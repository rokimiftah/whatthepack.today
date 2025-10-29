import { useEffect } from "react";

import { useAuth0 } from "@auth0/auth0-react";
import { Alert, Anchor, Box, Button, Container, Divider, Group, List, Paper, Stack, Text, Title } from "@mantine/core";
import { IconArrowRight, IconShieldCheck, IconShieldExclamation } from "@tabler/icons-react";
import { useConvexAuth, useQuery } from "convex/react";
import { useLocation } from "wouter";

import { api } from "../../../../convex/_generated/api";
import { getCurrentSubdomain } from "@shared/utils/subdomain";

export default function MfaRequiredPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { loginWithRedirect, logout } = useAuth0();
  const [location, navigate] = useLocation();
  const subdomain = getCurrentSubdomain();
  const org = useQuery(api.organizations.getBySlug, subdomain ? { slug: subdomain } : "skip");

  const sessionMetadata = useQuery(api.auth.getSessionMetadata, isAuthenticated ? {} : "skip");

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      const authorizationParams: Record<string, string> = {};
      if (org && (org as any).auth0OrgId) {
        authorizationParams.organization = (org as any).auth0OrgId as string;
      }
      void loginWithRedirect({ authorizationParams });
    }
  }, [isAuthenticated, isLoading, loginWithRedirect, org]);

  const mfaResolved = sessionMetadata !== undefined;
  const isOwnerWithoutMfa =
    sessionMetadata?.authenticated && sessionMetadata.roles.includes("owner") && sessionMetadata.mfaEnrolled === false;

  useEffect(() => {
    if (sessionMetadata?.authenticated && sessionMetadata.mfaEnrolled !== false) {
      if (location !== "/dashboard") {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [sessionMetadata?.authenticated, sessionMetadata?.mfaEnrolled, navigate, location]);

  return (
    <Box bg="gray.0" mih="100vh">
      <Paper withBorder radius={0} shadow="sm" bg="white" style={{ position: "sticky", top: 0, zIndex: 10 }}>
        <Container size="sm" py="md">
          <Group align="flex-start" gap="md">
            <IconShieldExclamation size={36} color="#f59e0b" aria-hidden />
            <Stack gap={4}>
              <Text size="xs" tt="uppercase" fw={600} c="gray.6" lts={4}>
                Security requirement
              </Text>
              <Title order={3}>Enable multi-factor authentication</Title>
            </Stack>
          </Group>
        </Container>
      </Paper>

      <Container size="sm" py="xl">
        <Stack gap="xl">
          <Paper withBorder radius="lg" p="xl" bg="white" shadow="xs">
            <Stack gap="lg">
              <Text c="gray.7" lh={1.7}>
                Owner accounts must complete multi-factor authentication (MFA) before accessing WhatThePack Mission Control. Auth0
                uses this extra verification to secure your organization&apos;s shipping credentials and analytics.
              </Text>

              <Alert color="yellow" variant="light" radius="lg">
                <Stack gap="xs">
                  <Text fw={600} c="yellow.9">
                    Steps to finish setup:
                  </Text>
                  <List type="ordered" spacing="xs" size="sm" c="yellow.9">
                    <List.Item>Return to the Auth0 login tab and follow the on-screen instructions to enroll in MFA.</List.Item>
                    <List.Item>
                      Scan the QR code or configure your authentication app (Authy, Google Authenticator, etc.).
                    </List.Item>
                    <List.Item>Enter the verification code to confirm enrollment.</List.Item>
                    <List.Item>Come back to this page and press “I’ve completed MFA”.</List.Item>
                  </List>
                </Stack>
              </Alert>

              <Group justify="space-between" align="center" wrap="wrap" gap="sm">
                <Button
                  variant="light"
                  color="teal"
                  leftSection={<IconShieldCheck size={16} />}
                  onClick={() => window.location.reload()}
                >
                  I’ve completed MFA
                </Button>
                <Button
                  variant="outline"
                  color="gray"
                  onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                >
                  Sign out
                </Button>
              </Group>
            </Stack>
          </Paper>

          <Paper withBorder radius="lg" p="xl" bg="white" shadow="xs">
            <Stack gap="sm">
              <Title order={4}>Need help?</Title>
              <Text size="sm" c="gray.6">
                If you closed the Auth0 tab prematurely, reopen the secure login and finish MFA enrollment.
              </Text>
              <Button
                mt="sm"
                variant="filled"
                color="brand"
                rightSection={<IconArrowRight size={16} />}
                onClick={() => {
                  const authorizationParams: Record<string, string> = { prompt: "login" };
                  if (org && (org as any).auth0OrgId) {
                    authorizationParams.organization = (org as any).auth0OrgId as string;
                  }
                  loginWithRedirect({ authorizationParams });
                }}
              >
                Reopen Auth0 login
              </Button>
            </Stack>
          </Paper>
        </Stack>
      </Container>

      <Divider />

      <Container size="sm" py="lg">
        <Text size="xs" c="gray.5" ta="center">
          Need assistance? Email{" "}
          <Anchor href="mailto:security@whatthepack.today" size="xs">
            security@whatthepack.today
          </Anchor>
        </Text>
      </Container>

      {(!mfaResolved || isOwnerWithoutMfa === false) && (
        <Box
          component="div"
          aria-live="polite"
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0, 0, 0, 0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
        >
          Session updated. Continuing…
        </Box>
      )}
    </Box>
  );
}
