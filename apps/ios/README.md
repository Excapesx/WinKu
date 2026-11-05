# apps/ios

**状态：未开始。**

iOS 客户端。**不在手机上跑引擎**——iOS 禁止 JIT 和子进程，Node 上不去。

## 定位

- 纯客户端：聊天、拍照解题、学生组件、artifact 渲染
- 模型调用：直连厂商 API（自带 key），或连自己的中转服务
- **不做**跨 App 自动化（iOS 没有无障碍能力，做不到）

## 两条实现路线

| 路线 | 成本 | 适合 |
|---|---|---|
| 复用 `apps/web` 的 Expo 代码 | 低，一份代码 | 先验证 |
| 原生 SwiftUI | 高，两套代码 | 要深度集成（小组件、Siri、Live Activity）时 |

先走第一条。什么时候需要第二条：等真有人天天用，再谈。

## 测试路径（没有 Mac 也能走完）

1. **Expo Go**：App Store 装一个，电脑上 `npx expo start`，扫码即用。零成本。
2. **PWA**：Safari 打开网页 → 添加到主屏幕。零成本。
3. **TestFlight**：EAS Build 云端出包，需要 Apple 开发者账号（$99/年）。
4. **侧载**：AltStore + 免费 Apple ID，7 天重签。

## 合规

上架中国区 App Store 需要 App 备案；**TestFlight、侧载、PWA 不涉及**。
详见 `docs/HANDOFF.md`。
