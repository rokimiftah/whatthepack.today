import { useEffect, useMemo, useState } from "react";

import { useAuth0 } from "@auth0/auth0-react";
import { Anchor, Button, Center, Container, Loader, Paper, Stack, Text, Title } from "@mantine/core";
import { IconMail, IconMailCheck } from "@tabler/icons-react";
import { useAction, useQuery } from "convex/react";
import { useLocation } from "wouter";

import { getAuth0OrgIdForCurrentEnv, getCurrentSubdomain } from "@shared/utils/subdomain";

import { api } from "../../../../convex/_generated/api";

export default function EmailConfirmationPage() {
  const { loginWithRedirect, isLoading, user } = useAuth0();
  const [, navigate] = useLocation();
  const resendVerificationEmail = useAction(api.mgmt.resendVerificationEmail);
  const subdomain = getCurrentSubdomain();
  const org = useQuery(api.organizations.getBySlug, subdomain ? { slug: subdomain } : "skip");

  const [resendStatus, setResendStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const email = useMemo(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const value = params.get("email");
    if (value) return decodeURIComponent(value);
    return user?.email ?? null;
  }, [user?.email]);

  const handleResendEmail = async () => {
    if (!email) {
      setResendStatus("error");
      setResendMessage("Email address not found. Please reopen the verification link from your inbox.");
      return;
    }

    setResendStatus("pending");
    setResendMessage(null);

    try {
      const result = await resendVerificationEmail({ email });

      if (result.alreadyVerified) {
        setResendStatus("success");
        setResendMessage("Your email is already verified. You can continue to sign in.");
        return;
      }

      setResendStatus("success");
      setResendMessage("Verification email sent. Please check your inbox (and spam folder).");
    } catch (error) {
      console.error("[EmailConfirmation] Resend verification failed", error);
      setResendStatus("error");

      let message = "Failed to resend verification email. Please contact support if this keeps happening.";
      if (typeof (error as { message?: string })?.message === "string") {
        message = (error as { message?: string }).message?.includes("Service not enabled within domain")
          ? "Verification email service is not enabled for this tenant. Contact support to configure Auth0 Management API."
          : ((error as { message?: string }).message ?? message);
      }

      setResendMessage(message);
    }
  };

  const handleContinue = () => {
    if (typeof window === "undefined") return;
    void loginWithRedirect({
      authorizationParams: {
        prompt: "login",
        redirect_uri: `${window.location.origin}/auth/callback`,
        ...(org && getAuth0OrgIdForCurrentEnv(org as any) ? { organization: getAuth0OrgIdForCurrentEnv(org as any) } : {}),
      },
      appState: {
        returnTo: "/onboarding",
      },
    });
  };

  // Auto-hide success message after 5 seconds
  useEffect(() => {
    if (resendStatus === "success" && resendMessage) {
      const t = window.setTimeout(() => setResendMessage(null), 5000);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [resendStatus, resendMessage]);

  return (
    <Center bg="gray.0" mih="100vh" px="md">
      <Container size={420}>
        <Paper withBorder radius="lg" shadow="lg" p="xl" bg="white">
          <Stack gap="lg" align="center">
            <IconMailCheck size={44} color="#22c55e" aria-hidden />
            <Stack gap="sm" align="center" ta="center">
              <Title order={3}>Confirm your email</Title>
              <Text size="sm" c="gray.6">
                {email ? (
                  <>
                    We sent a verification link to{" "}
                    <Text component="span" fw={600}>
                      {email}
                    </Text>
                    . Open your inbox and confirm to activate your account.
                  </>
                ) : (
                  "We sent a verification link to your email. Open your inbox and confirm to activate your account."
                )}
              </Text>
            </Stack>

            <Stack gap="sm" w="100%">
              <Button
                variant="filled"
                leftSection={resendStatus === "pending" ? <Loader size="sm" /> : <IconMail size={16} />}
                onClick={handleResendEmail}
                disabled={isLoading || resendStatus === "pending" || !email}
              >
                {resendStatus === "pending" ? "Sending verification email…" : "Resend verification email"}
              </Button>

              {resendMessage ? (
                <Paper
                  withBorder
                  radius="lg"
                  p="sm"
                  bg={resendStatus === "success" ? "green.0" : "red.0"}
                  c={resendStatus === "success" ? "green.7" : "red.7"}
                >
                  <Text size="xs">{resendMessage}</Text>
                </Paper>
              ) : null}

              <Button
                variant="outline"
                onClick={handleContinue}
                disabled={isLoading}
                leftSection={isLoading ? <Loader size="sm" /> : null}
              >
                {isLoading ? "Loading…" : "I have verified my email"}
              </Button>

              <Button variant="subtle" color="gray" onClick={() => navigate("/", { replace: true })}>
                Back to landing page
              </Button>
            </Stack>

            <Text size="xs" c="gray.5" ta="center">
              Check your spam folder if you don’t see the email in your inbox. Need help?{" "}
              <Anchor href="mailto:support@whatthepack.today" size="xs">
                Contact support
              </Anchor>
            </Text>
          </Stack>
        </Paper>
      </Container>
    </Center>
  );
}
