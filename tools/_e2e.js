'use strict';
/* Playwright 端到端:静态服务 index.html -> 打开商城 -> 截图 + 校验
 * - 无 JS 运行时错误
 * - 商城稀有皮肤/机体不显示 undefined,而是"未解锁"
 * - 开箱结果弹层可弹出
 * 浏览器由 tools/_harness.js 解析(本机 Chrome / Edge / Playwright 自带 Chromium)。 */
const H = require('./_harness');
const t = H.suite('商城与截图');
const fs = require('fs');
const path = require('path');

(async () => {
  const server = await H.startServer();
  const port = server.address().port;
  const base = 'http://127.0.0.1:' + port + '/';
  const outDir = path.join(__dirname, '_shots');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await H.launch();
  const page = await browser.newPage({ viewport: { width: 520, height: 820 } });

  const errors = [];      // 真正的 JS 异常
  const consoleErrs = []; // 控制台 error(含资源 404 噪音)
  const notFound = [];
  H.watchErrors(page, errors);
  page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('requestfailed', (r) => notFound.push('requestfailed: ' + r.url()));
  page.on('response', (r) => { if (r.status() === 404) notFound.push('404: ' + r.url()); });

  // 预置充足货币,以便截图展示可购买/可开箱状态
  await page.addInitScript(() => {
    localStorage.setItem('deepstrike.crystal', '999999');
    localStorage.setItem('deepstrike.chips', '9999');
  });

  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  // 打开商城
  await page.click('#btnShop');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, '01-shop-top.png') });

  // 滚动到底部截随机道具/兑换所
  await page.evaluate(() => { const el = document.querySelector('#menuShop .panel'); if (el) el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, '02-shop-bottom.png') });

  // 校验:皮肤/机体网格里不得出现 "undefined"
  const skinHtml = await page.$eval('#skinGrid', (el) => el.innerText);
  const shipHtml = await page.$eval('#shipGrid', (el) => el.innerText);
  const hasUndefined = /undefined/i.test(skinHtml) || /undefined/i.test(shipHtml);
  // 校验:稀有款显示"未解锁"
  const hasLocked = /未解锁/.test(skinHtml) && /未解锁/.test(shipHtml);

  // 触发一次开箱(星辉密匣 ×1),弹层出现
  await page.evaluate(() => {
    const btn = document.querySelector('#boxGrid [data-openbox]');
    if (btn) btn.click();
  });
  await page.waitForTimeout(400);
  const boxVisible = await page.evaluate(() => {
    const ov = document.getElementById('boxOverlay');
    return ov && !ov.classList.contains('hidden');
  });
  await page.screenshot({ path: path.join(outDir, '03-box-result.png') });

  // 装备高级皮肤(nebula)后出击,截取战斗画面看特效
  await page.evaluate(() => {
    document.getElementById('btnBoxClose') && document.getElementById('btnBoxClose').click();
    Shop.owned['nebula'] = true; Shop.equipSkin('nebula');
    window.game.showMenuPanel('main');
    window.game.start();
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, '04-ingame-nebula.png') });

  await H.shutdown(browser, server);

  console.log('base url was ' + base);
  console.log('skinGrid 含 undefined: ' + /undefined/i.test(skinHtml));
  console.log('shipGrid 含 undefined: ' + /undefined/i.test(shipHtml));
  console.log('稀有款显示未解锁: ' + hasLocked);
  console.log('开箱弹层弹出: ' + boxVisible);
  console.log('JS 异常数: ' + errors.length);
  errors.forEach((e) => console.log('  ' + e));
  console.log('控制台 error 数: ' + consoleErrs.length);
  consoleErrs.forEach((e) => console.log('  ' + e));
  console.log('404/失败请求: ' + notFound.length);
  notFound.forEach((e) => console.log('  ' + e));

  const check = t.check;
  check(!hasUndefined, '商城不含 undefined 文案');
  check(hasLocked, '稀有款显示「未解锁」');
  check(boxVisible, '开箱结果弹层正常弹出');
  check(errors.length === 0, '无 JS 运行时异常');
  console.log('\nE2E 截图目录: ' + outDir);
  t.finish();
})().catch((e) => t.crash(e));
