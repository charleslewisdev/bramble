#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createConfiguredMcpServer } from "./server.js";

async function main() {
  const server = createConfiguredMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP stdio server error:", err);
  process.exit(1);
});
