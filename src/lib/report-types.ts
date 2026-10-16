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
