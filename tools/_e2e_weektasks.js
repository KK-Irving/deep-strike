'use strict';
/* v1.6.1 每日/每周任务 行为测试:
 *  1) 文案与目标数值同索引绑定(解析文案中的数字必须等于 n)
 *  2) 每周任务:按周播种、独立进度、芯片奖励更高
 *  3) 事件转发:每日 bump 同步驱动每周;星晶/每日完成数等新事件源生效
 *  4) 面板同时渲染 每日/每周 两节 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const fp = path.join(ROOT, p);
      if (!fp.startsWith(ROOT) || !fs.existsSync(fp)) { res.statusCode = 404; res.end('404'); return; }
      res.setHeader('Content-Type', MIME[path.extname(fp)] || 'application/octet-stream');
      fs.createReadStream(fp).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

(async () => {
  const server = await startServer();
  const port = server.address().port;
  const base = 'http://127.0.0.1:' + port + '/';
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 520, height: 820 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
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

  await browser.close();
  server.close();
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e2) => console.log('  ' + e2)); }
  console.log(JSON.stringify(r));
  let bad = 0;
  for (const k of Object.keys(r)) if (r[k] !== true) { console.error('FAIL: ' + k); bad++; }
  checkCount(bad);
  function checkCount(b) { console.log(b ? ('\nFAILED: ' + b) : '\n每日/每周任务验证完成'); process.exitCode = b ? 1 : 0; }
})().catch((e) => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
