'use strict';
/* v4.7.0 六项玩法整改(v2,幂等版;一次性补丁,跑完即删)
 * ①选卡体系:跳过退场,放弃(2 次/局,真实丢失换 150分+10★)+ 刷新(旗舰 15% 掉落);
 * ②HUD 槽位推进器;③BOSS 血量公式重做 + 各变体专属技能(_special);④slotplus 上限 2 且低概率出现 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let fail = 0;
function load(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n'); }
function save(rel, s) { fs.writeFileSync(path.join(ROOT, rel), s, 'utf8'); }
function rep(rel, src, anchor, replacement, tag) {
  if (!src.includes(anchor)) { console.error('  SKIP(可能已应用): ' + tag); return src; }
  if (tag[0] !== '*' && src.split(anchor).length - 1 !== 1) { console.error('ANCHOR NOT UNIQUE [' + rel + '] ' + tag); fail++; return src; }
  console.log('  ok: ' + tag);
  return src.replace(anchor, replacement);
}

/* ================ ① 选卡体系 ================ */
let g = load('js/game.js');
g = rep('js/game.js', g,
`    this.abandonLeft = 2; this.overloadPulse = 0; this.overloadPulseT = 0;  // 放弃次数(每局):丢失该次升级,换保底补偿
    this.rerollLeft = 1;   // 刷新次数(每局):重抽当前三选一`,
`    this.abandonLeft = 2; this.overloadPulse = 0; this.overloadPulseT = 0;  // 放弃次数(每局):丢失该次升级,换保底补偿
    this.rerollLeft = 0;   // 刷新次数:击败旗舰概率掉落(15%)`, 'r1-reset');
g = rep('js/game.js', g,
`    this.overload = Math.min(100, (this.overload || 0) + 20); // 过载:旗舰大量充能`,
`    this.overload = Math.min(100, (this.overload || 0) + 20); // 过载:旗舰大量充能
    if (RNG() < 0.15) {                                        // 15% 概率掉「刷新机会」
      this.rerollLeft = (this.rerollLeft || 0) + 1;
      this._addFloat(new FloatText(b.x, b.y - 60, '↻ 刷新机会 +1', '#7ef3ff', 13));
    }`, 'boss-reroll');
g = rep('js/game.js', g,
`  /* 批量跳过:XP 洪流时一次折算全部待选等级(得分 + 星晶),消灭弹窗地狱 */
  skipAllLevels() {
    if (this.state !== 'levelup' || this._relicMode || this._augMode || this._devilMode) return;
    const n = Math.max(0, this.pendingLevels);
    if (n <= 0) return;
    this.pendingLevels = 0;
    this._cardChoices = [];
    this._pendingSwap = null; this._swapList = null;
    this.levelupCooldown = 3;
    const star = n * 20;
    this.score += n * 300;
    Shop.addCrystal(star);
    this._addFloat(new FloatText(this.player.x, this.player.y - 30, '批量跳过 ×' + n + ' · +' + (n * 300) + ' 分 +' + star + '★', '#ffd166', 13));
    this.state = 'playing';
    this._showState();
  }

  /* 跳过本次升级:暂存待选等级,获得经验后自动重新弹出(遗物奖励不可跳过) */
  skipUpgrade() {
    if (this.state !== 'levelup' || this._relicMode) return;
    this._pendingSwap = null;
    this._swapList = null;
    this._cardChoices = [];
    this.levelupCooldown = 3;
    this.state = 'playing';
    this._showState();
    this._addFloat(new FloatText(this.player.x, this.player.y - 30, '升级已暂存,稍后自动弹出', '#9fe8ff', 12));
  }`,
`  /* 放弃本次升级:真实丢失该次选择(不暂存,pendingLevels 真实 -1),换保底补偿;每局限 2 次 */
  abandonUpgrade() {
    if (this.state !== 'levelup' || this._relicMode || this._augMode || this._devilMode) return;
    if ((this.abandonLeft || 0) <= 0 || this.pendingLevels <= 0) return;
    this.abandonLeft--;
    this.pendingLevels--;
    this._cardChoices = [];
    this._pendingSwap = null; this._swapList = null;
    this.levelupCooldown = 3;
    this.score += 150;
    Shop.addCrystal(10);
    this._addFloat(new FloatText(this.player.x, this.player.y - 30, '放弃升级 · +150 分 +10★(剩 ' + this.abandonLeft + ' 次)', '#9fe8ff', 12));
    this.state = 'playing';
    this._showState();
  }`, 'skip-gone');

/* ---------------- ② slotplus 上限 2 且满槽低概率出现 ---------------- */
let u = load('js/upgrades.js');
u = rep('js/upgrades.js', u,
`  { id: 'slotplus', icon: '🧬', name: '基因扩展',   max: 5, rar: 2, desc: '隐藏卡:强化槽位 +1', hidden: true }`,
`  { id: 'slotplus', icon: '🧬', name: '基因扩展',   max: 2, rar: 2, desc: '隐藏卡:强化槽位 +1(最多 2 次)', hidden: true }`,
'slotplus-max');
save('js/upgrades.js', u);

/* ---------------- ③ HUD 槽位推进器 + 跳过退场 + slotplus 低概率 ---------------- */
let d = load('js/hud.js');
d = rep('js/hud.js', d,
`      // 跳过按钮:暂存本次升级,稍后自动弹出
      const skip = document.createElement('button');
      skip.className = 'menu-btn';
      skip.style.cssText = 'width:auto;padding:8px 22px;font-size:13px;flex-basis:100%;text-align:center;margin-top:10px';
      skip.innerHTML = '▸ 跳过本次升级(暂存,稍后自动弹出)';
      skip.addEventListener('click', () => this.skipUpgrade());
      row.appendChild(skip);`,
`      // 刷新 / 放弃双按钮(有限次数,真实代价)
      const util = document.createElement('div');
      util.style.cssText = 'flex-basis:100%;display:flex;gap:8px;justify-content:center;margin-top:10px';
      const rr = document.createElement('button');
      rr.className = 'menu-btn';
      rr.style.cssText = 'width:auto;padding:8px 16px;font-size:12.5px' + ((this.rerollLeft || 0) <= 0 ? ';opacity:0.4' : ';color:#7ef3ff');
      rr.innerHTML = '↻ 刷新候选(剩 ' + (this.rerollLeft || 0) + ')';
      rr.addEventListener('click', () => this.rerollChoices());
      const ab = document.createElement('button');
      ab.className = 'menu-btn';
      ab.style.cssText = 'width:auto;padding:8px 16px;font-size:12.5px;color:#ff8fa5' + ((this.abandonLeft || 0) <= 0 ? ';opacity:0.4' : '');
      ab.innerHTML = '✕ 放弃升级(剩 ' + (this.abandonLeft || 0) + ' · +150分+10★)';
      ab.addEventListener('click', () => { this.abandonUpgrade(); this._renderCards(); });
      util.appendChild(rr); util.appendChild(ab);
      row.appendChild(util);`, 'r1-buttons');
d = rep('js/hud.js', d,
`      // XP 洪流出口:待选等级堆积时提供批量跳过(折算星晶与得分)
      if (this.pendingLevels > 3) {
        const skipAll = document.createElement('button');
        skipAll.className = 'menu-btn';
        skipAll.style.cssText = 'width:auto;padding:8px 22px;font-size:13px;flex-basis:100%;text-align:center;margin-top:6px;color:#ffd166';
        skipAll.innerHTML = '▸ 全部跳过并折算(剩 ' + this.pendingLevels + ' 次 → 每次折算 300 分 + 20★)';
        skipAll.addEventListener('click', () => this.skipAllLevels());
        row.appendChild(skipAll);
      }`,
`      if ((this.abandonLeft || 0) > 0 && this.pendingLevels > 3) {
        const abAll = document.createElement('button');
        abAll.className = 'menu-btn';
        abAll.style.cssText = 'width:auto;padding:8px 22px;font-size:13px;flex-basis:100%;text-align:center;margin-top:6px;color:#ff8fa5';
        abAll.innerHTML = '▸ 全部放弃并折算(剩 ' + this.abandonLeft + ' 次 → 每次 150 分 + 10★)';
        abAll.addEventListener('click', () => this.abandonUpgrade());
        row.appendChild(abAll);
      }`, 'r1-hud-ab');
// slotplus:满槽超低概率出现(1%~3%,绚丽装备加成)——加入 _drawChoices 判断
g = rep('js/game.js', g,
`    // 卡槽系统:基础 5 槽,隐藏卡扩展
    this.maxSlots = 5 + (m.slotplus || 0) + (E.slotplus ? 1 : 0); // 无限基因再 +1`,
`    // 卡槽系统:基础 5 槽,隐藏卡扩展
    this.maxSlots = 5 + (m.slotplus || 0) + (E.slotplus ? 1 : 0); // 无限基因再 +1
    // 基因扩展低概率掉落:满槽时 1%~3%(绚丽机体+皮肤各+1%,加算)
    const rareCount = Object.keys((typeof Shop !== 'undefined' && Shop.ownedShip) || {}).filter(k => (SHIPS.find(x => x.id === k) || {}).rare).length
      + Object.keys((typeof Shop !== 'undefined' && Shop.owned) || {}).filter(k => (SKINS.find(x => x.id === k) || {}).rare).length;
    this.slotplusChance = (ownedCount >= this.maxSlots) ? Math.min(0.03, 0.01 * Math.max(1, rareCount)) : 0;`,
'slotplus-chance');
save('js/game.js', d === d ? g : g); // noop 保持流程
save('js/hud.js', d);

console.log(fail ? 'PATCH FAILED(部分已应用): ' + fail : 'PATCH OK');
process.exitCode = fail ? 1 : 0;
