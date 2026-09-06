'use strict';
/* ============================================================
 * 深空突袭 DEEP STRIKE — 音频系统
 * 全部音效与背景音乐由 WebAudio 实时合成,零外部素材
 * ============================================================ */
const AudioSys = {
  ctx: null, master: null, sfxGain: null, musicGain: null,
  muted: false, noiseBuf: null,
  _step: 0, _nextT: 0,

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.3;
    this.musicGain.connect(this.master);
    const n = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, n, n);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this._startMusic();
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
    return this.muted;
  },

  tone(o) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + (o.delay || 0);
    const dur = o.dur || 0.15;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.end) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.end), t0 + dur);
    g.gain.setValueAtTime(o.vol || 0.15, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(o.music ? this.musicGain : this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  },

  noise(o) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + (o.delay || 0);
    const dur = o.dur || 0.3;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(o.from || 3000, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, o.to || 200), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(o.vol || 0.25, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g);
    g.connect(o.music ? this.musicGain : this.sfxGain);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  },

  /* ---- 音效 ---- */
  shoot()      { this.tone({ freq: 920, end: 240, dur: 0.07, type: 'square', vol: 0.05 }); },
  enemyShoot() { this.tone({ freq: 300, end: 130, dur: 0.1, type: 'sawtooth', vol: 0.05 }); },
  hit()        { this.tone({ freq: 520, end: 300, dur: 0.05, type: 'triangle', vol: 0.08 }); },
  explode(big) {
    this.noise({ dur: big ? 0.7 : 0.3, vol: big ? 0.5 : 0.28, from: big ? 2600 : 1800, to: 60 });
    if (big) this.tone({ freq: 120, end: 30, dur: 0.6, type: 'sine', vol: 0.4 });
  },
  powerup() {
    [523, 659, 784, 1047].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.09, type: 'square', vol: 0.12, delay: i * 0.07 }));
  },
  shieldBreak() { this.noise({ dur: 0.25, vol: 0.3, from: 4000, to: 500 }); },
  playerHit() {
    this.noise({ dur: 0.5, vol: 0.45, from: 3200, to: 80 });
    this.tone({ freq: 400, end: 60, dur: 0.5, type: 'sawtooth', vol: 0.3 });
  },
  bomb() {
    this.tone({ freq: 90, end: 28, dur: 0.9, type: 'sine', vol: 0.55 });
    this.noise({ dur: 0.9, vol: 0.5, from: 1200, to: 40 });
  },
  waveStart() {
    [660, 880].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.12, type: 'square', vol: 0.14, delay: i * 0.12 }));
  },
  alarm() {
    for (let i = 0; i < 3; i++)
      this.tone({ freq: 440, end: 660, dur: 0.22, type: 'sawtooth', vol: 0.2, delay: i * 0.4 });
  },
  elite() {
    this.tone({ freq: 330, end: 550, dur: 0.3, type: 'sawtooth', vol: 0.16 });
    this.tone({ freq: 440, end: 700, dur: 0.3, type: 'sawtooth', vol: 0.12, delay: 0.18 });
  },
  gameover() {
    [392, 330, 262, 196].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.3, type: 'triangle', vol: 0.25, delay: i * 0.25 }));
  },
  record() {
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.15, type: 'square', vol: 0.18, delay: i * 0.09 }));
  },

  /* ---- 背景音乐:16 步小音序器(A 小调,138 BPM) ---- */
  _startMusic() {
    const bass = [110, 0, 110, 0, 131, 0, 110, 98, 110, 0, 110, 0, 165, 0, 131, 98];
    const lead = [440, 0, 523, 0, 0, 659, 0, 0, 440, 0, 523, 0, 0, 392, 0, 330];
    const spb = 60 / 138 / 2;
    this._step = 0;
    this._nextT = this.ctx.currentTime + 0.2;
    setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      while (this._nextT < this.ctx.currentTime + 0.2) {
        const s = this._step;
        const t = this._nextT - this.ctx.currentTime;
        if (bass[s]) this.tone({ freq: bass[s], dur: spb * 0.9, type: 'triangle', vol: 0.22, delay: t, music: true });
        if (lead[s]) this.tone({ freq: lead[s], dur: spb * 1.6, type: 'square', vol: 0.05, delay: t, music: true });
        if (s % 4 === 0) this.tone({ freq: 150, end: 40, dur: 0.12, type: 'sine', vol: 0.32, delay: t, music: true });
        if (s % 2 === 1) this.noise({ dur: 0.03, vol: 0.04, from: 8000, to: 6000, delay: t, music: true });
        this._nextT += spb;
        this._step = (s + 1) % 16;
      }
    }, 60);
  }
};
