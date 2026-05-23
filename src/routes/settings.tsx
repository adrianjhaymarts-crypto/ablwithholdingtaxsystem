import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useAppStore } from "@/store";
import { GlassCard, PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/settings")({
  component: Page,
  head: () => ({ meta: [{ title: "Company Settings — Jhaymarts" }] }),
});

function Page() {
  const { settings, saveSettings } = useAppStore();
  const [form, setForm] = useState(settings);

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      toast.error("Logo must be < 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((s) => ({ ...s, logoDataUrl: reader.result as string }));
    };
    reader.readAsDataURL(f);
  }

  function save() {
    if (!form.companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    saveSettings(form);
    toast.success("Settings saved");
  }

  return (
    <div>
      <PageHeader
        title="Company Settings"
        description="Branding and signatories applied to all reports."
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="lg:col-span-2 space-y-4">
          <div>
            <Label>Company Name *</Label>
            <Input
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>TIN Number</Label>
              <Input value={form.tinNumber} onChange={(e) => setForm({ ...form, tinNumber: e.target.value })} />
            </div>
            <div>
              <Label>Prepared By</Label>
              <Input value={form.preparedBy} onChange={(e) => setForm({ ...form, preparedBy: e.target.value })} />
            </div>
            <div>
              <Label>Approved By</Label>
              <Input value={form.approvedBy} onChange={(e) => setForm({ ...form, approvedBy: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Company Address</Label>
            <Textarea
              value={form.companyAddress}
              onChange={(e) => setForm({ ...form, companyAddress: e.target.value })}
              rows={2}
            />
          </div>
          <Button onClick={save} className="gradient-primary text-primary-foreground">
            Save Settings
          </Button>
        </GlassCard>

        <GlassCard className="space-y-3">
          <Label>Company Logo</Label>
          <div className="aspect-square rounded-xl bg-accent/30 grid place-items-center overflow-hidden">
            {form.logoDataUrl ? (
              <img src={form.logoDataUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">No logo uploaded</span>
            )}
          </div>
          <Input type="file" accept="image/*" onChange={onLogo} />
          {form.logoDataUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setForm({ ...form, logoDataUrl: "" })}
            >
              Remove Logo
            </Button>
          )}
        </GlassCard>
      </div>
    </div>
  );
}