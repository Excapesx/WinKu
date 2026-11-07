# WinKu Windows v1.0 交接 · 2026-11-07

## 当前状态

Windows x64 v1.0 已按 Android 统一主题与教学输出。Android 代码和 toolchains 未改动。安装包：`out/WinKu-v1.0-Windows-x64-setup.exe`，校验值见 `out/SHA256SUMS.txt`。

功能和构建入口见本目录 README。布局采用历史侧栏、中央聊天和按需打开的阅读面板；学生工具入口内容仍由用户指定。首版不含桌面自动操作、文件写入、云同步或自动更新。

## 本轮跨端统一

- Android `Color.kt`、`brand_mark.xml`、launcher XML 为视觉来源。`scripts/sync-android-design.mjs` 在前端构建时生成桌面配色、应用内 W 和启动图标 SVG；打包时自动生成 ICO/PNG。不要手改单端的生成文件。
- 桌面沿用手机侧栏字标、深浅色、20px 无尖角用户气泡、28px 输入框、中央空会话与开放式助手正文；保留固定侧栏、键盘操作和按需阅读面板。教学内容使用 Android 既有组件与原生桥接相同的主题覆盖，根字号统一为 16px，正文为 15/26。
- 教学标题支持行内公式，图标按组件类型选择。围栏解析与 Android `RichContent.kt` 对齐（含 `dsh-html`、缩进、CRLF、较长关闭围栏、普通代码内的组件示例保护）；桌面旧 `latex` 别名保留。
- TypeScript 通过，8/8 测试通过（5 项实际 dsh 集成、3 项围栏回归，`.tools/unified-tests.log`）。真实 Tauri WebView2 验证了流式、重新生成、代码复制/换行、PDF 阅读、组件展开/Escape、1180×800 和 760×680 布局。模型服务为本地模拟，无付费接口调用。
- `.review/unified-*.png` 是本轮截图，已查看；`.review/parity-{desktop,mobile}-{light,dark}.json` 对照同一组件数据的实测属性一致。mobile 对照是 Chromium 加载 Android 现有前端资产，未启动模拟器或新增真机测试。
- 独立界面审查 disposition 为 `ship`，无 material fixes；设计记录已合并为继承 Android 的当前系统。机械检查的字号/圆角提示来自旧文档。
- 新版 release/NSIS 构建成功，打包目录自带 Node/dsh 使用隔离数据和本地服务返回 `Installed runtime OK`（`.review/unified-release-engine.log`）。发现用户当前已安装并运行 `Desktop/WinKu`，因此没有再次执行安装器或覆盖其注册信息；本轮没有重复声明首版的安装/卸载验证。

## 首版验证记录（本轮之前）

- TypeScript 检查通过，5/5 集成测试通过（`.tools/test-delivery.log`），使用真实 Windows dsh 和本地模拟模型服务，没有调用用户的付费接口。
- 实际 Tauri WebView2 检查模型配置、Key 保存、流式/停止/重新生成、重启续聊、文本附件/PDF 阅读、代码复制与换行、学习组件状态、浅深色和 760×680 窄桌面布局。
- 长回答滚动与底部输入框固定已修复。正常 1180×800 窗口 composer bottom 为 800px。
- 首版曾使用桌面单独的操作绿；本轮已改为 Android 的语义角色（中性主按钮、深浅链接色、固定品牌绿），不应恢复旧桌面覆盖值。
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

主要截图在 `.review/`；最新为 `unified-*.png`。早期截图保留作调试参考，不要用它们覆盖当前源代码中的颜色决策。无需重新进行整套视觉探索或重复已通过的检查。

发布时保留当前平台的最新交付安装包；构建缓存不属于旧交付包，不要清掉缓存来清理安装包。
