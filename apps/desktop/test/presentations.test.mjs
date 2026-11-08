import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync } from "../engine/node_modules/fflate/esm/index.mjs";
import { DesktopHost } from "../engine/host.mjs";
import {
  createPresentation,
  presentationFile,
} from "../engine/presentations.mjs";
const deck = {
  title: "课程汇报",
  slides: [
    {
      layout: "title",
      title: "课程汇报",
      subtitle: "本机生成验证",
      notes: "讲稿备注：先讲清问题",
    },
    {
      layout: "bullets",
      title: "学习要点",
      bullets: ["理解概念", "检查结论"],
      source: "测试材料",
    },
    {
      layout: "two-column",
      title: "方法比较",
      leftTitle: "方法一",
      rightTitle: "方法二",
      left: ["先分析问题"],
      right: ["再验证结果"],
    },
    {
      layout: "chart",
      title: "测试数据",
      chart: {
        type: "bar",
        labels: ["A", "B"],
        series: [{ name: "样本", values: [2, 4] }],
      },
    },
  ],
};
const wait = async (fn) => {
  for (let i = 0; i < 800; i++) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw Error("Timed out");
};

test(
  "real dsh starts in all permission modes; PPT export approval, editable content, history and scoped file access",
  { timeout: 90000 },
  async () => {
    for (const access of ["read-only", "ask", "full"]) {
      const home = mkdtempSync(join(tmpdir(), "winku-ppt-")),
        h = new DesktopHost(home);
      let calls = 0,
        available;
      const server = createServer((req, res) => {
        let raw = "";
        req.on("data", (x) => (raw += x));
        req.on("end", () => {
          const body = JSON.parse(raw);
          calls++;
          available = body.tools?.some((t) => t.function.name === "ppt_export");
          const done = body.messages.some((m) => m.role === "tool");
          const delta =
            access === "read-only" || done
              ? { content: done ? "PPT 已生成" : "需要文件写入权限" }
              : {
                  tool_calls: [
                    {
                      index: 0,
                      id: "ppt-fixture",
                      type: "function",
                      function: {
                        name: "ppt_export",
                        arguments: JSON.stringify(deck),
                      },
                    },
                  ],
                };
          res.writeHead(200, { "content-type": "text/event-stream" });
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
                    finish_reason: delta.tool_calls ? "tool_calls" : "stop",
                  },
                ],
              }) +
              "\n\ndata: [DONE]\n\n",
          );
        });
      });
      await new Promise((r) => server.listen(0, "127.0.0.1", r));
      try {
        await h.handle("provider.save", {
          id: "fixture",
          name: "Fixture",
          model: "test",
          protocol: "openai-chat-completions",
          baseURL: "http://127.0.0.1:" + server.address().port,
        });
        await h.handle("preferences.save", {
          access,
          confirmFull: true,
          notifications: false,
        });
        const { sessionId } = await h.handle("send", {
          text: "直接生成课程汇报 PPT",
          _key: "PPT_FAKE_KEY",
        });
        if (access === "ask") {
          await wait(() => h.questions.size || !h.busy);
          assert.equal(
            h.questions.size,
            1,
            h.state.sessions[0].messages.at(-1).error,
          );
          assert.ok(!h.state.sessions[0].messages.at(-1).presentations?.length);
          const question = [...h.questions.values()][0].public;
          await h.handle("question.answer", {
            token: question.token,
            result: { outcome: "allowed-once" },
          });
        }
        await wait(() => !h.busy);
        const answer = h.state.sessions[0].messages.at(-1);
        assert.ok(!answer.error, answer.error);
        assert.equal(available, access !== "read-only");
        if (access === "read-only") {
          assert.ok(!answer.presentations?.length);
          continue;
        }
        assert.equal(h.questions.size, 0);
        assert.equal(calls, 2);
        assert.equal(answer.presentations.length, 1);
        const file = answer.presentations[0];
        assert.equal(file.pages, 4);
        const opened = await h.handle("presentation.file", {
          sessionId,
          id: file.id,
        });
        const zip = unzipSync(readFileSync(opened.path)),
          decode = (p) => new TextDecoder().decode(zip[p]);
        assert.match(decode("ppt/slides/slide1.xml"), /课程汇报/);
        assert.match(decode("ppt/notesSlides/notesSlide1.xml"), /讲稿备注/);
        assert.match(decode("ppt/charts/chart1.xml"), /样本/);
        assert.ok(!Object.keys(zip).some((n) => /vbaProject/i.test(n)));
        await assert.rejects(
          h.handle("presentation.file", { sessionId: "other", id: file.id }),
          /不存在/,
        );
        await assert.rejects(
          h.handle("presentation.file", { sessionId, id: "../private" }),
          /不存在/,
        );
        await h.handle("shutdown");
        const restored = new DesktopHost(home);
        assert.equal(
          (
            await restored.handle("presentation.file", {
              sessionId,
              id: file.id,
            })
          ).path,
          opened.path,
        );
        await restored.handle("shutdown");
        assert.ok(!readFileSync(h.file, "utf8").includes("PPT_FAKE_KEY"));
      } finally {
        await h.handle("shutdown");
        server.closeAllConnections();
        await new Promise((r) => server.close(r));
        rmSync(home, { recursive: true, force: true });
      }
    }
  },
);

test(
  "PPT exporter rejects oversized/invalid slides and cancellation without publishing files",
  { timeout: 30000 },
  async () => {
    const home = mkdtempSync(join(tmpdir(), "winku-ppt-validation-"));
    try {
      await assert.rejects(
        createPresentation({ ...deck, slides: [] }, home),
        /1–30/,
      );
      await assert.rejects(
        createPresentation(
          {
            ...deck,
            slides: [
              {
                layout: "chart",
                title: "错误",
                chart: {
                  type: "bar",
                  labels: ["A"],
                  series: [{ name: "x", values: [1, 2] }],
                },
              },
            ],
          },
          home,
        ),
        /数量/,
      );
      const controller = new AbortController();
      controller.abort();
      await assert.rejects(
        createPresentation(deck, home, controller.signal),
        /abort/i,
      );
      assert.ok(!existsSync(join(home, "presentations")));
      assert.throws(
        () => presentationFile(home, { id: "../outside", name: "a.pptx" }),
        /标识/,
      );
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  },
);
