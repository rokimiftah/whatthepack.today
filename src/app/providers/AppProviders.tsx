// src/app/providers/AppProviders.tsx

import type { ReactNode } from "react";

import { Auth0Provider } from "@auth0/auth0-react";
import "@mantine/charts/styles.css";
import { MantineProvider } from "@mantine/core";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithAuth0 } from "convex/react-auth0";

import { appTheme } from "./theme";

// Disable Convex's default beforeunload warning to prevent browser popups
const convex = new ConvexReactClient(import.meta.env.PUBLIC_CONVEX_URL, {
  unsavedChangesWarning: false,
});

export function AppProviders({ children }: { children: ReactNode }) {
  // Rsbuild uses PUBLIC_ prefix for env vars
  const domain = import.meta.env.PUBLIC_AUTH0_DOMAIN;
  const clientId = import.meta.env.PUBLIC_AUTH0_CLIENT_ID;
  const audience = import.meta.env.PUBLIC_AUTH0_AUDIENCE;
  const hostname = typeof window !== "undefined" ? window.location.hostname : undefined;

  // Share Auth0 session across subdomains by scoping cookie to the parent domain
  const cookieDomain = (() => {
    if (!hostname) return undefined;
    if (hostname.endsWith(".dev.whatthepack.today")) return ".dev.whatthepack.today";
    if (hostname.endsWith(".whatthepack.today")) return ".whatthepack.today";
    return undefined; // localhost or custom domains
  })();

  // Debug: Log env vars and current URL
  console.log("Auth0 Config:", {
    domain,
    clientId,
    audience,
    hostname: typeof window !== "undefined" ? window.location.hostname : "SSR",
    origin: typeof window !== "undefined" ? window.location.origin : "SSR",
  });

  if (!domain || !clientId) {
    console.error("❌ Auth0 credentials missing! Check PUBLIC_AUTH0_DOMAIN and PUBLIC_AUTH0_CLIENT_ID in .env.local");
  }

  // Build authorization params
  const authParams: Record<string, any> = {
    redirect_uri: typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : "",
  };

  // Add audience if defined
  if (audience) {
    authParams.audience = audience;
  }

  // NOTE: Organization parameter is NOT set here because:
  // 1. We only have the subdomain slug (e.g., "dodong")
  // 2. Auth0 requires the actual organization ID (e.g., "org_xxxxx")
  // 3. The organization ID is looked up and passed in specific loginWithRedirect calls
  //    (see src/pages/App/index.tsx line 632)

  return (
    <MantineProvider theme={appTheme} defaultColorScheme="light" forceColorScheme="light" withCssVariables>
      <Auth0Provider
        domain={domain}
        clientId={clientId}
        authorizationParams={authParams}
        useRefreshTokens={true}
        cacheLocation="localstorage"
        // Critical for cross-subdomain SSO when using refresh tokens stored per-origin
        useRefreshTokensFallback={true}
        // Scope the SDK's isAuthenticated cookie to parent domain so silent auth works across subdomains
        {...(cookieDomain ? { cookieDomain } : {})}
        // More robust transaction handling (magic links, multi-tab)
        useCookiesForTransactions={true}
      >
        <ConvexProviderWithAuth0 client={convex}>{children}</ConvexProviderWithAuth0>
      </Auth0Provider>
    </MantineProvider>
  );
}
