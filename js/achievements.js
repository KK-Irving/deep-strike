'use strict';
/* ============================================================
 * 深空突袭 DEEP STRIKE — 成就系统
 * 解锁条件在各游戏事件处调用 Ach.unlock()
 * ============================================================ */

const ACHIEVEMENTS = [
  { id: 'first_kill', name: '初出茅庐',   desc: '完成首次击坠' },
  { id: 'run_kill60', name: '百战老兵',   desc: '单局击坠 60 架敌机' },
  { id: 'wave_5',     name: '破阵先锋',   desc: '单局抵达第 5 波' },
  { id: 'wave_10',    name: '深入敌后',   desc: '单局抵达第 10 波' },
  { id: 'wave_15',    name: '王牌飞行员', desc: '单局抵达第 15 波' },
  { id: 'boss_1',     name: '旗舰猎手',   desc: '累计击毁 1 艘旗舰' },
  { id: 'boss_5',     name: '旗舰克星',   desc: '累计击毁 5 艘旗舰' },
  { id: 'bond_3',     name: '羁绊大师',   desc: '单局觉醒 3 条羁绊' },
  { id: 'level_10',   name: '极速成长',   desc: '单局达到 10 级' },
  { id: 'combo_30',   name: '连击狂人',   desc: '单局达成 30 连击' },
  { id: 'elite_10',   name: '精英收割者', desc: '累计击坠 10 架精英机' },
  { id: 'max_weapon', name: '火力全开',   desc: '单局火力达到 5 级' },
  { id: 'wave_20',    name: '无尽征服者', desc: '单局抵达第 20 波', reward: 150, skin: 'abyss' },
  { id: 'combo_60',   name: '神射手',     desc: '单局达成 60 连击', reward: 150, skin: 'crimson' },
  { id: 'evo_3',      name: '进化大师',   desc: '单局完成 3 次进化', reward: 150, skin: 'evoProto' },
  { id: 'boss_10',    name: '旗舰天敌',   desc: '累计击毁 10 艘旗舰', reward: 150, skin: 'phantomX' }
];

const Ach = {
  unlocked: {},

  load() {
    try { this.unlocked = JSON.parse(localStorage.getItem('deepstrike.ach')) || {}; }
    catch (e) { this.unlocked = {}; }
  },
  save() {
    try { localStorage.setItem('deepstrike.ach', JSON.stringify(this.unlocked)); }
    catch (e) { /* 忽略 */ }
  },

  /* 解锁:已解锁则静默;发放星晶奖励与可能的专属皮肤;游戏内金色横幅播报 */
  unlock(id, game) {
    if (this.unlocked[id]) return;
    this.unlocked[id] = Date.now();
    this.save();
    const a = ACHIEVEMENTS.find(x => x.id === id);
    if (!a) return;
    const reward = Shop.grantAchReward(a);
    if (game) {
      const skinPart = a.skin ? ' · 解锁皮肤「' + (SKINS.find(x => x.id === a.skin) || {}).name + '」' : '';
      game.banner = { text: '🏆 成就解锁', sub: a.name + ' · +' + reward + '★' + skinPart, life: 3.0, max: 3.0, gold: true };
      AudioSys.bond();
    }
  },

  count() { return Object.keys(this.unlocked).length; }
};
Ach.load();
