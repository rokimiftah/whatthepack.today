import type { Id } from "../../../../convex/_generated/dataModel";

import { useEffect, useState } from "react";

import { Box, Card, Group, Stack, Text, Title } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { useQuery } from "convex/react";
import { Bar, CartesianGrid, Legend, BarChart as ReBarChart, Tooltip, XAxis, YAxis } from "recharts";

import { api } from "../../../../convex/_generated/api";

interface ProductPerformanceChartProps {
  orgId: Id<"organizations">;
}

export default function ProductPerformanceChart({ orgId }: ProductPerformanceChartProps) {
  const { ref, width } = useElementSize();
  const products = useQuery(api.analytics.getProductAnalytics, {
    orgId,
    limit: 5,
  });
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (products === undefined) {
    return (
      <Card withBorder shadow="sm" radius="lg" bg="white" h={300}>
        <Stack align="center" justify="center" h="100%">
          <Text size="sm" c="gray.6">
            Loading product performance...
          </Text>
        </Stack>
      </Card>
    );
  }

  const chartData = products.products.slice(0, 5).map((product: any) => ({
    name: product.name.length > 15 ? `${product.name.substring(0, 15)}...` : product.name,
    revenue: product.revenue,
    profit: product.profit,
    quantity: product.totalSold,
  }));

  return (
    <Card withBorder shadow="sm" radius="lg" bg="white" style={{ minWidth: 0 }}>
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={4}>Top Products</Title>
          <Text size="xs" c="gray.6">
            By revenue
          </Text>
        </Group>
        <Box ref={ref} w="100%" style={{ minWidth: 0 }}>
          {mounted && width > 0 ? (
            <ReBarChart
              key={width}
              width={Math.max(width, 300)}
              height={250}
              data={chartData}
              layout="vertical"
              margin={{ right: 16 }}
            >
              <CartesianGrid strokeDasharray="5 5" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={100} />
              <Tooltip />
              <Legend />
              <Bar dataKey="revenue" fill="var(--mantine-color-brand-6)" />
              <Bar dataKey="profit" fill="var(--mantine-color-green-6)" />
            </ReBarChart>
          ) : (
            <Box h={250} />
          )}
        </Box>
      </Stack>
    </Card>
  );
}
