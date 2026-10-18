import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const GOOGLE_DRIVE_FOLDER_ID = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID") ?? "1yebBnCTdPhYPLrc4aylHWORLs9-vsn9n";
const GOOGLE_REDIRECT_URI = Deno.env.get("GOOGLE_REDIRECT_URI") ?? "";
const QUICKBOOKS_CLIENT_ID = Deno.env.get("QUICKBOOKS_CLIENT_ID") ?? "";
const QUICKBOOKS_CLIENT_SECRET = Deno.env.get("QUICKBOOKS_CLIENT_SECRET") ?? "";
const QUICKBOOKS_REDIRECT_URI = Deno.env.get("QUICKBOOKS_REDIRECT_URI") ?? "";
const QUICKBOOKS_ENVIRONMENT = Deno.env.get("QUICKBOOKS_ENVIRONMENT") === "sandbox" ? "sandbox" : "production";
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:3000,https://mattsimiele.github.io")
  .split(",").map((value) => value.trim()).filter(Boolean);

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

type Provider = "google_drive" | "quickbooks";
type Json = Record<string, unknown>;

function errorMessage(cause: unknown) {
  if (cause instanceof Error) return cause.message;
  if (cause && typeof cause === "object" && "message" in cause) return String((cause as { message: unknown }).message);
  return "Unexpected integration error";
}

function cors(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.some((value) => origin === value || origin.startsWith(`${value}/`));
  return {
    "Access-Control-Allow-Origin": allowed ? origin! : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    Vary: "Origin",
  };
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });
}

async function requireUser(req: Request) {
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("Authentication required");
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } }, auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Authentication required");
  const { data: access, error: accessError } = await client.rpc("manager_businesses");
  if (accessError || !(access as Array<{ manager_role?: string }> | null)?.some((row) => ["owner", "manager"].includes(row.manager_role ?? ""))) throw new Error("Manager access required");
  return data.user;
}

function safeReturnTo(value: unknown) {
  const fallback = "https://mattsimiele.github.io/thecurdnerd/dashboard/";
  if (typeof value !== "string") return fallback;
  try {
    const url = new URL(value);
    return ALLOWED_ORIGINS.some((origin) => url.origin === new URL(origin).origin) ? url.toString() : fallback;
  } catch { return fallback; }
}

async function createState(provider: Provider, userId: string, returnTo: string) {
  const state = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
  const { error } = await admin.from("oauth_states").insert({
    state, provider, user_id: userId, return_to: returnTo,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  if (error) throw error;
  return state;
}

async function consumeState(state: string, provider: Provider) {
  const { data, error } = await admin.from("oauth_states")
    .delete().eq("state", state).eq("provider", provider).gt("expires_at", new Date().toISOString())
    .select("user_id,return_to").maybeSingle();
  if (error || !data) throw new Error("OAuth request expired or is invalid");
  return data as { user_id: string; return_to: string };
}

async function saveConnection(provider: Provider, values: Json) {
  const { error } = await admin.from("integration_connections")
    .upsert({ provider, ...values, updated_at: new Date().toISOString() }, { onConflict: "provider" });
  if (error) throw error;
}

async function exchangeGoogleCode(code: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI, grant_type: "authorization_code" }),
  });
  if (!response.ok) throw new Error(`Google token exchange failed (${response.status})`);
  return await response.json() as { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
}

async function exchangeQuickBooksCode(code: string) {
  const credentials = btoa(`${QUICKBOOKS_CLIENT_ID}:${QUICKBOOKS_CLIENT_SECRET}`);
  const response = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST", headers: { Authorization: `Basic ${credentials}`, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, redirect_uri: QUICKBOOKS_REDIRECT_URI, grant_type: "authorization_code" }),
  });
  if (!response.ok) throw new Error(`QuickBooks token exchange failed (${response.status})`);
  return await response.json() as { access_token: string; refresh_token: string; expires_in: number };
}

async function accessToken(provider: Provider) {
  const { data, error } = await admin.from("integration_connections").select("*").eq("provider", provider).maybeSingle();
  if (error || !data?.refresh_token) throw new Error(`${provider === "google_drive" ? "Google Drive" : "QuickBooks"} is not connected`);
  if (data.access_token && new Date(data.token_expires_at ?? 0).getTime() > Date.now() + 60_000) return { token: data.access_token as string, connection: data };
  const isGoogle = provider === "google_drive";
  const endpoint = isGoogle ? "https://oauth2.googleapis.com/token" : "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" };
  if (!isGoogle) headers.Authorization = `Basic ${btoa(`${QUICKBOOKS_CLIENT_ID}:${QUICKBOOKS_CLIENT_SECRET}`)}`;
  const params = new URLSearchParams({ refresh_token: String(data.refresh_token), grant_type: "refresh_token" });
  if (isGoogle) { params.set("client_id", GOOGLE_CLIENT_ID); params.set("client_secret", GOOGLE_CLIENT_SECRET); }
  const response = await fetch(endpoint, { method: "POST", headers, body: params });
  if (!response.ok) throw new Error(`${provider} token refresh failed (${response.status})`);
  const refreshed = await response.json() as { access_token: string; refresh_token?: string; expires_in: number };
  await saveConnection(provider, {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token ?? data.refresh_token,
    token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
  });
  return { token: refreshed.access_token, connection: { ...data, refresh_token: refreshed.refresh_token ?? data.refresh_token } };
}

type DriveFile = { id: string; name: string; mimeType: string; parents?: string[]; webViewLink?: string; modifiedTime?: string; size?: string; md5Checksum?: string };

async function listDriveTree(token: string, rootFolder: string) {
  const folders = [rootFolder]; const pdfs: DriveFile[] = [];
  while (folders.length) {
    const parent = folders.shift()!; let pageToken = "";
    do {
      const url = new URL("https://www.googleapis.com/drive/v3/files");
      url.searchParams.set("q", `'${parent.replaceAll("'", "\\'")}' in parents and trashed = false`);
      url.searchParams.set("pageSize", "1000");
      url.searchParams.set("supportsAllDrives", "true");
      url.searchParams.set("includeItemsFromAllDrives", "true");
      url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,parents,webViewLink,modifiedTime,size,md5Checksum)");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(`Google Drive listing failed (${response.status})`);
      const page = await response.json() as { files?: DriveFile[]; nextPageToken?: string };
      for (const file of page.files ?? []) {
        if (file.mimeType === "application/vnd.google-apps.folder") folders.push(file.id);
        else if (file.mimeType === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) pdfs.push(file);
      }
      pageToken = page.nextPageToken ?? "";
    } while (pageToken);
  }
  return pdfs;
}

const months: Record<string, number> = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
function parseReceiptName(name: string) {
  const stem = name.replace(/\.pdf$/i, "").replaceAll("_", " ");
  let date: string | null = null;
  const digits = stem.match(/\b(20\d{2})(\d{2})(\d{2})\b|\b(\d{2})(\d{2})(20\d{2})\b/);
  if (digits) {
    const [year, month, day] = digits[1] ? [digits[1], digits[2], digits[3]] : [digits[6], digits[4], digits[5]];
    date = `${year}-${month}-${day}`;
  } else {
    const named = stem.match(/\b([A-Za-z]{3,9})\s+(\d{1,2})[, -]+(20\d{2})\b/);
    if (named && months[named[1].slice(0,3).toLowerCase()]) date = `${named[3]}-${String(months[named[1].slice(0,3).toLowerCase()]).padStart(2,"0")}-${named[2].padStart(2,"0")}`;
  }
  const amounts = [...stem.matchAll(/(?:\$|\b)(\d{1,5})[.,](\d{2})\b/g)].map((match) => Number(match[1]) * 100 + Number(match[2]));
  const amount = amounts.at(-1) ?? null;
  const vendor = stem.replace(/\b20\d{6}\b|\b\d{4}20\d{2}\b/g, " ").replace(/\b\d+[.,]\d{2}\b/g, " ").replace(/[–—_-]+/g, " ").replace(/\s+/g, " ").trim() || null;
  return { date, amount, vendor };
}

async function matchReceipts() {
  const [{ data: receipts }, { data: transactions }] = await Promise.all([
    admin.from("receipt_documents").select("id,parsed_date,parsed_amount_cents,parsed_vendor").eq("active", true),
    admin.from("quickbooks_workflow_transactions").select("id,transaction_date,amount_cents,description,vendor,status").in("status", ["needs_receipt", "needs_review", "matched"]),
  ]);
  let matched = 0;
  for (const transaction of transactions ?? []) {
    const candidates = (receipts ?? []).map((receipt) => {
      const days = receipt.parsed_date ? Math.abs((Date.parse(receipt.parsed_date) - Date.parse(transaction.transaction_date)) / 86_400_000) : 999;
      const amountMatch = receipt.parsed_amount_cents !== null && Math.abs(Number(receipt.parsed_amount_cents)) === Math.abs(Number(transaction.amount_cents));
      const vendorText = `${transaction.vendor ?? ""} ${transaction.description ?? ""}`.toLowerCase();
      const vendor = String(receipt.parsed_vendor ?? "").toLowerCase();
      const vendorMatch = vendor.length > 3 && vendor.split(/\s+/).some((part) => part.length > 3 && vendorText.includes(part));
      const confidence = (amountMatch ? 0.65 : 0) + (days <= 1 ? 0.25 : days <= 5 ? 0.15 : 0) + (vendorMatch ? 0.1 : 0);
      return { receipt, confidence, amountMatch, days };
    }).filter((item) => item.amountMatch && item.days <= 5).sort((a,b) => b.confidence - a.confidence);
    if (!candidates.length) continue;
    const top = candidates[0]; const ambiguous = candidates.length > 1 && candidates[1].confidence === top.confidence;
    const { error } = await admin.from("quickbooks_workflow_transactions").update({
      receipt_id: top.receipt.id, receipt_confidence: top.confidence,
      status: ambiguous || top.confidence < 0.8 ? "needs_review" : "matched", updated_at: new Date().toISOString(),
    }).eq("id", transaction.id).in("status", ["needs_receipt", "needs_review", "matched"]);
    if (!error) matched++;
  }
  return matched;
}

async function syncDrive() {
  const { token } = await accessToken("google_drive");
  const files = await listDriveTree(token, GOOGLE_DRIVE_FOLDER_ID);
  await admin.from("receipt_documents").update({ active: false }).eq("active", true);
  for (const file of files) {
    const parsed = parseReceiptName(file.name);
    const { error } = await admin.from("receipt_documents").upsert({
      drive_file_id: file.id, drive_parent_id: file.parents?.[0] ?? null, file_name: file.name,
      mime_type: file.mimeType, web_view_link: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
      modified_at: file.modifiedTime ?? null, size_bytes: file.size ? Number(file.size) : null,
      md5_checksum: file.md5Checksum ?? null, parsed_date: parsed.date, parsed_vendor: parsed.vendor,
      parsed_amount_cents: parsed.amount, indexed_at: new Date().toISOString(), active: true,
    }, { onConflict: "drive_file_id" });
    if (error) throw error;
  }
  const matched = await matchReceipts();
  return { indexed: files.length, matched };
}

function quickBooksBase() {
  return QUICKBOOKS_ENVIRONMENT === "sandbox" ? "https://sandbox-quickbooks.api.intuit.com" : "https://quickbooks.api.intuit.com";
}

async function queryQuickBooks(token: string, realmId: string, query: string) {
  const url = new URL(`/v3/company/${encodeURIComponent(realmId)}/query`, quickBooksBase());
  url.searchParams.set("query", query); url.searchParams.set("minorversion", "75");
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  if (!response.ok) throw new Error(`QuickBooks query failed (${response.status})`);
  return await response.json() as { QueryResponse?: Record<string, Json[]> };
}

async function syncQuickBooks() {
  const { token, connection } = await accessToken("quickbooks");
  const realmId = String(connection.external_account_id ?? "");
  if (!realmId) throw new Error("QuickBooks company ID is missing");
  const entities = ["Purchase", "Bill", "BillPayment", "Payment"];
  const startDate = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10);
  let written = 0;
  for (const entity of entities) {
    const result = await queryQuickBooks(token, realmId, `select * from ${entity} where TxnDate >= '${startDate}' maxresults 1000`);
    for (const row of result.QueryResponse?.[entity] ?? []) {
      const id = String(row.Id ?? ""); if (!id) continue;
      const vendorRef = row.EntityRef as Json | undefined;
      const accountRef = row.AccountRef as Json | undefined;
      const amount = Number(row.TotalAmt ?? row.Amount ?? 0);
      const sourceKey = `api:${entity}:${id}`;
      const { error } = await admin.from("quickbooks_workflow_transactions").upsert({
        source_key: sourceKey, quickbooks_entity_type: entity, quickbooks_entity_id: id,
        quickbooks_sync_token: String(row.SyncToken ?? ""), account_name: String(accountRef?.name ?? "QuickBooks"),
        transaction_date: String(row.TxnDate ?? new Date().toISOString().slice(0,10)),
        description: String(row.PrivateNote ?? row.DocNumber ?? vendorRef?.name ?? entity), amount_cents: Math.round(amount * 100),
        vendor: vendorRef?.name ? String(vendorRef.name) : null, status: "posted", source: "quickbooks_api",
        posted_at: new Date().toISOString(), source_payload: row, updated_at: new Date().toISOString(),
      }, { onConflict: "source_key" });
      if (error) throw error;

      // An imported bank-feed row has no QuickBooks entity ID until it is
      // posted. Once a unique date/amount match appears in the API, link it and
      // mark the original workflow row posted instead of guessing by text.
      const transactionDate = String(row.TxnDate ?? "");
      const amountCents = Math.round(amount * 100);
      const { data: pending } = await admin.from("quickbooks_workflow_transactions")
        .select("id,status").eq("source", "quickbooks_export").eq("transaction_date", transactionDate)
        .in("amount_cents", [amountCents, -amountCents]).in("status", ["uploaded", "approved", "matched", "needs_review"]);
      if (pending?.length === 1) {
        const receiptWasApproved = ["uploaded", "approved"].includes(String(pending[0].status));
        await admin.from("quickbooks_workflow_transactions").update({
          status: receiptWasApproved ? "approved" : "posted", posted_at: new Date().toISOString(), quickbooks_entity_type: entity,
          quickbooks_entity_id: id, quickbooks_sync_token: String(row.SyncToken ?? ""),
          last_error: null, updated_at: new Date().toISOString(),
        }).eq("id", pending[0].id);
      }
      written++;
    }
  }
  const attachments = await uploadApproved();
  return { written, attached: attachments.uploaded, waiting: attachments.waiting, note: "Posted transactions were synced and approved receipts were attached to their QuickBooks transactions." };
}

async function importPending(rows: Json[]) {
  let written = 0;
  for (const row of rows.slice(0, 5000)) {
    const account = String(row.account_name ?? row.account ?? "").trim();
    const date = String(row.transaction_date ?? row.date ?? "").trim();
    const description = String(row.description ?? row.bank_description ?? "").trim();
    const amountCents = Number(row.amount_cents ?? row.signed_cents);
    if (!account || !/^20\d{2}-\d{2}-\d{2}$/.test(date) || !description || !Number.isSafeInteger(amountCents)) continue;
    const raw = new TextEncoder().encode(`${account}|${date}|${description}|${amountCents}`);
    const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", raw))].map((byte) => byte.toString(16).padStart(2,"0")).join("");
    const { error } = await admin.from("quickbooks_workflow_transactions").upsert({
      source_key: `export:${digest}`, account_name: account, transaction_date: date, description,
      amount_cents: amountCents, vendor: row.vendor ? String(row.vendor) : null,
      category: row.category ? String(row.category) : null, location: row.location ? String(row.location) : null,
      status: "needs_receipt", source: "quickbooks_export", source_payload: row, updated_at: new Date().toISOString(),
    }, { onConflict: "source_key", ignoreDuplicates: true });
    if (error) throw error; written++;
  }
  const matched = await matchReceipts();
  return { written, matched };
}

async function uploadApproved() {
  const [{ token: driveToken }, { token: qbToken, connection }] = await Promise.all([accessToken("google_drive"), accessToken("quickbooks")]);
  const { data: transactions, error } = await admin.from("quickbooks_workflow_transactions")
    .select("id,receipt_id,quickbooks_entity_id,quickbooks_entity_type").eq("status", "approved");
  if (error) throw error;
  let uploaded = 0;
  let waiting = 0;
  for (const transaction of transactions ?? []) {
    // Banking "For review" rows have no API entity ID. Keep the approval
    // queued until the user posts the transaction and a sync discovers it.
    if (!transaction.quickbooks_entity_id || !transaction.quickbooks_entity_type) {
      waiting++;
      continue;
    }
    const { data: receipt } = await admin.from("receipt_documents").select("drive_file_id,file_name,mime_type").eq("id", transaction.receipt_id).single();
    if (!receipt) continue;
    try {
      const download = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(receipt.drive_file_id)}?alt=media`, { headers: { Authorization: `Bearer ${driveToken}` } });
      if (!download.ok) throw new Error(`Drive download failed (${download.status})`);
      const metadata: Json = { FileName: receipt.file_name, ContentType: receipt.mime_type || "application/pdf", LatentType: "Other" };
      metadata.AttachableRef = [{ EntityRef: { type: transaction.quickbooks_entity_type, value: transaction.quickbooks_entity_id } }];
      const body = new FormData();
      body.append("file_metadata_01", new Blob([JSON.stringify({ Attachable: metadata })], { type: "application/json" }), "metadata.json");
      body.append("file_content_01", await download.blob(), receipt.file_name);
      const response = await fetch(`${quickBooksBase()}/v3/company/${encodeURIComponent(String(connection.external_account_id))}/upload?minorversion=75`, {
        method: "POST", headers: { Authorization: `Bearer ${qbToken}`, Accept: "application/json" }, body,
      });
      if (!response.ok) throw new Error(`QuickBooks upload failed (${response.status})`);
      const result = await response.json() as { AttachableResponse?: Array<{ Attachable?: { Id?: string } }> };
      const attachableId = result.AttachableResponse?.[0]?.Attachable?.Id ?? null;
      await admin.from("quickbooks_workflow_transactions").update({ status: "posted", uploaded_at: new Date().toISOString(), quickbooks_attachable_id: attachableId, last_error: null, updated_at: new Date().toISOString() }).eq("id", transaction.id);
      uploaded++;
    } catch (cause) {
      await admin.from("quickbooks_workflow_transactions").update({ last_error: cause instanceof Error ? cause.message : "Upload failed", updated_at: new Date().toISOString() }).eq("id", transaction.id);
    }
  }
  return { uploaded, waiting };
}

async function connectionStatus() {
  const { data } = await admin.from("integration_connections").select("provider,external_account_name,connected_at");
  return { google_drive: data?.find((row) => row.provider === "google_drive") ?? null, quickbooks: data?.find((row) => row.provider === "quickbooks") ?? null };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  const url = new URL(req.url); const action = url.searchParams.get("action") ?? "status";
  try {
    if (action === "google_callback") {
      const code = url.searchParams.get("code"); const state = url.searchParams.get("state");
      if (!code || !state) throw new Error("Google authorization was cancelled");
      const saved = await consumeState(state, "google_drive"); const tokens = await exchangeGoogleCode(code);
      const prior = await admin.from("integration_connections").select("refresh_token").eq("provider", "google_drive").maybeSingle();
      await saveConnection("google_drive", { access_token: tokens.access_token, refresh_token: tokens.refresh_token ?? prior.data?.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(), scope: tokens.scope ?? null,
        connected_by: saved.user_id, connected_at: new Date().toISOString(), external_account_id: GOOGLE_DRIVE_FOLDER_ID });
      return Response.redirect(`${saved.return_to}${saved.return_to.includes("?") ? "&" : "?"}connected=google_drive`, 302);
    }
    if (action === "quickbooks_callback") {
      const code = url.searchParams.get("code"); const state = url.searchParams.get("state"); const realmId = url.searchParams.get("realmId");
      if (!code || !state || !realmId) throw new Error("QuickBooks authorization was cancelled");
      const saved = await consumeState(state, "quickbooks"); const tokens = await exchangeQuickBooksCode(code);
      await saveConnection("quickbooks", { access_token: tokens.access_token, refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(), connected_by: saved.user_id,
        connected_at: new Date().toISOString(), external_account_id: realmId });
      return Response.redirect(`${saved.return_to}${saved.return_to.includes("?") ? "&" : "?"}connected=quickbooks`, 302);
    }

    const user = await requireUser(req);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) as Json : {};
    if (action === "google_authorize") {
      if (!GOOGLE_CLIENT_ID || !GOOGLE_REDIRECT_URI) throw new Error("Google OAuth is not configured");
      const state = await createState("google_drive", user.id, safeReturnTo(body.return_to));
      const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      auth.searchParams.set("client_id", GOOGLE_CLIENT_ID); auth.searchParams.set("redirect_uri", GOOGLE_REDIRECT_URI);
      auth.searchParams.set("response_type", "code"); auth.searchParams.set("access_type", "offline"); auth.searchParams.set("prompt", "consent");
      auth.searchParams.set("scope", "https://www.googleapis.com/auth/drive.readonly"); auth.searchParams.set("state", state);
      return json({ url: auth.toString() }, 200, origin);
    }
    if (action === "quickbooks_authorize") {
      if (!QUICKBOOKS_CLIENT_ID || !QUICKBOOKS_REDIRECT_URI) throw new Error("QuickBooks OAuth is not configured");
      const state = await createState("quickbooks", user.id, safeReturnTo(body.return_to));
      const auth = new URL("https://appcenter.intuit.com/connect/oauth2");
      auth.searchParams.set("client_id", QUICKBOOKS_CLIENT_ID); auth.searchParams.set("redirect_uri", QUICKBOOKS_REDIRECT_URI);
      auth.searchParams.set("response_type", "code"); auth.searchParams.set("scope", "com.intuit.quickbooks.accounting"); auth.searchParams.set("state", state);
      return json({ url: auth.toString() }, 200, origin);
    }
    if (action === "status") return json(await connectionStatus(), 200, origin);
    if (action === "sync_drive") return json(await syncDrive(), 200, origin);
    if (action === "sync_quickbooks") return json(await syncQuickBooks(), 200, origin);
    if (action === "import_pending") return json(await importPending(Array.isArray(body.rows) ? body.rows as Json[] : []), 200, origin);
    if (action === "upload_approved") return json(await uploadApproved(), 200, origin);
    return json({ error: "Unknown action" }, 404, origin);
  } catch (cause) {
    const message = errorMessage(cause);
    return json({ error: message }, message.includes("Authentication") ? 401 : message.includes("access") ? 403 : 400, origin);
  }
});
