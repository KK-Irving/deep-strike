'use strict';
/* ============================================================
 * 深空突袭 DEEP STRIKE — 模式流程模块(v2.2.0 自 game.js 拆出)
 * 海克斯大乱斗 / 恶魔契约 / 深空远征 的选取与结算流程,
 * 经 Object.assign 挂到 Game.prototype,加载顺序须在 game.js 之后。
 * ============================================================ */
Object.assign(Game.prototype, {
    /* ---------------- 海克斯大乱斗:强化三选一 ---------------- */
    /* 每轮按权重抽取品阶:轮次越靠后,黄金/棱彩占比越高(致敬 LoL 海克斯大乱斗) */
    _drawAugments(round) {
      const W8 = [{ s: 70, g: 30, p: 0 }, { s: 40, g: 45, p: 15 }, { s: 20, g: 50, p: 30 }, { s: 10, g: 35, p: 55 }][Math.max(0, Math.min(3, round - 1))];
      const owned = this.augments || {};
      const pool = AUGMENTS.filter(a => !owned[a.id]);
      const picks = [];
      for (let n = 0; n < 3 && pool.length; n++) {
        const roll = Math.random() * (W8.s + W8.g + W8.p);
        const tier = roll < W8.s ? 0 : roll < W8.s + W8.g ? 1 : 2;
        let cands = pool.filter(a => a.tier === tier);
        if (!cands.length) cands = pool;
        const pick = cands[Math.floor(Math.random() * cands.length)];
        picks.push(pick);
        pool.splice(pool.indexOf(pick), 1);
      }
      return picks;
    },
    _openAugmentChoice(round) {
      if (this.state !== 'playing' || this.mode !== 'mayhem') return;
      const picks = this._drawAugments(round);
      if (!picks.length) return;
      this._augMode = true;
      this._augRound = round;
      this._augChoices = picks;
      this.state = 'levelup';
      AudioSys.levelup();
      this._renderAugments();
      this._showState();
    },
    chooseAugment(i) {
      if (!this._augMode || this.state !== 'levelup') return;
      const a = this._augChoices[i];
      if (!a) return;
      this.augments[a.id] = a.tier + 1; // +1:白银(0 档)也须为真值,判定处一律按存在性判断
      AudioSys.bond();
      this.banner = { text: AUG_TIER[a.tier].name + ' · ' + a.name, sub: a.desc, life: 2.6, max: 2.6, gold: true };
      this._augMode = false;
      this._augChoices = [];
      this._recalc();
      this.state = 'playing';
      this._showState();
    },

    /* ---------------- 恶魔契约(Phase 4.4) ---------------- */
    _openDevilOffer() {
      const pathId = UPGRADES.find(u => u.path && (this.mods[u.id] || 0) > 0);
      const pool = UPGRADES.filter(u => u.rar === 2 && !u.hidden && !u.curse
        && (this.mods[u.id] || 0) < u.max
        && !(u.path && pathId && pathId.id !== u.id));
      if (pool.length < 3) return;
      const picks = [];
      const left = pool.slice();
      for (let i = 0; i < 3 && left.length; i++)
        picks.push(left.splice(Math.floor(RNG() * left.length), 1)[0]);
      if (picks.length < 3) return;
      this._devilMode = true;
      this._devilChoices = picks;
      this.state = 'levelup';
      AudioSys.alarm();
      this._renderDevils();
      this._showState();
    },
    chooseDevil(i) {
      if (!this._devilMode || this.state !== 'levelup') return;
      const u = this._devilChoices[i];
      if (!u) return;
      const p = this.player;
      const cost = Math.max(1, Math.round(p.maxHp * 0.1));
      p.devilCost = (p.devilCost || 0) + cost; // 本局生命上限扣减(随 _recalc 生效)
      p.hp = Math.max(1, p.hp - cost);
      this.mods[u.id] = (this.mods[u.id] || 0) + 1;
      if ((this.mods[u.id] || 0) >= u.max) this.stats.maxedCards = this._stat('maxedCards', 0) + 1;
      this._devilMode = false;
      this._devilChoices = [];
      AudioSys.bond();
      this.banner = { text: '😈 契约达成 · ' + u.name, sub: u.desc + ' · 生命上限 -' + cost, life: 2.8, max: 2.8, gold: true };
      this._recalc();
      this._achEvaluate();
      this.state = 'playing';
      this._showState();
    },
    rejectDevil() {
      if (!this._devilMode || this.state !== 'levelup') return;
      this._devilMode = false;
      this._devilChoices = [];
      this.state = 'playing';
      this._showState();
      this._addFloat(new FloatText(this.player.x, this.player.y - 30, '恶魔悻悻离去…', '#b0a0ff', 12));
    },
    /* ---------------- 深空远征:章节结算 ---------------- */
    _campaignClear() {
      const rate = this._campQuota > 0 ? this._campKills / this._campQuota : 1;
      const stars = 1 + (this._campClean ? 1 : 0) + (rate >= 0.65 ? 1 : 0);
      const st = this._campaignLoad();
      const prev = st[this.campaignChapter] || 0;
      const firstClear = prev === 0;
      if (stars > prev) st[this.campaignChapter] = stars;
      this._campaignSave(st);
      this._campaignResult = { stars, rate, firstClear };
      if (firstClear) {
        Shop.addCrystal(200 + this.campaignChapter * 50);
        if (this.campaignChapter >= CAMPAIGN_CHAPTERS && !Shop.owned.voyager) {
          Shop.owned.voyager = true; // 通关最终章赠专属涂装
          Shop.save();
        }
      }
      this._achEvaluate();
      this._gameover();
    },
    /* 恶魔判定(独立方法便于测试注入) */
    _devilRollHit() { return RNG() < 0.35; },
    /* 恶魔契约结算链检查点:升级/遗物链全部结束后,恶魔才现身 */
    _maybeDevil() {
      if (this._devilPending && this.state === 'playing' && this.pendingLevels <= 0
        && !this.pendingRelic && !this._relicMode && !this._augMode && this.player.alive) {
        this._devilPending = false;
        this._openDevilOffer();
      }
    },
    _renderDevils() {
      const row = this._dom.cardRow;
      row.innerHTML = '';
      this._dom.lvTitle.textContent = '😈 恶魔契约';
      const cost = Math.max(1, Math.round(this.player.maxHp * 0.1));
      this._dom.lvSub.innerHTML = '<b style="color:#ff6ad5">献祭 ' + cost + ' 点生命上限</b> · 换取一项史诗强化(按 1 / 2 / 3,或 4 拒绝)';
      this._devilChoices.forEach((u, i) => {
        const el = document.createElement('button');
        el.className = 'card devil';
        el.innerHTML =
          '<div class="card-rar" style="color:#c86bff">😈 恶魔的馈赠</div>' +
          '<div class="card-icon">' + u.icon + '</div>' +
          '<div class="card-name">' + u.name + '</div>' +
          '<div class="card-desc">' + u.desc + '</div>' +
          '<div class="card-lv">' + (u.max > 1 ? 'Lv ' + (this.mods[u.id] || 0) + ' → ' + ((this.mods[u.id] || 0) + 1) : '被动生效') + ' · 按 ' + (i + 1) + '</div>';
        el.addEventListener('click', () => this.chooseDevil(i));
        row.appendChild(el);
      });
      const skip = document.createElement('button');
      skip.className = 'menu-btn';
      skip.style.cssText = 'width:auto;padding:8px 22px;font-size:13px;flex-basis:100%;text-align:center;margin-top:10px';
      skip.innerHTML = '▸ 拒绝契约(保留生命上限,按 4)';
      skip.addEventListener('click', () => this.rejectDevil());
      row.appendChild(skip);
      this._dom.ownRow.innerHTML = '<span class="chip devil-chip">😈 代价:本局生命上限 -' + cost + '(当前生命同步扣减,至少保留 1)</span>';
    },

    /* ---------------- 深空远征:章节结算 ---------------- */
    _campaignClear() {
      const rate = this._campQuota > 0 ? this._campKills / this._campQuota : 1;
      const stars = 1 + (this._campClean ? 1 : 0) + (rate >= 0.65 ? 1 : 0);
      const st = this._campaignLoad();
      const prev = st[this.campaignChapter] || 0;
      const firstClear = prev === 0;
      if (stars > prev) st[this.campaignChapter] = stars;
      this._campaignSave(st);
      this._campaignResult = { stars, rate, firstClear };
      if (firstClear) {
        Shop.addCrystal(200 + this.campaignChapter * 50);
        if (this.campaignChapter >= CAMPAIGN_CHAPTERS && !Shop.owned.voyager) {
          Shop.owned.voyager = true; // 通关最终章赠专属涂装
          Shop.save();
        }
      }
      this._achEvaluate();
      this._gameover();
    },

    /* 战役存取:章号 → 星数(0~3) */
    _campaignLoad() {
      try { return JSON.parse(localStorage.getItem(CAMPAIGN_STORE)) || {}; }
      catch (e) { return {}; }
    },
    _campaignSave(st) {
      try { localStorage.setItem(CAMPAIGN_STORE, JSON.stringify(st)); } catch (e) { /* 忽略 */ }
    },
    campaignStars() {
      const st = this._campaignLoad();
      return Object.keys(st).reduce((s, k) => s + (st[k] || 0), 0);
    },
    campaignUnlocked(ch) {
      if (ch <= 1) return true;
      const st = this._campaignLoad();
      return (st[ch - 1] || 0) >= 1;
    },
});
