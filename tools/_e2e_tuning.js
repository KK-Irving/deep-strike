'use strict';
/* v2.1.0 改装工坊(Phase 4.5)验证:残骸获取/合成扣费与上限/效果接线/持久化/入口 */
const H = require('./_harness');
const t = H.suite('改装工坊');

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
    const mkBoss = () => ({ x: 240, y: 120, r: 40, score: 500, variant: 'flag', state: 'fight', pods: null });
    // 1) 残骸获取:普通旗舰 +1 / 连战 +2
    g.start('normal');
    g.spawnQueue = []; g.waveQuota = 999999; g.autoFire = false; g.keys.fire = false;
    g.enemies = []; g.boss = null; g.powerups = [];
    Shop.scrap = 0; Shop.save();
    g.state = 'playing'; g.waveDamageTaken = 0; g.player.alive = true;
    g.killBoss(mkBoss());
    out.scrapNormal = Shop.scrap === 1;
    g.mode = 'boss';
    g.state = 'playing'; g.waveDamageTaken = 0; g.player.alive = true;
    g.killBoss(mkBoss());
    out.scrapBoss = Shop.scrap === 3;
    g.mode = 'normal';
    // 2) 合成:扣费/升限/材料不足
    Shop.scrap = 0; Shop.crystal = 100000; Shop.tunings = {}; Shop.save();
    const r0 = Shop.buyTuning('armorT');
    out.noScrap = !r0.ok;
    Shop.scrap = 100;
    const r1 = Shop.buyTuning('armorT');
    out.buy1 = r1.ok && Shop.tuningLv('armorT') === 1 && Shop.scrap === 100 - 6;
    Shop.crystal = 100000;
    Shop.buyTuning('armorT'); Shop.buyTuning('armorT');
    const maxed = Shop.buyTuning('armorT');
    out.max3 = Shop.tuningLv('armorT') === 3 && !maxed.ok;
    // 3) 效果接线
    g.start('normal');
    g.mods = {}; g.evo = {}; g.bonds = []; g.relics = {};
    const baseHp = 100 + 20; // 装甲 II:+20(基线 100)
    g._recalc();
    out.armorHp = g.player.maxHp >= baseHp - 1 && g.player.maxHp <= baseHp + 1 && g.tuningLv('armorT') === 3;
    out.armorPct = Math.abs(g.player.armorPct - 0.06) < 1e-9; // 装甲 I:-6%
    // 僚机:II +1 架
    Shop.tunings = { wingT: 2 }; g._recalc();
    out.wingCount = g.wingmen.length === 1;
    // 副武器:侧翼弹 +1 对
    Shop.tunings = { sideT: 1 }; g._recalc();
    g.playerBullets = []; g.player.fireCd = 0; g.player.weapon = 1;
    g.player._fire(g);
    out.sidePair = g.playerBullets.length === 1 + 2; // 主炮 1 + 侧翼 1 对
    g.playerBullets = [];
    // 炸弹伤害 II:+4(8 → 12)
    Shop.tunings = { sideT: 2 };
    g.state = 'playing'; g.player.alive = true; g.player.bombs = 3; g.bombActive = false;
    const dummy = { x: 200, y: 300, r: 14, dead: false, taken: 0, damage(n) { this.taken += n; }, update() {}, draw() {} };
    g.enemies = [dummy]; g.enemyBullets = []; g.boss = null; g.asteroids = [];
    g.tryBomb();
    g.bombActive = false;
    out.bombPlus = dummy.taken === 12;
    Shop.tunings = {};
    // 4) 面板渲染
    g.state = 'menu';
    game.showMenuPanel('tuning');
    const html = document.getElementById('tuningList').innerHTML;
    out.panel = html.indexOf('复合装甲改装') >= 0 && html.indexOf('残骸') >= 0;
    g.state = 'menu';
    return out;
  });

  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }
  console.log(JSON.stringify(r));
  t.check(errors.length === 0, '无 JS 运行时异常');
  t.check(r.scrapNormal && r.scrapBoss, '残骸获取(普通 +1 / 连战 +2)');
  t.check(r.noScrap && r.buy1 && r.max3, '合成:材料校验/扣费/3 级上限');
  t.check(r.armorHp && r.armorPct, '装甲改装:生命 +20 与减伤 -6%');
  t.check(r.wingCount, '僚机改装 II:+1 僚机');
  t.check(r.sidePair, '副武器挂架 I:侧翼弹 +1 对');
  t.check(r.bombPlus, '副武器挂架 II:炸弹伤害 +4(8→12)');
  t.check(r.panel, '工坊面板渲染');
  t.finish();
})().catch((e) => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
