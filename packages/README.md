# packages

**状态：空。** 这里放跨端共享的东西，目标是「一份实现，多个客户端引用」。

## 计划中的三个包

### `artifact/`（最先抽）

交互内容渲染器：函数图像、图表、流程图、公式、代码、测验、表格。

现在住在 `apps/android/learning-ui/`，是 React 组件 + esbuild 打包，产物进
`apps/android/app/src/main/assets/learning/`，由 WebView 加载。

抽出来的意义：Web、iOS、桌面都能直接用同一份，不用各写一套。

抽取时要处理：
- 主题：现在是 CSS 变量，要能被宿主写入（Android 传当前配色）
- 桥接：`window.AndroidBridge` 这类原生回调要抽象成可注入的接口
- 构建产物：一个 `dist/` + 一份 JSON schema

### `design/`

设计 token：颜色、字号、行高、圆角、间距。

现在 Android 有一份（`apps/android/app/.../core/designsystem/Color.kt` 和 `Theme.kt`），
Web/iOS 需要同一份数值。做法：用一个 `tokens.json` 作为唯一来源，各端生成自己的格式。

### `protocol/`

消息、工具调用、artifact、会话事件的数据结构。

各端要和引擎（或中转服务）对话，类型必须一致。先定义 JSON Schema，再生成 Kotlin / TypeScript 类型。

## 原则

- 包不依赖任何具体客户端
- 每个包能单独构建、单独测试
- 平台的差异留在 `apps/*` 里，不要渗进来
