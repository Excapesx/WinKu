import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DesktopHost } from "../engine/host.mjs";
import { polish } from "../engine/polish.mjs";
import { registerWindowsTools, powershell } from "../engine/windows-tools.mjs";
const serve = async (fn) => {
  const server = createServer(fn);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return server;
};
test("polish: all three protocols preserve references; truncation, changed refs and cancellation keep draft", async () => {
  let mode = "ok",
    body;
  const draft =
    "讲解 `int* p`，参考 https://example.com/a 和 @notes /review C:\\work\\a.cpp";
  const server = await serve((req, res) => {
    let raw = "";
    req.on("data", (x) => (raw += x));
    req.on("end", () => {
      body = JSON.parse(raw);
      if (mode === "hang") return;
      const text = mode === "refs" ? "丢失引用" : "请按步骤" + draft;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify(
          req.url === "/responses"
            ? {
                status: mode === "cut" ? "incomplete" : "completed",
                output: [
                  { type: "message", content: [{ type: "output_text", text }] },
                ],
              }
            : req.url === "/messages"
              ? {
                  stop_reason: mode === "cut" ? "max_tokens" : "end_turn",
                  content: [{ type: "text", text }],
                }
              : {
                  choices: [
                    {
                      finish_reason: mode === "cut" ? "length" : "stop",
                      message: { content: text },
                    },
                  ],
                },
        ),
      );
    });
  });
  try {
    for (const protocol of [
      "openai-chat-completions",
      "openai-responses",
      "anthropic-messages",
    ]) {
      const p = {
        protocol,
        baseURL: "http://127.0.0.1:" + server.address().port,
        model: "fixture",
      };
      mode = "ok";
      assert.equal((await polish(p, "fake", draft)).text, "请按步骤" + draft);
      assert.equal(body.tools, undefined);
      assert.equal(body.stream, false);
      mode = "cut";
      await assert.rejects(polish(p, "fake", draft), /未完成/);
      mode = "refs";
      await assert.rejects(polish(p, "fake", draft), /引用/);
      mode = "hang";
      await assert.rejects(
        polish(p, "fake", draft, AbortSignal.timeout(50)),
        /abort|timeout/i,
      );
    }
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
});
test("persistent settings, skill lifecycle, modes, provider selection, scheduler and limits", async () => {
  const dir = mkdtempSync(join(tmpdir(), "winku-features-")),
    events = [];
  let h = new DesktopHost(dir, (event, data) => events.push({ event, data }));
  try {
    const p = {
      id: "fixture",
      name: "Fixture",
      model: "one",
      models: ["one", "two"],
      baseURL: "http://127.0.0.1:1234",
      protocol: "openai-chat-completions",
    };
    await h.handle("provider.save", p);
    await assert.rejects(
      h.handle("provider.select", { id: "fixture", model: "missing" }),
      /不存在/,
    );
    assert.equal(h.state.providers[0].model, "one");
    await assert.rejects(
      h.handle("preferences.save", { access: "full" }),
      /确认/,
    );
    await h.handle("preferences.save", {
      access: "ask",
      theme: "dark",
      notifications: false,
      tools: { screen: true },
    });
    await h.handle("mode.save", { name: "复习", prompt: "先检查基础再练习" });
    const m = h.state.modes.at(-1);
    await h.handle("preferences.save", { modeId: m.id });
    assert.equal(h.features.route().mode.name, "复习");
    await h.handle("mode.delete", { id: m.id });
    assert.equal(h.state.preferences.modeId, "study");
    const skill = {
      id: "test-skill",
      type: "skill",
      name: "Test",
      text: "---\nname: test-skill\ndescription: Test skill\n---\nTeach carefully.",
    };
    await h.handle("extension.save", skill);
    const path = join(dir, "skills/test-skill/SKILL.md");
    assert.ok(existsSync(path));
    await h.handle("extension.toggle", { id: skill.id, enabled: false });
    assert.ok(!existsSync(path));
    await h.handle("extension.save", { ...skill, enabled: false });
    assert.ok(!existsSync(path));
    await h.handle("extension.toggle", { id: skill.id, enabled: true });
    assert.ok(existsSync(path));
    await assert.rejects(
      h.handle("extension.save", { ...skill, id: "../bad" }),
      /ID/,
    );
    const task = await h.handle("automation.save", {
      name: "复习",
      prompt: "出一道题",
      providerId: p.id,
      schedule: "interval",
      intervalMinutes: 1,
      enabled: true,
    });
    assert.ok(task.id);
    h.features.tick(task.nextAt + 1);
    h.features.tick(task.nextAt + 2);
    assert.equal(events.filter((x) => x.event === "automation.due").length, 1);
    h.busy = true;
    h.features.pending.clear();
    h.features.tick(task.nextAt + 3);
    assert.equal(events.filter((x) => x.event === "automation.due").length, 1);
    h.busy = false;
    await h.handle("automation.failure", { id: task.id });
    assert.equal(h.state.automations[0].runs.length, 1);
    assert.ok(h.state.automations[0].nextAt > Date.now());
    await h.handle("preferences.save", { dailyLimit: 1 });
    h.state.usage[new Date().toLocaleDateString("sv-SE")] = {
      input: 1,
      output: 0,
      cached: 0,
    };
    await assert.rejects(
      h.handle("send", {
        text: "test",
        providerId: p.id,
        _key: "secret-fixture",
      }),
      /上限/,
    );
    await h.handle("shutdown");
    h = new DesktopHost(dir);
    assert.equal(h.state.preferences.theme, "dark");
    assert.equal(h.state.extensions.length, 1);
    assert.equal(h.state.automations.length, 1);
    assert.ok(
      !readFileSync(join(dir, "desktop.json"), "utf8").includes(
        "secret-fixture",
      ),
    );
  } finally {
    await h.handle("shutdown");
    rmSync(dir, { recursive: true, force: true });
  }
});
test("Windows policy blocks mutations and MCP in read-only, asks once per execution, never runs disabled tools", async () => {
  for (const access of ["read-only", "ask", "full"]) {
    let hook;
    const tools = [];
    const ctx = {
      on: (_event, fn) => (hook = fn),
      tools: { register: (t) => tools.push(t) },
    };
    registerWindowsTools(ctx, {
      preferences: {
        access,
        tools: { screen: true, input: true, notifications: true },
      },
    });
    for (const name of [
      "windows_input",
      "pwsh",
      "write",
      "edit",
      "mcp__fixture__tool",
    ]) {
      const result = await hook({ name }, () => ({ kind: "allow" }));
      assert.equal(
        result.kind,
        access === "read-only" ? "deny" : access === "ask" ? "ask" : "allow",
      );
    }
    assert.equal(
      tools.some((t) => t.name === "windows_input"),
      access !== "read-only",
    );
    assert.ok(tools.some((t) => t.name === "windows_screen_tree"));
  }
  assert.equal(await powershell("Write-Output '中文能力验证'"), "中文能力验证");
});
test(
  "real dsh exposes imported skill and custom mode; automation creation waits for approval and runs through host RPC",
  { timeout: 30000 },
  async () => {
    const home = mkdtempSync(join(tmpdir(), "winku-automation-wire-"));
    let host, firstBody;
    const server = await serve((req, res) => {
      let raw = "";
      req.on("data", (x) => (raw += x));
      req.on("end", () => {
        const body = JSON.parse(raw);
        firstBody ??= body;
        const done = body.messages.some((x) => x.role === "tool");
        res.writeHead(200, { "content-type": "text/event-stream" });
        const delta = done
          ? { content: "任务已创建" }
          : {
              tool_calls: [
                {
                  index: 0,
                  id: "call-fixture",
                  type: "function",
                  function: {
                    name: "automation_create",
                    arguments: JSON.stringify({
                      name: "复习提醒",
                      prompt: "出一道高数题",
                      schedule: "daily",
                      time: "20:00",
                    }),
                  },
                },
              ],
            };
        res.end(
          "data: " +
            JSON.stringify({
              choices: [{ index: 0, delta, finish_reason: null }],
            }) +
            "\n\ndata: " +
            JSON.stringify({
              choices: [
                {
                  index: 0,
                  delta: {},
                  finish_reason: done ? "stop" : "tool_calls",
                },
              ],
            }) +
            "\n\ndata: [DONE]\n\n",
        );
      });
    });
    const until = async (fn) => {
      const end = Date.now() + 20000;
      while (!fn() && Date.now() < end)
        await new Promise((r) => setTimeout(r, 20));
      assert.ok(fn(), host.engine?.stderr);
    };
    host = new DesktopHost(home);
    try {
      await host.handle("provider.save", {
        id: "fixture",
        name: "Fixture",
        model: "test",
        baseURL: "http://127.0.0.1:" + server.address().port,
        protocol: "openai-chat-completions",
      });
      await host.handle("extension.save", {
        name: "复习技能",
        type: "skill",
        text: "---\nname: revision-fixture\ndescription: REVISION_SKILL_UNIQUE\n---\nExplain patiently.",
      });
      await host.handle("mode.save", {
        name: "测试模式",
        prompt: "MODE_UNIQUE_FIXTURE",
      });
      await host.handle("preferences.save", {
        modeId: host.state.modes.at(-1).id,
        notifications: false,
      });
      await host.handle("send", { text: "创建复习任务", _key: "fixture-key" });
      await until(() => host.questions.size > 0 || !host.busy);
      assert.equal(host.state.automations.length, 0);
      assert.equal(host.questions.size, 1);
      const question = [...host.questions.values()][0].public;
      assert.equal(question.method, "approval/request");
      await host.handle("question.answer", {
        token: question.token,
        result: { outcome: "allowed-once" },
      });
      await until(() => !host.busy);
      assert.equal(
        host.state.automations.length,
        1,
        host.state.sessions[0].messages.at(-1).error,
      );
      assert.equal(host.state.automations[0].name, "复习提醒");
      const serialized = JSON.stringify(firstBody);
      assert.match(serialized, /MODE_UNIQUE_FIXTURE/);
      assert.match(serialized, /REVISION_SKILL_UNIQUE/);
      assert.ok(
        !readFileSync(join(home, "desktop.json"), "utf8").includes(
          "fixture-key",
        ),
      );
    } finally {
      await host.handle("shutdown");
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      rmSync(home, { recursive: true, force: true });
    }
  },
);
test(
  "real MCP stdio bridge discovers tools, requires Windows approval and returns result",
  { timeout: 30000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "winku-mcp-wire-"));
    let host,
      toolResult = false;
    const server = await serve((req, res) => {
      let raw = "";
      req.on("data", (x) => (raw += x));
      req.on("end", () => {
        const b = JSON.parse(raw),
          tool = b.tools.find((x) => x.function.name.startsWith("mcp__"));
        toolResult = b.messages.some(
          (x) =>
            x.role === "tool" && JSON.stringify(x).includes("MCP_FIXTURE_OK"),
        );
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.end(
          "data: " +
            JSON.stringify({
              choices: [
                {
                  index: 0,
                  delta: toolResult
                    ? { content: "MCP 已验证" }
                    : {
                        tool_calls: [
                          {
                            index: 0,
                            id: "mcp-fixture",
                            type: "function",
                            function: {
                              name: tool.function.name,
                              arguments: "{}",
                            },
                          },
                        ],
                      },
                  finish_reason: null,
                },
              ],
            }) +
            "\n\ndata: " +
            JSON.stringify({
              choices: [
                {
                  index: 0,
                  delta: {},
                  finish_reason: toolResult ? "stop" : "tool_calls",
                },
              ],
            }) +
            "\n\ndata: [DONE]\n\n",
        );
      });
    });
    host = new DesktopHost(dir);
    const wait = async (fn) => {
      const end = Date.now() + 20000;
      while (!fn() && Date.now() < end)
        await new Promise((r) => setTimeout(r, 25));
      assert.ok(fn(), host.engine?.stderr);
    };
    try {
      await host.handle("preferences.save", {
        access: "ask",
        notifications: false,
      });
      await host.handle("provider.save", {
        id: "fixture",
        name: "Fixture",
        model: "test",
        baseURL: "http://127.0.0.1:" + server.address().port,
        protocol: "openai-chat-completions",
      });
      await host.handle("extension.save", {
        name: "MCP Fixture",
        type: "mcp",
        transport: "stdio",
        command: process.execPath,
        args: [fileURLToPath(new URL("./mcp-fixture.mjs", import.meta.url))],
      });
      await host.handle("send", {
        text: "Call the MCP ping tool",
        _key: "fake",
      });
      await wait(() => host.questions.size || !host.busy);
      assert.equal(
        host.questions.size,
        1,
        host.state.sessions[0].messages.at(-1).error,
      );
      await host.handle("question.answer", {
        token: [...host.questions.keys()][0],
        result: { outcome: "allowed-once" },
      });
      await wait(() => !host.busy);
      assert.ok(toolResult, host.state.sessions[0].messages.at(-1).error);
    } finally {
      await host.handle("shutdown");
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

test(
  "mode restrictions reach real dsh tools without raising global permissions",
  { timeout: 30000 },
  async () => {
    const home = mkdtempSync(join(tmpdir(), "winku-mode-tools-"));
    let offered;
    const server = await serve((req, res) => {
      let raw = "";
      req.on("data", (x) => (raw += x));
      req.on("end", () => {
        offered = JSON.parse(raw).tools.map((x) => x.function.name);
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.end(
          "data: " +
            JSON.stringify({
              choices: [
                {
                  index: 0,
                  delta: { content: "Mode verified" },
                  finish_reason: null,
                },
              ],
            }) +
            "\n\ndata: " +
            JSON.stringify({
              choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
            }) +
            "\n\ndata: [DONE]\n\n",
        );
      });
    });
    const host = new DesktopHost(home);
    try {
      await host.handle("provider.save", {
        id: "fixture",
        name: "Fixture",
        model: "test",
        baseURL: "http://127.0.0.1:" + server.address().port,
        protocol: "openai-chat-completions",
      });
      await host.handle("preferences.save", {
        access: "full",
        confirmFull: true,
        notifications: false,
        tools: { shell: true, input: true, screen: true },
      });
      await host.handle("mode.save", {
        name: "限制模式",
        prompt: "",
        preset: "read-only",
        icon: "inspect_outline",
        skills: false,
        groups: { screen: false },
        engineTools: { files_write: false, subagent: false, extensions: false },
      });
      await host.handle("preferences.save", {
        modeId: host.state.modes.at(-1).id,
      });
      const route = host.features.route();
      assert.equal(route.preferences.access, "read-only");
      assert.equal(route.preferences.tools.screen, false);
      assert.equal(route.skillsDir, undefined);
      await host.handle("send", { text: "Verify tools", _key: "fake" });
      const end = Date.now() + 20000;
      while (host.busy && Date.now() < end)
        await new Promise((r) => setTimeout(r, 20));
      assert.equal(host.state.sessions[0].messages.at(-1).error, "");
      for (const name of [
        "write",
        "edit",
        "pwsh",
        "windows_input",
        "windows_screen_tree",
        "skill",
        "subagent",
      ])
        assert.ok(!offered.includes(name), name);
      assert.ok(offered.includes("read"));
    } finally {
      await host.handle("shutdown");
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      rmSync(home, { recursive: true, force: true });
    }
  },
);
