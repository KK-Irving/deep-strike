'use strict';
/* v1.2.0 限时增益道具验证:×2 / 狂热 / 寒霜 / 磁力风暴 */
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
    game.start('normal');
    game.player.invuln = 999;
    // 1) ×2 双倍得分
    const s0 = game.score;
    game.buffs.x2 = 10;
    game.score = 0;
    game.killEnemy(Object.assign(new Enemy('drone', 200, 1, null, null), { x: 200, y: 300 }));
    out.x2Pts = game.score;               // drone 100 分 × combo1 × 2 = 200
    game.score = s0;
    game.buffs.x2 = 0;
    // 2) 狂热:射速间隔缩短
    game.mods = {}; game._recalc();
    const baseInt = game.player.fireInterval;
    game.buffs.frenzy = 10;
    game.player.fireCd = -1; game.player.update(0.001, game);
    out.frenzyCd = Math.round((game.player.fireCd / (baseInt * 0.667)) * 100) / 100; // ≈1
    game.buffs.frenzy = 0;
    // 3) 寒霜:敌机移动减速 + 弹幕减速
    const e1 = new Enemy('drone', 240, 1, null, null); e1.y = 100; game.enemies.push(e1);
    const y0 = e1.y;
    for (let i = 0; i < 30; i++) game.update(1 / 60);
    const normalDy = e1.y - y0;
    game.enemies.length = 0;
    game.buffs.frost = 5;
    const e2 = new Enemy('drone', 240, 1, null, null); e2.y = 100; game.enemies.push(e2);
    const y1 = e2.y;
    for (let i = 0; i < 30; i++) game.update(1 / 60);
    const frostDy = e2.y - y1;
    game.enemies.length = 0; game.buffs.frost = 0;
    out.frostRatio = Math.round((frostDy / normalDy) * 100) / 100; // ≈0.45
    // 4) 磁力风暴:全场吸取
    game.orbs.length = 0; game.powerups.length = 0;
    for (let i = 0; i < 5; i++) game.orbs.push(new XPOrb(20 + i * 100, 100, 2));
    game.powerups.push(new PowerUp(400, 150, 'bomb'));
    game.player.x = 240; game.player.y = 600; game.player.magnetR = 10;
    game._applyPower('magstorm');
    const allVac = game.orbs.every(o => o.vac) && game.powerups.every(p => p.vac);
    for (let i = 0; i < 240 && game.orbs.length + game.powerups.length > 0; i++) game.update(1 / 60);
    out.magVac = allVac;
    out.magCollected = game.orbs.length + game.powerups.length === 0;
    // 5) 增益倒计时衰减
    game.buffs.x2 = 1;
    game.update(0.5);
    out.decay = game.buffs.x2 > 0.4 && game.buffs.x2 < 0.6;
    return out;
  });

  await browser.close();
  server.close();
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }

  console.log('x2 击杀得分(期望200): ' + r.x2Pts);
  console.log('狂热间隔比(期望≈1): ' + r.frenzyCd);
  console.log('寒霜位移比(期望≈0.45): ' + r.frostRatio);
  console.log('磁力风暴 全部标记吸取: ' + r.magVac + ' · 全部被吸取: ' + r.magCollected);
  console.log('增益倒计时衰减: ' + r.decay);

  let bad = 0;
  const check = (cc, m) => { if (cc) console.log('ok: ' + m); else { console.error('FAIL: ' + m); bad++; } };
  check(errors.length === 0, '无 JS 运行时异常');
  check(r.x2Pts === 200, '×2 期间击杀得分翻倍');
  check(r.frenzyCd > 0.9 && r.frenzyCd < 1.1, '狂热使射击间隔 ×0.667');
  check(r.frostRatio > 0.3 && r.frostRatio < 0.6, '寒霜使敌机移动减速至 45%');
  check(r.magVac && r.magCollected, '磁力风暴全场吸取晶体与道具');
  check(r.decay, '限时增益随时间衰减');
  console.log(bad ? ('\nFAILED: ' + bad) : '\n限时增益验证完成');
  process.exitCode = bad ? 1 : 0;
})().catch((e) => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
