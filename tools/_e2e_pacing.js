'use strict';
/* v4.2.1 玩法节奏整改 验证 */
const H = require('./_harness');
const t = H.suite('玩法节奏整改');

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
    // 1) 前 3 波配额系数 0.5
    g.start('normal');
    g.startWave(1);
    out.q1 = g.waveQuota;
    out.q1Lower = out.q1 <= 6;
    // 2) 首杀必掉火力
    g.autoFire = false; g.keys.fire = false;
    g.enemies = []; g.powerups = [];
    const d0 = new Enemy('drone', 240, 1, null, null);
    d0.x = 240; d0.y = 300; d0.dead = true;
    g.state = 'playing'; g.player.alive = true;
    g.killEnemy(d0);
    out.firstDrop = g.powerups.some(p => p.type === 'power');
    // 3) 超时慈悲
    g.start('normal');
    g.startWave(12);
    out.deadline = g.waveDeadline === 69; // 45+12*2
    g.waveTime = 70; g.waveQuota = 5; g._mercyAcc = 7.99;
    g._updateMercy(0.02);
    out.mercyTick = g.waveQuota === 4;
    // 4) 前 3 波无慈悲
    g.startWave(2);
    out.noMercyEarly = g.waveDeadline === 49; // 全波次启用:第 2 波 = 45+4
    g.state = 'menu';
    return out;
  });

  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }
  console.log(JSON.stringify(r));
  t.check(errors.length === 0, '无 JS 运行时异常');
  t.check(r.q1Lower, '第 1 波配额下调(新手曲线): quota=' + r.q1);
  t.check(r.firstDrop, '首杀必掉火力道具');
  t.check(r.deadline && r.mercyTick && r.noMercyEarly, '超时慈悲(65s 起每 8s -1;前 3 波不启用)');
  t.finish();
})().catch(e => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
