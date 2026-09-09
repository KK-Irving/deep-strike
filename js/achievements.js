'use strict';
/* ============================================================
 * 深空突袭 DEEP STRIKE — 成就系统(v1.9.0 分级制重设计)
 * 34 条成就线 × 每线 5 级(共 170 个层级奖励),只升不降。
 * 每条线绑定一个统计维度(stat),达到层级阈值即升级并逐级发放星晶;
 * 部分线在指定层级附带专属皮肤/机体。
 * 旧版单级成就存档自动迁移(ACH_LEGACY_MAP)。
 * ============================================================ */

/* tiers: 每级阈值 n 与奖励 reward;skin/ship + skinAt/shipAt:指定层级附带专属 */
const ACHIEVEMENTS = [
  // ---- 战斗 ----
  { id: 'kills',      cat: '战斗', name: '无尽杀戮', stat: 'kills',      pre: '累计击坠敌机', tiers: [100, 1000, 3000, 8000, 20000], rewards: [50, 100, 200, 350, 500] },
  { id: 'runkills',   cat: '战斗', name: '单局屠戮', stat: 'runKills',   pre: '单局击坠敌机', tiers: [60, 120, 250, 400, 600], rewards: [50, 100, 200, 350, 500] },
  { id: 'bestscore',  cat: '战斗', name: '积分传奇', stat: 'bestScore',  pre: '单局得分', tiers: [20000, 50000, 100000, 200000, 400000], rewards: [50, 150, 250, 400, 600] },
  { id: 'totalscore', cat: '战斗', name: '百万军功', stat: 'totalScore', pre: '累计得分', tiers: [100000, 500000, 2000000, 5000000, 12000000], rewards: [50, 100, 250, 400, 600] },
  { id: 'bombs',      cat: '战斗', name: '爆破艺术', stat: 'bombsUsed',  pre: '累计使用炸弹', tiers: [50, 200, 600, 1500, 4000], rewards: [50, 100, 250, 400, 600] },
  // ---- 波次 ----
  { id: 'bestwave',   cat: '波次', name: '深空远征', stat: 'bestWave',   pre: '单局抵达第', unit: '波', tiers: [5, 10, 15, 25, 40], rewards: [50, 100, 200, 350, 600], skin: 'abyss', skinAt: 3, ship: 'tempest', shipAt: 4 },
  // ---- BOSS ----
  { id: 'bosskills',  cat: 'BOSS', name: '旗舰猎杀', stat: 'bossKills',  pre: '累计击毁旗舰', unit: '艘', tiers: [1, 10, 30, 60, 150], rewards: [50, 100, 250, 400, 700], skin: 'phantomX', skinAt: 2 },
  { id: 'bossnohit',  cat: 'BOSS', name: '完胜旗舰', stat: 'bossNoHit',  pre: '无伤击毁旗舰', unit: '艘', tiers: [1, 3, 6, 12, 20], rewards: [100, 200, 350, 500, 700] },
  { id: 'variants',   cat: 'BOSS', name: '变体征服', stat: 'variantKills', pre: '旗舰变体击毁收集(末级需四种各≥2)', tiers: [1, 2, 3, 4, 5], rewards: [100, 200, 350, 500, 700] },
  // ---- 连击 ----
  { id: 'combo',      cat: '连击', name: '连击传说', stat: 'bestCombo',  pre: '单局最高连击', tiers: [15, 30, 60, 120, 250], rewards: [50, 100, 200, 350, 600], skin: 'crimson', skinAt: 3 },
  // ---- 构筑 ----
  { id: 'evo',        cat: '构筑', name: '进化之路', stat: 'evoCount',   pre: '累计完成进化', unit: '次', tiers: [3, 8, 20, 40, 80], rewards: [100, 200, 350, 500, 700], skin: 'evoProto', skinAt: 1 },
  { id: 'bond',       cat: '构筑', name: '羁绊网络', stat: 'bondCount',  pre: '累计觉醒羁绊', unit: '条', tiers: [3, 10, 25, 50, 90], rewards: [50, 150, 300, 450, 600] },
  { id: 'maxed',      cat: '构筑', name: '满级大师', stat: 'maxedCards', pre: '累计将卡片升至 5 级', unit: '张', tiers: [3, 8, 18, 35, 60], rewards: [100, 200, 350, 500, 700] },
  { id: 'slots',      cat: '构筑', name: '基因狂想', stat: 'bestSlots',  pre: '单局强化槽位达', unit: '格', tiers: [6, 7, 8, 9, 10], rewards: [50, 100, 200, 350, 500] },
  // ---- 质变 ----
  { id: 'paths',      cat: '质变', name: '质变精通', stat: 'pathClears', pre: '精通质变武器(以该武器通关第 15 波)', unit: '条', tiers: [1, 2, 3, 4, 5], rewards: [100, 200, 300, 450, 600] },
  // ---- 精英 ----
  { id: 'elite',      cat: '精英', name: '精英收割', stat: 'eliteKills', pre: '累计击坠精英机', tiers: [10, 50, 200, 500, 1200], rewards: [50, 100, 250, 400, 600] },
  { id: 'dual',       cat: '精英', name: '双子猎手', stat: 'dualElite',  pre: '累计击坠双词缀精英', tiers: [1, 5, 15, 35, 70], rewards: [100, 200, 350, 500, 600] },
  // ---- 挑战 ----
  { id: 'perfect',    cat: '挑战', name: '完美防御', stat: 'perfectBest', pre: '连续无伤通过波次', unit: '波', tiers: [1, 3, 6, 10, 15], rewards: [100, 200, 350, 500, 700] },
  { id: 'lowhp',      cat: '挑战', name: '向死而生', stat: 'lowHpKills', pre: '濒死状态击坠敌机', tiers: [10, 30, 80, 200, 400], rewards: [100, 200, 350, 500, 700] },
  { id: 'curse',      cat: '挑战', name: '与狼共舞', stat: 'curseWaves', pre: '携带诅咒卡抵达第 10 波', unit: '次', tiers: [1, 2, 4, 7, 12], rewards: [100, 200, 350, 500, 600] },
  { id: 'nobomb',     cat: '挑战', name: '弹尽粮绝', stat: 'nobomb15',   pre: '不使用炸弹通关第 15 波', unit: '次', tiers: [1, 2, 4, 7, 12], rewards: [100, 200, 350, 500, 700] },
  { id: 'chain',      cat: '挑战', name: '连锁风暴', stat: 'bestChain',  pre: '单次链式闪电命中目标', tiers: [5, 8, 11, 14, 18], rewards: [100, 200, 350, 500, 600] },
  { id: 'mayhem',     cat: '挑战', name: '海克斯狂徒', stat: 'mayhemBest', pre: '大乱斗单局得分', tiers: [5000, 15000, 30000, 50000, 80000], rewards: [100, 200, 350, 500, 700] },
  { id: 'daily',      cat: '挑战', name: '每日精英', stat: 'dailyBest',  pre: '每日挑战单局得分', tiers: [5000, 12000, 20000, 35000, 60000], rewards: [100, 200, 350, 500, 700] },
  { id: 'weekly',     cat: '挑战', name: '周榜之巅', stat: 'weeklyBest', pre: '周挑战单局得分', tiers: [10000, 20000, 30000, 45000, 70000], rewards: [100, 200, 350, 500, 700] },
  { id: 'games',      cat: '挑战', name: '身经百战', stat: 'games',      pre: '累计出击', unit: '局', tiers: [10, 30, 80, 200, 500], rewards: [50, 100, 250, 400, 600] },
  // ---- 收集 ----
  { id: 'relics',     cat: '收集', name: '圣遗物收藏', stat: 'relicsGot',  pre: '累计获得圣遗物', unit: '件', tiers: [1, 5, 12, 25, 45], rewards: [100, 200, 350, 500, 700] },
  { id: 'box',        cat: '收集', name: '开匣成瘾', stat: 'boxOpens',   pre: '累计开启密匣', unit: '次', tiers: [10, 50, 150, 400, 1000], rewards: [100, 200, 300, 450, 600] },
  { id: 'rarepull',   cat: '收集', name: '天选之人', stat: 'rarePulls',  pre: '开出绚丽物品', unit: '次', tiers: [1, 2, 4, 8, 15], rewards: [100, 250, 400, 550, 700] },
  { id: 'chips',      cat: '收集', name: '芯片工匠', stat: 'chipsEarned', pre: '累计获得芯片', unit: '枚', tiers: [100, 500, 1500, 4000, 10000], rewards: [100, 200, 350, 500, 700] },
  { id: 'rich',       cat: '收集', name: '星晶帝国', stat: 'crystalBalance', pre: '星晶余额达', tiers: [500, 1500, 4000, 10000, 25000], rewards: [100, 200, 350, 500, 700] },
  { id: 'collection', cat: '收集', name: '藏机阁', stat: 'collection', pre: '收集皮肤与机体', unit: '件', tiers: [4, 8, 14, 20, 28], rewards: [100, 250, 400, 550, 700] },
  { id: 'bestiary',   cat: '收集', name: '博物学家', stat: 'bestiary',   pre: '图鉴收录敌机种类', tiers: [3, 6, 9, 11, 13], rewards: [100, 200, 350, 500, 800] },
  { id: 'tasks',      cat: '收集', name: '任务大师', stat: 'tasksDone',  pre: '累计完成任务', unit: '条', tiers: [5, 20, 50, 120, 250], rewards: [100, 200, 350, 500, 700] }
];

/* 旧版单级成就 → 分级制迁移映射:[新成就线 id, 迁移后等级](保守对齐,宁低勿高) */
const ACH_LEGACY_MAP = {
  first_kill: ['kills', 1],
  total_100: ['kills', 1], total_500: ['kills', 1], total_2000: ['kills', 2], total_5000: ['kills', 3], total_10000: ['kills', 4],
  run_kill60: ['runkills', 1], run_kill120: ['runkills', 2], run_kill250: ['runkills', 3],
  score_50k: ['bestscore', 2], score_150k: ['bestscore', 3],
  total_score_1m: ['totalscore', 2],
  bomb_50: ['bombs', 1], bomb_200: ['bombs', 2],
  wave_5: ['bestwave', 1], wave_10: ['bestwave', 2], wave_15: ['bestwave', 3], wave_20: ['bestwave', 3], wave_25: ['bestwave', 4], wave_30: ['bestwave', 4], wave_40: ['bestwave', 5], wave_50: ['bestwave', 5],
  boss_1: ['bosskills', 1], boss_5: ['bosskills', 1], boss_10: ['bosskills', 2], boss_25: ['bosskills', 2], boss_50: ['bosskills', 4], boss_100: ['bosskills', 5],
  boss_nohit: ['bossnohit', 1],
  storm_kill: ['variants', 1], tyrant_kill: ['variants', 1], dread_kill: ['variants', 1],
  combo_15: ['combo', 1], combo_30: ['combo', 2], combo_60: ['combo', 3], combo_100: ['combo', 3], combo_200: ['combo', 4], combo_300: ['combo', 5],
  evo_3: ['evo', 1], evo_5: ['evo', 1], evo_8: ['evo', 2],
  bond_3: ['bond', 1], bond_5: ['bond', 1], bond_8: ['bond', 1],
  maxed_3: ['maxed', 1], maxed_6: ['maxed', 1],
  slot_9: ['slots', 4],
  path_laser: ['paths', 1], path_spread: ['paths', 1], path_rail: ['paths', 1], path_tesla: ['paths', 1], path_boomer: ['paths', 1], path_all: ['paths', 4],
  elite_10: ['elite', 1], elite_50: ['elite', 2], elite_200: ['elite', 3], run_elite_10: ['elite', 1],
  dual_elite: ['dual', 1],
  perfect_wave: ['perfect', 1], perfect_3: ['perfect', 2], perfect_6: ['perfect', 3],
  lowhp_10: ['lowhp', 1], lowhp_30: ['lowhp', 2],
  curse_10: ['curse', 1],
  nobomb_wave15: ['nobomb', 1],
  tesla_chain8: ['chain', 2],
  daily_5000: ['daily', 1], daily_20000: ['daily', 3], weekly_30000: ['weekly', 3], mayhem_30k: ['mayhem', 3],
  level_10: ['games', 1], level_25: ['games', 2],
  rich_500: ['rich', 1], rich_1000: ['rich', 1], rich_5000: ['rich', 3],
  skin_3: ['collection', 1], skin_all: ['collection', 3], ship_all: ['collection', 2],
  box_50: ['box', 2], rare_pull: ['rarepull', 1], chip_master: ['chips', 2], codex_all: ['bestiary', 5]
};

const Ach = {
  unlocked: {},   // 成就线 id → 当前等级(1~5)
  _last: null,    // 最近一次 evaluate 的数值快照(供面板展示进度)

  load() {
    try { this.unlocked = JSON.parse(localStorage.getItem('deepstrike.ach')) || {}; }
    catch (e) { this.unlocked = {}; }
    // 旧版迁移:{旧id: 时间戳} → {新id: 等级}
    let migrated = false;
    for (const id of Object.keys(this.unlocked)) {
      const v = this.unlocked[id];
      if (this.def(id)) {
        if (typeof v !== 'number' || v < 0) { this.unlocked[id] = 0; migrated = true; }
        continue;
      }
      delete this.unlocked[id];
      const map = ACH_LEGACY_MAP[id];
      if (map) this.unlocked[map[0]] = Math.max(this.unlocked[map[0]] || 0, map[1]);
      migrated = true;
    }
    if (migrated) this.save();
  },
  save() {
    try { localStorage.setItem('deepstrike.ach', JSON.stringify(this.unlocked)); } catch (e) { /* 忽略 */ }
  },

  def(id) { return ACHIEVEMENTS.find(x => x.id === id); },
  levelOf(id) { return this.unlocked[id] || 0; },
  count() { return ACHIEVEMENTS.filter(a => this.levelOf(a.id) > 0).length; },
  totalTiers() { return ACHIEVEMENTS.reduce((s, a) => s + a.tiers.length, 0); },
  gotTiers() { return ACHIEVEMENTS.reduce((s, a) => s + this.levelOf(a.id), 0); },

  /* 提升到指定层级(只升不降):逐级补发奖励,达到指定层级发放专属 */
  set(id, lv, game) {
    const a = this.def(id);
    if (!a) return false;
    lv = Math.max(0, Math.min(lv, a.tiers.length));
    const cur = this.levelOf(id);
    if (lv <= cur) return false;
    this.unlocked[id] = lv;
    this.save();
    let reward = 0;
    for (let i = cur; i < lv; i++) reward += a.rewards[i];
    Shop.addCrystal(reward);
    let extra = '';
    if (a.skin && lv >= (a.skinAt || 99) && !Shop.owned[a.skin]) {
      Shop.owned[a.skin] = true;
      extra += ' · 皮肤「' + ((typeof SKINS !== 'undefined' && SKINS.find(x => x.id === a.skin)) || {}).name + '」';
    }
    if (a.ship && lv >= (a.shipAt || 99) && !Shop.ownedShip[a.ship]) {
      Shop.ownedShip[a.ship] = true;
      extra += ' · 机体「' + ((typeof SHIPS !== 'undefined' && SHIPS.find(x => x.id === a.ship)) || {}).name + '」';
    }
    if (typeof Shop.save === 'function') Shop.save();
    if (game) {
      game.banner = { text: cur === 0 ? '🏆 成就达成' : '🏆 成就升级', sub: a.name + ' Lv' + lv + ' · +' + reward + '★' + extra, life: 3.0, max: 3.0, gold: true };
      AudioSys.bond();
    }
    return true;
  },

  /* 旧接口兼容:单次解锁 = 升到 1 级(未知 id 静默忽略) */
  unlock(id, game) {
    if (!this.def(id)) return;
    this.set(id, Math.max(1, this.levelOf(id)), game);
  },

  /* 按数值推进:达到几档阈值即升到几级 */
  touch(id, value, game) {
    const a = this.def(id);
    if (!a || typeof value !== 'number') return;
    let target = 0;
    for (const n of a.tiers) if (value >= n) target++;
    this.set(id, target, game);
  },

  /* 批量评估:传入各统计维度快照,统一推进所有成就线 */
  evaluate(values, game) {
    this._last = values || this._last || {};
    for (const a of ACHIEVEMENTS) {
      const v = values[a.stat];
      if (typeof v === 'number') this.touch(a.id, v, game);
    }
  }
};
Ach.load();
