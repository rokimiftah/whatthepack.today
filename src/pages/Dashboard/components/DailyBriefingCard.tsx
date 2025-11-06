import type { Id } from "../../../../convex/_generated/dataModel";

import { useCallback, useEffect, useState } from "react";

import { ActionIcon, Badge, Card, Group, Skeleton, Stack, Text, Title } from "@mantine/core";
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
        <Stack gap="sm" p="md">
          <Skeleton height={14} width="30%" />
          <Skeleton height={10} width="95%" />
          <Skeleton height={10} width="92%" />
          <Skeleton height={10} width="88%" />
          <Skeleton height={10} width="84%" />
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
