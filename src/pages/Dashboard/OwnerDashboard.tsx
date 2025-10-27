import { useEffect, useMemo, useState } from "react";

import {
  Badge,
  Box,
  Breadcrumbs,
  Card,
  Grid,
  Group,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
  UnstyledButton,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconArrowUpRight,
  IconChartBar,
  IconChevronRight,
  IconCurrencyDollar,
  IconPackage,
  IconPlug,
  IconShoppingCart,
  IconTrendingUp,
  IconUpload,
  IconUsers,
} from "@tabler/icons-react";
import { useQuery } from "convex/react";

import AnalyticsPage from "@pages/Analytics";
import IntegrationsPage from "@pages/Integrations";
import InventoryPage from "@pages/Inventory";
import OrdersPage from "@pages/Orders";
// Embedded pages
import ProductsPage from "@pages/Products";
import StaffManagementPage from "@pages/Staff";
// import { Link } from "wouter";

import FullscreenLoader from "@shared/components/FullscreenLoader";

import { api } from "../../../convex/_generated/api";
import DailyBriefingCard from "./components/DailyBriefingCard";
import ProductPerformanceChart from "./components/ProductPerformanceChart";
import SalesTrendChart from "./components/SalesTrendChart";

type OwnerView = "overview" | "products" | "orders" | "staff" | "integrations" | "analytics" | "inventory";

const quickActions: Array<{ label: string; description: string; view: OwnerView; icon: any }> = [
  { label: "Overview", description: "Summary & insights", view: "overview", icon: IconChartBar },
  { label: "Products", description: "Manage catalog & stock", view: "products", icon: IconPackage },
  { label: "Orders", description: "View and update orders", view: "orders", icon: IconShoppingCart },
  { label: "Staff", description: "Invite teammates & manage roles", view: "staff", icon: IconUsers },
  { label: "Integrations", description: "Connect ShipEngine securely", view: "integrations", icon: IconPlug },
  { label: "Analytics", description: "Ask AI for business insights", view: "analytics", icon: IconChartBar },
  { label: "Inventory Import", description: "Bulk add products via CSV", view: "inventory", icon: IconUpload },
];

export default function OwnerDashboard() {
  const orgResult = useQuery(api.organizations.getForCurrentUser, {});
  const orgId = orgResult?.organization?._id;

  const [_refreshKey, setRefreshKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toLocaleTimeString());
  const [view, setView] = useState<OwnerView>("overview");

  const kpis = useQuery(api.analytics.getDashboardKPIs, orgId ? { orgId } : "skip");
  const lowStock = useQuery(api.inventory.getLowStock, orgId ? { orgId, threshold: 5 } : "skip");

  // Auto-refresh every 30 seconds for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey((prev) => prev + 1);
      setLastUpdated(new Date().toLocaleTimeString());
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, []);

  const summary = kpis?.summary;
  const cards = useMemo(
    () => [
      {
        label: "Orders",
        value: summary?.totalOrders ?? 0,
        subtitle: `${summary?.shippedOrders ?? 0} shipped`,
        trend: summary?.completionRate ? `${summary.completionRate.toFixed(1)}% completion` : undefined,
        icon: IconShoppingCart,
        gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        color: "violet",
      },
      {
        label: "Revenue",
        value: `$${(summary?.totalRevenue ?? 0).toFixed(2)}`,
        subtitle: `Avg: $${(summary?.averageOrderValue ?? 0).toFixed(2)}`,
        trend: "+12% vs last period",
        icon: IconCurrencyDollar,
        gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        color: "pink",
      },
      {
        label: "Profit",
        value: `$${(summary?.totalProfit ?? 0).toFixed(2)}`,
        subtitle: `Margin: ${(summary?.profitMargin ?? 0).toFixed(1)}%`,
        trend: summary?.profitMargin && summary.profitMargin > 20 ? "Healthy margin" : "Needs attention",
        icon: IconTrendingUp,
        gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        color: "cyan",
      },
      {
        label: "Growth",
        value: summary?.completionRate ? `${summary.completionRate.toFixed(1)}%` : "0%",
        subtitle: "Order fulfillment",
        progress: summary?.completionRate ? summary.completionRate / 100 : 0,
        trend: summary?.completionRate && summary.completionRate > 90 ? "Excellent" : "Improving",
        icon: IconArrowUpRight,
        gradient: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
        color: "teal",
      },
    ],
    [summary],
  );

  if (orgResult === undefined || (view === "overview" && (kpis === undefined || lowStock === undefined))) {
    return <FullscreenLoader />;
  }

  if (!orgId) {
    return (
      <Paper withBorder p="md" radius="lg" bg="white">
        <Text size="sm" c="gray.6">
          Organization not found.
        </Text>
      </Paper>
    );
  }

  const getPageConfig = (view: OwnerView) => {
    switch (view) {
      case "products":
        return {
          title: "Products",
          subtitle: "Manage catalog & stock",
          gradient: "linear-gradient(180deg, #667eea 0%, #764ba2 100%)",
          component: <ProductsPage />,
        };
      case "orders":
        return {
          title: "Orders",
          subtitle: "View and update orders",
          gradient: "linear-gradient(180deg, #f093fb 0%, #f5576c 100%)",
          component: <OrdersPage />,
        };
      case "staff":
        return {
          title: "Staff Management",
          subtitle: "Invite teammates & manage roles",
          gradient: "linear-gradient(180deg, #4facfe 0%, #00f2fe 100%)",
          component: <StaffManagementPage />,
        };
      case "integrations":
        return {
          title: "Integrations",
          subtitle: "Connect ShipEngine securely",
          gradient: "linear-gradient(180deg, #43e97b 0%, #38f9d7 100%)",
          component: <IntegrationsPage />,
        };
      case "analytics":
        return {
          title: "Analytics",
          subtitle: "Ask AI for business insights",
          gradient: "linear-gradient(180deg, #fa709a 0%, #fee140 100%)",
          component: <AnalyticsPage />,
        };
      case "inventory":
        return {
          title: "Inventory Import",
          subtitle: "Bulk add products via CSV",
          gradient: "linear-gradient(180deg, #30cfd0 0%, #330867 100%)",
          component: <InventoryPage />,
        };
      default:
        return null;
    }
  };

  return (
    <Stack gap="xl" style={{ width: "100%" }}>
      {/* Header */}
      <Box
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          borderRadius: "var(--mantine-radius-xl)",
          padding: "var(--mantine-spacing-xl)",
          boxShadow: "var(--mantine-shadow-md)",
        }}
      >
        <Stack gap={16}>
          <Group justify="space-between" align="flex-start">
            <Breadcrumbs
              separator="/"
              styles={{
                separator: {
                  color: "white !important",
                },
                breadcrumb: {
                  color: "white !important",
                },
              }}
            >
              <Text
                size="sm"
                fw={500}
                c="white"
                style={{
                  color: "white !important",
                }}
              >
                Dashboard
              </Text>
              <Text
                size="sm"
                fw={600}
                c="white"
                style={{
                  color: "white !important",
                }}
              >
                {view === "overview" ? "Overview" : view.charAt(0).toUpperCase() + view.slice(1).replace("_", " ")}
              </Text>
            </Breadcrumbs>
            <Group gap="md">
              <Box
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.25)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255, 255, 255, 0.4)",
                  borderRadius: "var(--mantine-radius-lg)",
                  padding: "var(--mantine-spacing-sm)",
                }}
              >
                <Group gap="xs">
                  <Box
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: "#4ade80",
                      boxShadow: "0 0 8px rgba(74, 222, 128, 0.8)",
                    }}
                  />
                  <Text
                    size="sm"
                    fw={600}
                    c="white"
                    style={{
                      color: "white !important",
                    }}
                  >
                    Live
                  </Text>
                </Group>
              </Box>
              <Text
                size="sm"
                c="white"
                style={{
                  color: "white !important",
                }}
              >
                Updated {lastUpdated}
              </Text>
            </Group>
          </Group>
          <Stack gap={6}>
            <Text
              size="lg"
              fw={700}
              c="white"
              tt="uppercase"
              style={{
                color: "white !important",
                opacity: 0.95,
                letterSpacing: 2,
                fontSize: "1.1rem",
              }}
            >
              {orgResult?.organization?.name || "Your Store"}
            </Text>
            <Title
              order={1}
              c="white"
              style={{
                fontSize: "2.5rem",
                fontWeight: 800,
                color: "white !important",
              }}
            >
              Owner Dashboard
            </Title>
            <Text
              size="md"
              c="white"
              style={{
                color: "white !important",
              }}
            >
              Real-time view of performance, inventory and insights
            </Text>
          </Stack>
        </Stack>
      </Box>

      <Grid gutter="xl">
        {/* Sidebar */}
        <Grid.Col span={{ base: 12, md: 3, lg: 3 }} style={{ minWidth: 0 }}>
          <Stack gap="lg">
            <Paper withBorder radius="xl" bg="white" p="lg" shadow="md" style={{ position: "sticky", top: 16 }}>
              <Stack gap="lg">
                <Group gap="xs">
                  <Box
                    style={{
                      width: 4,
                      height: 18,
                      background: "linear-gradient(180deg, #667eea 0%, #764ba2 100%)",
                      borderRadius: 4,
                    }}
                  />
                  <Text size="xs" tt="uppercase" fw={700} c="gray.7" lts={2}>
                    Quick navigation
                  </Text>
                </Group>
                <Stack gap={8}>
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    const active = view === action.view;
                    return (
                      <UnstyledButton
                        key={action.label}
                        style={{ width: "100%" }}
                        onClick={() => setView(action.view)}
                        onMouseEnter={(e) => {
                          const paper = e.currentTarget.querySelector("[data-menu-item]") as HTMLElement;
                          if (paper) {
                            paper.style.backgroundColor = "#f8f9fa";
                            paper.style.borderColor = "#dee2e6";
                          }
                        }}
                        onMouseLeave={(e) => {
                          const paper = e.currentTarget.querySelector("[data-menu-item]") as HTMLElement;
                          if (paper) {
                            paper.style.backgroundColor = active ? "var(--mantine-color-gray-0)" : "white";
                            paper.style.borderColor = active ? "var(--mantine-color-brand-3)" : "var(--mantine-color-gray-2)";
                          }
                        }}
                      >
                        <Paper
                          data-menu-item
                          p="md"
                          radius="lg"
                          style={{
                            border: `1px solid ${active ? "var(--mantine-color-brand-3)" : "var(--mantine-color-gray-2)"}`,
                            backgroundColor: active ? "var(--mantine-color-gray-0)" : "white",
                            height: "72px",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                        >
                          <Group justify="space-between" wrap="nowrap" align="center" style={{ height: "100%" }}>
                            <Group gap="md" wrap="nowrap" align="center" style={{ flex: 1, minWidth: 0 }}>
                              <ThemeIcon
                                size={36}
                                radius="md"
                                color="brand"
                                variant="light"
                                style={{
                                  flexShrink: 0,
                                  background:
                                    "linear-gradient(135deg, var(--mantine-color-brand-0) 0%, var(--mantine-color-brand-1) 100%)",
                                }}
                              >
                                <Icon size={18} />
                              </ThemeIcon>
                              <Box style={{ flex: 1, minWidth: 0 }}>
                                <Text fw={600} size="sm" c="gray.9" style={{ lineHeight: 1.3 }}>
                                  {action.label}
                                </Text>
                                <Text size="xs" c="gray.6" style={{ lineHeight: 1.3, marginTop: 2 }}>
                                  {action.description}
                                </Text>
                              </Box>
                            </Group>
                            <Box style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
                              <IconChevronRight size={16} style={{ opacity: 0.5 }} />
                            </Box>
                          </Group>
                        </Paper>
                      </UnstyledButton>
                    );
                  })}
                </Stack>
              </Stack>
            </Paper>
          </Stack>
        </Grid.Col>

        {/* Main content */}
        <Grid.Col span={{ base: 12, md: 9, lg: 9 }} style={{ minWidth: 0 }}>
          <Stack gap="xl">
            {view !== "overview" ? (
              // Render embedded pages for non-overview views with consistent styling
              (() => {
                const pageConfig = getPageConfig(view);
                if (!pageConfig) return null;
                return (
                  <>
                    {/* Page Header */}
                    <Stack gap={8}>
                      <Group gap="xs">
                        <Box
                          style={{
                            width: 4,
                            height: 20,
                            background: pageConfig.gradient,
                            borderRadius: 4,
                          }}
                        />
                        <Title order={3}>{pageConfig.title}</Title>
                      </Group>
                      <Text size="sm" c="gray.6" ml={16}>
                        {pageConfig.subtitle}
                      </Text>
                    </Stack>
                    {/* Page Content */}
                    {pageConfig.component}
                  </>
                );
              })()
            ) : (
              <>
                {/* KPI Cards */}
                <Stack gap={8}>
                  <Group gap="xs">
                    <Box
                      style={{
                        width: 4,
                        height: 20,
                        background: "linear-gradient(180deg, #667eea 0%, #764ba2 100%)",
                        borderRadius: 4,
                      }}
                    />
                    <Title order={3}>Performance Overview</Title>
                  </Group>
                  <Text size="sm" c="gray.6" ml={16}>
                    Real-time KPIs for your organization
                  </Text>
                </Stack>
                <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
                  {cards.map((card) => {
                    const CardIcon = card.icon;
                    return (
                      <Card
                        key={card.label}
                        withBorder
                        shadow="md"
                        radius="xl"
                        bg="white"
                        p="lg"
                        style={{
                          position: "relative",
                          overflow: "hidden",
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                        }}
                      >
                        {/* Background Decoration */}
                        <Box
                          style={{
                            position: "absolute",
                            top: 0,
                            right: 0,
                            width: "120px",
                            height: "120px",
                            background: card.gradient,
                            opacity: 0.1,
                            borderRadius: "50%",
                            transform: "translate(30%, -30%)",
                            pointerEvents: "none",
                          }}
                        />

                        {/* Content */}
                        <Box style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%" }}>
                          {/* Row 1: Icon (Fixed at top right) */}
                          <Group justify="flex-end" mb="sm">
                            <ThemeIcon
                              size={44}
                              radius="xl"
                              variant="gradient"
                              gradient={{ from: `${card.color}.5`, to: `${card.color}.7`, deg: 135 }}
                            >
                              <CardIcon size={24} />
                            </ThemeIcon>
                          </Group>

                          {/* Row 2: Label */}
                          <Text size="xs" tt="uppercase" fw={700} c="gray.6" lts={2} mb="md">
                            {card.label}
                          </Text>

                          {/* Row 3: Value */}
                          <Title order={2} mb={4} style={{ fontSize: "2.25rem", fontWeight: 800, lineHeight: 1 }}>
                            {card.value}
                          </Title>

                          {/* Row 4: Subtitle */}
                          <Text size="sm" c="gray.6" fw={500} mb="lg">
                            {card.subtitle}
                          </Text>

                          {/* Row 5: Progress Bar (if exists) */}
                          {card.progress !== undefined && (
                            <Box mb="xs">
                              <Progress
                                value={card.progress * 100}
                                size="md"
                                radius="xl"
                                color={card.progress > 0.9 ? "green" : card.progress > 0.7 ? "yellow" : "red"}
                                styles={{
                                  root: { backgroundColor: "var(--mantine-color-gray-1)" },
                                }}
                              />
                            </Box>
                          )}

                          {/* Row 6: Badge (Fixed at bottom) */}
                          <Box style={{ marginTop: "auto" }}>
                            {card.trend && (
                              <Badge
                                size="sm"
                                variant="light"
                                radius="md"
                                color={
                                  card.trend.includes("Excellent") || card.trend.includes("Healthy")
                                    ? "green"
                                    : card.trend.includes("Needs")
                                      ? "red"
                                      : "brand"
                                }
                                styles={{
                                  root: { fontWeight: 600 },
                                }}
                              >
                                {card.trend}
                              </Badge>
                            )}
                          </Box>
                        </Box>
                      </Card>
                    );
                  })}
                </SimpleGrid>

                {/* Daily Briefing */}
                <Stack gap={8}>
                  <Group gap="xs">
                    <Box
                      style={{
                        width: 4,
                        height: 20,
                        background: "linear-gradient(180deg, #4facfe 0%, #00f2fe 100%)",
                        borderRadius: 4,
                      }}
                    />
                    <Title order={3}>Daily Briefing</Title>
                  </Group>
                  <Text size="sm" c="gray.6" ml={16}>
                    AI-powered insights and recommendations for your business
                  </Text>
                </Stack>
                <DailyBriefingCard orgId={orgId} />

                {/* Analytics */}
                <Stack gap={8}>
                  <Group gap="xs">
                    <Box
                      style={{
                        width: 4,
                        height: 20,
                        background: "linear-gradient(180deg, #43e97b 0%, #38f9d7 100%)",
                        borderRadius: 4,
                      }}
                    />
                    <Title order={3}>Analytics & Trends</Title>
                  </Group>
                  <Text size="sm" c="gray.6" ml={16}>
                    Visual insights into your business performance
                  </Text>
                </Stack>
                <SimpleGrid cols={{ base: 1, md: 2 }} style={{ minWidth: 0 }}>
                  <SalesTrendChart orgId={orgId} />
                  <ProductPerformanceChart orgId={orgId} />
                </SimpleGrid>

                {/* Low stock */}
                <Stack gap="md">
                  <Group justify="space-between" align="flex-end">
                    <Stack gap={4}>
                      <Group gap="xs">
                        <Box
                          style={{
                            width: 4,
                            height: 20,
                            background: "linear-gradient(180deg, #ff6b6b 0%, #ee5a6f 100%)",
                            borderRadius: 4,
                          }}
                        />
                        <Title order={3}>Low Stock Alerts</Title>
                      </Group>
                      <Text size="sm" c="gray.6">
                        Items below threshold of 5 units
                      </Text>
                    </Stack>
                    {lowStock && lowStock.length > 0 && (
                      <Badge size="lg" variant="filled" color="red" radius="md">
                        {lowStock.length} {lowStock.length === 1 ? "alert" : "alerts"}
                      </Badge>
                    )}
                  </Group>
                  {lowStock && lowStock.length === 0 ? (
                    <Paper
                      withBorder
                      radius="xl"
                      p="xl"
                      bg="white"
                      shadow="md"
                      style={{
                        background: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
                        border: "none",
                      }}
                    >
                      <Group>
                        <ThemeIcon size={48} radius="xl" color="teal" variant="white">
                          <IconPackage size={24} />
                        </ThemeIcon>
                        <Stack gap={4}>
                          <Text size="lg" fw={700} c="gray.9">
                            All inventory healthy!
                          </Text>
                          <Text size="sm" c="gray.8">
                            No low stock items right now. Great job maintaining inventory levels.
                          </Text>
                        </Stack>
                      </Group>
                    </Paper>
                  ) : (
                    <Paper withBorder radius="xl" bg="white" shadow="md" style={{ overflow: "hidden" }}>
                      <Table
                        highlightOnHover
                        verticalSpacing="md"
                        horizontalSpacing="lg"
                        styles={{
                          thead: {
                            backgroundColor: "var(--mantine-color-gray-0)",
                          },
                        }}
                      >
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>
                              <Text fw={700} size="sm" c="gray.7">
                                Product
                              </Text>
                            </Table.Th>
                            <Table.Th>
                              <Text fw={700} size="sm" c="gray.7">
                                SKU
                              </Text>
                            </Table.Th>
                            <Table.Th>
                              <Text fw={700} size="sm" c="gray.7">
                                Stock
                              </Text>
                            </Table.Th>
                            <Table.Th>
                              <Text fw={700} size="sm" c="gray.7">
                                Bin Location
                              </Text>
                            </Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {lowStock?.map((product: any) => (
                            <Table.Tr key={product._id} style={{ transition: "background-color 0.2s ease" }}>
                              <Table.Td>
                                <Group gap="sm">
                                  <ThemeIcon size={36} radius="lg" color="red" variant="light">
                                    <IconAlertCircle size={18} />
                                  </ThemeIcon>
                                  <Stack gap={2}>
                                    <Text fw={600} size="sm">
                                      {product.name}
                                    </Text>
                                    <Text size="xs" c="gray.6">
                                      {product.category || "Uncategorized"}
                                    </Text>
                                  </Stack>
                                </Group>
                              </Table.Td>
                              <Table.Td>
                                <Badge variant="light" color="gray" size="md" radius="md">
                                  {product.sku}
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                <Badge
                                  variant="filled"
                                  color={product.stockQuantity === 0 ? "red" : "orange"}
                                  size="lg"
                                  radius="md"
                                >
                                  {product.stockQuantity} units
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm" c="gray.7" fw={500}>
                                  {product.warehouseLocation || "—"}
                                </Text>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Paper>
                  )}
                </Stack>
              </>
            )}
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
