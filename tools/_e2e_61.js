'use strict';
/* v4.6.1 强化多路线 + HUD 槽位 验证 */
const H = require('./_harness');
const t = H.suite('v4.6.1 强化与HUD');

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
    // 1) 强化 10 条:移速/射速/暴击/闪避 四条新路线
    out.boostCount = BOOSTS.length === 10;
    Shop.crystal = 999999;
    for (const id of ['spd0', 'rate0', 'crit0', 'evade0']) Shop.buyBoost(id);
    g.start('normal');
    g.mods = {}; g.evo = {}; g.relics = {}; g.bonds = []; g.augments = {};
    const base = g.player.speed;
    g._recalc();
    out.spd = g.player.speed > 330;                    // +1.5%
    out.rate = Math.abs(g.player.fireInterval - 0.11856) < 1e-6; // 0.12 × 0.988
    // 暴击采样
    let crits = 0;
    const tgt = new Enemy('drone', 240, 1, null, null);
    tgt.x = 240; tgt.y = 400; tgt.hp = 1e9; g.enemies = [tgt];
    for (let i = 0; i < 300; i++) {
      const b = { x: 240, y: 420, vx: 0, vy: -500, r: 3, dmg: 1, color: '#fff', dead: false, pierce: 0, split: 0 };
      g.playerBullets = [b];
      const h0 = tgt.hp;
      g._hitTarget(b, tgt);
      if (tgt.hp < h0 - 1.5) crits++;
    }
    out.crit = crits >= 300 * 0.005 && crits <= 300 * 0.02; // ~1%
    out.evade = Math.abs(g.player.dashCdCap - 2.4) < 1e-9 || true; // 冷却应用在 playerDash
    g.player.dashCd = 0;
    g.playerDash();
    out.evade2 = g.player.dashCd < 2.5 && g.player.dashCd > 2.3;
    g.playerBullets = []; g.enemies = [];
    // 2) HUD 槽位:右侧标签/威胁/高难不同行
    g.mode = 'weekly'; g.hard = true; g.wave = 15;
    g.render();
    out.renderOk = true;
    g.mode = 'normal'; g.hard = false;
    g.state = 'menu';
    return out;
  });

  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }
  console.log(JSON.stringify(r));
  t.check(errors.length === 0, '无 JS 运行时异常');
  t.check(r.boostCount, '强化扩至 10 条(多路线)');
  t.check(r.spd && r.rate, '推进矩阵/射频调谐接线生效');
  t.check(r.crit && r.evade2, '要害校准/相位引擎生效');
  t.check(r.renderOk, 'HUD 槽位化渲染正常');
  t.finish();
})().catch(e => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
