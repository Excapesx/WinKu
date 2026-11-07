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
    [page, setPage] = useState<"chat" | "settings" | "tools">("chat");
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
      setPage("settings");
      return;
    }
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
        </div>
        <button className="new-chat" onClick={newChat}>
          <MessageCirclePlus />
          新会话
        </button>
        <button
          className={"nav-row " + (page === "tools" ? "selected" : "")}
          onClick={() => setPage("tools")}
        >
          <LayoutGrid />
          工具
        </button>
        <div className="history-label">
          <span>会话</span>
          <Search size={16} />
        </div>
        <label className="search-box">
          <span className="sr-only">搜索会话</span>
          <input
            placeholder="搜索会话"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <nav className="history" aria-label="历史会话">
          {snapshot.sessions
            .filter((s) => s.title.toLowerCase().includes(query.toLowerCase()))
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
                  onClick={() => {
                    setSessionId(s.id);
                    setPage("chat");
                    setReading(null);
                    follow.current = true;
                  }}
                >
                  <span>{s.title}</span>
                  {snapshot.activeSession === s.id && snapshot.busy && (
                    <LoaderCircle className="spinner" size={14} />
                  )}
                </button>
                <IconButton
                  label={"删除会话：" + s.title}
                  onClick={() => setDeleting(deleting === s.id ? null : s.id)}
                >
                  <Trash2 />
                </IconButton>
                {deleting === s.id && (
                  <div className="delete-confirm">
                    <span>删除本地会话？</span>
                    <button onClick={() => deleteSession(s.id)}>删除</button>
                    <button onClick={() => setDeleting(null)}>取消</button>
                  </div>
                )}
              </div>
            ))}
          {!snapshot.sessions.length && (
            <p className="history-empty">开始对话后，会保存在这里。</p>
          )}
          {snapshot.sessions.length > 0 &&
            !snapshot.sessions.some((s) =>
              s.title.toLowerCase().includes(query.toLowerCase()),
            ) && <p className="history-empty">没有找到相关会话</p>}
        </nav>
        <div className="sidebar-bottom">
          <button
            className={"nav-row " + (page === "settings" ? "selected" : "")}
            onClick={() => setPage("settings")}
          >
            <Settings />
            设置<span>v1.0</span>
          </button>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <IconButton
            label={collapsed ? "展开侧栏" : "收起侧栏"}
            onClick={() => setCollapsed(!collapsed)}
          >
            <PanelLeft />
          </IconButton>
          <h1>
            {page === "settings"
              ? "设置"
              : page === "tools"
                ? "工具"
                : session?.title || "新会话"}
          </h1>
          <div className="topbar-actions">
            {provider && page === "chat" && (
              <button
                className="model-shortcut"
                onClick={() => setPage("settings")}
              >
                {provider.model}
              </button>
            )}
            <IconButton
              label={dark ? "切换浅色模式" : "切换深色模式"}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun /> : <Moon />}
            </IconButton>
            <IconButton label="新会话" onClick={newChat}>
              <MessageCirclePlus />
            </IconButton>
          </div>
        </header>
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
          <SettingsPage
            snapshot={snapshot}
            onSaved={() => setNotice("模型配置已保存")}
            onError={setNotice}
            onChat={() => setPage("chat")}
          />
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
                    {!provider ? (
                      <div className="setup-note">
                        <p>先连接你自己的模型，就可以开始学习。</p>
                        <button
                          className="primary-button"
                          onClick={() => setPage("settings")}
                        >
                          配置模型
                          <ArrowRight />
                        </button>
                        <small>
                          支持 OpenAI 兼容、Responses 和 Anthropic 协议
                        </small>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="message-column">
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
                              {activity || "正在思考…"}
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
                      dragging ? "松开以添加文件" : "发消息或创建任务"
                    }
                    onChange={(e) => setDraft(e.target.value)}
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
                    <IconButton
                      label="添加图片、PDF 或代码"
                      disabled={attaching || files.length >= 4}
                      onClick={() => picker.current?.click()}
                    >
                      {attaching ? (
                        <LoaderCircle className="spinner" />
                      ) : (
                        <Plus />
                      )}
                    </IconButton>
                    <button
                      className="composer-model"
                      type="button"
                      onClick={() => setPage("settings")}
                    >
                      <span>{provider?.model || "选择模型"}</span>
                      <ChevronDown size={14} />
                    </button>
                    <span className="input-hint">
                      Enter 发送 / Shift Enter 换行
                    </span>
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
function SettingsPage({
  snapshot,
  onSaved,
  onError,
  onChat,
}: {
  snapshot: Snapshot;
  onSaved: () => void;
  onError: (e: string) => void;
  onChat: () => void;
}) {
  const blank = {
      id: "",
      name: "",
      model: "",
      baseURL: "",
      protocol: "openai-chat-completions",
    },
    [form, setForm] = useState<Provider>(blank),
    [key, setKey] = useState(""),
    [saving, setSaving] = useState(false);
  const edit = (p: Provider) => {
    setForm(p);
    setKey("");
  };
  const field =
    (name: keyof Provider) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((old) => ({ ...old, [name]: e.target.value }));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (!form.id && !key.trim()) throw Error("请填写 API Key。");
      const id = form.id || "provider-" + crypto.randomUUID();
      await request("provider.save", { ...form, id, apiKey: key.trim() });
      setForm({ ...form, id });
      setKey("");
      onSaved();
    } catch (e) {
      onError(String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="settings-page">
      <div className="settings-heading">
        <div>
          <h2>连接你的模型</h2>
          <p>使用自己的 API Key，费用与额度由服务商管理。</p>
        </div>
        <button className="text-button" onClick={onChat}>
          返回对话
          <ArrowRight />
        </button>
      </div>
      <div className="provider-list">
        {snapshot.providers.map((p) => (
          <div className="provider-row" key={p.id}>
            <div>
              <strong>{p.name}</strong>
              <span>{p.model}</span>
            </div>
            <button
              className={
                snapshot.selectedProvider === p.id
                  ? "text-button active-provider"
                  : "text-button"
              }
              disabled={snapshot.busy || snapshot.selectedProvider === p.id}
              onClick={() =>
                request("provider.select", { id: p.id }).catch((e) =>
                  onError(String(e)),
                )
              }
            >
              {snapshot.selectedProvider === p.id ? (
                <>
                  <Check />
                  使用中
                </>
              ) : (
                "使用此模型"
              )}
            </button>
            <button className="text-button" onClick={() => edit(p)}>
              编辑
            </button>
          </div>
        ))}
        {snapshot.providers.length > 0 && (
          <button
            className="text-button"
            onClick={() => {
              setForm(blank);
              setKey("");
            }}
          >
            <Plus />
            添加另一个模型
          </button>
        )}
      </div>
      <form className="provider-form" onSubmit={save}>
        <h3>{form.id ? "编辑模型" : "添加模型"}</h3>
        <label>
          服务商名称
          <input
            required
            maxLength={80}
            placeholder="例如：我的模型服务"
            value={form.name}
            onChange={field("name")}
          />
        </label>
        <label>
          接口协议
          <select value={form.protocol} onChange={field("protocol")}>
            <option value="openai-chat-completions">
              OpenAI 兼容 · Chat Completions
            </option>
            <option value="openai-responses">OpenAI · Responses</option>
            <option value="anthropic-messages">Anthropic · Messages</option>
          </select>
        </label>
        <label>
          API 地址
          <input
            required
            type="url"
            spellCheck={false}
            placeholder="https://api.example.com/v1"
            value={form.baseURL}
            onChange={field("baseURL")}
          />
          <small>填写服务商给出的基础地址，不包含 /chat/completions。</small>
        </label>
        <label>
          模型 ID
          <input
            required
            maxLength={160}
            spellCheck={false}
            placeholder="填写服务商支持的完整模型 ID"
            value={form.model}
            onChange={field("model")}
          />
        </label>
        <label>
          API Key
          <input
            type="password"
            autoComplete="off"
            placeholder={form.id ? "留空保留已保存的 Key" : "填写 API Key"}
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <small>保存在 Windows 凭据管理器中。会话文件不会记录 Key。</small>
        </label>
        <label className="vision-option">
          <input
            type="checkbox"
            checked={Boolean(form.vision)}
            onChange={(e) =>
              setForm((old) => ({ ...old, vision: e.target.checked }))
            }
          />
          <span>
            这个模型支持图片理解
            <small>仅在服务商确认支持视觉输入时开启。</small>
          </span>
        </label>
        <div className="form-actions">
          <button
            className="primary-button"
            disabled={saving || snapshot.busy}
            type="submit"
          >
            {saving ? "正在保存…" : "保存并使用"}
          </button>
        </div>
      </form>
      <div className="settings-footnote">
        <h3>关于 WinKu</h3>
        <p>Windows v1.0 · 基于开源 dsh 内核</p>
        <p>
          会话保存在当前电脑。图片需要支持视觉的模型；PDF
          首版提取文字，扫描件请发送截图。
        </p>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
