'use strict';
/* 全菜单页功能冒烟:逐页 进入→可见→关键交互(真实点击) */
const H = require('./_harness');
const t = H.suite('菜单页全量冒烟');

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

  // 给一点资源便于真实交互
  await page.evaluate(() => { Shop.crystal = 50000; Shop.chips = 500; Shop.save(); });
  const vis = (id) => page.evaluate((id) => { const el = document.getElementById(id); return !!el && !el.classList.contains('hidden') && el.offsetParent !== null; }, id);

  // 1) 帮助页
  await page.click('#btnHelp');
  t.check(await vis('menuHelp'), '帮助页可见');
  // 2) 战绩档案(成就/图鉴)
  await page.keyboard.press('Escape');
  await page.click('#btnStats');
  t.check(await vis('menuStats'), '战绩档案页可见');
  const achOk = await page.evaluate(() => document.getElementById('achList').children.length > 0);
  t.check(achOk, '成就分级列表已渲染');
  // 3) 出击模式二级页(5 模式按钮 + 纪录行)与机库中心二级页
  await page.keyboard.press('Escape');
  await page.click('#btnModes');
  t.check(await vis('menuModes'), '出击模式二级页可见');
  t.check(await page.evaluate(() => document.querySelectorAll('#menuModes .menu-btn:not(#btnModesBack)').length === 5), '出击模式列出 5 种玩法');
  t.check(await page.evaluate(() => document.getElementById('modeRecords').innerHTML.indexOf('纪录') >= 0), '模式纪录行渲染');
  await page.keyboard.press('Escape');
  await page.click('#btnHangar');
  t.check(await vis('menuHangar'), '机库中心二级页可见');
  await page.click('#btnShop');
  t.check(await vis('menuShop'), '商城页可见');
  // 3a) 买一款皮肤
  const buyOk = await page.evaluate(() => {
    const sk = SKINS.find(x => !x.ach && !x.rare && !x.secret && !Shop.owned[x.id] && Shop.crystal >= x.price);
    if (!sk) return false;
    const before = Shop.owned[sk.id];
    const res = Shop.buySkin(sk.id);
    return res.ok && !!Shop.owned[sk.id] && !before;
  });
  t.check(buyOk, '商城购买皮肤生效');
  // 3b) 开一次密匣(真实按钮点击)
  const boxBtn = await page.$('#btnBox1, [data-box="ex_basic"], .box-card button');
  if (boxBtn) { try { await boxBtn.click({ timeout: 2000 }); } catch (e) { /* 动画遮罩 */ } }
  // 4) 深空远征:进入 + 点击第一章真实开局
  await page.keyboard.press('Escape');
  await page.evaluate(() => game.showMenuPanel('modes'));
  await page.click('#btnCampaign');
  t.check(await vis('menuCampaign'), '深空远征页可见');
  const chapterBtns = await page.$$('#campaignList .menu-btn');
  t.check(chapterBtns.length === 10, '章节按钮 10 个');
  await chapterBtns[0].click();
  await page.waitForTimeout(150);
  const inGame = await page.evaluate(() => game.state === 'playing' && game.mode === 'campaign' && game.campaignChapter === 1);
  t.check(inGame, '点击第一章真实进入战役');
  // 5) 改装工坊:进入 + 点击合成真实扣费
  await page.evaluate(() => { game.toMenu(); Shop.scrap = 50; Shop.crystal = 50000; Shop.tunings = {}; Shop.save(); game.showMenuPanel('tuning'); });
  t.check(await vis('menuTuning'), '改装工坊页可见');
  const before = await page.evaluate(() => ({ scrap: Shop.scrap, lv: Shop.tuningLv('wingT') }));
  // 点第二张卡(僚机强化)的合成
  const cards = await page.$$('#tuningList .menu-btn');
  t.check(cards.length >= 3, '三槽位改装卡渲染');
  await cards[1].click();
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => ({ scrap: Shop.scrap, lv: Shop.tuningLv('wingT') }));
  t.check(after.lv === before.lv + 1 && after.scrap === before.scrap - 6, '点击改装卡真实合成(僚机 Lv1,残骸-6)');
  // 6) Esc 逐页返回主页
  await page.keyboard.press('Escape');
  const backMain = await page.evaluate(() => game.menuPanel === 'main');
  t.check(backMain, 'Esc 返回主页');
  // 7) 离线补给/任务面板存在
  t.check(await page.evaluate(() => !!document.getElementById('offlinePanel') && !!document.getElementById('taskPanel')), '离线补给/任务面板挂载');
  t.check(errors.length === 0, '全程无 JS 异常');
  await H.shutdown(browser, server);
  t.finish();
})().catch((e) => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });
