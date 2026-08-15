# Admin First-run Setup and Blog Visual Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a token-protected one-time administrator setup with TOTP QR confirmation and restyle the administration application to match the public Aier Blog.

**Architecture:** SQLite migration v2 stores hashed setup tokens and temporary setup challenges. Public setup routes are available only while no administrator exists, require the exact admin Origin for writes, and create the only administrator plus session atomically after TOTP confirmation. React routes between setup, login and the protected application based on setup status; shared CSS variables and preference controls mirror the Astro blog.

**Tech Stack:** Node.js 24, Fastify 5, node:sqlite, React 19, React Router 7, TypeScript, qrcode, Vitest, Vite, Astro 7.

## Global Constraints

- Registration is one-time only and permanently closes after the administrator is created.
- The setup token is 256-bit random, shown once by a server CLI, and only its SHA-256 hash is stored.
- TOTP must be confirmed before the administrator row is created.
- Existing blog content, history, audit rows and publish state must survive authentication reset.
- Existing `/api/auth/register` remains absent.
- Production remains a single-user system.

---

### Task 1: Setup persistence and lifecycle

**Files:**
- Modify: `admin/server/db/migrations.ts`
- Create: `admin/server/auth/setup.ts`
- Test: `tests/admin-auth-setup.test.ts`

**Interfaces:**
- Produces `getSetupStatus`, `prepareFirstRunSetup`, `beginFirstRunSetup`, and `confirmFirstRunSetup`.

- [ ] Write failing tests for migration v2, token hashing, expiration, TOTP challenge confirmation, one-admin atomic creation, recovery codes and permanent closure.
- [ ] Run the focused test and confirm it fails because setup functions/tables do not exist.
- [ ] Implement migration v2 and the minimum lifecycle service.
- [ ] Run the focused test and confirm it passes.

### Task 2: Setup API and CLI

**Files:**
- Modify: `admin/cli/index.ts`
- Create: `admin/cli/prepare-setup.ts`
- Modify: `admin/server/app.ts`
- Modify: `admin/shared/auth-types.ts`
- Test: `tests/admin-api-setup.test.ts`
- Test: `tests/admin-auth-cli-options.test.ts`

**Interfaces:**
- Produces `GET /api/auth/setup/status`, `POST /api/auth/setup/begin`, `POST /api/auth/setup/confirm`, and `npm run admin:prepare-setup`.

- [ ] Write failing API tests for public status, exact-Origin enforcement, begin/confirm, automatic session, setup closure and absent `/api/auth/register`.
- [ ] Write failing CLI tests for explicit replacement and preservation of non-authentication rows.
- [ ] Implement routes, cookie creation and CLI command.
- [ ] Run focused API and CLI tests until passing.

### Task 3: React first-run flow

**Files:**
- Modify: `admin/client/src/api/client.ts`
- Modify: `admin/client/src/context/AuthContext.tsx`
- Modify: `admin/client/src/App.tsx`
- Create: `admin/client/src/pages/SetupPage.tsx`
- Test: `tests/admin-client-setup.test.ts`

**Interfaces:**
- Consumes setup status/begin/confirm APIs.
- Produces account, authenticator QR and recovery-code steps.

- [ ] Write failing source/DOM tests for setup routing, password validation, QR rendering, TOTP confirmation and recovery acknowledgement.
- [ ] Implement API client types, route state and accessible setup page.
- [ ] Run focused client tests until passing.

### Task 4: Public-blog visual parity

**Files:**
- Modify: `admin/client/src/styles.css`
- Modify: `admin/client/src/components/AppShell.tsx`
- Create: `admin/client/src/components/PreferenceDock.tsx`
- Modify: `admin/client/src/main.tsx`
- Test: `tests/admin-client-visual-parity.test.ts`

**Interfaces:**
- Reuses public blog preference keys `aier-theme`, `aier-accent-v2`, and `aier-background-v1`.

- [ ] Write failing tests for blog color variables, background artwork, serif/sans families and preference storage keys.
- [ ] Implement the editorial-desk shell, preference dock and responsive/dark styles.
- [ ] Run focused visual-contract tests until passing.

### Task 5: Full verification and production rollout

**Files:**
- Modify: `docs/admin-backend.md`
- Modify: `package.json`
- Test: all `tests/*.test.ts`

- [ ] Run `npm run admin:check`, `npm test -- --run`, `npm run admin:build`, `npm run build`, and `npm run deploy -- -DryRun`.
- [ ] Deploy while the current administrator remains intact and verify setup status is completed.
- [ ] Back up `/var/lib/aier-blog/state/admin.sqlite` with a timestamp and SHA-256.
- [ ] Run `npm run admin:prepare-setup -- --replace-admin` on the server and capture the one-time setup token.
- [ ] Verify setup status is required, normal login is closed, content counts/hash are unchanged, and provide the setup URL/token to the owner.