import { useEffect } from "react";

import { useAuth0 } from "@auth0/auth0-react";
import { Center, Loader, Stack } from "@mantine/core";
import { useQuery } from "convex/react";
import { useLocation } from "wouter";

import { getAuth0OrgIdForCurrentEnv, getCurrentSubdomain } from "@shared/utils/subdomain";

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
    if (org) {
      const oid = getAuth0OrgIdForCurrentEnv(org as any);
      if (oid) authorizationParams.organization = oid;
    }

    void loginWithRedirect({ authorizationParams }).catch((error) => {
      console.error("Auth0 login redirect failed", error);
      const msg = (error && (error.message || error.error_description)) || "";
      if (/is not part of the org_/i.test(msg)) {
        // Retry without organization parameter
        void loginWithRedirect({ authorizationParams: { redirect_uri: authorizationParams.redirect_uri } }).catch(() => {
          navigate("/", { replace: true });
        });
        return;
      }
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
