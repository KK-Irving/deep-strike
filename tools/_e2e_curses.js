'use strict';
/* v1.4.2 诅咒风险卡验证:玻璃大炮/脆刃/贪婪契约 数值与结算、低权重入池、红色描边、成就 */
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
    // 1) 玻璃大炮(5 级制):满级 5 = 伤害 ×2、生命 ×0.6;1 级 = +20%/-8%;进化净化减半
    game.start('normal');
    const hpBase = game.player.maxHp;
    game.mods = { glass: 5 };
    game._recalc();
    out.glassMul = Math.abs(game.player.dmgMul - 2) < 1e-9;
    out.glassHp = Math.abs(game.player.maxHp - Math.round(hpBase * 0.6)) <= 1;
    game.mods = { glass: 1 };
    game._recalc();
    out.glassLv1 = Math.abs(game.player.dmgMul - 1.2) < 1e-9 && Math.abs(game.player.maxHp / hpBase - 0.92) < 0.02;
    game.mods = { glass: 5 }; game.evo = { glass: true };
    game._recalc();
    out.glassPurify = Math.abs(game.player.dmgMul - 2) < 1e-9 && Math.abs(game.player.maxHp / hpBase - 0.8) < 0.02;
    game.evo = {};
    // 2) 脆刃(5 级制):满级 5 = 受击 ×1.5
    game.mods = { brittle: 5 };
    game._recalc();
    game.player.invuln = 0; game.player.shield = false; game.player.chillT = 0;
    game.player.maxHp = 1000; game.player.hp = 1000;
    game.enemies.length = 0;
    game._playerHit(100);
    out.brittleTaken = game.player.hp === 1000 - 150;
    // 3) 贪婪契约(5 级制):满级 5 = 敌弹 ×1.15、得分/星晶 ×1.5
    game.mods = { pact: 5 };
    game.buffs = { x2: 0, frenzy: 0, frost: 0, jam: 0 };
    game.score = 0; game.combo = 0;
    game._recalc();
    out.pactSlow = Math.abs(game.bulletSlow - 1.15) < 0.001;
    const e0 = Object.assign(new Enemy('drone', 240, 1, null, null), { x: 240, y: 300 });
    game.killEnemy(e0);
    out.pactScore = game.score === 150; // drone 100 × combo1 × 1.5
    // 4) 星晶结算 +50%
    game.mode = 'normal'; game.score = 16000; game.runBossKills = 0; game.runEliteKills = 0;
    game.relics = {}; game.state = 'playing';
    game._gameover();
    out.pactCrystal = Shop.lastEarn === 9; // 6 × 1.5
    // 5) 诅咒卡入池(低权重,300 次抽卡至少出现一次)
    let seen = false;
    for (let i = 0; i < 300 && !seen; i++) {
      const picks = drawUpgradeCards({}, 5, 1, null);
      seen = picks.some(p => p.curse);
    }
    out.inPool = seen;
    // 6) 携带诅咒抵达 10 波 → 成就
    game.start('normal');
    game.mods = { glass: 1 };
    game.startWave(10);
    out.ach = !!Ach.unlocked['curse_10'];
    return out;
  });

  // 7) 诅咒卡红色描边(渲染层)
  const cssOk = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8').indexOf('.card.curse') >= 0;

  await page.close();
  await browser.close();
  server.close();
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }

  console.log('玻璃大炮 伤害×2: ' + r.glassMul + ' · 生命×0.6: ' + r.glassHp);
  console.log('脆刃 受击×1.5: ' + r.brittleTaken);
  console.log('贪婪契约 敌弹加速: ' + r.pactSlow + ' · 击杀得分×1.5: ' + r.pactScore + ' · 星晶×1.5: ' + r.pactCrystal);
  console.log('诅咒卡入池: ' + r.inPool + ' · 红色描边样式: ' + cssOk);
  console.log('与狼共舞成就: ' + r.ach);

  let bad = 0;
  const check = (cc, m) => { if (cc) console.log('ok: ' + m); else { console.error('FAIL: ' + m); bad++; } };
  check(errors.length === 0, '无 JS 运行时异常');
  check(r.glassMul && r.glassHp, '玻璃大炮:伤害 ×2 / 生命上限 ×0.6');
  check(r.brittleTaken, '脆刃:受到伤害 ×1.5');
  check(r.pactSlow && r.pactScore && r.pactCrystal, '贪婪契约:敌弹加速 + 得分/星晶 ×1.5');
  check(r.inPool, '诅咒卡以低权重进入卡池');
  check(cssOk, '诅咒卡红色描边样式就绪');
  check(r.ach, '与狼共舞成就正常解锁');
  console.log(bad ? ('\nFAILED: ' + bad) : '\n诅咒风险卡验证完成');
  process.exitCode = bad ? 1 : 0;
})().catch((e) => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
