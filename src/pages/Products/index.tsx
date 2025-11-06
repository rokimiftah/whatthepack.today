import { useMemo, useState } from "react";

import {
  ActionIcon,
  Badge,
  Card,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconBoxSeam,
  IconChartLine,
  IconCurrencyDollar,
  IconDeviceFloppy,
  IconEdit,
  IconLocation,
  IconMinus,
  IconPackage,
  IconPlus,
  IconRuler,
  IconSearch,
  IconTag,
  IconTrash,
  IconWeight,
} from "@tabler/icons-react";
import { useMutation, useQuery } from "convex/react";

import FullscreenLoader from "@shared/components/FullscreenLoader";

import { api } from "../../../convex/_generated/api";

type ProductForm = {
  sku: string;
  name: string;
  description?: string;
  costOfGoods: number;
  sellPrice: number;
  stockQuantity: number;
  warehouseLocation: string;
  sop_packing?: string;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
};

export default function ProductsPage() {
  const orgRes = useQuery(api.organizations.getForCurrentUser, {});
  const orgId = orgRes?.organization?._id;

  const [searchTerm, setSearchTerm] = useState("");
  const products = useQuery(api.inventory.list, orgId ? { orgId } : "skip");

  const updateProduct = useMutation(api.inventory.update);
  const adjustStock = useMutation(api.inventory.adjustStock);
  const createProduct = useMutation(api.inventory.create);
  const removeProduct = useMutation(api.inventory.remove);

  const [creating, setCreating] = useState(false);
  const [edits, setEdits] = useState<Record<string, Partial<any>>>({});
  const [draft, setDraft] = useState<ProductForm>({
    sku: "",
    name: "",
    description: "",
    costOfGoods: 0,
    sellPrice: 0,
    stockQuantity: 0,
    warehouseLocation: "",
    sop_packing: "",
    weight: undefined,
    length: undefined,
    width: undefined,
    height: undefined,
  });

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!Array.isArray(products)) return [] as any[];
    if (!term) return products as any[];
    return (products as any[]).filter((p) => p.name?.toLowerCase().includes(term) || p.sku?.toLowerCase().includes(term));
  }, [products, searchTerm]);

  const handleQuickStock = async (productId: string, delta: number) => {
    try {
      await adjustStock({ productId: productId as any, adjustment: delta });
    } catch (e: any) {
      alert(e?.message || "Failed to adjust stock");
    }
  };

  const handleInlineSave = async (product: any) => {
    try {
      const e = edits[product._id] || {};
      const name = (e.name as string) ?? product.name;
      const description = (e.description as string) ?? product.description;
      const costOfGoods = Number((e.costOfGoods as any) ?? product.costOfGoods) || 0;
      const sellPrice = Number((e.sellPrice as any) ?? product.sellPrice) || 0;
      const stockQuantity = Number((e.stockQuantity as any) ?? product.stockQuantity) || 0;
      const warehouseLocation = (e.warehouseLocation as string) ?? product.warehouseLocation ?? "";
      const sop_packing = (e.sop_packing as string) ?? product.sop_packing ?? "";
      const weight = e.weight !== undefined ? Number(e.weight as any) : product.weight;
      const length = e.length !== undefined ? Number(e.length as any) : product.length;
      const width = e.width !== undefined ? Number(e.width as any) : product.width;
      const height = e.height !== undefined ? Number(e.height as any) : product.height;

      await updateProduct({
        productId: product._id,
        name,
        description,
        costOfGoods,
        sellPrice,
        stockQuantity,
        warehouseLocation,
        sop_packing,
        weight: weight as any,
        length: length as any,
        width: width as any,
        height: height as any,
      });
      alert("Saved");
      setEdits((s) => ({ ...s, [product._id]: {} }));
    } catch (e: any) {
      alert(e?.message || "Failed to save");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    setCreating(true);
    try {
      if (!draft.sku.trim() || !draft.name.trim()) throw new Error("SKU and Name required");
      await createProduct({
        orgId,
        sku: draft.sku.trim(),
        name: draft.name.trim(),
        description: draft.description?.trim() || "",
        costOfGoods: Number(draft.costOfGoods) || 0,
        sellPrice: Number(draft.sellPrice) || 0,
        stockQuantity: Number(draft.stockQuantity) || 0,
        warehouseLocation: draft.warehouseLocation.trim(),
        sop_packing: draft.sop_packing?.trim() || undefined,
        weight: draft.weight ? Number(draft.weight) : undefined,
        length: draft.length ? Number(draft.length) : undefined,
        width: draft.width ? Number(draft.width) : undefined,
        height: draft.height ? Number(draft.height) : undefined,
      });
      setDraft({
        sku: "",
        name: "",
        description: "",
        costOfGoods: 0,
        sellPrice: 0,
        stockQuantity: 0,
        warehouseLocation: "",
        sop_packing: "",
        weight: undefined,
        length: undefined,
        width: undefined,
        height: undefined,
      });
    } catch (e: any) {
      alert(e?.message || "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  if (orgRes === undefined || products === undefined) {
    return <FullscreenLoader />;
  }

  if (!orgId) {
    return <div className="p-6 text-sm text-neutral-400">Organization not found.</div>;
  }

  // Calculate stats
  const totalProducts = filtered.length;
  const totalValue = filtered.reduce((sum: number, p: any) => sum + (p.sellPrice || 0) * (p.stockQuantity || 0), 0);
  const lowStockCount = filtered.filter((p: any) => (p.stockQuantity || 0) < 5).length;

  return (
    <Stack gap="xl">
      {/* Header Section */}
      <Paper
        p="xl"
        radius="lg"
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          border: "none",
          boxShadow: "0 8px 32px rgba(102, 126, 234, 0.4)",
        }}
      >
        <Group justify="space-between" align="flex-start">
          <Stack gap="sm">
            <Group gap="sm">
              <ThemeIcon size={48} radius="md" variant="white" color="violet">
                <IconPackage size={28} />
              </ThemeIcon>
              <div>
                <Text size="xs" tt="uppercase" fw={600} c="white" style={{ opacity: 0.9, letterSpacing: "1.5px" }}>
                  Product Catalog
                </Text>
                <Title order={1} c="white" mt={4}>
                  Manage Products
                </Title>
              </div>
            </Group>
            <Group gap="xl" mt="sm">
              <div>
                <Text size="xs" c="white" style={{ opacity: 0.8 }}>
                  Total Products
                </Text>
                <Text size="xl" fw={700} c="white">
                  {totalProducts}
                </Text>
              </div>
              <div>
                <Text size="xs" c="white" style={{ opacity: 0.8 }}>
                  Total Value
                </Text>
                <Text size="xl" fw={700} c="white">
                  ${totalValue.toFixed(2)}
                </Text>
              </div>
              {lowStockCount > 0 && (
                <div>
                  <Text size="xs" c="white" style={{ opacity: 0.8 }}>
                    Low Stock Alerts
                  </Text>
                  <Group gap="xs">
                    <Text size="xl" fw={700} c="white">
                      {lowStockCount}
                    </Text>
                    <IconAlertTriangle size={20} color="white" />
                  </Group>
                </div>
              )}
            </Group>
          </Stack>
        </Group>
      </Paper>

      {/* Search Bar */}
      <TextInput
        size="lg"
        radius="md"
        placeholder="Search products by name or SKU..."
        leftSection={<IconSearch size={20} />}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        styles={{
          input: {
            border: "2px solid var(--mantine-color-gray-2)",
            "&:focus": {
              borderColor: "var(--mantine-color-violet-5)",
            },
          },
        }}
      />

      {/* Products Grid */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        {/* Create Product Card */}
        <Card
          radius="lg"
          p="xl"
          style={{
            border: "2px dashed var(--mantine-color-gray-3)",
            backgroundColor: "var(--mantine-color-gray-0)",
            minHeight: "400px",
          }}
        >
          <form onSubmit={handleCreate} style={{ height: "100%" }}>
            <Stack gap="md" style={{ height: "100%" }}>
              <Group justify="center" mb="md">
                <ThemeIcon size={56} radius="md" variant="light" color="violet">
                  <IconPlus size={32} />
                </ThemeIcon>
              </Group>

              <Title order={4} ta="center" c="violet">
                Create New Product
              </Title>

              <TextInput
                label="SKU"
                placeholder="Enter SKU"
                required
                value={draft.sku}
                onChange={(e) => setDraft((s) => ({ ...s, sku: e.target.value }))}
                leftSection={<IconTag size={16} />}
              />

              <TextInput
                label="Product Name"
                placeholder="Enter product name"
                required
                value={draft.name}
                onChange={(e) => setDraft((s) => ({ ...s, name: e.target.value }))}
                leftSection={<IconBoxSeam size={16} />}
              />

              <Group grow>
                <TextInput
                  label="COGS"
                  placeholder="0.00"
                  type="number"
                  value={draft.costOfGoods}
                  onChange={(e) => setDraft((s) => ({ ...s, costOfGoods: Number(e.target.value) || 0 }))}
                  leftSection={<IconCurrencyDollar size={16} />}
                />
                <TextInput
                  label="Sell Price"
                  placeholder="0.00"
                  type="number"
                  value={draft.sellPrice}
                  onChange={(e) => setDraft((s) => ({ ...s, sellPrice: Number(e.target.value) || 0 }))}
                  leftSection={<IconCurrencyDollar size={16} />}
                />
              </Group>

              <Group grow>
                <TextInput
                  label="Stock"
                  placeholder="0"
                  type="number"
                  value={draft.stockQuantity}
                  onChange={(e) => setDraft((s) => ({ ...s, stockQuantity: Number(e.target.value) || 0 }))}
                  leftSection={<IconPackage size={16} />}
                />
                <TextInput
                  label="Location"
                  placeholder="A1-B2"
                  value={draft.warehouseLocation}
                  onChange={(e) => setDraft((s) => ({ ...s, warehouseLocation: e.target.value }))}
                  leftSection={<IconLocation size={16} />}
                />
              </Group>

              <button
                type="submit"
                disabled={creating}
                style={{
                  marginTop: "auto",
                  padding: "12px 24px",
                  borderRadius: "8px",
                  border: "none",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "white",
                  fontWeight: 600,
                  cursor: creating ? "not-allowed" : "pointer",
                  opacity: creating ? 0.6 : 1,
                }}
              >
                {creating ? "Creating..." : "Create Product"}
              </button>
            </Stack>
          </form>
        </Card>

        {/* Product Cards */}
        {filtered.map((p: any) => {
          const e = edits[p._id] || {};
          const isEditing = Object.keys(e).length > 0;
          const profit = (p.sellPrice || 0) - (p.costOfGoods || 0);
          const profitMargin = p.sellPrice > 0 ? ((profit / p.sellPrice) * 100).toFixed(1) : "0";
          const stockStatus =
            (p.stockQuantity || 0) === 0
              ? "out"
              : (p.stockQuantity || 0) < 5
                ? "low"
                : (p.stockQuantity || 0) < 20
                  ? "medium"
                  : "good";
          const stockColor =
            stockStatus === "out" ? "red" : stockStatus === "low" ? "orange" : stockStatus === "medium" ? "yellow" : "green";

          return (
            <Card
              key={p._id}
              radius="lg"
              p="xl"
              style={{
                border: isEditing ? "2px solid var(--mantine-color-violet-5)" : "1px solid var(--mantine-color-gray-2)",
                backgroundColor: "white",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Stock Status Indicator */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: "4px",
                  height: "100%",
                  backgroundColor: `var(--mantine-color-${stockColor}-5)`,
                }}
              />

              <Stack gap="md">
                {/* Product Header */}
                <Group justify="space-between" align="flex-start">
                  <div style={{ flex: 1 }}>
                    {isEditing ? (
                      <TextInput
                        value={(e.name as string) ?? p.name ?? ""}
                        onChange={(ev) => setEdits((s) => ({ ...s, [p._id]: { ...s[p._id], name: ev.target.value } }))}
                        size="sm"
                        fw={600}
                      />
                    ) : (
                      <Title order={4} lineClamp={1}>
                        {p.name}
                      </Title>
                    )}
                    <Badge variant="light" color="gray" size="sm" mt={4}>
                      {p.sku}
                    </Badge>
                  </div>
                  <Group gap={4}>
                    <Tooltip label="Edit Product">
                      <ActionIcon
                        variant="light"
                        color={isEditing ? "violet" : "gray"}
                        size="lg"
                        radius="md"
                        onClick={() => {
                          if (isEditing) {
                            setEdits((s) => ({ ...s, [p._id]: {} }));
                          } else {
                            setEdits((s) => ({ ...s, [p._id]: { name: p.name } }));
                          }
                        }}
                      >
                        <IconEdit size={18} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Delete Product">
                      <ActionIcon
                        variant="light"
                        color="red"
                        size="lg"
                        radius="md"
                        onClick={async () => {
                          if (!confirm(`Delete product ${p.sku}? This cannot be undone.`)) return;
                          try {
                            await removeProduct({ productId: p._id });
                          } catch (e: any) {
                            alert(e?.message || "Failed to delete product");
                          }
                        }}
                      >
                        <IconTrash size={18} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>

                {/* Pricing Section */}
                <Paper p="md" radius="md" bg="gray.0">
                  <SimpleGrid cols={2} spacing="md">
                    <div>
                      <Text size="xs" c="dimmed" mb={4}>
                        Cost of Goods
                      </Text>
                      {isEditing ? (
                        <TextInput
                          value={(e.costOfGoods as any) ?? p.costOfGoods ?? 0}
                          onChange={(ev) =>
                            setEdits((s) => ({ ...s, [p._id]: { ...s[p._id], costOfGoods: Number(ev.target.value) || 0 } }))
                          }
                          size="sm"
                          leftSection={<IconCurrencyDollar size={14} />}
                        />
                      ) : (
                        <Group gap={4}>
                          <IconCurrencyDollar size={16} style={{ opacity: 0.6 }} />
                          <Text fw={600}>${(p.costOfGoods || 0).toFixed(2)}</Text>
                        </Group>
                      )}
                    </div>
                    <div>
                      <Text size="xs" c="dimmed" mb={4}>
                        Sell Price
                      </Text>
                      {isEditing ? (
                        <TextInput
                          value={(e.sellPrice as any) ?? p.sellPrice ?? 0}
                          onChange={(ev) =>
                            setEdits((s) => ({ ...s, [p._id]: { ...s[p._id], sellPrice: Number(ev.target.value) || 0 } }))
                          }
                          size="sm"
                          leftSection={<IconCurrencyDollar size={14} />}
                        />
                      ) : (
                        <Group gap={4}>
                          <IconCurrencyDollar size={16} style={{ opacity: 0.6 }} />
                          <Text fw={600}>${(p.sellPrice || 0).toFixed(2)}</Text>
                        </Group>
                      )}
                    </div>
                  </SimpleGrid>
                </Paper>

                {/* Profit Margin */}
                <Group justify="space-between" align="center">
                  <Group gap="xs">
                    <ThemeIcon size={32} radius="md" variant="light" color={profit > 0 ? "teal" : "red"}>
                      <IconChartLine size={16} />
                    </ThemeIcon>
                    <div>
                      <Text size="xs" c="dimmed">
                        Profit Margin
                      </Text>
                      <Text fw={600} c={profit > 0 ? "teal" : "red"}>
                        {profitMargin}%
                      </Text>
                    </div>
                  </Group>
                  <Badge variant="light" color={profit > 0 ? "teal" : "red"} size="lg">
                    ${profit.toFixed(2)}
                  </Badge>
                </Group>

                {/* Stock Management */}
                <Paper
                  p="md"
                  radius="md"
                  bg={`${stockColor}.0`}
                  style={{ border: `1px solid var(--mantine-color-${stockColor}-2)` }}
                >
                  <Group justify="space-between" align="center" mb="sm">
                    <Group gap="xs">
                      <IconPackage size={16} />
                      <Text size="sm" fw={600}>
                        Stock Level
                      </Text>
                    </Group>
                    <Badge variant="filled" color={stockColor} size="lg">
                      {p.stockQuantity || 0} units
                    </Badge>
                  </Group>
                  <Group justify="center" gap="md">
                    <ActionIcon
                      variant="filled"
                      color={stockColor}
                      size="lg"
                      radius="md"
                      onClick={() => handleQuickStock(p._id, -1)}
                      disabled={(p.stockQuantity || 0) === 0}
                    >
                      <IconMinus size={18} />
                    </ActionIcon>
                    <ActionIcon
                      variant="filled"
                      color={stockColor}
                      size="lg"
                      radius="md"
                      onClick={() => handleQuickStock(p._id, 1)}
                    >
                      <IconPlus size={18} />
                    </ActionIcon>
                  </Group>
                </Paper>

                {/* Location */}
                {isEditing ? (
                  <TextInput
                    label="Warehouse Location"
                    value={(e.warehouseLocation as string) ?? p.warehouseLocation ?? ""}
                    onChange={(ev) => setEdits((s) => ({ ...s, [p._id]: { ...s[p._id], warehouseLocation: ev.target.value } }))}
                    leftSection={<IconLocation size={16} />}
                  />
                ) : (
                  <Group gap="xs">
                    <IconLocation size={16} style={{ opacity: 0.6 }} />
                    <Text size="sm" c="dimmed">
                      {p.warehouseLocation || "No location set"}
                    </Text>
                  </Group>
                )}

                {/* Dimensions (if available) */}
                {(p.weight || p.length || p.width || p.height) && (
                  <Group gap="md">
                    {p.weight && (
                      <Tooltip label="Weight">
                        <Group gap={4}>
                          <IconWeight size={14} style={{ opacity: 0.6 }} />
                          <Text size="xs" c="dimmed">
                            {p.weight}g
                          </Text>
                        </Group>
                      </Tooltip>
                    )}
                    {(p.length || p.width || p.height) && (
                      <Tooltip label="Dimensions (L×W×H)">
                        <Group gap={4}>
                          <IconRuler size={14} style={{ opacity: 0.6 }} />
                          <Text size="xs" c="dimmed">
                            {p.length}×{p.width}×{p.height}
                          </Text>
                        </Group>
                      </Tooltip>
                    )}
                  </Group>
                )}

                {/* Save Button (only show when editing) */}
                {isEditing && (
                  <button
                    onClick={() => handleInlineSave(p)}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "8px",
                      border: "none",
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      color: "white",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                    }}
                  >
                    <IconDeviceFloppy size={18} />
                    Save Changes
                  </button>
                )}
              </Stack>
            </Card>
          );
        })}
      </SimpleGrid>

      {/* Empty State */}
      {filtered.length === 0 && !searchTerm && (
        <Paper p="xl" radius="lg" bg="gray.0" style={{ textAlign: "center" }}>
          <ThemeIcon size={64} radius="md" variant="light" color="gray" mx="auto" mb="md">
            <IconPackage size={32} />
          </ThemeIcon>
          <Title order={3} c="dimmed" mb="xs">
            No products yet
          </Title>
          <Text size="sm" c="dimmed">
            Create your first product to get started
          </Text>
        </Paper>
      )}

      {/* No Search Results */}
      {filtered.length === 0 && searchTerm && (
        <Paper p="xl" radius="lg" bg="gray.0" style={{ textAlign: "center" }}>
          <ThemeIcon size={64} radius="md" variant="light" color="gray" mx="auto" mb="md">
            <IconSearch size={32} />
          </ThemeIcon>
          <Title order={3} c="dimmed" mb="xs">
            No products found
          </Title>
          <Text size="sm" c="dimmed">
            Try adjusting your search terms
          </Text>
        </Paper>
      )}
    </Stack>
  );
}
