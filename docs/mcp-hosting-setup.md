# MCP Hosting Setup: Keycloak + mcp-auth-proxy on unRAID

This guide sets up a reusable pattern for hosting MCP servers on unRAID that work with Claude.ai, Claude Desktop, and other AI tools. The same Keycloak instance and pattern works for any MCP server you add.

## Architecture

```
Claude.ai / Claude Desktop / Claude Code
    |
    | HTTPS
    v
HAProxy (mcp.cl3-an.com)
    |
    | HTTP (path-based routing)
    v
mcp-auth-proxy (10.0.0.4:3100)          <-- handles OAuth 2.1 for Claude.ai
    |                    |
    | OIDC auth          | Proxied MCP requests
    v                    v
Keycloak               Bramble (10.0.0.4:3333/mcp)
(10.0.0.4:8080)          with Bearer: brk_...
```

**For each additional MCP server**, you add another mcp-auth-proxy instance on a different port and a new HAProxy route. Keycloak is shared.

---

## Step 1: Install Keycloak

1. In unRAID, go to **Docker > Add Container**
2. Use the template at `docs/unraid-templates/keycloak.xml` or enter manually:
   - **Repository:** `quay.io/keycloak/keycloak:26.5`
   - **Post Arguments:** `start-dev`
   - **Port:** `8080 → 8080`
   - **Env `KC_BOOTSTRAP_ADMIN_USERNAME`:** `admin`
   - **Env `KC_BOOTSTRAP_ADMIN_PASSWORD`:** (choose a strong password)
   - **Env `KC_PROXY_HEADERS`:** `xforwarded`
   - **Path `/opt/keycloak/data`:** `/mnt/user/appdata/keycloak`
3. Start the container
4. Open `http://10.0.0.4:8080` — you should see the Keycloak admin console

## Step 2: Configure Keycloak

### Create a Realm

1. Log in to Keycloak admin at `http://10.0.0.4:8080`
2. Click the realm dropdown (top-left, says "Keycloak") → **Create Realm**
3. Realm name: `homelab`
4. Click **Create**

### Create a User

1. In the `homelab` realm, go to **Users → Add user**
2. Set:
   - Username: your username
   - Email: your email
   - First name / Last name
   - Email verified: ON
3. Click **Create**
4. Go to the **Credentials** tab → **Set password**
5. Set a password, toggle "Temporary" OFF

### Create a Client for mcp-auth-proxy

1. Go to **Clients → Create client**
2. Client type: **OpenID Connect**
3. Client ID: `mcp-auth-proxy`
4. Click **Next**
5. Client authentication: **ON** (confidential client)
6. Authorization: OFF
7. Standard flow: **ON**
8. Direct access grants: OFF
9. Click **Next**
10. Valid redirect URIs: `https://mcp.cl3-an.com/*`
11. Web origins: `https://mcp.cl3-an.com`
12. Click **Save**
13. Go to the **Credentials** tab
14. Copy the **Client secret** — you'll need this for mcp-auth-proxy

## Step 3: Install mcp-auth-proxy

1. In unRAID, go to **Docker → Add Container**
2. Use the template at `docs/unraid-templates/mcp-auth-proxy-bramble.xml` or enter manually:
   - **Repository:** `ghcr.io/sigbit/mcp-auth-proxy:latest`
   - **Extra Parameters:** `-- http://10.0.0.4:3333`
   - **Port:** `3100 → 80`
   - **Env `EXTERNAL_URL`:** `https://mcp.cl3-an.com`
   - **Env `NO_AUTO_TLS`:** `true`
   - **Env `OIDC_CONFIGURATION_URL`:** `http://10.0.0.4:8080/realms/homelab/.well-known/openid-configuration`
   - **Env `OIDC_CLIENT_ID`:** `mcp-auth-proxy`
   - **Env `OIDC_CLIENT_SECRET`:** (paste from Keycloak step 2)
   - **Env `OIDC_ALLOWED_USERS`:** your email address
   - **Env `OIDC_PROVIDER_NAME`:** `Keycloak`
   - **Env `PROXY_BEARER_TOKEN`:** `brk_mmhKxJ55G2RTrKUkYHXc3ctTujOAnWb2LjyYwA7iXd0`
   - **Path `/data`:** `/mnt/user/appdata/mcp-auth-proxy-bramble`
3. Start the container

**Note:** The `-- http://10.0.0.4:3333` in Extra Parameters tells the proxy to forward authenticated MCP requests to your Bramble server. The `PROXY_BEARER_TOKEN` is sent as a `Bearer` header to Bramble, authenticating the request via your existing API key.

## Step 4: Configure HAProxy

Add a backend and frontend rule for the MCP proxy:

```
# Backend
backend mcp-auth-proxy
    server mcp 10.0.0.4:3100

# Frontend rule (in your HTTPS frontend)
acl host_mcp hdr(host) -i mcp.cl3-an.com
use_backend mcp-auth-proxy if host_mcp
```

Make sure HAProxy forwards the necessary headers:
```
http-request set-header X-Forwarded-Proto https
http-request set-header X-Forwarded-Host %[req.hdr(host)]
```

## Step 5: Configure Claude.ai Connector

1. Go to **Claude.ai → Settings → Connectors**
2. Click **Add custom connector**
3. Name: `Bramble`
4. URL: `https://mcp.cl3-an.com/mcp`
5. Leave OAuth Client ID and Client Secret **blank** — mcp-auth-proxy handles OAuth via Keycloak
6. Click **Add**
7. Claude.ai will redirect you to Keycloak to log in
8. Log in with your Keycloak credentials
9. You should see Bramble's tools appear

## Step 6: Verify

In a Claude.ai conversation, ask something like:

> "What plants do I have in my garden?"

Claude should call the `list_plants` tool through the MCP connector.

---

## Adding Another MCP Server

To add a new MCP server (e.g., a future `stash-sense` app):

1. **Create a new mcp-auth-proxy container** on a different port (e.g., 3101):
   - Same Keycloak config (same realm, same client, or a new client)
   - Different `EXTERNAL_URL` (e.g., `https://mcp.cl3-an.com` with path routing)
   - Different backend URL (e.g., `-- http://10.0.0.4:4000`)
   - Different `PROXY_BEARER_TOKEN` for that app

2. **Add HAProxy routing** — either by subdomain (`stash.mcp.cl3-an.com`) or path-based routing

3. **Add Claude.ai connector** pointing to the new URL

The Keycloak instance is shared — one login for all your MCP servers.

---

## Troubleshooting

### Claude.ai says "This isn't working right now"
- Check mcp-auth-proxy container logs in unRAID
- Verify `OIDC_CONFIGURATION_URL` is reachable: `curl http://10.0.0.4:8080/realms/homelab/.well-known/openid-configuration`
- Verify Bramble is reachable from the proxy: `curl -H "Authorization: Bearer brk_..." http://10.0.0.4:3333/mcp/health`

### Keycloak login page doesn't appear
- Check HAProxy is routing `mcp.cl3-an.com` to port 3100
- Check `EXTERNAL_URL` matches the domain Claude.ai connects to
- Check Keycloak's redirect URI allowlist includes `https://mcp.cl3-an.com/*`

### Authenticated but tools don't work
- Check `PROXY_BEARER_TOKEN` is set to a valid Bramble API key
- Check Bramble's MCP endpoint works directly: `curl -X POST -H "Authorization: Bearer brk_..." -H "Content-Type: application/json" http://10.0.0.4:3333/mcp`
