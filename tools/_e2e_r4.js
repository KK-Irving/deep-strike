'use strict';
/* v4.5.4 优化收尾 验证:SW 动态缓存名/触屏虚拟按钮 */
const H = require('./_harness');
const t = H.suite('v4.5.4 优化收尾');

(async () => {
  const server = await H.startServer();
  const port = server.address().port;
  const browser = await H.launch();
  const ctx = await browser.newContext({ hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  H.watchErrors(page, errors);
  await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const r1 = await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    const keys = await caches.keys();
    const dyn = keys.every(k => /^deep-strike-v[\d.]+$/.test(k)); // 动态版本缓存名
    return { sw: regs.length >= 1, dyn, keys };
  });
  t.check(r1.sw && r1.dyn, 'SW 注册且缓存名按版本动态派生(' + r1.keys.join(',') + ')');

  // 触屏按钮:touch-ui 后可见,点击生效
  await page.evaluate(() => {
    const g = window.game;
    g.start('normal');
    g.state = 'playing'; g.player.alive = true;
    g.player.x = 240; g.player.y = 620; g.player.dashCd = 0; g.overload = 100;
    document.body.classList.add('touch-ui');
  });
  const dashVisible = await page.evaluate(() => {
    const b = document.getElementById('btnDashT');
    return b && b.offsetParent !== null;
  });
  t.check(dashVisible, '触屏冲刺按钮可见');
  await page.evaluate(() => document.getElementById('btnDashT').dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true })));
  const dashed = await page.evaluate(() => window.game.player.dashCd > 0 || window.game.player.dashT > 0);
  t.check(dashed, '触屏冲刺按钮生效');
  await page.evaluate(() => document.getElementById('btnOverT').dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true })));
  const ov = await page.evaluate(() => window.game.overload < 100);
  t.check(ov, '触屏过载按钮生效(能量消耗)');

  await ctx.close();
  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }
  t.finish();
})().catch(e => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
