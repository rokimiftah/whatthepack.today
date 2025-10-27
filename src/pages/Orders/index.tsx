// src/pages/Orders/index.tsx

import { useMemo, useState } from "react";

import { Badge, Button, Center, Group, Paper, ScrollArea, Select, Stack, Table, Text, TextInput, Title } from "@mantine/core";
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
      <Group justify="space-between" align="center">
        <Stack gap={4}>
          <Title order={3}>Orders management</Title>
          <Text size="sm" c="gray.6">
            Track fulfillment progress and update statuses in real time.
          </Text>
        </Stack>
        <Select data={statusOptions} value={status} onChange={(value) => setStatus((value as Status | "all") ?? "all")} w={220} />
      </Group>

      <Paper withBorder radius="lg" shadow="xs" bg="white">
        <ScrollArea type="auto">
          <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Order</Table.Th>
                <Table.Th>Recipient</Table.Th>
                <Table.Th>City</Table.Th>
                <Table.Th ta="right">Items</Table.Th>
                <Table.Th ta="right">Total</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th ta="right">Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {list.map((order: any) => {
                const itemCount = order.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;
                const amount = typeof order.totalPrice === "number" ? `$${order.totalPrice.toFixed(2)}` : order.totalPrice || "—";

                return (
                  <Table.Tr key={order._id}>
                    <Table.Td>
                      <Stack gap={0} justify="center">
                        <Text fw={600}>{order.orderNumber || "Manual order"}</Text>
                        <Text size="xs" c="gray.5">
                          {new Date(order.createdAt || Date.now()).toLocaleString()}
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>{order.recipientName}</Table.Td>
                    <Table.Td>{order.recipientCity}</Table.Td>
                    <Table.Td ta="right">{itemCount}</Table.Td>
                    <Table.Td ta="right">{amount}</Table.Td>
                    <Table.Td>
                      <Badge variant="light" color="brand">
                        {order.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap="xs" align="flex-end">
                        <Group gap="xs" justify="flex-end" align="center">
                          <Select
                            data={statusOptions.filter((option) => option.value !== "all") as any}
                            value={order.status}
                            onChange={(value) => value && onSetStatus(order._id, value as Status)}
                            w={160}
                            size="xs"
                          />
                          {order.status !== "cancelled" && (
                            <Button variant="subtle" color="red" size="xs" onClick={() => onCancel(order._id)}>
                              Cancel
                            </Button>
                          )}
                        </Group>
                        <Group gap="xs" justify="flex-end">
                          <TextInput
                            placeholder="Tracking #"
                            size="xs"
                            w={160}
                            value={trackingDraft[order._id] || ""}
                            onChange={(event) =>
                              setTrackingDraft((state) => ({ ...state, [order._id]: event.currentTarget.value }))
                            }
                          />
                          <Button
                            variant="light"
                            size="xs"
                            onClick={() => onSetTracking(order)}
                            disabled={!trackingDraft[order._id]}
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
