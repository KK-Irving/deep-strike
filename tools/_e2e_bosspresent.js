'use strict';
/* v1.9.7 BOSS 演出强化(Phase 4.2)验证:登场敌弹折算星晶/清场/前摇判定/演出层渲染冒烟 */
const H = require('./_harness');
const t = H.suite('BOSS 演出');

(async () => {
  const server = await H.startServer();
  const port = server.address().port;
  const browser = await H.launch();
  const url = 'http://127.0.0.1:' + port + '/index.html';
  const page = await browser.newPage();
  const errors = [];
  H.watchErrors(page, errors);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  const r = await page.evaluate(() => {
    const g = window.game;
    const out = {};
    // 1) 登场折算:22 颗敌弹 → 清空 + 4★
    g.start('normal');
    g.spawnQueue = []; g.waveQuota = 999999; g.autoFire = false; g.keys.fire = false; g.enemies = []; g.boss = null;
    g.enemyBullets = [];
    for (let i = 0; i < 22; i++) g.enemyBullets.push({ x: 100 + i * 6, y: 100 + i * 3, vx: 0, vy: 40, r: 4, color: '#f0f', glow: '', dead: false });
    const c0 = Shop.crystal;
    g.enemyBullets._pushing = true;
    // 直接走 spawn 通路:构造 boss 入队并推进 waveTime
    g.spawnQueue = [{ boss: true, t: 0 }];
    g.waveTime = 0.01;
    for (let i = 0; i < 3; i++) g.update(1 / 60);
    out.cleared = g.enemyBullets.length === 0;
    out.stars = Shop.crystal - c0 === 4;
    out.bossIn = !!g.boss;
    // 2) 前摇判定
    out.teleDread = g._bossTelegraphOn({ state: 'fight', fireCd: 0.3, variant: 'dread' }) === true;
    out.teleTyrant0 = g._bossTelegraphOn({ state: 'fight', fireCd: 0.3, variant: 'tyrant', phase: 0 }) === true;
    out.teleTyrant1 = g._bossTelegraphOn({ state: 'fight', fireCd: 0.3, variant: 'tyrant', phase: 1 }) === false;
    out.teleOff = g._bossTelegraphOn({ state: 'enter', fireCd: 0.3, variant: 'dread' }) === false
      && g._bossTelegraphOn({ state: 'fight', fireCd: 0.8, variant: 'dread' }) === false;
    // 3) 演出层渲染冒烟:enter 与 fight(dread, fireCd<0.55)各渲染一帧不抛错
    g.boss.state = 'enter';
    g.render();
    g.boss.state = 'fight';
    g.boss.variant = 'dread';
    g.boss.fireCd = 0.3;
    g.render();
    out.renderOk = true;
    g.state = 'menu';
    return out;
  });

  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }
  console.log(JSON.stringify(r));
  t.check(errors.length === 0, '无 JS 运行时异常');
  t.check(r.cleared, '登场瞬间敌弹清场');
  t.check(r.stars, '敌弹折算星晶(22 弹 → 4★)');
  t.check(r.bossIn, '旗舰正常生成');
  t.check(r.teleDread && r.teleTyrant0 && r.teleTyrant1 && r.teleOff, '前摇警示判定(要塞任意阶段/暴君一阶段,其余关闭)');
  t.check(r.renderOk, '演出层渲染冒烟');
  t.finish();
})().catch((e) => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
