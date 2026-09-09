'use strict';
/* v1.4.3 敌机图鉴验证:分类型计数/首次收录星晶/旗舰收录/全收录成就/档案页渲染 */
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
    game.start('normal');
    game.stats.best = {}; game.stats.bestSeen = {};
    Shop.crystal = 0;
    const crystalAt = () => Shop.crystal;
    // 1) 首次击坠无人机:计数 1 + 星晶 5
    let c0 = crystalAt();
    game._bestiaryKill('drone');
    out.firstCount = game.stats.best.drone === 1;
    out.firstReward = crystalAt() === c0 + 5;
    // 2) 重复击坠:计数累加,不再发星晶
    c0 = crystalAt();
    game._bestiaryKill('drone');
    out.accCount = game.stats.best.drone === 2;
    out.noDoubleReward = crystalAt() === c0;
    // 3) 旗舰收录(暴君 +40)
    const fakeBoss = { variant: 'tyrant', isBoss: true };
    game.stats.bossKills = 0;
    game._bestiaryKill('boss_tyrant');
    out.bossSeen = !!game.stats.bestSeen.boss_tyrant;
    out.bossReward = crystalAt() === c0 + 40;
    // 4) 收录全部 → 博物学家成就
    for (const k of Object.keys(BESTIARY_INFO)) game._bestiaryKill(k);
    out.codexAll = (Ach.levelOf('bestiary') || 0) >= 5;
    // 5) 档案页渲染
    game.state = 'menu'; game.menuPanel = 'stats';
    game._refreshStatsPanel();
    const html = document.getElementById('bestiaryGrid').innerHTML || '';
    out.panel = html.indexOf('敌 机 图 鉴') < 0 && html.indexOf('已收录') >= 0 && html.indexOf('暴君旗舰') >= 0;
    // 6) 击杀链路:killEnemy 上报图鉴
    game.start('normal');
    game.stats.best = {}; game.stats.bestSeen = {};
    game.player.invuln = 999;
    game.buffs = { x2: 0, frenzy: 0, frost: 0, jam: 0 };
    const e0 = Object.assign(new Enemy('waver', 240, 1, null, null), { x: 240, y: 300 });
    game.killEnemy(e0);
    out.killHook = game.stats.best.waver === 1;
    return out;
  });

  await page.close();
  await browser.close();
  server.close();
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }

  console.log('首次收录 计数/星晶: ' + r.firstCount + '/' + r.firstReward);
  console.log('重复击坠 累加/不重复发奖: ' + r.accCount + '/' + r.noDoubleReward);
  console.log('旗舰收录+奖励: ' + r.bossSeen + '/' + r.bossReward);
  console.log('全收录成就: ' + r.codexAll);
  console.log('档案页渲染: ' + r.panel);
  console.log('击杀链路上报: ' + r.killHook);

  let bad = 0;
  const check = (cc, m) => { if (cc) console.log('ok: ' + m); else { console.error('FAIL: ' + m); bad++; } };
  check(errors.length === 0, '无 JS 运行时异常');
  check(r.firstCount && r.firstReward, '首次收录计数与星晶奖励');
  check(r.accCount && r.noDoubleReward, '重复击坠累加且不重复发奖');
  check(r.bossSeen && r.bossReward, '旗舰变体收录与奖励');
  check(r.codexAll, '全收录解锁博物学家成就');
  check(r.panel, '档案页图鉴面板正常渲染');
  check(r.killHook, 'killEnemy 自动上报图鉴');
  console.log(bad ? ('\nFAILED: ' + bad) : '\n敌机图鉴验证完成');
  process.exitCode = bad ? 1 : 0;
})().catch((e) => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
