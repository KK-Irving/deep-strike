'use strict';
/* ============================================================
 * 深空突袭 DEEP STRIKE — 每日任务
 * 按日期种子生成 3 条(全天所有玩家一致),跨局累计进度,
 * 完成即发放战术芯片,次日自动刷新
 * ============================================================ */

const TASK_POOL = [
  { id: 'kills', texts: ['击坠 150 架敌机', '击坠 220 架敌机'], ns: [150, 220], reward: 4, acm: true },
  { id: 'combo', texts: ['单局达成 30 连击', '单局达成 50 连击'], ns: [30, 50], reward: 4, acm: false },
  { id: 'wave',  texts: ['单局抵达第 10 波', '单局抵达第 14 波'], ns: [10, 14], reward: 5, acm: false },
  { id: 'elite', texts: ['击坠 6 架精英机', '击坠 10 架精英机'], ns: [6, 10], reward: 4, acm: true },
  { id: 'boss',  texts: ['击毁 2 艘旗舰'], ns: [2], reward: 4, acm: true },
  { id: 'score', texts: ['单局得分达到 20000', '单局得分达到 30000'], ns: [20000, 30000], reward: 5, acm: false },
  { id: 'box',   texts: ['累计开启 1 次密匣/兑换'], ns: [1], reward: 3, acm: true }
];

const DailyTasks = {
  state: null,

  load() {
    try { this.state = JSON.parse(localStorage.getItem('deepstrike.tasks')); }
    catch (e) { this.state = null; }
    if (!this.state || this.state.date !== this._today()) this._roll();
  },
  save() {
    try { localStorage.setItem('deepstrike.tasks', JSON.stringify(this.state)); } catch (e) { /* 忽略 */ }
  },
  _today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },
  /* 按日期派生种子:任务集全天固定且人人一致(与每日挑战种子不同流,互不干扰) */
  _roll() {
    let h = 2166136261;
    const k = 'tasks:' + this._today();
    for (let i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = Math.imul(h, 16777619); }
    const rnd = mulberry32(h >>> 0);
    const pool = TASK_POOL.slice();
    const tasks = [];
    for (let i = 0; i < 3 && pool.length; i++) {
      const t = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      tasks.push({
        id: t.id, acm: t.acm, reward: t.reward,
        text: t.texts[Math.floor(rnd() * t.texts.length)],
        n: t.ns[Math.floor(rnd() * t.ns.length)],
        p: 0, done: false
      });
    }
    this.state = { date: this._today(), tasks };
    this.save();
  },

  /* 进度上报:acm=true 累计型(跨局相加),false 单局型(取最好一次)。
   * 完成即发放芯片;局内完成时以横幅播报 */
  bump(id, v, game) {
    if (!this.state) return;
    const def = TASK_POOL.find(x => x.id === id);
    let changed = false;
    for (const t of this.state.tasks) {
      if (t.id !== id || t.done) continue;
      t.p = def && def.acm ? t.p + v : Math.max(t.p, v);
      if (t.p >= t.n) {
        t.done = true;
        Shop.addChips(t.reward);
        if (game && game.state === 'playing') {
          game.banner = { text: '📋 每日任务完成', sub: t.text + ' · ◈ +' + t.reward, life: 2.4, max: 2.4, gold: true };
          AudioSys.record();
        }
        changed = true;
      }
    }
    if (changed) {
      this.save();
      if (game && game._refreshTasks) game._refreshTasks();
    }
  },

  /* 主菜单任务面板 */
  render(el) {
    if (!el || !this.state) return;
    let html = '<div class="sec-title">每 日 任 务</div>';
    for (const t of this.state.tasks) {
      html += '<div class="task-row' + (t.done ? ' done' : '') + '">' +
        '<span class="task-check">' + (t.done ? '✓' : '□') + '</span>' +
        '<span class="task-text">' + t.text + '</span>' +
        '<span class="task-prog">' + (t.done ? '◈ +' + t.reward : Math.min(t.p, t.n) + '/' + t.n) + '</span>' +
        '</div>';
    }
    el.innerHTML = html;
  }
};
DailyTasks.load();
