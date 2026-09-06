'use strict';
/* ============================================================
 * 深空突袭 DEEP STRIKE — 启动引导
 * 自适应缩放 / 键盘与触屏输入 / 主循环
 * ============================================================ */
(function () {
  const canvas = document.getElementById('game');
  const game = new Game(canvas);

  // 逻辑分辨率固定 480×720,按窗口等比缩放并适配 devicePixelRatio
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    const cw = Math.max(1, Math.floor(W * scale));
    const ch = Math.max(1, Math.floor(H * scale));
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // 键盘
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    Space: 'fire', KeyJ: 'fire',
    ShiftLeft: 'slow', ShiftRight: 'slow'
  };
  window.addEventListener('keydown', (e) => {
    if (KEYMAP[e.code]) e.preventDefault();
    if (e.repeat) return;
    AudioSys.init();
    if (KEYMAP[e.code]) game.keys[KEYMAP[e.code]] = true;
    if (e.code === 'KeyK') game.tryBomb();
    if (e.code === 'KeyM') AudioSys.toggleMute();
    if (e.code === 'KeyF') game.autoFire = !game.autoFire;
    if (e.code === 'KeyP' || e.code === 'Escape') game.togglePause();
    if (e.code === 'Enter' && (game.state === 'menu' || game.state === 'gameover')) game.start();
  });
  window.addEventListener('keyup', (e) => {
    if (KEYMAP[e.code]) {
      game.keys[KEYMAP[e.code]] = false;
      e.preventDefault();
    }
  });

  // 切出窗口 / 最小化时自动暂停,避免背板阵亡
  window.addEventListener('blur', () => game.autoPause());
  document.addEventListener('visibilitychange', () => { if (document.hidden) game.autoPause(); });

  // 按钮
  document.getElementById('btnStart').addEventListener('click', () => { AudioSys.init(); game.start(); });
  document.getElementById('btnRestart').addEventListener('click', () => { AudioSys.init(); game.start(); });
  document.getElementById('btnResume').addEventListener('click', () => game.togglePause());

  // 触屏:单指拖动移动并连发,双指点按放炸弹
  function toLogical(t) {
    const r = canvas.getBoundingClientRect();
    return { x: (t.clientX - r.left) / r.width * W, y: (t.clientY - r.top) / r.height * H };
  }
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    AudioSys.init();
    if (game.state === 'menu' || game.state === 'gameover') { game.start(); return; }
    if (e.touches.length >= 2) { game.tryBomb(); return; }
    const p = toLogical(e.touches[0]);
    game.touch.active = true;
    game.touch.x = p.x; game.touch.y = p.y;
    game.keys.fire = true;
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!e.touches.length) return;
    const p = toLogical(e.touches[0]);
    game.touch.active = true;
    game.touch.x = p.x; game.touch.y = p.y;
    game.keys.fire = true;
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (!e.touches.length) {
      game.touch.active = false;
      game.keys.fire = false;
    }
  }, { passive: false });

  // 主循环:deltaTime 驱动,单帧上限 33ms 防止切后台后"瞬移"
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    game.update(dt);
    game.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
