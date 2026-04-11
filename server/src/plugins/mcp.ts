import { type FastifyInstance, type FastifyRequest, type FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import { createConfiguredMcpServer } from "bramble-mcp/server";

async function mcpPlugin(app: FastifyInstance) {
  const transports = new Map<string, StreamableHTTPServerTransport>();

  app.all("/mcp", async (request: FastifyRequest, reply: FastifyReply) => {
    // Auth is handled by the auth plugin (onRequest hook) which sets request.user
    // for valid Bearer tokens (brk_ API keys looked up in DB)
    if (!request.user) {
      return reply.status(401).send({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Unauthorized" },
        id: null,
      });
    }

    const sessionId = request.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports.has(sessionId)) {
      transport = transports.get(sessionId)!;
    } else if (!sessionId && request.method === "POST" && isInitializeRequest(request.body)) {
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
      return reply.status(400).send({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session" },
        id: null,
      });
    }

    // Tell Fastify we're taking over the response
    reply.hijack();
    await transport.handleRequest(request.raw, reply.raw, request.body);
  });

  // MCP health check
  app.get("/mcp/health", async () => ({
    status: "ok",
    name: "bramble-mcp",
    transport: "http",
  }));

  // Clean up active sessions on shutdown
  app.addHook("onClose", async () => {
    for (const transport of transports.values()) {
      await transport.close();
    }
    transports.clear();
  });

  app.log.info("MCP endpoint registered at /mcp");
}

export default fp(mcpPlugin, { name: "mcp" });
