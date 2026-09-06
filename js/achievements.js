'use strict';
/* ============================================================
 * 深空突袭 DEEP STRIKE — 成就系统
 * 8 大分类 40 项成就;奖励:星晶(普通50/进阶100/高难150~300)与专属皮肤
 * ============================================================ */

const ACHIEVEMENTS = [
  // ---- 战斗 ----
  { id: 'first_kill', cat: '战斗', name: '初出茅庐',   desc: '完成首次击坠', reward: 50 },
  { id: 'total_100',  cat: '战斗', name: '百人斩',     desc: '累计击坠 100 架敌机', reward: 50 },
  { id: 'total_500',  cat: '战斗', name: '杀戮机器',   desc: '累计击坠 500 架敌机', reward: 150 },
  { id: 'total_2000', cat: '战斗', name: '星际屠夫',   desc: '累计击坠 2000 架敌机', reward: 300 },
  { id: 'run_kill60', cat: '战斗', name: '百战老兵',   desc: '单局击坠 60 架敌机', reward: 100 },
  { id: 'run_kill120',cat: '战斗', name: '单局杀神',   desc: '单局击坠 120 架敌机', reward: 150 },
  { id: 'bomb_50',    cat: '战斗', name: '爆破艺术',   desc: '累计使用 50 枚炸弹', reward: 100 },
  // ---- 波次 ----
  { id: 'wave_5',     cat: '波次', name: '破阵先锋',   desc: '单局抵达第 5 波', reward: 50 },
  { id: 'wave_10',    cat: '波次', name: '深入敌后',   desc: '单局抵达第 10 波', reward: 100 },
  { id: 'wave_15',    cat: '波次', name: '王牌飞行员', desc: '单局抵达第 15 波', reward: 150 },
  { id: 'wave_20',    cat: '波次', name: '无尽征服者', desc: '单局抵达第 20 波', reward: 150, skin: 'abyss' },
  { id: 'wave_25',    cat: '波次', name: '深空行者',   desc: '单局抵达第 25 波', reward: 200 },
  { id: 'wave_30',    cat: '波次', name: '破晓者',     desc: '单局抵达第 30 波', reward: 300 },
  // ---- BOSS ----
  { id: 'boss_1',     cat: 'BOSS', name: '旗舰猎手',   desc: '累计击毁 1 艘旗舰', reward: 50 },
  { id: 'boss_5',     cat: 'BOSS', name: '旗舰克星',   desc: '累计击毁 5 艘旗舰', reward: 100 },
  { id: 'boss_10',    cat: 'BOSS', name: '旗舰天敌',   desc: '累计击毁 10 艘旗舰', reward: 150, skin: 'phantomX' },
  { id: 'boss_25',    cat: 'BOSS', name: '究极旗舰克星', desc: '累计击毁 25 艘旗舰', reward: 250 },
  { id: 'storm_kill', cat: 'BOSS', name: '驭风者',     desc: '击毁一艘暴风旗舰', reward: 150 },
  { id: 'tyrant_kill',cat: 'BOSS', name: '弑君者',     desc: '击毁一艘暴君旗舰', reward: 200 },
  // ---- 连击 ----
  { id: 'combo_15',   cat: '连击', name: '初窥门径',   desc: '达成 15 连击', reward: 50 },
  { id: 'combo_30',   cat: '连击', name: '连击高手',   desc: '达成 30 连击', reward: 100 },
  { id: 'combo_60',   cat: '连击', name: '神射手',     desc: '达成 60 连击', reward: 150, skin: 'crimson' },
  { id: 'combo_100',  cat: '连击', name: '连击传说',   desc: '达成 100 连击', reward: 250 },
  // ---- 构筑 ----
  { id: 'evo_3',      cat: '构筑', name: '进化大师',   desc: '单局完成 3 次进化', reward: 150, skin: 'evoProto' },
  { id: 'evo_5',      cat: '构筑', name: '进化学者',   desc: '单局完成 5 次进化', reward: 250 },
  { id: 'bond_3',     cat: '构筑', name: '羁绊大师',   desc: '单局觉醒 3 条羁绊', reward: 100 },
  { id: 'bond_5',     cat: '构筑', name: '羁绊网络',   desc: '单局觉醒 5 条羁绊', reward: 200 },
  { id: 'maxed_3',    cat: '构筑', name: '满级大师',   desc: '单局将 3 张卡片升至满级', reward: 200 },
  { id: 'max_weapon', cat: '构筑', name: '火力全开',   desc: '单局火力达到 5 级', reward: 50 },
  // ---- 精英 ----
  { id: 'elite_10',   cat: '精英', name: '精英收割者', desc: '累计击坠 10 架精英机', reward: 100 },
  { id: 'elite_50',   cat: '精英', name: '精英末日',   desc: '累计击坠 50 架精英机', reward: 250 },
  { id: 'dual_elite', cat: '精英', name: '双子星杀手', desc: '击坠双词缀精英机', reward: 150 },
  // ---- 挑战 ----
  { id: 'perfect_wave', cat: '挑战', name: '完美防御', desc: '无伤通过一个波次', reward: 150 },
  { id: 'perfect_3',    cat: '挑战', name: '铜墙铁壁', desc: '连续 3 个波次无伤通过', reward: 250 },
  { id: 'lowhp_10',     cat: '挑战', name: '向死而生', desc: '在生命 ≤10% 时击坠 10 架敌机', reward: 150 },
  { id: 'daily_5000',   cat: '挑战', name: '每日精英', desc: '每日挑战单局得分 ≥ 5000', reward: 150 },
  { id: 'level_10',     cat: '挑战', name: '极速成长', desc: '单局达到 10 级', reward: 50 },
  // ---- 收集 ----
  { id: 'rich_500',   cat: '收集', name: '小有积蓄',   desc: '星晶余额达到 500★', reward: 100 },
  { id: 'rich_1000',  cat: '收集', name: '星晶大亨',   desc: '星晶余额达到 1000★', reward: 200 },
  { id: 'skin_3',     cat: '收集', name: '藏机阁',     desc: '拥有 3 款战机皮肤', reward: 150 },
  { id: 'skin_all',   cat: '收集', name: '全皮肤收藏家', desc: '集齐全部 9 款战机皮肤', reward: 400 }
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

  /* 解锁:已解锁则静默;发放星晶与可能的专属皮肤;游戏内金色横幅播报 */
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
