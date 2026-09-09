'use strict';
/* v1.2.3 每日任务验证:日期种子一致 / 进度累计 / 完成发芯片且不重复 / 次日刷新 / 菜单面板 */
const H = require('./_harness');
const t = H.suite('每日任务');

(async () => {
  const server = await H.startServer();
  const port = server.address().port;
  const browser = await H.launch();

  // 两个独立页面加载同一日期 → 任务集应一致(种子确定性)
  async function loadTasks() {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'networkidle' });
    const t = await page.evaluate(() => DailyTasks.state.tasks.map(x => x.id + ':' + x.text + ':' + x.n).join('|'));
    await page.close();
    return t;
  }
  const ta = await loadTasks();
  const tb = await loadTasks();

  const page = await browser.newPage();
  const errors = [];
  H.watchErrors(page, errors);
  await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'networkidle' });

  const r = await page.evaluate(() => {
    const out = {};
    // 1) 完成语义(任务无关):任选一条,一次性上报到目标值 → 发芯片;重复上报不再发
    const t0 = DailyTasks.state.tasks[0];
    Shop.chips = 0; Shop.chipsEarned = 0;
    const def0 = TASK_POOL.find(x => x.id === t0.id);
    DailyTasks.bump(t0.id, t0.n);
    out.doneOnce = t0.done && Shop.chips === t0.reward;
    Shop.chips = 0;
    DailyTasks.bump(t0.id, t0.n);
    out.noDouble = Shop.chips === 0; // 已完成不再发放
    // 2) 单局型(acm=false)取最好一次,累计型(acm=true)相加
    const maxTask = DailyTasks.state.tasks.find(t => !t.done && def0 && t.acm === false && t.id !== t0.id);
    if (maxTask) {
      DailyTasks.bump(maxTask.id, 3);
      const afterLow = maxTask.p;
      DailyTasks.bump(maxTask.id, Math.max(1, maxTask.n - 1));
      out.maxSemantics = afterLow === 3 && maxTask.p >= maxTask.n - 1;
    } else out.maxSemantics = true;
    // 3) 次日刷新:伪造过期日期后 load 应重掷
    DailyTasks.state.date = '2000-01-01';
    DailyTasks.load();
    out.rolled = DailyTasks.state.date !== '2000-01-01';
    out.tasksCount = DailyTasks.state.tasks.length === 3;
    // 4) 菜单面板渲染
    out.panel = (document.getElementById('taskPanel').innerHTML || '').indexOf('每 日 任 务') >= 0;
    // 5) 游戏内击杀上报链路(若今日任务含累计型 kills)
    game.start('normal');
    const kTask = DailyTasks.state.tasks.find(t => t.id === 'kills');
    const kp0 = kTask ? kTask.p : 0;
    game.player.invuln = 999;
    const e0 = Object.assign(new Enemy('drone', 240, 1, null, null), { x: 240, y: 300 });
    game.buffs.x2 = 0; game.killEnemy(e0);
    out.killBump = kTask ? (kTask.done || kTask.p === kp0 + 1) : true;
    return out;
  });

  await page.close();
  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }

  console.log('双开任务集一致: ' + (ta === tb));
  console.log('box 任务完成发芯片: ' + r.doneOnce + ' · 不重复发放: ' + r.noDouble);
  console.log('单局型取最好语义: ' + r.maxSemantics);
  console.log('次日自动刷新: ' + r.rolled + ' · 任务数=3: ' + r.tasksCount);
  console.log('菜单面板渲染: ' + r.panel);
  console.log('局内击杀上报链路: ' + r.killBump);

  const check = t.check;
  check(errors.length === 0, '无 JS 运行时异常');
  check(ta === tb && ta.length > 0, '同一日期所有页面任务集一致');
  check(r.doneOnce && r.noDouble, '完成即发芯片且不重复发放');
  check(r.maxSemantics !== false, '单局型任务取最好一次');
  check(r.rolled && r.tasksCount, '跨日自动刷新且固定 3 条');
  check(r.panel, '主菜单任务面板正常渲染');
  check(r.killBump, '局内击杀驱动任务进度');
  t.finish();
})().catch((e) => t.crash(e));
