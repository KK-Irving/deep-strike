'use strict';
/* v4.5.3 PWA 离线 验证:SW 注册/预缓存/离线回退 */
const H = require('./_harness');
const t = H.suite('PWA 离线');

(async () => {
  const serverInfo = await H.startServer();
  const server = serverInfo;
  const srv = server;
  const port = server.address().port;
  const browser = await H.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  H.watchErrors(page, errors);
  await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600); // 等 SW install

  const r1 = await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    const keys = await caches.keys();
    let cached = 0;
    if (keys.length) {
      const cache = await caches.open(keys[0]);
      cached = (await cache.keys()).length;
    }
    return { sw: regs.length >= 1, cached, cachedOk: cached >= 15 };
  });
  t.check(r1.sw, 'Service Worker 注册成功');
t.check(r1.cachedOk, '预缓存 app shell(' + r1.cached + ' 文件)');
  

  // 离线回退:断网后 reload 仍可玩
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  const r2 = await page.evaluate(() => ({ state: window.game ? window.game.state : 'no-game', ver: window.GAME_VERSION }));
  t.check(r2.state === 'menu', '离线加载后正常进入主菜单');
  await ctx.setOffline(false);

  await ctx.close();
  await browser.close();
  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }
  console.log(JSON.stringify({ r1, r2 }));
  t.check(r2.state === 'menu', '离线状态正常');
  t.finish();
})().catch(e => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
