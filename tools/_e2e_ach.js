'use strict';
/* v1.9.0 成就分级制验证:
 *  1) 结构:34 条线 × 每线 5 级,阈值/奖励单调,无重复 id
 *  2) 旧版单级存档自动迁移(时间戳 → 等级映射)
 *  3) touch/evaluate 分级推进:只升不降、逐级发奖、阈值边界
 *  4) skin/ship 在指定层级发放
 *  5) 游戏内驱动:击坠→kills 线升级;结算→最优值统计入线
 *  6) 面板分级展示(线/级/进度) */
const H = require('./_harness');
const t = H.suite('成就分级制');

(async () => {
  const server = await H.startServer();
  const port = server.address().port;
  const base = 'http://127.0.0.1:' + port + '/';
  const browser = await H.launch();
  const errors = [];

  // 预置旧版存档(时间戳格式)验证迁移
  const ctx = await browser.newContext();
  const page0 = await ctx.newPage();
  await page0.goto(base, { waitUntil: 'networkidle' });
  await page0.evaluate(() => {
    localStorage.setItem('deepstrike.ach', JSON.stringify({
      first_kill: 1700000000000, wave_15: 1700000000001, boss_10: 1700000000002, unknown_old: 1700000000003
    }));
  });
  await page0.reload({ waitUntil: 'networkidle' });
  await page0.waitForTimeout(200);
  const mig = await page0.evaluate(() => ({
    kills: Ach.unlocked.kills, bestwave: Ach.unlocked.bestwave, bosskills: Ach.unlocked.bosskills,
    unknownGone: Ach.unlocked.unknown_old === undefined,
    allNumeric: Object.values(Ach.unlocked).every(v => typeof v === 'number' && v >= 1 && v <= 5)
  }));
  await ctx.close();
  if (!mig.kills || !mig.bestwave || !mig.bosskills || !mig.unknownGone || !mig.allNumeric) errors.push('pageerror: 迁移结果异常 ' + JSON.stringify(mig));

  const page = await browser.newPage({ viewport: { width: 520, height: 820 } });
  H.watchErrors(page, errors);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  const r = await page.evaluate(() => {
    const out = {};
    // 1) 结构
    out.lines = ACHIEVEMENTS.length === 35;
    out.all5 = ACHIEVEMENTS.every(a => a.tiers.length === 5 && a.rewards.length === 5);
    out.noDup = new Set(ACHIEVEMENTS.map(a => a.id)).size === 35;
    out.monotonic = ACHIEVEMENTS.every(a => a.tiers.every((n, i) => i === 0 || n > a.tiers[i - 1]) && a.rewards.every((n, i) => i === 0 || n >= a.rewards[i - 1]));
    out.totalTiers = Ach.totalTiers() === 175;
    // 2) touch 分级推进:只升不降、边界
    Ach.unlocked = {}; Ach.save();
    Ach.touch('kills', 999, null);          // < 1000 → Lv1
    out.t1 = Ach.levelOf('kills') === 1;
    Ach.touch('kills', 1000, null);         // = 1000 → Lv2
    out.t2 = Ach.levelOf('kills') === 2;
    Ach.touch('kills', 500, null);          // 回落不降级
    out.t3 = Ach.levelOf('kills') === 2;
    Ach.touch('kills', 25000, null);        // 满
    out.t4 = Ach.levelOf('kills') === 5;
    // 3) unlock 兼容:未知 id 静默;已知 id 升 1 级
    Ach.unlock('not_exist_id', null);
    out.unknownSafe = Ach.unlocked.not_exist_id === undefined;
    Ach.unlocked = {}; Ach.save();
    Ach.unlock('relics', null);
    out.compat = Ach.levelOf('relics') === 1;
    // 4) skin/ship 指定层级发放
    Ach.unlocked = {}; Shop.owned = { proto: true }; Shop.ownedShip = { vanguard: true };
    Ach.touch('bestwave', 15, null);        // Lv3 → abyss
    out.skinAt = !!Shop.owned.abyss && Ach.levelOf('bestwave') === 3 && !Shop.ownedShip.tempest;
    Ach.touch('bestwave', 40, null);        // Lv5 → tempest
    out.shipAt = !!Shop.ownedShip.tempest;
    // 5) 游戏内驱动:击坠 → kills 线
    const g = window.game;
    g.start('normal');
    g.spawnQueue = []; g.waveQuota = 999999; g.autoFire = false; g.keys.fire = false;
    g.enemies = []; g.powerups = []; g.boss = null;
    Ach.unlocked = {}; Ach.save();
    const d0 = Object.assign(new Enemy('drone', 1, null, null, null), { x: 100, y: 200, dead: true, elite: null });
    for (let i = 0; i < 100; i++) g.killEnemy(d0);
    out.liveKills = Ach.levelOf('kills') >= 1;
    // 6) 结算评估:bestScore 入线
    g.score = 52000; g.wave = 8; g.runBossKills = 0; g.runEliteKills = 0;
    g.mode = 'normal'; g.relics = {}; g.augments = {}; g.hard = false;
    g._gameover();
    out.bestScoreLine = (Ach.levelOf('bestscore') || 0) >= 2; // 52000 ≥ 50000 → Lv2
    // 7) 面板分级展示
    g._refreshStatsPanel();
    const html = document.getElementById('achList').innerHTML;
    out.panel = html.indexOf('线') >= 0 && html.indexOf('Lv') >= 0 && html.indexOf('ach-tiers') >= 0;
    g.state = 'menu';
    return out;
  });

  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }
  console.log('迁移: ' + JSON.stringify(mig));
  t.info('原始结果: ' + JSON.stringify(r));
  for (const k of Object.keys(r)) t.check(r[k] === true, k);
  t.check(errors.length === 0, '无 JS 运行时异常');
  t.finish();
})().catch((e) => t.crash(e));
