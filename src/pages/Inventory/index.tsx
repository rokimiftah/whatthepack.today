import { useMemo, useState } from "react";

import { Paper, Stack, Text, Title } from "@mantine/core";
import { useMutation, useQuery } from "convex/react";

import FullscreenLoader from "@shared/components/FullscreenLoader";

import { api } from "../../../convex/_generated/api";

type Row = Record<string, string>;

export default function InventoryPage() {
  const org = useQuery(api.organizations.getForCurrentUser, {});
  const orgId = org?.organization?._id;
  const createProduct = useMutation(api.inventory.create);

  const [csv, setCsv] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: number; fail: number; errors: string[] } | null>(null);

  const rows = useMemo(() => parseCsv(csv), [csv]);

  const handleImport = async () => {
    if (!orgId || rows.length === 0) return;
    setImporting(true);
    const errors: string[] = [];
    let ok = 0;
    for (const r of rows) {
      try {
        const sku = r.sku?.trim();
        const name = r.name?.trim();
        if (!sku || !name) throw new Error("Missing sku/name");
        await createProduct({
          orgId,
          sku,
          name,
          description: val(r.description),
          costOfGoods: num(r.costOfGoods) ?? 0,
          sellPrice: num(r.sellPrice) ?? 0,
          stockQuantity: num(r.stockQuantity) ?? 0,
          warehouseLocation: r.warehouseLocation?.trim() || "",
          sop_packing: val(r.sop_packing),
          weight: num(r.weight) ?? undefined,
          length: num(r.length) ?? undefined,
          width: num(r.width) ?? undefined,
          height: num(r.height) ?? undefined,
        });
        ok++;
      } catch (e: any) {
        errors.push(`${r.sku || r.name || "row"}: ${e?.message || e}`);
      }
    }
    setResult({ ok, fail: errors.length, errors });
    setImporting(false);
  };

  if (org === undefined) {
    return <FullscreenLoader />;
  }

  return (
    <Stack gap="lg">
      <Stack gap={2}>
        <Text size="xs" tt="uppercase" fw={600} c="gray.6" lts={4}>
          Inventory
        </Text>
        <Title order={2}>Import Catalog (CSV)</Title>
      </Stack>

      <Paper withBorder radius="xl" bg="white" p="lg">
        <div className="mb-3 text-sm text-neutral-600">
          Headers supported:
          sku,name,description,costOfGoods,sellPrice,stockQuantity,warehouseLocation,sop_packing,weight,length,width,height
        </div>
        <textarea
          className="h-64 w-full rounded-lg border border-gray-300 bg-white p-3 text-sm"
          placeholder="Paste CSV here"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            disabled={importing || !orgId || rows.length === 0}
            onClick={handleImport}
            className="rounded-lg border border-gray-400 px-4 py-2 text-sm disabled:opacity-50"
          >
            {importing ? "Importing..." : "Import"}
          </button>
          <span className="text-xs text-neutral-500">Rows parsed: {rows.length}</span>
        </div>

        {result && (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
            <div>
              Imported: {result.ok}, Failed: {result.fail}
            </div>
            {result.errors.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-red-500">
                {result.errors.slice(0, 10).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {result.errors.length > 10 ? <li>…and {result.errors.length - 10} more</li> : null}
              </ul>
            )}
          </div>
        )}
      </Paper>
    </Stack>
  );
}

function parseCsv(text: string): Row[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = safeSplit(lines[i]);
    const row: Row = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
}

function safeSplit(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function num(v?: string): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function val(v?: string): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}
