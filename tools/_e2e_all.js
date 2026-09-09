'use strict';
/* _e2e_all.js — 全量 e2e 运行器(入口:npm test)
 *
 * 为什么不用管道:DSH/受限沙箱下 Node 的 pipe stdio 会 spawn EPERM。
 * 这里用「文件描述符捕获 + 增量 tail」实现同样的实时输出,且在本机/CI/沙箱都能跑。
 *
 * 用法:
 *   node tools/_e2e_all.js                # 顺序跑全部套件
 *   node tools/_e2e_all.js --only=combat,shop2
 *   node tools/_e2e_all.js --jobs=2       # 并发(并发时不做实时输出,避免交叉)
 *   node tools/_e2e_all.js --timeout=300  # 单套件超时(秒,默认 300)
 *   node tools/_e2e_all.js --quiet        # 只打结果行
 *   node tools/_e2e_all.js --list         # 只列出会跑的套件
 *
 * 退出码:全部通过 0,否则 1。
 */

const cp = require('child_process');
const fs = require('fs');
const path = require('path');

const TOOLS = __dirname;
const ROOT = path.join(TOOLS, '..');
const LOG_DIR = path.join(TOOLS, '_logs');

const argv = process.argv.slice(2);
function opt(name) {
  const hit = argv.find((a) => a === '--' + name || a.startsWith('--' + name + '='));
  if (!hit) return null;
  const eq = hit.indexOf('=');
  return eq >= 0 ? hit.slice(eq + 1) : '';
}
const only = String(opt('only') || '').split(',').map((s) => s.trim()).filter(Boolean);
const jobs = Math.max(1, Number(opt('jobs') || 1) || 1);
const timeoutMs = Math.max(10, Number(opt('timeout') || 300) || 300) * 1000;
const quiet = argv.includes('--quiet');
const verbose = argv.includes('--verbose');

/* --------------------------------------------------------------- 发现套件 */

function discover() {
  return fs.readdirSync(TOOLS)
    .filter((f) => /^_e2e.*\.js$/.test(f))
    .filter((f) => f !== '_e2e_all.js' && f !== '_harness.js')
    .filter((f) => !only.length || only.some((k) => f.indexOf(k) >= 0))
    .sort();
}

/* --------------------------------------------------------------- 单套件运行 */

function parseSummary(logText) {
  // 套件名可能含空格(如「5 级制与进化」),用非贪婪匹配到 " pass="
  const m = logText.match(/\[e2e\] suite=(.+?) pass=(\d+) fail=(\d+) total=(\d+) result=(PASS|FAIL)/);
  if (!m) return null;
  return { name: m[1], pass: Number(m[2]), fail: Number(m[3]), total: Number(m[4]), result: m[5] };
}

function runSuite(file) {
  return new Promise((resolve) => {
    const logPath = path.join(LOG_DIR, file.replace(/\.js$/, '.log'));
    const started = Date.now();
    const base = { file, logPath, ms: 0, code: null, timedOut: false, spawnError: null, summary: null };

    let fd;
    let child;
    try {
      fd = fs.openSync(logPath, 'w');
      child = cp.spawn(process.execPath, [path.join(TOOLS, file)], {
        cwd: ROOT,
        stdio: ['ignore', fd, fd], // 不用管道:受限环境会 EPERM
        windowsHide: true
      });
    } catch (e) {
      try { if (fd !== undefined) fs.closeSync(fd); } catch (_) { /* ignore */ }
      resolve(Object.assign(base, { spawnError: e, ms: Date.now() - started }));
      return;
    }
    fs.closeSync(fd); // 子进程已持有自己的副本

    const tail = require('./_harness').createTail(logPath);
    const stream = !quiet && jobs === 1;
    const pump = () => { const s = tail(); if (s) process.stdout.write(s); };
    const tick = stream ? setInterval(pump, 120) : null;

    let settled = false;
    const done = (extra) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (tick) clearInterval(tick);
      if (stream) pump();
      let logText = '';
      try { logText = fs.readFileSync(logPath, 'utf8'); } catch (_) { /* ignore */ }
      resolve(Object.assign(base, { ms: Date.now() - started, summary: parseSummary(logText), logText }, extra));
    };

    const timer = setTimeout(() => {
      base.timedOut = true;
      try { child.kill(); } catch (_) { /* ignore */ }
    }, timeoutMs);

    child.on('error', (e) => done({ spawnError: e }));
    child.on('close', (code) => done({ code }));
  });
}

/* ------------------------------------------------------------------ 汇总 */

function width(s) {
  let w = 0;
  for (const ch of String(s)) w += /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/.test(ch) ? 2 : 1;
  return w;
}
function pad(s, n) { return String(s) + ' '.repeat(Math.max(0, n - width(s))); }

function judge(r) {
  if (r.spawnError) return { ok: false, why: 'spawn 失败: ' + (r.spawnError.code || r.spawnError.message) };
  if (r.timedOut) return { ok: false, why: '超时 ' + Math.round(timeoutMs / 1000) + 's 被终止' };
  if (r.code !== 0) return { ok: false, why: '退出码 ' + r.code };
  if (!r.summary) return { ok: false, why: '无 [e2e] 结果行(套件可能提前退出)' };
  if (r.summary.result !== 'PASS') return { ok: false, why: '汇总行 FAIL' };
  return { ok: true, why: '' };
}

function printFailureDetail(r) {
  const text = r.logText || '';
  if (!text) return;
  const lines = text.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
  const show = quiet ? lines : lines.slice(-20);
  console.error('  --- ' + r.file + ' 日志' + (quiet ? '' : '尾部') + ' (' + r.logPath + ') ---');
  for (const line of show) console.error('  | ' + line);
  if (/EPERM/i.test(text)) {
    console.error('  ! 日志中出现 EPERM:受限沙箱下 Chrome 无法启动,请放宽权限后重试,或设置 CHROME_PATH。');
  }
}

/* ------------------------------------------------------------------ 主流程 */

(async () => {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const suites = discover();
  if (!suites.length) {
    console.error('未发现任何 _e2e*.js 套件(--only=' + only.join(',') + ')');
    process.exitCode = 1;
    return;
  }
  if (argv.includes('--list')) {
    suites.forEach((f, i) => console.log(pad(String(i + 1) + '.', 5) + f));
    return;
  }

  let chrome = '(未检测)';
  try { chrome = require('./_harness').describeChrome(); } catch (e) { chrome = 'Playwright 不可用: ' + e.message; }

  console.log('e2e 全量运行: ' + suites.length + ' 个套件 · 并发 ' + jobs
    + ' · 单套件超时 ' + Math.round(timeoutMs / 1000) + 's');
  console.log('浏览器: ' + chrome);
  console.log('日志目录: ' + LOG_DIR);
  console.log('');

  const started = Date.now();
  const results = new Array(suites.length);
  let cursor = 0;

  async function worker() {
    while (cursor < suites.length) {
      const idx = cursor++;
      const file = suites[idx];
      if (jobs > 1 || quiet) console.log('▶ [' + (idx + 1) + '/' + suites.length + '] ' + file + ' ...');
      const r = await runSuite(file);
      const v = judge(r);
      results[idx] = Object.assign(r, { ok: v.ok, why: v.why });
      if (!v.ok) {
        console.log('');
        console.log('✘ [' + (idx + 1) + '/' + suites.length + '] ' + file + ' — ' + v.why);
        printFailureDetail(results[idx]);
      } else if (jobs > 1 || quiet) {
        console.log('✔ [' + (idx + 1) + '/' + suites.length + '] ' + file + ' — '
          + r.summary.pass + '/' + r.summary.total + ' (' + (r.ms / 1000).toFixed(1) + 's)');
      }
      if (verbose && jobs > 1) printFailureDetail(results[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(jobs, suites.length) }, worker));

  const totalMs = Date.now() - started;
  const failed = results.filter((r) => r && !r.ok);
  const passed = results.filter((r) => r && r.ok);
  const nameW = Math.max(12, ...results.map((r) => width((r && r.summary && r.summary.name) || r.file)));

  console.log('\n────────────────────────────────────────────────────────');
  console.log('e2e 汇总:' + suites.length + ' 套件 · 通过 ' + passed.length + ' · 失败 ' + failed.length
    + ' · 总耗时 ' + (totalMs / 1000).toFixed(1) + 's');
  for (const r of results) {
    const label = (r.summary && r.summary.name) || r.file;
    const counts = r.summary ? (r.summary.pass + '/' + r.summary.total) : '-';
    console.log('  ' + (r.ok ? 'PASS' : 'FAIL') + ' ' + pad(label, nameW) + '  ' + pad(counts, 8)
      + pad((r.ms / 1000).toFixed(1) + 's', 9) + (r.ok ? '' : (r.why + ' · ' + r.logPath)));
  }
  if (failed.length) {
    console.log('失败套件:' + failed.map((r) => r.file).join(', '));
  }
  console.log('────────────────────────────────────────────────────────');
  process.exitCode = failed.length ? 1 : 0;
})().catch((e) => {
  console.error('运行器异常: ' + (e && e.stack ? e.stack : e));
  process.exitCode = 1;
});
