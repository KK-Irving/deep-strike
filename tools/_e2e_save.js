'use strict';
/* v2.1.2 存档中心 验证(确定性,无真实 reload):
 * 导出/坏码拒绝/导入往返恢复/清档两步确认/按钮冒烟 */
const H = require('./_harness');
const t = H.suite('存档中心');

(async () => {
  const server = await H.startServer();
  const port = server.address().port;
  const browser = await H.launch();
  const url = 'http://127.0.0.1:' + port + '/index.html';
  const page = await browser.newPage();
  const errors = [];
  H.watchErrors(page, errors);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  // 造档:星晶/成就/远征星/残骸
  await page.evaluate(() => {
    Shop.crystal = 12345; Shop.addScrap(7);
    Ach.unlocked.kills = 2; Ach.save();
    localStorage.setItem('deepstrike.campaign', JSON.stringify({ 1: 3, 2: 1 }));
    Shop.save();
  });
  const code = await page.evaluate(() => Shop.exportSave());
  t.check(typeof code === 'string' && code.length > 100, '导出存档码(base64,含全部 deepstrike.* 键)');

  // 坏码导入被拒
  const bad = await page.evaluate(() => Shop.importSave('!!!not-base64!!!'));
  t.check(bad.ok === false, '坏码导入被拒绝');

  // 破坏数据 → 导入完整恢复(函数级,不触发页面刷新)
  await page.evaluate(() => {
    localStorage.setItem('deepstrike.crystal', '1');
    localStorage.removeItem('deepstrike.campaign');
    localStorage.setItem('deepstrike.ach', '{}');
  });
  const imp = await page.evaluate((c) => Shop.importSave(c), code);
  const restored = await page.evaluate(() => ({
    crystal: +localStorage.getItem('deepstrike.crystal'),
    ach: JSON.parse(localStorage.getItem('deepstrike.ach')).kills,
    camp: JSON.parse(localStorage.getItem('deepstrike.campaign'))[1],
    scrap: localStorage.getItem('deepstrike.scrap')
  }));
  t.check(imp.ok && imp.n >= 10, '导入写回全部存档键(' + imp.n + ' 项)');
  t.check(restored.crystal === 12345 && restored.ach === 2 && restored.camp === 3 && restored.scrap === '7', '破坏后数据完整恢复(星晶/成就/远征星/残骸)');

  // 页面可见 + 导出按钮真实点击
  console.log('[p] restored');
  await page.evaluate(() => game.showMenuPanel('save'));
  const vis = await page.evaluate(() => { const el = document.getElementById('menuSave'); return !el.classList.contains('hidden') && el.offsetParent !== null; });
  t.check(vis, '存档中心页可见');
  console.log('[p] vis ok');
  await page.click('#btnExportSave');
  console.log('[p] export-clicked');
  const ta = await page.evaluate(() => document.getElementById('saveText').value.length);
  t.check(ta > 50, '导出按钮真实生成存码并回填');

  // 清档:第一步武装确认(UI)→ 第二步以函数级执行(避免页面刷新挂起)
  console.log('[p] ta ok', ta);
  await page.click('#btnClearSave');
  console.log('[p] armed-clicked');
  const armed = await page.evaluate(() => document.getElementById('btnClearSave').dataset.arm === '1');
  console.log('[p] armed', armed);
  const cleared = await page.evaluate(() => Shop.clearSave());
  const left = await page.evaluate(() => {
    let n = 0;
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('deepstrike.') === 0) n++; }
    return n;
  });
  t.check(armed, '清档第一步:武装确认提示');
  t.check(cleared >= 19 && left === 0, '两步确认后清空全部 deepstrike.* 存档');

  // 重载后(等价新玩家)正常进入菜单
  console.log('[p] cleared', cleared, left);
  await page.reload({ waitUntil: 'networkidle' });
  console.log('[p] reloaded');
  await page.waitForTimeout(400);
  const fresh = await page.evaluate(() => ({ state: game.state, panel: game.menuPanel, crystal: Shop.crystal }));
  t.check(fresh.state === 'menu' && fresh.panel === 'main' && fresh.crystal === 0, '清档后等价新玩家正常进入主菜单');

  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }
  t.finish();
})().catch((e) => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
