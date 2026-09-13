'use strict';
/* v4.4.2 过载大招 验证 */
const H = require('./_harness');
const t = H.suite('过载大招');

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
    const out = {};
    g.start('normal');
    g.spawnQueue = []; g.boss = null; g.enemyBullets = [];
    g.state = 'playing'; g.player.alive = true; g.player.invuln = 999;
    g.player.x = 240; g.player.y = 620; g.player.hp = 100;
    g.overload = 0;
    // 1) 击坠充能:小怪 +2
    for (let i = 0; i < 5; i++) {
      const d0 = new Enemy('drone', 240, 1, null, null);
      d0.x = 240; d0.y = 300; d0.dead = true; g.enemies = [d0];
      g.waveDamageTaken = 0;
      g.killEnemy(d0);
      g.enemies = [];
    }
    out.charge = g.overload === 10;
    // 2) 未满 100 无法释放
    out.gated = g.overloadBurst() === false;
    // 3) 满 100 释放:全屏伤害 + 狂热 + 清弹
    g.overload = 100;
    const d1 = new Enemy('drone', 240, 1, null, null);
    d1.x = 240; d1.y = 300; d1.hp = 20; d1.maxHp = 20; d1.dead = false; g.enemies = [d1];
    g.enemyBullets = [{ x: 100, y: 100, vx: 0, vy: 50, r: 4, color: '#f', glow: '', dead: false }];
    const st = g.overloadBurst();
    out.released = st === true;
    out.dmg = d1.dead || d1.hp <= -10; // 20 - 30 → 死
    out.frenzy = g.buffs.frenzy >= 5;
    out.cleared = g.enemyBullets.length === 0;
    out.zeroed = g.overload <= 2; // 清零后爆发击杀又充少量
    // 4) HUD 能量条元素(game.render 不抛错即可)
    g.overload = 100; g.render();
    out.hudOk = true;
    g.state = 'menu';
    return out;
  });

  // G 键冒烟
  const p2 = await browser.newPage();
  H.watchErrors(p2, errors);
  await p2.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'networkidle' });
  const kb = await p2.evaluate(() => {
    const g = window.game;
    g.start('normal');
    g.state = 'playing'; g.player.alive = true; g.overload = 100;
    const before = g.overload;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyG' }));
    return { triggered: g.overload < before };
  });
  await p2.close();

  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }
  console.log(JSON.stringify(r), '键位:', JSON.stringify(kb));
  t.check(errors.length === 0, '无 JS 运行时异常');
  t.check(r.charge, '击坠充能 +2/架');
  t.check(r.gated, '未满 100 无法释放');
  t.check(r.released && r.dmg, '过载爆发:全屏 30 伤害');
  t.check(r.frenzy, '5s 狂热');
  t.check(r.cleared, '清空全场弹幕');
  t.check(r.zeroed && r.hudOk, '能量清零 + 能量条渲染');
  t.check(kb.triggered, 'G 键触发过载');
  t.finish();
})().catch(e => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
