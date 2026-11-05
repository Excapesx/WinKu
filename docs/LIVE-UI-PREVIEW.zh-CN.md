# DSH Ultra 界面实时预览

本项目的原生界面使用 Kotlin + Jetpack Compose，交互学习组件使用 React + Android WebView。Expo / React Native 的技能和 Expo Go 不适用这个项目。

已安装的开发技能是 `skydoves/android-testing-skills` 中的 `developing-with-compose-previews`，路径为 `C:/Users/Administrator/.codex/skills/developing-with-compose-previews`。它指导预览代码的编写；预览本身由下面的开发工具运行。

## 交互学习组件：保存后自动刷新

在项目目录运行：

```powershell
.\tools\preview-ui.ps1 -Mode Learning
```

手机宽度预览地址：<http://127.0.0.1:4173/_preview?width=390&demo=function>。

也可以在 `learning-ui` 目录运行 `npm run dev`。修改 `learning-ui/src` 下的 TSX、TypeScript 或 CSS，保存后会自动重新构建并刷新页面。选择其他组件后，自动刷新会保留组件种类；交互状态沿用组件已有的本地存储机制。这是自动重新载入页面，不是保留全部 React 内存状态的热替换。

开发产物放在忽略的 `toolchains/out/learning-dev`，不会覆盖 APK 的离线资源。预览服务只监听本机。正式打包仍使用 `npm run build`。

这个浏览器窗口展示真实的交互学习组件。原生主页、设置、导航、权限和 WebView 桥接需要在下面的 Android 环境查看。

## 原生 Compose 界面

```powershell
.\tools\preview-ui.ps1 -Mode Android
```

脚本会打开 Android Studio，并传入项目已有的 SDK、JDK 与 x86_64 界面诊断构建参数。预览文件是：

`app/src/debug/java/io/github/jackwener/dsh/feature/conversation/ConversationPreviews.kt`

文件直接调用项目的 `ChatStream` 与 `DshTheme`，使用普通模型数据，不需要账号、Hilt 注入或 Node 引擎。包含正常回复、正在生成、空会话、连接失败、长内容五种状态，以及浅色、深色、小屏大字配置。这个文件仅参与 debug 构建。

在 Android Studio 打开该文件，选择 **Split** 或 **Design**，即可查看和交互操作 Compose 预览。预览依赖已在项目中配置。

需要在运行中的 App 里实时查看 Compose 调整时，使用 Android Studio 的 **File → Settings → Editor → Live Edit → Automatic**，然后用 **Run** 将 debug 版本运行在 Android 11 / API 30 及以上的模拟器或手机上。支持的函数体修改会自动应用；改变函数签名、增删函数、改依赖或原生配置时仍需重新运行。外部编辑器保存的更改应以 IDE 的 Live Edit 状态指示器为准；没有应用时从 IDE 保存或重新运行。

现有 `dsh.learningPreview=true` 是仅用于 x86_64 模拟器的应用界面开发模式，不包含完整 arm64 Node agent。启动后会进入真实聊天主页，自动添加明确标为“界面预览示例”的本地对话；不会要求填写账号。输入框发送后生成本地示例回复，供检查消息气泡、滚动和输入状态，不会调用真实模型。侧栏、设置和导航仍使用应用本身的代码。验证真实模型、手机工具和引擎功能时，请使用原有 arm64 构建与实体手机。它使用独立包名 `io.github.jackwener.dsh.learning.preview`。

## 完整应用界面的浏览器查看页（默认）

```powershell
.\tools\preview-ui.ps1
```

打开 <http://127.0.0.1:4174/>。这里展示实际 Android 应用的界面，而非学习组件单独演示。支持：

- 实时运行画面，约每半秒获取一帧；应用页面发生变化后会更新。
- 当前聊天主页、会话侧栏、设置页面的原生截图切换。
- 适应窗口，以及 100%–200% 放大；放大后可横向、纵向滚动。

**浏览器查看页是只读的**，不向模拟器发送点击、键盘或构建命令。交互操作和原生代码编辑在 Android Studio / Android 运行环境中进行。Compose Preview 预览普通数据驱动的组件；Live Edit 可将支持的修改应用到运行中的应用，浏览器实时画面会随之更新。浏览器查看页不会自行把 Kotlin 转为 HTML，也不声称提供网页热替换。

查看服务仅监听本机 `127.0.0.1`，固定读取开发模拟器 `emulator-5554`，拒绝写请求和跨站来源，不连接实体手机。三个截图文件位于 `out/preview-app-{chat,drawer,settings}.png`，来自当前构建的实际页面；它们是静态检查记录，实时状态以“实时运行画面”为准。

本次已验证：开发版冷启动直接进入带示例内容的主界面；侧栏和设置可打开；示例事件通过真实 `Projector` 投影生成聊天记录，新增纯 JVM 测试通过。`assembleDebug` 成功；定向 JVM 测试运行时排除了未缓存且本测试不使用的 Robolectric 原生运行库，未声称运行 Robolectric 原生渲染测试。

## 参考

- [技能源码](https://github.com/skydoves/android-testing-skills/tree/main/compose/preview/developing-with-compose-previews)
- [Android Compose Preview](https://developer.android.com/develop/ui/compose/tooling/previews)
- [Android Live Edit 的支持范围与限制](https://developer.android.com/develop/ui/compose/tooling/iterative-development)
