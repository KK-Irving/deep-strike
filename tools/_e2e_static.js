'use strict';
/* 静态守卫(无需浏览器,不启动 Chrome):
 *  1) 编码:全仓文本文件必须合法 UTF-8 且无 BOM。
 *     背景:PowerShell 5 的 Set-Content -Encoding UTF8 / > 重定向会以 GBK 读入再写出,
 *     往返一次就能把源码里的中文注释与文案写坏;这里在测试门直接拦住。
 *  2) 种子流卫生:挑战模式的跨设备一致性要求"谁在消费种子流(rand/irand/RNG)"
 *     是显式受控的。本检查把全部消费点与白名单逐一比对 —— 表现层新增 rand() 会直接
 *     红灯,玩法层新增消费点也必须显式登记,防止无意破坏确定性契约(见 AGENTS.md)。
 *     已知且接受的消费层:
 *       · 波次导演 startWave —— 按波重播种,是"波次构成确定"的来源;
 *       · 运行期玩法(暴击/掉落/词缀/敌机行为)—— 每波重播种保证构成不受其影响,
 *         波内微观行为允许随帧率漂移(契约明确接受);
 *       · 商城/抽卡 —— 与挑战序列无关。 */
const H = require('./_harness');
const t = H.suite('静态守卫');

const fs = require('fs');
const path = require('path');

const ROOT = H.ROOT;
const TEXT_EXT = new Set(['.js', '.css', '.html', '.md', '.json', '.py', '.txt']);
const SKIP_DIRS = new Set(['node_modules', '.git', '.pw-browsers', '.npm-cache', '_shots', '_logs', 'report-output', '.workspace']);

/* ---------------------------------------------------------- 1) 编码守卫 */

function listTextFiles(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const fp = path.join(dir, name);
    const st = fs.statSync(fp);
    if (st.isDirectory()) listTextFiles(fp, out);
    else if (TEXT_EXT.has(path.extname(name))) out.push(fp);
  }
  return out;
}

function checkEncoding(files) {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bad = 0;
  for (const fp of files) {
    const rel = path.relative(ROOT, fp);
    const buf = fs.readFileSync(fp);
    const bom = (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) ? 'UTF-8 BOM'
      : (buf[0] === 0xFF && buf[1] === 0xFE) ? 'UTF-16LE BOM'
      : (buf[0] === 0xFE && buf[1] === 0xFF) ? 'UTF-16BE BOM' : null;
    let valid = true;
    try { decoder.decode(buf); } catch (e) { valid = false; }
    if (bom || !valid) {
      bad++;
      t.fail('编码异常: ' + rel + (bom ? ' 含 ' + bom : ' 不是合法 UTF-8'));
    }
  }
  t.check(bad === 0, '全部 ' + files.length + ' 个文本文件均为无 BOM 的合法 UTF-8');
}

/* ------------------------------------------------------ 2) 种子流卫生 */

/* 同长度把注释/字符串替换为空格:字符偏移不变,行号可直接映射 */
function blank(src) {
  const out = src.split('');
  let i = 0;
  let mode = 'normal';
  while (i < out.length) {
    const c = out[i], d = out[i + 1];
    if (mode === 'normal') {
      if (c === '/' && d === '/') { mode = 'line'; out[i] = out[i + 1] = ' '; i += 2; continue; }
      if (c === '/' && d === '*') { mode = 'block'; out[i] = out[i + 1] = ' '; i += 2; continue; }
      if (c === "'" || c === '"' || c === '`') { mode = c; out[i] = ' '; i++; continue; }
      i++; continue;
    }
    if (mode === 'line') { if (c === '\n') mode = 'normal'; else out[i] = ' '; i++; continue; }
    if (mode === 'block') {
      if (c === '*' && d === '/') { mode = 'normal'; out[i] = out[i + 1] = ' '; i += 2; continue; }
      if (c !== '\n') out[i] = ' ';
      i++; continue;
    }
    if (c === '\\') { out[i] = ' '; if (out[i + 1] !== undefined && out[i + 1] !== '\n') out[i + 1] = ' '; i += 2; continue; }
    if (c === mode) { mode = 'normal'; out[i] = ' '; i++; continue; }
    if (c !== '\n') out[i] = ' ';
    i++;
  }
  return out.join('');
}

const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'else', 'do', 'try', 'function']);
function headerName(line) {
  let m = line.match(/^\s*(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/);
  if (m) return m[1];
  m = line.match(/^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b[^{]*|\([^)]*\)\s*=>)\s*\{/);
  if (m) return m[1];
  m = line.match(/^\s*((?:get|set|static|async)\s+)*([A-Za-z_$][\w$]*)\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*\{\s*$/);
  if (m && !KEYWORDS.has(m[2])) return m[2];
  return null;
}

/* 种子流消费点白名单:file:Class>method(或 file:(top-level) / file:fnName)。
 * 语义:任何不在表内的 rand(/irand(/RNG( 调用都是红灯 —— 无论新增于表现层还是玩法层,
 * 都必须"有意识地"更新这张表,让确定性契约的每次变动都可被 review。 */
const STREAM_ALLOW = new Set([
  'entities.js:(top-level)',            // rand/irand 包装函数的定义本身
  // 实体构造与行为:构造参数按出怪队列顺序消费;波内行为允许随帧率漂移
  'entities.js:Enemy>constructor',
  'entities.js:Enemy>update',           // 射击间隔/母舰释放无人机偏移
  'entities.js:PowerUp>constructor',
  'entities.js:XPOrb>constructor',
  'entities.js:Wingman>constructor',
  'entities.js:Asteroid>constructor',
  'entities.js:Asteroid>damage',
  'entities.js:SupplyDrop>constructor',
  // 波次导演:按波重播种,是"波次构成确定"的来源(v1.9.3 起 startWave 位于 waves.js)
  'waves.js:startWave',
  // 运行期玩法随机:每波重播种保证构成不受影响
  'game.js:Game>_openRelicChoice',
  'game.js:Game>update',                // 事件波(陨石/空投)按队列时间生成
  'game.js:Game>_hitTarget',            // 暴击判定
  'game.js:Game>killEnemy',             // 击坠掉落/词缀触发
  'game.js:Game>killBoss',              // 旗舰遗物掉落
  'game.js:Game>_dropPower',
  'game.js:Game>_applyPower',           // 随机授予(遗物/道具)
  // 商城与抽卡:与挑战序列无关
  'shop.js:_grantPool',
  'shop.js:_grantGlory',
  'shop.js:_boxDropBoosted',
  'upgrades.js:drawUpgradeCards'        // 卡池加权抽取(挑战模式外套按抽卡序号派生的子流)
]);

const STREAM_RE = /\b(?:irand|rand|RNG)\s*\(/;

function scanFile(file) {
  const raw = fs.readFileSync(path.join(ROOT, 'js', file), 'utf8');
  const src = blank(raw);
  const lines = src.split('\n');
  const stack = [];
  let depth = 0;
  const found = [];
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;
    let name = headerName(line);
    if (!name) {
      const cm = line.match(/^\s*class\s+([A-Za-z_$][\w$]*)/);
      if (cm) name = 'class ' + cm[1];
    }
    if (name && opens > closes) stack.push({ name, depth: depth + opens - closes });
    depth += opens - closes;
    while (stack.length && depth < stack[stack.length - 1].depth) stack.pop();
    if (STREAM_RE.test(line)) {
      const fn = stack.map((s) => s.name.replace(/^class /, '')).join('>') || '(top-level)';
      found.push({ file, path: fn, line: li + 1, sample: raw.split('\n')[li].trim().slice(0, 80) });
    }
  }
  return found;
}

function checkStreamHygiene() {
  const files = fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js')).sort();
  const all = [];
  for (const f of files) all.push(...scanFile(f));

  // 扫描器自检:消费点数量级必须稳定,防止扫描器自身退化成"永远绿灯"
  t.check(all.length >= 20, '种子流扫描器工作正常(发现 ' + all.length + ' 个消费点)');

  const unknown = all.filter((c) => !STREAM_ALLOW.has(c.file + ':' + c.path));
  t.check(unknown.length === 0, '种子流消费点全部落在白名单内'
    + (unknown.length ? '(违例 ' + unknown.length + ' 处)' : ''));
  for (const u of unknown) t.fail(u.file + ':' + u.path + ' @L' + u.line + ' — ' + u.sample);

  // 反向:白名单不得腐烂(条目必须仍对应真实消费点,类名/函数名重构后同步更新)
  const have = new Set(all.map((c) => c.file + ':' + c.path));
  const stale = [...STREAM_ALLOW].filter((k) => k !== 'entities.js:(top-level)' && !have.has(k));
  t.check(stale.length === 0, '白名单无失效条目' + (stale.length ? ':' : ''));
  for (const s of stale) t.fail('白名单条目已无对应消费点(请清理或确认重构): ' + s);
}

/* --------------------------------------------- 3) 版本号三处一致(AGENTS.md 规则 2) */

function checkVersionSync() {
  const read = (p) => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch (e) { return ''; } };
  const verJs = (read('js/version.js').match(/GAME_VERSION\s*=\s*'([^']+)'/) || [])[1] || null;
  let pkgVer = null;
  try { pkgVer = 'v' + JSON.parse(read('package.json')).version; } catch (_) { /* ignore */ }
  const readme = read('README.md');
  const readmeVer = (readme.match(/\*\*当前版本[:：]\s*(v[\d.]+)\*\*/) || [])[1] || null;
  const ok = !!verJs && verJs === pkgVer && pkgVer === readmeVer;
  t.check(ok, '版本号三处一致(version.js / package.json / README): '
    + [verJs, pkgVer, readmeVer].map((v) => v || '缺失').join(' / '));
}

/* ------------------------------------------------------------------ 主流程 */

(async () => {
  checkEncoding(listTextFiles(ROOT, []));
  checkStreamHygiene();
  checkVersionSync();
  t.finish();
})().catch((e) => t.crash(e));
