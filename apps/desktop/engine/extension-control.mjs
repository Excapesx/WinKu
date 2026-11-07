import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PluginManager } from "@deepseek-ai/dsh-plugin-manager";
export const name = "winku-extension-control";
export const inject = ["loader", "profileContext"];
export function apply(ctx) {
  const root = dirname(fileURLToPath(import.meta.url));
  if (process.env.WINKU_EXTENSION_SAFE) {
    // A broken third-party bundle must not prevent its own disable/remove flow.
    // The recovery process boots cleanly, then manages the real SDK profile.
    ctx.profileContext.name = "sdk";
    ctx.profileContext.dir = join(process.env.DSH_HOME, "profiles", "sdk");
    ctx.profileContext.patchPath = join(
      ctx.profileContext.dir,
      "cordis.patch.yml",
    );
  }
  // Ship the package manager; a recipient does not need Node or pnpm on PATH.
  ctx.profileContext.packageManager = {
    command: process.execPath,
    args: [join(root, "node_modules/pnpm/bin/pnpm.mjs")],
    env: { ...process.env, npm_config_ignore_scripts: "true" },
  };
  let ready;
  const manager = async () => {
    if (!ready)
      ready = (async () => {
        const existing = ctx.get("pluginManager");
        if (existing) return existing;
        await ctx.plugin(PluginManager, { idleTimeoutMs: 90000 });
        return ctx.get("pluginManager");
      })().catch((e) => {
        ready = null;
        throw e;
      });
    return ready;
  };
  ctx.on("sdk-extensions/resolve", (method) => {
    if (!method.startsWith("desktop/ext/")) return;
    return async (p) => {
      const pm = await manager();
      switch (method.slice(12)) {
        case "list":
          const catalog = await ctx.get("skills")?.snapshot({
            cwd: join(process.env.DSH_HOME, "..", "workspace"),
          });
          return {
            safeMode: !!process.env.WINKU_EXTENSION_SAFE,
            bundles: await pm.listBundles(),
            plugins: await pm.listPlugins(),
            skillsComplete: catalog?.complete ?? false,
            skills: (catalog?.skills ?? []).map(
              ({ name, description, source, provider, path }) => ({
                name,
                description,
                source,
                provider,
                path,
              }),
            ),
          };
        case "inspect":
          return pm.inspect(p.spec);
        case "install":
          return pm.installBundle(p.spec, {
            enabled: true,
            saveExact: true,
            requestId: p.requestId,
            ...(p.registry ? { registry: p.registry } : {}),
          });
        case "toggle":
          return pm.setBundleEnabled(p.name, p.enabled === true);
        case "delete":
          return pm.removeBundle(p.name);
        default:
          throw Error("未知扩展操作。");
      }
    };
  });
}
