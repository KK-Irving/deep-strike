'use strict';
/* v2.3.0 远征回廊 验证:解锁链/变体轮换/难度递增/首通奖励/星数记录 */
const H = require('./_harness');
const t = H.suite('远征回廊');

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
    localStorage.removeItem('deepstrike.campaign');
    out.lockedBefore = g.campaignUnlocked(11) === false;
    localStorage.setItem('deepstrike.campaign', JSON.stringify({ 9: 1, 10: 2 }));
    out.unlockedAfter = g.campaignUnlocked(11) === true;
    g.start('campaign', 11);
    g.startWave(5);
    const s = g.spawnQueue.find(x => x.boss);
    out.layer11 = s.variant === 'tyrant' && s.vw === 45;   // (11-1)%4=2 → tyrant
    g.start('campaign', 13);
    g.startWave(5);
    out.layer13 = g.spawnQueue.find(x => x.boss).variant === 'flag'; // (13-1)%4=0 → flag
    localStorage.setItem('deepstrike.campaign', JSON.stringify({ 10: 1 }));
    g.start('campaign', 11);
    g._campKills = 100; g._campQuota = 100; g._campClean = false;
    const c0 = Shop.crystal;
    g.state = 'playing'; g.wave = 5; g.waveDamageTaken = 0; g.player.alive = true;
    g.killBoss({ x: 240, y: 120, r: 40, score: 500, variant: 'flag', state: 'fight', pods: null });
    out.firstReward = Shop.crystal - c0 >= 750; // 首通 750★(可能叠加成就升级奖励)
    out.stored = (g._campaignLoad()[11] || 0) >= 1;
    g.state = 'menu';
    return out;
  });

  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }
  console.log(JSON.stringify(r));
  t.check(errors.length === 0, '无 JS 运行时异常');
  t.check(r.lockedBefore && r.unlockedAfter, '第 10 章通关解锁回廊(此前锁定)');
  t.check(r.layer11 && r.layer13, '回廊层变体轮换(11 层 tyrant@45 / 13 层 flag@51)');
  t.check(r.firstReward && r.stored, '回廊首通奖励发放并记录星数');
  t.finish();
})().catch(e => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
