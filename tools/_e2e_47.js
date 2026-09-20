'use strict';
/* v4.7.0 六项玩法整改 验证(幂等版补丁后的最终形态) */
const H = require('./_harness');
const t = H.suite('v4.7.0 玩法整改');

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
    // ① 选卡:刷新/放弃/跳过退场
    g.start('normal');
    g.spawnQueue = []; g.enemies = []; g.boss = null;
    g.autoFire = false; g.keys.fire = false;
    g.state = 'playing'; g.player.alive = true; g.player.invuln = 999;
    g.abandonLeft = 2; g.rerollLeft = 1;
    g.pendingLevels = 1; g.openLevelup();
    const crystal0 = Shop.crystal, score0 = g.score;
    const hasReroll = document.getElementById('cardRow').innerHTML.indexOf('刷新候选') >= 0;
    const hasAbandon = document.getElementById('cardRow').innerHTML.indexOf('放弃升级') >= 0;
    const hasNoSkip = document.getElementById('cardRow').innerHTML.indexOf('跳过本次升级') < 0;
    g.abandonUpgrade();
    out.abandon = g.pendingLevels === 0 && g.abandonLeft === 1 && g.state === 'playing'
      && Shop.crystal === crystal0 + 10 && g.score === score0 + 150;
    // 刷新:重抽候选且次数递减
    g.pendingLevels = 1; g.openLevelup();
    const c0 = (g._cardChoices || []).map(c => c.id).join(',');
    let changed = false;
    for (let i = 0; i < 30 && !changed; i++) { g.rerollChoices(); if ((g._cardChoices || []).map(c => c.id).join(',') !== c0) changed = true; }
    out.reroll = changed && g.rerollLeft === 0 && g.pendingLevels === 1;
    out.ui = hasReroll && hasAbandon && hasNoSkip;
    g.skipUpgrade();
    // ② BOSS 强化:血量与专属技能
    g.start('campaign', 4);
    g.startWave(5);
    for (let i = 0; i < 260 && (!g.boss || g.boss.state !== 'fight'); i++) g.update(1 / 60);
    out.bossHp = g.boss && g.boss.maxHp > 2000; // (420+4*110)*1.0 = 860? wave=5 → vw=27 → 420+2970=3390
    out.specialFn = g.boss && typeof g.boss._special === 'function';
    out.specialCd = g.boss && typeof g.boss.specialCd !== 'undefined';
    // ③ slotplus max=2
    out.slotMax = UPGRADES.find(x => x.id === 'slotplus').max === 2;
    g.state = 'menu';
    return out;
  });

  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }
  console.log(JSON.stringify(r));
  t.check(errors.length === 0, '无 JS 运行时异常');
  t.check(r.abandon, '放弃:次数-1/补偿/等级真实丢失');
  t.check(r.reroll, '刷新:重抽候选且等级保留');
  t.check(r.ui, '选卡 UI:刷新/放弃按钮存在,跳过已退场');
  t.check(r.bossHp, 'BOSS 血量大幅提升');
  t.check(r.specialFn && r.specialCd !== undefined, '专属技能方法与计时就绪');
  t.check(r.slotMax, '基因扩展上限 2');
  t.finish();
})().catch(e => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
