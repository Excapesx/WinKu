import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { zipSync, strToU8 } from "../engine/node_modules/fflate/esm/index.mjs";
import { DesktopHost } from "../engine/host.mjs";
import { EngineClient } from "../engine/client.mjs";
const until = async (fn) => {
  for (let i = 0; i < 500; i++) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw Error("condition timed out");
};
const listen = async (fn) => {
  const s = createServer(fn);
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  return s;
};
const close = async (s) => {
  s.closeAllConnections();
  await new Promise((r) => s.close(r));
};
const fixture = async (url) => {
  const home = mkdtempSync(join(tmpdir(), "winku-continuation-")),
    h = new DesktopHost(home);
  await h.handle("provider.save", {
    id: "test",
    name: "Test",
    model: "fixture",
    protocol: "openai-chat-completions",
    baseURL: url,
  });
  return h;
};
const dispose = async (h) => {
  await h.handle("shutdown");
  assert.ok(h.home.startsWith(join(tmpdir(), "winku-continuation-")));
  rmSync(h.home, { recursive: true, force: true });
};
test(
  "queue drains in order; editing/removal, failure, stop and restart preserve drafts; mode stays bound",
  { timeout: 60000 },
  async () => {
    let gate,
      requests = 0,
      fail = false;
    const seen = [];
    const server = await listen((req, res) => {
      let raw = "";
      req.on("data", (b) => (raw += b));
      req.on("end", () => {
        const body = JSON.parse(raw);
        seen.push(body);
        requests++;
        if (fail) {
          res.writeHead(401);
          res.end('{"error":{"message":"fixture failure"}}');
          return;
        }
        res.writeHead(200, { "content-type": "text/event-stream" });
        const end = () =>
          res.end(
            "data: " +
              JSON.stringify({
                choices: [
                  {
                    index: 0,
                    delta: { content: "Answer " + requests },
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
        if (requests === 1 || requests === 4) gate = end;
        else end();
      });
    });
    let h = await fixture("http://127.0.0.1:" + server.address().port);
    try {
      const { sessionId } = await h.handle("send", {
        text: "one",
        _key: "fake",
      });
      await until(() => gate && h.active?.ready);
      await h.handle("send", { sessionId, text: "two", _key: "fake" });
      await h.handle("send", { sessionId, text: "remove", _key: "fake" });
      await h.handle("queue.remove", {
        sessionId,
        id: h.state.sessions[0].queue.at(-1).id,
      });
      assert.deepEqual(
        h.state.sessions[0].queue.map((x) => x.text),
        ["two"],
      );
      assert.ok(!readFileSync(h.file, "utf8").includes('"_key"'));
      gate();
      await until(() => !h.busy && requests === 2);
      assert.equal(
        h.state.sessions[0].messages.filter((x) => x.role === "user").length,
        2,
      );
      await h.handle("preferences.save", {
        modeId: "code",
        language: "en",
        busySend: "steer",
      });
      assert.equal(h.state.sessions[0].mode.id, "study");
      assert.equal(h.features.route(h.state.sessions[0]).mode.id, "study");
      fail = true;
      await h.handle("send", { sessionId, text: "fail", _key: "fake" });
      await until(() => !h.busy);
      assert.match(h.state.sessions[0].messages.at(-1).error, /fixture/);
      fail = false;
      gate = null;
      await h.handle("send", { sessionId, text: "stop", _key: "fake" });
      await until(() => gate && h.active?.ready);
      await h.handle("send", {
        sessionId,
        text: "keep after stop",
        _key: "fake",
      });
      await h.handle("stop");
      await until(() => !h.busy);
      assert.equal(h.state.sessions[0].queue[0].text, "keep after stop");
      await assert.rejects(
        h.handle("regenerate", { sessionId, _key: "fake" }),
        /排队消息/,
      );
      await h.handle("shutdown");
      h = new DesktopHost(h.home);
      assert.equal(h.state.sessions[0].queue[0].text, "keep after stop");
      const q = h.state.sessions[0].queue[0];
      await h.handle("queue.send", { sessionId, id: q.id, _key: "fake" });
      await until(() => !h.busy);
      assert.equal(h.state.sessions[0].queue.length, 0);
    } finally {
      await dispose(h);
      await close(server);
    }
  },
);
test(
  "real dsh steer reaches the next model request and is logged once",
  { timeout: 30000 },
  async () => {
    let endFirst;
    const bodies = [];
    const server = await listen((req, res) => {
      let raw = "";
      req.on("data", (b) => (raw += b));
      req.on("end", () => {
        bodies.push(JSON.parse(raw));
        res.writeHead(200, { "content-type": "text/event-stream" });
        const end = () =>
          res.end(
            "data: " +
              JSON.stringify({
                choices: [
                  {
                    index: 0,
                    delta: { content: "part " + bodies.length },
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
        if (bodies.length === 1) endFirst = end;
        else end();
      });
    });
    const h = await fixture("http://127.0.0.1:" + server.address().port);
    try {
      const { sessionId } = await h.handle("send", {
        text: "start",
        _key: "fake",
      });
      await until(() => endFirst && h.active?.ready);
      const receipt = await h.handle("send", {
        sessionId,
        text: "STEER_NEXT",
        now: true,
        _key: "fake",
      });
      assert.equal(receipt.delivery, "step");
      endFirst();
      await until(() => !h.busy);
      assert.ok(bodies.length >= 2);
      assert.ok(JSON.stringify(bodies.at(-1)).includes("STEER_NEXT"));
      const s = h.state.sessions[0];
      assert.equal(s.messages.filter((x) => x.text === "STEER_NEXT").length, 1);
      assert.ok(!s.messages.some((x) => x.pending));
      assert.equal(s.queue.length, 0);
    } finally {
      await dispose(h);
      await close(server);
    }
  },
);
test(
  "skill ZIP assets/import lifecycle, malicious paths and authenticated MCP probe",
  { timeout: 30000 },
  async () => {
    const h = await fixture("http://127.0.0.1:1");
    let auth;
    const server = await listen((req, res) => {
      if (req.url === "/index.json") {
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            format: 1,
            title: "Fixture index",
            plugins: [
              {
                name: "winku-fixture-plugin",
                title: { zh: "测试插件", en: "Fixture plugin" },
                versions: [
                  {
                    version: "1.0.0",
                    publishTimestamp: 1,
                    source: { type: "npm" },
                  },
                ],
              },
            ],
          }),
        );
        return;
      }
      auth = req.headers.authorization;
      if (req.method !== "POST") {
        res.writeHead(405);
        res.end();
        return;
      }
      let raw = "";
      req.on("data", (b) => (raw += b));
      req.on("end", () => {
        const m = JSON.parse(raw);
        if (m.id === undefined) {
          res.writeHead(202);
          res.end();
          return;
        }
        const result =
          m.method === "initialize"
            ? {
                protocolVersion: m.params.protocolVersion,
                capabilities: { tools: {} },
                serverInfo: { name: "fixture", version: "1" },
              }
            : {
                tools: [
                  {
                    name: "ping",
                    inputSchema: { type: "object", properties: {} },
                  },
                ],
              };
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ jsonrpc: "2.0", id: m.id, result }));
      });
    });
    try {
      const text =
        "---\nname: imported\ndescription: A fixture\n---\nRead resources/a.txt";
      const zip = zipSync({
        "folder/SKILL.md": strToU8(text),
        "folder/resources/a.txt": strToU8("ASSET"),
      });
      const preview = await h.handle("skill.preview", {
        name: "skill.zip",
        data: Buffer.from(zip).toString("base64"),
      });
      assert.equal(preview.skills[0].name, "imported");
      await h.handle("skill.import", { token: preview.token });
      const skill = h.state.extensions[0],
        path = join(h.home, "skills", skill.id, "resources/a.txt");
      assert.equal(readFileSync(path, "utf8"), "ASSET");
      await h.handle("extension.toggle", { id: skill.id, enabled: false });
      assert.ok(!existsSync(join(h.home, "skills", skill.id, "SKILL.md")));
      await h.handle("extension.toggle", { id: skill.id, enabled: true });
      assert.ok(existsSync(path));
      const bad = zipSync({ "../bad/SKILL.md": strToU8(text) });
      await assert.rejects(
        h.handle("skill.preview", {
          data: Buffer.from(bad).toString("base64"),
        }),
        /路径/,
      );
      const mcp = {
        id: "mcp-test",
        name: "fixture",
        type: "mcp",
        transport: "streamable-http",
        url: "http://127.0.0.1:" + server.address().port,
      };
      await h.handle("extension.save", mcp);
      const result = await h.handle("mcp.test", {
        ...mcp,
        _secrets: { headers: { Authorization: "Bearer TEST_ONLY" } },
      });
      assert.equal(result.tools[0].name, "ping");
      assert.equal(auth, "Bearer TEST_ONLY");
      assert.ok(!readFileSync(h.file, "utf8").includes("TEST_ONLY"));
      const r = await h.handle("mcp.test", {
        ...mcp,
        transport: "stdio",
        command: process.execPath,
        args: [resolve("test/mcp-fixture.mjs")],
        confirmLaunch: true,
      });
      assert.equal(r.tools[0].name, "ping");
      const indexURL =
        "http://127.0.0.1:" + server.address().port + "/index.json";
      await h.handle("market.save", { urls: [indexURL] });
      const market = await h.handle("market.read", { url: indexURL });
      assert.equal(
        market.plugins[0].versions[0].spec,
        "winku-fixture-plugin@1.0.0",
      );
      await assert.rejects(
        h.handle("market.save", { urls: ["file:///C:/private.json"] }),
        /HTTPS/,
      );
      await h.handle("extension.delete", { id: skill.id });
      assert.ok(!existsSync(path));
    } finally {
      await dispose(h);
      await close(server);
    }
  },
);
test(
  "bundled pnpm installs, activates, disables and removes a real local dsh bundle",
  { timeout: 120000 },
  async () => {
    const h = await fixture("http://127.0.0.1:1"),
      plugin = join(h.home, "fixture-plugin");
    mkdirSync(plugin);
    writeFileSync(
      join(plugin, "package.json"),
      JSON.stringify({
        name: "winku-fixture-plugin",
        version: "1.0.0",
        type: "module",
        dsh: { bundle: { patch: "./bundle.yml" } },
      }),
    );
    writeFileSync(
      join(plugin, "bundle.yml"),
      "- insert:\n  - id: winku-fixture\n    name: winku-fixture-plugin/plugin.js\n",
    );
    writeFileSync(
      join(plugin, "plugin.js"),
      'export const name="fixture";export const inject=["skills"];export function apply(ctx){ctx.skills.register({name:"plugin-fixture-skill",description:"Fixture plugin skill",content:"Read the fixture",source:"runtime"});}',
    );
    try {
      const inspection = await h.handle("plugins.inspect", { spec: plugin });
      assert.equal(inspection.status, "accepted");
      await h.handle("plugins.install", { spec: plugin, confirmTrust: true });
      let list = await h.handle("plugins.list");
      let b = list.bundles.find((x) => x.name === "winku-fixture-plugin");
      assert.ok(b?.enabled);
      assert.ok(
        list.skills.some(
          (x) => x.name === "plugin-fixture-skill" && x.source === "runtime",
        ),
      );
      const workspaceSkill = join(
        h.home,
        "engine/workspace/.agents/skills/workspace-fixture",
      );
      mkdirSync(workspaceSkill, { recursive: true });
      writeFileSync(
        join(workspaceSkill, "SKILL.md"),
        "---\nname: workspace-fixture\ndescription: A workspace skill\n---\nExplain clearly",
      );
      list = await h.handle("plugins.list");
      assert.ok(
        list.skills.some(
          (x) =>
            x.name === "workspace-fixture" && x.source === "custom" && x.path.includes(".agents"),
        ),
      );
      assert.ok(
        list.plugins.some(
          (x) =>
            x.moduleName.includes("winku-fixture-plugin") &&
            x.fiberPhase === "active",
        ),
      );
      const installed = join(
        h.home,
        "engine/dsh/profiles/sdk/node_modules/winku-fixture-plugin/bundle.yml",
      );
      writeFileSync(installed, "- insert: [invalid YAML");
      list = await h.handle("plugins.list");
      assert.ok(
        list.bundles.some((x) => x.name === b.name),
        "broken third-party plugins must remain manageable",
      );
      const recovery = new EngineClient(() => {});
      try {
        const recovered = await recovery.start(
          {
            id: "control",
            model: "control",
            protocol: "openai-chat-completions",
            baseURL: "http://127.0.0.1:1",
            desktop: { preferences: { access: "read-only", tools: {} } },
          },
          "",
          join(h.home, "engine"),
          "safe",
        );
        assert.equal(recovered.safeMode, true);
        assert.ok(recovered.bundles.some((x) => x.name === b.name));
      } finally {
        await recovery.stop();
      }
      await h.handle("plugins.toggle", {
        name: b.name,
        enabled: false,
        confirmTrust: true,
      });
      list = await h.handle("plugins.list");
      assert.equal(list.bundles.find((x) => x.name === b.name).enabled, false);
      assert.ok(!list.skills.some((x) => x.name === "plugin-fixture-skill"));
      await h.handle("plugins.delete", { name: b.name, confirmTrust: true });
      list = await h.handle("plugins.list");
      assert.ok(!list.bundles.some((x) => x.name === b.name));
    } finally {
      await dispose(h);
    }
  },
);
