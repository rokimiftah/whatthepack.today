// src/pages/Auth/Callback/index.tsx

import { useEffect, useRef } from "react";

import { useAuth0 } from "@auth0/auth0-react";
import { Center, Loader, Stack, Text } from "@mantine/core";
import { useQuery } from "convex/react";
import { useLocation } from "wouter";

import { getCurrentSubdomain } from "@shared/utils/subdomain";

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
  const subdomain = getCurrentSubdomain();

  // Check if user has completed onboarding
  const organizationResult = useQuery(
    api.organizations.getForCurrentUser,
    isAuthenticated ? { expectedSlug: subdomain || undefined } : "skip",
  );
  const sessionMetadata = useQuery(api.auth.getSessionMetadata, isAuthenticated ? {} : "skip");

  useEffect(() => {
    // If Auth0 SDK surfaced an error that the user isn't part of the org, retry WITHOUT the organization param
    if (!retriedNoOrgRef.current && error && /is not part of the org_/i.test(error.message || "")) {
      retriedNoOrgRef.current = true;
      void loginWithRedirect({ authorizationParams: {} }).catch(() => {});
      return;
    }

    // Fallback: if Auth0 returned access_denied "not part of the org_*", retry login WITHOUT organization param
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const err = params.get("error");
      const desc = params.get("error_description") || "";
      if (err === "access_denied" && /is not part of the org_/i.test(decodeURIComponent(desc))) {
        void loginWithRedirect({ authorizationParams: {} }).catch(() => {});
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

      // NEW: If NO organization but user is OWNER → Onboarding (first-time setup)
      if (!organizationResult || !organizationResult?.organization) {
        if (sessionMetadata?.roles?.includes("owner")) {
          hasHandledRef.current = true;
          console.log("[Callback] Owner without org → redirecting to onboarding");
          setLocation("/onboarding", { replace: true });
          return;
        }
      }

      // Fallback: redirect to root (for non-owners without org)
      hasHandledRef.current = true;
      setLocation("/", { replace: true });
    }
  }, [isLoading, isAuthenticated, organizationResult, sessionMetadata, setLocation, user, logout, loginWithRedirect]);

  if (error) {
    // If we've triggered a retry already, just show a loader; otherwise show the error
    if (retriedNoOrgRef.current) {
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
