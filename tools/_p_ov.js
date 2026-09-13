'use strict';
/* v4.4.2 过载大招(Phase 7.3,竞品借鉴:雷霆:集结 合体大招)(一次性补丁,跑完即删)
 * 击坠积攒过载能量(小怪 +2 / 旗舰 +20),满 100 按 G 释放:全屏 30 伤害 + 5s 狂热 + 清弹。 */
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

let g = load('js/game.js');

// 1) 状态复位
g = rep('js/game.js', g,
`    this.grazeCount = 0;`,
`    this.grazeCount = 0;
    this.overload = 0; // 过载能量 0~100`,
'ov-reset');

// 2) 击坠充能
g = rep('js/game.js', g,
`    this.grazeCount = (this.grazeCount || 0) + 1;`,
`    this.grazeCount = (this.grazeCount || 0) + 1;
    this.overload = Math.min(100, (this.overload || 0) + 2);`,
'ov-charge-kill');

// 3) 旗舰击坠充能
g = rep('js/game.js', g,
`    Shop.addScrap(this.cfg().scrap); // 旗舰残骸(改装件材料)`,
`    Shop.addScrap(this.cfg().scrap); // 旗舰残骸(改装件材料)
    this.overload = Math.min(100, (this.overload || 0) + 20); // 过载:旗舰大量充能`,
'ov-charge-boss');

// 4) 释放方法(过载就绪按 G)
g = rep('js/game.js', g,
`  /* 闪避冲刺:沿当前移动方向短距位移 + 0.3s 无敌(冷却 2.5s) */
  playerDash(dir) {`,
`  /* 过载大招:全屏 30 伤害 + 清弹 + 5s 狂热 */
  overloadBurst() {
    const p = this.player;
    if (this.state !== 'playing' || !p.alive || (this.overload || 0) < 100) return false;
    this.overload = 0;
    this.buffs.frenzy = Math.max(this.buffs.frenzy, 5);
    this.enemyBullets.length = 0;
    for (const en of this.enemies) {
      if (!en.dead) {
        en.damage(30, this, true);
        this._sparks(en.x, en.y, '#ffd166', 3);
      }
    }
    if (this.boss && this.boss.state === 'fight') {
      this.boss.damage(30, this, true);
      if (this.boss.pods) for (const pod of this.boss.pods) if (!pod.dead) this.boss.hitPod(pod, 15, this);
    }
    this.rings.push(new Ring(p.x, p.y, '#ffd166', 460, 0.8));
    this.rings.push(new Ring(p.x, p.y, '#ff9a3c', 300, 0.55));
    this.flashT = 0.3; this.flashColor = 'rgba(255,209,102,';
    this.shake(10, 0.5);
    this._addFloat(new FloatText(p.x, p.y - 34, '⚡ 过载爆发!', '#ffd166', 16));
    AudioSys.bomb();
    return true;
  }

  /* 闪避冲刺:沿当前移动方向短距位移 + 0.3s 无敌(冷却 2.5s) */
  playerDash(dir) {`,
'ov-fn');
save('js/game.js', g);

/* ---------------- js/main.js:G 键 ---------------- */
let m = load('js/main.js');
m = rep('js/main.js', m,
`    if (e.code === 'KeyX') game.playerDash();`,
`    if (e.code === 'KeyG' && game.state === 'playing') game.overloadBurst();`,
'ov-key');
save('js/main.js', m);

/* ---------------- js/hud.js:过载能量条 ---------------- */
let d = load('js/hud.js');
d = rep('js/hud.js', d,
`      // 擦弹计数(右下小字,Phase 7.2)`,
`      // 过载能量条(底边上沿,Phase 7.3)
      if (this.state === 'playing' && (this.overload || 0) > 0) {
        const ov = Math.min(100, this.overload);
        ctx.save();
        ctx.fillStyle = 'rgba(10,20,40,0.6)';
        ctx.fillRect(W / 2 - 60, H - 16, 120, 7);
        ctx.fillStyle = ov >= 100 ? ((Math.sin(performance.now() / 120) > 0) ? '#ffd166' : '#ff9a3c') : '#ff9a3c';
        ctx.fillRect(W / 2 - 60, H - 16, 120 * ov / 100, 7);
        ctx.strokeStyle = 'rgba(255,209,102,0.7)'; ctx.lineWidth = 1;
        ctx.strokeRect(W / 2 - 60, H - 16, 120, 7);
        if (ov >= 100) {
          ctx.fillStyle = '#ffd166';
          ctx.font = 'bold 10px "Segoe UI", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('⚡ 过载就绪 G', W / 2, H - 20);
        }
        ctx.restore();
      }
      // 擦弹计数(右下小字,Phase 7.2)`,
'ov-hud');
save('js/hud.js', d);

console.log(fail ? 'PATCH FAILED: ' + fail : 'PATCH OK');
process.exitCode = fail ? 1 : 0;
