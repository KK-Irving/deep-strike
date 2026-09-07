'use strict';
/* ============================================================
 * 深空突袭 DEEP STRIKE — 机库商城系统
 * 星晶货币 / 战机皮肤(含成就解锁款) / 永久强化
 * ============================================================ */

/* 战机皮肤:涂装四色 + 引擎火焰双色;ach 指定对应解锁成就
 * tier:0 基础 / 1 进阶 / 2 高级 / 3 绚丽(仅密匣) —— 越高级特效越华丽
 * fx 可选特效:
 *   glow   机体辉光强度(描边发光半径倍率)
 *   dual   双色描边(stroke2 为副色),高级皮肤呈现渐变金属质感
 *   sheen  流光扫过(渲染层实现),仅高级/绚丽
 *   trail  拖尾粒子密度倍率 */
const SKINS = [
  { id: 'proto',    name: '原型机·青',   price: 0,    tier: 0, hull: '#0f4b66', stroke: '#7ef3ff', cockpit: '#d9fbff', flame: ['rgba(120,230,255,0.9)', 'rgba(0,120,255,0)'], desc: '默认涂装' },
  { id: 'frost',    name: '霜语',         price: 360,  tier: 0, hull: '#123a52', stroke: '#c8ecff', cockpit: '#eaf7ff', flame: ['rgba(200,236,255,0.9)', 'rgba(80,160,255,0)'] },
  { id: 'ember',    name: '烈焰',         price: 480,  tier: 0, hull: '#4a1810', stroke: '#ff9a3c', cockpit: '#ffd9a8', flame: ['rgba(255,170,90,0.9)', 'rgba(255,60,0,0)'] },
  { id: 'violet',   name: '幽紫',         price: 640,  tier: 1, hull: '#2a1240', stroke: '#c86bff', cockpit: '#eadfff', flame: ['rgba(200,107,255,0.9)', 'rgba(90,0,180,0)'], fx: { glow: 1.3, dual: '#7ef3ff' } },
  { id: 'gold',     name: '黄金装甲',     price: 1000, tier: 2, hull: '#4a3a10', stroke: '#ffd166', cockpit: '#fff3c8', flame: ['rgba(255,220,120,0.9)', 'rgba(255,140,0,0)'], fx: { glow: 1.6, dual: '#fff2b0', sheen: '#fff6cf', trail: 1.4 } },
  { id: 'aurora',   name: '极光',         price: 1200, tier: 2, hull: '#0a2f3a', stroke: '#5ffbf1', cockpit: '#dffffb', flame: ['rgba(95,251,241,0.9)', 'rgba(120,80,255,0)'], desc: '流转极光涂装', fx: { glow: 1.7, dual: '#a98bff', sheen: '#c8fff4', trail: 1.5 } },
  { id: 'nebula',   name: '星海',         price: 1500, tier: 2, hull: '#1a1040', stroke: '#a98bff', cockpit: '#efe6ff', flame: ['rgba(169,139,255,0.9)', 'rgba(255,90,200,0)'], desc: '深空星云涂装', fx: { glow: 1.8, dual: '#ff8fd8', sheen: '#e6d6ff', trail: 1.6 } },
  { id: 'crimson',  name: '猩红之刃',     ach: 'combo_60', tier: 1, hull: '#40101d', stroke: '#ff4d6d', cockpit: '#ffd6de', flame: ['rgba(255,110,130,0.9)', 'rgba(180,0,40,0)'], fx: { glow: 1.4, dual: '#ffd166' } },
  { id: 'abyss',    name: '深渊指挥官',   ach: 'wave_20',  tier: 2, hull: '#06282a', stroke: '#2be8c8', cockpit: '#c8fff4', flame: ['rgba(80,230,200,0.9)', 'rgba(0,120,140,0)'], fx: { glow: 1.6, dual: '#7effe0', sheen: '#c8fff4', trail: 1.4 } },
  { id: 'evoProto', name: '进化原型机',   ach: 'evo_3',    tier: 1, hull: '#12240a', stroke: '#9dff5a', cockpit: '#e8ffd6', flame: ['rgba(157,255,90,0.9)', 'rgba(40,140,0,0)'], fx: { glow: 1.4, dual: '#e8ffd6' } },
  { id: 'phantomX', name: '幽灵X',        ach: 'boss_10',  tier: 2, hull: '#1a1a2e', stroke: '#8fa8ff', cockpit: '#dfe8ff', flame: ['rgba(143,168,255,0.8)', 'rgba(40,60,180,0)'], fx: { glow: 1.6, dual: '#c8d4ff', sheen: '#dfe8ff', trail: 1.3 } },
  { id: 'prism',    name: '棱镜绚彩',     rare: true, tier: 3, hull: '#2a0d3d', stroke: '#ff6ad5', cockpit: '#fff0fb', flame: ['rgba(255,106,213,0.95)', 'rgba(106,180,255,0)'], desc: '★绚丽·仅密匣/兑换获得', fx: { glow: 2.2, dual: '#6ab4ff', sheen: '#ffffff', trail: 2.0, rainbow: true } },
  { id: 'celestial',name: '天穹圣辉',     rare: true, tier: 3, hull: '#3a2f05', stroke: '#ffe66a', cockpit: '#fffbe0', flame: ['rgba(255,230,106,0.95)', 'rgba(255,140,0,0)'], desc: '★绚丽·仅密匣/兑换获得', fx: { glow: 2.4, dual: '#fff6cf', sheen: '#ffffff', trail: 2.2, halo: true } }
];

/* 出击机体:造型/数值/专属特性;ach 指定成就解锁 */
const SHIPS = [
  { id: 'vanguard',  name: '突击机',     price: 0,   desc: '均衡型:全属性标准',            hp: 100, speed: 330, fire: 0.12,  dmgBonus: 0 },
  { id: 'juggernaut',name: '重装堡垒',   price: 1500, desc: '重装型:血厚甲硬,机动迟缓',      hp: 140, speed: 295, fire: 0.135, dmgBonus: 0, perkArmor: 0.10 },
  { id: 'phantom',   name: '幽灵',       price: 950, desc: '掠袭型:极速机动,机体脆弱',      hp: 75,  speed: 375, fire: 0.10,  dmgBonus: 0, perkMagnet: 60 },
  { id: 'lancer',    name: '锐锋狙击',   price: 1900, desc: '狙击型:高伤慢射,精准强袭',      hp: 90,  speed: 320, fire: 0.16,  dmgBonus: 2 },
  { id: 'scatter',   name: '散华',       price: 2200, desc: '散射型:高频弱弹,弹幕覆盖',      hp: 95,  speed: 340, fire: 0.09,  dmgBonus: 0, perkSide: 1, perkMagnet: 30 },
  { id: 'tempest',   name: '风暴棱镜',   ach: 'wave_25', desc: '特化型:开局自带侧翼弹',     hp: 90,  speed: 350, fire: 0.11,  dmgBonus: 0, perkSide: 1 },
  { id: 'titanX',    name: '泰坦·X',     rare: true, desc: '★绚丽机体:全能强袭,仅密匣/兑换获得', hp: 130, speed: 355, fire: 0.10, dmgBonus: 2, perkArmor: 0.08, perkSide: 1 }
];

/* 机体 hull 造型路径(与皮肤配色组合渲染) */
const SHIP_SHAPES = {
  vanguard:  (g) => { g.moveTo(0, -17); g.lineTo(9, 4); g.lineTo(14, 11); g.lineTo(5, 8); g.lineTo(0, 12); g.lineTo(-5, 8); g.lineTo(-14, 11); g.lineTo(-9, 4); g.closePath(); },
  juggernaut:(g) => { g.moveTo(0, -15); g.lineTo(11, -6); g.lineTo(15, 8); g.lineTo(6, 12); g.lineTo(-6, 12); g.lineTo(-15, 8); g.lineTo(-11, -6); g.closePath(); },
  phantom:   (g) => { g.moveTo(0, -18); g.lineTo(6, 2); g.lineTo(10, 12); g.lineTo(0, 7); g.lineTo(-10, 12); g.lineTo(-6, 2); g.closePath(); },
  tempest:   (g) => { g.moveTo(0, -16); g.lineTo(5, -4); g.lineTo(13, 10); g.lineTo(4, 6); g.lineTo(0, 12); g.lineTo(-4, 6); g.lineTo(-13, 10); g.lineTo(-5, -4); g.closePath(); },
  lancer:    (g) => { g.moveTo(0, -20); g.lineTo(4, 0); g.lineTo(8, 12); g.lineTo(3, 9); g.lineTo(0, 13); g.lineTo(-3, 9); g.lineTo(-8, 12); g.lineTo(-4, 0); g.closePath(); },
  scatter:   (g) => { g.moveTo(0, -14); g.lineTo(8, -6); g.lineTo(16, 6); g.lineTo(7, 9); g.lineTo(0, 13); g.lineTo(-7, 9); g.lineTo(-16, 6); g.lineTo(-8, -6); g.closePath(); },
  titanX:    (g) => { g.moveTo(0, -18); g.lineTo(10, -5); g.lineTo(14, 9); g.lineTo(5, 7); g.lineTo(0, 13); g.lineTo(-5, 7); g.lineTo(-14, 9); g.lineTo(-10, -5); g.closePath(); }
};

/* 永久强化:多级可升级,作用于每次出击。
 * prices[i] 为购买第 (i+1) 级所需星晶;max = prices.length。
 * 数值经平衡下调,靠逐级递增价格拉高总投入。
 * 兼容旧存档:boosts[id] === true 视为 1 级。 */
const BOOSTS = [
  { id: 'bomb1',  icon: '💣', name: '初始炸弹',   desc: '每次出击携带炸弹 +1/级', prices: [250, 650],             per: '+1 炸弹' },
  { id: 'hp25',   icon: '❤️', name: '装甲扩容',   desc: '初始生命上限 +15/级',    prices: [320, 560, 880, 1300], per: '+15 HP' },
  { id: 'xp10',   icon: '🔷', name: '经验调校',   desc: '经验获取 +6%/级',        prices: [400, 720, 1120],      per: '+6% 经验' },
  { id: 'shield', icon: '◇',  name: '出发护盾',   desc: 'Lv1 出击1层盾 · Lv2 盾额外减伤', prices: [560, 1120],    per: '护盾强化' }
];
/* 读取某强化的当前等级(兼容旧布尔存档) */
function boostLevel(id) {
  const v = Shop.boosts[id];
  if (v === true) return 1;
  return (+v) || 0;
}

const Shop = {
  crystal: 0,
  chips: 0,           // 战术芯片(挑战产出货币)
  owned: {},          // 皮肤/强化拥有表
  equipped: 'proto',  // 当前皮肤
  equippedShip: 'vanguard', // 当前机体
  ownedShip: {},      // 机体拥有表
  granted: [],        // 已发放奖励的成就
  boosts: {},         // 已购强化(值为等级数字;旧存档 true 兼容为 1 级)
  sprites: {},        // 皮肤预渲染精灵
  shipSprites: {},    // 机体x皮肤组合缓存
  lastEarn: 0,        // 上局获得星晶(结算展示)
  lastChips: 0,       // 上局获得芯片(结算展示)

  load() {
    try {
      this.crystal = +localStorage.getItem('deepstrike.crystal') || 0;
      this.chips = +localStorage.getItem('deepstrike.chips') || 0;
      this.owned = JSON.parse(localStorage.getItem('deepstrike.shopOwned')) || {};
      this.boosts = JSON.parse(localStorage.getItem('deepstrike.boosts')) || {};
      this.granted = JSON.parse(localStorage.getItem('deepstrike.granted')) || [];
      this.equipped = localStorage.getItem('deepstrike.skin') || 'proto';
      this.equippedShip = localStorage.getItem('deepstrike.ship') || 'vanguard';
      this.ownedShip = JSON.parse(localStorage.getItem('deepstrike.shipsOwned')) || {};
    } catch (e) { /* 忽略 */ }
    if (!this.ownedShip.vanguard) this.ownedShip.vanguard = true;
    if (!this.ownedShip[this.equippedShip]) this.equippedShip = 'vanguard';
    // 成就解锁款皮肤:成就达成即拥有(含历史成就补发)
    for (const sk of SKINS) {
      if (sk.ach && this.achUnlocked(sk.ach)) this.owned[sk.id] = true;
    }
    // 历史成就星晶补发
    if (typeof ACHIEVEMENTS !== 'undefined') {
      try {
        const ach = JSON.parse(localStorage.getItem('deepstrike.ach')) || {};
        for (const id in ach) {
          const a = ACHIEVEMENTS.find(x => x.id === id);
          if (a && !this.granted.includes(id)) {
            this.crystal += a.reward || 50;
            this.granted.push(id);
          }
        }
      } catch (e) { /* 忽略 */ }
    }
    if (!this.owned.proto) this.owned.proto = true;
    if (!this.owned[this.equipped]) this.equipped = 'proto';
    this.prerender();
    this.save();
  },

  achUnlocked(id) {
    try {
      const ach = JSON.parse(localStorage.getItem('deepstrike.ach')) || {};
      return !!ach[id];
    } catch (e) { return false; }
  },

  save() {
    try {
      localStorage.setItem('deepstrike.crystal', String(this.crystal));
      localStorage.setItem('deepstrike.chips', String(this.chips));
      localStorage.setItem('deepstrike.shopOwned', JSON.stringify(this.owned));
      localStorage.setItem('deepstrike.boosts', JSON.stringify(this.boosts));
      localStorage.setItem('deepstrike.granted', JSON.stringify(this.granted));
      localStorage.setItem('deepstrike.skin', this.equipped);
      localStorage.setItem('deepstrike.ship', this.equippedShip);
      localStorage.setItem('deepstrike.shipsOwned', JSON.stringify(this.ownedShip));
    } catch (e) { /* 忽略 */ }
  },

  /* 结算获得星晶(富豪成就联动) */
  addCrystal(n, game) {
    this.crystal += n;
    if (this.crystal >= 500) Ach.unlock('rich_500', game);
    if (this.crystal >= 1000) Ach.unlock('rich_1000', game);
    this.save();
  },

  /* 成就奖励发放(星晶 + 可能的皮肤),供 Ach.unlock 调用 */
  grantAchReward(a) {
    const reward = a.reward || 50;
    if (!this.granted.includes(a.id)) {
      this.crystal += reward;
      this.granted.push(a.id);
    }
    if (a.skin) this.owned[a.skin] = true;
    if (a.ship) this.ownedShip[a.ship] = true;
    this.save();
    this._checkSkinCollect();
    return reward;
  },

  _checkSkinCollect() {
    const ownedSkins = SKINS.filter(x => this.owned[x.id]).length;
    if (ownedSkins >= 3) Ach.unlock('skin_3');
    if (ownedSkins >= SKINS.length) Ach.unlock('skin_all');
  },

  buySkin(id) {
    const sk = SKINS.find(x => x.id === id);
    if (!sk || sk.ach || sk.rare || this.owned[id]) return { ok: false, msg: '无法购买' };
    if (this.crystal < sk.price) return { ok: false, msg: '星晶不足' };
    this.crystal -= sk.price;
    this.owned[id] = true;
    this.save();
    this._checkSkinCollect();
    return { ok: true, msg: '已购入「' + sk.name + '」' };
  },

  currentShip() {
    return SHIPS.find(x => x.id === this.equippedShip) || SHIPS[0];
  },

  buyShip(id) {
    const sh = SHIPS.find(x => x.id === id);
    if (!sh || sh.ach || sh.rare || this.ownedShip[id]) return { ok: false, msg: '无法购买' };
    if (this.crystal < sh.price) return { ok: false, msg: '星晶不足' };
    this.crystal -= sh.price;
    this.ownedShip[id] = true;
    this.save();
    return { ok: true, msg: '已购入「' + sh.name + '」' };
  },

  equipShip(id) {
    if (!this.ownedShip[id]) return false;
    this.equippedShip = id;
    this.save();
    return true;
  },

  shipSpriteFor(shipId, skinId) {
    const key = shipId + '|' + skinId;
    if (!this.shipSprites[key]) {
      const sh = SHIPS.find(x => x.id === shipId) || SHIPS[0];
      const sk = SKINS.find(x => x.id === skinId) || SKINS[0];
      const path = (g) => { g.beginPath(); SHIP_SHAPES[sh.id](g); };
      this.shipSprites[key] = {
        body: makeSprite(30, (g) => this._paintHull(g, sk, path)),
        flame: sk.flame, accent: sk.stroke, half: 30, fx: sk.fx || null
      };
    }
    return this.shipSprites[key];
  },

  shipSprite() {
    return this.shipSpriteFor(this.equippedShip, this.equipped);
  },

  boostLevel(id) { return boostLevel(id); },
  boostMax(b) { return b.prices.length; },
  /* 下一级价格;已满级返回 null */
  boostNextPrice(b) {
    const lv = boostLevel(b.id);
    return lv >= b.prices.length ? null : b.prices[lv];
  },
  /* 逐级升级永久强化 */
  buyBoost(id) {
    const b = BOOSTS.find(x => x.id === id);
    if (!b) return { ok: false, msg: '无法购买' };
    const lv = boostLevel(id);
    if (lv >= b.prices.length) return { ok: false, msg: '已满级' };
    const price = b.prices[lv];
    if (this.crystal < price) return { ok: false, msg: '星晶不足' };
    this.crystal -= price;
    this.boosts[id] = lv + 1;
    this.save();
    return { ok: true, msg: '「' + b.name + '」升至 Lv.' + (lv + 1) };
  },

  equipSkin(id) {
    if (!this.owned[id]) return false;
    this.equipped = id;
    this.save();
    return true;
  },

  /* ============================================================
   * 随机道具「星辉密匣」— 星晶购买/开启,可批量
   * 掉落分级(概率总和=1):
   *   junk    62%  纯星晶返还(60~120)
   *   common  25%  普通商城皮肤(未拥有;否则星晶补偿)
   *   rare    9%   稀有机体(phantom/juggernaut/lancer/scatter)或成就款皮肤
   *   epic    3%   绚丽皮肤(prism/celestial)
   *   mythic  1%   绚丽机体(titanX)
   * 抽到已拥有项 → 折算星晶补偿(避免重复浪费) */
  BOX_PRICE: 280,
  /* 星晶密匣走标准掉落表(与兑换标准档一致:绚丽 3.5%) */
  boxDrop() {
    return this._boxDropBoosted(0);
  },
  _grantPool(tier) {
    const rnd = () => (RNG ? RNG() : Math.random());
    let candidates = [];
    if (tier === 'common') {
      candidates = SKINS.filter(s => !s.ach && !s.rare && s.price > 0).map(s => ({ t: 'skin', item: s }));
    } else if (tier === 'rare') {
      candidates = SKINS.filter(s => s.ach).map(s => ({ t: 'skin', item: s }))
        .concat(SHIPS.filter(s => !s.ach && !s.rare && s.price > 0).map(s => ({ t: 'ship', item: s })));
    } else if (tier === 'epic') {
      candidates = SKINS.filter(s => s.rare).map(s => ({ t: 'skin', item: s }));
    } else { // mythic
      candidates = SHIPS.filter(s => s.rare).map(s => ({ t: 'ship', item: s }));
    }
    if (!candidates.length) { this.crystal += 100; return { tier, kind: 'crystal', amount: 100, name: '星晶 +100' }; }
    const pick = candidates[Math.floor(rnd() * candidates.length)];
    const ownedAlready = pick.t === 'skin' ? !!this.owned[pick.item.id] : !!this.ownedShip[pick.item.id];
    if (ownedAlready) {
      const comp = tier === 'mythic' ? 800 : tier === 'epic' ? 500 : tier === 'rare' ? 250 : 120;
      this.crystal += comp;
      return { tier, kind: 'crystal', amount: comp, dup: true, name: '重复·星晶 +' + comp + '(' + pick.item.name + ')' };
    }
    if (pick.t === 'skin') this.owned[pick.item.id] = true;
    else this.ownedShip[pick.item.id] = true;
    return { tier, kind: pick.t, id: pick.item.id, name: pick.item.name };
  },
  /* 批量开箱:先扣费,再逐个开;返回结果数组 */
  openBox(count) {
    count = Math.max(1, Math.min(50, count | 0));
    const cost = this.BOX_PRICE * count;
    if (this.crystal < cost) return { ok: false, msg: '星晶不足(需 ' + cost + ')' };
    this.crystal -= cost;
    const results = [];
    for (let i = 0; i < count; i++) results.push(this.boxDrop());
    this._checkSkinCollect();
    this.save();
    return { ok: true, results };
  },

  /* ============================================================
   * 兑换所 — 用战术芯片兑换密匣(不同档位对应不同好物概率)
   * 廉价匣走标准掉落表;高级匣抬高稀有+以上概率
   * ============================================================ */
  EXCHANGE: [
    { id: 'ex_basic', name: '标准密匣', chips: 12, boost: 0,   desc: '绚丽概率 2.5%~4%' },
    { id: 'ex_fine',  name: '精制密匣', chips: 30, boost: 1,   desc: '绚丽概率 5%~7.5%' },
    { id: 'ex_lux',   name: '奢华密匣', chips: 60, boost: 2,   desc: '绚丽概率 10%~15%' }
  ],
  /* boost 档位改写掉落概率 */
  _boxDropBoosted(boost) {
    const rnd = () => (RNG ? RNG() : Math.random());
    const r = rnd();
    // boost 0/1/2 对应的分档阈值(epic+mythic = 绚丽总概率)
    // 标准 3.5% | 精制 6.5% | 奢华 13%
    const T = boost === 2
      ? { junk: 0.30, common: 0.58, rare: 0.87, epic: 0.975 }  // epic 10.5% + mythic 2.5% = 13%
      : boost === 1
      ? { junk: 0.42, common: 0.68, rare: 0.935, epic: 0.985 } // epic 5% + mythic 1.5% = 6.5%
      : { junk: 0.60, common: 0.85, rare: 0.965, epic: 0.99 }; // epic 2.5% + mythic 1% = 3.5%
    if (r < T.junk) {
      const amt = 60 + Math.floor(rnd() * 61);
      this.crystal += amt;
      return { tier: 'junk', kind: 'crystal', amount: amt, name: '星晶 +' + amt };
    }
    if (r < T.common) return this._grantPool('common');
    if (r < T.rare) return this._grantPool('rare');
    if (r < T.epic) return this._grantPool('epic');
    return this._grantPool('mythic');
  },
  exchange(exId, count) {
    const ex = this.EXCHANGE.find(x => x.id === exId);
    if (!ex) return { ok: false, msg: '无效兑换' };
    count = Math.max(1, Math.min(20, count | 0));
    const cost = ex.chips * count;
    if (this.chips < cost) return { ok: false, msg: '芯片不足(需 ' + cost + ')' };
    this.chips -= cost;
    const results = [];
    for (let i = 0; i < count; i++) results.push(this._boxDropBoosted(ex.boost));
    this._checkSkinCollect();
    this.save();
    return { ok: true, results };
  },
  addChips(n) { this.chips += n; this.save(); },

  skinSprite() {
    return this.sprites[this.equipped] || this.sprites.proto;
  },

  accent() {
    const sk = SKINS.find(x => x.id === this.equipped) || SKINS[0];
    return sk.stroke;
  },

  /* 皮肤预渲染:与默认机体同路径,替换配色。
   * 越高级(fx)特效越华丽:更强辉光、双色描边、机身高光、绚丽款额外光环。 */
  _paintHull(g, sk, path) {
    const fx = sk.fx || {};
    const glow = fx.glow || 1;
    g.shadowColor = sk.stroke; g.shadowBlur = 14 * glow;
    path(g);
    g.fillStyle = sk.hull; g.fill();
    // 高级皮肤:机身线性高光,营造金属/流光质感
    if (fx.sheen) {
      g.save();
      g.clip();
      const grd = g.createLinearGradient(-14, -18, 14, 14);
      grd.addColorStop(0, 'rgba(255,255,255,0)');
      grd.addColorStop(0.45, fx.sheen);
      grd.addColorStop(0.55, fx.sheen);
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.globalAlpha = 0.35;
      g.fillStyle = grd; g.fillRect(-16, -20, 32, 34);
      g.restore();
    }
    // 描边:双色皮肤先粗副色再细主色,形成描边渐层
    if (fx.dual) {
      g.lineWidth = 3.2; g.strokeStyle = fx.dual; g.globalAlpha = 0.7; g.stroke();
      g.globalAlpha = 1;
    }
    g.lineWidth = 2; g.strokeStyle = sk.stroke; g.stroke();
    // 绚丽款:外层光环
    if (fx.halo || fx.rainbow) {
      g.shadowBlur = 22 * glow;
      g.lineWidth = 1; g.globalAlpha = 0.5;
      g.strokeStyle = fx.rainbow ? '#ffffff' : (fx.dual || sk.stroke);
      g.stroke();
      g.globalAlpha = 1;
    }
    g.shadowBlur = 0;
    g.fillStyle = sk.cockpit;
    g.beginPath(); g.arc(0, -4, sk.tier >= 2 ? 3.0 : 2.6, 0, TAU); g.fill();
    // 高阶座舱高光点
    if (sk.tier >= 2) {
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath(); g.arc(-0.8, -4.8, 1.0, 0, TAU); g.fill();
    }
  },

  prerender() {
    const vanguardPath = (g) => {
      g.beginPath();
      g.moveTo(0, -17); g.lineTo(9, 4); g.lineTo(14, 11); g.lineTo(5, 8);
      g.lineTo(0, 12); g.lineTo(-5, 8); g.lineTo(-14, 11); g.lineTo(-9, 4);
      g.closePath();
    };
    for (const sk of SKINS) {
      this.sprites[sk.id] = {
        body: makeSprite(30, (g) => this._paintHull(g, sk, vanguardPath)),
        flame: sk.flame,
        accent: sk.stroke,
        fx: sk.fx || null
      };
    }
  },

  /* 商城面板渲染 */
  renderPanel() {
    const $ = (id) => document.getElementById(id);
    $('shopCrystal').textContent = this.crystal + ' ★';
    const skinGrid = $('skinGrid');
    skinGrid.innerHTML = '';
    for (const sk of SKINS) {
      const owned = !!this.owned[sk.id];
      const equipped = this.equipped === sk.id;
      const card = document.createElement('div');
      card.className = 'shop-card' + (equipped ? ' using' : '');
      let action;
      if (equipped) action = '<button class="shop-btn" disabled>使用中</button>';
      else if (owned) action = '<button class="shop-btn primary" data-equip="' + sk.id + '">装 备</button>';
      else if (sk.rare) action = '<button class="shop-btn" disabled>🔒 未解锁 · 密匣获得</button>';
      else if (sk.ach) {
        const a = typeof ACHIEVEMENTS !== 'undefined' ? ACHIEVEMENTS.find(x => x.id === sk.ach) : null;
        action = '<button class="shop-btn" disabled>🔒 ' + (a ? a.name : '成就解锁') + '</button>';
      } else action = '<button class="shop-btn primary" data-buy="' + sk.id + '">★ ' + sk.price + '</button>';
      const tierCls = sk.tier ? ' tier' + sk.tier : '';
      card.className = 'shop-card' + (equipped ? ' using' : '') + tierCls;
      card.innerHTML =
        '<canvas class="skin-preview" width="64" height="64"></canvas>' +
        '<div class="shop-name">' + sk.name + (sk.tier === 3 ? ' ✦' : '') + '</div>' +
        '<div class="shop-desc">' + (sk.desc || (sk.ach ? '成就限定涂装' : '商城涂装')) + '</div>' +
        action;
      skinGrid.appendChild(card);
      // 迷你预览
      const cv = card.querySelector('canvas');
      const g = cv.getContext('2d');
      g.translate(32, 34);
      g.scale(1.5, 1.5);
      g.drawImage(this.sprites[sk.id].body, -30, -30, 60, 60);
    }
    // 机体区块
    const shipGrid = $('shipGrid');
    shipGrid.innerHTML = '';
    for (const sh of SHIPS) {
      const owned = !!this.ownedShip[sh.id];
      const equipped = this.equippedShip === sh.id;
      const card = document.createElement('div');
      card.className = 'shop-card' + (equipped ? ' using' : '');
      let action;
      if (equipped) action = '<button class="shop-btn" disabled>使用中</button>';
      else if (owned) action = '<button class="shop-btn primary" data-equips="' + sh.id + '">装 备</button>';
      else if (sh.rare) action = '<button class="shop-btn" disabled>🔒 未解锁 · 密匣获得</button>';
      else if (sh.ach) {
        const a = typeof ACHIEVEMENTS !== 'undefined' ? ACHIEVEMENTS.find(x => x.id === sh.ach) : null;
        action = '<button class="shop-btn" disabled>🔒 ' + (a ? a.name : '成就解锁') + '</button>';
      } else action = '<button class="shop-btn primary" data-buyship="' + sh.id + '">★ ' + sh.price + '</button>';
      if (sh.rare) card.className = 'shop-card tier3' + (equipped ? ' using' : '');
      const statLine = 'HP ' + sh.hp + ' · 速 ' + sh.speed + ' · 射 ' + Math.round(sh.fire * 1000) / 10;
      card.innerHTML =
        '<canvas class="skin-preview" width="64" height="64" data-shipview="' + sh.id + '"></canvas>' +
        '<div class="shop-name">' + sh.name + (sh.rare ? ' ✦' : '') + '</div>' +
        '<div class="shop-desc">' + sh.desc + '<br>' + statLine + '</div>' +
        action;
      shipGrid.appendChild(card);
      const cv = card.querySelector('canvas');
      const g = cv.getContext('2d');
      g.translate(32, 34); g.scale(1.5, 1.5);
      g.drawImage(this.shipSpriteFor(sh.id, this.equipped).body, -30, -30, 60, 60);
    }
    shipGrid.querySelectorAll('[data-equips]').forEach(el =>
      el.addEventListener('click', () => { this.equipShip(el.dataset.equips); this.renderPanel(); }));
    shipGrid.querySelectorAll('[data-buyship]').forEach(el =>
      el.addEventListener('click', () => { const r = this.buyShip(el.dataset.buyship); this.renderPanel(); r.ok && AudioSys.powerup(); }));

    const boostGrid = $('boostGrid');
    boostGrid.innerHTML = '';
    for (const b of BOOSTS) {
      const lv = boostLevel(b.id);
      const max = b.prices.length;
      const full = lv >= max;
      const next = full ? null : b.prices[lv];
      const card = document.createElement('div');
      card.className = 'shop-card boost' + (lv > 0 ? ' using' : '');
      const lvTag = '<span class="lv-tag">Lv.' + lv + '/' + max + '</span>';
      card.innerHTML =
        '<div class="shop-name"><i style="font-style:normal">' + b.icon + '</i> ' + b.name + ' ' + lvTag + '</div>' +
        '<div class="shop-desc">' + b.desc + '</div>' +
        (full ? '<button class="shop-btn" disabled>已满级</button>'
              : '<button class="shop-btn primary" data-buyb="' + b.id + '">' + (lv > 0 ? '升级 ' : '') + '★ ' + next + '</button>');
      boostGrid.appendChild(card);
    }
    // 随机道具「星辉密匣」区块
    const boxGrid = $('boxGrid');
    if (boxGrid) {
      boxGrid.innerHTML = '';
      const mk = (n) => {
        const cost = this.BOX_PRICE * n;
        const card = document.createElement('div');
        card.className = 'shop-card boost';
        card.innerHTML =
          '<div class="shop-name">🎁 星辉密匣 ×' + n + '</div>' +
          '<div class="shop-desc">开启获随机好物 · 绚丽皮肤/机体极低概率</div>' +
          '<button class="shop-btn primary" data-openbox="' + n + '">★ ' + cost + '</button>';
        boxGrid.appendChild(card);
      };
      mk(1); mk(10);
    }
    // 兑换所(战术芯片)
    const exGrid = $('exchangeGrid');
    if (exGrid) {
      const chipBal = $('shopChips');
      if (chipBal) chipBal.textContent = this.chips + ' ◈';
      exGrid.innerHTML = '';
      for (const ex of this.EXCHANGE) {
        const card = document.createElement('div');
        card.className = 'shop-card boost';
        card.innerHTML =
          '<div class="shop-name">🔧 ' + ex.name + '</div>' +
          '<div class="shop-desc">' + ex.desc + '</div>' +
          '<button class="shop-btn primary" data-ex="' + ex.id + '">◈ ' + ex.chips + '</button>';
        exGrid.appendChild(card);
      }
    }
    // 购买/装备事件
    skinGrid.querySelectorAll('[data-equip]').forEach(el =>
      el.addEventListener('click', () => { this.equipSkin(el.dataset.equip); this.renderPanel(); }));
    skinGrid.querySelectorAll('[data-buy]').forEach(el =>
      el.addEventListener('click', () => { const r = this.buySkin(el.dataset.buy); this.renderPanel(); r.ok && AudioSys.powerup(); }));
    boostGrid.querySelectorAll('[data-buyb]').forEach(el =>
      el.addEventListener('click', () => { const r = this.buyBoost(el.dataset.buyb); this.renderPanel(); r.ok && AudioSys.powerup(); }));
    const boxGridEl = $('boxGrid');
    if (boxGridEl) boxGridEl.querySelectorAll('[data-openbox]').forEach(el =>
      el.addEventListener('click', () => {
        const r = this.openBox(+el.dataset.openbox);
        if (!r.ok) { this._toast(r.msg); return; }
        AudioSys.powerup();
        this.showBoxResults(r.results, '星辉密匣');
        this.renderPanel();
      }));
    const exGridEl = $('exchangeGrid');
    if (exGridEl) exGridEl.querySelectorAll('[data-ex]').forEach(el =>
      el.addEventListener('click', () => {
        const r = this.exchange(el.dataset.ex, 1);
        if (!r.ok) { this._toast(r.msg); return; }
        AudioSys.powerup();
        this.showBoxResults(r.results, '兑换');
        this.renderPanel();
      }));
  },

  _toast(msg) {
    let t = document.getElementById('shopToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'shopToast';
      t.className = 'shop-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove('show'), 1600);
  },

  /* 开箱/兑换结果弹层 */
  showBoxResults(results, title) {
    const tierName = { junk: '星晶', common: '普通', rare: '稀有', epic: '绚丽', mythic: '传奇' };
    const overlay = document.getElementById('boxOverlay');
    const list = document.getElementById('boxResultList');
    const ttl = document.getElementById('boxResultTitle');
    if (!overlay || !list) {
      // 无弹层则退化为 toast 汇总
      const best = results.reduce((a, b) => (this._tierRank(b.tier) > this._tierRank(a.tier) ? b : a), results[0]);
      this._toast('开启完成 · 最佳:' + best.name);
      return;
    }
    if (ttl) ttl.textContent = title + ' · 共 ' + results.length + ' 次';
    list.innerHTML = '';
    for (const r of results) {
      const row = document.createElement('div');
      row.className = 'box-row tier-' + r.tier;
      row.innerHTML =
        '<span class="box-tier">' + (tierName[r.tier] || r.tier) + '</span>' +
        '<span class="box-item">' + r.name + '</span>';
      list.appendChild(row);
    }
    overlay.classList.remove('hidden');
  },
  _tierRank(t) { return { junk: 0, common: 1, rare: 2, epic: 3, mythic: 4 }[t] || 0; }
};
Shop.load();
