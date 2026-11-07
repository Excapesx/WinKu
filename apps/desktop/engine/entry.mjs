import { runCli } from "@deepseek-ai/dsh/lib/bin.js";
process.argv = [
  process.argv[0],
  process.argv[1],
  "--profile",
  "sdk",
  "--patch",
  process.env.WINKU_ENGINE_PATCH,
];
await runCli();
