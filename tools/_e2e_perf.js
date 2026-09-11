'use strict';
/* v2.2.1 性能冒烟:压力场景(满屏敌机+弹幕+粒子)固定步进,平均帧耗时必须 < 16ms(60fps 线) */
const H = require('./_harness');
const t = H.suite('性能冒烟');

(async () => {
  const server = await H.startServer();
  const port = server.address().port;
  const browser = await H.launch();
  const page = await browser.newPage();
  const errors = [];
  H.watchErrors(page, errors);
  await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  const r = await page.evaluate(() => {
    const g = window.game;
    g.start('mayhem');                 // 大乱斗:开表最强(改装件/符文全开)
    g.tunings = { armorT: 3, wingT: 3, sideT: 3 };
    g.augments = { a_urf: 3, a_comet: 2, a_coil: 2, a_army: 3 };
    g._recalc();
    g.spawnQueue = []; g.waveQuota = 999999; g.waveClearT = -1;
    g.state = 'playing';
    // 压力铺场:45 敌机 + 180 敌弹 + 满 rubbles
    g.enemies = [];
    for (let i = 0; i < 45; i++) {
      const e0 = new Enemy(['drone', 'waver', 'sniper', 'tank'][i % 4], 40 + (i % 11) * 40, 12, null, g._env);
      e0.x = 40 + (i % 11) * 40; e0.y = 80 + Math.floor(i / 11) * 60;
      g.enemies.push(e0);
    }
    g.enemyBullets = [];
    for (let i = 0; i < 180; i++)
      g.enemyBullets.push({ x: 20 + (i % 24) * 20, y: 60 + Math.floor(i / 24) * 40, vx: 0, vy: 120, r: 4, color: '#f0f', glow: '', dead: false });
    g.autoFire = true; g.keys.fire = true;
    g.player.x = 240; g.player.y = 600; g.player.invuln = 999; g.player.alive = true;
    const dt = 1 / 60;
    // 预热 30 帧(JIT 编译/GC 尖峰不计入)
    for (let i = 0; i < 30; i++) { g.update(dt); g.render(); }
    // 压力计测:固定 dt 步进 120 帧(含完整 update+render)
    let worst = 0, sum = 0;
    for (let i = 0; i < 120; i++) {
      const t0 = performance.now();
      g.update(dt);
      g.render();
      const ms = performance.now() - t0;
      sum += ms;
      if (ms > worst) worst = ms;
      g.enemies = g.enemies.filter(e0 => !e0.dead);
      if (g.enemies.length < 45) { // 保持压力:补充敌机
        for (let k = g.enemies.length; k < 45; k++) {
          const e0 = new Enemy('drone', 40 + (k % 11) * 40, 12, null, g._env);
          e0.x = 40 + (k % 11) * 40; e0.y = 80 + Math.floor(k / 11) * 60;
          g.enemies.push(e0);
        }
      }
    }
    g.state = 'menu';
    return { avg: +(sum / 120).toFixed(2), worst: +worst.toFixed(2) };
  });

  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }
  t.info('压力场景(45 敌机 + 180 弹 + 满符文改装): 平均 ' + r.avg + 'ms/帧 · 最差 ' + r.worst + 'ms/帧(60fps 线 = 16.7ms)');
  t.check(errors.length === 0, '无 JS 运行时异常');
  t.check(r.avg < 16, '平均帧耗时 < 16ms(实际 ' + r.avg + 'ms)');
  t.check(r.worst < 100, '最差帧 < 100ms(V8 GC 暂停尖峰,实际 ' + r.worst + 'ms)');
  t.finish();
})().catch((e) => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
