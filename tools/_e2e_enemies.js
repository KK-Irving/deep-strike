'use strict';
/* 敌机强度/丰富度验证(feature #4):
 *  1) 敌方弹幕伤害 enemyDmg 随波次显著增长(w20 > w1),且封顶合理;
 *  2) 橙色狙击弹伤害更高;
 *  3) 出怪配额随波次增长(w14 明显多于 w3,均为非 BOSS 波);
 *  4) 新增「母舰 carrier」:血厚且 update 会周期释放无人机;
 *  5) 全程无 JS 异常。 */
const H = require('./_harness');
const t = H.suite('敌机强度');

(async () => {
  const server = await H.startServer();
  const port = server.address().port;
  const base = 'http://127.0.0.1:' + port + '/';
  const browser = await H.launch();
  const page = await browser.newPage({ viewport: { width: 520, height: 820 } });
  const errors = [];
  H.watchErrors(page, errors);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  const result = await page.evaluate(() => {
    const g = window.game;
    g.start();

    g.wave = 1; const dmgW1 = g.enemyDmg('pink'); const dmgW1o = g.enemyDmg('orange');
    g.wave = 20; const dmgW20 = g.enemyDmg('pink'); const dmgW20o = g.enemyDmg('orange');
    g.wave = 60; const dmgW60 = g.enemyDmg('pink');

    function countSpawns(wave) {
      g.enemies = []; g.spawnQueue = [];
      g.wave = wave;
      g.startWave(wave);
      return g.spawnQueue.length;
    }
    const spawnW3 = countSpawns(3);
    const spawnW14 = countSpawns(14);

    g.wave = 8; g.enemies = []; g.enemyBullets = []; g.rings = g.rings || [];
    const carrier = new Enemy('carrier', 240, 8, null, g._env || { hpMul: 1, spdMul: 1, fireMul: 1 });
    carrier.stopped = true; carrier.y = 120; carrier.spawnCd = 0.01;
    g.enemies = [carrier];
    const before = g.enemies.length;
    for (let i = 0; i < 30; i++) carrier.update(1 / 60, g);
    const after = g.enemies.length;
    const spawnedDrones = g.enemies.filter(e => e !== carrier && e.type === 'drone').length;
    const carrierHp = carrier.maxHp;

    g.state = 'menu';
    return { dmgW1, dmgW1o, dmgW20, dmgW20o, dmgW60, spawnW3, spawnW14, before, after, spawnedDrones, carrierHp };
  });

  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }

  console.log('弹幕伤害 w1=' + result.dmgW1 + ' w20=' + result.dmgW20 + ' w60=' + result.dmgW60
    + ' (橙 w1=' + result.dmgW1o + ' w20=' + result.dmgW20o + ')');
  console.log('出怪配额 w3=' + result.spawnW3 + ' w14=' + result.spawnW14);
  console.log('母舰释放:before=' + result.before + ' after=' + result.after + ' 无人机=' + result.spawnedDrones + ' 母舰血=' + result.carrierHp);

  const check = t.check;
  check(errors.length === 0, '无 JS 运行时异常');
  check(result.dmgW20 > result.dmgW1, '弹幕伤害随波次增长(w20>w1)');
  check(result.dmgW60 >= result.dmgW20, '弹幕伤害持续增长/封顶(w60>=w20)');
  check(result.dmgW60 <= 60, '弹幕伤害有合理上限(<=60)');
  check(result.dmgW20o > result.dmgW20, '橙色狙击弹伤害更高');
  check(result.spawnW14 > result.spawnW3, '出怪配额随波次增长(w14>w3)');
  check(result.carrierHp >= 16, '母舰血量厚(>=16)');
  check(result.spawnedDrones >= 2, '母舰周期释放无人机(>=2)');
  t.finish();
})().catch((e) => t.crash(e));
