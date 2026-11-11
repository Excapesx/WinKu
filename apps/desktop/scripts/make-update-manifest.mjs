import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

export async function windowsManifest({ installer, signature, tag, notes, version, publishedAt = new Date().toISOString() }) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error("A stable semver version is required");
  if (!/^[\w.-]+$/.test(tag)) throw Error("Invalid release tag");
  if (!installer.endsWith("-setup.exe") || !(await stat(installer)).isFile()) throw Error("NSIS installer required");
  if (basename(installer).includes("-validation")) throw Error("A CI validation installer cannot be published as an update");
  const sig = (await readFile(signature ?? installer + ".sig", "utf8")).trim();
  const decoded = Buffer.from(sig, "base64").toString("utf8");
  if (!decoded.startsWith("untrusted comment:") || !decoded.includes("trusted comment:")) throw Error("Missing or invalid Tauri update signature");
  const bytes = await readFile(installer);
  return {
    version, notes, pub_date: publishedAt,
    platforms: { "windows-x86_64": { signature: sig, url: `https://github.com/Excapesx/WinKu/releases/download/${tag}/${encodeURIComponent(basename(installer))}` } },
    size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, i, all) => i % 2 ? pairs : [...pairs, [value.replace(/^--/, ""), all[i + 1]]], []));
  if (!args.installer || !args.tag || !args.notes || !args.output) throw Error("Required: --installer path --tag tag --notes notes.md --output latest.json");
  const config = JSON.parse(await readFile(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"));
  const manifest = await windowsManifest({ installer: args.installer, signature: args.signature, tag: args.tag, notes: await readFile(args.notes, "utf8"), version: config.version });
  await mkdir(dirname(resolve(args.output)), { recursive: true });
  await writeFile(args.output, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Wrote Windows update manifest ${manifest.version} (${manifest.size} bytes)`);
}
