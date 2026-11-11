# WinKu 原生 Windows 安装界面

基于已确认的 `apps/desktop/design/installer` 交互提案。页面采用 Windows 原生控件和 GDI+，无需额外 WebView 或常驻安装服务。品牌标志和颜色来自 WinKu 现有规范。

## 构建

在 Windows 的 `apps/desktop` 目录运行 `scripts/build-installer-ui.ps1`。脚本通过 vswhere 选择已安装的 Visual C++ 工具链，编译 x86 Unicode NSIS 插件，然后生成 `WinKu.nsi`。`scripts/package.ps1` 已包含此步骤。`plugins/` 为生成产物，不应手工编辑或单独提交。

Tauri 配置使用本目录模板、`WinKuUI.nsh` 和正式应用图标。x86 插件由 NSIS 安装器使用，不影响 x64 客户端。插件使用静态 C 运行库和 Windows 自带 API。

## 保留的安装行为

资源复制、WebView2 检查、现有版本检测、注册表、开始菜单、静默参数以及卸载仍来自上游 Tauri 模板。欢迎页集中编辑安装位置和桌面快捷方式；完成页选择是否启动。

当前用户安装和应用标识 `io.github.excapesx.winku.desktop` 不变。更新不清除聊天、配置与密钥；卸载的数据删除保持上游明确勾选机制。用户取消时只停止剩余步骤，不递归删除安装目录，以免升级过程中误删用户已有内容。部分已写入的应用文件可能保留，可重新运行安装器覆盖安装。

进度直接读取 NSIS 的进度控件，不使用预览计时器。取消请求通过原子标志传递，并在主程序及每个资源文件写入后检查；长文件写入或运行依赖安装器时，需要等待当前步骤返回。交互安装和 `/P` 被动安装均执行检查；`/S` 静默安装不加载界面插件。失败重试会重新打开交互安装器并保留目标路径。

初始窗口根据可用工作区限制缩放比例；跨显示器 DPI 变化时重新布局。系统文件夹选择器、确认和错误提示使用系统对话框。

`NOTICES.txt` 随安装包和应用目录提供，欢迎页与完成页可以离线打开。

## 上游与素材

- `upstream-template.nsi`：Tauri CLI v2.12.4 的 [NSIS 模板](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.4/crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi)，Tauri 项目采用 MIT / Apache-2.0 双许可证；本项目保留来源并通过脚本进行有边界的修改。
- 固定上游 SHA-256：`d00089d3b1a2c4a30d7b6e098079100cb8f25e980f84d4515aca4597b95e967d`。升级上游时须重新审核锚点与差异。
- `WinKu.nsi` 为生成后的模板，生成器校验固定上游内容，保留卸载区段。
- `left-panel.png` 来自本项目已确认的安装器预览左侧品牌区域截图，无第三方摄影或图标素材；由 `apps/desktop/.impeccable/review/installer/desktop-welcome.png` 裁切生成。
- W 路径继承 `apps/desktop/app-icon.svg`；其余图形为本项目原生绘制。
- `NOTICES.txt` 来源于官网 `src/credits/LICENSES.txt` 的第三方许可汇编。

## 验证边界

原生界面曾在隔离 NSIS 测试程序中验证欢迎页、路径展开、系统浏览、无效相对路径拦截及完成页。测试不注册或覆盖真实 WinKu。最新取消 / 重试与缩放改动仍须完成原生运行验证后才可发布；编译通过和网页预览不能替代这些检查。
