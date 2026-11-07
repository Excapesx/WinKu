import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DesktopHost } from "../engine/host.mjs";
const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADklEQVQImWP4DwYMEAoAU7oL9W/sIDEAAAAASUVORK5CYII=";
for (const protocol of ["openai-responses", "anthropic-messages"])
  test(
    protocol + " through the real dsh carrier, including image input",
    { timeout: 45000 },
    async () => {
      const home = mkdtempSync(join(tmpdir(), "winku-wire-test-"));
      let requestBody;
      const server = createServer((req, res) => {
        let raw = "";
        req.on("data", (b) => (raw += b));
        req.on("end", () => {
          requestBody = JSON.parse(raw);
          res.writeHead(200, { "content-type": "text/event-stream" });
          const event = (type, value) =>
            res.write(
              "event: " +
                type +
                "\ndata: " +
                JSON.stringify({ type, ...value }) +
                "\n\n",
            );
          if (protocol === "anthropic-messages") {
            event("message_start", {
              message: {
                id: "fixture",
                type: "message",
                role: "assistant",
                model: "fixture",
                content: [],
                usage: { input_tokens: 10, output_tokens: 0 },
              },
            });
            event("content_block_start", {
              index: 0,
              content_block: { type: "text", text: "" },
            });
            event("content_block_delta", {
              index: 0,
              delta: { type: "text_delta", text: "Vision fixture OK" },
            });
            event("content_block_stop", { index: 0 });
            event("message_delta", {
              delta: { stop_reason: "end_turn", stop_sequence: null },
              usage: { output_tokens: 4 },
            });
            event("message_stop", {});
          } else {
            const item = {
              id: "msg-fixture",
              type: "message",
              role: "assistant",
              status: "completed",
              content: [
                {
                  type: "output_text",
                  text: "Vision fixture OK",
                  annotations: [],
                },
              ],
            };
            event("response.created", {
              response: {
                id: "resp-fixture",
                status: "in_progress",
                model: "fixture",
                output: [],
              },
            });
            event("response.output_item.added", {
              output_index: 0,
              item: { ...item, status: "in_progress", content: [] },
            });
            event("response.content_part.added", {
              item_id: item.id,
              output_index: 0,
              content_index: 0,
              part: { type: "output_text", text: "", annotations: [] },
            });
            event("response.output_text.delta", {
              item_id: item.id,
              output_index: 0,
              content_index: 0,
              delta: "Vision fixture OK",
            });
            event("response.output_text.done", {
              item_id: item.id,
              output_index: 0,
              content_index: 0,
              text: "Vision fixture OK",
            });
            event("response.output_item.done", { output_index: 0, item });
            event("response.completed", {
              response: {
                id: "resp-fixture",
                status: "completed",
                model: "fixture",
                output: [item],
                usage: { input_tokens: 10, output_tokens: 4, total_tokens: 14 },
              },
            });
          }
          res.end();
        });
      });
      await new Promise((r) => server.listen(0, "127.0.0.1", r));
      const host = new DesktopHost(home);
      try {
        await host.handle("provider.save", {
          id: "fixture",
          name: "fixture",
          model: "fixture",
          protocol,
          vision: true,
          baseURL: "http://127.0.0.1:" + server.address().port + "/v1",
        });
        await host.handle("send", {
          text: "Describe this image",
          _key: "fixture-key",
          attachments: [
            {
              kind: "image",
              name: "sample.png",
              mimeType: "image/png",
              data: png,
            },
          ],
        });
        const until = Date.now() + 25000;
        while (host.busy && Date.now() < until)
          await new Promise((r) => setTimeout(r, 30));
        const answer = host.state.sessions[0].messages.at(-1);
        assert.equal(answer.error, "", answer.error);
        assert.equal(answer.text, "Vision fixture OK");
        assert.match(JSON.stringify(requestBody), /input_image|"type":"image"/);
      } finally {
        await host.handle("shutdown");
        server.closeAllConnections();
        await new Promise((r) => server.close(r));
        rmSync(home, { recursive: true, force: true });
      }
    },
  );
