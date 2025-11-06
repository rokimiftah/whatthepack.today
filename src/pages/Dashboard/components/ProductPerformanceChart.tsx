import type { Id } from "../../../../convex/_generated/dataModel";

import { Badge, Card, Group, Paper, Progress, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconTrophy } from "@tabler/icons-react";
import { useQuery } from "convex/react";

import { api } from "../../../../convex/_generated/api";

interface ProductPerformanceChartProps {
  orgId: Id<"organizations">;
}

export default function ProductPerformanceChart({ orgId }: ProductPerformanceChartProps) {
  const products = useQuery(api.analytics.getProductAnalytics, {
    orgId,
    limit: 6,
  });

  if (products === undefined) {
    return (
      <Card
        p="xl"
        radius="lg"
        style={{
          background: "white",
          border: "1px solid #e9ecef",
          height: 400,
        }}
      >
        <Stack align="center" justify="center" h="100%">
          <Text size="sm" c="gray.6">
            Loading product performance...
          </Text>
        </Stack>
      </Card>
    );
  }

  const topProducts = products.products.slice(0, 6);
  const maxRevenue = Math.max(...topProducts.map((p: any) => p.revenue));

  const getMedalColor = (rank: number) => {
    if (rank === 1) return "yellow.6";
    if (rank === 2) return "gray.5";
    if (rank === 3) return "orange.7";
    return "gray.6";
  };

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return "yellow";
    if (rank === 2) return "gray";
    if (rank === 3) return "orange";
    return "blue";
  };

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
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" variant="light" color="teal">
              <IconTrophy size={20} />
            </ThemeIcon>
            <div>
              <Title order={4} fw={700}>
                Top Products
              </Title>
              <Text size="xs" c="dimmed">
                Best sellers ranking
              </Text>
            </div>
          </Group>
          <Badge size="md" variant="light" color="teal" radius="md">
            Top {topProducts.length}
          </Badge>
        </Group>

        {/* Leaderboard */}
        <Stack gap="sm">
          {topProducts.map((product: any, index: number) => {
            const rank = index + 1;
            const revenuePercent = (product.revenue / maxRevenue) * 100;

            return (
              <Paper
                key={product._id}
                p="md"
                radius="lg"
                style={{
                  border: rank <= 3 ? `2px solid var(--mantine-color-${getRankBadgeColor(rank)}-2)` : "1px solid #e9ecef",
                  background: rank === 1 ? "#fffbf0" : "white",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateX(4px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateX(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  {/* Rank & Info */}
                  <Group gap="md" align="flex-start" style={{ flex: 1 }}>
                    {/* Rank Badge */}
                    <div style={{ width: "36px", textAlign: "center" }}>
                      {rank <= 3 ? (
                        <ThemeIcon size="lg" radius="lg" color={getRankBadgeColor(rank)} variant="light">
                          <IconTrophy size={18} style={{ color: `var(--mantine-color-${getMedalColor(rank)})` }} />
                        </ThemeIcon>
                      ) : (
                        <Badge
                          size="lg"
                          variant="light"
                          color="gray"
                          radius="lg"
                          style={{ width: "36px", height: "36px", padding: 0 }}
                        >
                          <Text fw={700} size="sm">
                            {rank}
                          </Text>
                        </Badge>
                      )}
                    </div>

                    {/* Product Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        fw={600}
                        size="sm"
                        mb={4}
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {product.name}
                      </Text>

                      {/* Revenue Progress */}
                      <Stack gap={4}>
                        <Group justify="space-between">
                          <Text size="xs" c="dimmed">
                            Revenue
                          </Text>
                          <Text size="xs" fw={700} c="blue.7">
                            ${product.revenue.toLocaleString()}
                          </Text>
                        </Group>
                        <Progress
                          value={revenuePercent}
                          size="md"
                          radius="lg"
                          styles={{
                            root: { backgroundColor: "#f1f3f5" },
                            section: {
                              background:
                                rank === 1
                                  ? "linear-gradient(90deg, #ffd43b, #fab005)"
                                  : rank === 2
                                    ? "linear-gradient(90deg, #adb5bd, #868e96)"
                                    : rank === 3
                                      ? "linear-gradient(90deg, #ff922b, #fd7e14)"
                                      : "linear-gradient(90deg, #4dabf7, #339af0)",
                            },
                          }}
                        />
                      </Stack>
                    </div>
                  </Group>

                  {/* Stats */}
                  <Group gap="lg" wrap="nowrap">
                    <div style={{ textAlign: "right" }}>
                      <Text size="xs" c="dimmed" mb={2}>
                        Profit
                      </Text>
                      <Text size="sm" fw={700} c="green.7">
                        ${product.profit.toLocaleString()}
                      </Text>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <Text size="xs" c="dimmed" mb={2}>
                        Sold
                      </Text>
                      <Badge size="lg" variant="light" color="blue" radius="md">
                        {product.totalSold}
                      </Badge>
                    </div>
                  </Group>
                </Group>
              </Paper>
            );
          })}
        </Stack>
      </Stack>
    </Card>
  );
}
