import { useEffect } from "react";

import { useAuth0 } from "@auth0/auth0-react";
import { Center, Loader, Stack } from "@mantine/core";
import { useLocation } from "wouter";

export default function LoginRedirectPage() {
  const { loginWithRedirect } = useAuth0();
  const [, navigate] = useLocation();

  useEffect(() => {
    void loginWithRedirect().catch((error) => {
      console.error("Auth0 login redirect failed", error);
      navigate("/", { replace: true });
    });
  }, [loginWithRedirect, navigate]);

  return (
    <Center mih="100vh" bg="gray.0">
      <Stack align="center" gap="sm">
        <Loader size="xl" type="dots" />
      </Stack>
    </Center>
  );
}
