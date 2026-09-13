'use strict';
/* v4.4.1 擦弹系统 验证 */
const H = require('./_harness');
const t = H.suite('擦弹系统');

(async () => {
  const server = await H.startServer();
  const port = server.address().port;
  const browser = await H.launch();
  const page = await browser.newPage();
  const errors = [];
  H.watchErrors(page, errors);
  await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  const r = await page.evaluate(() => {
    const g = window.game;
    g.start('normal');
    g.spawnQueue = []; g.enemies = []; g.boss = null;
    g.state = 'playing'; g.player.alive = true; g.player.invuln = 999;
    g.player.x = 240; g.player.y = 620; g.player.bombs = 2; g.grazeCount = 14;
    g.enemyBullets = [{ x: 258, y: 600, vx: 0, vy: 60, r: 4, color: '#f0f', glow: '', dead: false }];
    const bombsBefore = g.player.bombs;
    g.update(1 / 60);
    return {
      graze: g.grazeCount,
      grazedFlag: g.enemyBullets.length ? !!g.enemyBullets[0].grazed : 'gone',
      bombPlus: g.player.bombs - bombsBefore,
      hit: g.player.hp < 100
    };
  });

  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }
  console.log(JSON.stringify(r));
  t.check(errors.length === 0, '无 JS 运行时异常');
  t.check(r.graze === 15, '贴近弹计一次擦弹(14→15)');
  t.check(r.grazedFlag !== false, '弹标记 grazed 防重复');
  t.check(r.bombPlus === 1, '满 15 次奖励炸弹 +1');
  t.check(!r.hit, '擦弹带不判定命中');
  t.finish();
})().catch(e => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
