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
- 套件 `tools/_e2e*.js`(放入 tools/ 即被自动发现,无需注册),**一键全量** `npm test`
  (= `node tools/_e2e_all.js`)顺序执行全部套件,任一失败即退出码 1。
  - `npm test -- --only=combat,shop2` 只跑匹配套件;`--jobs=N` 并发;`--timeout=秒`;`--quiet`;`--list`
  - 单跑某套件:`node tools/_e2e_xxx.js`;输出统一为逐条 `ok/FAIL` + `PASS/FAIL 套件名 — n/m`
    + 可解析的 `[e2e] suite=... result=PASS|FAIL` 汇总行。
  - 运行日志落在 `tools/_logs/`(已 gitignore),失败时运行器自动打印尾部。
  - `_e2e_static.js` 是无需浏览器的静态守卫(编码 + 种子流白名单),纯文案/文档改动
    可只跑它:`node tools/_e2e_static.js`。
- 涉及玩法/随机性/商城/成就的改动,至少跑 `_e2e_combat`、`_e2e_economy`、`_e2e_shop2` 相关项;
  改种子/波次/抽卡逻辑,必须加跑 `_e2e_determinism`。

## 项目速览

- 纯前端零依赖 Canvas 射击游戏:双击 `index.html` 即可运行;`python tools/serve.py` 为无缓存开发服务器。
- 模块:`js/game.js`(核心状态机/碰撞/经验升级/掉落/成就评估)、`waves.js`(波次导演:出怪队列与
  挑战重播种)、`hud.js`(画布渲染与 DOM 面板,经 Object.assign 挂到 Game.prototype,加载序在 game.js 后)、
  `entities.js`(实体与精灵预渲染)、`shop.js`(商城/密匣/兑换)、`upgrades.js`(卡池/羁绊/抽卡)、
  `achievements.js`(成就)、`audio.js`(WebAudio 合成)、`main.js`(引导/输入/主循环)。
- **每日/周挑战确定性(重要约束,分层契约)**:
  1. **跨设备确定(必须)**:种子基准按日期/周号派生,`startWave(n)` 按波、`_drawChoices` 按抽卡序号
     各自派生独立子流 ⇒ 波次构成(`spawnQueue`/配额/词缀)与出卡序列是 `(种子, 波号/序号)` 的纯函数,
     与此前战斗过程消耗了多少随机数无关。由 `_e2e_determinism` 双开对比锁死。
  2. **波内微观行为(允许漂移)**:敌机射击间隔、母舰放机偏移、掉落掷点等运行期玩法随机**允许**消费
     种子流(`RNG`/`rand`/`irand`)—— 每波重播种保证构成不受其影响;真实帧率下行为细节允许随设备漂移,
     这是已接受的权衡,不要为了"绝对一致"把玩法随机改成效用表现层流。
  3. **表现层(严禁消费种子流)**:粒子/星空/震屏/尾焰/音效抖动等纯表现随机必须用 `crand`/`Math.random`。
     由 `_e2e_static.js` 的 `STREAM_ALLOW` 白名单静态锁死:**任何新增 `rand(/irand(/RNG(` 消费点都会红灯**,
     无论哪一层,都必须显式更新白名单并说明归属,让契约的每次变动可被 review。
- **文件编码(重要约束)**:全仓文本一律**无 BOM 的合法 UTF-8**。PowerShell 的 `Set-Content`/`>` 重定向
  会按本地代码页往返把中文写坏 —— 改文件请用编辑器或 Node/编辑工具,不要用 PowerShell 重定向写源码;
  `_e2e_static.js` 会在测试门拦截(44+ 文本文件逐个校验)。
