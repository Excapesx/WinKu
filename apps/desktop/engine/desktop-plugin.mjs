import { setupAssistantStream } from "./assistant-stream.js";
import { learningPrompt } from "./learning.js";
import { registerWindowsTools } from "./windows-tools.mjs";
import { createHash } from "node:crypto";
import * as mcp from "@deepseek-ai/dsh-mcp-client";
import {
  createPresentation,
  presentationPrompt,
  presentationSchema,
} from "./presentations.mjs";
export const name = "winku-desktop";
export const inject = ["systemPrompt", "tools"];
export async function apply(ctx, config = {}) {
  setupAssistantStream(ctx);
  ctx.systemPrompt.section({
    name: "winku:learning",
    order: 60,
    text: learningPrompt
      .replaceAll("on this phone", "on this Windows computer")
      .replaceAll("phone diagrams", "desktop diagrams"),
  });
  registerWindowsTools(ctx, config);
  const secrets = JSON.parse(process.env.WINKU_MCP_SECRETS || "{}");
  for (const ext of config.extensions ?? [])
    if (
      ext.type === "mcp" &&
      (ext.transport !== "stdio" || config.preferences?.access !== "read-only")
    ) {
      const serverName = createHash("sha256")
        .update(ext.id)
        .digest("hex")
        .slice(0, 32);
      if (ext.askBeforeCall !== false)
        ctx.on("tools/pre-execute", (exec, next) =>
          exec.name.startsWith("mcp__" + serverName + "__") &&
          config.preferences?.access === "full"
            ? {
                kind: "ask",
                reason:
                  ext.name +
                  " 请求调用工具：" +
                  exec.name +
                  "\n" +
                  JSON.stringify(exec.arguments ?? {}).slice(0, 8000),
              }
            : next(),
        );
      await ctx.plugin(mcp, {
        transport: ext.transport,
        serverName,
        failOnStartupError: true,
        ...(ext.transport === "stdio"
          ? {
              command: ext.command,
              args: ext.args,
              env: secrets[ext.id]?.env ?? {},
              cwd: config.workspace,
            }
          : { url: ext.url, headers: secrets[ext.id]?.headers ?? {} }),
      });
    }
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
  ctx.systemPrompt.section({
    name: "winku:presentations",
    order: 65,
    text: presentationPrompt,
  });
  if (
    config.preferences?.tools?.files &&
    config.preferences.access !== "read-only" &&
    config.preferences.engineTools?.files_write !== false
  ) {
    ctx.tools.register({
      name: "ppt_export",
      description:
        "生成可编辑的 PowerPoint 文件，包含正文、图表和讲稿备注，并在对话中提供打开/另存为按钮。先确认提纲，除非用户要求直接生成。",
      parameters: presentationSchema,
      output,
      execute: async (args, exec) => {
        const file = await createPresentation(
          args,
          config.workspace,
          exec.signal,
        );
        await rpc("presentation.publish", {
          sessionId: exec.agent?.session.id,
          file,
        });
        return {
          ...file,
          message: "PPT 已生成，可在对话文件卡片中打开或另存为。",
        };
      },
    });
  }
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
