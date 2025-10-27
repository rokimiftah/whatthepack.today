// src/pages/Auth/Verified/index.tsx

import { useEffect } from "react";

import { useAuth0 } from "@auth0/auth0-react";
import { Center, Loader, Stack, Text } from "@mantine/core";
import { IconCircleCheck } from "@tabler/icons-react";
import { useLocation } from "wouter";

/**
 * Email Verification Success Page
 *
 * This page is shown after user clicks email verification link.
 * It auto-triggers login to create session, then redirects to onboarding.
 */
export default function VerifiedPage() {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();
  const [, navigate] = useLocation();

  useEffect(() => {
    // If already authenticated, go to onboarding
    if (isAuthenticated) {
      navigate("/onboarding", { replace: true });
      return;
    }

    // If not loading and not authenticated, trigger login
    if (!isLoading && !isAuthenticated) {
      // Auto-trigger login after 1.5 seconds (show success message first)
      const timer = setTimeout(() => {
        loginWithRedirect({
          authorizationParams: {
            redirect_uri: `${window.location.origin}/auth/callback`,
            // Use prompt: none to skip login screen if session exists
            prompt: "none",
          },
          appState: {
            returnTo: "/onboarding",
          },
        }).catch(() => {
          // If prompt: none fails (no session), show login screen
          loginWithRedirect({
            authorizationParams: {
              redirect_uri: `${window.location.origin}/auth/callback`,
            },
            appState: {
              returnTo: "/onboarding",
            },
          });
        });
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isLoading, loginWithRedirect, navigate]);

  return (
    <Center style={{ minHeight: "100vh", background: "#000" }}>
      <Stack align="center" gap="xl">
        <IconCircleCheck size={64} color="#51cf66" />

        <Stack align="center" gap="sm">
          <Text size="xl" fw={700} c="white">
            Email Verified Successfully! ✓
          </Text>

          {isAuthenticated ? (
            <Text size="sm" c="dimmed">
              Redirecting to onboarding...
            </Text>
          ) : (
            <Loader size="xl" type="dots" />
          )}
        </Stack>
      </Stack>
    </Center>
  );
}
