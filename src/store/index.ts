import { create } from "zustand";
import { Collection, uid } from "@/lib/storage";
import type {
  Supplier,
  ITWRecord,
  CompanySettings,
  ActivityLog,
} from "@/lib/types";

const suppliersCol = new Collection<Supplier>("suppliers");
const top10kCol = new Collection<ITWRecord>("itw_top10k");
const expandedCol = new Collection<ITWRecord>("itw_expanded");
const settingsCol = new Collection<CompanySettings>("company_settings");
const logsCol = new Collection<ActivityLog>("activity_logs");

function nowIso() {
  return new Date().toISOString();
}

export function logActivity(
  module: string,
  message: string,
  type: ActivityLog["type"] = "info"
) {
  logsCol.insert({
    message,
    module,
    type,
    createdAt: nowIso(),
  } as any);
  useAppStore.getState().refreshLogs();
}

interface AppState {
  suppliers: Supplier[];
  top10k: ITWRecord[];
  expanded: ITWRecord[];
  settings: CompanySettings;
  logs: ActivityLog[];
  // suppliers
  refreshSuppliers: () => void;
  addSupplier: (s: Omit<Supplier, "id" | "createdAt" | "updatedAt">) => Supplier;
  updateSupplier: (id: string, patch: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;
  bulkUpsertSuppliers: (rows: Omit<Supplier, "id" | "createdAt" | "updatedAt">[]) => { added: number; skipped: number };
  // ITW
  refreshTop10k: () => void;
  refreshExpanded: () => void;
  addTop10k: (r: Omit<ITWRecord, "id" | "createdAt">) => void;
  addExpanded: (r: Omit<ITWRecord, "id" | "createdAt">) => void;
  bulkAddTop10k: (rows: Omit<ITWRecord, "id" | "createdAt">[]) => void;
  bulkAddExpanded: (rows: Omit<ITWRecord, "id" | "createdAt">[]) => void;
  updateTop10k: (id: string, patch: Partial<ITWRecord>) => void;
  updateExpanded: (id: string, patch: Partial<ITWRecord>) => void;
  deleteTop10k: (id: string) => void;
  deleteExpanded: (id: string) => void;
  clearTop10k: () => void;
  clearExpanded: () => void;
  // settings
  refreshSettings: () => void;
  saveSettings: (s: Partial<CompanySettings>) => void;
  // logs
  refreshLogs: () => void;
  clearLogs: () => void;
}

const DEFAULT_SETTINGS: CompanySettings = {
  id: "default",
  companyName: "Jhaymarts Industries Incorporated",
  tinNumber: "",
  companyAddress: "",
  preparedBy: "",
  approvedBy: "",
  logoDataUrl: "",
};

function loadSettings(): CompanySettings {
  const all = settingsCol.list();
  if (all.length === 0) {
    settingsCol.insert(DEFAULT_SETTINGS as any);
    return DEFAULT_SETTINGS;
  }
  return all[0];
}

export const useAppStore = create<AppState>((set, get) => ({
  suppliers: suppliersCol.list(),
  top10k: top10kCol.list(),
  expanded: expandedCol.list(),
  settings: loadSettings(),
  logs: logsCol.list(),

  refreshSuppliers: () => set({ suppliers: suppliersCol.list() }),
  addSupplier: (s) => {
    const created = suppliersCol.insert({
      ...s,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    } as any);
    get().refreshSuppliers();
    logActivity("Suppliers", `Added supplier: ${s.supplierName}`, "success");
    return created;
  },
  updateSupplier: (id, patch) => {
    suppliersCol.update(id, { ...patch, updatedAt: nowIso() } as any);
    get().refreshSuppliers();
    logActivity("Suppliers", `Updated supplier`, "info");
  },
  deleteSupplier: (id) => {
    suppliersCol.remove(id);
    get().refreshSuppliers();
    logActivity("Suppliers", `Deleted supplier`, "warning");
  },
  bulkUpsertSuppliers: (rows) => {
    const existing = suppliersCol.list();
    const byTinName = new Map(
      existing.map((e) => [`${e.tinNumber}::${e.supplierName.toLowerCase()}`, e])
    );
    let added = 0;
    let skipped = 0;
    const created: Supplier[] = [];
    for (const r of rows) {
      const key = `${r.tinNumber}::${r.supplierName.toLowerCase()}`;
      if (byTinName.has(key)) {
        skipped++;
        continue;
      }
      created.push({
        ...r,
        id: uid(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      } as Supplier);
      added++;
    }
    if (created.length) {
      suppliersCol.saveAll([...existing, ...created]);
    }
    get().refreshSuppliers();
    logActivity(
      "Suppliers",
      `Imported ${added} suppliers (${skipped} duplicates skipped)`,
      "success"
    );
    return { added, skipped };
  },

  refreshTop10k: () => set({ top10k: top10kCol.list() }),
  refreshExpanded: () => set({ expanded: expandedCol.list() }),
  addTop10k: (r) => {
    top10kCol.insert({ ...r, createdAt: nowIso() } as any);
    get().refreshTop10k();
  },
  addExpanded: (r) => {
    expandedCol.insert({ ...r, createdAt: nowIso() } as any);
    get().refreshExpanded();
  },
  bulkAddTop10k: (rows) => {
    const stamped = rows.map((r) => ({ ...r, createdAt: nowIso() }));
    top10kCol.insertMany(stamped as any);
    get().refreshTop10k();
    logActivity("ITW Top 10K", `Imported ${rows.length} records`, "success");
  },
  bulkAddExpanded: (rows) => {
    const stamped = rows.map((r) => ({ ...r, createdAt: nowIso() }));
    expandedCol.insertMany(stamped as any);
    get().refreshExpanded();
    logActivity("ITW Expanded", `Imported ${rows.length} records`, "success");
  },
  updateTop10k: (id, patch) => {
    top10kCol.update(id, patch);
    get().refreshTop10k();
  },
  updateExpanded: (id, patch) => {
    expandedCol.update(id, patch);
    get().refreshExpanded();
  },
  deleteTop10k: (id) => {
    top10kCol.remove(id);
    get().refreshTop10k();
  },
  deleteExpanded: (id) => {
    expandedCol.remove(id);
    get().refreshExpanded();
  },
  clearTop10k: () => {
    top10kCol.clear();
    get().refreshTop10k();
  },
  clearExpanded: () => {
    expandedCol.clear();
    get().refreshExpanded();
  },

  refreshSettings: () => set({ settings: loadSettings() }),
  saveSettings: (s) => {
    const current = loadSettings();
    const merged = { ...current, ...s };
    settingsCol.saveAll([merged]);
    set({ settings: merged });
    logActivity("Settings", "Company settings updated", "success");
  },

  refreshLogs: () => set({ logs: logsCol.list().slice(-200) }),
  clearLogs: () => {
    logsCol.clear();
    set({ logs: [] });
  },
}));