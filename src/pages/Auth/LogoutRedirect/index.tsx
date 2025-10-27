import { useEffect } from "react";

import { useAuth0 } from "@auth0/auth0-react";
import { Center, Loader, Stack } from "@mantine/core";

export default function LogoutRedirectPage() {
  const { logout } = useAuth0();

  useEffect(() => {
    logout({ logoutParams: { returnTo: window.location.origin } });
  }, [logout]);

  return (
    <Center mih="100vh" bg="gray.0">
      <Stack align="center" gap="sm">
        <Loader size="xl" type="dots" />
      </Stack>
    </Center>
  );
}
