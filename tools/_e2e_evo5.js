'use strict';
/* v1.6.0 卡片统一 5 级制 + 全员进化 行为测试:
 *  1) 抽卡池排除满级卡;满级卡必注入对应进化(传说卡替换候选)
 *  2) 33 张卡与 33 条进化一一对应(每卡都有进化线)
 *  3) 5 级制数值重平衡抽样验证(射速/推进/磁吸/经验/连击/护盾/时滞/生命/装甲/汲取/僚机/裂隙/不屈/反击/歼灭)
 *  4) 进化质变抽样(彗星引擎/奇点磁场/万炮齐发/双子侧翼/龙鳞尾炮/幽灵中队/泰坦装甲/守护天使/净化类)
 *  5) 满级成就(maxed_3)在 5 级制下照常解锁 */
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
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 520, height: 820 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  const r = await page.evaluate(() => {
    const g = window.game;
    const out = {};
    // 1) 结构:全员 5 级、进化全覆盖
    out.allMax5 = UPGRADES.every(u => u.max === 5);
    out.evoCover = UPGRADES.every(u => EVOLUTIONS.some(e => e.base === u.id));
    out.evoUnique = new Set(EVOLUTIONS.map(e => e.base)).size === EVOLUTIONS.length;
    // 2) 满级卡不入池;满级且未进化 → 必注入进化
    const mods = { dmg: 5, rate: 5, speed: 3 };
    let evoSeen = 0, maxedSeen = 0;
    for (let i = 0; i < 400; i++) {
      const picks = drawUpgradeCards(mods, 8, 10, {});
      if (picks.some(p => p.isEvo && p.base === 'dmg')) evoSeen++;
      if (picks.some(p => p.id === 'dmg')) maxedSeen++;
    }
    out.evoInjected = evoSeen > 25;    // 三选一之一为进化(dmg/rate 二选一注入,期望约 1/6)
    out.maxedExcluded = maxedSeen === 0;
    // 已进化后不再注入
    let evoAgain = 0;
    for (let i = 0; i < 100; i++) {
      const picks = drawUpgradeCards(mods, 8, 10, { dmg: true, rate: true });
      if (picks.some(p => p.isEvo)) evoAgain++;
    }
    out.evoOnceOnly = evoAgain === 0;
    // 3) 数值抽样
    g.start('normal');
    const base = { interval: g.player.fireInterval, speed: g.player.speed, magnet: g.player.magnetR, hp: g.player.maxHp };
    g.mods = { rate: 5 }; g._recalc();
    out.rate5 = Math.abs(g.player.fireInterval - base.interval * Math.pow(0.88, 5)) < 1e-9;
    g.mods = { speed: 5 }; g._recalc();
    out.speed5 = Math.abs(g.player.speed / (base.speed) - Math.pow(1.10, 5)) < 1e-9;
    g.mods = { magnet: 5 }; g._recalc();
    out.magnet5 = Math.abs(g.player.magnetR - (140 + 45 * 5)) < 1e-9;
    g.mods = { xpchip: 5 }; g._recalc();
    out.xp5 = Math.abs(g.xpMult - (1 + 0.15 * 5)) < 1e-9;
    g.mods = { combo: 5 }; g._recalc();
    out.combo5 = Math.abs(g.comboWindow - (2 + 0.7 * 5)) < 1e-9;
    g.mods = { shieldgen: 5 }; g._recalc();
    out.shield5 = Math.abs(g.player.shieldInterval - 7) < 1e-9;
    g.mods = { time: 5 }; g._recalc();
    out.time5 = Math.abs(g.bulletSlow - 0.5) < 1e-9;
    g.mods = { time: 5 }; g.bonds = ['chrono']; g._recalc();
    out.time5chrono = Math.abs(g.bulletSlow - 0.38) < 1e-9; // 1 - min(0.62, 0.16*5=0.8→cap0.62)
    g.bonds = [];
    g.mods = { vitality: 5 }; g._recalc();
    out.vita5 = Math.abs(g.player.maxHp - Math.round(base.hp + 20 * 5)) <= 1;
    g.mods = { armor: 5 }; g._recalc();
    out.armor5 = Math.abs(g.player.armorPct - 0.40) < 1e-9;
    g.mods = { armor: 5 }; g.evo = { armor: true }; g._recalc();
    out.armorEvo = Math.abs(g.player.armorPct - 0.52) < 1e-9; // 0.40+0.12
    g.evo = {};
    g.mods = { leech: 5 }; g._recalc();
    out.leech5 = Math.abs(g.player.leechPer - 0.45 * 5) < 1e-9;
    g.mods = { wingman: 5 }; g._recalc();
    out.wing5 = g.wingmen.length === 5;
    g.mods = { wingman: 5 }; g.evo = { wingman: true }; g._recalc();
    out.wingEvo = g.wingmen.length === 7;
    g.evo = {}; g.mods = {};
    // 4) 进化质变抽样
    g._recalc();
    // 彗星引擎
    g.mods = { speed: 5 }; g.evo = { speed: true }; g._recalc();
    out.eComet = Math.abs(g.player.speed / base.speed - Math.pow(1.10, 5) * 1.25) < 1e-9;
    // 奇点磁场
    g.mods = { magnet: 5 }; g.evo = { magnet: true }; g._recalc();
    out.eSingularity = Math.abs(g.player.magnetR - (140 + 45 * 5) * 1.8) < 1e-9;
    // 万炮齐发:多一路(发射数验证)
    g.mods = { multi: 5 }; g.evo = { multi: true }; g._recalc();
    g.playerBullets = []; g.player.fireCd = 0; g.autoFire = true; g.keys.fire = true;
    g.player.weapon = 1; g.player._fire(g);
    out.eVolley = g.playerBullets.length === 1 + 2 * (5 + 1); // 中轴 1 + 万炮齐发 6 路 ×2 侧
    g.playerBullets = []; g.autoFire = false; g.keys.fire = false;
    // 双子侧翼 / 龙鳞尾炮(弹丸计数)
    g.mods = { side: 5, rear: 5 }; g.evo = { side: true, rear: true }; g._recalc();
    g.playerBullets = []; g.player._fire(g);
    out.eTwinDragontail = g.playerBullets.length === 1 + 2 * 7 + 2 * 10; // 主炮 1 + 侧翼 7 对 + 尾炮 5×2 对
    g.mods = {}; g.evo = {}; g._recalc();
    // 守护天使:两次不屈
    g.mods = { undying: 5 }; g.evo = { undying: true }; g._recalc();
    g.state = 'playing'; g.enemies = [];
    g.player.maxHp = 100; g.player.hp = 100; g.player.invuln = 0; g.player.shield = false; g.player.alive = true;
    g._playerHit(999);
    out.eGuardian1 = g.player.alive && g.player.hp === 10 && (g.player.undyingCount === 1); // 2%×5
    g.player.invuln = 0; g._playerHit(999);
    out.eGuardian2 = g.player.alive && g.player.undyingCount === 2;
    g.player.invuln = 0; g._playerHit(999);
    out.eGuardianDead = !g.player.alive;
    g.mods = {}; g.evo = {}; g._recalc();
    // 反击风暴满级半径
    g.mods = { thorn: 5 }; g._recalc();
    g.enemyBullets = [{ x: g.player.x + 255, y: g.player.y, dead: false }, { x: g.player.x + 155, y: g.player.y, dead: false }];
    g.player.alive = true;
    g._thornBlast();
    out.thorn5 = g.enemyBullets[0].dead === false && g.enemyBullets[1].dead === true; // R=160
    g.mods = {};
    // 5) 满级成就:maxed_3(选卡使第 3 张卡满级)
    g.start('normal');
    g.mods = { rate: 5, speed: 5, dmg: 4 };
    g._recalc();
    g.state = 'levelup';
    g._pendingSwap = null;
    g._cardChoices = [UPGRADE_MAP.dmg];
    g.chooseCard(0);
    out.maxed3 = g.mods.dmg === 5 && !!Ach.unlocked['maxed_3'];
    g.state = 'menu';
    return out;
  });

  await browser.close();
  server.close();

  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e2) => console.log('  ' + e2)); }
  console.log(JSON.stringify(r, null, 1));
  let bad = 0;
  for (const k of Object.keys(r)) {
    if (r[k] !== true) { console.error('FAIL: ' + k); bad++; }
  }
  checkCount(bad);
  function checkCount(b) { console.log(b ? ('\nFAILED: ' + b) : '\n5 级制与全员进化验证完成'); process.exitCode = b ? 1 : 0; }
})().catch((e) => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
