'use strict';
/* v1.3.3 出击准备验证:购买扣芯片/重复拦截/开局生效(炸弹/强化选择/遗物五选一)/一次性消耗 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
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
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'networkidle' });

  const r = await page.evaluate(() => {
    const out = {};
    localStorage.removeItem('deepstrike.loadout');
    Shop.loadout = {};
    // 1) 购买:扣芯片;重复购买拦截
    Shop.chips = 9999;
    out.b1 = Shop.buyLoadout('bomb2').ok;
    out.b2 = Shop.buyLoadout('lv3').ok;
    out.b3 = Shop.buyLoadout('relic5').ok;
    const chipsAfterBuy = Shop.chips;            // 9999 - 80
    const dup = Shop.buyLoadout('bomb2');
    out.dupBlocked = !dup.ok && Shop.chips === chipsAfterBuy;
    out.chipsCost = chipsAfterBuy === 9999 - (15 + 25 + 40);
    // 2) 开局生效:炸弹 +1、立即弹出强化选择、遗物五选一标记
    game.start('normal');
    out.bombApplied = game.player.bombs === 3;   // 默认 2 + 1
    out.levelupOpened = game.state === 'levelup' && game._cardChoices.length > 0;
    out.loadoutCleared = Object.keys(Shop.loadout).length === 0;
    // 消耗 2 次强化选择
    let guard = 0;
    while (game.state === 'levelup' && game._cardChoices.length && guard++ < 10) game.chooseCard(0);
    out.picksConsumed = game.pendingLevels <= 0 && game.state === 'playing';
    // 3) 遗物五选一(直接打开遗物选择验证 _relicFive 通路)
    game.pendingRelic = true;
    game._openRelicChoice();
    out.relicFive = game._relicMode && game._relicChoices.length === 5;
    if (game._relicMode) game.chooseRelic(0);
    // 4) 第二次开局:无增益生效(炸弹回到默认 2,无强化弹窗)
    game.player.invuln = 999;
    game.start('normal');
    out.secondRun = game.player.bombs === 2 && game.state === 'playing' && game.pendingLevels === 0;
    // 5) 商城面板渲染出击准备区块
    game.toMenu();
    game.showMenuPanel('shop');
    out.panelRendered = (document.getElementById('loadoutGrid').innerHTML || '').indexOf('出击弹药') >= 0;
    return out;
  });

  await page.close();
  await browser.close();
  server.close();
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }

  console.log('三项购买: ' + [r.b1, r.b2, r.b3].join('/') + ' · 芯片扣除正确: ' + r.chipsCost + ' · 重复拦截: ' + r.dupBlocked);
  console.log('炸弹+1: ' + r.bombApplied + ' · 开局强化弹窗: ' + r.levelupOpened + ' · loadout 清空: ' + r.loadoutCleared);
  console.log('2 次强化消耗完毕: ' + r.picksConsumed);
  console.log('遗物五选一: ' + r.relicFive);
  console.log('第二次开局无增益: ' + r.secondRun);
  console.log('商城区块渲染: ' + r.panelRendered);

  let bad = 0;
  const check = (cc, m) => { if (cc) console.log('ok: ' + m); else { console.error('FAIL: ' + m); bad++; } };
  check(errors.length === 0, '无 JS 运行时异常');
  check(r.b1 && r.b2 && r.b3 && r.chipsCost && r.dupBlocked, '购买/扣费/重复拦截正常');
  check(r.bombApplied && r.levelupOpened && r.loadoutCleared, '开局生效:炸弹+1、强化弹窗、增益清空');
  check(r.picksConsumed, '紧急改装 2 次选择可正常消耗');
  check(r.relicFive, '情报网络使遗物五选一');
  check(r.secondRun, '一次性:第二次开局不再生效');
  check(r.panelRendered, '商城出击准备区块正常渲染');
  console.log(bad ? ('\nFAILED: ' + bad) : '\n出击准备验证完成');
  process.exitCode = bad ? 1 : 0;
})().catch((e) => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
