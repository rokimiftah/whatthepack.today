import { useMemo, useState } from "react";

import { Group, Paper, Stack, Text, Title } from "@mantine/core";
import { IconDeviceFloppy, IconSearch, IconUpload } from "@tabler/icons-react";
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

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <Stack gap={2}>
          <Text size="xs" tt="uppercase" fw={600} c="gray.6" lts={4}>
            Products
          </Text>
          <Title order={2}>Catalog</Title>
        </Stack>
        <a href="/inventory" className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs">
          <IconUpload className="mr-1 inline h-3 w-3" /> Import CSV
        </a>
      </Group>

      <div className="mb-2 flex items-center gap-2">
        <div className="relative flex-1">
          <IconSearch className="pointer-events-none absolute top-2.5 left-2 h-4 w-4 text-neutral-500" />
          <input
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pr-3 pl-8 text-sm"
            placeholder="Search by name or SKU"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Paper withBorder radius="xl" bg="white">
            <div className="grid grid-cols-8 gap-2 border-b border-gray-200 bg-gray-50 p-2 text-xs tracking-widest text-neutral-500 uppercase">
              <div className="col-span-2">Product</div>
              <div>SKU</div>
              <div className="text-right">COGS</div>
              <div className="text-right">Price</div>
              <div className="text-right">Stock</div>
              <div>Location</div>
              <div className="text-right">Actions</div>
            </div>
            <div className="divide-y divide-gray-100">
              {filtered.map((p: any) => {
                const e = edits[p._id] || {};
                const v = {
                  name: (e.name as string) ?? p.name ?? "",
                  costOfGoods: (e.costOfGoods as any) ?? p.costOfGoods ?? 0,
                  sellPrice: (e.sellPrice as any) ?? p.sellPrice ?? 0,
                  warehouseLocation: (e.warehouseLocation as string) ?? p.warehouseLocation ?? "",
                };
                return (
                  <div key={p._id} className="grid grid-cols-8 items-center gap-2 p-2 text-sm">
                    <input
                      className="col-span-2 rounded border border-gray-200 bg-white p-1"
                      value={v.name}
                      onChange={(ev) => setEdits((s) => ({ ...s, [p._id]: { ...s[p._id], name: ev.target.value } }))}
                    />
                    <div className="truncate text-neutral-600">{p.sku}</div>
                    <input
                      className="rounded border border-gray-200 bg-white p-1 text-right"
                      value={v.costOfGoods}
                      onChange={(ev) =>
                        setEdits((s) => ({ ...s, [p._id]: { ...s[p._id], costOfGoods: Number(ev.target.value) || 0 } }))
                      }
                    />
                    <input
                      className="rounded border border-gray-200 bg-white p-1 text-right"
                      value={v.sellPrice}
                      onChange={(ev) =>
                        setEdits((s) => ({ ...s, [p._id]: { ...s[p._id], sellPrice: Number(ev.target.value) || 0 } }))
                      }
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button className="rounded border border-gray-300 px-2 text-xs" onClick={() => handleQuickStock(p._id, -1)}>
                        -1
                      </button>
                      <span className="min-w-[2ch] text-right">{p.stockQuantity ?? 0}</span>
                      <button className="rounded border border-gray-300 px-2 text-xs" onClick={() => handleQuickStock(p._id, +1)}>
                        +1
                      </button>
                    </div>
                    <input
                      className="rounded border border-gray-200 bg-white p-1"
                      value={v.warehouseLocation}
                      onChange={(ev) => setEdits((s) => ({ ...s, [p._id]: { ...s[p._id], warehouseLocation: ev.target.value } }))}
                    />
                    <div className="text-right">
                      <button
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                        onClick={() => handleInlineSave(p)}
                      >
                        <IconDeviceFloppy className="h-3 w-3" /> Save
                      </button>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && <div className="p-4 text-sm text-neutral-500">No products found.</div>}
            </div>
          </Paper>
        </div>

        <Paper withBorder radius="xl" bg="white" className="p-4">
          <h3 className="mb-3 text-sm font-semibold tracking-widest text-neutral-600 uppercase">Create Product</h3>
          <form className="space-y-2" onSubmit={handleCreate}>
            <input
              className="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm"
              placeholder="SKU"
              value={draft.sku}
              onChange={(e) => setDraft((s) => ({ ...s, sku: e.target.value }))}
            />
            <input
              className="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm"
              placeholder="Name"
              value={draft.name}
              onChange={(e) => setDraft((s) => ({ ...s, name: e.target.value }))}
            />
            <input
              className="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm"
              placeholder="Description"
              value={draft.description}
              onChange={(e) => setDraft((s) => ({ ...s, description: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="rounded-lg border border-gray-300 bg-white p-2 text-sm"
                placeholder="COGS"
                type="number"
                value={draft.costOfGoods}
                onChange={(e) => setDraft((s) => ({ ...s, costOfGoods: Number(e.target.value) || 0 }))}
              />
              <input
                className="rounded-lg border border-gray-300 bg-white p-2 text-sm"
                placeholder="Sell Price"
                type="number"
                value={draft.sellPrice}
                onChange={(e) => setDraft((s) => ({ ...s, sellPrice: Number(e.target.value) || 0 }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                className="rounded-lg border border-gray-300 bg-white p-2 text-sm"
                placeholder="Stock"
                type="number"
                value={draft.stockQuantity}
                onChange={(e) => setDraft((s) => ({ ...s, stockQuantity: Number(e.target.value) || 0 }))}
              />
              <input
                className="rounded-lg border border-gray-300 bg-white p-2 text-sm"
                placeholder="Location"
                value={draft.warehouseLocation}
                onChange={(e) => setDraft((s) => ({ ...s, warehouseLocation: e.target.value }))}
              />
            </div>
            <input
              className="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm"
              placeholder="SOP Packing"
              value={draft.sop_packing}
              onChange={(e) => setDraft((s) => ({ ...s, sop_packing: e.target.value }))}
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                className="rounded-lg border border-gray-300 bg-white p-2 text-sm"
                placeholder="Weight (g)"
                type="number"
                value={draft.weight || 0}
                onChange={(e) => setDraft((s) => ({ ...s, weight: Number(e.target.value) || undefined }))}
              />
              <input
                className="rounded-lg border border-gray-300 bg-white p-2 text-sm"
                placeholder="L"
                type="number"
                value={draft.length || 0}
                onChange={(e) => setDraft((s) => ({ ...s, length: Number(e.target.value) || undefined }))}
              />
              <input
                className="rounded-lg border border-gray-300 bg-white p-2 text-sm"
                placeholder="W"
                type="number"
                value={draft.width || 0}
                onChange={(e) => setDraft((s) => ({ ...s, width: Number(e.target.value) || undefined }))}
              />
              <input
                className="rounded-lg border border-gray-300 bg-white p-2 text-sm"
                placeholder="H"
                type="number"
                value={draft.height || 0}
                onChange={(e) => setDraft((s) => ({ ...s, height: Number(e.target.value) || undefined }))}
              />
            </div>
            <button
              disabled={creating}
              className="w-full rounded-lg border border-gray-400 px-4 py-2 text-sm disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </form>
        </Paper>
      </section>
    </Stack>
  );
}
