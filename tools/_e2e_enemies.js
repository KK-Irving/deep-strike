'use strict';
/* 敌机强度/丰富度验证(feature #4):
 *  1) 敌方弹幕伤害 enemyDmg 随波次显著增长(w20 > w1),且封顶合理;
 *  2) 橙色狙击弹伤害更高;
 *  3) 出怪配额随波次增长(w14 明显多于 w3,均为非 BOSS 波);
 *  4) 新增「母舰 carrier」:血厚且 update 会周期释放无人机;
 *  5) 全程无 JS 异常。 */
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
    const g = window.game;
    g.start();

    g.wave = 1; const dmgW1 = g.enemyDmg('pink'); const dmgW1o = g.enemyDmg('orange');
    g.wave = 20; const dmgW20 = g.enemyDmg('pink'); const dmgW20o = g.enemyDmg('orange');
    g.wave = 60; const dmgW60 = g.enemyDmg('pink');

    function countSpawns(wave) {
      g.enemies = []; g.spawnQueue = [];
      g.wave = wave;
      g.startWave(wave);
      return g.spawnQueue.length;
    }
    const spawnW3 = countSpawns(3);
    const spawnW14 = countSpawns(14);

    g.wave = 8; g.enemies = []; g.enemyBullets = []; g.rings = g.rings || [];
    const carrier = new Enemy('carrier', 240, 8, null, g._env || { hpMul: 1, spdMul: 1, fireMul: 1 });
    carrier.stopped = true; carrier.y = 120; carrier.spawnCd = 0.01;
    g.enemies = [carrier];
    const before = g.enemies.length;
    for (let i = 0; i < 30; i++) carrier.update(1 / 60, g);
    const after = g.enemies.length;
    const spawnedDrones = g.enemies.filter(e => e !== carrier && e.type === 'drone').length;
    const carrierHp = carrier.maxHp;

    g.state = 'menu';
    return { dmgW1, dmgW1o, dmgW20, dmgW20o, dmgW60, spawnW3, spawnW14, before, after, spawnedDrones, carrierHp };
  });

  await browser.close();
  server.close();
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }

  console.log('弹幕伤害 w1=' + result.dmgW1 + ' w20=' + result.dmgW20 + ' w60=' + result.dmgW60
    + ' (橙 w1=' + result.dmgW1o + ' w20=' + result.dmgW20o + ')');
  console.log('出怪配额 w3=' + result.spawnW3 + ' w14=' + result.spawnW14);
  console.log('母舰释放:before=' + result.before + ' after=' + result.after + ' 无人机=' + result.spawnedDrones + ' 母舰血=' + result.carrierHp);

  let bad = 0;
  const check = (c, m) => { if (c) console.log('ok: ' + m); else { console.error('FAIL: ' + m); bad++; } };
  check(errors.length === 0, '无 JS 运行时异常');
  check(result.dmgW20 > result.dmgW1, '弹幕伤害随波次增长(w20>w1)');
  check(result.dmgW60 >= result.dmgW20, '弹幕伤害持续增长/封顶(w60>=w20)');
  check(result.dmgW60 <= 60, '弹幕伤害有合理上限(<=60)');
  check(result.dmgW20o > result.dmgW20, '橙色狙击弹伤害更高');
  check(result.spawnW14 > result.spawnW3, '出怪配额随波次增长(w14>w3)');
  check(result.carrierHp >= 16, '母舰血量厚(>=16)');
  check(result.spawnedDrones >= 2, '母舰周期释放无人机(>=2)');
  console.log(bad ? ('\nFAILED: ' + bad) : '\n敌机强度/丰富度验证完成');
  process.exitCode = bad ? 1 : 0;
})().catch((e) => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });