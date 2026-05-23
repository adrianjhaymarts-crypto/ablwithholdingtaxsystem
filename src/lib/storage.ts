// Storage abstraction layer — currently localStorage based JSON store.
// Designed for easy migration to Supabase later: swap implementation of
// `Collection` methods to call supabase.from(name).select/insert/update/delete.

export type WithId = { id: string };

const PREFIX = "jhaymarts:";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export function uid() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}

export class Collection<T extends WithId> {
  constructor(public name: string) {}
  list(): T[] {
    return read<T[]>(this.name, []);
  }
  get(id: string): T | undefined {
    return this.list().find((r) => r.id === id);
  }
  saveAll(rows: T[]) {
    write(this.name, rows);
  }
  insert(row: Omit<T, "id"> & { id?: string }): T {
    const all = this.list();
    const created = { ...(row as any), id: row.id ?? uid() } as T;
    all.push(created);
    this.saveAll(all);
    return created;
  }
  insertMany(rows: Array<Omit<T, "id"> & { id?: string }>): T[] {
    const all = this.list();
    const created = rows.map((r) => ({ ...(r as any), id: (r as any).id ?? uid() } as T));
    all.push(...created);
    this.saveAll(all);
    return created;
  }
  update(id: string, patch: Partial<T>): T | undefined {
    const all = this.list();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return undefined;
    all[idx] = { ...all[idx], ...patch, id } as T;
    this.saveAll(all);
    return all[idx];
  }
  remove(id: string): boolean {
    const all = this.list();
    const next = all.filter((r) => r.id !== id);
    if (next.length === all.length) return false;
    this.saveAll(next);
    return true;
  }
  clear() {
    this.saveAll([]);
  }
}

export const COLLECTIONS = [
  "suppliers",
  "itw_top10k",
  "itw_expanded",
  "quarterly_reports",
  "company_settings",
  "system_backups",
  "activity_logs",
] as const;

export type CollectionName = (typeof COLLECTIONS)[number];

export function dumpAll(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of COLLECTIONS) out[c] = read(c, []);
  out.__version = 1;
  out.__exportedAt = new Date().toISOString();
  return out;
}

export function restoreAll(data: Record<string, unknown>) {
  if (!data || typeof data !== "object") throw new Error("Invalid backup file");
  for (const c of COLLECTIONS) {
    if (c in data) write(c, (data as any)[c]);
  }
}

export function cleanupEmpty() {
  let removed = 0;
  for (const c of COLLECTIONS) {
    const rows = read<any[]>(c, []);
    if (Array.isArray(rows)) {
      const filtered = rows.filter(
        (r) => r && typeof r === "object" && Object.keys(r).length > 1
      );
      removed += rows.length - filtered.length;
      write(c, filtered);
    }
  }
  return removed;
}