'use strict';
/* 经济再平衡验证:
 *  1) 星晶获取下调:相同战绩下,结算星晶按新公式(score/1600 + boss*6 + elite*1)计,明显低于旧公式(score/1000 + boss*10 + elite*2);
 *  2) 每日挑战芯片:同一日仅可领取一次,数额落在 10~15;二次结算发放 0;
 *  3) 每周挑战芯片:同一周仅可领取一次,数额落在 40~60;二次结算发放 0;
 *  4) 普通模式不产出芯片。
 * 直接驱动 window.game 的结算路径(_gameover),读取 Shop.lastEarn / lastChips。 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const fp = path.join(ROOT, p);
      if (!fp.startsWith(ROOT) || !fs.existsSync(fp)) { res.statusCode = 404; res.end('404'); return; }
      res.setHeader('Content-Type', MIME[path.extname(fp)] || 'application/octet-stream');
      fs.createReadStream(fp).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

(async () => {
  const server = await startServer();
  const port = server.address().port;
  const base = 'http://127.0.0.1:' + port + '/';
  const exe = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const page = await browser.newPage({ viewport: { width: 520, height: 820 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  const result = await page.evaluate(() => {
    const g = window.game;
    // 清理领取记录,保证测试从"未领取"开始
    try { localStorage.removeItem('deepstrike.dailyClaim'); localStorage.removeItem('deepstrike.weeklyClaim'); } catch (e) {}

    // 构造一局战绩并跑结算,返回本局星晶/芯片
    function settle(mode, score, wave, boss, elite) {
      g.mode = mode; g.score = score; g.wave = wave;
      g.runBossKills = boss; g.runEliteKills = elite;
      g.relics = {};                 // 排除贪婪圣杯翻倍干扰
      g.newRecord = false;
      g._gameover();
      return { earn: Shop.lastEarn, chips: Shop.lastChips, capped: Shop.lastChipsCapped };
    }

    const out = {};
    // 星晶:score 32000, boss 3, elite 10 → 新公式 = 20 + 18 + 10 = 48;旧公式 = 32 + 30 + 20 = 82
    const crys = settle('normal', 32000, 12, 3, 10);
    out.crystalNew = crys.earn;
    out.crystalOld = Math.floor(32000 / 1000) + 3 * 10 + 10 * 2;
    out.normalChips = crys.chips;

    // 每日:首次应发放且在 10~15;二次应为 0 且 capped
    const d1 = settle('daily', 45000, 14, 3, 8);
    const d2 = settle('daily', 90000, 20, 6, 16);
    out.daily1 = d1.chips; out.daily2 = d2.chips; out.daily2capped = d2.capped;

    // 每周:首次应发放且在 40~60;二次应为 0 且 capped
    const w1 = settle('weekly', 50000, 16, 4, 10);
    const w2 = settle('weekly', 120000, 24, 8, 20);
    out.weekly1 = w1.chips; out.weekly2 = w2.chips; out.weekly2capped = w2.capped;

    // 低战绩每日仍保底到区间下限
    try { localStorage.removeItem('deepstrike.dailyClaim'); } catch (e) {}
    const dLow = settle('daily', 1000, 2, 0, 0);
    out.dailyLow = dLow.chips;
    // 高战绩每周仍封顶到区间上限
    try { localStorage.removeItem('deepstrike.weeklyClaim'); } catch (e) {}
    const wHigh = settle('weekly', 999999, 40, 20, 60);
    out.weeklyHigh = wHigh.chips;

    g.state = 'menu';
    return out;
  });

  await browser.close();
  server.close();
  if (errors.length) { console.log('--- JS 异常 ---'); errors.forEach((e) => console.log('  ' + e)); }

  console.log('星晶 新公式=' + result.crystalNew + ' 旧公式=' + result.crystalOld + ' 普通模式芯片=' + result.normalChips);
  console.log('每日 首次=' + result.daily1 + ' 二次=' + result.daily2 + '(capped=' + result.daily2capped + ') 低战绩=' + result.dailyLow);
  console.log('每周 首次=' + result.weekly1 + ' 二次=' + result.weekly2 + '(capped=' + result.weekly2capped + ') 高战绩=' + result.weeklyHigh);

  let bad = 0;
  const check = (c, m) => { if (c) console.log('ok: ' + m); else { console.error('FAIL: ' + m); bad++; } };
  check(errors.length === 0, '无 JS 运行时异常');
  check(result.crystalNew < result.crystalOld, '星晶获取已下调(新 < 旧公式)');
  check(result.normalChips === 0, '普通模式不产出芯片');
  check(result.daily1 >= 10 && result.daily1 <= 15, '每日芯片首次落在 10~15');
  check(result.daily2 === 0 && result.daily2capped, '每日芯片二次为 0(当日已领取)');
  check(result.dailyLow >= 10 && result.dailyLow <= 15, '每日低战绩仍保底到 10~15 区间');
  check(result.weekly1 >= 40 && result.weekly1 <= 60, '每周芯片首次落在 40~60');
  check(result.weekly2 === 0 && result.weekly2capped, '每周芯片二次为 0(本周已领取)');
  check(result.weeklyHigh >= 40 && result.weeklyHigh <= 60, '每周高战绩封顶在 40~60 区间');
  console.log(bad ? ('\nFAILED: ' + bad) : '\n经济再平衡验证完成');
  process.exitCode = bad ? 1 : 0;
})().catch((e) => { console.error('E2E 异常: ' + e.stack); process.exitCode = 1; });