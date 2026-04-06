import { type FastifyInstance, type FastifyRequest } from "fastify";
import { randomBytes, createHash } from "crypto";

const MCP_API_KEY = process.env.BRAMBLE_API_KEY ?? "";

// ─── Token store ────────────────────────────────────────────────────────────

const TOKEN_TTL_MS = 3600 * 1000;
const tokens = new Map<string, number>(); // token → expiresAt

// ─── Authorization code store (PKCE) ────────────────────────────────────────

interface AuthCode {
  code: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  expiresAt: number;
}
const CODE_TTL_MS = 60 * 1000; // 1 minute
const authCodes = new Map<string, AuthCode>();

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of tokens) {
    if (now > v) tokens.delete(k);
  }
  for (const [k, v] of authCodes) {
    if (now > v.expiresAt) authCodes.delete(k);
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

function issueToken(): { access_token: string; token_type: string; expires_in: number } {
  const token = randomBytes(32).toString("base64url");
  const expiresIn = 3600;
  tokens.set(token, Date.now() + expiresIn * 1000);
  return { access_token: token, token_type: "Bearer", expires_in: expiresIn };
}

/** S256 PKCE verification */
function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  const computed = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return computed === codeChallenge;
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

  // ─── RFC 9728: Protected Resource Metadata ──────────────────────────────

  app.get("/.well-known/oauth-protected-resource", async (request) => {
    const baseUrl = getBaseUrl(request);
    return {
      resource: `${baseUrl}/mcp`,
      authorization_servers: [baseUrl],
      bearer_methods_supported: ["header"],
    };
  });

  app.get("/.well-known/oauth-protected-resource/mcp", async (request) => {
    const baseUrl = getBaseUrl(request);
    return {
      resource: `${baseUrl}/mcp`,
      authorization_servers: [baseUrl],
      bearer_methods_supported: ["header"],
    };
  });

  // ─── RFC 8414: Authorization Server Metadata ────────────────────────────

  app.get("/.well-known/oauth-authorization-server", async (request) => {
    const baseUrl = getBaseUrl(request);
    return {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      registration_endpoint: `${baseUrl}/oauth/register`,
      token_endpoint_auth_methods_supported: [
        "client_secret_post",
        "client_secret_basic",
      ],
      grant_types_supported: ["authorization_code", "client_credentials"],
      response_types_supported: ["code"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: [],
    };
  });

  // ─── Dynamic Client Registration (RFC 7591) ────────────────────────────
  // Claude.ai may register itself as a client before starting the auth flow.
  // For a single-user app, we accept any registration and return the client_id.

  app.post("/oauth/register", async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const clientId = randomBytes(16).toString("hex");
    return reply.status(201).send({
      client_id: clientId,
      client_name: body.client_name ?? "MCP Client",
      redirect_uris: body.redirect_uris ?? [],
      grant_types: body.grant_types ?? ["authorization_code"],
      response_types: body.response_types ?? ["code"],
      token_endpoint_auth_method: body.token_endpoint_auth_method ?? "client_secret_post",
    });
  });

  // ─── Authorization Endpoint ─────────────────────────────────────────────
  // Auto-approves for single-user self-hosted — you consented by setting up
  // the connector. Generates an auth code and redirects back immediately.

  app.get("/authorize", async (request, reply) => {
    const query = request.query as Record<string, string>;
    const {
      response_type,
      client_id,
      redirect_uri,
      state,
      code_challenge,
      code_challenge_method,
    } = query;

    if (response_type !== "code") {
      return reply.status(400).send({
        error: "unsupported_response_type",
        error_description: "Only 'code' response type is supported",
      });
    }

    if (!redirect_uri) {
      return reply.status(400).send({
        error: "invalid_request",
        error_description: "redirect_uri is required",
      });
    }

    if (code_challenge_method && code_challenge_method !== "S256") {
      return reply.status(400).send({
        error: "invalid_request",
        error_description: "Only S256 code challenge method is supported",
      });
    }

    // Generate authorization code
    const code = randomBytes(32).toString("base64url");
    authCodes.set(code, {
      code,
      clientId: client_id ?? "",
      redirectUri: redirect_uri,
      codeChallenge: code_challenge ?? "",
      expiresAt: Date.now() + CODE_TTL_MS,
    });

    // Build redirect URL with code and state
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set("code", code);
    if (state) {
      redirectUrl.searchParams.set("state", state);
    }

    return reply.redirect(redirectUrl.toString());
  });

  // ─── Token Endpoint ─────────────────────────────────────────────────────

  app.post("/oauth/token", async (request, reply) => {
    const body = request.body as Record<string, string | undefined>;
    const grantType = body.grant_type ?? "";
    const code = body.code ?? "";
    const codeVerifier = body.code_verifier ?? "";
    const redirectUri = body.redirect_uri ?? "";

    // Extract client secret from body or Basic auth header
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

    // ── Authorization Code Grant ──────────────────────────────────────────
    if (grantType === "authorization_code") {
      const authCode = authCodes.get(code);

      if (!authCode || Date.now() > authCode.expiresAt) {
        authCodes.delete(code);
        return reply.status(400).send({
          error: "invalid_grant",
          error_description: "Invalid or expired authorization code",
        });
      }

      // Verify redirect_uri matches
      if (redirectUri && redirectUri !== authCode.redirectUri) {
        authCodes.delete(code);
        return reply.status(400).send({
          error: "invalid_grant",
          error_description: "redirect_uri mismatch",
        });
      }

      // Verify PKCE if code_challenge was provided
      if (authCode.codeChallenge) {
        if (!codeVerifier || !verifyPkce(codeVerifier, authCode.codeChallenge)) {
          authCodes.delete(code);
          return reply.status(400).send({
            error: "invalid_grant",
            error_description: "Invalid code_verifier",
          });
        }
      }

      // Code is valid — consume it and issue token
      authCodes.delete(code);
      return issueToken();
    }

    // ── Client Credentials Grant ──────────────────────────────────────────
    if (grantType === "client_credentials") {
      if (!clientSecret || clientSecret !== MCP_API_KEY) {
        return reply.status(401).send({
          error: "invalid_client",
          error_description: "Invalid client credentials",
        });
      }
      return issueToken();
    }

    return reply.status(400).send({
      error: "unsupported_grant_type",
      error_description: "Supported: authorization_code, client_credentials",
    });
  });

  app.log.info("OAuth endpoints registered");
}

export default oauthPlugin;
