import { runCli } from "@deepseek-ai/dsh/lib/bin.js";
process.argv = [
  process.argv[0],
  process.argv[1],
  "--profile",
  process.env.WINKU_EXTENSION_SAFE ? "sdk-control" : "sdk",
  ...(process.env.WINKU_EXTENSION_SAFE ? ["--from-default-profile", "sdk"] : []),
  "--patch",
  process.env.WINKU_ENGINE_PATCH,
];
await runCli();
