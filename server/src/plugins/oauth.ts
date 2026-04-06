import { type FastifyInstance, type FastifyRequest } from "fastify";
import { randomBytes } from "crypto";

const MCP_API_KEY = process.env.BRAMBLE_API_KEY ?? "";

// In-memory token store: token → expiresAt timestamp
const TOKEN_TTL_MS = 3600 * 1000;
const tokens = new Map<string, number>();

// Periodic cleanup of expired tokens
setInterval(() => {
  const now = Date.now();
  for (const [token, expiresAt] of tokens) {
    if (now > expiresAt) tokens.delete(token);
  }
}, 60_000).unref();

/** Validate an OAuth-issued access token */
export function validateOAuthToken(token: string): boolean {
  const expiresAt = tokens.get(token);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    tokens.delete(token);
    return false;
  }
  return true;
}

function getBaseUrl(request: FastifyRequest): string {
  const proto = request.headers["x-forwarded-proto"] || "http";
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  return `${proto}://${host}`;
}

async function oauthPlugin(app: FastifyInstance) {
  if (!MCP_API_KEY) {
    app.log.info("BRAMBLE_API_KEY not set — OAuth endpoints disabled");
    return;
  }

  // Parse application/x-www-form-urlencoded for the token endpoint
  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_req, body, done) => {
      try {
        const params = new URLSearchParams(body as string);
        const result: Record<string, string> = {};
        for (const [key, value] of params) {
          result[key] = value;
        }
        done(null, result);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  // RFC 9728: Protected Resource Metadata
  app.get("/.well-known/oauth-protected-resource", async (request) => {
    const baseUrl = getBaseUrl(request);
    return {
      resource: `${baseUrl}/mcp`,
      authorization_servers: [baseUrl],
      bearer_methods_supported: ["header"],
    };
  });

  // Same metadata at path-suffixed URL (some clients append the resource path)
  app.get("/.well-known/oauth-protected-resource/mcp", async (request) => {
    const baseUrl = getBaseUrl(request);
    return {
      resource: `${baseUrl}/mcp`,
      authorization_servers: [baseUrl],
      bearer_methods_supported: ["header"],
    };
  });

  // RFC 8414: Authorization Server Metadata
  app.get("/.well-known/oauth-authorization-server", async (request) => {
    const baseUrl = getBaseUrl(request);
    return {
      issuer: baseUrl,
      token_endpoint: `${baseUrl}/oauth/token`,
      token_endpoint_auth_methods_supported: [
        "client_secret_post",
        "client_secret_basic",
      ],
      grant_types_supported: ["client_credentials"],
      response_types_supported: [],
      scopes_supported: [],
    };
  });

  // OAuth Token Endpoint — client_credentials grant
  app.post("/oauth/token", async (request, reply) => {
    const body = request.body as Record<string, string>;

    // Support both client_secret_post and client_secret_basic
    let clientSecret = body.client_secret;
    if (!clientSecret) {
      const authHeader = request.headers.authorization;
      if (authHeader?.startsWith("Basic ")) {
        const decoded = Buffer.from(authHeader.slice(6), "base64").toString();
        const colonIdx = decoded.indexOf(":");
        if (colonIdx !== -1) {
          clientSecret = decoded.slice(colonIdx + 1);
        }
      }
    }

    if (body.grant_type !== "client_credentials") {
      return reply.status(400).send({
        error: "unsupported_grant_type",
        error_description: "Only client_credentials grant is supported",
      });
    }

    if (!clientSecret || clientSecret !== MCP_API_KEY) {
      return reply.status(401).send({
        error: "invalid_client",
        error_description: "Invalid client credentials",
      });
    }

    const token = randomBytes(32).toString("base64url");
    const expiresIn = 3600;
    tokens.set(token, Date.now() + expiresIn * 1000);

    return {
      access_token: token,
      token_type: "Bearer",
      expires_in: expiresIn,
    };
  });

  app.log.info("OAuth endpoints registered");
}

export default oauthPlugin;
