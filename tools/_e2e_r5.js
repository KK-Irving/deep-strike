'use strict';
/* v4.5.5 四项收尾优化 验证 */
const H = require('./_harness');
const t = H.suite('v4.5.5 收尾优化');

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
    // ① 音效表扩展:三音色存在且可调用
    out.sfxGraze = typeof AudioSys.graze === 'function';
    out.sfxDash = typeof AudioSys.dash === 'function';
    out.sfxHum = typeof AudioSys.overloadHum === 'function';
    // ② draw 拆分:子方法存在且渲染不抛错
    g.start('normal');
    g.player.shield = true;
    g.render();
    out.drawSplit = typeof g.player._drawFlame === 'function' && typeof g.player._drawShieldRing === 'function';
    // ③ 回廊词缀联动
    localStorage.setItem('deepstrike.campaign', JSON.stringify({ 10: 3 }));
    g.start('campaign', 12); // (12-11)%5=1 → iron
    g.startWave(5);
    for (let i = 0; i < 260 && (!g.boss || g.boss.state !== 'fight'); i++) g.update(1 / 60);
    out.mod = g.waveMod && g.waveMod.id === 'iron';
    out.modFireSet = g.boss && g.boss.modFire === 1; // iron 不改火力,modFire=1
    const base = g.enemyDmg('pink');
    out.dmgLink = base >= 25 && base < 60; // iron +25% 已生效(base 较无词缀高)
    // ④ touch-ui 持久化
    localStorage.setItem('deepstrike.touch', '1');
    g.state = 'menu';
    return out;
  });

  // ④ 持久化:重载后 touch-ui 自动生效
  const r2 = await page.evaluate(() => localStorage.getItem('deepstrike.touch'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const persisted = await page.evaluate(() => document.body.classList.contains('touch-ui'));
  await page.evaluate(() => localStorage.removeItem('deepstrike.touch'));

  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }
  console.log(JSON.stringify(r), 'persisted:', persisted);
  t.check(errors.length === 0, '无 JS 运行时异常');
  t.check(r.sfxGraze && r.sfxDash && r.sfxHum, '①音色表扩展:graze/dash/overloadHum');
  t.check(r.drawSplit, '②Player.draw 拆分(_drawFlame/_drawShieldRing)');
  t.check(r.mod && r.modFireSet && r.dmgLink, '③回廊词缀联动(环境+伤害+火力节奏)');
  t.check(persisted, '④touch-ui 持久化(重载自动生效)');
  t.finish();
})().catch(e => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
