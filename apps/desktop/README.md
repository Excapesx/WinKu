# apps/desktop

**状态：未开始。**

Windows / macOS 桌面端。

## 为什么桌面端最简单

dsh 本来就是跨平台 Node 程序，桌面上**直接跑原生引擎**，不需要 Android 那套 JNI + libnode 的移植。
缺的只有两样：

1. 一个壳（聊天窗口）
2. 一堆桌面能力插件（文件、shell 本来就有；屏幕自动化要另写）

## 壳怎么选

| 方案 | 优点 | 缺点 |
|---|---|---|
| Compose Desktop | 能复用 Android 的 Compose 界面代码 | 打包体积大，macOS 签名麻烦 |
| Tauri | 体积小、原生窗口 | UI 要用 Web 技术重写 |
| Electron | 生态最熟 | 体积更大 |

倾向 **Compose Desktop**：Android 那套界面逻辑能搬相当一部分，颜色、字号、会话结构都是现成的。

## 能力层

- 文件 / shell：dsh 自带，不用写
- 屏幕：Windows 用 PowerShell + UI Automation；macOS 用 Accessibility API（需要用户授权）
- 剪贴板、通知：各平台原生 API

## 优先级

在 P5（见 `ROADMAP.md`）。理由：桌面端的用户少，但它是唯一能"跑满血引擎"的地方，
也是以后做远程模式时的宿主。
