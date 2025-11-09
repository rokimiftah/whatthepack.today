# WhatThePack.today

AI Mission Control for D2C businesses on social commerce. A secure, multi-tenant back‑office OS to manage operations (orders, inventory, packing) with RBAC, courier integration via ShipEngine (BYOC), a voice interface for packers, proactive notifications, and LLM‑powered analytics.

## Key Features

- Multi-tenancy per organization (subdomain `store-name.whatthepack.today`)
- RBAC: `owner`, `admin`, `packer` with server- and client-side guards
- Core operations: inventory, orders, packing queue, movement audit trail
- Voice Packing (VAPI.ai) for hands‑free packer workflows
- Secure delegation: packers can purchase labels without seeing API keys (Auth0 Org Metadata)
- Proactive notifications (Resend) and Business Analytics (OpenAI)
- Realtime backend with Convex; React 19 + Mantine UI frontend

## Tech Stack

- Frontend: React 19, TypeScript, Mantine UI, Wouter, Tailwind (Mantine preset)
- Backend: Convex (serverless + real‑time DB/functions)
- Build: Rsbuild (Rspack), dev server at `http://localhost:3000`
- Auth: Auth0 (Organizations, Roles, Actions, MFA)
- Email: Resend
- Voice: VAPI.ai
- AI: OpenAI (RAG, extraction, analytics)
- Logistics: ShipEngine (API key per org in Auth0 Organization Metadata)
- Quality: Biome (lint), Prettier (format), strict TypeScript

## Project Structure

```
whatthepack.today/
├─ convex/                 # DB schema, queries, mutations, actions, http endpoints
├─ src/                    # React app (routes, pages, shared components)
├─ dist/                   # Frontend build output
├─ rsbuild.config.ts       # Rsbuild config (dev port 3000)
├─ package.json            # Scripts & dependencies
├─ biome.json              # Biome lint rules
├─ tailwind.config.mjs     # Tailwind preset Mantine
├─ .env.local.example      # Environment variables template
└─ README.md               # This document
```

## Prerequisites

- Bun ≥ 1.1 (package manager & runner)
- Node.js ≥ 18
- Auth0 tenant (SPA app + M2M for Management API)
- OpenAI API key (optional for AI features)
- Resend API key (optional for notifications)
- VAPI.ai (optional for voice)

## Quick Start (Local)

1. Install dependencies

```bash
bun install
```

2. Configure environment

```bash
cp .env.local.example .env.local
# Fill required variables (Auth0, Convex, Resend/OpenAI/VAPI if used)
# Example to generate webhook secret → openssl rand -base64 32
```

3. Run backend (Convex)

```bash
bunx convex dev
```

4. Run frontend (Rsbuild dev server)

```bash
bun run dev
# Open http://localhost:3000
```

## Important Scripts

```bash
# Development
bun run dev                 # rsbuild dev (frontend)
bunx convex dev             # Convex backend (auto typegen)

# Build & Preview
bun run build               # rsbuild build → dist/
bun run preview             # production preview

# Quality
bun run format              # prettier --write .
bun run lint                # biome check --write .
bun run typecheck           # tsc --noEmit (root + convex)
bun run lint:typecheck      # lint + typecheck
bun run format:lint:typecheck
```

## Architecture & Patterns

- Multi-tenancy: every Convex query/mutation MUST filter by `orgId` (add indexes as needed).
- RBAC: enforce `requireRole(ctx, orgId, ["owner", ...])` on server; use `RoleGuard` on client routes.
- Secure delegation (ShipEngine): API keys live in Auth0 Organization Metadata; access only via authorized Convex Actions; never expose to the client.
- Voice (VAPI): Convex `http.ts` exposes `POST /vapi`, verifies signature, maps intents to internal functions.
- RAG: pre-filter data by role before sending to the LLM (never rely on post-filtering).

## Environment Variables

Use `.env.local.example` as the complete reference. Variables:

```bash
# Convex
PUBLIC_CONVEX_URL=
CONVEX_WEBHOOK_SECRET=

# Self-hosted (optional)
CONVEX_SELF_HOSTED_URL=
CONVEX_SELF_HOSTED_ADMIN_KEY=

# Auth0 (SPA + M2M)
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_DOMAIN=
AUTH0_TENANT_DOMAIN=
AUTH0_AUDIENCE=
AUTH0_CONNECTION_ID=

# Auth0 (public for frontend)
PUBLIC_AUTH0_DOMAIN=
PUBLIC_AUTH0_CLIENT_ID=
PUBLIC_AUTH0_AUDIENCE=

# Auth0 Management API (M2M)
AUTH0_MGMT_CLIENT_ID=
AUTH0_MGMT_CLIENT_SECRET=

# Auth0 Roles
AUTH0_OWNER_ROLE_ID=
AUTH0_ADMIN_ROLE_ID=
AUTH0_PACKER_ROLE_ID=

# Custom JWT (optional)
JWKS=
JWT_PRIVATE_KEY=

# AI & LLM
LLM_API_KEY=
LLM_API_MODEL=
LLM_API_URL=

# Email (Resend)
RESEND_API_KEY=

# Voice (VAPI.ai)
PUBLIC_VAPI_ASSISTANT_ID=
PUBLIC_VAPI_PUBLIC_KEY=
VAPI_WEBHOOK_SECRET=
VAPI_SECRET_KEY=
VAPI_SERVER_URL=
VAPI_ASSISTANT_NAME=
VAPI_VOICE_ID=
VAPI_TRANSCRIBER_MODEL=
VAPI_TRANSCRIBER_LANGUAGE=

# Application
APP_DOMAIN_SUFFIX=
SITE_URL=
```

Auth0 notes:

- Add custom claims in a Post‑Login Action: `https://whatthepack.today/roles` and `https://whatthepack.today/orgId`.
- Enforce MFA for the `owner` role when accessing sensitive pages (Integrations, Staff Management).

## Backend Development (Convex)

- Define schema and indexes in `convex/schema.ts`.
- Use typed args (`v.*`) for queries/mutations/actions and keep audit trails on updates.
- Expose HTTP endpoints (e.g., `/provision`, `/vapi`) via `convex/http.ts` with signature/secret verification.

## Code Quality

Before commit/deploy:

```bash
bun run format:lint:typecheck
bun run build
```

Type checking for the root and `convex/` is covered by the `typecheck` script.

## Deploy

```bash
# Deploy backend (Convex)
bunx convex deploy --prod

# Build frontend
bun run build  # upload dist/ to your hosting (Vercel/Netlify/etc.)
```

Quick verification:

```bash
curl https://api.whatthepack.today/health     # → { status: "ok" }
```

## Security (Quick Checklist)

- Always scope queries/mutations by `orgId` (prevent cross‑tenant leakage).
- Never store or expose API keys in client code; access via server/actions only.
- Validate signatures/secrets for all webhooks.
- Require MFA for the `owner` role on sensitive operations.

## Troubleshooting

- “Cannot find module 'convex/server'” → run `bunx convex dev` (regenerate types) or `bunx convex codegen`.
- JWT missing `roles`/`orgId` → verify Auth0 Post‑Login Action, then logout/login again.
- 401 on `/provision` → check `CONVEX_WEBHOOK_SECRET` and Authorization Bearer header.
- Port 3000 conflict → change `server.port` in `rsbuild.config.ts` or stop the conflicting process.

---

For deeper architecture, examples, and security practices, see `AGENTS.md` and `MASTERPLAN.md` in this repo.
