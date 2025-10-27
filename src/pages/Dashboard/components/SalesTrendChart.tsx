import type { Id } from "../../../../convex/_generated/dataModel";

import { useEffect, useState } from "react";

import { Box, Card, Group, Stack, Text, Title } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { useQuery } from "convex/react";
import { CartesianGrid, Legend, Line, LineChart as ReLineChart, Tooltip, XAxis, YAxis } from "recharts";

import { api } from "../../../../convex/_generated/api";

interface SalesTrendChartProps {
  orgId: Id<"organizations">;
}

export default function SalesTrendChart({ orgId }: SalesTrendChartProps) {
  const { ref, width } = useElementSize();
  const trends = useQuery(api.analytics.getSalesTrends, {
    orgId,
    period: "daily",
  });
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (trends === undefined) {
    return (
      <Card withBorder shadow="sm" radius="lg" bg="white" h={300}>
        <Stack align="center" justify="center" h="100%">
          <Text size="sm" c="gray.6">
            Loading sales trends...
          </Text>
        </Stack>
      </Card>
    );
  }

  const chartData = trends.data.map((item: any) => ({
    date: new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    orders: item.orders,
    revenue: item.revenue,
  }));

  return (
    <Card withBorder shadow="sm" radius="lg" bg="white" style={{ minWidth: 0 }}>
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={4}>Sales Trends</Title>
          <Text size="xs" c="gray.6">
            Last 30 days
          </Text>
        </Group>
        <Box ref={ref} w="100%" style={{ minWidth: 0 }}>
          {mounted && width > 0 ? (
            <ReLineChart key={width} width={Math.max(width, 300)} height={250} data={chartData} margin={{ right: 16 }}>
              <CartesianGrid strokeDasharray="5 5" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="orders"
                stroke="var(--mantine-color-brand-6)"
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="var(--mantine-color-green-6)"
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                strokeWidth={2}
              />
            </ReLineChart>
          ) : (
            <Box h={250} />
          )}
        </Box>
      </Stack>
    </Card>
  );
}
