'use strict';
/* _harness.js — e2e 测试统一基座(不入库的测试基础设施)
 *
 * 解决的问题:
 *   1) 23 个 _e2e_*.js 各自复制 HTTP 静态服务 + MIME 表 + 硬编码 Chrome 绝对路径;
 *   2) 断言输出格式各不相同(ok:/FAIL:/JSON dump),无法一眼判断;
 *   3) 换机器 / 换 Chrome 安装位置 / 进 CI 就集体挂掉。
 *
 * 用法(每个套件只需三行):
 *   const H = require('./_harness');
 *   const t = H.suite('战斗协同');          // 打印套件标题
 *   ...
 *   const server = await H.startServer();   // 随机端口静态服务(no-store)
 *   const browser = await H.launch();       // 自动解析 Chrome
 *   const errors = H.watchErrors(page);     // 收集 pageerror
 *   t.check(cond, '断言描述');              // 统一 ok/FAIL 输出
 *   await H.shutdown(browser, server);
 *   t.finish();                             // 汇总 + 设置退出码
 *
 * Chrome 解析顺序(可用 CHROME_PATH 覆盖):
 *   CHROME_PATH → PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH → 常见 Chrome 安装路径
 *   → 常见 Edge 安装路径 → PATH 上的 google-chrome/chromium → Playwright 自带 Chromium
 *
 * 输出契约(供 tools/_e2e_all.js 解析):
 *   每断言一行:  "  ok   <描述>"  /  "  FAIL <描述>"
 *   套件结束:    "[e2e] suite=<名> pass=<n> fail=<m> total=<t> result=PASS|FAIL ms=<ms>"
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { StringDecoder } = require('string_decoder');

const ROOT = path.join(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8'
};

/* ---------------------------------------------------------------- 静态服务 */

/* 启动随机端口的静态服务,根目录默认仓库根。返回 { server, port, base } 之外的
 * 原始 server,保持与旧脚本 `server.address().port` 用法兼容。 */
function startServer(opts) {
  const root = (opts && opts.root) || ROOT;
  const server = http.createServer((req, res) => {
    let p;
    try { p = decodeURIComponent(String(req.url || '/').split('?')[0]); } catch (_) { p = '/'; }
    if (p === '/' || p === '') p = '/index.html';
    const fp = path.resolve(root, '.' + p);
    const inside = fp === root || fp.startsWith(root + path.sep);
    if (!inside || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('404');
      return;
    }
    res.setHeader('Content-Type', MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream');
    // 无缓存:改完 js 直接刷新即可看到效果,避免 Chrome 内存缓存导致"改了没生效"
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    fs.createReadStream(fp).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      // 不因遗留的监听句柄拖住进程:正常路径仍由 browser 句柄维持事件循环
      server.unref();
      resolve(server);
    });
  });
}

/* ------------------------------------------------------------------ Chrome */

function exists(p) {
  try { return !!p && fs.existsSync(p); } catch (_) { return false; }
}

function findOnPath(names) {
  const dirs = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', ''] : [''];
  for (const dir of dirs) {
    for (const name of names) {
      for (const ext of exts) {
        const p = path.join(dir, name + ext);
        if (exists(p)) return p;
      }
    }
  }
  return null;
}

/* 返回 { path, source };path 为 null 表示交给 Playwright 自带 Chromium。 */
function resolveChrome() {
  const envKeys = ['CHROME_PATH', 'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'];
  for (const k of envKeys) {
    const v = process.env[k];
    if (v && exists(v)) return { path: v, source: 'env ' + k };
    if (v) return { path: null, source: 'env ' + k + ' 指向的文件不存在(' + v + '),回退 Playwright 自带 Chromium' };
  }

  const candidates = [];
  if (process.platform === 'win32') {
    const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const local = process.env['LOCALAPPDATA'] || '';
    for (const base of [pf, pf86]) {
      candidates.push(path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'));
      candidates.push(path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    }
    if (local) {
      candidates.push(path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'));
      candidates.push(path.join(local, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    }
  } else if (process.platform === 'darwin') {
    candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    candidates.push('/Applications/Chromium.app/Contents/MacOS/Chromium');
    candidates.push('/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
    const home = process.env.HOME || '';
    if (home) candidates.push(path.join(home, 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'));
  } else {
    candidates.push('/usr/bin/google-chrome');
    candidates.push('/usr/bin/google-chrome-stable');
    candidates.push('/usr/bin/chromium');
    candidates.push('/usr/bin/chromium-browser');
    candidates.push('/snap/bin/chromium');
    candidates.push('/usr/bin/microsoft-edge');
  }
  for (const c of candidates) if (exists(c)) return { path: c, source: '常见安装路径' };

  const onPath = findOnPath(process.platform === 'win32'
    ? ['chrome', 'msedge']
    : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']);
  if (onPath) return { path: onPath, source: 'PATH' };

  return { path: null, source: 'Playwright 自带 Chromium' };
}

function describeChrome() {
  const info = resolveChrome();
  return info.path ? (info.path + '(' + info.source + ')') : info.source;
}

/* 启动 headless 浏览器。默认加 --mute-audio,避免 CI 无音频设备时的噪音/告警。 */
async function launch(opts) {
  const { chromium } = require('playwright');
  const info = resolveChrome();
  const options = Object.assign({ headless: true, args: ['--mute-audio'] }, opts || {});
  if (info.path) options.executablePath = info.path;
  try {
    return await chromium.launch(options);
  } catch (e) {
    const msg = String(e && e.message || e);
    if (/spawn EPERM/i.test(msg)) {
      throw new Error('浏览器启动被拒绝(EPERM):' + (info.path || info.source)
        + '。受限沙箱/权限策略下无法 spawn 浏览器,请放宽权限重试,或用 CHROME_PATH 指向可用浏览器。原始错误: ' + msg);
    }
    if (/Executable doesn't exist|browserType\.launch/i.test(msg)) {
      throw new Error('无法启动浏览器(' + info.source + ')。请设置 CHROME_PATH 指向本机 Chrome,或执行 npx playwright install chromium。原始错误: ' + msg);
    }
    throw e;
  }
}

/* 关闭浏览器与静态服务(best-effort,不抛异常)。 */
async function shutdown(browser, server) {
  try { if (browser) await browser.close(); } catch (_) { /* ignore */ }
  try { if (server) await new Promise((r) => server.close(() => r())); } catch (_) { /* ignore */ }
}

/* ---------------------------------------------------------------- 断言输出 */

/* 收集页面未捕获异常。传入 sink 可复用外部数组。返回该数组。 */
function watchErrors(page, sink) {
  const errors = sink || [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  return errors;
}

/* 创建一个套件报告器。所有断言走 check(),结束调用 finish()。 */
function suite(name) {
  const label = String(name);
  const started = Date.now();
  let pass = 0;
  let fail = 0;
  let finished = false;

  console.log('\n=== ' + label + ' ===');

  const api = {
    check(cond, msg) {
      if (cond) { pass++; console.log('  ok   ' + msg); }
      else { fail++; console.error('  FAIL ' + msg); }
      return !!cond;
    },
    fail(msg) { return api.check(false, msg); },
    info(msg) { console.log('  info ' + msg); },
    crash(e) {
      fail++;
      console.error('  FAIL 未捕获异常: ' + (e && e.stack ? e.stack : e));
      api.finish();
      // 崩溃时可能残留 server/browser 句柄:下一轮事件循环强制退出,避免进程挂住
      setImmediate(() => process.exit(1));
    },
    finish() {
      if (finished) return fail === 0;
      finished = true;
      if (pass + fail === 0) {
        fail++;
        console.error('  FAIL 未执行任何断言(套件提前退出?)');
      }
      const total = pass + fail;
      const ms = Date.now() - started;
      const ok = fail === 0;
      console.log((ok ? '\nPASS ' : '\nFAIL ') + label + ' — ' + pass + '/' + total + ' 通过'
        + (fail ? ' · ' + fail + ' 失败' : '') + ' (' + ms + 'ms)');
      console.log('[e2e] suite=' + label + ' pass=' + pass + ' fail=' + fail + ' total=' + total
        + ' result=' + (ok ? 'PASS' : 'FAIL') + ' ms=' + ms);
      process.exitCode = ok ? 0 : 1;
      return ok;
    }
  };
  return api;
}

/* ------------------------------------------------------------------ 工具 */

/* 增量读取文件(用于 _e2e_all.js 的实时输出),处理跨 chunk 的多字节字符。 */
function createTail(logPath) {
  const decoder = new StringDecoder('utf8');
  let offset = 0;
  return function read() {
    let st;
    try { st = fs.statSync(logPath); } catch (_) { return ''; }
    if (st.size <= offset) return '';
    const len = st.size - offset;
    const buf = Buffer.allocUnsafe(len);
    const fd = fs.openSync(logPath, 'r');
    try { fs.readSync(fd, buf, 0, len, offset); } finally { fs.closeSync(fd); }
    offset = st.size;
    return decoder.write(buf);
  };
}

module.exports = {
  ROOT,
  MIME,
  startServer,
  resolveChrome,
  describeChrome,
  launch,
  shutdown,
  watchErrors,
  suite,
  createTail
};
