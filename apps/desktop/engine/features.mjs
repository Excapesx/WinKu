import { powershell } from "./windows-tools.mjs";
import { modelOf } from "@snnh/dsh-llm-service-lite";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
export const defaults = {
  theme: "system",
  language: "system",
  sendKey: "enter",
  busySend: "queue",
  workDetails: "standard",
  access: "read-only",
  modeId: "study",
  notifications: true,
  tools: {
    files: true,
    web: true,
    screen: false,
    input: false,
    shell: false,
    notifications: false,
  },
  dailyLimit: 0,
  sessionLimit: 0,
};
export const builtinModes = [
  {
    id: "study",
    name: "学习助手",
    prompt:
      "用适合大学生的语言讲解，强调理解、步骤与检查；适合时使用交互学习组件。",
    builtin: true,
  },
  {
    id: "general",
    name: "通用助手",
    prompt: "清晰、直接地帮助用户完成任务，遵守用户给出的约束。",
    builtin: true,
  },
  {
    id: "code",
    name: "编程助手",
    prompt: "帮助用户理解、编写与检查代码，解释关键原理和验证方法。",
    builtin: true,
  },
];
export class Features {
  constructor(host) {
    this.host = host;
    const s = host.state;
    s.preferences = {
      ...defaults,
      ...s.preferences,
      tools: { ...defaults.tools, ...s.preferences?.tools },
    };
    s.modes ??= structuredClone(builtinModes);
    s.extensions ??= [];
    s.automations ??= [];
    s.usage ??= {};
    this.pending = new Set();
    this.timer = setInterval(() => this.tick(), 15000);
    this.timer.unref();
  }
  tick(now = Date.now()) {
    const h = this.host;
    if (h.busy || h.managing) return;
    const task = h.state.automations.find(
      (x) => x.enabled && x.nextAt <= now && !this.pending.has(x.id),
    );
    if (task) {
      this.pending.add(task.id);
      h.notify("automation.due", { id: task.id, providerId: task.providerId });
    }
  }
  route(session) {
    const s = this.host.state;
    const mode =
        session?.mode ?? s.modes.find((x) => x.id === s.preferences.modeId),
      preferences = structuredClone(s.preferences);
    for (const key of Object.keys(defaults.tools))
      if (mode?.groups?.[key] === false) preferences.tools[key] = false;
    const levels = ["read-only", "ask", "full"];
    if (
      mode?.preset &&
      levels.indexOf(mode.preset) < levels.indexOf(preferences.access)
    )
      preferences.access = mode.preset;
    preferences.engineTools = mode?.engineTools ?? {};
    if (mode?.engineTools?.shell === false) preferences.tools.shell = false;
    if (mode?.engineTools?.web === false) preferences.tools.web = false;
    return {
      preferences,
      mode,
      extensions:
        mode?.engineTools?.extensions === false
          ? []
          : s.extensions.filter((x) => x.enabled),
      skillsDir:
        mode?.skills === false ? undefined : join(this.host.home, "skills"),
    };
  }
  usage(event) {
    if (event.type !== "assistant/message" || !event.data?.usage) return;
    const u = event.data.usage;
    if (!Number.isFinite(u.inputTokens) || !Number.isFinite(u.outputTokens))
      return;
    const date = new Date().toLocaleDateString("sv-SE");
    const day = (this.host.state.usage[date] ??= {
      input: 0,
      output: 0,
      cached: 0,
    });
    day.input += u.inputTokens;
    day.output += u.outputTokens;
    day.cached += u.cacheReadTokens ?? 0;
    this.host.state.usage[date] = day;
    const session = this.host.active?.session;
    if (session)
      session.tokens = (session.tokens ?? 0) + u.inputTokens + u.outputTokens;
  }
  async handle(method, p) {
    const h = this.host,
      s = h.state;
    const changed = () => {
      h.publish(true);
      return {};
    };
    if (method === "preferences.save") {
      if (h.busy) throw Error("请等待当前回答完成后修改。");
      const old = s.preferences,
        next = { ...old };
      if (p.effort !== undefined) {
        const provider = s.providers.find((x) => x.id === s.selectedProvider);
        if (
          p.effort !== "auto" &&
          (!provider ||
            !modelOf({ models: [] }, provider.model).effort.includes(p.effort))
        )
          throw Error("当前模型不支持这个思考强度。");
        next.effort = p.effort;
      }
      for (const key of [
        "theme",
        "language",
        "busySend",
        "sendKey",
        "workDetails",
        "access",
      ])
        if (p[key] !== undefined) {
          const options = {
            theme: ["light", "dark", "system"],
            language: ["system", "zh", "en"],
            busySend: ["queue", "steer"],
            sendKey: ["enter", "ctrl-enter"],
            workDetails: ["compact", "standard", "detailed"],
            access: ["read-only", "ask", "full"],
          };
          if (!options[key].includes(p[key])) throw Error("设置值无效。");
          if (
            key === "access" &&
            p[key] === "full" &&
            old.access !== "full" &&
            !p.confirmFull
          )
            throw Error("请确认完全访问权限。");
          next[key] = p[key];
        }
      if (p.modeId !== undefined) {
        if (!s.modes.some((x) => x.id === p.modeId))
          throw Error("会话模式不存在。");
        next.modeId = p.modeId;
      }
      if (p.notifications !== undefined)
        next.notifications = p.notifications === true;
      for (const key of ["dailyLimit", "sessionLimit"])
        if (p[key] !== undefined) {
          if (!Number.isSafeInteger(p[key]) || p[key] < 0)
            throw Error("用量上限无效。");
          next[key] = p[key];
        }
      if (p.tools)
        next.tools = {
          ...old.tools,
          ...Object.fromEntries(
            Object.keys(defaults.tools)
              .filter((k) => p.tools[k] !== undefined)
              .map((k) => [k, p.tools[k] === true]),
          ),
        };
      s.preferences = next;
      return changed();
    }
    if (method === "session.update") {
      const item = s.sessions.find((x) => x.id === p.id);
      if (!item) throw Error("会话不存在。");
      if (p.title !== undefined) {
        if (!String(p.title).trim()) throw Error("请输入标题。");
        item.title = String(p.title).trim().slice(0, 100);
      }
      for (const key of ["pinned", "archived", "muted"])
        if (p[key] !== undefined) item[key] = p[key] === true;
      return changed();
    }
    if (method === "mode.save") {
      if (h.busy) throw Error("请等待当前回答完成。");
      if (!String(p.name ?? "").trim()) throw Error("请填写模式名称。");
      if (String(p.prompt ?? "").length > 12000) throw Error("提示词过长。");
      const item = s.modes.find((x) => x.id === p.id);
      if (item?.builtin) throw Error("内置模式不可改写，可新建自己的模式。");
      const value = {
        id: item?.id ?? randomUUID(),
        name: p.name.trim().slice(0, 80),
        prompt: String(p.prompt ?? "").trim(),
        icon: [
          "agent_preset_outline",
          "inspect_outline",
          "sparkle",
          "clock_outline",
          "new_chat_outline",
          "apps_add_outline",
        ].includes(p.icon)
          ? p.icon
          : "agent_preset_outline",
        preset: ["read-only", "ask", "full"].includes(p.preset) ? p.preset : "",
        skills: p.skills !== false,
        groups: Object.fromEntries(
          Object.keys(defaults.tools).map((k) => [k, p.groups?.[k] !== false]),
        ),
        engineTools: Object.fromEntries(
          [
            "shell",
            "files_read",
            "files_write",
            "web",
            "subagent",
            "extensions",
          ].map((k) => [k, p.engineTools?.[k] !== false]),
        ),
        builtin: false,
      };
      if (item) Object.assign(item, value);
      else s.modes.push(value);
      return changed();
    }
    if (method === "mode.delete") {
      const item = s.modes.find((x) => x.id === p.id);
      if (item?.builtin) throw Error("内置模式不可删除。");
      s.modes = s.modes.filter((x) => x.id !== p.id);
      if (s.preferences.modeId === p.id) s.preferences.modeId = "study";
      return changed();
    }
    if (method === "extension.toggle") {
      if (h.busy) throw Error("请等待当前回答完成。");
      const item = s.extensions.find((x) => x.id === p.id);
      if (!item) throw Error("扩展不存在。");
      item.enabled = p.enabled === true;
      if (item.type === "skill") {
        const dir = join(h.home, "skills", item.id);
        mkdirSync(dir, { recursive: true });
        if (item.enabled) writeFileSync(join(dir, "SKILL.md"), item.text);
        else rmSync(join(dir, "SKILL.md"), { force: true });
      }
      return changed();
    }
    if (method === "automation.save") {
      if (!p.name?.trim() || !p.prompt?.trim())
        throw Error("请填写任务名称和提示词。");
      if (!s.providers.some((x) => x.id === p.providerId))
        throw Error("请选择任务使用的模型。");
      const interval = Number(p.intervalMinutes);
      if (!["interval", "daily"].includes(p.schedule))
        throw Error("定时方式无效。");
      if (
        p.schedule === "interval" &&
        (!Number.isInteger(interval) || interval < 1 || interval > 525600)
      )
        throw Error("间隔应为 1–525600 分钟。");
      if (
        p.schedule === "daily" &&
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time ?? "")
      )
        throw Error("时间格式应为 HH:mm。");
      const old = s.automations.find((x) => x.id === p.id);
      const value = {
        id: old?.id ?? randomUUID(),
        name: p.name.trim().slice(0, 100),
        prompt: p.prompt.trim().slice(0, 120000),
        providerId: p.providerId,
        schedule: p.schedule,
        time: p.time,
        intervalMinutes: interval,
        enabled: p.enabled !== false,
        runs: old?.runs ?? [],
      };
      value.nextAt = this.nextAt(value);
      if (old) Object.assign(old, value);
      else s.automations.push(value);
      changed();
      return { id: value.id, name: value.name, nextAt: value.nextAt };
    }
    if (method === "automation.toggle") {
      const task = s.automations.find((x) => x.id === p.id);
      if (!task) throw Error("任务不存在。");
      task.enabled = p.enabled === true;
      task.nextAt = this.nextAt(task);
      return changed();
    }
    if (method === "automation.delete") {
      s.automations = s.automations.filter((x) => x.id !== p.id);
      this.pending.delete(p.id);
      return changed();
    }
    if (method === "automation.failure") {
      const task = s.automations.find((x) => x.id === p.id);
      if (task) {
        task.runs.unshift({
          time: Date.now(),
          error: "未能启动，请检查 API Key 和模型配置。",
        });
        task.runs = task.runs.slice(0, 50);
        task.nextAt = this.nextAt(task);
      }
      this.pending.delete(p.id);
      return changed();
    }
    if (method === "automation.run") {
      if (h.busy) {
        this.pending.delete(p.id);
        throw Error("当前会话正在运行，请稍后重试。");
      }
      const task = s.automations.find((x) => x.id === p.id);
      if (!task) throw Error("任务不存在。");
      try {
        const result = await h.run(
          {
            providerId: task.providerId,
            text: task.prompt,
            _key: p._key,
            _mcpSecrets: p._mcpSecrets,
          },
          false,
        );
        task.runs.unshift({ time: Date.now(), sessionId: result.sessionId });
        task.runs = task.runs.slice(0, 50);
        task.nextAt = this.nextAt(task);
        h.publish(true);
        return result;
      } finally {
        this.pending.delete(p.id);
      }
    }
    return undefined;
  }
  nextAt(task, now = Date.now()) {
    if (task.schedule === "interval") return now + task.intervalMinutes * 60000;
    const date = new Date(now),
      [hour, minute] = task.time.split(":").map(Number);
    date.setHours(hour, minute, 0, 0);
    if (date.getTime() <= now) date.setDate(date.getDate() + 1);
    return date.getTime();
  }
  completed(session, answer) {
    for (const task of this.host.state.automations) {
      const run = task.runs.find(
        (x) => x.sessionId === session.id && !x.status,
      );
      if (!run) continue;
      run.status = answer.interrupted
        ? "stopped"
        : answer.error
          ? "failed"
          : "completed";
      run.error = answer.error || undefined;
      if (this.host.state.preferences.notifications && !session.muted)
        powershell(
          `Add-Type -AssemblyName System.Windows.Forms;Add-Type -AssemblyName System.Drawing;$n=New-Object Windows.Forms.NotifyIcon;$n.Icon=[Drawing.SystemIcons]::Information;$n.Visible=$true;try{$n.ShowBalloonTip(5000,'WinKu',$winkuArgs.text,[Windows.Forms.ToolTipIcon]::Info);Start-Sleep -Seconds 6}finally{$n.Dispose()}`,
          {
            text:
              task.name +
              (run.status === "completed" ? " 已完成" : " 未完成，请查看会话"),
          },
        ).catch(() => {});
    }
  }
  stop() {
    clearInterval(this.timer);
  }
}
