# Auth, Users & Roles — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add cookie-based auth with three garden-themed roles (Groundskeeper/Gardener/Helper), invite flow, and setup-mode for first run.

**Architecture:** New `users`, `sessions`, `invites` tables via Drizzle. Fastify plugin for session middleware. Role-based route guards. React auth context with login/setup/invite pages.

**Tech Stack:** `@node-rs/argon2` (password hashing), `@fastify/cookie` (session cookies), `crypto` (token generation), Drizzle ORM, React context + TanStack Query.

---

### Task 1: Install dependencies

**Files:**
- Modify: `server/package.json`

**Step 1: Install server dependencies**

Run:
```bash
cd /home/carrot/code/bramble && pnpm add --filter server @node-rs/argon2 @fastify/cookie
```

**Step 2: Verify installation**

Run: `cd /home/carrot/code/bramble && pnpm ls --filter server @node-rs/argon2 @fastify/cookie`
Expected: Both packages listed

**Step 3: Commit**

```bash
git add server/package.json server/pnpm-lock.yaml pnpm-lock.yaml
git commit -m "chore: add argon2 and fastify-cookie dependencies for auth"
```

---

### Task 2: Schema — users, sessions, invites tables

**Files:**
- Modify: `server/src/db/schema.ts` (add tables + types at end)

**Step 1: Add schema definitions**

Add to `server/src/db/schema.ts` before the type exports section:

```typescript
// ─── Users ──────────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  email: text("email").unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", {
    enum: ["groundskeeper", "gardener", "helper"],
  }).notNull(),
  avatarUrl: text("avatar_url"),
  lastLoginAt: text("last_login_at"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("users_username_idx").on(table.username),
]);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
}));

// ─── Sessions ───────────────────────────────────────────────────────────────

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // random 256-bit token
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  userAgent: text("user_agent"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("sessions_user_id_idx").on(table.userId),
  index("sessions_expires_at_idx").on(table.expiresAt),
]);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// ─── Invites ────────────────────────────────────────────────────────────────

export const invites = sqliteTable("invites", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  token: text("token").notNull().unique(),
  role: text("role", {
    enum: ["gardener", "helper"],
  }).notNull(),
  createdBy: integer("created_by")
    .notNull()
    .references(() => users.id),
  claimedBy: integer("claimed_by").references(() => users.id),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("invites_token_idx").on(table.token),
]);

export const invitesRelations = relations(invites, ({ one }) => ({
  creator: one(users, {
    fields: [invites.createdBy],
    references: [users.id],
  }),
}));
```

Add type exports alongside existing ones:

```typescript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Invite = typeof invites.$inferSelect;
```

**Step 2: Add createdBy columns to content tables**

Add `createdBy` to these existing tables in `schema.ts`: `plantPhotos`, `careTaskLogs`, `journalEntries`, `shoppingListItems`.

```typescript
createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
```

**Step 3: Generate migration**

Run:
```bash
cd /home/carrot/code/bramble/server && pnpm db:generate
```

Review the generated SQL file in `server/drizzle/` — should create 3 new tables and ALTER the 4 existing tables.

**Step 4: Test migration applies cleanly**

Run:
```bash
cd /home/carrot/code/bramble/server && pnpm db:migrate
```

**Step 5: Verify TypeScript compiles**

Run: `cd /home/carrot/code/bramble && npx tsc --noEmit -p server/tsconfig.json`

**Step 6: Commit**

```bash
git add server/src/db/schema.ts server/drizzle/
git commit -m "feat: add users, sessions, invites tables and createdBy columns"
```

---

### Task 3: Auth service — password hashing and session management

**Files:**
- Create: `server/src/services/auth.ts`
- Create: `server/src/services/auth.test.ts`

**Step 1: Write tests for auth service**

```typescript
// server/src/services/auth.test.ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, generateSessionToken, generateInviteToken } from "./auth.js";

describe("auth service", () => {
  describe("password hashing", () => {
    it("hashes and verifies a password", async () => {
      const hash = await hashPassword("test-password-123");
      expect(hash).not.toBe("test-password-123");
      expect(await verifyPassword("test-password-123", hash)).toBe(true);
    });

    it("rejects wrong password", async () => {
      const hash = await hashPassword("correct-password");
      expect(await verifyPassword("wrong-password", hash)).toBe(false);
    });
  });

  describe("token generation", () => {
    it("generates unique session tokens", () => {
      const a = generateSessionToken();
      const b = generateSessionToken();
      expect(a).not.toBe(b);
      expect(a.length).toBeGreaterThan(30);
    });

    it("generates URL-safe invite tokens", () => {
      const token = generateInviteToken();
      expect(token.length).toBeGreaterThan(15);
      expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd /home/carrot/code/bramble/server && pnpm test -- src/services/auth.test.ts`
Expected: FAIL — module not found

**Step 3: Implement auth service**

```typescript
// server/src/services/auth.ts
import { hash, verify } from "@node-rs/argon2";
import { randomBytes } from "crypto";

export async function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return verify(passwordHash, password);
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function generateInviteToken(): string {
  return randomBytes(16).toString("base64url");
}

/** Session duration: 30 days */
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Invite duration: 7 days */
export const INVITE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
```

**Step 4: Run tests to verify they pass**

Run: `cd /home/carrot/code/bramble/server && pnpm test -- src/services/auth.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/src/services/auth.ts server/src/services/auth.test.ts
git commit -m "feat: auth service — password hashing and token generation"
```

---

### Task 4: Auth middleware — session validation and role guards

**Files:**
- Create: `server/src/plugins/auth.ts`

**Step 1: Implement auth plugin**

This Fastify plugin:
1. Registers `@fastify/cookie`
2. Adds an `onRequest` hook that checks the session cookie
3. Decorates the request with `user` (or null)
4. Exports `requireAuth` and `requireRole` helper functions for routes

```typescript
// server/src/plugins/auth.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fastifyCookie from "@fastify/cookie";
import { db, schema } from "../db/index.js";
import { eq, and, gt, count } from "drizzle-orm";

// Role hierarchy: higher index = more power
const ROLE_LEVELS = { helper: 0, gardener: 1, groundskeeper: 2 } as const;
export type Role = keyof typeof ROLE_LEVELS;

declare module "fastify" {
  interface FastifyRequest {
    user: { id: number; username: string; displayName: string; role: Role } | null;
    setupMode: boolean;
  }
}

export async function authPlugin(app: FastifyInstance) {
  await app.register(fastifyCookie);

  // Decorate request with defaults
  app.decorateRequest("user", null);
  app.decorateRequest("setupMode", false);

  app.addHook("onRequest", async (request: FastifyRequest) => {
    // Check setup mode (0 users)
    const [{ total }] = db.select({ total: count() }).from(schema.users).all();
    if (total === 0) {
      request.setupMode = true;
      return;
    }

    const token = request.cookies.bramble_session;
    if (!token) return;

    const now = new Date().toISOString();
    const session = db
      .select()
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.id, token),
          gt(schema.sessions.expiresAt, now),
        ),
      )
      .get();

    if (!session) return;

    const user = db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.users.displayName,
        role: schema.users.role,
      })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.id, session.userId),
          eq(schema.users.isActive, true),
        ),
      )
      .get();

    if (user) {
      request.user = user as { id: number; username: string; displayName: string; role: Role };
    }
  });
}

/** Route-level guard: must be logged in */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (request.setupMode) {
    return reply.status(403).send({ error: "Setup required", setupMode: true });
  }
  if (!request.user) {
    return reply.status(401).send({ error: "Not authenticated" });
  }
}

/** Route-level guard: must have at least this role */
export function requireRole(minRole: Role) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;
    const userLevel = ROLE_LEVELS[request.user!.role];
    const requiredLevel = ROLE_LEVELS[minRole];
    if (userLevel < requiredLevel) {
      return reply.status(403).send({ error: "Insufficient permissions" });
    }
  };
}
```

**Step 2: Commit**

```bash
git add server/src/plugins/auth.ts
git commit -m "feat: auth middleware — session validation and role guards"
```

---

### Task 5: Auth routes — login, logout, setup, password change

**Files:**
- Create: `server/src/routes/auth.ts`
- Create: `server/src/routes/auth.test.ts`

**Step 1: Write integration tests**

Test setup flow (POST /api/auth/setup), login, me, logout, password change. Use Fastify `inject()` pattern from existing route tests.

**Step 2: Implement auth routes**

Key routes:
- `POST /api/auth/setup` — only works when 0 users, creates Groundskeeper, returns session cookie
- `POST /api/auth/login` — validates credentials, creates session, sets cookie
- `GET /api/auth/me` — returns current user from session (or 401, or `{ setupMode: true }`)
- `POST /api/auth/logout` — deletes session, clears cookie
- `PUT /api/auth/password` — change own password (requires current password)

Cookie settings: `httpOnly: true`, `sameSite: 'lax'`, `secure: process.env.NODE_ENV === 'production'`, `path: '/'`, `maxAge: SESSION_MAX_AGE_MS / 1000`

**Step 3: Run tests**

Run: `cd /home/carrot/code/bramble/server && pnpm test -- src/routes/auth.test.ts`

**Step 4: Commit**

```bash
git add server/src/routes/auth.ts server/src/routes/auth.test.ts
git commit -m "feat: auth routes — setup, login, logout, password change"
```

---

### Task 6: Invite routes

**Files:**
- Create: `server/src/routes/invites.ts`

**Step 1: Implement invite routes**

- `POST /api/auth/invites` — Groundskeeper creates invite (role + optional expiry)
- `GET /api/auth/invites` — Groundskeeper lists all invites
- `DELETE /api/auth/invites/:id` — Groundskeeper revokes invite
- `GET /api/auth/invites/:token` — Public: check if invite is valid (returns role, not sensitive data)
- `POST /api/auth/invites/:token/claim` — Public: claim invite (username + password) → creates user + session

**Step 2: Commit**

```bash
git add server/src/routes/invites.ts
git commit -m "feat: invite routes — create, list, revoke, claim"
```

---

### Task 7: User management routes

**Files:**
- Create: `server/src/routes/users.ts`

**Step 1: Implement user routes**

- `GET /api/users` — Groundskeeper: list all users
- `PUT /api/users/:id/role` — Groundskeeper: change user role (can't demote self)
- `PUT /api/users/:id/active` — Groundskeeper: activate/deactivate user (can't deactivate self)
- `GET /api/auth/sessions` — Groundskeeper: all sessions; others: own sessions
- `DELETE /api/auth/sessions/:id` — Groundskeeper: any session; others: own session only

**Step 2: Commit**

```bash
git add server/src/routes/users.ts
git commit -m "feat: user management routes — list, role change, deactivate"
```

---

### Task 8: Wire auth into Fastify app + protect existing routes

**Files:**
- Modify: `server/src/index.ts`

**Step 1: Register auth plugin and routes**

In `server/src/index.ts`:
1. Register `authPlugin` before all route registrations
2. Register auth routes at `/api/auth`
3. Register invite routes at `/api/auth/invites`
4. Register user routes at `/api/users`

**Step 2: Add auth guards to existing routes**

Add `preHandler` hooks to all existing route files:
- Routes that need Gardener+: locations, zones, plants (write ops), care-tasks (create/edit/delete), settings, notifications, fertilizers, structures
- Routes that allow Helper: care-task logs, shopping list (add/toggle), photos (upload), journal (create own)
- Read routes: `requireAuth` only (any authenticated role can read)

Pattern per route file — add `onRequest` to the plugin:
```typescript
export async function someRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireAuth);
  // ... routes, with per-route preHandler for role checks
}
```

**Step 3: Ensure health check stays public**

`GET /api/health` must NOT require auth.

**Step 4: Run all server tests**

Run: `cd /home/carrot/code/bramble/server && pnpm test`
Expected: All pass (existing tests may need session cookie injection)

**Step 5: Commit**

```bash
git add server/src/index.ts server/src/routes/*.ts
git commit -m "feat: wire auth into app, protect all existing routes"
```

---

### Task 9: Frontend — auth context and API functions

**Files:**
- Create: `web/src/auth/AuthContext.tsx`
- Create: `web/src/auth/useAuth.ts`
- Modify: `web/src/api/index.ts` (add auth API functions + `credentials: 'include'`)

**Step 1: Add `credentials: 'include'` to fetch wrapper**

In `web/src/api/index.ts`, update the `request` function so cookies are sent:
```typescript
const res = await fetch(`${BASE}${path}`, {
  ...init,
  credentials: "include",
  headers,
});
```

**Step 2: Add auth API functions**

```typescript
// Auth types
export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  role: "groundskeeper" | "gardener" | "helper";
  email: string | null;
  avatarUrl: string | null;
}

export interface AuthStatus {
  user: AuthUser | null;
  setupMode: boolean;
}

// Auth API
export function getMe(): Promise<AuthUser> {
  return request<AuthUser>("/auth/me");
}

export function login(username: string, password: string): Promise<AuthUser> {
  return post<AuthUser>("/auth/login", { username, password });
}

export function logout(): Promise<void> {
  return post<void>("/auth/logout", {});
}

export function setup(data: { username: string; displayName: string; password: string }): Promise<AuthUser> {
  return post<AuthUser>("/auth/setup", data);
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return put<void>("/auth/password", { currentPassword, newPassword });
}

export function getInviteInfo(token: string): Promise<{ role: string; expiresAt: string }> {
  return request<{ role: string; expiresAt: string }>(`/auth/invites/${token}`);
}

export function claimInvite(token: string, data: { username: string; displayName: string; password: string }): Promise<AuthUser> {
  return post<AuthUser>(`/auth/invites/${token}/claim`, data);
}
```

**Step 3: Create AuthContext**

`AuthContext` provides: `user`, `setupMode`, `isLoading`, `login()`, `logout()`, `refresh()`.

Calls `GET /api/auth/me` on mount. If 403 with `setupMode: true`, sets setupMode. If 401, user is null.

**Step 4: Commit**

```bash
git add web/src/auth/ web/src/api/index.ts
git commit -m "feat: frontend auth context and API functions"
```

---

### Task 10: Frontend — login, setup, and invite pages

**Files:**
- Create: `web/src/pages/Login.tsx`
- Create: `web/src/pages/Setup.tsx`
- Create: `web/src/pages/InviteClaim.tsx`

**Step 1: Build login page**

Simple form: username + password. On success, `auth.login()` → redirects to `/`. Error display for wrong credentials. Bramble-themed styling consistent with existing pages.

**Step 2: Build setup page**

"Welcome to Bramble" — username, display name, password, confirm password. Creates the Groundskeeper account. Only shown when `setupMode` is true.

**Step 3: Build invite claim page**

Route: `/invite/:token`. Fetches invite info to show the assigned role. Form: username, display name, password. On claim success → logged in, redirect to `/`.

**Step 4: Commit**

```bash
git add web/src/pages/Login.tsx web/src/pages/Setup.tsx web/src/pages/InviteClaim.tsx
git commit -m "feat: login, setup, and invite claim pages"
```

---

### Task 11: Frontend — route protection and auth wiring

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/main.tsx`

**Step 1: Wrap app in AuthProvider**

In `main.tsx`, add `<AuthProvider>` inside `QueryClientProvider`.

**Step 2: Add route protection to App.tsx**

- Add `/login`, `/setup`, `/invite/:token` routes (public)
- Wrap all existing routes in a `<ProtectedRoute>` component that checks auth context
- `ProtectedRoute`: if loading → spinner, if setupMode → redirect to `/setup`, if not authenticated → redirect to `/login`

**Step 3: Add user menu to layout**

Show current user's display name + role badge in the layout header/nav. Logout button. Link to settings for Groundskeepers.

**Step 4: Verify the full flow works**

Run dev servers, test: setup → login → navigate → logout → login again.

**Step 5: Commit**

```bash
git add web/src/App.tsx web/src/main.tsx web/src/components/
git commit -m "feat: route protection, auth wiring, user menu"
```

---

### Task 12: Frontend — role-based UI guards

**Files:**
- Modify: various page components

**Step 1: Create role guard utility**

```typescript
// web/src/auth/useAuth.ts (add to existing)
export function useCanEdit(): boolean {
  const { user } = useAuth();
  return user?.role === "groundskeeper" || user?.role === "gardener";
}

export function useIsGroundskeeper(): boolean {
  const { user } = useAuth();
  return user?.role === "groundskeeper";
}
```

**Step 2: Hide write actions for Helpers**

In pages that have create/edit/delete buttons, conditionally render based on role:
- Location/zone CRUD buttons: Gardener+
- Plant add/edit/delete: Gardener+
- Care task create/edit/delete: Gardener+
- Settings page: Groundskeeper only
- Shopping list delete: Gardener+ (add/toggle: all)

Helpers can still: view everything, complete care tasks, add photos, add shopping items, create journal entries.

**Step 3: Commit**

```bash
git add web/src/
git commit -m "feat: role-based UI guards — hide actions by permission level"
```

---

### Task 13: Groundskeeper admin UI — users and invites

**Files:**
- Create: `web/src/pages/Users.tsx`
- Modify: `web/src/App.tsx` (add route)

**Step 1: Build users/invites management page**

Route: `/users` (Groundskeeper only)

Sections:
1. **Users list** — name, role, last login, active status. Actions: change role, deactivate
2. **Invites** — create new (pick role), list pending, revoke. Show copyable invite URL
3. **Active sessions** — list with user agent, created date. Revoke button

**Step 2: Commit**

```bash
git add web/src/pages/Users.tsx web/src/App.tsx
git commit -m "feat: Groundskeeper admin UI — users, invites, sessions"
```

---

### Task 14: Add createdBy tracking to write operations

**Files:**
- Modify: `server/src/routes/photos.ts`
- Modify: `server/src/routes/care-tasks.ts`
- Modify: `server/src/routes/journal.ts`
- Modify: `server/src/routes/shopping-list.ts`

**Step 1: Set createdBy on new records**

In routes that create `plantPhotos`, `careTaskLogs`, `journalEntries`, `shoppingListItems` — set `createdBy: request.user!.id` on insert.

**Step 2: Commit**

```bash
git add server/src/routes/photos.ts server/src/routes/care-tasks.ts server/src/routes/journal.ts server/src/routes/shopping-list.ts
git commit -m "feat: track createdBy user on photos, task logs, journal, shopping"
```

---

### Task 15: Full integration test and cleanup

**Step 1: Run all server tests**

Run: `cd /home/carrot/code/bramble/server && pnpm test`

**Step 2: Run all web tests**

Run: `cd /home/carrot/code/bramble/web && pnpm test`

**Step 3: TypeScript compile check**

Run: `cd /home/carrot/code/bramble && npx tsc --noEmit -p server/tsconfig.json && npx tsc --noEmit -p web/tsconfig.json`

**Step 4: Manual smoke test**

Start dev servers, verify:
- Fresh DB → setup mode → create Groundskeeper → logged in
- Logout → login page
- Create invite → open in incognito → claim → Helper logged in
- Helper can: view plants, complete tasks, add photos, add shopping items
- Helper cannot: create plants, delete zones, access settings
- Groundskeeper can: manage users, change roles, revoke sessions

**Step 5: Final commit**

```bash
git add .
git commit -m "chore: auth integration tests and cleanup"
```
