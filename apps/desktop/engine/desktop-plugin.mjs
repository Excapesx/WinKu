import { setupAssistantStream } from "./assistant-stream.js";
import { learningPrompt } from "./learning.js";
export const name = "winku-desktop";
export const inject = ["systemPrompt"];
export function apply(ctx) {
  setupAssistantStream(ctx);
  ctx.systemPrompt.section({
    name: "winku:learning",
    order: 60,
    text: learningPrompt
      .replaceAll("on this phone", "on this Windows computer")
      .replaceAll("phone diagrams", "desktop diagrams"),
  });
}
