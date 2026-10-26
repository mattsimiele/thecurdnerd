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
  summary: { netMovementCents: number; expenseCents: number; cogsCents: number; transactionCount: number; expenseLineCount: number; latestTransactionDate: string | null; latestImportAt: string | null };
  groups: Array<{ reporting_group: string; expense_amount_cents: number; transaction_count: number }>;
  daily: Array<{ transaction_date: string; expense_amount_cents: number; transaction_count: number }>;
};

export type QuickBooksReceiptStatus = "needs_receipt" | "matched" | "approved" | "uploaded" | "posted" | "needs_review" | "held";
export type QuickBooksWorkflowTransaction = {
  id: string; account_name: string; transaction_date: string; description: string; amount_cents: number;
  location: "The Curd Nerd" | "The Wedge" | "TCN/Wedge" | null; vendor: string | null; category: string | null;
  receipt_id?: string | null; receipt_path: string | null; receipt_name: string | null; receipt_confidence: number | null;
  status: QuickBooksReceiptStatus; source?: "quickbooks_api" | "quickbooks_export"; last_error?: string | null; updated_at: string | null;
};
export type QuickBooksWorkflowReport = { fetched_at: string | null; source: "quickbooks" | "local_worker" | "not_connected"; connections?: { google_drive: boolean; quickbooks: boolean }; transactions: QuickBooksWorkflowTransaction[] };

export type OperatingBusiness = {
  slug: string; name: string; sales_cents: number; previous_sales_cents: number;
  tickets: number; previous_tickets: number; observed_days: number; previous_observed_days: number;
  gift_card_cents: number; unverified_gift_card_cents: number; uncategorized_lines: number; unknown_unit_lines: number;
  sales_through: string | null; sales_imported_at: string | null;
  accounting_through: string | null; accounting_imported_at: string | null; direct_expense_cents: number;
};
export type ExpenseAccount = { account: string; account_type: string; allocation: string; current_cents: number; previous_cents: number; line_count: number };
export type OperatingReport = {
  startDate: string; endDate: string; previousStartDate: string; previousEndDate: string; sharedVisible: boolean; accountingDataThrough: string | null; accountingImportedAt: string | null;
  businesses: OperatingBusiness[];
  daily: { slug: string; business_date: string; source_lines: number; sales_cents: number }[];
  categories: { slug: string; category: string; sales_cents: number }[];
  items: { slug: string; item_name: string; variation_name: string | null; catalog_variation_id: string | null; quantity_unit: string; quantity: number; sales_cents: number; ranking: number }[];
  accounts: ExpenseAccount[];
  vendors: { account: string; vendor: string; allocation: string; current_cents: number; previous_cents: number }[];
  recordedReturns: { slug: string; return_lines: number; return_cents: number }[];
};
export type ExpenseLinePage = {
  total: number; rows: { id: string; transaction_date: string; account: string; vendor: string; amount_cents: number; allocation: string; entity_type: string; source_id: string | null }[];
};
