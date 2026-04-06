#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import { randomUUID } from "crypto";
import { createConfiguredMcpServer } from "./server.js";

const TRANSPORT = process.env.MCP_TRANSPORT ?? "stdio"; // "stdio" or "http"
const PORT = parseInt(process.env.MCP_PORT ?? "3100", 10);

// ─── Stdio transport (for Claude Code / local use) ──────────────────────────

async function startStdio() {
  const server = createConfiguredMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// ─── HTTP transport (for Claude.ai / remote connectors) ─────────────────────

async function startHttp() {
  const app = express();
  app.use(express.json());

  const transports = new Map<string, StreamableHTTPServerTransport>();

  app.all("/mcp", async (req, res) => {
    try {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports.has(sessionId)) {
        transport = transports.get(sessionId)!;
      } else if (!sessionId && req.method === "POST" && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            transports.set(sid, transport);
          },
        });
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) transports.delete(sid);
        };
        const server = createConfiguredMcpServer();
        await server.connect(transport);
      } else {
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Bad Request: No valid session" },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", name: "bramble-mcp", transport: "http" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Bramble MCP server (HTTP) listening on port ${PORT}`);
    console.log(`Endpoint: http://0.0.0.0:${PORT}/mcp`);
  });
}

// ─── Entry point ────────────────────────────────────────────────────────────

if (TRANSPORT === "http") {
  startHttp().catch((err) => {
    console.error("MCP HTTP server error:", err);
    process.exit(1);
  });
} else {
  startStdio().catch((err) => {
    console.error("MCP stdio server error:", err);
    process.exit(1);
  });
}
