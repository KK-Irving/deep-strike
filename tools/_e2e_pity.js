'use strict';
/* v1.2.2 密匣保底(pity)验证:40 抽必出绚丽 / 10 抽必出稀有 / 计数重置 / 荣耀秘匣不受影响 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const fp = path.join(ROOT, p);
      if (!fp.startsWith(ROOT) || !fs.existsSync(fp)) { res.statusCode = 404; res.end('404'); return; }
      res.setHeader('Content-Type', MIME[path.extname(fp)] || 'application/octet-stream');
      fs.createReadStream(fp).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

(async () => {
  const server = await startServer();
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'networkidle' });

  const r = await page.evaluate(() => {
    const out = {};
    // 常备星晶
    const free = () => { Shop.crystal = 99999999; };
    // 1) 40 抽保底:构造 39 抽未出绚丽,下一抽(即使抽到 junk/common/rare)必升为绚丽
    free();
    Shop.pityEpic = 39; Shop.pityRare = 0;
    let res = Shop._boxDropBoosted(0);
    out.epicPity = res.tier === 'epic' || res.tier === 'mythic';
    out.epicReset = Shop.pityEpic === 0 && Shop.pityRare === 0;
    // 2) 10 抽保底:构造 9 抽未出稀有+,下一抽必为稀有以上
    Shop.pityEpic = 0; Shop.pityRare = 9;
    res = Shop._boxDropBoosted(0);
    out.rarePity = ['rare', 'epic', 'mythic'].includes(res.tier);
    out.rareEpicCounter = Shop.pityEpic; // 稀有命中时 epic 计数应 +1(=1)
    out.rareReset = Shop.pityRare === 0;
    // 3) 普通低抽计数:junk 累加双计数
    Shop.pityEpic = 0; Shop.pityRare = 0;
    let junkN = 0;
    for (let i = 0; i < 60 && junkN < 1; i++) {
      res = Shop._boxDropBoosted(0);
      if (res.tier === 'junk' || res.tier === 'common') junkN++;
      else break;
    }
    out.lowInc = (res.tier === 'junk' || res.tier === 'common') ? Shop.pityEpic === 1 && Shop.pityRare === 1 : true;
    // 4) 荣耀秘匣不影响保底计数
    Shop.pityEpic = 7; Shop.pityRare = 3;
    Shop.chips = 9999;
    Shop._grantGlory();
    out.gloryKeepsPity = Shop.pityEpic === 7 && Shop.pityRare === 3;
    // 5) 批量开箱不越界:40 抽内必有绚丽(从 0 计数开始,连续开 60 抽统计绚丽间隔)
    Shop.pityEpic = 0; Shop.pityRare = 0;
    free();
    let sinceEpic = 0, maxGap = 0;
    for (let i = 0; i < 200; i++) {
      res = Shop._boxDropBoosted(0);
      sinceEpic++;
      if (res.tier === 'epic' || res.tier === 'mythic') { maxGap = Math.max(maxGap, sinceEpic); sinceEpic = 0; }
      // 拥有全部后 _grantPool 会折算星晶,tier 依旧成立
    }
    out.maxGap = maxGap;
    out.gapOk = maxGap <= 40;
    return out;
  });

  await browser.close();
  server.close();
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }

  console.log('39 抽兜底出绚丽: ' + r.epicPity + ' · 双计数重置: ' + r.epicReset);
  console.log('9 抽兜底出稀有+: ' + r.rarePity + ' · 稀有命中时 epic 计数+1: ' + r.rareEpicCounter + ' · 稀有计数重置: ' + r.rareReset);
  console.log('低阶命中累加计数: ' + r.lowInc);
  console.log('荣耀秘匣不消耗保底: ' + r.gloryKeepsPity);
  console.log('200 抽内绚丽最大间隔: ' + r.maxGap + '(阈值 40)');

  let bad = 0;
  const check = (cc, m) => { if (cc) console.log('ok: ' + m); else { console.error('FAIL: ' + m); bad++; } };
  check(errors.length === 0, '无 JS 运行时异常');
  check(r.epicPity && r.epicReset, '40 抽保底必出绚丽并重置双计数');
  check(r.rarePity && r.rareReset, '10 抽保底必出稀有+并重置稀有计数');
  check(r.rareEpicCounter === 1, '稀有命中时绚丽计数照常累加');
  check(r.lowInc, 'junk/common 命中累加双计数');
  check(r.gloryKeepsPity, '荣耀秘匣不消耗/不重置保底');
  check(r.gapOk, '长时间连续开箱绚丽间隔不超过 40 抽');
  console.log(bad ? ('\nFAILED: ' + bad) : '\n密匣保底验证完成');
  process.exitCode = bad ? 1 : 0;
})().catch((e) => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
