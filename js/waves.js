'use strict';
/* ============================================================
 * 深空突袭 DEEP STRIKE — 波次导演(v1.9.3 自 game.js 拆出)
 * startWave:按波构建出怪队列(spawnQueue)/配额/词缀/事件波。
 * 确定性关键:挑战模式在此按 (种子 ^ 波号) 重播种,波次构成是
 * (种子, 波号) 的纯函数 —— 由 tools/_e2e_determinism.js 锁死;
 * 任何改动请先读 AGENTS.md「每日/周挑战确定性」分层契约。
 * 通过 Object.assign 挂到 Game.prototype,加载顺序须在 game.js 之后。
 * ============================================================ */
Object.assign(Game.prototype, {
    startWave(n) {
      this.wave = n; this.waveTime = 0; this.spawnQueue = []; this.waveClearT = -1;
      this.waveKills = 0; this.trickleT = 0;
      if (typeof DailyTasks !== 'undefined') DailyTasks.bump('wave', n, this);
      // 挑战模式:按波派生独立子流——出怪序列/词缀只取决于日期种子与波号,
      // 与此前战斗过程(掉落/暴击/粒子)消耗了多少随机数无关,任意尝试严格一致
      if (this.isChallenge()) RNG = mulberry32((this._seedBase ^ Math.imul(n, 0x9E3779B1)) >>> 0);
      // 时间冻结:每波开始静止敌方弹幕
      if (this.evo.time) this.bulletFreezeT = 2.5;
      // 补给号角:波首掉落随机道具
      if (this.relics.r_horn) this._dropPower(rand(60, W - 60), -20);
      const threat = this.threatLevel();
      // 波次词缀:第 6 波起 40% 概率(BOSS 波与连战模式除外)
      this.waveMod = null;
      if (this.mode !== 'boss' && n >= 6 && n % 5 !== 0 && RNG() < (this.mode === 'weekly' ? 0.7 : this.mode === 'mayhem' ? 0.6 : 0.4)) {
        this.waveMod = WAVE_MODS[irand(0, WAVE_MODS.length - 1)];
      }
      // 环境参数:威胁与词缀共同作用于本波敌机
      // 火力节奏:除威胁外,追加随波次的持续提速(每波 ×0.985,封顶到第 30 波),后期更具压迫感
      const waveFire = Math.max(0.62, Math.pow(0.985, Math.min(n, 30)));
      this._env = {
        hpMul: (1 + threat * 0.15) * (this.waveMod && this.waveMod.id === 'iron' ? 1.35 : 1),
        spdMul: (this.waveMod && this.waveMod.id === 'swift' ? 1.2 : 1) * (1 + Math.min(0.25, n * 0.008)),
        fireMul: Math.max(0.4, Math.pow(0.94, threat)) * waveFire * (this.waveMod && this.waveMod.id === 'barrage' ? 0.6 : 1)
      };
      // 周变异:作用于本波全体敌机
      if (this._mut) {
        if (this._mut.id === 'rage') this._env.fireMul *= 0.8;
        if (this._mut.id === 'bulwark') this._env.hpMul *= 1.25;
        if (this._mut.id === 'gale') this._env.spdMul *= 1.15;
      }
      // 里程碑:每 10 波投放补给(炸弹+1 与 25% 生命修复)
      const milestone = n > 10 && (n - 1) % 10 === 0;
      if (milestone) {
        const bombCap = this.bombCap();
        if (this.player.bombs < bombCap) this.player.bombs++;
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.round(this.player.maxHp * 0.25));
      }
      // 波次/质变/无弹成就:旗舰连战不按真实波次语义解锁
      if (this.mode !== 'boss') {
        if (n > this._stat('bestWave', 0)) this.stats.bestWave = n; // 深空远征线实时推进
        if (n >= 5) Ach.unlock('wave_5', this);
        if (n >= 10) Ach.unlock('wave_10', this);
        if (n >= 15) Ach.unlock('wave_15', this);
        if (n >= 20) Ach.unlock('wave_20', this);
        if (n >= 25) Ach.unlock('wave_25', this);
        if (n >= 30) Ach.unlock('wave_30', this);
        if (n >= 40) Ach.unlock('wave_40', this);
        if (n >= 50) Ach.unlock('wave_50', this);
        // 质变武器抵达 20 波精通 + 四通累计;15 波用于 path_all 记录
        if (n >= 20) {
          const pk = this.mods.laser ? 'laser' : this.mods.spread ? 'spread' : this.mods.railgun ? 'railgun' : this.mods.tesla ? 'tesla' : this.mods.boomer ? 'boomer' : null;
          if (pk) Ach.unlock('path_' + pk, this);
        }
        if (n >= 15) {
          const pk = this.mods.laser ? 'laser' : this.mods.spread ? 'spread' : this.mods.railgun ? 'railgun' : this.mods.tesla ? 'tesla' : this.mods.boomer ? 'boomer' : null;
          if (pk) this._recordPathClear(pk);
        }
        // 不使用炸弹通关第 15 波
        if (n > 15 && (this.runBombsUsed || 0) === 0) this.stats.nobomb15 = this._stat('nobomb15', 0) + 1;
        // 与狼共舞:携带诅咒卡抵达第 10 波
        if (n >= 10 && UPGRADES.some(x => x.curse && (this.mods[x.id] || 0) > 0)) this.stats.curseWaves = this._stat('curseWaves', 0) + 1;
      }
      this._achEvaluate();
      // 连续无伤波次里程碑
      if (this.perfectStreak >= 6) Ach.unlock('perfect_6', this);
      this.waveDamageTaken = 0;
      // 海克斯大乱斗:第 1/4/7/10 波开局提供强化三选一(共 4 轮,BOSS 波亦可先选)
      if (this.mode === 'mayhem' && (n === 1 || n === 4 || n === 7 || n === 10))
        this._openAugmentChoice((n + 2) / 3);
      if (n % 5 === 0 || this.mode === 'boss') {
        this.waveQuota = 1; // 目标:击毁旗舰
        // 连战模式:第 k 阶段按虚拟波号 5k 构造旗舰(难度递增,变体自然轮换)
        const vw = this.mode === 'boss' ? n * 5 : n;
        const bname = BOSS_VARIANTS[bossVariant(vw)].name;
        this.banner = { text: '⚠ WARNING ⚠', sub: '目标:击毁' + bname, life: 2.2, max: 2.2, red: true };
        AudioSys.alarm();
        this.spawnQueue.push({ boss: true, t: 2.0 });
        return;
      }
      this.banner = { text: 'WAVE ' + n, sub: '', life: 1.8, max: 1.8, red: false };
      AudioSys.waveStart();
      // 出怪配额:线性 + 二次增长,后期数量显著上升(封顶防止过载)
      let budget = Math.min(120, 8 + n * 3 + Math.floor(n * n * 0.12) + this.threatLevel() * 2);
      let t = 1.0;
      while (budget > 0) {
        const roll = RNG();
        let type = 'drone';
        // 第 6 波起引入「母舰」(carrier):周期释放无人机,增加压迫与丰富度
        if (n >= 6 && roll < 0.08) type = 'carrier';
        else if (n >= 3 && roll < 0.22) type = 'tank';
        else if (n >= 4 && roll < 0.33) type = 'bomber';
        else if (n >= 5 && roll < 0.40) type = 'shielder';
        else if (n >= 8 && roll < 0.48) type = 'mender';
        else if (n >= 7 && roll < 0.54) type = 'jammer';
        else if (n >= 2 && roll < 0.70) type = 'waver';
        else if (n >= 4 && roll < 0.84) type = 'sniper';
        let cost = type === 'carrier' ? 5 : (type === 'tank' || type === 'mender' || type === 'jammer' ? 3 : (type === 'shielder' ? 4 : (type === 'drone' ? 1 : 2)));
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
      // 关卡目标:必须击坠足够数量的敌机才能过关,躲避无法通关
      const hordeMul = this.waveMod && this.waveMod.id === 'horde' ? 1.4 : 1;
      this.waveQuota = Math.ceil(this.spawnQueue.length * 0.65 * hordeMul * (this.mode === 'mayhem' ? 1.3 : 1)); // 大乱斗:出怪 +30%
      this.banner.sub = '目标:击坠 ' + this.waveQuota + ' 架敌机';
      // 精英机:第 3 波起概率随队,第 7 波起可能双精英,第 10 波起概率出现双词缀精英;猎杀周大增
      const huntWeek = this._mut && this._mut.id === 'hunt';
      if (n >= 3 && RNG() < (huntWeek ? 0.9 : 0.65)) {
        const affixes = Object.keys(ELITE_CFG);
        const count = n >= 7 && RNG() < (huntWeek ? 0.55 : 0.35) ? 2 : 1;
        for (let i = 0; i < count; i++) {
          const idx = irand(0, this.spawnQueue.length - 1);
          const a1 = affixes[irand(0, affixes.length - 1)];
          const list = [a1];
          if (n >= 10 && RNG() < 0.35) {
            const a2 = affixes[irand(0, affixes.length - 1)];
            if (a2 !== a1) list.push(a2);
          }
          this.spawnQueue[idx].elite = list;
        }
        this.banner.sub += ' · ⚠ 精英机随队';
      }
      // 事件波:陨石带(第3/8/13…波,掩体兼威胁)与补给空投(第4/9/14…波);连战模式无杂兵事件
      if (this.mode !== 'boss' && n % 5 === 3) {
        this.banner.sub += ' · ☄ 陨石带';
        const rocks = 4 + Math.floor(n / 3);
        for (let i = 0; i < rocks; i++)
          this.spawnQueue.push({ asteroid: true, t: rand(0.5, 6), x: rand(40, W - 40), r: rand(14, 26) });
      }
      if (this.mode !== 'boss' && n % 5 === 4) {
        this.banner.sub += ' · ▽ 补给空投';
        for (let i = 0; i < 3; i++)
          this.spawnQueue.push({ supply: true, t: rand(1, 5), x: rand(50, W - 50) });
      }
      if (this.waveMod) this.banner.sub += ' · ' + this.waveMod.icon + ' ' + this.waveMod.name;
      if (milestone) this.banner.sub += ' · ⚡ 威胁纪元补给';
    },
});
