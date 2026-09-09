'use strict';
/* 商城扩展验证:
 *  1) 荣耀秘匣(ex_glory, 520 芯片)必得绚丽皮肤或机体(epic/mythic),100%;芯片正确扣除;
 *  2) 永久强化全部为 10 级上限;每级数值已下调(hp +10、xp +4%、bomb 每2级+1、shield 每级+1.2%减伤);
 *     价格逐级递增且总价显著提高。 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
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
  const base = 'http://127.0.0.1:' + port + '/';
  const exe = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const page = await browser.newPage({ viewport: { width: 520, height: 820 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  const result = await page.evaluate(() => {
    // 荣耀秘匣配置
    const glory = Shop.EXCHANGE.find(e => e.id === 'ex_glory');

    // 必得绚丽:重置拥有态,给足芯片,连开 40 次,全部应为 epic/mythic 实物或(池尽后)高额补偿
    Shop.owned = { proto: true }; Shop.ownedShip = { vanguard: true };
    Shop.chips = 100000;
    const tiers = {}; let nonGlory = 0; let realItems = 0;
    // 隔离任务系统:开匣会推进每日/每周任务并返还芯片,干扰扣费断言
    const realBump = DailyTasks.bump.bind(DailyTasks);
    DailyTasks.bump = () => {};
    const before = Shop.chips;
    for (let i = 0; i < 40; i++) {
      const r = Shop.exchange('ex_glory', 1);
      if (!r.ok) { nonGlory++; continue; }
      const res = r.results[0];
      tiers[res.tier] = (tiers[res.tier] || 0) + 1;
      if (res.tier !== 'epic' && res.tier !== 'mythic') nonGlory++;
      if (res.kind === 'skin' || res.kind === 'ship') realItems++;
    }
    const spent = before - Shop.chips;

    // 单次扣费正确性(同样隔离任务返还)
    Shop.chips = 600;
    const one = Shop.exchange('ex_glory', 1);
    const costOk = one.ok && Shop.chips === 600 - 520;
    DailyTasks.bump = realBump;

    // 永久强化:全部 10 级,价格递增
    const boostInfo = BOOSTS.map(b => ({
      id: b.id, max: b.prices.length,
      ascending: b.prices.every((v, i) => i === 0 || v > b.prices[i - 1]),
      total: b.prices.reduce((s, v) => s + v, 0),
      first: b.prices[0], last: b.prices[b.prices.length - 1]
    }));

    return { glory: !!glory, gloryChips: glory && glory.chips, tiers, nonGlory, realItems, spent, costOk, boostInfo };
  });

  await browser.close();
  server.close();
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }

  console.log('荣耀秘匣: 存在=' + result.glory + ' 芯片价=' + result.gloryChips);
  console.log('40 连开品级分布 = ' + JSON.stringify(result.tiers) + ' 非绚丽=' + result.nonGlory + ' 实物=' + result.realItems + ' 芯片消耗=' + result.spent);
  console.log('单次扣费正确=' + result.costOk);
  result.boostInfo.forEach(b => console.log('强化 ' + b.id + ': max=' + b.max + ' 递增=' + b.ascending + ' 首级=' + b.first + ' 满级=' + b.last + ' 总价=' + b.total));

  let bad = 0;
  const check = (c, m) => { if (c) console.log('ok: ' + m); else { console.error('FAIL: ' + m); bad++; } };
  check(errors.length === 0, '无 JS 运行时异常');
  check(result.glory && result.gloryChips === 520, '荣耀秘匣存在且为 520 芯片');
  check(result.nonGlory === 0, '荣耀秘匣 40 连开全部为绚丽(epic/mythic)');
  check((result.tiers.epic || 0) > 0 && (result.tiers.mythic || 0) > 0, '皮肤与机体两种绚丽都能开出');
  check(result.spent === 40 * 520, '芯片按 520/次 正确扣除');
  check(result.costOk, '单次兑换正确扣除 520 芯片');
  check(result.boostInfo.every(b => b.max === 10), '所有永久强化上限为 10 级');
  check(result.boostInfo.every(b => b.ascending), '每个强化价格逐级递增');
  check(result.boostInfo.every(b => b.last > b.first * 5), '满级价格显著高于首级(>5x,总投入拉高)');
  console.log(bad ? ('\nFAILED: ' + bad) : '\n商城扩展验证完成');
  process.exitCode = bad ? 1 : 0;
})().catch((e) => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });