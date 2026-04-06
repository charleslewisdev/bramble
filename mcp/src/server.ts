import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools.js";

export function createMcpServer(): McpServer {
  return new McpServer({ name: "bramble", version: "0.1.0" });
}

export function createConfiguredMcpServer(): McpServer {
  const server = createMcpServer();
  registerTools(server);
  return server;
}

export { registerTools } from "./tools.js";
