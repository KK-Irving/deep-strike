'use strict';
/* 成就系统验证:加载页面,校验成就数据完整(无 undefined/重复 id)、分类数、
 * 关键新成就存在,并驱动几个解锁钩子确认可正常发放。 */
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
  const exe = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const page = await browser.newPage({ viewport: { width: 520, height: 820 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  const info = await page.evaluate(() => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
    const badFields = ACHIEVEMENTS.filter((a) => !a.id || !a.name || !a.desc || !a.cat || typeof a.reward !== 'number');
    const cats = [...new Set(ACHIEVEMENTS.map((a) => a.cat))];
    // 驱动几个解锁钩子
    const g = window.game;
    // 成就面板渲染
    g.showMenuPanel('stats');
    const panelText = document.getElementById('achList') ? document.getElementById('achList').innerText : '';
    // 直接触发几个新成就的解锁(验证发放链路不报错)
    const before = Ach.count();
    Ach.unlock('wave_40', g);
    Ach.unlock('combo_300', g);
    Ach.unlock('path_rail', g);
    Ach.unlock('tesla_chain8', g);
    Ach.unlock('rare_pull');
    const after = Ach.count();
    return {
      total: ACHIEVEMENTS.length,
      dupes, badCount: badFields.length,
      cats,
      hasQuatumCat: cats.includes('质变'),
      panelHasUndefined: /undefined/i.test(panelText),
      unlockedDelta: after - before,
      sampleNew: ['wave_50','total_10000','boss_100','combo_300','path_all','tesla_chain8','box_50','chip_master','ship_all','level_25']
        .every((id) => ids.includes(id))
    };
  });

  await browser.close();
  server.close();

  console.log('成就总数: ' + info.total);
  console.log('分类: ' + info.cats.join(' / '));
  console.log('重复 id: ' + (info.dupes.length ? info.dupes.join(',') : '无'));
  console.log('字段缺失条数: ' + info.badCount);
  console.log('面板含 undefined: ' + info.panelHasUndefined);
  console.log('本次解锁发放数: ' + info.unlockedDelta);

  let bad = 0;
  const check = (c, m) => { if (c) console.log('ok: ' + m); else { console.error('FAIL: ' + m); bad++; } };
  check(errors.length === 0, '无 JS 运行时异常');
  check(info.total >= 60, '成就数量显著增加(>=60,原 40)');
  check(info.dupes.length === 0, '无重复成就 id');
  check(info.badCount === 0, '所有成就字段完整');
  check(info.hasQuatumCat, '新增「质变」精通分类');
  check(!info.panelHasUndefined, '成就面板无 undefined');
  check(info.sampleNew, '关键高门槛新成就均存在');
  check(info.unlockedDelta >= 4, '新成就解锁发放链路正常');
  errors.forEach((e) => console.log('  ' + e));
  console.log(bad ? ('\nFAILED: ' + bad) : '\n成就验证完成');
  process.exitCode = bad ? 1 : 0;
})().catch((e) => { console.error('异常: ' + e.stack); process.exitCode = 1; });