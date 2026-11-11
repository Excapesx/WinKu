# WinKu 更新清单

使用 `tools/make-update-manifest.py` 生成 `latest.json`，APK 上传完成后再将清单提交到 main；同一清单作为 `update-android.json` 和兼容旧客户端的 `update.json` 附加到 GitHub Release。两端清单独立维护，详见 [`docs/APP-UPDATES.md`](../../../docs/APP-UPDATES.md)。

旧上游的更新清单已移除。不要使用上游 APK 的下载地址、签名或校验值发布 WinKu 更新。
