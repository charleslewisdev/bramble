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
    const isInit =
      request.method === "POST" && isInitializeRequest(request.body);
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports.has(sessionId)) {
      // Existing session — reuse transport
      transport = transports.get(sessionId)!;
    } else if (isInit) {
      // New initialize — create a fresh session. Ignore any stale sessionId
      // header the client may have cached from a previous container instance.
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
    } else if (sessionId) {
      // Client sent an unknown session ID (likely stale from before a restart).
      // Per MCP Streamable HTTP spec, 404 tells the client to re-initialize.
      return reply.status(404).send({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Session not found" },
        id: null,
      });
    } else {
      return reply.status(400).send({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No session and not an initialize request" },
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
