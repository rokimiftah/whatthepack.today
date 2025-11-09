# AGENTS.md — AI Agents Development Guide

This document provides comprehensive guidance for AI agents working with the WhatThePack.today project. It covers the codebase architecture, development workflows, coding standards, and operational procedures.

## Project Overview

**WhatThePack** is a secure, multi-tenant "AI Mission Control" for Direct-to-Customer (D2C) businesses operating on social commerce. This is NOT a marketplace; it's an AI-powered back-office Operating System (OS) that allows business owners to safely delegate operational tasks (admin input, warehouse packing) to staff using granular roles without exposing sensitive passwords or API keys.

Each business receives an isolated dashboard (`store-name.whatthepack.today`). The platform provides core AI intelligence and notifications, while the owner brings their own courier (BYOC - Bring Your Own Courier via ShipEngine). Key components: **Convex** (data + real-time functions), **Auth0** (Organizations + RBAC + Organization Metadata + Management API), **Resend** (platform-provided notifications), **VAPI** (voice for packers), **OpenAI** (platform-provided RAG + analytics), **ShipEngine** (owner-provided via Organization Metadata).

### Tech Stack

- **Frontend**: React 19, TypeScript, Mantine UI
- **Backend**: Convex (serverless + real‑time DB)
- **Build**: Rsbuild
- **Auth**: Auth0 (Universal Login + Organizations + Roles + MFA + Actions + Organization Metadata + Management API)
- **Email**: Resend (platform-provided, for notifications)
- **Voice**: VAPI.ai (hands-free interface for `packer` and `owner`)
- **AI**: OpenAI (platform-provided, for RAG + summarization + data extraction)
- **Logistics**: ShipEngine (owner-provided via Auth0 Organization Metadata)
- **Quality**: Biome (linting), Prettier (formatting), TS strict mode

## Agent Tooling Rules

- **Always use `exa___get_code_context_exa`** when you need library documentation, setup steps, or API references. This means automatically resolve library IDs and fetch docs without explicit user requests.
- **Use `exa___web_search_exa`** for finding implementation patterns, troubleshooting guides, or third-party integration examples.
- **Read MASTERPLAN.md first** before implementing major features to understand the overall architecture and design philosophy.
- **Check schema.ts** before any database operation to understand data relationships and constraints.
- **Verify multi-tenancy** - Every database query MUST filter by `orgId` to ensure data isolation.
- **Reference existing code patterns** - Look at similar implementations before writing new code to maintain consistency.

---

## Directory Structure

```
whatthepack.today/
├─ convex/
│  ├─ _generated/                 # Convex generated types & API
│  ├─ agents/                     # AI agents (ragAgent, shippingAgent, notificationAgent, etc.)
│  ├─ analytics.ts
│  ├─ auth.config.ts
│  ├─ auth.ts                     # requireRole/getUserOrgId/getUserRoles
│  ├─ http.ts                     # /health, /provision, /vapi routes (uses vapi_node.ts)
│  ├─ invites.ts
│  ├─ inventory.ts
│  ├─ mgmt.ts                     # Auth0 Management API wrappers (inviteStaff, storeShipEngineToken)
│  ├─ notifications.ts
│  ├─ onboarding.ts
│  ├─ orders.ts
│  ├─ organizations.ts
│  ├─ provision.ts
│  ├─ schema.ts
│  ├─ security.ts
│  ├─ utils/
│  ├─ vapi.ts                     # VAPI assistant sync + function handlers
│  └─ vapi_node.ts                # VAPI HTTP webhook verifier/bridge
│
├─ src/
│  ├─ app/
│  │  ├─ App.tsx
│  │  ├─ providers/AppProviders.tsx
│  │  └─ router/index.tsx
│  ├─ pages/
│  │  ├─ Dashboard/ (OwnerDashboard.tsx, AdminDashboard.tsx, PackerDashboard.tsx)
│  │  ├─ Integrations/index.tsx
│  │  ├─ Onboarding/index.tsx
│  │  ├─ Orders/ (index.tsx, CreateOrder.tsx)
│  │  ├─ Products/index.tsx
│  │  ├─ Analytics/index.tsx
│  │  └─ Auth/* (Callback, Verified, etc.)
│  ├─ shared/
│  │  ├─ components/ (FullscreenLoader, etc.)
│  │  └─ utils/
│  ├─ index.tsx
│  └─ env.d.ts
│
├─ dist/                          # Frontend build output
├─ rsbuild.config.ts              # Dev server at http://localhost:3000
├─ package.json
├─ tailwind.config.mjs
├─ biome.json
├─ tsconfig.json
└─ README.md
```

---

## AI Agent Responsibilities

### Primary Tasks for AI Agents

1. **Feature Development & Implementation**
   - Build new features following the 6 AI-powered solutions framework
   - Implement UI components with proper role-based access control
   - Create Convex functions with org-scoped queries
   - Integrate external APIs (ShipEngine, VAPI, Resend, OpenAI)

2. **Security & Multi-Tenancy Operations**
   - Ensure all database queries filter by `orgId`
   - Implement Auth0 Organization Metadata integrations
   - Add Auth0 Management API workflows (staff onboarding)
   - Build role-aware RAG filters to prevent data leakage

3. **System Maintenance & Optimization**
   - Update dependencies and resolve conflicts
   - Optimize Convex query performance (add indexes)
   - Monitor and fix deployment issues
   - Debug Auth0 → Convex webhook flows

4. **Code Quality Assurance**
   - Maintain TypeScript strict mode compliance
   - Follow Biome linting standards
   - Write secure, composable functions
   - Add proper error handling and validation

---

## Agent Responsibilities & AI Solutions

The platform implements 6 AI-powered solutions:

### 1. **Secure Staff Onboarding (Auth0 Management API)**

- **Purpose**: Allow `owner` to invite staff via email without sharing passwords.
- **Implementation**: Create user in Auth0, assign to Organization + Role, trigger email enrollment.
- **Result**: Staff set their own private passwords via Auth0 enrollment link.

### 2. **Secure API Delegation (Auth0 Organization Metadata + AI Agent)**

- **Purpose**: Enable `packer` to trigger label purchases without seeing `owner`'s ShipEngine API key.
- **Implementation**: AI Agent (triggered by VAPI) retrieves API key from Organization Metadata via Management API, calls ShipEngine API, updates order.
- **Result**: Zero-trust workflow - low-privilege user performs high-trust action securely.

### 3. **Role-Aware Intelligence (RAG + Role Filtering)**

- **Purpose**: Provide contextually appropriate information without data leakage.
- **Implementation**: Filter database queries by `role` (from JWT) before sending context to LLM.
- **Examples**:
  - `packer` asks "How to pack SKU123?" → Returns SOP and warehouse location.
  - `packer` asks "What's the profit?" → Returns "Not authorized."
  - `owner` asks "What's my profit?" → Returns financial analysis.

### 4. **Voice Packing Agent (VAPI.ai)**

- **Purpose**: Hands-free warehouse operations for `packer`.
- **Intents**: `get_next_order`, `complete_order`, `check_stock`, `report_stockout`.
- **Implementation**: VAPI sends webhook to Convex with JWT → triggers AI Agent → orchestrates workflow.
- **Always include**: `orgId` in payload and validate via `requireRole`.

### 5. **Proactive Notifications (Resend + AI Agent)**

- **Purpose**: Instant communication for critical events (stockouts, order failures).
- **Triggers**: `packer` reports "stock out" via VAPI, order processing errors.
- **Implementation**: AI Agent uses platform's Resend key to send email to `owner`/`admin`.
- **Email from**: `notifications@whatthepack.today`

### 6. **Operational AI Assistants (LLM)**

- **Data Extraction (for `admin`)**: Paste raw customer chat → LLM extracts details → auto-fills order form.
- **Daily Briefing (for `owner`)**: Summarize orders, profit, and stock alerts.
- **Business Analyst (for `owner`)**: Answer "Show me sales trends" with insights + recommendations.

---

## Development Workflow

### Before Making Changes

1. **Understand the Context**
   - Read **MASTERPLAN.md** to understand the overall architecture and design philosophy
   - Review `convex/schema.ts` for database structure and relationships
   - Check existing implementations in the same feature area for patterns
   - Verify multi-tenancy requirements (is `orgId` filtering needed?)

2. **Setup Validation**
   - Ensure all environment variables are configured (see `.env.local.example`)
   - Verify Convex dev server is running: `bunx convex dev`
   - Check frontend dev server: `bun run dev`
   - Confirm Auth0 Applications are configured (SPA + M2M)

3. **Security Checklist**
   - [ ] All database queries filter by `orgId` for multi-tenancy
   - [ ] Role-based access control implemented via `requireRole`
   - [ ] Sensitive operations protected (MFA step-up for owner)
   - [ ] No API keys or secrets in client-side code

### Implementation Guidelines

#### Frontend (React)

```tsx
// Pattern: resolve orgId first, handle loading, then render
import { useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";

export function PackerQueue() {
  const orgRes = useQuery(api.organizations.getForCurrentUser, {});
  const orgId = orgRes?.organization?._id;
  const orders = useQuery(api.orders.list, orgId ? { orgId, status: "paid" as const } : "skip");

  if (orgRes === undefined || orders === undefined) return <Spinner />;
  if (!orgId) return <EmptyState message="No organization" />;
  if (!orders?.length) return <EmptyState message="No paid orders" />;

  return (
    <div>
      {orders.map((o) => (
        <OrderCard key={o._id} order={o} />
      ))}
    </div>
  );
}
```

#### Backend (Convex)

```ts
// convex/orders.ts (excerpt)
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireRole } from "./auth";
import { requireOrgAccess } from "./security";

export const list = query({
  args: {
    orgId: v.id("organizations"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("paid"),
        v.literal("processing"),
        v.literal("shipped"),
        v.literal("delivered"),
        v.literal("cancelled"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId);
    await requireRole(ctx, args.orgId, ["owner", "admin", "packer"]);
    return args.status
      ? ctx.db
          .query("orders")
          .withIndex("by_org_status", (q) => q.eq("orgId", args.orgId).eq("status", args.status!))
          .order("desc")
          .collect()
      : ctx.db
          .query("orders")
          .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
          .order("desc")
          .collect();
  },
});

export const updateStatus = mutation({
  args: {
    orderId: v.id("orders"),
    status: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("processing"),
      v.literal("shipped"),
      v.literal("delivered"),
      v.literal("cancelled"),
    ),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    await requireOrgAccess(ctx, order.orgId);
    await requireRole(ctx, order.orgId, ["owner", "admin"]);
    await ctx.db.patch(args.orderId, { status: args.status, updatedAt: Date.now() });
  },
});
```

#### Voice (VAPI Webhook)

```ts
// convex/http.ts (excerpt)
import { httpRouter } from "convex/server";

import { auth } from "./auth";
import { handleVapiWebhook } from "./vapi_node";

const http = httpRouter();
auth.addHttpRoutes(http);

http.route({ path: "/vapi", method: "POST", handler: handleVapiWebhook });

export default http;
```

#### Auth0 Integration

**Post‑Login Action:**

- Inject custom claims into JWT: `https://whatthepack.today/roles` and `https://whatthepack.today/orgId`.
- Enforce MFA step-up for `owner` role when accessing sensitive pages (Integrations, Staff Management).

**Staff Onboarding (Management API):**

```ts
// convex/mgmt.ts (excerpt)
import { v } from "convex/values";

import { action } from "./_generated/server";
import { requireRole } from "./auth";

export const inviteStaff = action({
  args: {
    orgId: v.id("organizations"),
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("admin"), v.literal("packer")),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.orgId, ["owner"]);
    // Ensures Auth0 org, creates/gets user, adds member, assigns org role,
    // generates enrollment ticket, upserts local user, and records the invite.
    return { success: true };
  },
});
```

**Auth0 Organization Metadata (ShipEngine API Key):**

```ts
// convex/agents/shippingAgent.ts (excerpt)
import { v } from "convex/values";

import { api, internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

export const buyLabel = internalAction({
  args: { orderId: v.id("orders"), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const order = await ctx.runQuery(api.orders.get, { orderId: args.orderId });
    const org = await ctx.runQuery(internal.organizations.get, { orgId: args.orgId });
    const auth0OrgId = selectAuth0OrgIdForEnv(org) || org.auth0OrgId!;
    const shipEngineApiKey = await getShipEngineApiKeyFromAuth0(auth0OrgId);
    // Call ShipEngine REST and persist results
    await ctx.runMutation(api.orders.updateShipping, {
      orderId: args.orderId,
      trackingNumber,
      labelUrl,
      shippingCost,
      courierService,
    });
  },
});
```

**Role-Aware RAG Implementation:**

```ts
// convex/agents/ragAgent.ts (excerpt)
import { v } from "convex/values";

import { query } from "../_generated/server";
import { getUserOrgId, getUserRoles } from "../auth";
import { chatCompletion } from "../utils/llm";

export const answerQuery = query({
  args: { prompt: v.string(), orgId: v.optional(v.id("organizations")) },
  handler: async (ctx, args) => {
    const roles = await getUserRoles(ctx);
    const userOrgId = await getUserOrgId(ctx);
    const targetOrgId = args.orgId || userOrgId;
    // ...collect role-scoped context for targetOrgId
    const result = await chatCompletion({
      messages: [
        { role: "system", content: "Answer only with provided, role-filtered context." },
        { role: "user", content: args.prompt },
      ],
      max_tokens: 500,
    });
    return { response: result.content, role: roles[0] || "unknown" };
  },
});
```

### Code Quality Standards

#### TypeScript Configuration

- **Strict mode enabled** in `tsconfig.json` - no `any` types allowed
- All functions must have proper type annotations
- Use Convex-generated types for database operations (`Id<"tableName">`)
- Prefer interfaces over types for object shapes

#### Linting & Formatting

```bash
# Run before committing
bun run format:lint:typecheck
```

**Key Rules:**

- No unused variables or imports
- Consistent naming: `camelCase` for variables, `PascalCase` for components
- Explicit return types for exported functions
- Proper error handling with try-catch where needed

#### File Organization

- Group related functions in same file (e.g., all order operations in `orders.ts`)
- Use descriptive function names (`listOrdersByStatus`, not `getOrders`)
- Add JSDoc comments for complex business logic
- Keep functions under 50 lines when possible

### Testing & Verification

#### Before Submitting Changes

1. **Code Quality**: `bun run format:lint:typecheck` (must pass)
2. **Build Test**: `bun run build` (must succeed)
3. **Type Check**: `bun run typecheck` (no errors)
4. **Manual Testing**: Verify in development environment

#### Testing Multi-Tenancy

```bash
# 1. Create test organizations
bunx convex run organizations:create --orgName "Test Store A" --slug "test-a"
bunx convex run organizations:create --orgName "Test Store B" --slug "test-b"

# 2. Add test data to each org
bunx convex run inventory:seedProducts --orgId "org123"

# 3. Verify data isolation
# Login as user in Org A, verify cannot see Org B data
```

#### Testing Auth0 Flows

1. **Staff Onboarding Flow**
   - Owner invites staff via UI
   - Check Auth0 dashboard for new user
   - Staff receives email and sets password
   - Verify staff can login with org-scoped URL

2. **Organization Metadata Flow**
   - Owner enters ShipEngine API key in Integrations page
   - Packer triggers label purchase via VAPI
   - Verify label purchased without key exposure
   - Check order updated with tracking number

3. **RAG Flow**
   - Login as packer, ask "What's the profit?" → Should be denied
   - Login as owner, ask same question → Should return profit data
   - Verify context filtering at query level (not LLM level)

---

## Operations

### Schedules & Jobs

#### Automated Tasks

```typescript
// convex/crons.ts
import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily summary at 18:00 local time for each org
crons.daily(
  "send-daily-summaries",
  { hourUTC: 11 }, // 18:00 WIB = 11:00 UTC
  internal.emails.sendDailySummaries,
);

// Low stock scan every 6 hours
crons.interval("low-stock-scan", { hours: 6 }, internal.inventory.lowStockScan);

export default crons;
```

#### Manual Operations

```bash
# Process unprocessed orders
npx convex run orders:processUnprocessedOrders

# Regenerate analytics for all orgs
npx convex run analytics:regenerateAllStats

# Send test notification
npx convex run emails:sendTestEmail --email "test@example.com"
```

### Deployment Workflow

#### Pre-deployment Checklist

1. **Code Quality**
   - [ ] `bun run format:lint:typecheck` passes without errors
   - [ ] `bun run build` succeeds
   - [ ] All TypeScript errors resolved
   - [ ] No console.log statements in production code

2. **Environment Variables**
   - [ ] All required vars set in Convex dashboard
   - [ ] Auth0 Applications configured (SPA + M2M)
   - [ ] Callback URLs updated (wildcards for subdomains)
   - [ ] Resend API key valid
   - [ ] LLM_API_KEY and LLM_API_MODEL set

3. **Database Schema**
   - [ ] Schema migrations tested in dev
   - [ ] Indexes created for new queries
   - [ ] Data validation rules in place

4. **Auth0 Configuration**
   - [ ] Organizations feature enabled
   - [ ] Roles created (owner, admin, packer)
   - [ ] Organization Metadata configured for ShipEngine
   - [ ] Post-Login Action deployed
   - [ ] Management API M2M app created

5. **Integrations**
   - [ ] VAPI webhook URL configured
   - [ ] VAPI assistant tools updated
   - [ ] Resend domain verified
   - [ ] Wildcard DNS configured

#### Deployment Steps

```bash
# 1. Deploy backend (Convex)
bunx convex deploy --prod

# 2. Deploy frontend
bun run build
# Upload dist/ to hosting provider (Vercel, Netlify, etc.)

# 3. Verify deployment
curl https://api.whatthepack.today/health
# Should return status: ok

# 4. Test critical flows
# - Staff invitation
# - Voice packing workflow
# - Label purchase via Organization Metadata
```

---

## Configuration Management

### Required Environment Variables

```bash
# ------------------------------------------------------------------------------
# Convex Configuration
# ------------------------------------------------------------------------------
PUBLIC_CONVEX_URL=
CONVEX_WEBHOOK_SECRET=

# Self-hosted (optional)
CONVEX_SELF_HOSTED_URL=
CONVEX_SELF_HOSTED_ADMIN_KEY=

# ------------------------------------------------------------------------------
# Auth0 Configuration
# ------------------------------------------------------------------------------
# Backend (Convex)
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_DOMAIN=
AUTH0_TENANT_DOMAIN=
AUTH0_AUDIENCE=
AUTH0_CONNECTION_ID=

# Frontend (PUBLIC_ required)
PUBLIC_AUTH0_DOMAIN=
PUBLIC_AUTH0_CLIENT_ID=
PUBLIC_AUTH0_AUDIENCE=

# Management API (M2M)
AUTH0_MGMT_CLIENT_ID=
AUTH0_MGMT_CLIENT_SECRET=

# Roles (IDs from dashboard)
AUTH0_OWNER_ROLE_ID=
AUTH0_ADMIN_ROLE_ID=
AUTH0_PACKER_ROLE_ID=

# ------------------------------------------------------------------------------
# Custom JWT (optional)
# ------------------------------------------------------------------------------
JWKS=
JWT_PRIVATE_KEY=

# ------------------------------------------------------------------------------
# AI & LLM Configuration
# ------------------------------------------------------------------------------
LLM_API_KEY=
LLM_API_MODEL=
LLM_API_URL=

# ------------------------------------------------------------------------------
# Email Notifications (Resend)
# ------------------------------------------------------------------------------
RESEND_API_KEY=

# ------------------------------------------------------------------------------
# Voice Interface (VAPI.ai)
# ------------------------------------------------------------------------------
PUBLIC_VAPI_ASSISTANT_ID=
PUBLIC_VAPI_PUBLIC_KEY=

VAPI_WEBHOOK_SECRET=
VAPI_SECRET_KEY=
VAPI_SERVER_URL=
VAPI_ASSISTANT_NAME=
VAPI_VOICE_ID=
VAPI_TRANSCRIBER_MODEL=
VAPI_TRANSCRIBER_LANGUAGE=

# ------------------------------------------------------------------------------
# Application Configuration
# ------------------------------------------------------------------------------
APP_DOMAIN_SUFFIX=
SITE_URL=
```

### Local Development Setup

```bash
# 1. Clone repository
git clone https://github.com/your-org/whatthepack.today
cd whatthepack.today

# 2. Install dependencies
bun install

# 3. Setup environment
cp .env.local.example .env.local
# Edit .env.local with your values

# 4. Start development servers
bunx convex dev     # Terminal 1 - Backend
bun run dev         # Terminal 2 - Frontend

# 5. Open browser
# http://localhost:3000
```

---

## Key Integration Points

### Auth0 → Convex (Provisioning)

- **Endpoint**: `POST /provision`
- **Trigger**: Post-User Registration Action in Auth0
- **Purpose**: Create Organization and owner membership
- **Idempotency**: Safe to call multiple times (checks existing org)
- **Headers**: `Authorization: Bearer {CONVEX_WEBHOOK_SECRET}`

### VAPI → Convex (Voice Intents)

- **Endpoint**: `POST /vapi`
- **Trigger**: VAPI tool call from voice conversation
- **Purpose**: Execute packer actions (get order, complete, report stockout)
- **Security**: Validate VAPI signature, enforce RBAC via `requireRole`
- **Response**: Terse, speakable responses for voice playback

### Convex → ShipEngine (Label Purchase)

- **Flow**: VAPI → Convex Action → Auth0 Organization Metadata → ShipEngine API
- **Security**: AI Agent retrieves API key from Organization Metadata, packer never sees key
- **Error Handling**: Graceful fallback if API key not configured or invalid

### Convex → Resend (Notifications)

- **Trigger**: Critical events (stockout, order failure)
- **From**: `notifications@whatthepack.today`
- **Recipients**: `owner` and `admin` roles only
- **Rate Limiting**: Max 5 emails per org per hour (prevent spam)

---

## Common Issues & Solutions

### Build & Deployment Issues

#### "Cannot find module 'convex/server'"

**Cause**: Convex types not generated  
**Solution**:

```bash
bunx convex dev  # Regenerate types
# or
bunx convex codegen
```

#### "Type error: Property 'orgId' does not exist on type 'UserIdentity'"

**Cause**: Custom claims not configured in Auth0 Post-Login Action  
**Solution**:

1. Check Auth0 Action code includes:
   ```js
   api.idToken.setCustomClaim("https://whatthepack.today/orgId", user.org_id);
   ```
2. Verify claim namespace matches exactly
3. Clear browser cookies and re-login

#### Build fails with Biome errors

**Cause**: Linting violations  
**Solution**:

```bash
bun run format    # Auto-fix formatting
bun run lint      # Check remaining issues
# Manually fix remaining violations
```

### Runtime Issues

#### "401 Unauthorized" on /provision endpoint

**Cause**: Invalid webhook secret  
**Solution**:

1. Check `CONVEX_WEBHOOK_SECRET` matches in both Auth0 Action and Convex env
2. Verify header name is `Authorization: Bearer {secret}`
3. Check Auth0 Action logs for exact error

#### "Organization not found" when accessing subdomain

**Cause**: Org slug not set during onboarding  
**Solution**:

```bash
# Check if org exists
bunx convex run organizations:get --orgId "org123"

# Set slug manually
bunx convex run organizations:setSlug --orgId "org123" --slug "store-name"
```

#### "Cannot access route" - User sees blank page

**Cause**: JWT missing `roles` or `org_id` claims  
**Solution**:

1. Check Auth0 Post-Login Action is deployed and enabled
2. Verify custom claims are added to both ID token and Access token
3. Clear browser localStorage and re-login
4. Check browser console for JWT payload

```js
// Debug JWT in browser console
const token = localStorage.getItem("convex:auth:token");
console.log(JSON.parse(atob(token.split(".")[1])));
// Should have: { "https://whatthepack.today/roles": ["owner"], ... }
```

#### VAPI webhook returns "Unknown intent"

**Cause**: VAPI not sending correct intent format  
**Solution**:

1. Check VAPI assistant configuration
2. Verify tool schema matches expected format:
   ```json
   {
     "intent": "get_next_order",
     "orgId": "org123",
     "payload": {}
   }
   ```
3. Add logging to `convex/http.ts` to debug incoming payloads

### Performance Issues

#### Slow dashboard load (5+ seconds)

**Cause**: Missing database indexes  
**Solution**:

```typescript
// convex/schema.ts
export default defineSchema({
  orders: defineTable({
    orgId: v.id("organizations"),
    status: v.string(),
    createdAt: v.number(),
  })
    .index("by_org_status", ["orgId", "status"]) // Add this
    .index("by_org_created", ["orgId", "createdAt"]), // And this
});
```

#### VAPI responses timing out

**Cause**: Convex action taking too long  
**Solution**:

1. Add early return with "Processing..." message
2. Use `ctx.scheduler.runAfter` for long-running tasks
3. Implement caching for frequently accessed data

#### High OpenAI API costs

**Cause**: Sending too much context to LLM  
**Solution**:

1. Limit context to last 50 products/orders
2. Implement semantic search (embeddings) instead of full-text
3. Cache LLM responses for identical queries
4. Use cheaper model (gpt-3.5-turbo) for non-critical tasks

### Auth0 Integration Issues

#### "Invite link expired" when staff tries to enroll

**Cause**: Password change ticket expired (24 hours)  
**Solution**:

```bash
# Re-issue invitation
npx convex run users:resendInvite --userId "user123"
```

#### Staff cannot see organization data after login

**Cause**: User not added to Organization in Auth0  
**Solution**:

1. Check Auth0 dashboard → Organizations → Members
2. Manually add user if missing
3. Verify role assignment
4. User must re-login after changes

#### Organization Metadata returns "Token not found"

**Cause**: ShipEngine API key not saved in Organization Metadata  
**Solution**:

1. Owner goes to Integrations page
2. Enters ShipEngine API key
3. Key saved to Auth0 Organization Metadata via Management API
4. Verify in Auth0 dashboard → Organization Metadata

---

## Monitoring & Analytics

### Key Metrics to Monitor

#### System Health

- **Convex Function Latency**: Query < 200ms, Mutation < 500ms, Action < 2s
- **Error Rates**: < 1% for queries, < 0.1% for mutations
- **Webhook Success Rate**: > 99% for /provision and /vapi

#### Business Metrics

- **Orders per Hour**: Track packing throughput
- **Average Pack Time**: Time from `paid` to `shipped`
- **Stockout Frequency**: How often inventory hits zero
- **Staff Performance**: Orders processed per packer per day

#### Security Metrics

- **Failed Auth Attempts**: Monitor for brute-force attacks
- **Unauthorized Access Attempts**: Calls to `requireRole` that fail
- **Organization Metadata Access**: Audit log of ShipEngine key retrievals

### Debugging Tools

#### Convex Dashboard

```
https://dashboard.convex.dev/{your-deployment}
```

- **Functions**: View execution times, error rates
- **Logs**: Real-time console.log output
- **Data**: Browse tables, run queries
- **Scheduler**: Check scheduled and pending jobs

#### Browser DevTools

- **Console**: Check for JWT payload, auth errors
- **Network Tab**: Verify Convex function calls
- **Performance**: Profile React component renders
- **Application → Local Storage**: Check auth tokens

#### Auth0 Logs

```
https://manage.auth0.com/dashboard/{tenant}/logs
```

- **Post-Login Action Logs**: Verify custom claims added
- **Management API Calls**: Track user creation, org assignments
- **Organization Metadata Access**: Audit ShipEngine key retrievals

#### VAPI Logs

- **Call Logs**: Verify webhook payloads sent
- **Tool Errors**: Check for timeout or validation errors
- **Transcripts**: Debug voice recognition issues

### Health Check Endpoints

```bash
# Convex health
curl https://api.whatthepack.today/health
# Returns: { "status": "ok", "timestamp": 1234567890 }

# Auth0 health
curl https://your-tenant.auth0.com/.well-known/openid-configuration
# Returns OIDC metadata

# VAPI health
curl https://api.vapi.ai/health
# Returns: { "status": "ok" }
```

---

## Security Considerations

### API Key Management

- **Never commit secrets** to git repository (use `.gitignore`)
- **Use environment variables** for all API keys
- **Rotate secrets quarterly** (Auth0 M2M, VAPI, Resend)
- **Audit access logs** monthly for unusual activity

### Data Privacy & Multi-Tenancy

- **Org-scoped queries**: Every DB query MUST filter by `orgId`
- **Role-based filtering**: RAG must filter before LLM, not after
- **No cross-tenant data**: Verify no data leakage in aggregations
- **Audit trail**: Log all sensitive operations (staff invite, Organization Metadata access)

### Authentication Security

- **Enforce MFA**: Required for `owner` role
- **Short session lifetime**: 24 hours max
- **Secure cookies**: `httpOnly`, `secure`, `sameSite: strict`
- **Rate limiting**: Max 5 login attempts per IP per hour

### Webhook Security

- **Verify signatures**: VAPI webhook, Auth0 webhook
- **Use secrets**: `CONVEX_WEBHOOK_SECRET`, `VAPI_WEBHOOK_SECRET`
- **Validate payloads**: Schema validation with Zod
- **Idempotency**: Safe to replay webhooks

---

## Collaboration Guidelines

### Code Review Process

1. **Self-Review**: Ensure all quality checks pass before PR
2. **Documentation**: Update AGENTS.md if workflow changes
3. **Testing**: Verify in dev environment with multi-org test data
4. **Git Standards**: Use conventional commits

```bash
# Commit message format
feat(orders): add bulk order export
fix(auth): resolve organization metadata race condition
docs(agents): update RAG filtering section
```

### Communication Patterns

- **Issue Reporting**: Include reproduction steps, error logs, environment
- **Feature Requests**: Reference MASTERPLAN.md section, explain use case
- **Bug Reports**: Provide JWT payload, Convex function logs, browser console
- **Questions**: Show what you've tried, link to relevant code

### Contribution Areas

- **Frontend**: UI/UX improvements, accessibility, mobile responsiveness
- **Backend**: Performance optimization, new AI agents, integrations
- **Security**: Audit multi-tenancy, penetration testing, RBAC improvements
- **Infrastructure**: Monitoring, alerting, deployment automation

---

**This guide serves as the primary reference for AI agents and developers working on WhatThePack.today. Always refer to this document first when implementing changes, and keep it updated as the project evolves.**
