import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { toast } from "sonner";
import { Download, Upload, Trash2 } from "lucide-react";
import { GlassCard, PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { dumpAll, restoreAll, cleanupEmpty } from "@/lib/storage";
import { downloadBlob } from "@/lib/excel";
import { useAppStore, logActivity } from "@/store";

export const Route = createFileRoute("/backup")({
  component: Page,
  head: () => ({ meta: [{ title: "Backup & Restore — Jhaymarts" }] }),
});

function Page() {
  const { refreshSuppliers, refreshTop10k, refreshExpanded, refreshSettings, refreshLogs, logs, clearLogs } =
    useAppStore();
  const fileRef = useRef<HTMLInputElement>(null);

  function doBackup() {
    const data = dumpAll();
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    downloadBlob(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      `jhaymarts-backup-${ts}.json`
    );
    logActivity("Backup", `Backup file created`, "success");
    toast.success("Backup downloaded");
  }

  function onRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string);
        if (typeof json !== "object" || json === null) throw new Error("Invalid file");
        if (!confirm("This will overwrite current data. Continue?")) return;
        restoreAll(json);
        refreshSuppliers();
        refreshTop10k();
        refreshExpanded();
        refreshSettings();
        refreshLogs();
        toast.success("Backup restored");
        logActivity("Backup", "Backup restored from file", "success");
      } catch (err: any) {
        toast.error("Invalid backup file: " + (err?.message ?? err));
      }
    };
    reader.readAsText(f);
  }

  function cleanup() {
    const removed = cleanupEmpty();
    refreshSuppliers();
    refreshTop10k();
    refreshExpanded();
    toast.success(`Cleaned ${removed} empty record${removed === 1 ? "" : "s"}`);
  }

  return (
    <div>
      <PageHeader
        title="Backup & Restore"
        description="Download or restore your entire local JSON database."
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="space-y-3">
          <Download className="w-8 h-8 text-primary" />
          <h3 className="font-semibold">Create Backup</h3>
          <p className="text-sm text-muted-foreground">
            Exports all suppliers, ITW records, reports and settings as a timestamped JSON file.
          </p>
          <Button onClick={doBackup} className="gradient-primary text-primary-foreground w-full">
            Download Backup
          </Button>
        </GlassCard>

        <GlassCard className="space-y-3">
          <Upload className="w-8 h-8 text-primary" />
          <h3 className="font-semibold">Restore Backup</h3>
          <p className="text-sm text-muted-foreground">
            Restore from a previously downloaded JSON backup. Current data will be replaced.
          </p>
          <input ref={fileRef} type="file" accept=".json" onChange={onRestore} className="hidden" />
          <Button variant="outline" onClick={() => fileRef.current?.click()} className="w-full">
            Choose File
          </Button>
        </GlassCard>

        <GlassCard className="space-y-3">
          <Trash2 className="w-8 h-8 text-destructive" />
          <h3 className="font-semibold">Cleanup</h3>
          <p className="text-sm text-muted-foreground">
            Remove empty or corrupted records from local storage.
          </p>
          <Button variant="outline" onClick={cleanup} className="w-full">
            Cleanup Empty Records
          </Button>
          <Button variant="outline" onClick={clearLogs} className="w-full">
            Clear Activity Logs ({logs.length})
          </Button>
        </GlassCard>
      </div>
    </div>
  );
}