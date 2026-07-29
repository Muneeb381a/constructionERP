function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Client-side CSV export — opens directly in Excel. No server round-trip and no new
 * dependency; good enough for "give me this list" requests that don't need a real .xlsx. */
export function exportToCsv<T>(filename: string, rows: T[], columns: { header: string; value: (row: T) => unknown }[]) {
  const lines = [
    columns.map((c) => csvCell(c.header)).join(","),
    ...rows.map((row) => columns.map((c) => csvCell(c.value(row))).join(",")),
  ];
  // BOM so Excel renders UTF-8 (Urdu names, currency symbols) correctly instead of mangling it
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
