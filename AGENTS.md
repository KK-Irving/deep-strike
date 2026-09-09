# AGENTS.md — 协作约定(供 AI 代理与协作者遵循)

## 迭代与提交(必须遵守)

1. **每次修改并测试通过后,必须本地 commit**,并生成对应的中文 commit message。
   格式:`vX.Y.Z: 标题 — 要点;要点;要点`(参考 `git log` 既有风格)。
2. **版本号跟随项目中最新版本,每次迭代提交自动 +0.0.1**,并同步更新三处:
   - `js/version.js` 的 `GAME_VERSION`
   - `package.json` 的 `version`
   - `README.md` 的「当前版本」与「版本迭代」列表
3. **突破性/改造性更新**可提升中间数位并把末位归零(如 v1.1.1 → v1.2.0,架构重写可 v2.0.0)。
4. 每次迭代 commit 后打同名 tag:`git tag vX.Y.Z`。
5. 提交前先验证:JS 语法检查 + `npm test`(全量 e2e,需本地 Chrome,headless)无回归;
   纯文案/文档改动可只做语法检查。

## 测试

- 基座 `tools/_harness.js`:统一静态服务(no-store)、Chrome 解析
  (`CHROME_PATH` → 常见安装路径 → PATH → Playwright 自带 Chromium)与断言输出。
- 套件 `tools/_e2e*.js`,基于 Playwright + 本机 Chrome;**一键全量** `npm test`
  (= `node tools/_e2e_all.js`),23 个套件顺序执行,任一失败即退出码 1。
  - `npm test -- --only=combat,shop2` 只跑匹配套件;`--jobs=N` 并发;`--timeout=秒`;`--quiet`;`--list`
  - 单跑某套件:`node tools/_e2e_xxx.js`;输出统一为逐条 `ok/FAIL` + `PASS/FAIL 套件名 — n/m`
    + 可解析的 `[e2e] suite=... result=PASS|FAIL` 汇总行。
  - 运行日志落在 `tools/_logs/`(已 gitignore),失败时运行器自动打印尾部。
- 涉及玩法/随机性/商城/成就的改动,至少跑 `_e2e_combat`、`_e2e_economy`、`_e2e_shop2` 相关项。

## 项目速览

- 纯前端零依赖 Canvas 射击游戏:双击 `index.html` 即可运行;`python tools/serve.py` 为无缓存开发服务器。
- 模块:`js/game.js`(核心状态机/波次/碰撞/HUD)、`entities.js`(实体与精灵预渲染)、
  `shop.js`(商城/密匣/兑换)、`upgrades.js`(卡池/羁绊/抽卡)、`achievements.js`(成就)、
  `audio.js`(WebAudio 合成)、`main.js`(引导/输入/主循环)。
- **每日/周挑战确定性(重要约束)**:种子按波(`startWave`)与抽卡序号(`_drawChoices`)派生独立子流;
  一切纯表现层随机(粒子/星空/震屏/音效抖动)必须用 `crand`/`Math.random`,
  **严禁消费种子流**(`RNG`/`rand`/`irand`),否则跨设备序列一致性会被破坏。
