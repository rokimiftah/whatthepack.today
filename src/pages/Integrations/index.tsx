import { useState } from "react";

import { Badge, Button, Card, Group, Loader, Paper, PasswordInput, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import {
  IconCircleCheck,
  IconCreditCard,
  IconInfoCircle,
  IconKey,
  IconLock,
  IconPlug,
  IconShieldCheck,
  IconTruck,
} from "@tabler/icons-react";
import { useAction, useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";

export default function IntegrationsPage() {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);

  // Get current org
  const org = useQuery(api.organizations.getForCurrentUser, {});
  const orgId = org?.organization?._id;

  // Check if ShipEngine is connected
  const shipEngineStatus = useQuery(api.organizations.hasShipEngine, orgId ? { orgId } : "skip");

  const storeToken = useAction(api.mgmt.storeShipEngineToken);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !apiKey.trim()) return;

    setLoading(true);
    try {
      await storeToken({ orgId, apiKey: apiKey.trim() });
      alert("✅ ShipEngine connected successfully!");
      setApiKey(""); // Clear input
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const isConnected = shipEngineStatus === true;

  // Loading state
  if (org === undefined || shipEngineStatus === undefined) {
    return (
      <Stack gap="xl" align="center" justify="center" style={{ minHeight: "60vh" }}>
        <Loader size="xl" type="dots" color="violet" />
        <Text size="sm" c="dimmed">
          Loading integrations...
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      <Paper p="lg" radius="lg" bg="white" style={{ border: "1px solid var(--mantine-color-gray-2)" }}>
        <Group gap="md">
          <ThemeIcon size={48} radius="lg" variant="light" color="violet">
            <IconPlug size={28} />
          </ThemeIcon>
          <Stack gap={4}>
            <Title order={2} fw={700}>
              Integrations
            </Title>
            <Text size="sm" c="dimmed">
              Connect your business tools and services
            </Text>
          </Stack>
        </Group>
      </Paper>

      <Card withBorder shadow="sm" radius="lg" bg="white" p="xl">
        <Stack gap="lg">
          <Group justify="space-between" align="flex-start">
            <Group gap="md">
              <ThemeIcon size={64} radius="lg" variant="light" color={isConnected ? "green" : "blue"}>
                <IconTruck size={36} />
              </ThemeIcon>
              <Stack gap={4}>
                <Title order={3} fw={700}>
                  ShipEngine
                </Title>
                <Text size="sm" c="dimmed">
                  Courier integration for automatic shipping label purchase
                </Text>
              </Stack>
            </Group>
            {isConnected && (
              <Badge
                variant="light"
                color="green"
                size="xl"
                radius="lg"
                leftSection={
                  <ThemeIcon size="xs" color="green" variant="transparent">
                    <IconCircleCheck size={16} />
                  </ThemeIcon>
                }
              >
                Connected
              </Badge>
            )}
          </Group>

          {!isConnected ? (
            <form onSubmit={handleSave}>
              <Stack gap="lg">
                <PasswordInput
                  label="ShipEngine API Key"
                  placeholder="TEST_xxxxx or prod_xxxxx"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  required
                  radius="lg"
                  size="md"
                  leftSection={<IconKey size={16} />}
                  description={
                    <Text size="xs" c="dimmed" mt={4}>
                      Get your API key from{" "}
                      <Text
                        component="a"
                        href="https://shipengine.com"
                        target="_blank"
                        rel="noreferrer"
                        size="xs"
                        c="blue"
                        td="underline"
                      >
                        ShipEngine Dashboard
                      </Text>
                    </Text>
                  }
                  styles={{
                    input: { fontWeight: 500 },
                    description: { marginBottom: 12 },
                  }}
                />
                <Group>
                  <Button
                    type="submit"
                    loading={loading}
                    leftSection={<IconPlug size={16} />}
                    radius="lg"
                    size="md"
                    disabled={loading}
                  >
                    {loading ? "Connecting..." : "Connect ShipEngine"}
                  </Button>
                </Group>
              </Stack>
            </form>
          ) : (
            <Paper p="lg" radius="lg" bg="green.0" style={{ border: "1px solid var(--mantine-color-green-2)" }}>
              <Group gap="md">
                <ThemeIcon size="lg" radius="lg" color="green" variant="light">
                  <IconCircleCheck size={20} />
                </ThemeIcon>
                <Stack gap={4}>
                  <Text fw={600} c="green.8">
                    Integration Active
                  </Text>
                  <Text size="sm" c="green.7">
                    Shipping labels will be purchased automatically when orders are processed.
                  </Text>
                </Stack>
              </Group>
            </Paper>
          )}
        </Stack>
      </Card>

      <Card withBorder shadow="sm" radius="lg" bg="white" p="xl" style={{ opacity: 0.6 }}>
        <Group gap="md">
          <ThemeIcon size={64} radius="lg" variant="light" color="gray">
            <IconCreditCard size={36} />
          </ThemeIcon>
          <Stack gap={4}>
            <Title order={3} fw={700} c="dimmed">
              Payment Gateway
            </Title>
            <Badge variant="light" color="gray" size="lg" radius="lg">
              Coming Soon
            </Badge>
          </Stack>
        </Group>
      </Card>

      <Card withBorder shadow="sm" radius="lg" bg="blue.0" p="lg" style={{ border: "1px solid var(--mantine-color-blue-2)" }}>
        <Group gap="md" align="flex-start">
          <ThemeIcon size="lg" radius="lg" color="blue" variant="light">
            <IconShieldCheck size={20} />
          </ThemeIcon>
          <Stack gap="sm" style={{ flex: 1 }}>
            <Group gap="xs">
              <IconInfoCircle size={18} color="var(--mantine-color-blue-6)" />
              <Title order={4} c="blue.8" fw={700}>
                Security & Privacy
              </Title>
            </Group>
            <Text size="sm" c="blue.8">
              WhatThePack securely stores your API keys using Auth0 Organization Metadata. Your keys are encrypted at rest and
              only accessed by our AI agents when needed to process orders.
            </Text>
            <Group gap="xs">
              <ThemeIcon size="sm" radius="lg" color="blue" variant="light">
                <IconLock size={12} />
              </ThemeIcon>
              <Text size="sm" c="blue.7" fw={500}>
                Your staff will never see your API keys. They can trigger actions without accessing your credentials.
              </Text>
            </Group>
          </Stack>
        </Group>
      </Card>
    </Stack>
  );
}
