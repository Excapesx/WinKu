import { t, getLocale } from "./i18n";
import React, { useEffect, useState } from "react";
import { request, type Snapshot } from "./api";
import {
  AButton,
  AIcon,
  Card,
  Row,
  Page,
  Segmented,
  Switch,
  Dialog,
} from "./MobileUI";
const localText = (v: any): string =>
  typeof v === "string"
    ? v
    : (v?.[getLocale()] ??
      v?.en ??
      (Object.values(v ?? {})[0] as string) ??
      "");
export function ExtensionsPage({
  snapshot: s,
  onBack,
  onError,
}: {
  snapshot: Snapshot;
  onBack: () => void;
  onError: (s: string) => void;
}) {
  const [tab, setTab] = useState("plugins"),
    [route, setRoute] = useState("list"),
    [selected, setSelected] = useState<any>(null),
    [bundle, setBundle] = useState<any>(null);
  const [inventory, setInventory] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState<any>(null),
    [trust, setTrust] = useState(false);
  const [spec, setSpec] = useState(""),
    [inspection, setInspection] = useState<any>(null),
    [query, setQuery] = useState(""),
    [market, setMarket] = useState<any>(null),
    [index, setIndex] = useState(""),
    [urls, setUrls] = useState((s as any).marketIndexes?.join("\n") ?? "");
  const [source, setSource] = useState(""),
    [preview, setPreview] = useState<any>(null);
  const call = async (method: string, params: any = {}) => {
    setBusy(true);
    setError("");
    try {
      return await request(method, params);
    } catch (e) {
      setError(String(e));
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const load = () =>
    call("plugins.list")
      .then(setInventory)
      .catch(() => {});
  useEffect(() => {
    if ((tab === "plugins" || tab === "skills") && !inventory) load();
  }, [tab]);
  const back = () => {
    if (route === "list") onBack();
    else {
      setRoute("list");
      setSelected(null);
      setBundle(null);
      setError("");
      setPreview(null);
    }
  };
  const open = (item: any) => {
    setSelected(item);
    setRoute("editor");
  };
  const mutate = async (method: string, p: any) => {
    try {
      const result = await call(method, p);
      setConfirm(null);
      setTrust(false);
      setRoute("list");
      if (method.startsWith("plugins.")) {
        setInventory(null);
        await load();
      }
      return result;
    } catch {}
  };
  const list = (s.extensions ?? []).filter(
    (x) => x.type === (tab === "skills" ? "skill" : "mcp"),
  );
  let content: React.ReactNode,
    title = t("扩展");
  if (route === "editor")
    return <McpSkillEditor item={selected} onBack={back} onError={onError} />;
  if (route === "discovered") {
    title = selected.name;
    content = (
      <>
        <Card>
          <Row title={selected.name} description={selected.description} />
          <Row
            title={t("来源")}
            description={selected.source ?? selected.provider}
          />
          <Row
            title={t("位置")}
            description={selected.path ?? selected.provider}
          />
        </Card>
        <p className="a-note">
          {t("此技能由内核、插件或工作区提供，请在来源处管理。")}
        </p>
      </>
    );
  } else if (route === "plugin") {
    title = localText(bundle.meta?.title) || bundle.name;
    content = (
      <>
        <Card>
          <Row title={bundle.name} description={bundle.description} />
          <Row title={t("版本")} description={bundle.version ?? "—"} />
          <Row title={t("来源")} description={bundle.source ?? t("内置")} />
          <Row
            title={t("状态")}
            description={
              bundle.error?.code ?? (bundle.enabled ? t("已启用") : t("已停用"))
            }
          />
        </Card>
        <h2 className="a-group-title">{t("插件模块")}</h2>
        <Card>
          {bundle.rows?.map((row: any) => (
            <Row
              key={row.rowId}
              title={localText(row.meta?.title) || row.rowId}
              description={
                inventory?.plugins?.find((x: any) => x.entryId === row.entryId)
                  ?.fiberPhase ?? t("未运行")
              }
            />
          ))}
        </Card>
        <div className="a-page-actions">
          {!bundle.readOnlyReason && (
            <button
              className="a-outline-button"
              disabled={busy}
              onClick={() => {
                setTrust(false);
                setConfirm({
                  method: "plugins.toggle",
                  params: { name: bundle.name, enabled: !bundle.enabled },
                });
              }}
            >
              {bundle.enabled ? t("停用插件") : t("启用插件")}
            </button>
          )}
          {bundle.removable && (
            <button
              className="a-outline-button danger"
              disabled={busy}
              onClick={() => {
                setTrust(false);
                setConfirm({
                  method: "plugins.delete",
                  params: { name: bundle.name },
                });
              }}
            >
              {t("卸载插件")}
            </button>
          )}
        </div>
      </>
    );
  } else if (route === "install") {
    title = t("安装插件");
    content = (
      <>
        <Card>
          <Row
            title={t("安装来源")}
            description={t("填写 npm 包名、GitHub 地址或本地插件目录。")}
          >
            <input
              aria-label={t("插件来源")}
              value={spec}
              onChange={(e) => {
                setSpec(e.target.value);
                setInspection(null);
              }}
            />
          </Row>
        </Card>
        <div className="a-page-actions">
          <button
            className="a-outline-button"
            disabled={busy || !spec.trim()}
            onClick={() =>
              call("plugins.inspect", { spec: spec.trim() })
                .then(setInspection)
                .catch(() => {})
            }
          >
            {t("检查插件")}
          </button>
        </div>
        {inspection && (
          <Card>
            <Row
              title={inspection.name ?? spec}
              description={
                inspection.description ?? inspection.reason ?? inspection.status
              }
            />
            <Row
              title={t("检查结果")}
              description={
                inspection.status === "accepted" ? t("可安装") : t("无法安装")
              }
            />
          </Card>
        )}
        {inspection?.status === "accepted" && (
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => {
              setTrust(false);
              setConfirm({
                method: "plugins.install",
                params: { spec: spec.trim(), requestId: crypto.randomUUID() },
              });
            }}
          >
            {t("安装并启用")}
          </button>
        )}
      </>
    );
  } else if (route === "indexes") {
    title = t("管理索引");
    content = (
      <>
        <Card>
          <Row
            title={t("插件索引")}
            description={t("每行一个 HTTPS JSON 索引地址。")}
          >
            <textarea
              aria-label={t("插件索引")}
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
            />
          </Row>
        </Card>
        <button
          className="primary-button"
          disabled={busy}
          onClick={() =>
            mutate("market.save", {
              urls: urls
                .split("\n")
                .map((x: string) => x.trim())
                .filter(Boolean),
            })
          }
        >
          {t("保存")}
        </button>
      </>
    );
  } else if (route === "market") {
    title = t("插件市场");
    content = (
      <>
        <Card>
          <Row title={t("索引")}>
            <select
              aria-label={t("市场索引")}
              value={index}
              onChange={(e) => {
                setIndex(e.target.value);
                setMarket(null);
              }}
            >
              <option value="">{t("选择索引")}</option>
              {((s as any).marketIndexes ?? []).map((url: string) => (
                <option key={url} value={url}>
                  {url}
                </option>
              ))}
            </select>
          </Row>
          <Row title={t("搜索插件")}>
            <input
              aria-label={t("搜索插件")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Row>
        </Card>
        <div className="a-page-actions">
          <button
            className="a-outline-button"
            disabled={busy || !index}
            onClick={() =>
              call("market.read", { url: index })
                .then(setMarket)
                .catch(() => {})
            }
          >
            {t("刷新")}
          </button>
          <button
            className="a-outline-button"
            onClick={() => {
              setUrls((s as any).marketIndexes?.join("\n") ?? "");
              setRoute("indexes");
            }}
          >
            {t("管理索引")}
          </button>
        </div>
        {!index && <p className="a-note">{t("选择或添加索引以查看插件。")}</p>}
        {market && (
          <>
            <h2 className="a-group-title">{localText(market.title)}</h2>
            <Card>
              {market.plugins
                .filter((x: any) =>
                  (x.name + localText(x.title) + localText(x.description))
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((p: any) => (
                  <Row
                    key={p.name}
                    title={localText(p.title) || p.name}
                    description={localText(p.description)}
                    onClick={() => {
                      setBundle(p);
                      setRoute("market-detail");
                    }}
                  />
                ))}
            </Card>
          </>
        )}
      </>
    );
  } else if (route === "market-detail") {
    title = localText(bundle.title) || bundle.name;
    content = (
      <>
        <Card>
          <Row
            title={bundle.name}
            description={localText(bundle.description)}
          />
          {bundle.author && (
            <Row title={t("作者")} description={bundle.author} />
          )}
          <Row title={t("来源")} description={index} />
        </Card>
        <h2 className="a-group-title">{t("可用版本")}</h2>
        <Card>
          {bundle.versions.map((v: any) => (
            <Row
              key={v.version}
              title={v.version}
              description={v.engines?.dsh ? "dsh " + v.engines.dsh : undefined}
              trailing={
                <button
                  className="a-outline-button"
                  disabled={busy}
                  onClick={() => {
                    setTrust(false);
                    setConfirm({
                      method: "plugins.install",
                      params: {
                        spec: v.spec,
                        registry: v.registry,
                        requestId: crypto.randomUUID(),
                      },
                    });
                  }}
                >
                  {t("安装")}
                </button>
              }
            />
          ))}
        </Card>
      </>
    );
  } else if (route === "import") {
    title = t("导入技能");
    content = (
      <>
        <Card>
          <Row
            title={t("本地文件")}
            description={t("支持 SKILL.md 或包含技能及附件的 ZIP，最大 5 MB。")}
          >
            <input
              type="file"
              aria-label={t("选择技能文件")}
              accept=".md,.zip"
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) {
                  setError(t("文件超过 5 MB。"));
                  return;
                }
                let raw = "";
                for (const byte of new Uint8Array(await file.arrayBuffer()))
                  raw += String.fromCharCode(byte);
                call("skill.preview", { name: file.name, data: btoa(raw) })
                  .then(setPreview)
                  .catch(() => {});
              }}
            />
          </Row>
          <Row title={t("URL 或 GitHub 地址")}>
            <input
              aria-label={t("技能地址")}
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setPreview(null);
              }}
            />
          </Row>
        </Card>
        <button
          className="a-outline-button"
          disabled={busy || !source.trim()}
          onClick={() =>
            call("skill.preview", { source: source.trim() })
              .then(setPreview)
              .catch(() => {})
          }
        >
          {t("预览导入")}
        </button>
        {preview && (
          <>
            <h2 className="a-group-title">{t("导入预览")}</h2>
            <Card>
              {preview.skills.map((x: any) => (
                <Row key={x.name} title={x.name} description={x.description} />
              ))}
            </Card>
            <p className="a-note">
              {t("技能会作为助手指令。仅导入你信任的来源。")}
            </p>
            <button
              className="primary-button"
              disabled={busy}
              onClick={() => mutate("skill.import", { token: preview.token })}
            >
              {t("确认导入")}
            </button>
          </>
        )}
      </>
    );
  } else {
    content = (
      <>
        <Segmented
          values={[
            { id: "plugins", label: t("插件") },
            { id: "skills", label: t("技能") },
            { id: "mcp", label: "MCP" },
          ]}
          value={tab}
          onChange={(v) => {
            setTab(v);
            setError("");
          }}
        />
        <p className="a-note">
          {t("扩展会参与模型上下文或提供工具，只添加你信任的内容。")}
        </p>
        {tab === "plugins" ? (
          <>
            <div className="a-page-actions">
              <button
                className="a-outline-button"
                onClick={() => setRoute("market")}
              >
                {t("插件市场")}
              </button>
              <button
                className="a-outline-button"
                onClick={() => {
                  setInspection(null);
                  setRoute("install");
                }}
              >
                {t("安装插件")}
              </button>
              <AButton
                label={t("刷新插件")}
                icon="inspect_outline"
                disabled={busy}
                onClick={load}
              />
            </div>
            {inventory?.safeMode && (
              <p role="status" className="a-note">
                {t("已进入扩展恢复模式，可停用或卸载导致启动失败的插件。")}
              </p>
            )}
            <Card>
              {inventory?.bundles
                ?.filter(
                  (x: any) =>
                    !x.optional &&
                    (x.removable || x.availability === "profile"),
                )
                .map((x: any) => (
                  <Row
                    key={x.name}
                    title={localText(x.meta?.title) || x.name}
                    description={
                      (x.enabled ? t("已启用") : t("未启用")) +
                      (x.version ? " · " + x.version : "")
                    }
                    onClick={() => {
                      setBundle(x);
                      setRoute("plugin");
                    }}
                  />
                ))}
              {inventory &&
                !inventory.bundles?.some(
                  (x: any) =>
                    !x.optional &&
                    (x.removable || x.availability === "profile"),
                ) && (
                  <Row
                    title={t("尚未安装插件")}
                    description={t("从市场选择插件，或填写安装来源。")}
                  />
                )}
            </Card>
          </>
        ) : (
          <>
            {tab === "skills" && (
              <h2 className="a-group-title">{t("已导入的技能")}</h2>
            )}
            <Card>
              {list.length ? (
                list.map((x: any) => (
                  <Row
                    key={x.id}
                    title={x.name}
                    description={
                      x.type === "skill"
                        ? x.description
                        : x.enabled
                          ? t("已启用")
                          : t("已停用")
                    }
                    onClick={() => open(x)}
                    trailing={
                      <Switch
                        label={t("启用 ") + x.name}
                        checked={x.enabled}
                        disabled={busy || s.busy}
                        onChange={(enabled) =>
                          mutate("extension.toggle", { id: x.id, enabled })
                        }
                      />
                    }
                  />
                ))
              ) : (
                <Row
                  title={
                    tab === "skills"
                      ? t("尚未导入技能")
                      : t("尚未添加 MCP 服务")
                  }
                />
              )}
            </Card>
            <button
              className="a-outline-button"
              onClick={() =>
                tab === "skills"
                  ? setRoute("import")
                  : open({
                      id: crypto.randomUUID(),
                      type: "mcp",
                      name: "",
                      enabled: true,
                      transport: "streamable-http",
                      url: "",
                      command: "",
                      args: [],
                    })
              }
            >
              <AIcon name="plus_outline" />
              {tab === "skills" ? t("导入技能") : t("添加 MCP 服务")}
            </button>
            {tab === "skills" && (
              <>
                <h2 className="a-group-title">{t("自动发现的技能")}</h2>
                <AButton
                  label={t("刷新技能")}
                  icon="inspect_outline"
                  disabled={busy || s.busy}
                  onClick={load}
                />
                {inventory?.skillsComplete === false && (
                  <p className="a-note" role="status">
                    {t("部分技能来源暂时不可读取，请稍后刷新。")}
                  </p>
                )}
                <Card>
                  {inventory?.skills?.filter(
                    (x: any) => !list.some((v) => v.name === x.name),
                  ).length ? (
                    inventory.skills
                      .filter((x: any) => !list.some((v) => v.name === x.name))
                      .map((x: any) => (
                        <Row
                          key={x.name}
                          title={x.name}
                          description={
                            (x.source ?? x.provider ?? t("内置")) +
                            " · " +
                            x.description
                          }
                          onClick={() => {
                            setSelected(x);
                            setRoute("discovered");
                          }}
                        />
                      ))
                  ) : (
                    <Row
                      title={busy ? t("正在读取技能") : t("未发现其他技能")}
                    />
                  )}
                </Card>
                <p className="a-note">
                  {t("此技能由内核、插件或工作区提供，请在来源处管理。")}
                </p>
              </>
            )}
            {tab === "mcp" && (
              <button
                className="a-outline-button"
                onClick={() =>
                  open({
                    id: crypto.randomUUID(),
                    type: "mcp",
                    name: "",
                    enabled: true,
                    transport: "streamable-http",
                    url: "",
                    command: "",
                    args: [],
                    importJson: true,
                  })
                }
              >
                {t("粘贴 MCP JSON")}
              </button>
            )}
          </>
        )}
      </>
    );
  }
  return (
    <Page title={title} onBack={back}>
      {busy && (
        <p role="status" className="a-note">
          {t("正在处理…")}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {t(error)}
        </p>
      )}
      {content}
      {confirm && (
        <Dialog
          title={t("确认插件操作")}
          onClose={() => !busy && setConfirm(null)}
        >
          <p>
            {t(
              "第三方插件在本机运行代码，能够访问当前用户的文件和网络。权限设置无法隔离插件自身的代码。",
            )}
          </p>
          <label className="a-checkbox-row">
            <input
              type="checkbox"
              checked={trust}
              onChange={(e) => setTrust(e.target.checked)}
            />
            {t("我信任此来源并了解影响")}
          </label>
          <div className="a-dialog-actions">
            <button disabled={busy} onClick={() => setConfirm(null)}>
              {t("取消")}
            </button>
            <button
              disabled={!trust || busy}
              onClick={() =>
                mutate(confirm.method, {
                  ...confirm.params,
                  confirmTrust: true,
                })
              }
            >
              {busy ? t("正在处理…") : t("确认")}
            </button>
          </div>
        </Dialog>
      )}
    </Page>
  );
}
function McpSkillEditor({
  item,
  onBack,
  onError,
}: {
  item: any;
  onBack: () => void;
  onError: (s: string) => void;
}) {
  const [form, setForm] = useState({
      ...item,
      askBeforeCall: item.askBeforeCall !== false,
    }),
    [headers, setHeaders] = useState(""),
    [env, setEnv] = useState(""),
    [json, setJson] = useState(""),
    [busy, setBusy] = useState(false),
    [tools, setTools] = useState<any[] | null>(item.lastTest?.tools ?? null),
    [confirm, setConfirm] = useState(false),
    [launch, setLaunch] = useState(false);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const secrets = () => {
    if (!headers && !env) return undefined;
    return {
      ...(headers ? { headers: JSON.parse(headers) } : {}),
      ...(env ? { env: JSON.parse(env) } : {}),
    };
  };
  const call = async (method: string, p: any, done = false) => {
    setBusy(true);
    try {
      const r = await request(method, p);
      if (done) onBack();
      return r;
    } catch (e) {
      onError(String(e));
      return null;
    } finally {
      setBusy(false);
    }
  };
  const params = () => ({ ...form, secrets: secrets() });
  const test = () => {
    try {
      call("mcp.test", { ...params(), confirmLaunch: launch }).then((r) => {
        if (r) setTools(r.tools);
      });
    } catch (e) {
      onError(t("认证配置需要有效的 JSON 对象。"));
    }
  };
  return (
    <Page
      title={item.type === "skill" ? item.name : t("MCP 服务")}
      onBack={onBack}
    >
      {item.importJson && (
        <Card>
          <Row
            title="MCP JSON"
            description={t("粘贴包含 mcpServers 的配置，一次导入一个服务。")}
          >
            <textarea
              aria-label="MCP JSON"
              value={json}
              onChange={(e) => setJson(e.target.value)}
            />
          </Row>
          <Row
            title={t("应用 JSON")}
            onClick={() => {
              try {
                const parsed = JSON.parse(json),
                  entries = Object.entries(parsed.mcpServers ?? {});
                if (entries.length !== 1) throw Error();
                const [name, value] = entries[0] as [string, any];
                setForm({
                  ...form,
                  name,
                  transport: value.url ? "streamable-http" : "stdio",
                  url: value.url ?? "",
                  command: value.command ?? "",
                  args: value.args ?? [],
                });
                setHeaders(JSON.stringify(value.headers ?? {}, null, 2));
                setEnv(JSON.stringify(value.env ?? {}, null, 2));
              } catch {
                onError(t("配置需要包含一个 mcpServers 服务。"));
              }
            }}
          />
        </Card>
      )}
      <Card>
        <Row title={t("名称")}>
          <input
            aria-label={t("扩展名称")}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Row>
        <Row
          title={t("启用")}
          trailing={
            <Switch
              label={t("启用扩展")}
              checked={form.enabled}
              onChange={(v) => set("enabled", v)}
            />
          }
        />
        {item.type === "skill" ? (
          <>
            <Row title={t("来源")} description={item.origin ?? t("编辑器")} />
            <Row
              title={t("文件数量")}
              description={String(item.fileCount ?? 1)}
            />
            <Row title={t("技能内容")}>
              <textarea
                className="a-prompt-editor"
                aria-label={t("技能内容")}
                value={form.text}
                onChange={(e) => set("text", e.target.value)}
              />
            </Row>
          </>
        ) : (
          <>
            <Row title={t("连接方式")}>
              <Segmented
                values={[
                  { id: "streamable-http", label: "HTTP" },
                  { id: "stdio", label: t("本地命令") },
                ]}
                value={form.transport}
                onChange={(v) => set("transport", v)}
              />
            </Row>
            {form.transport === "stdio" ? (
              <>
                <Row
                  title={t("命令")}
                  description={t("只运行你信任的本地 MCP 服务。")}
                >
                  <input
                    aria-label={t("MCP 命令")}
                    value={form.command}
                    onChange={(e) => set("command", e.target.value)}
                  />
                </Row>
                <Row title={t("参数")} description={t("每行一个参数。")}>
                  <textarea
                    aria-label={t("MCP 参数")}
                    value={form.args.join("\n")}
                    onChange={(e) =>
                      set("args", e.target.value.split("\n").filter(Boolean))
                    }
                  />
                </Row>
                <Row
                  title={t("环境变量")}
                  description={t(
                    "填写 JSON；保存在 Windows 凭据管理器。留空保留已保存值，{} 清空。",
                  )}
                >
                  <textarea
                    aria-label={t("MCP 环境变量")}
                    value={env}
                    placeholder={form.hasSecrets ? t("已保存，留空保留") : "{}"}
                    onChange={(e) => setEnv(e.target.value)}
                  />
                </Row>
              </>
            ) : (
              <>
                <Row title={t("服务地址")}>
                  <input
                    aria-label={t("MCP 服务地址")}
                    value={form.url}
                    onChange={(e) => set("url", e.target.value)}
                  />
                </Row>
                <Row
                  title={t("认证请求头")}
                  description={t(
                    "填写 JSON；保存在 Windows 凭据管理器。留空保留已保存值，{} 清空。",
                  )}
                >
                  <textarea
                    aria-label={t("MCP 认证请求头")}
                    value={headers}
                    placeholder={form.hasSecrets ? t("已保存，留空保留") : "{}"}
                    onChange={(e) => setHeaders(e.target.value)}
                  />
                </Row>
              </>
            )}
            <Row
              title={t("调用前询问")}
              description={t("即使开启完全访问，也先确认此服务的工具调用。")}
              trailing={
                <Switch
                  label={t("调用前询问")}
                  checked={form.askBeforeCall}
                  onChange={(v) => set("askBeforeCall", v)}
                />
              }
            />
          </>
        )}
      </Card>
      <div className="a-page-actions">
        <button
          className="primary-button"
          disabled={busy}
          onClick={() => {
            try {
              call("extension.save", params(), true);
            } catch {
              onError(t("认证配置需要有效的 JSON 对象。"));
            }
          }}
        >
          {t("保存")}
        </button>
        {item.type === "mcp" && (
          <button className="a-outline-button" disabled={busy} onClick={test}>
            {t("测试连接")}
          </button>
        )}
        <button
          className="a-outline-button danger"
          disabled={busy}
          onClick={() => setConfirm(true)}
        >
          {t("删除扩展")}
        </button>
      </div>
      {item.type === "mcp" && form.transport === "stdio" && (
        <label className="a-checkbox-row">
          <input
            type="checkbox"
            checked={launch}
            onChange={(e) => setLaunch(e.target.checked)}
          />
          {t("允许测试时启动此本地命令")}
        </label>
      )}
      {tools && (
        <>
          <h2 className="a-group-title">
            {t("工具 ·")}
            {tools.length}
          </h2>
          <p className="a-note">{t("最近一次测试结果；重新测试可刷新。")}</p>
          <Card>
            {tools.map((t) => (
              <Row key={t.name} title={t.name} description={t.description} />
            ))}
          </Card>
        </>
      )}
      {confirm && (
        <Dialog title={t("删除扩展？")} onClose={() => setConfirm(false)}>
          <p>{t("删除后可重新添加。")}</p>
          <div className="a-dialog-actions">
            <button onClick={() => setConfirm(false)}>{t("取消")}</button>
            <button
              className="danger"
              disabled={busy}
              onClick={() => call("extension.delete", { id: form.id }, true)}
            >
              {t("删除")}
            </button>
          </div>
        </Dialog>
      )}
    </Page>
  );
}
