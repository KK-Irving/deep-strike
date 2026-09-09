'use strict';
/* 开箱动画验证:
 *  1) 触发开箱后,动画舞台(#boxAnim)先显示、结果列表为空、确定按钮隐藏;
 *  2) 蓄力阶段 crate 添加 charging 类;
 *  3) 动画结束后 crate 爆发、结果逐条 reveal 出现、确定按钮恢复可见;
 *  4) 点击跳过可立即揭晓;
 *  5) 全程无 JS 异常。
 * 用可控结果:直接调用 Shop.showBoxResults 传入构造结果,规避随机性。 */
const H = require('./_harness');
const t = H.suite('开箱动画');

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

  // 用一个含 epic 的结果集触发动画(最佳品级=epic)
  await page.evaluate(() => {
    window.game.showMenuPanel('shop');
    Shop.showBoxResults([
      { tier: 'junk', kind: 'crystal', amount: 80, name: '星晶 +80' },
      { tier: 'common', kind: 'skin', id: 'frost', name: '霜语' },
      { tier: 'epic', kind: 'skin', id: 'prism', name: '棱镜绚彩' }
    ], '星辉密匣');
  });

  // 动画刚开始:舞台可见、列表为空、确定按钮隐藏
  await page.waitForTimeout(200);
  const early = await page.evaluate(() => {
    const anim = document.getElementById('boxAnim');
    const list = document.getElementById('boxResultList');
    const crate = document.getElementById('boxCrate');
    const btn = document.getElementById('btnBoxClose');
    return {
      animShown: anim && anim.style.display !== 'none',
      listCount: list ? list.children.length : -1,
      crateCharging: crate ? crate.className.indexOf('charging') >= 0 : false,
      crateColor: crate ? crate.style.color : '',
      btnHidden: btn ? btn.style.visibility === 'hidden' : false
    };
  });

  // 等待动画走完(epic: chargeMs=520+3*180=1060,+560 揭晓,+行揭晓)
  await page.waitForTimeout(2200);
  const done = await page.evaluate(() => {
    const anim = document.getElementById('boxAnim');
    const list = document.getElementById('boxResultList');
    const btn = document.getElementById('btnBoxClose');
    const revealed = Array.prototype.slice.call(list ? list.children : []).filter(r => r.className.indexOf('reveal') >= 0);
    return {
      animHidden: anim ? anim.style.display === 'none' : false,
      listCount: list ? list.children.length : -1,
      revealedCount: revealed.length,
      hasEpicRow: !!(list && list.querySelector('.tier-epic')),
      btnVisible: btn ? btn.style.visibility !== 'hidden' : false
    };
  });

  // 关闭并重开,测试"跳过":触发后立刻点击舞台跳过
  await page.evaluate(() => {
    document.getElementById('btnBoxClose').click();
    Shop.showBoxResults([
      { tier: 'mythic', kind: 'ship', id: 'seraph', name: '炽天使' }
    ], '奢华密匣');
  });
  await page.waitForTimeout(150);
  await page.evaluate(() => { if (typeof Shop._boxSkip === 'function') Shop._boxSkip(); });
  await page.waitForTimeout(500);
  const skipped = await page.evaluate(() => {
    const anim = document.getElementById('boxAnim');
    const list = document.getElementById('boxResultList');
    return {
      animHidden: anim ? anim.style.display === 'none' : false,
      listCount: list ? list.children.length : -1,
      hasMythic: !!(list && list.querySelector('.tier-mythic'))
    };
  });

  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }

  console.log('early  = ' + JSON.stringify(early));
  console.log('done   = ' + JSON.stringify(done));
  console.log('skipped= ' + JSON.stringify(skipped));

  const check = t.check;
  check(errors.length === 0, '无 JS 运行时异常');
  check(early.animShown, '开箱初始:动画舞台显示');
  check(early.listCount === 0, '开箱初始:结果列表尚未填充');
  check(early.btnHidden, '开箱初始:确定按钮隐藏');
  check(early.crateColor && early.crateColor.length > 0, 'crate 着色为最佳品级色');
  check(done.animHidden, '动画结束:舞台隐藏');
  check(done.listCount === 3, '动画结束:三条结果全部生成');
  check(done.revealedCount === 3, '动画结束:三条结果均带 reveal 入场动画');
  check(done.hasEpicRow, '动画结束:含绚丽(epic)行');
  check(done.btnVisible, '动画结束:确定按钮恢复可见');
  check(skipped.animHidden && skipped.listCount === 1 && skipped.hasMythic, '跳过动画:立即揭晓传奇结果');
  t.finish();
})().catch((e) => t.crash(e));
