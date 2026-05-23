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
  amountTaxWithheld: number;
  transactionDate: string;
}

export async function parseITWFromFile(file: File): Promise<ParsedITWRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (rows.length === 0) return [];

  const headerIdx = findHeaderRow(rows, [
    "vendor",
    "tin",
    "tax withheld",
    "withheld",
  ]);
  const headers = rows[headerIdx].map((h: any) => norm(h).toLowerCase());
  const idx = (...names: string[]) => {
    for (const n of names) {
      const i = headers.findIndex((h) => h.includes(n.toLowerCase()));
      if (i !== -1) return i;
    }
    return -1;
  };

  const cVendor = idx("vendor name", "vendor", "supplier", "payee");
  const cTin = idx("tin");
  // Column F (index 5) is fallback for amount withheld
  const cWithheld = idx("tax withheld", "withheld", "amount of tax");
  const cDate = idx("date", "period", "transaction");

  const out: ParsedITWRow[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const vendorName = norm(r[cVendor]);
    const wIdx = cWithheld !== -1 ? cWithheld : 5; // column F
    const amt = parseNumber(r[wIdx]);
    if (!vendorName && !amt) continue;
    let dateStr = "";
    if (cDate !== -1) {
      const d = r[cDate];
      if (d instanceof Date) dateStr = d.toISOString().slice(0, 10);
      else if (d) dateStr = norm(d);
    }
    out.push({
      vendorName,
      tinNumber: norm(r[cTin]),
      amountTaxWithheld: amt,
      transactionDate: dateStr || new Date().toISOString().slice(0, 10),
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
  const byTin = new Map(suppliers.filter((s) => s.tinNumber).map((s) => [s.tinNumber.replace(/\D/g, ""), s]));
  const byName = new Map(
    suppliers.map((s) => [s.supplierName.toLowerCase().trim(), s])
  );

  return parsed.map((p) => {
    const tinKey = p.tinNumber.replace(/\D/g, "");
    const matched =
      (tinKey && byTin.get(tinKey)) ||
      byName.get(p.vendorName.toLowerCase().trim()) ||
      null;
    const rate = matched ? (matched.taxRateA || matched.taxRateB || 0) : 0;
    const incomePayment = rate > 0 ? p.amountTaxWithheld / rate : 0;
    return {
      vendorName: p.vendorName || (matched?.supplierName ?? ""),
      tinNumber: p.tinNumber || (matched?.tinNumber ?? ""),
      taxRate: rate,
      amountTaxWithheld: p.amountTaxWithheld,
      amountIncomePayment: incomePayment,
      grandTotal: incomePayment + p.amountTaxWithheld,
      transactionDate: p.transactionDate,
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