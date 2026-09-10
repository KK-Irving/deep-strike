'use strict';
/* 挑战确定性(跨设备序列一致)行为测试:
 *  1) 尝试间一致:同一页面两次全新对局,波次构成(spawnQueue/配额/词缀)与三选一抽卡
 *     序列完全一致 —— 且第二次对局乱序铺波、并在每波之前额外消费 50 次随机数,
 *     证明构成只取决于 (种子, 波号/抽卡序号),与此前战斗过程消耗了多少随机数无关;
 *  2) 跨上下文一致:两个全新 context(等效另一台设备的新存档)快照逐一相同;
 *  3) 波内行为:同一 dt 步进序列下,敌机/敌弹/掉落状态完全可复现(离散事件模拟)。
 * 契约定义见 AGENTS.md「每日/周挑战确定性」;表现层种子流卫生由 _e2e_static 静态锁死。 */
const H = require('./_harness');
const t = H.suite('挑战确定性');

(async () => {
  const server = await H.startServer();
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await H.launch();

  const SEED = 0x51DE7E5D;

  /* 在一个全新 context 里跑完整快照:每日/周挑战的波次构成、两轮 12 连抽、固定步进行为 */
  async function snapshot() {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = H.watchErrors(page);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForTimeout(250);
    const r = await page.evaluate((seed) => {
      const g = window.game;
      const round = (v) => Math.round(v * 100) / 100;
      const grabWaves = (sink, shuffled, pollute) => {
        const order = shuffled ? [30, 17, 9, 3, 25, 6, 20, 1, 13, 8, 4, 5] : [1, 3, 4, 5, 6, 8, 9, 13, 17, 20, 25, 30];
        for (const n of order) {
          if (pollute) for (let i = 0; i < 50; i++) rand(0, 1000); // 故意消耗主流,模拟"此前战斗过程"
          g.startWave(n);
          sink[n] = {
            quota: g.waveQuota,
            mod: g.waveMod ? g.waveMod.id : null,
            queue: JSON.parse(JSON.stringify(g.spawnQueue))
          };
        }
      };
      const out = { daily: { a1: {}, a2: {} }, weekly: { a1: {} }, draws: [], draws2: [], sim: null };

      // ── 每日挑战:两次尝试(第二次乱序 + 污染主流)──
      g._challengeSeed = () => seed;      // 固定测试种子(替代日期种子)
      g.start('daily');
      grabWaves(out.daily.a1, false, false);
      grabWaves(out.daily.a2, true, true);

      // ── 周挑战:固定周号(全局变异按周种子派生)──
      g._weekKey = () => '2099-W01';
      g.start('weekly');
      grabWaves(out.weekly.a1, false, false);

      // ── 三选一:清空构筑,第 0 抽起连抽两轮(挑战模式按抽卡序号派生子流)──
      g._challengeSeed = () => seed;
      g.start('daily');
      g.startWave(5);
      g.mods = {}; g.evo = {}; g._drawCount = 0; g.maxSlots = 6; g.level = 20;
      g._recalc();
      for (let i = 0; i < 12; i++) out.draws.push(g._drawChoices().map((c) => c.id));
      for (let i = 0; i < 50; i++) rand(0, 1000); // 污染主流:抽卡子流不受影响
      g._drawCount = 0;
      for (let i = 0; i < 12; i++) out.draws2.push(g._drawChoices().map((c) => c.id));

      // ── 波内行为:同一 dt 步进序列必须完全可复现 ──
      g.start('daily');
      g.startWave(7);
      g.state = 'playing';
      g.autoFire = false; g.keys.fire = false;
      g.player.invuln = 9999; // 只关注 gameplay 状态复现,屏蔽死亡结算差异
      let maxEnemies = 0;
      for (let i = 0; i < 240; i++) {
        g.update(1 / 60);
        maxEnemies = Math.max(maxEnemies, g.enemies.length);
      }
      out.sim = {
        maxEnemies,
        enemies: g.enemies.map((e) => [e.type, round(e.x), round(e.y), Math.round(e.hp), e.elite ? e.elite.join('+') : '']),
        bullets: g.enemyBullets.map((b) => [round(b.x), round(b.y)])
          .sort((p, q) => (p[0] - q[0]) || (p[1] - q[1])),
        asteroids: g.asteroids.length,
        supplies: g.supplies.length,
        powerups: g.powerups.length
      };
      g.state = 'menu';
      return out;
    }, SEED);
    await ctx.close();
    return { r, errors };
  }

  /* 首个差异路径(失败时直接定位到 waves[7].queue[3].x 这一级) */
  function diffPath(a, b, path) {
    if (a === b) return null;
    if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return path;
    if (Array.isArray(a) !== Array.isArray(b)) return path;
    if (Array.isArray(a)) {
      if (a.length !== b.length) return path + '.length(' + a.length + '≠' + b.length + ')';
      for (let i = 0; i < a.length; i++) {
        const d = diffPath(a[i], b[i], path + '[' + i + ']');
        if (d) return d;
      }
      return null;
    }
    const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return path + '.keys';
    for (const k of ka) {
      const d = diffPath(a[k], b[k], path + '.' + k);
      if (d) return d;
    }
    return null;
  }
  const same = (a, b, label) => t.check(diffPath(a, b, '$') === null, label);

  const A = await snapshot();
  const B = await snapshot();
  await H.shutdown(browser, server);

  if (A.errors.length || B.errors.length) {
    for (const e of A.errors.concat(B.errors)) t.fail('JS 异常: ' + e);
  } else {
    t.check(true, '无 JS 运行时异常');
  }

  // ── 非平凡性:快照必须是真数据,防"两个空结构相等"的假绿 ──
  const waveList = [1, 3, 4, 5, 6, 8, 9, 13, 17, 20, 25, 30];
  t.check(waveList.every((n) => A.r.daily.a1[n] && A.r.daily.a1[n].queue.length > 0), '每日各波出怪队列非空');
  t.check(waveList.every((n) => A.r.weekly.a1[n] && A.r.weekly.a1[n].queue.length > 0), '周挑战各波出怪队列非空');
  t.check(A.r.draws.length === 12 && A.r.draws.every((d) => d.length === 3), '12 连抽各 3 张');
  t.check(new Set(A.r.draws.flat()).size >= 5, '抽卡结果有多样性(≥5 种卡)');
  t.check(A.r.sim.maxEnemies > 0 && A.r.sim.enemies.length > 0, '波内模拟有敌机生成且结束时仍在场上');

  // ── 1) 尝试间一致(乱序 + 污染主流,逐波仍一致)──
  for (const n of waveList) {
    const d = diffPath(A.r.daily.a1[n], A.r.daily.a2[n], 'daily.wave' + n);
    t.check(!d, '尝试间一致:第 ' + n + ' 波构成与"乱序+污染"重跑完全一致' + (d ? ' → ' + d : ''));
  }
  same(A.r.draws, A.r.draws2, '尝试间一致:污染主流后重抽的 12 连抽序列不变');

  // ── 2) 跨上下文一致(等效跨设备新存档)──
  same(A.r.daily.a1, B.r.daily.a1, '跨上下文一致:每日 12 波构成逐一相同');
  same(A.r.weekly.a1, B.r.weekly.a1, '跨上下文一致:周挑战(固定周号)构成逐一相同');
  same(A.r.draws, B.r.draws, '跨上下文一致:12 连抽卡序列相同');
  same(A.r.sim, B.r.sim, '跨上下文一致:同 dt 序列下波内行为完全复现');

  t.finish();
})().catch((e) => t.crash(e));
