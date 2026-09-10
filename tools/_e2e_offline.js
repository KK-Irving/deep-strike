'use strict';
/* v1.9.6 离线补给站(Phase 4.1)验证:时间戳折算/8h 封顶/领取入账/任务事件源联动/时钟偏移安全/首访静默 */
const H = require('./_harness');
const t = H.suite('离线补给站');

(async () => {
  const server = await H.startServer();
  const port = server.address().port;
  const browser = await H.launch();
  const url = 'http://127.0.0.1:' + port + '/index.html';

  // 场景 A:8 小时前的时间戳 → 满额领取 + 每周星晶任务推进 + 领取后归零
  const pA = await browser.newPage();
  const errors = [];
  H.watchErrors(pA, errors);
  await pA.goto(url, { waitUntil: 'networkidle' });
  await pA.evaluate(() => {
    localStorage.setItem('deepstrike.offline', JSON.stringify({ t: Date.now() - 8 * 3600 * 1000 - 60000 }));
  });
  await pA.reload({ waitUntil: 'networkidle' });
  await pA.waitForTimeout(300);
  const a = await pA.evaluate(() => {
    const out = {};
    const info = Shop.offlineInfo();
    out.capped = info.gain === 336 && info.seconds === 8 * 3600; // 42★/时 × 8h
    const panel = document.getElementById('offlinePanel');
    out.panelVisible = !!panel && !panel.classList.contains('hidden') && panel.innerHTML.indexOf('离线补给站') >= 0;
    // 每周星晶任务事件源联动
    game.showMenuPanel('main');
    const wk = WeeklyTasks.state.tasks.find(x => x.id === 'crystal');
    const before = wk ? wk.p : -1;
    const beforeCrystal = Shop.crystal;
    const claimed = Shop.claimOffline();
    out.claimed = claimed.gain === 336 && Shop.crystal === beforeCrystal + 336;
    out.taskBumped = !wk || wk.p === before + 336;
    // 领取后时间戳重置 → 立即归零
    out.reset = Shop.offlineInfo().gain === 0;
    return out;
  });
  await pA.close();

  // 场景 B:时钟偏移(未来时间戳)→ 不产生负收益;首访 → 静默起算
  const pB = await browser.newPage();
  H.watchErrors(pB, errors);
  await pB.goto(url, { waitUntil: 'networkidle' });
  const b1 = await pB.evaluate(() => {
    const fresh = Shop.offlineInfo(); // 未写入过时间戳
    Shop.claimOffline();              // 首访:静默起算
    const after = Shop.offlineInfo();
    localStorage.setItem('deepstrike.offline', JSON.stringify({ t: Date.now() + 3600 * 1000 })); // 未来
    return { freshSilent: fresh.gain === 0, afterSilent: after.gain === 0 };
  });
  await pB.reload({ waitUntil: 'networkidle' });
  const b2 = await pB.evaluate(() => Shop.offlineInfo().gain === 0);
  await pB.close();

  await H.shutdown(browser, server);

  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }
  console.log('A 满额: ' + JSON.stringify(a));
  console.log('B 偏移: ' + JSON.stringify(b1) + ' 未来重载归零=' + b2);
  t.check(errors.length === 0, '无 JS 运行时异常');
  t.check(a.capped, '8 小时封顶 = 336★(42★/时)');
  t.check(a.panelVisible, '主菜单离线补给面板可见');
  t.check(a.claimed, '领取入账星晶');
  t.check(a.taskBumped, '领取计入累计星晶任务事件源');
  t.check(a.reset, '领取后重新起算');
  t.check(b1.freshSilent && b1.afterSilent && b2, '首访静默起算 + 未来时间戳无负收益');
  t.finish();
})().catch((e) => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
