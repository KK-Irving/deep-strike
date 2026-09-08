'use strict';
/* v1.4.1 要塞旗舰验证:变体轮换/炮塔受击/优先判定/全毁减速/击毁成就 */
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
    // 1) 变体轮换
    out.variants = bossVariant(40) === 'dread' && bossVariant(45) === 'tyrant' && bossVariant(35) === 'tyrant' && bossVariant(30) === 'dread' === false ? 'check' : (bossVariant(40) === 'dread' && bossVariant(45) === 'tyrant');
    out.variants = bossVariant(40) === 'dread' && bossVariant(45) === 'tyrant' && bossVariant(35) === 'tyrant';
    // 2) 构造要塞旗舰
    game.start('normal');
    game.wave = 40;
    game.boss = new Boss(40);
    game.boss.state = 'fight';
    game.boss.y = 120;
    game.boss.x = 240;
    const bo = game.boss;
    out.hasPods = bo.pods && bo.pods.length === 2 && bo.pods.every(p => !p.dead);
    const hp0 = bo.hp;
    // 3) 子弹优先命中炮塔(打在炮塔位置 → 舰体不掉血)
    game.playerBullets = [];
    const pod0 = bo.pods[0];
    const bx = bo.x + pod0.ox, by = bo.y + pod0.oy;
    game.playerBullets.push({ x: bx, y: by - 8, vx: 0, vy: -100, r: 3, dmg: 10, color: '#fff', dead: false, pierce: 0, split: 0 });
    game.player.invuln = 999; game.player.x = 240; game.player.y = 600;
    game._collide();
    out.podTook = pod0.hp < pod0.max;
    out.bodySafe = bo.hp === hp0;
    // 4) 摧毁全部炮塔 → 火力节奏 ×1.3
    bo.hitPod(bo.pods[1], 999999, game);
    out.cadence = (() => {
      bo.hp = bo.maxHp * 0.9; bo.phase = 0;
      bo.fireCd = 0; bo._attack(game); const c1 = bo.fireCd;
      bo.hitPod(bo.pods[0], 999999, game);
      bo.fireCd = 0; bo._attack(game); const c2 = bo.fireCd;
      return Math.abs(c2 / c1 - 1.3) < 0.01;
    })();
    // 5) 炮塔全毁横幅
    out.disarmBanner = game.banner && game.banner.text === '要塞武装解除';
    // 6) 击毁要塞 → 成就
    game.boss.damage(999999, game);
    out.ach = !!Ach.unlocked['dread_kill'];
    return out;
  });

  await page.close();
  await browser.close();
  server.close();
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }

  console.log('变体轮换(40/45/35): ' + r.variants);
  console.log('炮塔存在: ' + r.hasPods + ' · 炮塔优先受击: ' + r.podTook + ' · 舰体不受该弹伤害: ' + r.bodySafe);
  console.log('全毁后火力节奏 ×1.3: ' + r.cadence + ' · 解除武装横幅: ' + r.disarmBanner);
  console.log('击毁要塞成就: ' + r.ach);

  let bad = 0;
  const check = (cc, m) => { if (cc) console.log('ok: ' + m); else { console.error('FAIL: ' + m); bad++; } };
  check(errors.length === 0, '无 JS 运行时异常');
  check(r.variants, '40/45/35 波变体轮换正确');
  check(r.hasPods, '要塞旗舰携带两侧炮塔');
  check(r.podTook && r.bodySafe, '命中炮塔不穿透舰体');
  check(r.cadence, '炮塔全毁后火力间隔 ×1.3');
  check(r.disarmBanner, '全毁触发解除武装横幅');
  check(r.ach, '击毁要塞解锁拆塔专家成就');
  console.log(bad ? ('\nFAILED: ' + bad) : '\n要塞旗舰验证完成');
  process.exitCode = bad ? 1 : 0;
})().catch((e) => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
