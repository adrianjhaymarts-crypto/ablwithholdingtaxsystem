import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { CompanySettings } from "./types";

export function buildReportPDF(opts: {
  title: string;
  subtitle?: string;
  settings: CompanySettings;
  head: string[][];
  body: (string | number)[][];
  filename: string;
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = 40;

  if (opts.settings.logoDataUrl) {
    try {
      doc.addImage(opts.settings.logoDataUrl, "PNG", 40, 30, 60, 60);
    } catch {}
  }

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(opts.settings.companyName || "Company", W / 2, y, { align: "center" });
  y += 18;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (opts.settings.companyAddress)
    doc.text(opts.settings.companyAddress, W / 2, y, { align: "center" });
  y += 12;
  if (opts.settings.tinNumber)
    doc.text(`TIN: ${opts.settings.tinNumber}`, W / 2, y, { align: "center" });
  y += 20;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(opts.title, W / 2, y, { align: "center" });
  y += 14;
  if (opts.subtitle) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(opts.subtitle, W / 2, y, { align: "center" });
    y += 12;
  }

  autoTable(doc, {
    startY: y + 10,
    head: opts.head,
    body: opts.body,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [16, 185, 129], textColor: 255 },
    alternateRowStyles: { fillColor: [240, 253, 250] },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? y + 60;
  const sigY = Math.max(finalY + 50, doc.internal.pageSize.getHeight() - 80);
  doc.setFontSize(10);
  doc.text("Prepared By:", 60, sigY);
  doc.line(60, sigY + 30, 240, sigY + 30);
  doc.text(opts.settings.preparedBy || "_______________", 60, sigY + 45);

  doc.text("Approved By:", W - 240, sigY);
  doc.line(W - 240, sigY + 30, W - 60, sigY + 30);
  doc.text(opts.settings.approvedBy || "_______________", W - 240, sigY + 45);

  doc.save(opts.filename);
}

export function printReport(doc: jsPDF) {
  doc.autoPrint();
  window.open(doc.output("bloburl"), "_blank");
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(n || 0);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);
}

export function formatPercent(n: number): string {
  return `${((n || 0) * 100).toFixed(2)}%`;
}