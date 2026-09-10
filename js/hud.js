'use strict';
/* ============================================================
 * 深空突袭 DEEP STRIKE — 渲染与面板(v1.9.3 自 game.js 拆出)
 * 画布场景渲染(render/_drawHud)与全部 DOM 面板:战绩档案/任务/
 * 升级三选一/遗物三选一/海克斯符文/换卡/结算摘要/菜单页切换/状态条。
 * 通过 Object.assign 挂到 Game.prototype,加载顺序须在 game.js 之后。
 * ============================================================ */
Object.assign(Game.prototype, {
    _refreshStatsPanel() {
      const d = this._dom;
      d.stHi.textContent = this.hi;
      d.stWave.textContent = this._stat('bestWave', 0);
      d.stGames.textContent = this._stat('games', 0);
      d.stKills.textContent = this._stat('kills', 0);
      d.stScore.textContent = this._stat('totalScore', 0);
      d.stBoss.textContent = this._stat('bossKills', 0);
      // 成就列表(按分类分组)
      if (typeof Ach.evaluate === 'function') this._achEvaluate();
      const on = Ach.count();
      const cats = [...new Set(ACHIEVEMENTS.map(a => a.cat))];
      const fmt = (n) => n >= 10000 ? ((n / 10000).toFixed(n % 10000 !== 0 ? 1 : 0).replace(/\.0$/, '') + '万') : String(n);
      let html = '<div class="ach-head">' + on + '/' + ACHIEVEMENTS.length + ' 线 · ' + Ach.gotTiers() + '/' + Ach.totalTiers() + ' 级</div>';
      for (const cat of cats) {
        const list = ACHIEVEMENTS.filter(a => a.cat === cat);
        const gotCat = list.filter(a => Ach.levelOf(a.id) > 0).length;
        html += '<div class="ach-cat">' + cat + ' ' + gotCat + '/' + list.length + '</div>';
        for (const a of list) {
          const lv = Ach.levelOf(a.id);
          const max = a.tiers.length;
          const v = (Ach._last || {})[a.stat] || 0;
          const next = lv < max ? a.tiers[lv] : null;
          const prog = lv >= max ? 'MAX' : fmt(Math.min(v, next)) + '/' + fmt(next);
          html += '<div class="ach-item ' + (lv > 0 ? 'on' : 'off') + '">' +
            '<i>' + (lv > 0 ? '🏆' : '🔒') + '</i>' +
            '<div><b>' + a.name + (lv > 0 ? ' <em class="ach-lv">Lv' + lv + '</em>' : '') + '</b>' +
            '<span>' + a.pre + ' ' + prog + '</span>' +
            '<span class="ach-tiers">' + a.tiers.map((n, i) => '<i class="' + (i < lv ? 'got' : '') + '">' + fmt(n) + '</i>').join('') + '</span></div></div>';
        }
      }
      d.achList.innerHTML = html;
      // 敌机图鉴
      if (d.bestiaryGrid) {
        const best = this.stats.best || {}, seen = this.stats.bestSeen || {};
        const keys = Object.keys(BESTIARY_INFO);
        const got = keys.filter(k => seen[k]).length;
        let bhtml = '<div class="ach-head">已收录 ' + got + ' / ' + keys.length + ' · 首次击毁发放星晶</div>';
        for (const k of keys) {
          const info = BESTIARY_INFO[k];
          if (seen[k]) {
            bhtml += '<div class="best-item on"><b>' + info.name + '</b><span>击坠 ' + best[k] + '</span><i>+' + info.reward + '★</i></div>';
          } else {
            bhtml += '<div class="best-item off"><b>???</b><span>尚未击毁</span><i>+' + info.reward + '★</i></div>';
          }
        }
        d.bestiaryGrid.innerHTML = bhtml;
      }
    },
    /* BOSS 演出:瞄准系大招前摇警示是否生效(纯读状态,不改攻击时序)
     * 覆盖:要塞旗舰任意阶段的重压扇面 / 暴君一阶段的瞄准五连 */
    _bossTelegraphOn(b) {
      return !!b && b.state === 'fight' && b.fireCd > 0 && b.fireCd < 0.55
        && (b.variant === 'dread' || (b.variant === 'tyrant' && b.phase === 0));
    },
    _renderTuning() {
      const el = document.getElementById('tuningList');
      if (!el) return;
      el.innerHTML = '';
      for (const def of Shop.TUNINGS) {
        const info = Shop.tuningInfo(def.id);
        const btn = document.createElement('button');
        btn.className = 'menu-btn';
        btn.style.cssText = 'flex-basis:100%;text-align:left;font-size:13px';
        const lvRow = def.lv.map((txt, i) => '<i class="' + (i < info.lv ? 'got' : '') + '" style="font-style:normal;opacity:' + (i < info.lv ? 1 : 0.55) + '">Lv' + (i + 1) + ' ' + txt + '</i>').join('<br>');
        btn.innerHTML = '▸ ' + def.icon + ' ' + def.name + '(' + def.flow + '流) <i style="float:right;color:#ffd166">Lv' + info.lv + '/3</i><br>' +
          '<span style="font-size:11.5px;opacity:0.85">' + lvRow + '</span><br>' +
          (info.maxed
            ? '<span style="font-size:12px;color:#51e08a">已满改</span>'
            : '<span style="font-size:12px;color:#ffd166">下一级:' + info.nextDesc + ' · 需 残骸×' + info.nextScrap + ' + ' + info.nextCrystal + '★</span>');
        btn.addEventListener('click', () => {
          const res = Shop.buyTuning(def.id);
          if (res.ok) { AudioSys.bond(); game._addFloat && 0; }
          btn.blur();
          game.showMenuPanel('tuning');
        });
        el.appendChild(btn);
      }
      const scrapRow = document.createElement('div');
      scrapRow.className = 'hint';
      scrapRow.style.marginTop = '10px';
      scrapRow.textContent = '当前残骸:' + (Shop.scrap || 0);
      el.appendChild(scrapRow);
    },
    _renderCampaignList() {
      const st = (function () { try { return JSON.parse(localStorage.getItem('deepstrike.campaign')) || {}; } catch (e) { return {}; } })();
      const el = document.getElementById('campaignList');
      if (!el) return;
      el.innerHTML = '';
      for (let ch = 1; ch <= CAMPAIGN_CHAPTERS; ch++) {
        const unlocked = ch === 1 || (st[ch - 1] || 0) >= 1;
        const stars = st[ch] || 0;
        const btn = document.createElement('button');
        btn.className = 'menu-btn' + (unlocked ? '' : ' locked');
        btn.style.cssText = 'flex-basis:100%;text-align:left;font-size:13px' + (unlocked ? '' : ';opacity:0.45');
        btn.innerHTML = (unlocked ? '▸' : '🔒') + ' 第 ' + ch + ' 章 · ' + BOSS_VARIANTS[CAMPAIGN_VARIANTS[(ch - 1) % 4]].name
          + ' <i style="float:right;color:#ffd166">' + '★'.repeat(stars) + '☆'.repeat(3 - stars) + '</i>';
        if (unlocked) btn.addEventListener('click', () => { AudioSys.init(); game.start('campaign', ch); });
        el.appendChild(btn);
      }
    },
    _renderOffline() {
      const el = this._dom.offlinePanel;
      if (!el) return;
      const info = Shop.offlineInfo();
      if (!info.gain) { el.classList.add('hidden'); return; }
      el.classList.remove('hidden');
      const hh = Math.floor(info.seconds / 3600);
      const mm = Math.floor((info.seconds % 3600) / 60);
      el.innerHTML = '<div class="sec-title">🛰 离线补给站</div>' +
        '<div class="task-row"><span class="task-text">离线补给已就绪 ' + (hh ? hh + ' 时 ' : '') + mm + ' 分</span>' +
        '<span class="task-prog"><button class="menu-btn" id="btnClaimOffline" style="width:auto;padding:4px 14px;font-size:12px">领取 +' + info.gain + '★</button></span></div>';
      const btn = document.getElementById('btnClaimOffline');
      if (btn) btn.addEventListener('click', () => {
        Shop.claimOffline();
        AudioSys.bond();
        this._renderOffline();
        this._refreshTasks();
      });
    },
    _refreshTasks() {
      if (typeof DailyTasks !== 'undefined') DailyTasks.render(this._dom.taskPanel);
    },
    showMenuPanel(name) {
      if (this.state !== 'menu' && this.state !== 'gameover') return;
      if (this.state === 'gameover') this.toMenu();
      this.menuPanel = name;
      if (name === 'stats') this._refreshStatsPanel();
      if (name === 'shop') Shop.renderPanel();
      this._showState();
    },
    _refreshMenuHi() {
      this._dom.menuHi.textContent = '最高纪录 ' + this.hi + ' · 每日 ' + this._modeBest('daily')
        + ' · 周挑战 ' + this._modeBest('weekly') + ' · 连战 ' + this._bossBest() + ' · 大乱斗 ' + this._mayhemBest();
    },
    _showState() {
      const d = this._dom;
      d.menu.classList.toggle('hidden', this.state !== 'menu');
      d.pause.classList.toggle('hidden', this.state !== 'paused');
      d.over.classList.toggle('hidden', this.state !== 'gameover');
      d.levelup.classList.toggle('hidden', this.state !== 'levelup');
      if (this.state === 'menu') {
        d.menuMain.classList.toggle('hidden', this.menuPanel !== 'main');
        d.menuCampaign.classList.toggle('hidden', this.menuPanel !== 'campaign');
        d.menuTuning.classList.toggle('hidden', this.menuPanel !== 'tuning');
        d.menuHelp.classList.toggle('hidden', this.menuPanel !== 'help');
        d.menuStats.classList.toggle('hidden', this.menuPanel !== 'stats');
        d.menuShop.classList.toggle('hidden', this.menuPanel !== 'shop');
        if (this.menuPanel === 'main') {
          this._refreshTasks();
          this._renderOffline();
          const scrapHint = document.getElementById('scrapHint');
          if (scrapHint) scrapHint.textContent = Shop.scrap || 0;
          if (d.btnHard) d.btnHard.innerHTML = '▸ 高难模式:' + (this.hard ? '开' : '关') + ' <i>星晶×1.5</i>';
        }
        if (this.menuPanel === 'campaign') this._renderCampaignList();
        if (this.menuPanel === 'tuning') this._renderTuning();
        if (this.menuPanel === 'shop') Shop.renderPanel();
      }
    },
    _renderCards() {
      this._dom.lvTitle.textContent = '⬆ 战机升级';
      const row = this._dom.cardRow;
      row.innerHTML = '';
      const owned = this._ownedIds().length;
      const slotsFull = owned >= this.maxSlots;
      this._dom.lvSub.innerHTML = '槽位 <b style="color:#ffd166">' + owned + ' / ' + this.maxSlots + '</b>' +
        (slotsFull ? ' · 已满,选新卡需替换(也可跳过)' : ' · 按 1 / 2 / 3 或点击卡片');
      this._cardChoices.forEach((u, i) => {
        const r = RARITY[u.rar];
        const cur = this.mods[u.id] || 0;
        const needSwap = slotsFull && !cur && !u.hidden && !u.isEvo;
        const el = document.createElement('button');
        el.className = 'card r' + u.rar + (u.hidden ? ' hidden-card' : '') + (u.isEvo ? ' evo-card' : '') + (u.curse ? ' curse' : '');
        el.innerHTML =
          '<div class="card-rar" style="color:' + (u.curse ? '#ff5577' : r.color) + '">' + (u.curse ? '诅咒 ⚠' : (u.hidden ? '隐藏卡' : r.name)) + (u.isEvo ? ' ✦' : u.rar === 2 ? ' ★' : '') + '</div>' +
          '<div class="card-icon">' + u.icon + '</div>' +
          '<div class="card-name">' + u.name + '</div>' +
          '<div class="card-desc">' + u.desc + '</div>' +
          '<div class="card-lv">' + (u.isEvo ? '传说进化! · ' + UPGRADE_MAP[u.base].name + ' 满级'
            : u.hidden ? '槽位 +1'
            : cur > 0 ? 'Lv ' + cur + ' → ' + (cur + 1)
            : needSwap ? '需替换一项' : '新能力!') + ' · 按 ' + (i + 1) + '</div>';
        el.addEventListener('click', () => this.chooseCard(i));
        row.appendChild(el);
      });
      // 已持有强化与羁绊一览
      let html = '';
      for (const u of UPGRADES) {
        const c = this.mods[u.id] || 0;
        if (c > 0) html += '<span class="chip' + (this.evo[u.id] ? ' evo' : '') + '"><i>' + u.icon + '</i>' + u.name + (u.max > 1 ? ' ×' + c : '') + (this.evo[u.id] ? ' ✦' : '') + '</span>';
      }
      for (const b of BONDS) {
        if (this.bonds.includes(b.id)) html += '<span class="chip bond" title="' + b.desc + '">羁绊·' + b.name + '</span>';
      }
      this._dom.ownRow.innerHTML = html || '<span class="chip">首次升级 · 选择你的成长路线</span>';
      // 跳过按钮:暂存本次升级,稍后自动弹出
      const skip = document.createElement('button');
      skip.className = 'menu-btn';
      skip.style.cssText = 'width:auto;padding:8px 22px;font-size:13px;flex-basis:100%;text-align:center;margin-top:10px';
      skip.innerHTML = '▸ 跳过本次升级(暂存,稍后自动弹出)';
      skip.addEventListener('click', () => this.skipUpgrade());
      row.appendChild(skip);
    },
    _renderRelics() {
      this._dom.lvTitle.textContent = '⬆ 远古遗物';
      const row = this._dom.cardRow;
      row.innerHTML = '';
      this._dom.lvSub.innerHTML = '旗舰遗落了远古造物 · <b style="color:#ffd166">选择一件遗物</b>(按 1 / 2 / 3)';
      this._relicChoices.forEach((r, i) => {
        const el = document.createElement('button');
        el.className = 'card r3 evo-card';
        el.innerHTML =
          '<div class="card-rar" style="color:#ffd166">遗 物 ✦</div>' +
          '<div class="card-icon">' + r.icon + '</div>' +
          '<div class="card-name">' + r.name + '</div>' +
          '<div class="card-desc">' + r.desc + '</div>' +
          '<div class="card-lv">被动生效 · 按 ' + (i + 1) + '</div>';
        el.addEventListener('click', () => this.chooseRelic(i));
        row.appendChild(el);
      });
      let html = '';
      for (const r0 of RELICS) {
        if (this.relics[r0.id]) html += '<span class="chip evo"><i>' + r0.icon + '</i>' + r0.name + '</span>';
      }
      this._dom.ownRow.innerHTML = html || '<span class="chip">尚无遗物</span>';
    },
    _renderAugments() {
      this._dom.lvTitle.textContent = '⬆ 海克斯强化';
      const row = this._dom.cardRow;
      row.innerHTML = '';
      this._dom.lvSub.innerHTML = '海克斯强化(第 ' + this._augRound + ' / 4 轮) · <b style="color:#ffd166">选择一项</b>(按 1 / 2 / 3)';
      this._augChoices.forEach((a, i) => {
        const t = AUG_TIER[a.tier];
        const el = document.createElement('button');
        el.className = 'card aug tier' + a.tier;
        el.innerHTML =
          '<div class="card-rar" style="color:' + t.color + '">◆ ' + t.name + '</div>' +
          '<div class="card-icon">' + a.icon + '</div>' +
          '<div class="card-name">' + a.name + '</div>' +
          '<div class="card-desc">' + a.desc + '</div>' +
          '<div class="card-lv">按 ' + (i + 1) + '</div>';
        el.addEventListener('click', () => this.chooseAugment(i));
        row.appendChild(el);
      });
      let html = '';
      for (const id in this.augments) {
        const a = AUGMENTS.find(x => x.id === id);
        if (a) html += '<span class="chip aug t' + a.tier + '">◆ ' + a.name + '</span>';
      }
      this._dom.ownRow.innerHTML = html || '<span class="chip">首轮强化</span>';
    },
    _renderSwap() {
      const row = this._dom.cardRow;
      row.innerHTML = '';
      const u = this._pendingSwap;
      this._dom.lvSub.innerHTML = '<b style="color:#ff8fa5">槽位已满</b> · 点击卡片替换为「' + u.icon + ' ' + u.name + '」 · 或仅丢弃腾出槽位 <span style="color:rgba(159,232,255,0.5)">(Esc 返回)</span>';
      this._swapList.forEach((id, i) => {
        const owned = UPGRADE_MAP[id];
        const r = RARITY[owned.rar];
        const el = document.createElement('div');
        el.className = 'card swap r' + owned.rar;
        el.setAttribute('role', 'button');
        el.innerHTML =
          '<div class="card-rar" style="color:' + r.color + '">替换 · 按 ' + (i + 1) + '</div>' +
          '<div class="card-icon">' + owned.icon + '</div>' +
          '<div class="card-name">' + owned.name + '</div>' +
          '<div class="card-desc">Lv ' + this.mods[id] + ' / ' + owned.max + '</div>' +
          '<div class="card-lv">点击卡片 = 丢弃并装备新卡</div>' +
          '<button class="swap-discard" data-discard="' + id + '">🗑 仅丢弃(腾槽)</button>';
        el.addEventListener('click', () => this.swapPick(id));
        row.appendChild(el);
      });
      row.querySelectorAll('[data-discard]').forEach(btn =>
        btn.addEventListener('click', (ev) => { ev.stopPropagation(); this.discardOnly(btn.dataset.discard); }));
      const cancel = document.createElement('button');
      cancel.className = 'menu-btn';
      cancel.style.cssText = 'width:auto;padding:8px 22px;font-size:13px;flex-basis:100%;text-align:center';
      cancel.innerHTML = '▸ 返回选项(重新挑选)';
      cancel.addEventListener('click', () => this.cancelSwap());
      row.appendChild(cancel);
      const skip2 = document.createElement('button');
      skip2.className = 'menu-btn';
      skip2.style.cssText = 'width:auto;padding:8px 22px;font-size:13px;flex-basis:100%;text-align:center';
      skip2.innerHTML = '▸ 跳过本次升级(暂存,稍后自动弹出)';
      skip2.addEventListener('click', () => this.skipUpgrade());
      row.appendChild(skip2);
    },
    render() {
      const ctx = this.ctx;
      ctx.drawImage(this.bg, 0, 0);
      this.stars.draw(ctx);

      ctx.save();
      const off = this._shakeOff();
      if (off) ctx.translate(off[0], off[1]);

      for (const pu of this.powerups) pu.draw(ctx);
      for (const su of this.supplies) su.draw(ctx);
      for (const o of this.orbs) o.draw(ctx);
      for (const a of this.asteroids) a.draw(ctx);
      for (const rf of this.rifts) rf.draw(ctx);
      for (const e of this.enemies) e.draw(ctx);
      if (this.boss) this.boss.draw(ctx);
      this.player.draw(ctx);
      for (const w of this.wingmen) w.draw(ctx);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const b of this.playerBullets) {
        if (b.boom) {
          // 回旋刃:旋转双刃造型
          ctx.save();
          ctx.translate(b.x, b.y);
          ctx.rotate(b.spin || 0);
          ctx.fillStyle = 'rgba(143,245,224,0.35)';
          ctx.fillRect(-b.r - 3, -2, (b.r + 3) * 2, 4);
          ctx.fillRect(-2, -b.r - 3, 4, (b.r + 3) * 2);
          ctx.fillStyle = b.color;
          ctx.beginPath(); ctx.arc(0, 0, b.r * 0.55, 0, TAU); ctx.fill();
          ctx.restore();
          continue;
        }
        ctx.fillStyle = 'rgba(120,220,255,0.35)';
        ctx.fillRect(b.x - 3.5, b.y - 13, 7, 18);
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x - 1.8, b.y - 10, 3.6, 14);
      }
      // 激光光束
      if (this.player.beamOn && this.beams) {
        const tk = performance.now() / 1000;
        for (const bm of this.beams) {
          const flick = 0.72 + 0.28 * Math.sin(tk * 42 + bm.x);
          const bottom = this.player.y - 14;
          // 过载脉冲:光束转为炽白金色并加宽;分裂副束偏青
          const hot = bm.hot;
          const glowCol = hot ? 'rgba(255,196,120,' : (bm.split ? 'rgba(120,240,255,' : 'rgba(255,110,170,');
          const coreCol = hot ? 'rgba(255,250,230,' : (bm.split ? 'rgba(224,255,255,' : 'rgba(255,228,246,');
          const wMul = hot ? 3.0 : 2.2;
          ctx.fillStyle = glowCol + (0.16 * flick).toFixed(3) + ')';
          ctx.fillRect(bm.x - bm.halfW * wMul, 0, bm.halfW * wMul * 2, bottom);
          ctx.fillStyle = coreCol + ((hot ? 0.9 : 0.72) * flick).toFixed(3) + ')';
          ctx.fillRect(bm.x - bm.halfW * 0.7, 0, bm.halfW * 1.4, bottom);
        }
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

      // BOSS 演出层(纯表现,Phase 4.2):登场警戒线 + 瞄准大招前摇警示圈
      if (this.boss && !this.boss.dead) {
        const b0 = this.boss;
        if (b0.state === 'enter') {
          const prog = clamp((b0.y + 90) / 205, 0, 1);
          ctx.save();
          ctx.globalAlpha = 0.2 + 0.5 * prog;
          ctx.strokeStyle = '#ff4d6d';
          ctx.lineWidth = 2;
          ctx.setLineDash([18, 12]);
          ctx.lineDashOffset = -(Date.now() / 28) % 60;
          ctx.beginPath(); ctx.moveTo(0, 115); ctx.lineTo(W, 115); ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        } else if (this._bossTelegraphOn(b0)) {
          const k = b0.fireCd / 0.55; // 1 → 0 收缩
          ctx.save();
          ctx.globalAlpha = 0.35 + 0.45 * (1 - k);
          ctx.strokeStyle = '#ff8c42';
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(b0.x, b0.y + 26, 14 + 22 * k, 0, TAU); ctx.stroke();
          ctx.globalAlpha *= 0.5;
          ctx.beginPath(); ctx.arc(b0.x, b0.y + 26, 6, 0, TAU); ctx.fillStyle = '#ff8c42'; ctx.fill();
          ctx.restore();
        }
      }

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
      // 濒死警示:最后一丝生命时屏幕边缘红色脉动
      if (this.state === 'playing' && this.player.alive && this.player.hp / this.player.maxHp <= 0.3) {
        const a = 0.10 + 0.07 * Math.sin(performance.now() / 250);
        const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 0.72);
        g.addColorStop(0, 'rgba(255,40,70,0)');
        g.addColorStop(1, 'rgba(255,40,70,' + a.toFixed(3) + ')');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      if (this.state !== 'menu') this._drawHud(ctx);
    },
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
      ctx.fillText((this.mode === 'boss' ? 'STAGE ' : 'WAVE ') + this.wave, W - 14, 14);
      // 关卡目标进度
      const quotaMet = this.waveKills >= this.waveQuota;
      ctx.font = 'bold 12px Consolas, monospace';
      if (this.wave % 5 === 0) {
        ctx.fillStyle = '#ff8fa5';
        ctx.fillText('目标:击毁旗舰', W - 14, 38);
      } else if (quotaMet) {
        ctx.fillStyle = '#51e08a';
        ctx.fillText('目标达成 ' + this.waveKills + '/' + this.waveQuota, W - 14, 38);
      } else {
        const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 150);
        ctx.fillStyle = 'rgba(255,209,102,' + pulse.toFixed(2) + ')';
        ctx.fillText('击坠 ' + this.waveKills + ' / ' + this.waveQuota, W - 14, 38);
      }
      if (AudioSys.muted) {
        // 放在右列最下方(挑战标签 y54 / 威胁等级 y68 之下),避免与目标进度文字叠印
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '12px sans-serif';
        ctx.fillText('♪ OFF', W - 14, 82);
      }
      // 挑战模式标识
      if (this.mode !== 'normal') {
        const tagName = this.mode === 'weekly' ? '周挑战' : this.mode === 'boss' ? '旗舰连战' : this.mode === 'mayhem' ? '海克斯大乱斗' : '每日挑战';
        const best = this.mode === 'boss' ? this._bossBest() : this.mode === 'mayhem' ? this._mayhemBest() : this._challengeBest();
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 11px Consolas, monospace';
        ctx.fillText(tagName + ' · 纪录 ' + best, W - 14, 54);
      }
      // 无尽模式:威胁等级与波次词缀
      const threat = this.threatLevel();
      if (threat > 0) {
        ctx.fillStyle = 'rgba(255,120,140,0.9)';
        ctx.font = 'bold 11px Consolas, monospace';
        ctx.fillText('⚡ 威胁等级 ' + threat, W - 14, this.mode !== 'normal' ? 68 : 54);
      }
      if (this.waveMod) {
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 11px "Segoe UI", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(this.waveMod.icon + ' ' + this.waveMod.name + ' · ' + this.waveMod.desc, 14, 54);
      }
      // 限时增益倒计时
      const bt = [];
      if (this.buffs.x2 > 0) bt.push('×2 ' + Math.ceil(this.buffs.x2) + 's');
      if (this.buffs.frenzy > 0) bt.push('狂热 ' + Math.ceil(this.buffs.frenzy) + 's');
      if (this.buffs.frost > 0) bt.push('寒霜 ' + Math.ceil(this.buffs.frost) + 's');
      if (this.buffs.jam > 0) bt.push('受干扰 ' + Math.ceil(this.buffs.jam) + 's');
      if (bt.length) {
        const jamOnly = this.buffs.jam > 0 && bt.length === 1;
        ctx.fillStyle = jamOnly ? '#b0ff5a' : '#c86bff';
        ctx.font = 'bold 11px "Segoe UI", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('✦ ' + bt.join(' · '), 14, 68);
      }
      // 周挑战全局变异
      if (this._mut) {
        ctx.fillStyle = '#c86bff';
        ctx.font = 'bold 11px "Segoe UI", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(this._mut.icon + ' 周变异·' + this._mut.name + ' · ' + this._mut.desc, 14, 82);
      }
      // 高难模式标识
      if (this.hard) {
        ctx.fillStyle = '#ff5577';
        ctx.font = 'bold 11px Consolas, monospace';
        ctx.textAlign = 'right';
        ctx.fillText('☠ 高难 ×1.5★', W - 14, 96);
      }
      // 生命条(数值化生命)
      {
        const bw = 104, bx = 14, by = H - 27;
        const pct = clamp(p.hp / p.maxHp, 0, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(bx - 1, by - 1, bw + 2, 10);
        ctx.fillStyle = pct > 0.5 ? '#51e08a' : (pct > 0.25 ? '#ffd166' : '#ff5577');
        ctx.fillRect(bx, by, bw * pct, 8);
        ctx.strokeStyle = 'rgba(126,243,255,0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx - 1.5, by - 1.5, bw + 3, 11);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#cfe8ff';
        ctx.font = 'bold 10px Consolas, monospace';
        ctx.fillText('HP ' + Math.ceil(p.hp) + '/' + p.maxHp, bx + bw + 8, by);
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
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 15px Consolas, monospace';
        ctx.fillText(this.combo + ' COMBO  ×' + this.multiplier(), W / 2, 60);
        const fw = 90 * clamp(this.comboT / this.comboWindow, 0, 1);
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
        // 三阶段分段标记(当前阶段高亮)
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(bx + bw / 3 - 1, by, 2, 8);
        ctx.fillRect(bx + bw * 2 / 3 - 1, by, 2, 8);
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 9px Consolas, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('P' + (this.boss.phase + 1), bx + bw + 10, by + 1);
      }
      // 经验条与等级
      if (this.level > 1 || this.xp > 0 || this.mods && Object.keys(this.mods).length) {
        const bw = 170, bx = (W - bw) / 2, by = 12;
        ctx.textAlign = 'right';
        ctx.fillStyle = '#8fe8ff';
        ctx.font = 'bold 12px Consolas, monospace';
        ctx.fillText('LV ' + this.level, bx - 8, by - 1);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(bx - 1, by - 1, bw + 2, 9);
        const xf = clamp(this.xp / this.xpNext, 0, 1);
        ctx.fillStyle = '#37e2ff';
        ctx.fillRect(bx, by, bw * xf, 7);
        ctx.strokeStyle = 'rgba(143,232,255,0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx - 1.5, by - 1.5, bw + 3, 10);
      }
      // 波次横幅
      if (this.banner && this.banner.life > 0) {
        const b = this.banner;
        const a = Math.min(1, b.life / 0.5) * Math.min(1, (b.max - b.life) * 4);
        ctx.globalAlpha = clamp(a, 0, 1);
        const col = b.red ? '#ff3355' : (b.gold ? '#ffd166' : '#7ef3ff');
        const glow = b.red ? '#ff3355' : (b.gold ? '#ffae30' : '#37e2ff');
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const maxW = W - 36;
        ctx.fillStyle = col;
        ctx.font = 'bold 34px "Segoe UI", "Microsoft YaHei", sans-serif';
        const mainW = ctx.measureText(b.text).width;
        if (mainW > maxW) ctx.font = 'bold ' + Math.max(16, Math.floor(34 * maxW / mainW)) + 'px "Segoe UI", "Microsoft YaHei", sans-serif';
        ctx.shadowColor = glow;
        ctx.shadowBlur = 18;
        ctx.fillText(b.text, W / 2, H * 0.38);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(230,245,255,0.85)';
        ctx.font = '15px "Segoe UI", "Microsoft YaHei", sans-serif';
        const subW = ctx.measureText(b.sub).width;
        if (subW > maxW) ctx.font = Math.max(10, Math.floor(15 * maxW / subW)) + 'px "Segoe UI", "Microsoft YaHei", sans-serif';
        ctx.fillText(b.sub, W / 2, H * 0.38 + 42);
        ctx.restore();
        ctx.globalAlpha = 1;
      }
      // 已获强化图标与羁绊
      const owned = UPGRADES.filter(u => this.mods[u.id]);
      if (owned.length) {
        ctx.textAlign = 'center';
        ctx.font = '11px "Segoe UI", sans-serif';
        const total = owned.length * 18 - 6;
        let ox = W / 2 - total / 2 + 7;
        for (const u of owned) {
          const cnt = this.mods[u.id];
          ctx.fillStyle = this.evo[u.id] ? '#ffd166' : RARITY[u.rar].color;
          ctx.fillText(u.icon + (this.evo[u.id] ? '✦' : ''), ox, H - 38);
          if (u.max > 1) {
            ctx.fillStyle = 'rgba(230,245,255,0.75)';
            ctx.fillText(String(cnt), ox + 5, H - 30);
          }
          ox += 18;
        }
      }
      if (this.bonds.length) {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 11px "Segoe UI", "Microsoft YaHei", sans-serif';
        ctx.fillText('羁绊 ' + this.bonds.map(id => BONDS.find(b => b.id === id).name).join(' · '), 14, H - 44);
      }
      // 海克斯强化图标(按品阶着色)
      const ownedAugs = Object.keys(this.augments || {});
      if (ownedAugs.length) {
        ctx.textAlign = 'left';
        ctx.font = '12px "Segoe UI", sans-serif';
        let ax = 14;
        for (const id of ownedAugs) {
          const a = AUGMENTS.find(x => x.id === id);
          if (!a) continue;
          ctx.fillStyle = AUG_TIER[a.tier].color;
          ctx.fillText('◆' + a.icon, ax, H - 74);
          ax += 26;
        }
      }
      // 遗物图标
      const ownedRelics = RELICS.filter(r0 => this.relics[r0.id]);
      if (ownedRelics.length) {
        ctx.textAlign = 'left';
        ctx.font = '12px "Segoe UI", sans-serif';
        let rx = 14;
        for (const r0 of ownedRelics) {
          ctx.fillStyle = '#ffd166';
          ctx.fillText(r0.icon, rx, H - 60);
          rx += 20;
        }
      }
      if (owned.length) {
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(159,232,255,0.6)';
        ctx.font = 'bold 10px Consolas, monospace';
        ctx.fillText(this._ownedIds().length + '/' + this.maxSlots + ' 槽', W / 2, H - 48);
      }
    },
    _buildSummaryHTML() {
      let html = '';
      for (const u of UPGRADES) {
        const c = this.mods[u.id] || 0;
        if (c > 0) html += '<span class="chip' + (this.evo[u.id] ? ' evo' : '') + '"><i>' + u.icon + '</i>' + u.name + (u.max > 1 ? ' ×' + c : '') + (this.evo[u.id] ? ' ✦' : '') + '</span>';
      }
      for (const b of BONDS) {
        if (this.bonds.includes(b.id)) html += '<span class="chip bond">羁绊·' + b.name + '</span>';
      }
      if (this.augments) {
        for (const id in this.augments) {
          const a = AUGMENTS.find(x => x.id === id);
          if (a) html += '<span class="chip aug t' + a.tier + '">◆ ' + a.name + '</span>';
        }
      }
      if (!html) html = '<span class="chip">本局尚未获得强化</span>';
      return html;
    },
    _runStatsText() {
      return '击坠 ' + this.runKills + ' · 精英 ' + this.runEliteKills + ' · 等级 ' + this.level + ' · 最高连击 ' + this.maxCombo;
    },
});
