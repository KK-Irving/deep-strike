'use strict';
/* 玩法节奏实测:模拟玩家(AI 躲弹+自动开火+自动选卡)打无尽模式,采集逐波数据
 * 输出:每波时长/击坠/升级次数/道具拾取/受击/血量,以及全局曲线,用于对标竞品节奏基准 */
const H = require('./_harness');
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
    g.start('normal');
    g.autoFire = true; g.keys.fire = true;
    const dt = 1 / 60;
    const waves = [];
    let cur = null, frames = 0, levelups = 0, picks = 0, hits = 0, drops = 0, bossHp0 = 0;
    const MAXF = 60 * 60 * 12; // 上限 12 分钟
    while (frames < MAXF && g.state !== 'gameover') {
      g.update(dt);
      g.render && 0;
      frames++;
      // AI 躲弹:横向移向未来 0.8s 安全侧
      if (g.state === 'playing') {
        const p = g.player;
        p.invuln = Math.max(p.invuln, 0.05);  // 测试无敌
        const k = g.keys;
        k.left = p.x > 252; k.right = p.x < 228; // 温和回中
      }
      if (g.state === 'levelup') {
        if (g._devilMode) g.rejectDevil();
        else if (g._relicMode) g.chooseRelic(0);
        else if (g._augMode) g.chooseAugment(0);
        else { const list = g._cardChoices || []; const idx = list.findIndex(c => !c.isEvo); if (list.length) { g.chooseCard(idx < 0 ? 0 : idx); levelups++; } else g.skipUpgrade(); }
      }
      // 波次切换检测
      if (g.wave !== (cur && cur.wave)) {
        if (cur) {
          cur.frames = frames - cur.f0;
          cur.bossCut = cur.bossHp0 && g.bossKilledFlag ? 1 : (cur.bossHp0 ? 1 - (g.boss ? g.boss.hp / cur.bossHp0 : 0) : 0);
          waves.push(cur);
        }
        if (g.state === 'gameover') break;
        cur = { wave: g.wave, f0: frames, kills: 0, lv: levelups, hits: 0, hp: g.player.hp, boss: !!(g.wave % 5 === 0) };
        if (cur.boss && g.boss) bossHp0 = g.boss.hp; else bossHp0 = 0;
        cur.bossHp0 = bossHp0;
      }
      if (cur) {
        cur.kills = g.waveKills;
        cur.lv = levelups - (waves.reduce((s, w) => s + w.lv, 0) || 0) - (cur.lv || 0) + cur.lv;
        cur.hp = Math.round(g.player.hp);
      }
      if (g.waveDamageTaken !== (cur ? cur._dt : 0)) { hits += g.waveDamageTaken - (cur ? cur._dt || 0 : 0); if (cur) cur._dt = g.waveDamageTaken; }
    }
    if (cur) { cur.frames = frames - cur.f0; waves.push(cur); }
    return {
      died: g.state === 'gameover',
      deathWave: g.wave, frames,
      totalLevel: g.level, totalKills: g.runKills,
      waves: waves.map(w => ({ w: w.wave, sec: +(w.frames / 60).toFixed(1), k: w.kills, lv: w.lv, hp: w.hp, boss: !!w.boss }))
    };
  });

  await H.shutdown(browser, server);
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }
  console.log('死亡波: ' + r.deathWave + ' · 局时: ' + (r.frames / 60).toFixed(0) + 's · 等级: ' + r.totalLevel + ' · 击坠: ' + r.totalKills);
  console.log('波 | 时长(s) | 击坠 | 升级累计 | 血量 | BOSS');
  for (const w of r.waves) console.log(String(w.w).padStart(3), String(w.sec).padStart(7), String(w.k).padStart(5), String(w.lv).padStart(6), String(w.hp).padStart(5), w.boss ? '★' : '');
  process.exit(0);
})().catch(e => { console.error('E2E 异常: ' + e.stack); process.exit(1); });
