import { setupAssistantStream } from "./assistant-stream.js";
import { learningPrompt } from "./learning.js";
import { registerWindowsTools } from "./windows-tools.mjs";
export const name = "winku-desktop";
export const inject = ["systemPrompt", "tools"];
export function apply(ctx, config = {}) {
  setupAssistantStream(ctx);
  ctx.systemPrompt.section({
    name: "winku:learning",
    order: 60,
    text: learningPrompt
      .replaceAll("on this phone", "on this Windows computer")
      .replaceAll("phone diagrams", "desktop diagrams"),
  });
  registerWindowsTools(ctx, config);
  const rpc = async (method, params) => {
    const response = await fetch(process.env.WINKU_APP_RPC, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.WINKU_APP_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ method, params }),
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || "任务操作失败");
    return result;
  };
  ctx.on("tools/pre-execute", async (exec, next) =>
    exec.name.startsWith("automation_") &&
    exec.name !== "automation_list" &&
    config.preferences?.access !== "full"
      ? {
          kind: "ask",
          reason:
            "创建或修改 WinKu 自动化任务，将在软件运行时调用所选模型。\n" +
            JSON.stringify(exec.arguments ?? {}).slice(0, 8000),
        }
      : next(),
  );
  const output = {
    schema: {},
    render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }],
  };
  ctx.tools.register({
    name: "automation_list",
    description: "列出当前 Windows WinKu 自动化任务与执行时间。",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    output,
    execute: () => rpc("automation.list", {}),
  });
  ctx.tools.register({
    name: "automation_create",
    description:
      "创建 Windows 定时学习任务。支持每天指定时刻或每隔若干分钟。只在 WinKu 运行期间执行；退出后暂停，重新打开补执行一次。",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        prompt: { type: "string" },
        schedule: { type: "string", enum: ["daily", "interval"] },
        time: { type: "string", description: "每天执行时间，24小时 HH:mm" },
        intervalMinutes: { type: "integer", description: "间隔分钟，至少1" },
      },
      required: ["name", "prompt", "schedule"],
      additionalProperties: false,
    },
    output,
    execute: (args) =>
      rpc("automation.save", {
        ...args,
        providerId: config.providerId,
        enabled: true,
      }),
  });
  ctx.tools.register({
    name: "automation_toggle",
    description: "开启或暂停已有 WinKu 定时任务。",
    parameters: {
      type: "object",
      properties: { id: { type: "string" }, enabled: { type: "boolean" } },
      required: ["id", "enabled"],
      additionalProperties: false,
    },
    output,
    execute: (args) => rpc("automation.toggle", args),
  });
  ctx.tools.register({
    name: "automation_delete",
    description: "删除已有 WinKu 定时任务。",
    parameters: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
    output,
    execute: (args) => rpc("automation.delete", args),
  });
}
