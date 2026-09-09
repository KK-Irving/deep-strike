'use strict';
/* v1.7.0 遗物系统 行为测试:
 *  1) 遗物池扩充至 16 件
 *  2) 掉落:非连战模式击败旗舰按 5%~10%(随波次)概率掉落未知圣遗物;情报网络首艘必掉;连战保留必得三选一
 *  3) 拾取:随机授予未拥有遗物 + 闪光动画(三环/粒子/横幅);已集齐转化 1000 分
 *  4) 新遗物效果:引力核心/战意旗帜/贤者之书/寒霜宝石/命运骰子/不死鸟羽 */
const H = require('./_harness');
const t = H.suite('圣遗物');

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

  const r = await page.evaluate(() => {
    const g = window.game;
    const out = {};
    // 1) 池规模
    out.pool16 = RELICS.length === 16;
    out.newIds = ['r_magnet', 'r_frenzy', 'r_phoenix', 'r_sage', 'r_frostgem', 'r_dice'].every(id => RELICS.some(x => x.id === id));
    // 2) 掉落:统计法验证概率路径(模块内 let RNG 无法从外部覆写)
    const mkBoss = () => ({ x: 240, y: 120, r: 40, score: 1000, variant: 'flag', state: 'fight', pods: null });
    const dropCount = (n, wave, force) => {
      g.start('normal');
      g.spawnQueue = []; g.waveQuota = 999999; g.autoFire = false; g.keys.fire = false; g.enemies = [];
      g.wave = wave;
      g._forceRelicDrop = !!force;
      let cnt = 0;
      for (let i = 0; i < n; i++) {
        g._forceRelicDrop = !!force; // 每轮重设:掉落即消费
        g.powerups = [];
        g.killBoss(mkBoss());
        if (g.powerups.some(p => p.type === 'relic')) cnt++;
      }
      return cnt;
    };
    const drops10 = dropCount(200, 30, false); // 波 30 → 概率 10% 封顶,期望 20
    out.dropHigh = drops10 >= 4 && drops10 <= 46;
    const dropsF = dropCount(50, 5, true);     // 情报网络:必掉
    out.forceDrop = dropsF === 50;
    // 连战:必得三选一(不掉落实物)
    g.mode = 'boss'; g.powerups = []; g.pendingRelic = false;
    g.killBoss(mkBoss());
    out.bossMode = g.pendingRelic === true && !g.powerups.some(p => p.type === 'relic');
    g.mode = 'normal';
    // 3) 拾取:随机授予未拥有 + 闪光表现;集满转 1000 分
    g.start('normal');
    g.powerups = []; g.rings = []; g.enemyBullets = [];
    g.relics = {};
    g._applyPower('relic');
    out.grantOne = Object.keys(g.relics).length === 1;
    out.fxRings = g.rings.length >= 3;
    for (const r0 of RELICS) if (!g.relics[r0.id]) g.relics[r0.id] = true;
    g.score = 0;
    g._applyPower('relic');
    out.allOwned = g.score === 1000;
    // 4) 新遗物效果
    // 先清空遗物并重算,取真正的「无遗物」基线:上面 _applyPower('relic') 随机授予了一件遗物,
    // 若抽到 r_sage/r_magnet,基线会被污染,导致 sage/magnet 断言约 1/16 概率随机失败。
    g.relics = {}; g._recalc();
    const baseMagnet = g.player.magnetR, baseXp = g.xpMult;
    g.relics = { r_magnet: true }; g._recalc();
    out.magnet = Math.abs(g.player.magnetR - baseMagnet * 1.6) < 1e-9;
    g.relics = { r_sage: true }; g._recalc();
    out.sage = Math.abs(g.xpMult - baseXp * 1.25) < 1e-9;
    g.relics = { r_frenzy: true }; g._recalc();
    out.frenzy = Math.abs(g.comboWindow - 3) < 1e-9; // 无卡基线 2 + 遗物 1
    // 寒霜宝石:击坠触发脉冲(统计:25% × 60 次)
    g.relics = { r_frostgem: true }; g.buffs.frost = 0;
    let frostHits = 0;
    for (let i = 0; i < 60; i++) {
      g.buffs.frost = 0;
      const d0 = Object.assign(new Enemy('drone', 1, null, null, null), { x: 200, y: 300, dead: true, elite: null });
      g.killEnemy(d0);
      if (g.buffs.frost > 0) frostHits++;
    }
    out.frostgem = frostHits >= 6; // 期望 15,P(<6) < 1e-3
    // 命运骰子:击坠掉落道具(统计:10% × 60 次)
    g.relics = { r_dice: true }; g.powerups = [];
    for (let i = 0; i < 60; i++) {
      const d1 = Object.assign(new Enemy('drone', 1, null, null, null), { x: 220, y: 320, dead: true, elite: null });
      g.killEnemy(d1);
    }
    out.dice = g.powerups.length >= 1;
    g.relics = {};
    // 不死鸟羽:30% 生命重生,仅一次
    g.relics = { r_phoenix: true };
    g.state = 'playing'; g.enemies = [];
    g.player.maxHp = 100; g.player.hp = 100; g.player.invuln = 0; g.player.shield = false; g.player.alive = true;
    g._playerHit(999);
    out.phoenix1 = g.player.alive && g.player.hp === 30 && g._phoenixUsed === true;
    g.player.invuln = 0; g._playerHit(999);
    out.phoenix2 = !g.player.alive;
    g.relics = {}; g._recalc();
    // 5) 道具渲染与 HUD 图标通道
    g.powerups = [];
    g.powerups.push(new PowerUp(100, 100, 'relic'));
    out.cfgRelic = !!PowerUp.CFG.relic && !!SPRITES.power.relic;
    return out;
  });

  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e2) => console.log('  ' + e2)); }
  t.info('原始结果: ' + JSON.stringify(r));
  for (const k of Object.keys(r)) t.check(r[k] === true, k);
  t.check(errors.length === 0, '无 JS 运行时异常');
  t.finish();
})().catch((e) => t.crash(e));
