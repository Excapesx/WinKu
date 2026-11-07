# WinKu Windows v1.0 交接 · 2026-11-07

## 当前状态

Windows x64 首版已完成编译、原生界面复核、安装与退出验证。Android 代码和 toolchains 未改动。安装包：`out/WinKu-v1.0-Windows-x64-setup.exe`，校验值见 `out/SHA256SUMS.txt`。

功能和构建入口见本目录 README。布局采用历史侧栏、中央聊天和按需打开的阅读面板；学生工具入口内容仍由用户指定。首版不含桌面自动操作、文件写入、云同步或自动更新。

## 已验证

- TypeScript 检查通过，5/5 集成测试通过（`.tools/test-delivery.log`），使用真实 Windows dsh 和本地模拟模型服务，没有调用用户的付费接口。
- 实际 Tauri WebView2 检查模型配置、Key 保存、流式/停止/重新生成、重启续聊、文本附件/PDF 阅读、代码复制与换行、学习组件状态、浅深色和 760×680 窄桌面布局。
- 长回答滚动与底部输入框固定已修复。正常 1180×800 窗口 composer bottom 为 800px。
- 独立界面审查的唯一修正为小字和按钮对比度；已改为操作色 #0B7A40，图形品牌 W 保持 #0E8A4A。修正复核结果为 ship，仅覆盖此修正；设计文档已完成。
- NSIS 安装退出码 0；在隔离安装目录使用其自带 Node v24.21.0 和 dsh 实际返回 `Installed runtime OK`；原生窗口标题 WinKu，响应正常。
- 正常关闭安装后的应用，9 个所属进程全部退出；隔离测试安装随后已卸载。验收日志 `.review/install-verification.json`、`.review/installed-engine.log`。
- 本机先前空闲进程合计工作集约 498 MiB，专用提交约 325 MiB；会随会话和附件变化。

## 开发约束

- Node 24 + Rust MSVC + Visual Studio C++；Cargo 最多 2 个 worker，构建和运行测试串行。不需要 Android 模拟器或 Gradle。
- Windows dsh 依赖单独安装到 `engine/node_modules`，不能复制 Android 的 .so/native/shell/profile 补丁。
- `prepare-engine.mjs` 从 Android 源复用生成指引/流式模块，只应用可移植补丁。生成副本、Node runtime、target、gen/schema、QA 数据均不提交。
- API Key 存于 Windows 凭据管理器。`.review` 只含本地虚假模型配置，不能放进发布包。
- 本机 `.cargo/config.toml` 是 gitignored 网络覆盖（rsproxy sparse、关闭代理、离线缓存）；新机器按自己的网络配置，不应清除现有构建缓存。
- Android `toolchains/` 是构建命脉，绝对不要删。

## 调试与复核

Debug 模式可设置 `WINKU_DEBUG_PORT=9229`、`WINKU_TEST_DATA_DIR=<隔离目录>`，再用 agent-browser 连接真实 WebView2。PowerShell 的 `@eN` 需要单引号，截图用绝对路径；release 不使用 QA 环境变量切换数据目录。

主要截图在 `.review/`；最新对比度复核截图为 `contrast-settings.png`、`contrast-tools.png`。早期截图保留作调试参考，不要用它们覆盖当前源代码中的颜色决策。无需重新进行整套视觉探索或重复已通过的检查。

发布时保留当前平台的最新交付安装包；构建缓存不属于旧交付包，不要清掉缓存来清理安装包。
