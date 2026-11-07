import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  renameSync,
  rmSync,
} from "node:fs";
import { join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { unzipSync } from "fflate";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { scrubbedParentEnv } from "@deepseek-ai/dsh-subprocess";
import {
  parseMarketIndex,
  marketInstallTarget,
} from "@deepseek-ai/dsh-plugin-market-index";
import { EngineClient } from "./client.mjs";
const MAX = 5 * 1024 * 1024;
export function safeURL(value) {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      ))
  )
    throw Error("地址需要 HTTPS，且不能包含用户名或密码。");
  return url;
}
async function download(value) {
  let url = safeURL(value);
  for (let n = 0; n < 5; n++) {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      url = safeURL(new URL(response.headers.get("location"), url).href);
      continue;
    }
    if (!response.ok) throw Error("下载失败（HTTP " + response.status + "）。");
    const chunks = [];
    let size = 0;
    for await (const b of response.body) {
      size += b.length;
      if (size > MAX) {
        await response.body.cancel().catch(() => {});
        throw Error("文件超过 5 MB。");
      }
      chunks.push(b);
    }
    return Buffer.concat(chunks);
  }
  throw Error("下载重定向过多。");
}
function skillMeta(text) {
  const head = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1];
  const name = /^name:\s*["']?([^\r\n"']+)/m.exec(head ?? "")?.[1]?.trim();
  const description = /^description:\s*(.+)/m.exec(head ?? "")?.[1]?.trim();
  if (!name || !description || text.length > 120000)
    throw Error("技能需要包含 name、description 和正文的 SKILL.md。");
  return { name, description };
}
export class Extensions {
  constructor(host) {
    this.h = host;
    this.previews = new Map();
    host.state.marketIndexes ??= [
      "https://cdn.jsdelivr.net/gh/jackwener/DSH-Android@main/plugins/index.json",
    ];
  }
  normalize(p) {
    const old = this.h.state.extensions.find((x) => x.id === p.id),
      id = p.id || randomUUID();
    if (!/^[a-z0-9-]{1,64}$/.test(id)) throw Error("扩展 ID 无效。");
    const name = String(p.name ?? "")
      .trim()
      .slice(0, 80);
    if (!name) throw Error("请输入扩展名称。");
    const common = {
      id,
      name,
      enabled: p.enabled !== false,
      askBeforeCall: p.askBeforeCall !== false,
    };
    if (p.type === "skill") {
      const text = String(p.text ?? "");
      const meta = skillMeta(text);
      return {
        ...common,
        type: "skill",
        text,
        description: meta.description,
        origin: old?.origin ?? "editor",
        fileCount: old?.fileCount ?? 1,
      };
    }
    if (p.type !== "mcp") throw Error("扩展类型无效。");
    if (!["stdio", "streamable-http"].includes(p.transport))
      throw Error("请选择 MCP 连接方式。");
    if (p.transport === "stdio" && !String(p.command ?? "").trim())
      throw Error("请输入 MCP 命令。");
    if (p.transport === "streamable-http") {
      const url = safeURL(p.url);
      if (url.search) throw Error("请把认证信息放在请求头中。");
    }
    if (!Array.isArray(p.args ?? []) || (p.args ?? []).length > 100)
      throw Error("MCP 参数过多。");
    return {
      ...common,
      type: "mcp",
      transport: p.transport,
      url: p.transport === "streamable-http" ? String(p.url) : "",
      command: p.transport === "stdio" ? String(p.command).trim() : "",
      args: (p.args ?? []).map(String),
      hasSecrets: p.hasSecrets ?? old?.hasSecrets ?? false,
    };
  }
  async control(method, p) {
    const h = this.h;
    if (h.busy || h.managing) throw Error("请等待当前操作完成。");
    h.managing = true;
    try {
      clearTimeout(h.idle);
      await h.closing;
      await h.engine?.stop();
      h.engine = null;
      const e = new EngineClient(() => {});
      h.controlEngine = e;
      try {
        const provider = {
          id: "extension-control",
          model: "control",
          protocol: "openai-chat-completions",
          baseURL: "http://127.0.0.1:1",
          desktop: {
            preferences: { access: "read-only", tools: { files: true } },
            skillsDir: join(h.home, "skills"),
          },
        };
        let list;
        try {
          list = await e.start(provider, "", join(h.home, "engine"), true);
        } catch {
          await e.stop();
          list = await e.start(provider, "", join(h.home, "engine"), "safe");
        }
        const result =
          method === "plugins.list"
            ? list
            : await e.call("desktop/ext/" + method.slice(8), p, 180000);
        if (result?.error || result?.application === "failed")
          throw Error(
            result.error?.diagnostic ||
              result.error?.code ||
              result.packageResult?.output?.slice(-1500) ||
              "插件操作失败。",
          );
        return result;
      } finally {
        await e.stop();
        h.controlEngine = null;
      }
    } finally {
      h.managing = false;
    }
  }
  async handle(method, p) {
    const h = this.h,
      s = h.state,
      changed = () => {
        h.publish(true);
        return {};
      };
    if (method.startsWith("plugins.")) {
      if (
        ["plugins.install", "plugins.toggle", "plugins.delete"].includes(
          method,
        ) &&
        !p.confirmTrust
      )
        throw Error("请先确认信任此插件。");
      return this.control(method, p);
    }
    if (method === "market.save") {
      if (!Array.isArray(p.urls) || p.urls.length > 10)
        throw Error("最多添加 10 个索引。");
      s.marketIndexes = [...new Set(p.urls.map((u) => safeURL(u).href))];
      return changed();
    }
    if (method === "market.read") {
      if (!s.marketIndexes.includes(p.url)) throw Error("请先添加这个索引。");
      let data;
      try {
        data = await download(p.url);
      } catch {
        throw Error("插件索引暂时无法访问，请检查网络或更换索引。");
      }
      const index = parseMarketIndex(JSON.parse(data.toString("utf8")), p.url);
      return {
        ...index,
        plugins: index.plugins.map((x) => ({
          ...x,
          versions: x.versions.map((v) => ({
            ...v,
            ...marketInstallTarget(x.name, v),
          })),
        })),
      };
    }
    if (method === "skill.preview") {
      let data,
        source = p.source || p.name || "SKILL.md";
      if (p.source) {
        const url = safeURL(p.source);
        if (url.hostname === "github.com") {
          const parts = url.pathname.split("/").filter(Boolean);
          if (parts[2] === "blob")
            source =
              "https://raw.githubusercontent.com/" +
              parts.slice(0, 2).concat(parts.slice(3)).join("/");
          else if (parts.length === 2)
            source =
              "https://api.github.com/repos/" + parts.join("/") + "/zipball";
          else if (parts[2] === "tree")
            source =
              "https://codeload.github.com/" +
              parts.slice(0, 2).join("/") +
              "/zip/refs/heads/" +
              parts[3];
        }
        data = await download(source);
      } else {
        data = Buffer.from(String(p.data ?? ""), "base64");
        if (data.length > MAX) throw Error("文件超过 5 MB。");
      }
      let files;
      if (data[0] === 0x50 && data[1] === 0x4b) {
        let total = 0,
          count = 0;
        files = unzipSync(data, {
          filter: (entry) => {
            if (
              ++count > 500 ||
              entry.originalSize > MAX ||
              (total += entry.originalSize) > 10 * 1024 * 1024
            )
              throw Error("技能压缩包展开后过大。");
            return true;
          },
        });
      } else files = { "SKILL.md": data };
      for (const path of Object.keys(files))
        if (
          path.includes("\\") ||
          path.split("/").includes("..") ||
          path.startsWith("/") ||
          /^[A-Za-z]:/.test(path)
        )
          throw Error("压缩包包含无效路径。");
      const skills = Object.keys(files)
        .filter((n) => n === "SKILL.md" || n.endsWith("/SKILL.md"))
        .map((path) => {
          const text = Buffer.from(files[path]).toString("utf8"),
            root = path.slice(0, -8);
          return { ...skillMeta(text), text, root };
        });
      if (!skills.length || skills.length > 20)
        throw Error("压缩包需要包含 1–20 个 SKILL.md。");
      const token = randomUUID();
      this.previews.clear();
      this.previews.set(token, { files, skills, source, at: Date.now() });
      return {
        token,
        source,
        skills: skills.map(({ name, description }) => ({ name, description })),
      };
    }
    if (method === "skill.import") {
      if (h.busy) throw Error("请等待当前回答完成。");
      const preview = this.previews.get(p.token);
      if (!preview || Date.now() - preview.at > 600000)
        throw Error("预览已过期，请重新导入。");
      for (const skill of preview.skills) {
        const id = randomUUID(),
          dir = join(h.home, "skills", id);
        mkdirSync(dir, { recursive: true });
        let count = 0;
        for (const [name, bytes] of Object.entries(preview.files))
          if (name.startsWith(skill.root) && !name.endsWith("/")) {
            const relative = name.slice(skill.root.length);
            if (!relative) continue;
            const target = resolve(dir, relative);
            if (!target.startsWith(resolve(dir) + sep))
              throw Error("技能路径无效。");
            mkdirSync(join(target, ".."), { recursive: true });
            writeFileSync(target, bytes);
            count++;
          }
        s.extensions.push({
          id,
          name: skill.name,
          description: skill.description,
          type: "skill",
          text: skill.text,
          enabled: true,
          origin: preview.source,
          fileCount: count,
        });
      }
      this.previews.delete(p.token);
      return changed();
    }
    if (method === "extension.validate") {
      if (h.busy || h.managing) throw Error("请等待当前操作完成。");
      return this.normalize(p);
    }
    if (method === "extension.save") {
      if (h.busy) throw Error("请等待当前回答完成。");
      const value = this.normalize(p),
        old = s.extensions.find((x) => x.id === value.id);
      if (old && old.type !== value.type) throw Error("请新建扩展以更换类型。");
      if (value.type === "skill") {
        const dir = join(h.home, "skills", value.id);
        mkdirSync(dir, { recursive: true });
        if (value.enabled) writeFileSync(join(dir, "SKILL.md"), value.text);
        else rmSync(join(dir, "SKILL.md"), { force: true });
      }
      if (old) Object.assign(old, value);
      else s.extensions.push(value);
      return changed();
    }
    if (method === "mcp.test") {
      if (h.busy) throw Error("请等待当前回答完成。");
      const ext = this.normalize(p),
        secret = p._secrets ?? {};
      if (ext.type !== "mcp") throw Error("请选择 MCP 服务。");
      if (ext.transport === "stdio" && !p.confirmLaunch)
        throw Error("请确认启动这个本地命令。");
      const client = new Client({ name: "WinKu", version: "1.0.0" });
      const transport =
        ext.transport === "stdio"
          ? new StdioClientTransport({
              command: ext.command,
              args: ext.args,
              env: { ...scrubbedParentEnv(process.env), ...secret.env },
              stderr: "pipe",
            })
          : new StreamableHTTPClientTransport(new URL(ext.url), {
              requestInit: { headers: secret.headers ?? {} },
            });
      try {
        await client.connect(transport, { timeout: 15000 });
        const all = [];
        let cursor;
        do {
          const result = await client.listTools({ cursor }, { timeout: 15000 });
          all.push(
            ...result.tools.map(({ name, description }) => ({
              name,
              description,
            })),
          );
          cursor = result.nextCursor;
          if (all.length > 500) throw Error("MCP 工具过多。");
        } while (cursor);
        const item = s.extensions.find((x) => x.id === ext.id);
        if (item) {
          item.lastTest = { at: Date.now(), tools: all };
          h.publish(true);
        }
        return { tools: all };
      } catch (e) {
        throw Error("MCP 连接失败，请检查地址、认证和命令。");
      } finally {
        await client.close().catch(() => {});
        await transport.close().catch(() => {});
      }
    }
    if (method === "extension.delete") {
      if (h.busy) throw Error("请等待当前回答完成。");
      const item = s.extensions.find((x) => x.id === p.id);
      if (item?.type === "skill" && /^[a-z0-9-]{1,64}$/.test(item.id)) {
        const dir = resolve(h.home, "skills", item.id),
          root = resolve(h.home, "skills");
        if (!dir.startsWith(root + sep)) throw Error("技能路径无效。");
        rmSync(dir, { recursive: true, force: true });
      }
      s.extensions = s.extensions.filter((x) => x.id !== p.id);
      return changed();
    }
  }
}
