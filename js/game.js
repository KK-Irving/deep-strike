'use strict';
/* ============================================================
 * 深空突袭 DEEP STRIKE — 游戏核心
 * 状态机 / 波次导演 / 碰撞 / 特效 / HUD 渲染
 * ============================================================ */

/* 敌机图鉴:收录条目与首次击坠星晶奖励(击毁即收录,全部收录解锁博物学家) */
const BESTIARY_INFO = {
  drone:        { name: '无人机',   reward: 5 },
  waver:        { name: '摇摆机',   reward: 8 },
  bomber:       { name: '自爆蜂',   reward: 10 },
  sniper:       { name: '狙击机',   reward: 10 },
  mender:       { name: '治疗机',   reward: 12 },
  jammer:       { name: '干扰机',   reward: 12 },
  tank:         { name: '重装舰',   reward: 15 },
  shielder:     { name: '护盾兵',   reward: 15 },
  carrier:      { name: '母舰',     reward: 20 },
  boss_flag:    { name: '敌方旗舰', reward: 30 },
  boss_storm:   { name: '暴风旗舰', reward: 30 },
  boss_tyrant:  { name: '暴君旗舰', reward: 40 },
  boss_dread:   { name: '要塞旗舰', reward: 50 }
};

/* 海克斯大乱斗:强化符文(致敬 LoL 海克斯大乱斗/斗魂竞技场),白银/黄金/棱彩三档
 * 第 1/4/7/10 波开局三选一,共 4 轮;品阶随轮次提升。大乱斗为娱乐模式,使用真随机。 */
const AUGMENTS = [
  // 白银:小幅数值强化
  { id: 'a_engine',    tier: 0, icon: '🚀', name: '引擎过载',   desc: '移动速度 +20%' },
  { id: 'a_overclock', tier: 0, icon: '⚙',  name: '超频射击',   desc: '射击间隔 -15%' },
  { id: 'a_might',     tier: 0, icon: '💪', name: '巨力弹头',   desc: '所有伤害 +2' },
  { id: 'a_medic',     tier: 0, icon: '🩹', name: '医疗无人机', desc: '每秒回复 1.5 生命' },
  { id: 'a_scav',      tier: 0, icon: '🧲', name: '拾荒者',     desc: '经验获取 +40%' },
  { id: 'a_leech',     tier: 0, icon: '🩸', name: '吸血弹头',   desc: '击坠敌机回复 1 生命' },
  // 黄金:构筑级强化
  { id: 'a_glass',     tier: 1, icon: '💥', name: '玻璃大炮',   desc: '所有伤害 +50%,生命上限 -25%' },
  { id: 'a_snow',      tier: 1, icon: '⛄', name: '雪球风暴',   desc: '击坠时 20% 概率引发范围爆震' },
  { id: 'a_comet',     tier: 1, icon: '☄',  name: '天降彗星',   desc: '每 9 秒一颗彗星轰击随机敌机' },
  { id: 'a_ammo',      tier: 1, icon: '📦', name: '弹药库',     desc: '炸弹上限 +2,每 25 秒自动补一枚' },
  { id: 'a_coil',      tier: 1, icon: '🌀', name: '磁暴线圈',   desc: '每 5 秒清除自身周围 110px 敌弹' },
  { id: 'a_phase',     tier: 1, icon: '👻', name: '相位疾行',   desc: '受击后 +0.6 秒无敌并短暂加速' },
  // 棱彩:改变玩法规则的质变强化
  { id: 'a_urf',       tier: 2, icon: '♾️', name: '无限火力',   desc: '射击间隔 -35%,伤害 -20%' },
  { id: 'a_ghost',     tier: 2, icon: '🛡', name: '弹幕幽灵',   desc: '受到的所有伤害 -40%' },
  { id: 'a_nuke',      tier: 2, icon: '☢',  name: '战术核弹',   desc: '炸弹伤害 ×4,冲击半径 ×1.6' },
  { id: 'a_army',      tier: 2, icon: '🛰', name: '分身军团',   desc: '+2 架幻影僚机(不占槽位)' },
  { id: 'a_chrono',    tier: 2, icon: '⏱', name: '时间领主',   desc: '敌方弹幕永久减速 30%' },
  { id: 'a_stone',     tier: 2, icon: '🔶', name: '贤者之石',   desc: '星晶获取 ×2' }
];
const AUG_TIER = [
  { name: '白银强化', color: '#c0c8d8' },
  { name: '黄金强化', color: '#ffd166' },
  { name: '棱彩强化', color: '#ff6ad5' }
];

/* 遗物:旗舰击毁后掉落的被动神器(唯一,不占卡槽) */
const RELICS = [
  { id: 'r_thorn_crown', icon: '👑', name: '荆棘王冠', desc: '接触伤害 ×2,撞击敌机更疼' },
  { id: 'r_voidwatch',   icon: '⌛', name: '虚空怀表', desc: '全部敌方弹幕额外减速 10%' },
  { id: 'r_hunter',      icon: '🎯', name: '猎手徽记', desc: '暴击率 +10%' },
  { id: 'r_belt',        icon: '💊', name: '巨人药剂', desc: '生命上限 +30,拾取时回满' },
  { id: 'r_horn',        icon: '📯', name: '补给号角', desc: '每波开始时掉落一枚随机道具' },
  { id: 'r_dragon',      icon: '🐲', name: '龙魂核心', desc: '炸弹上限 +2,炸弹伤害 +15' },
  { id: 'r_grail',       icon: '🏆', name: '贪婪圣杯', desc: '星晶获取 ×2' },
  { id: 'r_bloodmoon',   icon: '🌙', name: '血月初刃', desc: '击坠 8% 概率回复 8 点生命' },
  { id: 'r_cloak',       icon: '🧿', name: '相位斗篷', desc: '受击后的无敌时间 +0.7 秒' },
  { id: 'r_thor',        icon: '⚡', name: '雷神之锤', desc: '击坠时 15% 概率引落闪电,重创 3 个随机敌人' },
  { id: 'r_magnet',      icon: '🧲', name: '引力核心', desc: '磁吸范围 +60%' },
  { id: 'r_frenzy',      icon: '🚩', name: '战意旗帜', desc: '连击维持时间 +1 秒' },
  { id: 'r_phoenix',     icon: '🪶', name: '不死鸟羽', desc: '每局一次,致死伤害时以 30% 生命浴火重生' },
  { id: 'r_sage',        icon: '📖', name: '贤者之书', desc: '经验获取 +25%' },
  { id: 'r_frostgem',    icon: '❄️', name: '寒霜宝石', desc: '击坠 25% 概率触发寒霜脉冲(全场减速 1.5 秒)' },
  { id: 'r_dice',        icon: '🎲', name: '命运骰子', desc: '击坠 10% 概率掉落随机道具' }
];

/* 深空远征(章节战役):10 章固定变体轮换,难度随章递增(vw = 12 + 章×3) */
const CAMPAIGN_VARIANTS = ['flag', 'storm', 'tyrant', 'dread'];
const CAMPAIGN_CHAPTERS = 10;
const CAMPAIGN_STORE = 'deepstrike.campaign';

/* 无尽模式波次词缀:第 6 波起概率出现(BOSS 波除外) */
const WAVE_MODS = [
  { id: 'horde',   icon: '✸', name: '狂潮', desc: '出怪配额 +40%' },
  { id: 'iron',    icon: '⚙', name: '钢铁', desc: '敌机生命 +35%' },
  { id: 'swift',   icon: '💨', name: '迅影', desc: '敌机速度 +20%' },
  { id: 'barrage', icon: '🔥', name: '弹雨', desc: '敌方开火频率 +40%' },
  { id: 'bounty',  icon: '💎', name: '赏金', desc: '经验 +50%,掉落翻倍' }
];

/* 周挑战全局变异:按周种子派生,本周所有玩家一致 */
const WEEK_MUTATORS = [
  { id: 'rage',    icon: '🔥', name: '狂暴周', desc: '全部敌机火力节奏 +25%' },
  { id: 'bulwark', icon: '⚙', name: '钢铁周', desc: '全部敌机生命 +25%' },
  { id: 'gale',    icon: '💨', name: '疾风周', desc: '全部敌机速度 +15%' },
  { id: 'greed',   icon: '💎', name: '贪婪周', desc: '星晶获取 ×1.5' },
  { id: 'surge',   icon: '🔷', name: '经验风暴', desc: '经验获取 +50%' },
  { id: 'hunt',    icon: '🎯', name: '猎杀周', desc: '精英机出现率与双词缀率大增' }
];

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = 'menu';           // menu | playing | paused | gameover
    this.keys = { left: false, right: false, up: false, down: false, fire: false, slow: false };
    this.touch = { active: false, x: 0, y: 0 };
    this.autoFire = true; // F 键可切换
    this.mode = 'normal'; // normal | daily | weekly
    this.bg = createBackground();
    this.stars = new Starfield();
    this.player = new Player();
    this.hi = this._loadHi();
    this.hard = this._loadHard();
    this.shakeMag = 0; this.shakeT = 0; this.shakeDur = 1;
    this.flashT = 0; this.flashColor = 'rgba(255,255,255,';
    this.bombActive = false; this.bombT = 0;
    this._reset();
    this.menuPanel = 'main';       // 主菜单子页面: main | help | stats
    this.stats = this._loadStats();
    this._dom = {
      menu: document.getElementById('menuOverlay'),
      pause: document.getElementById('pauseOverlay'),
      over: document.getElementById('overOverlay'),
      menuMain: document.getElementById('menuMain'),
      menuHelp: document.getElementById('menuHelp'),
      menuStats: document.getElementById('menuStats'),
      menuHi: document.getElementById('menuHi'),
      lvTitle: document.getElementById('lvTitle'),
      finalScore: document.getElementById('finalScore'),
      finalWave: document.getElementById('finalWave'),
      finalHi: document.getElementById('finalHi'),
      newRecord: document.getElementById('newRecord'),
      overRunStats: document.getElementById('overRunStats'),
      overBuild: document.getElementById('overBuild'),
      pauseBuild: document.getElementById('pauseBuild'),
      pauseRunStats: document.getElementById('pauseRunStats'),
      stHi: document.getElementById('stHi'),
      stWave: document.getElementById('stWave'),
      stGames: document.getElementById('stGames'),
      stKills: document.getElementById('stKills'),
      stScore: document.getElementById('stScore'),
      stBoss: document.getElementById('stBoss'),
      achList: document.getElementById('achList'),
      bestiaryGrid: document.getElementById('bestiaryGrid'),
      levelup: document.getElementById('levelupOverlay'),
      lvSub: document.getElementById('lvSub'),
      overCrystals: document.getElementById('overCrystals'),
      menuShop: document.getElementById('menuShop'),
      taskPanel: document.getElementById('taskPanel'),
      offlinePanel: document.getElementById('offlinePanel'),
      menuCampaign: document.getElementById('menuCampaign'),
      menuTuning: document.getElementById('menuTuning'),
      btnHard: document.getElementById('btnHard'),
      cardRow: document.getElementById('cardRow'),
      ownRow: document.getElementById('ownRow')
    };
    this._refreshMenuHi();
    this._showState();
  }

  _loadHi() { try { return +localStorage.getItem('deepstrike.hi') || 0; } catch (e) { return 0; } }
  _saveHi() { try { localStorage.setItem('deepstrike.hi', String(this.hi)); } catch (e) { /* 忽略 */ } }

  /* 高难模式:威胁+2 / 伤害上调 / 星晶 ×1.5,持久化,所有模式可用 */
  _loadHard() { try { return localStorage.getItem('deepstrike.hard') === '1'; } catch (e) { return false; } }
  toggleHard() {
    this.hard = !this.hard;
    try { localStorage.setItem('deepstrike.hard', this.hard ? '1' : '0'); } catch (e) { /* 忽略 */ }
    this._showState();
  }

  /* ---- 战绩档案(累计统计) ---- */
  _loadStats() {
    try { return JSON.parse(localStorage.getItem('deepstrike.stats')) || {}; }
    catch (e) { return {}; }
  }
  _stat(key, def) { return typeof this.stats[key] === 'number' ? this.stats[key] : def; }
  saveStats() {
    try { localStorage.setItem('deepstrike.stats', JSON.stringify(this.stats)); } catch (e) { /* 忽略 */ }
  }
  /* 成就评估快照:汇总本局统计 / 商城计数 / 各模式纪录 */
  _achEvaluate() {
    if (typeof Ach === 'undefined' || !Ach.evaluate) return;
    const s = this.stats;
    const vk = s.variantKills || {};
    const kinds = ['flag', 'storm', 'tyrant', 'dread'].filter(k => (vk[k] || 0) > 0).length;
    const all2 = ['flag', 'storm', 'tyrant', 'dread'].every(k => (vk[k] || 0) >= 2);
    let pathClears = 0;
    try { pathClears = Object.keys(JSON.parse(localStorage.getItem('deepstrike.pathClears')) || {}).length; } catch (e) { /* 忽略 */ }
    Ach.evaluate({
      kills: this._stat('kills', 0),
      runKills: this._stat('bestRunKills', 0),
      bestScore: this._stat('bestScore', 0),
      totalScore: this._stat('totalScore', 0),
      bombsUsed: this._stat('bombsUsed', 0),
      games: this._stat('games', 0),
      bestWave: this._stat('bestWave', 0),
      bossKills: this._stat('bossKills', 0),
      bossNoHit: this._stat('bossNoHit', 0),
      variantKills: kinds + (all2 ? 1 : 0),
      bestCombo: this._stat('bestCombo', 0),
      evoCount: this._stat('evoCount', 0),
      bondCount: this._stat('bondCount', 0),
      maxedCards: this._stat('maxedCards', 0),
      bestSlots: this._stat('bestSlots', 0),
      bestLevel: this._stat('bestLevel', 0),
      pathClears,
      eliteKills: this._stat('eliteKills', 0),
      dualElite: this._stat('dualEliteKills', 0),
      perfectBest: this._stat('perfectBest', 0),
      lowHpKills: this._stat('lowHpKills', 0),
      curseWaves: this._stat('curseWaves', 0),
      nobomb15: this._stat('nobomb15', 0),
      bestChain: this._stat('bestChain', 0),
      mayhemBest: this._mayhemBest(),
      dailyBest: this._modeBest('daily'),
      weeklyBest: this._modeBest('weekly'),
      relicsGot: this._stat('relicsGot', 0),
      boxOpens: (typeof Shop !== 'undefined' && Shop.boxOpens) || 0,
      rarePulls: this._stat('rarePulls', 0),
      chipsEarned: (typeof Shop !== 'undefined' && Shop.chipsEarned) || 0,
      crystalBalance: (typeof Shop !== 'undefined' && Shop.crystal) || 0,
      collection: (typeof Shop !== 'undefined' ? Object.keys(Shop.owned || {}).length + Object.keys(Shop.ownedShip || {}).length : 0),
      bestiary: Object.keys(s.bestSeen || {}).length,
      tasksDone: this._stat('tasksDone', 0),
      campaignStars: this.campaignStars()
    }, this);
  }


  /* 每日任务面板(主菜单) */

  /* ---- 菜单子页面切换 ---- */

  /* ---- 从游戏返回主菜单 ---- */
  toMenu() {
    this.state = 'menu';
    this.menuPanel = 'main';
    this.saveStats();
    this._refreshMenuHi();
    this._showState();
  }

  _reset() {
    this.shipDef = Shop.currentShip();
    this.player.reset(this.shipDef);
    this.playerBullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.boss = null;
    this.powerups = [];
    this.particles = [];
    this.rings = [];
    this.floats = [];
    this.score = 0; this.combo = 0; this.comboT = 0;
    this.wave = 0; this.waveTime = 0; this.spawnQueue = [];
    this.waveQuota = 0; this.waveKills = 0; this.trickleT = 0;
    this.maxCombo = 0;
    this.banner = null; this.waveClearT = -1;
    this.deathT = -1; this.newRecord = false;
    // 肉鸽成长状态
    this.orbs = [];
    this.mods = {}; this.bonds = [];
    this.xp = 0; this.level = 1; this.xpNext = 12; this.pendingLevels = 0;
    this.xpMult = 1; this.comboWindow = 2;
    this.bombMeter = 0;
    // 限时增益(道具):x2 双倍得分 / frenzy 狂热射速 / frost 寒霜减速 / jam 受干扰(单位秒)
    this.buffs = { x2: 0, frenzy: 0, frost: 0, jam: 0 };
    this.wingmen = []; this.rifts = []; this.riftCd = 0;
    this.asteroids = []; this.supplies = [];
    this.runKills = 0; this.runEliteKills = 0; this.runBossKills = 0; this.runEvoCount = 0;
    this.runBombsUsed = 0; this.runBossNoHit = false;
    this.waveDamageTaken = 0; this.perfectStreak = 0; this.runLowHpKills = 0;
    this._cardChoices = [];
    this._drawCount = 0;
    this._pendingSwap = null; this._swapList = null;
    this.evo = {}; this.bulletFreezeT = 0;
    this.relics = {}; this.pendingRelic = false; this._relicMode = false; this._relicChoices = [];
    this.augments = {}; this._cometT = 0; this._coilT = 0; this._ammoT = 0; // 海克斯大乱斗:符文与计时器
    this._forceRelicDrop = false; this._phoenixUsed = false;
    this._campKills = 0; this._campQuota = 0; this._campClean = true; this._campPrev = null; // 深空远征统计
    this._devilMode = false; this._devilChoices = []; this._devilPending = false;
    this.levelupCooldown = 0;
    this.waveMod = null; this._env = { hpMul: 1, spdMul: 1, fireMul: 1 };
    this._recalc();
  }

  start(challengeMode, campaignChapter) {
    this.mode = challengeMode || 'normal';
    if (this.mode === 'campaign') this.campaignChapter = Math.max(1, Math.min(CAMPAIGN_CHAPTERS, campaignChapter || this.campaignChapter || 1));
    // 每日/周挑战:播种固定波次序列与抽卡序列;周挑战威胁+1
    // 种子基准保留,供 startWave 按波派生与 _drawChoices 按抽卡序号派生
    Shop.offlineTick(); // 进入对局即起算新一轮离线补给
    this._seedBase = this._challengeSeed();
    RNG = this.isChallenge() ? mulberry32(this._seedBase) : Math.random;
    // 周挑战全局变异(由周种子决定)
    this._mut = this._weekMutator();
    this._reset();
    this.state = 'playing';
    AudioSys.init();
    if (AudioSys.musicGain) AudioSys.musicGain.gain.value = 0.3;
    // 机库永久强化:初始资源(多级)
    const bombLv = boostLevel('bomb1');
    if (bombLv) this.player.bombs += Math.ceil(bombLv / 2); // 砍半:每 2 级 +1 炸弹(满级 +5)
    if (boostLevel('hp25')) this.player.hp = this.player.maxHp;
    if (boostLevel('shield')) this.player.shield = true;
    // 出击准备:消耗一次性战前增益(芯片购买)
    this._relicFive = false;
    const load = Shop.consumeLoadout();
    if (load.bomb2) this.player.bombs = Math.min(5, this.player.bombs + 1);
    if (load.lv3) this.pendingLevels += 2;
    if (load.relic5) { this._relicFive = true; this._forceRelicDrop = true; } // 情报网络:首艘旗舰必掉 + 连战五选一
    if (load.heal0) this.player.hp = this.player.maxHp;
    if (load.aegis0) this.player.shield = true;
    if (load.bomb2 || load.lv3 || load.relic5 || load.heal0 || load.aegis0)
      this._addFloat(new FloatText(this.player.x, this.player.y - 40, '出击准备生效', '#ffd166', 13));
    this._showState();
    this.startWave(1);
    // 紧急改装:开局立即弹出强化选择
    if (load.lv3 && this.pendingLevels > 0) this.openLevelup();
    if (this.mode === 'daily') this.banner = { text: '每日挑战', sub: this._challengeKey() + ' · 固定关卡,冲击纪录', life: 2.4, max: 2.4, gold: true };
    if (this.mode === 'weekly') this.banner = { text: '周挑战', sub: this._challengeKey() + (this._mut ? ' · ' + this._mut.icon + ' ' + this._mut.name + ':' + this._mut.desc : '') + ' · 威胁+1,冲击纪录', life: 3.0, max: 3.0, gold: true };
    if (this.mode === 'boss') this.banner = { text: '旗舰连战', sub: '连续击毁不断强化的旗舰 · 每阶段升级+遗物 · 每日芯片限领', life: 2.6, max: 2.6, gold: true };
    if (this.mode === 'mayhem') this.banner = { text: '海克斯大乱斗', sub: '经验/星晶 +50% · 出怪更凶 · 四轮海克斯强化三选一', life: 2.8, max: 2.8, gold: true };
    if (this.mode === 'campaign') this.banner = { text: '深空远征 · 第 ' + this.campaignChapter + ' 章', sub: '5 波固守 · 击败' + BOSS_VARIANTS[CAMPAIGN_VARIANTS[(this.campaignChapter - 1) % 4]].name, life: 3.0, max: 3.0, gold: true };
  }

  /* ---- 每日挑战 ---- */
  _dailyKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  _weekKey() {
    // ISO 8601 周号:周一为一周之始,含首个周四的周为第 1 周,跨年归属正确
    const d = new Date();
    const thursday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    thursday.setDate(thursday.getDate() - ((thursday.getDay() + 6) % 7) + 3);
    const isoYear = thursday.getFullYear();
    const first = new Date(isoYear, 0, 4);
    first.setDate(first.getDate() - ((first.getDay() + 6) % 7) + 3);
    const week = 1 + Math.round((thursday - first) / (7 * 86400000));
    return isoYear + '-W' + String(week).padStart(2, '0');
  }
  _challengeKey() {
    if (this.mode === 'campaign') return 'campaign-' + (this.campaignChapter || 1);
    return this.mode === 'weekly' ? this._weekKey() : this._dailyKey();
  }
  /* 是否种子挑战模式(每日/周/章节战役)——旗舰连战与普通模式使用真随机 */
  isChallenge() { return this.mode === 'daily' || this.mode === 'weekly' || this.mode === 'campaign'; }
  /* 战役存取:章号 → 星数(0~3) */
  _campaignLoad() {
    try { return JSON.parse(localStorage.getItem(CAMPAIGN_STORE)) || {}; }
    catch (e) { return {}; }
  }
  _campaignSave(st) {
    try { localStorage.setItem(CAMPAIGN_STORE, JSON.stringify(st)); } catch (e) { /* 忽略 */ }
  }
  campaignStars() {
    const st = this._campaignLoad();
    return Object.keys(st).reduce((s, k) => s + (st[k] || 0), 0);
  }
  campaignUnlocked(ch) {
    if (ch <= 1) return true;
    const st = this._campaignLoad();
    return (st[ch - 1] || 0) >= 1;
  }
  /* 周挑战全局变异:按周种子派生(加盐避免与出怪序列同流),本周固定且人人一致 */
  _weekMutator() {
    if (this.mode !== 'weekly') return null;
    const k = 'mut:' + this._weekKey();
    let h = 2166136261;
    for (let i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = Math.imul(h, 16777619); }
    return WEEK_MUTATORS[(h >>> 0) % WEEK_MUTATORS.length];
  }
  /* 挑战芯片领取闸门:按当前真实日期/周判断本期是否已领取 */
  _claimStoreKey() {
    return this.mode === 'weekly' ? 'deepstrike.weeklyClaim' : 'deepstrike.dailyClaim';
  }
  _canClaimChips() {
    if (this.mode === 'normal' || this.mode === 'campaign' || this.mode === 'mayhem') return false;
    try {
      const claimed = localStorage.getItem(this._claimStoreKey());
      return claimed !== this._challengeKey();
    } catch (e) { return true; }
  }
  _markChipsClaimed() {
    try { localStorage.setItem(this._claimStoreKey(), this._challengeKey()); }
    catch (e) { /* 忽略 */ }
  }
  _challengeSeed() {
    const k = this._challengeKey();
    let h = 2166136261;
    for (let i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  _challengePrefix() {
    if (this.mode === 'campaign') return 'deepstrike.campaignHi.';
    return this.mode === 'weekly' ? 'deepstrike.weeklyHi.' : 'deepstrike.dailyHi.';
  }
  _challengeBest() {
    try { return +localStorage.getItem(this._challengePrefix() + this._challengeKey()) || 0; }
    catch (e) { return 0; }
  }
  _saveChallengeBest(score) {
    try { localStorage.setItem(this._challengePrefix() + this._challengeKey(), String(score)); }
    catch (e) { /* 忽略 */ }
  }
  /* 旗舰连战:永久最佳纪录 + 每日芯片限领 */
  _bossBest() { try { return +localStorage.getItem('deepstrike.bossHi') || 0; } catch (e) { return 0; } }
  _saveBossBest(s) { try { localStorage.setItem('deepstrike.bossHi', String(s)); } catch (e) { /* 忽略 */ } }
  _canBossClaim() { try { return localStorage.getItem('deepstrike.bossClaim') !== this._dailyKey(); } catch (e) { return true; } }
  _markBossClaimed() { try { localStorage.setItem('deepstrike.bossClaim', this._dailyKey()); } catch (e) { /* 忽略 */ } }
  /* 海克斯大乱斗:永久最佳纪录 */
  _mayhemBest() { try { return +localStorage.getItem('deepstrike.mayhemHi') || 0; } catch (e) { return 0; } }
  _saveMayhemBest(s) { try { localStorage.setItem('deepstrike.mayhemHi', String(s)); } catch (e) { /* 忽略 */ } }

  /* 记录某质变武器已通关第 15 波;四种集齐解锁「万法归一」 */
  _recordPathClear(pk) {
    try {
      const done = JSON.parse(localStorage.getItem('deepstrike.pathClears')) || {};
      if (!done[pk]) {
        done[pk] = true;
        localStorage.setItem('deepstrike.pathClears', JSON.stringify(done));
      }
      if (['laser', 'spread', 'railgun', 'tesla'].every(k => done[k])) Ach.unlock('path_all', this);
    } catch (e) { /* 忽略 */ }
  }
  _modeBest(mode) {
    const key = (mode === 'weekly' ? 'deepstrike.weeklyHi.' : 'deepstrike.dailyHi.') + (mode === 'weekly' ? this._weekKey() : this._dailyKey());
    try { return +localStorage.getItem(key) || 0; }
    catch (e) { return 0; }
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this._dom.pauseBuild.innerHTML = this._buildSummaryHTML();
      this._dom.pauseRunStats.textContent = this._runStatsText();
    } else if (this.state === 'paused') {
      this.state = 'playing';
    } else return;
    if (AudioSys.musicGain) AudioSys.musicGain.gain.value = this.state === 'paused' ? 0.1 : 0.3;
    this._showState();
  }

  autoPause() {
    if (this.state === 'playing') this.togglePause();
  }


  multiplier() { return 1 + Math.min(3, Math.floor(this.combo / 8)); }

  /* 弹速增长封顶波数:防止后期弹速无限膨胀 */
  effWave() { return Math.min(this.wave, 18); }

  /* 无尽模式威胁等级:第 15 波起每 5 波 +1;周挑战全程 +1;高难 +2 */
  threatLevel() {
    const base = Math.floor(Math.max(0, this.wave - 10) / 5);
    return base + (this.mode === 'weekly' ? 1 : 0) + (this.mode === 'campaign' ? Math.floor(((this.campaignChapter || 1) - 1) / 2) : 0) + (this.hard ? 2 : 0);
  }

  /* ---------------- 肉鸽升级系统 ---------------- */
  _recalc() {
    const m = this.mods, p = this.player;
    const E = this.evo || {};   // 进化状态
    const sh = this.shipDef || {};
    const A = this.augments || {};   // 海克斯大乱斗:已获符文
    p.dmgBonus = (m.dmg || 0) + (E.dmg ? 2 : 0) + (sh.dmgBonus || 0) + (A.a_might ? 2 : 0) + (E.multi ? 1 : 0); // 「巨力弹头」/ 万炮齐发
    p.dmgMul = (m.glass ? 1 + 0.2 * m.glass : 1) * (A.a_glass ? 1.5 : 1) * (A.a_urf ? 0.8 : 1); // 玻璃大炮卡(+20%/级) / 符文
    let interval = (p.fireBase || 0.12) * Math.pow(0.88, m.rate || 0);
    if (E.rate) interval *= 0.75;
    if (this.bonds.includes('overdrive')) interval *= 0.85;
    // 轨道炮:蓄力式慢射(高单发伤害);穿甲协议/磁暴风进化缩短蓄力
    if (m.railgun) {
      let railMul = 3.2 - 0.35 * (m.railgun - 1);
      if (this.bonds.includes('railcrit')) railMul *= 0.7;
      if (E.railgun) railMul *= 0.65;
      interval *= railMul;
    }
    // 回旋刃:双程伤害故投掷偏慢;疾风投掷/龙卷之核缩短间隔
    if (m.boomer) {
      interval *= 1.45 - 0.06 * (m.boomer - 1);
      if (this.bonds.includes('boomerch')) interval *= 0.75;
      if (E.boomer) interval *= 0.85;
    }
    // 海克斯强化:「超频射击」-15% /「无限火力」-35%
    if (A.a_overclock) interval *= 0.85;
    if (A.a_urf) interval *= 0.65;
    p.fireInterval = Math.max(0.045, interval);
    p.speed = (sh.speed || 330) * Math.pow(1.10, m.speed || 0) * (A.a_engine ? 1.2 : 1) * (E.speed ? 1.25 : 1);
    p.magnetR = 140 + (sh.perkMagnet || 0) + (m.magnet || 0) * 45 + 18 * boostLevel('magnet0');
    if (E.magnet) p.magnetR *= 1.8;
    if (this.relics.r_magnet) p.magnetR *= 1.6;
    // 经验调校 + 经验风暴周变异
    this.xpMult = (1 + 0.15 * (m.xpchip || 0) + 0.04 * boostLevel('xp10')) * (this._mut && this._mut.id === 'surge' ? 1.5 : 1)
      * (A.a_scav ? 1.4 : 1) * (E.xpchip ? 1.4 : 1) * (this.relics.r_sage ? 1.25 : 1) * (this.mode === 'mayhem' ? 1.5 : 1); // 「拾荒者」符文;大乱斗节奏福利 +50%
    this.comboWindow = 2 + 0.7 * (m.combo || 0) + (E.combo ? 2 : 0) + (this.relics.r_frenzy ? 1 : 0);
    p.shieldInterval = Math.max(3, (this.bonds.includes('fortress') ? 6 : 12) - (m.shieldgen || 0)); // 护盾发生器每级充能 -1 秒
    // 时滞力场:敌弹整体减速(「时间领主」羁绊强化每层效果)
    const timePerStack = this.bonds.includes('chrono') ? 0.16 : 0.10;
    const timeCap = this.bonds.includes('chrono') ? 0.62 : 0.50;
    this.bulletSlow = (m.time || 0) ? 1 - Math.min(timeCap, timePerStack * m.time) : 1;
    if (this.relics.r_voidwatch) this.bulletSlow = Math.max(0.3, this.bulletSlow * 0.9);
    if (m.pact) this.bulletSlow = Math.min(1.25, this.bulletSlow * (1 + (E.pact ? 0.015 : 0.03) * m.pact)); // 贪婪契约:敌弹加速(黄金契约惩罚减半)
    if (A.a_chrono) this.bulletSlow *= 0.7; // 「时间领主」:敌弹永久减速 30%
    // 卡槽系统:基础 5 槽,隐藏卡扩展
    this.maxSlots = 5 + (m.slotplus || 0) + (E.slotplus ? 1 : 0); // 无限基因再 +1
    // 生命值系统:上限 = 机体基础 + 卡片成长 + 等级成长(+泰坦血统 50 + 机库装甲扩容)
    const glassHp = m.glass ? (E.glass ? 1 - 0.04 * m.glass : 1 - 0.08 * m.glass) : 1; // 玻璃大炮:逐级 -8%,进化后惩罚减半
    p.maxHp = Math.round(((sh.hp || 100) + 20 * (m.vitality || 0) + 5 * (this.level - 1) + (E.vitality ? 50 : 0)
      + 10 * boostLevel('hp25') + (this.relics.r_belt ? 30 : 0)) * glassHp * (A.a_glass ? 0.75 : 1));
    p.armorPct = Math.min(E.armor ? 0.62 : 0.5, 0.08 * (m.armor || 0) + (E.armor ? 0.12 : 0) + (sh.perkArmor || 0) + (this.tuningLv('armorT') >= 1 ? 0.06 : 0) + Math.min(0.12, 0.012 * boostLevel('shield'))); // 装甲每级 -8%;泰坦装甲 +12% 并抬上限;装甲改装 I -6%
    p.regenRate = 0.4 * (m.regen || 0) * (E.regen ? 2 : 1) + (A.a_medic ? 1.5 : 0);
    p.leechPer = 0.45 * (m.leech || 0) + (A.a_leech ? 1 : 0);
    if (E.leech) p.leechPer *= 2; // 血之盛宴
    if (p.devilCost) { p.maxHp = Math.max(1, p.maxHp - p.devilCost); p.hp = Math.min(p.hp, p.maxHp); } // 恶魔契约:生命上限献祭
    if (this.tuningLv('armorT') >= 2) p.maxHp += 20; // 装甲改装 II
    p.hp = Math.min(p.hp, p.maxHp);
    // 幻影僚机:数量同步
    const wingTarget = (m.wingman || 0) + (A.a_army ? 2 : 0) + (E.wingman ? 2 : 0) + (this.tuningLv('wingT') >= 2 ? 1 : 0); // 「分身军团」/幽灵中队/僚机改装 II:+1 不占槽位
    while (this.wingmen.length < wingTarget) this.wingmen.push(new Wingman(this.wingmen.length));
    while (this.wingmen.length > wingTarget) this.wingmen.pop();
    if (m.shieldgen && !p.shield && p.shieldCd <= 0) p.shieldCd = p.shieldInterval;
  }

  /* 补给空投开箱 */
  openSupply(kind, x, y) {
    AudioSys.powerup();
    if (kind === 'star') {
      this.score += 500;
      this._addFloat(new FloatText(x, y - 16, '+500', '#ffd166', 15));
    } else {
      this._applyPower(kind);
    }
  }

  /* 激光主炮:光束持续伤害结算(每帧调用) */
  beamTick(dt) {
    const p = this.player, m = this.mods;
    const lvl = m.laser;
    // 卡片协同:dmg 线性增益、pierce 加宽并增伤、crit 周期过载脉冲、split 分裂侧束、要害/处决羁绊放大
    const critChance = 0.1 * (m.crit || 0) + (this.evo.crit ? 0.3 : 0) + (this.relics.r_hunter ? 0.1 : 0)
      + (m.brittle ? 0.06 * m.brittle : 0);
    // 过载脉冲:按暴击率周期性爆发额外伤害(把"暴击"转译为持续武器的节奏)
    this._beamCritT = (this._beamCritT || 0) - dt;
    let critPulse = 1;
    if (critChance > 0 && this._beamCritT <= 0) {
      this._beamCritT = Math.max(0.25, 0.9 - critChance);
      critPulse = this.bonds.includes('execute') ? 3.2 : (this.evo.crit ? 2.6 : 2.2);
      this._beamCrit = 0.12; // 过载可见时长
    }
    this._beamCrit = Math.max(0, (this._beamCrit || 0) - dt);
    const dps = (8 + 2.6 * (lvl - 1) + 3.2 * p.dmgBonus)
      * (this.bonds.includes('focus') ? 1.6 : 1)
      * (1 + 0.18 * (p.weapon - 1))
      * (1 + 0.25 * (m.pierce || 0))          // 贯穿:每层 +25% 灼烧
      * (this._beamCrit > 0 ? critPulse : 1) // 过载脉冲窗口内爆发
      * (p.dmgMul || 1);
    let halfW = 2.5 + 0.5 * (lvl - 1) + 0.4 * (p.weapon - 1) + 0.6 * (m.pierce || 0);
    if (this.evo.laser) halfW *= 1.6;
    const lensPen = this.bonds.includes('laserlens');
    if (lensPen) halfW *= 2;
    const beamDps = dps * (this.evo.laser ? 1.25 : 1)   // 平衡:略降激光 evo 统治力(1.4→1.25)
      * (this.buffs.frenzy > 0 ? 1.3 : 1);              // 狂热:持续武器以增伤等价受益
    // 主光束 + multi 侧束 + split 分裂副束(split 使每束旁再生一道细束)
    const xs = [p.x];
    for (let i = 1; i <= (m.multi || 0); i++) { xs.push(p.x - 7 - i * 8, p.x + 7 + i * 8); }
    const splitN = m.split || 0;
    const splitBeams = [];
    if (splitN > 0) for (const bx of xs) { splitBeams.push(bx - 6 - splitN * 3, bx + 6 + splitN * 3); }
    const allX = xs.concat(splitBeams);
    const splitDps = beamDps * 0.4;
    this.beams = allX.map((x, i) => ({ x, halfW: i < xs.length ? halfW : halfW * 0.6, split: i >= xs.length, hot: this._beamCrit > 0 }));
    let hitAny = false;
    for (let bi = 0; bi < allX.length; bi++) {
      const bx = allX[bi];
      const isSplit = bi >= xs.length;
      const w = isSplit ? halfW * 0.6 : halfW;
      const dmgHere = isSplit ? splitDps : beamDps;
      for (const e of this.enemies) {
        if (e.dead || e.elitePhased) continue;
        if (e.y < p.y - 6 && Math.abs(e.x - bx) < e.r + w) {
          // 护盾开启的护盾兵:激光仅 30% 烧蚀通过(聚焦透镜羁绊无视护盾)
          const mul = (e.type === 'shielder' && e.shieldOff <= 0 && !lensPen) ? 0.3 : 1;
          e.damage(dmgHere * dt * mul, this, true);
          hitAny = true;
        }
      }
      // 激光烧蚀陨石
      for (const a of this.asteroids) {
        if (!a.dead && a.y < p.y - 6 && Math.abs(a.x - bx) < a.r + w) {
          a.damage(dmgHere * dt, this);
          hitAny = true;
        }
      }
      if (this.boss && this.boss.state === 'fight' && Math.abs(this.boss.x - bx) < this.boss.r + w) {
        this.boss.damage(dmgHere * dt, this, true);
        hitAny = true;
      }
      if (this.boss && this.boss.state === 'fight' && this.boss.pods) {
        for (const pod of this.boss.pods) {
          if (pod.dead) continue;
          const px = this.boss.x + pod.ox;
          if (Math.abs(px - bx) < pod.r + w && this.boss.y + pod.oy < p.y - 6)
            this.boss.hitPod(pod, dmgHere * dt * 0.6, this);
        }
      }
    }
    this._beamSndT = (this._beamSndT || 0) - dt;
    if (hitAny && this._beamSndT <= 0) {
      this._beamSndT = 0.15;
      AudioSys.beam();
    }
  }

  gainXP(n) {
    this.xp += n * this.xpMult;
    AudioSys.xp();
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = Math.round(this.xpNext * 1.22 + 4);
      this.pendingLevels++;
      // 等级成长:生命上限 +5 并回复同量
      this._recalc();
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 5);
      if (this.level >= 10) Ach.unlock('level_10', this);
      if (this.level >= 25) Ach.unlock('level_25', this);
    }
    if (this.pendingLevels > 0 && this.state === 'playing' && this.player.alive && !(this.levelupCooldown > 0)) this.openLevelup();
  }

  _ownedIds() {
    return UPGRADES.filter(u => (this.mods[u.id] || 0) > 0 && !u.hidden).map(u => u.id);
  }

  /* 抽卡:挑战模式下按抽卡序号派生独立子流——第 N 抽的随机取数对全天
   * 所有尝试一致(具体出卡仍受各自构筑过滤影响),且不影响波内种子流 */
  _drawChoices() {
    if (!this.isChallenge()) return drawUpgradeCards(this.mods, this.maxSlots, this.level, this.evo);
    const idx = this._drawCount++;
    const saved = RNG;
    RNG = mulberry32((this._seedBase ^ Math.imul(idx + 1, 0x85EBCA6B)) >>> 0);
    const picks = drawUpgradeCards(this.mods, this.maxSlots, this.level, this.evo);
    RNG = saved;
    return picks;
  }

  /* 羁绊重构:根据当前模组重算激活羁绊,返回增减 */
  _recalcBonds() {
    const active = BONDS.filter(b => b.req.every(id => (this.mods[id] || 0) > 0)).map(b => b.id);
    const gained = active.filter(id => !this.bonds.includes(id));
    const lost = this.bonds.filter(id => !active.includes(id));
    this.bonds = active;
    return { gained, lost };
  }

  openLevelup() {
    if (this.state !== 'playing' || this.pendingLevels <= 0) return;
    this._cardChoices = this._drawChoices();
    // 卡池耗尽兜底(全部满级):转化为奖励分,避免软锁
    if (this._cardChoices.length === 0) {
      const bonus = 500 * this.pendingLevels;
      this.score += bonus;
      this._addFloat(new FloatText(this.player.x, this.player.y - 30, '全模块满级 +' + bonus, '#ffd166', 14));
      this.pendingLevels = 0;
      return;
    }
    this.state = 'levelup';
    AudioSys.levelup();
    this._renderCards();
    this._showState();
  }


  /* 遗物三选一(情报网络增益下五选一):复用升级界面 */
  _openRelicChoice() {
    if (this.state !== 'playing') return;
    const avail = RELICS.filter(x => !this.relics[x.id]);
    if (!avail.length) return;
    const want = this._relicFive ? 5 : 3;
    this._relicFive = false;
    const picks = [];
    const pool = avail.slice();
    for (let i = 0; i < want && pool.length; i++) {
      picks.push(pool.splice(irand(0, pool.length - 1), 1)[0]);
    }
    this._relicMode = true;
    this._relicChoices = picks;
    this.state = 'levelup';
    AudioSys.levelup();
    this._renderRelics();
    this._showState();
  }

  chooseRelic(i) {
    if (!this._relicMode || this.state !== 'levelup') return;
    const r = this._relicChoices[i];
    if (!r) return;
    this.relics[r.id] = true;
    this.stats.relicsGot = this._stat('relicsGot', 0) + 1;
    this._achEvaluate();
    AudioSys.bond();
    this.banner = { text: '遗物获得 · ' + r.name, sub: r.desc, life: 2.6, max: 2.6, gold: true };
    this._relicMode = false;
    this._relicChoices = [];
    this._recalc();
    if (r.id === 'r_belt') this.player.hp = this.player.maxHp;
    this.state = 'playing';
    this._showState();
    this._maybeDevil();
  }


  /* ---------------- 海克斯大乱斗:强化三选一 ---------------- */
  /* 每轮按权重抽取品阶:轮次越靠后,黄金/棱彩占比越高(致敬 LoL 海克斯大乱斗) */
  _drawAugments(round) {
    const W8 = [{ s: 70, g: 30, p: 0 }, { s: 40, g: 45, p: 15 }, { s: 20, g: 50, p: 30 }, { s: 10, g: 35, p: 55 }][Math.max(0, Math.min(3, round - 1))];
    const owned = this.augments || {};
    const pool = AUGMENTS.filter(a => !owned[a.id]);
    const picks = [];
    for (let n = 0; n < 3 && pool.length; n++) {
      const roll = Math.random() * (W8.s + W8.g + W8.p);
      const tier = roll < W8.s ? 0 : roll < W8.s + W8.g ? 1 : 2;
      let cands = pool.filter(a => a.tier === tier);
      if (!cands.length) cands = pool;
      const pick = cands[Math.floor(Math.random() * cands.length)];
      picks.push(pick);
      pool.splice(pool.indexOf(pick), 1);
    }
    return picks;
  }
  _openAugmentChoice(round) {
    if (this.state !== 'playing' || this.mode !== 'mayhem') return;
    const picks = this._drawAugments(round);
    if (!picks.length) return;
    this._augMode = true;
    this._augRound = round;
    this._augChoices = picks;
    this.state = 'levelup';
    AudioSys.levelup();
    this._renderAugments();
    this._showState();
  }
  chooseAugment(i) {
    if (!this._augMode || this.state !== 'levelup') return;
    const a = this._augChoices[i];
    if (!a) return;
    this.augments[a.id] = a.tier + 1; // +1:白银(0 档)也须为真值,判定处一律按存在性判断
    AudioSys.bond();
    this.banner = { text: AUG_TIER[a.tier].name + ' · ' + a.name, sub: a.desc, life: 2.6, max: 2.6, gold: true };
    this._augMode = false;
    this._augChoices = [];
    this._recalc();
    this.state = 'playing';
    this._showState();
  }

  /* ---------------- 恶魔契约(Phase 4.4) ---------------- */
  _openDevilOffer() {
    const pathId = UPGRADES.find(u => u.path && (this.mods[u.id] || 0) > 0);
    const pool = UPGRADES.filter(u => u.rar === 2 && !u.hidden && !u.curse
      && (this.mods[u.id] || 0) < u.max
      && !(u.path && pathId && pathId.id !== u.id));
    if (pool.length < 3) return;
    const picks = [];
    const left = pool.slice();
    for (let i = 0; i < 3 && left.length; i++)
      picks.push(left.splice(Math.floor(RNG() * left.length), 1)[0]);
    if (picks.length < 3) return;
    this._devilMode = true;
    this._devilChoices = picks;
    this.state = 'levelup';
    AudioSys.alarm();
    this._renderDevils();
    this._showState();
  }
  chooseDevil(i) {
    if (!this._devilMode || this.state !== 'levelup') return;
    const u = this._devilChoices[i];
    if (!u) return;
    const p = this.player;
    const cost = Math.max(1, Math.round(p.maxHp * 0.1));
    p.devilCost = (p.devilCost || 0) + cost; // 本局生命上限扣减(随 _recalc 生效)
    p.hp = Math.max(1, p.hp - cost);
    this.mods[u.id] = (this.mods[u.id] || 0) + 1;
    if ((this.mods[u.id] || 0) >= u.max) this.stats.maxedCards = this._stat('maxedCards', 0) + 1;
    this._devilMode = false;
    this._devilChoices = [];
    AudioSys.bond();
    this.banner = { text: '😈 契约达成 · ' + u.name, sub: u.desc + ' · 生命上限 -' + cost, life: 2.8, max: 2.8, gold: true };
    this._recalc();
    this._achEvaluate();
    this.state = 'playing';
    this._showState();
  }
  rejectDevil() {
    if (!this._devilMode || this.state !== 'levelup') return;
    this._devilMode = false;
    this._devilChoices = [];
    this.state = 'playing';
    this._showState();
    this._addFloat(new FloatText(this.player.x, this.player.y - 30, '恶魔悻悻离去…', '#b0a0ff', 12));
  }
  /* ---------------- 深空远征:章节结算 ---------------- */
  _campaignClear() {
    const rate = this._campQuota > 0 ? this._campKills / this._campQuota : 1;
    const stars = 1 + (this._campClean ? 1 : 0) + (rate >= 0.65 ? 1 : 0);
    const st = this._campaignLoad();
    const prev = st[this.campaignChapter] || 0;
    const firstClear = prev === 0;
    if (stars > prev) st[this.campaignChapter] = stars;
    this._campaignSave(st);
    this._campaignResult = { stars, rate, firstClear };
    if (firstClear) {
      Shop.addCrystal(200 + this.campaignChapter * 50);
      if (this.campaignChapter >= CAMPAIGN_CHAPTERS && !Shop.owned.voyager) {
        Shop.owned.voyager = true; // 通关最终章赠专属涂装
        Shop.save();
      }
    }
    this._achEvaluate();
    this._gameover();
  }
  /* 恶魔判定(独立方法便于测试注入) */
  _devilRollHit() { return RNG() < 0.35; }
  /* 恶魔契约结算链检查点:升级/遗物链全部结束后,恶魔才现身 */
  _maybeDevil() {
    if (this._devilPending && this.state === 'playing' && this.pendingLevels <= 0
      && !this.pendingRelic && !this._relicMode && !this._augMode && this.player.alive) {
      this._devilPending = false;
      this._openDevilOffer();
    }
  }
  _renderDevils() {
    const row = this._dom.cardRow;
    row.innerHTML = '';
    this._dom.lvTitle.textContent = '😈 恶魔契约';
    const cost = Math.max(1, Math.round(this.player.maxHp * 0.1));
    this._dom.lvSub.innerHTML = '<b style="color:#ff6ad5">献祭 ' + cost + ' 点生命上限</b> · 换取一项史诗强化(按 1 / 2 / 3,或 4 拒绝)';
    this._devilChoices.forEach((u, i) => {
      const el = document.createElement('button');
      el.className = 'card devil';
      el.innerHTML =
        '<div class="card-rar" style="color:#c86bff">😈 恶魔的馈赠</div>' +
        '<div class="card-icon">' + u.icon + '</div>' +
        '<div class="card-name">' + u.name + '</div>' +
        '<div class="card-desc">' + u.desc + '</div>' +
        '<div class="card-lv">' + (u.max > 1 ? 'Lv ' + (this.mods[u.id] || 0) + ' → ' + ((this.mods[u.id] || 0) + 1) : '被动生效') + ' · 按 ' + (i + 1) + '</div>';
      el.addEventListener('click', () => this.chooseDevil(i));
      row.appendChild(el);
    });
    const skip = document.createElement('button');
    skip.className = 'menu-btn';
    skip.style.cssText = 'width:auto;padding:8px 22px;font-size:13px;flex-basis:100%;text-align:center;margin-top:10px';
    skip.innerHTML = '▸ 拒绝契约(保留生命上限,按 4)';
    skip.addEventListener('click', () => this.rejectDevil());
    row.appendChild(skip);
    this._dom.ownRow.innerHTML = '<span class="chip devil-chip">😈 代价:本局生命上限 -' + cost + '(当前生命同步扣减,至少保留 1)</span>';
  }

  /* 取消替换:回到三选一界面 */
  cancelSwap() {
    if (this.state !== 'levelup' || !this._pendingSwap) return;
    this._pendingSwap = null;
    this._swapList = null;
    this._renderCards();
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
    this._maybeDevil();
  }

  /* 满槽替换界面:展示已持有模块,点击丢弃 */

  chooseCard(i) {
    if (this.state !== 'levelup' || this._pendingSwap) return;
    const u = this._cardChoices[i];
    if (!u) return;
    if (u.isEvo) {
      // 传说进化:满级卡片质变,不占槽位
      this.evo[u.base] = true;
      this.stats.evoCount = this._stat('evoCount', 0) + 1;
      this.runEvoCount = (this.runEvoCount || 0) + 1;
      if (this.runEvoCount >= 3) Ach.unlock('evo_3', this);
      if (this.runEvoCount >= 5) Ach.unlock('evo_5', this);
      if (this.runEvoCount >= 8) Ach.unlock('evo_8', this);
      AudioSys.bond();
      this.banner = { text: '✦ 进化 · ' + u.name, sub: u.desc, life: 3.0, max: 3.0, gold: true };
      this._recalc();
      this.pendingLevels--;
      if (this.pendingLevels > 0) {
        this._cardChoices = this._drawChoices();
        this._renderCards();
      } else {
        this.state = 'playing';
        this._showState();
      }
      return;
    }
    if (u.id === 'slotplus') {
      // 隐藏卡:直接扩充槽位,不占用槽位
      this.mods[u.id] = (this.mods[u.id] || 0) + 1;
    } else if (this.mods[u.id]) {
      // 已持有:叠加层数,不占用新槽位
      this.mods[u.id]++;
    } else if (this._ownedIds().length < this.maxSlots) {
      // 新卡且有空闲槽位
      this.mods[u.id] = 1;
    } else {
      // 槽位已满:进入替换模式,先选择要丢弃的模块
      this._pendingSwap = u;
      this._swapList = this._ownedIds();
      this._renderSwap();
      AudioSys.cardPick();
      return;
    }
    this._finishPick(u);
  }

  /* 仅丢弃:不装备新卡,腾出槽位后回到三选一 */
  discardOnly(oldId) {
    if (this.state !== 'levelup' || !this._pendingSwap || !this._swapList.includes(oldId)) return;
    delete this.mods[oldId];
    this._pendingSwap = null;
    this._swapList = null;
    const { lost } = this._recalcBonds();
    for (const b of lost) {
      const cfg = BONDS.find(x => x.id === b);
      this.banner = { text: '羁绊瓦解 · ' + cfg.name, sub: '条件不再满足', life: 2.2, max: 2.2, red: true };
      AudioSys.shieldBreak();
    }
    this._recalc();
    this._renderCards();   // 空出一格槽位,回到三选一(可再选新卡或跳过)
  }

  /* 满槽替换:丢弃 oldId 后装备待选卡 */
  swapPick(oldId) {
    if (this.state !== 'levelup' || !this._pendingSwap) return;
    if (!this._swapList.includes(oldId)) return;
    delete this.mods[oldId];
    const u = this._pendingSwap;
    this._pendingSwap = null;
    this._swapList = null;
    this.mods[u.id] = 1;
    this._finishPick(u);
  }

  _finishPick(u) {
    AudioSys.cardPick();
    const { gained, lost } = this._recalcBonds();
    if (gained.length) this.stats.bondCount = this._stat('bondCount', 0) + gained.length;
    for (const b of gained) {
      const cfg = BONDS.find(x => x.id === b);
      this.banner = { text: '羁绊觉醒 · ' + cfg.name, sub: cfg.desc, life: 2.6, max: 2.6, gold: true };
      AudioSys.bond();
      if (this.bonds.length >= 3) Ach.unlock('bond_3', this);
      if (this.bonds.length >= 5) Ach.unlock('bond_5', this);
      if (this.bonds.length >= 8) Ach.unlock('bond_8', this);
    }
    for (const b of lost) {
      const cfg = BONDS.find(x => x.id === b);
      this.banner = { text: '羁绊瓦解 · ' + cfg.name, sub: '条件不再满足', life: 2.2, max: 2.2, red: true };
      AudioSys.shieldBreak();
    }
    this._recalc();
    if (u.id === 'vitality') this.player.hp = Math.min(this.player.maxHp, this.player.hp + 25);
    if ((this.mods[u.id] || 0) >= u.max) this.stats.maxedCards = this._stat('maxedCards', 0) + 1;
    // 满级大师:3 张卡升至满级
    const maxedCount = UPGRADES.filter(x => (this.mods[x.id] || 0) >= x.max && !x.hidden).length;
    this._achEvaluate();
    if (maxedCount >= 3) Ach.unlock('maxed_3', this);
    if (maxedCount >= 6) Ach.unlock('maxed_6', this);
    if (this.maxSlots >= 9) Ach.unlock('slot_9', this);
    this.pendingLevels--;
    if (this.pendingLevels > 0) {
      this._cardChoices = this._drawChoices();
      // 升级链中途卡池耗尽兜底:剩余等级转化为奖励分
      if (this._cardChoices.length === 0) {
        const bonus = 500 * this.pendingLevels;
        this.score += bonus;
        this._addFloat(new FloatText(this.player.x, this.player.y - 30, '全模块满级 +' + bonus, '#ffd166', 14));
        this.pendingLevels = 0;
      }
      this._renderCards();
    }
    if (this.pendingLevels <= 0) {
      this._pendingSwap = null;
      this._swapList = null;
      this.state = 'playing';
      this._showState();
      // 升级链结束:若旗舰遗落遗物,弹出三选一
      if (this.pendingRelic && this.state === 'playing' && this.player.alive) {
        this.pendingRelic = false;
        this._openRelicChoice();
      }
      this._maybeDevil();
    }
  }

  /* ---------------- 波次导演 ---------------- */

  /* ---------------- 主更新 ---------------- */
  update(dt) {
    this.stars.update(dt, this.state === 'playing' ? 1 : 0.35);
    this._decayFx(dt);
    if (this.state !== 'playing') return;
    this._maybeDevil(); // 恶魔契约:升级/遗物链结算干净后,下一帧自动现身

    this.waveTime += dt;
    for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
      const s = this.spawnQueue[i];
      if (s.t <= this.waveTime) {
        if (s.boss) {
          this.boss = new Boss(s.vw || (this.mode === 'boss' ? this.wave * 5 : this.wave), s.variant);
          // BOSS 演出:登场瞬间全场敌弹转化为星晶(1★/5 弹折算,Phase 4.2)
          const n2 = this.enemyBullets.length;
          if (n2 > 0) {
            for (const b2 of this.enemyBullets) this._sparks(b2.x, b2.y, '#ffd166', 1);
            const stars = Math.floor(n2 / 5);
            this.enemyBullets.length = 0;
            if (stars > 0) {
              Shop.addCrystal(stars, this);
              this._addFloat(new FloatText(W / 2, 168, '✦ 清场折算 +' + stars + '★', '#ffd166', 13));
            }
          }
        }
        else if (s.asteroid) this.asteroids.push(new Asteroid(s.x, -30, s.r));
        else if (s.supply) this.supplies.push(new SupplyDrop(s.x, SUPPLY_LOOT[irand(0, SUPPLY_LOOT.length - 1)]));
        else {
          this.enemies.push(new Enemy(s.type, s.x, this.wave, s.elite, this._env));
          if (s.elite) AudioSys.elite();
        }
        this.spawnQueue.splice(i, 1);
      }
    }

    if (this.player.alive) this.player.update(dt, this);
    if (!this.player.alive || !this.player.beamOn) { this.beams = null; this.player.beamOn = false; }

    for (let i = this.playerBullets.length - 1; i >= 0; i--) {
      const b = this.playerBullets[i];
      // 散射弹丸射程衰减
      if (b.life !== undefined) {
        b.life -= dt;
        if (b.life <= 0) { this.playerBullets.splice(i, 1); continue; }
      }
      // 回旋刃:去程减速,时机到折返追手,回到手中消失(不受出界清除)
      if (b.boom) {
        b.age += dt;
        b.spin += dt * 22;
        if (!b.ret) {
          const dec = Math.exp(-1.9 * dt);
          b.vx *= dec; b.vy *= dec;
          b.boomT -= dt;
          if (b.boomT <= 0) { b.ret = true; b.lastHit = null; }
        } else {
          const dx = this.player.x - b.x, dy = (this.player.y - 6) - b.y;
          const d = Math.hypot(dx, dy) || 1;
          const sp = 640, f = Math.min(1, 10 * dt);
          b.vx += (dx / d * sp - b.vx) * f;
          b.vy += (dy / d * sp - b.vy) * f;
          if (d < 20 && b.age > 0.2) b.dead = true;
        }
      }
      if (b.homing) {
        b.life -= dt;
        if (b.life <= 0) { this.playerBullets.splice(i, 1); continue; }
        // 寻的:飞向最近目标
        let tx = null, ty = 0, best = 1e9;
        for (const e of this.enemies) {
          const d = (e.x - b.x) * (e.x - b.x) + (e.y - b.y) * (e.y - b.y);
          if (d < best) { best = d; tx = e.x; ty = e.y; }
        }
        if (this.boss && this.boss.state === 'fight') {
          const d = (this.boss.x - b.x) * (this.boss.x - b.x) + (this.boss.y - b.y) * (this.boss.y - b.y);
          if (d < best) { best = d; tx = this.boss.x; ty = this.boss.y; }
        }
        if (tx !== null) {
          const want = Math.atan2(ty - b.y, tx - b.x);
          const cur = Math.atan2(b.vy, b.vx);
          let diff = want - cur;
          while (diff > Math.PI) diff -= TAU;
          while (diff < -Math.PI) diff += TAU;
          const na = cur + clamp(diff, -4.2 * dt, 4.2 * dt);
          b.vx = Math.cos(na) * 400; b.vy = Math.sin(na) * 400;
        }
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.dead || (!b.boom && (b.y < -20 || b.x < -20 || b.x > W + 20 || b.y > H + 20))) this.playerBullets.splice(i, 1);
    }
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      // 时间冻结:波首静止弹幕
      if (this.bulletFreezeT > 0) continue;
      // 时滞力场 + 寒霜
      const sdt = dt * this.bulletSlow * (this.buffs.frost > 0 ? 0.4 : 1);
      b.x += b.vx * sdt; b.y += b.vy * sdt;
      if (b.dead || b.y > H + 20 || b.y < -30 || b.x < -20 || b.x > W + 20) this.enemyBullets.splice(i, 1);
    }
    this._updateArr(this.enemies, dt);
    this._updateArr(this.asteroids, dt);
    this._updateArr(this.supplies, dt);
    this._updateArr(this.powerups, dt);
    this._updateArr(this.orbs, dt);
    this._updateArr(this.rifts, dt);
    if (this.wingmen.length) {
      this.player.wingAngle += dt * 2.2;
      for (const w of this.wingmen) w.update(dt, this);
    }
    // 空间裂隙:周期生成黑洞
    if (this.mods.rift) {
      this.riftCd -= dt;
      if (this.riftCd <= 0) {
        this.riftCd = 9 - 0.6 * this.mods.rift - (this.evo.rift ? 2 : 0);
        this.rifts.push(new Rift(rand(70, W - 70), rand(130, 320), this));
        AudioSys.rift();
      }
    }
    // 海克斯强化周期效果:天降彗星 / 磁暴线圈 / 弹药库
    const A2 = this.augments || {};
    if (A2.a_comet) {
      this._cometT -= dt;
      if (this._cometT <= 0) {
        this._cometT = 9;
        const live = this.enemies.filter(e => !e.dead && e.y > 0);
        const t = live.length ? live[Math.floor(RNG() * live.length)] : (this.boss && this.boss.state === 'fight' ? this.boss : null);
        if (t) {
          const tx = t.x, ty = t.y;
          this._explode(tx, ty, 24, '#9fdcff', 1.3);
          for (const e of this.enemies) {
            if (e.dead) continue;
            const ddx = e.x - tx, ddy = e.y - ty;
            if (ddx * ddx + ddy * ddy < 80 * 80) e.damage(60, this, true);
          }
          if (this.boss && this.boss.state === 'fight' && Math.hypot(this.boss.x - tx, this.boss.y - ty) < 80 + this.boss.r) this.boss.damage(60, this, true);
          if (this.boss && this.boss.pods)
            for (const pod of this.boss.pods)
              if (!pod.dead && Math.hypot(pod.x - tx, pod.y - ty) < 100) this.boss.hitPod(pod, 30, this);
          this.shake(8, 0.3);
          AudioSys.bomb();
        }
      }
    }
    if (A2.a_coil) {
      this._coilT -= dt;
      if (this._coilT <= 0) {
        this._coilT = 5;
        let cleared = 0;
        for (const b of this.enemyBullets) {
          const ddx = b.x - this.player.x, ddy = b.y - this.player.y;
          if (ddx * ddx + ddy * ddy < 110 * 110) { b.dead = true; cleared++; }
        }
        if (cleared) {
          this.enemyBullets = this.enemyBullets.filter(b => !b.dead);
          this._sparks(this.player.x, this.player.y, '#aef0ff', 10);
          this.rings.push(new Ring(this.player.x, this.player.y, '#aef0ff', 110, 0.4));
          AudioSys.web();
        }
      }
    }
    if (A2.a_ammo) {
      this._ammoT -= dt;
      if (this._ammoT <= 0) {
        this._ammoT = 25;
        if (this.player.bombs < this.bombCap()) {
          this.player.bombs++;
          this._addFloat(new FloatText(this.player.x, this.player.y - 40, '弹药库 +1', '#51e08a', 12));
        }
      }
    }
    if (this.boss) {
      this.boss.update(dt, this);
      if (this.boss.dead) this.boss = null;
    }
    this._updateArr(this.particles, dt);
    this._updateArr(this.rings, dt);
    this._updateArr(this.floats, dt);

    if (this.combo > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }

    this._collide();

    // 波次推进:配额达成 + 出怪完毕且场上无敌人
    const quotaMet = this.waveKills >= this.waveQuota;
    if (this.spawnQueue.length === 0 && this.enemies.length === 0 && !this.boss) {
      if (!quotaMet) {
        // 配额未达成:持续派出增援,躲避无法过关
        this.trickleT -= dt;
        if (this.trickleT <= 0) {
          this.trickleT = Math.max(0.7, 1.6 - this.wave * 0.06);
          const roll = RNG();
          const type = this.wave >= 3 && roll < 0.13 ? 'tank'
            : this.wave >= 4 && roll < 0.24 ? 'bomber'
            : this.wave >= 5 && roll < 0.32 ? 'shielder'
            : this.wave >= 8 && roll < 0.41 ? 'mender'
            : this.wave >= 7 && roll < 0.48 ? 'jammer'
            : this.wave >= 2 && roll < 0.66 ? 'waver'
            : this.wave >= 4 && roll < 0.81 ? 'sniper' : 'drone';
          this.enemies.push(new Enemy(type, rand(60, W - 60), this.wave, null, this._env));
        }
      } else if (this.waveClearT < 0) {
        this.waveClearT = 1.6;
        const bonus = 200 + this.wave * 100;
        this.score += bonus;
        if (this.player.alive) this.player.hp = Math.min(this.player.maxHp, this.player.hp + 5 + (this.evo.vitality ? 15 : 0) + (this.evo.regen ? 10 : 0));
        // 完美波次:本波未受任何实际伤害
        if (this.waveDamageTaken === 0 && this.wave > 1) {
          this.perfectStreak++;
          Ach.unlock('perfect_wave', this);
          if (this.perfectStreak >= 3) Ach.unlock('perfect_3', this);
        } else this.perfectStreak = 0;
        this.banner = { text: 'WAVE CLEAR', sub: '奖励 +' + bonus, life: 1.6, max: 1.6, red: false };
        AudioSys.waveStart();
      } else {
        this.waveClearT -= dt;
        if (this.waveClearT <= 0) this.startWave(this.wave + 1);
      }
    }

    // 玩家阵亡 → 延迟结算
    if (!this.player.alive) {
      if (this.deathT < 0) this.deathT = 1.6;
      this.deathT -= dt;
      if (this.deathT <= 0) this._gameover();
    }
  }

  _updateArr(arr, dt) {
    for (let i = arr.length - 1; i >= 0; i--) {
      arr[i].update(dt, this);
      if (arr[i].dead) arr.splice(i, 1);
    }
  }

  /* ---------------- 碰撞 ---------------- */
  _collide() {
    const p = this.player;
    // 玩家子弹 → 敌机 / BOSS
    for (const b of this.playerBullets) {
      if (b.dead) continue;
      for (const e of this.enemies) {
        if (e.dead || e === b.lastHit) continue;
        const dx = b.x - e.x, dy = b.y - e.y;
        const rr = e.r + b.r;
        if (dx * dx + dy * dy < rr * rr) {
          // 护盾兵正面护盾:仅格挡来自下半球的弹道(绕至上方攻击可破盾)
          if (e.type === 'shielder' && e.shieldOff <= 0) {
            const ang = Math.atan2(b.y - e.y, b.x - e.x);
            if (ang > Math.PI * 0.2 && ang < Math.PI * 0.8) {
              b.dead = true;
              this._sparks(b.x, b.y, '#5ad0ff', 3);
              AudioSys.hit();
              break;
            }
          }
          this._hitTarget(b, e);
          break;
        }
      }
      if (!b.dead && this.boss && !this.boss.dead && this.boss.state === 'fight' && this.boss !== b.lastHit) {
        const bo = this.boss;
        let podHit = false;
        // 要塞炮塔:优先于舰体判定
        if (bo.pods) {
          for (const pod of bo.pods) {
            if (pod.dead) continue;
            const px = bo.x + pod.ox, py = bo.y + pod.oy;
            const ddx = b.x - px, ddy = b.y - py;
            const rr = pod.r + b.r;
            if (ddx * ddx + ddy * ddy < rr * rr) {
              bo.hitPod(pod, b.dmg, this);
              b.dead = true;
              this._sparks(b.x, b.y, '#ffb14d', 4);
              AudioSys.hit();
              podHit = true;
              break;
            }
          }
        }
        if (!podHit) {
          const dx = b.x - bo.x, dy = b.y - bo.y;
          const rr = bo.r + b.r;
          if (dx * dx + dy * dy < rr * rr) this._hitTarget(b, bo);
        }
      }
      // 陨石吸收玩家弹幕
      if (!b.dead) {
        for (const a of this.asteroids) {
          if (a.dead) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const rr = a.r + b.r;
          if (dx * dx + dy * dy < rr * rr) {
            b.dead = true;
            a.damage(b.dmg, this);
            this._sparks(b.x, b.y, '#8a7f68', 2);
            break;
          }
        }
      }
    }
    if (!p.alive) return;
    // 敌弹 → 玩家
    if (p.invuln <= 0) {
      for (const b of this.enemyBullets) {
        if (b.dead) continue;
        const dx = b.x - p.x, dy = b.y - p.y;
        const rr = p.r + b.r;
        if (dx * dx + dy * dy < rr * rr) {
          b.dead = true;
          this._playerHit(b.dmg || 25);
          break;
        }
      }
      // 敌机冲撞 → 玩家(接触伤害随波次小幅增长,封顶 65;高难额外 +10)
      if (p.alive && p.invuln <= 0) {
        const contactDmg = Math.min(65, 35 + Math.floor(Math.max(0, this.wave - 1) * 0.8) + (this.hard ? 10 : 0));
        for (const e of this.enemies) {
          if (e.dead) continue;
          const dx = e.x - p.x, dy = e.y - p.y;
          const rr = e.r + p.r;
          if (dx * dx + dy * dy < rr * rr) {
            e.damage(this.relics.r_thorn_crown ? 6 : 3, this);
            // 吸血词缀:接触玩家时大量回复自身生命
            if (e.elite && e.elite.includes('vampiric') && !e.dead) {
              e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.2);
              this._addFloat(new FloatText(e.x, e.y - e.r - 18, '汲取!', '#ff77a9', 11));
            }
            this._playerHit(contactDmg);
            break;
          }
        }
        // 陨石撞击
        if (p.alive && p.invuln <= 0) {
          for (const a of this.asteroids) {
            if (a.dead) continue;
            const dx = a.x - p.x, dy = a.y - p.y;
            const rr = a.r + p.r;
            if (dx * dx + dy * dy < rr * rr) {
              a.damage(3, this);
              this._playerHit(35);
              break;
            }
          }
        }
        if (p.alive && p.invuln <= 0 && this.boss && !this.boss.dead && this.boss.state === 'fight') {
          const bo = this.boss;
          const dx = bo.x - p.x, dy = bo.y - p.y;
          const rr = bo.r + p.r;
          if (dx * dx + dy * dy < rr * rr) this._playerHit(35);
        }
      }
    }
    // 道具 → 玩家
    for (const pu of this.powerups) {
      const dx = pu.x - p.x, dy = pu.y - p.y;
      if (dx * dx + dy * dy < 900) {
        pu.dead = true;
        this._applyPower(pu.type);
      }
    }
    // 敌方弹幕被陨石吸收(掩体机制)
    for (const b of this.enemyBullets) {
      if (b.dead) continue;
      for (const a of this.asteroids) {
        if (a.dead) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        if (dx * dx + dy * dy < a.r * a.r) {
          b.dead = true;
          this._sparks(b.x, b.y, '#8a7f68', 2);
          break;
        }
      }
    }
  }

  /* 单发子弹命中结算:暴击 / 贯穿 / 裂变 */
  _hitTarget(b, e) {
    let dmg = b.dmg;
    let cc = 0.1 * (this.mods.crit || 0) + (this.evo.crit ? 0.3 : 0) + (this.relics.r_hunter ? 0.1 : 0)
      + (this.mods.brittle ? 0.3 : 0);
    // 虚空之刃:回旋刃暴击率 ×1.5
    if (b.boom && this.bonds.includes('voidedge')) cc *= 1.5;
    const guaranteed = (b.homing && this.bonds.includes('hunt'))
      || (b.rail && this.bonds.includes('railcrit'));
    const crit = guaranteed || (cc > 0 && RNG() < cc);
    // 无阻贯通:轨道炮伤害随剩余贯穿层叠加
    if (b.rail && this.bonds.includes('railpierce')) dmg += Math.min(20, (b.pierce || 0));
    if (crit) dmg = Math.round(dmg * (this.bonds.includes('execute') ? 4.5 : 3));
    // 处决者:暴击对精英与旗舰额外 +50%
    if (crit && this.evo.crit && (e.elite || e.isBoss)) dmg = Math.round(dmg * 1.5);
    AudioSys.hit();
    this._sparks(b.x, b.y, crit ? '#ffd166' : e.color, crit ? 7 : 4);
    if (crit) {
      this._addFloat(new FloatText(b.x, b.y - 8, '暴击', '#ff5470', 11));
      if (this.bonds.includes('bloodrush') && this.player.alive)
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 2);
    }
    // 裂变弹:命中后分裂出 2 枚小弹(羁绊「弹幕风暴」赋予贯穿)
    if (b.split > 0) {
      for (let i = 0; i < 2; i++) {
        const a = -Math.PI / 2 + (i ? 0.55 : -0.55);
        this.playerBullets.push({
          x: b.x, y: b.y, vx: Math.cos(a) * 330, vy: Math.sin(a) * 330,
          r: 2.2, dmg: Math.max(1, Math.round(b.dmg * 0.4)), color: '#a5ffd6', dead: false,
          pierce: this.bonds.includes('storm') ? 1 : 0, split: (this.evo.split && !b.child) ? 1 : 0, child: true
        });
      }
    }
    // 贯穿:未耗尽穿透数时继续飞行
    if (b.pierce > 0) { b.pierce--; b.lastHit = e; }
    else b.dead = true;
    // 聚变弹头:命中溅射
    if (this.evo.dmg && dmg > 1) {
      const splash = Math.max(1, Math.round(dmg * 0.5));
      for (const o of this.enemies) {
        if (o === e || o.dead) continue;
        const ddx = o.x - e.x, ddy = o.y - e.y;
        if (ddx * ddx + ddy * ddy < 3600) o.damage(splash, this, true);
      }
      if (this.boss && !this.boss.dead && this.boss !== e) {
        const ddx = this.boss.x - e.x, ddy = this.boss.y - e.y;
        if (ddx * ddx + ddy * ddy < 4900) this.boss.damage(splash, this, true);
      }
    }
    // 电弧发生器:命中触发链式闪电
    if (b.tesla) { b.dead = true; this._teslaChain(e, dmg); }
    e.damage(dmg, this);
  }

  /* 链式闪电:从命中点在敌群间跳跃,每跳伤害衰减;雷霆领主/分叉雷电增强 */
  _teslaChain(origin, dmg) {
    const m = this.mods;
    let jumps = 3 + (m.tesla || 1) + (this.evo.tesla ? 3 : 0);
    const fork = this.bonds.includes('teslafork');
    const hit = new Set([origin]);
    let sources = [origin];
    // 链式基础提高到满伤,衰减放缓(0.82→0.9),使电弧多目标总输出与其它质变武器持平
    let chainDmg = Math.max(1, Math.round(dmg * 1.0));
    for (let j = 0; j < jumps; j++) {
      const nextSources = [];
      const perSource = fork ? 2 : 1;
      for (const src of sources) {
        const cands = this.enemies
          .filter(o => !o.dead && !o.elitePhased && !hit.has(o))
          .map(o => ({ o, d: (o.x - src.x) ** 2 + (o.y - src.y) ** 2 }))
          .filter(c => c.d < 22500) // 150px 内可跳
          .sort((a, b) => a.d - b.d)
          .slice(0, perSource);
        for (const c of cands) {
          hit.add(c.o);
          c.o.damage(chainDmg, this, true);
          this.rings.push(new Ring((src.x + c.o.x) / 2, (src.y + c.o.y) / 2, '#aef0ff', 22, 0.18));
          this._sparks(c.o.x, c.o.y, '#cdefff', 3);
          // 雷霆领主:麻痹减速
          if (this.evo.tesla) { c.o.vy *= 0.6; }
          nextSources.push(c.o);
        }
      }
      if (!nextSources.length) break;
      sources = nextSources;
      chainDmg = Math.max(1, Math.round(chainDmg * 0.9));
    }
    if (hit.size > 1) AudioSys.beam();
    if (hit.size > this._stat('bestChain', 0)) this.stats.bestChain = hit.size;
  }

  /* 敌机图鉴:分类型击坠累计,首次收录发放星晶 */
  _bestiaryKill(key) {
    this.stats.best = this.stats.best || {};
    this.stats.best[key] = (this.stats.best[key] || 0) + 1;
    if (!this.stats.bestSeen) this.stats.bestSeen = {};
    if (this.stats.bestSeen[key]) return;
    this.stats.bestSeen[key] = true;
    const info = BESTIARY_INFO[key];
    const reward = info ? info.reward : 5;
    Shop.addCrystal(reward, this);
    if (this.state === 'playing' && this.player.alive)
      this._addFloat(new FloatText(this.player.x, this.player.y - 46, '📖 图鉴新收录 +' + reward + '★', '#ffd166', 12));
    if (Object.keys(this.stats.bestSeen).length >= Object.keys(BESTIARY_INFO).length)
      Ach.unlock('codex_all', this);
    this._achEvaluate();
  }

  /* ---------------- 击杀 / 伤害结算 ---------------- */
  killEnemy(e) {
    this.combo++;
    this.comboT = this.comboWindow;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    // 雪球风暴:击坠时概率引发范围爆震
    if (this.augments && this.augments.a_snow && RNG() < 0.2) {
      this._explode(e.x, e.y, 12, '#cfe8ff', 0.8);
      for (const o of this.enemies) {
        if (o === e || o.dead) continue;
        const ddx = o.x - e.x, ddy = o.y - e.y;
        if (ddx * ddx + ddy * ddy < 60 * 60) o.damage(10, this, true);
      }
    }
    // 击杀汲取
    if (this.player.leechPer > 0 && this.player.alive)
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.leechPer);
    // 连击奖励:每 25 连击掉落一枚随机道具
    if (this.combo > 0 && this.combo % 25 === 0) {
      this._dropPower(this.player.x + rand(-30, 30), this.player.y - 46);
      this._addFloat(new FloatText(this.player.x, this.player.y - 34, '连击奖励!', '#ffd166', 12));
    }
    // 精英击坠:直接获得星晶
    if (e.elite) {
      Shop.addCrystal(2);
      this._addFloat(new FloatText(e.x, e.y - 40, '★+2', '#ffd166', 11));
    }
    // 血月初刃:8% 回血
    if (this.relics.r_bloodmoon && RNG() < 0.08 && this.player.alive) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 8);
      this._addFloat(new FloatText(this.player.x, this.player.y - 26, '血月回血 +8', '#ff77a9', 11));
    }
    // 雷神之锤:15% 引落闪电
    if (this.relics.r_thor && RNG() < 0.15 && this.enemies.length) {
      const targets = this.enemies.filter(x => !x.dead).sort(() => RNG() - 0.5).slice(0, 3);
      for (const t of targets) {
        t.damage(5, this);
        this.rings.push(new Ring(t.x, t.y, '#ffe98a', 30, 0.3));
      }
      AudioSys.beam();
    }
    // 寒霜宝石:25% 概率触发寒霜脉冲(未处于寒霜时)
    if (this.relics.r_frostgem && this.buffs.frost <= 0 && RNG() < 0.25) {
      this.buffs.frost = 1.5;
      this.rings.push(new Ring(e.x, e.y, '#aef0ff', 80, 0.4));
    }
    // 命运骰子:10% 概率掉落随机道具
    if (this.relics.r_dice && RNG() < 0.10) this._dropPower(e.x, e.y);
    if (this.mode === 'campaign') { this._campPrevKills = this.waveKills; this._campPrevQuota = this.waveQuota; }
    this.stats.kills = this._stat('kills', 0) + 1;
    if (this.combo > this._stat('bestCombo', 0)) this.stats.bestCombo = this.combo;
    this._achEvaluate();
    this.waveKills++;
    this.runKills++;
    this._bestiaryKill(e.type);
    // 每日任务进度
    if (typeof DailyTasks !== 'undefined') {
      DailyTasks.bump('kills', 1, this);
      if (e.elite) DailyTasks.bump('elite', 1, this);
      DailyTasks.bump('combo', this.combo, this);
    }
    // 成就
    Ach.unlock('first_kill', this);
    if (this.runKills >= 60) Ach.unlock('run_kill60', this);
    if (this.combo >= 30) Ach.unlock('combo_30', this);
    if (this.combo >= 60) Ach.unlock('combo_60', this);
    if (this.combo >= 15) Ach.unlock('combo_15', this);
    if (this.combo >= 100) Ach.unlock('combo_100', this);
    if (this.combo >= 200) Ach.unlock('combo_200', this);
    if (this.combo >= 300) Ach.unlock('combo_300', this);
    if (this.runKills >= 250) Ach.unlock('run_kill250', this);
    // 累计击杀与单局击杀成就
    const tk = this.stats.kills;
    if (tk >= 100) Ach.unlock('total_100', this);
    if (tk >= 500) Ach.unlock('total_500', this);
    if (tk >= 2000) Ach.unlock('total_2000', this);
    if (tk >= 5000) Ach.unlock('total_5000', this);
    if (tk >= 10000) Ach.unlock('total_10000', this);
    if (this.runKills >= 120) Ach.unlock('run_kill120', this);
    // 双子星杀手:双词缀精英
    if (e.elite && e.elite.length >= 2) this.stats.dualEliteKills = this._stat('dualEliteKills', 0) + 1;
    // 向死而生:濒死状态击坠
    if (this.player.alive && this.player.hp / this.player.maxHp <= 0.1) {
      this.runLowHpKills++;
      if (this.runLowHpKills >= 10) Ach.unlock('lowhp_10', this);
      if (this.runLowHpKills >= 30) Ach.unlock('lowhp_30', this);
    }
    if (e.elite) {
      this.runEliteKills++;
      const totalElite = this._stat('eliteKills', 0) + this.runEliteKills;
      if (totalElite >= 10) Ach.unlock('elite_10', this);
      if (totalElite >= 50) Ach.unlock('elite_50', this);
      if (totalElite >= 200) Ach.unlock('elite_200', this);
      if (this.runEliteKills >= 10) Ach.unlock('run_elite_10', this);
    }
    // 歼灭装填:击坠积累炸弹
    if (this.mods.bombkill) {
      this.bombMeter++;
      let need = Math.max(8, 30 - 5 * this.mods.bombkill);
      if (this.evo.bombkill) need = Math.max(6, need - 5);
      if (this.bombMeter >= need) {
        this.bombMeter = 0;
        if (this.player.bombs < this.bombCap()) {
          this.player.bombs++;
          this._addFloat(new FloatText(this.player.x, this.player.y - 30, '歼灭装填 炸弹+1', '#51e08a', 12));
        }
      }
    }
    const mult = this.multiplier() * (this.buffs.x2 > 0 ? 2 : 1) * (this.mods.pact ? 1 + 0.1 * this.mods.pact : 1);
    const pts = Math.round(e.score * mult);
    this.score += pts;
    this._addFloat(new FloatText(e.x, e.y - 8, '+' + pts, mult > 1 ? '#ffd166' : '#e8f6ff', e.r > 18 ? 16 : 13));
    this._explode(e.x, e.y, e.r, e.color, 1);
    AudioSys.explode(e.r >= 18);
    this.shake(Math.min(9, 1.5 + e.r * 0.18), 0.22);
    // 掉落经验晶体(精英 ×4)
    const xpTable = { drone: 2, waver: 3, sniper: 4, tank: 8, bomber: 3, shielder: 10, mender: 6, jammer: 4 };
    let xp = (xpTable[e.type] || 2) * (e.elite ? 4 : 1) * (this.waveMod && this.waveMod.id === 'bounty' ? 1.5 : 1);
    while (xp > 0) {
      const v = Math.min(4, xp);
      xp -= v;
      this.orbs.push(new XPOrb(e.x + rand(-10, 10), e.y + rand(-10, 10), v));
    }
    if (this.orbs.length > 140) {
      const overflow = this.orbs.splice(0, this.orbs.length - 140);
      for (const o of overflow) this.gainXP(o.v);
    }
    if (e.type === 'tank') this._dropPower(e.x, e.y);
    else if (e.elite) {
      // 精英必掉道具 + 额外奖励分
      this._dropPower(e.x, e.y);
      const bonus = 150 + this.wave * 25;
      this.score += bonus;
      this._addFloat(new FloatText(e.x, e.y - 26, '精英击坠 +' + bonus, e.eliteColor, 13));
    }
    else if (RNG() < (this.waveMod && this.waveMod.id === 'bounty' ? 0.26 : 0.13)) this._dropPower(e.x, e.y);
  }

  killBoss(b) {
    this.combo++;
    this.comboT = this.comboWindow;
    this.stats.bossKills = this._stat('bossKills', 0) + 1;
    this.runBossKills = (this.runBossKills || 0) + 1;
    this.waveKills++;
    this._bestiaryKill('boss_' + b.variant);
    if (typeof DailyTasks !== 'undefined') DailyTasks.bump('boss', 1, this);
    // 旗舰奖励:击毁后获得一次额外升级机会;遗物按模式分发——
    // 连战:每阶段必得遗物三选一(模式核心承诺);其余:5%~10%(随波次)概率掉落未知圣遗物
    this.pendingLevels++;
    if (this.mode === 'boss') {
      this.pendingRelic = true;
    } else if (this._forceRelicDrop || RNG() < 0.05 + Math.min(0.05, this.wave * 0.002)) {
      this._forceRelicDrop = false;
      this.powerups.push(new PowerUp(b.x, b.y - 20, 'relic'));
      this._addFloat(new FloatText(b.x, b.y - 54, '✦ 圣遗物坠落!', '#ffd166', 15));
      AudioSys.record();
    }
    if (this.state === 'playing' && this.player.alive) this.openLevelup();
    Ach.unlock('boss_1', this);
    if (this.stats.bossKills >= 5) Ach.unlock('boss_5', this);
    if (this.stats.bossKills >= 10) Ach.unlock('boss_10', this);
    if (this.stats.bossKills >= 25) Ach.unlock('boss_25', this);
    if (this.stats.bossKills >= 50) Ach.unlock('boss_50', this);
    if (this.stats.bossKills >= 100) Ach.unlock('boss_100', this);
    if (b.variant === 'storm') Ach.unlock('storm_kill', this);
    if (b.variant === 'tyrant') Ach.unlock('tyrant_kill', this);
    if (b.variant === 'dread') Ach.unlock('dread_kill', this);
    // 完胜旗舰:本波(BOSS 波)未受伤击毁(累计计数)
    if (this.waveDamageTaken === 0) this.stats.bossNoHit = this._stat('bossNoHit', 0) + 1;
    const vk = this.stats.variantKills = this.stats.variantKills || {};
    vk[b.variant] = (vk[b.variant] || 0) + 1;
    this._achEvaluate();
    const pts = Math.round(b.score * this.multiplier() * (this.buffs.x2 > 0 ? 2 : 1) * (this.mods.pact ? 1 + 0.1 * this.mods.pact : 1));
    this.score += pts;
    this._addFloat(new FloatText(b.x, b.y, '+' + pts, '#ffd166', 22));
    // 连战模式:击毁旗舰回复 15% 生命,支撑连续作战
    if (this.mode === 'boss' && this.player.alive)
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.round(this.player.maxHp * 0.15));
    for (let i = 0; i < 10; i++)
      this._explode(b.x + rand(-b.r, b.r), b.y + rand(-b.r * 0.6, b.r * 0.6), 14, '#ff8c42', 1.1);
    this._explode(b.x, b.y, 30, '#ffd166', 1.6);
    AudioSys.explode(true);
    this.shake(18, 0.8);
    this.flashT = 0.3; this.flashColor = 'rgba(255,200,120,';
    this.enemyBullets.length = 0;
    this._dropPower(b.x - 40, b.y, 'power');
    this._dropPower(b.x + 40, b.y, 'bomb');
    this._dropPower(b.x, b.y - 20, RNG() < 0.5 ? 'life' : 'shield');
    // 旗舰核心大量经验:环形散落晶体
    for (let i = 0; i < 15; i++) {
      const a = i / 15 * TAU;
      this.orbs.push(new XPOrb(b.x + Math.cos(a) * 40, b.y + Math.sin(a) * 24, 4));
    }
    Shop.addScrap(this.mode === 'boss' ? 2 : 1); // 旗舰残骸(改装件材料)
    // 深空远征:第 5 波旗舰击毁即章节结算
    if (this.mode === 'campaign' && this.wave === 5) {
      this._campKills += this.waveKills;
      this._campQuota += 1; // 旗舰计入 1
      this._campaignClear();
      return;
    }
    // 恶魔契约:无伤击毁旗舰后 35% 概率现身(连战不叠加;待升级/遗物链结束后弹出)
    if (this.mode !== 'boss' && this.waveDamageTaken === 0 && this.player.alive && this._devilRollHit())
      this._devilPending = true;
  }

  _dropPower(x, y, force) {
    let type = force;
    if (!type) {
      const r = RNG();
      type = r < 0.32 ? 'power' : r < 0.54 ? 'shield' : r < 0.74 ? 'bomb' : r < 0.82 ? 'life'
        : r < 0.89 ? 'x2' : r < 0.95 ? 'frenzy' : r < 0.98 ? 'frost' : 'magstorm';
    }
    this.powerups.push(new PowerUp(x, y, type));
  }

  _applyPower(type) {
    const p = this.player;
    AudioSys.powerup();
    if (type === 'power') {
      if (p.weapon < 5) {
        p.weapon++;
        this._addFloat(new FloatText(p.x, p.y - 24, '火力提升!', '#ff5470'));
        if (p.weapon >= 5) Ach.unlock('max_weapon', this);
      } else {
        this.score += 300;
        this._addFloat(new FloatText(p.x, p.y - 24, '+300', '#ffd166'));
      }
    } else if (type === 'shield') {
      p.shield = true;
      this._addFloat(new FloatText(p.x, p.y - 24, '护盾展开!', '#4db8ff'));
    } else if (type === 'bomb') {
      if (p.bombs < this.bombCap()) {
        p.bombs++;
        this._addFloat(new FloatText(p.x, p.y - 24, '炸弹 +1', '#51e08a'));
      } else {
        this.score += 300;
        this._addFloat(new FloatText(p.x, p.y - 24, '+300', '#ffd166'));
      }
    } else if (type === 'life') {
      const heal = Math.min(40, p.maxHp - p.hp);
      p.hp += heal;
      if (heal > 0) this._addFloat(new FloatText(p.x, p.y - 24, '生命 +' + Math.round(heal), '#ff77a9'));
      else {
        this.score += 300;
        this._addFloat(new FloatText(p.x, p.y - 24, '+300', '#ffd166'));
      }
    } else if (type === 'relic') {
      // 圣遗物:随机授予一件未拥有遗物,伴随闪光动画与横幅播报;已集齐则转化为高额奖励分
      const avail = RELICS.filter(r0 => !this.relics[r0.id]);
      if (!avail.length) {
        this.score += 1000;
        this._addFloat(new FloatText(p.x, p.y - 24, '遗物已集齐 +1000', '#ffd166', 13));
      } else {
        const r0 = avail[Math.floor(RNG() * avail.length)];
        this.relics[r0.id] = true;
        this.stats.relicsGot = this._stat('relicsGot', 0) + 1;
        this.rings.push(new Ring(p.x, p.y, '#ffd166', 220, 0.9));
        this.rings.push(new Ring(p.x, p.y, '#fff6cf', 150, 0.6));
        this.rings.push(new Ring(p.x, p.y, '#ffd166', 90, 0.45));
        for (let i = 0; i < 26; i++) {
          const a = rand(0, TAU);
          this._sparks(p.x + Math.cos(a) * 14, p.y + Math.sin(a) * 14, '#ffe98a', 2);
        }
        this.flashT = 0.25; this.flashColor = 'rgba(255,220,130,';
        this.shake(6, 0.3);
        this.banner = { text: '✦ 圣遗物 · ' + r0.name, sub: r0.desc, life: 2.8, max: 2.8, gold: true };
        AudioSys.record();
        this._recalc();
        if (r0.id === 'r_belt') this.player.hp = this.player.maxHp;
      }
    } else if (type === 'x2') {
      this.buffs.x2 = 10;
      this._addFloat(new FloatText(p.x, p.y - 24, '×2 双倍得分!', '#ffd166'));
    } else if (type === 'frenzy') {
      this.buffs.frenzy = 10;
      this._addFloat(new FloatText(p.x, p.y - 24, '狂热!', '#ff9a3c'));
    } else if (type === 'frost') {
      this.buffs.frost = 5;
      this._addFloat(new FloatText(p.x, p.y - 24, '寒霜!', '#aef0ff'));
    } else if (type === 'magstorm') {
      // 全场吸取:晶体/道具/空投立刻飞向玩家
      for (const o of this.orbs) o.vac = true;
      for (const pu of this.powerups) pu.vac = true;
      for (const su of this.supplies) su.vac = true;
      this._addFloat(new FloatText(p.x, p.y - 24, '磁力风暴!', '#c86bff'));
      AudioSys.rift();
    }
  }

  /* 受击结算:数值伤害(dmg 由伤害来源指定),装甲减免,不屈兜底 */
  _playerHit(dmg = 25) {
    const p = this.player;
    if (p.invuln > 0 || !p.alive) return;
    // 凝滞词缀:场上存在凝滞精英时,受击后移动迟缓(护盾破碎同样触发)
    if (this.enemies.some(e => e.elite && e.elite.includes('chill') && !e.dead)) p.chillT = 2;
    // 「弹幕幽灵」:受到的所有伤害 -40%;「相位疾行」:受击后额外无敌与短暂加速
    if (this.augments && this.augments.a_ghost) dmg *= 0.6;
    if (this.augments && this.augments.a_phase) { p.invuln += 0.6; p._phaseT = 2; }
    if (p.shield) {
      p.shield = false;
      p.invuln = 1.2 + (this.relics.r_cloak ? 0.7 : 0);
      if (this.mods.shieldgen) p.shieldCd = p.shieldInterval; // 重启护盾充能
      // 圣盾爆发:护盾破碎时清屏+重创
      if (this.evo.shieldgen) {
        this.enemyBullets.length = 0;
        for (const e of this.enemies) e.damage(12, this);
        this.rings.push(new Ring(p.x, p.y, '#ffd166', 240, 0.6));
        this.shake(10, 0.4);
        AudioSys.bomb();
      }
      if (this.bonds.includes('symbiosis') && this.mods.regen) {
        p.hp = Math.min(p.maxHp, p.hp + 15);
        this._addFloat(new FloatText(p.x, p.y - 26, '生机涌动 +15', '#51e08a', 12));
      }
      AudioSys.shieldBreak();
      this.shake(7, 0.3);
      this.rings.push(new Ring(p.x, p.y, '#4db8ff', 60, 0.4));
      this._thornBlast();
      return;
    }
    const brittleTaken = this.mods.brittle ? 1 + (this.evo.brittle ? 0.05 : 0.10) * this.mods.brittle : 1;
    if (this.mode === 'campaign' && !p.shield) this._campClean = false; // 三星:无伤条件(护盾抵挡不算破金身)
    const real = Math.max(1, Math.round(dmg * (1 - p.armorPct) * brittleTaken));
    if (this.tuningLv('armorT') >= 3 && p.hp < p.maxHp) { // 装甲改装 III:受击回复
      p.hp = Math.min(p.maxHp, p.hp + 3);
      this._addFloat(new FloatText(p.x, p.y - 20, '+3', '#51e08a', 11));
    }
    p.hp -= real;
    this.waveDamageTaken++;
    this.combo = 0;
    AudioSys.playerHit();
    this.shake(14, 0.5);
    this.flashT = 0.35; this.flashColor = 'rgba(255,70,90,';
    this._explode(p.x, p.y, 16, '#7ef3ff', 1.4);
    this._thornBlast();
    if (p.hp <= 0) {
      // 不死鸟羽:每局一次,致死伤害时以 30% 生命浴火重生
      if (this.relics.r_phoenix && !this._phoenixUsed) {
        this._phoenixUsed = true;
        p.hp = Math.max(1, Math.round(p.maxHp * 0.3));
        p.invuln = 2.0;
        this.enemyBullets.length = 0;
        this.rings.push(new Ring(p.x, p.y, '#ff9a3c', 240, 0.7));
        this._addFloat(new FloatText(p.x, p.y - 30, '🪶 浴火重生!', '#ff9a3c', 16));
        AudioSys.record();
        return;
      }
      // 不屈意志:每局一次,保留 1 点生命并清除全屏弹幕
      if (this.mods.undying && (p.undyingCount || 0) < (this.evo.undying ? 2 : 1)) {
        p.undyingCount = (p.undyingCount || 0) + 1;
        p.hp = Math.max(1, Math.round(p.maxHp * 0.02 * this.mods.undying));
        p.invuln = 2.5 + (this.evo.undying ? 1 : 0);
        this.enemyBullets.length = 0;
        this._addFloat(new FloatText(p.x, p.y - 30, '🕊 不屈意志!', '#ffd166', 16));
        AudioSys.record();
        this.rings.push(new Ring(p.x, p.y, '#ffd166', 240, 0.6));
        return;
      }
      p.hp = 0;
      p.alive = false;
      this._explode(p.x, p.y, 26, '#7ef3ff', 2);
      this.shake(20, 0.8);
    } else {
      p.invuln = 1.5 + (this.relics.r_cloak ? 0.7 : 0);
      if (this.bonds.includes('ironwill')) {
        p.hp = Math.min(p.maxHp, p.hp + 5);
        this._addFloat(new FloatText(p.x, p.y - 26, '荆棘装甲 +5', '#a5ffd6', 11));
      }
    }
  }

  /* 反击风暴:受击时清除周围弹幕并放出冲击波 */
  _thornBlast() {
    if (!this.mods.thorn || !this.player.alive) return;
    const p = this.player;
    const R = 100 + 12 * this.mods.thorn + (this.evo.thorn ? 60 : 0);
    const thornDmg = (2 + 2 * this.mods.thorn) * (this.evo.thorn ? 2 : 1);
    for (const b of this.enemyBullets) {
      const dx = b.x - p.x, dy = b.y - p.y;
      if (dx * dx + dy * dy < R * R) {
        this._sparks(b.x, b.y, '#a5ffd6', 2);
        b.dead = true;
      }
    }
    for (const e of this.enemies) {
      const dx = e.x - p.x, dy = e.y - p.y;
      if (dx * dx + dy * dy < R * R) e.damage(thornDmg, this);
    }
    this.rings.push(new Ring(p.x, p.y, '#a5ffd6', R, 0.45));
    AudioSys.web();
  }

  /* ---------------- 炸弹 ---------------- */
  /* 炸弹携带上限:龙魂遗物 +2、「弹药库」海克斯强化 +2 */
  bombCap() { return (this.relics.r_dragon ? 7 : 5) + ((this.augments && this.augments.a_ammo) ? 2 : 0) + Math.floor(boostLevel('cap0') / 2); }
  /* 改装件等级(局外持久,改装工坊) */
  tuningLv(id) { return (typeof Shop !== 'undefined' && Shop.tuningLv(id)) || 0; }

  tryBomb() {
    if (this.state !== 'playing' || !this.player.alive) return;
    const p = this.player;
    if (p.bombs <= 0 || this.bombActive) return;
    p.bombs--;
    this.runBombsUsed = (this.runBombsUsed || 0) + 1;
    this.stats.bombsUsed = this._stat('bombsUsed', 0) + 1;
    if (this.stats.bombsUsed >= 50) Ach.unlock('bomb_50', this);
    if (this.stats.bombsUsed >= 200) Ach.unlock('bomb_200', this);
    this.bombActive = true;
    this.bombT = 0.9;
    AudioSys.bomb();
    this.flashT = 0.4; this.flashColor = 'rgba(170,240,255,';
    this.shake(16, 0.7);
    p.invuln = Math.max(p.invuln, 1.2); // 炸弹瞬间无敌,可作保命键
    for (const b of this.enemyBullets) this._sparks(b.x, b.y, '#9fe8ff', 3);
    this.enemyBullets.length = 0;
    const nuke = this.augments && this.augments.a_nuke;
    const bombDmg = (this.relics.r_dragon ? 23 : 8) * (nuke ? 4 : 1) + (this.tuningLv('sideT') >= 2 ? 4 : 0);
    for (const e of this.enemies) e.damage(bombDmg, this);
    for (const a of this.asteroids) a.damage(6, this);
    if (this.boss) {
      this.boss.damage(this.relics.r_dragon ? 35 : 20, this);
      if (this.boss.pods)
        for (const pod of this.boss.pods)
          if (!pod.dead) this.boss.hitPod(pod, this.relics.r_dragon ? 12 : 5, this);
    }
    this.rings.push(new Ring(p.x, p.y, '#aef3ff', nuke ? 480 : 300, 0.7));
  }

  /* ---------------- 子弹发射 ---------------- */
  /* 敌方弹幕伤害:随波次与威胁等级增长(后期弹幕更疼)。
   * 基础 22,每波 +0.7(封顶 +18),威胁每级 +2;橙色狙击弹额外 +15%。
   * 连战模式按虚拟波号(阶段 ×5)成长,与旗舰强度同步。 */
  enemyDmg(kind) {
    const w = this.mode === 'boss' ? this.wave * 5 : this.wave;
    const base = 22 + Math.min(18, (w - 1) * 0.7) + this.threatLevel() * 2 + (this.hard ? 5 : 0);
    return Math.round(base * (kind === 'orange' ? 1.15 : 1));
  }

  enemyShot(x, y, angle, speed, kind = 'pink') {
    if (this.enemyBullets.length > 240) return;
    const cfg = kind === 'orange'
      ? { color: '#ffb066', glow: 'rgba(255,140,60,0.35)' }
      : { color: '#ff8fd0', glow: 'rgba(255,70,160,0.32)' };
    this.enemyBullets.push({
      x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      r: 4, color: cfg.color, glow: cfg.glow, dead: false, dmg: this.enemyDmg(kind)
    });
  }

  aimedAngle(x, y) {
    const p = this.player;
    return Math.atan2(p.y - y, p.x - x);
  }

  /* ---------------- 特效 ---------------- */
  shake(mag, dur) {
    this.shakeMag = mag; this.shakeDur = dur; this.shakeT = dur;
  }

  // 容量保护:极端场面下粒子/飘字不无限膨胀
  _addParticle(p) { if (this.particles.length < 500) this.particles.push(p); }
  _addFloat(f) { if (this.floats.length < 60) this.floats.push(f); }

  _sparks(x, y, color, n = 6) {
    for (let i = 0; i < n; i++) {
      const a = crand(0, TAU), sp = crand(60, 220);
      this._addParticle(new Particle(x, y, Math.cos(a) * sp, Math.sin(a) * sp, crand(0.15, 0.35), crand(1.5, 3), color));
    }
  }

  _explode(x, y, r, color, scale = 1) {
    const n = Math.round((10 + r) * scale);
    for (let i = 0; i < n; i++) {
      const a = crand(0, TAU), sp = crand(30, 260) * scale;
      const c = Math.random() < 0.5 ? color : (Math.random() < 0.5 ? '#ffd166' : '#ff8c42');
      this._addParticle(new Particle(x, y, Math.cos(a) * sp, Math.sin(a) * sp, crand(0.3, 0.8) * scale, crand(1.5, 4) * scale, c));
    }
    this.rings.push(new Ring(x, y, color, (r + 20) * scale, 0.4));
  }

  _decayFx(dt) {
    if (this.shakeT > 0) this.shakeT -= dt;
    if (this.flashT > 0) this.flashT -= dt;
    if (this.bombActive) {
      this.bombT -= dt;
      if (this.bombT <= 0) this.bombActive = false;
    }
    if (this.bulletFreezeT > 0) this.bulletFreezeT -= dt;
    if (this.levelupCooldown > 0) this.levelupCooldown -= dt;
    if (this.banner) this.banner.life -= dt;
    // 限时增益倒计时
    for (const k in this.buffs) if (this.buffs[k] > 0) this.buffs[k] -= dt;
  }

  _shakeOff() {
    if (this.shakeT <= 0) return null;
    const f = this.shakeT / this.shakeDur;
    // 震屏在渲染帧调用,频率随机型帧率波动——必须用表现层随机,不碰种子流
    return [crand(-1, 1) * this.shakeMag * f, crand(-1, 1) * this.shakeMag * f];
  }

  /* ---------------- 渲染 ---------------- */


  /* 本局构筑摘要(暂停/结算共用) */

  _gameover() {
    this.state = 'gameover';
    AudioSys.gameover();
    if (this.mode === 'daily' && this.score >= 5000) Ach.unlock('daily_5000', this);
    if (this.mode === 'daily' && this.score >= 20000) Ach.unlock('daily_20000', this);
    if (this.mode === 'weekly' && this.score >= 30000) Ach.unlock('weekly_30000', this);
    if (this.score >= 50000) Ach.unlock('score_50k', this);
    if (this.score >= 150000) Ach.unlock('score_150k', this);
    if (this.mode === 'mayhem') {
      // 大乱斗:永久最佳纪录 + 专属成就
      if (this.score >= 30000) Ach.unlock('mayhem_30k', this);
      const best = this._mayhemBest();
      if (this.score > best) {
        this.newRecord = true;
        this._saveMayhemBest(this.score);
        AudioSys.record();
      }
    } else if (this.mode === 'boss') {
      // 连战:永久最佳纪录
      const best = this._bossBest();
      if (this.score > best) {
        this.newRecord = true;
        this._saveBossBest(this.score);
        AudioSys.record();
      }
    } else if (this.mode !== 'normal') {
      // 挑战模式:独立纪录
      const best = this._challengeBest();
      if (this.score > best) {
        this.newRecord = true;
        this._saveChallengeBest(this.score);
        AudioSys.record();
      }
    } else if (this.score > this.hi) {
      this.hi = this.score;
      this.newRecord = true;
      this._saveHi();
      AudioSys.record();
    }
    // 累计战绩
    const s = this.stats;
    s.games = this._stat('games', 0) + 1;
    s.kills = this._stat('kills', 0);
    s.bossKills = this._stat('bossKills', 0);
    s.eliteKills = this._stat('eliteKills', 0) + this.runEliteKills;
    s.totalScore = this._stat('totalScore', 0) + this.score;
    if (s.totalScore >= 1000000) Ach.unlock('total_score_1m', this);
    if (this.mode !== 'boss') s.bestWave = Math.max(this._stat('bestWave', 0), this.wave); // 连战阶段号不计波次线
    s.bestScore = Math.max(this._stat('bestScore', 0), this.score);
    s.bestRunKills = Math.max(this._stat('bestRunKills', 0), this.runKills);
    s.bestCombo = Math.max(this._stat('bestCombo', 0), this.maxCombo);
    s.bestLevel = Math.max(this._stat('bestLevel', 0), this.level);
    s.bestSlots = Math.max(this._stat('bestSlots', 0), this.maxSlots);
    s.perfectBest = Math.max(this._stat('perfectBest', 0), this.perfectStreak);
    s.lowHpKills = this._stat('lowHpKills', 0) + (this.runLowHpKills || 0);
    this.saveStats();
    this._achEvaluate();
    if (typeof DailyTasks !== 'undefined') {
      DailyTasks.bump('score', this.score, this);
      DailyTasks.save(); // 进度跨局累计,局末持久化一次
    }
    const d = this._dom;
    d.finalScore.textContent = this.score;
    d.finalWave.textContent = this.wave;
    d.finalHi.textContent = this.mode === 'mayhem' ? this._mayhemBest() : (this.mode !== 'normal' ? this._challengeBest() : this.hi);
    this._refreshMenuHi();
    // 星晶结算:得分/1600 + 旗舰×6 + 精英×1;贪婪周 ×1.5;高难 ×1.5
    Shop.lastEarn = Math.floor(this.score / 2600) + (this.runBossKills || 0) * 5 + (this.runEliteKills || 0) * 1;
    if (this._mut && this._mut.id === 'greed') Shop.lastEarn = Math.round(Shop.lastEarn * 1.5);
    if (this.mods.pact) Shop.lastEarn = Math.round(Shop.lastEarn * (1 + 0.1 * this.mods.pact));
    if (this.hard) Shop.lastEarn = Math.round(Shop.lastEarn * 1.5);
    if (this.mode === 'mayhem') Shop.lastEarn = Math.round(Shop.lastEarn * 1.5); // 大乱斗节奏福利
    if (this.augments && this.augments.a_stone) Shop.lastEarn = Math.round(Shop.lastEarn * 2); // 「贤者之石」
    if (this.relics.r_grail) Shop.lastEarn *= 2;
    Shop.addCrystal(Shop.lastEarn);
    // 挑战材料「战术芯片」:连战与每日/周挑战产出;按期限领一次
    Shop.lastChips = 0;
    Shop.lastChipsCapped = false;
    if (this.mode === 'boss') {
      // 连战:按抵达阶段给芯片(8~24),每日限领一次
      if (this._canBossClaim()) {
        Shop.lastChips = clamp(6 + this.wave * 2, 8, 24);
        Shop.addChips(Shop.lastChips);
        this._markBossClaimed();
      } else {
        Shop.lastChips = 0;
        Shop.lastChipsCapped = true;
      }
    } else if (this.mode === 'daily' || this.mode === 'weekly') {
      // 挑战芯片:每日/每周仅可领取一次,数额按表现浮动并钳制在目标区间
      // (每日 10~15,每周 40~60);重复挑战同一日/周不再发放(仍可刷分/纪录)
      if (this._canClaimChips()) {
        if (this.mode === 'weekly') {
          const perf = Math.floor(this.score / 6000) + Math.floor(this.wave / 3) + (this.runBossKills || 0) * 2;
          Shop.lastChips = clamp(40 + perf, 40, 60);
        } else {
          const perf = Math.floor(this.score / 8000) + Math.floor(this.wave / 5) + (this.runBossKills || 0);
          Shop.lastChips = clamp(10 + perf, 10, 15);
        }
        Shop.addChips(Shop.lastChips);
        this._markChipsClaimed();
      } else {
        // 今日/本周已领取:不再发放芯片
        Shop.lastChips = 0;
        Shop.lastChipsCapped = true;
      }
    }
    // 结算即落盘:局内星晶为延迟批量写入,此处强制刷新一次
    Shop.save();
    d.overCrystals.textContent = '★ +' + Shop.lastEarn + '(星晶 ' + Shop.crystal + ')'
      + (Shop.lastChips ? ' · ◈ +' + Shop.lastChips + '(芯片 ' + Shop.chips + ')' : '');
    // 芯片已领取提示:本期(今日/本周)奖励已领,追加说明
    if (Shop.lastChipsCapped && (this.mode === 'daily' || this.mode === 'weekly')) {
      const period = this.mode === 'weekly' ? '本周' : '今日';
      d.overCrystals.textContent += ' · ' + period + '芯片奖励已领取';
    }
    d.overRunStats.textContent = this._runStatsText()
      + (this.mode === 'campaign' && this._campaignResult ? ' · ' + '★'.repeat(this._campaignResult.stars) + '☆'.repeat(3 - this._campaignResult.stars) + (this._campaignResult.firstClear ? ' · 首通奖励已发放' : '') : '');
    d.overBuild.innerHTML = this._buildSummaryHTML();
    d.newRecord.classList.toggle('hidden', !this.newRecord);
    this._showState();
  }
}
