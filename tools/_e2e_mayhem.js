'use strict';
/* 海克斯大乱斗(v1.5.0)行为测试:
 *  1) 菜单入口(按钮 + L 键)与开局强化三选一(第 1/4/7/10 波共 4 轮,BOSS 波亦可先选)
 *  2) 18 张符文三档建模与品阶权重递增
 *  3) 符文效果逐一接线验证(射速/伤害/生命/僚机/炸弹/受击/结算等)
 *  4) 模式福利(经验 +50%)、独立纪录、专属成就,且不侵占每日/周挑战芯片限领
 * 通过 window.game 直接驱动,密闭环境(清出怪/停自fire)避免时序竞争。 */
const H = require('./_harness');
const t = H.suite('海克斯大乱斗');

(async () => {
  const server = await H.startServer();
  const port = server.address().port;
  const base = 'http://127.0.0.1:' + port + '/';
  const browser = await H.launch();
  const page = await browser.newPage({ viewport: { width: 520, height: 820 } });
  const errors = [];
  H.watchErrors(page, errors);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  // 密闭开局:进大乱斗并处理开局强化,随后清空战场威胁
  async function freshMayhem() {
    return page.evaluate(() => {
      const g = window.game;
      g.start('mayhem');
      // 开局(第 1 波)强化选择应已弹出
      const opened = g.state === 'levelup' && g._augMode === true && g._augRound === 1 && g._augChoices.length === 3;
      if (g.state === 'levelup') g.chooseAugment(0);
      // 密闭环境:无出怪、无增援、无自动开火、配额拉满防过关
      g.spawnQueue = []; g.waveQuota = 999999; g.trickleT = 9999;
      g.autoFire = false; g.keys.fire = false; g.waveClearT = -1;
      g.enemies = []; g.enemyBullets = []; g.boss = null; g.asteroids = []; g.supplies = [];
      return {
        opened,
        mode: g.mode,
        notChallenge: g.isChallenge() === false,
        pickedId: Object.keys(g.augments)[0] || '',
        choiceIds: (g._augChoices || []).map(a => a.id)
      };
    });
  }

  const r = {};
  const mark = (m) => process.stdout.write('[ ' + m + ' ]\n');

  mark('1 menu');
  // ── 1. 菜单入口 ──
  r.menu = await page.evaluate(() => ({
    btn: !!document.getElementById('btnMayhem'),
    hiHasMayhem: document.getElementById('menuHi').textContent.indexOf('大乱斗') >= 0,
    achLines: (typeof ACHIEVEMENTS !== 'undefined') ? ACHIEVEMENTS.length : -1,
    augTotal: (typeof AUGMENTS !== 'undefined') ? AUGMENTS.length : -1,
    tiers: (typeof AUGMENTS !== 'undefined') ? [0, 1, 2].map(t => AUGMENTS.filter(a => a.tier === t).length) : []
  }));

  mark('2 hotkey');
  // ── 2. 开局强化 + L 键热键 ──
  await page.keyboard.press('KeyL');
  await page.waitForTimeout(80);
  r.hotkey = await page.evaluate(() => {
    const g = window.game;
    const ok = g.mode === 'mayhem' && g.state === 'levelup' && g._augMode === true;
    const ids = (g._augChoices || []).map(a => a.id);
    const unique = new Set(ids).size === ids.length;
    g.chooseAugment(0);
    return { ok, unique, resumed: g.state === 'playing', owned: Object.keys(g.augments).length === 1 };
  });

  mark('3 rounds');
  // ── 3. 四轮选取:1/4/7/10 波(含 BOSS 波先选)──
  await freshMayhem();
  r.rounds = await page.evaluate(() => {
    const g = window.game;
    const out = {};
    const tryRound = (n, expect) => {
      g.state = 'playing';
      g.startWave(n);
      const opened = g.state === 'levelup' && g._augMode === true;
      out['w' + n] = opened && g._augRound === expect;
      if (opened) g.chooseAugment(0);
    };
    tryRound(4, 2); tryRound(7, 3); tryRound(10, 4);
    g.state = 'playing';
    g.startWave(11);
    out.w11_no = g.state === 'playing' && !g._augMode;
    g.state = 'menu';
    return out;
  });

  mark('4 tiers');
  // ── 4. 品阶权重随轮次递增(统计模拟)──
  r.tiers = await page.evaluate(() => {
    const g = window.game;
    const count = [0, 0, 0];
    for (let i = 0; i < 3000; i++) {
      g.augments = {}; // 全池可抽
      const picks = g._drawAugments(4);
      for (const a of picks) count[a.tier]++;
    }
    g.augments = {};
    return { round4: count, prismDominant: count[2] > count[1] && count[1] > count[0] };
  });

  mark('5 fx');
  // ── 5. 模式福利与符文效果 ──
  await freshMayhem();
  r.fx = await page.evaluate(() => {
    const g = window.game;
    const out = {};
    g.augments = {}; g._recalc(); // 先清空符文,取无符文基准
    out.xp15 = Math.abs(g.xpMult - 1.5) < 1e-9;
    const baseInterval = g.player.fireInterval;
    const baseHp = g.player.maxHp;
    const baseSpeed = g.player.speed;
    // 模式福利:大乱斗经验 +50%
        // 超频/无限火力
    g.augments = { a_overclock: 1 }; g._recalc();
    out.overclock = Math.abs(g.player.fireInterval - baseInterval * 0.85) < 1e-9;
    g.augments = { a_urf: 2 }; g._recalc();
    out.urfInterval = Math.abs(g.player.fireInterval - baseInterval * 0.65) < 1e-9;
    out.urfDmg = Math.abs(g.player.dmgMul - 0.8) < 1e-9;
    // 玻璃大炮符文:+50% 伤害 / -25% 生命
    g.augments = { a_glass: 1 }; g._recalc();
    out.glassDmg = Math.abs(g.player.dmgMul - 1.5) < 1e-9;
    out.glassHp = Math.abs(g.player.maxHp - Math.round(baseHp / 0.75) * 0.75 / (baseHp / 0.75) * baseHp * 0.75) < 1e-6 || g.player.maxHp < baseHp;
    out.glassHpExact = Math.abs(g.player.maxHp - baseHp * 0.75) < 0.51;
    // 引擎/医疗/吸血/拾荒/时间领主
    g.augments = { a_engine: 1 }; g._recalc();
    out.engine = Math.abs(g.player.speed - baseSpeed * 1.2) < 1e-9;
    g.augments = { a_medic: 1 }; g._recalc();
    out.medic = Math.abs(g.player.regenRate - 1.5) < 1e-9;
    g.augments = { a_leech: 1 }; g._recalc();
    out.leech = Math.abs(g.player.leechPer - 1) < 1e-9;
    g.augments = { a_scav: 1 }; g._recalc();
    out.scav = Math.abs(g.xpMult - 1.5 * 1.4) < 1e-9;
    g.augments = { a_chrono: 2 }; g._recalc();
    out.chrono = Math.abs(g.bulletSlow - 0.7) < 1e-9;
    g.augments = { a_army: 2 }; g._recalc();
    out.army = g.wingmen.length === 2;
    g.augments = { a_ammo: 1 }; g._recalc();
    out.bombCap = g.bombCap() === 7;
    g.augments = {};
    g._recalc();
    out.bombCapBase = g.bombCap() === 5;
    // 巨力弹头
    g.augments = { a_might: 1 }; g._recalc();
    out.might = g.player.dmgBonus === 2;
    g.augments = {};
    g._recalc();
    return out;
  });

  mark('6 hit');
  // ── 6. 受击系:弹幕幽灵 / 相位疾行 ──
  r.hit = await page.evaluate(() => {
    const g = window.game;
    const out = {};
    g.state = 'playing';
    g.enemies = [];
    g.augments = { a_ghost: 3 }; g._recalc();
    g.player.hp = g.player.maxHp; g.player.invuln = 0; g.player.shield = false; g.player.alive = true;
    const hp0 = g.player.hp;
    g._playerHit(25);
    out.ghost = hp0 - g.player.hp === 15; // 25 × 0.6
    // 相位疾行:额外无敌 + 加速标记
    g.augments = { a_phase: 2 }; g._recalc();
    g.player.invuln = 0;
    g._playerHit(25);
    out.phaseMark = g.player._phaseT > 1.9 && g.player.invuln >= 1.4;
    g.augments = {}; g._recalc();
    return out;
  });

  mark('7 timers');
  // ── 7. 周期效果:彗星 / 线圈 / 弹药库 ──
  r.timers = await page.evaluate(() => {
    const g = window.game;
    const out = {};
    const step = (n) => { for (let i = 0; i < n; i++) g.update(1 / 60); };
    // 天降彗星:唯一活敌必中
    g.augments = { a_comet: 2 }; g._cometT = 0.001;
    const dummy = { x: 120, y: 200, r: 14, dead: false, hp: 1000, maxHp: 1000, taken: 0, type: 'dummy', elite: null,
      damage(n2) { this.taken += n2; if (this.hp !== undefined) this.hp -= n2; }, update() {}, draw() {} };
    g.enemies = [dummy];
    step(2);
    out.comet = dummy.taken >= 60;
    // 磁暴线圈:近弹清除、远弹保留
    g.augments = { a_coil: 2 }; g._coilT = 0.001;
    g.player.x = 240; g.player.y = 600;
    g.enemyBullets = [
      { x: 245, y: 605, vx: 0, vy: 0, r: 4, dead: false },
      { x: 240, y: 300, vx: 0, vy: 0, r: 4, dead: false }
    ];
    step(2);
    out.coil = g.enemyBullets.length === 1 && !g.enemyBullets[0].dead;
    // 弹药库:自动补弹且不超上限
    g.augments = { a_ammo: 2 }; g._ammoT = 0.001;
    g.player.bombs = 0;
    step(2);
    out.ammo = g.player.bombs === 1;
    g.augments = {};
    g.enemies = []; g.enemyBullets = [];
    return out;
  });

  mark('8 bomb');
  // ── 8. 炸弹系:战术核弹 ──
  r.bomb = await page.evaluate(() => {
    const g = window.game;
    const out = {};
    // 训练靶补 update/draw:主循环 rAF 可能在同一帧遍历 enemies,
    // 缺方法会抛 "arr[i].update is not a function"(间歇性)
    const mk = () => ({ x: 200, y: 300, r: 14, dead: false, taken: 0,
      damage(n2) { this.taken += n2; }, update() {}, draw() {} });
    const tryB = () => {
      g.state = 'playing'; g.player.alive = true; g.player.bombs = 3; g.bombActive = false; g.bombT = 0;
      g.enemies = [mk()]; g.enemyBullets = []; g.boss = null; g.asteroids = [];
      const e0 = g.enemies[0];
      g.tryBomb();
      g.bombActive = false;
      return e0.taken;
    };
    g.augments = {};
    out.base = tryB() === 8;
    g.augments = { a_nuke: 2 };
    out.nuke = tryB() === 32;
    g.augments = {};
    return out;
  });

  mark('9 snow');
  // ── 9. 雪球风暴:概率触发(统计)──
  r.snow = await page.evaluate(() => {
    const g = window.game;
    g.augments = { a_snow: 2 };
    const orig = g._explode.bind(g);
    let cnt = 0;
    g._explode = (...a) => { cnt++; return orig(...a); };
    const dummy = { x: 100, y: 200, r: 14, dead: true, elite: null, type: 'drone', damage() {}, update() {}, draw() {} };
    g.enemies = [];
    for (let i = 0; i < 100; i++) g.killEnemy(dummy);
    g._explode = orig;
    g.augments = {};
    return { triggered: cnt, ok: cnt >= 5 }; // p=0.2,P(<5)≈1e-5
  });

  mark('10 settle');
  // ── 10. 结算:星晶 ×1.5 + 贤者之石 + 纪录 + 成就 + 芯片不侵占 ──
  r.settle = await page.evaluate(() => {
    const g = window.game;
    const out = {};
    const chipsKeyBefore = localStorage.getItem('deepstrike.chipClaim');
    g.start('mayhem');
    if (g.state === 'levelup') g.chooseAugment(0);
    g.spawnQueue = []; g.waveQuota = 999999; g.autoFire = false; g.keys.fire = false;
    // 贤者之石:基准 1 分 → ×1.5(模式) ×2(石头) = 3
    g.augments = { a_stone: 3 };
    g.score = 16000; g.wave = 6; g.runBossKills = 0; g.runEliteKills = 0;
    g._gameover();
    out.stone = Shop.lastEarn === 18; // 6 ×1.5(模式)=9 ×2(贤者之石)=18
    out.recordSaved = +localStorage.getItem('deepstrike.mayhemHi') >= 16000;
    out.chipsUntouched = localStorage.getItem('deepstrike.chipClaim') === chipsKeyBefore;
    // 纪录保持:更低分不覆盖
    g.start('mayhem');
    if (g.state === 'levelup') g.chooseAugment(0);
    g.augments = {};
    g.score = 500; g.wave = 2; g.runBossKills = 0; g.runEliteKills = 0;
    g._gameover();
    out.recordKept = +localStorage.getItem('deepstrike.mayhemHi') >= 16000;
    // 成就:mayhem_30k
    g.start('mayhem');
    if (g.state === 'levelup') g.chooseAugment(0);
    g.score = 31000; g.wave = 12; g.runBossKills = 0; g.runEliteKills = 0;
    g._gameover();
    out.ach = (Ach.levelOf('mayhem') || 0) >= 3;
    out.hiFinal = +localStorage.getItem('deepstrike.mayhemHi') === 31000;
    // 构筑摘要含符文 chips
    g.augments = { a_engine: 1, a_nuke: 3 };
    out.summary = g._buildSummaryHTML().indexOf('◆ 引擎过载') >= 0 && g._buildSummaryHTML().indexOf('◆ 战术核弹') >= 0;
    g.state = 'menu';
    return out;
  });

  await H.shutdown(browser, server);

  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e2) => console.log('  ' + e2)); }
  console.log('菜单: ' + JSON.stringify(r.menu));
  console.log('热键: ' + JSON.stringify(r.hotkey));
  console.log('四轮: ' + JSON.stringify(r.rounds));
  console.log('品阶: ' + JSON.stringify(r.tiers));
  console.log('效果: ' + JSON.stringify(r.fx));
  console.log('受击: ' + JSON.stringify(r.hit));
  console.log('周期: ' + JSON.stringify(r.timers));
  console.log('炸弹: ' + JSON.stringify(r.bomb));
  console.log('雪球: ' + JSON.stringify(r.snow));
  console.log('结算: ' + JSON.stringify(r.settle));

  const check = t.check;
  check(errors.length === 0, '无 JS 运行时异常');
  check(r.menu.btn && r.menu.hiHasMayhem, '菜单入口与纪录行就绪');
  check(r.menu.achLines === 34, '成就 34 条线(分级制)');
  check(r.menu.augTotal === 18 && r.menu.tiers.join(',') === '6,6,6', '18 张符文,三档各 6 张');
  check(r.hotkey.ok && r.hotkey.unique && r.hotkey.resumed && r.hotkey.owned, 'L 键开局强化三选一(不重复)并正常返回战场');
  check(r.rounds.w4 && r.rounds.w7 && r.rounds.w10 && r.rounds.w11_no, '第 4/7/10 波依次第 2/3/4 轮(BOSS 波可先选),第 11 波不再弹');
  check(r.tiers.prismDominant, '第 4 轮品阶权重棱彩 > 黄金 > 白银');
  const f = r.fx;
  check(f.xp15, '大乱斗经验 +50%');
  check(f.overclock && f.urfInterval && f.urfDmg, '超频射击 -15% / 无限火力 -35% 间隔与 -20% 伤害');
  check(f.glassDmg && f.glassHpExact, '玻璃大炮符文 +50% 伤害 / -25% 生命上限');
  check(f.engine && f.medic && f.leech && f.scav && f.chrono && f.army, '引擎/医疗/吸血/拾荒/时间领主/分身军团生效');
  check(f.might, '巨力弹头 +2 伤害');
  check(f.bombCap && f.bombCapBase, '弹药库炸弹上限 7,基准 5');
  check(r.hit.ghost, '弹幕幽灵受伤 ×0.6(25→15)');
  check(r.hit.phaseMark, '相位疾行受击后无敌延长并进入加速');
  check(r.timers.comet && r.timers.coil && r.timers.ammo, '彗星命中 / 线圈清近弹留远弹 / 弹药库自动补弹');
  check(r.bomb.base && r.bomb.nuke, '战术核弹:炸弹 8→32 伤害');
  check(r.snow.ok, '雪球风暴概率触发(' + r.snow.triggered + '/100)');
  const s = r.settle;
  check(s.stone, '星晶结算:模式 ×1.5 与贤者之石 ×2(1→3)');
  check(s.recordSaved && s.recordKept && s.hiFinal, '独立纪录保存/保持/刷新');
  check(s.chipsUntouched, '不侵占每日/周挑战芯片限领');
  check(s.ach, '成就「海克斯狂徒」解锁');
  check(s.summary, '构筑摘要展示符文 chips');
  t.finish();
})().catch((e) => t.crash(e));
