'use strict';
/* v1.9.8 恶魔契约(Phase 4.4)验证(全确定性,无统计循环):
 *  1) 判定方法:默认 35% 概率分布 + 可注入
 *  2) 触发路径:无伤 + 注入 → 升级链结算后恶魔现身;有伤/连战/概率关 → 不触发
 *  3) 契约:献祭 10% 生命上限(devilCost 经 _recalc 生效)、史诗过滤、强化生效
 *  4) 拒绝:保留生命上限;面板与键位渲染 */
const H = require('./_harness');
const t = H.suite('恶魔契约');

(async () => {
  const server = await H.startServer();
  const port = server.address().port;
  const browser = await H.launch();
  const url = 'http://127.0.0.1:' + port + '/index.html';
  const page = await browser.newPage();
  const errors = [];
  H.watchErrors(page, errors);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  const r = await page.evaluate(() => {
    const g = window.game;
    const out = {};
    const mkBoss = () => ({ x: 240, y: 120, r: 40, score: 500, variant: 'flag', state: 'fight', pods: null });
    const arm = (mode) => {
      g.start(mode || 'normal');
      g.spawnQueue = []; g.waveQuota = 999999; g.autoFire = false; g.keys.fire = false;
      g.enemies = []; g.enemyBullets = []; g.powerups = []; g.boss = null;
      g.player.devilCost = 0;
    };
    // 消化选卡链(有限步;链尾会同步弹出恶魔)
    const drain = () => {
      let n = 0;
      while (n++ < 60 && g.state === 'levelup' && !g._devilMode) {
        if (g._relicMode) g.chooseRelic(0);
        else {
          const list = g._cardChoices || [];
          const idx = list.findIndex(c => !c.isEvo);
          if (list.length) g.chooseCard(idx < 0 ? 0 : idx);
          else g.skipUpgrade();
        }
      }
      return n;
    };
    // 1) 判定:默认概率分布(1000 次方法直调)+ 注入
    let low = 0;
    for (let i = 0; i < 1000; i++) if (g._devilRollHit()) low++;
    out.p35 = low >= 280 && low <= 420;
    // 2) 触发路径(注入必中):无伤 → 升级链结算后现身
    g._devilRollHit = () => true;
    arm();
    g.state = 'playing'; g.waveDamageTaken = 0; g.player.alive = true;
    g.killBoss(mkBoss());
    out.pending = g._devilPending === true;
    const steps = drain();
    out.shown = g.state === 'levelup' && g._devilMode && g._devilChoices.length === 3;
    out.chainConsumed = g.pendingLevels <= 0;
    out.stepsSane = steps < 60;
    out.panelUi = document.getElementById('cardRow').innerHTML.indexOf('恶魔') >= 0
      && document.getElementById('lvTitle').textContent.indexOf('恶魔') >= 0
      && document.getElementById('ownRow').innerHTML.indexOf('生命上限') >= 0;
    // 3) 献祭与强化
    const hp0 = g.player.maxHp;
    const cost = Math.max(1, Math.round(hp0 * 0.1));
    const pick = g._devilChoices[0];
    const modsBefore = g.mods[pick.id] || 0;
    g.player.hp = hp0;
    g.chooseDevil(0);
    out.sacrifice = g.player.maxHp === hp0 - cost && g.player.hp === hp0 - cost;
    out.applied = (g.mods[pick.id] || 0) === modsBefore + 1;
    out.resumed = g.state === 'playing';
    // 4) 有伤不触发(注入必中也不行)
    arm();
    g._devilRollHit = () => true;
    g.state = 'playing'; g.waveDamageTaken = 3; g.player.alive = true;
    g.killBoss(mkBoss());
    drain();
    out.damagedSafe = !(g.state === 'levelup' && g._devilMode);
    // 5) 连战不触发
    arm('boss');
    g._devilRollHit = () => true;
    g.state = 'playing'; g.waveDamageTaken = 0; g.player.alive = true;
    g.killBoss(mkBoss());
    drain();
    out.bossModeSafe = !(g.state === 'levelup' && g._devilMode);
    g.mode = 'normal';
    // 6) 概率关:零触发
    arm();
    g._devilRollHit = () => false;
    g.state = 'playing'; g.waveDamageTaken = 0; g.player.alive = true;
    g.killBoss(mkBoss());
    drain();
    out.neverHit = !(g.state === 'levelup' && g._devilMode);
    // 7) 拒绝:保留生命上限
    g._devilRollHit = () => true;
    arm();
    g.state = 'playing'; g.waveDamageTaken = 0; g.player.alive = true;
    g.killBoss(mkBoss());
    drain();
    const hpKeep = g.player.maxHp;
    if (g.state === 'levelup' && g._devilMode) {
      g.rejectDevil();
      out.reject = g.state === 'playing' && g.player.maxHp === hpKeep;
    } else out.reject = false;
    g.state = 'menu';
    return out;
  });

  // 键位冒烟(独立页面)
  const p2 = await browser.newPage();
  H.watchErrors(p2, errors);
  await p2.goto(url, { waitUntil: 'networkidle' });
  const kb = await p2.evaluate(() => {
    const g = window.game;
    g.start('normal');
    g.spawnQueue = []; g.waveQuota = 999999; g.autoFire = false; g.keys.fire = false;
    g.enemies = []; g.boss = null;
    g._devilMode = true; g._devilChoices = [UPGRADE_MAP.split, UPGRADE_MAP.homing, UPGRADE_MAP.time];
    g.state = 'levelup'; g.player.maxHp = 100; g.player.hp = 100;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit4' }));
    const rejected = g.state === 'playing';
    g._devilMode = true; g._devilChoices = [UPGRADE_MAP.split, UPGRADE_MAP.homing, UPGRADE_MAP.time]; g.state = 'levelup';
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2' }));
    return { rejected, accepted: g.state === 'playing' && (g.mods.homing || 0) === 1 && g.player.maxHp === 90 };
  });
  await p2.close();

  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }
  console.log(JSON.stringify(r));
  console.log('键位: ' + JSON.stringify(kb));
  t.check(errors.length === 0, '无 JS 运行时异常');
  t.check(r.p35, '默认判定 35% 概率分布(1000 次 280~420)');
  t.check(r.pending && r.shown && r.chainConsumed, '无伤+注入:升级链结算后恶魔现身(三选一)');
  t.check(r.stepsSane, '选卡链有限步消化');
  t.check(r.panelUi, '契约面板渲染(卡片/标题/代价提示)');
  t.check(r.sacrifice && r.applied && r.resumed, '献祭 10% 生命上限并生效所选史诗卡');
  t.check(r.damagedSafe, '有伤击毁不触发');
  t.check(r.bossModeSafe, '连战模式不触发');
  t.check(r.neverHit, '概率关闭时零触发');
  t.check(r.reject, '拒绝保留生命上限');
  t.check(kb.rejected && kb.accepted, '键位:4 拒绝 / 数字选择');
  t.finish();
})().catch((e) => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
