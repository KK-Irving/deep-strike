'use strict';
/* v1.2.0 限时增益道具验证:×2 / 狂热 / 寒霜 / 磁力风暴 */
const H = require('./_harness');
const t = H.suite('限时增益');

(async () => {
  const server = await H.startServer();
  const port = server.address().port;
  const browser = await H.launch();
  const page = await browser.newPage();
  const errors = [];
  H.watchErrors(page, errors);
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
    // 4) 磁力风暴:全场吸取(密闭环境:清场+停刷怪+停火,避免波次生物掉落新晶体干扰计数)
    game.orbs.length = 0; game.powerups.length = 0; game.enemies.length = 0;
    game.spawnQueue.length = 0; game.waveQuota = 99999; game.trickleT = 999;
    game.autoFire = false;
    for (let i = 0; i < 5; i++) game.orbs.push(new XPOrb(20 + i * 100, 100, 2));
    game.powerups.push(new PowerUp(400, 150, 'bomb'));
    game.player.x = 240; game.player.y = 600; game.player.magnetR = 10;
    game._applyPower('magstorm');
    const allVac = game.orbs.every(o => o.vac) && game.powerups.every(p => p.vac);
    for (let i = 0; i < 240 && game.orbs.length + game.powerups.length > 0; i++) game.update(1 / 60);
    game.autoFire = true;
    out.magVac = allVac;
    out.magCollected = game.orbs.length + game.powerups.length === 0;
    // 5) 增益倒计时衰减
    game.buffs.x2 = 1;
    game.update(0.5);
    out.decay = game.buffs.x2 > 0.4 && game.buffs.x2 < 0.6;
    return out;
  });

  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }

  console.log('x2 击杀得分(期望200): ' + r.x2Pts);
  console.log('狂热间隔比(期望≈1): ' + r.frenzyCd);
  console.log('寒霜位移比(期望≈0.45): ' + r.frostRatio);
  console.log('磁力风暴 全部标记吸取: ' + r.magVac + ' · 全部被吸取: ' + r.magCollected);
  console.log('增益倒计时衰减: ' + r.decay);

  const check = t.check;
  check(errors.length === 0, '无 JS 运行时异常');
  check(r.x2Pts === 200, '×2 期间击杀得分翻倍');
  check(r.frenzyCd > 0.9 && r.frenzyCd < 1.1, '狂热使射击间隔 ×0.667');
  check(r.frostRatio > 0.3 && r.frostRatio < 0.6, '寒霜使敌机移动减速至 45%');
  check(r.magVac && r.magCollected, '磁力风暴全场吸取晶体与道具');
  check(r.decay, '限时增益随时间衰减');
  t.finish();
})().catch((e) => t.crash(e));
