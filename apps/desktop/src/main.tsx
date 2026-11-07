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
  const permissionLabel = (
    { "read-only": "只读", ask: "询问", full: "完全访问" } as Record<
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
    editDraft("帮我创建一个自动化任务：");
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
  async function send(text = draft, regenerate = false) {
    if (submitting || snapshot.busy) return;
    if (!provider) {
      modelSettings();
      return;
    }
    cancelPolish();
    setUndo(null);
    setSubmitting(true);
    follow.current = true;
    setActivity("正在连接模型…");
    try {
      const result = await request<{ sessionId: string }>(
        regenerate ? "regenerate" : "send",
        {
          sessionId,
          providerId: provider.id,
          text,
          attachments: regenerate ? [] : files,
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
      setNotice("每次最多添加 4 个附件。");
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
      setNotice("复制失败，请选中文字手动复制。");
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
      <aside className="sidebar" aria-label="主导航">
        <div className="brand">
          <Brand />
          <span>WinKu</span>
          <span className="platform">AGENT</span>
          <AButton
            label="收起侧栏"
            icon="panel_left_outline"
            onClick={() => setCollapsed(true)}
          />
        </div>
        <button className="new-chat" onClick={newChat}>
          <AIcon name="new_chat_outline" size={20} />
          新会话
        </button>
        <div className="sidebar-links">
          <button
            className={"nav-row " + (page === "tools" ? "selected" : "")}
            onClick={() => setPage("tools")}
          >
            <AIcon name="apps_add_outline" size={20} />
            工具
          </button>
          <button
            className={"nav-row " + (page === "automation" ? "selected" : "")}
            onClick={() => {
              setNavEpoch((n) => n + 1);
              setPage("automation");
            }}
          >
            <AIcon name="clock_outline" size={20} />
            自动化任务
          </button>
          <button
            className={"nav-row " + (page === "permissions" ? "selected" : "")}
            onClick={() => {
              setNavEpoch((n) => n + 1);
              setPage("permissions");
            }}
          >
            <AIcon name="shield_outline" size={20} />
            权限与无障碍
          </button>
        </div>
        <div className="history-label">
          <span>会话</span>
          <AButton
            label="搜索会话"
            icon="search_outline"
            onClick={() => setShowSearch(!showSearch)}
          />
          <Menu
            label="筛选会话"
            trigger={<AIcon name="sliders_two_outline" size={18} />}
          >
            <MenuItem
              selected={historyFilter === "active"}
              onClick={() => setHistoryFilter("active")}
            >
              全部会话
            </MenuItem>
            <MenuItem
              selected={historyFilter === "pinned"}
              onClick={() => setHistoryFilter("pinned")}
            >
              已置顶
            </MenuItem>
            <MenuItem
              selected={historyFilter === "archived"}
              onClick={() => setHistoryFilter("archived")}
            >
              已归档
            </MenuItem>
          </Menu>
        </div>
        {showSearch && (
          <label className="search-box">
            <span className="sr-only">搜索会话</span>
            <input
              autoFocus
              placeholder="搜索会话"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        )}
        <nav className="history" aria-label="历史会话">
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
                <Menu label={"会话菜单：" + s.title} trigger={<MoreIcon />}>
                  <MenuItem
                    onClick={() => setRename({ id: s.id, title: s.title })}
                  >
                    重命名
                  </MenuItem>
                  <MenuItem
                    onClick={() =>
                      act("session.update", { id: s.id, pinned: !s.pinned })
                    }
                  >
                    {s.pinned ? "取消置顶" : "置顶"}
                  </MenuItem>
                  <MenuItem
                    onClick={() =>
                      act("session.update", { id: s.id, archived: !s.archived })
                    }
                  >
                    {s.archived ? "取消归档" : "归档"}
                  </MenuItem>
                  <MenuItem onClick={() => setDeleting(s.id)}>删除</MenuItem>
                </Menu>
              </div>
            ))}
          {!snapshot.sessions.length && (
            <p className="history-empty">开始对话后，会保存在这里。</p>
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
            设置
          </button>
        </div>
      </aside>
      <main className="workspace">
        {(page === "chat" || page === "tools") && (
          <header className="topbar">
            <AButton
              label={collapsed ? "展开侧栏" : "收起侧栏"}
              icon="panel_left_outline"
              onClick={() => setCollapsed(!collapsed)}
            />
            <h1>{page === "tools" ? "工具" : (session?.title ?? "")}</h1>
            <div className="topbar-actions">
              {page === "chat" && session && (
                <AButton
                  label="轨迹"
                  icon="inspect_outline"
                  onClick={() => setPage("trajectory")}
                />
              )}
              <AButton
                label="新会话"
                icon="new_chat_outline"
                onClick={newChat}
              />
            </div>
          </header>
        )}
        {fatal ? (
          <div className="startup-error">
            <h2>暂时无法连接桌面引擎</h2>
            <p>{fatal}</p>
            <button
              className="primary-button"
              onClick={() => location.reload()}
            >
              重新连接
            </button>
          </div>
        ) : !ready ? (
          <div className="center-state" role="status">
            <LoaderCircle className="spinner" />
            正在打开 WinKu…
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
            <h2>学生工具</h2>
            <p>工具入口已预留，具体内容待确定。</p>
            <button className="text-button" onClick={() => setPage("chat")}>
              <ChevronLeft />
              返回对话
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
                      <h2>今天想做点什么</h2>
                    </div>
                  </div>
                ) : (
                  <div className="message-column">
                    {pref.workDetails === "detailed" &&
                    session.events?.length ? (
                      <details className="conversation-work">
                        <summary>
                          工作详情 · {session.events.length} 条事件
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
                          查看完整轨迹
                        </button>
                      </details>
                    ) : null}
                    {session.messages.map((message, i) => (
                      <article
                        key={message.id}
                        className={"message " + message.role}
                        aria-label={
                          message.role === "user" ? "你的问题" : "WinKu 回答"
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
                          <div className="user-text">{message.text}</div>
                        ) : (
                          <Suspense fallback={<p>正在显示回答…</p>}>
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
                            <strong>回答未完成</strong>
                            <p>{message.error}</p>
                          </div>
                        )}
                        {message.interrupted && (
                          <p className="muted">已停止生成</p>
                        )}
                        {message.role === "assistant" &&
                          !(
                            snapshot.busy &&
                            snapshot.activeSession === session.id &&
                            i === session.messages.length - 1
                          ) && (
                            <footer className="answer-actions">
                              <IconButton
                                label="复制回答"
                                onClick={() => copy(message.id, message.text)}
                              >
                                {copied === message.id ? <Check /> : <Copy />}
                              </IconButton>
                              <span>{message.model}</span>
                              {i === session.messages.length - 1 && (
                                <IconButton
                                  label="重新生成"
                                  disabled={snapshot.busy || submitting}
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
                                ? "正在回答…"
                                : activity || "正在思考…"}
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
                            label={"移除 " + file.name}
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
                    发送消息
                  </label>
                  <textarea
                    id="prompt"
                    ref={textarea}
                    value={draft}
                    rows={2}
                    placeholder={
                      dragging
                        ? "松开以添加文件"
                        : "描述你想让电脑做的事， / 调用指令"
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
                        if (!snapshot.busy && !attaching) send();
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
                      label="添加图片、PDF 或代码"
                      icon="plus_outline"
                      disabled={attaching || files.length >= 4}
                      onClick={() => picker.current?.click()}
                    />
                    <Menu
                      label="权限模式"
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
                                "read-only": "只读",
                                ask: "询问",
                                full: "完全访问",
                              } as any
                            )[value]
                          }
                        </MenuItem>
                      ))}
                      <MenuItem onClick={() => setPage("permissions")}>
                        权限与无障碍
                      </MenuItem>
                    </Menu>
                    <Menu
                      label="会话模式"
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
                          selected={m.id === pref.modeId}
                          onClick={() =>
                            act("preferences.save", { modeId: m.id })
                          }
                          description={m.prompt.slice(0, 70)}
                        >
                          {m.name}
                        </MenuItem>
                      ))}
                      <MenuItem
                        onClick={() => {
                          setSettingsSection("modes");
                          setPage("settings");
                        }}
                      >
                        管理模式
                      </MenuItem>
                    </Menu>
                    <button
                      className={
                        "polish-button " + (polishing ? "polishing" : "")
                      }
                      type="button"
                      aria-label={polishing ? "取消润色" : "润色提示词"}
                      title={polishing ? "取消润色" : "润色提示词"}
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
                      label="选择模型"
                      className="composer-model"
                      trigger={
                        <>
                          <span>{provider?.model || "选择模型"}</span>
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
                        管理模型服务
                      </MenuItem>
                    </Menu>
                    {!!provider?.efforts?.length && (
                      <Menu
                        label="思考强度"
                        className="effort-chip"
                        trigger={
                          <>
                            <span>
                              {pref.effort && pref.effort !== "auto"
                                ? pref.effort.charAt(0).toUpperCase() +
                                  pref.effort.slice(1)
                                : "自动"}
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
                              ? "自动"
                              : effort.charAt(0).toUpperCase() +
                                effort.slice(1)}
                          </MenuItem>
                        ))}
                      </Menu>
                    )}
                    <span className="composer-spacer" />
                    <AButton
                      label="语音输入"
                      icon="microphone_outline"
                      onClick={() => {
                        textarea.current?.focus();
                        request("windows.voice").catch((e) =>
                          setNotice(String(e)),
                        );
                      }}
                    />
                    {snapshot.busy ? (
                      <button
                        className="send-button stop"
                        type="button"
                        aria-label="停止生成"
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
                        aria-label="发送消息"
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
                    已润色
                    <button
                      onClick={() => {
                        editDraft(undo.before);
                        textarea.current?.focus();
                      }}
                    >
                      撤销
                    </button>
                  </div>
                )}
                <div className="composer-note">
                  回答由所选模型生成，请核对关键知识与计算。
                </div>
              </div>
            </div>
            {reading && (
              <aside className="reader" aria-label="附件阅读面板">
                <header>
                  <FileText />
                  <h2>{reading.name}</h2>
                  <IconButton
                    label="关闭阅读面板"
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
          <Dialog title="删除本地会话？" onClose={() => setDeleting(null)}>
            <p>删除后无法恢复。</p>
            <div className="a-dialog-actions">
              <button onClick={() => setDeleting(null)}>取消</button>
              <button
                className="danger"
                onClick={() => deleteSession(deleting)}
              >
                删除
              </button>
            </div>
          </Dialog>
        )}
        {rename && (
          <Dialog title="重命名会话" onClose={() => setRename(null)}>
            <input
              aria-label="会话名称"
              maxLength={100}
              value={rename.title}
              onChange={(e) => setRename({ ...rename, title: e.target.value })}
            />
            <div className="a-dialog-actions">
              <button onClick={() => setRename(null)}>取消</button>
              <button
                onClick={() =>
                  request("session.update", rename)
                    .then(() => setRename(null))
                    .catch((e) => setNotice(String(e)))
                }
              >
                保存
              </button>
            </div>
          </Dialog>
        )}
        {snapshot.pendingQuestions.map((q) => (
          <section
            className="request-panel"
            key={q.token}
            aria-label="引擎请求"
          >
            <h2>
              {q.method === "approval/request"
                ? "工具请求授权"
                : "WinKu 需要你的回答"}
            </h2>
            {q.method === "approval/request" ? (
              <>
                <p>
                  {q.params.toolName}：{q.params.reason || "此操作需要授权。"}
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
                  允许这一次
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
                  拒绝
                </button>
              </>
            ) : (
              <>
                <p>模型提出了补充问题。请停止本次生成后，在对话中补充说明。</p>
                <button className="text-button" onClick={() => request("stop")}>
                  停止并补充
                </button>
              </>
            )}
          </section>
        ))}
        {notice && (
          <div className="toast" role="status">
            <span>{notice}</span>
            <IconButton label="关闭提示" onClick={() => setNotice("")}>
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
    ? "刚刚"
    : min < 60
      ? min + "分钟"
      : min < 1440
        ? Math.floor(min / 60) + "小时"
        : Math.floor(min / 1440) + "天";
}
createRoot(document.getElementById("root")!).render(<App />);
