// CSV building for report downloads.

export type CsvColumn<T> = { header: string; value: (row: T) => string | number | null | undefined };

// Cells starting with these are treated as formulas by spreadsheet apps.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Escape one cell: neutralize formula injection, then quote if needed (RFC 4180). */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  let s = value;
  if (FORMULA_PREFIX.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => csvCell(c.value(row))).join(","));
  // BOM so Excel opens UTF-8 (e.g. Urdu names) correctly.
  return `﻿${lines.join("\r\n")}\r\n`;
}
