/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agents_analystAgent from "../agents/analystAgent.js";
import type * as agents_briefingAgent from "../agents/briefingAgent.js";
import type * as agents_extractionAgent from "../agents/extractionAgent.js";
import type * as agents_notificationAgent from "../agents/notificationAgent.js";
import type * as agents_ragAgent from "../agents/ragAgent.js";
import type * as agents_shippingAgent from "../agents/shippingAgent.js";
import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as emails_templates_DailyBriefingEmail from "../emails/templates/DailyBriefingEmail.js";
import type * as emails_templates_StockAlertEmail from "../emails/templates/StockAlertEmail.js";
import type * as emails from "../emails.js";
import type * as http from "../http.js";
import type * as inventory from "../inventory.js";
import type * as invites from "../invites.js";
import type * as magicLink from "../magicLink.js";
import type * as mgmt from "../mgmt.js";
import type * as movements from "../movements.js";
import type * as notifications from "../notifications.js";
import type * as onboarding from "../onboarding.js";
import type * as orders from "../orders.js";
import type * as organizations from "../organizations.js";
import type * as provision from "../provision.js";
import type * as security from "../security.js";
import type * as testing from "../testing.js";
import type * as users from "../users.js";
import type * as utils_llm from "../utils/llm.js";
import type * as utils_urls from "../utils/urls.js";
import type * as vapi from "../vapi.js";
import type * as vapi_node from "../vapi_node.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "agents/analystAgent": typeof agents_analystAgent;
  "agents/briefingAgent": typeof agents_briefingAgent;
  "agents/extractionAgent": typeof agents_extractionAgent;
  "agents/notificationAgent": typeof agents_notificationAgent;
  "agents/ragAgent": typeof agents_ragAgent;
  "agents/shippingAgent": typeof agents_shippingAgent;
  analytics: typeof analytics;
  auth: typeof auth;
  crons: typeof crons;
  "emails/templates/DailyBriefingEmail": typeof emails_templates_DailyBriefingEmail;
  "emails/templates/StockAlertEmail": typeof emails_templates_StockAlertEmail;
  emails: typeof emails;
  http: typeof http;
  inventory: typeof inventory;
  invites: typeof invites;
  magicLink: typeof magicLink;
  mgmt: typeof mgmt;
  movements: typeof movements;
  notifications: typeof notifications;
  onboarding: typeof onboarding;
  orders: typeof orders;
  organizations: typeof organizations;
  provision: typeof provision;
  security: typeof security;
  testing: typeof testing;
  users: typeof users;
  "utils/llm": typeof utils_llm;
  "utils/urls": typeof utils_urls;
  vapi: typeof vapi;
  vapi_node: typeof vapi_node;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
