'use strict';
/* v1.2.1 干扰机 + 精英词缀(吸血/凝滞)验证 */
const H = require('./_harness');
const t = H.suite('干扰机与词缀');

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
    // 1) 干扰机脉冲:范围内玩家受干扰
    const j = new Enemy('jammer', 240, 9, null, null);
    j.y = j.stopY = 300; j.stopped = true; j.pulseCd = 0.01;
    game.enemies.push(j);
    game.player.x = 240; game.player.y = 380; // 距离 80 < 190
    game.buffs.jam = 0;
    for (let i = 0; i < 20 && game.buffs.jam <= 0; i++) game.update(1 / 60);
    out.jamTriggered = game.buffs.jam > 0;
    // 干扰使射击间隔 ×1.8
    game.mods = {}; game._recalc();
    const baseInt = game.player.fireInterval;
    game.player.fireCd = -1; game.player.update(0.001, game);
    out.jamCdRatio = Math.round((game.player.fireCd / (baseInt * 1.8)) * 100) / 100; // ≈1
    // 干扰时磁吸范围缩短:远处道具不被吸引
    game.powerups.length = 0;
    game.player.magnetR = 400;
    game.buffs.jam = 5;
    const pu = new PowerUp(240, 300, 'bomb'); // 距玩家 300:正常 400 内会被吸,受干扰(50)不会
    game.powerups.push(pu);
    const py0 = pu.y;
    for (let i = 0; i < 30; i++) game.update(1 / 60);
    out.magnetBlocked = pu.y > py0; // 仍下落 = 未被吸
    game.buffs.jam = 0; game.powerups.length = 0; game.enemies.length = 0;
    // 2) 凝滞词缀:受击后玩家迟缓
    const ce = new Enemy('drone', 400, 3, ['chill'], null);
    ce.y = 200; game.enemies.push(ce);
    game.player.invuln = 0; game.player.chillT = 0; game.player.shield = false;
    game.player.hp = game.player.maxHp; // 保证受击不死
    game._playerHit(5);
    out.chillTriggered = game.player.chillT > 0;
    // 迟缓时移动速度 60%(先回到屏幕左侧,避免撞到边界钳制影响位移)
    let dNorm = 0, dChill = 0;
    game.player.chillT = 0;
    game.player.x = 100;
    for (let i = 0; i < 30; i++) { game.keys.right = true; const x0 = game.player.x; game.player.update(1 / 60, game); dNorm += game.player.x - x0; }
    game.keys.right = false;
    game.player.chillT = 2;
    game.player.x = 100;
    for (let i = 0; i < 30; i++) { game.keys.right = true; const x0 = game.player.x; game.player.update(1 / 60, game); dChill += game.player.x - x0; }
    game.keys.right = false;
    game.player.chillT = 0;
    out.chillRatio = Math.round((dChill / dNorm) * 100) / 100; // ≈0.6
    game.enemies.length = 0;
    // 3) 吸血词缀:接触玩家回复自身生命(固定坐标,清空弹幕,排除干扰)
    game.player.x = 240; game.player.y = 600;
    game.player.invuln = 0; game.player.shield = false; game.player.hp = game.player.maxHp;
    game.playerBullets.length = 0; game.enemyBullets.length = 0; game.enemies.length = 0;
    const ve = new Enemy('tank', 240, 1, ['vampiric'], null);
    ve.x = 240; ve.y = 585; ve.hp = 10; // 与玩家仅距 15(<33 判定圈),压低血量便于观察回复
    game.enemies.push(ve);
    const vhp0 = ve.hp;
    game._collide();
    out.vampHealed = !ve.dead && ve.hp > vhp0;
    out.vampHealReal = ve.dead ? null : Math.round(ve.hp - vhp0);
    return out;
  });

  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }

  console.log('干扰触发: ' + r.jamTriggered + ' · 间隔比(期望≈1): ' + r.jamCdRatio);
  console.log('干扰时磁吸被阻断: ' + r.magnetBlocked);
  console.log('凝滞触发: ' + r.chillTriggered + ' · 迟缓速度比(期望≈0.6): ' + r.chillRatio);
  console.log('吸血接触回复: ' + r.vampHealed + (r.vampHealReal != null ? ' (+' + r.vampHealReal + ')' : ' (一击致死路径)'));

  const check = t.check;
  check(errors.length === 0, '无 JS 运行时异常');
  check(r.jamTriggered, '干扰机脉冲使玩家受干扰');
  check(r.jamCdRatio > 0.9 && r.jamCdRatio < 1.1, '受干扰射击间隔 ×1.8');
  check(r.magnetBlocked, '受干扰时磁吸失效(道具不再被吸)');
  check(r.chillTriggered, '凝滞精英在场时受击触发迟缓');
  check(r.chillRatio > 0.5 && r.chillRatio < 0.7, '迟缓时移动速度 60%');
  check(r.vampHealed, '吸血词缀接触玩家回复自身');
  t.finish();
})().catch((e) => t.crash(e));
