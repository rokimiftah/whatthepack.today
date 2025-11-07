import type { Id } from "../../../../convex/_generated/dataModel";

import React from "react";

import { BarChart } from "@mantine/charts";
import { Badge, Button, Card, Group, Skeleton, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconTrendingUp } from "@tabler/icons-react";
import { useQuery } from "convex/react";

import { api } from "../../../../convex/_generated/api";

interface SalesTrendChartProps {
  orgId: Id<"organizations">;
}

export default function SalesTrendChart({ orgId }: SalesTrendChartProps) {
  const [timedOut, setTimedOut] = React.useState(false);
  const timerRef = React.useRef<number | null>(null);
  const [range, setRange] = React.useState(() => {
    const end = Date.now();
    return { startDate: end - 30 * 24 * 60 * 60 * 1000, endDate: end };
  });

  const startTimer = React.useCallback(() => {
    setTimedOut(false);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setTimedOut(true), 5000);
  }, []);

  React.useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [startTimer]);

  const trends = useQuery(api.analytics.getSalesTrends, {
    orgId,
    period: "daily",
    startDate: range.startDate,
    endDate: range.endDate,
  });

  if (trends === undefined && !timedOut) {
    return (
      <Card radius="lg" style={{ background: "white", border: "1px solid #e9ecef", height: 350 }}>
        <Stack gap="sm" p="md">
          <Skeleton height={14} width="35%" />
          <Skeleton height={14} width="20%" />
          <Skeleton height={280} />
        </Stack>
      </Card>
    );
  }

  const fallback = trends === undefined && timedOut;
  const chartData = fallback
    ? Array.from({ length: 14 }).map((_, i) => {
        const d = new Date(range.endDate - (13 - i) * 24 * 60 * 60 * 1000);
        return { date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), aov: 0, margin: 0 };
      })
    : trends!.data.map((item: any) => {
        const orders = item.orders || 0;
        const revenue = item.revenue || 0;
        const profit = item.profit || 0;
        const aov = orders > 0 ? revenue / orders : 0;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
        return {
          date: new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          aov,
          margin,
        };
      });

  const firstLabel = chartData[0]?.date;
  const midLabel = chartData[Math.floor(chartData.length / 2)]?.date;
  const lastLabel = chartData[chartData.length - 1]?.date;

  return (
    <Card
      p="xl"
      radius="lg"
      style={{
        background: "white",
        border: "1px solid #e9ecef",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
        minWidth: 0,
      }}
    >
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" variant="light" color="blue">
              <IconTrendingUp size={20} />
            </ThemeIcon>
            <div>
              <Title order={4} fw={700}>
                Sales Trends
              </Title>
              <Text size="xs" c="dimmed">
                Performance overview
              </Text>
            </div>
          </Group>
          <Badge size="md" variant="light" color="blue" radius="md">
            Last 30 days
          </Badge>
        </Group>
        <div style={{ width: "100%", minWidth: 0, position: "relative" }}>
          {fallback && (
            <Group justify="space-between" align="center" style={{ position: "absolute", inset: 8, zIndex: 1 }}>
              <Text size="xs" c="gray.6">
                Offline — showing placeholder
              </Text>
              <Button
                size="xs"
                variant="light"
                onClick={() => {
                  const end = Date.now();
                  setRange({ startDate: end - 30 * 24 * 60 * 60 * 1000, endDate: end });
                  startTimer();
                }}
              >
                Retry
              </Button>
            </Group>
          )}
          <Stack gap={12}>
            <div>
              <Text size="xs" c="dimmed" mb={6}>
                Avg order value (AOV)
              </Text>
              <BarChart h={140} data={chartData} dataKey="date" series={[{ name: "aov", color: "blue.6" }]} />
            </div>
            <div>
              <Text size="xs" c="dimmed" mb={6}>
                Profit margin (%)
              </Text>
              <BarChart h={140} data={chartData} dataKey="date" series={[{ name: "margin", color: "teal.6" }]} />
            </div>
          </Stack>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <Text size="xs" c="dimmed">
              {firstLabel}
            </Text>
            <Text size="xs" c="dimmed">
              {midLabel}
            </Text>
            <Text size="xs" c="dimmed">
              {lastLabel}
            </Text>
          </div>
        </div>
      </Stack>
    </Card>
  );
}
