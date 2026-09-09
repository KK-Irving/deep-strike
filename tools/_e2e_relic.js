'use strict';
/* v1.7.0 遗物系统 行为测试:
 *  1) 遗物池扩充至 16 件
 *  2) 掉落:非连战模式击败旗舰按 5%~10%(随波次)概率掉落未知圣遗物;情报网络首艘必掉;连战保留必得三选一
 *  3) 拾取:随机授予未拥有遗物 + 闪光动画(三环/粒子/横幅);已集齐转化 1000 分
 *  4) 新遗物效果:引力核心/战意旗帜/贤者之书/寒霜宝石/命运骰子/不死鸟羽 */
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
    // 1) 池规模
    out.pool16 = RELICS.length === 16;
    out.newIds = ['r_magnet', 'r_frenzy', 'r_phoenix', 'r_sage', 'r_frostgem', 'r_dice'].every(id => RELICS.some(x => x.id === id));
    // 2) 掉落:统计法验证概率路径(模块内 let RNG 无法从外部覆写)
    const mkBoss = () => ({ x: 240, y: 120, r: 40, score: 1000, variant: 'flag', state: 'fight', pods: null });
    const dropCount = (n, wave, force) => {
      g.start('normal');
      g.spawnQueue = []; g.waveQuota = 999999; g.autoFire = false; g.keys.fire = false; g.enemies = [];
      g.wave = wave;
      g._forceRelicDrop = !!force;
      let cnt = 0;
      for (let i = 0; i < n; i++) {
        g._forceRelicDrop = !!force; // 每轮重设:掉落即消费
        g.powerups = [];
        g.killBoss(mkBoss());
        if (g.powerups.some(p => p.type === 'relic')) cnt++;
      }
      return cnt;
    };
    const drops10 = dropCount(200, 30, false); // 波 30 → 概率 10% 封顶,期望 20
    out.dropHigh = drops10 >= 8 && drops10 <= 40;
    const dropsF = dropCount(50, 5, true);     // 情报网络:必掉
    out.forceDrop = dropsF === 50;
    // 连战:必得三选一(不掉落实物)
    g.mode = 'boss'; g.powerups = []; g.pendingRelic = false;
    g.killBoss(mkBoss());
    out.bossMode = g.pendingRelic === true && !g.powerups.some(p => p.type === 'relic');
    g.mode = 'normal';
    // 3) 拾取:随机授予未拥有 + 闪光表现;集满转 1000 分
    g.start('normal');
    g.powerups = []; g.rings = []; g.enemyBullets = [];
    g.relics = {};
    g._applyPower('relic');
    out.grantOne = Object.keys(g.relics).length === 1;
    out.fxRings = g.rings.length >= 3;
    for (const r0 of RELICS) if (!g.relics[r0.id]) g.relics[r0.id] = true;
    g.score = 0;
    g._applyPower('relic');
    out.allOwned = g.score === 1000;
    // 4) 新遗物效果
    const baseMagnet = g.player.magnetR, baseXp = g.xpMult;
    g.relics = { r_magnet: true }; g._recalc();
    out.magnet = Math.abs(g.player.magnetR - baseMagnet * 1.6) < 1e-9;
    g.relics = { r_sage: true }; g._recalc();
    out.sage = Math.abs(g.xpMult - baseXp * 1.25) < 1e-9;
    g.relics = { r_frenzy: true }; g._recalc();
    out.frenzy = Math.abs(g.comboWindow - 3) < 1e-9; // 无卡基线 2 + 遗物 1
    // 寒霜宝石:击坠触发脉冲(统计:25% × 60 次)
    g.relics = { r_frostgem: true }; g.buffs.frost = 0;
    let frostHits = 0;
    for (let i = 0; i < 60; i++) {
      g.buffs.frost = 0;
      const d0 = Object.assign(new Enemy('drone', 1, null, null, null), { x: 200, y: 300, dead: true, elite: null });
      g.killEnemy(d0);
      if (g.buffs.frost > 0) frostHits++;
    }
    out.frostgem = frostHits >= 6; // 期望 15,P(<6) < 1e-3
    // 命运骰子:击坠掉落道具(统计:10% × 60 次)
    g.relics = { r_dice: true }; g.powerups = [];
    for (let i = 0; i < 60; i++) {
      const d1 = Object.assign(new Enemy('drone', 1, null, null, null), { x: 220, y: 320, dead: true, elite: null });
      g.killEnemy(d1);
    }
    out.dice = g.powerups.length >= 1;
    g.relics = {};
    // 不死鸟羽:30% 生命重生,仅一次
    g.relics = { r_phoenix: true };
    g.state = 'playing'; g.enemies = [];
    g.player.maxHp = 100; g.player.hp = 100; g.player.invuln = 0; g.player.shield = false; g.player.alive = true;
    g._playerHit(999);
    out.phoenix1 = g.player.alive && g.player.hp === 30 && g._phoenixUsed === true;
    g.player.invuln = 0; g._playerHit(999);
    out.phoenix2 = !g.player.alive;
    g.relics = {}; g._recalc();
    // 5) 道具渲染与 HUD 图标通道
    g.powerups = [];
    g.powerups.push(new PowerUp(100, 100, 'relic'));
    out.cfgRelic = !!PowerUp.CFG.relic && !!SPRITES.power.relic;
    return out;
  });

  await browser.close();
  server.close();
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e2) => console.log('  ' + e2)); }
  console.log(JSON.stringify(r));
  let bad = 0;
  for (const k of Object.keys(r)) if (r[k] !== true) { console.error('FAIL: ' + k); bad++; }
  console.log(bad ? ('\nFAILED: ' + bad) : '\n圣遗物系统验证完成');
  process.exitCode = bad ? 1 : 0;
})().catch((e) => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
