'use strict';
/* v2.2.2 样式扩充 验证:3 款新机体可购/装备生效/造型管线 + 远征星图渲染 */
const H = require('./_harness');
const t = H.suite('样式扩充');

(async () => {
  const server = await H.startServer();
  const port = server.address().port;
  const browser = await H.launch();
  const page = await browser.newPage();
  const errors = [];
  H.watchErrors(page, errors);
  await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  const r = await page.evaluate(() => {
    const g = window.game;
    const out = {};
    Shop.crystal = 50000; Shop.save();
    // 3 款新机体可购 + hull 造型管线齐全
    out.newShips = ['ronin', 'fortress2', 'zenith'].every(id => {
      const sh = SHIPS.find(x => x.id === id);
      return sh && SHIP_SHAPES[id] && Shop.buyShip(id).ok;
    });
    // 天顶装备生效(数值/侧翼)
    Shop.equipShip('zenith'); g.start('normal');
    out.zenith = g.shipDef.id === 'zenith' && g.shipDef.perkSide === 1 && g.player.maxHp >= 105;
    // 远征星图渲染
    localStorage.setItem('deepstrike.campaign', JSON.stringify({ 1: 3, 2: 1 }));
    g.state = 'menu'; g.menuPanel = 'stats'; g._refreshStatsPanel();
    const html = document.getElementById('achList').innerHTML;
    out.starMap = html.indexOf('远 征 星 图') >= 0 && html.indexOf('★★★') >= 0 && html.indexOf('🔒') >= 0;
    g.state = 'menu';
    return out;
  });

  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }
  console.log(JSON.stringify(r));
  t.check(errors.length === 0, '无 JS 运行时异常');
  t.check(r.newShips, '3 款新机体可购且造型管线齐全');
  t.check(r.zenith, '天顶机体装备生效(数值/侧翼)');
  t.check(r.starMap, '远征星图渲染(章号/星级/锁定)');
  t.finish();
})().catch(e => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
