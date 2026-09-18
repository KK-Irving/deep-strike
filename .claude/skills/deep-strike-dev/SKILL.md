---
name: deep-strike-dev
description: 深空突袭(DEEP STRIKE)项目迭代工作流。当在本仓库进行任何代码修改、玩法调整、版本迭代时使用——固化测试、扫描、模拟验证、版本提升与提交规范。
---

# 深空突袭 · 迭代工作流

每次迭代必须完整走以下流程(详见仓库根 AGENTS.md):

## 1. 修改前
- 读 `AGENTS.md`(协作约定)与 `ROADMAP.md`(当前阶段)
- 确认改动属于哪个 Phase/维度,避免与已登记的"明确不做"冲突

## 2. 修改后验证(顺序执行)
1. `node --check` 所有被改的 js 文件
2. `npm test` 全量 44+ 套 e2e;小改可 `npm test -- --only=<相关套件>`
3. 涉及玩法节奏:`node tools/_play_sim.js` 模拟实测(波时长 10~80s 为健康区)
4. 涉及商品:`node tools/_e2e_static.js` 含"机体造型完整性"断言
5. `node tools/_review_scan.js` 静态扫描,确认无新增违例

## 3. 版本提升
- `node tools/bump.js`(自动 +0.0.1)或 `node tools/bump.js X.Y.Z`(突破性手动指定)
- 三处版本号由工具同步,禁止手改

## 4. 提交
- 中文 commit message:`vX.Y.Z: 标题 — 要点;要点`(参考 git log 既有风格)
- `git tag vX.Y.Z` 同名标签
- 临时补丁脚本(tools/_p*.js)不入库:跑完即删或与最终提交一起清理

## 5. 硬性约束
- 全部文本文件无 BOM UTF-8;禁止 PowerShell 重定向写源码
- 表现层随机用 crand/Math.random;玩法随机走种子流(改动必须过 _e2e_determinism)
- 模式差异一律写入 game.js 顶部 MODES 配置表,禁止散落新 mode 特判
- 新增出击机体必须同时配 SHIP_SHAPES 条目(静态守卫会拦)
