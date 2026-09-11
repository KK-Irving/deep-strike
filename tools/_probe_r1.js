'use strict';
/* 轮1 正确性:行为级边界探针(一次性) */
const H = require('./_harness');
const t = H.suite('轮1 边界探针');

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
    // A. 敌机负血/超界坐标
    g.start('normal');
    g.state = 'playing'; g.player.invuln = 999;
    const d0 = new Enemy('drone', 240, 1, null, null);
    d0.damage(-5, g);            // 负伤害
    out.negDmg = !Number.isNaN(d0.hp) && d0.hp > 0;
    d0.x = -9999; d0.y = 99999; d0.update(1, g);   // 超界更新不抛错
    out.extremePos = Number.isFinite(d0.x) || d0.dead;
    // B. Ach 迁移边界:坏 JSON / 空对象 / 非法等级
    localStorage.setItem('deepstrike.ach', '{bad json');
    Ach.load();
    out.badAch = typeof Ach.unlocked === 'object';
    localStorage.setItem('deepstrike.ach', JSON.stringify({ kills: 'xxx', bestwave: 99 }));
    Ach.load();
    out.clampLevel = Ach.levelOf('kills') === 0 && Ach.levelOf('bestwave') === 5; // 非法清零/越界钳 5
    // C. Shop 导入:空串/数组注入
    out.importEmpty = Shop.importSave('') .ok === false;
    out.importArray = Shop.importSave('WQ==').ok === false; // base64('[]') → 非对象
    // D. 纪元重置幂等:连重两次核心不叠加第二次
    localStorage.setItem('deepstrike.campaign', JSON.stringify({ 10: 3 }));
    localStorage.setItem('deepstrike.eras', JSON.stringify({ cores: 0, spent: {}, resets: 0 }));
    const r1 = Shop.epochReset();
    const r2 = Shop.epochReset();
    out.resetIdempotent = r1.ok && r2.ok && Shop.eraCores() === r1.cores; // 第二次无新增进度,核心不再增长
    // E. 回廊层号上限:9999 层不溢出
    g.start('campaign', 9999);
    g.startWave(5);
    const s = g.spawnQueue.find(x => x.boss);
    out.cap9999 = s && Number.isFinite(s.vw) && s.vw > 10000 && g.campaignChapter === 9999;
    // F. 大乱斗:自然波序 12 波恰 4 轮强化,且此后不再弹
    g.start('mayhem');
    let opened = 0;
    for (let n = 1; n <= 12; n++) {
      g.state = 'playing';
      g.startWave(n);
      if (g.state === 'levelup' && g._augMode) { opened++; g.chooseAugment(0); }
      let guard = 0;
      while (g.state === 'levelup' && !g._devilMode && guard++ < 30) {
        if (g._relicMode) g.chooseRelic(0);
        else if (g._cardChoices && g._cardChoices.length) { const list = g._cardChoices; let idx = list.findIndex(c => !c.isEvo); g.chooseCard(idx < 0 ? 0 : idx); }
        else g.skipUpgrade();
      }
    }
    out.poolExhaust = opened === 4;
    g.state = 'menu';
    return out;
  });

  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }
  console.log(JSON.stringify(r));
  t.check(errors.length === 0, '无 JS 运行时异常');
  for (const k of Object.keys(r)) t.check(r[k] === true, k);
  t.finish();
})().catch(e => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
