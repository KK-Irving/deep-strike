'use strict';
/* 版本号提升工具(AGENTS.md 规则 2 的配套):三处同步,杜绝漏升。
 * 用法:
 *   node tools/bump.js            → 自动 +0.0.1
 *   node tools/bump.js 4.5.0      → 指定版本(突破性/改造性时手动给中位)
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let target = process.argv[2];
if (!target) {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const [M, m, p] = pkg.version.split('.').map(Number);
  target = `${M}.${m}.${p + 1}`;
}
const V = 'v' + target;

fs.writeFileSync(path.join(ROOT, 'js', 'version.js'),
  `/* 游戏版本号 — 随每次迭代提交递增(由 tools/bump.js 维护) */\nwindow.GAME_VERSION = '${V}';\n`);

const pkgPath = path.join(ROOT, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = target;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

const readmePath = path.join(ROOT, 'README.md');
let readme = fs.readFileSync(readmePath, 'utf8').replace(/\r\n/g, '\n');
readme = readme.replace(/\*\*当前版本:v[\d.]+\*\*/, `**当前版本:${V}**`);
fs.writeFileSync(readmePath, readme);

console.log('版本已提升至 ' + V + '(version.js / package.json / README 三处同步)');
