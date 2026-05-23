import { useMemo, useState } from "react";
import { Download, FileText, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/store";
import { GlassCard, PageHeader } from "@/components/AppLayout";
import { Dropzone } from "@/components/Dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  parseITWFromFile,
  buildITWRecords,
  exportToExcel,
  exportToCSV,
} from "@/lib/excel";
import { buildReportPDF, formatCurrency, formatPercent } from "@/lib/pdf";
import type { ITWRecord } from "@/lib/types";

interface Props {
  title: string;
  description: string;
  records: ITWRecord[];
  bulkAdd: (rows: Omit<ITWRecord, "id" | "createdAt">[]) => void;
  update: (id: string, patch: Partial<ITWRecord>) => void;
  remove: (id: string) => void;
  clearAll: () => void;
  module: "Top 10K" | "Expanded";
}

export function ITWModule({
  title,
  description,
  records,
  bulkAdd,
  update,
  remove,
  clearAll,
  module,
}: Props) {
  const suppliers = useAppStore((s) => s.suppliers);
  const settings = useAppStore((s) => s.settings);
  const [query, setQuery] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editVals, setEditVals] = useState<{ taxRate: number; amountTaxWithheld: number }>({
    taxRate: 0,
    amountTaxWithheld: 0,
  });

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return records;
    return records.filter(
      (r) =>
        r.vendorName.toLowerCase().includes(q) ||
        r.tinNumber.toLowerCase().includes(q) ||
        (r.matchedSupplier?.toLowerCase().includes(q) ?? false)
    );
  }, [records, query]);

  const totals = useMemo(() => {
    const tw = filtered.reduce((s, r) => s + (r.amountTaxWithheld || 0), 0);
    const ip = filtered.reduce((s, r) => s + (r.amountIncomePayment || 0), 0);
    const matched = filtered.filter((r) => r.matchedSupplier).length;
    return { tw, ip, matched, total: filtered.length };
  }, [filtered]);

  async function handleUpload(files: File[]) {
    try {
      const all: Omit<ITWRecord, "id" | "createdAt">[] = [];
      for (const f of files) {
        const parsed = await parseITWFromFile(f);
        const built = buildITWRecords(parsed, suppliers, f.name);
        all.push(...built);
      }
      if (all.length === 0) {
        toast.error("No rows detected");
        return;
      }
      bulkAdd(all);
      const unmatched = all.filter((r) => !r.matchedSupplier).length;
      toast.success(
        `Imported ${all.length} records${unmatched ? ` (${unmatched} unmatched)` : ""}`
      );
    } catch (e: any) {
      toast.error("Import failed: " + (e?.message ?? e));
    }
  }

  async function handleExportExcel() {
    if (records.length === 0) return toast.error("No data");
    await exportToExcel(
      records.map((r) => ({
        TIN: r.tinNumber,
        "Vendor Name": r.vendorName,
        "Matched Supplier": r.matchedSupplier ?? "",
        "Tax Rate": r.taxRate,
        "Amount of Tax Withheld": r.amountTaxWithheld,
        "Amount of Income Payment": r.amountIncomePayment,
        "Grand Total": r.grandTotal,
        "Transaction Date": r.transactionDate,
        "Source File": r.sourceFile,
      })),
      `itw-${module.toLowerCase().replace(/\s/g, "-")}-${new Date().toISOString().slice(0, 10)}.xlsx`,
      `ITW ${module}`
    );
    toast.success("Excel exported");
  }

  function handleExportPDF() {
    if (records.length === 0) return toast.error("No data");
    buildReportPDF({
      title: `ITW ${module} Report`,
      subtitle: `Total Records: ${records.length}`,
      settings,
      head: [["TIN", "Vendor", "Rate", "Tax Withheld", "Income Payment", "Date"]],
      body: records.map((r) => [
        r.tinNumber,
        r.vendorName,
        formatPercent(r.taxRate),
        formatCurrency(r.amountTaxWithheld),
        formatCurrency(r.amountIncomePayment),
        r.transactionDate,
      ]),
      filename: `itw-${module.toLowerCase().replace(/\s/g, "-")}.pdf`,
    });
  }

  function startEdit(r: ITWRecord) {
    setEditId(r.id);
    setEditVals({ taxRate: r.taxRate, amountTaxWithheld: r.amountTaxWithheld });
  }

  function saveEdit(r: ITWRecord) {
    const rate = Number(editVals.taxRate) || 0;
    const withheld = Number(editVals.amountTaxWithheld) || 0;
    const income = rate > 0 ? withheld / rate : 0;
    update(r.id, {
      taxRate: rate,
      amountTaxWithheld: withheld,
      amountIncomePayment: income,
      grandTotal: income + withheld,
    });
    setEditId(null);
    toast.success("Row updated");
  }

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            <Button variant="outline" onClick={() => exportToCSV(records as any, `${module}.csv`)}>
              CSV
            </Button>
            <Button variant="outline" onClick={handleExportExcel}>
              <Download className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" onClick={handleExportPDF}>
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (confirm("Clear all records in this module?")) {
                  clearAll();
                  toast.success("Cleared");
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Clear
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
        {[
          { label: "Records", value: String(totals.total) },
          { label: "Matched", value: String(totals.matched) },
          { label: "Total Tax Withheld", value: formatCurrency(totals.tw) },
          { label: "Total Income Payment", value: formatCurrency(totals.ip) },
        ].map((s) => (
          <GlassCard key={s.label} className="p-4">
            <p className="text-xs text-muted-foreground uppercase">{s.label}</p>
            <p className="text-xl font-bold mt-1">{s.value}</p>
          </GlassCard>
        ))}
      </div>

      <div className="mb-4">
        <Dropzone onFiles={handleUpload} hint={`Upload ITW ${module} Excel file`} />
      </div>

      <GlassCard className="p-0 overflow-hidden">
        <div className="p-4 border-b border-border/40 flex items-center gap-3">
          <Input
            placeholder="Search vendor, TIN..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-sm"
          />
          <span className="ml-auto text-xs text-muted-foreground">
            {filtered.length} of {records.length}
          </span>
        </div>
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="bg-accent/30 text-xs uppercase tracking-wide sticky top-0">
              <tr>
                <th className="text-left p-3">Vendor</th>
                <th className="text-left p-3">TIN</th>
                <th className="text-left p-3">Matched</th>
                <th className="text-right p-3">Rate</th>
                <th className="text-right p-3">Tax Withheld</th>
                <th className="text-right p-3">Income Payment</th>
                <th className="text-left p-3">Date</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-muted-foreground">
                    No records. Upload an Excel file to get started.
                  </td>
                </tr>
              )}
              {filtered.map((r) => {
                const editing = editId === r.id;
                return (
                  <tr key={r.id} className="border-t border-border/30 hover:bg-accent/10">
                    <td className="p-3">
                      <div className="font-medium">{r.vendorName || "—"}</div>
                      <div className="text-[11px] text-muted-foreground">{r.sourceFile}</div>
                    </td>
                    <td className="p-3 font-mono text-xs">{r.tinNumber || "—"}</td>
                    <td className="p-3">
                      {r.matchedSupplier ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                          {r.matchedSupplier}
                        </span>
                      ) : (
                        <span className="text-xs text-destructive">Unmatched</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {editing ? (
                        <Input
                          type="number"
                          step="0.0001"
                          value={editVals.taxRate}
                          onChange={(e) =>
                            setEditVals((v) => ({ ...v, taxRate: parseFloat(e.target.value) || 0 }))
                          }
                          className="h-7 w-20 ml-auto"
                        />
                      ) : (
                        formatPercent(r.taxRate)
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {editing ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={editVals.amountTaxWithheld}
                          onChange={(e) =>
                            setEditVals((v) => ({
                              ...v,
                              amountTaxWithheld: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="h-7 w-28 ml-auto"
                        />
                      ) : (
                        formatCurrency(r.amountTaxWithheld)
                      )}
                    </td>
                    <td className="p-3 text-right">{formatCurrency(r.amountIncomePayment)}</td>
                    <td className="p-3 text-xs">{r.transactionDate}</td>
                    <td className="p-3 text-right">
                      <div className="inline-flex gap-1">
                        {editing ? (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => saveEdit(r)}>
                              <Check className="w-4 h-4 text-primary" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setEditId(null)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => startEdit(r)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                if (confirm("Delete this row?")) remove(r.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-accent/20 font-semibold sticky bottom-0">
                <tr>
                  <td className="p-3" colSpan={4}>
                    Totals
                  </td>
                  <td className="p-3 text-right">{formatCurrency(totals.tw)}</td>
                  <td className="p-3 text-right">{formatCurrency(totals.ip)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </GlassCard>
    </div>
  );
}