'use strict';
/* v2.0.0 深空远征(章节战役)验证(全确定性):
 *  1) 章节种子确定性:同章两次开局,出怪队列严格一致(跨加载)
 *  2) 变体映射与难度递增(章 k → 变体 [k-1]%4,vw = 12+3k)
 *  3) 三星结算:通关/击坠率/无伤;首通奖励;纪录独立存储
 *  4) 解锁链:上一章 ≥1 星解锁下一章
 *  5) 第 10 章首通赠专属涂装「远征·星辉」;远征元帅成就线 */
const H = require('./_harness');
const t = H.suite('深空远征');

(async () => {
  const server = await H.startServer();
  const port = server.address().port;
  const browser = await H.launch();
  const url = 'http://127.0.0.1:' + port + '/index.html';

  // 第一次加载:采集章 3 出怪队列快照
  const p1 = await browser.newPage();
  const errors = [];
  H.watchErrors(p1, errors);
  await p1.goto(url, { waitUntil: 'networkidle' });
  const snapA = await p1.evaluate(() => {
    const g = window.game;
    g.start('campaign', 3);
    g.startWave(1);
    return JSON.stringify({ queue: g.spawnQueue, env: g._env });
  });
  await p1.close();

  const page = await browser.newPage();
  H.watchErrors(page, errors);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const snapB = await page.evaluate(() => {
    const g = window.game;
    g.start('campaign', 3);
    g.startWave(1);
    return JSON.stringify({ queue: g.spawnQueue, env: g._env });
  });

  const r = await page.evaluate(() => {
    const g = window.game;
    const out = {};
    const mkBoss = (v) => ({ x: 240, y: 120, r: 40, score: 500, variant: v, state: 'fight', pods: null });
    localStorage.removeItem('deepstrike.campaign');
    // 2) 变体映射与难度
    const variantOf = (ch) => {
      g.start('campaign', ch);
      g.startWave(5);
      const s = g.spawnQueue.find(x => x.boss);
      return s ? s.variant + '@' + s.vw : 'none';
    };
    out.v1 = variantOf(1) === 'flag@15';
    out.v2 = variantOf(2) === 'storm@18';
    out.v3 = variantOf(3) === 'tyrant@21';
    out.v4 = variantOf(4) === 'dread@24';
    // 3) 三星结算:高击坠 + 无伤 = 3 星;首通奖励
    g.start('campaign', 1);
    g._campKills = 80; g._campQuota = 100; g._campClean = true;
    const crystal0 = Shop.crystal;
    g.state = 'playing'; g.wave = 5; g.waveDamageTaken = 0; g.player.alive = true;
    g.killBoss(mkBoss('flag'));
    const st = g._campaignLoad();
    out.threeStar = st[1] === 3 && g._campaignResult.stars === 3;
    out.firstReward = Shop.crystal >= crystal0 + 200 + 50; // 200 + 章×50
    out.overShown = g.state === 'gameover' && document.getElementById('overRunStats').textContent.indexOf('★★★') >= 0;
    // 纪录独立存储
    g.score = 12345; // 再走一次结算对齐纪录? killBoss 已触发 _gameover,score 已定;仅断言键存在
    out.recordKey = localStorage.getItem('deepstrike.campaignHi.campaign-1') !== null;
    // 4) 低击坠 + 有伤 = 1 星
    g.start('campaign', 2);
    g._campKills = 20; g._campQuota = 100; g._campClean = false;
    g.state = 'playing'; g.wave = 5; g.waveDamageTaken = 0; g.player.alive = true;
    g.killBoss(mkBoss('storm'));
    out.oneStar = (g._campaignLoad()[2] || 0) === 1;
    // 5) 解锁链
    out.unlockChain = g.campaignUnlocked(1) === true && g.campaignUnlocked(2) === true && g.campaignUnlocked(4) === false;
    localStorage.setItem('deepstrike.campaign', JSON.stringify({ 1: 1, 2: 3, 3: 1 }));
    out.unlockAfterStars = g.campaignUnlocked(4) === true;
    // 6) 第 10 章首通赠涂装 + 5 波限制(第 5 波即结算)
    localStorage.removeItem('deepstrike.campaign');
    g.start('campaign', 10);
    g._campKills = 100; g._campQuota = 100; g._campClean = true;
    g.state = 'playing'; g.wave = 5; g.waveDamageTaken = 0; g.player.alive = true;
    g.killBoss(mkBoss('dread'));
    out.voyager = !!Shop.owned.voyager;
    // 7) 成就线存在
    out.achLine = ACHIEVEMENTS.some(a => a.id === 'campaign' && a.tiers.length === 5);
    g.state = 'menu';
    return out;
  });
  await page.close();

  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }
  console.log('确定性: ' + (snapA === snapB));
  console.log(JSON.stringify(r));
  t.check(errors.length === 0, '无 JS 运行时异常');
  t.check(snapA === snapB, '章节种子确定性(同章双开出怪一致)');
  t.check(r.v1 && r.v2 && r.v3 && r.v4, '变体映射与难度递增(15/18/21/24)');
  t.check(r.threeStar, '三星结算(通关+无伤+击坠率≥65%)');
  t.check(r.firstReward, '首通奖励星晶(200+章×50)');
  t.check(r.overShown, '结算浮层显示星级');
  t.check(r.recordKey, '章节纪录独立存储(campaignHi.campaign-k)');
  t.check(r.oneStar, '低击坠+有伤 = 1 星');
  t.check(r.unlockChain && r.unlockAfterStars, '解锁链(上一章 ≥1 星)');
  t.check(r.voyager, '第 10 章首通赠「远征·星辉」');
  t.check(r.achLine, '远征元帅成就线(5 级)');
  t.finish();
})().catch((e) => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
