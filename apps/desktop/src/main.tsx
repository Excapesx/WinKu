import { t, setUILanguage } from "./i18n";
import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Plus,
  PanelLeft,
  Settings,
  Search,
  Sun,
  Moon,
  ArrowUp,
  Square,
  X,
  FileText,
  Image,
  RotateCw,
  Copy,
  Check,
  Trash2,
  ChevronLeft,
  ArrowRight,
  LoaderCircle,
  MessageCirclePlus,
  LayoutGrid,
  ChevronDown,
} from "lucide-react";
import { androidMark } from "./android-brand";
import { AIcon, AButton, Menu, MenuItem, Dialog, RiskDialog } from "./MobileUI";
import { SettingsHub, AutomationPage, TrajectoryPage } from "./MobilePages";
import {
  empty,
  request,
  subscribe,
  openExternal,
  type Snapshot,
  type Provider,
  type Attachment,
} from "./api";
import { readAttachment } from "./attachments";
import "katex/dist/katex.min.css";
import "../../android/learning-ui/src/style.css";
import "./style.css";
import "./android-design.css";
import "./mobile-parity.css";
const Teaching = lazy(() =>
  import("./Teaching").then((m) => ({ default: m.Teaching })),
);
function Brand() {
  return (
    <svg
      width="30"
      height="30"
      viewBox={androidMark.viewBox}
      fill="none"
      aria-hidden="true"
    >
      <path
        d={androidMark.path}
        stroke="currentColor"
        strokeWidth={androidMark.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconButton({
  label,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}
function App() {
  const [snapshot, setSnapshot] = useState<Snapshot>(empty),
    [sessionId, setSessionId] = useState<string | null>(null),
    [page, setPage] = useState<
      | "chat"
      | "settings"
      | "tools"
      | "automation"
      | "permissions"
      | "trajectory"
    >("chat");
  const [navEpoch, setNavEpoch] = useState(0);
  const [settingsSection, setSettingsSection] = useState("index"),
    [showSearch, setShowSearch] = useState(false),
    [historyFilter, setHistoryFilter] = useState("active"),
    [rename, setRename] = useState<{ id: string; title: string } | null>(null),
    [fullConfirm, setFullConfirm] = useState(false);
  const [polishing, setPolishing] = useState(false),
    [undo, setUndo] = useState<{ before: string; after: string } | null>(null);
  const polishJob = useRef<string | null>(null),
    draftRef = useRef("");
  const [ready, setReady] = useState(false),
    [fatal, setFatal] = useState(""),
    [notice, setNotice] = useState(""),
    [draft, setDraft] = useState(""),
    [files, setFiles] = useState<Attachment[]>([]),
    [reading, setReading] = useState<Attachment | null>(null),
    [attaching, setAttaching] = useState(false),
    [dragging, setDragging] = useState(false),
    [query, setQuery] = useState(""),
    [collapsed, setCollapsed] = useState(false),
    [deleting, setDeleting] = useState<string | null>(null);
  const [dark, setDark] = useState(() =>
      localStorage.getItem("winku-theme")
        ? localStorage.getItem("winku-theme") === "dark"
        : matchMedia("(prefers-color-scheme:dark)").matches,
    ),
    [copied, setCopied] = useState(""),
    [submitting, setSubmitting] = useState(false),
    [activity, setActivity] = useState("");
  const scroll = useRef<HTMLDivElement>(null),
    follow = useRef(true),
    textarea = useRef<HTMLTextAreaElement>(null),
    picker = useRef<HTMLInputElement>(null);
  const session = snapshot.sessions.find((s) => s.id === sessionId),
    provider = snapshot.providers.find(
      (p) => p.id === snapshot.selectedProvider,
    );
  const pref = snapshot.preferences ?? {},
    mode = snapshot.modes?.find((m) => m.id === pref.modeId);
  const [systemLanguage, setSystemLanguage] = useState(navigator.language);
  const language = setUILanguage(pref.language ?? "system", systemLanguage);
  useEffect(() => {
    const changed = () => setSystemLanguage(navigator.language);
    window.addEventListener("languagechange", changed);
    return () => window.removeEventListener("languagechange", changed);
  }, []);
  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);
  const permissionLabel = (
    { "read-only": t("只读"), ask: t("询问"), full: t("完全访问") } as Record<
      string,
      string
    >
  )[pref.access ?? "read-only"];
  const modelSettings = () => {
    setSettingsSection("model");
    setPage("settings");
  };
  const act = (method: string, params: any = {}) =>
    request(method, params).catch((e) => setNotice(String(e)));
  function cancelPolish() {
    const id = polishJob.current;
    polishJob.current = null;
    setPolishing(false);
    if (id) request("prompt.polish.cancel", { id }).catch(() => {});
  }
  function editDraft(text: string) {
    cancelPolish();
    draftRef.current = text;
    setDraft(text);
    setUndo(null);
  }
  async function polishDraft() {
    if (polishing) {
      cancelPolish();
      return;
    }
    if (!provider) {
      modelSettings();
      return;
    }
    if (!draft.trim()) return;
    const before = draft,
      id = crypto.randomUUID();
    polishJob.current = id;
    setPolishing(true);
    try {
      const result = await request<{ text: string }>("prompt.polish", {
        id,
        providerId: provider.id,
        text: before,
      });
      if (polishJob.current === id && draftRef.current === before) {
        setDraft(result.text);
        draftRef.current = result.text;
        setUndo({ before, after: result.text });
      }
    } catch (e) {
      if (polishJob.current === id) setNotice(String(e));
    } finally {
      if (polishJob.current === id) {
        polishJob.current = null;
        setPolishing(false);
      }
    }
  }
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  useEffect(() => {
    cancelPolish();
  }, [sessionId, snapshot.selectedProvider, page]);
  useEffect(() => {
    if (pref.theme)
      setDark(
        pref.theme === "system"
          ? matchMedia("(prefers-color-scheme:dark)").matches
          : pref.theme === "dark",
      );
  }, [pref.theme]);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme:dark)"),
      update = () => {
        if (pref.theme === "system") setDark(media.matches);
      };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [pref.theme]);
  function openSession(id: string) {
    setSessionId(id);
    setPage("chat");
    setReading(null);
    follow.current = true;
  }
  function newTask() {
    newChat();
    editDraft(t("帮我创建一个自动化任务："));
  }
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("winku-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    let disposed = false,
      unlisten: (() => void) | undefined;
    subscribe((message) => {
      if (disposed) return;
      if (message.event === "state") setSnapshot(message.data);
      if (message.event === "artifact")
        setSnapshot((old) => ({
          ...old,
          sessions: old.sessions.map((s) =>
            s.id === message.data.sessionId
              ? {
                  ...s,
                  artifacts: {
                    ...s.artifacts,
                    [message.data.id]: message.data.value,
                  },
                }
              : s,
          ),
        }));
      if (message.event === "stream")
        setSnapshot((old) => ({
          ...old,
          sessions: old.sessions.map((s) =>
            s.id === message.data.sessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === message.data.messageId
                      ? { ...m, text: message.data.text }
                      : m,
                  ),
                }
              : s,
          ),
        }));
      if (message.event === "activity") setActivity(message.data.text);
      if (message.event === "automation.due")
        request("automation.run", { id: message.data.id }).catch(() =>
          request("automation.failure", { id: message.data.id }).catch(
            () => {},
          ),
        );
    })
      .then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      })
      .catch(() => {});
    request<Snapshot>("state")
      .then((s) => {
        if (!disposed) {
          setSnapshot(s);
          setReady(true);
        }
      })
      .catch((e) => {
        setFatal(String(e));
        setReady(true);
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (follow.current)
      scroll.current?.scrollTo({
        top: scroll.current.scrollHeight,
        behavior: "instant",
      });
  }, [session?.messages.at(-1)?.text, session?.messages.length, snapshot.busy]);
  useEffect(() => {
    const el = textarea.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 180) + "px";
    }
  }, [draft]);
  useEffect(() => {
    const onLink = (e: MouseEvent) => {
      const a = (e.target as Element)?.closest("a");
      if (a?.href && /^https?:/.test(a.href)) {
        e.preventDefault();
        openExternal(a.href).catch((x) => setNotice(String(x)));
      }
    };
    document.addEventListener("click", onLink);
    return () => document.removeEventListener("click", onLink);
  }, []);
  function newChat() {
    cancelPolish();
    setUndo(null);
    draftRef.current = "";
    setSessionId(null);
    setPage("chat");
    setReading(null);
    setDraft("");
    setFiles([]);
    follow.current = true;
    setTimeout(() => textarea.current?.focus(), 0);
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        newChat();
      }
      if (e.key === "Escape") {
        setReading(null);
        setDragging(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  async function send(text = draft, regenerate = false, now = false) {
    if (submitting) return;
    if (!provider) {
      modelSettings();
      return;
    }
    cancelPolish();
    setUndo(null);
    setSubmitting(true);
    follow.current = true;
    setActivity(t("正在连接模型…"));
    try {
      const result = await request<{ sessionId: string }>(
        regenerate ? "regenerate" : "send",
        {
          sessionId,
          providerId: provider.id,
          text,
          attachments: regenerate ? [] : files,
          now,
        },
      );
      setSessionId(result.sessionId);
      setPage("chat");
      if (!regenerate) {
        setDraft("");
        setFiles([]);
      }
    } catch (e) {
      setNotice(String(e));
    } finally {
      setSubmitting(false);
    }
  }
  async function addFiles(list: File[]) {
    if (files.length + list.length > 4) {
      setNotice(t("每次最多添加 4 个附件。"));
      return;
    }
    setAttaching(true);
    try {
      const added: Attachment[] = [];
      for (const file of list) added.push(await readAttachment(file));
      setFiles((old) => [...old, ...added]);
    } catch (e) {
      setNotice(String((e as Error).message ?? e));
    } finally {
      setAttaching(false);
    }
  }
  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(""), 1800);
    } catch {
      setNotice(t("复制失败，请选中文字手动复制。"));
    }
  }
  async function deleteSession(id: string) {
    try {
      await request("session.delete", { id });
      if (sessionId === id) newChat();
      setDeleting(null);
    } catch (e) {
      setNotice(String(e));
    }
  }
  return (
    <div className={"app " + (collapsed ? "sidebar-collapsed" : "")}>
      <aside className="sidebar" aria-label={t("主导航")}>
        <div className="brand">
          <Brand />
          <span>WinKu</span>
          <span className="platform">AGENT</span>
          <AButton
            label={t("收起侧栏")}
            icon="panel_left_outline"
            onClick={() => setCollapsed(true)}
          />
        </div>
        <button className="new-chat" onClick={newChat}>
          <AIcon name="new_chat_outline" size={20} />
          {t("新会话")}
        </button>
        <div className="sidebar-links">
          <button
            className={"nav-row " + (page === "tools" ? "selected" : "")}
            onClick={() => setPage("tools")}
          >
            <AIcon name="apps_add_outline" size={20} />
            {t("工具")}
          </button>
          <button
            className={"nav-row " + (page === "automation" ? "selected" : "")}
            onClick={() => {
              setNavEpoch((n) => n + 1);
              setPage("automation");
            }}
          >
            <AIcon name="clock_outline" size={20} />
            {t("自动化任务")}
          </button>
          <button
            className={"nav-row " + (page === "permissions" ? "selected" : "")}
            onClick={() => {
              setNavEpoch((n) => n + 1);
              setPage("permissions");
            }}
          >
            <AIcon name="shield_outline" size={20} />
            {t("权限与无障碍")}
          </button>
        </div>
        <div className="history-label">
          <span>{t("会话")}</span>
          <AButton
            label={t("搜索会话")}
            icon="search_outline"
            onClick={() => setShowSearch(!showSearch)}
          />
          <Menu
            label={t("筛选会话")}
            trigger={<AIcon name="sliders_two_outline" size={18} />}
          >
            <MenuItem
              selected={historyFilter === "active"}
              onClick={() => setHistoryFilter("active")}
            >
              {t("全部会话")}
            </MenuItem>
            <MenuItem
              selected={historyFilter === "pinned"}
              onClick={() => setHistoryFilter("pinned")}
            >
              {t("已置顶")}
            </MenuItem>
            <MenuItem
              selected={historyFilter === "archived"}
              onClick={() => setHistoryFilter("archived")}
            >
              {t("已归档")}
            </MenuItem>
          </Menu>
        </div>
        {showSearch && (
          <label className="search-box">
            <span className="sr-only">{t("搜索会话")}</span>
            <input
              autoFocus
              placeholder={t("搜索会话")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        )}
        <nav className="history" aria-label={t("历史会话")}>
          {snapshot.sessions
            .filter(
              (s) =>
                s.title.toLowerCase().includes(query.toLowerCase()) &&
                (historyFilter === "archived" ? s.archived : !s.archived) &&
                (historyFilter !== "pinned" || s.pinned),
            )
            .sort(
              (a, b) =>
                Number(!!b.pinned) - Number(!!a.pinned) ||
                (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt),
            )
            .map((s) => (
              <div
                key={s.id}
                className={
                  "history-row " +
                  (s.id === sessionId && page === "chat" ? "selected" : "")
                }
              >
                <button
                  className="history-item"
                  onClick={() => openSession(s.id)}
                >
                  <span>{s.title}</span>
                  {snapshot.activeSession === s.id && snapshot.busy ? (
                    <LoaderCircle className="spinner" size={14} />
                  ) : (
                    <time>{relativeTime(s.updatedAt ?? s.createdAt)}</time>
                  )}
                </button>
                <Menu label={t("会话菜单：") + s.title} trigger={<MoreIcon />}>
                  <MenuItem
                    onClick={() => setRename({ id: s.id, title: s.title })}
                  >
                    {t("重命名")}
                  </MenuItem>
                  <MenuItem
                    onClick={() =>
                      act("session.update", { id: s.id, pinned: !s.pinned })
                    }
                  >
                    {s.pinned ? t("取消置顶") : t("置顶")}
                  </MenuItem>
                  <MenuItem
                    onClick={() =>
                      act("session.update", { id: s.id, archived: !s.archived })
                    }
                  >
                    {s.archived ? t("取消归档") : t("归档")}
                  </MenuItem>
                  <MenuItem onClick={() => setDeleting(s.id)}>
                    {t("删除")}
                  </MenuItem>
                </Menu>
              </div>
            ))}
          {!snapshot.sessions.length && (
            <p className="history-empty">{t("开始对话后，会保存在这里。")}</p>
          )}
        </nav>
        <div className="sidebar-bottom">
          <button
            className={"nav-row " + (page === "settings" ? "selected" : "")}
            onClick={() => {
              setSettingsSection("index");
              setNavEpoch((n) => n + 1);
              setPage("settings");
            }}
          >
            <AIcon name="settings_outline" size={20} />
            {t("设置")}
          </button>
        </div>
      </aside>
      <main className="workspace">
        {(page === "chat" || page === "tools") && (
          <header className="topbar">
            <AButton
              label={collapsed ? t("展开侧栏") : t("收起侧栏")}
              icon="panel_left_outline"
              onClick={() => setCollapsed(!collapsed)}
            />
            <h1>{page === "tools" ? t("工具") : (session?.title ?? "")}</h1>
            <div className="topbar-actions">
              {page === "chat" && session && (
                <AButton
                  label={t("轨迹")}
                  icon="inspect_outline"
                  onClick={() => setPage("trajectory")}
                />
              )}
              <AButton
                label={t("新会话")}
                icon="new_chat_outline"
                onClick={newChat}
              />
            </div>
          </header>
        )}
        {fatal ? (
          <div className="startup-error">
            <h2>{t("暂时无法连接桌面引擎")}</h2>
            <p>{t(fatal)}</p>
            <button
              className="primary-button"
              onClick={() => location.reload()}
            >
              {t("重新连接")}
            </button>
          </div>
        ) : !ready ? (
          <div className="center-state" role="status">
            <LoaderCircle className="spinner" />
            {t("正在打开 WinKu…")}
          </div>
        ) : page === "settings" ? (
          <SettingsHub
            key={settingsSection + navEpoch}
            snapshot={snapshot}
            initialSection={settingsSection}
            onBack={() => setPage("chat")}
            onError={setNotice}
            onOpenSession={openSession}
            dark={dark}
          />
        ) : page === "permissions" ? (
          <SettingsHub
            key={"permissions" + navEpoch}
            snapshot={snapshot}
            initialSection="phone"
            onBack={() => setPage("chat")}
            onError={setNotice}
            onOpenSession={openSession}
            dark={dark}
          />
        ) : page === "automation" ? (
          <AutomationPage
            key={navEpoch}
            snapshot={snapshot}
            onBack={() => setPage("chat")}
            onError={setNotice}
            onOpenSession={openSession}
            onNew={newTask}
          />
        ) : page === "trajectory" ? (
          <TrajectoryPage session={session} onBack={() => setPage("chat")} />
        ) : page === "tools" ? (
          <div className="tools-empty">
            <LayoutGrid />
            <h2>{t("学生工具")}</h2>
            <p>{t("工具入口已预留，具体内容待确定。")}</p>
            <button className="text-button" onClick={() => setPage("chat")}>
              <ChevronLeft />
              {t("返回对话")}
            </button>
          </div>
        ) : (
          <div className="chat-layout">
            <div
              className={
                "conversation " + (!session?.messages.length ? "is-empty" : "")
              }
            >
              <div
                className="messages"
                ref={scroll}
                onScroll={() => {
                  const el = scroll.current;
                  if (el)
                    follow.current =
                      el.scrollHeight - el.scrollTop - el.clientHeight < 120;
                }}
              >
                {!session?.messages.length ? (
                  <div className="welcome">
                    <div className="welcome-heading">
                      <Brand />
                      <h2>{t("今天想做点什么")}</h2>
                    </div>
                  </div>
                ) : (
                  <div className="message-column">
                    {pref.workDetails === "detailed" &&
                    session.events?.length ? (
                      <details className="conversation-work">
                        <summary>
                          {t("工作详情 ·")}
                          {session.events.length}
                          {t("条事件")}
                        </summary>
                        {session.events.slice(-10).map((e, i) => (
                          <div key={i}>
                            <time>{new Date(e.time).toLocaleTimeString()}</time>
                            <span>{e.type}</span>
                          </div>
                        ))}
                        <button
                          className="text-button"
                          onClick={() => setPage("trajectory")}
                        >
                          {t("查看完整轨迹")}
                        </button>
                      </details>
                    ) : null}
                    {session.messages.map((message, i) => (
                      <article
                        key={message.id}
                        className={"message " + message.role}
                        aria-label={
                          message.role === "user"
                            ? t("你的问题")
                            : t("WinKu 回答")
                        }
                      >
                        {message.attachments?.length ? (
                          <div className="attachment-list">
                            {message.attachments.map((a, n) => (
                              <button
                                className="attachment"
                                key={n}
                                onClick={() => setReading(a)}
                              >
                                {a.kind === "image" ? <Image /> : <FileText />}
                                <span>{a.name}</span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {message.role === "user" ? (
                          <div className="user-text">
                            {message.text}
                            {message.pending && (
                              <small className="a-note">
                                {t("等待助手接收…")}
                              </small>
                            )}
                          </div>
                        ) : (
                          <Suspense fallback={<p>{t("正在显示回答…")}</p>}>
                            <Teaching
                              text={message.text}
                              session={session}
                              messageId={message.id}
                              dark={dark}
                              canAsk={!snapshot.busy}
                              ask={(text) => {
                                setDraft(text);
                                textarea.current?.focus();
                              }}
                            />
                          </Suspense>
                        )}
                        {message.error && (
                          <div className="answer-error" role="alert">
                            <strong>{t("回答未完成")}</strong>
                            <p>{message.error}</p>
                          </div>
                        )}
                        {message.interrupted && (
                          <p className="muted">{t("已停止生成")}</p>
                        )}
                        {message.role === "assistant" &&
                          !(
                            snapshot.busy &&
                            snapshot.activeSession === session.id &&
                            i === session.messages.length - 1
                          ) && (
                            <footer className="answer-actions">
                              <IconButton
                                label={t("复制回答")}
                                onClick={() => copy(message.id, message.text)}
                              >
                                {copied === message.id ? <Check /> : <Copy />}
                              </IconButton>
                              <span>{message.model}</span>
                              {i === session.messages.length - 1 && (
                                <IconButton
                                  label={t("重新生成")}
                                  disabled={snapshot.busy || submitting || !!session.queue?.length || !!snapshot.pendingQuestions.length}
                                  onClick={() => send("", true)}
                                >
                                  <RotateCw />
                                </IconButton>
                              )}
                            </footer>
                          )}
                        {message.role === "assistant" &&
                          snapshot.busy &&
                          snapshot.activeSession === session.id &&
                          i === session.messages.length - 1 &&
                          !message.text && (
                            <p className="generating" role="status">
                              <LoaderCircle className="spinner" />
                              {pref.workDetails === "compact"
                                ? t("正在回答…")
                                : activity || t("正在思考…")}
                            </p>
                          )}
                      </article>
                    ))}
                  </div>
                )}
              </div>
              <div
                className={"composer-zone " + (dragging ? "is-dragging" : "")}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node))
                    setDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  addFiles([...e.dataTransfer.files]);
                }}
              >
                {!!session?.queue?.length && (
                  <div className="queue-dock" aria-label={t("排队消息")}>
                    <div className="queue-heading">
                      <AIcon name="queue_outline" />
                      {t("排队消息 ·")}
                      {session.queue.length}
                    </div>
                    {session.queue.map((q) => (
                      <div className="queue-item" key={q.id}>
                        <span>
                          {q.text ||
                            q.attachments.map((a) => a.name).join("、")}
                        </span>
                        <AButton
                          label={t("编辑排队消息")}
                          icon="edit_outline"
                          onClick={async () => {
                            if (draft.trim() || files.length) {
                              setNotice(t("请先处理输入框里的草稿。"));
                              return;
                            }
                            try {
                              await request("queue.remove", {
                                sessionId,
                                id: q.id,
                              });
                              setDraft(q.text);
                              setFiles(q.attachments);
                              textarea.current?.focus();
                            } catch (e) {
                              setNotice(String(e));
                            }
                          }}
                        />
                        <AButton
                          label={t("删除排队消息")}
                          icon="trash_outline"
                          onClick={() =>
                            act("queue.remove", { sessionId, id: q.id })
                          }
                        />
                        <AButton
                          label={t("立即引导")}
                          icon="paper_plane_outline"
                          onClick={() =>
                            act("queue.send", {
                              sessionId,
                              id: q.id,
                              providerId: provider?.id,
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
                <form
                  className="composer"
                  onSubmit={(e) => {
                    e.preventDefault();
                    send();
                  }}
                >
                  {files.length > 0 && (
                    <div className="attachment-list">
                      {files.map((file, i) => (
                        <div className="draft-attachment" key={i}>
                          <button
                            onClick={() => setReading(file)}
                            type="button"
                          >
                            {file.kind === "image" ? <Image /> : <FileText />}
                            <span>{file.name}</span>
                          </button>
                          <IconButton
                            label={t("移除 ") + file.name}
                            onClick={() =>
                              setFiles((old) => old.filter((_, n) => n !== i))
                            }
                          >
                            <X />
                          </IconButton>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="sr-only" htmlFor="prompt">
                    {t("发送消息")}
                  </label>
                  <textarea
                    id="prompt"
                    ref={textarea}
                    value={draft}
                    rows={2}
                    placeholder={
                      dragging
                        ? t("松开以添加文件")
                        : t("描述你想让电脑做的事， / 调用指令")
                    }
                    onChange={(e) => editDraft(e.target.value)}
                    onPaste={(e) => {
                      const images = [...e.clipboardData.files].filter((f) =>
                        f.type.startsWith("image/"),
                      );
                      if (images.length) {
                        e.preventDefault();
                        addFiles(images);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        (pref.sendKey !== "ctrl-enter" || e.ctrlKey) &&
                        !e.nativeEvent.isComposing
                      ) {
                        e.preventDefault();
                        if (!attaching)
                          send(
                            draft,
                            false,
                            snapshot.busy &&
                              (e.altKey || pref.busySend === "steer"),
                          );
                      }
                    }}
                  />
                  <div className="composer-toolbar">
                    <input
                      ref={picker}
                      type="file"
                      multiple
                      hidden
                      accept=".pdf,.txt,.md,.csv,.json,.js,.jsx,.ts,.tsx,.py,.java,.kt,.kts,.c,.cpp,.h,.hpp,.rs,.go,.html,.css,.yml,.yaml,.xml,.log,image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        addFiles([...(e.target.files ?? [])]);
                        e.target.value = "";
                      }}
                    />
                    <AButton
                      label={t("添加图片、PDF 或代码")}
                      icon="plus_outline"
                      disabled={attaching || files.length >= 4}
                      onClick={() => picker.current?.click()}
                    />
                    <Menu
                      label={t("权限模式")}
                      className={
                        "permission-chip " + (pref.access ?? "read-only")
                      }
                      trigger={
                        <>
                          <AIcon name="shield_outline" size={19} />
                          <AIcon name="chevron_down_outline" size={10} />
                        </>
                      }
                    >
                      {["read-only", "ask", "full"].map((value) => (
                        <MenuItem
                          key={value}
                          selected={(pref.access ?? "read-only") === value}
                          onClick={() =>
                            value === "full" && pref.access !== "full"
                              ? setFullConfirm(true)
                              : act("preferences.save", { access: value })
                          }
                        >
                          {
                            (
                              {
                                "read-only": t("只读"),
                                ask: t("询问"),
                                full: t("完全访问"),
                              } as any
                            )[value]
                          }
                        </MenuItem>
                      ))}
                      <MenuItem onClick={() => setPage("permissions")}>
                        {t("权限与无障碍")}
                      </MenuItem>
                    </Menu>
                    <Menu
                      label={t("会话模式")}
                      className="mode-chip"
                      trigger={
                        <>
                          <AIcon name="sparkle" size={20} />
                          <AIcon name="chevron_down_outline" size={10} />
                        </>
                      }
                    >
                      {(snapshot.modes ?? []).map((m) => (
                        <MenuItem
                          key={m.id}
                          selected={m.id === (session?.mode?.id ?? pref.modeId)}
                          onClick={() =>
                            session?.mode
                              ? setNotice(
                                  t(
                                    "会话开始后模式固定；新建会话可选择其他模式。",
                                  ),
                                )
                              : act("preferences.save", { modeId: m.id })
                          }
                          description={m.prompt.slice(0, 70)}
                        >
                          {m.builtin ? t(m.name) : m.name}
                        </MenuItem>
                      ))}
                      <MenuItem
                        onClick={() => {
                          setSettingsSection("modes");
                          setPage("settings");
                        }}
                      >
                        {t("管理模式")}
                      </MenuItem>
                    </Menu>
                    <button
                      className={
                        "polish-button " + (polishing ? "polishing" : "")
                      }
                      type="button"
                      aria-label={polishing ? t("取消润色") : t("润色提示词")}
                      title={polishing ? t("取消润色") : t("润色提示词")}
                      disabled={!draft.trim() && !polishing}
                      onClick={polishDraft}
                    >
                      {polishing ? (
                        <LoaderCircle className="spinner" />
                      ) : (
                        <WandIcon />
                      )}
                    </button>
                    <Menu
                      label={t("选择模型")}
                      className="composer-model"
                      trigger={
                        <>
                          <span>{provider?.model || t("选择模型")}</span>
                          <AIcon name="chevron_down_outline" size={12} />
                        </>
                      }
                    >
                      {snapshot.providers
                        .filter((p) => p.enabled !== false)
                        .flatMap((p) =>
                          (p.models ?? [p.model]).map((model) => (
                            <MenuItem
                              key={p.id + model}
                              selected={
                                provider?.id === p.id &&
                                provider.model === model
                              }
                              description={p.name}
                              onClick={() => {
                                cancelPolish();
                                act("provider.select", { id: p.id, model });
                              }}
                            >
                              {model}
                            </MenuItem>
                          )),
                        )}
                      <MenuItem icon="data_outline" onClick={modelSettings}>
                        {t("管理模型服务")}
                      </MenuItem>
                    </Menu>
                    {!!provider?.efforts?.length && (
                      <Menu
                        label={t("思考强度")}
                        className="effort-chip"
                        trigger={
                          <>
                            <span>
                              {pref.effort && pref.effort !== "auto"
                                ? pref.effort.charAt(0).toUpperCase() +
                                  pref.effort.slice(1)
                                : t("自动")}
                            </span>
                            <AIcon name="chevron_down_outline" size={11} />
                          </>
                        }
                      >
                        {["auto", ...provider.efforts].map((effort) => (
                          <MenuItem
                            key={effort}
                            selected={(pref.effort ?? "auto") === effort}
                            onClick={() => act("preferences.save", { effort })}
                          >
                            {effort === "auto"
                              ? t("自动")
                              : effort.charAt(0).toUpperCase() +
                                effort.slice(1)}
                          </MenuItem>
                        ))}
                      </Menu>
                    )}
                    <span className="composer-spacer" />
                    <AButton
                      label={t("语音输入")}
                      icon="microphone_outline"
                      onClick={() => {
                        textarea.current?.focus();
                        request("windows.voice").catch((e) =>
                          setNotice(String(e)),
                        );
                      }}
                    />
                    {snapshot.busy && (draft.trim() || files.length > 0) && (
                      <Menu
                        label={t("生成中发送")}
                        trigger={<AIcon name="queue_outline" size={20} />}
                      >
                        <MenuItem onClick={() => send()}>
                          {t("排队发送")}
                        </MenuItem>
                        <MenuItem onClick={() => send(draft, false, true)}>
                          {t("立即引导")}
                        </MenuItem>
                      </Menu>
                    )}
                    {snapshot.busy ? (
                      <button
                        className="send-button stop"
                        type="button"
                        aria-label={t("停止生成")}
                        onClick={() =>
                          request("stop").catch((e) => setNotice(String(e)))
                        }
                      >
                        <Square fill="currentColor" size={16} />
                      </button>
                    ) : (
                      <button
                        className="send-button"
                        type="submit"
                        aria-label={t("发送消息")}
                        disabled={
                          submitting ||
                          attaching ||
                          (!draft.trim() && !files.length)
                        }
                      >
                        {submitting ? (
                          <LoaderCircle className="spinner" />
                        ) : (
                          <ArrowUp />
                        )}
                      </button>
                    )}
                  </div>
                </form>
                {undo && draft === undo.after && (
                  <div className="polish-undo">
                    {t("已润色")}
                    <button
                      onClick={() => {
                        editDraft(undo.before);
                        textarea.current?.focus();
                      }}
                    >
                      {t("撤销")}
                    </button>
                  </div>
                )}
                <div className="composer-note">
                  {t("回答由所选模型生成，请核对关键知识与计算。")}
                </div>
              </div>
            </div>
            {reading && (
              <aside className="reader" aria-label={t("附件阅读面板")}>
                <header>
                  <FileText />
                  <h2>{reading.name}</h2>
                  <IconButton
                    label={t("关闭阅读面板")}
                    onClick={() => setReading(null)}
                  >
                    <X />
                  </IconButton>
                </header>
                {reading.kind === "image" ? (
                  <img
                    alt={reading.name}
                    src={"data:" + reading.mimeType + ";base64," + reading.data}
                  />
                ) : (
                  <pre>{reading.text}</pre>
                )}
              </aside>
            )}
          </div>
        )}
        {fullConfirm && (
          <RiskDialog
            onClose={() => setFullConfirm(false)}
            onConfirm={() => {
              act("preferences.save", { access: "full", confirmFull: true });
              setFullConfirm(false);
            }}
          />
        )}
        {deleting && (
          <Dialog title={t("删除本地会话？")} onClose={() => setDeleting(null)}>
            <p>{t("删除后无法恢复。")}</p>
            <div className="a-dialog-actions">
              <button onClick={() => setDeleting(null)}>{t("取消")}</button>
              <button
                className="danger"
                onClick={() => deleteSession(deleting)}
              >
                {t("删除")}
              </button>
            </div>
          </Dialog>
        )}
        {rename && (
          <Dialog title={t("重命名会话")} onClose={() => setRename(null)}>
            <input
              aria-label={t("会话名称")}
              maxLength={100}
              value={rename.title}
              onChange={(e) => setRename({ ...rename, title: e.target.value })}
            />
            <div className="a-dialog-actions">
              <button onClick={() => setRename(null)}>{t("取消")}</button>
              <button
                onClick={() =>
                  request("session.update", rename)
                    .then(() => setRename(null))
                    .catch((e) => setNotice(String(e)))
                }
              >
                {t("保存")}
              </button>
            </div>
          </Dialog>
        )}
        {snapshot.pendingQuestions.map((q) => (
          <section
            className="request-panel"
            key={q.token}
            aria-label={t("引擎请求")}
          >
            <h2>
              {q.method === "approval/request"
                ? t("工具请求授权")
                : t("WinKu 需要你的回答")}
            </h2>
            {q.method === "approval/request" ? (
              <>
                <p>
                  {q.params.toolName}：
                  {q.params.reason || t("此操作需要授权。")}
                </p>
                <button
                  className="primary-button"
                  onClick={() =>
                    request("question.answer", {
                      token: q.token,
                      result: { outcome: "allowed-once" },
                    })
                  }
                >
                  {t("允许这一次")}
                </button>
                <button
                  className="text-button"
                  onClick={() =>
                    request("question.answer", {
                      token: q.token,
                      result: { outcome: "rejected" },
                    })
                  }
                >
                  {t("拒绝")}
                </button>
              </>
            ) : (
              <>
                <p>
                  {t(
                    "模型提出了补充问题。请停止本次生成后，在对话中补充说明。",
                  )}
                </p>
                <button className="text-button" onClick={() => request("stop")}>
                  {t("停止并补充")}
                </button>
              </>
            )}
          </section>
        ))}
        {notice && (
          <div className="toast" role="status">
            <span>{t(notice)}</span>
            <IconButton label={t("关闭提示")} onClick={() => setNotice("")}>
              <X />
            </IconButton>
          </div>
        )}
      </main>
    </div>
  );
}
function MoreIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}
function WandIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="m5 19 13-13M4 5h6M7 2v6m9 10h5m-2.5-2.5v5M14 10l3 3" />
    </svg>
  );
}
function relativeTime(value: number) {
  const min = Math.max(0, Math.floor((Date.now() - value) / 60000));
  return min < 1
    ? t("刚刚")
    : min < 60
      ? min + t("分钟")
      : min < 1440
        ? Math.floor(min / 60) + t("小时")
        : Math.floor(min / 1440) + t("天");
}
createRoot(document.getElementById("root")!).render(<App />);
