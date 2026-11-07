// The fence contract matches Android RichContent.kt. Consume every top-level
// fence, including ordinary code, so teaching examples inside code stay code.
const supported = new Set([
  "dsh-visual",
  "mermaid",
  "math",
  "dsh-html",
  "latex",
]);
const types = new Set([
  "function",
  "diagram",
  "chart",
  "quiz",
  "math",
  "table",
  "code",
  "html",
  "explanation",
]);
export function parseRichContent(text) {
  const lines = text.split("\n"),
    parts = [];
  let pending = "";
  const plain = (i) => {
    pending += lines[i] + (i < lines.length - 1 ? "\n" : "");
  };
  const flush = () => {
    if (pending) parts.push({ text: pending });
    pending = "";
  };
  for (let i = 0; i < lines.length; ) {
    const opening = /^ {0,3}(`{3,}|~{3,})([^\r\n]*)$/.exec(
      lines[i].replace(/\r$/, ""),
    );
    if (!opening) {
      plain(i++);
      continue;
    }
    const marker = opening[1],
      language = opening[2].trim().toLowerCase().split(" ")[0];
    let end = i + 1;
    while (end < lines.length) {
      const line = lines[end].replace(/\r$/, ""),
        closing = line.replace(/^ */, "").trimEnd();
      if (
        (line.match(/^ */)?.[0].length ?? 0) <= 3 &&
        closing.length >= marker.length &&
        [...closing].every((c) => c === marker[0])
      )
        break;
      end++;
    }
    if (end === lines.length) {
      while (i < lines.length) plain(i++);
      break;
    }
    const body = lines
      .slice(i + 1, end)
      .join("\n")
      .replace(/\r$/, "");
    let spec;
    if (supported.has(language) && body.length <= 150_000) {
      try {
        if (language === "dsh-visual") {
          const value = JSON.parse(body);
          if (value && types.has(value.type)) spec = value;
        } else if (language === "mermaid")
          spec = { type: "diagram", source: body };
        else if (language === "dsh-html") spec = { type: "html", html: body };
        else spec = { type: "math", latex: body };
      } catch {
        /* Incomplete or invalid data stays readable as original code. */
      }
    }
    if (spec) {
      flush();
      parts.push({ spec });
      i = end + 1;
    } else while (i <= end) plain(i++);
  }
  flush();
  return parts;
}
