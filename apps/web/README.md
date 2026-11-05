# apps/web

**状态：未开始。**

移动优先的网页版。计划里它同时承担两个角色：

1. 浏览器里能用的聊天界面（PWA，可加到主屏）
2. iOS 端的代码来源——用 Expo 或 WKWebView 包一层就是原生 App

## 打算怎么做

- 技术栈：Expo（React Native + Web），一份代码同时出 Web 和 iOS
- 模型接入：浏览器直连模型厂商的 OpenAI 兼容接口，key 存在本机
- artifact：复用 `packages/artifact`（现在是 `apps/android/learning-ui`），公式、图表、流程图、测验
- 不做：手机自动化、本地文件深度访问

## 为什么放 Expo

见 `docs/HANDOFF.md` 的「跨端策略」：Expo Go 可以扫码在真机上跑，不需要 Mac、不需要开发者账号，
是验证 iOS 体验最快的路；同一份代码还能出 PWA 和 TestFlight 包。

## 开工前

先把 `packages/artifact` 抽出来（ROADMAP P2），否则三端会各写一套渲染。
