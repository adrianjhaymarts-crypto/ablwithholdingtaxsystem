import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import type { Supplier, ITWRecord } from "./types";

// --- Helpers ---
function norm(s: any): string {
  return String(s ?? "").trim();
}

function parsePercent(v: any): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") {
    // 0.02 stays 0.02, 2 becomes 0.02 if > 1
    return v > 1 ? v / 100 : v;
  }
  const s = String(v).replace("%", "").trim();
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return n > 1 ? n / 100 : n;
}

function parseNumber(v: any): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v).replace(/[,₱$\s]/g, ""));
  return isNaN(n) ? 0 : n;
}

// Find header row index by scanning first ~10 rows for known header keywords
function findHeaderRow(rows: any[][], keywords: string[]): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i].map((c) => norm(c).toLowerCase());
    const matches = keywords.filter((kw) =>
      row.some((c) => c.includes(kw.toLowerCase()))
    ).length;
    if (matches >= 2) return i;
  }
  return 0;
}

// --- Supplier Import ---
export async function parseSuppliersFromFile(
  file: File
): Promise<Omit<Supplier, "id" | "createdAt" | "updatedAt">[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (rows.length === 0) return [];

  const headerIdx = findHeaderRow(rows, ["supplier", "tin", "vat"]);
  const headers = rows[headerIdx].map((h: any) => norm(h).toLowerCase());
  const idx = (...names: string[]) => {
    for (const n of names) {
      const i = headers.findIndex((h) => h.includes(n.toLowerCase()));
      if (i !== -1) return i;
    }
    return -1;
  };

  const cSupplier = idx("supplier");
  const cAddr = idx("billing address", "address");
  const cPhone = idx("phone");
  const cTin = idx("tin");
  const cVat = idx("vat or non", "vat");
  const cAtcA = idx("atc (a)", "atc a", "atc(a)");
  const cRateA = idx("tax rate (a)", "tax rate a", "rate (a)");
  const cAtcB = idx("atc (b)", "atc b", "atc(b)");
  const cRateB = idx("tax rate (b)", "tax rate b", "rate (b)");
  const cExp = idx("expanded withholding", "income payments");

  const out: Omit<Supplier, "id" | "createdAt" | "updatedAt">[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const supplierName = norm(r[cSupplier]);
    const tinNumber = norm(r[cTin]);
    if (!supplierName && !tinNumber) continue;
    out.push({
      supplierName,
      billingAddress: norm(r[cAddr]),
      phoneNumber: norm(r[cPhone]),
      tinNumber,
      vatType: (norm(r[cVat]).toUpperCase().includes("NON") ? "NON-VAT" : norm(r[cVat]).toUpperCase().includes("VAT") ? "VAT" : ""),
      atcA: norm(r[cAtcA]),
      taxRateA: parsePercent(r[cRateA]),
      atcB: norm(r[cAtcB]),
      taxRateB: parsePercent(r[cRateB]),
      expandedWithholdingType: norm(r[cExp]),
    });
  }
  return out;
}

// --- ITW Import (TOP 10K / EXPANDED) ---
export interface ParsedITWRow {
  vendorName: string;
  tinNumber: string;
  amount: number; // Column F = Income Payment (gross)
  transactionDate: string;
  memo: string;
  memoRate: number; // tax rate parsed from memo (e.g. "2%") if present
}

const EXCLUDED_VENDORS = new Set(
  ["fao - bureau of internal revenue"].map((s) => s.toLowerCase())
);

function normVendor(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "").replace(/[.,]/g, "");
}

function parseDateAny(v: any): { iso: string; month: number; year: number } | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    return {
      iso: v.toISOString().slice(0, 10),
      month: v.getMonth() + 1,
      year: v.getFullYear(),
    };
  }
  const s = String(v).trim();
  // MM/DD/YYYY or M/D/YYYY
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    let [, mo, da, yr] = m;
    let year = parseInt(yr);
    if (year < 100) year += 2000;
    const month = parseInt(mo);
    const day = parseInt(da);
    const d = new Date(year, month - 1, day);
    if (isNaN(d.getTime())) return null;
    return { iso: d.toISOString().slice(0, 10), month, year };
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return {
      iso: d.toISOString().slice(0, 10),
      month: d.getMonth() + 1,
      year: d.getFullYear(),
    };
  }
  return null;
}

function parseMemoRate(memo: string): number {
  if (!memo) return 0;
  const m = String(memo).match(/(\d+(?:\.\d+)?)\s*%/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  return isNaN(n) ? 0 : n / 100;
}

export function quarterOf(month: number): 1 | 2 | 3 | 4 {
  return (Math.floor((month - 1) / 3) + 1) as 1 | 2 | 3 | 4;
}

export async function parseITWFromFile(file: File): Promise<ParsedITWRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (rows.length === 0) return [];

  // Positional mapping per spec:
  //   Column A (0) = Date
  //   Column D (3) = Vendor Name
  //   Column E (4) = Memo/Description (often contains "2%" etc.)
  //   Column F (5) = Amount (Income Payment, gross)
  // First row is the header — skip it.
  const headerRow = rows[0].map((c) => norm(c).toLowerCase());
  const startIdx = headerRow.some((c) => c.includes("date") || c.includes("vendor") || c.includes("name") || c.includes("amount")) ? 1 : 0;

  const out: ParsedITWRow[] = [];
  for (let i = startIdx; i < rows.length; i++) {
    const r = rows[i] || [];
    const rawVendor = norm(r[3]);
    const amount = parseNumber(r[5]);
    const date = parseDateAny(r[0]);
    // Validations: skip empty rows, NaN, missing vendor, excluded vendors
    if (!rawVendor) continue;
    if (EXCLUDED_VENDORS.has(rawVendor.toLowerCase())) continue;
    if (!amount || isNaN(amount)) continue;
    if (!date) continue;
    const memo = norm(r[4]);
    out.push({
      vendorName: rawVendor,
      tinNumber: "",
      amount,
      transactionDate: date.iso,
      memo,
      memoRate: parseMemoRate(memo),
    });
  }
  return out;
}

// --- Match supplier and compute ITW records ---
export function buildITWRecords(
  parsed: ParsedITWRow[],
  suppliers: Supplier[],
  sourceFile: string
): Omit<ITWRecord, "id" | "createdAt">[] {
  const byName = new Map<string, Supplier>();
  for (const s of suppliers) {
    if (s.supplierName) byName.set(normVendor(s.supplierName), s);
  }

  return parsed.map((p) => {
    const key = normVendor(p.vendorName);
    const matched = byName.get(key) || null;
    // Pick best ATC/Rate: prefer A, fallback to B; fallback to memo rate
    const supRate = matched ? (matched.taxRateA || matched.taxRateB || 0) : 0;
    const supAtc = matched ? (matched.atcA || matched.atcB || "") : "";
    const rate = supRate || p.memoRate || 0;
    const atc = supAtc;
    const incomePayment = p.amount;
    const taxWithheld = +(incomePayment * rate).toFixed(2);
    const d = new Date(p.transactionDate);
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    return {
      vendorName: matched?.supplierName ?? p.vendorName,
      tinNumber: matched?.tinNumber ?? "",
      atc,
      taxRate: rate,
      amountTaxWithheld: taxWithheld,
      amountIncomePayment: incomePayment,
      grandTotal: +(incomePayment + taxWithheld).toFixed(2),
      transactionDate: p.transactionDate,
      month,
      year,
      quarter: quarterOf(month),
      memo: p.memo,
      sourceFile,
      matchedSupplier: matched?.supplierName ?? null,
    };
  });
}

// --- Excel export helpers ---
export async function exportToExcel<T extends Record<string, any>>(
  rows: T[],
  filename: string,
  sheetName = "Sheet1"
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  if (rows.length === 0) {
    ws.addRow(["No data"]);
  } else {
    const headers = Object.keys(rows[0]);
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF10B981" },
    };
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    for (const r of rows) ws.addRow(headers.map((h) => r[h]));
    ws.columns.forEach((col) => {
      let max = 10;
      col.eachCell?.((c) => {
        const v = c.value ? String(c.value) : "";
        if (v.length > max) max = v.length;
      });
      col.width = Math.min(max + 2, 40);
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buf]), filename);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToCSV<T extends Record<string, any>>(rows: T[], filename: string) {
  if (rows.length === 0) {
    downloadBlob(new Blob(["No data"], { type: "text/csv" }), filename);
    return;
  }
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
}