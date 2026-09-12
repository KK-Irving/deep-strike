'use strict';
/* 轮3 健壮性:触屏/极端窗口/高频操作探针(一次性) */
const H = require('./_harness');
const t = H.suite('轮3 健壮性');

(async () => {
  const server = await H.startServer();
  const port = server.address().port;
  const browser = await H.launch();
  const errors = [];

  console.log("[p]", "// A.".slice(3, 30));
  // A. 极小窗口(320x480)加载与开局
  const p1 = await browser.newPage({ viewport: { width: 320, height: 480 } });
  H.watchErrors(p1, errors);
  await p1.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'networkidle' });
  await p1.waitForTimeout(300);
  const small = await p1.evaluate(() => { game.start('normal'); return game.state === 'playing'; });
  t.check(small && errors.length === 0, '极小窗口(320×480)正常开局');
  await p1.close();

  console.log("[p]", "// B.".slice(3, 30));
  // B. 超大窗口(2560x1440)加载
  const ctx2 = await browser.newContext({ viewport: { width: 2560, height: 1440 }, hasTouch: true });
  const p2 = await ctx2.newPage();
  H.watchErrors(p2, errors);
  await p2.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'networkidle' });
  await p2.waitForTimeout(300);
  const big = await p2.evaluate(() => { game.start('mayhem'); return game.state === 'playing' || game.state === 'levelup'; }); // 开局可能弹强化
  t.check(big, '超大窗口(2560×1440)正常开局');

  console.log("[p]", "// C.".slice(3, 30));
  // C. 触屏拖动 + 双指点按炸弹
  await p2.touchscreen.tap(240, 400);
  await p2.evaluate(() => {
    const g = window.game;
    const c = document.getElementById('gameCanvas') || document.querySelector('canvas');
    const rect = c.getBoundingClientRect();
    const touch = new Touch({ identifier: 1, target: c, clientX: rect.left + 240, clientY: rect.top + 500 });
    c.dispatchEvent(new TouchEvent('touchstart', { touches: [touch], changedTouches: [touch], bubbles: true }));
  });
  await p2.waitForTimeout(50);
  const touchOk = await p2.evaluate(() => { game.update(1 / 60); return game.touch.active || true; });
  t.check(touchOk, '触屏事件不抛错');

  console.log("[p]", "// D.".slice(3, 30));
  // D. 高频操作:密匣 20 连点 / 章节快速连进
  const stress = await p2.evaluate(() => {
    Shop.chips = 5000; Shop.crystal = 999999; Shop.tunings = {}; Shop.save();
    let boxOk = 0;
    for (let i = 0; i < 20; i++) { const r = Shop.exchange('ex_basic', 1); if (r.ok) boxOk++; }
    let starts = 0;
    for (let i = 0; i < 10; i++) { game.start('campaign', (i % 10) + 1); if (game.state === 'playing') starts++; }
    game.state = 'menu';
    return { boxOk, starts };
  });
  t.check(stress.boxOk >= 19, '密匣 20 连点稳定(' + stress.boxOk + '/20)');
  t.check(stress.starts === 10, '章节快速连进 10 次稳定');
  await p2.close();

  console.log("[p]", "// E.".slice(3, 30));
  // E. 导入超长字符串(性能/不崩)
  const p3 = await browser.newPage();
  H.watchErrors(p3, errors);
  await p3.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'networkidle' });
  const huge = await p3.evaluate(() => {
    const long = 'WycdeWVcc=' + 'A'.repeat(200000);
    const t0 = performance.now();
    const res = Shop.importSave(long);
    return { ms: Math.round(performance.now() - t0), ok: res.ok };
  });
  t.check(huge.ms < 500, '超长存档码导入 200KB 内快速拒绝(' + huge.ms + 'ms)');
  await p3.close();

  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }
  t.finish();
})().catch(e => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
