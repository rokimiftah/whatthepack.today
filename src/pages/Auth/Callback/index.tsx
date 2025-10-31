// src/pages/Auth/Callback/index.tsx

import { useEffect, useMemo, useRef } from "react";

import { useAuth0 } from "@auth0/auth0-react";
import { Center, Loader, Stack, Text } from "@mantine/core";
import { useQuery } from "convex/react";
import { useLocation } from "wouter";

import { getAuth0OrgIdForCurrentEnv, getCurrentSubdomain } from "@shared/utils/subdomain";

import { api } from "../../../../convex/_generated/api";

/**
 * Auth0 Callback Handler
 *
 * This page handles the OAuth callback from Auth0.
 * Auth0 SDK will automatically exchange the code for tokens.
 * Redirects based on onboarding completion status.
 */
export default function CallbackPage() {
  const { isLoading, isAuthenticated, error, user, logout, loginWithRedirect } = useAuth0();
  const [, setLocation] = useLocation();
  const hasHandledRef = useRef(false);
  const retriedNoOrgRef = useRef(false);
  const retriedLoginRequiredRef = useRef(false);
  const subdomain = getCurrentSubdomain();

  // Check if user has completed onboarding
  const organizationResult = useQuery(
    api.organizations.getForCurrentUser,
    isAuthenticated ? { expectedSlug: subdomain || undefined } : "skip",
  );
  const sessionMetadata = useQuery(api.auth.getSessionMetadata, isAuthenticated ? {} : "skip");
  const orgBySlug = useQuery(api.organizations.getBySlug, subdomain ? { slug: subdomain } : "skip");

  const shouldRetryNoOrg = useMemo(() => {
    const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const err = urlParams?.get("error");
    const desc = decodeURIComponent(urlParams?.get("error_description") || "");
    const urlMismatch = err === "access_denied" && /is not part of the org_/i.test(desc);
    const hookMismatch = !!(error && /is not part of the org_/i.test(error.message || ""));
    return urlMismatch || hookMismatch;
  }, [error]);

  useEffect(() => {
    // If Auth0 sign-in failed with org-membership error, immediately retry WITHOUT organization
    if (!retriedNoOrgRef.current && shouldRetryNoOrg) {
      retriedNoOrgRef.current = true;
      void loginWithRedirect({ authorizationParams: {} }).catch(() => {});
      return;
    }
    // Handle login_required by triggering interactive login (with org param when available)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const err = params.get("error");
      if (!isAuthenticated && err === "login_required" && !retriedLoginRequiredRef.current) {
        retriedLoginRequiredRef.current = true;
        const oid = orgBySlug ? (getAuth0OrgIdForCurrentEnv(orgBySlug as any) as string | undefined) : undefined;
        const authorizationParams: Record<string, string> = {};
        if (oid) authorizationParams.organization = oid;
        void loginWithRedirect({ authorizationParams }).catch(() => {});
        return;
      }
    }

    // Once authentication is complete, redirect to appropriate page
    if (hasHandledRef.current) return;

    if (!isLoading && isAuthenticated) {
      if (user && user.email_verified === false) {
        hasHandledRef.current = true;
        const emailQuery = user.email ? `?email=${encodeURIComponent(user.email)}` : "";

        void logout({
          openUrl: false,
        })
          .catch((logoutError) => {
            console.error("Auth0 logout failed", logoutError);
          })
          .finally(() => {
            setLocation(`/email-confirmation${emailQuery}`);
          });
        return;
      }

      // Wait for organization data to load
      if (organizationResult === undefined) return;

      // NEW: Also wait for sessionMetadata to determine user role
      if (sessionMetadata === undefined) return;

      // If organization exists and onboarding NOT completed → Onboarding
      if (organizationResult?.organization && !organizationResult.organization.onboardingCompleted) {
        hasHandledRef.current = true;
        setLocation("/onboarding", { replace: true });
        return;
      }

      // If onboarding completed → Dashboard
      if (organizationResult?.organization?.onboardingCompleted) {
        hasHandledRef.current = true;
        setLocation("/dashboard", { replace: true });
        return;
      }

      // If NO organization → go to onboarding (owner-only gating handled inside onboarding page)
      if (!organizationResult || !organizationResult?.organization) {
        hasHandledRef.current = true;
        console.log("[Callback] No organization → redirecting to onboarding");
        setLocation("/onboarding", { replace: true });
        return;
      }

      // Fallback: redirect to root (for non-owners without org)
      hasHandledRef.current = true;
      setLocation("/", { replace: true });
    }
  }, [
    isLoading,
    isAuthenticated,
    organizationResult,
    sessionMetadata,
    setLocation,
    user,
    logout,
    loginWithRedirect,
    shouldRetryNoOrg,
    orgBySlug,
  ]);

  if (error) {
    // For org-membership error, hide the error and show a loader while retrying without organization
    if (retriedNoOrgRef.current || shouldRetryNoOrg || retriedLoginRequiredRef.current) {
      return (
        <Center style={{ height: "100vh" }}>
          <Stack align="center" gap="md">
            <Loader size="xl" type="dots" />
          </Stack>
        </Center>
      );
    }
    return (
      <Center style={{ height: "100vh" }}>
        <Stack align="center" gap="md">
          <Text size="xl" fw={600} c="red">
            Authentication Error
          </Text>
          <Text size="sm" c="dimmed">
            {error.message}
          </Text>
          <Text size="xs" c="dimmed">
            Please try logging in again.
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Center style={{ height: "100vh" }}>
      <Stack align="center" gap="md">
        <Loader size="xl" type="dots" />
      </Stack>
    </Center>
  );
}
