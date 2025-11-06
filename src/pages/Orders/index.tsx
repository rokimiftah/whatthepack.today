// src/pages/Orders/index.tsx

import { useMemo, useState } from "react";

import {
  Badge,
  Button,
  Center,
  Group,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconCircleCheck,
  IconClock,
  IconCreditCard,
  IconEdit,
  IconPackage,
  IconTrash,
  IconTruck,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery } from "convex/react";

import FullscreenLoader from "@shared/components/FullscreenLoader";

import { api } from "../../../convex/_generated/api";

type Status = "pending" | "paid" | "processing" | "shipped" | "delivered" | "cancelled";

const statusOptions: { label: string; value: Status | "all" }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

export default function OrdersPage() {
  const orgRes = useQuery(api.organizations.getForCurrentUser, {});
  const orgId = orgRes?.organization?._id;

  const [status, setStatus] = useState<Status | "all">("all");
  const orders = useQuery(api.orders.list, orgId ? (status === "all" ? { orgId } : { orgId, status }) : "skip");

  const updateStatus = useMutation(api.orders.updateStatus);
  const updateShipping = useMutation(api.orders.updateShipping);
  const cancelOrder = useMutation(api.orders.cancel);

  const [trackingDraft, setTrackingDraft] = useState<Record<string, string>>({});

  const list = useMemo(() => ((orders as any[]) || []).slice().sort((a, b) => b.createdAt - a.createdAt), [orders]);

  const getStatusColor = (status: Status) => {
    switch (status) {
      case "pending":
        return "gray";
      case "paid":
        return "blue";
      case "processing":
        return "yellow";
      case "shipped":
        return "cyan";
      case "delivered":
        return "green";
      case "cancelled":
        return "red";
      default:
        return "gray";
    }
  };

  const getStatusIcon = (status: Status) => {
    switch (status) {
      case "pending":
        return IconClock;
      case "paid":
        return IconCreditCard;
      case "processing":
        return IconPackage;
      case "shipped":
        return IconTruck;
      case "delivered":
        return IconCircleCheck;
      case "cancelled":
        return IconX;
      default:
        return IconClock;
    }
  };

  const onSetTracking = async (order: any) => {
    try {
      const trackingNumber = (trackingDraft[order._id] || "").trim();
      if (!trackingNumber) return;
      await updateShipping({ orderId: order._id, trackingNumber });
      setTrackingDraft((state) => ({ ...state, [order._id]: "" }));
    } catch (error: any) {
      alert(error?.message || "Failed to set tracking");
    }
  };

  const onCancel = async (orderId: string) => {
    if (!confirm("Cancel this order?")) return;
    try {
      await cancelOrder({ orderId: orderId as any });
    } catch (error: any) {
      alert(error?.message || "Failed to cancel");
    }
  };

  const onSetStatus = async (orderId: string, nextStatus: Status) => {
    try {
      await updateStatus({ orderId: orderId as any, status: nextStatus });
    } catch (error: any) {
      alert(error?.message || "Failed to update status");
    }
  };

  if (orgRes === undefined || orders === undefined) {
    return <FullscreenLoader />;
  }

  if (!orgId) {
    return (
      <Center h="100vh">
        <Paper withBorder radius="lg" p="xl" bg="white">
          <Text size="sm" c="gray.6">
            Organization not found.
          </Text>
        </Paper>
      </Center>
    );
  }

  return (
    <Stack gap="xl">
      <Paper p="lg" radius="lg" bg="white" style={{ border: "1px solid var(--mantine-color-gray-2)" }}>
        <Group justify="space-between" align="center">
          <Stack gap={4}>
            <Title order={2} fw={700}>
              Orders Management
            </Title>
            <Text size="sm" c="dimmed">
              Track fulfillment progress and update statuses in real time
            </Text>
          </Stack>
          <Select
            data={statusOptions}
            value={status}
            onChange={(value) => setStatus((value as Status | "all") ?? "all")}
            w={220}
            radius="lg"
            size="md"
            styles={{
              input: {
                fontWeight: 500,
              },
            }}
          />
        </Group>
      </Paper>

      <Paper withBorder radius="lg" shadow="sm" bg="white" style={{ overflow: "hidden" }}>
        <ScrollArea type="auto">
          <Table highlightOnHover verticalSpacing="md" horizontalSpacing="lg">
            <Table.Thead style={{ backgroundColor: "var(--mantine-color-gray-0)" }}>
              <Table.Tr>
                <Table.Th>
                  <Text fw={600} size="sm">
                    Order
                  </Text>
                </Table.Th>
                <Table.Th>
                  <Text fw={600} size="sm">
                    Recipient
                  </Text>
                </Table.Th>
                <Table.Th>
                  <Text fw={600} size="sm">
                    City
                  </Text>
                </Table.Th>
                <Table.Th ta="right">
                  <Text fw={600} size="sm">
                    Items
                  </Text>
                </Table.Th>
                <Table.Th ta="right">
                  <Text fw={600} size="sm">
                    Total
                  </Text>
                </Table.Th>
                <Table.Th>
                  <Text fw={600} size="sm">
                    Status
                  </Text>
                </Table.Th>
                <Table.Th ta="right">
                  <Text fw={600} size="sm">
                    Actions
                  </Text>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {list.map((order: any) => {
                const itemCount = order.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;
                const amount = typeof order.totalPrice === "number" ? `$${order.totalPrice.toFixed(2)}` : order.totalPrice || "—";

                return (
                  <Table.Tr key={order._id}>
                    <Table.Td>
                      <Stack gap={4}>
                        <Text fw={600} size="sm">
                          {order.orderNumber || "Manual order"}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {new Date(order.createdAt || Date.now()).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {order.recipientName}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {order.recipientCity}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Badge variant="light" color="gray" size="lg" radius="lg">
                        {itemCount}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text fw={700} size="sm">
                        {amount}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        variant="light"
                        color={getStatusColor(order.status)}
                        size="lg"
                        radius="lg"
                        leftSection={
                          <ThemeIcon size="xs" color={getStatusColor(order.status)} variant="transparent">
                            {(() => {
                              const Icon = getStatusIcon(order.status);
                              return <Icon size={12} />;
                            })()}
                          </ThemeIcon>
                        }
                      >
                        {order.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap="sm" align="flex-end">
                        <Group gap="xs" justify="flex-end" align="center">
                          <Select
                            data={statusOptions.filter((option) => option.value !== "all") as any}
                            value={order.status}
                            onChange={(value) => value && onSetStatus(order._id, value as Status)}
                            w={160}
                            size="sm"
                            radius="lg"
                            leftSection={<IconEdit size={14} />}
                            styles={{
                              input: {
                                fontWeight: 500,
                              },
                            }}
                          />
                          {order.status !== "cancelled" && (
                            <Button
                              variant="light"
                              color="red"
                              size="sm"
                              radius="lg"
                              onClick={() => onCancel(order._id)}
                              leftSection={<IconTrash size={14} />}
                            >
                              Cancel
                            </Button>
                          )}
                        </Group>
                        <Group gap="xs" justify="flex-end">
                          <TextInput
                            placeholder="Tracking number"
                            size="sm"
                            w={200}
                            radius="lg"
                            value={trackingDraft[order._id] || ""}
                            onChange={(event) =>
                              setTrackingDraft((state) => ({ ...state, [order._id]: event.currentTarget.value }))
                            }
                            styles={{
                              input: {
                                fontWeight: 500,
                              },
                            }}
                          />
                          <Button
                            variant="filled"
                            size="sm"
                            radius="lg"
                            onClick={() => onSetTracking(order)}
                            disabled={!trackingDraft[order._id]}
                            leftSection={<IconTruck size={14} />}
                          >
                            Set
                          </Button>
                        </Group>
                      </Stack>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
              {list.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={7}>
                    <Center py="lg">
                      <Text size="sm" c="gray.6">
                        No orders yet for the selected filter.
                      </Text>
                    </Center>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>
    </Stack>
  );
}
