// src/shared/components/MobileBlocker.tsx

import { useEffect, useState } from "react";

import { Anchor, Box, Button, Container, Image, Paper, Stack, Text, Title } from "@mantine/core";

export default function MobileBlocker({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

      // Check if it's a mobile device
      const mobileCheck = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());

      // Also check screen width
      const screenCheck = window.innerWidth < 768;

      // Check if touch device
      const touchCheck = "ontouchstart" in window || navigator.maxTouchPoints > 0;

      // Consider it mobile if it matches mobile user agent OR (small screen AND touch capable)
      setIsMobile(mobileCheck || (screenCheck && touchCheck));
    };

    // Check on mount
    checkMobile();

    // Check on resize
    window.addEventListener("resize", checkMobile);

    // Check on orientation change
    window.addEventListener("orientationchange", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
      window.removeEventListener("orientationchange", checkMobile);
    };
  }, []);

  if (isMobile) {
    const shareUrl = typeof window !== "undefined" ? window.location.href : "https://whatthepack.today";

    return (
      <Box
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #f7faff 0%, #e6efff 100%)",
        }}
      >
        <Container size={420}>
          <Paper radius="lg" shadow="xl" p="xl" withBorder>
            <Stack align="center" gap="lg">
              <Image src="/logo.png" alt="WhatThePack.today" h={64} fit="contain" />
              <Title order={2} ta="center" size="h3" c="brand.7">
                Desktop Experience Required
              </Title>
              <Text ta="center" c="gray.7">
                WhatThePack.today is optimized for desktop workflows. To access your secure mission control, please switch to a
                larger screen.
              </Text>
              <Paper radius="md" withBorder p="md" w="100%" bg="gray.0">
                <Text size="sm" ta="center" c="gray.7">
                  For the best experience, open this workspace again from your laptop or desktop computer.
                </Text>
              </Paper>
              <Stack gap="sm" w="100%">
                <Button
                  component="a"
                  href={`mailto:?subject=Access WhatThePack.today&body=Open your secure workspace on desktop: ${shareUrl}`}
                  variant="light"
                  fullWidth
                >
                  Email this link to myself
                </Button>
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => {
                    if (navigator.share) {
                      void navigator.share({
                        title: "WhatThePack.today",
                        text: "Access WhatThePack.today secure mission control on desktop.",
                        url: shareUrl,
                      });
                    }
                  }}
                >
                  Share this workspace
                </Button>
              </Stack>
              <Stack gap={4} align="center">
                <Text size="xs" c="gray.5">
                  © {new Date().getFullYear()} WhatThePack.today
                </Text>
                <Anchor href="https://whatthepack.today" size="xs" c="gray.6">
                  Return to homepage
                </Anchor>
              </Stack>
            </Stack>
          </Paper>
        </Container>
      </Box>
    );
  }

  return <>{children}</>;
}
