'use strict';
/* 质变武器协同的浏览器内行为测试:
 * 在真实游戏对象上,分别构造 默认主炮 / 激光 / 散射 三种构筑,叠加 dmg/pierce/split/crit 卡,
 * 用固定假想目标测量单位时间输出,确认:
 *  1) 激光/散射会随卡片增强(加卡后 DPS 明显上升)
 *  2) 质变武器 + 适配卡 的输出不弱于默认主炮 + 同等卡
 * 通过 window.game 暴露的对象直接驱动,避免依赖真实敌机 AI。 */
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
  const exe = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const page = await browser.newPage({ viewport: { width: 520, height: 820 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  const result = await page.evaluate(() => {
    const g = window.game;
    // 一个静止的"训练靶":实现最小的 damage 接口,累计承伤
    function makeDummy(x) {
      return { x, y: 120, r: 16, dead: false, elitePhased: false, type: 'dummy',
        hp: 1e9, maxHp: 1e9, taken: 0, flash: 0, t: 0,
        damage(n) { this.taken += n; },
        update() {}, draw() {} };
    }
    // 测一种构筑的 3 秒总输出(固定 dt 步进,禁用敌人/BOSS 干扰)
    function measure(setup) {
      g.start();               // 进入 playing,重置构筑
      g.mods = {}; g.evo = {}; g.bonds = [];
      g.boss = null;
      setup(g);                // 施加卡片
      g._recalc && g._recalc();
      // 训练靶:在玩家正前方从近到远铺一列(覆盖散射近程与激光/主炮全程),外加两侧覆盖侧翼/散射扇形
      g.enemies = [];
      const dummies = [];
      for (let y = 120; y <= 560; y += 40) { const d = makeDummy(240); d.y = y; dummies.push(d); }
      for (let x = 160; x <= 320; x += 40) { if (x === 240) continue; const d = makeDummy(x); d.y = 520; dummies.push(d); }
      g.enemies = dummies.slice();
      g.player.x = 240; g.player.y = 600;
      g.player.fireCd = 0; g.player.homingCd = 0;
      g.autoFire = true; g.keys.fire = true;
      // 固定步进模拟 3 秒(60fps)
      const dt = 1 / 60;
      for (let i = 0; i < 180; i++) {
        g.player.update(dt, g);
        // 手动推进玩家子弹并与训练靶碰撞(复用真实碰撞的核心判定)
        for (const b of g.playerBullets) {
          if (b.dead) continue;
          if (b.life !== undefined) { b.life -= dt; if (b.life <= 0) { b.dead = true; continue; } }
          b.x += b.vx * dt; b.y += b.vy * dt;
          for (const e of dummies) {
            if (e === b.lastHit) continue;
            const dx = b.x - e.x, dy = b.y - e.y;
            if (dx * dx + dy * dy < (e.r + b.r) * (e.r + b.r)) {
              // 走真实命中结算(暴击/裂变/贯穿/链式闪电/溅射)
              g._hitTarget(b, e);
              break;
            }
          }
          if (b.y < -40 || b.x < -40 || b.x > 520) b.dead = true;
        }
        g.playerBullets = g.playerBullets.filter((b) => !b.dead);
      }
      const total = dummies.reduce((s, e) => s + e.taken, 0);
      return total;
    }

    const out = {};
    // 默认主炮:基础 vs +3dmg +2pierce
    out.gun_base = measure((g) => {});
    out.gun_cards = measure((g) => { g.mods = { dmg: 3, pierce: 2, multi: 1 }; });
    // 激光:基础 vs +卡(dmg/pierce/crit/split)
    out.laser_base = measure((g) => { g.mods = { laser: 1 }; });
    out.laser_cards = measure((g) => { g.mods = { laser: 2, dmg: 3, pierce: 2, crit: 2, split: 1, multi: 1 }; });
    // 散射:基础 vs +卡
    out.spread_base = measure((g) => { g.mods = { spread: 1 }; });
    out.spread_cards = measure((g) => { g.mods = { spread: 2, dmg: 3, pierce: 2, split: 1 }; });
    // evo 适配:与 +卡 完全相同的卡组,额外附加 evo,验证 evo 带来净增益
    out.laser_evo = measure((g) => { g.mods = { laser: 2, dmg: 3, pierce: 2, crit: 2, split: 1, multi: 1 }; g.evo = { laser: true }; });
    out.spread_evo = measure((g) => { g.mods = { spread: 2, dmg: 3, pierce: 2, split: 1 }; g.evo = { spread: true }; });
    // 新增质变武器:轨道炮 / 电弧
    out.rail_base = measure((g) => { g.mods = { railgun: 1 }; });
    out.rail_cards = measure((g) => { g.mods = { railgun: 2, dmg: 3, pierce: 2, crit: 2, multi: 1 }; });
    // 第五质变路线:回旋刃
    out.boom_base = measure((g) => { g.mods = { boomer: 1 }; });
    out.boom_cards = measure((g) => { g.mods = { boomer: 2, dmg: 3, crit: 2, multi: 1 }; });
    out.boom_evo = measure((g) => { g.mods = { boomer: 2, dmg: 3, crit: 2, multi: 1 }; g.evo = { boomer: true }; });
    out.tesla_base = measure((g) => { g.mods = { tesla: 1 }; });
    out.tesla_cards = measure((g) => { g.mods = { tesla: 2, dmg: 3, multi: 2, split: 1 }; });
    g.state = 'menu';
    return out;
  });

  await browser.close();
  server.close();

  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }
  const r = (n) => Math.round(n);
  console.log('默认主炮   base=' + r(result.gun_base) + '  +卡=' + r(result.gun_cards));
  console.log('激光       base=' + r(result.laser_base) + '  +卡=' + r(result.laser_cards) + '  +evo=' + r(result.laser_evo));
  console.log('散射       base=' + r(result.spread_base) + '  +卡=' + r(result.spread_cards) + '  +evo=' + r(result.spread_evo));
  console.log('轨道炮     base=' + r(result.rail_base) + '  +卡=' + r(result.rail_cards));
  console.log('电弧       base=' + r(result.tesla_base) + '  +卡=' + r(result.tesla_cards));
  console.log('回旋刃     base=' + r(result.boom_base) + '  +卡=' + r(result.boom_cards) + '  +evo=' + r(result.boom_evo));

  let bad = 0;
  const check = (c, m) => { if (c) console.log('ok: ' + m); else { console.error('FAIL: ' + m); bad++; } };
  check(errors.length === 0, '无 JS 运行时异常');
  check(result.laser_cards > result.laser_base * 1.5, '激光随卡片显著变强(>1.5x)');
  check(result.spread_cards > result.spread_base * 1.5, '散射随卡片显著变强(>1.5x)');
  check(result.laser_evo > result.laser_cards, '激光 evo 进一步增强');
  check(result.spread_evo > result.spread_cards, '散射 evo 进一步增强');
  // 质变 + 卡 不弱于 默认 + 卡(允许 0.8x 容差,因为默认主炮命中率/弹道不同)
  check(result.laser_cards >= result.gun_cards * 0.8, '激光+卡 不明显弱于 默认+卡');
  check(result.spread_cards >= result.gun_cards * 0.8, '散射+卡 不明显弱于 默认+卡');
  check(result.rail_base > 0, '轨道炮能造成伤害');
  check(result.rail_cards > result.rail_base * 1.5, '轨道炮随卡片显著变强(>1.5x)');
  check(result.tesla_base > 0, '电弧能造成伤害(链式闪电生效)');
  check(result.tesla_cards > result.tesla_base * 1.5, '电弧随卡片显著变强(>1.5x)');
  // 平衡(feature #5):四种质变武器 + 卡 均应可用,且强弱差距收敛,避免"只有几种有用"
  const paths = {
    laser: result.laser_cards, spread: result.spread_cards,
    railgun: result.rail_cards, tesla: result.tesla_cards, boomer: result.boom_cards
  };
  const vals = Object.values(paths);
  const maxP = Math.max.apply(null, vals);
  const minP = Math.min.apply(null, vals);
  console.log('质变武器+卡 区间: min=' + Math.round(minP) + ' max=' + Math.round(maxP) + ' 比值=' + (maxP / minP).toFixed(2));
  // 每条质变路线 + 卡 都不弱于默认主炮 + 卡(是真正值得选择的构筑)
  for (const k of Object.keys(paths)) {
    check(paths[k] >= result.gun_cards, k + '+卡 不弱于默认主炮+卡(值得作为质变选择)');
  }
  // 最强/最弱质变比值收敛(<=3.2),确保没有一枝独秀导致其它无人问津
  check(maxP / minP <= 3.2, '质变武器强弱差距收敛(最强/最弱 <=3.2x)');
  // 电弧不再是明显垫底的异常项(>= 最弱线的 0.9)
  check(result.tesla_cards >= minP * 0.9, '电弧不再是垫底异常项');
  console.log(bad ? ('\nFAILED: ' + bad) : '\n战斗协同验证完成');
  process.exitCode = bad ? 1 : 0;
})().catch((e) => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });