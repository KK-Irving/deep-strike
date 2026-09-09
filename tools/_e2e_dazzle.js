'use strict';
/* 绚丽机体/皮肤动效验证:
 *  1) 装备普通皮肤时 Shop.activeFx() 为 null,Player.draw 不产生动效绘制;
 *  2) 装备 tier3 绚丽皮肤(prism/celestial/singularity/phoenix)与绚丽机体(seraph)时,
 *     activeFx() 非空,且连续两帧 Player.draw 的绘制指令数明显更多(存在逐帧动画);
 *  3) 新增绚丽皮肤/机体存在于开箱掉落池(epic/mythic pool 非空且含新条目)。 */
const H = require('./_harness');
const t = H.suite('绚丽动效');

(async () => {
  const server = await H.startServer();
  const port = server.address().port;
  const base = 'http://127.0.0.1:' + port + '/';
  const browser = await H.launch();
  const page = await browser.newPage({ viewport: { width: 520, height: 820 } });
  const errors = [];
  H.watchErrors(page, errors);
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
    // 绚丽机体(配普通皮肤 proto,动效来自机体):titanX/seraph/voidreaver/bloomlord
    out.ships = {};
    for (const sh of ['titanX', 'seraph', 'voidreaver', 'bloomlord']) {
      out.fx[sh] = fxAfterEquip('proto', sh);
      out.ops[sh] = countDrawOps('proto', sh, 1.0);
      out.ships[sh] = out.fx[sh] ? out.fx[sh].anim : null;
    }

    // 收集全部 8 个绚丽项的 anim,验证互不相同
    out.anims = {
      prism: out.fx.prism && out.fx.prism.anim,
      celestial: out.fx.celestial && out.fx.celestial.anim,
      singularity: out.fx.singularity && out.fx.singularity.anim,
      phoenix: out.fx.phoenix && out.fx.phoenix.anim,
      titanX: out.ships.titanX, seraph: out.ships.seraph,
      voidreaver: out.ships.voidreaver, bloomlord: out.ships.bloomlord
    };

    // 掉落池:epic(绚丽皮肤)/mythic(绚丽机体)候选包含新条目
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

  await H.shutdown(browser, server);
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
  console.log('八项绚丽动效 anims = ' + j(result.anims));
  console.log('新机体 drawOps titanX=' + result.ops.titanX + ' voidreaver=' + result.ops.voidreaver + ' bloomlord=' + result.ops.bloomlord);
  console.log('prism 动画帧差: t1=' + result.prismT1 + ' t2=' + result.prismT2);

  const check = t.check;
  check(errors.length === 0, '无 JS 运行时异常');
  check(result.fx.proto === null, '普通皮肤 activeFx 为 null(无动效)');
  check(result.fx.nebula === null, 'tier2 皮肤 activeFx 为 null(无逐帧动效)');
  check(result.fx.prism && result.fx.prism.anim === 'prism', 'prism 绚丽皮肤有 prism 动效');
  check(result.fx.seraph && result.fx.seraph.anim, '绚丽机体 seraph 有动效(即便配普通皮肤)');
  const dazzleMin = Math.min(result.ops.prism, result.ops.celestial, result.ops.singularity, result.ops.phoenix, result.ops.seraph);
  check(dazzleMin > result.ops.proto + 5, '绚丽机体逐帧绘制指令明显多于普通皮肤(有额外动画)');
  check(result.ops.nebula <= result.ops.proto + 4, 'tier2 皮肤不产生额外逐帧动画');
  check(result.epicSkins.includes('singularity') && result.epicSkins.includes('phoenix'), '新绚丽皮肤进入 epic 掉落池');
  check(result.mythicShips.includes('seraph'), '绚丽机体 seraph 进入 mythic 掉落池');
  check(result.prismT1 !== result.prismT2, 'prism 动画随时间变化(逐帧动效)');
  // 新增两个绚丽机体
  check(result.mythicShips.includes('voidreaver') && result.mythicShips.includes('bloomlord'), '新增绚丽机体 voidreaver/bloomlord 进入 mythic 掉落池');
  // titanX 现在也有专属动效(此前无 anim)
  check(result.ships.titanX && result.ops.titanX > result.ops.proto + 5, 'titanX 具备专属动效并逐帧绘制');
  // 四个绚丽机体都动画
  for (const sh of ['titanX', 'seraph', 'voidreaver', 'bloomlord']) {
    check(result.ships[sh] && result.ops[sh] > result.ops.proto + 5, sh + ' 绚丽机体有逐帧动效');
  }
  // 关键:八项绚丽动效互不相同(体现"每个都不一样")
  const animVals = Object.values(result.anims);
  const allSet = new Set(animVals);
  check(animVals.every(Boolean) && allSet.size === animVals.length, '八项绚丽动效各不相同(风格不重复)');
  t.finish();
})().catch((e) => t.crash(e));
