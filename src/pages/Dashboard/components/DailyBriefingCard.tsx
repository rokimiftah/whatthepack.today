import type { Id } from "../../../../convex/_generated/dataModel";

import { useCallback, useEffect, useState } from "react";

import { ActionIcon, Badge, Card, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { IconRefresh, IconSparkles } from "@tabler/icons-react";
import { useAction } from "convex/react";

import { api } from "../../../../convex/_generated/api";

interface DailyBriefingCardProps {
  orgId: Id<"organizations">;
}

export default function DailyBriefingCard({ orgId }: DailyBriefingCardProps) {
  const [briefingResult, setBriefingResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const generateDailyBriefing = useAction((api as any)["agents/briefingAgent"].generateDailyBriefing);

  const loadBriefing = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const result = await generateDailyBriefing({ orgId });
      setBriefingResult(result);
    } catch (error) {
      console.error("Failed to load briefing:", error);
    } finally {
      setLoading(false);
    }
  }, [orgId, generateDailyBriefing]);

  useEffect(() => {
    loadBriefing();
  }, [loadBriefing]);

  const handleRefresh = useCallback(() => {
    loadBriefing();
  }, [loadBriefing]);

  if (loading || briefingResult === null) {
    return (
      <Card withBorder shadow="sm" radius="lg" bg="white">
        <Stack align="center" py="lg">
          <IconSparkles size={24} color="#5f84f0" />
          <Loader size="sm" />
          <Text size="sm" c="gray.6">
            {loading ? "Generating your daily briefing..." : "Loading..."}
          </Text>
        </Stack>
      </Card>
    );
  }

  return (
    <Card withBorder shadow="sm" radius="lg" bg="white">
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="sm">
            <IconSparkles size={20} color="#5f84f0" />
            <Title order={4}>Daily Briefing</Title>
            <Badge variant="light" color="brand">
              AI Generated
            </Badge>
          </Group>
          <ActionIcon variant="light" color="brand" onClick={handleRefresh} size="sm">
            <IconRefresh size={14} />
          </ActionIcon>
        </Group>

        <Stack gap="sm">
          <Text size="xs" c="gray.6" tt="uppercase" fw={600} lts={2}>
            Business Insights
          </Text>
          <Text size="sm" lh={1.6} c="gray.8" style={{ whiteSpace: "pre-line" }}>
            {briefingResult.briefing}
          </Text>
        </Stack>

        <Group justify="space-between">
          <Text size="xs" c="gray.5">
            Updated: {new Date(briefingResult.generatedAt).toLocaleString()}
          </Text>
          <Badge size="xs" variant="outline" color="green">
            Live data
          </Badge>
        </Group>
      </Stack>
    </Card>
  );
}
