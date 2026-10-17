export type ManagerBusiness = {
  slug: "the-curd-nerd" | "the-wedge";
  name: string;
  manager_role: "owner" | "manager" | "viewer";
  earliest_sales_date: string;
  latest_sales_date: string;
};

export type SalesReport = {
  scope: string;
  startDate: string;
  endDate: string;
  summary: {
    netSalesCents: number;
    grossSalesCents: number;
    discountCents: number;
    taxCents: number;
    transactionCount: number;
    itemQuantity: number;
    averageTicketCents: number | null;
    latestImportAt: string | null;
  };
  yearOverYear: {
    netSalesCents: number;
    transactionCount: number;
    percentChange: number | null;
  };
  daily: Array<{ business_date: string; business_name: string; net_sales_cents: number; tax_cents: number; transaction_count: number; item_quantity: number }>;
  weekly: Array<{ week_start: string; business_name: string; net_sales_cents: number; transaction_count: number; item_quantity: number }>;
  categories: Array<{ category: string; net_sales_cents: number; item_quantity: number }>;
  items: Array<{ item_name: string; category: string; net_sales_cents: number; item_quantity: number }>;
  hourly: Array<{ hour: number; net_sales_cents: number; transaction_count: number }>;
};

export type AccountingReport = {
  startDate: string;
  endDate: string;
  summary: { netMovementCents: number; cogsCents: number; transactionCount: number; latestTransactionDate: string | null };
  groups: Array<{ reporting_group: string; amount_cents: number; transaction_count: number }>;
  daily: Array<{ transaction_date: string; amount_cents: number; transaction_count: number }>;
};

export type QuickBooksReceiptStatus = "needs_receipt" | "matched" | "approved" | "uploaded" | "posted" | "needs_review" | "held";
export type QuickBooksWorkflowTransaction = {
  id: string; account_name: string; transaction_date: string; description: string; amount_cents: number;
  location: "The Curd Nerd" | "The Wedge" | "TCN/Wedge" | null; vendor: string | null; category: string | null;
  receipt_id?: string | null; receipt_path: string | null; receipt_name: string | null; receipt_confidence: number | null;
  status: QuickBooksReceiptStatus; source?: "quickbooks_api" | "quickbooks_export"; last_error?: string | null; updated_at: string | null;
};
export type QuickBooksWorkflowReport = { fetched_at: string | null; source: "quickbooks" | "local_worker" | "not_connected"; connections?: { google_drive: boolean; quickbooks: boolean }; transactions: QuickBooksWorkflowTransaction[] };
