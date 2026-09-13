'use strict';
/* v4.4.0 闪避冲刺 验证 */
const H = require('./_harness');
const t = H.suite('闪避冲刺');

(async () => {
  const server = await H.startServer();
  const port = server.address().port;
  const browser = await H.launch();
  const url = 'http://127.0.0.1:' + port + '/index.html';
  const page = await browser.newPage();
  const errors = [];
  H.watchErrors(page, errors);
  await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  const r = await page.evaluate(() => {
    const g = window.game;
    const out = {};
    g.start('normal');
    g.spawnQueue = []; g.enemies = []; g.boss = null; g.enemyBullets = [];
    g.state = 'playing'; g.player.alive = true;
    g.player.x = 240; g.player.y = 620; g.player.invuln = 0;
    // 1) 默认向上闪:位移约 1400*0.18=252,但会被 clamp
    const ok1 = g.playerDash();
    out.invuln = g.player.invuln >= 0.25; // 冲刺瞬间即有无敌帧
    for (let i = 0; i < 12; i++) g.update(1 / 60);
    const moved = 620 - g.player.y;
    out.dash = ok1 && moved > 150 && moved <= 260;
    out.cd = Math.abs(g.player.dashCd - 2.5) < 0.2;
    // 2) 冷却期无法再次冲刺
    g.player.y = 620;
    const ok2 = g.playerDash();
    out.cooldownBlock = !ok2 && Math.abs(g.player.y - 620) < 1;
    // 3) 冷却结束可再冲
    g.player.dashCd = 0;
    g.keys.right = true;                      // 向右闪
    const ok3 = g.playerDash('right');
    g.keys.right = false;
    for (let i = 0; i < 12; i++) g.update(1 / 60);
    out.dirRight = ok3 && g.player.x > 240 + 100;
    // 4) 冲刺期间无敌帧:弹幕命中被 invuln 挡下
    g.player.x = 240; g.player.y = 620; g.player.hp = 100;
    g.player.dashCd = 0;
    g.playerDash();
    const hp0 = g.player.hp;
    g._playerHit(25);
    out.iFrames = g.player.hp === hp0;
    g.state = 'menu';
    return out;
  });

  // 键位冒烟
  const p2 = await browser.newPage();
  H.watchErrors(p2, errors);
  await p2.goto(url, { waitUntil: 'networkidle' });
  const kb = await p2.evaluate(() => {
    const g = window.game;
    g.start('normal');
    g.state = 'playing'; g.player.alive = true;
    g.player.x = 240; g.player.y = 620; g.player.dashCd = 0;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX' }));
    return { dashT: g.player.dashT > 0 || g.player.dashCd > 0 };
  });
  await p2.close();

  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }
  console.log(JSON.stringify(r), '键位:', JSON.stringify(kb));
  t.check(errors.length === 0, '无 JS 运行时异常');
  t.check(r.dash, '冲刺位移(约 250px)');
  t.check(r.invuln, '冲刺无敌帧 0.3s');
  t.check(r.cd, '冷却 2.5s');
  t.check(r.cooldownBlock, '冷却期禁止冲刺');
  t.check(r.dirRight, '方向参数冲刺');
  t.check(r.iFrames, '冲刺期间免疫伤害');
  t.check(kb.dashT, 'X 键触发冲刺');
  t.finish();
})().catch(e => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
