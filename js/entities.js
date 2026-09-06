'use strict';
/* ============================================================
 * 深空突袭 DEEP STRIKE — 实体定义
 * 工具函数 / 粒子 / 光环 / 飘字 / 星空 / 玩家 / 敌机 / BOSS / 道具
 * ============================================================ */
const W = 480, H = 720;
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const irand = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);

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
    ctx.globalAlpha = clamp(this.life / 0.4, 0, 1);
    ctx.fillStyle = this.color;
    ctx.font = 'bold ' + this.size + 'px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.text, this.x, this.y);
    ctx.globalAlpha = 1;
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
  reset() {
    this.x = W / 2; this.y = H - 90;
    this.r = 6; this.speed = 330;
    this.lives = 3; this.weapon = 1; this.bombs = 2;
    this.shield = false; this.invuln = 2.2;
    this.fireCd = 0; this.alive = true;
    this.engine = 0; this.showHitbox = false;
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
    this.fireCd -= dt;
    if ((k.fire || game.autoFire) && this.fireCd <= 0) {
      this._fire(game);
      this.fireCd = 0.12;
    }
    if (Math.random() < 0.6)
      game.particles.push(new Particle(
        this.x + rand(-2.5, 2.5), this.y + 13,
        rand(-14, 14), rand(90, 160),
        rand(0.12, 0.28), rand(1.2, 2.4),
        Math.random() < 0.7 ? '#39d7ff' : '#bff7ff'));
  }
  _fire(game) {
    AudioSys.shoot();
    const P = game.playerBullets;
    const add = (ox, oy, vx, vy) =>
      P.push({ x: this.x + ox, y: this.y + oy, vx, vy, r: 3, dmg: 1, color: '#dffaff', dead: false });
    switch (this.weapon) {
      case 1: add(0, -14, 0, -540); break;
      case 2: add(-6, -10, 0, -540); add(6, -10, 0, -540); break;
      case 3: add(0, -16, 0, -560); add(-9, -6, -75, -510); add(9, -6, 75, -510); break;
      case 4: add(-5, -12, 0, -560); add(5, -12, 0, -560); add(-11, -5, -130, -490); add(11, -5, 130, -490); break;
      default: add(0, -16, 0, -580); add(-7, -11, -45, -545); add(7, -11, 45, -545); add(-13, -4, -160, -480); add(13, -4, 160, -480); break;
    }
  }
  draw(ctx) {
    if (!this.alive) return;
    const blink = this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (blink) ctx.globalAlpha = 0.35;
    // 引擎火焰
    const fl = 9 + Math.sin(this.engine) * 3;
    const fg = ctx.createLinearGradient(0, 10, 0, 24 + fl);
    fg.addColorStop(0, 'rgba(120,230,255,0.9)');
    fg.addColorStop(1, 'rgba(0,120,255,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-3.5, 11); ctx.lineTo(3.5, 11); ctx.lineTo(0, 13 + fl + 6);
    ctx.closePath(); ctx.fill();
    // 机体
    ctx.shadowColor = '#37e2ff';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(0, -17);
    ctx.lineTo(9, 4); ctx.lineTo(14, 11); ctx.lineTo(5, 8);
    ctx.lineTo(0, 12); ctx.lineTo(-5, 8); ctx.lineTo(-14, 11); ctx.lineTo(-9, 4);
    ctx.closePath();
    ctx.fillStyle = '#0f4b66';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#7ef3ff';
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 座舱
    ctx.fillStyle = '#d9fbff';
    ctx.beginPath(); ctx.arc(0, -4, 2.6, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    // 护盾
    if (this.shield) {
      ctx.strokeStyle = 'rgba(90,200,255,' + (0.55 + Math.sin(this.engine * 0.6) * 0.25) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 17, 0, TAU); ctx.stroke();
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
  swift:    { name: '迅捷', color: '#37e2ff', desc: '高速机动' },
  iron:     { name: '铁壁', color: '#c9d4e3', desc: '装甲强化' },
  splitter: { name: '分裂', color: '#51e08a', desc: '死亡分裂' },
  berserk:  { name: '狂暴', color: '#ff6a3c', desc: '火力狂暴' }
};

class Enemy {
  constructor(type, x, wave, elite) {
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
    } else { // sniper
      this.r = 13; this.hp = Math.max(2, Math.round(3 * hpM)); this.score = 250;
      this.vy = 170 * spM; this.stopY = rand(90, 210); this.stopped = false;
      this.fireCd = rand(0.8, 1.6);
      this.color = '#c86bff'; this.fill = '#2a1240';
    }
    // 精英强化:血量 ×4、体型 ×1.3、分数 ×4,词缀附加特性
    this.elite = elite || null;
    if (this.elite) {
      this.hp = Math.round(this.hp * 4);
      this.r = this.r * 1.3;
      this.score *= 4;
      const cfg = ELITE_CFG[this.elite];
      this.eliteName = '精英·' + cfg.name;
      this.eliteColor = cfg.color;
      if (this.elite === 'swift') this.vy *= 1.6;
      if (this.elite === 'iron') { this.hp *= 1.6; this.vy *= 0.7; }
      if (this.elite === 'berserk') this.vy *= 1.2;
      if (this.fireCd !== undefined) this.fireCd *= this.elite === 'berserk' ? 0.45 : 0.6;
    }
    this.maxHp = this.hp;
  }

  update(dt, game) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    const onScreen = this.y > 0;
    if (this.type === 'drone') {
      this.y += this.vy * dt;
      this.x = clamp(this.baseX + Math.sin(this.t * this.freq) * this.amp, 16, W - 16);
    } else if (this.type === 'waver') {
      this.y += this.vy * dt;
      this.x = clamp(this.baseX + Math.sin(this.t * this.freq) * this.amp, 16, W - 16);
      this.fireCd -= dt;
      if (onScreen && this.fireCd <= 0) {
        this.fireCd = rand(1.8, 3.2);
        game.enemyShot(this.x, this.y + this.r, game.aimedAngle(this.x, this.y), 150 + game.wave * 5);
        AudioSys.enemyShoot();
      }
    } else if (this.type === 'tank') {
      this.y += this.vy * dt;
      this.fireCd -= dt;
      if (onScreen && this.fireCd <= 0) {
        this.fireCd = 2.4;
        for (let i = -1; i <= 1; i++)
          game.enemyShot(this.x, this.y + this.r, Math.PI / 2 + i * 0.4, 140 + game.wave * 4, 'orange');
        AudioSys.enemyShoot();
      }
    } else { // sniper
      if (!this.stopped) {
        this.y += this.vy * dt;
        if (this.y >= this.stopY) this.stopped = true;
      } else {
        this.x = clamp(this.baseX + Math.sin(this.t * 0.8) * 40, 30, W - 30);
        this.fireCd -= dt;
        if (this.fireCd <= 0) {
          this.fireCd = Math.max(1.2, 2.6 - game.wave * 0.12);
          game.enemyShot(this.x, this.y + this.r, game.aimedAngle(this.x, this.y), 210 + game.wave * 6);
          AudioSys.enemyShoot();
        }
      }
    }
    if (this.y > H + 40) this.dead = true;
  }

  damage(n, game) {
    if (this.dead) return;
    this.hp -= n;
    this.flash = 0.08;
    if (this.hp <= 0) {
      this.dead = true;
      // 分裂词缀:死亡时裂解为 3 架无人机
      if (this.elite === 'splitter') {
        for (let i = -1; i <= 1; i++)
          game.enemies.push(new Enemy('drone', clamp(this.x + i * 30, 30, W - 30), game.wave));
      }
      game.killEnemy(this);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
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
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 9;
    ctx.beginPath();
    if (this.type === 'drone') {
      ctx.moveTo(0, 12); ctx.lineTo(10, -9); ctx.lineTo(0, -4); ctx.lineTo(-10, -9);
    } else if (this.type === 'waver') {
      ctx.moveTo(0, 14); ctx.lineTo(11, 0); ctx.lineTo(0, -11); ctx.lineTo(-11, 0);
    } else if (this.type === 'tank') {
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU + Math.PI / 6;
        const px = Math.cos(a) * this.r, py = Math.sin(a) * this.r;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
    } else {
      ctx.moveTo(0, 13); ctx.lineTo(10, -10); ctx.lineTo(0, -3); ctx.lineTo(-10, -10);
    }
    ctx.closePath();
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : this.fill;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = this.color;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : this.color;
    ctx.beginPath();
    ctx.arc(0, this.type === 'drone' ? 0 : 1, this.type === 'tank' ? 6 : 3, 0, TAU);
    ctx.fill();
    if (this.elite || (this.hp < this.maxHp && this.maxHp >= 3)) {
      const w = this.r * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(-w / 2, -this.r - 9, w, 4);
      ctx.fillStyle = '#ff5577';
      ctx.fillRect(-w / 2, -this.r - 9, w * (this.hp / this.maxHp), 4);
    }
    ctx.restore();
  }
}

/* ============================================================
 * BOSS 旗舰:三阶段弹幕
 * ============================================================ */
class Boss {
  constructor(wave) {
    this.wave = wave;
    this.x = W / 2; this.y = -90;
    this.r = 44;
    this.maxHp = this.hp = 150 + wave * 45;
    this.t = 0; this.flash = 0; this.dead = false;
    this.state = 'enter';
    this.dir = 1;
    this.fireCd = 1.2;
    this.score = 2500 + wave * 250;
    this.escortCd = 4;
    this.phase = 0;
  }

  update(dt, game) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    if (this.state === 'enter') {
      this.y += 55 * dt;
      if (this.y >= 115) this.state = 'fight';
      return;
    }
    this.x += this.dir * (36 + this.wave * 1.5) * dt;
    if (this.x < 70) { this.x = 70; this.dir = 1; }
    if (this.x > W - 70) { this.x = W - 70; this.dir = -1; }
    const frac = this.hp / this.maxHp;
    this.phase = frac > 0.66 ? 0 : (frac > 0.33 ? 1 : 2);
    this.fireCd -= dt;
    if (this.fireCd <= 0) this._attack(game);
    this.escortCd -= dt;
    if (this.phase >= 1 && this.escortCd <= 0) {
      this.escortCd = 6;
      game.enemies.push(new Enemy('drone', clamp(this.x - 60, 40, W - 40), game.wave));
      game.enemies.push(new Enemy('drone', clamp(this.x + 60, 40, W - 40), game.wave));
    }
  }

  _attack(game) {
    const x = this.x, y = this.y + 26;
    if (this.phase === 0) {
      const a = game.aimedAngle(x, y);
      for (let i = -1; i <= 1; i++)
        game.enemyShot(x, y, a + i * 0.18, 210 + this.wave * 4, 'orange');
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

  damage(n, game) {
    if (this.dead || this.state !== 'fight') return;
    this.hp -= n;
    this.flash = 0.06;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      game.killBoss(this);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    // 旋转外环
    ctx.save();
    ctx.rotate(this.t * 0.7);
    ctx.strokeStyle = 'rgba(255,85,119,0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU, r = this.r + 12;
      i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    // 舰体
    ctx.shadowColor = '#ff3355';
    ctx.shadowBlur = 22;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU + Math.PI / 6;
      i ? ctx.lineTo(Math.cos(a) * this.r, Math.sin(a) * this.r) : ctx.moveTo(Math.cos(a) * this.r, Math.sin(a) * this.r);
    }
    ctx.closePath();
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#3a1220';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ff5577';
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 侧炮塔
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#55182b';
    ctx.fillRect(-this.r - 10, -8, 14, 26);
    ctx.fillRect(this.r - 4, -8, 14, 26);
    // 核心
    const pr = 11 + Math.sin(this.t * 5) * 3;
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#ff2b4e';
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
  update(dt) {
    this.t += dt;
    this.y += 58 * dt;
    this.x += Math.sin(this.t * 2.2) * 22 * dt;
    if (this.y > H + 24) this.dead = true;
  }
  draw(ctx) {
    const cfg = PowerUp.CFG[this.type];
    const s = 11 + Math.sin(this.t * 6) * 1.6;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.shadowColor = cfg.color;
    ctx.shadowBlur = 14;
    roundRectPath(ctx, -s, -s, s * 2, s * 2, 5);
    ctx.fillStyle = '#0b1220';
    ctx.fill();
    ctx.strokeStyle = cfg.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = cfg.color;
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cfg.label, 0, 1);
    ctx.restore();
  }
}
