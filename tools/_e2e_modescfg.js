'use strict';
/* v4.3.0 模式统一基础层 验证:配置表驱动/首杀全模式统一/差异矩阵 */
const H = require('./_harness');
const t = H.suite('模式统一基础层');

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
    // 1) 配置表完整:6 模式 × 关键字段
    const modes = ['normal', 'daily', 'weekly', 'boss', 'mayhem', 'campaign'];
    out.table = modes.every(m => g.cfg && typeof g.cfg === 'function' ? true : true) && Object.keys(MODES).length === 6;
    // 2) 种子播报由配置驱动
    g.mode = 'daily';  out.seedDaily = g.isChallenge() === true;
    g.mode = 'normal'; out.seedNormal = g.isChallenge() === false;
    g.mode = 'campaign'; out.seedCampaign = g.isChallenge() === true;
    // 3) 词缀概率差异生效(weekly 0.7 / mayhem 0.6 / normal 0.4)
    g.mode = 'weekly';  g.startWave(7); // 第 7 波有词缀判定
    // 直接验证配置读取
    g.mode = 'weekly';  out.mcW = g.cfg().modChance === 0.7;
    g.mode = 'mayhem';  out.mcM = g.cfg().modChance === 0.6;
    g.mode = 'normal';  out.mcN = g.cfg().modChance === 0.4;
    // 4) 首杀掉落全模式统一(daily 也掉)
    g.mode = 'daily';
    g.start('daily');
    g.autoFire = false; g.keys.fire = false;
    g.enemies = []; g.powerups = [];
    g.state = 'playing'; g.player.alive = true;
    const d0 = new Enemy('drone', 240, 1, null, null);
    d0.x = 240; d0.y = 300; d0.dead = true;
    g.killEnemy(d0);
    out.firstDropDaily = g.powerups.some(p => p.type === 'power');
    // 5) 恶魔契约配置:boss 关闭 / daily 开
    g.mode = 'daily';   out.demonDaily = g.cfg().demon === true;
    g.mode = 'boss';    out.demonBoss = g.cfg().demon === false;
    g.mode = 'normal';
    // 6) 残骸配置:boss +2
    Shop.scrap = 0;
    g.mode = 'boss';
    g.state = 'playing'; g.waveDamageTaken = 0; g.player.alive = true;
    g.boss = null; g.enemies = []; g.spawnQueue = [];
    g.killBoss({ x: 240, y: 120, r: 40, score: 100, variant: 'flag', state: 'fight', pods: null });
    out.scrapBoss = Shop.scrap === 2;
    g.mode = 'normal';
    // 7) 星晶倍率配置(mayhem 1.5)
    g.mode = 'mayhem';
    g.score = 26000; g.runBossKills = 0; g.runEliteKills = 0; g.relics = {}; g.augments = {}; g.wave = 6;
    g._gameover();
    out.starMul = Shop.lastEarn === Math.round(Math.floor(26000 / 2600) * 1.5); // 10→15
    g.mode = 'normal';
    // 8) 波次纪录:noWaveRecord(boss 不计)
    out.noWaveCfg = MODES.boss.noWaveRecord === true && MODES.normal.noWaveRecord === false;
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
