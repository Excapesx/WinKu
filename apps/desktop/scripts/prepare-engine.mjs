import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  mkdirSync,
  cpSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const patches = join(root, "../android/js/patches"),
  nm = join(root, "engine/node_modules");
// Apply portable Android fixes exactly, with context verification. Never apply the
// Android native/shell/profile patches to a Windows installation.
const selected = new Set([
  "02",
  "08",
  "10",
  "11",
  "14",
  "15",
  "16",
  "17",
  "18",
  "21",
  "22",
  "23",
  "24",
]);
const marker = join(nm, ".winku-patched");
if (!existsSync(marker)) {
  for (const filename of readdirSync(patches)
    .filter((n) => selected.has(n.slice(0, 2)))
    .sort()) {
    const lines = readFileSync(join(patches, filename), "utf8")
      .replaceAll("\r", "")
      .split("\n");
    let target,
      source,
      offset = 0;
    const flush = () => {
      if (target) writeFileSync(target, source.join("\n"));
    };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("+++ b/")) {
        flush();
        const relative = line
          .slice(6)
          .trim()
          .replace(/^node_modules\//, "");
        target = join(nm, relative);
        source = readFileSync(target, "utf8").replaceAll("\r", "").split("\n");
        offset = 0;
      } else if (line.startsWith("@@ ")) {
        const match = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
        if (!match) throw Error("Invalid patch: " + filename);
        const old = [],
          replacement = [];
        while (
          i + 1 < lines.length &&
          /^[ +\-\\]/.test(lines[i + 1]) &&
          !lines[i + 1].startsWith("--- a/")
        ) {
          const s = lines[++i];
          if (s[0] === " " || s[0] === "-") old.push(s.slice(1));
          if (s[0] === " " || s[0] === "+") replacement.push(s.slice(1));
        }
        let at = Number(match[1]) - 1 + offset;
        const matches = (n) =>
          source.slice(n, n + old.length).join("\n") === old.join("\n");
        if (!matches(at)) {
          const candidates = [];
          for (let n = 0; n <= source.length - old.length; n++)
            if (matches(n)) candidates.push(n);
          if (candidates.length !== 1)
            throw Error("Patch context mismatch: " + filename + " " + line);
          at = candidates[0];
        }
        source.splice(at, old.length, ...replacement);
        offset += replacement.length - old.length;
      }
    }
    flush();
    console.log("Applied " + filename);
  }
  writeFileSync(marker, "dsh 0.2.1-rc.5 / WinKu portable fixes\n");
}
const shared = join(root, "../android/js/packages/plugin-guard");
for (const name of [
  "learning.js",
  "learning-templates.js",
  "assistant-stream.js",
])
  cpSync(join(shared, name), join(root, "engine", name));
const runtime = join(root, "runtime");
cpSync(join(root,"../android/app/src/main/assets/skills/prompt-polish/SKILL.md"),join(root,"engine/prompt-polish.md"));
mkdirSync(runtime, { recursive: true });
cpSync(process.execPath, join(runtime, "node.exe"));
if (!existsSync(join(runtime, "NODE-LICENSE"))) {
  const response = await fetch(
    "https://raw.githubusercontent.com/nodejs/node/" +
      process.version +
      "/LICENSE",
  );
  if (!response.ok)
    throw Error(
      "Could not obtain the bundled Node license: " + response.status,
    );
  writeFileSync(join(runtime, "NODE-LICENSE"), await response.text());
}
console.log("Windows engine prepared; Node " + process.version);
