'use strict';
/* 商城扩充与去重 验证 */
const H = require('./_harness');
const t = H.suite('商城扩充与去重');

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
    out.skins24 = SKINS.length === 26;   // 22 + 2 绚丽(v4.1.0)+ 2 高级(v4.3.1)
    out.ships18 = SHIPS.length === 20;   // 16 + 2 绚丽(v4.1.0)+ 2 机制内建(v4.3.1)
    out.rarePool = SKINS.filter(x => x.rare).length === 6 && SHIPS.filter(x => x.rare).length === 6;
    // 新动效分支存在性:渲染四种新绚丽机体不抛错
    Shop.crystal = 999999;
    g.state = 'playing';
    g.player.invuln = 999; g.player.alive = true;
    let renderOk = true;
    for (const id of ['riftblade', 'winterwind']) {
      Shop.equipShip(id);
      g.shipDef = Shop.currentShip ? Shop.currentShip() : (SHIPS.find(x => x.id === id));
      g.start('normal');
      g.player._drawDazzle(g.ctx, (SKINS.find(x => x.id === 'eventhorizon')).fx);  // horizon
      g.player._drawDazzle(g.ctx, (SKINS.find(x => x.id === 'skyfall')).fx);       // thorchain
      g.player._drawDazzle(g.ctx, SHIPS.find(x => x.id === 'riftblade').fx);       // rift
      g.player._drawDazzle(g.ctx, SHIPS.find(x => x.id === 'winterwind').fx);      // frostnova
    }
    out.renderOk = renderOk;
    // 堡垒·改独有自愈
    Shop.tunings = {}; Shop.relics = undefined;
    Shop.crystal = 99999;
    Shop.buyShip('fortress2');
    Shop.equipShip('fortress2');
    g.start('normal');
    g.mods = {}; g.relics = {}; g.evo = {};
    g.player.hp = Math.max(1, g.player.maxHp - 30);
    g._recalc();
    out.fortRegen = Math.abs(g.player.regenRate - 0.8) < 1e-9;
    // 战地维修:过波回复 ×2
    localStorage.setItem('deepstrike.loadout', JSON.stringify({ heal0: 1 }));
    Shop.load();
    g.start('normal');
    g.player.hp = 40;
    g.state = 'playing'; g.wave = 2; g.waveKills = g.waveQuota = 500; g.enemies = []; g.spawnQueue = []; g.boss = null;
    g.update(1 / 60);
    out.heal2x = g.player.hp >= 50;
    Shop.loadout = {}; Shop.save();
    g.state = 'menu';
    return out;
  });

  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }
  console.log(JSON.stringify(r));
  t.check(errors.length === 0, '无 JS 运行时异常');
  t.check(r.skins24, '皮肤 24 款(22 + 2 新绚丽)');
  t.check(r.ships18, '机体 18 款(16 + 2 新绚丽)');
  t.check(r.rarePool, '绚丽池:皮肤 6 / 机体 6');
  t.check(r.renderOk, '四种新动效渲染不抛错');
  t.check(r.fortRegen, '堡垒·改差异化:独有 0.8/秒 自愈');
  t.check(r.heal2x, '战地维修差异化:过波回复 ×2');
  t.finish();
})().catch(e => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
