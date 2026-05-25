import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Download, FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/store";
import { GlassCard, PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { buildReportPDF, formatCurrency } from "@/lib/pdf";
import { exportToExcel } from "@/lib/excel";
import type { ITWRecord } from "@/lib/types";

export const Route = createFileRoute("/quarterly-reports")({
  component: Page,
  head: () => ({ meta: [{ title: "Quarterly Reports — Jhaymarts" }] }),
});

function monthSlot(month: number, quarter: number): 1 | 2 | 3 | 0 {
  const start = (quarter - 1) * 3 + 1;
  if (month === start) return 1;
  if (month === start + 1) return 2;
  if (month === start + 2) return 3;
  return 0;
}

function recordMonthYear(r: ITWRecord): { month: number; year: number } | null {
  if (r.month && r.year) return { month: r.month, year: r.year };
  if (!r.transactionDate) return null;
  // Parse YYYY-MM-DD without timezone shift
  const m = r.transactionDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { year: parseInt(m[1]), month: parseInt(m[2]) };
  const d = new Date(r.transactionDate);
  if (isNaN(d.getTime())) return null;
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

function summarize(records: ITWRecord[], year: number, quarter: number) {
  const out = {
    m1Ip: 0, m1Tw: 0, m2Ip: 0, m2Tw: 0, m3Ip: 0, m3Tw: 0,
    has1: false, has2: false, has3: false,
  };
  for (const r of records) {
    const my = recordMonthYear(r);
    if (!my || my.year !== year) continue;
    const which = monthSlot(my.month, quarter);
    if (which === 0) continue;
    out[`m${which}Ip` as "m1Ip"] += r.amountIncomePayment || 0;
    out[`m${which}Tw` as "m1Tw"] += r.amountTaxWithheld || 0;
    out[`has${which}` as "has1"] = true;
  }
  return out;
}

function Page() {
  const { top10k, expanded, settings } = useAppStore();
  const currentYear = new Date().getFullYear();

  // Auto-detect available years and quarters from uploaded data
  const { availableYears, availableByYear } = useMemo(() => {
    const all = [...top10k, ...expanded];
    const byYear = new Map<number, Set<number>>();
    for (const r of all) {
      const my = recordMonthYear(r);
      if (!my) continue;
      const q = (Math.floor((my.month - 1) / 3) + 1);
      if (!byYear.has(my.year)) byYear.set(my.year, new Set());
      byYear.get(my.year)!.add(q);
    }
    const years = Array.from(byYear.keys()).sort((a, b) => b - a);
    return { availableYears: years, availableByYear: byYear };
  }, [top10k, expanded]);

  const defaultYear = availableYears[0] ?? currentYear;
  const [year, setYear] = useState<number>(defaultYear);
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>(
    (Math.floor(new Date().getMonth() / 3) + 1) as 1 | 2 | 3 | 4
  );

  // Keep selection aligned with available data
  useEffect(() => {
    if (availableYears.length === 0) return;
    if (!availableYears.includes(year)) {
      setYear(availableYears[0]);
      return;
    }
    const qs = availableByYear.get(year);
    if (qs && qs.size > 0 && !qs.has(quarter)) {
      setQuarter(Array.from(qs).sort()[0] as 1 | 2 | 3 | 4);
    }
  }, [availableYears, availableByYear, year, quarter]);

  const top = useMemo(() => summarize(top10k, year, quarter), [top10k, year, quarter]);
  const exp = useMemo(() => summarize(expanded, year, quarter), [expanded, year, quarter]);

  // Which month slots (1/2/3) have any data for this quarter — hide empty months
  const showSlot = useMemo(
    () => ({
      1: top.has1 || exp.has1,
      2: top.has2 || exp.has2,
      3: top.has3 || exp.has3,
    }),
    [top, exp]
  );
  const activeSlots = useMemo(
    () => ([1, 2, 3] as const).filter((s) => showSlot[s]),
    [showSlot]
  );
  const yearOptions = availableYears.length > 0 ? availableYears : [currentYear];
  const quarterOptions = (availableByYear.get(year) ? Array.from(availableByYear.get(year)!).sort() : [1, 2, 3, 4]) as number[];

  const monthNames = useMemo(() => {
    const start = (quarter - 1) * 3;
    return ["January","February","March","April","May","June","July","August","September","October","November","December"]
      .slice(start, start + 3);
  }, [quarter]);

  function reportRows() {
    return [
      ["TYPE", `${monthNames[0]} Income`, `${monthNames[0]} Withheld`,
        `${monthNames[1]} Income`, `${monthNames[1]} Withheld`,
        `${monthNames[2]} Income`, `${monthNames[2]} Withheld`,
        "Quarter Total Income", "Quarter Total Withheld"],
    ];
  }

  const totalTopIp = top.m1Ip + top.m2Ip + top.m3Ip;
  const totalTopTw = top.m1Tw + top.m2Tw + top.m3Tw;
  const totalExpIp = exp.m1Ip + exp.m2Ip + exp.m3Ip;
  const totalExpTw = exp.m1Tw + exp.m2Tw + exp.m3Tw;

  const body: (string | number)[][] = [
    ["ITW-TOP 10K",
      formatCurrency(top.m1Ip), formatCurrency(top.m1Tw),
      formatCurrency(top.m2Ip), formatCurrency(top.m2Tw),
      formatCurrency(top.m3Ip), formatCurrency(top.m3Tw),
      formatCurrency(totalTopIp), formatCurrency(totalTopTw)],
    ["ITW-EXPANDED",
      formatCurrency(exp.m1Ip), formatCurrency(exp.m1Tw),
      formatCurrency(exp.m2Ip), formatCurrency(exp.m2Tw),
      formatCurrency(exp.m3Ip), formatCurrency(exp.m3Tw),
      formatCurrency(totalExpIp), formatCurrency(totalExpTw)],
  ];

  function exportPDF() {
    buildReportPDF({
      title: `Quarterly Withholding Tax Report — Q${quarter} ${year}`,
      subtitle: `Months: ${monthNames.join(" / ")}`,
      settings,
      head: reportRows(),
      body,
      filename: `quarterly-Q${quarter}-${year}.pdf`,
    });
  }

  async function exportExcel() {
    await exportToExcel(
      [
        {
          Type: "ITW-TOP 10K",
          [`${monthNames[0]} Income`]: top.m1Ip,
          [`${monthNames[0]} Withheld`]: top.m1Tw,
          [`${monthNames[1]} Income`]: top.m2Ip,
          [`${monthNames[1]} Withheld`]: top.m2Tw,
          [`${monthNames[2]} Income`]: top.m3Ip,
          [`${monthNames[2]} Withheld`]: top.m3Tw,
          "Quarter Income": totalTopIp,
          "Quarter Withheld": totalTopTw,
        },
        {
          Type: "ITW-EXPANDED",
          [`${monthNames[0]} Income`]: exp.m1Ip,
          [`${monthNames[0]} Withheld`]: exp.m1Tw,
          [`${monthNames[1]} Income`]: exp.m2Ip,
          [`${monthNames[1]} Withheld`]: exp.m2Tw,
          [`${monthNames[2]} Income`]: exp.m3Ip,
          [`${monthNames[2]} Withheld`]: exp.m3Tw,
          "Quarter Income": totalExpIp,
          "Quarter Withheld": totalExpTw,
        },
      ],
      `quarterly-Q${quarter}-${year}.xlsx`,
      `Q${quarter} ${year}`
    );
    toast.success("Excel exported");
  }

  return (
    <div>
      <PageHeader
        title="Quarterly Reports"
        description="Auto-generated quarterly summaries from ITW Top 10K and Expanded."
        actions={
          <>
            <Button variant="outline" onClick={exportExcel}>
              <Download className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" onClick={exportPDF}>
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" /> Print
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Quarter</label>
          <select
            value={quarter}
            onChange={(e) => setQuarter(parseInt(e.target.value) as 1 | 2 | 3 | 4)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {quarterOptions.map((q) => (
              <option key={q} value={q}>
                Q{q}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Year</label>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        {activeSlots.length === 0 && (
          <p className="text-xs text-muted-foreground self-end">
            No uploaded data for Q{quarter} {year}.
          </p>
        )}
      </div>

      <GlassCard className="print:bg-white print:shadow-none">
        <div className="text-center mb-6">
          {settings.logoDataUrl && (
            <img src={settings.logoDataUrl} alt="" className="h-16 mx-auto mb-2" />
          )}
          <h2 className="text-xl font-bold">{settings.companyName}</h2>
          {settings.companyAddress && (
            <p className="text-sm text-muted-foreground">{settings.companyAddress}</p>
          )}
          {settings.tinNumber && (
            <p className="text-xs text-muted-foreground">TIN: {settings.tinNumber}</p>
          )}
          <p className="mt-3 font-semibold">
            Quarterly Withholding Tax Report — Q{quarter} {year}
          </p>
          <p className="text-xs text-muted-foreground">{monthNames.join(" · ")}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-accent/40">
              <tr>
                <th rowSpan={2} className="border p-2 text-left">TYPE</th>
                {monthNames.map((m, i) => (
                  <th key={m} colSpan={2} className="border p-2 text-center">
                    {`${["1st","2nd","3rd"][i]} Month — ${m}`}
                  </th>
                ))}
                <th colSpan={2} className="border p-2 text-center">Quarter Total</th>
              </tr>
              <tr>
                {monthNames.map((m) => (
                  <Fragment key={m}>
                    <th className="border p-2 text-right text-xs">Income Payment</th>
                    <th className="border p-2 text-right text-xs">Tax Withheld</th>
                  </Fragment>
                ))}
                <th className="border p-2 text-right text-xs">Income</th>
                <th className="border p-2 text-right text-xs">Withheld</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "ITW-TOP 10K", s: top, tip: totalTopIp, ttw: totalTopTw },
                { label: "ITW-EXPANDED", s: exp, tip: totalExpIp, ttw: totalExpTw },
              ].map((r) => (
                <tr key={r.label}>
                  <td className="border p-2 font-medium">{r.label}</td>
                  <td className="border p-2 text-right">{formatCurrency(r.s.m1Ip)}</td>
                  <td className="border p-2 text-right">{formatCurrency(r.s.m1Tw)}</td>
                  <td className="border p-2 text-right">{formatCurrency(r.s.m2Ip)}</td>
                  <td className="border p-2 text-right">{formatCurrency(r.s.m2Tw)}</td>
                  <td className="border p-2 text-right">{formatCurrency(r.s.m3Ip)}</td>
                  <td className="border p-2 text-right">{formatCurrency(r.s.m3Tw)}</td>
                  <td className="border p-2 text-right font-semibold">{formatCurrency(r.tip)}</td>
                  <td className="border p-2 text-right font-semibold">{formatCurrency(r.ttw)}</td>
                </tr>
              ))}
              <tr className="bg-accent/30 font-bold">
                <td className="border p-2">GRAND TOTAL</td>
                <td className="border p-2 text-right">{formatCurrency(top.m1Ip + exp.m1Ip)}</td>
                <td className="border p-2 text-right">{formatCurrency(top.m1Tw + exp.m1Tw)}</td>
                <td className="border p-2 text-right">{formatCurrency(top.m2Ip + exp.m2Ip)}</td>
                <td className="border p-2 text-right">{formatCurrency(top.m2Tw + exp.m2Tw)}</td>
                <td className="border p-2 text-right">{formatCurrency(top.m3Ip + exp.m3Ip)}</td>
                <td className="border p-2 text-right">{formatCurrency(top.m3Tw + exp.m3Tw)}</td>
                <td className="border p-2 text-right">{formatCurrency(totalTopIp + totalExpIp)}</td>
                <td className="border p-2 text-right">{formatCurrency(totalTopTw + totalExpTw)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12 text-sm">
          <div>
            <p className="text-muted-foreground">Prepared By:</p>
            <div className="border-b border-foreground mt-8" />
            <p className="mt-1 font-medium">{settings.preparedBy || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Approved By:</p>
            <div className="border-b border-foreground mt-8" />
            <p className="mt-1 font-medium">{settings.approvedBy || "—"}</p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}