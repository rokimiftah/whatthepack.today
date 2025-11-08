import { useEffect, useMemo, useState } from "react";

import {
  ActionIcon,
  Badge,
  Card,
  Group,
  Menu,
  Paper,
  Progress,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Tabs,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconArrowUpRight,
  IconBell,
  IconChartBar,
  IconChevronDown,
  IconCurrencyDollar,
  IconLogout,
  IconPackage,
  IconPlug,
  IconShoppingCart,
  IconTrendingUp,
  IconUpload,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery } from "convex/react";

import AnalyticsPage from "@pages/Analytics";
import IntegrationsPage from "@pages/Integrations";
import InventoryPage from "@pages/Inventory";
import OrdersPage from "@pages/Orders";
import ProductsPage from "@pages/Products";
import StaffManagementPage from "@pages/Staff";

// no fullscreen overlay loader here; route-level handles global loading

import { api } from "../../../convex/_generated/api";
import DailyBriefingCard from "./components/DailyBriefingCard";
import ProductPerformanceChart from "./components/ProductPerformanceChart";
import SalesTrendChart from "./components/SalesTrendChart";

type OwnerView = "overview" | "products" | "orders" | "staff" | "integrations" | "analytics" | "inventory";

const quickActions: Array<{ label: string; value: OwnerView; icon: any }> = [
  { label: "Overview", value: "overview", icon: IconChartBar },
  { label: "Products", value: "products", icon: IconPackage },
  { label: "Orders", value: "orders", icon: IconShoppingCart },
  { label: "Staff", value: "staff", icon: IconUsers },
  { label: "Integrations", value: "integrations", icon: IconPlug },
  { label: "Analytics", value: "analytics", icon: IconTrendingUp },
  { label: "Inventory", value: "inventory", icon: IconUpload },
];

export default function OwnerDashboard() {
  const orgResult = useQuery(api.organizations.getForCurrentUser, {});
  const orgId = orgResult?.organization?._id;

  const [_refreshKey, setRefreshKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toLocaleTimeString());
  const [view, setView] = useState<OwnerView>("overview");
  // Persistent notification "seen" state (per user/org)
  const notifState = useQuery(api.notifications.getState, orgId ? { orgId } : "skip");
  const markSeen = useMutation(api.notifications.markSeen);
  const showNotificationBadge = notifState ? !notifState.hasSeen : false;

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

  // Handle notification badge click
  const handleNotificationClick = async () => {
    if (!orgId) return;
    // Optimistic hide; backend persists seen state
    try {
      await markSeen({ orgId });
    } catch (_e) {
      // no-op; UI will reflect server state on next render
    }
  };

  const summary = kpis?.summary;
  const cards = useMemo(
    () => [
      {
        label: "Total Orders",
        value: summary?.totalOrders ?? 0,
        subtitle: `${summary?.shippedOrders ?? 0} shipped`,
        change: summary?.completionRate ? `${summary.completionRate.toFixed(0)}%` : "0%",
        changeLabel: "completion rate",
        icon: IconShoppingCart,
        color: "indigo",
      },
      {
        label: "Total Revenue",
        value: `$${(summary?.totalRevenue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        subtitle: `Avg: $${(summary?.averageOrderValue ?? 0).toFixed(2)}`,
        change: "Last 30 days",
        changeLabel: "data period",
        icon: IconCurrencyDollar,
        color: "violet",
      },
      {
        label: "Net Profit",
        value: `$${(summary?.totalProfit ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        subtitle: `Margin: ${(summary?.profitMargin ?? 0).toFixed(1)}%`,
        change: summary?.profitMargin && summary.profitMargin > 20 ? "Healthy" : "Low",
        changeLabel: "profit margin",
        icon: IconTrendingUp,
        color: summary?.profitMargin && summary.profitMargin > 20 ? "teal" : "yellow",
      },
      {
        label: "Fulfillment Rate",
        value: summary?.completionRate ? `${summary.completionRate.toFixed(1)}%` : "0%",
        subtitle: "Order fulfillment",
        progress: summary?.completionRate ? summary.completionRate : 0,
        change: summary?.completionRate && summary.completionRate > 90 ? "Excellent" : "Good",
        changeLabel: "performance",
        icon: IconArrowUpRight,
        color: summary?.completionRate && summary.completionRate > 90 ? "green" : "pink",
      },
    ],
    [summary],
  );

  const loadingOverview = view === "overview" && (kpis === undefined || lowStock === undefined);

  if (orgResult !== undefined && !orgId) {
    return (
      <Paper p="md" radius="lg" bg="gray.0">
        <Text size="sm" c="gray.6">
          Organization not found.
        </Text>
      </Paper>
    );
  }

  return (
    <Stack gap="lg" style={{ width: "100%", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Professional Header */}
      <Paper
        py="sm"
        px="xl"
        radius="lg"
        bg="white"
        style={{
          border: "1px solid var(--mantine-color-gray-2)",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
        }}
      >
        <Group justify="space-between" align="center" wrap="nowrap">
          {/* Left Section - Logo & Title */}
          <Group gap="lg" wrap="nowrap">
            <div>
              <Text
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 800,
                  color: "#1e293b",
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                }}
              >
                {orgResult?.organization?.name || "Your Store"}
              </Text>
            </div>
          </Group>

          {/* Right Section - Actions */}
          <Group gap="md" wrap="nowrap">
            {/* Time Display */}
            <Paper
              px="md"
              py={6}
              radius="lg"
              style={{
                backgroundColor: "var(--mantine-color-gray-0)",
                border: "1px solid var(--mantine-color-gray-2)",
              }}
            >
              <Group gap={6}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: "var(--mantine-color-green-6)",
                  }}
                />
                <Text size="xs" fw={500} c="dark">
                  {lastUpdated}
                </Text>
              </Group>
            </Paper>

            {/* Notifications with Badge */}
            <Menu shadow="md" width={240} position="bottom" offset={18}>
              <Menu.Target>
                <div style={{ position: "relative" }}>
                  <ActionIcon variant="light" color="gray" size="lg" radius="lg" onClick={handleNotificationClick}>
                    <IconBell size={20} />
                  </ActionIcon>
                  {/* Notification Badge */}
                  {showNotificationBadge && (
                    <div
                      style={{
                        position: "absolute",
                        top: -8,
                        right: -8,
                        minWidth: 20,
                        height: 20,
                        borderRadius: "50%",
                        backgroundColor: "var(--mantine-color-red-6)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "none",
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "white",
                        border: "2px solid white",
                        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
                        boxSizing: "content-box",
                        lineHeight: 1,
                      }}
                    >
                      3
                    </div>
                  )}
                </div>
              </Menu.Target>

              <Menu.Dropdown style={{ marginTop: 0 }}>
                <Menu.Label>Notifications</Menu.Label>
                <Menu.Item>
                  <Stack gap={4}>
                    <Text size="sm" fw={500}>
                      New order received
                    </Text>
                    <Text size="xs" c="dimmed">
                      2 minutes ago
                    </Text>
                  </Stack>
                </Menu.Item>
                <Menu.Item>
                  <Stack gap={4}>
                    <Text size="sm" fw={500}>
                      Low stock alert
                    </Text>
                    <Text size="xs" c="dimmed">
                      15 minutes ago
                    </Text>
                  </Stack>
                </Menu.Item>
                <Menu.Item>
                  <Stack gap={4}>
                    <Text size="sm" fw={500}>
                      Order shipped
                    </Text>
                    <Text size="xs" c="dimmed">
                      1 hour ago
                    </Text>
                  </Stack>
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>

            {/* Profile Menu with Avatar */}
            <Menu shadow="md" width={210} position="bottom" offset={13}>
              <Menu.Target>
                <Group
                  gap="sm"
                  style={{
                    cursor: "pointer",
                    padding: "6px 12px",
                    borderRadius: "var(--mantine-radius-lg)",
                    transition: "background-color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--mantine-color-gray-0)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <ThemeIcon size={32} radius="lg" variant="light" color="blue">
                    <IconUser size={16} />
                  </ThemeIcon>
                  <Text size="sm" fw={600}>
                    Owner
                  </Text>
                  <IconChevronDown size={14} style={{ opacity: 0.6 }} />
                </Group>
              </Menu.Target>

              <Menu.Dropdown style={{ marginTop: 0 }}>
                {/* <Menu.Item leftSection={<IconSettings size={16} />}>Settings</Menu.Item>

                <Menu.Divider /> */}

                <Menu.Item color="red" leftSection={<IconLogout size={16} />}>
                  Logout
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </Paper>

      {/* Tabs Navigation */}
      <Tabs
        value={view}
        onChange={(value) => setView(value as OwnerView)}
        keepMounted={false}
        variant="pills"
        styles={{
          root: {
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          },
          list: {
            flexWrap: "wrap",
            gap: "0.5rem",
            justifyContent: "center",
          },
          tab: {
            fontWeight: "500 !important",
            fontSize: "0.875rem !important",
            padding: "0.75rem 1.5rem !important",
            borderRadius: "var(--mantine-radius-lg) !important",
            transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) !important",
            border: "2px solid #e9ecef !important",
            backgroundColor: "#ffffff !important",
            color: "#495057 !important",
            position: "relative" as const,
            overflow: "hidden !important",
            cursor: "pointer !important",

            "&::before": {
              content: '""',
              position: "absolute",
              top: "0",
              left: "-100%",
              width: "100%",
              height: "100%",
              background: "linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.2), transparent)",
              transition: "left 0.6s ease",
              zIndex: 0,
            },

            "&:hover": {
              backgroundColor: "#e7f5ff !important",
              borderColor: "#74c0fc !important",
              transform: "translateY(-3px) scale(1.05) !important",
              boxShadow: "0 8px 16px rgba(34, 139, 230, 0.15), 0 4px 8px rgba(0, 0, 0, 0.08) !important",
              color: "#1971c2 !important",
            },

            "&:hover::before": {
              left: "100%",
            },

            "&:active": {
              transform: "translateY(-1px) scale(0.97) !important",
              transition: "all 0.1s ease !important",
            },

            "&[data-active]": {
              backgroundColor: "#228be6 !important",
              color: "#ffffff !important",
              fontWeight: "600 !important",
              borderColor: "#1c7ed6 !important",
              boxShadow:
                "0 8px 24px rgba(34, 139, 230, 0.4), 0 4px 12px rgba(34, 139, 230, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2) !important",
              transform: "translateY(-2px) scale(1.02) !important",
            },

            "&[data-active]::before": {
              background: "linear-gradient(135deg, transparent, rgba(255, 255, 255, 0.3), transparent)",
            },

            "&[data-active]:hover": {
              backgroundColor: "#1971c2 !important",
              borderColor: "#1864ab !important",
              transform: "translateY(-4px) scale(1.05) !important",
              boxShadow:
                "0 12px 32px rgba(34, 139, 230, 0.5), 0 6px 16px rgba(34, 139, 230, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.3) !important",
            },

            "&[data-active]:hover::before": {
              left: "100%",
            },
          },
        }}
      >
        <Paper
          p="sm"
          radius="lg"
          bg="white"
          style={{
            border: "1px solid var(--mantine-color-gray-2)",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
          }}
        >
          <Tabs.List>
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Tabs.Tab key={action.value} value={action.value} leftSection={<Icon size={16} />}>
                  {action.label}
                </Tabs.Tab>
              );
            })}
          </Tabs.List>
        </Paper>

        {/* Overview Tab */}
        <Tabs.Panel value="overview" pt="xl">
          <Stack gap="xl">
            {/* KPI Cards */}
            <Stack gap="md">
              <Title order={3}>Key Metrics</Title>
              {loadingOverview ? (
                <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} spacing="md">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i} p="xl" radius="lg" style={{ height: "100%", minHeight: 180 }}>
                      <Stack gap="sm">
                        <Skeleton height={14} width="40%" />
                        <Skeleton height={36} width="70%" />
                        <Skeleton height={12} width="50%" />
                        <Skeleton height={8} width="100%" />
                      </Stack>
                    </Card>
                  ))}
                </SimpleGrid>
              ) : (
                <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} spacing="md">
                  {cards.map((card) => {
                    const CardIcon = card.icon;
                    return (
                      <Card
                        key={card.label}
                        p="xl"
                        radius="lg"
                        style={{
                          background: `linear-gradient(135deg, var(--mantine-color-${card.color}-6) 0%, var(--mantine-color-${card.color}-8) 100%)`,
                          border: "none",
                          height: "100%",
                          position: "relative",
                          overflow: "hidden",
                          boxShadow: `0 4px 20px var(--mantine-color-${card.color}-2)`,
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            top: "-25px",
                            right: "-25px",
                            width: "100px",
                            height: "100px",
                            borderRadius: "50%",
                            background: "rgba(255, 255, 255, 0.1)",
                            backdropFilter: "blur(10px)",
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            bottom: "-40px",
                            left: "-40px",
                            width: "120px",
                            height: "120px",
                            borderRadius: "50%",
                            background: "rgba(255, 255, 255, 0.05)",
                            backdropFilter: "blur(10px)",
                          }}
                        />

                        <Stack gap="md" style={{ height: "100%", position: "relative", zIndex: 1 }}>
                          <Group justify="space-between" align="flex-start">
                            <div
                              style={{
                                padding: "11px",
                                borderRadius: "var(--mantine-radius-lg)",
                                background: "rgba(255, 255, 255, 0.2)",
                                backdropFilter: "blur(10px)",
                                border: "1px solid rgba(255, 255, 255, 0.3)",
                              }}
                            >
                              <CardIcon size={24} style={{ color: "white" }} />
                            </div>
                            <div
                              style={{
                                padding: "4px 9px",
                                borderRadius: "var(--mantine-radius-lg)",
                                background: "rgba(255, 255, 255, 0.2)",
                                backdropFilter: "blur(10px)",
                                border: "1px solid rgba(255, 255, 255, 0.3)",
                              }}
                            >
                              <Text size="xs" fw={600} c="white" style={{ opacity: 0.9, fontSize: "0.7rem" }}>
                                LIVE
                              </Text>
                            </div>
                          </Group>

                          <div>
                            <Text
                              size="sm"
                              fw={700}
                              c="white"
                              tt="uppercase"
                              style={{
                                opacity: 0.95,
                                letterSpacing: "1.5px",
                                fontSize: "0.85rem",
                                marginBottom: "16px",
                                textShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
                              }}
                            >
                              {card.label}
                            </Text>

                            <Title
                              order={1}
                              fw={900}
                              c="white"
                              style={{
                                fontSize: "2.75rem",
                                lineHeight: 1.1,
                                textShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
                                marginBottom: "8px",
                                letterSpacing: "-0.02em",
                              }}
                            >
                              {card.value}
                            </Title>

                            <Text size="sm" c="white" style={{ opacity: 0.85, fontSize: "0.875rem" }}>
                              {card.subtitle}
                            </Text>
                          </div>

                          {card.progress !== undefined && (
                            <div style={{ marginTop: "auto" }}>
                              <Group justify="space-between" mb={7}>
                                <Text size="xs" c="white" fw={500} style={{ opacity: 0.9, fontSize: "0.7rem" }}>
                                  Progress
                                </Text>
                                <Text size="sm" fw={700} c="white">
                                  {card.progress.toFixed(0)}%
                                </Text>
                              </Group>
                              <Progress
                                value={card.progress}
                                size="md"
                                radius="lg"
                                styles={{
                                  root: {
                                    backgroundColor: "rgba(255, 255, 255, 0.2)",
                                    border: "1px solid rgba(255, 255, 255, 0.3)",
                                  },
                                  section: {
                                    background: "linear-gradient(90deg, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 1))",
                                  },
                                }}
                              />
                            </div>
                          )}

                          <Group gap="xs" align="center" style={{ marginTop: card.progress === undefined ? "auto" : undefined }}>
                            <div
                              style={{
                                padding: "5px 12px",
                                borderRadius: "var(--mantine-radius-lg)",
                                background: "rgba(255, 255, 255, 0.95)",
                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                              }}
                            >
                              <Text size="sm" fw={700} c={`${card.color}.8`}>
                                {card.change}
                              </Text>
                            </div>
                            <Text size="xs" c="white" fw={500} style={{ opacity: 0.9, fontSize: "0.7rem" }}>
                              {card.changeLabel}
                            </Text>
                          </Group>
                        </Stack>
                      </Card>
                    );
                  })}
                </SimpleGrid>
              )}
            </Stack>

            {/* Daily Briefing */}
            <Stack gap="md">
              <Stack gap="xs">
                <Title order={3}>Daily Briefing</Title>
                <Text size="sm" c="dimmed">
                  AI-powered insights and recommendations
                </Text>
              </Stack>
              {orgId ? (
                <DailyBriefingCard orgId={orgId} />
              ) : (
                <Card withBorder shadow="sm" radius="lg" bg="white">
                  <Stack gap="sm" py="md">
                    <Skeleton height={14} width="30%" />
                    <Skeleton height={10} width="90%" />
                    <Skeleton height={10} width="85%" />
                    <Skeleton height={10} width="80%" />
                  </Stack>
                </Card>
              )}
            </Stack>

            {/* Analytics */}
            <Stack gap="md">
              <Stack gap="xs">
                <Title order={3}>Analytics</Title>
                <Text size="sm" c="dimmed">
                  Sales trends and product performance
                </Text>
              </Stack>
              {orgId ? (
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                  <SalesTrendChart orgId={orgId} />
                  <ProductPerformanceChart orgId={orgId} />
                </SimpleGrid>
              ) : (
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                  <Card radius="lg" withBorder>
                    <Skeleton height={280} />
                  </Card>
                  <Card radius="lg" withBorder>
                    <Skeleton height={400} />
                  </Card>
                </SimpleGrid>
              )}
            </Stack>

            {/* Low stock */}
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Stack gap="xs">
                  <Title order={3}>Low Stock Alerts</Title>
                  <Text size="sm" c="dimmed">
                    Items below threshold of 5 units
                  </Text>
                </Stack>
                {!loadingOverview && lowStock && lowStock.length > 0 && (
                  <Badge size="lg" variant="filled" color="red" radius="lg">
                    {lowStock.length} {lowStock.length === 1 ? "alert" : "alerts"}
                  </Badge>
                )}
              </Group>
              {loadingOverview ? (
                <Paper
                  radius="lg"
                  bg="white"
                  style={{
                    border: "1px solid var(--mantine-color-gray-2)",
                    padding: 16,
                  }}
                >
                  <Stack gap="sm">
                    <Skeleton height={16} />
                    <Skeleton height={16} />
                    <Skeleton height={16} />
                    <Skeleton height={16} />
                  </Stack>
                </Paper>
              ) : lowStock && lowStock.length === 0 ? (
                <Paper
                  p="xl"
                  radius="lg"
                  bg="teal.0"
                  style={{
                    border: "1px solid var(--mantine-color-teal-2)",
                  }}
                >
                  <Group>
                    <ThemeIcon size={48} radius="lg" color="teal" variant="light">
                      <IconPackage size={24} />
                    </ThemeIcon>
                    <Stack gap={4}>
                      <Text size="md" fw={700}>
                        All inventory healthy!
                      </Text>
                      <Text size="sm" c="dimmed">
                        No low stock items right now. Great job maintaining inventory levels.
                      </Text>
                    </Stack>
                  </Group>
                </Paper>
              ) : (
                <Paper
                  radius="lg"
                  bg="white"
                  style={{
                    border: "1px solid var(--mantine-color-gray-2)",
                    overflow: "hidden",
                  }}
                >
                  <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
                    <Table.Thead style={{ backgroundColor: "var(--mantine-color-gray-0)" }}>
                      <Table.Tr>
                        <Table.Th>
                          <Text fw={600} size="sm">
                            Product
                          </Text>
                        </Table.Th>
                        <Table.Th>
                          <Text fw={600} size="sm">
                            SKU
                          </Text>
                        </Table.Th>
                        <Table.Th>
                          <Text fw={600} size="sm">
                            Stock
                          </Text>
                        </Table.Th>
                        <Table.Th>
                          <Text fw={600} size="sm">
                            Location
                          </Text>
                        </Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {lowStock?.map((product: any) => (
                        <Table.Tr key={product._id}>
                          <Table.Td>
                            <Group gap="sm">
                              <ThemeIcon size={32} radius="lg" color="red" variant="light">
                                <IconAlertCircle size={16} />
                              </ThemeIcon>
                              <div>
                                <Text fw={500} size="sm">
                                  {product.name}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  {product.category || "Uncategorized"}
                                </Text>
                              </div>
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Badge variant="light" color="gray" size="sm" radius="lg">
                              {product.sku}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Badge variant="filled" color={product.stockQuantity === 0 ? "red" : "orange"} size="sm" radius="lg">
                              {product.stockQuantity} units
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" c="dimmed">
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
          </Stack>
        </Tabs.Panel>

        {/* Other Tabs */}
        <Tabs.Panel value="products" pt="lg">
          <ProductsPage />
        </Tabs.Panel>

        <Tabs.Panel value="orders" pt="lg">
          <OrdersPage />
        </Tabs.Panel>

        <Tabs.Panel value="staff" pt="lg">
          <StaffManagementPage />
        </Tabs.Panel>

        <Tabs.Panel value="integrations" pt="lg">
          <IntegrationsPage />
        </Tabs.Panel>

        <Tabs.Panel value="analytics" pt="lg">
          <AnalyticsPage />
        </Tabs.Panel>

        <Tabs.Panel value="inventory" pt="lg">
          <InventoryPage />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
