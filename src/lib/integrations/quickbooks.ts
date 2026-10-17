import { z } from "zod";

const tokenSchema = z.object({ access_token: z.string(), refresh_token: z.string(), expires_in: z.number(), x_refresh_token_expires_in: z.number().optional() });

export function quickBooksAuthorizationUrl(state: string) {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI;
  if (!clientId || !redirectUri) throw new Error("QuickBooks OAuth is not configured.");
  const url = new URL("https://appcenter.intuit.com/connect/oauth2");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "com.intuit.quickbooks.accounting");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeQuickBooksCode(code: string) {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) throw new Error("QuickBooks OAuth is not configured.");
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", { method:"POST", headers:{ Authorization:`Basic ${credentials}`, Accept:"application/json", "Content-Type":"application/x-www-form-urlencoded" }, body:new URLSearchParams({ grant_type:"authorization_code", code, redirect_uri:redirectUri }), cache:"no-store" });
  if (!response.ok) throw new Error(`QuickBooks token exchange failed with status ${response.status}.`);
  return tokenSchema.parse(await response.json());
}

export async function queryQuickBooks({ realmId, accessToken, query }: { realmId:string; accessToken:string; query:string }) {
  const url = new URL(`/v3/company/${encodeURIComponent(realmId)}/query`, "https://quickbooks.api.intuit.com");
  url.searchParams.set("query", query);
  url.searchParams.set("minorversion", "75");
  const response = await fetch(url, { headers:{ Authorization:`Bearer ${accessToken}`, Accept:"application/json" }, cache:"no-store" });
  if (!response.ok) throw new Error(`QuickBooks query failed with status ${response.status}.`);
  return response.json() as Promise<unknown>;
}

export type QuickBooksOpenTransaction = {
  id: string;
  entity: "Purchase" | "Payment" | "BillPaymentCheck" | "Deposit" | "JournalEntry";
  accountName: string;
  date: string;
  description: string;
  amountCents: number;
  syncToken?: string;
};

/**
 * QuickBooks' Review/Bank Transactions screen is not exposed as a single API
 * resource. The worker queries the purchasable entities and keeps only rows
 * that still need review. Matching is intentionally account/date/cents first;
 * description is only corroborating evidence.
 */
export async function queryOpenTransactions({ realmId, accessToken, startDate }: { realmId: string; accessToken: string; startDate: string }) {
  const queries = [
    `select * from Purchase where TxnDate >= '${startDate}' maxresults 1000`,
    `select * from Payment where TxnDate >= '${startDate}' maxresults 1000`,
    `select * from BillPaymentCheck where TxnDate >= '${startDate}' maxresults 1000`,
  ];
  const results = await Promise.all(queries.map((query) => queryQuickBooks({ realmId, accessToken, query })));
  return results.flatMap((result, index) => {
    const entity = ["Purchase", "Payment", "BillPaymentCheck"][index] as QuickBooksOpenTransaction["entity"];
    const rows = (result as { QueryResponse?: Record<string, Array<Record<string, unknown>>> }).QueryResponse?.[entity] ?? [];
    return rows.map((row) => {
      const amount = Number(row.TotalAmt ?? row.Amount ?? 0);
      const account = row.Account as { name?: string } | undefined;
      return { id: String(row.Id), entity, accountName: account?.name ?? "Unknown account", date: String(row.TxnDate ?? ""), description: String(row.PrivateNote ?? row.DocNumber ?? ""), amountCents: Math.round(amount * 100), syncToken: row.SyncToken ? String(row.SyncToken) : undefined };
    });
  });
}

export async function uploadReceiptToQuickBooks({ realmId, accessToken, transactionId, file }: { realmId: string; accessToken: string; transactionId: string; file: Blob & { name?: string } }) {
  const metadata = JSON.stringify({ Attachable: { FileName: file.name ?? "receipt.pdf", ContentType: file.type || "application/pdf", LatentType: "Other", EntityRef: { type: "Purchase", value: transactionId } } });
  const body = new FormData();
  body.append("file_metadata_01", new Blob([metadata], { type: "application/json" }));
  body.append("file_content_01", file, file.name ?? "receipt.pdf");
  const response = await fetch(`https://quickbooks.api.intuit.com/v3/company/${encodeURIComponent(realmId)}/upload?minorversion=75`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }, body, cache: "no-store" });
  if (!response.ok) throw new Error(`QuickBooks receipt upload failed with status ${response.status}.`);
  return response.json() as Promise<unknown>;
}
