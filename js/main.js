'use strict';
/* ============================================================
 * 深空突袭 DEEP STRIKE — 启动引导
 * 自适应缩放 / 键盘与触屏输入 / 主循环
 * ============================================================ */
(function () {
  const canvas = document.getElementById('game');
  const game = new Game(canvas);
  window.game = game; // 调试/测试用全局句柄

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
    // 开箱结果弹层优先响应 Enter/Esc
    if ((e.code === 'Enter' || e.code === 'Escape') && closeBox()) return;
    if (KEYMAP[e.code]) game.keys[KEYMAP[e.code]] = true;
    if (e.code === 'KeyK') game.tryBomb();
    if (e.code === 'KeyM') AudioSys.toggleMute();
    if (e.code === 'KeyF') game.autoFire = !game.autoFire;
    if (e.code === 'KeyP' || e.code === 'Escape') game.togglePause();
    // R 快速重开(暂停或结算时)
    if (e.code === 'KeyR' && (game.state === 'paused' || game.state === 'gameover')) game.start(game.mode);
    // 升级选卡快捷键(遗物模式下选择遗物;满槽替换模式下选择要丢弃的模块)
    if (game.state === 'levelup') {
      // 恶魔契约:献祭三选一(4/0 拒绝)
      if (game._devilMode) {
        const di = ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].indexOf(e.code);
        if (di >= 0) game.chooseDevil(di % 3);
        if (e.code === 'Digit4' || e.code === 'Numpad4' || e.code === 'Digit0' || e.code === 'Numpad0') game.rejectDevil();
        return;
      }
      // 海克斯大乱斗:强化三选一
      if (game._augMode) {
        const ai = ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].indexOf(e.code);
        if (ai >= 0) game.chooseAugment(ai % 3);
        return;
      }
      if (game._relicMode) {
        // 情报网络增益下遗物五选一,支持 1~5
        const relicKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];
        const ri = relicKeys.indexOf(e.code);
        if (ri >= 0) game.chooseRelic(ri);
        return;
      }
      if (e.code === 'Escape' && game._pendingSwap) { game.cancelSwap(); return; }
      if (game._pendingSwap) {
        const keys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7'];
        const idx = keys.indexOf(e.code);
        if (idx >= 0 && game._swapList && game._swapList[idx]) game.swapPick(game._swapList[idx]);
        return;
      }
      if (e.code === 'Digit1' || e.code === 'Numpad1') game.chooseCard(0);
      if (e.code === 'Digit2' || e.code === 'Numpad2') game.chooseCard(1);
      if (e.code === 'Digit3' || e.code === 'Numpad3') game.chooseCard(2);
      return;
    }
    if (game.state === 'menu') {
      if (e.code === 'Enter') game.start();
      if (e.code === 'KeyD') game.start('daily');
      if (e.code === 'KeyW') game.start('weekly');
      if (e.code === 'KeyB') game.start('boss');
      if (e.code === 'KeyL') game.start('mayhem');
      if (e.code === 'KeyC') game.showMenuPanel('campaign');
      if (e.code === 'KeyU') game.showMenuPanel('tuning');
      if (e.code === 'KeyG') game.showMenuPanel('shop');
      if (e.code === 'KeyH') game.showMenuPanel('help');
      if (e.code === 'KeyT') game.showMenuPanel('stats');
      if ((e.code === 'Escape' || e.code === 'Backspace') && game.menuPanel !== 'main') game.showMenuPanel('main');
    } else if (game.state === 'gameover') {
      if (e.code === 'Enter') game.start();
      if (e.code === 'Escape' || e.code === 'Backspace') game.toMenu();
    }
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
  const $ = (id) => document.getElementById(id);
  $('btnStart').addEventListener('click', () => { AudioSys.init(); game.start(); });
  $('btnDaily').addEventListener('click', () => { AudioSys.init(); game.start('daily'); });
  $('btnWeekly').addEventListener('click', () => { AudioSys.init(); game.start('weekly'); });
  $('btnBoss').addEventListener('click', () => { AudioSys.init(); game.start('boss'); });
  $('btnMayhem').addEventListener('click', () => { AudioSys.init(); game.start('mayhem'); });
  $('btnCampaign').addEventListener('click', () => game.showMenuPanel('campaign'));
  $('btnCampaignBack').addEventListener('click', () => game.showMenuPanel('main'));
  $('btnTuning').addEventListener('click', () => game.showMenuPanel('tuning'));
  $('btnTuningBack').addEventListener('click', () => game.showMenuPanel('main'));
  $('btnRestart').addEventListener('click', () => { AudioSys.init(); game.start(); });
  $('btnResume').addEventListener('click', () => game.togglePause());
  $('btnRestart2').addEventListener('click', () => { AudioSys.init(); game.start(game.mode); });
  $('btnShop').addEventListener('click', () => game.showMenuPanel('shop'));
  $('btnShopBack').addEventListener('click', () => game.showMenuPanel('main'));
  $('btnHelp').addEventListener('click', () => game.showMenuPanel('help'));
  $('btnStats').addEventListener('click', () => game.showMenuPanel('stats'));
  $('btnHard').addEventListener('click', () => { AudioSys.init(); game.toggleHard(); });
  $('btnHelpBack').addEventListener('click', () => game.showMenuPanel('main'));
  $('btnStatsBack').addEventListener('click', () => game.showMenuPanel('main'));
    $('btnOverMenu').addEventListener('click', () => game.toMenu());
  // 开箱/兑换结果弹层:确定关闭并刷新商城
  const closeBox = () => {
    const ov = $('boxOverlay');
    if (ov && !ov.classList.contains('hidden')) {
      // 若动画仍在进行,首次 Enter/Esc 先跳到结果揭晓,再次才关闭
      const anim = $('boxAnim');
      if (anim && anim.style.display !== 'none' && typeof Shop._boxSkip === 'function') {
        Shop._boxSkip();
        return true;
      }
      // 关闭并清理动画/揭晓计时器,避免残留回调
      if (Shop._clearBoxAnim) Shop._clearBoxAnim();
      (Shop._revealTimers || []).forEach(clearTimeout);
      Shop._revealTimers = [];
      ov.classList.add('hidden');
      if (game.state === 'menu' && game.menuPanel === 'shop') Shop.renderPanel();
      return true;
    }
    return false;
  };
  $('btnBoxClose').addEventListener('click', closeBox);

  // 危险操作二次确认:第一次点击进入待确认态,3 秒未确认自动复原
  function armConfirm(btn, action) {
    const label = btn.innerHTML;
    let armed = false, timer = 0;
    btn.addEventListener('click', () => {
      if (!armed) {
        armed = true;
        btn.classList.add('armed');
        btn.innerHTML = '▸ 确认返回?(再次点击)';
        timer = setTimeout(() => {
          armed = false;
          btn.classList.remove('armed');
          btn.innerHTML = label;
        }, 3000);
        return;
      }
      clearTimeout(timer);
      armed = false;
      btn.classList.remove('armed');
      btn.innerHTML = label;
      action();
    });
  }
  armConfirm($('btnQuit'), () => game.toMenu());

  // 版本号
  $('verTag').textContent = window.GAME_VERSION || 'dev';

  // 触屏:单指拖动移动并连发,双指点按放炸弹;显示触屏专用炸弹键
  function toLogical(t) {
    const r = canvas.getBoundingClientRect();
    return { x: (t.clientX - r.left) / r.width * W, y: (t.clientY - r.top) / r.height * H };
  }
  $('btnBomb').addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    AudioSys.init();
    game.tryBomb();
  }, { passive: false });
  document.body.addEventListener('touchstart', () => document.body.classList.add('touch-ui'), { once: true, passive: true });
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
