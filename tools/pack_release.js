'use strict';
/* 发行包打包:dist/deep-strike-v<版本>.zip(全部运行文件 + README)
 * 用法:node tools/pack_release.js */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..');

const ver = (fs.readFileSync(path.join(ROOT, 'js', 'version.js'), 'utf8').match(/v[\d.]+/) || ['v?'])[0];
const dist = path.join(ROOT, 'dist', 'deep-strike-' + ver);
const RUN_FILES = ['index.html', 'README.md', 'css', 'js'];

// 清理旧产物
fs.rmSync(path.join(ROOT, 'dist'), { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

// 复制运行文件
for (const f of RUN_FILES) {
  const src = path.join(ROOT, f);
  const dst = path.join(dist, f);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.cpSync(src, dst, { recursive: true });
}
// Pages 友好:跳过 Jekyll 处理(无下划线路径时非必需,防御性放置)
fs.writeFileSync(path.join(dist, '.nojekyll'), '');

// zip(tar.gz 兜底:Windows Git Bash 无 zip 时)
const base = path.basename(dist);
try {
  execSync('tar -a -c -f "deep-strike-' + ver + '.zip" "' + base + '"', { cwd: path.join(ROOT, 'dist') });
  console.log('zip 生成');
} catch (e) {
  execSync('tar -czf "deep-strike-' + ver + '.tar.gz" "' + base + '"', { cwd: path.join(ROOT, 'dist') });
  console.log('tar.gz 生成(zip 不可用,已回退)');
}
const out = fs.readdirSync(path.join(ROOT, 'dist'));
console.log('dist 内容:', out.join(', '));
console.log('完成: dist/deep-strike-' + ver + '(.zip) — 可上传 itch.io(HTML, 勾选 played in browser)');
