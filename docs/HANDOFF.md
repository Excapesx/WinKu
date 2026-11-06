# 交接说明（给下一个接手的人 / agent）

> 最后更新 2026-11-06。读完这份再动代码，能省你半天。

## 0. 先说你面对的是什么

**产品定位**：给大学生用的 AI 助手，替代手机端的豆包 / DeepSeek。
核心是「手机端 Claude / ChatGPT 的使用体验」，差异化是「学习场景的组件」。
Android 额外保留一套「替你操作手机」的能力，iOS 没有。

**用户是一个人**，中文沟通，说话很短：要结论不要过程，要能跑的东西不要方案文档。
产品决定问他，技术坑自己解决。

## 1. 仓库

fork 自 [jackwener/DSH-Android](https://github.com/jackwener/DSH-Android)（Apache-2.0），
`upstream` remote 保留，可以同步上游。

```
apps/
  android/      Kotlin + Compose + 内置 dsh 引擎（唯一能跑的端）
  web/          （计划）Expo，兼作 iOS 的代码来源
  desktop/      （计划）Windows / macOS
  ios/          （计划）纯客户端
packages/       （计划）artifact 渲染、设计 token、协议
docs/           架构、引擎契约、交接
```

## 2. 现在的状态

主线分支 `main`。

**能跑**：Android 装配包、聊天、多服务商模型、学习组件（图表/公式/流程）、设备能力。

**界面上已改过的**：
- 品牌：WinKu，单一品牌色 `#0E8A4A`（深浅共用），中性灰底
- 启动图 / 图标 / 侧栏字标已换
- 正文 15/26
- 学习组件（WebView）的配色也接进了品牌色

**没做完的**：
- 顶部栏、输入框的布局还是老结构（控件太多）
- 学生组件（拍照解题、课表、DDL、复习卡）一个都没有
- iOS / Web / 桌面只有 README，没有代码

## 3. 构建与验证

### 环境

- JDK：`apps/android/toolchains/local/jdk/jdk-21.0.13.0.2+1`，必须设 `JAVA_HOME`
- Android SDK：`apps/android/toolchains/local/android-sdk`，`local.properties` 已指向它
- `apps/android/toolchains/` 约 8 GB（SDK + JDK + 预编译 libnode + engine.zip），**不要删**，也不进仓库

### 构建

```powershell
$env:JAVA_HOME="<repo>\apps\android\toolchains\local\jdk\jdk-21.0.13.0.2+1"
cd <repo>\apps\android
.\gradlew.bat :app:assembleDebug "-Pdsh.fetchShizuku=false" --console=plain
```

三个坑：

1. `-Pdsh.xxx=...` 在 PowerShell 里会被吞掉 → **参数必须加引号**
2. 必须带 `-Pdsh.fetchShizuku=false`（Windows 没有 bash，默认会去跑 .sh）
3. `-Pdsh.learningPreview=true` 才出 x86_64 包（装模拟器用），包名变成 `.learning.preview`，
   并且不启动真实引擎（用示例数据），适合快速看界面

### 装机与截图

```powershell
$adb="<repo>\apps\android\toolchains\local\android-sdk\platform-tools\adb.exe"
& $adb install -r apps\android\app\build\outputs\apk\debug\app-debug.apk
& $adb shell am start -n io.github.jackwener.dsh.learning/.io.github.jackwener.dsh.MainActivity
& $adb shell screencap -p /sdcard/x.png
& $adb pull /sdcard/x.png D:\tmp\x.png
```

模拟器没起时：`tools/preview-ui.ps1 -Mode App` 会自动起 AVD `dsh-learning-test`、构建、装机、
并在 `127.0.0.1:4174` 提供实时画面。

**首启很慢**：15–20 秒，系统会报 ANR，别当崩溃。

### 改完必须验证

编译 → 装机 → 截图 → 看图。不看图不算改完（除非改的是纯逻辑）。

多模型运行时（2026-11-05）的验证：88 项直接相关 JVM 测试通过；扩大回归后，排除 `ShellFilesTest` 和 `ExtensionsStoreTest` 两个旧测试类，其余 370 项 JVM 测试全部通过。前者有 4 项 Windows 临时目录路径断言失败，后者在等待扩展激活事件时挂起，均未修改。
197 项引擎测试通过，包含实际打包的提示词组装、SDK 拒绝未注册路由、请求头、网关回放和设备策略；4 项 Android 设备测试通过，使用隔离 Keystore 与本机 HTTP 服务验证密钥迁移及三种协议。
预览包和 arm64 包均构建成功，APK 内嵌 engine.zip 校验一致，空模型配置与协议选择器已装机截图检查。产物在 `apps/android/build/winku-release/`（不入库）。预览包不启动真实 Node 引擎；通过 dsh 调用真实服务商仍需 arm64 真机与有效 API Key 验证。

流式显示（2026-11-06）：376 项 JVM 回归通过（同样排除上述两个旧测试类），211 项引擎测试通过，实际 SDK 通道验证首段先于最终日志送达、24ms 合并和终止清理。设备测试包含流式会话、原有模型配置与学习触摸共 6 项；模型真实联网和物理手机帧率仍待真机验证。
本机模拟器在旧 `swiftshader_indirect` 图形配置下曾退出，改用 `-gpu swiftshader -feature -Vulkan` 后设备测试完整通过。预览包的本地示例现在也逐步输出，便于离线检查排版、自动滚动与停止；正式包仍使用实际引擎增量。

## 4. 代码地图（`apps/android/`）

| 位置 | 责任 |
|---|---|
| `app/src/main/java/.../core/designsystem/` | 设计系统：`Color.kt`（色板）、`Theme.kt`（字号/圆角）、`Primitives.kt`（组件）、`Brand.kt`（字标） |
| `app/src/main/java/.../feature/conversation/` | 对话：`HomeScreen`、`Stream`、`Composer`、`ToolRows`、`SessionDrawer` |
| `app/src/main/java/.../core/engine/` | 引擎进程：`EngineManager`、`EngineService`、`JsonRpcPeer` |
| `app/src/main/java/.../core/capability/` | 设备能力：`CapabilityHub` + `tools/*` |
| `app/src/main/java/.../core/provider/Providers.kt` | 多服务商：预设、限额、`/models`、profile patch |
| `app/src/main/java/.../feature/learning/` | WebView 富内容（图表/公式/流程/测验） |
| `learning-ui/` | 上面那套 WebView 的 React 源码，构建产物进 `app/src/main/assets/learning/` |
| `js/` | dsh 侧插件（device / guard / mode / extensions）与补丁 |
| `native/` | Node 交叉编译与 JNI 包装 |

## 5. 已经做过的架构改动（别改回去）

- **真实流式显示**：`plugin-guard/assistant-stream.js` 将内核增量通过 `session.assistant-stream` 送给 App；首段立即转发，后续 24ms 合并。临时快照不写数据库，最终日志仍是历史与用量的唯一来源。停止、失败、重试和引擎更换时清理旧状态；不要改成收到整条消息后再慢放
- 会话投影缓存已完成的日志，逐帧只叠加当前输出；Markdown 使用现有 0.46.0 库的增量解析，取消逐次尺寸动画和首页/聊天的整页交叉淡入。跟随滚动监听实际内容高度，用户拖动即停止跟随。协议见 ENGINE-CONTRACT §2.3；设备回归 `StreamingOutputTest` 只在独立预览包运行
- **DeepSeek 账号登录整体移除**：`core/account`、`feature/account` 已删，引擎里
  `plugin-account` 已从 `engine.zip` 和 `cordis.patch.yml` 移除，`llm-deepseek-account` 路由已 disabled
- 模型配置统一存在 `Settings.providers`，全部经过 `llm-service-lite`；支持 Chat Completions、Responses、Messages。Anthropic 预设使用 Messages，DeepSeek 只是普通可选预设，新安装没有默认服务商或模型
- `ModelSettingsMigration` v2 将已有密钥的旧内置路由迁成普通服务商：先复制到命名加密槽位，偏好提交成功后才清理旧密钥。空占位项直接移除，其他服务商和原选择保留；旧原生路由的验证结果清空，需要重新验证
- 服务商停用、删除或移除所选模型时保留原选择并报错；初始化失败也不会回退到其他模型。更换密钥会更新配置指纹，下次空闲调用重新启动引擎
- `EngineManager.control()` 可在未配置模型时启动控制通道供扩展管理使用，模型初始化延迟到 `sdk()` 首次发送前
- `platform.deepseek.com` 的充值与用量页面全删
- Kotlin 和实际打包的 SDK 都拒绝未注册路由，关闭 `llm-deepseek`、账号路由及厂商联网搜索；`web_fetch` 保留，搜索通过独立扩展或 MCP 接入
- 实际引擎提示词使用 WinKu 身份并关闭上游身份注入；请求 User-Agent 为 `WinKu/<版本>`，更新只指向 `Excapesx/WinKu`。没有发布新清单前，更新检查可能返回无可用清单，不会下载上游 APK
- 保留 dsh 内核、上游 npm 命名空间、许可证与来源说明，它们不代表模型依赖。`applicationId` 保持原值，避免破坏用户数据
- 正常重打引擎用 `js/build-engine.sh`（包含补丁 23/24）；Windows 已有完整引擎包时可用 `tools/refresh-engine-bundle.ps1 -Install` 更新自有包并应用这两项补丁，原包备份在 `build/engine-backups/`。依赖变更仍须完整构建

## 6. 下一步（按 ROADMAP P1）

1. **学习模式**：用现有的「会话模式」加一个内置提示词（分步讲解、先问再答、公式必渲染）
2. **拍照解题**：相册/相机入口前置
3. **学生卡片**：DDL、课表、复习卡，做成 artifact 类型 + 本地存储
4. **首页减法**：悬浮球、自动化、权限收进「增强」

## 7. 禁令

- 不删 `apps/android/toolchains/`（构建命脉，8 GB）
- 不改 `applicationId`（数据与更新链路绑着）
- 不加回账号体系
- 不直接改 `app/src/main/assets/learning/`（构建产物，改 `learning-ui/src/` 再构建）
- 不加功能凑数：这个项目的病是每样都做了一半

## 8. 跨端策略（为什么这么分）

| 端 | 能不能跑引擎 | 原因 |
|---|---|---|
| Android | ✅ | Node 编成 `.so`，JNI 起在自己的进程里 |
| Windows/macOS | ✅ | dsh 本来就是跨平台 Node 程序 |
| iOS | ❌ | 禁止 JIT、禁止子进程，Node 上不去 |

所以：**Android 与桌面是"带引擎的客户端"，iOS 是"纯客户端"**。
iOS 的能力集是 Android 的子集：聊天、拍照、文件、日历；没有跨 App 自动化。

iOS 的测试路径（没有 Mac 也能走）：Expo Go 扫码 → PWA → EAS Build + TestFlight（需 $99/年）。
上架中国区 App Store 需要 App 备案；TestFlight、侧载、PWA 不涉及。

## 9. 一句话

这不是「功能不够」的项目，是「每样都做了一半」的项目。
接手的第一个月，目标应该是**让它像一件成品**，而不是让它会更多东西。
