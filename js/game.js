'use strict';
/* ============================================================
 * 深空突袭 DEEP STRIKE — 游戏核心
 * 状态机 / 波次导演 / 碰撞 / 特效 / HUD 渲染
 * ============================================================ */

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
  { id: 'r_thor',        icon: '⚡', name: '雷神之锤', desc: '击坠时 15% 概率引落闪电,重创 3 个随机敌人' }
];

/* 无尽模式波次词缀:第 6 波起概率出现(BOSS 波除外) */
const WAVE_MODS = [
  { id: 'horde',   icon: '✸', name: '狂潮', desc: '出怪配额 +40%' },
  { id: 'iron',    icon: '⚙', name: '钢铁', desc: '敌机生命 +35%' },
  { id: 'swift',   icon: '💨', name: '迅影', desc: '敌机速度 +20%' },
  { id: 'barrage', icon: '🔥', name: '弹雨', desc: '敌方开火频率 +40%' },
  { id: 'bounty',  icon: '💎', name: '赏金', desc: '经验 +50%,掉落翻倍' }
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
      levelup: document.getElementById('levelupOverlay'),
      lvSub: document.getElementById('lvSub'),
      overCrystals: document.getElementById('overCrystals'),
      menuShop: document.getElementById('menuShop'),
      cardRow: document.getElementById('cardRow'),
      ownRow: document.getElementById('ownRow')
    };
    this._refreshMenuHi();
    this._showState();
  }

  _loadHi() { try { return +localStorage.getItem('deepstrike.hi') || 0; } catch (e) { return 0; } }
  _saveHi() { try { localStorage.setItem('deepstrike.hi', String(this.hi)); } catch (e) { /* 忽略 */ } }

  /* ---- 战绩档案(累计统计) ---- */
  _loadStats() {
    try { return JSON.parse(localStorage.getItem('deepstrike.stats')) || {}; }
    catch (e) { return {}; }
  }
  _stat(key, def) { return typeof this.stats[key] === 'number' ? this.stats[key] : def; }
  saveStats() {
    try { localStorage.setItem('deepstrike.stats', JSON.stringify(this.stats)); } catch (e) { /* 忽略 */ }
  }
  _refreshStatsPanel() {
    const d = this._dom;
    d.stHi.textContent = this.hi;
    d.stWave.textContent = this._stat('bestWave', 0);
    d.stGames.textContent = this._stat('games', 0);
    d.stKills.textContent = this._stat('kills', 0);
    d.stScore.textContent = this._stat('totalScore', 0);
    d.stBoss.textContent = this._stat('bossKills', 0);
    // 成就列表(按分类分组)
    const on = Ach.count();
    const cats = [...new Set(ACHIEVEMENTS.map(a => a.cat))];
    let html = '<div class="ach-head">' + on + ' / ' + ACHIEVEMENTS.length + '</div>';
    for (const cat of cats) {
      const list = ACHIEVEMENTS.filter(a => a.cat === cat);
      const gotCat = list.filter(a => Ach.unlocked[a.id]).length;
      html += '<div class="ach-cat">' + cat + ' ' + gotCat + '/' + list.length + '</div>';
      for (const a of list) {
        const got = !!Ach.unlocked[a.id];
        html += '<div class="ach-item ' + (got ? 'on' : 'off') + '">' +
          '<i>' + (got ? '🏆' : '🔒') + '</i>' +
          '<div><b>' + a.name + '</b><span>' + a.desc + '</span></div></div>';
      }
    }
    d.achList.innerHTML = html;
  }

  /* ---- 菜单子页面切换 ---- */
  showMenuPanel(name) {
    if (this.state !== 'menu' && this.state !== 'gameover') return;
    if (this.state === 'gameover') this.toMenu();
    this.menuPanel = name;
    if (name === 'stats') this._refreshStatsPanel();
    if (name === 'shop') Shop.renderPanel();
    this._showState();
  }

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
    this.levelupCooldown = 0;
    this.waveMod = null; this._env = { hpMul: 1, spdMul: 1, fireMul: 1 };
    this._recalc();
  }

  start(challengeMode) {
    this.mode = challengeMode || 'normal';
    // 每日/周挑战:播种固定波次序列与抽卡序列;周挑战威胁+1
    // 种子基准保留,供 startWave 按波派生与 _drawChoices 按抽卡序号派生
    this._seedBase = this.mode === 'normal' ? 0 : this._challengeSeed();
    RNG = this.mode === 'normal' ? Math.random : mulberry32(this._seedBase);
    this._reset();
    this.state = 'playing';
    AudioSys.init();
    if (AudioSys.musicGain) AudioSys.musicGain.gain.value = 0.3;
    // 机库永久强化:初始资源(多级)
    const bombLv = boostLevel('bomb1');
    if (bombLv) this.player.bombs += Math.ceil(bombLv / 2); // 砍半:每 2 级 +1 炸弹(满级 +5)
    if (boostLevel('hp25')) this.player.hp = this.player.maxHp;
    if (boostLevel('shield')) this.player.shield = true;
    this._showState();
    this.startWave(1);
    if (this.mode === 'daily') this.banner = { text: '每日挑战', sub: this._challengeKey() + ' · 固定关卡,冲击纪录', life: 2.4, max: 2.4, gold: true };
    if (this.mode === 'weekly') this.banner = { text: '周挑战', sub: this._challengeKey() + ' · 威胁+1,词缀更凶,冲击纪录', life: 2.4, max: 2.4, gold: true };
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
    return this.mode === 'weekly' ? this._weekKey() : this._dailyKey();
  }
  /* 挑战芯片领取闸门:按当前真实日期/周判断本期是否已领取 */
  _claimStoreKey() {
    return this.mode === 'weekly' ? 'deepstrike.weeklyClaim' : 'deepstrike.dailyClaim';
  }
  _canClaimChips() {
    if (this.mode === 'normal') return false;
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
  _refreshMenuHi() {
    this._dom.menuHi.textContent = '最高纪录 ' + this.hi + ' · 每日 ' + this._modeBest('daily') + ' · 周挑战 ' + this._modeBest('weekly');
  }

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

  _showState() {
    const d = this._dom;
    d.menu.classList.toggle('hidden', this.state !== 'menu');
    d.pause.classList.toggle('hidden', this.state !== 'paused');
    d.over.classList.toggle('hidden', this.state !== 'gameover');
    d.levelup.classList.toggle('hidden', this.state !== 'levelup');
    if (this.state === 'menu') {
      d.menuMain.classList.toggle('hidden', this.menuPanel !== 'main');
      d.menuHelp.classList.toggle('hidden', this.menuPanel !== 'help');
      d.menuStats.classList.toggle('hidden', this.menuPanel !== 'stats');
      d.menuShop.classList.toggle('hidden', this.menuPanel !== 'shop');
      if (this.menuPanel === 'shop') Shop.renderPanel();
    }
  }

  multiplier() { return 1 + Math.min(3, Math.floor(this.combo / 8)); }

  /* 弹速增长封顶波数:防止后期弹速无限膨胀 */
  effWave() { return Math.min(this.wave, 18); }

  /* 无尽模式威胁等级:第 15 波起每 5 波 +1;周挑战全程 +1 */
  threatLevel() {
    const base = Math.floor(Math.max(0, this.wave - 10) / 5);
    return base + (this.mode === 'weekly' ? 1 : 0);
  }

  /* ---------------- 肉鸽升级系统 ---------------- */
  _recalc() {
    const m = this.mods, p = this.player;
    const E = this.evo || {};   // 进化状态
    const sh = this.shipDef || {};
    p.dmgBonus = (m.dmg || 0) + (E.dmg ? 2 : 0) + (sh.dmgBonus || 0);
    let interval = (p.fireBase || 0.12) * Math.pow(0.85, m.rate || 0);
    if (E.rate) interval *= 0.75;
    if (this.bonds.includes('overdrive')) interval *= 0.85;
    // 轨道炮:蓄力式慢射(高单发伤害);穿甲协议/磁暴风进化缩短蓄力
    if (m.railgun) {
      let railMul = 3.2 - 0.4 * (m.railgun - 1);
      if (this.bonds.includes('railcrit')) railMul *= 0.7;
      if (E.railgun) railMul *= 0.65;
      interval *= railMul;
    }
    p.fireInterval = Math.max(0.045, interval);
    p.speed = (sh.speed || 330) * Math.pow(1.15, m.speed || 0);
    p.magnetR = 140 + (sh.perkMagnet || 0) + (m.magnet || 0) * 70;
    this.xpMult = 1 + 0.25 * (m.xpchip || 0) + 0.04 * boostLevel('xp10'); // 砍:每级 +4%(满级 +40%)
    this.comboWindow = 2 + 1.5 * (m.combo || 0);
    p.shieldInterval = this.bonds.includes('fortress') ? 6 : 12;
    // 时滞力场:敌弹整体减速(「时间领主」羁绊强化每层效果)
    const timePerStack = this.bonds.includes('chrono') ? 0.30 : 0.18;
    this.bulletSlow = (m.time || 0) ? 1 - Math.min(0.62, timePerStack * m.time) : 1;
    if (this.relics.r_voidwatch) this.bulletSlow = Math.max(0.3, this.bulletSlow * 0.9);
    // 卡槽系统:基础 5 槽,隐藏卡扩展
    this.maxSlots = 5 + (m.slotplus || 0);
    // 生命值系统:上限 = 机体基础 + 卡片成长 + 等级成长(+泰坦血统 50 + 机库装甲扩容)
    p.maxHp = (sh.hp || 100) + 25 * (m.vitality || 0) + 5 * (this.level - 1) + (E.vitality ? 50 : 0)
      + 10 * boostLevel('hp25') + (this.relics.r_belt ? 30 : 0);
    p.armorPct = Math.min(0.5, 0.15 * (m.armor || 0) + (sh.perkArmor || 0) + Math.min(0.12, 0.012 * boostLevel('shield'))); // 护盾:每级 +1.2% 减伤(满级 +12%)
    p.regenRate = 0.6 * (m.regen || 0) * (E.regen ? 2 : 1);
    p.leechPer = 0.7 * (m.leech || 0);
    p.hp = Math.min(p.hp, p.maxHp);
    // 幻影僚机:数量同步
    while (this.wingmen.length < (m.wingman || 0)) this.wingmen.push(new Wingman(this.wingmen.length));
    while (this.wingmen.length > (m.wingman || 0)) this.wingmen.pop();
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
    const critChance = 0.2 * (m.crit || 0) + (this.evo.crit ? 0.3 : 0) + (this.relics.r_hunter ? 0.1 : 0);
    // 过载脉冲:按暴击率周期性爆发额外伤害(把"暴击"转译为持续武器的节奏)
    this._beamCritT = (this._beamCritT || 0) - dt;
    let critPulse = 1;
    if (critChance > 0 && this._beamCritT <= 0) {
      this._beamCritT = Math.max(0.25, 0.9 - critChance);
      critPulse = this.bonds.includes('execute') ? 3.2 : (this.evo.crit ? 2.6 : 2.2);
      this._beamCrit = 0.12; // 过载可见时长
    }
    this._beamCrit = Math.max(0, (this._beamCrit || 0) - dt);
    const dps = (8 + 4.5 * (lvl - 1) + 3.2 * p.dmgBonus)
      * (this.bonds.includes('focus') ? 1.6 : 1)
      * (1 + 0.18 * (p.weapon - 1))
      * (1 + 0.25 * (m.pierce || 0))          // 贯穿:每层 +25% 灼烧
      * (this._beamCrit > 0 ? critPulse : 1); // 过载脉冲窗口内爆发
    let halfW = 2.5 + 0.8 * (lvl - 1) + 0.4 * (p.weapon - 1) + 0.6 * (m.pierce || 0);
    if (this.evo.laser) halfW *= 1.6;
    const lensPen = this.bonds.includes('laserlens');
    if (lensPen) halfW *= 2;
    const beamDps = dps * (this.evo.laser ? 1.25 : 1);   // 平衡:略降激光 evo 统治力(1.4→1.25)
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
    if (this.mode === 'normal') return drawUpgradeCards(this.mods, this.maxSlots, this.level, this.evo);
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

  _renderCards() {
    const row = this._dom.cardRow;
    row.innerHTML = '';
    const owned = this._ownedIds().length;
    const slotsFull = owned >= this.maxSlots;
    this._dom.lvSub.innerHTML = '槽位 <b style="color:#ffd166">' + owned + ' / ' + this.maxSlots + '</b>' +
      (slotsFull ? ' · 已满,选新卡需替换(也可跳过)' : ' · 按 1 / 2 / 3 或点击卡片');
    this._cardChoices.forEach((u, i) => {
      const r = RARITY[u.rar];
      const cur = this.mods[u.id] || 0;
      const needSwap = slotsFull && !cur && !u.hidden && !u.isEvo;
      const el = document.createElement('button');
      el.className = 'card r' + u.rar + (u.hidden ? ' hidden-card' : '') + (u.isEvo ? ' evo-card' : '');
      el.innerHTML =
        '<div class="card-rar" style="color:' + r.color + '">' + (u.hidden ? '隐藏卡' : r.name) + (u.isEvo ? ' ✦' : u.rar === 2 ? ' ★' : '') + '</div>' +
        '<div class="card-icon">' + u.icon + '</div>' +
        '<div class="card-name">' + u.name + '</div>' +
        '<div class="card-desc">' + u.desc + '</div>' +
        '<div class="card-lv">' + (u.isEvo ? '传说进化! · ' + UPGRADE_MAP[u.base].name + ' 满级'
          : u.hidden ? '槽位 +1'
          : cur > 0 ? 'Lv ' + cur + ' → ' + (cur + 1)
          : needSwap ? '需替换一项' : '新能力!') + ' · 按 ' + (i + 1) + '</div>';
      el.addEventListener('click', () => this.chooseCard(i));
      row.appendChild(el);
    });
    // 已持有强化与羁绊一览
    let html = '';
    for (const u of UPGRADES) {
      const c = this.mods[u.id] || 0;
      if (c > 0) html += '<span class="chip' + (this.evo[u.id] ? ' evo' : '') + '"><i>' + u.icon + '</i>' + u.name + (u.max > 1 ? ' ×' + c : '') + (this.evo[u.id] ? ' ✦' : '') + '</span>';
    }
    for (const b of BONDS) {
      if (this.bonds.includes(b.id)) html += '<span class="chip bond" title="' + b.desc + '">羁绊·' + b.name + '</span>';
    }
    this._dom.ownRow.innerHTML = html || '<span class="chip">首次升级 · 选择你的成长路线</span>';
    // 跳过按钮:暂存本次升级,稍后自动弹出
    const skip = document.createElement('button');
    skip.className = 'menu-btn';
    skip.style.cssText = 'width:auto;padding:8px 22px;font-size:13px;flex-basis:100%;text-align:center;margin-top:10px';
    skip.innerHTML = '▸ 跳过本次升级(暂存,稍后自动弹出)';
    skip.addEventListener('click', () => this.skipUpgrade());
    row.appendChild(skip);
  }

  /* 遗物三选一:复用升级界面 */
  _openRelicChoice() {
    if (this.state !== 'playing') return;
    const avail = RELICS.filter(x => !this.relics[x.id]);
    if (!avail.length) return;
    const picks = [];
    const pool = avail.slice();
    for (let i = 0; i < 3 && pool.length; i++) {
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
    AudioSys.bond();
    this.banner = { text: '遗物获得 · ' + r.name, sub: r.desc, life: 2.6, max: 2.6, gold: true };
    this._relicMode = false;
    this._relicChoices = [];
    this._recalc();
    if (r.id === 'r_belt') this.player.hp = this.player.maxHp;
    this.state = 'playing';
    this._showState();
  }

  _renderRelics() {
    const row = this._dom.cardRow;
    row.innerHTML = '';
    this._dom.lvSub.innerHTML = '旗舰遗落了远古造物 · <b style="color:#ffd166">选择一件遗物</b>(按 1 / 2 / 3)';
    this._relicChoices.forEach((r, i) => {
      const el = document.createElement('button');
      el.className = 'card r3 evo-card';
      el.innerHTML =
        '<div class="card-rar" style="color:#ffd166">遗 物 ✦</div>' +
        '<div class="card-icon">' + r.icon + '</div>' +
        '<div class="card-name">' + r.name + '</div>' +
        '<div class="card-desc">' + r.desc + '</div>' +
        '<div class="card-lv">被动生效 · 按 ' + (i + 1) + '</div>';
      el.addEventListener('click', () => this.chooseRelic(i));
      row.appendChild(el);
    });
    let html = '';
    for (const r0 of RELICS) {
      if (this.relics[r0.id]) html += '<span class="chip evo"><i>' + r0.icon + '</i>' + r0.name + '</span>';
    }
    this._dom.ownRow.innerHTML = html || '<span class="chip">尚无遗物</span>';
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
  }

  /* 满槽替换界面:展示已持有模块,点击丢弃 */
  _renderSwap() {
    const row = this._dom.cardRow;
    row.innerHTML = '';
    const u = this._pendingSwap;
    this._dom.lvSub.innerHTML = '<b style="color:#ff8fa5">槽位已满</b> · 点击卡片替换为「' + u.icon + ' ' + u.name + '」 · 或仅丢弃腾出槽位 <span style="color:rgba(159,232,255,0.5)">(Esc 返回)</span>';
    this._swapList.forEach((id, i) => {
      const owned = UPGRADE_MAP[id];
      const r = RARITY[owned.rar];
      const el = document.createElement('div');
      el.className = 'card swap r' + owned.rar;
      el.setAttribute('role', 'button');
      el.innerHTML =
        '<div class="card-rar" style="color:' + r.color + '">替换 · 按 ' + (i + 1) + '</div>' +
        '<div class="card-icon">' + owned.icon + '</div>' +
        '<div class="card-name">' + owned.name + '</div>' +
        '<div class="card-desc">Lv ' + this.mods[id] + ' / ' + owned.max + '</div>' +
        '<div class="card-lv">点击卡片 = 丢弃并装备新卡</div>' +
        '<button class="swap-discard" data-discard="' + id + '">🗑 仅丢弃(腾槽)</button>';
      el.addEventListener('click', () => this.swapPick(id));
      row.appendChild(el);
    });
    row.querySelectorAll('[data-discard]').forEach(btn =>
      btn.addEventListener('click', (ev) => { ev.stopPropagation(); this.discardOnly(btn.dataset.discard); }));
    const cancel = document.createElement('button');
    cancel.className = 'menu-btn';
    cancel.style.cssText = 'width:auto;padding:8px 22px;font-size:13px;flex-basis:100%;text-align:center';
    cancel.innerHTML = '▸ 返回选项(重新挑选)';
    cancel.addEventListener('click', () => this.cancelSwap());
    row.appendChild(cancel);
    const skip2 = document.createElement('button');
    skip2.className = 'menu-btn';
    skip2.style.cssText = 'width:auto;padding:8px 22px;font-size:13px;flex-basis:100%;text-align:center';
    skip2.innerHTML = '▸ 跳过本次升级(暂存,稍后自动弹出)';
    skip2.addEventListener('click', () => this.skipUpgrade());
    row.appendChild(skip2);
  }

  chooseCard(i) {
    if (this.state !== 'levelup' || this._pendingSwap) return;
    const u = this._cardChoices[i];
    if (!u) return;
    if (u.isEvo) {
      // 传说进化:满级卡片质变,不占槽位
      this.evo[u.base] = true;
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
    // 满级大师:3 张卡升至满级
    const maxedCount = UPGRADES.filter(x => (this.mods[x.id] || 0) >= x.max && !x.hidden).length;
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
    }
  }

  /* ---------------- 波次导演 ---------------- */
  startWave(n) {
    this.wave = n; this.waveTime = 0; this.spawnQueue = []; this.waveClearT = -1;
    this.waveKills = 0; this.trickleT = 0;
    // 挑战模式:按波派生独立子流——出怪序列/词缀只取决于日期种子与波号,
    // 与此前战斗过程(掉落/暴击/粒子)消耗了多少随机数无关,任意尝试严格一致
    if (this.mode !== 'normal') RNG = mulberry32((this._seedBase ^ Math.imul(n, 0x9E3779B1)) >>> 0);
    // 时间冻结:每波开始静止敌方弹幕
    if (this.evo.time) this.bulletFreezeT = 2.5;
    // 补给号角:波首掉落随机道具
    if (this.relics.r_horn) this._dropPower(rand(60, W - 60), -20);
    const threat = this.threatLevel();
    // 波次词缀:第 6 波起 40% 概率(BOSS 波除外)
    this.waveMod = null;
    if (n >= 6 && n % 5 !== 0 && RNG() < (this.mode === 'weekly' ? 0.7 : 0.4)) {
      this.waveMod = WAVE_MODS[irand(0, WAVE_MODS.length - 1)];
    }
    // 环境参数:威胁与词缀共同作用于本波敌机
    // 火力节奏:除威胁外,追加随波次的持续提速(每波 ×0.985,封顶到第 30 波),后期更具压迫感
    const waveFire = Math.max(0.62, Math.pow(0.985, Math.min(n, 30)));
    this._env = {
      hpMul: (1 + threat * 0.15) * (this.waveMod && this.waveMod.id === 'iron' ? 1.35 : 1),
      spdMul: (this.waveMod && this.waveMod.id === 'swift' ? 1.2 : 1) * (1 + Math.min(0.25, n * 0.008)),
      fireMul: Math.max(0.4, Math.pow(0.94, threat)) * waveFire * (this.waveMod && this.waveMod.id === 'barrage' ? 0.6 : 1)
    };
    // 里程碑:每 10 波投放补给(炸弹+1 与 25% 生命修复)
    const milestone = n > 10 && (n - 1) % 10 === 0;
    if (milestone) {
      const bombCap = this.relics.r_dragon ? 7 : 5;
      if (this.player.bombs < bombCap) this.player.bombs++;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.round(this.player.maxHp * 0.25));
    }
    if (n >= 5) Ach.unlock('wave_5', this);
    if (n >= 10) Ach.unlock('wave_10', this);
    if (n >= 15) Ach.unlock('wave_15', this);
    if (n >= 20) Ach.unlock('wave_20', this);
    if (n >= 25) Ach.unlock('wave_25', this);
    if (n >= 30) Ach.unlock('wave_30', this);
    if (n >= 40) Ach.unlock('wave_40', this);
    if (n >= 50) Ach.unlock('wave_50', this);
    // 质变武器抵达 20 波精通 + 四通累计;15 波用于 path_all 记录
    if (n >= 20) {
      const pk = this.mods.laser ? 'laser' : this.mods.spread ? 'spread' : this.mods.railgun ? 'railgun' : this.mods.tesla ? 'tesla' : null;
      if (pk) Ach.unlock('path_' + pk, this);
    }
    if (n >= 15) {
      const pk = this.mods.laser ? 'laser' : this.mods.spread ? 'spread' : this.mods.railgun ? 'railgun' : this.mods.tesla ? 'tesla' : null;
      if (pk) this._recordPathClear(pk);
    }
    // 不使用炸弹通关第 15 波
    if (n > 15 && (this.runBombsUsed || 0) === 0) Ach.unlock('nobomb_wave15', this);
    // 连续无伤波次里程碑
    if (this.perfectStreak >= 6) Ach.unlock('perfect_6', this);
    this.waveDamageTaken = 0;
    if (n % 5 === 0) {
      this.waveQuota = 1; // 目标:击毁旗舰
      const bname = BOSS_VARIANTS[bossVariant(n)].name;
      this.banner = { text: '⚠ WARNING ⚠', sub: '目标:击毁' + bname, life: 2.2, max: 2.2, red: true };
      AudioSys.alarm();
      this.spawnQueue.push({ boss: true, t: 2.0 });
      return;
    }
    this.banner = { text: 'WAVE ' + n, sub: '', life: 1.8, max: 1.8, red: false };
    AudioSys.waveStart();
    // 出怪配额:线性 + 二次增长,后期数量显著上升(封顶防止过载)
    let budget = Math.min(120, 8 + n * 3 + Math.floor(n * n * 0.12) + this.threatLevel() * 2);
    let t = 1.0;
    while (budget > 0) {
      const roll = RNG();
      let type = 'drone';
      // 第 6 波起引入「母舰」(carrier):周期释放无人机,增加压迫与丰富度
      if (n >= 6 && roll < 0.08) type = 'carrier';
      else if (n >= 3 && roll < 0.22) type = 'tank';
      else if (n >= 4 && roll < 0.33) type = 'bomber';
      else if (n >= 5 && roll < 0.40) type = 'shielder';
      else if (n >= 8 && roll < 0.48) type = 'mender';
      else if (n >= 2 && roll < 0.70) type = 'waver';
      else if (n >= 4 && roll < 0.84) type = 'sniper';
      let cost = type === 'carrier' ? 5 : (type === 'tank' || type === 'mender' ? 3 : (type === 'shielder' ? 4 : (type === 'drone' ? 1 : 2)));
      if (cost > budget) { type = 'drone'; cost = 1; }
      if (type === 'drone') {
        const cnt = Math.min(budget, irand(2, 4));
        const bx = rand(60, W - 60);
        for (let i = 0; i < cnt; i++)
          this.spawnQueue.push({ type: 'drone', t: t + i * 0.22, x: clamp(bx + rand(-50, 50), 40, W - 40) });
        budget -= cnt;
      } else {
        this.spawnQueue.push({ type, t, x: rand(60, W - 60) });
        budget -= cost;
      }
      t += rand(0.8, 1.7) * Math.max(0.5, 1 - n * 0.04);
    }
    // 关卡目标:必须击坠足够数量的敌机才能过关,躲避无法通关
    const hordeMul = this.waveMod && this.waveMod.id === 'horde' ? 1.4 : 1;
    this.waveQuota = Math.ceil(this.spawnQueue.length * 0.65 * hordeMul);
    this.banner.sub = '目标:击坠 ' + this.waveQuota + ' 架敌机';
    // 精英机:第 3 波起概率随队,第 7 波起可能双精英,第 10 波起概率出现双词缀精英
    if (n >= 3 && RNG() < 0.65) {
      const affixes = Object.keys(ELITE_CFG);
      const count = n >= 7 && RNG() < 0.35 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const idx = irand(0, this.spawnQueue.length - 1);
        const a1 = affixes[irand(0, affixes.length - 1)];
        const list = [a1];
        if (n >= 10 && RNG() < 0.35) {
          const a2 = affixes[irand(0, affixes.length - 1)];
          if (a2 !== a1) list.push(a2);
        }
        this.spawnQueue[idx].elite = list;
      }
      this.banner.sub += ' · ⚠ 精英机随队';
    }
    // 事件波:陨石带(第3/8/13…波,掩体兼威胁)与补给空投(第4/9/14…波)
    if (n % 5 === 3) {
      this.banner.sub += ' · ☄ 陨石带';
      const rocks = 4 + Math.floor(n / 3);
      for (let i = 0; i < rocks; i++)
        this.spawnQueue.push({ asteroid: true, t: rand(0.5, 6), x: rand(40, W - 40), r: rand(14, 26) });
    }
    if (n % 5 === 4) {
      this.banner.sub += ' · ▽ 补给空投';
      for (let i = 0; i < 3; i++)
        this.spawnQueue.push({ supply: true, t: rand(1, 5), x: rand(50, W - 50) });
    }
    if (this.waveMod) this.banner.sub += ' · ' + this.waveMod.icon + ' ' + this.waveMod.name;
    if (milestone) this.banner.sub += ' · ⚡ 威胁纪元补给';
  }

  /* ---------------- 主更新 ---------------- */
  update(dt) {
    this.stars.update(dt, this.state === 'playing' ? 1 : 0.35);
    this._decayFx(dt);
    if (this.state !== 'playing') return;

    this.waveTime += dt;
    for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
      const s = this.spawnQueue[i];
      if (s.t <= this.waveTime) {
        if (s.boss) this.boss = new Boss(this.wave);
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
      if (b.dead || b.y < -20 || b.x < -20 || b.x > W + 20 || b.y > H + 20) this.playerBullets.splice(i, 1);
    }
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      // 时间冻结:波首静止弹幕
      if (this.bulletFreezeT > 0) continue;
      // 时滞力场
      const sdt = dt * this.bulletSlow;
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
        this.riftCd = 8.5;
        this.rifts.push(new Rift(rand(70, W - 70), rand(130, 320), this));
        AudioSys.rift();
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
            : this.wave >= 2 && roll < 0.63 ? 'waver'
            : this.wave >= 4 && roll < 0.79 ? 'sniper' : 'drone';
          this.enemies.push(new Enemy(type, rand(60, W - 60), this.wave, null, this._env));
        }
      } else if (this.waveClearT < 0) {
        this.waveClearT = 1.6;
        const bonus = 200 + this.wave * 100;
        this.score += bonus;
        if (this.player.alive) this.player.hp = Math.min(this.player.maxHp, this.player.hp + 5 + (this.evo.vitality ? 15 : 0));
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
        const dx = b.x - bo.x, dy = b.y - bo.y;
        const rr = bo.r + b.r;
        if (dx * dx + dy * dy < rr * rr) this._hitTarget(b, bo);
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
      // 敌机冲撞 → 玩家(接触伤害随波次小幅增长,封顶 55)
      if (p.alive && p.invuln <= 0) {
        const contactDmg = Math.min(55, 35 + Math.floor(Math.max(0, this.wave - 1) * 0.8));
        for (const e of this.enemies) {
          if (e.dead) continue;
          const dx = e.x - p.x, dy = e.y - p.y;
          const rr = e.r + p.r;
          if (dx * dx + dy * dy < rr * rr) {
            e.damage(this.relics.r_thorn_crown ? 6 : 3, this);
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
    const cc = 0.2 * (this.mods.crit || 0) + (this.evo.crit ? 0.3 : 0) + (this.relics.r_hunter ? 0.1 : 0);
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
    if (hit.size >= 8) Ach.unlock('tesla_chain8', this);
  }

  /* ---------------- 击杀 / 伤害结算 ---------------- */
  killEnemy(e) {
    this.combo++;
    this.comboT = this.comboWindow;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
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
    this.stats.kills = this._stat('kills', 0) + 1;
    this.waveKills++;
    this.runKills++;
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
    if (e.elite && e.elite.length >= 2) Ach.unlock('dual_elite', this);
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
      const need = this.mods.bombkill === 1 ? 25 : 15;
      if (this.bombMeter >= need) {
        this.bombMeter = 0;
        if (this.player.bombs < (this.relics.r_dragon ? 7 : 5)) {
          this.player.bombs++;
          this._addFloat(new FloatText(this.player.x, this.player.y - 30, '歼灭装填 炸弹+1', '#51e08a', 12));
        }
      }
    }
    const mult = this.multiplier();
    const pts = Math.round(e.score * mult);
    this.score += pts;
    this._addFloat(new FloatText(e.x, e.y - 8, '+' + pts, mult > 1 ? '#ffd166' : '#e8f6ff', e.r > 18 ? 16 : 13));
    this._explode(e.x, e.y, e.r, e.color, 1);
    AudioSys.explode(e.r >= 18);
    this.shake(Math.min(9, 1.5 + e.r * 0.18), 0.22);
    // 掉落经验晶体(精英 ×4)
    const xpTable = { drone: 2, waver: 3, sniper: 4, tank: 8, bomber: 3, shielder: 10, mender: 6 };
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
    // 旗舰奖励:击毁后获得一次额外升级机会 + 一件遗物三选一
    this.pendingLevels++;
    this.pendingRelic = true;
    if (this.state === 'playing' && this.player.alive) this.openLevelup();
    Ach.unlock('boss_1', this);
    if (this.stats.bossKills >= 5) Ach.unlock('boss_5', this);
    if (this.stats.bossKills >= 10) Ach.unlock('boss_10', this);
    if (this.stats.bossKills >= 25) Ach.unlock('boss_25', this);
    if (this.stats.bossKills >= 50) Ach.unlock('boss_50', this);
    if (this.stats.bossKills >= 100) Ach.unlock('boss_100', this);
    if (b.variant === 'storm') Ach.unlock('storm_kill', this);
    if (b.variant === 'tyrant') Ach.unlock('tyrant_kill', this);
    // 完胜旗舰:本波(BOSS 波)未受伤击毁
    if (this.waveDamageTaken === 0) Ach.unlock('boss_nohit', this);
    const pts = Math.round(b.score * this.multiplier());
    this.score += pts;
    this._addFloat(new FloatText(b.x, b.y, '+' + pts, '#ffd166', 22));
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
  }

  _dropPower(x, y, force) {
    let type = force;
    if (!type) {
      const r = RNG();
      type = r < 0.42 ? 'power' : r < 0.68 ? 'shield' : r < 0.92 ? 'bomb' : 'life';
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
      if (p.bombs < (this.relics.r_dragon ? 7 : 5)) {
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
    }
  }

  /* 受击结算:数值伤害(dmg 由伤害来源指定),装甲减免,不屈兜底 */
  _playerHit(dmg = 25) {
    const p = this.player;
    if (p.invuln > 0 || !p.alive) return;
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
    const real = Math.max(1, Math.round(dmg * (1 - p.armorPct)));
    p.hp -= real;
    this.waveDamageTaken++;
    this.combo = 0;
    AudioSys.playerHit();
    this.shake(14, 0.5);
    this.flashT = 0.35; this.flashColor = 'rgba(255,70,90,';
    this._explode(p.x, p.y, 16, '#7ef3ff', 1.4);
    this._thornBlast();
    if (p.hp <= 0) {
      // 不屈意志:每局一次,保留 1 点生命并清除全屏弹幕
      if (this.mods.undying && !p.undyingUsed) {
        p.undyingUsed = true;
        p.hp = 1;
        p.invuln = 2.5;
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
    const p = this.player, R = 150;
    for (const b of this.enemyBullets) {
      const dx = b.x - p.x, dy = b.y - p.y;
      if (dx * dx + dy * dy < R * R) {
        this._sparks(b.x, b.y, '#a5ffd6', 2);
        b.dead = true;
      }
    }
    for (const e of this.enemies) {
      const dx = e.x - p.x, dy = e.y - p.y;
      if (dx * dx + dy * dy < R * R) e.damage(4, this);
    }
    this.rings.push(new Ring(p.x, p.y, '#a5ffd6', R, 0.45));
    AudioSys.web();
  }

  /* ---------------- 炸弹 ---------------- */
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
    const bombDmg = this.relics.r_dragon ? 23 : 8;
    for (const e of this.enemies) e.damage(bombDmg, this);
    for (const a of this.asteroids) a.damage(6, this);
    if (this.boss) this.boss.damage(this.relics.r_dragon ? 35 : 20, this);
    this.rings.push(new Ring(p.x, p.y, '#aef3ff', 300, 0.7));
  }

  /* ---------------- 子弹发射 ---------------- */
  /* 敌方弹幕伤害:随波次与威胁等级增长(后期弹幕更疼)。
   * 基础 22,每波 +0.7(封顶 +18),威胁每级 +2;橙色狙击弹额外 +15%。 */
  enemyDmg(kind) {
    const base = 22 + Math.min(18, (this.wave - 1) * 0.7) + this.threatLevel() * 2;
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
  }

  _shakeOff() {
    if (this.shakeT <= 0) return null;
    const f = this.shakeT / this.shakeDur;
    // 震屏在渲染帧调用,频率随机型帧率波动——必须用表现层随机,不碰种子流
    return [crand(-1, 1) * this.shakeMag * f, crand(-1, 1) * this.shakeMag * f];
  }

  /* ---------------- 渲染 ---------------- */
  render() {
    const ctx = this.ctx;
    ctx.drawImage(this.bg, 0, 0);
    this.stars.draw(ctx);

    ctx.save();
    const off = this._shakeOff();
    if (off) ctx.translate(off[0], off[1]);

    for (const pu of this.powerups) pu.draw(ctx);
    for (const su of this.supplies) su.draw(ctx);
    for (const o of this.orbs) o.draw(ctx);
    for (const a of this.asteroids) a.draw(ctx);
    for (const rf of this.rifts) rf.draw(ctx);
    for (const e of this.enemies) e.draw(ctx);
    if (this.boss) this.boss.draw(ctx);
    this.player.draw(ctx);
    for (const w of this.wingmen) w.draw(ctx);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.playerBullets) {
      ctx.fillStyle = 'rgba(120,220,255,0.35)';
      ctx.fillRect(b.x - 3.5, b.y - 13, 7, 18);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - 1.8, b.y - 10, 3.6, 14);
    }
    // 激光光束
    if (this.player.beamOn && this.beams) {
      const tk = performance.now() / 1000;
      for (const bm of this.beams) {
        const flick = 0.72 + 0.28 * Math.sin(tk * 42 + bm.x);
        const bottom = this.player.y - 14;
        // 过载脉冲:光束转为炽白金色并加宽;分裂副束偏青
        const hot = bm.hot;
        const glowCol = hot ? 'rgba(255,196,120,' : (bm.split ? 'rgba(120,240,255,' : 'rgba(255,110,170,');
        const coreCol = hot ? 'rgba(255,250,230,' : (bm.split ? 'rgba(224,255,255,' : 'rgba(255,228,246,');
        const wMul = hot ? 3.0 : 2.2;
        ctx.fillStyle = glowCol + (0.16 * flick).toFixed(3) + ')';
        ctx.fillRect(bm.x - bm.halfW * wMul, 0, bm.halfW * wMul * 2, bottom);
        ctx.fillStyle = coreCol + ((hot ? 0.9 : 0.72) * flick).toFixed(3) + ')';
        ctx.fillRect(bm.x - bm.halfW * 0.7, 0, bm.halfW * 1.4, bottom);
      }
    }
    ctx.restore();

    for (const b of this.enemyBullets) {
      ctx.fillStyle = b.glow;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2.2, 0, TAU); ctx.fill();
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const pt of this.particles) pt.draw(ctx);
    for (const rg of this.rings) rg.draw(ctx);
    ctx.restore();

    if (this.bombActive) {
      const f = 1 - this.bombT / 0.9;
      ctx.strokeStyle = 'rgba(170,240,255,' + Math.max(0, 1 - f) + ')';
      ctx.lineWidth = 6 * (1 - f) + 1;
      ctx.beginPath();
      ctx.arc(this.player.x, this.player.y, f * 620, 0, TAU);
      ctx.stroke();
    }

    for (const f of this.floats) f.draw(ctx);
    ctx.restore();

    if (this.flashT > 0) {
      ctx.fillStyle = this.flashColor + (clamp(this.flashT / 0.4, 0, 1) * 0.4).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    // 濒死警示:最后一丝生命时屏幕边缘红色脉动
    if (this.state === 'playing' && this.player.alive && this.player.hp / this.player.maxHp <= 0.3) {
      const a = 0.10 + 0.07 * Math.sin(performance.now() / 250);
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 0.72);
      g.addColorStop(0, 'rgba(255,40,70,0)');
      g.addColorStop(1, 'rgba(255,40,70,' + a.toFixed(3) + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    if (this.state !== 'menu') this._drawHud(ctx);
  }

  _drawHud(ctx) {
    const p = this.player;
    ctx.textBaseline = 'top';
    // 分数
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9fe8ff';
    ctx.font = 'bold 20px Consolas, monospace';
    ctx.fillText(String(this.score).padStart(7, '0'), 14, 12);
    ctx.fillStyle = 'rgba(159,232,255,0.55)';
    ctx.font = '12px Consolas, monospace';
    ctx.fillText('HI ' + String(Math.max(this.hi, this.score)).padStart(7, '0'), 14, 38);
    // 波次
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 16px Consolas, monospace';
    ctx.fillText('WAVE ' + this.wave, W - 14, 14);
    // 关卡目标进度
    const quotaMet = this.waveKills >= this.waveQuota;
    ctx.font = 'bold 12px Consolas, monospace';
    if (this.wave % 5 === 0) {
      ctx.fillStyle = '#ff8fa5';
      ctx.fillText('目标:击毁旗舰', W - 14, 38);
    } else if (quotaMet) {
      ctx.fillStyle = '#51e08a';
      ctx.fillText('目标达成 ' + this.waveKills + '/' + this.waveQuota, W - 14, 38);
    } else {
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 150);
      ctx.fillStyle = 'rgba(255,209,102,' + pulse.toFixed(2) + ')';
      ctx.fillText('击坠 ' + this.waveKills + ' / ' + this.waveQuota, W - 14, 38);
    }
    if (AudioSys.muted) {
      // 放在右列最下方(挑战标签 y54 / 威胁等级 y68 之下),避免与目标进度文字叠印
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '12px sans-serif';
      ctx.fillText('♪ OFF', W - 14, 82);
    }
    // 挑战模式标识
    if (this.mode !== 'normal') {
      const tagName = this.mode === 'weekly' ? '周挑战' : '每日挑战';
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 11px Consolas, monospace';
      ctx.fillText(tagName + ' · 纪录 ' + this._challengeBest(), W - 14, 54);
    }
    // 无尽模式:威胁等级与波次词缀
    const threat = this.threatLevel();
    if (threat > 0) {
      ctx.fillStyle = 'rgba(255,120,140,0.9)';
      ctx.font = 'bold 11px Consolas, monospace';
      ctx.fillText('⚡ 威胁等级 ' + threat, W - 14, this.mode !== 'normal' ? 68 : 54);
    }
    if (this.waveMod) {
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 11px "Segoe UI", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(this.waveMod.icon + ' ' + this.waveMod.name + ' · ' + this.waveMod.desc, 14, 54);
    }
    // 生命条(数值化生命)
    {
      const bw = 104, bx = 14, by = H - 27;
      const pct = clamp(p.hp / p.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, 10);
      ctx.fillStyle = pct > 0.5 ? '#51e08a' : (pct > 0.25 ? '#ffd166' : '#ff5577');
      ctx.fillRect(bx, by, bw * pct, 8);
      ctx.strokeStyle = 'rgba(126,243,255,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx - 1.5, by - 1.5, bw + 3, 11);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#cfe8ff';
      ctx.font = 'bold 10px Consolas, monospace';
      ctx.fillText('HP ' + Math.ceil(p.hp) + '/' + p.maxHp, bx + bw + 8, by);
    }
    // 炸弹
    for (let i = 0; i < p.bombs; i++) {
      const x = W - 22 - i * 20, y = H - 22;
      ctx.fillStyle = '#51e08a';
      ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc(x - 2, y - 2, 1.6, 0, TAU); ctx.fill();
    }
    // 火力等级
    ctx.textAlign = 'center';
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < p.weapon ? '#ff5470' : 'rgba(255,84,112,0.25)';
      ctx.fillRect(W / 2 - 32 + i * 14, H - 16, 10, 5);
    }
    // 连击
    if (this.combo >= 4) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 15px Consolas, monospace';
      ctx.fillText(this.combo + ' COMBO  ×' + this.multiplier(), W / 2, 60);
      const fw = 90 * clamp(this.comboT / this.comboWindow, 0, 1);
      ctx.fillStyle = 'rgba(255,209,102,0.5)';
      ctx.fillRect(W / 2 - fw / 2, 80, fw, 3);
    }
    // BOSS 血条
    if (this.boss && this.boss.state !== 'enter') {
      const bw = 320, bx = (W - bw) / 2, by = 34;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx - 2, by - 2, bw + 4, 12);
      ctx.fillStyle = '#ff3355';
      ctx.fillRect(bx, by, bw * clamp(this.boss.hp / this.boss.maxHp, 0, 1), 8);
      ctx.strokeStyle = 'rgba(255,85,119,0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx - 2.5, by - 2.5, bw + 5, 13);
      // 三阶段分段标记(当前阶段高亮)
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(bx + bw / 3 - 1, by, 2, 8);
      ctx.fillRect(bx + bw * 2 / 3 - 1, by, 2, 8);
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 9px Consolas, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('P' + (this.boss.phase + 1), bx + bw + 10, by + 1);
    }
    // 经验条与等级
    if (this.level > 1 || this.xp > 0 || this.mods && Object.keys(this.mods).length) {
      const bw = 170, bx = (W - bw) / 2, by = 12;
      ctx.textAlign = 'right';
      ctx.fillStyle = '#8fe8ff';
      ctx.font = 'bold 12px Consolas, monospace';
      ctx.fillText('LV ' + this.level, bx - 8, by - 1);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, 9);
      const xf = clamp(this.xp / this.xpNext, 0, 1);
      ctx.fillStyle = '#37e2ff';
      ctx.fillRect(bx, by, bw * xf, 7);
      ctx.strokeStyle = 'rgba(143,232,255,0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx - 1.5, by - 1.5, bw + 3, 10);
    }
    // 波次横幅
    if (this.banner && this.banner.life > 0) {
      const b = this.banner;
      const a = Math.min(1, b.life / 0.5) * Math.min(1, (b.max - b.life) * 4);
      ctx.globalAlpha = clamp(a, 0, 1);
      const col = b.red ? '#ff3355' : (b.gold ? '#ffd166' : '#7ef3ff');
      const glow = b.red ? '#ff3355' : (b.gold ? '#ffae30' : '#37e2ff');
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const maxW = W - 36;
      ctx.fillStyle = col;
      ctx.font = 'bold 34px "Segoe UI", "Microsoft YaHei", sans-serif';
      const mainW = ctx.measureText(b.text).width;
      if (mainW > maxW) ctx.font = 'bold ' + Math.max(16, Math.floor(34 * maxW / mainW)) + 'px "Segoe UI", "Microsoft YaHei", sans-serif';
      ctx.shadowColor = glow;
      ctx.shadowBlur = 18;
      ctx.fillText(b.text, W / 2, H * 0.38);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(230,245,255,0.85)';
      ctx.font = '15px "Segoe UI", "Microsoft YaHei", sans-serif';
      const subW = ctx.measureText(b.sub).width;
      if (subW > maxW) ctx.font = Math.max(10, Math.floor(15 * maxW / subW)) + 'px "Segoe UI", "Microsoft YaHei", sans-serif';
      ctx.fillText(b.sub, W / 2, H * 0.38 + 42);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    // 已获强化图标与羁绊
    const owned = UPGRADES.filter(u => this.mods[u.id]);
    if (owned.length) {
      ctx.textAlign = 'center';
      ctx.font = '11px "Segoe UI", sans-serif';
      const total = owned.length * 18 - 6;
      let ox = W / 2 - total / 2 + 7;
      for (const u of owned) {
        const cnt = this.mods[u.id];
        ctx.fillStyle = this.evo[u.id] ? '#ffd166' : RARITY[u.rar].color;
        ctx.fillText(u.icon + (this.evo[u.id] ? '✦' : ''), ox, H - 38);
        if (u.max > 1) {
          ctx.fillStyle = 'rgba(230,245,255,0.75)';
          ctx.fillText(String(cnt), ox + 5, H - 30);
        }
        ox += 18;
      }
    }
    if (this.bonds.length) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 11px "Segoe UI", "Microsoft YaHei", sans-serif';
      ctx.fillText('羁绊 ' + this.bonds.map(id => BONDS.find(b => b.id === id).name).join(' · '), 14, H - 44);
    }
    // 遗物图标
    const ownedRelics = RELICS.filter(r0 => this.relics[r0.id]);
    if (ownedRelics.length) {
      ctx.textAlign = 'left';
      ctx.font = '12px "Segoe UI", sans-serif';
      let rx = 14;
      for (const r0 of ownedRelics) {
        ctx.fillStyle = '#ffd166';
        ctx.fillText(r0.icon, rx, H - 60);
        rx += 20;
      }
    }
    if (owned.length) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(159,232,255,0.6)';
      ctx.font = 'bold 10px Consolas, monospace';
      ctx.fillText(this._ownedIds().length + '/' + this.maxSlots + ' 槽', W / 2, H - 48);
    }
  }

  /* 本局构筑摘要(暂停/结算共用) */
  _buildSummaryHTML() {
    let html = '';
    for (const u of UPGRADES) {
      const c = this.mods[u.id] || 0;
      if (c > 0) html += '<span class="chip' + (this.evo[u.id] ? ' evo' : '') + '"><i>' + u.icon + '</i>' + u.name + (u.max > 1 ? ' ×' + c : '') + (this.evo[u.id] ? ' ✦' : '') + '</span>';
    }
    for (const b of BONDS) {
      if (this.bonds.includes(b.id)) html += '<span class="chip bond">羁绊·' + b.name + '</span>';
    }
    if (!html) html = '<span class="chip">本局尚未获得强化</span>';
    return html;
  }
  _runStatsText() {
    return '击坠 ' + this.runKills + ' · 精英 ' + this.runEliteKills + ' · 等级 ' + this.level + ' · 最高连击 ' + this.maxCombo;
  }

  _gameover() {
    this.state = 'gameover';
    AudioSys.gameover();
    if (this.mode === 'daily' && this.score >= 5000) Ach.unlock('daily_5000', this);
    if (this.mode === 'daily' && this.score >= 20000) Ach.unlock('daily_20000', this);
    if (this.mode === 'weekly' && this.score >= 30000) Ach.unlock('weekly_30000', this);
    if (this.score >= 50000) Ach.unlock('score_50k', this);
    if (this.score >= 150000) Ach.unlock('score_150k', this);
    if (this.mode !== 'normal') {
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
    s.bestWave = Math.max(this._stat('bestWave', 0), this.wave);
    this.saveStats();
    const d = this._dom;
    d.finalScore.textContent = this.score;
    d.finalWave.textContent = this.wave;
    d.finalHi.textContent = this.mode !== 'normal' ? this._challengeBest() : this.hi;
    this._refreshMenuHi();
    // 星晶结算:得分/1000 + 旗舰 10 + 精英 2
    Shop.lastEarn = Math.floor(this.score / 1600) + (this.runBossKills || 0) * 6 + (this.runEliteKills || 0) * 1;
    if (this.relics.r_grail) Shop.lastEarn *= 2;
    Shop.addCrystal(Shop.lastEarn);
    // 挑战材料「战术芯片」:仅每日/周挑战产出,按得分/波次给予;周挑战翻倍
    Shop.lastChips = 0;
    if (this.mode !== 'normal') {
      // 挑战芯片:每日/每周仅可领取一次,数额按表现浮动并钳制在目标区间
      // (每日 10~15,每周 40~60);重复挑战同一日/周不再发放(仍可刷分/纪录)
      Shop.lastChipsCapped = false;
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
    if (Shop.lastChipsCapped && this.mode !== 'normal') {
      const period = this.mode === 'weekly' ? '本周' : '今日';
      d.overCrystals.textContent += ' · ' + period + '芯片奖励已领取';
    }
    d.overRunStats.textContent = this._runStatsText();
    d.overBuild.innerHTML = this._buildSummaryHTML();
    d.newRecord.classList.toggle('hidden', !this.newRecord);
    this._showState();
  }
}
