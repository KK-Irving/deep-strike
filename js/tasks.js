'use strict';
/* ============================================================
 * 深空突袭 DEEP STRIKE — 每日 / 每周任务
 * 按日期(周)种子生成,全天(周)所有玩家一致,跨局累计进度,
 * 完成即发放战术芯片,次日(周)自动刷新。
 * v1.6.1:修复任务文案与目标数值错配(同索引绑定);新增每周任务。
 * ============================================================ */

/* 每日任务池:texts[i] 与 ns[i] 一一对应(同索引绑定,不得各自独立随机) */
const TASK_POOL = [
  { id: 'kills', texts: ['击坠 150 架敌机', '击坠 220 架敌机'], ns: [150, 220], reward: 4, acm: true },
  { id: 'combo', texts: ['单局达成 30 连击', '单局达成 50 连击'], ns: [30, 50], reward: 4, acm: false },
  { id: 'wave',  texts: ['单局抵达第 10 波', '单局抵达第 14 波'], ns: [10, 14], reward: 5, acm: false },
  { id: 'elite', texts: ['击坠 6 架精英机', '击坠 10 架精英机'], ns: [6, 10], reward: 4, acm: true },
  { id: 'boss',  texts: ['击毁 2 艘旗舰'], ns: [2], reward: 4, acm: true },
  { id: 'score', texts: ['单局得分达到 20000', '单局得分达到 30000'], ns: [20000, 30000], reward: 5, acm: false },
  { id: 'box',   texts: ['累计开启 1 次密匣/兑换'], ns: [1], reward: 3, acm: true }
];

/* 每周任务池:目标更大、周期一周,奖励芯片更高 */
const WEEK_TASK_POOL = [
  { id: 'kills',   texts: ['本周累计击坠 1500 架敌机', '本周累计击坠 2200 架敌机'], ns: [1500, 2200], reward: 15, acm: true },
  { id: 'boss',    texts: ['本周累计击毁 12 艘旗舰', '本周累计击毁 18 艘旗舰'], ns: [12, 18], reward: 18, acm: true },
  { id: 'wave',    texts: ['单局抵达第 20 波', '单局抵达第 25 波'], ns: [20, 25], reward: 20, acm: false },
  { id: 'score',   texts: ['单局得分达到 60000', '单局得分达到 90000'], ns: [60000, 90000], reward: 20, acm: false },
  { id: 'elite',   texts: ['本周累计击坠 50 架精英机', '本周累计击坠 80 架精英机'], ns: [50, 80], reward: 15, acm: true },
  { id: 'crystal', texts: ['本周累计获得 800 星晶', '本周累计获得 1200 星晶'], ns: [800, 1200], reward: 15, acm: true },
  { id: 'box',     texts: ['本周累计开启 6 次密匣/兑换'], ns: [6], reward: 12, acm: true },
  { id: 'daily',   texts: ['本周完成 8 条每日任务', '本周完成 12 条每日任务'], ns: [8, 12], reward: 18, acm: true }
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
    this.state = this._rollPool('tasks:' + this._today(), TASK_POOL, 3, { date: this._today() });
    this.save();
  },
  /* 从池中抽取 count 条:texts/ns/reward 按同一随机索引绑定,杜绝文案与数值错配 */
  _rollPool(seedKey, pool, count, base) {
    let h = 2166136261;
    for (let i = 0; i < seedKey.length; i++) { h ^= seedKey.charCodeAt(i); h = Math.imul(h, 16777619); }
    const rnd = mulberry32(h >>> 0);
    const left = pool.slice();
    const tasks = [];
    for (let i = 0; i < count && left.length; i++) {
      const t = left.splice(Math.floor(rnd() * left.length), 1)[0];
      const vi = Math.floor(rnd() * t.ns.length); // 同一索引:文案、目标数值、数量绑定
      tasks.push({
        id: t.id, acm: t.acm, reward: t.reward,
        text: t.texts[vi],
        n: t.ns[vi],
        p: 0, done: false
      });
    }
    return Object.assign({}, base, { tasks });
  },

  /* 进度上报:同时驱动每日与每周;acm=true 累计型(跨局相加),false 单局型(取最好一次)。
   * 完成即发放芯片;局内完成时以横幅播报 */
  bump(id, v, game) {
    if (this.state) this._bumpState(this, id, v, game, '📋 每日任务完成');
    if (typeof WeeklyTasks !== 'undefined') WeeklyTasks.bump(id, v, game);
  },
  /* 内部:对给定任务集上报进度(供每日/每周共用) */
  _bumpState(mgr, id, v, game, bannerText) {
    const st = mgr.state;
    const def = mgr._pool().find(x => x.id === id);
    let changed = false;
    for (const t of st.tasks) {
      if (t.id !== id || t.done) continue;
      t.p = def && def.acm ? t.p + v : Math.max(t.p, v);
      if (t.p >= t.n) {
        t.done = true;
        Shop.addChips(t.reward);
        if (game && game.state === 'playing') {
          game.banner = { text: bannerText, sub: t.text + ' · ◈ +' + t.reward, life: 2.4, max: 2.4, gold: true };
          AudioSys.record();
        }
        changed = true;
        if (typeof WeeklyTasks !== 'undefined' && mgr === DailyTasks) WeeklyTasks.bump('daily', 1, null); // 每周:完成每日任务计数
      }
    }
    if (changed) {
      mgr.save();
      if (game && game._refreshTasks) game._refreshTasks();
    }
  },
  _pool() { return TASK_POOL; },

  /* 主菜单任务面板:每日 + 每周 两节 */
  render(el) {
    if (!el || !this.state) return;
    let html = this._section('每 日 任 务', this.state.tasks);
    if (typeof WeeklyTasks !== 'undefined' && WeeklyTasks.state)
      html += this._section('每 周 任 务', WeeklyTasks.state.tasks);
    el.innerHTML = html;
  },
  _section(title, tasks) {
    let html = '<div class="sec-title">' + title + '</div>';
    for (const t of tasks) {
      html += '<div class="task-row' + (t.done ? ' done' : '') + '">' +
        '<span class="task-check">' + (t.done ? '✓' : '□') + '</span>' +
        '<span class="task-text">' + t.text + '</span>' +
        '<span class="task-prog">' + (t.done ? '◈ +' + t.reward : Math.min(t.p, t.n) + '/' + t.n) + '</span>' +
        '</div>';
    }
    return html;
  }
};

/* 每周任务:按 ISO 周号播种,与周挑战周号一致 */
const WeeklyTasks = {
  state: null,

  load() {
    try { this.state = JSON.parse(localStorage.getItem('deepstrike.weektasks')); }
    catch (e) { this.state = null; }
    if (!this.state || this.state.week !== this._weekKey()) this._roll();
  },
  save() {
    try { localStorage.setItem('deepstrike.weektasks', JSON.stringify(this.state)); } catch (e) { /* 忽略 */ }
  },
  _pool() { return WEEK_TASK_POOL; },
  /* ISO 8601 周号(与 Game._weekKey 同算法,独立模块不复用) */
  _weekKey() {
    const d = new Date();
    const thursday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    thursday.setDate(thursday.getDate() - ((thursday.getDay() + 6) % 7) + 3);
    const isoYear = thursday.getFullYear();
    const first = new Date(isoYear, 0, 4);
    first.setDate(first.getDate() - ((first.getDay() + 6) % 7) + 3);
    const week = 1 + Math.round((thursday - first) / (7 * 86400000));
    return isoYear + '-W' + String(week).padStart(2, '0');
  },
  _roll() {
    this.state = DailyTasks._rollPool('weektasks:' + this._weekKey(), WEEK_TASK_POOL, 4, { week: this._weekKey() });
    this.save();
  },
  bump(id, v, game) {
    if (!this.state) return;
    DailyTasks._bumpState(this, id, v, game, '📅 每周任务完成');
  }
};

DailyTasks.load();
WeeklyTasks.load();
