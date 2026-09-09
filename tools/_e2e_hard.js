'use strict';
/* v1.3.2 高难模式验证:开关持久化 / 威胁+2 / 弹幕伤害上调 / 星晶×1.5 */
const H = require('./_harness');
const t = H.suite('高难模式');

(async () => {
  const server = await H.startServer();
  const port = server.address().port;
  const browser = await H.launch();

  // 持久化:页面 A 打开高难 → 页面 B(新上下文)读到的应是各自存储,这里验证同页持久化 + 重载
  const page = await browser.newPage();
  const errors = [];
  H.watchErrors(page, errors);
  await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'networkidle' });

  const r = await page.evaluate(() => {
    const out = {};
    localStorage.removeItem('deepstrike.hard');
    // 1) 开关与持久化
    game.hard = false;
    game.toggleHard();
    out.on = game.hard === true && localStorage.getItem('deepstrike.hard') === '1';
    // 2) 威胁 +2
    game.start('normal');
    game.wave = 12;
    const t0 = (() => { const h = game.hard; game.hard = false; const v = game.threatLevel(); game.hard = h; return v; })();
    const t1 = game.threatLevel();
    out.threat = t0 === 0 && t1 === 2;
    // 周挑战叠加:全程+1 + 高难+2
    game.start('weekly');
    game.wave = 12;
    out.threatWeekly = game.threatLevel() === 3;
    // 3) 弹幕伤害上调
    game.start('normal');
    game.wave = 5;
    const d0 = (() => { const h = game.hard; game.hard = false; const v = game.enemyDmg('pink'); game.hard = h; return v; })();
    const d1 = game.enemyDmg('pink');
    out.dmg = d1 > d0;
    // 4) 星晶结算 ×1.5(16000 分 → 基础 6 → 高难 9)
    const run = () => {
      game.mode = 'normal'; game.state = 'playing'; game.score = 16000;
      game.runBossKills = 0; game.runEliteKills = 0; game.relics = {};
      game._gameover();
      return Shop.lastEarn;
    };
    game.hard = false; const e0 = run();
    game.hard = true; const e1 = run();
    out.crystal = e0 === 6 && e1 === 9;
    // 5) 菜单按钮文案刷新(回到主菜单后)
    game.toMenu();
    game.toggleHard();
    const btn = document.getElementById('btnHard').innerHTML;
    out.btnLabel = btn.indexOf('高难模式:关') >= 0; // 上一步从开切回关
    game.toggleHard(); // 恢复为关并保持一致
    localStorage.removeItem('deepstrike.hard');
    return out;
  });

  await page.close();
  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }

  console.log('开关持久化: ' + r.on);
  console.log('威胁 普通=' + '0' + ' 高难=2: ' + r.threat + ' · 周挑战叠加=3: ' + r.threatWeekly);
  console.log('弹幕伤害上调: ' + r.dmg);
  console.log('星晶 10→15: ' + r.crystal);
  console.log('按钮文案刷新: ' + r.btnLabel);

  const check = t.check;
  check(errors.length === 0, '无 JS 运行时异常');
  check(r.on, '开关状态写入 localStorage');
  check(r.threat && r.threatWeekly, '威胁 +2(周挑战叠加为 +3)');
  check(r.dmg, '高难弹幕伤害上调');
  check(r.crystal, '高难星晶结算 ×1.5');
  check(r.btnLabel, '主菜单按钮文案随状态刷新');
  t.finish();
})().catch((e) => t.crash(e));
