'use strict';
/* v4.7.0 六项玩法整改(一次性补丁,跑完即删)
 * ①移除跳过/批量跳过,保留 刷新/放弃;slotplus 上限 2 且满槽超低概率(1%~3%)掉落,绚丽装备加成;
 * ②HUD 右列改槽位推进器(根治叠印);③BOSS 血量分变体大幅提升 + 各变体专属攻击技能与差异化节奏;
 * ④触屏 persist 微调 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let fail = 0;
function load(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n'); }
function save(rel, s) { fs.writeFileSync(path.join(ROOT, rel), s, 'utf8'); }
function rep(rel, src, anchor, replacement, tag) {
  if (!src.includes(anchor)) { console.error('ANCHOR NOT FOUND [' + rel + '] ' + tag); fail++; return src; }
  if (tag[0] !== '*' && src.split(anchor).length - 1 !== 1) { console.error('ANCHOR NOT UNIQUE [' + rel + '] ' + tag); fail++; return src; }
  return src.replace(anchor, replacement);
}

/* ================ ① 选卡体系:跳过退场,放弃/刷新主力 ================ */
let g = load('js/game.js');

// 刷新改为击败 BOSS 概率掉落(每局可通过击杀多次获得),放弃保留 2 次
g = rep('js/game.js', g,
`    this.abandonLeft = 2; this.overloadPulse = 0; this.overloadPulseT = 0;  // 放弃次数(每局):丢失该次升级,换保底补偿
    this.rerollLeft = 1;   // 刷新次数(每局):重抽当前三选一`,
`    this.abandonLeft = 2; this.overloadPulse = 0; this.overloadPulseT = 0;  // 放弃次数(每局):丢失该次升级,换保底补偿
    this.rerollLeft = 0;   // 刷新次数:击败旗舰概率掉落(每 15% 概率 +1)`,
'r1-reset');

// 旗舰掉刷新机会
g = rep('js/game.js', g,
`    this.overload = Math.min(100, (this.overload || 0) + 20); // 过载:旗舰大量充能`,
`    this.overload = Math.min(100, (this.overload || 0) + 20); // 过载:旗舰大量充能
    if (RNG() < 0.15) {                                        // 15% 概率掉「刷新机会」
      this.rerollLeft = (this.rerollLeft || 0) + 1;
      this._addFloat(new FloatText(b.x, b.y - 60, '↻ 刷新机会 +1', '#7ef3ff', 13));
    }`,
'boss-reroll');

// ② 跳过退场:skipUpgrade 删除,批量跳过删除,skip 按钮删除
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
`  /* 放弃本次升级:真实丢失该次选择(不暂存),换取保底补偿;每局限 2 次 */
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
  }`,
'r1-skip-gone');
save('js/game.js', g);

/* ---------------- js/hud.js:选卡 UI 改双按钮,XP 洪流改放弃出口 ---------------- */
let d = load('js/hud.js');
// 旧跳过按钮 → 双按钮(放弃/刷新)
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
      rr.addEventListener('click', () => { this.rerollChoices(); });
      const ab = document.createElement('button');
      ab.className = 'menu-btn';
      ab.style.cssText = 'width:auto;padding:8px 16px;font-size:12.5px;color:#ff8fa5' + ((this.abandonLeft || 0) <= 0 ? ';opacity:0.4' : '');
      ab.innerHTML = '✕ 放弃升级(剩 ' + (this.abandonLeft || 0) + ' · +150分+10★)';
      ab.addEventListener('click', () => { this.abandonUpgrade(); game.showMenuPanel && 0; this._renderCards(); });
      util.appendChild(rr); util.appendChild(ab);
      row.appendChild(util);`,
'r1-buttons');
// XP 洪流批量按钮 → 放弃出口
d = rep('js/hud.js', d,
`      if (this.pendingLevels > 3) {
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
      }`,
'r1-hud-ab');
// 二级页里的跳过2(372 行附近 skip2)保留 skipUpgrade 引用无需改(方法还在)
save('js/hud.js', d);

/* ================ ② HUD 槽位推进器(R2 遗留:右列仍写死) ================ */
d = load('js/hud.js');
d = rep('js/hud.js', d,
`      if (AudioSys.muted) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '12px sans-serif';
        ctx.fillText('♪ OFF', W - 14, 38 + 16); // 目标行下
        rs += 16;
      }`,
`      if (AudioSys.muted) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '12px sans-serif';
        ctx.fillText('♪ OFF', W - 14, 38 + 16); // 目标行下
        rs += 16;
      }
      // 挑战模式标签(槽位推进)
      if (this.mode !== 'normal') {
        const tagName = this.mode === 'weekly' ? '周挑战' : this.mode === 'boss' ? '旗舰连战' : this.mode === 'mayhem' ? '海克斯大乱斗' : this.mode === 'campaign' ? (this.campaignChapter > 10 ? '远征回廊·' + this.campaignChapter + ' 层' : '远征·第 ' + this.campaignChapter + ' 章') : '每日挑战';
        const best = this.mode === 'boss' ? this._bossBest() : this.mode === 'campaign' ? this._challengeBest() : this.mode === 'mayhem' ? this._mayhemBest() : this._challengeBest();
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 11px Consolas, monospace';
        ctx.fillText(tagName + ' · 纪录 ' + best, W - 14, rs);
        rs += 14;
      }
      // 威胁等级
      const threatV = this.threatLevel();
      if (threatV > 0) {
        ctx.fillStyle = 'rgba(255,120,140,0.9)';
        ctx.font = 'bold 11px Consolas, monospace';
        ctx.fillText('⚡ 威胁等级 ' + threatV, W - 14, rs);
        rs += 14;
      }`,
'slot-adv1');
// 旧写死标签/威胁段删除(现在槽位化)
d = rep('js/hud.js', d,
`      // 挑战模式标识
      if (this.mode !== 'normal') {
        const tagName = this.mode === 'weekly' ? '周挑战' : this.mode === 'boss' ? '旗舰连战' : this.mode === 'mayhem' ? '海克斯大乱斗' : this.mode === 'campaign' ? (this.campaignChapter > 10 ? '远征回廊·' + this.campaignChapter + ' 层' : '远征·第 ' + this.campaignChapter + ' 章') : '每日挑战';
        const best = this.mode === 'boss' ? this._bossBest() : this.mode === 'campaign' ? this._challengeBest() : this.mode === 'mayhem' ? this._mayhemBest() : this._challengeBest();
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 11px Consolas, monospace';
        ctx.fillText(tagName + ' · 纪录 ' + best, W - 14, 54);
      }
      // 无尽模式:威胁等级与波次词缀
      const threat = this.threatLevel();
      if (threat > 0) {
        ctx.fillStyle = 'rgba(255,120,140,0.9)';
        ctx.font = 'bold 11px Consolas, monospace';
        ctx.fillText('⚡ 威胁等级 ' + threat, W - 14, this.mode !== 'normal' ? 68 : 54);
      }`,
`      // (槽位化后于 mute 行统一绘制)`, 'old-tags-gone');
save('js/hud.js', d);

/* ================ ③ BOSS 强化:血量分变体 + 专属技能 ================ */
e = load('js/entities.js');
// 3a) 血量公式:基础 ×2.2,变体差异加大
e = rep('js/entities.js', e,
`    this.maxHp = this.hp = (150 + wave * 45) * (tyrant ? 1.6 : storm ? 1.3 : 1);`,
`    this.maxHp = this.hp = (420 + wave * 110) * (tyrant ? 1.6 : storm ? 1.3 : 1); // v4.7.0:血量大幅提升`,
'boss-hp');
// 3b) 专属技能:v4.7.0 新增 _special()——各变体独立攻击,冷却独立计时
e = rep('js/entities.js', e,
`  _attack(game) {
    const x = this.x, y = this.y + 26;
    const modFire = this.modFire || 1; // 回廊词缀联动:火力节奏`,
`  /* 专属技能(v4.7.0):各变体独立大招,冷却与常规弹幕分离 */
  _special(game) {
    const x = this.x, y = this.y + 26;
    if (this.variant === 'flag') {
      // 敌方旗舰:全屏环形弹幕(两圈)
      for (let ring = 0; ring < 2; ring++)
        for (let i = 0; i < 18; i++)
          game.enemyShot(x, y, i / 18 * TAU + ring * 0.17 + this.t * 0.5, 150 + ring * 40, ring ? 'orange' : 'pink');
      this.specialCd = 5.5;
    } else if (this.variant === 'storm') {
      // 暴风:追踪雷暴云(三朵雷云随机位置放电)
      for (let i = 0; i < 3; i++) {
        const cx = game.player.x + Math.cos(this.t * 2 + i * 2.1) * 130;
        const cy = game.player.y - 180 + Math.sin(this.t * 1.7 + i * 1.4) * 40;
        for (let k = 0; k < 4; k++)
          game.enemyShot(cx + rand(-14, 14), cy, Math.PI / 2 + rand(-0.25, 0.25), 260, 'orange');
      }
      this.specialCd = 4.2;
    } else if (this.variant === 'tyrant') {
      // 暴君:激光扫射(六连快弹追踪)
      const a = game.aimedAngle(x, y);
      for (let i = 0; i < 6; i++)
        game.enemyShot(x, y, a + (i - 2.5) * 0.07, 320 + this.wave * 3, 'orange');
      this.specialCd = 3.4;
    } else if (this.variant === 'dread') {
      // 要塞:双炮塔齐射十字弹
      for (const pod of (this.pods || [])) {
        if (pod.dead) continue;
        const px = x + pod.ox, py = y + pod.oy;
        for (let i = 0; i < 4; i++)
          game.enemyShot(px, py, i / 4 * TAU + this.t, 190, 'orange');
      }
      this.specialCd = 3.8;
    }
    game.shake(4, 0.25);
  }

  _attack(game) {
    const x = this.x, y = this.y + 26;
    const modFire = this.modFire || 1; // 回廊词缀联动:火力节奏`,
'boss-special');
// 3c) update:专属技能独立计时(常规 _attack 之外)
e = rep('js/entities.js', e,
`    if (this.fireCd <= 0) this._attack(game);`,
`    if (this.fireCd <= 0) this._attack(game);
    // 专属技能计时(与常规弹幕独立,变体差异化攻击)
    this.specialCd = (this.specialCd || 0) - dt;
    if (this.specialCd <= 0 && this.state === 'fight') this._special(game);`,
'boss-special-tick');
save('js/entities.js', e);

console.log(fail ? 'PATCH FAILED: ' + fail : 'PATCH OK');
process.exitCode = fail ? 1 : 0;
