import { t } from "./i18n";
import { ExtensionsPage } from "./ExtensionsPage";
import React, { useEffect, useState, lazy, Suspense } from "react";
import {
  AIcon,
  AButton,
  Card,
  Row,
  Page,
  Segmented,
  Switch,
  Dialog,
  RiskDialog,
  type IconName,
} from "./MobileUI";
import {
  request,
  openExternal,
  type Snapshot,
  type Provider,
  type Session,
} from "./api";
import { androidPresets } from "./android-presets";
import { examples } from "../../android/learning-ui/src/examples";
const Teaching = lazy(() =>
  import("./Teaching").then((x) => ({ default: x.Teaching })),
);
const sections = (): { id: string; title: string; icon: IconName }[] => [
  { id: "general", title: t("通用"), icon: "settings_outline" },
  { id: "model", title: t("模型服务"), icon: "data_outline" },
  { id: "agent", title: t("能力"), icon: "apps_add_outline" },
  { id: "extensions", title: t("扩展"), icon: "cordis_plugin_outline" },
  { id: "modes", title: t("会话模式"), icon: "agent_preset_outline" },
  { id: "usage", title: t("用量"), icon: "gauge_outline" },
  { id: "phone", title: t("电脑权限"), icon: "shield_outline" },
  { id: "about", title: t("关于"), icon: "info_outline" },
];
const tools = () =>
  [
    ["files", t("文件"), t("读取文件与图片；写入需要询问或完全访问。")],
    ["web", t("浏览器"), t("读取网页内容。")],
    ["screen", t("读屏"), t("读取窗口无障碍树与屏幕截图。")],
    ["input", t("电脑操作"), t("点击、键盘输入与打开系统设置。")],
    ["shell", "PowerShell", t("执行命令，需要询问或完全访问。")],
    ["notifications", t("通知"), t("发送桌面气泡通知。")],
  ] as const;
type Props = {
  snapshot: Snapshot;
  onBack: () => void;
  onError: (text: string) => void;
  onOpenSession: (id: string) => void;
  initialSection?: string;
  dark: boolean;
};
export function SettingsHub({
  snapshot: s,
  onBack,
  onError,
  onOpenSession,
  initialSection = "index",
  dark,
}: Props) {
  const [path, setPath] = useState<string[]>(
    initialSection === "index" ? [] : [initialSection],
  );
  const [confirmFull, setConfirmFull] = useState(false);
  const current = path.at(-1) ?? "index",
    pref = s.preferences ?? {},
    [modal, setModal] = useState<React.ReactNode>(null);
  const go = (id: string) => setPath((p) => [...p, id]);
  const back = () => {
    if (!path.length || (initialSection !== "index" && path.length === 1))
      onBack();
    else setPath((p) => p.slice(0, -1));
  };
  const save = async (method: string, params: any) => {
    try {
      await request(method, params);
    } catch (e) {
      onError(String((e as Error).message ?? e));
    }
  };
  const preferences = (p: any) => save("preferences.save", p);
  const access = (value: string) =>
    value === "full" && pref.access !== "full"
      ? setConfirmFull(true)
      : preferences({ access: value });
  let content: React.ReactNode,
    title = sections().find((x) => x.id === current)?.title ?? t("设置");
  if (current === "index")
    content = (
      <>
        <Card>
          <Row title={t("交互学习")} onClick={() => go("learning")} />
        </Card>
        <Card>
          {sections().map((item) => (
            <Row
              key={item.id}
              title={item.title}
              icon={item.icon}
              onClick={() => go(item.id)}
            />
          ))}
        </Card>
      </>
    );
  if (current === "general")
    content = (
      <>
        <Card>
          <Row
            title={t("默认权限")}
            description={t("选择模型执行电脑工具时的访问方式。")}
          >
            <Segmented
              values={[
                { id: "read-only", label: t("只读") },
                { id: "ask", label: t("询问") },
                { id: "full", label: t("完全访问") },
              ]}
              value={pref.access ?? "read-only"}
              onChange={access}
            />
          </Row>
          <Row title={t("外观")}>
            <Segmented
              values={[
                { id: "light", label: t("浅色") },
                { id: "dark", label: t("深色") },
                { id: "system", label: t("跟随系统") },
              ]}
              value={pref.theme ?? "system"}
              onChange={(theme) => preferences({ theme })}
            />
          </Row>
          <Row title={t("语言")}>
            <Segmented
              values={[
                { id: "system", label: t("跟随系统") },
                { id: "zh", label: t("简体中文") },
                { id: "en", label: "English" },
              ]}
              value={pref.language ?? "system"}
              onChange={(language) => preferences({ language })}
            />
          </Row>
          <Row title={t("生成中发送")}>
            <Segmented
              values={[
                { id: "queue", label: t("排队发送") },
                { id: "steer", label: t("立即引导") },
              ]}
              value={pref.busySend ?? "queue"}
              onChange={(busySend) => preferences({ busySend })}
            />
          </Row>
          <Row
            title={t("工作详情")}
            description={t("控制对话中过程信息的展开程度。")}
          >
            <Segmented
              values={[
                { id: "compact", label: t("简洁") },
                { id: "standard", label: t("标准") },
                { id: "detailed", label: t("详细") },
              ]}
              value={pref.workDetails ?? "standard"}
              onChange={(workDetails) => preferences({ workDetails })}
            />
          </Row>
          <Row title={t("发送方式")}>
            <Segmented
              values={[
                { id: "enter", label: t("Enter 发送") },
                { id: "ctrl-enter", label: t("Ctrl + Enter 发送") },
              ]}
              value={pref.sendKey ?? "enter"}
              onChange={(sendKey) => preferences({ sendKey })}
            />
          </Row>
          <Row
            title={t("任务通知")}
            description={t("自动化任务完成后显示桌面通知。")}
            trailing={
              <Switch
                label={t("任务通知")}
                checked={pref.notifications !== false}
                onChange={(notifications) => preferences({ notifications })}
              />
            }
          />
        </Card>
        <p className="a-note">
          {t(
            "Windows 使用自己的输入法与系统语音服务；手机悬浮球、默认助手手势由手机端提供。",
          )}
        </p>
      </>
    );
  if (current === "model")
    content = (
      <>
        <p className="a-note">
          {t("配置你自己的模型服务，Key 保存在 Windows 凭据管理器中。")}
        </p>
        <Card>
          {s.providers.length ? (
            s.providers.map((p) => (
              <Row
                key={p.id}
                title={p.name}
                description={(p.models ?? [p.model]).join("、")}
                icon="data_outline"
                onClick={() => go("provider:" + p.id)}
              />
            ))
          ) : (
            <Row
              title={t("还没有模型服务")}
              description={t("添加一个服务商后即可开始对话。")}
            />
          )}
        </Card>
        <button className="a-outline-button" onClick={() => go("presets")}>
          <AIcon name="plus_outline" />
          {t("添加模型服务")}
        </button>
        <h2 className="a-group-title">{t("默认模型")}</h2>
        <Card>
          <Row title={t("模型服务")}>
            <select
              aria-label={t("默认模型服务")}
              value={s.selectedProvider}
              onChange={(e) => save("provider.select", { id: e.target.value })}
            >
              <option value="" disabled>
                {t("选择服务商")}
              </option>
              {s.providers
                .filter((p) => p.enabled !== false)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.model}
                  </option>
                ))}
            </select>
          </Row>
        </Card>
      </>
    );
  if (current === "presets") {
    title = t("添加模型服务");
    content = (
      <>
        <p className="a-note">
          {t(
            "选择服务商，或填写自定义 API。模型名称沿用手机端预设，以服务商实际可用模型为准。",
          )}
        </p>
        <Card>
          {androidPresets.map((p) => (
            <Row
              key={p.id}
              title={p.name}
              icon="data_outline"
              onClick={() => go("preset:" + p.id)}
            />
          ))}
          <Row
            title={t("自定义 API")}
            icon="plus_outline"
            onClick={() => go("preset:custom")}
          />
        </Card>
      </>
    );
  }
  if (current.startsWith("preset:") || current.startsWith("provider:")) {
    title = t("模型服务");
    const preset = androidPresets.find((p) => p.id === current.split(":")[1]),
      provider = s.providers.find((p) => p.id === current.split(":")[1]);
    content = (
      <ProviderEditor
        key={current}
        provider={provider}
        preset={preset}
        busy={s.busy}
        onError={onError}
        onDone={() => setPath(["model"])}
      />
    );
  }
  if (current === "agent")
    content = (
      <>
        <h2 className="a-group-title">{t("工具能力")}</h2>
        <Card>
          {tools().map(([key, name, desc]) => (
            <Row
              key={key}
              title={name}
              description={desc}
              trailing={
                <Switch
                  label={name}
                  checked={pref.tools?.[key] === true}
                  onChange={(value) => preferences({ tools: { [key]: value } })}
                />
              }
            />
          ))}
        </Card>
        <h2 className="a-group-title">{t("用量限制")}</h2>
        <Limits preferences={pref} save={preferences} />
        <h2 className="a-group-title">{t("网页")}</h2>
        <Card>
          <Row
            title={t("网页搜索")}
            description={t("当前没有配置搜索服务。")}
          />
          <Row
            title={t("网页抓取")}
            description={t("通过内核读取公开网页。")}
            trailing={
              <span className="a-status">
                {pref.tools?.web ? t("已启用") : t("未启用")}
              </span>
            }
          />
        </Card>
      </>
    );
  if (current === "extensions")
    return <ExtensionsPage snapshot={s} onBack={back} onError={onError} />;
  if (current === "modes")
    content = (
      <>
        <p className="a-note">
          {t(
            "会话模式决定助手的工作方式。权限设置始终优先，模式不能自行提权。",
          )}
        </p>
        {[true, false].map((builtin) => (
          <React.Fragment key={String(builtin)}>
            <h2 className="a-group-title">
              {builtin ? t("内置模式") : t("我的模式")}
            </h2>
            <Card>
              {(s.modes ?? [])
                .filter((x: any) => !!x.builtin === builtin)
                .map((x: any) => (
                  <Row
                    key={x.id}
                    title={x.builtin ? t(x.name) : x.name}
                    description={x.prompt.slice(0, 100)}
                    icon="agent_preset_outline"
                    onClick={() => go("mode:" + x.id)}
                  />
                ))}
            </Card>
          </React.Fragment>
        ))}
        <button className="a-outline-button" onClick={() => go("mode:new")}>
          <AIcon name="plus_outline" />
          {t("新建模式")}
        </button>
      </>
    );
  if (current.startsWith("mode:")) {
    title = t("会话模式");
    content = (
      <ModeEditor
        item={s.modes?.find((x: any) => x.id === current.split(":")[1])}
        onError={onError}
        onDone={() => setPath(["modes"])}
      />
    );
  }
  if (current === "usage") {
    const today = new Date().toLocaleDateString("sv-SE"),
      usage = s.usage ?? {},
      day = usage[today];
    content = (
      <>
        <h2 className="a-group-title">{t("今日用量")}</h2>
        <Card>
          <div className="a-stats">
            {[
              [t("输入"), day?.input],
              [t("缓存"), day?.cached],
              [t("输出"), day?.output],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <strong>{Number(value ?? 0).toLocaleString()}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          {!day && <p className="a-note">{t("暂无服务商返回的用量记录。")}</p>}
        </Card>
        <h2 className="a-group-title">{t("最近 30 天")}</h2>
        <Card>
          {Object.entries(usage)
            .slice(-30)
            .reverse()
            .map(([date, u]) => (
              <Row
                key={date}
                title={date}
                description={`${t("输入")} ${u.input.toLocaleString()} · ${t("输出")} ${u.output.toLocaleString()} · ${t("缓存")} ${u.cached.toLocaleString()}`}
              />
            ))}
          {!Object.keys(usage).length && (
            <Row
              title={t("暂无记录")}
              description={t("仅记录服务商返回的 token 用量，不估算费用。")}
            />
          )}
        </Card>
      </>
    );
  }
  if (current === "phone")
    content = (
      <>
        <p className="a-note">
          {t(
            "Windows 无障碍控件树、读屏与电脑操作由本机工具提供。权限不会因更换模型或会话模式自动提高。",
          )}
        </p>
        <Card>
          <Row title={t("权限模式")}>
            <Segmented
              values={[
                { id: "read-only", label: t("只读") },
                { id: "ask", label: t("询问") },
                { id: "full", label: t("完全访问") },
              ]}
              value={pref.access ?? "read-only"}
              onChange={access}
            />
          </Row>
          {tools().map(([key, name, desc]) => (
            <Row
              key={key}
              title={name}
              description={desc}
              icon="shield_outline"
              trailing={
                <Switch
                  label={t("允许") + name}
                  checked={pref.tools?.[key] === true}
                  onChange={(value) => preferences({ tools: { [key]: value } })}
                />
              }
            />
          ))}
        </Card>
        <p className="a-note">
          {t(
            "只读模式不允许点击、输入、写入文件或执行命令。“询问”会在执行需要授权的操作时弹出确认。",
          )}
        </p>
        <h2 className="a-group-title">{t("系统设置")}</h2>
        <Card>
          <Row
            title={t("Windows 无障碍")}
            description={t("打开系统辅助功能设置。")}
            onClick={() => save("windows.settings", { page: "accessibility" })}
          />
          <Row
            title={t("麦克风")}
            description={t("语音输入使用 Windows 系统服务（Win + H）。")}
            onClick={() => save("windows.settings", { page: "microphone" })}
          />
          <Row
            title={t("通知")}
            description={t("管理 Windows 通知显示。")}
            onClick={() => save("windows.settings", { page: "notifications" })}
          />
        </Card>
        <h2 className="a-group-title">{t("系统差异")}</h2>
        <Card>
          <Row
            title={t("手机专属权限")}
            description={t(
              "Android 的 Shizuku、通知读取、悬浮球和跨应用助手手势仅在手机端使用。Windows 使用 UI Automation 与 PowerShell。",
            )}
          />
        </Card>
      </>
    );
  if (current === "about")
    content = (
      <>
        <Card>
          <Row title="WinKu" description="v1.0 · Windows" />
          <Row
            title={t("开源项目")}
            description="github.com/Excapesx/WinKu"
            onClick={() =>
              openExternal("https://github.com/Excapesx/WinKu").catch((e) =>
                onError(String(e)),
              )
            }
          />
          <Row
            title={t("内核")}
            description={t("基于开源 dsh 的多模型 Harness")}
          />
          <Row
            title={t("本地数据")}
            description={t(
              "聊天、配置和附件存于当前电脑。API Key 由 Windows 凭据管理器保存。",
            )}
          />
        </Card>
      </>
    );
  if (current === "learning") {
    title = t("交互学习");
    content = <LearningGallery dark={dark} />;
  }
  return (
    <Page title={title} onBack={back}>
      {content}
      {confirmFull && (
        <RiskDialog
          onClose={() => setConfirmFull(false)}
          onConfirm={() => {
            preferences({ access: "full", confirmFull: true });
            setConfirmFull(false);
          }}
        />
      )}
      {modal}
    </Page>
  );
}
function Limits({
  preferences: p,
  save,
}: {
  preferences: any;
  save: (p: any) => void;
}) {
  const [daily, setDaily] = useState(p.dailyLimit ?? 0),
    [session, setSession] = useState(p.sessionLimit ?? 0);
  return (
    <Card>
      <Row title={t("会话 token 上限")} description={t("0 表示不限制。")}>
        <input
          aria-label={t("会话 token 上限")}
          type="number"
          min="0"
          value={session}
          onChange={(e) => setSession(Number(e.target.value))}
        />
      </Row>
      <Row
        title={t("每日 token 上限")}
        description={t(
          "依据服务商返回的用量；达到上限后停止开启新的模型请求。",
        )}
      >
        <input
          aria-label={t("每日 token 上限")}
          type="number"
          min="0"
          value={daily}
          onChange={(e) => setDaily(Number(e.target.value))}
        />
      </Row>
      <div className="a-card-actions">
        <button
          className="primary-button"
          onClick={() => save({ dailyLimit: daily, sessionLimit: session })}
        >
          {t("保存")}
        </button>
      </div>
    </Card>
  );
}
function ProviderEditor({
  provider,
  preset,
  busy,
  onDone,
  onError,
}: {
  provider?: Provider;
  preset?: any;
  busy: boolean;
  onDone: () => void;
  onError: (s: string) => void;
}) {
  const [form, setForm] = useState<Provider>(
      provider ?? {
        id: "provider-" + crypto.randomUUID(),
        name: preset?.name ?? "",
        baseURL: preset?.baseURL ?? "",
        model: preset?.model ?? "",
        protocol: preset?.protocol ?? "openai-chat-completions",
        enabled: true,
        models: preset?.model ? [preset.model] : [],
      },
    ),
    [key, setKey] = useState(""),
    [working, setWorking] = useState(false),
    [saved, setSaved] = useState(!!provider),
    [discover, setDiscover] = useState<string[] | null>(null),
    [deleting, setDeleting] = useState(false);
  const field =
    (name: keyof Provider) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((x) => ({ ...x, [name]: e.target.value }));
  async function save(exit = true) {
    if (working) return;
    setWorking(true);
    try {
      if (!saved && !key.trim()) throw Error(t("请填写 API Key。"));
      await request("provider.save", { ...form, apiKey: key.trim() });
      setKey("");
      setSaved(true);
      if (exit) onDone();
    } catch (e) {
      onError(String((e as Error).message ?? e));
      return false;
    } finally {
      setWorking(false);
    }
    return true;
  }
  async function action(method: string) {
    if (!(await save(false))) return;
    setWorking(true);
    try {
      const result = await request<any>(method, { providerId: form.id });
      if (method === "provider.models") setDiscover(result.models);
      else onError(t("连接验证成功"));
    } catch (e) {
      onError(String((e as Error).message ?? e));
    } finally {
      setWorking(false);
    }
  }
  return (
    <>
      <h2 className="a-group-title">
        {provider ? t("编辑服务商") : t("添加服务商")}
      </h2>
      <Card>
        <Row
          title={t("启用服务商")}
          trailing={
            <Switch
              label={t("启用服务商")}
              checked={form.enabled !== false}
              onChange={(enabled) => setForm((x) => ({ ...x, enabled }))}
            />
          }
        />
        <Row title={t("服务商名称")}>
          <input
            aria-label={t("服务商名称")}
            required
            maxLength={80}
            value={form.name}
            onChange={field("name")}
            placeholder={t("例如：我的模型服务")}
          />
        </Row>
        <Row title={t("API 地址")}>
          <input
            aria-label={t("API 地址")}
            required
            type="url"
            value={form.baseURL}
            onChange={field("baseURL")}
            placeholder="https://api.example.com/v1"
          />
        </Row>
        <Row title={t("接口协议")}>
          <select
            aria-label={t("接口协议")}
            value={form.protocol}
            onChange={field("protocol")}
          >
            <option value="openai-chat-completions">{t("OpenAI 兼容")}</option>
            <option value="openai-responses">OpenAI Responses</option>
            <option value="anthropic-messages">Anthropic Messages</option>
          </select>
        </Row>
        <Row
          title="API Key"
          description={
            saved
              ? t("留空保留已保存的 Key。")
              : t("密钥只保存在 Windows 凭据管理器中。")
          }
        >
          <input
            aria-label="API Key"
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={saved ? t("已保存") : t("填写 API Key")}
          />
        </Row>
        {preset?.keysURL && (
          <Row
            title={t("获取 API Key")}
            onClick={() =>
              openExternal(preset.keysURL).catch((e) => onError(String(e)))
            }
          />
        )}
      </Card>
      <h2 className="a-group-title">{t("模型")}</h2>
      <Card>
        <Row title={t("默认模型")}>
          <input
            aria-label={t("默认模型")}
            value={form.model}
            onChange={field("model")}
            placeholder={t("填写服务商支持的模型 ID")}
          />
        </Row>
        <Row
          title={t("模型列表")}
          description={t("每行一个模型 ID，保留默认模型。")}
        >
          <textarea
            aria-label={t("模型列表")}
            value={(form.models ?? []).join("\n")}
            onChange={(e) =>
              setForm((x) => ({ ...x, models: e.target.value.split("\n") }))
            }
          />
        </Row>
        <Row
          title={t("图片理解")}
          description={t("仅在服务商确认模型支持图片时启用。")}
          trailing={
            <Switch
              label={t("图片理解")}
              checked={!!form.vision}
              onChange={(vision) => setForm((x) => ({ ...x, vision }))}
            />
          }
        />
        <Row
          title={t("获取模型列表")}
          onClick={() => action("provider.models")}
        />
        <Row
          title={t("验证连接")}
          description={t("发送一个简短请求，可能产生少量模型用量。")}
          onClick={() => action("provider.test")}
        />
      </Card>
      <div className="a-page-actions">
        <button
          className="primary-button"
          disabled={working || busy}
          onClick={() => save()}
        >
          {working ? t("处理中…") : t("保存")}
        </button>
        {provider && (
          <button
            className="danger text-button"
            onClick={() => setDeleting(true)}
          >
            {t("删除服务商")}
          </button>
        )}
      </div>
      {discover && (
        <Dialog title={t("选择模型")} onClose={() => setDiscover(null)}>
          <div className="a-model-discovery">
            {discover.map((model) => (
              <label key={model}>
                <input
                  type="checkbox"
                  checked={(form.models ?? []).includes(model)}
                  onChange={(e) =>
                    setForm((x) => ({
                      ...x,
                      models: e.target.checked
                        ? [...(x.models ?? []), model]
                        : (x.models ?? []).filter((y) => y !== model),
                    }))
                  }
                />
                {model}
              </label>
            ))}
          </div>
          <div className="a-dialog-actions">
            <button onClick={() => setDiscover(null)}>{t("完成")}</button>
          </div>
        </Dialog>
      )}
      {deleting && (
        <Dialog title={t("删除模型服务？")} onClose={() => setDeleting(false)}>
          <p>{t("会话记录会保留，后续需要选择其他模型才能继续。")}</p>
          <div className="a-dialog-actions">
            <button onClick={() => setDeleting(false)}>{t("取消")}</button>
            <button
              className="danger"
              onClick={() =>
                request("provider.delete", { id: form.id })
                  .then(onDone)
                  .catch((e) => onError(String(e)))
              }
            >
              {t("删除")}
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
function ModeEditor({
  item,
  onDone,
  onError,
}: {
  item?: any;
  onDone: () => void;
  onError: (s: string) => void;
}) {
  const [form, setForm] = useState<any>(
      item ?? {
        name: "",
        prompt: "",
        icon: "agent_preset_outline",
        preset: "",
        skills: true,
        groups: {},
        engineTools: {},
      },
    ),
    [confirm, setConfirm] = useState(false),
    [risk, setRisk] = useState(false);
  const locked = !!item?.builtin;
  const set = (key: string, value: any) =>
    setForm((f: any) => ({ ...f, [key]: value }));
  const call = (method: string, p: any) =>
    request(method, p)
      .then(onDone)
      .catch((e) => onError(String(e)));
  const icons: IconName[] = [
    "agent_preset_outline",
    "inspect_outline",
    "sparkle",
    "clock_outline",
    "new_chat_outline",
    "apps_add_outline",
  ];
  return (
    <>
      {locked && <p className="a-note">{t("内置模式只读，可复制后修改。")}</p>}
      <Card>
        <Row title={t("模式名称")}>
          <input
            aria-label={t("模式名称")}
            readOnly={locked}
            maxLength={30}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Row>
        <Row title={t("图标")}>
          <div className="a-mode-icons">
            {icons.map((icon) => (
              <button
                key={icon}
                disabled={locked}
                aria-label={t("图标 ") + icon}
                aria-pressed={(form.icon ?? icons[0]) === icon}
                onClick={() => set("icon", icon)}
              >
                <AIcon name={icon} size={18} />
              </button>
            ))}
          </div>
        </Row>
        <Row
          title={t("系统提示词")}
          description={t("为这个模式补充工作方式。")}
        >
          <textarea
            aria-label={t("模式提示词")}
            readOnly={locked}
            value={form.prompt}
            onChange={(e) => set("prompt", e.target.value)}
          />
        </Row>
      </Card>
      <h2 className="a-group-title">{t("权限预设")}</h2>
      <Card>
        <div className="a-mode-presets">
          <Segmented
            values={[
              { id: "", label: t("跟随通用设置") },
              { id: "read-only", label: t("只读") },
              { id: "ask", label: t("询问") },
              { id: "full", label: t("完全访问") },
            ]}
            value={form.preset ?? ""}
            onChange={(v) => {
              if (!locked) {
                if (v === "full" && form.preset !== "full") setRisk(true);
                else set("preset", v);
              }
            }}
          />
        </div>
      </Card>
      <p className="a-note">
        {t("模式可进一步限制权限，完全访问仍需要通用权限允许。")}
      </p>
      <h2 className="a-group-title">{t("设备能力")}</h2>
      <Card>
        {tools().map(([key, name, description]) => (
          <Row
            key={key}
            title={name}
            description={description}
            trailing={
              <Switch
                label={t("模式 ") + name}
                disabled={locked}
                checked={form.groups?.[key] !== false}
                onChange={(v) => set("groups", { ...form.groups, [key]: v })}
              />
            }
          />
        ))}
      </Card>
      <h2 className="a-group-title">{t("引擎工具")}</h2>
      <Card>
        {[
          ["shell", t("命令执行")],
          ["files_read", t("读取文件")],
          ["files_write", t("写入文件")],
          ["web", t("网页")],
          ["subagent", t("子代理")],
          ["extensions", t("扩展工具")],
        ].map(([key, name]) => (
          <Row
            key={key}
            title={name}
            trailing={
              <Switch
                label={t("模式 ") + name}
                disabled={locked}
                checked={form.engineTools?.[key] !== false}
                onChange={(v) =>
                  set("engineTools", { ...form.engineTools, [key]: v })
                }
              />
            }
          />
        ))}
        <Row
          title={t("技能")}
          trailing={
            <Switch
              label={t("模式技能")}
              disabled={locked}
              checked={form.skills !== false}
              onChange={(v) => set("skills", v)}
            />
          }
        />
      </Card>
      <div className="a-page-actions">
        {item && (
          <button
            className="a-outline-button"
            onClick={() =>
              call("mode.save", {
                ...form,
                id: undefined,
                name: form.name + t(" 副本"),
              })
            }
          >
            {t("复制")}
          </button>
        )}
        {!locked && (
          <button
            className="primary-button"
            onClick={() => call("mode.save", form)}
          >
            {t("保存")}
          </button>
        )}
        {item && !locked && (
          <button
            className="danger text-button"
            onClick={() => setConfirm(true)}
          >
            {t("删除模式")}
          </button>
        )}
      </div>
      {risk && (
        <RiskDialog
          onClose={() => setRisk(false)}
          onConfirm={() => {
            set("preset", "full");
            setRisk(false);
          }}
        />
      )}
      {confirm && (
        <Dialog title={t("删除模式？")} onClose={() => setConfirm(false)}>
          <p>{t("删除这个自定义模式？")}</p>
          <div className="a-dialog-actions">
            <button onClick={() => setConfirm(false)}>{t("取消")}</button>
            <button
              className="danger"
              onClick={() => call("mode.delete", { id: item.id })}
            >
              {t("删除")}
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
export function AutomationPage({
  snapshot: s,
  onBack,
  onError,
  onOpenSession,
  onNew,
}: {
  snapshot: Snapshot;
  onBack: () => void;
  onError: (text: string) => void;
  onOpenSession: (id: string) => void;
  onNew: () => void;
}) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [editing, setEditing] = useState<any | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [confirm, setConfirm] = useState(false);
  const task = s.automations?.find((x: any) => x.id === selected);
  const call = (method: string, p: any) =>
    request<any>(method, p).catch((e) => {
      onError(String(e));
      throw e;
    });
  if (editing)
    return (
      <TaskEditor
        value={editing}
        providers={s.providers}
        onBack={() => setEditing(null)}
        onSave={async (value: any) => {
          try {
            await call("automation.save", value);
            setEditing(null);
          } catch {}
        }}
      />
    );
  if (task)
    return (
      <Page
        title={task.name}
        onBack={() => setSelected(null)}
        actions={
          <Switch
            label={t("启用任务")}
            checked={task.enabled}
            onChange={(enabled) =>
              call("automation.toggle", { id: task.id, enabled }).catch(
                () => {},
              )
            }
          />
        }
      >
        <h2 className="a-group-title">{t("何时执行")}</h2>
        <Card>
          <Row
            title={
              task.schedule === "daily"
                ? t("每天 ") + task.time
                : t("每 ") + task.intervalMinutes + t(" 分钟")
            }
            description={
              task.enabled
                ? t("下次执行：") + new Date(task.nextAt).toLocaleString()
                : t("已停用")
            }
          />
        </Card>
        <h2 className="a-group-title">{t("执行内容")}</h2>
        <Card>
          <Row
            title={
              s.providers.find((p) => p.id === task.providerId)?.name ??
              t("模型已移除")
            }
            description={task.prompt}
          />
        </Card>
        <h2 className="a-group-title">{t("最近运行")}</h2>
        <Card>
          {task.runs.length ? (
            task.runs.map((run: any, i: number) => (
              <Row
                key={i}
                title={new Date(run.time).toLocaleString()}
                description={
                  run.error ??
                  (run.status === "completed"
                    ? t("已完成 · 查看会话")
                    : run.status === "stopped"
                      ? t("已停止 · 查看会话")
                      : t("执行中 · 查看会话"))
                }
                onClick={
                  run.sessionId ? () => onOpenSession(run.sessionId) : undefined
                }
              />
            ))
          ) : (
            <Row title={t("尚未执行")} />
          )}
        </Card>
        <div className="a-page-actions">
          <button
            className="primary-button"
            disabled={s.busy}
            onClick={() =>
              call("automation.run", { id: task.id })
                .then((x) => onOpenSession(x.sessionId))
                .catch(() => {})
            }
          >
            {t("立即运行")}
          </button>
          <button className="text-button" onClick={() => setEditing(task)}>
            {t("编辑任务")}
          </button>
          <button
            className="danger text-button"
            onClick={() => setConfirm(true)}
          >
            {t("删除任务")}
          </button>
        </div>
        {confirm && (
          <Dialog
            title={t("删除自动化任务？")}
            onClose={() => setConfirm(false)}
          >
            <div className="a-dialog-actions">
              <button onClick={() => setConfirm(false)}>{t("取消")}</button>
              <button
                className="danger"
                onClick={() =>
                  call("automation.delete", { id: task.id })
                    .then(() => {
                      setConfirm(false);
                      setSelected(null);
                    })
                    .catch(() => {})
                }
              >
                {t("删除")}
              </button>
            </div>
          </Dialog>
        )}
      </Page>
    );
  return (
    <Page
      title={t("自动化任务")}
      onBack={onBack}
      actions={
        <button className="text-button" onClick={onNew}>
          <AIcon name="plus_outline" />
          {t("新建")}
        </button>
      }
    >
      <input
        className="a-search-rules"
        aria-label={t("搜索自动化任务")}
        placeholder={t("搜索任务")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="a-filter-pills">
        <Segmented
          values={[
            { id: "all", label: t("全部") },
            { id: "on", label: t("已启用") },
            { id: "off", label: t("已停用") },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>
      <p className="a-note">
        {t(
          "在 WinKu 运行期间按时触发；退出软件时暂停，重新打开后补执行一次到期任务。",
        )}
      </p>
      {(s.automations ?? [])
        .filter(
          (x: any) =>
            x.name.includes(query) &&
            (filter === "all" || x.enabled === (filter === "on")),
        )
        .map((x: any) => (
          <div className="a-task-row" key={x.id}>
            <button onClick={() => setSelected(x.id)}>
              <AIcon name="clock_outline" size={20} />
              <span>
                <strong>{x.name}</strong>
                <small>
                  {(x.schedule === "daily"
                    ? t("每天 ") + x.time
                    : t("每 ") + x.intervalMinutes + t(" 分钟")) +
                    " · " +
                    (x.runs.length
                      ? t("已执行 ") + x.runs.length + t(" 次")
                      : t("尚未执行"))}
                </small>
              </span>
            </button>
            <Switch
              label={t("启用") + x.name}
              checked={x.enabled}
              onChange={(enabled) =>
                call("automation.toggle", { id: x.id, enabled }).catch(() => {})
              }
            />
          </div>
        ))}
      {!s.automations?.length && (
        <div className="a-empty">
          <AIcon name="clock_outline" size={36} />
          <h2>{t("还没有自动化任务")}</h2>
          <p>{t("设置一个时间，让 WinKu 帮你完成重复的学习任务。")}</p>
          <button className="a-outline-button" onClick={onNew}>
            {t("新建任务")}
          </button>
        </div>
      )}
    </Page>
  );
}
function TaskEditor({
  value,
  providers,
  onBack,
  onSave,
}: {
  value: any;
  providers: Provider[];
  onBack: () => void;
  onSave: (x: any) => Promise<void>;
}) {
  const [form, setForm] = useState(value),
    [saving, setSaving] = useState(false);
  const set = (key: string, v: any) =>
    setForm((x: any) => ({ ...x, [key]: v }));
  return (
    <Page title={value.id ? t("编辑任务") : t("新建任务")} onBack={onBack}>
      <Card>
        <Row title={t("任务名称")}>
          <input
            aria-label={t("任务名称")}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Row>
        <Row title={t("执行时间")}>
          <Segmented
            values={[
              { id: "daily", label: t("每天") },
              { id: "interval", label: t("间隔") },
            ]}
            value={form.schedule}
            onChange={(v) => set("schedule", v)}
          />
          {form.schedule === "daily" ? (
            <input
              aria-label={t("每天执行时间")}
              type="time"
              value={form.time}
              onChange={(e) => set("time", e.target.value)}
            />
          ) : (
            <input
              aria-label={t("间隔分钟")}
              type="number"
              min={1}
              value={form.intervalMinutes}
              onChange={(e) => set("intervalMinutes", Number(e.target.value))}
            />
          )}
        </Row>
        <Row title={t("模型")}>
          <select
            aria-label={t("任务模型")}
            value={form.providerId}
            onChange={(e) => set("providerId", e.target.value)}
          >
            <option value="">{t("选择模型服务")}</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.model}
              </option>
            ))}
          </select>
        </Row>
        <Row title={t("执行内容")}>
          <textarea
            className="a-prompt-editor"
            aria-label={t("任务提示词")}
            value={form.prompt}
            onChange={(e) => set("prompt", e.target.value)}
            placeholder={t(
              "例如：整理今天的复习计划，并出三道检查理解的小题。",
            )}
          />
        </Row>
      </Card>
      <p className="a-note">
        {t("按所选模型的计费规则调用，电脑操作仍遵守当前权限设置。")}
      </p>
      <div className="a-page-actions">
        <button
          className="primary-button"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(form);
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? t("保存中…") : t("保存")}
        </button>
      </div>
    </Page>
  );
}
export function LearningGallery({ dark }: { dark: boolean }) {
  const [kind, setKind] = useState("function");
  const spec = (examples as any)[kind];
  const session: Session = {
    id: "learning-preview",
    title: t("交互学习"),
    createdAt: 0,
    messages: [],
  };
  return (
    <>
      <h2 className="a-learning-title">{t("动手试，慢慢懂。")}</h2>
      <p className="a-note">{t("把抽象的概念，变成可以探索的图像。")}</p>
      <label className="a-gallery-select">
        {t("选择内容")}
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          {Object.entries(examples).map(([key, value]: any) => (
            <option value={key} key={key}>
              {value.title ?? key}
            </option>
          ))}
        </select>
      </label>
      <Suspense fallback={<p>{t("正在排版…")}</p>}>
        <Teaching
          text={"```dsh-visual\n" + JSON.stringify(spec) + "\n```"}
          session={session}
          messageId={kind}
          dark={dark}
          ask={() => {}}
          canAsk={false}
        />
      </Suspense>
    </>
  );
}
export function TrajectoryPage({
  session,
  onBack,
}: {
  session?: Session;
  onBack: () => void;
}) {
  return (
    <Page title={t("轨迹")} onBack={onBack}>
      <p className="a-note">
        {t("当前会话的模型与工具事件，保留最近 500 条。")}
      </p>
      {session?.events?.length ? (
        session.events.map((e, i) => (
          <details className="a-trace-row" key={i}>
            <summary>
              <span>{e.type}</span>
              <time>{new Date(e.time).toLocaleTimeString()}</time>
            </summary>
            <pre>{e.data}</pre>
          </details>
        ))
      ) : (
        <div className="a-empty">{t("此会话暂无轨迹记录。")}</div>
      )}
    </Page>
  );
}
