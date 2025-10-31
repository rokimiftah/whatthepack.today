import type { ReactNode } from "react";

import { useEffect, useRef } from "react";

import { useAuth0 } from "@auth0/auth0-react";
import { Anchor, Box, Button, Center, Container, Loader, Paper, Stack, Text, Title } from "@mantine/core";
import { useConvexAuth, useQuery } from "convex/react";

import { buildOrgUrl, getAuth0OrgIdForCurrentEnv, getCurrentSubdomain } from "@shared/utils/subdomain";

import { api } from "../../../convex/_generated/api";
import AdminDashboard from "./AdminDashboard";
import OwnerDashboard from "./OwnerDashboard";
import PackerDashboard from "./PackerDashboard";

function FullscreenState({
  title,
  description,
  primaryAction,
}: {
  title: string;
  description?: string;
  primaryAction?: ReactNode;
}) {
  return (
    <Center h="100vh" bg="gray.0">
      <Stack align="center" gap="md" maw={440} ta="center">
        <Title order={2}>{title}</Title>
        {description ? <Text c="gray.6">{description}</Text> : null}
        {primaryAction}
      </Stack>
    </Center>
  );
}

export default function DashboardPlaceholder() {
  const { loginWithRedirect, logout: auth0Logout } = useAuth0();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const subdomain = getCurrentSubdomain();
  const loginStartedRef = useRef(false);

  const subdomainValidation = useQuery(api.organizations.getBySlug, subdomain ? { slug: subdomain } : "skip");

  const organizationResult = useQuery(
    api.organizations.getForCurrentUser,
    isAuthenticated ? { expectedSlug: subdomain || undefined } : "skip",
  );

  useEffect(() => {
    if (!organizationResult || !organizationResult.organization) return;

    const org = organizationResult.organization;
    const orgSlug = org.slug;

    if (orgSlug && orgSlug !== subdomain) {
      const correctUrl = buildOrgUrl(orgSlug, "/");
      void auth0Logout({
        logoutParams: {
          returnTo: correctUrl,
        },
      });
    }
  }, [organizationResult, subdomain, auth0Logout]);

  // If unauthenticated on a tenant domain, automatically start org-scoped login
  useEffect(() => {
    if (isLoading || isAuthenticated || !subdomain) return;
    if (subdomainValidation === undefined) return; // wait until we know the org exists
    if (loginStartedRef.current) return;
    loginStartedRef.current = true;
    const oid = subdomainValidation ? (getAuth0OrgIdForCurrentEnv(subdomainValidation as any) as string | undefined) : undefined;
    const authorizationParams: Record<string, string> = {};
    if (oid) authorizationParams.organization = oid;
    void loginWithRedirect({ authorizationParams }).catch(() => {
      // allow UI fallback below
    });
  }, [isLoading, isAuthenticated, subdomain, subdomainValidation, loginWithRedirect]);

  if (subdomain && subdomainValidation === undefined) {
    return (
      <Center h="100vh" bg="gray.0">
        <Stack align="center" gap="md">
          <Loader size="xl" type="dots" />
        </Stack>
      </Center>
    );
  }

  if (subdomain && subdomainValidation === null) {
    const homeUrl =
      typeof window !== "undefined" && window.location.hostname.includes(".dev.")
        ? "https://dev.whatthepack.today"
        : "https://whatthepack.today";
    return (
      <FullscreenState
        title="Organization not found"
        description={`The subdomain ${subdomain}.whatthepack.today does not exist.`}
        primaryAction={
          <Button component="a" href={homeUrl} variant="light">
            Go to platform home
          </Button>
        }
      />
    );
  }

  // Important: handle loading state first to avoid false "Sign in required" during Auth0 init
  if (isLoading) {
    return (
      <Center h="100vh" bg="gray.0">
        <Stack align="center" gap="md">
          <Loader size="xl" type="dots" />
        </Stack>
      </Center>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
        <Loader size="xl" type="dots" />
      </div>
    );
  }

  if (organizationResult === undefined) {
    return (
      <Center h="100vh" bg="gray.0">
        <Stack align="center" gap="md">
          <Loader size="xl" type="dots" />
        </Stack>
      </Center>
    );
  }

  if (!organizationResult?.organization) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
        <Loader size="xl" type="dots" />
      </div>
    );
  }

  const roles: string[] = organizationResult.roles || [];
  const isOwner = roles.includes("owner");
  const isAdmin = roles.includes("admin");
  const isPacker = roles.includes("packer");

  return (
    <Box bg="gray.0" mih="100vh">
      <Container fluid py="xl">
        {isOwner && <OwnerDashboard />}
        {!isOwner && isAdmin && <AdminDashboard />}
        {!isOwner && !isAdmin && isPacker && <PackerDashboard />}
        {!isOwner && !isAdmin && !isPacker && (
          <Paper withBorder p="xl" radius="lg" bg="white">
            <Stack gap="sm" align="center">
              <Title order={4}>Role pending</Title>
              <Text c="gray.6" ta="center">
                No role is assigned to your account yet. Contact your organization owner for access.
              </Text>
              <Anchor size="sm" href="mailto:support@whatthepack.today" target="_blank" rel="noreferrer">
                Contact support
              </Anchor>
            </Stack>
          </Paper>
        )}
      </Container>
    </Box>
  );
}
