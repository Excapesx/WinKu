import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const here = dirname(fileURLToPath(import.meta.url));
export class EngineClient {
  constructor(notify, request = () => ({ outcome: "rejected" })) {
    this.notify = notify;
    this.request = request;
    this.pending = new Map();
    this.next = 1;
    this.opened = new Set();
  }
  async start(provider, key, home, control = false) {
    const desktop = provider.desktop ?? {},
      prefs = desktop.preferences ?? {
        access: "read-only",
        tools: { files: true, web: true },
      },
      tools = prefs.tools ?? {};
    const readOnly = prefs.access === "read-only",
      writable = !readOnly && tools.files;
    this.home = home;
    mkdirSync(home, { recursive: true });
    const workspace = join(home, "workspace");
    mkdirSync(workspace, { recursive: true });
    const disabled = [
      "llm-deepseek",
      "llm-deepseek-account",
      "deepseek-account",
      "web-search-deepseek",
      "web-deepseek-api",
      "deepseek-llm-api-extensions",
      "session-log-deepseek",
      "plugin-package-inventory-deepseek",
      "llm-pi-ai",
      "otel",
      "session-telemetry-otel",
      "session-title-llm",
      "plugin-manager",
      "tool-plugin-manager",
      "ptc-runtime",
      "workflow-ptc",
      "tool-workflow",
      "skill-office",
      "workspace-dependencies",
      "tool-goal",
      "goal-round-driver",
      "command-goal",
      "tmux-context",
      "tool-bash",
      "tool-jobs",
    ];
    if (readOnly || !tools.shell) disabled.push("tool-pwsh");
    if (desktop.mode?.skills === false)
      disabled.push("tool-skill", "skill-filesystem");
    if (prefs.engineTools?.subagent === false)
      disabled.push("tool-subagent", "tool-subagent-control");
    const patches = disabled.map((id) => ({ id, disabled: true }));
    patches.push(
      {
        id: "system-prompt",
        config: {
          includeHarnessIdentity: false,
          personaPrefix:
            "You are WinKu, a personal learning assistant for university students on Windows. Your product identity is WinKu, independent of your model ({{model}}). If asked about the engine, explain accurately that WinKu uses open-source dsh. Reply in the user's language. Only claim actions supported by available tools and their returned results. " +
            (readOnly
              ? "Current permissions are read-only. "
              : "Respect the user-selected permission policy. ") +
            (desktop.mode?.prompt ?? ""),
        },
      },
      {
        id: "tool-web",
        config: { search: false, fetch: !!tools.web, searchTimeoutMs: 60000 },
      },
      {
        id: "tool-fs",
        config: {
          read: !!tools.files && prefs.engineTools?.files_read !== false,
          readImage:
            !!(tools.files || tools.screen) &&
            prefs.engineTools?.files_read !== false,
          write: !!writable && prefs.engineTools?.files_write !== false,
          edit: !!writable && prefs.engineTools?.files_write !== false,
        },
      },
      {
        id: "sandbox-policy",
        config: {
          mode: readOnly
            ? "read-only"
            : prefs.access === "full"
              ? "danger-full-access"
              : "workspace-write",
          workspaceRoot: workspace,
        },
      },
      {
        id: "approval",
        config: { policy: prefs.access === "full" ? "never" : "ask" },
      },
      {
        id: "skill-filesystem",
        config: {
          includeDefaultRoots: false,
          customSkillDirs: [
            ...(desktop.skillsDir ? [desktop.skillsDir] : []),
            join(workspace, ".agents", "skills"),
            join(workspace, ".dsh", "skills"),
          ],
          watch: false,
        },
      },
      {
        id: "agent-default-model",
        config: { provider: provider.id, model: provider.model },
      },
      {
        insert: [
          {
            id: "winku-extension-control",
            name: pathToFileURL(join(here, "extension-control.mjs")).href,
          },
          {
            id: "llm-service-lite",
            name: pathToFileURL(
              join(
                here,
                "node_modules/@snnh/dsh-llm-service-lite/lib/index.js",
              ),
            ).href,
            config: {
              providers: {
                [provider.id]: {
                  interfaceType: provider.protocol,
                  baseURL: provider.baseURL,
                  apiKeyEnv: "WINKU_PROVIDER_KEY",
                  models: [
                    {
                      id: provider.model,
                      ...(provider.vision
                        ? { capabilities: { modalities: ["text", "image"] } }
                        : {}),
                    },
                  ],
                  ...(provider.protocol === "openai-chat-completions"
                    ? { includeUsage: true }
                    : {}),
                },
              },
            },
          },
          {
            id: "winku-desktop",
            name: pathToFileURL(join(here, "desktop-plugin.mjs")).href,
            config: {
              preferences: prefs,
              workspace,
              providerId: provider.id,
              extensions: desktop.extensions ?? [],
            },
          },
        ],
      },
    );
    const patch = join(home, "desktop.patch.json");
    writeFileSync(patch, JSON.stringify(patches));
    this.stderr = "";
    this.child = spawn(
      process.execPath,
      ["--expose-internals", join(here, "entry.mjs")],
      {
        cwd: workspace,
        windowsHide: true,
        env: {
          ...process.env,
          DSH_HOME: join(home, "dsh"),
          DSH_TELEMETRY_DISABLED: "1",
          WINKU_PROVIDER_KEY: key,
          WINKU_EXTENSION_SAFE: control === "safe" ? "1" : "",
          WINKU_MCP_SECRETS: JSON.stringify(provider.mcpSecrets ?? {}),
          WINKU_ENGINE_PATCH: patch,
          WINKU_APP_RPC: provider.appRPC ?? "",
          WINKU_APP_TOKEN: provider.appToken ?? "",
        },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    this.child.stderr.on("data", (chunk) => {
      this.stderr = (this.stderr + chunk).slice(-12000);
    });
    this.child.stdin.on("error", () => {});
    createInterface({ input: this.child.stdout }).on("line", (line) => {
      let m;
      try {
        m = JSON.parse(line);
      } catch {
        return;
      }
      if (m.method && m.id !== undefined) {
        Promise.resolve(this.request(m)).then(
          (result) => this.write({ id: m.id, result }),
          () => this.write({ id: m.id, result: { outcome: "cancelled" } }),
        );
      } else if (m.id !== undefined) {
        const p = this.pending.get(m.id);
        if (p) {
          this.pending.delete(m.id);
          m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
        }
      } else if (m.method) this.notify(m);
    });
    this.exited = new Promise((resolve) =>
      this.child.once("exit", (code) => {
        for (const p of this.pending.values())
          p.reject(
            new Error("引擎已退出 (" + code + ")：" + this.stderr.slice(-1200)),
          );
        this.pending.clear();
        resolve(code);
      }),
    );
    this.child.once("error", (error) => {
      for (const p of this.pending.values()) p.reject(error);
      this.pending.clear();
    });
    if (control) return this.call("desktop/ext/list");
    return this.call("initialize", {
      provider: provider.id,
      model: provider.model,
      ...(prefs.effort && prefs.effort !== "auto"
        ? { reasoningEffort: prefs.effort }
        : {}),
      cwd: workspace,
      approvalRequests: true,
      capabilities: { userQuestions: true },
    });
  }
  write(message) {
    if (this.child?.stdin.writable)
      this.child.stdin.write(
        JSON.stringify({ jsonrpc: "2.0", ...message }) + "\n",
      );
  }
  call(method, params = {}, timeout = 60000) {
    return new Promise((resolve, reject) => {
      const id = this.next++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(method + " 超时。" + this.stderr.slice(-1200)));
      }, timeout);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      this.write({ id, method, params });
    });
  }
  async stop() {
    if (!this.child || this.child.exitCode !== null) return;
    try {
      await this.call("shutdown", {}, 3000);
    } catch {}
    const timer = setTimeout(() => this.child?.kill(), 1500);
    await this.exited;
    clearTimeout(timer);
    this.opened.clear();
  }
}
