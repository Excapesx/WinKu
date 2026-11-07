import { build, context } from "esbuild";
import {
  mkdir,
  copyFile,
  writeFile,
  readdir,
  readFile,
  rm,
} from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import "./sync-android-design.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  out = join(root, "dist"),
  nm = join(root, "node_modules");
if (out !== join(root, "dist")) throw Error("Unexpected frontend output path");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const options = {
  absWorkingDir: root,
  entryPoints: ["src/main.tsx"],
  bundle: true,
  splitting: true,
  format: "esm",
  minify: true,
  target: ["chrome120"],
  outdir: out,
  entryNames: "app",
  chunkNames: "chunks/[name]-[hash]",
  loader: { ".woff2": "file", ".woff": "file", ".ttf": "file" },
  assetNames: "fonts/[name]-[hash]",
  nodePaths: [nm],
  alias: { react: join(nm, "react"), "react-dom": join(nm, "react-dom") },
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "linked",
  logLevel: "info",
};
await copyFile(join(root, "index.html"), join(out, "index.html"));
await copyFile(
  join(root, "../android/learning-ui/sandbox.html"),
  join(out, "sandbox.html"),
);
await build({
  entryPoints: [join(root, "../android/learning-ui/src/sandbox.ts")],
  bundle: true,
  minify: true,
  target: ["chrome120"],
  outfile: join(out, "sandbox.js"),
  nodePaths: [nm],
});
await copyFile(
  join(nm, "pdfjs-dist/build/pdf.worker.min.mjs"),
  join(out, "pdf.worker.min.mjs"),
);
// Ship attribution with the assets, including notices retained by the bundler.
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8")),
  licenses = [];
for (const name of Object.keys(pkg.dependencies)) {
  const dir = join(nm, name),
    meta = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
  const file = (await readdir(dir)).find((x) => /^licen[sc]e(\.|$)/i.test(x));
  licenses.push(
    name +
      " " +
      meta.version +
      " / " +
      meta.license +
      "\n" +
      (file ? await readFile(join(dir, file), "utf8") : ""),
  );
}
await writeFile(
  join(out, "THIRD-PARTY-LICENSES.txt"),
  licenses.join("\n\n----------------\n\n"),
);
if (process.argv.includes("--serve")) {
  const ctx = await context(options);
  await ctx.watch();
  await ctx.serve({ host: "127.0.0.1", port: 1420, servedir: out });
  console.log("WinKu desktop preview: http://localhost:1420");
} else await build(options);
