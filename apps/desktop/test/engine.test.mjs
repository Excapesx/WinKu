import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DesktopHost } from "../engine/host.mjs";

test(
  "real Windows dsh: streaming, attachment context, regeneration, restart/resume, failure recovery and process cleanup",
  { timeout: 120000 },
  async () => {
    const home = mkdtempSync(join(tmpdir(), "winku-engine-test-"));
    let sequence = 0,
      fail = false,
      hang = false;
    const calls = [];
    const server = createServer((req, res) => {
      let raw = "";
      req.on("data", (b) => (raw += b));
      req.on("end", () => {
        const body = JSON.parse(raw);
        calls.push(body);
        if (fail) {
          res.writeHead(401, { "content-type": "application/json" });
          res.end(
            JSON.stringify({ error: { message: "fixture auth failure" } }),
          );
          return;
        }
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.write(
          "data: " +
            JSON.stringify({
              choices: [
                {
                  index: 0,
                  delta: { role: "assistant", content: "answer " + ++sequence },
                  finish_reason: null,
                },
              ],
              usage: null,
            }) +
            "\n\n",
        );
        if (hang) return;
        setTimeout(() => {
          res.write(
            "data: " +
              JSON.stringify({
                choices: [
                  {
                    index: 0,
                    delta: { content: " complete" },
                    finish_reason: null,
                  },
                ],
              }) +
              "\n\n",
          );
          res.end(
            "data: " +
              JSON.stringify({
                choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
              }) +
              "\n\ndata: [DONE]\n\n",
          );
        }, 50);
      });
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    let host = new DesktopHost(home);
    const fixtureKey = "fixture-not-a-real-api-key";
    const settle = async () => {
      const until = Date.now() + 20000;
      while (host.busy && Date.now() < until)
        await new Promise((r) => setTimeout(r, 30));
      assert.equal(host.busy, false, host.engine?.stderr);
    };
    try {
      await assert.rejects(
        host.handle("provider.save", { id: "../escape", name: "fixture" }),
        /ID/,
      );
      await assert.rejects(
        host.handle("provider.save", {
          id: "fixture",
          name: "fixture",
          model: "model",
          protocol: "openai-chat-completions",
          baseURL: "http://unsafe.example/v1",
        }),
        /HTTPS/,
      );
      await host.handle("provider.save", {
        id: "fixture",
        name: "fixture",
        model: "model",
        protocol: "openai-chat-completions",
        baseURL: "http://127.0.0.1:" + server.address().port + "/v1",
        apiKey: fixtureKey,
      });
      const first = await host.handle("send", {
        text: "Explain my note",
        _key: fixtureKey,
        attachments: [
          { kind: "document", name: "note.md", text: "source content" },
        ],
      });
      await assert.rejects(
        host.handle("send", { text: "duplicate", _key: fixtureKey }),
        /正在回答/,
      );
      await settle();
      assert.equal(
        host.state.sessions[0].messages.at(-1).text,
        "answer 1 complete",
      );
      assert.ok(JSON.stringify(calls[0]).includes("source content"));
      // The product persona, teaching contract and read-only tool set reach the real model adapter.
      const prompt = JSON.stringify(calls[0]);
      assert.match(prompt, /You are WinKu/);
      assert.match(prompt, /underbrace/);
      assert.match(prompt, /dsh-visual/);
      const tools = calls[0].tools ?? [];
      for (const forbidden of ["write", "edit", "pwsh", "bash"])
        assert.ok(
          !tools.some((t) => t.function?.name === forbidden),
          forbidden,
        );
      await host.handle("regenerate", {
        sessionId: first.sessionId,
        _key: fixtureKey,
      });
      await settle();
      assert.equal(host.state.sessions[0].messages.length, 2);
      assert.equal(
        host.state.sessions[0].messages[1].text,
        "answer 2 complete",
      );
      await host.handle("artifact.save", {
        sessionId: first.sessionId,
        id: "card-1",
        value: { quiz: { index: 1 } },
      });
      const pid = host.engine.child.pid;
      await host.handle("shutdown");
      assert.throws(() => process.kill(pid, 0));
      host = new DesktopHost(home);
      assert.equal(host.state.sessions[0].artifacts["card-1"].quiz.index, 1);
      await host.handle("send", {
        sessionId: first.sessionId,
        text: "Follow up",
        _key: fixtureKey,
      });
      await settle();
      assert.equal(
        host.state.sessions[0].messages.at(-1).text,
        "answer 3 complete",
      );
      assert.ok(JSON.stringify(calls.at(-1)).includes("Explain my note"));
      fail = true;
      await host.handle("regenerate", {
        sessionId: first.sessionId,
        _key: fixtureKey,
      });
      await settle();
      assert.equal(
        host.state.sessions[0].messages.at(-1).text,
        "answer 3 complete",
      );
      assert.match(
        host.state.sessions[0].messages.at(-1).error,
        /401|auth|credential/i,
      );
      fail = false;
      hang = true;
      await host.handle("send", {
        sessionId: first.sessionId,
        text: "Stop test",
        _key: fixtureKey,
      });
      const until = Date.now() + 15000;
      while (sequence < 4 && Date.now() < until)
        await new Promise((r) => setTimeout(r, 30));
      assert.equal(sequence, 4);
      await host.handle("stop");
      await settle();
      assert.equal(host.state.sessions[0].messages.at(-1).interrupted, true);
      assert.equal(host.engine, null);
      assert.ok(
        !readFileSync(join(home, "desktop.json"), "utf8").includes(fixtureKey),
      );
      assert.ok(
        !readFileSync(join(home, "engine/desktop.patch.json"), "utf8").includes(
          fixtureKey,
        ),
      );
      await host.handle("session.delete", { id: first.sessionId });
      assert.equal(host.state.sessions.length, 0);
    } finally {
      await host.handle("shutdown");
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      rmSync(home, { recursive: true, force: true });
    }
  },
);

test("corrupt data fails loudly instead of overwriting history", () => {
  const home = mkdtempSync(join(tmpdir(), "winku-data-test-"));
  try {
    writeFileSync(join(home, "desktop.json"), "{broken");
    assert.throws(() => new DesktopHost(home));
    assert.equal(readFileSync(join(home, "desktop.json"), "utf8"), "{broken");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("Windows carrier uses the inherited learning components and OS credentials", () => {
  const root = resolve(import.meta.dirname, "..");
  const rust = readFileSync(join(root, "src-tauri/src/main.rs"), "utf8");
  assert.match(rust, /JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE/);
  assert.match(rust, /set_password/);
  assert.match(rust, /get_password/);
  const teaching = readFileSync(join(root, "src/Teaching.tsx"), "utf8");
  for (const name of [
    "MathText",
    "FunctionPlot",
    "Explanation",
    "normalizeSpec",
  ])
    assert.ok(
      teaching.includes(
        "../../android/learning-ui/src/" +
          name.replace("normalizeSpec", "schema.mjs"),
      ),
      name,
    );
});
