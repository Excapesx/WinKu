# WinKu 应用内更新

Android 与 Windows 使用独立的版本清单，安装包下载来源为本仓库 GitHub Releases。自动检查每天至多一次，不自动弹窗；发现新版后，在侧栏底部设置右侧显示绿色下载图标。设置 → 关于可手动检查，网络错误不显示为“已是最新版本”。

## Windows

- 使用 Tauri v2 官方 updater 插件。下载返回前验证 Minisign 签名，验证失败不会调用安装器。
- 清单固定地址：`https://raw.githubusercontent.com/Excapesx/WinKu/main/apps/desktop/update/latest.json`。
- 首次带更新功能的版本为 1.0.1；先前的 Windows 版本需手动覆盖安装一次。
- 点击下载图标直接下载；下载后点击“重启并安装”。运行中的任务需额外确认，安装使用 NSIS `/UPDATE`，保留用户数据。Windows 安装器由插件在独立临时目录中管理；不要把聊天数据放入应用安装目录。
- 公钥已固化在 tauri.conf.json。签名私钥仅在维护者电脑的 `%USERPROFILE%/.winku-signing/windows-updater.key`，应备份到安全位置，切勿上传仓库、安装包或日志。CI 使用 `TAURI_SIGNING_PRIVATE_KEY` 与 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 环境变量。丢失密钥会导致已有客户端无法验证后续更新。
- `scripts/package.ps1` 默认要求签名密钥，生成带版本号的 EXE 与 `.sig`。现有 GitHub Actions 在未配置签名密钥时仅生成 `-validation-setup.exe`；本地也可明确设置 `WINKU_ALLOW_UNSIGNED_TEST_BUILD=1`。该验证产物不得作为更新包发布，清单生成器会拒绝它。

```powershell
cd apps/desktop
npm run package
node scripts/make-update-manifest.mjs --installer out/WinKu-v1.0.1-Windows-x64-setup.exe --tag v1.0.1 --notes ../../docs/releases/v1.0.1.md --output update/latest.json
```

## Android

- 保留现有下载续传、SHA-256、包名、版本号、安装签名检查与 PackageInstaller 安装流程。
- 清单固定地址：`https://raw.githubusercontent.com/Excapesx/WinKu/main/apps/android/update/latest.json`。备用来源保留平台专用附件 `update-android.json`，避免 GitHub latest 指向 Windows 时取错清单。
- 版本必须递增 versionCode；覆盖安装必须沿用用户当前 APK 的签名。自行构建且签名不同的版本会提示手动处理，不能通过关闭签名校验“修复”。
- 点击侧栏下载图标后开始下载，验证通过且应用在前台、没有运行任务时调起系统安装；否则显示“安装”按钮。Android 可能要求用户授权“安装未知应用”并确认安装。
- 更新完成后现有下载缓存清理机制删除旧 APK，不清理聊天、配置或密钥。

```powershell
cd apps/android
python tools/make-update-manifest.py app/build/outputs/apk/release/app-release.apk --name WinKu-v1.0.1-arm64.apk --tag v1.0.1 --notes-zh ../../docs/releases/v1.0.1.md -o update/latest.json
```

## 发布顺序

1. 先构建并验证两端安装包；Android 沿用现有发布签名，Windows 使用固化公钥对应的私钥签名。
2. 生成两份清单，检查版本、文件名、签名、哈希、大小和发布标签。
3. 创建 GitHub Release 并上传 EXE、`.sig`、APK、校验值及 `update-windows.json`、`update-android.json`；验证下载地址实际可用。
4. **最后**才更新 main 分支上的两个 `update/latest.json`。不要先发布清单再上传安装包，也不要将校验失败、缺失或 CI validation 安装包写入正式清单。
5. 在低一版本客户端验证提示、下载进度、网络中断重试、安装、重启后版本及原有聊天/配置仍在。

安装包使用不可变的版本路径，不覆盖已发布文件；官网和更新入口指向同一 Release。更新检查与下载无需模型 API Key。GitHub 网络不可用时保留当前客户端并提供重试及手动下载页。
