import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, realpathSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const audio = new Set([".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg", ".opus"]);
const office = new Set([".docx", ".xlsx", ".pptx"]);
const pictures = new Set([".png", ".jpg", ".jpeg"]);
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

function extension(name) {
  return typeof name === "string" ? extname(name).toLowerCase() : "";
}

function validAttachment(key) {
  if (typeof key !== "string" || !uuid.test(key.slice(0, 36)) || key.slice(36) !== extension(key)) return false;
  const ext = extension(key);
  return audio.has(ext) || office.has(ext) || pictures.has(ext);
}

export function stageAttachment(workspace, { key, name, offset, size, data, cancel }) {
  const ext = extension(name);
  if (!validAttachment(key) || extension(key) !== ext) throw Error("附件类型不支持");
  const folder = join(workspace, "attachments");
  mkdirSync(folder, { recursive: true });
  const temporary = join(folder, key + ".part");
  const target = join(folder, key);
  if (cancel) { rmSync(temporary, { force: true }); return {}; }
  const max = (audio.has(ext) ? 192 : 20) * 1024 * 1024;
  if (!Number.isInteger(size) || size <= 0 || size > max || !Number.isInteger(offset) || offset < 0 ||
      typeof data !== "string" || data.length > 360000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data) || existsSync(target))
    throw Error("附件格式或大小无效");
  const bytes = Buffer.from(data, "base64");
  const current = existsSync(temporary) ? statSync(temporary).size : 0;
  if (offset !== current || !bytes.length || offset + bytes.length > size) throw Error("附件传输顺序无效");
  appendFileSync(temporary, bytes);
  if (offset + bytes.length === size) renameSync(temporary, target);
  return {};
}

export function attachmentPath(workspace, key) {
  if (!validAttachment(key)) throw Error("附件标识无效");
  const folder = realpathSync(join(workspace, "attachments"));
  const file = realpathSync(join(folder, key));
  if (dirname(file) !== folder || !statSync(file).isFile()) throw Error("附件已移动或不可读");
  return file;
}

export function presentationPath(workspace, id) {
  if (typeof id !== "string" || !uuid.test(id)) throw Error("演示文稿标识无效");
  const folder = realpathSync(join(workspace, "presentations"));
  const file = realpathSync(join(folder, `${id}.pptx`));
  if (dirname(file) !== folder || extname(file).toLowerCase() !== ".pptx" || !statSync(file).isFile())
    throw Error("演示文稿已移动或不可读");
  return file;
}

async function worker(operation, args, signal) {
  const python = process.env.WINKU_STUDY_PYTHON || join(here, "../runtime/python/python.exe");
  if (!existsSync(python)) throw Error("缺少 WinKu 学习工具运行环境，请使用完整安装包。");
  const { stdout } = await run(python, [join(here, "study-worker.py"), operation, ...args], {
    windowsHide: true, signal, timeout: 14 * 60_000, maxBuffer: 2 * 1024 * 1024,
    env: { SystemRoot: process.env.SystemRoot, PATH: process.env.PATH, TEMP: process.env.TEMP, TMP: process.env.TMP, PYTHONUTF8: "1" },
  }).catch((error) => { throw Error(error.stderr?.trim().split(/\r?\n/).at(-1)?.slice(0, 400) || error.message); });
  return JSON.parse(stdout.trim().split(/\r?\n/).at(-1));
}

export function registerStudyTools(ctx, config, publish) {
  const { workspace, preferences } = config;
  if (config.skills === false || !preferences?.tools?.files) return;
  const add = (name, description, properties, required, execute) => ctx.tools.register({
    name, description,
    parameters: { type: "object", properties, required, additionalProperties: false },
    output: { schema: {}, render: (_args, value) => [{ type: "text", text: String(value) }] },
    execute: (args, exec) => execute(args, exec.signal),
    timeoutMs: 15 * 60_000,
  });
  const string = { type: "string" }, integer = { type: "integer" };
  if (preferences.engineTools?.files_read !== false) {
    add("lecture_transcribe", "Transcribe a recording attached by the user locally. Pass its attachment key as path. Start and end are seconds, at most 20 minutes apart. The first use downloads the offline speech model.",
      { path: string, start: integer, end: integer }, ["path"], async ({ path, start = 0, end = start + 1200 }, signal) => {
        if (!audio.has(extension(path)) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start || end - start > 1200)
          throw Error("请选择录音附件和不超过 20 分钟的时间段。");
        const result = await worker("transcribe", [attachmentPath(workspace, path), join(workspace, "../lecture-models"), String(start), String(end)], signal);
        return `Decoded ${start}s to ${result.end}s. Source transcript only:\n${result.text}`;
      });
    add("ppt_read_source", "Read an attached Word, Excel or PowerPoint document. Pass the attachment key as path; start is the 1-based character offset.",
      { path: string, start: integer }, ["path"], async ({ path, start = 1 }, signal) => {
        if (!office.has(extension(path)) || !Number.isSafeInteger(start) || start < 1) throw Error("请选择 Office 文档附件。");
        const text = await worker("office", [attachmentPath(workspace, path)], signal);
        const part = text.slice(start - 1, start - 1 + 12000);
        if (!part.trim()) throw Error("这个范围内没有可读取的文字。");
        return part + (start - 1 + part.length < text.length ? `\nContinue with start=${start + part.length}.` : "");
      });
  }
  if (preferences.access === "read-only" || preferences.engineTools?.files_write === false) return;
  add("ppt_export", "Export drafted SVG slides as an editable PowerPoint file. The draft directory must be directly under the workspace ppt-drafts directory.",
    { directory: string, title: string, language: string }, ["directory", "title"], async ({ directory, title, language = "zh-CN" }, signal) => {
      const dir = realpathSync(resolve(workspace, directory));
      if (dirname(dir) !== realpathSync(join(workspace, "ppt-drafts")) || !statSync(dir).isDirectory() ||
          !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$/.test(language)) throw Error("演示文稿草稿目录或语言无效。");
      const id = randomUUID(), folder = join(workspace, "presentations");
      const name = (title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim().slice(0, 80).replace(/\.pptx$/i, "") || "WinKu") + ".pptx";
      const staging = join(folder, `${id}.tmp`), output = join(folder, `${id}.pptx`);
      mkdirSync(folder, { recursive: true });
      const attachments = join(workspace, "attachments");
      mkdirSync(attachments, { recursive: true });
      try {
        const count = await worker("ppt", [join(here, "../runtime/ppt-master-renderer.zip"), dir, attachments, staging, language], signal);
        signal?.throwIfAborted();
        if (!Number.isInteger(count) || count < 1 || !statSync(staging).size) throw Error("PPT 导出结果为空。");
        renameSync(staging, output);
        await publish({ id, name });
        return `Created ${name} (${count} slides). The user can open it in the chat.`;
      } finally { rmSync(staging, { force: true }); }
    });
}
