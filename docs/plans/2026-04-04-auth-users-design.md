# Auth, Users & Roles — Design

## Goal

Add authentication, user management, and role-based authorization to Bramble so it can be safely exposed over the internet. Support invite-based onboarding so trusted people can help with gardening tasks at appropriate permission levels.

## Architecture

Cookie-based sessions stored in SQLite. First user to register becomes the Groundskeeper (super admin). Groundskeeper creates invite links with a preset role. All existing data (pre-auth) continues to work — no user ownership on structural tables.

Three garden-themed roles with hierarchical permissions: **Groundskeeper > Gardener > Helper**.

## Tech Choices

- **Password hashing**: `@node-rs/argon2` (fast native binding, Argon2id)
- **Session tokens**: `crypto.randomBytes(32).toString('base64url')` — 256-bit random, URL-safe
- **Cookies**: `@fastify/cookie` — `HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/`, 30-day expiry
- **Invite tokens**: `crypto.randomBytes(16).toString('base64url')` — shorter, URL-friendly

---

## Data Model

### `users` table

| Column | Type | Notes |
|--------|------|-------|
| id | integer PK | auto-increment |
| username | text, unique, not null | login identifier |
| displayName | text, not null | shown in UI |
| email | text, unique, nullable | optional, for future notifications |
| passwordHash | text, not null | Argon2id hash |
| role | text, not null | `'groundskeeper'` / `'gardener'` / `'helper'` |
| avatarUrl | text, nullable | future use |
| lastLoginAt | text, nullable | ISO timestamp |
| isActive | integer (boolean) | default true, soft-disable |
| createdAt | text, not null | ISO timestamp |
| updatedAt | text, not null | ISO timestamp |

### `sessions` table

| Column | Type | Notes |
|--------|------|-------|
| id | text PK | random 256-bit token (base64url) |
| userId | integer FK → users.id | cascade delete |
| expiresAt | text, not null | ISO timestamp |
| userAgent | text, nullable | for "active sessions" UI |
| createdAt | text, not null | ISO timestamp |

### `invites` table

| Column | Type | Notes |
|--------|------|-------|
| id | integer PK | auto-increment |
| token | text, unique, not null | URL-safe random string |
| role | text, not null | `'gardener'` / `'helper'` only |
| createdBy | integer FK → users.id | who created it |
| claimedBy | integer FK → users.id, nullable | who used it |
| expiresAt | text, not null | ISO timestamp |
| createdAt | text, not null | ISO timestamp |

### Migration for existing tables

Add nullable `createdBy` (FK → users.id) to:
- `care_task_logs`
- `shopping_list_items`
- `plant_photos`
- `journal_entries`
- `journal_photos`

Existing rows keep `createdBy = null` (means "created before auth"). No backfill.

Structural tables (`locations`, `zones`, `plant_instances`, `plant_references`, `care_tasks`, etc.) do NOT get a user column — they belong to the Bramble instance.

---

## Role Permissions

| Action | Groundskeeper | Gardener | Helper |
|--------|:---:|:---:|:---:|
| **Server & Users** | | | |
| Manage settings | ✓ | | |
| Create/revoke invites | ✓ | | |
| Manage users (deactivate, change role) | ✓ | | |
| View active sessions | ✓ | | |
| **Locations & Zones** | | | |
| Create/edit/delete locations | ✓ | ✓ | |
| Create/edit/delete zones | ✓ | ✓ | |
| Manage structures | ✓ | ✓ | |
| **Plants** | | | |
| Add/remove/move plant instances | ✓ | ✓ | |
| Edit plant details & status | ✓ | ✓ | |
| Add plant photos | ✓ | ✓ | ✓ |
| Manage plant references | ✓ | ✓ | |
| **Care & Tasks** | | | |
| Create/edit/delete care tasks | ✓ | ✓ | |
| Complete care tasks (log) | ✓ | ✓ | ✓ |
| **Journal** | | | |
| Create/edit own journal entries | ✓ | ✓ | ✓ |
| Delete any journal entry | ✓ | ✓ | |
| **Shopping List** | | | |
| Add/check off items | ✓ | ✓ | ✓ |
| Delete items | ✓ | ✓ | |
| **Notifications** | | | |
| Manage notification channels | ✓ | ✓ | |
| **Read-only (all data)** | ✓ | ✓ | ✓ |

Implementation: simple role hierarchy middleware. `requireRole('gardener')` allows Gardener + Groundskeeper. Specific overrides for mixed-permission routes (e.g., Helper can POST photos but not PUT plant status).

---

## Auth Flows

### First-run setup

1. App starts, migrations run, detects 0 users → **setup mode**
2. ALL API routes return 403 except: `GET /api/auth/me` (returns 401), `POST /api/auth/setup`, static assets
3. Frontend detects setup mode, shows "Welcome to Bramble" setup page
4. User creates username + password → becomes Groundskeeper
5. Session created, app transitions to normal mode (no restart)

### Login

1. `POST /api/auth/login` — username + password → validates, creates session, sets `bramble_session` cookie
2. `GET /api/auth/me` — returns current user from session cookie (or 401)
3. `POST /api/auth/logout` — clears session row + cookie

### Invite flow

1. Groundskeeper: `POST /api/auth/invites` with role → returns invite URL `/invite/{token}`
2. Recipient visits link → sees "You've been invited" + assigned role
3. Picks username, display name, password → account created, invite marked claimed
4. Logged in automatically

### Existing install upgrade

Pull new Docker image → start → migrations add users/sessions/invites tables + `createdBy` columns → 0 users detected → setup mode → create Groundskeeper → all existing data intact.

---

## API Routes

```
# Public (always)
POST   /api/auth/login
POST   /api/auth/setup                    # only works when 0 users exist
POST   /api/auth/invites/:token/claim     # with valid, unexpired token
GET    /api/auth/invites/:token           # check invite validity (public)

# Authenticated (any role)
GET    /api/auth/me
POST   /api/auth/logout
PUT    /api/auth/password                 # change own password

# Groundskeeper only
GET    /api/users
PUT    /api/users/:id/role
PUT    /api/users/:id/active
GET    /api/auth/invites
POST   /api/auth/invites
DELETE /api/auth/invites/:id
GET    /api/auth/sessions                 # all sessions
DELETE /api/auth/sessions/:id             # any session
```

---

## Frontend Changes

### New pages
- `/login` — login form
- `/setup` — first-run Groundskeeper setup
- `/invite/:token` — invite claim form

### Auth context
- `AuthProvider` wraps the app, calls `GET /api/auth/me` on mount
- Stores current user + role in React context
- Unauthenticated → redirect to `/login` (or `/setup` if setup mode)
- Role available for conditional UI (hide buttons user can't use)

### Route protection
- All existing routes wrapped in auth check
- `/login`, `/setup`, `/invite/:token` are public
- Server always enforces permissions regardless of UI
