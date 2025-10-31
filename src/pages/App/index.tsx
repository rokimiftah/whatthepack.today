import type { Id } from "../../../convex/_generated/dataModel";
import type React from "react";

import { useEffect, useState } from "react";

import { useAuth0 } from "@auth0/auth0-react";
import { Alert, Button, Loader, Modal, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconAlertCircle,
  IconArrowRight,
  IconChartBar,
  IconCheck,
  IconRobot,
  IconShieldLock,
  IconSparkles,
  IconWorld,
  IconX,
} from "@tabler/icons-react";
import { Authenticated, Unauthenticated, useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useLocation } from "wouter";

import { canTriggerLogin, markLoginStarted } from "@shared/utils/authFlow";
import { buildOrgUrl, getAuth0OrgIdForCurrentEnv, getCurrentSubdomain, isReservedSubdomain } from "@shared/utils/subdomain";

import { api } from "../../../convex/_generated/api";

export default function RootPage() {
  const subdomain = getCurrentSubdomain();
  if (subdomain) {
    return <TenantRoot />;
  }
  return <MarketingLanding />;
}

const slugRegex = /^[a-z0-9-]+$/;
const MAX_SLUG_LENGTH = 48;

function sanitizeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, MAX_SLUG_LENGTH);
}

function MarketingLanding() {
  const { loginWithRedirect } = useAuth0();
  const { isAuthenticated } = useConvexAuth();
  const [opened, { open, close }] = useDisclosure(false);

  // State for subdomain modal
  const [slugValue, setSlugValue] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Query to check if authenticated user has an organization
  const organizationResult = useQuery(api.organizations.getForCurrentUser, isAuthenticated ? {} : "skip");

  // Validate slug input
  const normalizedSlug = sanitizeSlug(slugValue);
  const slugIsReserved = normalizedSlug ? isReservedSubdomain(normalizedSlug) : false;

  // Auth0 signup for new users (keep subdomain selection in onboarding)
  const handleAuth0Signup = () => {
    void loginWithRedirect({
      authorizationParams: {
        screen_hint: "signup",
      },
    });
  };

  // Handle dashboard button click - always show modal for subdomain selection
  const handleDashboardClick = () => {
    // If authenticated and has org, go directly to their subdomain
    if (isAuthenticated && organizationResult?.organization) {
      const org = organizationResult.organization;
      if (!org.onboardingCompleted) {
        window.location.href = buildOrgUrl(org.slug, "/onboarding");
      } else {
        window.location.href = buildOrgUrl(org.slug, "/dashboard");
      }
      return;
    }

    // Otherwise, show modal to input/select subdomain
    open();
  };

  // Handle subdomain selection - redirect to that subdomain
  const handleSubdomainSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const finalSlug = normalizedSlug;

    if (!finalSlug) {
      setFormError("Subdomain is required.");
      return;
    }

    if (!slugRegex.test(finalSlug)) {
      setFormError("Subdomain can only contain lowercase letters, numbers, and hyphens.");
      return;
    }

    if (isReservedSubdomain(finalSlug)) {
      setFormError("That subdomain is reserved by the platform. Try a different name.");
      return;
    }

    setFormError(null);
    setSaving(true);

    // Redirect to subdomain - auth will happen there
    const subdomainUrl = buildOrgUrl(finalSlug, "/");
    window.location.href = subdomainUrl;
  };

  const getSlugErrorMessage = (): string | null => {
    if (!normalizedSlug) return null; // Don't show error if empty
    if (!slugRegex.test(normalizedSlug)) return "Only lowercase letters, numbers, and hyphens allowed.";
    if (normalizedSlug.length < 3) return "Subdomain must be at least 3 characters.";
    if (slugIsReserved) return "This subdomain is reserved by the platform.";
    return null;
  };

  const slugErrorMessage = getSlugErrorMessage();

  return (
    <>
      {/* Subdomain Selection Modal */}
      <Modal
        opened={opened}
        onClose={close}
        title={null}
        size="md"
        centered
        padding="xl"
        radius="lg"
        withCloseButton={false}
        overlayProps={{
          blur: 3,
          opacity: 1,
        }}
      >
        <Stack gap="xl">
          {/* Header with Logo */}
          <Stack gap="md" align="center">
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #000000 0%, #434343 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 10px 40px rgba(0, 0, 0, 0.15)",
                padding: "20px",
              }}
            >
              <img
                src="https://cdn.whatthepack.today/logo.png"
                alt="WhatThePack Logo"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
            </div>
            <Stack gap={4} align="center">
              <Text size="xl" fw={700} ta="center" c="gray.9">
                Access Your Store
              </Text>
            </Stack>
          </Stack>

          <form onSubmit={handleSubdomainSubmit}>
            <Stack gap="lg">
              {/* Input Field with Enhanced Styling */}
              <TextInput
                label={
                  <Text size="sm" fw={600} c="gray.8" mb={4}>
                    Store Subdomain
                  </Text>
                }
                value={slugValue}
                onChange={(event) => setSlugValue(event.currentTarget.value)}
                maxLength={MAX_SLUG_LENGTH}
                autoFocus
                size="md"
                leftSection={<IconWorld size={18} color="gray" />}
                rightSection={
                  <Text size="sm" c="gray.6" style={{ whiteSpace: "nowrap", marginRight: 8 }}>
                    .whatthepack.today
                  </Text>
                }
                rightSectionWidth={150}
                styles={{
                  input: {
                    fontSize: "15px",
                    fontWeight: 500,
                    borderWidth: 2,
                    transition: "all 0.2s ease",
                  },
                }}
              />

              {/* Error Alert */}
              {formError && (
                <Alert
                  color="red"
                  variant="light"
                  icon={<IconAlertCircle size={16} />}
                  styles={{
                    root: {
                      borderLeft: "4px solid var(--mantine-color-red-6)",
                    },
                  }}
                >
                  {formError}
                </Alert>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                fullWidth
                size="md"
                loading={saving}
                disabled={Boolean(slugErrorMessage) || !normalizedSlug}
                styles={{
                  root: {
                    background: "linear-gradient(135deg, #000000 0%, #434343 100%)",
                    border: "none",
                    height: 48,
                    fontSize: "15px",
                    fontWeight: 600,
                    transition: "all 0.3s ease",
                  },
                }}
                rightSection={<IconArrowRight size={18} />}
              >
                Continue to Dashboard
              </Button>
            </Stack>
          </form>
        </Stack>
      </Modal>

      <div className="min-h-dvh bg-white text-neutral-900 antialiased selection:bg-neutral-200">
        {/* Skip link for a11y */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:bg-black focus:px-3 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>

        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-neutral-900/10 bg-white/95 backdrop-blur-xl supports-[backdrop-filter]:bg-white/80">
          <div className="mx-auto max-w-screen-2xl px-6">
            <div className="flex h-16 items-center justify-between">
              <a
                href="#top"
                className="font-mono text-xs tracking-[0.3em] text-neutral-900 transition-colors hover:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                WHATTHEPACK
              </a>

              {/* Desktop nav */}
              <nav className="hidden gap-10 text-sm font-medium text-neutral-700 md:flex">
                <HeaderLink href="#solutions">Features</HeaderLink>
                <HeaderLink href="#comparison">Comparison</HeaderLink>
                <HeaderLink href="#security">How It Works</HeaderLink>
              </nav>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDashboardClick}
                  className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-black bg-black px-3 text-sm font-medium text-white transition-all duration-200 hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white motion-reduce:transition-none"
                >
                  Dashboard <IconArrowRight className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main id="main">
          {/* HERO */}
          <section className="flex min-h-[calc(100dvh-4rem)] items-center justify-center border-b border-neutral-200" id="top">
            <div className="mx-auto w-full max-w-screen-2xl px-6 text-center">
              <div className="mx-auto max-w-4xl">
                <div className="mb-8 inline-block border-l-4 border-neutral-900 pl-4">
                  <span className="font-mono text-xs font-semibold tracking-[0.3em] text-neutral-600 uppercase">
                    What Should Be Packed Today?
                  </span>
                </div>
                <h1 className="text-5xl leading-[1.1] font-bold tracking-tight md:text-7xl lg:text-8xl">
                  <span className="underline decoration-neutral-400 decoration-2 underline-offset-8">Secure & Automate</span> Your
                  D2C Logistics.
                </h1>
                <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-neutral-600 md:text-xl">
                  <span className="font-semibold">WhatThePack.today</span> is the AI-powered "Mission Control" OS for D2C
                  businesses. Manage staff, secure courier APIs, and process orders 10x faster—without ever sharing your sensitive
                  access.
                </p>
                <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
                  <Unauthenticated>
                    <button
                      onClick={handleAuth0Signup}
                      className="group inline-flex h-12 cursor-pointer items-center gap-2 rounded-md border-2 border-black bg-black px-6 text-sm font-semibold text-white transition-all duration-200 hover:border-neutral-800 hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white motion-reduce:transition-none"
                    >
                      Get Started{" "}
                      <IconArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                    </button>
                  </Unauthenticated>
                  <Authenticated>
                    <button
                      onClick={handleDashboardClick}
                      className="group inline-flex h-12 cursor-pointer items-center gap-2 rounded-md border-2 border-black bg-black px-6 text-sm font-semibold text-white transition-all duration-200 hover:border-neutral-800 hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white motion-reduce:transition-none"
                    >
                      Go to Dashboard{" "}
                      <IconArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                    </button>
                  </Authenticated>
                </div>

                <dl className="mx-auto mt-20 grid max-w-3xl grid-cols-3 divide-x divide-neutral-300 rounded-md border-2 border-neutral-200 bg-neutral-50/50">
                  <Stat label="Profit Margin" value="100%" note="No commissions" />
                  <Stat label="Data" value="You own it" note="Forever" />
                  <Stat label="Setup" value="5 minutes" note="No install" />
                </dl>
              </div>
            </div>
          </section>

          {/* THE SOLUTION */}
          <section className="border-b border-neutral-200">
            <div className="mx-auto max-w-screen-2xl p-6 md:p-12 lg:p-16 xl:p-20">
              <div className="mb-4 inline-block border-l-4 border-emerald-600 pl-4">
                <span className="font-mono text-xs font-semibold tracking-[0.3em] text-neutral-600 uppercase">The Solution</span>
              </div>
              <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
                Introducing WhatThePack.today: Your Business's AI Mission Control
              </h2>
              <div className="mt-8 space-y-4 text-lg leading-relaxed text-neutral-700">
                <p>
                  We solve your <strong>"Delegation Nightmare."</strong> WhatThePack is an intelligent and secure logistics
                  operating system.
                </p>
                <p>
                  You can finally hire an <code className="bg-neutral-200 px-1.5 py-0.5 text-sm">admin</code> and{" "}
                  <code className="bg-neutral-200 px-1.5 py-0.5 text-sm">packer</code> with peace of mind. Your staff gets a
                  dedicated dashboard for their specific tasks, while all your sensitive data (like profit margins) and API Keys
                  (like ShipEngine) stay locked in your secure vault.
                </p>
                <p>
                  Your <code className="bg-neutral-200 px-1.5 py-0.5 text-sm">packer</code> can even work{" "}
                  <strong>hands-free</strong> using voice commands, transforming your warehouse into an efficient logistics hub.
                </p>
              </div>
            </div>
          </section>

          {/* CORE FEATURES */}
          <section id="solutions" className="border-b border-neutral-200">
            <div className="mx-auto max-w-screen-2xl">
              <div className="border-b border-neutral-200 p-6 md:p-12 lg:p-16 xl:p-20">
                <div className="mb-4 inline-block border-l-4 border-neutral-900 pl-4">
                  <span className="font-mono text-xs font-semibold tracking-[0.3em] text-neutral-600 uppercase">
                    Core Features
                  </span>
                </div>
                <h2 className="text-4xl font-bold tracking-tight md:text-5xl">Core Features That Put You Back in Control</h2>
                <p className="mt-4 text-lg text-neutral-600">
                  This is where we combine Auth0's security and AI's intelligence for you.
                </p>
              </div>
              <div className="grid divide-x divide-y divide-neutral-200 sm:grid-cols-2">
                <FeatureCell icon={IconShieldLock} title="1. Flawless Security & Delegation">
                  <strong>Granular Staff Management:</strong> Three clear roles (owner, admin, packer) with completely separate
                  access rights and dashboards.
                  <br />
                  <br />
                  <strong>Secure Staff Onboarding:</strong> Invite staff via email. They create their own private password using a
                  secure Auth0 link. You never know their password.
                  <br />
                  <br />
                  <strong>Secure Credential Storage (Organization Metadata):</strong> Securely store your courier API Keys
                  (ShipEngine, etc.) in encrypted metadata. Staff can trigger actions without ever seeing the key.
                  <br />
                  <br />
                  <strong>Secure Multi-Tenancy:</strong> Every business is completely isolated, ensuring your data never leaks to
                  another business.
                </FeatureCell>
                <FeatureCell icon={IconRobot} title="2. The Super-Efficient (Hands-Free) Warehouse">
                  <strong>AI Voice Commands (VAPI.ai):</strong> Say goodbye to screens! Your packer can work hands-free. "Vapi,
                  next order!" or "Vapi, SKU123 is out of stock."
                  <br />
                  <br />
                  <strong>AI Logistics Agent:</strong> When the packer says, "Finished, weight 300 grams," our AI automatically
                  buys the shipping label (using the API from your Vault) and prints it.
                  <br />
                  <br />
                  <strong>Smart SOPs (RAG):</strong> Packer confused? "Vapi, how do I pack this shirt?" The AI will instantly read
                  the packing SOP for that specific product.
                </FeatureCell>
                <FeatureCell icon={IconSparkles} title="3. The Smart Admin (Not a Data Entry Clerk)">
                  <strong>AI Chat Extraction:</strong> Simply paste the chat log from WhatsApp or Instagram. The AI will
                  automatically fill out the entire order form for you.
                  <br />
                  <br />
                  <strong>Real-time Order Status:</strong> When the packer finishes an order in the warehouse, the admin will
                  instantly see the tracking number appear on their dashboard. No more guessing.
                </FeatureCell>
                <FeatureCell icon={IconChartBar} title="4. Business Insights Just for the Owner">
                  <strong>AI Daily Briefing:</strong> "Vapi, read me my daily briefing." Get a summary of your profit, order
                  count, and staff performance delivered straight to your phone.
                  <br />
                  <br />
                  <strong>Secure Data Analysis (RAG):</strong> Only the owner can ask, "What's our profit on SKU123?" The AI will
                  refuse to give this financial info to an admin or packer.
                  <br />
                  <br />
                  <strong>Proactive Notifications:</strong> If a packer reports an item out of stock by voice, the AI will
                  automatically send a "CRITICAL STOCK ALERT" email to the owner and admin immediately.
                </FeatureCell>
              </div>
            </div>
          </section>

          {/* COMPARISON */}
          <section id="comparison" className="border-b border-neutral-200">
            <div className="mx-auto max-w-screen-2xl p-6 md:p-12 lg:p-16 xl:p-20">
              <div className="mb-8 inline-block border-l-4 border-neutral-900 pl-4">
                <span className="font-mono text-xs font-semibold tracking-[0.3em] text-neutral-600 uppercase">Comparison</span>
              </div>
              <h2 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
                Designed for Independent Sellers (Who Avoid Marketplaces)
              </h2>
              <p className="mb-8 text-lg text-neutral-600">We aren't a marketplace. We're your partner for maximizing profit.</p>
              <div className="overflow-x-auto border-2 border-neutral-200">
                <table className="w-full">
                  <thead className="border-b-2 border-neutral-200 bg-neutral-50">
                    <tr>
                      <th className="px-8 py-5 text-left text-xs font-bold tracking-wider text-neutral-900 uppercase">Aspect</th>
                      <th className="px-8 py-5 text-left text-xs font-bold tracking-wider text-neutral-900 uppercase">
                        Marketplaces
                      </th>
                      <th className="px-8 py-5 text-left text-xs font-bold tracking-wider text-neutral-900 uppercase">
                        WhatThePack
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    <ComparisonRow
                      aspect="Profit Margin"
                      marketplace="Low. Slashed by 5-10% commissions."
                      whatthepack="100% Profit. No sales commissions."
                    />
                    <ComparisonRow
                      aspect="Customer Data"
                      marketplace="Owned by Marketplace. You can't re-market."
                      whatthepack="Owned by You. Build your own customer data asset."
                    />
                    <ComparisonRow
                      aspect="Staff Security"
                      marketplace="Basic. Generic admin roles."
                      whatthepack="Granular & Secure. Clearly separate admin & packer."
                    />
                    <ComparisonRow
                      aspect="API Control"
                      marketplace="Locked-in. Must use their couriers & payment."
                      whatthepack="Open & Secure. BYOC & secure your API key."
                    />
                    <ComparisonRow
                      aspect="Warehouse Ops"
                      marketplace="Manual. Packer must look at a screen."
                      whatthepack="Agentic (AI). Packer can work hands-free via voice."
                    />
                    <ComparisonRow
                      aspect="Business Intel"
                      marketplace="Generic. Basic sales analytics."
                      whatthepack="Specific & Secure. Owner sees profit, Packer sees SOPs."
                    />
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ROLES SECTION */}
          <section id="security" className="border-b border-neutral-200 bg-neutral-50/30">
            <div className="mx-auto max-w-screen-2xl">
              <div className="border-b border-neutral-200 p-6 md:p-12 lg:p-16 xl:p-20">
                <div className="mb-4 inline-block border-l-4 border-neutral-900 pl-4">
                  <span className="font-mono text-xs font-semibold tracking-[0.3em] text-neutral-600 uppercase">
                    How It Works
                  </span>
                </div>
                <h2 className="text-4xl font-bold tracking-tight md:text-5xl">One Platform, Three Tailor-Made Roles</h2>
              </div>
              <div className="grid divide-x divide-y divide-neutral-200 sm:grid-cols-3">
                <RoleCell
                  title="For the Owner"
                  subtitle="(The Strategist)"
                  permissions={[
                    "✅ View profit & KPI dashboards",
                    "✅ Securely manage and invite staff",
                    "✅ Connect your courier APIs just once",
                    "✅ Get daily briefings via AI",
                  ]}
                />
                <RoleCell
                  title="For the Admin"
                  subtitle="(The Operator)"
                  permissions={[
                    '✅ "Paste Chat" for lightning-fast order entry',
                    "✅ See real-time status for all orders",
                    "✅ Get out-of-stock notifications",
                    "❌ Cannot see profit or API Keys",
                  ]}
                />
                <RoleCell
                  title="For the Packer"
                  subtitle="(The Executor)"
                  permissions={[
                    "✅ Work 100% hands-free with voice commands",
                    "✅ Process orders, buy labels, and report stock-outs by voice",
                    "✅ Ask the AI for packing SOPs",
                    "❌ Cannot see order data or financials",
                  ]}
                />
              </div>
            </div>
          </section>

          {/* KEY FEATURES */}
          <section className="border-b border-neutral-200">
            <div className="mx-auto max-w-screen-2xl p-6 md:p-12 lg:p-16 xl:p-20">
              <div className="mb-4 inline-block border-l-4 border-neutral-900 pl-4">
                <span className="font-mono text-xs font-semibold tracking-[0.3em] text-neutral-600 uppercase">Why Choose Us</span>
              </div>
              <h2 className="mb-8 text-4xl font-bold tracking-tight md:text-5xl">Built for D2C Independence</h2>
              <div className="grid gap-6 divide-y divide-neutral-200 border border-neutral-200 md:gap-0 md:divide-y-0">
                <BenefitGroup title="Complete Data Isolation">
                  <BenefitItem>Each business gets its own secure workspace—no data mixing between companies</BenefitItem>
                  <BenefitItem>Role-based permissions ensure staff only see what they need to see</BenefitItem>
                  <BenefitItem>Your customer data, order history, and financial info stay private</BenefitItem>
                </BenefitGroup>
                <BenefitGroup title="Safe Delegation">
                  <BenefitItem>Packers can purchase shipping labels without accessing your courier account</BenefitItem>
                  <BenefitItem>Admins manage orders without seeing your profit margins</BenefitItem>
                  <BenefitItem>Staff actions are logged and auditable for full transparency</BenefitItem>
                </BenefitGroup>
                <BenefitGroup title="Context-Aware Assistance">
                  <BenefitItem>AI provides relevant information based on each team member's role</BenefitItem>
                  <BenefitItem>Warehouse staff get packing instructions and bin locations</BenefitItem>
                  <BenefitItem>Business owners get profit analysis and strategic insights</BenefitItem>
                </BenefitGroup>
              </div>
            </div>
          </section>
        </main>

        {/* FINAL CTA */}
        <section className="border-b border-neutral-200">
          <div className="mx-auto flex max-w-screen-2xl flex-col items-start gap-4 px-4 py-10 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-xl font-medium text-neutral-900">Ready to Turn Chaos into Control?</h3>
              <p className="mt-1 text-sm text-neutral-700">
                Focus on the "human touch" with your customers. Let WhatThePack.today handle the logistics chaos and secure your
                business.
              </p>
            </div>
            <div className="flex gap-2">
              <Unauthenticated>
                <button
                  onClick={handleAuth0Signup}
                  className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-black bg-black px-3 text-sm font-medium text-white transition-all duration-200 hover:border-neutral-800 hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white motion-reduce:transition-none"
                >
                  Get Started <IconArrowRight className="size-4" aria-hidden="true" />
                </button>
              </Unauthenticated>
              <Authenticated>
                <button
                  onClick={handleDashboardClick}
                  className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-black bg-black px-3 text-sm font-medium text-white transition-all duration-200 hover:border-neutral-800 hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white motion-reduce:transition-none"
                >
                  Go to Dashboard <IconArrowRight className="size-4" aria-hidden="true" />
                </button>
              </Authenticated>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function TenantRoot() {
  const subdomain = getCurrentSubdomain();
  const { loginWithRedirect } = useAuth0();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [location, navigate] = useLocation();
  const syncCurrentUser = useMutation(api.users.syncCurrentUser);
  const ensureOrgLoginReady = useAction(api.onboarding.ensureOrgLoginReady);
  const [userSyncStatus, setUserSyncStatus] = useState<"idle" | "pending" | "done">("idle");

  // SECURITY: First, validate that the subdomain actually exists in database
  // This prevents subdomain squatting attacks where anyone can access random subdomains
  const subdomainValidation = useQuery(api.organizations.getBySlug, subdomain ? { slug: subdomain } : "skip");

  const organizationResult = useQuery(
    api.organizations.getForCurrentUser,
    isAuthenticated ? { expectedSlug: subdomain || undefined } : "skip",
  );
  const sessionMetadata = useQuery(api.auth.getSessionMetadata, isAuthenticated ? {} : "skip");

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    if (subdomainValidation === undefined) return;
    if (subdomainValidation === null) return;
    if (userSyncStatus !== "idle") return;

    const orgIdHint = (subdomainValidation as { _id: Id<"organizations"> } | null | undefined)?._id;

    setUserSyncStatus("pending");
    void syncCurrentUser(orgIdHint ? { orgIdHint } : {})
      .catch((error) => {
        console.error("[TenantRoot] Failed to sync current user", error);
      })
      .finally(() => {
        setUserSyncStatus("done");
      });
  }, [isAuthenticated, isLoading, subdomainValidation, syncCurrentUser, userSyncStatus]);

  // Auto-redirect to Auth0 login if not authenticated
  useEffect(() => {
    if (isLoading) return;
    if (subdomainValidation === undefined) return; // Wait for subdomain validation

    // If not authenticated, auto-redirect to Auth0 login with organization
    if (!isAuthenticated && subdomainValidation !== null) {
      if (!canTriggerLogin()) return; // prevent double login flows
      const precomputedOrgId = getAuth0OrgIdForCurrentEnv(subdomainValidation as any);
      console.log("[TenantRoot] Not authenticated, preparing org connection then redirecting to Auth0 login...");
      (async () => {
        let ensuredOrgId: string | undefined;
        try {
          if (subdomain) {
            const ensured = await ensureOrgLoginReady({ slug: subdomain });
            ensuredOrgId = (ensured as any)?.auth0OrgId as string | undefined;
          }
        } catch (e) {
          console.warn("[TenantRoot] ensureOrgLoginReady failed", (e as any)?.message || e);
        }
        const search = typeof window !== "undefined" ? window.location.search : "";
        const isSignupIntent = search.includes("action=signup");
        const authorizationParams: Record<string, string> = {};
        const orgParam = ensuredOrgId || precomputedOrgId;
        if (orgParam) authorizationParams.organization = orgParam;
        if (isSignupIntent) authorizationParams.screen_hint = "signup";
        markLoginStarted();
        void loginWithRedirect({ authorizationParams });
      })();
      return;
    }
  }, [isLoading, isAuthenticated, subdomainValidation, loginWithRedirect, ensureOrgLoginReady, subdomain]);

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    if (organizationResult === undefined) return;

    // NEW: If user is authenticated but has NO organization → redirect to onboarding
    if (!organizationResult || !organizationResult?.organization) {
      // Check if user has owner role (from sessionMetadata)
      if (sessionMetadata?.roles?.includes("owner")) {
        if (location !== "/onboarding") {
          console.log("[TenantRoot] Owner has no org → redirecting to onboarding");
          navigate("/onboarding", { replace: true });
        }
        return;
      }
      // Non-owner without org → should not happen, stay on current page
      return;
    }

    const org = organizationResult.organization;
    const orgSlug = org.slug;

    // SECURITY: If user has org but is on wrong subdomain, redirect to correct subdomain (keep session)
    if (orgSlug && orgSlug !== subdomain) {
      console.log("[TenantRoot] User on wrong subdomain, redirecting to org subdomain...");
      console.log("[TenantRoot] Current subdomain:", subdomain, "Expected:", orgSlug);
      const correctUrl = buildOrgUrl(orgSlug, location);
      console.log("[TenantRoot] Redirecting to:", correctUrl);
      if (typeof window !== "undefined") {
        window.location.replace(correctUrl);
      }
      return;
    }

    if (!organizationResult.organization.onboardingCompleted) {
      if (location !== "/onboarding") {
        navigate("/onboarding", { replace: true });
      }
      return;
    }

    if (location !== "/dashboard") {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, isLoading, organizationResult, sessionMetadata, navigate, location, subdomain]);

  if (!subdomain) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
        <p className="text-neutral-300">Missing subdomain context. Reload your secure store URL.</p>
      </div>
    );
  }

  // SECURITY: Check if subdomain validation is still loading
  if (subdomainValidation === undefined) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
        <Loader size="xl" type="dots" />
      </div>
    );
  }

  // SECURITY: If subdomain doesn't exist in database, show 404
  // This prevents subdomain squatting attacks
  if (subdomainValidation === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
        <div className="max-w-lg space-y-4 text-center">
          <div className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/20 text-6xl">
            404
          </div>
          <h1 className="text-3xl font-semibold">Organization Not Found</h1>
          <p className="text-neutral-300">
            The subdomain <span className="font-semibold text-white">{subdomain}.whatthepack.today</span> does not exist.
          </p>
          <p className="text-sm text-neutral-400">If you're trying to access your organization, please check the URL spelling.</p>
          <a
            href={
              typeof window !== "undefined" && window.location.hostname.includes(".dev.")
                ? "https://dev.whatthepack.today"
                : "https://whatthepack.today"
            }
            className="inline-flex items-center gap-2 rounded-md border border-white/40 px-6 py-3 text-sm font-semibold transition hover:bg-white/10"
          >
            Go to Platform Home
          </a>
        </div>
      </div>
    );
  }

  if (isLoading || (isAuthenticated && organizationResult === undefined)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
        <Loader size="xl" type="dots" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Auto-redirect is happening in useEffect, show loading state
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
        <Stack gap="md" align="center">
          <Loader size="xl" type="dots" />
        </Stack>
      </div>
    );
  }

  if (!organizationResult?.organization) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
        <div className="max-w-lg space-y-4 text-center">
          <h1 className="text-3xl font-semibold">Organization not provisioned</h1>
          <p className="text-neutral-300">
            We couldn&apos;t find an organization linked to your account. Complete provisioning or contact support.
          </p>
        </div>
      </div>
    );
  }

  if (!organizationResult.organization.onboardingCompleted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
        <Loader size="xl" type="dots" />
      </div>
    );
  }

  const sessionResolved = sessionMetadata !== undefined;
  if (!sessionResolved) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
        <Loader size="xl" type="dots" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
      <Loader size="xl" type="dots" />
    </div>
  );
}

// ───────────────────────── Components ─────────────────────────

function HeaderLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="transition-colors hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
    >
      {children}
    </a>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-2 p-6">
      <dt className="font-mono text-[10px] font-semibold tracking-[0.3em] text-neutral-500 uppercase">{label}</dt>
      <dd className="text-3xl font-bold md:text-4xl">{value}</dd>
      {note ? <span className="text-xs text-neutral-600">{note}</span> : null}
    </div>
  );
}

function FeatureCell({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="group flex flex-col gap-4 p-8 transition-colors hover:bg-neutral-50/50 md:p-10">
      <div className="flex items-center gap-3">
        <div className="rounded-md border-2 border-neutral-200 bg-white p-2 transition-colors group-hover:border-neutral-900">
          <Icon className="size-5 text-neutral-900" aria-hidden="true" />
        </div>
        <span className="font-semibold text-neutral-900">{title}</span>
      </div>
      <p className="text-sm leading-relaxed text-neutral-600">{children}</p>
    </div>
  );
}

function ComparisonRow({ aspect, marketplace, whatthepack }: { aspect: string; marketplace: string; whatthepack: string }) {
  return (
    <tr className="transition-colors hover:bg-neutral-50">
      <td className="px-8 py-5 font-bold text-neutral-900">{aspect}</td>
      <td className="px-8 py-5 text-neutral-500">{marketplace}</td>
      <td className="px-8 py-5 font-semibold text-neutral-900">{whatthepack}</td>
    </tr>
  );
}

function BenefitGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-4 border-l-4 border-neutral-900 p-6 md:p-8">
      <h3 className="text-lg font-bold text-neutral-900">{title}</h3>
      <ul className="grid gap-3 text-sm text-neutral-800">{children}</ul>
    </div>
  );
}

function BenefitItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <IconCheck className="mt-[2px] size-5 flex-none text-emerald-600" aria-hidden="true" />
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

function RoleCell({ title, subtitle, permissions }: { title: string; subtitle: string; permissions: string[] }) {
  return (
    <div className="flex flex-col gap-6 p-8 transition-colors hover:bg-white md:p-12">
      <div>
        <h3 className="text-2xl font-bold text-neutral-900">{title}</h3>
        <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
      </div>
      <ul className="space-y-3 text-sm text-neutral-700">
        {permissions.map((permission, index) => {
          const isAllowed = permission.startsWith("✅");
          const text = permission.replace(/^[✅❌]\s*/, "");

          return (
            <li key={index} className="flex items-start gap-2 leading-relaxed">
              {isAllowed ? (
                <IconCheck className="mt-0.5 size-4 flex-none text-emerald-600" aria-hidden="true" />
              ) : (
                <IconX className="mt-0.5 size-4 flex-none text-red-600" aria-hidden="true" />
              )}
              <span>{text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
