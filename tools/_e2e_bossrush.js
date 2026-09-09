'use strict';
/* v1.3.0 旗舰连战模式验证:虚拟波号/变体轮换/每阶段升级+遗物/无杂兵事件/纪录与芯片限领/成就门控 */
const H = require('./_harness');
const t = H.suite('旗舰连战');

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
    localStorage.removeItem('deepstrike.bossHi');
    localStorage.removeItem('deepstrike.bossClaim');
    // 1) 启动连战
    game.start('boss');
    out.mode = game.mode;
    out.stage = game.wave;             // 1
    out.quota = game.waveQuota;        // 1
    out.noQueue = game.spawnQueue.length === 1 && game.spawnQueue[0].boss; // 只有旗舰
    // 2) 旗舰按虚拟波号 5 构造(flag 变体)
    game.player.invuln = 999;
    for (let i = 0; i < 500 && (!game.boss || game.boss.state !== 'fight'); i++) game.update(1 / 60);
    out.boss1 = game.boss && game.boss.wave === 5 && game.boss.variant === 'flag';
    const hp1 = game.player.hp;
    game.player.hp = Math.round(game.player.maxHp * 0.5);
    // 3) 击毁 → 升级+遗物 待处理,回血 15%
    const hpBefore = game.player.hp;
    game.boss.damage(999999, game);
    out.upgradeOwed = game.pendingLevels >= 1;
    out.relicOwed = game.pendingRelic === true;
    out.healed = game.player.hp === Math.min(game.player.maxHp, hpBefore + Math.round(game.player.maxHp * 0.15));
    // 4) 处理完升级链与遗物后清掉僚机 → 推进到第 2 阶段(storm,虚拟波 10)
    while (game.state === 'levelup' && game._relicMode) game.chooseRelic(0);
    while (game.state === 'levelup' && game._cardChoices.length) game.chooseCard(0);
    while (game.pendingLevels > 0 && game.state === 'levelup') game.chooseCard(0);
    game.enemies.length = 0; game.spawnQueue.length = 0; game.waveKills = 1;
    game.update(1 / 60); game.waveClearT = 0.01; game.update(1 / 60);
    out.stage2 = game.wave === 2;
    game.player.invuln = 999;
    for (let i = 0; i < 500 && (!game.boss || game.boss.state !== 'fight'); i++) game.update(1 / 60);
    out.boss2 = game.boss && game.boss.wave === 10 && game.boss.variant === 'storm';
    // 5) 连战不触发波次语义成就
    out.noWaveAch = (Ach.levelOf('bestwave') || 0) === 0;
    game.start('normal'); // 普通模式第 5 波应解锁
    game.startWave(5);
    out.normalWaveAch = (Ach.levelOf('bestwave') || 0) >= 1;
    // 6) 结算:纪录 + 芯片限领
    game.mode = 'boss'; game.wave = 6; game.score = 12000; game.state = 'playing';
    game._gameover();
    out.record = localStorage.getItem('deepstrike.bossHi') === '12000';
    const chips1 = Shop.lastChips;
    out.chipsInRange = chips1 >= 8 && chips1 <= 24;
    game.mode = 'boss'; game.wave = 7; game.score = 30000; game.state = 'playing';
    game._gameover();
    out.chipCapped = Shop.lastChips === 0 && Shop.lastChipsCapped === true;
    out.bestKept = localStorage.getItem('deepstrike.bossHi') === '30000';
    return out;
  });

  await page.close();
  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }

  console.log('模式/阶段/配额/纯旗舰队列: ' + [r.mode, r.stage, r.quota, r.noQueue].join(' / '));
  console.log('旗舰1(虚拟波5·flag): ' + r.boss1 + ' · 击毁后升级+遗物+回血: ' + [r.upgradeOwed, r.relicOwed, r.healed].join('/'));
  console.log('推进到阶段2: ' + r.stage2 + ' · 旗舰2(虚拟波10·storm): ' + r.boss2);
  console.log('连战不解锁波次成就: ' + r.noWaveAch + ' · 普通模式正常解锁: ' + r.normalWaveAch);
  console.log('纪录写入: ' + r.record + ' · 芯片区间: ' + r.chipsInRange + ' · 当日限领: ' + r.chipCapped + ' · 纪录保留: ' + r.bestKept);

  const check = t.check;
  check(errors.length === 0, '无 JS 运行时异常');
  check(r.mode === 'boss' && r.stage === 1 && r.quota === 1 && r.noQueue, '连战启动:仅旗舰无杂兵');
  check(r.boss1, '第 1 阶段旗舰按虚拟波号 5 构造(flag)');
  check(r.upgradeOwed && r.relicOwed && r.healed, '击毁旗舰奖励升级+遗物并回复 15% 生命');
  check(r.stage2 && r.boss2, '推进到第 2 阶段(storm,虚拟波 10)');
  check(r.noWaveAch && r.normalWaveAch, '连战不解锁波次成就,普通模式不受影响');
  check(r.record && r.bestKept, '连战最佳纪录正确写入');
  check(r.chipsInRange && r.chipCapped, '芯片按阶段结算且每日限领一次');
  t.finish();
})().catch((e) => t.crash(e));
