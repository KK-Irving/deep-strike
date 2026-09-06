'use strict';
/* ============================================================
 * 深空突袭 DEEP STRIKE — 机库商城系统
 * 星晶货币 / 战机皮肤(含成就解锁款) / 永久强化
 * ============================================================ */

/* 战机皮肤:涂装四色 + 引擎火焰双色;ach 指定对应解锁成就 */
const SKINS = [
  { id: 'proto',    name: '原型机·青',   price: 0,   hull: '#0f4b66', stroke: '#7ef3ff', cockpit: '#d9fbff', flame: ['rgba(120,230,255,0.9)', 'rgba(0,120,255,0)'], desc: '默认涂装' },
  { id: 'frost',    name: '霜语',         price: 150, hull: '#123a52', stroke: '#c8ecff', cockpit: '#eaf7ff', flame: ['rgba(200,236,255,0.9)', 'rgba(80,160,255,0)'] },
  { id: 'ember',    name: '烈焰',         price: 200, hull: '#4a1810', stroke: '#ff9a3c', cockpit: '#ffd9a8', flame: ['rgba(255,170,90,0.9)', 'rgba(255,60,0,0)'] },
  { id: 'violet',   name: '幽紫',         price: 260, hull: '#2a1240', stroke: '#c86bff', cockpit: '#eadfff', flame: ['rgba(200,107,255,0.9)', 'rgba(90,0,180,0)'] },
  { id: 'gold',     name: '黄金装甲',     price: 400, hull: '#4a3a10', stroke: '#ffd166', cockpit: '#fff3c8', flame: ['rgba(255,220,120,0.9)', 'rgba(255,140,0,0)'] },
  { id: 'crimson',  name: '猩红之刃',     ach: 'combo_60', hull: '#40101d', stroke: '#ff4d6d', cockpit: '#ffd6de', flame: ['rgba(255,110,130,0.9)', 'rgba(180,0,40,0)'] },
  { id: 'abyss',    name: '深渊指挥官',   ach: 'wave_20',  hull: '#06282a', stroke: '#2be8c8', cockpit: '#c8fff4', flame: ['rgba(80,230,200,0.9)', 'rgba(0,120,140,0)'] },
  { id: 'evoProto', name: '进化原型机',   ach: 'evo_3',    hull: '#12240a', stroke: '#9dff5a', cockpit: '#e8ffd6', flame: ['rgba(157,255,90,0.9)', 'rgba(40,140,0,0)'] },
  { id: 'phantomX', name: '幽灵X',        ach: 'boss_10',  hull: '#1a1a2e', stroke: '#8fa8ff', cockpit: '#dfe8ff', flame: ['rgba(143,168,255,0.8)', 'rgba(40,60,180,0)'] }
];

/* 永久强化:一次性买断,作用于每次出击 */
const BOOSTS = [
  { id: 'bomb1',  icon: '💣', name: '初始炸弹 +1', desc: '每次出击携带的炸弹 +1', price: 120 },
  { id: 'hp25',   icon: '❤️', name: '装甲扩容',     desc: '初始生命上限 +25',     price: 180 },
  { id: 'xp10',   icon: '🔷', name: '经验调校',     desc: '经验获取永久 +10%',    price: 220 },
  { id: 'shield', icon: '◇',  name: '出发护盾',     desc: '每次出击自带一层护盾', price: 300 }
];

const Shop = {
  crystal: 0,
  owned: {},          // 皮肤/强化拥有表
  equipped: 'proto',  // 当前皮肤
  granted: [],        // 已发放奖励的成就
  boosts: {},         // 已购强化
  sprites: {},        // 皮肤预渲染精灵
  lastEarn: 0,        // 上局获得星晶(结算展示)

  load() {
    try {
      this.crystal = +localStorage.getItem('deepstrike.crystal') || 0;
      this.owned = JSON.parse(localStorage.getItem('deepstrike.shopOwned')) || {};
      this.boosts = JSON.parse(localStorage.getItem('deepstrike.boosts')) || {};
      this.granted = JSON.parse(localStorage.getItem('deepstrike.granted')) || [];
      this.equipped = localStorage.getItem('deepstrike.skin') || 'proto';
    } catch (e) { /* 忽略 */ }
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
      localStorage.setItem('deepstrike.shopOwned', JSON.stringify(this.owned));
      localStorage.setItem('deepstrike.boosts', JSON.stringify(this.boosts));
      localStorage.setItem('deepstrike.granted', JSON.stringify(this.granted));
      localStorage.setItem('deepstrike.skin', this.equipped);
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
    if (!sk || sk.ach || this.owned[id]) return { ok: false, msg: '无法购买' };
    if (this.crystal < sk.price) return { ok: false, msg: '星晶不足' };
    this.crystal -= sk.price;
    this.owned[id] = true;
    this.save();
    this._checkSkinCollect();
    return { ok: true, msg: '已购入「' + sk.name + '」' };
  },

  buyBoost(id) {
    const b = BOOSTS.find(x => x.id === id);
    if (!b || this.boosts[id]) return { ok: false, msg: '无法购买' };
    if (this.crystal < b.price) return { ok: false, msg: '星晶不足' };
    this.crystal -= b.price;
    this.boosts[id] = true;
    this.save();
    return { ok: true, msg: '已购入「' + b.name + '」' };
  },

  equipSkin(id) {
    if (!this.owned[id]) return false;
    this.equipped = id;
    this.save();
    return true;
  },

  skinSprite() {
    return this.sprites[this.equipped] || this.sprites.proto;
  },

  accent() {
    const sk = SKINS.find(x => x.id === this.equipped) || SKINS[0];
    return sk.stroke;
  },

  /* 皮肤预渲染:与默认机体同路径,替换配色 */
  prerender() {
    for (const sk of SKINS) {
      this.sprites[sk.id] = {
        body: makeSprite(30, (g) => {
          g.shadowColor = sk.stroke; g.shadowBlur = 14;
          g.beginPath();
          g.moveTo(0, -17); g.lineTo(9, 4); g.lineTo(14, 11); g.lineTo(5, 8);
          g.lineTo(0, 12); g.lineTo(-5, 8); g.lineTo(-14, 11); g.lineTo(-9, 4);
          g.closePath();
          g.fillStyle = sk.hull; g.fill();
          g.lineWidth = 2; g.strokeStyle = sk.stroke; g.stroke();
          g.shadowBlur = 0;
          g.fillStyle = sk.cockpit;
          g.beginPath(); g.arc(0, -4, 2.6, 0, TAU); g.fill();
        }),
        flame: sk.flame,
        accent: sk.stroke
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
      else if (sk.ach) {
        const a = typeof ACHIEVEMENTS !== 'undefined' ? ACHIEVEMENTS.find(x => x.id === sk.ach) : null;
        action = '<button class="shop-btn" disabled>🔒 ' + (a ? a.name : '成就解锁') + '</button>';
      } else action = '<button class="shop-btn primary" data-buy="' + sk.id + '">★ ' + sk.price + '</button>';
      card.innerHTML =
        '<canvas class="skin-preview" width="64" height="64"></canvas>' +
        '<div class="shop-name">' + sk.name + '</div>' +
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
    const boostGrid = $('boostGrid');
    boostGrid.innerHTML = '';
    for (const b of BOOSTS) {
      const owned = !!this.boosts[b.id];
      const card = document.createElement('div');
      card.className = 'shop-card boost' + (owned ? ' using' : '');
      card.innerHTML =
        '<div class="shop-name"><i style="font-style:normal">' + b.icon + '</i> ' + b.name + '</div>' +
        '<div class="shop-desc">' + b.desc + '</div>' +
        (owned ? '<button class="shop-btn" disabled>已拥有</button>'
               : '<button class="shop-btn primary" data-buyb="' + b.id + '">★ ' + b.price + '</button>');
      boostGrid.appendChild(card);
    }
    // 购买/装备事件
    skinGrid.querySelectorAll('[data-equip]').forEach(el =>
      el.addEventListener('click', () => { this.equipSkin(el.dataset.equip); this.renderPanel(); }));
    skinGrid.querySelectorAll('[data-buy]').forEach(el =>
      el.addEventListener('click', () => { const r = this.buySkin(el.dataset.buy); this.renderPanel(); r.ok && AudioSys.powerup(); }));
    boostGrid.querySelectorAll('[data-buyb]').forEach(el =>
      el.addEventListener('click', () => { const r = this.buyBoost(el.dataset.buyb); this.renderPanel(); r.ok && AudioSys.powerup(); }));
  }
};
Shop.load();
