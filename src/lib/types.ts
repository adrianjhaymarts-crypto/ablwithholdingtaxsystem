export interface Supplier {
  id: string;
  supplierName: string;
  billingAddress: string;
  phoneNumber: string;
  tinNumber: string;
  vatType: "VAT" | "NON-VAT" | "";
  atcA: string;
  taxRateA: number;
  atcB: string;
  taxRateB: number;
  expandedWithholdingType: string;
  createdAt: string;
  updatedAt: string;
}

export interface ITWRecord {
  id: string;
  tinNumber: string;
  vendorName: string;
  taxRate: number;
  amountTaxWithheld: number;
  amountIncomePayment: number;
  grandTotal: number;
  transactionDate: string;
  sourceFile: string;
  matchedSupplier: string | null;
  createdAt: string;
}

export interface CompanySettings {
  id: string;
  companyName: string;
  tinNumber: string;
  companyAddress: string;
  preparedBy: string;
  approvedBy: string;
  logoDataUrl: string;
}

export interface ActivityLog {
  id: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  module: string;
  createdAt: string;
}

export interface QuarterlyReport {
  id: string;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  type: "ITW-TOP 10K" | "ITW-EXPANDED";
  m1IncomePayment: number;
  m1TaxWithheld: number;
  m2IncomePayment: number;
  m2TaxWithheld: number;
  m3IncomePayment: number;
  m3TaxWithheld: number;
  createdAt: string;
}