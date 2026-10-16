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
