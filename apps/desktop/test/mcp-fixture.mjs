import { createInterface } from "node:readline";
for await (const line of createInterface({ input: process.stdin })) {
  const m = JSON.parse(line);
  if (m.id === undefined) continue;
  const result =
    m.method === "initialize"
      ? {
          protocolVersion: m.params.protocolVersion,
          capabilities: { tools: {} },
          serverInfo: { name: "winku-test", version: "1" },
        }
      : m.method === "tools/list"
        ? {
            tools: [
              {
                name: "ping",
                description: "Read-only fixture ping",
                inputSchema: { type: "object", properties: {} },
              },
            ],
          }
        : m.method === "tools/call"
          ? { content: [{ type: "text", text: "MCP_FIXTURE_OK" }] }
          : {};
  process.stdout.write(
    JSON.stringify({ jsonrpc: "2.0", id: m.id, result }) + "\n",
  );
}
