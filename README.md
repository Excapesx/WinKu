# WinKu

> **状态：未完成（WIP）** — 正在重建中。目前只有 Android 能跑，其余平台只有骨架。
> 接口、目录、数据格式都还会变。

面向大学生的个性化移动端 AI Agent。

WinKu 希望围绕大学生的课程学习、学科竞赛和个人成长，将 AI 能力与内置 Skills、任务流程和移动端交互结合，
让每个人都能拥有理解自己目标与学习节奏的智能伙伴。

## 项目愿景

以移动端为主要入口，在大学生的真实任务中持续提升个性化体验与任务完成能力，
逐步成为能够替代并超越 GPT、Claude 等主流通用 Agent 体验的学生专属助手。

## 规划方向

- **个性化陪伴**：结合专业、年级、兴趣和目标，提供适合个人的建议与任务支持。
- **课程学习**：内置知识讲解、学习规划、笔记整理与复习备考等 Skills。
- **竞赛支持**：围绕数学建模、程序设计、创新创业等竞赛，辅助选题、资料研究、方案设计与成果表达。
- **任务执行**：将复杂目标拆解为可执行步骤，协助推进学习与项目任务。
- **移动端体验**：围绕手机使用场景设计，便于随时记录问题、获取帮助和跟进进度。

## Skills 集成清单

Skills 按能力系统分类，后续在各系统下补充具体技能与接入状态。Humanizer 是首个列入集成清单的 Skill，目前先完成文档登记，运行时接入与各端适配尚待验证。

### 写作与表达系统

| Skill | 作用 | 使用场景 | 接入状态 |
|---|---|---|---|
| **Humanizer（降 AI 味）** | 在保留原意与事实的前提下，减少模板化表达、空话和机械句式，让文字更自然 | 课程报告、竞赛说明、日常文案的润色 | 已列入首批集成清单，待接入调用 |

示例指令：

> 帮我润色下面这段课程报告，降低 AI 味，保留原意、专业术语和引用，不补充未经确认的内容。

### 学习系统

规划覆盖课程学习、笔记整理与复习备考，具体 Skills 待补充。

### 竞赛系统

规划覆盖竞赛选题、资料研究与成果整理，具体 Skills 待补充。

### 校园生活系统

规划覆盖课表、DDL 提醒与日常事务，具体 Skills 待补充。

## 当前状态

Android 已有可运行的客户端（聊天、多服务商模型接入、学习内容渲染、手机操作能力），
界面与品牌正在重做，学生组件（拍照解题、课表、DDL、复习卡）尚未开始。

| 端 | 状态 | 说明 |
|---|---|---|
| **Android** | 🟡 能跑，未打磨 | Kotlin + Compose，内置 dsh 引擎（Node），带设备能力 |
| iOS | ⬜ 只有计划 | 纯客户端，不跑引擎；能力集是 Android 的子集 |
| Web | ⬜ 只有计划 | 移动优先的网页版，兼作 iOS 的 PWA 形态 |
| Windows / macOS | ⬜ 只有计划 | 桌面壳，引擎直接用宿主机的 Node |
| 共享包 | ⬜ 待抽取 | artifact 渲染器、设计 token、协议类型 |

## 仓库结构

```
apps/
  android/          Kotlin + Compose 客户端（含 dsh 引擎、设备能力、学习组件）
  web/              （计划）网页版
  desktop/          （计划）Windows / macOS 桌面端
  ios/              （计划）iOS 客户端
packages/           （计划）跨端共享：artifact 渲染、设计 token、协议
docs/               架构、引擎契约、交接说明
```

`apps/android/` 里是完整的 Gradle 工程，进去之后和普通 Android 项目一样。

## 快速开始（Android）

前置：JDK 21、Android SDK（compileSdk 37.2）、Node（只在重打引擎包时需要）。

```bash
cd apps/android
./gradlew :app:assembleDebug "-Pdsh.fetchShizuku=false"
```

Windows 上注意两点：

1. `-P` 参数**必须加引号**，否则 PowerShell 会把它拆开。
2. 必须带 `-Pdsh.fetchShizuku=false`，否则会去跑 `tools/fetch-shizuku.sh`（需要 bash）。

产物在 `apps/android/app/build/outputs/apk/debug/app-debug.apk`，arm64-v8a，Android 10+。

**首次克隆后编不过**是正常的：`toolchains/`（SDK、JDK、预编译的 libnode、engine.zip）不进仓库，
需要先补齐：

```bash
cd apps/android
native/prebuilt.sh fetch        # 预编译原生库
js/build-engine.sh              # 引擎包 engine.zip
```

或者直接找维护者要一份 `toolchains/out/`。

## 现在做到哪了

- 路线图：[`ROADMAP.md`](ROADMAP.md)
- 接手必读（环境、坑、代码地图）：[`docs/HANDOFF.md`](docs/HANDOFF.md)
- 参与方式：[`CONTRIBUTING.md`](CONTRIBUTING.md)

## 跨端策略

| 端 | 能不能跑引擎 | 原因 |
|---|---|---|
| Android | ✅ | Node 编成 `.so`，JNI 起在自己的进程里 |
| Windows / macOS | ✅ | dsh 本来就是跨平台 Node 程序 |
| iOS | ❌ | 禁止 JIT、禁止子进程，Node 上不去 |

所以 Android 与桌面是「带引擎的客户端」，iOS 是「纯客户端」，
能力集是 Android 的子集：聊天、拍照、文件、日历，没有跨 App 自动化。

## 与上游的关系

Android 端 fork 自 [jackwener/DSH-Android](https://github.com/jackwener/DSH-Android)（Apache-2.0），
保留 `upstream` remote 以便同步上游改动：

```bash
git fetch upstream && git merge upstream/main
```

引擎侧的补丁与插件改动较多（见 `apps/android/js/`），合并时注意冲突。

## 许可

Apache-2.0。内置的第三方组件（Node.js、dsh、Shizuku、ripgrep 等）遵循各自许可证。
