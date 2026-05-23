import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo } from "react";
import {
  Users,
  FileSpreadsheet,
  FileBarChart,
  Wallet,
  TrendingUp,
  Activity,
} from "lucide-react";
import { useAppStore } from "@/store";
import { GlassCard, PageHeader } from "@/components/AppLayout";
import { formatCurrency } from "@/lib/pdf";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  delay = 0,
}: {
  icon: any;
  label: string;
  value: string;
  hint?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -3, scale: 1.01 }}
      className="glass-strong rounded-2xl p-5 relative overflow-hidden"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl lg:text-3xl font-bold mt-2 truncate">{value}</p>
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
        <div className="w-11 h-11 rounded-xl gradient-primary grid place-items-center shrink-0 shadow-elegant">
          <Icon className="w-5 h-5 text-primary-foreground" />
        </div>
      </div>
    </motion.div>
  );
}

function Dashboard() {
  const { suppliers, top10k, expanded, logs } = useAppStore();
  const totalTax = useMemo(
    () =>
      top10k.reduce((s, r) => s + (r.amountTaxWithheld || 0), 0) +
      expanded.reduce((s, r) => s + (r.amountTaxWithheld || 0), 0),
    [top10k, expanded]
  );
  const totalIncome = useMemo(
    () =>
      top10k.reduce((s, r) => s + (r.amountIncomePayment || 0), 0) +
      expanded.reduce((s, r) => s + (r.amountIncomePayment || 0), 0),
    [top10k, expanded]
  );

  const byMonth = useMemo(() => {
    const map = new Map<string, number>();
    [...top10k, ...expanded].forEach((r) => {
      const m = (r.transactionDate || "").slice(0, 7) || "—";
      map.set(m, (map.get(m) || 0) + (r.amountTaxWithheld || 0));
    });
    return Array.from(map.entries()).sort().slice(-6);
  }, [top10k, expanded]);
  const maxMonth = Math.max(1, ...byMonth.map(([, v]) => v));

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Real-time overview of your withholding tax compliance status."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Users} label="Total Suppliers" value={String(suppliers.length)} delay={0} />
        <StatCard
          icon={FileSpreadsheet}
          label="ITW Top 10K"
          value={String(top10k.length)}
          hint="transactions"
          delay={0.05}
        />
        <StatCard
          icon={FileBarChart}
          label="ITW Expanded"
          value={String(expanded.length)}
          hint="transactions"
          delay={0.1}
        />
        <StatCard
          icon={Wallet}
          label="Total Tax Withheld"
          value={formatCurrency(totalTax)}
          delay={0.15}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Monthly Tax Withheld</h3>
              <p className="text-xs text-muted-foreground">Last 6 periods</p>
            </div>
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          {byMonth.length === 0 ? (
            <div className="text-sm text-muted-foreground py-10 text-center">
              No data yet. Upload ITW files to see analytics.
            </div>
          ) : (
            <div className="flex items-end gap-3 h-48">
              {byMonth.map(([m, v]) => (
                <div key={m} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex-1 flex items-end">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(v / maxMonth) * 100}%` }}
                      transition={{ duration: 0.6 }}
                      className="w-full rounded-t-lg gradient-primary shadow-elegant"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{m}</p>
                  <p className="text-[10px] font-medium">{formatCurrency(v)}</p>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-accent/30 p-3">
              <p className="text-xs text-muted-foreground">Total Income Payments</p>
              <p className="font-semibold">{formatCurrency(totalIncome)}</p>
            </div>
            <div className="rounded-xl bg-accent/30 p-3">
              <p className="text-xs text-muted-foreground">Total Records</p>
              <p className="font-semibold">{top10k.length + expanded.length}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent Activity</h3>
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {logs.length === 0 && (
              <p className="text-xs text-muted-foreground">No activity yet.</p>
            )}
            {logs
              .slice()
              .reverse()
              .slice(0, 20)
              .map((l) => (
                <div key={l.id} className="text-xs rounded-lg bg-accent/20 px-3 py-2">
                  <p className="font-medium">{l.message}</p>
                  <p className="text-muted-foreground mt-0.5">
                    {l.module} · {new Date(l.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
