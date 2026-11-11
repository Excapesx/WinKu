/** One updater shared by the sidebar and settings; the signed installer is owned by Tauri. */
export function createUpdateController({ check, storage, now = Date.now }) {
  let state = { phase: "idle", version: "", notes: "", downloaded: 0, total: 0, error: "", checkedAt: 0 };
  try {
    const known = JSON.parse(storage.getItem("winku-update-known") ?? "null");
    if (known && /^\d+\.\d+\.\d+$/.test(known.version)) state = { ...state, phase: "available", version: known.version, notes: String(known.notes ?? "").slice(0, 16_000) };
  } catch { /* Invalid preferences cannot prevent startup. */ }
  let update = null;
  let job = null;
  const listeners = new Set();
  const emit = (patch) => { state = { ...state, ...patch }; listeners.forEach((fn) => fn()); };
  const read = (key) => { try { return storage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { storage.setItem(key, value); } catch { /* Checks still work without preferences. */ } };
  const active = () => ["checking", "downloading", "installing"].includes(state.phase);
  const controller = {
    getSnapshot: () => state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    autoEnabled: () => read("winku-update-auto") !== "false",
    setAutoEnabled(value) { write("winku-update-auto", String(value)); emit({}); },
    async check(manual = true) {
      if (active() || (!manual && state.phase === "ready")) return;
      const at = now();
      if (!manual && (read("winku-update-auto") === "false" || at - Number(read("winku-update-at") ?? 0) < 86_400_000)) return;
      write("winku-update-at", String(at));
      const previous = update;
      const previousState = state;
      emit({ phase: "checking", error: "" });
      try {
        const found = await check();
        if (previous && previousState.phase === "ready" && found?.version === previous.version) {
          if (found !== previous) await found.close().catch(() => {});
          emit({ ...previousState, checkedAt: at, error: "" });
          return;
        }
        if (previous && previous !== found) await previous.close().catch(() => {});
        update = found;
        write("winku-update-known", found ? JSON.stringify({ version: found.version, notes: found.body ?? "" }) : "null");
        emit({ phase: found ? "available" : "current", version: found?.version ?? "", notes: found?.body ?? "", downloaded: 0, total: 0, checkedAt: at });
      } catch {
        // A failed check must not erase an already discovered version.
        emit({ phase: previous ? previousState.phase : "error", error: "检查失败，请检查网络后重试。", checkedAt: at });
      }
    },
    async download() {
      // Cached metadata may advertise an update after restart, but never authorizes an install.
      if (!update && !active()) await controller.check();
      if (!update || active() || state.phase === "ready") return;
      emit({ phase: "downloading", downloaded: 0, total: 0, error: "" });
      job = update;
      try {
        await job.download((event) => {
          if (event.event === "Started") emit({ total: event.data.contentLength ?? 0, downloaded: 0 });
          else if (event.event === "Progress") emit({ downloaded: state.downloaded + event.data.chunkLength });
        }, { timeout: 120_000 });
        // download() resolves only after the plugin has verified the cryptographic signature.
        emit({ phase: "ready" });
      } catch {
        emit({ phase: "error", error: "更新下载或校验失败，当前版本未改变。请重试，或打开发布页手动下载。" });
      } finally { job = null; }
    },
    async install() {
      if (!update || state.phase !== "ready") return;
      emit({ phase: "installing", error: "" });
      // The Windows plugin exits the process. Do this first so the next launch checks its new version.
      write("winku-update-known", "null");
      write("winku-update-at", "0");
      try { await update.install({ restartAfterInstall: true }); }
      catch {
        write("winku-update-known", JSON.stringify({ version: state.version, notes: state.notes }));
        emit({ phase: "ready", error: "未能启动安装，请重试或打开发布页手动下载。" });
      }
    },
  };
  return controller;
}
