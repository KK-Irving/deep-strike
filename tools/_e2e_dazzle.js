'use strict';
/* 绚丽机体/皮肤动效验证:
 *  1) 装备普通皮肤时 Shop.activeFx() 为 null,Player.draw 不产生动效绘制;
 *  2) 装备 tier3 绚丽皮肤(prism/celestial/singularity/phoenix)与绚丽机体(seraph)时,
 *     activeFx() 非空,且连续两帧 Player.draw 的绘制指令数明显更多(存在逐帧动画);
 *  3) 新增绚丽皮肤/机体存在于开箱掉落池(epic/mythic pool 非空且含新条目)。 */
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
  await page.addInitScript(() => {
    localStorage.setItem('deepstrike.crystal', '999999');
    localStorage.setItem('deepstrike.chips', '9999');
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  const result = await page.evaluate(() => {
    const g = window.game;
    g.start();
    const p = g.player;

    // 计量一帧 Player.draw 产生的画布操作数(arc/fill/stroke/moveTo 等)
    function countDrawOps(skinId, shipId, engineT) {
      Shop.owned[skinId] = true; Shop.equipSkin(skinId);
      if (shipId) { Shop.ownedShip[shipId] = true; Shop.equipShip(shipId); }
      else { Shop.equipShip('vanguard'); }
      const ctx = g.ctx;
      let n = 0;
      const wrap = ['arc', 'fill', 'stroke', 'fillRect', 'moveTo', 'lineTo', 'quadraticCurveTo', 'beginPath'];
      const orig = {};
      for (const k of wrap) { orig[k] = ctx[k].bind(ctx); ctx[k] = function () { n++; return orig[k].apply(ctx, arguments); }; }
      p.engine = engineT; p.alive = true; p.invuln = 0;
      ctx.save(); p.draw(ctx); ctx.restore();
      for (const k of wrap) ctx[k] = orig[k];
      return n;
    }

    // 统一在装备好后立即读取 activeFx,再计量绘制,避免状态错位
    function fxAfterEquip(skinId, shipId) {
      Shop.owned[skinId] = true; Shop.equipSkin(skinId);
      if (shipId) { Shop.ownedShip[shipId] = true; Shop.equipShip(shipId); }
      else Shop.equipShip('vanguard');
      return Shop.activeFx();
    }
    const out = { fx: {}, ops: {} };
    out.fx.proto = fxAfterEquip('proto', null);
    out.ops.proto = countDrawOps('proto', null, 1.0);
    out.fx.nebula = fxAfterEquip('nebula', null);
    out.ops.nebula = countDrawOps('nebula', null, 1.0);
    for (const sk of ['prism', 'celestial', 'singularity', 'phoenix']) {
      out.fx[sk] = fxAfterEquip(sk, null);
      out.ops[sk] = countDrawOps(sk, null, 1.0);
    }
    out.fx.seraph = fxAfterEquip('proto', 'seraph');
    out.ops.seraph = countDrawOps('proto', 'seraph', 1.0);

    // 掉落池:epic(绚丽皮肤)/mythic(绚丽机体)候选包含新条目
    // 复用 _grantPool 的候选构造逻辑:直接读 SKINS/SHIPS
    const epicSkins = SKINS.filter(s => s.rare).map(s => s.id);
    const mythicShips = SHIPS.filter(s => s.rare).map(s => s.id);
    out.epicSkins = epicSkins;
    out.mythicShips = mythicShips;

    // 动画随时间变化:拦截 arc 的首个半径,两帧不同即证明动画
    function firstArcRadius(skinId, shipId, engineT) {
      Shop.owned[skinId] = true; Shop.equipSkin(skinId);
      Shop.equipShip(shipId || 'vanguard');
      const ctx = g.ctx; const radii = [];
      const oa = ctx.arc.bind(ctx);
      ctx.arc = function (x, y, r) { radii.push(Math.round(r * 1000) / 1000); return oa.apply(ctx, arguments); };
      p.engine = engineT; p.alive = true; p.invuln = 0;
      ctx.save(); p.draw(ctx); ctx.restore();
      ctx.arc = oa;
      // 汇总所有 arc 的半径与坐标签名,足以反映动画随时间变化
      return radii.join(',');
    }
    out.prismT1 = firstArcRadius('prism', null, 0.5);
    out.prismT2 = firstArcRadius('prism', null, 2.3);

    g.state = 'menu';
    return out;
  });

  await browser.close();
  server.close();
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }

  const j = (x) => JSON.stringify(x);
  console.log('activeFx.proto      = ' + j(result.fx.proto));
  console.log('activeFx.nebula(t2) = ' + j(result.fx.nebula));
  console.log('activeFx.prism      = ' + j(result.fx.prism));
  console.log('activeFx.seraph     = ' + j(result.fx.seraph));
  console.log('drawOps proto=' + result.ops.proto + ' nebula=' + result.ops.nebula
    + ' prism=' + result.ops.prism + ' celestial=' + result.ops.celestial
    + ' singularity=' + result.ops.singularity + ' phoenix=' + result.ops.phoenix
    + ' seraph=' + result.ops.seraph);
  console.log('绚丽皮肤池 epicSkins = ' + j(result.epicSkins));
  console.log('绚丽机体池 mythicShips = ' + j(result.mythicShips));
  console.log('prism 动画帧差: t1=' + result.prismT1 + ' t2=' + result.prismT2);

  let bad = 0;
  const check = (c, m) => { if (c) console.log('ok: ' + m); else { console.error('FAIL: ' + m); bad++; } };
  check(errors.length === 0, '无 JS 运行时异常');
  check(result.fx.proto === null, '普通皮肤 activeFx 为 null(无动效)');
  check(result.fx.nebula === null, 'tier2 皮肤 activeFx 为 null(无逐帧动效)');
  check(result.fx.prism && result.fx.prism.anim === 'prism', 'prism 绚丽皮肤有 prism 动效');
  check(result.fx.seraph && result.fx.seraph.anim, '绚丽机体 seraph 有动效(即便配普通皮肤)');
  const dazzleMin = Math.min(result.ops.prism, result.ops.celestial, result.ops.singularity, result.ops.phoenix, result.ops.seraph);
  check(dazzleMin > result.ops.proto + 5, '绚丽机体逐帧绘制指令明显多于普通皮肤(有额外动画)');
  check(result.ops.nebula <= result.ops.proto + 4, 'tier2 皮肤不产生额外逐帧动画');
  check(result.epicSkins.includes('singularity') && result.epicSkins.includes('phoenix'), '新绚丽皮肤进入 epic 掉落池');
  check(result.mythicShips.includes('seraph'), '新绚丽机体 seraph 进入 mythic 掉落池');
  check(result.prismT1 !== result.prismT2, 'prism 动画随时间变化(逐帧动效)');
  console.log(bad ? ('\nFAILED: ' + bad) : '\n绚丽动效验证完成');
  process.exitCode = bad ? 1 : 0;
})().catch((e) => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });