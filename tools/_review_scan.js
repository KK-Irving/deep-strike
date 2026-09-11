'use strict';
/* 模块 review 扫描器:静态扫全部 js 模块的常见问题(仅供 review 流程用,不进 npm test) */
const fs = require('fs');
const path = require('path');
const files = fs.readdirSync(path.join(__dirname, '..', 'js')).filter(f => f.endsWith('.js') && f !== 'version.js');
const issues = [];

for (const f of files) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
  const lines = src.split('\n');
  lines.forEach((l, i) => {
    const ln = i + 1;
    if (/console\.log\(/.test(l)) issues.push(`${f}:${ln} console.log 残留`);
    if (/\b(g0|label\d?):\s*\{/.test(l)) issues.push(`${f}:${ln} 死标签`);
    if (/debugger/.test(l)) issues.push(`${f}:${ln} debugger 残留`);
    if (/undefined/.test(l) && !/\/\//.test(l) && /=== 'undefined'|!== 'undefined'|typeof/.test(l) === false && !/no-undefined-check/.test(l)) {
      if (/= undefined\b/.test(l)) issues.push(`${f}:${ln} 直接赋值 undefined(应置 null)`);
    }
  });
  // 重复 id 定义(同文件)
  const ids = [...src.matchAll(/\{ id: '([\w-]+)'/g)].map(m => m[1]);
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
  if (dup.length) issues.push(`${f} 重复 id: ${[...new Set(dup)].join(',')}`);
  // 重复方法名(类/对象内近似检测)
  const methods = [...src.matchAll(/^ {2}([a-zA-Z_$][\w$]*)\(/gm)].map(m => m[1]);
  const dupM = methods.filter((v, i) => methods.indexOf(v) !== i);
  if (dupM.length) issues.push(`${f} 重复方法名: ${[...new Set(dupM)].join(',')}`);
  // 超长方法(>160 行)
  let starts = [];
  lines.forEach((l, i) => { if (/^ {2}[a-zA-Z_$][\w$]*\(.*\) \{/.test(l)) starts.push(i); });
  starts.push(lines.length);
  for (let i = 0; i < starts.length - 1; i++) {
    const len = starts[i + 1] - starts[i];
    if (len > 160) issues.push(`${f}:${starts[i] + 1} 超长方法 ${len} 行 — ${lines[starts[i]].trim().slice(0, 36)}`);
  }
}
console.log(issues.length ? issues.map(s => '  [!] ' + s).join('\n') : '  (无发现)');
console.log('合计:', issues.length);
