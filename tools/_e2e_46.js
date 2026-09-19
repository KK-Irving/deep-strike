'use strict';
/* v4.6.0 玩法四项整改 验证 */
const H = require('./_harness');
const t = H.suite('v4.6.0 玩法整改');

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
    // ① 放弃:次数/补偿/等级真实丢失
    g.start('normal');
    g.spawnQueue = []; g.enemies = []; g.boss = null;
    g.autoFire = false; g.keys.fire = false;
    g.state = 'playing'; g.player.alive = true; g.player.invuln = 999;
    g.abandonLeft = 2; g.rerollLeft = 1;
    g.pendingLevels = 1; g.openLevelup();
    const crystal0 = Shop.crystal, score0 = g.score;
    g.abandonUpgrade();
    out.abandon = g.pendingLevels === 0 && g.abandonLeft === 1 && g.state === 'playing'
      && Shop.crystal === crystal0 + 10 && g.score === score0 + 150;
    // 再放弃:次数用尽
    g.pendingLevels = 1; g.openLevelup();
    g.abandonUpgrade();
    g.pendingLevels = 1; g.openLevelup();
    g.abandonUpgrade();
    out.abandonCap = g.abandonLeft === 0 && g.pendingLevels === 1; // 第三次无效
    g.skipUpgrade();
    // 刷新:重抽候选且次数递减
    g.pendingLevels = 1; g.openLevelup();
    const before = (g._cardChoices || []).map(c => c.id).join(',');
    let changed = false;
    for (let i = 0; i < 30 && !changed; i++) { g.rerollChoices(); if ((g._cardChoices || []).map(c => c.id).join(',') !== before) changed = true; }
    out.reroll = changed && g.rerollLeft === 0 && g.pendingLevels === 1; // 等级不丢
    g.skipUpgrade();
    // ② 过载差异化:伤害 60 + 3 段余波
    g.overload = 100;
    const d1 = new Enemy('drone', 240, 1, null, null);
    d1.x = 240; d1.y = 300; d1.hp = 70; d1.maxHp = 70; d1.dead = false; g.enemies = [d1];
    g.enemyBullets = [];
    g.overloadBurst();
    out.burst60 = d1.hp === 10; // 60 伤害生效(70→10)
    out.pulse = g.overloadPulse === 3;
    // 余波 tick 清剩余敌机
    const d2 = new Enemy('drone', 240, 1, null, null);
    d2.x = 240; d2.y = 300; d2.hp = 100; d2.dead = false; g.enemies = [d2];
    for (let i = 0; i < 130 && !d2.dead; i++) g.update(1 / 60); // 3 段 ×0.6s = 108 帧
    out.pulseDmg = d2.dead; // 3 段 ×40 必杀
    g.overloadPulse = 0;
    g.enemies = [];
    g.state = 'menu';
    return out;
  });

  // ③ 进化卡视觉:evo-card 动画样式存在
  const cssOk = await page.evaluate(() => {
    const sheet = [...document.styleSheets].find(s => s.href && s.href.includes('style.css'));
    const rules = sheet ? [...sheet.cssRules].map(x => x.cssText).join('\n') : '';
    return rules.includes('.card.evo-card') && rules.includes('evoPulse');
  });
  // ④ 永久强化:炸弹相关仅 2 条(bomb1/cap0),新增移速/射速对齐(检查 BOOSTS)
  const boosts = await page.evaluate(() => BOOSTS.map(b => b.id));

  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }
  console.log(JSON.stringify(r), 'boosts:', boosts.join(','), 'cssEvo:', cssOk);
  t.check(errors.length === 0, '无 JS 运行时异常');
  t.check(r.abandon, '放弃:次数-1/补偿 150分+10★/等级真实丢失');
  t.check(r.abandonCap, '放弃每局限 2 次');
  t.check(r.reroll, '刷新:重抽候选且等级保留,每局限 1 次');
  t.check(r.burst60 && r.pulse && r.pulseDmg, 'G 过载差异化:60 伤害+3 段余波(K 为瞬时 8~23)');
  t.check(cssOk, '进化卡专属动画样式(evoPulse)');
  t.finish();
})().catch(e => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
