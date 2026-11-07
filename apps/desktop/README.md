# WinKu Windows

Windows x64 首版，版本 v1.0。Tauri + React 提供桌面窗口，随安装包携带 Node 24 和真正的 dsh 引擎；使用者不需要另外安装 Node。macOS 尚未实现。

## 当前开发状态（尚未发布）

当前源码已补充 Windows 自动化、权限工具、提示词润色和 Android 风格的设置分页。独立界面审查仍为 FIX：扩展管理完整迁移、语言切换、生成中排队/引导尚未完成，因此不能宣称每个子页面已经与 Android 几乎一致，`out/` 仍保留上一轮已交付安装包。不要把新源码和旧安装包混为一版。

## 使用

安装 `out/WinKu-v1.0-Windows-x64-setup.exe`，进入“设置”添加自己的服务商名称、API 基础地址、模型 ID 和 API Key。支持 Chat Completions、Responses、Anthropic Messages；确认模型支持视觉时勾选“图片理解”。无内置公共 Key 或免费额度。

- 流式聊天、停止、重新生成，以及本地历史会话。重新生成替换最新回答，使用原会话上下文，不回滚 dsh 日志。
- 图片、文本/代码和 PDF 附件。每次最多 4 个；图片上限 8 MB，文档上限 20 MB / 12 万字符，PDF 上限 60 页。PDF 首版提取文字，扫描 PDF 请改发截图给视觉模型。
- 复用 Android 的数学/化学公式、代码高亮、函数图、流程图、图表、讲解与小测组件；阅读面板按需打开。
- API Key 存于 Windows 凭据管理器；配置、附件与聊天内容保存在当前用户的 `%LOCALAPPDATA%/io.github.excapesx.winku.desktop`，应视为私有资料。
- “工具”保留学生工具入口，内容待用户指定。当前源码支持 Windows 读屏/截图、点按/输入、PowerShell、文件写入、桌面通知；默认只读，电脑操作需要开启相应工具和权限。云同步与自动更新尚未实现。

引擎按需启动，空闲 60 秒后关闭；窗口退出时 Windows Job Object 清理所属子进程。首版未签名，安装器可能需要系统下载 WebView2 Runtime。

## 开发与打包

需要 Windows x64、Node 24、Rust MSVC 工具链和 Visual Studio C++ 构建工具。在本目录运行：

```powershell
npm ci
npm ci --prefix engine --install-links
npm run prepare:engine
npm run tauri -- dev
```

验证及打包：

```powershell
npx tsc --noEmit
npm test
npm run package
```

打包脚本限制 Cargo 为 2 个 worker。不要同时启动 Android 构建/模拟器。`engine/node_modules`、`runtime`、Rust target 和 `.review` 都是本地生成目录；不要把 QA 数据打入安装包。`.cargo/config.toml` 是本机可选网络配置，不提交到仓库。

桌面主题、应用内 W 和图标以 Android 为基准：构建会从手机端色板与矢量资源同步，打包会重新生成 Windows 图标。用户气泡、输入框、空会话和学习卡片保持同一视觉语言；桌面保留侧栏、拖入文件、键盘操作和按需阅读面板。桌面内置 Noto Sans SC（OFL，许可随包分发），避免 Windows 字体回退成衬线体。窗口与启动图标外形遵循各平台约定。

## 代码地图

| 路径 | 职责 |
|---|---|
| `src-tauri/src/main.rs` | 原生进程归属、JSON IPC、Windows 凭据、外部链接 |
| `engine/host.mjs` | 配置/会话持久化、运行状态、附件上下文、重新生成 |
| `engine/client.mjs` | dsh SDK 子进程、模型路由、会话恢复、权限和模式工具集 |
| `engine/features.mjs` | 通用设置、模式限制、技能/MCP、定时任务与真实用量 |
| `engine/polish.mjs` | 三协议提示词润色，引用保护、超时取消 |
| `engine/windows-tools.mjs` | Windows UI Automation、截图、输入、系统设置、通知及授权拦截 |
| `src/MobilePages.tsx` / `src/MobileUI.tsx` | 安卓式设置分页、模式编辑、任务列表与统一控件 |
| `engine/desktop-plugin.mjs` | 流式事件与共享学习组件生成指引 |
| `src/main.tsx` | 会话、模型设置、附件入口与阅读面板 |
| `src/Teaching.tsx` | 共享学习组件封装与交互状态 |
| `src/rich-content.mjs` | 与 Android 对齐的教学围栏解析，保护代码示例与未完成数据 |
| `scripts/sync-android-design.mjs` | 从 Android 色板和品牌资源生成桌面主题与图标源 |
| `scripts/prepare-engine.mjs` | Windows 可移植补丁、共享模块及 Node 运行时准备 |
| `scripts/package.ps1` | NSIS 安装包 |

渲染器直接引用 `../android/learning-ui/src`，不复制实现；生成指引直接从 Android 插件源构建。不要把 Android 的 native、shell、profile 补丁套到 Windows 上。安装后的资源路径必须指向安装目录内的 `engine` 和 `runtime`。

## 验证范围

14 个测试包含实际 dsh 集成测试、设置与权限回归和教学围栏回归，使用本机 HTTP 模拟服务覆盖三种协议、图片输入、流式、失败、停止、重生成与重启续聊；没有调用用户的付费服务。已在真实 Tauri WebView2 中检查聊天、PDF 阅读、代码操作、学习组件、深浅主题和窄桌面布局，并对照 Android 现有前端资产验证同一教学卡片的主题与尺寸。具体服务商的模型权限、额度和兼容性仍由其实际接口决定。

自动化任务仅在 WinKu 运行时按时触发；关闭期间暂停，重开后补执行一次到期任务，不建立开机自启服务。任务使用创建时的模型服务和执行时的权限；失败记录可在任务详情中查看。模型自建任务也须授权。

润色只发当前草稿，不带聊天历史，不创建会话；结果不完整或引用变化时保留原稿。编辑、换会话或换模型会取消当前润色，完成后可撤销。
