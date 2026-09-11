'use strict';
/* v3.0.0 纪元系统 验证:解锁门槛/重置结算(保留与重置边界)/核心公式/天赋购买前置与扣费/效果接线 */
const H = require('./_harness');
const t = H.suite('纪元系统');

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
    localStorage.removeItem('deepstrike.eras');
    // 1) 门槛:三星(3 星)才可重置
    localStorage.setItem('deepstrike.campaign', JSON.stringify({ 10: 2 }));
    out.gated = Shop.epochAvailable() === false;
    localStorage.setItem('deepstrike.campaign', JSON.stringify({ 9: 3, 10: 3 }));
    out.available = Shop.epochAvailable() === true;
    // 2) 重置结算:核心 = 3 + 星/2 + 改装层数;保留收藏重置养成
    Shop.crystal = 9999; Shop.boosts = { hp25: 5 }; Shop.tunings = { armorT: 3, wingT: 1 }; Shop.scrap = 20;
    Shop.ownedShip = { vanguard: true, zenith: true }; Shop.owned = { proto: true, gold: true };
    Shop.save();
    const res = Shop.epochReset(); // 核心 = 3 + 6/2 + 4 = 10
    out.resetOk = res.ok && res.cores === 10;
    out.wiped = Shop.crystal === 0 && Object.keys(Shop.boosts).length === 0 && Shop.scrap === 0 && Object.keys(Shop.tunings).length === 0;
    out.kept = !!Shop.owned.gold && !!Shop.ownedShip.zenith;
    out.eraSaved = Shop.eraCores() === 10 && Shop.eraResets() === 1;
    // 3) 天赋:前置/扣费/效果
    const rEarly = Shop.eraBuy('atk3');            // 未点 atk1/atk2
    out.prereq = !rEarly.ok;
    const r1 = Shop.eraBuy('atk1');                 // 层 1,核心 1
    out.buy1 = r1.ok && Shop.eraLv('atk1') === 1 && Shop.eraCores() === 9;
    const r2 = Shop.eraBuy('atk2');                 // 层 2,核心 2
    out.buy2 = r2.ok && Shop.eraCores() === 7;
    // 效果接线:atk1 +1 伤害 / atk2 射速 ×0.94
    g.start('normal');
    const baseInterval = g.player.fireInterval;
    g._recalc();
    g.mods = {}; g._recalc();
    out.atk1 = g.player.dmgBonus === 1;
    g._recalc();
    out.atk2 = Math.abs(g.player.fireInterval - baseInterval * 0.94) < 1e-9 || Math.abs(g.player.fireInterval - (g.player.fireBase || 0.12) * 0.94) < 1e-9;
    // def2/tec2 效果(注入已点亮)
    Shop.eraSave({ cores: 99, spent: { def2: 2, tec2: 2 }, resets: 1 });
    g.mods = {}; g._recalc();
    Shop.tunings = {}; g._recalc();
    out.def2 = Math.abs(g.player.armorPct - 0.03) < 1e-9;
    // tec2 炸弹上限
    g.tunings = {};
    out.tec2 = g.bombCap() === 6;
    // 面板渲染(未满条件显示引导)
    g.state = 'menu'; g.menuPanel = 'save'; g._refreshSave ? g._refreshSave() : 0;
    g.showMenuPanel('save');
    out.panel = document.getElementById('eraBox').innerHTML.indexOf('纪 元') >= 0;
    g.state = 'menu';
    return out;
  });

  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }
  console.log(JSON.stringify(r));
  t.check(errors.length === 0, '无 JS 运行时异常');
  t.check(r.gated && r.available, '重置门槛:第 10 章三星解锁');
  t.check(r.resetOk, '纪元重置:核心 = 3 + 星/2 + 改装层数(=10)');
  t.check(r.wiped && r.kept, '重置边界:养成清空,收藏保留');
  t.check(r.eraSaved, '纪元核心与次数持久化');
  t.check(r.prereq && r.buy1 && r.buy2, '天赋:支线前置 + 核心扣费');
  t.check(r.atk1 && r.atk2, '贯穿天赋效果(+1 伤害 / 射速 ×0.94)');
  t.check(r.def2 && r.tec2, '庇护 II 减伤 +3% / 机变 II 炸弹上限 +1');
  t.check(r.panel, '纪元面板渲染');
  t.finish();
})().catch(e => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
