import React, { useEffect, useState, useSyncExternalStore } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { check } from "@tauri-apps/plugin-updater";
import { Download, LoaderCircle } from "lucide-react";
import { createUpdateController } from "./update-controller.mjs";
import { Card, Dialog, Row, Switch } from "./MobileUI";
import { openExternal } from "./api";
import { t } from "./i18n";

export const appUpdates = createUpdateController({ check: () => check({ timeout: 25_000 }), storage: localStorage });
const useUpdate = () => useSyncExternalStore(appUpdates.subscribe, appUpdates.getSnapshot);
const releases = "https://github.com/Excapesx/WinKu/releases";
const working = (phase: string) => ["checking", "downloading", "installing"].includes(phase);
const bytes = (n: number) => `${(n / 1_048_576).toFixed(1)} MB`;
function UpdateButton({ variant, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) {
  return <button type="button" className={`${variant === "ghost" ? "a-text-button" : "a-outline-button"} update-action`} {...props} />;
}
function description(s: ReturnType<typeof useUpdate>) {
  if (s.error) return t(s.error);
  if (s.phase === "checking") return t("正在检查新版本…");
  if (s.phase === "downloading") return s.total ? `${bytes(s.downloaded)} / ${bytes(s.total)}` : `${t("正在下载更新")} · ${bytes(s.downloaded)}`;
  if (s.phase === "ready") return t("下载完成，已通过签名校验。");
  if (s.phase === "installing") return t("正在启动更新安装…");
  if (s.phase === "current") return t("已是最新版本");
  if (s.version) return `${t("发现新版本")} ${s.version}`;
  return t("点击检查 GitHub 上的新版本");
}

export function UpdateIndicator({ busy }: { busy: boolean }) {
  const s = useUpdate();
  const [open, setOpen] = useState(false);
  const [confirmInstall, setConfirmInstall] = useState(false);
  useEffect(() => {
    if (!isTauri()) return;
    const start = () => void appUpdates.check(false);
    const timer = window.setTimeout(start, 3_000);
    window.addEventListener("focus", start);
    return () => { clearTimeout(timer); window.removeEventListener("focus", start); };
  }, []);
  async function install() {
    if (busy && !confirmInstall) { setConfirmInstall(true); return; }
    await appUpdates.install();
  }
  async function activate() {
    setOpen(true);
    setConfirmInstall(false);
    if (s.phase !== "ready" && !working(s.phase)) await appUpdates.download();
  }
  // A background check never interrupts a conversation with a modal.
  const visible = !!s.version;
  return <>
    {visible && <button type="button" className="update-indicator" title={`${t("更新 WinKu")} · ${s.version}`} aria-label={`${t("更新 WinKu")} ${s.version}`} onClick={activate}>
      {working(s.phase) ? <LoaderCircle size={20} className="update-spin" /> : <Download size={20} />}
    </button>}
    {open && <Dialog title={`${t("更新 WinKu")} ${s.version}`} onClose={() => { setOpen(false); setConfirmInstall(false); }}>
      <p role="status">{description(s)}</p>
      {s.phase === "downloading" && <progress className="update-progress" aria-label={t("更新下载进度")} max={s.total || undefined} value={s.total ? Math.min(s.downloaded, s.total) : undefined} />}
      {s.notes && <p className="update-notes">{s.notes}</p>}
      {s.phase === "ready" && <p>{t(confirmInstall ? "仍有任务运行，更新会中断任务。确定现在安装？" : "安装将关闭 WinKu，完成后重新打开。聊天和配置会保留。")}</p>}
      <div className="dialog-actions">
        <UpdateButton variant="outline" onClick={() => { setOpen(false); setConfirmInstall(false); }}>{t("稍后")}</UpdateButton>
        {s.phase === "ready" ? <UpdateButton onClick={install}>{t(confirmInstall ? "结束任务并安装" : "重启并安装")}</UpdateButton>
          : !working(s.phase) && <UpdateButton onClick={() => appUpdates.download()}>{t("下载更新")}</UpdateButton>}
      </div>
      {s.error && <UpdateButton variant="ghost" onClick={() => void openExternal(releases).catch(() => {})}>{t("打开发布页")}</UpdateButton>}
    </Dialog>}
  </>;
}

export function UpdateSettings() {
  const s = useUpdate();
  const [version, setVersion] = useState("");
  useEffect(() => { if (isTauri()) void getVersion().then(setVersion).catch(() => {}); }, []);
  return <Card>
    <Row title="WinKu" description={version ? `v${version} · Windows` : "Windows"} />
    <Row title={t("检查更新")} description={`${version ? `v${version} · ` : ""}${description(s)}`}
      trailing={<UpdateButton variant="outline" disabled={working(s.phase)} onClick={() => appUpdates.check()}>{t(s.phase === "checking" ? "正在检查…" : "检查更新")}</UpdateButton>} />
    {s.version && <Row title={`${t("新版本")} ${s.version}`} description={t("点击侧栏底部绿色下载图标即可下载和安装")} />}
    <Row title={t("自动检查更新")} description={t("启动时在后台检查 GitHub 上的新版本，每天最多一次")}
      trailing={<Switch label={t("自动检查更新")} checked={appUpdates.autoEnabled()} onChange={(value) => appUpdates.setAutoEnabled(value)} />} />
  </Card>;
}
