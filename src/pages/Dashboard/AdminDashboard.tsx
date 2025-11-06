import type { FormEvent } from "react";

import { useMemo, useState } from "react";

import {
  Anchor,
  Badge,
  Button,
  Divider,
  Group,
  NumberInput,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useAction, useMutation, useQuery } from "convex/react";

import FullscreenLoader from "@shared/components/FullscreenLoader";

import { api } from "../../../convex/_generated/api";

// src/pages/Dashboard/AdminDashboard.tsx

type FormItem = { sku: string; quantity: number };

const EMPTY_FORM = {
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  recipientName: "",
  recipientPhone: "",
  recipientAddress: "",
  recipientCity: "",
  recipientProvince: "",
  recipientPostalCode: "",
  recipientCountry: "US",
  notes: "",
  items: [] as FormItem[],
};

export default function AdminDashboard() {
  const orgResult = useQuery(api.organizations.getForCurrentUser, {});
  const orgId = orgResult?.organization?._id;

  const products = useQuery(api.inventory.list, orgId ? { orgId } : "skip");
  const orders = useQuery(api.orders.list, orgId ? { orgId } : "skip");

  const createOrder = useMutation(api.orders.create);
  const updateStatus = useMutation(api.orders.updateStatus);
  const extract = useAction((api as any)["agents/extractionAgent"].extractOrderFromChat);

  const [chat, setChat] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const skuMap = useMemo(() => {
    const map: Record<string, any> = {};
    (products as any[])?.forEach((product: any) => {
      map[product.sku] = product;
    });
    return map;
  }, [products]);

  const handleExtract = async () => {
    if (!chat.trim()) return;
    if (!orgId) {
      alert("Organization not found");
      return;
    }
    setExtracting(true);
    try {
      const res: any = await extract({ chatText: chat, orgId });
      if (res?.success && res.data) {
        const d = res.data;
        setForm((prev) => ({
          ...prev,
          customerName: d.customerName || prev.customerName,
          customerPhone: d.customerPhone || prev.customerPhone,
          recipientName: d.recipientName || d.customerName || prev.recipientName,
          recipientPhone: d.recipientPhone || d.customerPhone || prev.recipientPhone,
          recipientAddress: d.address || prev.recipientAddress,
          recipientCity: d.city || prev.recipientCity,
          recipientProvince: d.province || prev.recipientProvince,
          recipientPostalCode: d.postalCode || prev.recipientPostalCode,
          recipientCountry: (d.country || prev.recipientCountry || "US").toUpperCase(),
          notes: [prev.notes, d.notes].filter(Boolean).join("\n").trim(),
          items: Array.isArray(d.items)
            ? d.items
                .filter((item: any) => item)
                .map((item: any) => ({
                  sku: item.sku || item.name || "",
                  quantity: Math.max(1, Number(item.quantity) || 1),
                }))
            : prev.items,
        }));
      } else {
        alert(res?.error || "Extraction failed");
      }
    } catch (error: any) {
      alert(error?.message || "Extraction error");
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!orgId) return;

    try {
      const itemsPayload = form.items
        .map((item) => ({ sku: item.sku.trim(), quantity: item.quantity }))
        .filter((item) => item.sku && skuMap[item.sku])
        .map((item) => ({ productId: skuMap[item.sku]._id, quantity: item.quantity }));

      if (itemsPayload.length === 0) {
        alert("Please add at least one valid item (by SKU)");
        return;
      }

      const orderId = await createOrder({
        orgId,
        customerName: form.customerName || form.recipientName,
        customerPhone: form.customerPhone || form.recipientPhone,
        customerEmail: form.customerEmail || undefined,
        recipientName: form.recipientName,
        recipientPhone: form.recipientPhone,
        recipientAddress: form.recipientAddress,
        recipientCity: form.recipientCity,
        recipientProvince: form.recipientProvince,
        recipientPostalCode: form.recipientPostalCode,
        recipientCountry: form.recipientCountry,
        items: itemsPayload as any,
        rawChatLog: chat || undefined,
        notes: form.notes || undefined,
      });

      await updateStatus({ orderId, status: "paid" });
      alert("Order created and marked as paid");
      setChat("");
      setForm(EMPTY_FORM);
    } catch (error: any) {
      alert(error?.message || "Failed to create order");
    }
  };

  if (orgResult === undefined || products === undefined || orders === undefined) {
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

  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Title order={3}>Order management</Title>
        <Text size="sm" c="gray.6">
          Capture verified customer orders and coordinate with your warehouse in one view.
        </Text>
      </Stack>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl">
        <Paper component="section" withBorder radius="lg" p="xl" shadow="sm" bg="white">
          <Stack gap="lg">
            <Stack gap={4}>
              <Title order={4}>Create order</Title>
              <Text size="sm" c="gray.6">
                Use verified chat information to create a shipping-ready order.
              </Text>
            </Stack>

            <form onSubmit={handleSubmit}>
              <Stack gap="md">
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <TextInput
                    label="Customer name"
                    placeholder="Full name"
                    value={form.customerName}
                    onChange={(event) => setForm((state) => ({ ...state, customerName: event.currentTarget.value }))}
                  />
                  <TextInput
                    label="Customer phone"
                    placeholder="+62..."
                    value={form.customerPhone}
                    onChange={(event) => setForm((state) => ({ ...state, customerPhone: event.currentTarget.value }))}
                  />
                  <TextInput
                    label="Recipient name"
                    placeholder="Ship to"
                    value={form.recipientName}
                    onChange={(event) => setForm((state) => ({ ...state, recipientName: event.currentTarget.value }))}
                  />
                  <TextInput
                    label="Recipient phone"
                    placeholder="+62..."
                    value={form.recipientPhone}
                    onChange={(event) => setForm((state) => ({ ...state, recipientPhone: event.currentTarget.value }))}
                  />
                </SimpleGrid>

                <TextInput
                  label="Customer email"
                  placeholder="Optional"
                  value={form.customerEmail}
                  onChange={(event) => setForm((state) => ({ ...state, customerEmail: event.currentTarget.value }))}
                />

                <Textarea
                  label="Shipping address"
                  placeholder="Street, building, detail information"
                  minRows={3}
                  value={form.recipientAddress}
                  onChange={(event) => setForm((state) => ({ ...state, recipientAddress: event.currentTarget.value }))}
                />

                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                  <TextInput
                    label="City"
                    value={form.recipientCity}
                    onChange={(event) => setForm((state) => ({ ...state, recipientCity: event.currentTarget.value }))}
                  />
                  <TextInput
                    label="Province/State"
                    value={form.recipientProvince}
                    onChange={(event) => setForm((state) => ({ ...state, recipientProvince: event.currentTarget.value }))}
                  />
                  <TextInput
                    label="Postal code"
                    value={form.recipientPostalCode}
                    onChange={(event) => setForm((state) => ({ ...state, recipientPostalCode: event.currentTarget.value }))}
                  />
                </SimpleGrid>

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <TextInput
                    label="Country (ISO)"
                    placeholder="US"
                    value={form.recipientCountry}
                    onChange={(event) => setForm((state) => ({ ...state, recipientCountry: event.currentTarget.value }))}
                  />
                  <TextInput
                    label="Notes"
                    placeholder="Optional internal notes"
                    value={form.notes}
                    onChange={(event) => setForm((state) => ({ ...state, notes: event.currentTarget.value }))}
                  />
                </SimpleGrid>

                <Stack gap="sm">
                  <Group justify="space-between" align="center">
                    <Text fw={600}>Items</Text>
                    <Badge variant="light" color="brand">
                      Use SKU to match inventory
                    </Badge>
                  </Group>
                  <Stack gap="sm">
                    {form.items.length === 0 ? (
                      <Text size="sm" c="gray.5">
                        Add items below. Matching SKUs will populate the payload automatically.
                      </Text>
                    ) : null}
                    {form.items.map((item, index) => (
                      <Group key={`${item.sku}-${index}`} align="flex-end" gap="sm">
                        <TextInput
                          label="SKU"
                          placeholder="e.g., SKU123"
                          flex={1}
                          value={item.sku}
                          onChange={(event) =>
                            setForm((state) => ({
                              ...state,
                              items: state.items.map((existing, i) =>
                                i === index ? { ...existing, sku: event.currentTarget.value } : existing,
                              ),
                            }))
                          }
                        />
                        <NumberInput
                          label="Qty"
                          min={1}
                          value={item.quantity}
                          onChange={(value) =>
                            setForm((state) => ({
                              ...state,
                              items: state.items.map((existing, i) =>
                                i === index ? { ...existing, quantity: Number(value) || 1 } : existing,
                              ),
                            }))
                          }
                        />
                        <Button
                          variant="subtle"
                          color="red"
                          onClick={() =>
                            setForm((state) => ({
                              ...state,
                              items: state.items.filter((_, i) => i !== index),
                            }))
                          }
                        >
                          Remove
                        </Button>
                      </Group>
                    ))}
                    <Button
                      variant="light"
                      onClick={() => setForm((state) => ({ ...state, items: [...state.items, { sku: "", quantity: 1 }] }))}
                    >
                      Add item
                    </Button>
                  </Stack>
                </Stack>

                <Group justify="flex-end">
                  <Button type="submit">Create &amp; mark as paid</Button>
                </Group>
              </Stack>
            </form>
          </Stack>
        </Paper>

        <Paper component="section" withBorder radius="lg" p="xl" shadow="sm" bg="white">
          <Stack gap="lg">
            <Stack gap={4}>
              <Title order={4}>Paste chat → auto-fill</Title>
              <Text size="sm" c="gray.6">
                Paste the verified chat transcript. The AI extraction agent fills the form for you.
              </Text>
            </Stack>

            <Textarea
              placeholder="Paste customer chat transcript here"
              minRows={10}
              value={chat}
              onChange={(event) => setChat(event.currentTarget.value)}
            />

            <Group justify="space-between" align="center">
              <Button loading={extracting} onClick={handleExtract}>
                {extracting ? "Extracting…" : "Extract info"}
              </Button>
              <Text size="xs" c="gray.5">
                Output gets merged with the manual form on the left.
              </Text>
            </Group>

            <Divider label="Product reference" />

            <ScrollArea h={200} type="auto">
              <Table highlightOnHover verticalSpacing="xs" horizontalSpacing="md" withRowBorders={false}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>SKU</Table.Th>
                    <Table.Th>Stock</Table.Th>
                    <Table.Th>Sell price</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(products as any[])?.map((product: any) => (
                    <Table.Tr key={product._id}>
                      <Table.Td>
                        <Stack gap={0}>
                          <Text fw={600}>{product.name}</Text>
                          <Text size="xs" c="gray.5">
                            {product.category || "Uncategorized"}
                          </Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td>{product.sku}</Table.Td>
                      <Table.Td>{product.stockQuantity}</Table.Td>
                      <Table.Td>${product.sellPrice}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
            <Text size="xs" c="gray.5">
              Need to add a new product? Head to{" "}
              <Anchor href="/products" size="xs">
                Products
              </Anchor>{" "}
              or{" "}
              <Anchor href="/inventory" size="xs">
                Inventory Import
              </Anchor>
              .
            </Text>
          </Stack>
        </Paper>
      </SimpleGrid>

      <Stack gap="sm">
        <Group justify="space-between" align="flex-end">
          <Title order={4}>Recent orders</Title>
          <Text size="sm" c="gray.6">
            Showing latest updates across all statuses
          </Text>
        </Group>
        <Paper withBorder radius="lg" shadow="xs" bg="white">
          <ScrollArea type="auto" mah={360}>
            <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Order</Table.Th>
                  <Table.Th>Recipient</Table.Th>
                  <Table.Th>City</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Tracking</Table.Th>
                  <Table.Th>Items</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(orders as any[])?.map((order: any) => (
                  <Table.Tr key={order._id}>
                    <Table.Td>
                      <Stack gap={0}>
                        <Text fw={600}>{order.orderNumber || "Manual order"}</Text>
                        <Text size="xs" c="gray.5">
                          {new Date(order.createdAt || Date.now()).toLocaleString()}
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>{order.recipientName}</Table.Td>
                    <Table.Td>{order.recipientCity}</Table.Td>
                    <Table.Td>
                      <Badge variant="light" color="brand">
                        {order.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{order.trackingNumber || "Pending"}</Table.Td>
                    <Table.Td>{order.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      </Stack>
    </Stack>
  );
}
