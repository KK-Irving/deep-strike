'use strict';
/* v1.6.1 每日/每周任务 行为测试:
 *  1) 文案与目标数值同索引绑定(解析文案中的数字必须等于 n)
 *  2) 每周任务:按周播种、独立进度、芯片奖励更高
 *  3) 事件转发:每日 bump 同步驱动每周;星晶/每日完成数等新事件源生效
 *  4) 面板同时渲染 每日/每周 两节 */
const H = require('./_harness');
const t = H.suite('每日/每周任务');

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
    const out = {};
    // 1) 全池文案与数值绑定校验(两池全量,非随机抽样)
    const pairOk = (pool) => pool.every(t => t.texts.length === t.ns.length && t.texts.every((tx, i) => {
      const nums = (tx.match(/\d+/g) || []).map(Number);
      return nums.length > 0 && nums[nums.length - 1] === t.ns[i];
    }));
    out.dailyPair = pairOk(TASK_POOL);
    out.weekPair = pairOk(WEEK_TASK_POOL);
    // 运行态 100 次重抽校验(覆盖各日期种子分支)
    let rollOk = true;
    for (let i = 0; i < 100; i++) {
      const st = DailyTasks._rollPool('test:' + i, TASK_POOL, 3, {});
      for (const t of st.tasks) {
        const nums = (t.text.match(/\d+/g) || []).map(Number);
        if (!nums.length || nums[nums.length - 1] !== t.n) rollOk = false;
      }
    }
    out.rollBound = rollOk;
    // 2) 每周任务:独立周期播种与进度
    WeeklyTasks._weekKey = () => '2099-W01'; // 固定测试周
    WeeklyTasks._roll();
    out.weekCount = WeeklyTasks.state.tasks.length === 4;
    out.weekSeeded = WeeklyTasks.state.week === '2099-W01';
    const wk = WeeklyTasks.state.tasks.find(t => t.id === 'kills');
    if (wk) {
      DailyTasks.bump('kills', wk.n, null); // 每日 bump 转发至每周
      out.weekForward = wk.done === true;
      const chipsAfter = Shop.chips;
      out.weekReward = chipsAfter >= wk.reward;
    } else out.weekForward = false;
    // 3) 星晶事件源 → 每周 crystal 任务
    const ck = WeeklyTasks.state.tasks.find(t => t.id === 'crystal');
    if (ck && !ck.done) {
      const before = ck.p;
      Shop.addCrystal(100, null);
      out.crystalHook = ck.p === before + 100;
    } else out.crystalHook = true; // 本周未抽到 crystal 任务则跳过
    // 4) 每日完成 → 每周 daily 计数
    const dk = WeeklyTasks.state.tasks.find(t => t.id === 'daily');
    if (dk && !dk.done) {
      const before = dk.p;
      const t0 = DailyTasks.state.tasks.find(t => !t.done);
      if (t0) {
        DailyTasks.bump(t0.id, t0.n, null);
        out.dailyCounter = dk.p === before + 1;
      } else out.dailyCounter = true;
    } else out.dailyCounter = true;
    // 5) 面板两节渲染
    game._refreshTasks();
    const html = document.getElementById('taskPanel').innerHTML;
    out.panelBoth = html.indexOf('每 日 任 务') >= 0 && html.indexOf('每 周 任 务') >= 0;
    return out;
  });

  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e2) => console.log('  ' + e2)); }
  t.info('原始结果: ' + JSON.stringify(r));
  for (const k of Object.keys(r)) t.check(r[k] === true, k);
  t.check(errors.length === 0, '无 JS 运行时异常');
  t.finish();
})().catch((e) => t.crash(e));
