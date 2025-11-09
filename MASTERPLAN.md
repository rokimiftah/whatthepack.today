### **1. Project Title**

**`WhatThePack.today`**

### **2. Overview**

**WhatThePack** is a secure, multi-tenant "AI Mission Control" for Direct-to-Customer (D2C) businesses operating on social commerce. This is **NOT** a marketplace; it is an AI-powered, back-office Operating System (OS) that allows business owners to safely delegate operational tasks (admin input, warehouse packing) to staff using granular roles without ever exposing sensitive passwords or API keys.

Each business receives an isolated dashboard (`store-name.whatthepack.today`). The platform provides the core AI intelligence and notifications, while the owner brings their own courier (BYOC via ShipEngine) account. `WhatThePack` transforms manual operational chaos into an automated, intelligent, and secure logistics workflow. For the warehouse `packer`, it answers their core question hands-free: **"What Should Be Packed Today?"**, while ensuring every action is secured.

### **3. Product Philosophy: The Justification for Manual Workflows**

`WhatThePack` intentionally does not automate customer chat or payment verification. This is a deliberate design philosophy essential for the D2C/Social Commerce target market.

1.  **Preserving the "Human Touch" (High-Touch):** Social commerce brands are built on personal conversations. Customers _want_ to ask, "Is this material comfortable?" A rigid bot would destroy this personal experience. In this model, the `admin` is a _Human Customer Service_ representative, not a data operator.
2.  **Market Reality (Trust in Payments):** In many markets, "Manual Transfer + Send Proof" is the most common and trusted payment method for SMEs. It maximizes profit (zero payment gateway fees) and aligns with existing customer behavior.
3.  **Focusing on the Real Problem:** The biggest problem for sellers is NOT replying to chats. It's **what happens _after_ the chat is closed**: the logistics chaos and the **security nightmare** of delegating that chaos. `WhatThePack` is laser-focused on solving that core problem.

### **4. Problem Solved**

Successful D2C sellers (on Instagram, WA, etc.) drown in manual work. To scale, they must hire staff, which creates a massive security risk. The platform addresses four core problems:

1.  **Operational Chaos:** Successful D2C sellers are drowning in manual work: verifying bank transfers, copy-pasting addresses, checking shipping rates, and typing tracking numbers back to customers. **Data entry is slow and error-prone.**
2.  **The Delegation Nightmare (Core Problem):** To hire staff (an `admin` and a `packer`), the owner is _forced_ to share highly sensitive access:
    - **Online Banking Login** (to verify transfers).
    - **Courier/Aggregator API Keys** (to purchase shipping labels).
    - **Financial Data** (COGS, profit margins, etc.). Crucially, **staff passwords** should also remain private.
3.  **Location Disparity & Communication Gaps:** The `admin` (at the office/home) and the `packer` (in the warehouse) lack a real-time, single source of truth for orders, and critical updates (like stockouts) are often delayed.
4.  **Warehouse Inefficiency:** The `packer` must constantly look at a screen, switch between tasks, and manually confirm steps, slowing down fulfillment and increasing the chance of errors.

### **5. Target Audience**

- **Business Type:** D2C sellers who _avoid_ marketplaces to maximize their profit. (e.g., independent fashion brands, jewelry, hobbies, or thrift stores on IG/WA/TikTok).
- **Business Scale:** Growing Small-to-Medium Businesses (SMEs). Perfect for the "Overwhelmed Solopreneur" hiring their first staff, or small teams (2-5 people) needing a clear separation of duties.

### **6. Comparison & Advantages vs. Marketplaces**

This platform is designed for sellers who _avoid_ marketplaces. Here's why it's a superior model for them:

| Aspect             | Marketplace (Amazon, Shopee)                          | `WhatThePack.today`                                                                                               |
| :----------------- | :---------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------- |
| **Profit Margin**  | **Low.** Slashed by marketplace commissions (5-10%).  | **100% Profit.** No sales commissions.                                                                            |
| **Customer Data**  | **Owned by Marketplace.** You cannot re-market.       | **Owned by You.** You build your own customer data asset.                                                         |
| **Staff Security** | **Basic.** Generic admin roles.                       | **Granular & Secure (Auth0).** (`owner`, `admin`, `packer`) roles with totally separate UIs & data.               |
| **API Control**    | **Locked-in.** You must use their payment & shipping. | **Open & Secure (Auth0 Organization Metadata).** "Bring Your Own Courier" (via ShipEngine) & secure your API key. |
| **Warehouse Ops**  | **Manual.** `Packer` must view a screen.              | **Agentic (VAPI.ai).** `Packer` can work _hands-free_ via voice commands.                                         |
| **Business Intel** | **Generic.** Basic sales analytics.                   | **Specific & Secure (Auth0 RAG).** `Owner` sees profit, `Packer` sees SOPs. Same data, different views.           |

---

### **7. The Solution: Integrated Auth0 & AI Architecture**

`WhatThePack.today` solves this multi-layered crisis by integrating Auth0's security with targeted AI tools, creating a **secure, agentic workflow**:

- ✅ **Securely Onboards & Authenticates Staff:** Uses **Auth0 Universal Login**, enforces **MFA** for owners, employs **Auth0 Roles**, and leverages **Auth0's email enrollment flow** triggered via the Management API for secure staff onboarding. `Owner` invites staff via email, and staff set their own private passwords.
- ✅ **Ensures Business Isolation:** Leverages **Auth0 Organizations** for true multi-tenancy, guaranteeing data separation between businesses.
- ✅ **Protects Sensitive Credentials:** Secures the `owner`'s critical API key (e.g., ShipEngine) in **Auth0 Organization Metadata** (encrypted at rest), preventing exposure to staff or the AI itself.
- ✅ **Enables Secure Agentic Action & Warehouse Efficiency:** Empowers an **AI Agent** (running on Convex) - triggered via **VAPI.ai voice commands** from the `packer` - to securely access the **Organization Metadata** via Management API and execute actions (like buying labels) on the `owner`'s behalf. _This solves the core delegation nightmare **and** allows the packer to work hands-free, eliminating screen-switching inefficiency._
- ✅ **Delivers Role-Aware Intelligence:** Implements **Auth0's `Limit knowledge` (RAG)** principle, using the user's role (from the Auth0 JWT) to filter data _before_ it reaches the **LLM (OpenAI)**. _This ensures the AI provides relevant information (SOPs for packers, profit for owners) without leaking sensitive data._
- ✅ **Provides Proactive Communication:** Uses **Resend** (triggered by the AI Agent) to send automated email notifications (e.g., stock alerts reported via VAPI) to the relevant roles (`owner`/`admin`). _This instantly bridges the communication gap caused by location disparity._
- ✅ **Reduces Operational Burden:** Utilizes the **LLM** for practical AI assistance, such as extracting order details from pasted chat logs (`admin`) and generating business summaries/analysis (`owner`). _This directly combats operational chaos and slow data entry._

---

### **8. Maximizing the Tech Stack**

This project is designed to demonstrate the full power of the required tech stack, especially the entire Auth0 for AI Agents suite.

#### A. Full Auth0 Suite Utilization

1.  **Universal Login, MFA, Organizations, Roles, Actions:** This is the core. A "Login Flow Action" injects the user's `role` and `orgId` as claims into the JWT, which Convex uses to isolate all data. **MFA is enforced** for the `owner` role.
2.  **Auth0 Organization Metadata (Secure Credential Storage):**
    - **Laser Focus:** Organization Metadata has **one critical job**: to secure the `owner`'s **ShipEngine API Key**.
    - **The Trust Narrative:** "Our platform provides the AI, but you bring your own logistics asset. **Auth0 Organization Metadata** (encrypted at rest) is our guarantee that your most sensitive credential—your ShipEngine API key—is secure. We use it to buy labels on your behalf via Management API, but your staff (`admin`, `packer`) can never see or steal it."
3.  **Auth0 for AI - RAG (Limit Knowledge):**
    - The AI Agent uses the `role` from the JWT to filter data _before_ sending it to the LLM (which is powered by the platform's API key). A `packer` cannot request profit data, even if they try.
4.  **Auth0 Management API (Secure Onboarding):**
    - Staff onboarding uses Auth0's secure email enrollment triggered via the Management API. When the `owner` invites a staff member, the system creates the user in the correct `Organization`, assigns the appropriate `Role`, and triggers Auth0's enrollment email. Staff set their own private passwords.

#### B. Full LLM Stack Utilization (Platform-Powered)

1.  **AI RAG (Role-Aware Q\&A):** Answers questions from `owner`, `admin`, and `packer` with pre-secured, role-appropriate data.
2.  **AI Logistics Agent (Action):** (For `packer`) When triggered by the `packer`'s voice, this AI _acts_: it retrieves the ShipEngine API key from Auth0 Organization Metadata via Management API, calls the ShipEngine API, compares rates, and purchases the label.
3.  **AI Admin Assistant (Data Extraction):** (For `admin`) On the "New Order" form, the `admin` can paste raw chat text. The LLM will extract the data and **auto-fill** the order form draft.
4.  **AI Daily Briefing (Summarization):** (For `owner`) When the `owner` logs in (or asks via VAPI), the LLM generates a daily summary: "Good morning. There are 15 new orders, estimated profit $145. 'Black T-Shirt' stock is low (5 left)."
5.  **AI Business Analyst (Analysis & Forecasting):** (For `owner`) On the "Analytics" page, the `owner` can ask: "Show me this month's sales trends." The LLM analyzes the (secured RAG) data and provides _insights_ and _suggestions_.

---

### **9. Detailed Feature Matrix per Role**

| Feature                 | `owner` (The Strategist)                                                                                     | `admin` (The Operator)                                                                           | `packer` (The Executor)                                                                                           |
| :---------------------- | :----------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------- |
| **Login & Dashboard**   | **Login via `store-name...` (MFA Enforced).**<br>Full Dashboard: Financial KPIs, AI Analytics, Staff Logs.   | **Login via Username** (`name_role`)<br>Limited Dashboard: "Order Management" only.              | **Login via Username** (`name_role`)<br>Hyper-Limited Dashboard: "Packing Queue" only.                            |
| **Staff Management**    | ✅ **Yes** (**Invite** & Remove `admin` / `packer` via email enrollment).                                    | ❌ **No**                                                                                        | ❌ **No**                                                                                                         |
| **API Integration**     | ✅ **Yes** (Stores **ShipEngine** API key in **Auth0 Organization Metadata**).                               | ❌ **No**                                                                                        | ❌ **No**                                                                                                         |
| **Product Management**  | ✅ **Yes** (Upload/Edit Catalog & SOPs. Enters COGS, Sell Price, Bin Location).                              | ❌ **No**                                                                                        | ❌ **No**                                                                                                         |
| **Order Management**    | ✅ **Yes** (View & Edit all orders).                                                                         | ✅ **Yes** (Create new orders, view status).<br>**LLM Feature:** "Paste Chat" to auto-fill form. | ❌ **No** (Only sees `status: "paid"` queue).                                                                     |
| **Email Notifications** | ✅ **Receives**<br>("Stock Alert," "Daily Briefing," etc. from `notifications@whatthepack.today`).           | ✅ **Receives**<br>("Stock Alert," "Order Failed," etc.).                                        | ❌ **No** (Works via UI/VAPI only).                                                                               |
| **RAG (LLM) Access**    | ✅ **Full Access.**<br>"What's my profit?"<br>"Analyze SKU123 trends."                                       | ✅ **Limited Access.**<br>"What's order \#125 status?"<br>"How much stock is left for SKU123?"   | ✅ **Scoped Access.**<br>"How do I pack SKU123?"<br>"Where is SKU123 located?"                                    |
| **VAPI.ai Access**      | ✅ **Insight Mode (Read-Only).**<br>"Vapi, read my AI Daily Briefing."<br>"How is `packer` John performing?" | ❌ **No**                                                                                        | ✅ **Action Mode (Read-Write).**<br>"Vapi, next order."<br>"Finished, weight 300g."<br>"Stock for SKU123 is out." |
| **Staff Analytics**     | ✅ **Yes.**<br>Views performance dashboard (e.g., "Avg. pack time per `packer`").                            | ❌ **No**                                                                                        | ❌ **No**                                                                                                         |

---

### **10. Auth0 for AI Agents Implementation Details**

The project's entire security and operational model is built on solving the "multi-layered crisis of trust" using the complete Auth0 for AI Agents framework, intelligently integrated with other key AI technologies.

#### 10.1 Solving Organizational & Role-Based Trust (`Authenticate the user`)

- **The Problem:** How to manage multiple businesses securely and enforce strict permissions between `owner`, `admin`, and `packer`, especially during onboarding.
- **The Auth0 Solution:** Uses **Auth0 Organizations** for multi-tenancy and **Auth0 Roles + Actions** to inject JWT claims. **Crucially, staff onboarding uses Auth0's secure email enrollment triggered via the Management API.**
- **Implementation:**

  ```typescript
  // convex/auth.config.ts (Simplified)
  export default {
    providers: [
      {
        domain: process.env.AUTH0_DOMAIN!,
        applicationID: process.env.AUTH0_CLIENT_ID!,
      },
    ],
  };
  ```

  _Note: Role and organization claims are read and enforced in `convex/auth.ts` via `requireRole`, `getUserOrgId`, and `getUserRoles`._

  **Staff Onboarding (Auth0 Management API):** When the `owner` invites a staff member via the UI, a Convex `action` calls the Auth0 Management API. This call creates the user within the correct `Organization`, assigns the appropriate `Role`, and triggers Auth0 to send a secure **enrollment/invitation email** to the staff member. The staff member clicks the link and sets their _own private password_. The `owner` never knows it.

  ```typescript
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
      // Ensure Auth0 organization, create/reuse user, add as member, assign org-scoped role,
      // create enrollment ticket, upsert local user, and store invite.
      return { success: true };
    },
  });
  ```

- **Why This Matters:** Provides the foundational security layer, enables granular control, and ensures staff passwords remain private via a standard, secure onboarding flow.

#### 10.2 Solving Delegated Trust (`Control the tools`)

- **The Problem:** How to let a low-privilege `packer` perform a high-trust action (buy a shipping label) without the `owner`'s master API key?
- **The Auth0 Solution:** This is the star feature. The `owner` saves their **ShipEngine API Key** securely in **Auth0 Organization Metadata** (encrypted at rest). When the `packer` gives the voice command, the AI Agent (a Convex Action) uses the Management API to retrieve and _use_ that key on the organization's behalf, but the `packer` _never_ sees it.
- **Implementation:**

  ```typescript
  // convex/agents/shippingAgent.ts (excerpt)
  import { api, internal } from "../_generated/api";
  import { internalAction } from "../_generated/server";

  export const buyLabel = internalAction({
    args: { orderId: v.id("orders"), orgId: v.id("organizations") },
    handler: async (ctx, args) => {
      const order = await ctx.runQuery(api.orders.get, { orderId: args.orderId });
      const org = await ctx.runQuery(internal.organizations.get, { orgId: args.orgId });
      const auth0OrgId = selectAuth0OrgIdForEnv(org) || org.auth0OrgId!;
      const apiKey = await getShipEngineApiKeyFromAuth0(auth0OrgId);
      // Purchase label via ShipEngine REST, then persist
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

- **Why This Matters:** Built a true **zero-trust, delegated-action workflow**. The AI agent acts as a secure proxy, enabling a low-trust user to perform a high-trust action without ever exposing the credential.

#### 10.3 Solving AI Trust & Providing Role-Aware Info (`Limit knowledge`)

- **The Problem:** How to ensure the AI gives correct, role-specific answers (SOPs vs. Profit) without leaking data.
- **The Auth0 + LLM Solution:** Uses Auth0's `Limit knowledge` (RAG) principle. The AI Agent checks the user's `role` from the Auth0 JWT _before_ querying the database for context. The LLM _only_ receives data that the specific role is authorized to see.
- **Implementation:**

  ```typescript
  // convex/agents/ragAgent.ts (excerpt)
  import { query } from "../_generated/server";
  import { getUserOrgId, getUserRoles } from "../auth";
  import { chatCompletion } from "../utils/llm";

  export const answerQuery = query({
    args: { prompt: v.string() },
    handler: async (ctx, args) => {
      const roles = await getUserRoles(ctx);
      const orgId = await getUserOrgId(ctx);
      // collect role-scoped context by orgId...
      const result = await chatCompletion({
        messages: [
          { role: "system", content: "Answer only with provided, role-filtered context." },
          { role: "user", content: args.prompt },
        ],
        max_tokens: 500,
      });
      return result.content;
    },
  });
  ```

- **Why This Matters:** The AI's "brain" is dynamically and securely scoped based on _who_ is asking and _which organization_ they belong to. The RAG pipeline is permission-aware at the data-access layer, ensuring zero data leakage to the LLM or between tenants.

#### 10.4 Solving Warehouse Inefficiency & Enabling Agentic Action

- **The Problem:** Packers are slowed down by screen-switching and manual confirmations.
- **The VAPI.ai + AI Agent Solution:** Integrated **VAPI.ai** as the primary interface for the `packer`. Voice commands trigger the **AI Agent** (Convex Action), which then orchestrates the entire packing and shipping workflow (including RAG lookups and retrieving credentials from Auth0 Organization Metadata).
- **Why This Matters:** Creates a truly hands-free, efficient, and AI-driven warehouse operation.

#### 10.5 Solving Communication Gaps

- **The Problem:** Delayed critical updates (like stockouts) between warehouse and management.
- **The Resend + AI Agent Solution:** When the AI Agent detects a critical event (e.g., `packer` reports "stock out" via VAPI), it triggers a Convex Action that uses the **platform's Resend key** to send an instant email notification to the `owner` and `admin`.
- **Why This Matters:** Ensures timely communication and proactive management.

#### 10.6 Solving Operational Chaos & Data Entry Burden

- **The Problem:** Admins waste time copy-pasting chat logs into order forms; Owners struggle to get quick business insights.
- **The LLM Solution:** Leverages the **LLM (OpenAI)** for:
  - **Data Extraction:** The "Paste Chat to Auto-fill" feature on the `admin`'s order form.
  - **Summarization & Analysis:** The "AI Daily Briefing" and "Business Analyst" features for the `owner`.
- **Why This Matters:** Directly reduces manual labor and provides actionable intelligence.

---

### **11. Technical Architecture Summary**

- **Framework:** React 19 (Frontend), Convex (Backend, DB, Serverless Functions)
- **Authentication:** Auth0 (Universal Login, Organizations, Roles, MFA, Actions, Organization Metadata, Management API)
- **Voice AI:** VAPI.ai (Agentic voice interface for `packer` and `owner`)
- **Logistics API:** ShipEngine (Purchasing labels with `owner`'s key stored in Organization Metadata)
- **Build Tool:** Rsbuild
- **AI Model:** OpenAI (Powered by platform key, used for RAG, Summarization, Data Extraction, Analysis)
- **Notifications:** Resend (Powered by platform key, for stock alerts and system notifications)
- **Styling:** Mantine UI
- **Code Quality**: Biome (Linting), Prettier (Formatting), TypeScript strict mode

---

### **12. Complete Workflows**

**Flow 1: Setup & Data Upload (By `Owner`, One-Time)**

1.  `Owner` signs up. Auth0 creates a new `Organization`.
2.  `Owner` is directed to their unique subdomain: `store-name.whatthepack.today`.
3.  **Auth0:** `Owner` enables **MFA** on their account.
4.  **Integration:** `Owner` goes to "Integrations" and sees: **"Connect ShipEngine"**. They enter their ShipEngine API Key, which is stored securely in **Auth0 Organization Metadata** (encrypted at rest).
5.  **Data:** `Owner` uploads their Product Catalog CSV (SKU, Name, COGS, Sell Price, Stock, Bin Location, Packing SOP).
6.  **Background (LLM):** A Convex `action` triggers, using the _platform's_ OpenAI key to create RAG _embeddings_.
7.  **Staff Onboarding:** `Owner` goes to "Manage Staff" → "Invite New Staff".
8.  `Owner` enters the staff member's **Email** (`lisa.admin@email.com`), assigns a **Role** (`admin`), and optionally a **Username Base** (`lisa`). System confirms `lisa_admin`.
9.  `Owner` clicks "Send Invite".
10. **Backend (Auth0 Management API):** Convex calls Auth0 to create the user (`lisa_admin`) in the `Organization` and trigger Auth0's **email enrollment flow**.
11. **Staff Experience:** Lisa receives an Auth0 email, clicks the link, and **sets her own private password**. `Owner` invites `john.packer@email.com` similarly for the `packer` role (username `john_packer`).

**Flow 2: Daily Order Processing (Manual Admin → AI Logistics)**

1.  `Admin` Lisa logs in using username `lisa_admin` and her private password. She sees the "Order Management" dashboard.
2.  (Outside the app) Lisa handles customer chat and manually verifies payment.
3.  In `WhatThePack`, Lisa clicks "Create New Order".
4.  **LLM Feature:** She pastes the final chat confirmation. The _platform's_ LLM extracts details to **auto-fill** the draft form.
5.  Lisa verifies, selects SKU123, and clicks **"Send to Warehouse"**.
6.  Order #125 (`status: "paid"`) appears **in real-time** on `Packer` John's screen.
7.  John starts the **VAPI Voice Workflow**.
8.  **VAPI:** "Finished packing. Weight 300 grams."
9.  The **AI Logistics Agent (Convex)** is triggered:
    - Retrieves `owner`'s ShipEngine API key from **Auth0 Organization Metadata** via Management API.
    - Calls **ShipEngine** → buys the cheapest label (billing the `owner`'s account).
    - Updates `order` in Convex with tracking number.
    - Updates `product` stock in Convex.
10. **VAPI** confirms to John: "Label printed. Stock is now 14."
11. **Real-time (Admin):** Lisa's screen updates: Order #125 → "Shipped", tracking number appears.
12. Lisa (manually) sends the tracking number to the customer.

**Flow 3: Proactive Notification Workflow (AI → Human)**

1.  `Packer` John (via VAPI): "Vapi, stock for SKU123 is out."
2.  AI Agent updates `product` stock to 0.
3.  **AI Agent (Automatic):** Triggers a Notification _action_.
4.  _Action_ uses the **platform's Resend key** to send an email from `notifications@whatthepack.today` to `owner@store-a.com` and `lisa@store-a.com`:
    > **Subject: CRITICAL STOCK ALERT - SKU123 (Red Shirt)**
    > Stock for SKU123 (Red Shirt) was just reported as 0 by `packer` John on October 19, 11:15.
    > Please contact your vendor immediately to reorder.
5.  `Owner` and `admin` are instantly notified.

**Flow 4: `Owner` Monitoring Workflow (Mobile)**

1.  `Owner` opens VAPI on their phone (logged in as `owner`).
2.  **`Owner` (via VAPI):** "Vapi, read me my AI Daily Briefing."
3.  **AI (VAPI + RAG + Platform LLM):** Provides the summary with financials and stock alerts.
4.  `Owner` is informed and ends the call.

---

### **13. Key Design Principles**

1.  **Security by Design:** Multi-layered security using Auth0's full suite (Organizations, Roles, MFA, Organization Metadata) ensures data isolation and prevents credential exposure.
2.  **Zero-Trust Delegation:** Low-privilege users can trigger high-trust actions through AI agents without ever accessing sensitive credentials.
3.  **Role-Aware Intelligence:** AI provides contextually appropriate information based on user roles, preventing data leakage.
4.  **Human-in-the-Loop:** The platform augments rather than replaces human judgment, particularly in customer-facing interactions.
5.  **Hands-Free Operations:** Voice interface for warehouse staff eliminates screen-switching inefficiency while maintaining security.
6.  **Real-Time Collaboration:** Convex provides instant data synchronization across roles and locations.
7.  **Proactive Communication:** Automated notifications bridge communication gaps without manual intervention.
