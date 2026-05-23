import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/store";
import { GlassCard, PageHeader } from "@/components/AppLayout";
import { Dropzone } from "@/components/Dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { parseSuppliersFromFile, exportToExcel } from "@/lib/excel";
import type { Supplier } from "@/lib/types";
import { formatPercent } from "@/lib/pdf";

export const Route = createFileRoute("/suppliers")({
  component: SuppliersPage,
  head: () => ({ meta: [{ title: "Supplier Masterlist — Jhaymarts" }] }),
});

const schema = z.object({
  supplierName: z.string().trim().min(1, "Supplier name required").max(200),
  tinNumber: z.string().trim().min(1, "TIN required").max(50),
  billingAddress: z.string().max(500).optional().default(""),
  phoneNumber: z.string().max(100).optional().default(""),
  vatType: z.enum(["VAT", "NON-VAT", ""]).default(""),
  atcA: z.string().max(50).optional().default(""),
  taxRateA: z.coerce.number().min(0).max(1).default(0),
  atcB: z.string().max(50).optional().default(""),
  taxRateB: z.coerce.number().min(0).max(1).default(0),
  expandedWithholdingType: z.string().max(300).optional().default(""),
});

type FormData = z.infer<typeof schema>;

function SuppliersPage() {
  const { suppliers, addSupplier, updateSupplier, deleteSupplier, bulkUpsertSuppliers } = useAppStore();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [open, setOpen] = useState(false);
  const pageSize = 10;

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      supplierName: "",
      tinNumber: "",
      billingAddress: "",
      phoneNumber: "",
      vatType: "",
      atcA: "",
      taxRateA: 0,
      atcB: "",
      taxRateB: 0,
      expandedWithholdingType: "",
    },
  });

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.supplierName.toLowerCase().includes(q) ||
        s.tinNumber.toLowerCase().includes(q) ||
        s.billingAddress.toLowerCase().includes(q)
    );
  }, [suppliers, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  function openCreate() {
    setEditing(null);
    form.reset();
    setOpen(true);
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    form.reset(s as any);
    setOpen(true);
  }

  function onSubmit(values: FormData) {
    const dup = suppliers.find(
      (s) =>
        s.id !== editing?.id &&
        s.supplierName.toLowerCase() === values.supplierName.toLowerCase()
    );
    if (dup) {
      toast.error("Supplier name already exists");
      return;
    }
    if (editing) {
      updateSupplier(editing.id, values as any);
      toast.success("Supplier updated");
    } else {
      addSupplier(values as any);
      toast.success("Supplier added");
    }
    setOpen(false);
  }

  async function handleUpload(files: File[]) {
    try {
      const all = [];
      for (const f of files) {
        const rows = await parseSuppliersFromFile(f);
        all.push(...rows);
      }
      if (all.length === 0) {
        toast.error("No rows detected in file");
        return;
      }
      const res = bulkUpsertSuppliers(all);
      toast.success(`Imported ${res.added} suppliers (${res.skipped} duplicates skipped)`);
    } catch (e: any) {
      toast.error("Failed to import: " + (e?.message ?? e));
    }
  }

  async function handleExport() {
    if (suppliers.length === 0) {
      toast.error("No suppliers to export");
      return;
    }
    await exportToExcel(
      suppliers.map((s) => ({
        Supplier: s.supplierName,
        "Billing address": s.billingAddress,
        "Phone numbers": s.phoneNumber,
        "TIN NUMBER": s.tinNumber,
        "VAT OR NON VAT": s.vatType,
        "ATC (A)": s.atcA,
        "TAX RATE (A)": s.taxRateA,
        "ATC (B)": s.atcB,
        "TAX RATE (B)": s.taxRateB,
        "Income Payments subject to Expanded Withholding Tax": s.expandedWithholdingType,
      })),
      `suppliers-${new Date().toISOString().slice(0, 10)}.xlsx`,
      "Suppliers"
    );
    toast.success("Exported supplier masterlist");
  }

  return (
    <div>
      <PageHeader
        title="Supplier Masterlist"
        description="Manage your suppliers, tax rates, and ATC mappings."
        actions={
          <>
            <Button variant="outline" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" /> Export Excel
            </Button>
            <Button onClick={openCreate} className="gradient-primary text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" /> Add Supplier
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <Dropzone onFiles={handleUpload} hint="Upload Supplier Masterlist (.xlsx)" />
        </div>
        <GlassCard>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Upload className="w-4 h-4" />
            <span>Required columns</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Supplier · Billing address · Phone numbers · TIN NUMBER · VAT OR NON VAT · ATC (A) · TAX
            RATE (A) · ATC (B) · TAX RATE (B) · Income Payments subject to Expanded Withholding Tax
          </p>
        </GlassCard>
      </div>

      <GlassCard className="p-0 overflow-hidden">
        <div className="p-4 flex items-center gap-3 border-b border-border/40">
          <Input
            placeholder="Search by name, TIN, address..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            className="max-w-sm"
          />
          <span className="text-xs text-muted-foreground ml-auto">
            {filtered.length} record{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-accent/30 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left p-3">Supplier</th>
                <th className="text-left p-3">TIN</th>
                <th className="text-left p-3">VAT</th>
                <th className="text-left p-3">ATC A</th>
                <th className="text-right p-3">Rate A</th>
                <th className="text-left p-3">ATC B</th>
                <th className="text-right p-3">Rate B</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    No suppliers found
                  </td>
                </tr>
              )}
              {visible.map((s) => (
                <tr key={s.id} className="border-t border-border/30 hover:bg-accent/10">
                  <td className="p-3">
                    <div className="font-medium">{s.supplierName}</div>
                    <div className="text-xs text-muted-foreground">{s.billingAddress}</div>
                  </td>
                  <td className="p-3 font-mono text-xs">{s.tinNumber}</td>
                  <td className="p-3">{s.vatType || "—"}</td>
                  <td className="p-3">{s.atcA || "—"}</td>
                  <td className="p-3 text-right">{formatPercent(s.taxRateA)}</td>
                  <td className="p-3">{s.atcB || "—"}</td>
                  <td className="p-3 text-right">{formatPercent(s.taxRateB)}</td>
                  <td className="p-3 text-right">
                    <div className="inline-flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(s)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Delete supplier "${s.supplierName}"?`)) {
                            deleteSupplier(s.id);
                            toast.success("Supplier deleted");
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-3 flex items-center justify-between border-t border-border/40 text-xs">
          <span className="text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      </GlassCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>Supplier Name *</Label>
              <Input {...form.register("supplierName")} />
              {form.formState.errors.supplierName && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.supplierName.message}
                </p>
              )}
            </div>
            <div>
              <Label>TIN Number *</Label>
              <Input {...form.register("tinNumber")} />
              {form.formState.errors.tinNumber && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.tinNumber.message}
                </p>
              )}
            </div>
            <div>
              <Label>VAT Type</Label>
              <select
                {...form.register("vatType")}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">—</option>
                <option value="VAT">VAT</option>
                <option value="NON-VAT">NON-VAT</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <Label>Billing Address</Label>
              <Input {...form.register("billingAddress")} />
            </div>
            <div>
              <Label>Phone Numbers</Label>
              <Input {...form.register("phoneNumber")} />
            </div>
            <div />
            <div>
              <Label>ATC (A)</Label>
              <Input {...form.register("atcA")} />
            </div>
            <div>
              <Label>Tax Rate A (e.g. 0.01 for 1%)</Label>
              <Input type="number" step="0.0001" {...form.register("taxRateA")} />
            </div>
            <div>
              <Label>ATC (B)</Label>
              <Input {...form.register("atcB")} />
            </div>
            <div>
              <Label>Tax Rate B</Label>
              <Input type="number" step="0.0001" {...form.register("taxRateB")} />
            </div>
            <div className="md:col-span-2">
              <Label>Income Payments subject to Expanded Withholding Tax</Label>
              <Input {...form.register("expandedWithholdingType")} />
            </div>
            <DialogFooter className="md:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="gradient-primary text-primary-foreground">
                {editing ? "Update Supplier" : "Save Supplier"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}