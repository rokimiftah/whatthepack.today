import { useEffect } from "react";

import { useAuth0 } from "@auth0/auth0-react";
import { Center, Loader, Stack } from "@mantine/core";
import { useQuery } from "convex/react";
import { useLocation } from "wouter";

import { getCurrentSubdomain } from "@shared/utils/subdomain";

import { api } from "../../../../convex/_generated/api";

export default function LoginRedirectPage() {
  const { loginWithRedirect } = useAuth0();
  const [, navigate] = useLocation();
  const subdomain = getCurrentSubdomain();
  const org = useQuery(api.organizations.getBySlug, subdomain ? { slug: subdomain } : "skip");

  useEffect(() => {
    const authorizationParams: Record<string, string> = {};
    if (typeof window !== "undefined") {
      authorizationParams.redirect_uri = `${window.location.origin}/auth/callback`;
    }
    if (org && (org as any).auth0OrgId) {
      authorizationParams.organization = (org as any).auth0OrgId as string;
    }

    void loginWithRedirect({ authorizationParams }).catch((error) => {
      console.error("Auth0 login redirect failed", error);
      navigate("/", { replace: true });
    });
  }, [loginWithRedirect, navigate, org]);

  return (
    <Center mih="100vh" bg="gray.0">
      <Stack align="center" gap="sm">
        <Loader size="xl" type="dots" />
      </Stack>
    </Center>
  );
}
