// src/pages/Auth/MagicLinkPage/index.tsx

import { useEffect, useState } from "react";

import { useAuthActions } from "@convex-dev/auth/react";
import { Anchor, Box, Button, Container, Image, Paper, Stack, Text, Title } from "@mantine/core";
import { IconAlertCircle, IconCircleCheck } from "@tabler/icons-react";
import { useLocation } from "wouter";

export default function MagicLinkPage() {
  const { signIn } = useAuthActions();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const params = new URLSearchParams(search);
    const tokenParam = params.get("token");
    const emailParam = params.get("email");

    if (tokenParam && emailParam) {
      setToken(tokenParam);
      setEmail(decodeURIComponent(emailParam));
    } else {
      navigate("/");
    }
  }, [navigate]);

  const handleSignIn = async () => {
    if (!token || !email) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("code", token);
      formData.set("email", email);

      const result = await signIn("resend-magic-link", formData);

      if (result && typeof result === "object" && "tokens" in result) {
        const tokens = (result as { tokens?: { token?: string; refreshToken?: string } }).tokens ?? {};

        if (tokens.token) {
          localStorage.setItem("convex:auth:token", tokens.token);
        }

        if (tokens.refreshToken) {
          localStorage.setItem("convex:auth:refreshToken", tokens.refreshToken);
        }

        if (tokens.token || tokens.refreshToken) {
          localStorage.setItem(
            "convex:auth:session",
            JSON.stringify({
              token: tokens.token,
              refreshToken: tokens.refreshToken,
              timestamp: Date.now(),
            }),
          );
        }
      }

      setTimeout(() => {
        window.location.href = "/";
      }, 800);
    } catch (err) {
      console.error("Magic link sign-in failed", err);
      setError("Failed to sign in. The link may have expired.");
      setLoading(false);
    }
  };

  if (!email || !token) {
    return null;
  }

  return (
    <Box
      mih="100vh"
      bg="linear-gradient(180deg, rgba(246,248,251,1) 0%, rgba(226,233,244,1) 100%)"
      px="md"
      style={{ display: "flex", alignItems: "center" }}
    >
      <Container size={420}>
        <Stack align="center" gap="lg">
          <Image src="/logo.png" alt="WhatThePack.today" h={54} fit="contain" />

          <Paper withBorder radius="lg" shadow="lg" p="xl" w="100%" bg="white">
            <Stack gap="lg" align="center">
              <Stack gap={4} align="center">
                <Title order={3}>Confirm sign-in</Title>
                <Text size="sm" c="gray.6">
                  You are about to sign in with:
                </Text>
                <Text size="sm" fw={600} c="brand.7" ta="center" style={{ wordBreak: "break-word" }}>
                  {email}
                </Text>
              </Stack>

              {error ? (
                <Paper withBorder radius="lg" p="sm" w="100%" bg="red.0" c="red.7">
                  <Stack gap={4} align="center">
                    <IconAlertCircle size={18} />
                    <Text size="sm">{error}</Text>
                  </Stack>
                </Paper>
              ) : (
                <Paper withBorder radius="lg" p="sm" w="100%" bg="green.0" c="green.7">
                  <Stack gap={4} align="center">
                    <IconCircleCheck size={18} />
                    <Text size="sm">This link expires in 10 minutes for security.</Text>
                  </Stack>
                </Paper>
              )}

              <Stack gap="sm" w="100%">
                <Button onClick={handleSignIn} loading={loading} radius="lg" size="md">
                  Continue
                </Button>
                <Button variant="subtle" color="gray" radius="lg" size="md" onClick={() => navigate("/")} disabled={loading}>
                  Back to home
                </Button>
              </Stack>
            </Stack>
          </Paper>

          <Text size="xs" c="gray.5" ta="center">
            Trouble with the link? Contact{" "}
            <Anchor href="mailto:support@whatthepack.today" size="xs">
              support@whatthepack.today
            </Anchor>
          </Text>
        </Stack>
      </Container>
    </Box>
  );
}
