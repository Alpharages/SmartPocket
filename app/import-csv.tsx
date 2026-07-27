import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/ToastProvider";
import {
  CSV_IMPORT_FIELDS,
  autoMapColumns,
  duplicateKey,
  parseCsv,
  validateRow,
  type ColumnMap,
  type CsvImportField,
  type ImportTransaction,
  type InvalidImportRow,
} from "@/lib/csv-import";
import { pickTextFile } from "@/lib/read-text-file";
import { useExpense } from "@/lib/expense-context";
import { useColors } from "@/hooks/use-colors";
import { Spacing } from "@/lib/_core/theme";

const FIELD_LABELS: Record<CsvImportField, string> = {
  date: "Date",
  type: "Type",
  amount: "Amount",
  category: "Category",
  card: "Card",
  description: "Description",
};

type ImportSummary = {
  created: number;
  skipped: number;
  invalid: InvalidImportRow[];
};

// Must stay at or under the server's transactions.createMany row cap (server/routers.ts).
const IMPORT_CHUNK_SIZE = 1000;

const REQUIRED_IMPORT_FIELDS: readonly CsvImportField[] = [
  "date",
  "type",
  "amount",
  "category",
];

function mappedCell(row: string[], map: ColumnMap, field: CsvImportField) {
  const index = map[field];
  return index == null ? "" : (row[index] ?? "");
}

export default function ImportCsvScreen() {
  const router = useRouter();
  const colors = useColors();
  const toast = useToast();
  const { categories, creditCards, transactions, importTransactions } =
    useExpense();
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [map, setMap] = useState<ColumnMap>(() => autoMapColumns([]));
  const [editingField, setEditingField] = useState<CsvImportField | null>(null);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const previewRows = useMemo(() => rows.slice(0, 10), [rows]);
  const missingRequiredFields = useMemo(
    () => REQUIRED_IMPORT_FIELDS.filter((field) => map[field] == null),
    [map],
  );

  const handlePick = useCallback(async () => {
    setSummary(null);
    try {
      const picked = await pickTextFile();
      if (!picked) return;
      if (!picked.name.toLowerCase().endsWith(".csv")) {
        throw new Error("Choose a .csv file");
      }
      const parsed = parseCsv(picked.text);
      if (parsed.rows.length === 0) {
        throw new Error("CSV has no transaction rows");
      }
      setFileName(picked.name);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMap(autoMapColumns(parsed.headers));
    } catch (err) {
      toast.show({
        type: "error",
        message: err instanceof Error ? err.message : "Could not read CSV",
      });
      setFileName("");
      setHeaders([]);
      setRows([]);
      setMap(autoMapColumns([]));
    }
  }, [toast]);

  const handleImport = useCallback(async () => {
    if (importing || rows.length === 0 || missingRequiredFields.length > 0) {
      return;
    }
    setImporting(true);

    const valid: ImportTransaction[] = [];
    const invalid: InvalidImportRow[] = [];
    let skipped = 0;
    const seenKeys = new Set(transactions.map(duplicateKey));

    rows.forEach((row, index) => {
      const result = validateRow(row, map, {
        categories,
        creditCards,
        rowIndex: index + 2,
      });
      if (!result.ok) {
        invalid.push({ rowIndex: result.rowIndex, reason: result.reason });
        return;
      }
      const key = duplicateKey(result.value);
      if (seenKeys.has(key)) {
        skipped++;
        return;
      }
      seenKeys.add(key);
      valid.push(result.value);
    });

    let created = 0;
    try {
      for (let i = 0; i < valid.length; i += IMPORT_CHUNK_SIZE) {
        const chunk = valid.slice(i, i + IMPORT_CHUNK_SIZE);
        await importTransactions(chunk);
        created += chunk.length;
      }
      if (valid.length === 0) {
        toast.show({ type: "error", message: "No valid rows to import" });
      }
    } catch {
      // useExpense().importTransactions already shows the failure toast.
      // `created` still reflects any chunks that committed before the failure.
    } finally {
      setSummary({ created, skipped, invalid });
      setImporting(false);
    }
  }, [
    importing,
    rows,
    map,
    missingRequiredFields,
    categories,
    creditCards,
    transactions,
    importTransactions,
    toast,
  ]);

  return (
    <ScreenContainer className="flex-1 bg-background">
      <ScreenHeader
        title="Import CSV"
        accessibilityLabel="Import CSV screen"
        leading={
          <Button
            variant="icon-only"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            leftIcon={
              <Ionicons
                name="chevron-back"
                size={22}
                color={colors.foreground}
              />
            }
          />
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingBottom: Spacing["2xl"],
          gap: Spacing.lg,
        }}
      >
        <Button
          label={fileName ? "Choose another CSV" : "Choose CSV file"}
          onPress={handlePick}
          accessibilityLabel="Choose CSV file"
        />

        {fileName ? (
          <Text className="text-caption text-muted">{fileName}</Text>
        ) : null}

        {headers.length > 0 ? (
          <View className="gap-md">
            <Text className="text-body font-semibold text-foreground">
              Column mapping
            </Text>
            {CSV_IMPORT_FIELDS.map((field) => (
              <Pressable
                key={field}
                onPress={() => setEditingField(field)}
                accessibilityRole="button"
                accessibilityLabel={`Map ${FIELD_LABELS[field]}`}
                className="flex-row items-center rounded-lg border px-md py-sm"
                style={{
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                }}
              >
                <Text className="flex-1 text-body text-foreground">
                  {FIELD_LABELS[field]}
                </Text>
                <Text className="text-body text-muted">
                  {map[field] == null ? "Not mapped" : headers[map[field]]}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {previewRows.length > 0 ? (
          <View className="gap-md">
            <Text className="text-body font-semibold text-foreground">
              Preview
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View
                className="rounded-lg border"
                style={{ borderColor: colors.border }}
              >
                {[CSV_IMPORT_FIELDS, ...previewRows].map((row, rowIndex) => (
                  <View
                    key={rowIndex}
                    className="flex-row"
                    style={{
                      backgroundColor:
                        rowIndex === 0 ? colors.surface : colors.background,
                    }}
                  >
                    {CSV_IMPORT_FIELDS.map((field) => (
                      <Text
                        key={field}
                        className="px-sm py-xs text-caption text-foreground"
                        style={{ width: 120 }}
                        numberOfLines={2}
                      >
                        {rowIndex === 0
                          ? FIELD_LABELS[field]
                          : mappedCell(row as string[], map, field)}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}

        {rows.length > 0 ? (
          <View className="gap-xs">
            <Button
              label="Import"
              onPress={handleImport}
              loading={importing}
              disabled={importing || missingRequiredFields.length > 0}
              accessibilityLabel="Import transactions"
            />
            {missingRequiredFields.length > 0 ? (
              <Text className="text-caption text-muted">
                Map{" "}
                {missingRequiredFields
                  .map((field) => FIELD_LABELS[field])
                  .join(", ")}{" "}
                before importing.
              </Text>
            ) : null}
          </View>
        ) : null}

        {summary ? (
          <View className="gap-sm">
            <Text className="text-body font-semibold text-foreground">
              Import summary
            </Text>
            <Text className="text-body text-foreground">
              Created: {summary.created} - Skipped duplicates: {summary.skipped}{" "}
              - Invalid: {summary.invalid.length}
            </Text>
            {summary.invalid.slice(0, 20).map((row) => (
              <Text key={row.rowIndex} className="text-caption text-muted">
                Row {row.rowIndex}: {row.reason}
              </Text>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <Sheet
        visible={editingField != null}
        onClose={() => setEditingField(null)}
        title={
          editingField ? `Map ${FIELD_LABELS[editingField]}` : "Map column"
        }
      >
        <View className="px-lg pb-lg">
          <Pressable
            onPress={() => {
              if (editingField) {
                setMap((current) => ({ ...current, [editingField]: null }));
              }
              setEditingField(null);
            }}
            className="py-md"
            accessibilityRole="button"
            accessibilityLabel="Not mapped"
          >
            <Text className="text-body text-foreground">Not mapped</Text>
          </Pressable>
          {headers.map((header, index) => (
            <Pressable
              key={`${header}-${index}`}
              onPress={() => {
                if (editingField) {
                  setMap((current) => {
                    const next = { ...current, [editingField]: index };
                    // A column can only feed one canonical field — clear it from
                    // any other field that previously claimed the same column.
                    for (const field of CSV_IMPORT_FIELDS) {
                      if (field !== editingField && next[field] === index) {
                        next[field] = null;
                      }
                    }
                    return next;
                  });
                }
                setEditingField(null);
              }}
              className="py-md"
              accessibilityRole="button"
              accessibilityLabel={`Map to ${header}`}
            >
              <Text className="text-body text-foreground">{header}</Text>
            </Pressable>
          ))}
        </View>
      </Sheet>
    </ScreenContainer>
  );
}
