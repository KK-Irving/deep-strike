---
name: deep-strike-release
description: 深空突袭发布流程。当需要把游戏发布到 GitHub Pages 或 itch.io、或生成发行包时使用。
---

# 深空突袭 · 发布流程

游戏为纯静态零构建产物,发布即分发文件。

## 1. 发布前检查
1. `npm test` 全量 44+ 套 e2e 全绿
2. `node tools/_play_sim.js` 节奏模拟健康(波时长 10~80s)
3. `js/version.js` / `package.json` / `README` 三处版本一致(静态守卫覆盖)

## 2. GitHub Pages
1. 仓库 Settings → Pages → Source 选 `main` 分支 `/ (root)`
2. 本项目所有资源引用均为相对路径,无需任何构建或路径改写
3. 可选:仓库根放置空的 `.nojekyll` 文件(跳过 Jekyll 处理,本作无以下划线开头的路径,非必需)
4. 验证:`https://<user>.github.io/<repo>/` 双击逻辑等价,直接可玩

## 3. itch.io 打包
1. `node tools/pack_release.js` → 生成 `dist/deep-strike-v<版本>.zip`(全部运行文件 + README)
2. itch.io 新建 project → Kind of Project 选 **HTML** → 上传 zip
3. 关键设置:勾选 **This file will be played in the browser**;Viewport 尺寸 900×1200(520 逻辑宽 + 边距);
   勾选 Mobile friendly(本项目已适配触屏)
4. 更新版本时重复第 1 步后在 itch.io 页面 re-upload 即可

## 4. 发行说明
- 从 `git log --oneline` 提取本版本区间迭代要点
- README「版本迭代」段落为权威来源,直接摘取

## 5. 约束
- 保持零素材零构建:发布产物 = 仓库运行文件原样,禁止引入打包器或外部 CDN
- 新增文件须确认不影响 file:// 双击直玩(所有引用保持相对路径)
