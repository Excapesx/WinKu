import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRichContent } from "../src/rich-content.mjs";

test("Android teaching fences: HTML, CRLF, indents and longer closing fences", () => {
  const parts = parseRichContent(
    "讲解\r\n  ```DSH-HTML\r\n<p>互动内容</p>\r\n  ````\r\n\n~~~math\n\\frac{1}{2}\n~~~",
  );
  assert.equal(parts[0].text, "讲解\r\n");
  assert.deepEqual(
    parts.filter((p) => p.spec).map((p) => p.spec),
    [
      { type: "html", html: "<p>互动内容</p>" },
      { type: "math", latex: "\\frac{1}{2}" },
    ],
  );
});
test("teaching source inside a normal code example is never executed", () => {
  const source =
    "````markdown\n```dsh-html\n<button>只是代码</button>\n```\n````";
  assert.deepEqual(parseRichContent(source), [{ text: source }]);
});
test("unfinished, unsupported, oversized and malformed artifacts remain original text", () => {
  for (const source of [
    '```dsh-visual\n{"type":"quiz"}',
    '```dsh-visual\n{"type":"unknown"}\n```',
    "```dsh-visual\n{broken}\n```",
    "```math\n" + "x".repeat(150_001) + "\n```",
  ])
    assert.deepEqual(parseRichContent(source), [{ text: source }]);
});
