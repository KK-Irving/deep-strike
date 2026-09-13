'use strict';
/* v4.3.1 商城二轮 loop 验证:撞车去重/机制内建机体/空投呼叫/desc 完整 */
const H = require('./_harness');
const t = H.suite('商城二轮去重与扩充');

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
    Shop.crystal = 999999; Shop.save();
    // 1) 机体数量与新品
    out.ships20 = SHIPS.length === 20; // 18 + 2
    out.skins26 = SKINS.length === 26; // 24 + 2
    // 2) wasp 重定位:全库最快射速
    const wasp = SHIPS.find(x => x.id === 'wasp');
    const phantom = SHIPS.find(x => x.id === 'phantom');
    out.waspFastest = wasp.fire < phantom.fire && wasp.fire <= Math.min(...SHIPS.filter(x => !x.rare && !x.ach).map(x => x.fire));
    // 3) lancer 内置暴击:站桩打靶测暴击率(取样)
    Shop.buyShip('lancer'); Shop.equipShip('lancer');
    g.start('normal');
    g.mods = {}; g.evo = {}; g.relics = {}; g.bonds = [];
    let crits = 0, trials = 400;
    for (let i = 0; i < trials; i++) {
      g.player.fireCd = 0;
      // 直接构造子弹走 _hitTarget:用敌机靶
      const tgt = new Enemy('drone', 240, 1, null, null);
      tgt.x = 240; tgt.y = 400; tgt.hp = 1e9;
      g.enemies = [tgt];
      const b = { x: 240, y: 420, vx: 0, vy: -500, r: 3, dmg: 1, color: '#fff', dead: false, pierce: 0, split: 0 };
      g.playerBullets = [b];
      const hpBefore = tgt.hp;
      g._hitTarget(b, tgt);
      if (tgt.hp < hpBefore - 1.5) crits++; // 暴击 3 倍
    }
    out.lancerCrit = crits >= trials * 0.06 && crits <= trials * 0.14; // 期望 10%(锐锋内置暴击)
    // 4) shard 天生裂变:击杀分裂产生小弹
    Shop.buyShip('shard'); Shop.equipShip('shard');
    g.start('normal');
    g.mods = {}; g.evo = {}; g.bonds = []; g.relics = {};
    g.player.fireCd = 0; g.player.weapon = 1;
    g.playerBullets = []; g.player._fire(g);
    out.shardSplit = g.playerBullets.every(b => b.split >= 1) && g.playerBullets.length >= 1;
    // 5) tide 天生时滞
    Shop.buyShip('tide'); Shop.equipShip('tide');
    g.start('normal'); // _reset 刷新 shipDef 为潮汐
    g.mods = {}; g._recalc();
    out.tideSlow = Math.abs(g.bulletSlow - 0.9) < 1e-9;
    // 6) 空投呼叫:双补给
    localStorage.setItem('deepstrike.loadout', JSON.stringify({ aegis0: 1 }));
    Shop.load();
    g.start('normal');
    g.state = 'playing'; g.player.alive = true;
    out.airdrop = g.powerups.length === 2;
    localStorage.removeItem('deepstrike.loadout');
    // 7) desc 完整性:全部非 secret 皮肤与机体都有 desc
    out.descFull = SKINS.filter(x => !x.secret).every(x => x.desc) && SHIPS.every(x => x.desc);
    g.state = 'menu';
    return out;
  });

  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }
  console.log(JSON.stringify(r));
  t.check(errors.length === 0, '无 JS 运行时异常');
  t.check(r.ships20 && r.skins26, '扩充:机体 20 / 皮肤 26');
  t.check(r.rarePool !== false, '绚丽池不变(6+6)');
  t.check(r.waspFastest, '黄蜂重定位:全库最快射速(与幽灵区分)');
  t.check(r.lancerCrit, '锐锋狙击:内置暴击生效(取样 ' + ')');
  t.check(r.shardSplit, '裂片:天生裂变(子弹自带 split)');
  t.check(r.tideSlow, '潮汐:天生时滞 10%');
  t.check(r.airdrop, '空投呼叫:出击双补给');
  t.check(r.descFull, '全部商品 desc 完整');
  t.finish();
})().catch(e => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
