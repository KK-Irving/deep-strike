'use strict';
/* 经济审计:星晶/芯片产出 vs 商城总价的量化对账(调价/加内容前先跑这个)。
 *  1) 商品目录:★ 可购(皮肤/机体/永久强化 6×10 级)逐项总价;密匣限定/成就锁定单独计数
 *  2) 每局收入:走真实 _gameover 结算公式(非复刻),覆盖 休闲/进阶/硬核/高难/大乱斗 画像
 *  3) 搬空时长:总价 ÷ 每局收入,按画像给出局数
 *  4) 密匣限定收集:调用真实 _boxDropBoosted/_grantPool 蒙特卡洛(300 次模拟),
 *     统计集齐全部绚丽皮肤+机体的 抽数/芯片/折算天数(芯片只来自每日+每周任务)
 * 断言只锁结构与数量级(防公式/价格意外劣化);精确平衡数字以 info 输出,供人工决策。 */
const H = require('./_harness');
const t = H.suite('经济审计');

(async () => {
  const server = await H.startServer();
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await H.launch();
  const page = await browser.newPage({ viewport: { width: 520, height: 820 } });
  const errors = H.watchErrors(page);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);

  const r = await page.evaluate(() => {
    const g = window.game;
    const out = {};

    /* ── 1) 商品目录与 ★ 总价 ── */
    const buySkins = SKINS.filter(s => !s.rare && !s.ach);
    const buyShips = SHIPS.filter(s => !s.rare && !s.ach);
    const skinsStar = buySkins.reduce((a, s) => a + s.price, 0);
    const shipsStar = buyShips.reduce((a, s) => a + s.price, 0);
    const boostsStar = BOOSTS.reduce((a, b) => a + b.prices.reduce((x, y) => x + y, 0), 0);
    out.catalog = {
      skins: buySkins.length, ships: buyShips.length, boostKinds: BOOSTS.length, boostLv: BOOSTS[0].prices.length,
      skinsStar, shipsStar, boostsStar, starTotal: skinsStar + shipsStar + boostsStar,
      locked: {
        rareSkins: SKINS.filter(s => s.rare).length,
        rareShips: SHIPS.filter(s => s.rare).length,
        achSkins: SKINS.filter(s => s.ach).length
      },
      pricesInt: buySkins.concat(buyShips).every(s => Number.isInteger(s.price) && s.price >= 0),
      boostStrict: BOOSTS.every(b => b.prices.length === 10 && b.prices.every((p, i) => p > 0 && (i === 0 || p > b.prices[i - 1])))
    };

    /* ── 2) 每局收入:真实 _gameover 公式(清空构筑/遗物/符文/诅咒等加成) ── */
    function income(mode, score, boss, elite, hard) {
      g.start(mode);
      g.mods = {}; g.evo = {}; g.augments = {}; g.relics = {}; g._mut = null;
      g.hard = !!hard;
      g.score = score; g.runBossKills = boss; g.runEliteKills = elite; g.wave = 10;
      g.state = 'playing'; g.player.alive = true;
      Shop.lastEarn = 0;
      g._gameover();
      return Shop.lastEarn;
    }
    const P = [
      { tag: '休闲   2万分', mode: 'normal', score: 20000, boss: 1, elite: 2, hard: false },
      { tag: '进阶   6万分', mode: 'normal', score: 60000, boss: 2, elite: 4, hard: false },
      { tag: '硬核  12万分', mode: 'normal', score: 120000, boss: 3, elite: 6, hard: false },
      { tag: '高难  12万分', mode: 'normal', score: 120000, boss: 3, elite: 6, hard: true },
      { tag: '大乱斗 12万分', mode: 'mayhem', score: 120000, boss: 3, elite: 6, hard: false }
    ];
    out.income = P.map(p => ({ tag: p.tag, hard: p.hard, mayhem: p.mode === 'mayhem', star: income(p.mode, p.score, p.boss, p.elite, p.hard) }));

    /* ── 3) 密匣限定收集时长:真实掉落函数蒙特卡洛 ── */
    function simDraws() {
      Shop.owned = {}; Shop.ownedShip = {};
      Shop.pityEpic = 0; Shop.pityRare = 0; Shop.crystal = 0;
      const rs = SKINS.filter(s => s.rare).map(s => s.id);
      const rp = SHIPS.filter(s => s.rare).map(s => s.id);
      const done = () => rs.every(id => Shop.owned[id]) && rp.every(id => Shop.ownedShip[id]);
      let draws = 0;
      while (!done() && draws < 50000) { Shop._boxDropBoosted(0); draws++; }
      return draws;
    }
    const N = 300;
    const arr = [];
    for (let i = 0; i < N; i++) arr.push(simDraws());
    arr.sort((a, b) => a - b);
    out.box = {
      sims: N, min: arr[0], median: arr[N >> 1], p90: arr[Math.floor(N * 0.9)],
      mean: Math.round(arr.reduce((a, b) => a + b, 0) / N), chipPerDraw: 15,
      chipsDaily: 12.5, chipsWeekly: 50 // 每日 10~15(中值 12.5)+ 每周 40~60(中值 50)
    };
    g.state = 'menu';
    return out;
  });

  await H.shutdown(browser, server);
  if (errors.length) for (const e of errors) t.fail('JS 异常: ' + e);
  else t.check(true, '无 JS 运行时异常');

  /* ── 结构与数量级护栏 ── */
  t.check(r.catalog.pricesInt, '全部可购商品价格均为非负整数');
  t.check(r.catalog.boostStrict, '永久强化 6 条 × 10 级且价格逐级严格递增');
  t.check(r.catalog.starTotal > 50000 && r.catalog.starTotal < 2000000,
    '★ 商城总价数量级合理: ' + r.catalog.starTotal + ' ★');

  const byTag = (s) => r.income.find(x => x.tag === s);
  const norm = byTag('硬核  12万分'), hard = byTag('高难  12万分'), mayhem = byTag('大乱斗 12万分');
  t.check(norm.star > 0 && hard.star > 0 && mayhem.star > 0, '各画像每局收入均为正');
  t.check(hard.star === Math.round(norm.star * 1.5), '高难模式星晶 ×1.5 生效(' + hard.star + ' = ' + norm.star + '×1.5)');
  t.check(mayhem.star === Math.round(norm.star * 1.5), '大乱斗星晶 ×1.5 生效(' + mayhem.star + ' = ' + norm.star + '×1.5)');

  const casual = byTag('休闲   2万分').star;
  const runs = Math.ceil(r.catalog.starTotal / casual);
  // 护栏只防数量级错误(公式坏了会变成几十局或几百万局);
  // 长线搬空时长本身是刻意设计(v1.8.0 涨价 + 产出下调),精确值看下方 info 输出
  t.check(runs > 50 && runs < 100000, '搬空商城局数在合理数量级(按 ' + casual + '★/局 ≈ ' + runs + ' 局)');

  const chipPerDay = r.box.chipsDaily + r.box.chipsWeekly / 7;
  const days = Math.round(r.box.median * r.box.chipPerDraw / chipPerDay);
  t.check(r.box.median > 0 && days <= 3650, '密匣限定收集时长在合理区间(中位 ' + r.box.median + ' 抽 ≈ ' + days + ' 天)');

  /* ── 审计数据输出(调价/加内容的决策依据)── */
  t.info('★ 可购目录: 皮肤×' + r.catalog.skins + '=' + r.catalog.skinsStar
    + ' + 机体×' + r.catalog.ships + '=' + r.catalog.shipsStar
    + ' + 强化×' + r.catalog.boostKinds + '条×10级=' + r.catalog.boostsStar
    + ' → 合计 ' + r.catalog.starTotal + ' ★');
  t.info('非★获取: 密匣限定皮肤×' + r.catalog.locked.rareSkins + ' · 密匣限定机体×' + r.catalog.locked.rareShips
    + ' · 成就解锁皮肤×' + r.catalog.locked.achSkins);
  for (const row of r.income) {
    t.info(row.tag + ' → ' + row.star + ' ★/局 · 搬空商城 ≈ ' + Math.ceil(r.catalog.starTotal / row.star) + ' 局');
  }
  t.info('密匣限定集齐(标准密匣 15◈/抽,300 次模拟): 中位 ' + r.box.median + ' 抽 · 平均 ' + r.box.mean
    + ' 抽 · p90 ' + r.box.p90 + ' 抽 · 最少 ' + r.box.min + ' 抽');
  t.info('按芯片产出(每日 10~15 + 每周 40~60 ≈ ' + chipPerDay.toFixed(1) + '◈/天):中位 ' + r.box.median
    + ' 抽 = ' + (r.box.median * r.box.chipPerDraw) + '◈ ≈ ' + days + ' 天 · p90 ≈ '
    + Math.round(r.box.p90 * r.box.chipPerDraw / chipPerDay) + ' 天');

  t.finish();
})().catch((e) => t.crash(e));
