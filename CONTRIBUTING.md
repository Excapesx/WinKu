# 参与开发

## 先读什么

1. [`README.md`](README.md) —— 项目是什么、仓库怎么放
2. [`docs/HANDOFF.md`](docs/HANDOFF.md) —— 环境、坑、代码地图
3. [`ROADMAP.md`](ROADMAP.md) —— 现在做到哪、下一步是什么

## 代码放哪

| 你要加的东西 | 放哪 |
|---|---|
| Android 的界面、逻辑 | `apps/android/app/src/main/java/...` |
| 引擎侧插件、补丁 | `apps/android/js/` |
| 原生库（Node、JNI） | `apps/android/native/` |
| 跨端共享的渲染器 / 协议 / token | `packages/`（还没建，见 P2） |
| 新平台的客户端 | `apps/web`、`apps/ios`、`apps/desktop` |

## 提交前

1. **能编过**：`cd apps/android && ./gradlew :app:assembleDebug "-Pdsh.fetchShizuku=false"`
2. **界面改动附截图**（模拟器或真机都行，不要只贴代码）
3. 一次提交只做一件事，message 说清楚"为什么"，不是"改了什么"

## 约定

- 分支：`main` 是主线，功能开 `feat/xxx`，实验性重构开 `rebuild/xxx`
- 提交信息用中文，第一行不超过 50 字
- **不要提交** `toolchains/`、`local.properties`、`build/`、`node_modules/`
- **不要改** `applicationId`（数据与更新链路绑着它）
- 删文件前先 `git status`，这个仓库能回滚

## 不要做的事

- 加回 DeepSeek 账号登录（已整体移除，见 `docs/HANDOFF.md`）
- 为了"完整"加功能 —— 这个项目的病是每样都做了一半
- 直接改 `app/src/main/assets/learning/`（那是构建产物，改 `learning-ui/src/` 再重新构建）

## 遇到问题

先看 `docs/` 下的文档；没有答案就在 issue 里写清楚：什么命令、什么报错、什么环境。
