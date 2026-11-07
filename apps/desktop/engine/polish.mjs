import { readFileSync } from "node:fs";
const instructions = readFileSync(
  new URL("./prompt-polish.md", import.meta.url),
  "utf8",
).replace(/^---[\s\S]*?---\s*/, "");
export const references = (text) =>
  [
    ...text.matchAll(
      /```[\s\S]*?```|`[^`\n]+`|https?:\/\/[^\s<>]+|[A-Za-z]:[\\/][^\s"<>]+|(?<!\S)@[^\s]+|(?<!\S)\/[^\s]+/g,
    ),
  ].map((x) => x[0]);
export async function polish(provider, key, draft, signal) {
  if (!draft?.trim() || draft.length > 8000)
    throw Error("请输入提示词，最多 8000 字。");
  const protocol = provider.protocol;
  const body = { model: provider.model, stream: false };
  let path;
  if (protocol === "openai-responses") {
    path = "/responses";
    Object.assign(body, {
      instructions,
      input: draft,
      max_output_tokens: 2048,
    });
  } else {
    path =
      protocol === "anthropic-messages" ? "/messages" : "/chat/completions";
    body.messages = [{ role: "user", content: draft }];
    if (protocol === "anthropic-messages") body.system = instructions;
    else body.messages.unshift({ role: "system", content: instructions });
    body[
      protocol === "openai-chat-completions" &&
      /^(gpt-5|o1|o3|o4)/i.test(provider.model.split("/").at(-1))
        ? "max_completion_tokens"
        : "max_tokens"
    ] = 2048;
  }
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(protocol === "anthropic-messages"
      ? { "x-api-key": key, "anthropic-version": "2023-06-01" }
      : { Authorization: "Bearer " + key }),
  };
  const response = await fetch(provider.baseURL.replace(/\/$/, "") + path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    redirect: "error",
    signal,
  });
  if (!response.ok)
    throw Error(`润色失败（HTTP ${response.status}），请检查模型服务。`);
  const reader = response.body.getReader();
  let chunks = [],
    size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 131072) throw Error("润色响应过长，请缩短草稿重试。");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  let text;
  if (payload.error) throw Error("模型未能完成润色，请重试。");
  if (protocol === "openai-chat-completions") {
    const choice = payload.choices?.[0];
    if (!["stop", "end_turn"].includes(choice?.finish_reason))
      throw Error("润色结果未完成，原草稿已保留。");
    text = choice.message?.content;
  } else if (protocol === "anthropic-messages") {
    if (payload.stop_reason !== "end_turn")
      throw Error("润色结果未完成，原草稿已保留。");
    text = payload.content
      ?.filter((x) => x.type === "text")
      .map((x) => x.text)
      .join("");
  } else {
    if (payload.status !== "completed")
      throw Error("润色结果未完成，原草稿已保留。");
    text = payload.output
      ?.filter((x) => x.type === "message")
      .flatMap((x) => x.content ?? [])
      .filter((x) => x.type === "output_text")
      .map((x) => x.text)
      .join("");
  }
  if (typeof text !== "string" || !text.trim() || text.length > 12000)
    throw Error("润色结果无效，原草稿已保留。");
  if (references(draft).some((x) => !text.includes(x)))
    throw Error("润色改变了引用或链接，原草稿已保留。");
  return { text: text.trim() };
}
