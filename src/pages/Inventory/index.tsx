import { useMemo, useState } from "react";

import { Alert, Badge, Button, Card, Group, Paper, Stack, Text, Textarea, ThemeIcon, Title } from "@mantine/core";
import { IconAlertCircle, IconCheck, IconFileImport, IconPackage, IconTableImport, IconUpload, IconX } from "@tabler/icons-react";
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
    <Stack gap="xl">
      <Paper p="lg" radius="lg" bg="white" style={{ border: "1px solid var(--mantine-color-gray-2)" }}>
        <Group gap="md">
          <ThemeIcon size={48} radius="lg" variant="light" color="orange">
            <IconPackage size={28} />
          </ThemeIcon>
          <Stack gap={4} style={{ flex: 1 }}>
            <Title order={2} fw={700}>
              Inventory Management
            </Title>
            <Text size="sm" c="dimmed">
              Import your product catalog via CSV
            </Text>
          </Stack>
          <Badge variant="light" color="orange" size="lg" radius="lg" leftSection={<IconFileImport size={14} />}>
            CSV Import
          </Badge>
        </Group>
      </Paper>

      <Card withBorder shadow="sm" radius="lg" bg="white" p="xl">
        <Stack gap="lg">
          <Alert variant="light" color="blue" radius="lg" icon={<IconTableImport size={20} />}>
            <Stack gap="xs">
              <Text size="sm" fw={600} c="blue.8">
                Supported CSV Headers
              </Text>
              <Text size="sm" c="blue.7" style={{ fontFamily: "monospace" }}>
                sku, name, description, costOfGoods, sellPrice, stockQuantity, warehouseLocation, sop_packing, weight, length,
                width, height
              </Text>
            </Stack>
          </Alert>

          <Textarea
            label="CSV Data"
            description="Paste your CSV data below. First row should contain headers."
            placeholder="sku,name,description,costOfGoods,sellPrice,stockQuantity&#10;PROD-001,Product Name,Description,10000,25000,100"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            minRows={12}
            radius="lg"
            size="md"
            styles={{
              input: {
                fontFamily: "monospace",
                fontSize: "0.875rem",
              },
              description: { marginBottom: 12 },
            }}
          />

          <Group justify="space-between" align="center">
            <Group gap="md">
              <Button
                disabled={importing || !orgId || rows.length === 0}
                onClick={handleImport}
                loading={importing}
                leftSection={<IconUpload size={16} />}
                radius="lg"
                size="md"
                color="orange"
              >
                {importing ? "Importing..." : "Import Products"}
              </Button>
              {rows.length > 0 && (
                <Badge variant="light" color="gray" size="lg" radius="lg">
                  {rows.length} rows parsed
                </Badge>
              )}
            </Group>
          </Group>

          {result && (
            <Card withBorder radius="lg" bg={result.fail === 0 ? "green.0" : "orange.0"} p="lg">
              <Stack gap="md">
                <Group gap="md">
                  <ThemeIcon size="lg" radius="lg" color={result.fail === 0 ? "green" : "orange"} variant="light">
                    {result.fail === 0 ? <IconCheck size={20} /> : <IconAlertCircle size={20} />}
                  </ThemeIcon>
                  <Stack gap={4}>
                    <Text fw={700} c={result.fail === 0 ? "green.8" : "orange.8"}>
                      Import {result.fail === 0 ? "Successful" : "Completed with Errors"}
                    </Text>
                    <Group gap="md">
                      <Badge variant="light" color="green" radius="lg">
                        {result.ok} Imported
                      </Badge>
                      {result.fail > 0 && (
                        <Badge variant="light" color="red" radius="lg">
                          {result.fail} Failed
                        </Badge>
                      )}
                    </Group>
                  </Stack>
                </Group>

                {result.errors.length > 0 && (
                  <Paper withBorder radius="lg" p="md" bg="white">
                    <Stack gap="xs">
                      <Group gap="xs">
                        <IconX size={16} color="var(--mantine-color-red-6)" />
                        <Text size="sm" fw={600} c="red.8">
                          Error Details
                        </Text>
                      </Group>
                      <Stack gap="xs">
                        {result.errors.slice(0, 10).map((e, i) => (
                          <Text key={i} size="sm" c="red.7" style={{ fontFamily: "monospace" }}>
                            • {e}
                          </Text>
                        ))}
                        {result.errors.length > 10 && (
                          <Text size="sm" c="dimmed" fs="italic">
                            …and {result.errors.length - 10} more errors
                          </Text>
                        )}
                      </Stack>
                    </Stack>
                  </Paper>
                )}
              </Stack>
            </Card>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}

// RFC 4180–compliant CSV parser (comma-delimited, supports quotes, escaped quotes, CRLF, multiline)
function parseCsv(text: string): Row[] {
  if (!text) return [];
  // Remove BOM if present
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        // Escaped quote
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (c === "\r") {
        // Handle CRLF (\r\n)
        if (i + 1 < text.length && text[i + 1] === "\n") {
          i++;
        }
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
  }
  // Push last field/row if any
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Filter out any completely empty rows
  const nonEmptyRows = rows.filter((r) => r.some((v) => v && v.trim() !== ""));
  if (nonEmptyRows.length < 2) return [];

  const headers = nonEmptyRows[0].map((h) => h.trim());
  const result: Row[] = [];
  for (let i = 1; i < nonEmptyRows.length; i++) {
    const cells = nonEmptyRows[i];
    const obj: Row = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j];
      // If row is shorter, missing cells become ""
      obj[key] = (cells[j] ?? "").trim();
    }
    result.push(obj);
  }
  return result;
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
