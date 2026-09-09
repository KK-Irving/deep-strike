'use strict';
/* v1.3.1 每周变异词缀验证:周种子派生一致 / 各变异生效 / 非周挑战无变异 */
const H = require('./_harness');
const t = H.suite('每周变异');

(async () => {
  const server = await H.startServer();
  const port = server.address().port;
  const browser = await H.launch();

  // 两个独立页面:本周变异应一致
  async function loadMut() {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'networkidle' });
    const m = await page.evaluate(() => {
      game.start('weekly');
      return game._mut ? game._mut.id : null;
    });
    await page.close();
    return m;
  }
  const ma = await loadMut();
  const mb = await loadMut();

  const page = await browser.newPage();
  const errors = [];
  H.watchErrors(page, errors);
  await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'networkidle' });

  const r = await page.evaluate(() => {
    const out = {};
    // 1) 非周挑战无变异;周挑战有且在合法池内
    game.start('normal');
    out.normalNone = game._mut === null;
    game.start('weekly');
    out.weeklyHas = !!game._mut && WEEK_MUTATORS.some(x => x.id === game._mut.id);
    out.inBanner = game.banner && game.banner.sub.indexOf(game._mut.name) >= 0;
    // 2) 各变异数值生效(normal 模式挂变异,避开种子重播与波次词缀)
    game.start('normal');
    game._mut = null; game.startWave(2);
    const base = { hp: game._env.hpMul, spd: game._env.spdMul, fire: game._env.fireMul, xp: game.xpMult };
    game._mut = WEEK_MUTATORS.find(x => x.id === 'rage'); game.startWave(2);
    out.rage = Math.abs(game._env.fireMul / base.fire - 0.8) < 0.01;
    game._mut = WEEK_MUTATORS.find(x => x.id === 'bulwark'); game.startWave(2);
    out.bulwark = Math.abs(game._env.hpMul / base.hp - 1.25) < 0.01;
    game._mut = WEEK_MUTATORS.find(x => x.id === 'gale'); game.startWave(2);
    out.gale = Math.abs(game._env.spdMul / base.spd - 1.15) < 0.01;
    game._mut = WEEK_MUTATORS.find(x => x.id === 'surge'); game._recalc();
    out.surge = Math.abs(game.xpMult / base.xp - 1.5) < 0.01;
    // 3) 贪婪周结算 ×1.5
    game._mut = WEEK_MUTATORS.find(x => x.id === 'greed');
    game.mode = 'normal'; game.score = 16000; game.runBossKills = 0; game.runEliteKills = 0; game.relics = {};
    game.state = 'playing'; game._gameover();
    out.greed = Shop.lastEarn === 9; // floor(16000/2600)=6 → ×1.5
    game._mut = null;
    return out;
  });

  await page.close();
  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }

  console.log('本周变异(双开一致): ' + ma + ' / ' + mb);
  console.log('普通无变异: ' + r.normalNone + ' · 周挑战有变异: ' + r.weeklyHas + ' · 横幅含变异: ' + r.inBanner);
  console.log('狂暴火力: ' + r.rage + ' · 钢铁生命: ' + r.bulwark + ' · 疾风速度: ' + r.gale + ' · 经验风暴: ' + r.surge + ' · 贪婪星晶×1.5: ' + r.greed);

  const check = t.check;
  check(errors.length === 0, '无 JS 运行时异常');
  check(ma !== null && ma === mb, '同一周所有页面变异一致');
  check(r.normalNone, '普通/连战模式无变异');
  check(r.weeklyHas && r.inBanner, '周挑战变异合法且横幅播报');
  check(r.rage && r.bulwark && r.gale && r.surge, '环境类变异数值正确');
  check(r.greed, '贪婪周星晶结算 ×1.5');
  t.finish();
})().catch((e) => t.crash(e));
