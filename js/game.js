'use strict';
/* ============================================================
 * 深空突袭 DEEP STRIKE — 游戏核心
 * 状态机 / 波次导演 / 碰撞 / 特效 / HUD 渲染
 * ============================================================ */

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = 'menu';           // menu | playing | paused | gameover
    this.keys = { left: false, right: false, up: false, down: false, fire: false, slow: false };
    this.touch = { active: false, x: 0, y: 0 };
    this.autoFire = true; // F 键可切换
    this.bg = createBackground();
    this.stars = new Starfield();
    this.player = new Player();
    this.hi = this._loadHi();
    this.shakeMag = 0; this.shakeT = 0; this.shakeDur = 1;
    this.flashT = 0; this.flashColor = 'rgba(255,255,255,';
    this.bombActive = false; this.bombT = 0;
    this._reset();
    this._dom = {
      menu: document.getElementById('menuOverlay'),
      pause: document.getElementById('pauseOverlay'),
      over: document.getElementById('overOverlay'),
      btnStart: document.getElementById('btnStart'),
      btnResume: document.getElementById('btnResume'),
      btnRestart: document.getElementById('btnRestart'),
      menuHi: document.getElementById('menuHi'),
      finalScore: document.getElementById('finalScore'),
      finalWave: document.getElementById('finalWave'),
      finalHi: document.getElementById('finalHi'),
      newRecord: document.getElementById('newRecord')
    };
    this._dom.menuHi.textContent = '最高纪录 ' + this.hi;
    this._showState();
  }

  _loadHi() { try { return +localStorage.getItem('deepstrike.hi') || 0; } catch (e) { return 0; } }
  _saveHi() { try { localStorage.setItem('deepstrike.hi', String(this.hi)); } catch (e) { /* 忽略 */ } }

  _reset() {
    this.player.reset();
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
    this.banner = null; this.waveClearT = -1;
    this.deathT = -1; this.newRecord = false;
  }

  start() {
    this._reset();
    this.state = 'playing';
    AudioSys.init();
    if (AudioSys.musicGain) AudioSys.musicGain.gain.value = 0.3;
    this._showState();
    this.startWave(1);
  }

  togglePause() {
    if (this.state === 'playing') this.state = 'paused';
    else if (this.state === 'paused') this.state = 'playing';
    else return;
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
  }

  multiplier() { return 1 + Math.min(3, Math.floor(this.combo / 8)); }

  /* ---------------- 波次导演 ---------------- */
  startWave(n) {
    this.wave = n; this.waveTime = 0; this.spawnQueue = []; this.waveClearT = -1;
    if (n % 5 === 0) {
      this.banner = { text: '⚠ WARNING ⚠', sub: '敌方旗舰接近', life: 2.2, max: 2.2, red: true };
      AudioSys.alarm();
      this.spawnQueue.push({ boss: true, t: 2.0 });
      return;
    }
    this.banner = { text: 'WAVE ' + n, sub: '敌机来袭', life: 1.8, max: 1.8, red: false };
    AudioSys.waveStart();
    let budget = 8 + n * 3;
    let t = 1.0;
    while (budget > 0) {
      const roll = Math.random();
      let type = 'drone';
      if (n >= 3 && roll < 0.18) type = 'tank';
      else if (n >= 2 && roll < 0.48) type = 'waver';
      else if (n >= 4 && roll < 0.62) type = 'sniper';
      let cost = type === 'tank' ? 3 : (type === 'drone' ? 1 : 2);
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
        else this.enemies.push(new Enemy(s.type, s.x, this.wave));
        this.spawnQueue.splice(i, 1);
      }
    }

    if (this.player.alive) this.player.update(dt, this);

    for (let i = this.playerBullets.length - 1; i >= 0; i--) {
      const b = this.playerBullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.dead || b.y < -20 || b.x < -20 || b.x > W + 20) this.playerBullets.splice(i, 1);
    }
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.dead || b.y > H + 20 || b.y < -30 || b.x < -20 || b.x > W + 20) this.enemyBullets.splice(i, 1);
    }
    this._updateArr(this.enemies, dt);
    this._updateArr(this.powerups, dt);
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

    // 波次推进:出怪完毕且场上无敌人
    if (this.spawnQueue.length === 0 && this.enemies.length === 0 && !this.boss) {
      if (this.waveClearT < 0) {
        this.waveClearT = 1.6;
        const bonus = 200 + this.wave * 100;
        this.score += bonus;
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
        if (e.dead) continue;
        const dx = b.x - e.x, dy = b.y - e.y;
        const rr = e.r + b.r;
        if (dx * dx + dy * dy < rr * rr) {
          b.dead = true;
          AudioSys.hit();
          this._sparks(b.x, b.y, e.color, 4);
          e.damage(b.dmg, this);
          break;
        }
      }
      if (!b.dead && this.boss && !this.boss.dead && this.boss.state === 'fight') {
        const bo = this.boss;
        const dx = b.x - bo.x, dy = b.y - bo.y;
        const rr = bo.r + b.r;
        if (dx * dx + dy * dy < rr * rr) {
          b.dead = true;
          AudioSys.hit();
          this._sparks(b.x, b.y, '#ff5577', 4);
          bo.damage(b.dmg, this);
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
          this._playerHit();
          break;
        }
      }
      // 敌机冲撞 → 玩家
      if (p.alive && p.invuln <= 0) {
        for (const e of this.enemies) {
          if (e.dead) continue;
          const dx = e.x - p.x, dy = e.y - p.y;
          const rr = e.r + p.r;
          if (dx * dx + dy * dy < rr * rr) {
            e.damage(3, this);
            this._playerHit();
            break;
          }
        }
        if (p.alive && p.invuln <= 0 && this.boss && !this.boss.dead && this.boss.state === 'fight') {
          const bo = this.boss;
          const dx = bo.x - p.x, dy = bo.y - p.y;
          const rr = bo.r + p.r;
          if (dx * dx + dy * dy < rr * rr) this._playerHit();
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
  }

  /* ---------------- 击杀 / 伤害结算 ---------------- */
  killEnemy(e) {
    this.combo++;
    this.comboT = 2;
    const mult = this.multiplier();
    const pts = Math.round(e.score * mult);
    this.score += pts;
    this.floats.push(new FloatText(e.x, e.y - 8, '+' + pts, mult > 1 ? '#ffd166' : '#e8f6ff', e.r > 18 ? 16 : 13));
    this._explode(e.x, e.y, e.r, e.color, 1);
    AudioSys.explode(e.r >= 18);
    this.shake(Math.min(9, 1.5 + e.r * 0.18), 0.22);
    if (e.type === 'tank') this._dropPower(e.x, e.y);
    else if (Math.random() < 0.13) this._dropPower(e.x, e.y);
  }

  killBoss(b) {
    this.combo++;
    this.comboT = 2;
    const pts = Math.round(b.score * this.multiplier());
    this.score += pts;
    this.floats.push(new FloatText(b.x, b.y, '+' + pts, '#ffd166', 22));
    for (let i = 0; i < 10; i++)
      this._explode(b.x + rand(-b.r, b.r), b.y + rand(-b.r * 0.6, b.r * 0.6), 14, '#ff8c42', 1.1);
    this._explode(b.x, b.y, 30, '#ffd166', 1.6);
    AudioSys.explode(true);
    this.shake(18, 0.8);
    this.flashT = 0.3; this.flashColor = 'rgba(255,200,120,';
    this.enemyBullets.length = 0;
    this._dropPower(b.x - 40, b.y, 'power');
    this._dropPower(b.x + 40, b.y, 'bomb');
    this._dropPower(b.x, b.y - 20, Math.random() < 0.5 ? 'life' : 'shield');
  }

  _dropPower(x, y, force) {
    let type = force;
    if (!type) {
      const r = Math.random();
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
        this.floats.push(new FloatText(p.x, p.y - 24, '火力提升!', '#ff5470'));
      } else {
        this.score += 300;
        this.floats.push(new FloatText(p.x, p.y - 24, '+300', '#ffd166'));
      }
    } else if (type === 'shield') {
      p.shield = true;
      this.floats.push(new FloatText(p.x, p.y - 24, '护盾展开!', '#4db8ff'));
    } else if (type === 'bomb') {
      if (p.bombs < 5) {
        p.bombs++;
        this.floats.push(new FloatText(p.x, p.y - 24, '炸弹 +1', '#51e08a'));
      } else {
        this.score += 300;
        this.floats.push(new FloatText(p.x, p.y - 24, '+300', '#ffd166'));
      }
    } else if (type === 'life') {
      if (p.lives < 5) {
        p.lives++;
        this.floats.push(new FloatText(p.x, p.y - 24, '生命 +1', '#ff77a9'));
      } else {
        this.score += 500;
        this.floats.push(new FloatText(p.x, p.y - 24, '+500', '#ffd166'));
      }
    }
  }

  _playerHit() {
    const p = this.player;
    if (p.invuln > 0 || !p.alive) return;
    if (p.shield) {
      p.shield = false;
      p.invuln = 1.2;
      AudioSys.shieldBreak();
      this.shake(7, 0.3);
      this.rings.push(new Ring(p.x, p.y, '#4db8ff', 60, 0.4));
      return;
    }
    p.lives--;
    AudioSys.playerHit();
    this.shake(14, 0.5);
    this.flashT = 0.35; this.flashColor = 'rgba(255,70,90,';
    this._explode(p.x, p.y, 16, '#7ef3ff', 1.4);
    this.combo = 0;
    if (p.lives <= 0) {
      p.alive = false;
      this._explode(p.x, p.y, 26, '#7ef3ff', 2);
      this.shake(20, 0.8);
    } else {
      p.weapon = Math.max(1, p.weapon - 1);
      p.invuln = 3.0;
      p.x = W / 2;
      p.y = H - 90;
    }
  }

  /* ---------------- 炸弹 ---------------- */
  tryBomb() {
    if (this.state !== 'playing' || !this.player.alive) return;
    const p = this.player;
    if (p.bombs <= 0 || this.bombActive) return;
    p.bombs--;
    this.bombActive = true;
    this.bombT = 0.9;
    AudioSys.bomb();
    this.flashT = 0.4; this.flashColor = 'rgba(170,240,255,';
    this.shake(16, 0.7);
    p.invuln = Math.max(p.invuln, 1.2); // 炸弹瞬间无敌,可作保命键
    for (const b of this.enemyBullets) this._sparks(b.x, b.y, '#9fe8ff', 3);
    this.enemyBullets.length = 0;
    for (const e of this.enemies) e.damage(8, this);
    if (this.boss) this.boss.damage(20, this);
    this.rings.push(new Ring(p.x, p.y, '#aef3ff', 300, 0.7));
  }

  /* ---------------- 子弹发射 ---------------- */
  enemyShot(x, y, angle, speed, kind = 'pink') {
    if (this.enemyBullets.length > 240) return;
    const cfg = kind === 'orange'
      ? { color: '#ffb066', glow: 'rgba(255,140,60,0.35)' }
      : { color: '#ff8fd0', glow: 'rgba(255,70,160,0.32)' };
    this.enemyBullets.push({
      x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      r: 4, color: cfg.color, glow: cfg.glow, dead: false
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

  _sparks(x, y, color, n = 6) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), sp = rand(60, 220);
      this.particles.push(new Particle(x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.15, 0.35), rand(1.5, 3), color));
    }
  }

  _explode(x, y, r, color, scale = 1) {
    const n = Math.round((10 + r) * scale);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), sp = rand(30, 260) * scale;
      const c = Math.random() < 0.5 ? color : (Math.random() < 0.5 ? '#ffd166' : '#ff8c42');
      this.particles.push(new Particle(x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.3, 0.8) * scale, rand(1.5, 4) * scale, c));
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
    if (this.banner) this.banner.life -= dt;
  }

  _shakeOff() {
    if (this.shakeT <= 0) return null;
    const f = this.shakeT / this.shakeDur;
    return [rand(-1, 1) * this.shakeMag * f, rand(-1, 1) * this.shakeMag * f];
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
    for (const e of this.enemies) e.draw(ctx);
    if (this.boss) this.boss.draw(ctx);
    this.player.draw(ctx);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.playerBullets) {
      ctx.fillStyle = 'rgba(120,220,255,0.35)';
      ctx.fillRect(b.x - 3.5, b.y - 13, 7, 18);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - 1.8, b.y - 10, 3.6, 14);
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

    this._drawHud(ctx);
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
    if (AudioSys.muted) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '12px sans-serif';
      ctx.fillText('♪ OFF', W - 14, 38);
    }
    // 生命(小战机)
    for (let i = 0; i < p.lives; i++) {
      ctx.save();
      ctx.translate(22 + i * 24, H - 22);
      ctx.scale(0.62, 0.62);
      ctx.fillStyle = '#0f4b66';
      ctx.strokeStyle = '#7ef3ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -14); ctx.lineTo(10, 8); ctx.lineTo(0, 4); ctx.lineTo(-10, 8);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
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
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 15px Consolas, monospace';
      ctx.fillText(this.combo + ' COMBO  ×' + this.multiplier(), W / 2, 60);
      const fw = 90 * clamp(this.comboT / 2, 0, 1);
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
    }
    // 波次横幅
    if (this.banner && this.banner.life > 0) {
      const b = this.banner;
      const a = Math.min(1, b.life / 0.5) * Math.min(1, (b.max - b.life) * 4);
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.fillStyle = b.red ? '#ff3355' : '#7ef3ff';
      ctx.font = 'bold 34px "Segoe UI", "Microsoft YaHei", sans-serif';
      ctx.shadowColor = b.red ? '#ff3355' : '#37e2ff';
      ctx.shadowBlur = 18;
      ctx.fillText(b.text, W / 2, H * 0.38);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(230,245,255,0.85)';
      ctx.font = '15px "Segoe UI", "Microsoft YaHei", sans-serif';
      ctx.fillText(b.sub, W / 2, H * 0.38 + 42);
      ctx.globalAlpha = 1;
    }
  }

  _gameover() {
    this.state = 'gameover';
    AudioSys.gameover();
    if (this.score > this.hi) {
      this.hi = this.score;
      this.newRecord = true;
      this._saveHi();
      AudioSys.record();
    }
    const d = this._dom;
    d.finalScore.textContent = this.score;
    d.finalWave.textContent = this.wave;
    d.finalHi.textContent = this.hi;
    d.menuHi.textContent = '最高纪录 ' + this.hi;
    d.newRecord.classList.toggle('hidden', !this.newRecord);
    this._showState();
  }
}
