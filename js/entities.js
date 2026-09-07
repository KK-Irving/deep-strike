'use strict';
/* ============================================================
 * 深空突袭 DEEP STRIKE — 实体定义
 * 工具函数 / 粒子 / 光环 / 飘字 / 星空 / 玩家 / 敌机 / BOSS / 道具
 * ============================================================ */
const W = 480, H = 720;
const TAU = Math.PI * 2;
/* 可注入随机源:普通模式为 Math.random,每日挑战替换为按日期播种的确定性随机 */
let RNG = Math.random;
const rand = (a, b) => a + RNG() * (b - a);
const irand = (a, b) => Math.floor(a + RNG() * (b - a + 1));
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);

/* mulberry32 播种随机数生成器 */
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* 预渲染星空云气背景,运行时仅贴图 */
function createBackground() {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0a1030');
  grad.addColorStop(0.55, '#060a1e');
  grad.addColorStop(1, '#02040c');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  const blobs = [[0.2, 0.25, '#18305e'], [0.8, 0.45, '#2a1445'], [0.5, 0.8, '#0e2440']];
  for (const [bx, by, col] of blobs) {
    const r = 220;
    const rg = g.createRadialGradient(bx * W, by * H, 0, bx * W, by * H, r);
    rg.addColorStop(0, col);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.5;
    g.fillStyle = rg;
    g.fillRect(bx * W - r, by * H - r, r * 2, r * 2);
  }
  g.globalAlpha = 1;
  return c;
}

/* ============================================================
 * 精灵预渲染:带 shadowBlur 的静态机体只绘制一次到离屏画布,
 * 运行时 drawImage 贴图,避免逐帧 shadowBlur 的巨大开销
 * ============================================================ */
function makeSprite(half, paint) {
  const c = document.createElement('canvas');
  c.width = c.height = half * 4;   // 2x 超采样
  const g = c.getContext('2d');
  g.scale(2, 2);
  g.translate(half, half);
  paint(g);
  return c;
}

const SPRITES = { enemy: {}, power: {} };

function initSprites() {
  const enemyPaint = (color, fill, path, dotR, dotY) => (g) => {
    g.shadowColor = color; g.shadowBlur = 9;
    g.beginPath(); path(g); g.closePath();
    g.fillStyle = fill; g.fill();
    g.lineWidth = 2; g.strokeStyle = color; g.stroke();
    g.shadowBlur = 0;
    g.fillStyle = color;
    g.beginPath(); g.arc(0, dotY, dotR, 0, TAU); g.fill();
  };
  const enemyDefs = {
    drone:  { color: '#ff4d6d', fill: '#42101d', half: 22, baseR: 11, dotR: 3, dotY: 0,
      path: (g) => { g.moveTo(0, 12); g.lineTo(10, -9); g.lineTo(0, -4); g.lineTo(-10, -9); } },
    waver:  { color: '#ff7ab8', fill: '#40152c', half: 24, baseR: 13, dotR: 3, dotY: 1,
      path: (g) => { g.moveTo(0, 14); g.lineTo(11, 0); g.lineTo(0, -11); g.lineTo(-11, 0); } },
    tank:   { color: '#ff9a3c', fill: '#40230c', half: 32, baseR: 21, dotR: 6, dotY: 1,
      path: (g) => { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; const px = Math.cos(a) * 21, py = Math.sin(a) * 21; i ? g.lineTo(px, py) : g.moveTo(px, py); } } },
    bomber: { color: '#ff6a3c', fill: '#40180c', half: 18, baseR: 9, dotR: 2.5, dotY: -1,
      path: (g) => { g.moveTo(0, 11); g.lineTo(9, -8); g.lineTo(0, -3); g.lineTo(-9, -8); } },
    shielder: { color: '#5ad0ff', fill: '#0e2c40', half: 26, baseR: 15, dotR: 5, dotY: 0,
      path: (g) => { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const px = Math.cos(a) * 15, py = Math.sin(a) * 15; i ? g.lineTo(px, py) : g.moveTo(px, py); } } },
    mender: { color: '#7dff9e', fill: '#103a1e', half: 24, baseR: 13, dotR: 4, dotY: 0,
      path: (g) => { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const px = Math.cos(a) * 13, py = Math.sin(a) * 13; i ? g.lineTo(px, py) : g.moveTo(px, py); } } },
    sniper: { color: '#c86bff', fill: '#2a1240', half: 24, baseR: 13, dotR: 3, dotY: 1,
      path: (g) => { g.moveTo(0, 13); g.lineTo(10, -10); g.lineTo(0, -3); g.lineTo(-10, -10); } }
  };
  for (const [type, d] of Object.entries(enemyDefs)) {
    SPRITES.enemy[type] = {
      baseR: d.baseR, half: d.half,
      body: makeSprite(d.half, enemyPaint(d.color, d.fill, d.path, d.dotR, d.dotY)),
      flash: makeSprite(d.half, enemyPaint('#ffffff', '#ffffff', d.path, d.dotR, d.dotY))
    };
  }
  // 玩家机体(引擎火焰/护盾/判定点动态绘制)
  SPRITES.player = {
    half: 30,
    body: makeSprite(30, (g) => {
      g.shadowColor = '#37e2ff'; g.shadowBlur = 14;
      g.beginPath();
      g.moveTo(0, -17); g.lineTo(9, 4); g.lineTo(14, 11); g.lineTo(5, 8);
      g.lineTo(0, 12); g.lineTo(-5, 8); g.lineTo(-14, 11); g.lineTo(-9, 4);
      g.closePath();
      g.fillStyle = '#0f4b66'; g.fill();
      g.lineWidth = 2; g.strokeStyle = '#7ef3ff'; g.stroke();
      g.shadowBlur = 0;
      g.fillStyle = '#d9fbff';
      g.beginPath(); g.arc(0, -4, 2.6, 0, TAU); g.fill();
    })
  };
  // BOSS 舰体(旋转外环与核心动态绘制,双变体配色)
  SPRITES.boss = {};
  for (const [vname, vcfg] of Object.entries(BOSS_VARIANTS)) {
    SPRITES.boss[vname] = {
      half: 84,
      body: makeSprite(84, (g) => {
        g.shadowColor = vcfg.glow; g.shadowBlur = 22;
        g.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * TAU + Math.PI / 6;
          const px = Math.cos(a) * 44, py = Math.sin(a) * 44;
          i ? g.lineTo(px, py) : g.moveTo(px, py);
        }
        g.closePath();
        g.fillStyle = vcfg.hull; g.fill();
        g.lineWidth = 3; g.strokeStyle = vcfg.color; g.stroke();
        g.shadowBlur = 0;
        g.fillStyle = vcfg.turret;
        g.fillRect(-54, -8, 14, 26);
        g.fillRect(40, -8, 14, 26);
      })
    };
  }
  // 道具盒
  for (const [type, cfg] of Object.entries(PowerUp.CFG)) {
    SPRITES.power[type] = {
      half: 28,
      c: makeSprite(28, (g) => {
        g.shadowColor = cfg.color; g.shadowBlur = 14;
        roundRectPath(g, -11, -11, 22, 22, 5);
        g.fillStyle = '#0b1220'; g.fill();
        g.lineWidth = 2; g.strokeStyle = cfg.color; g.stroke();
        g.shadowBlur = 0;
        g.fillStyle = cfg.color;
        g.font = 'bold 13px "Segoe UI", sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(cfg.label, 0, 1);
      })
    };
  }
}

class Particle {
  constructor(x, y, vx, vy, life, size, color) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = life; this.max = life; this.size = size; this.color = color;
    this.dead = false;
  }
  update(dt) {
    const d = Math.exp(-2.2 * dt);
    this.vx *= d; this.vy *= d;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    const a = Math.max(0, this.life / this.max);
    ctx.globalAlpha = a;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * (0.5 + a * 0.5), 0, TAU);
    ctx.fill();
  }
}

class Ring {
  constructor(x, y, color, maxR = 90, life = 0.5) {
    this.x = x; this.y = y; this.color = color;
    this.maxR = maxR; this.life = life; this.max = life; this.dead = false;
  }
  update(dt) {
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    const f = 1 - this.life / this.max;
    ctx.globalAlpha = Math.max(0, this.life / this.max);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3 * (1 - f) + 1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.maxR * f, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

class FloatText {
  constructor(x, y, text, color, size = 14) {
    this.x = x; this.y = y; this.text = text; this.color = color; this.size = size;
    this.life = 0.9; this.max = 0.9; this.dead = false;
  }
  update(dt) {
    this.y -= 34 * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = clamp(this.life / 0.4, 0, 1);
    ctx.fillStyle = this.color;
    ctx.font = 'bold ' + this.size + 'px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

/* 三层视差星空 */
class Starfield {
  constructor() {
    this.stars = [];
    for (let i = 0; i < 100; i++) this.stars.push(this._make(true));
  }
  _make(anyY) {
    const layer = irand(0, 2);
    return {
      layer,
      x: rand(0, W),
      y: anyY ? rand(0, H) : rand(-30, -2),
      speed: [26, 55, 105][layer],
      size: [1, 1.6, 2.4][layer],
      alpha: [0.35, 0.6, 0.95][layer],
      hue: Math.random() < 0.25 ? '#8fd0ff' : '#ffffff'
    };
  }
  update(dt, factor = 1) {
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      s.y += s.speed * factor * dt;
      if (s.y > H + 2) this.stars[i] = this._make(false);
    }
  }
  draw(ctx) {
    for (const s of this.stars) {
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = s.hue;
      ctx.fillRect(s.x, s.y, s.size, s.size * 2.2);
    }
    ctx.globalAlpha = 1;
  }
}

/* ============================================================
 * 玩家
 * ============================================================ */
class Player {
  constructor() { this.reset(); }
  reset(shipDef) {
    shipDef = shipDef || {};
    this.x = W / 2; this.y = H - 90;
    this.r = 6; this.speed = shipDef.speed || 330;
    // 生命值系统:数值化生命,上限由机体/等级与卡片成长
    this.maxHp = shipDef.hp || 100; this.hp = this.maxHp;
    this.fireBase = shipDef.fire || 0.12;
    this.armorPct = 0; this.regenRate = 0; this.leechPer = 0;
    this.undyingUsed = false;
    this.weapon = 1; this.bombs = 2;
    this.shield = false; this.invuln = 2.2;
    this.fireCd = 0; this.alive = true;
    this.beamOn = false;
    this.engine = 0; this.showHitbox = false;
    // 肉鸽模组衍生数值(由 game._recalc 刷新)
    this.dmgBonus = 0; this.fireInterval = 0.12; this.magnetR = 140;
    this.homingCd = 0; this.webCd = 0; this.shieldCd = 0; this.shieldInterval = 12;
    this.wingAngle = 0;
  }
  update(dt, game) {
    const k = game.keys;
    let dx = 0, dy = 0;
    if (k.left) dx -= 1;
    if (k.right) dx += 1;
    if (k.up) dy -= 1;
    if (k.down) dy += 1;
    if (game.touch.active) {
      const f = Math.min(1, dt * 14);
      this.x += (game.touch.x - this.x) * f;
      this.y += (game.touch.y - this.y) * f;
    } else if (dx || dy) {
      const len = Math.hypot(dx, dy);
      const sp = this.speed * (k.slow ? 0.42 : 1);
      this.x += dx / len * sp * dt;
      this.y += dy / len * sp * dt;
    }
    this.x = clamp(this.x, 16, W - 16);
    this.y = clamp(this.y, 60, H - 22);
    this.showHitbox = !!k.slow;
    this.engine += dt * 26;
    this.invuln = Math.max(0, this.invuln - dt);
    // 纳米修复:持续回复
    if (this.regenRate > 0 && this.hp < this.maxHp)
      this.hp = Math.min(this.maxHp, this.hp + this.regenRate * dt);
    // 激光主炮:按住开火时持续光束
    this.beamOn = false;
    if (game.mods.laser && (k.fire || game.autoFire)) {
      this.beamOn = true;
      game.beamTick(dt);
    }
    this.fireCd -= dt;
    if ((k.fire || game.autoFire) && this.fireCd <= 0) {
      this._fire(game);
      this.fireCd = this.fireInterval;
    }
    // 追踪导弹:周期自动发射
    if (game.mods.homing) {
      this.homingCd -= dt;
      if (this.homingCd <= 0) {
        this.homingCd = 2.4 - game.mods.homing * 0.35;
        this._fireHoming(game);
      }
    }
    // 羁绊「天罗地网」:全向环形弹
    if (game.bonds.includes('web')) {
      this.webCd -= dt;
      if (this.webCd <= 0) {
        this.webCd = 0.9;
        const n = 10, dmg = 1 + this.dmgBonus;
        for (let i = 0; i < n; i++) {
          const a = i / n * TAU + this.engine * 0.4;
          game.playerBullets.push({
            x: this.x, y: this.y, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300,
            r: 2.6, dmg, color: '#a5ffd6', dead: false, pierce: 0, split: 0
          });
        }
        AudioSys.web();
      }
    }
    // 羁绊装备「护盾发生器」:自动充能护盾
    if (game.mods.shieldgen && !this.shield) {
      this.shieldCd -= dt;
      if (this.shieldCd <= 0) {
        this.shield = true;
        AudioSys.powerup();
        game.floats.push(new FloatText(this.x, this.y - 24, '护盾充能完毕', '#4db8ff', 12));
      }
    }
    if (Math.random() < 0.6) {
      // 尾焰粒子随皮肤配色
      const accent = (typeof Shop !== 'undefined') ? Shop.accent() : '#39d7ff';
      game._addParticle(new Particle(
        this.x + rand(-2.5, 2.5), this.y + 13,
        rand(-14, 14), rand(90, 160),
        rand(0.12, 0.28), rand(1.2, 2.4),
        Math.random() < 0.7 ? accent : '#bff7ff'));
    }
  }
  _fire(game) {
    const P = game.playerBullets;
    const m = game.mods;
    const dmg = 1 + this.dmgBonus;
    const pierce = (m.pierce || 0) + (game.evo.pierce ? 2 : 0);
    const split = m.split || 0;
    const mk = (ox, oy, vx, vy, extra) =>
      P.push(Object.assign({ x: this.x + ox, y: this.y + oy, vx, vy, r: 3, dmg, color: '#dffaff', dead: false, pierce, split }, extra || {}));
    if (m.railgun) {
      // 轨道炮:高速磁轨弹,单发高伤,天然强贯穿(质变路线)。与暴击/贯穿强联动
      const railPierce = 3 + 2 * (m.pierce || 0) + (game.bonds.includes('railpierce') ? 99 : 0)
        + (game.evo.railgun ? 99 : 0);
      const base = 6 + 3 * (m.railgun - 1) + 2 * this.dmgBonus + 1.5 * (this.weapon - 1);
      const railDmg = Math.round(base * (game.evo.railgun ? 1.6 : 1));
      mk(0, -16, 0, -1250, { color: '#bfe4ff', r: 4.4, pierce: railPierce, split, dmg: railDmg, rail: true });
      for (let i = 1; i <= (m.multi || 0); i++) {
        mk(-8 - i * 9, -10, 0, -1250, { color: '#bfe4ff', r: 3.6, pierce: railPierce, split, dmg: railDmg, rail: true });
        mk(8 + i * 9, -10, 0, -1250, { color: '#bfe4ff', r: 3.6, pierce: railPierce, split, dmg: railDmg, rail: true });
      }
    } else if (m.tesla) {
      // 电弧发生器:发射一颗"引雷弹",命中即触发链式闪电(在 game 层结算跳跃)
      const chains = 1 + (m.tesla - 1) + (m.multi || 0) + (game.bonds.includes('teslachain') ? 1 : 0);
      const teslaDmg = 2 + this.dmgBonus + (game.evo.tesla ? 2 : 0);
      for (let c = 0; c < chains; c++) {
        const ox = chains === 1 ? 0 : (c / (chains - 1) - 0.5) * 22;
        mk(ox, -12, ox * 6, -900, { color: '#aef0ff', r: 3.2, pierce: 0, split: 0, dmg: teslaDmg, tesla: true });
      }
    } else if (m.spread) {
      // 散射炮:宽扇弹幕(质变路线)。卡片协同 —— 弹丸继承 pierce/split,evo 取消衰减并加宽扇形
      const n = 5 + 2 * (m.spread - 1) + 2 * (m.multi || 0) + (this.weapon - 1)
        + (game.bonds.includes('suppress') ? 2 : 0) + (game.evo.spread ? 6 : 0);
      const fade = game.evo.spread ? {} : { life: 0.42 };
      const spPierce = Math.floor(pierce / 2) + (game.evo.spread ? 1 : 0);
      const arc = game.evo.spread ? 0.92 : 0.6;
      const rounds = game.bonds.includes('scatterstorm') ? 2 : 1;
      for (let rr = 0; rr < rounds; rr++)
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (n === 1 ? 0 : (i / (n - 1) - 0.5) * arc) + (rr ? 0.12 : 0);
        mk(0, -12, Math.cos(a) * 520, Math.sin(a) * 520,
          Object.assign({ color: '#ffe9a8', r: 2.6, pierce: spPierce, split }, fade));
      }
    } else if (!m.laser) {
      switch (this.weapon) {
        case 1: mk(0, -14, 0, -540); break;
        case 2: mk(-6, -10, 0, -540); mk(6, -10, 0, -540); break;
        case 3: mk(0, -16, 0, -560); mk(-9, -6, -75, -510); mk(9, -6, 75, -510); break;
        case 4: mk(-5, -12, 0, -560); mk(5, -12, 0, -560); mk(-11, -5, -130, -490); mk(11, -5, 130, -490); break;
        default: mk(0, -16, 0, -580); mk(-7, -11, -45, -545); mk(7, -11, 45, -545); mk(-13, -4, -160, -480); mk(13, -4, 160, -480); break;
      }
      // 并列弹道:主炮两侧追加直射弹
      for (let i = 1; i <= (m.multi || 0); i++) {
        mk(-7 - i * 8, -8, 0, -540);
        mk(7 + i * 8, -8, 0, -540);
      }
    }
    // 侧翼弹:更开斜角的追加弹对(不受质变影响)
    let sideN = m.side || 0;
    if (game.bonds.includes('suppress')) sideN += 2;
    if (game.shipDef && game.shipDef.perkSide) sideN += game.shipDef.perkSide;
    for (let i = 1; i <= sideN; i++) {
      const vx = 95 + i * 55;
      mk(-10, -4, -vx, -500);
      mk(10, -4, vx, -500);
    }
    // 尾炮
    for (let i = 1; i <= (m.rear || 0); i++) {
      mk(-5, 10, -70, 380);
      mk(5, 10, 70, 380);
    }
    AudioSys.shoot();
  }
  _fireHoming(game) {
    const lvl = game.mods.homing;
    const n = 1 + lvl + (game.evo.homing ? 3 : 0);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.55;
      game.playerBullets.push({
        x: this.x, y: this.y - 8,
        vx: Math.cos(a) * 300, vy: Math.sin(a) * 300,
        r: 4, dmg: 2 + this.dmgBonus + (game.evo.homing ? 2 : 0), color: '#ffd166', dead: false,
        homing: true, life: 2.6, pierce: 0, split: 0
      });
    }
    AudioSys.missile();
  }
  draw(ctx) {
    if (!this.alive) return;
    const blink = this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (blink) ctx.globalAlpha = 0.35;
    // 引擎火焰(随皮肤配色)
    const skin = typeof Shop !== 'undefined' ? Shop.skinSprite() : null;
    const flame = skin ? skin.flame : ['rgba(120,230,255,0.9)', 'rgba(0,120,255,0)'];
    const fl = 9 + Math.sin(this.engine) * 3;
    const fg = ctx.createLinearGradient(0, 10, 0, 24 + fl);
    fg.addColorStop(0, flame[0]);
    fg.addColorStop(1, flame[1]);
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-3.5, 11); ctx.lineTo(3.5, 11); ctx.lineTo(0, 13 + fl + 6);
    ctx.closePath(); ctx.fill();
    // 机体(预渲染精灵,应用当前机体造型与皮肤)
    const spr = (typeof Shop !== 'undefined') ? Shop.shipSprite() : (skin || SPRITES.player);
    ctx.drawImage(spr.body, -spr.half, -spr.half, spr.half * 2, spr.half * 2);
    ctx.globalAlpha = 1;
    // 护盾
    if (this.shield) {
      const sc = skin ? skin.accent : '#5ac8ff';
      ctx.strokeStyle = sc;
      ctx.globalAlpha = 0.55 + Math.sin(this.engine * 0.6) * 0.25;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 17, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // 低速判定点
    if (this.showHitbox) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }
}

/* ============================================================
 * 敌机:drone 直冲 / waver 蛇形 / tank 重装 / sniper 狙击
 * 精英词缀:swift 迅捷 / iron 铁壁 / splitter 分裂 / berserk 狂暴
 * ============================================================ */
const ELITE_CFG = {
  swift:     { name: '迅捷', color: '#37e2ff', desc: '高速机动' },
  iron:      { name: '铁壁', color: '#c9d4e3', desc: '装甲强化' },
  splitter:  { name: '分裂', color: '#51e08a', desc: '死亡分裂' },
  berserk:   { name: '狂暴', color: '#ff6a3c', desc: '火力狂暴' },
  phantom:   { name: '幽影', color: '#b8c6ff', desc: '周期相位免疫' },
  vengeance: { name: '复仇', color: '#ffd166', desc: '死亡弹幕反扑' }
};

class Enemy {
  constructor(type, x, wave, elite, env) {
    env = env || { hpMul: 1, spdMul: 1, fireMul: 1 };
    this.type = type;
    this.x = x; this.y = -26; this.baseX = x;
    this.t = 0; this.dead = false; this.flash = 0;
    const hpM = 1 + (wave - 1) * 0.16;
    const spM = 1 + (wave - 1) * 0.045;
    if (type === 'drone') {
      this.r = 11; this.hp = Math.max(1, Math.round(1 * hpM)); this.score = 100;
      this.vy = (130 + rand(-15, 45)) * spM;
      this.amp = rand(20, 60); this.freq = rand(1.5, 2.6);
      this.color = '#ff4d6d'; this.fill = '#42101d';
    } else if (type === 'waver') {
      this.r = 13; this.hp = Math.max(2, Math.round(2 * hpM)); this.score = 150;
      this.vy = 85 * spM; this.amp = rand(60, 130); this.freq = rand(1.2, 2.2);
      this.fireCd = rand(1.5, 3);
      this.color = '#ff7ab8'; this.fill = '#40152c';
    } else if (type === 'tank') {
      this.r = 21; this.hp = Math.max(5, Math.round(6 * hpM)); this.score = 300;
      this.vy = 42 * spM; this.fireCd = 1.4;
      this.color = '#ff9a3c'; this.fill = '#40230c';
    } else if (type === 'bomber') {
      // 自爆蜂:追踪俯冲,接近玩家或引信耗尽时自爆成环弹;击坠可拆除
      this.r = 9; this.hp = Math.max(1, Math.round(1 * hpM)); this.score = 200;
      this.vy = (150 + wave * 4) * spM;
      this.fuse = rand(2.6, 3.6);
      this.dvx = 0; this.dvy = this.vy;
      this.color = '#ff6a3c'; this.fill = '#40180c';
    } else if (type === 'shielder') {
      // 护盾兵:正面护盾周期开合,格挡自下而上的陡角弹道
      this.r = 15; this.hp = Math.max(8, Math.round(9 * hpM)); this.score = 400;
      this.vy = 34 * spM;
      this.shieldCycle = 2.4; this.shieldOff = 0;
      this.color = '#5ad0ff'; this.fill = '#0e2c40';
    } else if (type === 'mender') {
      // 治疗机:周期性治疗周围友军,优先集火目标
      this.r = 13; this.hp = Math.max(6, Math.round(6 * hpM)); this.score = 350;
      this.vy = 30 * spM; this.amp = rand(40, 80); this.freq = rand(0.8, 1.4);
      this.healCd = rand(2, 3);
      this.color = '#7dff9e'; this.fill = '#103a1e';
    } else { // sniper
      this.r = 13; this.hp = Math.max(2, Math.round(3 * hpM)); this.score = 250;
      this.vy = 170 * spM; this.stopY = rand(90, 210); this.stopped = false;
      this.fireCd = rand(0.8, 1.6);
      this.color = '#c86bff'; this.fill = '#2a1240';
    }
    // 无尽模式环境:威胁等级与波次词缀
    this.hp = Math.round(this.hp * env.hpMul);
    this.vy *= env.spdMul;
    if (this.fireCd !== undefined) this.fireCd *= env.fireMul;
    this.fireMul = env.fireMul;
    // 精英强化:血量 ×4、体型 ×1.3、分数 ×4,词缀附加特性(支持双词缀组合)
    this.elite = elite ? (Array.isArray(elite) ? elite : [elite]) : null;
    if (this.elite) {
      this.hp = Math.round(this.hp * 4);
      this.r = this.r * 1.3;
      this.score *= 4;
      this.eliteName = '精英·' + this.elite.map(a => ELITE_CFG[a].name).join('+');
      this.eliteColor = this.elite.length > 1 ? '#ff8fd0' : ELITE_CFG[this.elite[0]].color;
      if (this.elite.includes('swift')) this.vy *= 1.6;
      if (this.elite.includes('iron')) { this.hp *= 1.6; this.vy *= 0.7; }
      if (this.elite.includes('berserk')) { this.vy *= 1.2; if (this.fireCd !== undefined) this.fireCd *= 0.45; }
      if (this.elite.includes('phantom')) { this.phaseCd = 2.2; this.elitePhased = false; }
      if (this.fireCd !== undefined && !this.elite.includes('berserk')) this.fireCd *= 0.6;
    }
    this.maxHp = this.hp;
  }

  update(dt, game) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    // 幽影词缀:周期相位(免疫伤害且停止开火)
    if (this.elite && this.elite.includes('phantom')) {
      if (this.elitePhased) {
        this.phaseDur -= dt;
        if (this.phaseDur <= 0) this.elitePhased = false;
      } else {
        this.phaseCd -= dt;
        if (this.phaseCd <= 0) { this.elitePhased = true; this.phaseDur = 1.0; this.phaseCd = 2.6; }
      }
    }
    // 精英狂暴:生命低于 30% 时激怒(加速+增频)
    if (this.elite && !this.enraged && this.hp > 0 && this.hp < this.maxHp * 0.3) {
      this.enraged = true;
      this.vy *= 1.3;
      this.fireMul = (this.fireMul || 1) * 0.7;
    }
    const onScreen = this.y > 0;
    const canFire = onScreen && !this.elitePhased;
    if (this.type === 'drone') {
      this.y += this.vy * dt;
      this.x = clamp(this.baseX + Math.sin(this.t * this.freq) * this.amp, 16, W - 16);
    } else if (this.type === 'waver') {
      this.y += this.vy * dt;
      this.x = clamp(this.baseX + Math.sin(this.t * this.freq) * this.amp, 16, W - 16);
      this.fireCd -= dt;
      if (canFire && this.fireCd <= 0) {
        this.fireCd = rand(1.8, 3.2) * this.fireMul;
        game.enemyShot(this.x, this.y + this.r, game.aimedAngle(this.x, this.y), 150 + game.effWave() * 5);
        AudioSys.enemyShoot();
      }
    } else if (this.type === 'tank') {
      this.y += this.vy * dt;
      this.fireCd -= dt;
      if (canFire && this.fireCd <= 0) {
        this.fireCd = 2.4 * this.fireMul;
        for (let i = -1; i <= 1; i++)
          game.enemyShot(this.x, this.y + this.r, Math.PI / 2 + i * 0.4, 140 + game.effWave() * 4, 'orange');
        AudioSys.enemyShoot();
      }
    } else if (this.type === 'bomber') {
      // 追踪俯冲 + 引信
      const aim = game.aimedAngle(this.x, this.y);
      const f = Math.min(1, 3.2 * dt);
      this.dvx += (Math.cos(aim) * this.vy - this.dvx) * f;
      this.dvy += (Math.sin(aim) * this.vy - this.dvy) * f;
      this.x = clamp(this.x + this.dvx * dt, 14, W - 14);
      this.y += this.dvy * dt;
      this.fuse -= dt;
      const pdx = game.player.x - this.x, pdy = game.player.y - this.y;
      if (!this.dead && (pdx * pdx + pdy * pdy < 8100 || this.fuse <= 0)) {
        this.dead = true;
        for (let i = 0; i < 8; i++)
          game.enemyShot(this.x, this.y, i / 8 * TAU + 0.3, 130 + game.effWave() * 3);
        game._explode(this.x, this.y, 14, '#ff9a3c', 0.9);
        game.shake(5, 0.2);
        AudioSys.explode(false);
      }
    } else if (this.type === 'shielder') {
      this.y += this.vy * dt;
      this.x = clamp(this.baseX + Math.sin(this.t * 0.7) * 30, 20, W - 20);
      if (this.shieldOff > 0) {
        this.shieldOff -= dt;
      } else {
        this.shieldCycle -= dt;
        if (this.shieldCycle <= 0) { this.shieldOff = 1.2; this.shieldCycle = 2.4; }
      }
    } else if (this.type === 'mender') {
      this.y += this.vy * dt;
      this.x = clamp(this.baseX + Math.sin(this.t * this.freq) * this.amp, 20, W - 20);
      this.healCd -= dt;
      if (this.healPulse > 0) this.healPulse -= dt;
      if (canFire && this.healCd <= 0) {
        this.healCd = 4;
        let healed = 0;
        for (const o of game.enemies) {
          if (o === this || o.dead || o.hp >= o.maxHp || o.elitePhased) continue;
          const ddx = o.x - this.x, ddy = o.y - this.y;
          if (ddx * ddx + ddy * ddy < 19600) { o.hp = Math.min(o.maxHp, o.hp + 4); healed++; }
        }
        if (healed) {
          this.healPulse = 0.35;
          game.rings.push(new Ring(this.x, this.y, '#7dff9e', 140, 0.4));
        }
      }
    } else { // sniper
      if (!this.stopped) {
        this.y += this.vy * dt;
        if (this.y >= this.stopY) this.stopped = true;
      } else {
        this.x = clamp(this.baseX + Math.sin(this.t * 0.8) * 40, 30, W - 30);
        this.fireCd -= dt;
        if (canFire && this.fireCd <= 0) {
          this.fireCd = Math.max(1.2, 2.6 - game.wave * 0.12) * this.fireMul;
          game.enemyShot(this.x, this.y + this.r, game.aimedAngle(this.x, this.y), 210 + game.effWave() * 6);
          AudioSys.enemyShoot();
        }
      }
    }
    if (this.y > H + 40) this.dead = true;
  }

  damage(n, game, silent) {
    if (this.dead || this.elitePhased) return;
    this.hp -= n;
    if (!silent) this.flash = 0.08;
    if (this.hp <= 0) {
      this.dead = true;
      // 分裂词缀:死亡时裂解为 3 架无人机
      if (this.elite && this.elite.includes('splitter')) {
        for (let i = -1; i <= 1; i++)
          game.enemies.push(new Enemy('drone', clamp(this.x + i * 30, 30, W - 30), game.wave, null, game._env));
      }
      // 复仇词缀:死亡时向四周释放环形弹幕
      if (this.elite && this.elite.includes('vengeance')) {
        const n = 12;
        for (let i = 0; i < n; i++)
          game.enemyShot(this.x, this.y, i / n * TAU, 140 + game.effWave() * 4);
        AudioSys.enemyShoot();
      }
      game.killEnemy(this);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.elitePhased) ctx.globalAlpha = 0.3; // 相位状态半透明
    // 精英光环与名牌
    if (this.elite) {
      const pr = this.r + 8 + Math.sin(this.t * 5) * 2.5;
      ctx.strokeStyle = this.eliteColor;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(0, 0, pr, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.28;
      ctx.beginPath(); ctx.arc(0, 0, pr + 5, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = this.eliteColor;
      ctx.font = 'bold 10px "Segoe UI", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.eliteName, 0, -this.r - 16);
    }
    // 机体(预渲染精灵,精英按半径比例放大)
    const spr = SPRITES.enemy[this.type];
    ctx.scale(this.r / spr.baseR, this.r / spr.baseR);
    const img = this.flash > 0 ? spr.flash : spr.body;
    ctx.drawImage(img, -spr.half, -spr.half, spr.half * 2, spr.half * 2);
    // 治疗机:白色十字
    if (this.type === 'mender') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(-1.5, -6, 3, 12);
      ctx.fillRect(-6, -1.5, 12, 3);
    }
    // 精英狂暴:红色狂暴光环
    if (this.enraged) {
      ctx.strokeStyle = 'rgba(255,80,60,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, this.r + 11 + Math.sin(this.t * 8) * 2, 0, TAU); ctx.stroke();
    }
    // 护盾兵:正面护盾弧
    if (this.type === 'shielder' && this.shieldOff <= 0) {
      const warn = this.shieldCycle < 0.5 && Math.floor(this.shieldCycle * 10) % 2 === 0;
      ctx.strokeStyle = warn ? 'rgba(90,208,255,0.35)' : 'rgba(90,208,255,0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 3, this.r + 8, Math.PI * 0.12, Math.PI * 0.88);
      ctx.stroke();
    }
    ctx.restore();
    // 血条(屏幕坐标)
    if (this.elite || (this.hp < this.maxHp && this.maxHp >= 3)) {
      const w = this.r * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(this.x - w / 2, this.y - this.r - 9, w, 4);
      ctx.fillStyle = '#ff5577';
      ctx.fillRect(this.x - w / 2, this.y - this.r - 9, w * (this.hp / this.maxHp), 4);
    }
  }
}

/* ============================================================
 * BOSS 旗舰:三阶段弹幕;第 10/20/30…波出现「暴风」变体
 * ============================================================ */
const BOSS_VARIANTS = {
  flag:   { name: '敌方旗舰', color: '#ff5577', glow: '#ff3355', hull: '#3a1220', turret: '#55182b', core: '#ff2b4e' },
  storm:  { name: '暴风旗舰', color: '#3fe8c8', glow: '#17bfa0', hull: '#12424e', turret: '#1d5f70', core: '#2be8c8' },
  tyrant: { name: '暴君旗舰', color: '#c86bff', glow: '#8a2be2', hull: '#1e1030', turret: '#3a1a55', core: '#c86bff' }
};
const bossVariant = (wave) => (wave >= 25 ? 'tyrant' : (wave >= 10 && Math.floor(wave / 5) % 2 === 0 ? 'storm' : 'flag'));

class Boss {
  constructor(wave) {
    this.wave = wave;
    this.isBoss = true;
    this.variant = bossVariant(wave);
    const storm = this.variant === 'storm', tyrant = this.variant === 'tyrant';
    this.x = W / 2; this.y = -90;
    this.r = 44;
    this.maxHp = this.hp = (150 + wave * 45) * (tyrant ? 1.6 : storm ? 1.3 : 1);
    this.t = 0; this.flash = 0; this.dead = false;
    this.state = 'enter';
    this.dir = 1;
    this.fireCd = 1.2;
    this.score = (2500 + wave * 250) * (tyrant ? 1.5 : storm ? 1.25 : 1);
    this.escortCd = tyrant ? 4 : storm ? 4.5 : 6;
    this.phase = 0;
    this.burstCycle = 0;
  }

  update(dt, game) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    if (this.state === 'enter') {
      this.y += 55 * dt;
      if (this.y >= 115) this.state = 'fight';
      return;
    }
    const storm = this.variant === 'storm', tyrant = this.variant === 'tyrant';
    this.x += this.dir * (36 + this.wave * 1.5) * (tyrant ? 1.5 : storm ? 1.35 : 1) * dt;
    if (this.x < 70) { this.x = 70; this.dir = 1; }
    if (this.x > W - 70) { this.x = W - 70; this.dir = -1; }
    const frac = this.hp / this.maxHp;
    this.phase = frac > 0.66 ? 0 : (frac > 0.33 ? 1 : 2);
    this.fireCd -= dt;
    if (this.fireCd <= 0) this._attack(game);
    this.escortCd -= dt;
    if (this.phase >= 1 && this.escortCd <= 0) {
      this.escortCd = tyrant ? 4 : storm ? 5 : 6;
      game.enemies.push(new Enemy('drone', clamp(this.x - 60, 40, W - 40), game.wave, null, game._env));
      game.enemies.push(new Enemy('drone', clamp(this.x + 60, 40, W - 40), game.wave, null, game._env));
    }
  }

  _attack(game) {
    const x = this.x, y = this.y + 26;
    if (this.variant === 'tyrant') {
      if (this.phase === 0) {
        // 瞄准五连
        const a = game.aimedAngle(x, y);
        for (let i = -2; i <= 2; i++)
          game.enemyShot(x, y, a + i * 0.14, 230 + this.wave * 4, 'orange');
        this.fireCd = 0.85;
      } else if (this.phase === 1) {
        // 三臂螺旋
        const a0 = this.t * 3.2;
        for (let i = 0; i < 3; i++)
          game.enemyShot(x, y, a0 + i * Math.PI * 2 / 3, 175);
        this.fireCd = 0.12;
      } else {
        // 双向四臂螺旋 + 瞄准齐射
        const a = this.t * 4.6;
        for (let i = 0; i < 4; i++)
          game.enemyShot(x, y, a + i * Math.PI / 2, 160);
        this.burstCycle++;
        if (this.burstCycle % 7 === 0) {
          const aim = game.aimedAngle(x, y);
          for (let i = -1; i <= 1; i++)
            game.enemyShot(x, y, aim + i * 0.2, 240 + this.wave * 3);
        }
        this.fireCd = 0.16;
      }
      AudioSys.enemyShoot();
      return;
    }
    if (this.variant === 'storm') {
      if (this.phase === 0) {
        // 高速窄角狙击三连
        const a = game.aimedAngle(x, y);
        for (let i = -1; i <= 1; i++)
          game.enemyShot(x, y, a + i * 0.1, 240 + Math.min(this.wave, 18) * 4, 'orange');
        this.fireCd = 0.8;
      } else if (this.phase === 1) {
        // 双臂旋转螺旋
        const n = 2, a0 = this.t * 3.6;
        for (let i = 0; i < n; i++)
          game.enemyShot(x, y, a0 + i * Math.PI, 165);
        this.fireCd = 0.13;
      } else {
        // 四臂螺旋 + 周期性瞄准齐射
        const a = this.t * 4.2;
        for (let i = 0; i < 4; i++)
          game.enemyShot(x, y, a + i * Math.PI / 2, 150);
        this.burstCycle++;
        if (this.burstCycle % 9 === 0) {
          const aim = game.aimedAngle(x, y);
          for (let i = -1; i <= 1; i++)
            game.enemyShot(x, y, aim + i * 0.16, 220 + Math.min(this.wave, 18) * 3);
        }
        this.fireCd = 0.18;
      }
      AudioSys.enemyShoot();
      return;
    }
    if (this.phase === 0) {
      const a = game.aimedAngle(x, y);
      for (let i = -1; i <= 1; i++)
        game.enemyShot(x, y, a + i * 0.18, 210 + Math.min(this.wave, 18) * 4, 'orange');
      this.fireCd = 1.05;
    } else if (this.phase === 1) {
      const n = 16;
      for (let i = 0; i < n; i++)
        game.enemyShot(x, y, this.t + i / n * TAU, 135);
      this.fireCd = 1.5;
    } else {
      const a = this.t * 4.2;
      game.enemyShot(x, y, a, 150);
      game.enemyShot(x, y, a + Math.PI / 2, 150);
      game.enemyShot(x, y, a + Math.PI, 150);
      game.enemyShot(x, y, a + Math.PI * 1.5, 150);
      this.fireCd = 0.16;
    }
    AudioSys.enemyShoot();
  }

  damage(n, game, silent) {
    if (this.dead || this.state !== 'fight') return;
    this.hp -= n;
    if (!silent) this.flash = 0.06;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      game.killBoss(this);
    }
  }

  draw(ctx) {
    const cfg = BOSS_VARIANTS[this.variant];
    ctx.save();
    ctx.translate(this.x, this.y);
    // 旋转外环
    ctx.save();
    ctx.rotate(this.t * 0.7);
    ctx.strokeStyle = cfg.color;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU, r = this.r + 12;
      i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    // 舰体(按变体取预渲染精灵)
    const spr = (this.variant === 'storm' ? SPRITES.boss.storm : SPRITES.boss.flag).body;
    ctx.globalAlpha = 1;
    ctx.drawImage(spr, -SPRITES.boss[this.variant].half, -SPRITES.boss[this.variant].half, SPRITES.boss[this.variant].half * 2, SPRITES.boss[this.variant].half * 2);
    // 核心
    const pr = 11 + Math.sin(this.t * 5) * 3;
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : cfg.core;
    ctx.beginPath();
    ctx.arc(0, 0, pr, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}

/* ============================================================
 * 道具:P 火力 / S 护盾 / B 炸弹 / ♥ 生命
 * ============================================================ */
class PowerUp {
  static CFG = {
    power: { color: '#ff5470', label: 'P' },
    shield: { color: '#4db8ff', label: 'S' },
    bomb: { color: '#51e08a', label: 'B' },
    life: { color: '#ff77a9', label: '♥' }
  };
  constructor(x, y, type) {
    this.x = x; this.y = y; this.type = type;
    this.t = rand(0, TAU); this.dead = false;
  }
  update(dt, game) {
    this.t += dt;
    // 引力场:进入吸取范围后飞向玩家
    const p = game.player;
    if (p.alive) {
      const dx = p.x - this.x, dy = p.y - this.y;
      if (dx * dx + dy * dy < p.magnetR * p.magnetR) {
        const f = Math.min(1, dt * 6);
        this.x += dx * f;
        this.y += dy * f;
      }
    }
    this.y += 58 * dt;
    this.x += Math.sin(this.t * 2.2) * 22 * dt;
    if (this.y > H + 24) this.dead = true;
  }
  draw(ctx) {
    const spr = SPRITES.power[this.type];
    const s = 1 + Math.sin(this.t * 6) * 0.05;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(s, s);
    ctx.drawImage(spr.c, -spr.half, -spr.half, spr.half * 2, spr.half * 2);
    ctx.restore();
  }
}

/* ============================================================
 * 经验晶体:击坠掉落,受引力场吸引,拾取后转化为升级经验
 * ============================================================ */
class XPOrb {
  constructor(x, y, v) {
    this.x = x; this.y = y;
    const a = rand(0, TAU), sp = rand(30, 110);
    this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp - 40;
    this.v = v; this.t = rand(0, TAU); this.dead = false;
    this.age = 0;
    this.life = rand(14, 18); // 存活时间,临期闪烁后消失
  }
  update(dt, game) {
    this.t += dt;
    this.age += dt;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    const p = game.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    // 磁吸范围内立即吸取;掉落 5 秒后自动飞向玩家兜底,保证经验不浪费
    if (p.alive && (d < p.magnetR || this.age > 5)) {
      const sp = clamp(240 + (p.magnetR - d) * 2.4, 220, 560);
      const f = Math.min(1, 9 * dt);
      this.vx += (dx / d * sp - this.vx) * f;
      this.vy += (dy / d * sp - this.vy) * f;
    } else {
      this.vx *= Math.exp(-2.5 * dt);
      this.vy += (14 - this.vy) * Math.min(1, 1.6 * dt); // 缓慢漂落,不会坠出屏幕
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.x = clamp(this.x, 8, W - 8);
    this.y = clamp(this.y, -20, H - 12);
    if (p.alive && d < 24) { this.dead = true; game.gainXP(this.v); }
  }
  draw(ctx) {
    const s = 3.2 + Math.sin(this.t * 7) * 0.8;
    const blink = this.life < 3 && Math.floor(this.life * 6) % 2 === 0;
    ctx.save();
    if (blink) ctx.globalAlpha = 0.3;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(80,220,255,0.22)';
    ctx.beginPath(); ctx.arc(this.x, this.y, s * 2.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8fe8ff';
    ctx.translate(this.x, this.y);
    ctx.rotate(this.t * 2);
    ctx.fillRect(-s, -s, s * 2, s * 2);
    ctx.restore();
  }
}

/* ============================================================
 * 幻影僚机:环绕玩家,自动索敌射击(「僚机协议」羁绊改射导弹)
 * ============================================================ */
class Wingman {
  constructor(slot) {
    this.slot = slot;         // 0/1 → 环绕相位差半圈
    this.fireCd = rand(0.2, 0.6);
    this.t = 0; this.dead = false;
    this.x = W / 2; this.y = H - 120;
  }
  update(dt, game) {
    this.t += dt;
    const p = game.player;
    const a = p.wingAngle + this.slot * Math.PI;
    this.x = p.x + Math.cos(a) * 36;
    this.y = p.y + Math.sin(a) * 36 - 4;
    this.fireCd -= dt;
    if (this.fireCd <= 0) {
      this.fireCd = 0.85;
      // 索敌:最近的敌机/BOSS
      let tx = null, ty = 0, best = 340 * 340;
      for (const e of game.enemies) {
        if (e.elitePhased) continue;
        const d = (e.x - this.x) ** 2 + (e.y - this.y) ** 2;
        if (d < best) { best = d; tx = e.x; ty = e.y; }
      }
      if (game.boss && game.boss.state === 'fight') {
        const d = (game.boss.x - this.x) ** 2 + (game.boss.y - this.y) ** 2;
        if (d < best) { best = d; tx = game.boss.x; ty = game.boss.y; }
      }
      if (tx !== null) {
        const aim = Math.atan2(ty - this.y, tx - this.x);
        const missile = game.bonds.includes('squad');
        game.playerBullets.push(missile
          ? { x: this.x, y: this.y, vx: Math.cos(aim) * 300, vy: Math.sin(aim) * 300, r: 4, dmg: 2 + game.player.dmgBonus, color: '#ffd166', dead: false, homing: true, life: 2.2, pierce: 0, split: 0 }
          : { x: this.x, y: this.y, vx: Math.cos(aim) * 480, vy: Math.sin(aim) * 480, r: 2.6, dmg: 1 + game.player.dmgBonus, color: '#9ffcf0', dead: false, pierce: 0, split: 0 });
        AudioSys.missile();
      }
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.PI / 2);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#0f4b66';
    ctx.strokeStyle = typeof Shop !== 'undefined' ? Shop.accent() : '#7ef3ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(5, 5); ctx.lineTo(0, 2); ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}

/* ============================================================
 * 空间裂隙:黑洞吸附敌弹并灼烧敌机(「维度撕裂」羁绊强化)
 * ============================================================ */
class Rift {
  constructor(x, y, game) {
    this.x = x; this.y = y;
    this.r = 70 + game.mods.rift * 25;
    if (game.bonds.includes('ghostNet')) this.r *= 1.6;
    this.life = this.max = 3.2;
    this.t = 0; this.dead = false;
  }
  update(dt, game) {
    this.t += dt;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    // 吸附并撕碎附近敌弹
    for (const b of game.enemyBullets) {
      if (b.dead) continue;
      const dx = this.x - b.x, dy = this.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < this.r * 1.6) {
        const pull = 320 * dt * (1 - d / (this.r * 1.8));
        b.x += dx / d * pull * 8;
        b.y += dy / d * pull * 8;
        if (d < 16) {
          b.dead = true;
          game._sparks(b.x, b.y, '#c2a8ff', 2);
        }
      }
    }
    // 灼烧范围内敌机(静默伤害,不闪白)
    for (const e of game.enemies) {
      const dx = e.x - this.x, dy = e.y - this.y;
      if (dx * dx + dy * dy < this.r * this.r && !e.elitePhased) e.damage(5 * dt, game, true);
    }
    if (game.boss && game.boss.state === 'fight') {
      const dx = game.boss.x - this.x, dy = game.boss.y - this.y;
      if (dx * dx + dy * dy < (this.r + game.boss.r) * (this.r + game.boss.r)) game.boss.damage(6 * dt, game);
    }
  }
  draw(ctx) {
    const f = this.life / this.max;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalCompositeOperation = 'lighter';
    // 吸积盘
    ctx.globalAlpha = 0.55 * f;
    ctx.strokeStyle = '#c2a8ff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, this.r * (0.75 + 0.1 * Math.sin(this.t * 5)), 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.3 * f;
    ctx.beginPath(); ctx.arc(0, 0, this.r * 1.25, 0, TAU); ctx.stroke();
    // 旋臂
    ctx.globalAlpha = 0.7 * f;
    ctx.rotate(this.t * 3);
    for (let i = 0; i < 2; i++) {
      ctx.rotate(Math.PI);
      ctx.beginPath();
      for (let k = 0; k <= 20; k++) {
        const a = k / 20 * Math.PI * 1.6, r = 8 + k / 20 * this.r * 0.8;
        const px = Math.cos(a) * r, py = Math.sin(a) * r;
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // 核心
    ctx.globalAlpha = f;
    ctx.fillStyle = '#e8dcff';
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

/* ============================================================
 * 陨石:缓慢漂落,吸收双方弹幕(掩体),击碎掉落经验
 * ============================================================ */
class Asteroid {
  constructor(x, y, r) {
    this.x = x; this.y = y; this.r = r;
    this.rot = rand(0, TAU); this.rotSpd = rand(-1.2, 1.2);
    this.vy = rand(26, 44);
    this.hp = Math.max(3, Math.round(r * 0.4)); this.maxHp = this.hp;
    this.t = rand(0, TAU); this.dead = false;
    this.verts = [];
    const n = irand(7, 9);
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU;
      const rr = r * rand(0.75, 1.15);
      this.verts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
  }
  update(dt, game) {
    this.t += dt;
    this.rot += this.rotSpd * dt;
    this.y += this.vy * dt;
    if (this.y > H + this.r + 20) this.dead = true;
  }
  damage(n, game) {
    if (this.dead) return;
    this.hp -= n;
    if (this.hp <= 0) {
      this.dead = true;
      game._explode(this.x, this.y, this.r, '#9a8f7a', 0.9);
      AudioSys.explode(this.r > 20);
      let xp = Math.round(this.r * 0.5);
      while (xp > 0) {
        const v = Math.min(4, xp);
        xp -= v;
        game.orbs.push(new XPOrb(this.x + rand(-8, 8), this.y + rand(-8, 8), v));
      }
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.beginPath();
    this.verts.forEach((v, i) => i ? ctx.lineTo(v[0], v[1]) : ctx.moveTo(v[0], v[1]));
    ctx.closePath();
    ctx.fillStyle = '#322c22';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#8a7f68';
    ctx.stroke();
    // 坑洞
    ctx.fillStyle = 'rgba(20,17,12,0.7)';
    ctx.beginPath(); ctx.arc(-this.r * 0.3, -this.r * 0.2, this.r * 0.22, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(this.r * 0.28, this.r * 0.25, this.r * 0.16, 0, TAU); ctx.fill();
    ctx.restore();
    if (this.hp < this.maxHp) {
      const w = this.r * 1.6;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(this.x - w / 2, this.y - this.r - 8, w, 3);
      ctx.fillStyle = '#b8a888';
      ctx.fillRect(this.x - w / 2, this.y - this.r - 8, w * (this.hp / this.maxHp), 3);
    }
  }
}

/* ============================================================
 * 补给空投:缓慢降落的标准补给箱,接住即获得对应物资
 * ============================================================ */
const SUPPLY_LOOT = ['power', 'shield', 'bomb', 'life', 'star'];
class SupplyDrop {
  constructor(x, kind) {
    this.x = x; this.y = -20; this.kind = kind;
    this.t = rand(0, TAU); this.dead = false;
  }
  update(dt, game) {
    this.t += dt;
    this.y += 30 * dt;
    this.x += Math.sin(this.t * 1.4) * 14 * dt;
    const p = game.player;
    // 引力场:进入吸取范围后飞向玩家
    if (p.alive) {
      const dx2 = p.x - this.x, dy2 = p.y - this.y;
      if (dx2 * dx2 + dy2 * dy2 < p.magnetR * p.magnetR) {
        const f = Math.min(1, dt * 6);
        this.x += dx2 * f;
        this.y += dy2 * f;
      }
    }
    const dx = p.x - this.x, dy = p.y - this.y;
    if (p.alive && dx * dx + dy * dy < 460) {
      this.dead = true;
      game.openSupply(this.kind, this.x, this.y);
    }
    if (this.y > H + 20) this.dead = true;
  }
  draw(ctx) {
    const cfg = { power: '#ff5470', shield: '#4db8ff', bomb: '#51e08a', life: '#ff77a9', star: '#ffd166' }[this.kind];
    const label = { power: 'P', shield: 'S', bomb: 'B', life: '♥', star: '★' }[this.kind];
    ctx.save();
    ctx.translate(this.x, this.y + Math.sin(this.t * 4) * 2);
    // 降落伞绳
    ctx.strokeStyle = 'rgba(207,232,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-10, -6); ctx.lineTo(0, -22); ctx.lineTo(10, -6);
    ctx.stroke();
    ctx.fillStyle = 'rgba(207,232,255,0.25)';
    ctx.beginPath(); ctx.arc(0, -24, 13, Math.PI, 0); ctx.fill();
    // 箱体
    ctx.shadowColor = cfg;
    ctx.shadowBlur = 12;
    roundRectPath(ctx, -11, -9, 22, 20, 4);
    ctx.fillStyle = '#0b1220';
    ctx.fill();
    ctx.strokeStyle = cfg;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = cfg;
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 1);
    ctx.restore();
  }
}

initSprites();
