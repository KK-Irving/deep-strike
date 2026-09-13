'use strict';
/* v4.4.0 闪避冲刺(Phase 7.1,竞品借鉴:雷霆:集结 闪避技)(一次性补丁,跑完即删)
 * X 键:沿当前移动方向短距冲刺,冲刺期间无敌 0.3s,冷却 2.5s。 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let fail = 0;
function load(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n'); }
function save(rel, s) { fs.writeFileSync(path.join(ROOT, rel), s, 'utf8'); }
function rep(rel, src, anchor, replacement, tag) {
  if (!src.includes(anchor)) { console.error('ANCHOR NOT FOUND [' + rel + '] ' + tag); fail++; return src; }
  if (tag[0] !== '*' && src.split(anchor).length - 1 !== 1) { console.error('ANCHOR NOT UNIQUE [' + rel + '] ' + tag); fail++; return src; }
  return src.replace(anchor, replacement);
}

/* ---------------- js/entities.js:Player 冲刺状态与位移 ---------------- */
let e = load('js/entities.js');
e = rep('js/entities.js', e,
`    this.fireCd = 0; this.alive = true;`,
`    this.fireCd = 0; this.alive = true;
    this.dashCd = 0; this.dashT = 0; this.dashVx = 0; this.dashVy = 0; // 闪避冲刺`,
'dash-reset');
e = rep('js/entities.js', e,
`    if (game.touch.active) {
      const f = Math.min(1, dt * 14);
      this.x += (game.touch.x - this.x) * f;
      this.y += (game.touch.y - this.y) * f;
    } else if (dx || dy) {`,
`    // 闪避冲刺位移(优先于常规移动,冲刺期间由无敌帧保护)
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.x += this.dashVx * dt;
      this.y += this.dashVy * dt;
    }
    if (game.touch.active) {
      const f = Math.min(1, dt * 14);
      this.x += (game.touch.x - this.x) * f;
      this.y += (game.touch.y - this.y) * f;
    } else if (dx || dy && this.dashT <= 0) {`,
'dash-move');
e = rep('js/entities.js', e,
`    this.chillT = Math.max(0, this.chillT - dt);
    this._phaseT = Math.max(0, this._phaseT - dt);`,
`    this.chillT = Math.max(0, this.chillT - dt);
    this._phaseT = Math.max(0, this._phaseT - dt);
    this.dashCd = Math.max(0, (this.dashCd || 0) - dt);`,
'dash-cd');
save('js/entities.js', e);

/* ---------------- js/game.js:冲刺触发 ---------------- */
let g = load('js/game.js');
g = rep('js/game.js', g,
`  /* 当前模式配置(模式统一基础层) */
  cfg() { return MODES[this.mode] || MODES.normal; }`,
`  /* 闪避冲刺:沿当前移动方向短距位移 + 0.3s 无敌(冷却 2.5s) */
  playerDash(dir) {
    const p = this.player;
    if (this.state !== 'playing' || !p.alive || (p.dashCd || 0) > 0 || p.dashT > 0) return false;
    const k = this.keys;
    let dx = (dir === 'left' || k.left) ? -1 : (dir === 'right' || k.right) ? 1 : 0;
    let dy = (dir === 'up' || k.up) ? -1 : (dir === 'down' || k.down) ? 1 : 0;
    if (!dx && !dy) dy = -1; // 无方向默认向上闪
    const len = Math.hypot(dx, dy);
    p.dashVx = dx / len * 1400;
    p.dashVy = dy / len * 1400;
    p.dashT = 0.18;
    p.dashCd = 2.5;
    p.invuln = Math.max(p.invuln, 0.3);
    AudioSys.dash && AudioSys.dash();
    this._sparks(p.x, p.y, '#aef0ff', 6);
    return true;
  }

  /* 当前模式配置(模式统一基础层) */
  cfg() { return MODES[this.mode] || MODES.normal; }`,
'dash-fn');
save('js/game.js', g);

/* ---------------- js/main.js:X 键触发 ---------------- */
let m = load('js/main.js');
m = rep('js/main.js', m,
`    if (e.code === 'KeyK') game.tryBomb();`,
`    if (e.code === 'KeyK') game.tryBomb();
    if (e.code === 'KeyX') game.playerDash();`,
'dash-key');
save('js/main.js', m);

/* ---------------- js/hud.js:冲刺冷却指示 ---------------- */
let d = load('js/hud.js');
d = rep('js/hud.js', d,
`      if (this.bombActive) {`,
`      // 闪避冲刺冷却指示(判定点下方小弧)
      if (this.state === 'playing' && this.player.alive && (this.player.dashCd || 0) > 0) {
        const frac = 1 - this.player.dashCd / 2.5;
        ctx.save();
        ctx.strokeStyle = 'rgba(174,240,255,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.player.x, this.player.y + 16, 10, -Math.PI / 2, -Math.PI / 2 + frac * TAU);
        ctx.stroke();
        ctx.restore();
      }
      if (this.bombActive) {`,
'dash-hud');
save('js/hud.js', d);

console.log(fail ? 'PATCH FAILED: ' + fail : 'PATCH OK');
process.exitCode = fail ? 1 : 0;
