import { useState } from "react";

import { Badge, Loader, Paper, Stack, Text, Title } from "@mantine/core";
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
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader size="xl" type="dots" />
      </div>
    );
  }

  return (
    <Stack gap="lg">
      <Stack gap={2}>
        <Text size="xs" tt="uppercase" fw={600} c="gray.6" lts={4}>
          Integrations
        </Text>
        <Title order={2}>{org?.organization?.name}</Title>
      </Stack>

      <Paper withBorder radius="xl" bg="white" p="lg">
        <Stack gap="md">
          <Stack gap={2}>
            <Title order={3}>ShipEngine</Title>
            <Text size="sm" c="gray.6">
              Courier integration for automatic shipping label purchase
            </Text>
          </Stack>
          {isConnected && (
            <Badge variant="light" color="green" w="fit-content">
              Connected
            </Badge>
          )}

          {!isConnected ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label htmlFor="shipengine-key" className="mb-2 block text-sm font-medium">
                  API Key
                </label>
                <input
                  id="shipengine-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="TEST_xxxxx or prod_xxxxx"
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 placeholder:text-neutral-500 focus:border-gray-400 focus:outline-none"
                  required
                />
                <p className="mt-1 text-xs text-neutral-500">
                  Get your API key from{" "}
                  <a href="https://shipengine.com" target="_blank" rel="noreferrer" className="underline">
                    ShipEngine Dashboard
                  </a>
                </p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg border border-gray-400 px-6 py-2 disabled:opacity-50"
              >
                {loading ? "Connecting..." : "Connect ShipEngine"}
              </button>
            </form>
          ) : (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-700">
              ✓ Your courier integration is active. Shipping labels will be purchased automatically when orders are processed.
            </div>
          )}
        </Stack>
      </Paper>

      <Paper withBorder radius="xl" bg="white" p="lg" className="opacity-80">
        <Title order={3}>Payment Gateway</Title>
        <Text size="sm" c="gray.6">
          Coming soon
        </Text>
      </Paper>

      <Paper withBorder radius="xl" bg="white" p="lg">
        <Stack gap="xs">
          <Title order={4}>About Integrations</Title>
          <Text c="gray.6">
            WhatThePack securely stores your API keys using Auth0 Organization Metadata. Your keys are encrypted at rest and only
            accessed by our AI agents when needed to process orders.
          </Text>
          <Text size="xs" c="gray.6">
            Your staff (admin and packer) will never see your API keys. They can trigger actions (like purchasing shipping labels)
            without having access to your credentials.
          </Text>
        </Stack>
      </Paper>
    </Stack>
  );
}
