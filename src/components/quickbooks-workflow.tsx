"use client";

import type { QuickBooksReceiptStatus, QuickBooksWorkflowReport, QuickBooksWorkflowTransaction } from "@/lib/report-types";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ChangeEvent, useCallback, useEffect, useState } from "react";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const receiptFolderUrl = process.env.NEXT_PUBLIC_RECEIPTS_DRIVE_FOLDER_URL || "https://drive.google.com/drive/folders/1yebBnCTdPhYPLrc4aylHWORLs9-vsn9n";
const apiUrl = process.env.NEXT_PUBLIC_RECEIPTS_API_URL || `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/receipt-workflow`;
const labels: Record<QuickBooksReceiptStatus, string> = {
  needs_receipt: "Find receipt", matched: "Matched", approved: "Approved — post in QuickBooks",
  uploaded: "Uploaded earlier — sync to attach", posted: "Posted", needs_review: "Needs review", held: "Held",
};

function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { cell += '"'; index++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index++;
      row.push(cell); if (row.some((value) => value.trim())) rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  row.push(cell); if (row.some((value) => value.trim())) rows.push(row);
  if (rows.length < 2) throw new Error("The CSV has no transaction rows.");
  const headers = rows[0].map((value) => value.trim().toLowerCase());
  const column = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const dateIndex = column("date", "transaction date");
  const descriptionIndex = column("bank description", "description");
  const amountIndex = column("amount");
  const accountIndex = column("account", "account name");
  const vendorIndex = column("from/to", "vendor", "payee");
  const locationIndex = column("business", "location");
  const categoryIndex = column("match/categorize", "category");
  if (dateIndex < 0 || descriptionIndex < 0 || amountIndex < 0) throw new Error("The export needs Date, Bank description, and Amount columns.");
  return rows.slice(1).map((values) => {
    const rawDate = values[dateIndex]?.trim() ?? "";
    const match = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/);
    const transactionDate = match ? `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}` : rawDate;
    const rawAmount = values[amountIndex] ?? "";
    const number = Number(rawAmount.replace(/[$,()]/g, ""));
    const signed = /\(.*\)/.test(rawAmount) ? -Math.abs(number) : number;
    return {
      account_name: accountIndex >= 0 ? values[accountIndex]?.trim() : "QuickBooks bank feed",
      transaction_date: transactionDate, description: values[descriptionIndex]?.trim(),
      amount_cents: Math.round(signed * 100), vendor: vendorIndex >= 0 ? values[vendorIndex]?.trim() : "",
      location: locationIndex >= 0 ? values[locationIndex]?.trim() : "",
      category: categoryIndex >= 0 ? values[categoryIndex]?.trim() : "",
    };
  }).filter((item) => item.transaction_date && item.description && Number.isSafeInteger(item.amount_cents));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function ApprovalRow({ transaction, onComplete }: { transaction: QuickBooksWorkflowTransaction; onComplete: () => Promise<void> }) {
  const [vendor, setVendor] = useState(transaction.vendor || transaction.description);
  const [category, setCategory] = useState(transaction.category || "Cost of Goods Sold");
  const [location, setLocation] = useState(transaction.location || "The Curd Nerd");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const ready = transaction.status === "matched" || transaction.status === "needs_review";

  async function approve() {
    setSaving(true); setError(undefined);
    const supabase = getSupabaseBrowserClient();
    const { error: approvalError } = await supabase.rpc("approve_quickbooks_receipt", {
      p_transaction_id: transaction.id, p_vendor: vendor, p_category: category, p_location: location,
    });
    if (approvalError) { setError(approvalError.message); setSaving(false); return; }
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch(`${apiUrl}?action=upload_approved`, {
        method: "POST", headers: { Authorization: `Bearer ${data.session?.access_token}`, "Content-Type": "application/json" }, body: "{}",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The receipt could not be uploaded.");
      await onComplete();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Upload failed"); }
    setSaving(false);
  }

  return <tr>
    <td><input aria-label="Vendor" value={vendor} onChange={(event) => setVendor(event.target.value)} disabled={!ready} /><span className="qb-muted">{transaction.description}</span></td>
    <td>{formatDate(transaction.transaction_date)}<span className="qb-muted">{transaction.account_name}</span></td>
    <td className="qb-amount">{money.format(Math.abs(transaction.amount_cents) / 100)}</td>
    <td>{transaction.receipt_name ? <a href={transaction.receipt_path || receiptFolderUrl} target="_blank" rel="noreferrer"><strong>{transaction.receipt_name}</strong><span className="qb-muted">{transaction.receipt_confidence ? `${Math.round(transaction.receipt_confidence * 100)}% match` : "View PDF"}</span></a> : <span className="qb-muted">No PDF matched</span>}</td>
    <td>{ready ? <div className="qb-review-fields"><input aria-label="Category" value={category} onChange={(event) => setCategory(event.target.value)} /><select aria-label="Business location" value={location} onChange={(event) => setLocation(event.target.value as "The Curd Nerd" | "The Wedge" | "TCN/Wedge")}><option>The Curd Nerd</option><option>The Wedge</option><option>TCN/Wedge</option></select><button onClick={approve} disabled={saving || !transaction.receipt_name}>{saving ? "Approving…" : "Approve receipt"}</button>{error && <span className="qb-row-error">{error}</span>}</div> : <><span className={`qb-status qb-status-${transaction.status.replaceAll("_", "-")}`}>{transaction.status === "posted" && transaction.receipt_name ? "Posted + attached" : labels[transaction.status]}</span>{["approved", "uploaded"].includes(transaction.status) && <span className="qb-muted">Payee: {transaction.vendor}<br />Category: {transaction.category}<br />Location: {transaction.location}</span>}</>}</td>
  </tr>;
}

export function QuickBooksWorkflow() {
  const [report, setReport] = useState<QuickBooksWorkflowReport>();
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getSupabaseBrowserClient().rpc("manager_quickbooks_workflow");
    if (error) setNotice("The hosted receipt workflow has not been deployed to Supabase yet.");
    else { setReport(data as QuickBooksWorkflowReport); setNotice(undefined); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function callIntegration(action: string, body: object = {}) {
    setWorking(action); setNotice(undefined);
    try {
      const { data } = await getSupabaseBrowserClient().auth.getSession();
      if (!data.session) throw new Error("Sign in again before connecting an integration.");
      const response = await fetch(`${apiUrl}?action=${action}`, {
        method: "POST", headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The integration request failed.");
      if (typeof result.url === "string") window.location.assign(result.url);
      else { await load(); setNotice(action === "sync_drive" ? `Indexed ${result.indexed} PDFs; matched ${result.matched}.` : action === "sync_quickbooks" ? `Synced ${result.written} posted QuickBooks transactions and attached ${result.attached ?? 0} approved receipts.` : "Sync completed."); }
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "The integration request failed."); }
    setWorking(undefined);
  }

  async function importExport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const rows = parseCsv(await file.text()); setWorking("import_pending");
      const { data } = await getSupabaseBrowserClient().auth.getSession();
      const response = await fetch(`${apiUrl}?action=import_pending`, {
        method: "POST", headers: { Authorization: `Bearer ${data.session?.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ rows }),
      });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Import failed");
      await load(); setNotice(`Imported ${result.written} open rows; matched ${result.matched} receipts.`);
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "The QuickBooks export could not be read."); }
    setWorking(undefined); event.target.value = "";
  }

  const rows = report?.transactions ?? [];
  const activeRows = rows.filter((row) => row.status !== "posted");
  const postedRows = rows.filter((row) => row.status === "posted");
  const counts = {
    open: rows.filter((row) => row.status !== "posted").length,
    matched: activeRows.filter((row) => Boolean(row.receipt_name)).length,
    approval: activeRows.filter((row) => ["matched", "needs_review"].includes(row.status)).length,
    waiting: activeRows.filter((row) => ["approved", "uploaded"].includes(row.status)).length,
  };

  return <section className="qb-workflow" id="quickbooks">
    <div className="qb-workflow-head"><div><p>QuickBooks workflow</p><h2>Receipts to review</h2><span className="qb-subtitle">Drive supplies the PDFs. Open banking rows come from a QuickBooks export; posted accounting records sync through the API.</span></div><a className="button button-light" href={receiptFolderUrl} target="_blank" rel="noreferrer">Open Drive folder</a></div>
    <div className="qb-stats"><div><strong>{counts.open}</strong><span>Open</span></div><div><strong>{counts.matched}</strong><span>Receipt matched</span></div><div><strong>{counts.approval}</strong><span>Ready for approval</span></div><div><strong>{counts.waiting}</strong><span>Approved, awaiting post</span></div></div>
    {counts.waiting > 0 && <p className="qb-guidance"><strong>{counts.waiting} approved receipt{counts.waiting === 1 ? " is" : "s are"} waiting for a QuickBooks transaction.</strong> Post the matching bank-feed transaction in QuickBooks, then expand Connections and imports and choose <b>Sync posted</b>. The sync will find its QuickBooks ID and attach the PDF to that transaction.</p>}
    {notice && <p className="qb-notice">{notice}</p>}
    {!loading && !activeRows.length ? <div className="qb-empty"><strong>No open transactions need attention</strong><span>Import the QuickBooks Banking export to add “For review” transactions and match their receipts.</span></div> : <div className="qb-table-wrap"><table className="qb-table"><thead><tr><th>Vendor</th><th>Date / account</th><th>Amount</th><th>Receipt</th><th>Review</th></tr></thead><tbody>{activeRows.map((transaction) => <ApprovalRow transaction={transaction} onComplete={load} key={transaction.id} />)}</tbody></table></div>}
    <details className="qb-collapsible" open={!report?.connections?.google_drive || !report?.connections?.quickbooks}>
      <summary><span>Connections and imports</span><small>Google Drive, QuickBooks, and Banking CSV</small></summary>
      <div className="qb-connectors"><article><div><span>Google Drive</span><strong>{report?.connections?.google_drive ? "Connected" : "Not connected"}</strong></div><button onClick={() => callIntegration("google_authorize", { return_to: window.location.href })}>{report?.connections?.google_drive ? "Reconnect" : "Connect"}</button><button disabled={!report?.connections?.google_drive || !!working} onClick={() => callIntegration("sync_drive")}>Index PDFs</button></article><article><div><span>QuickBooks</span><strong>{report?.connections?.quickbooks ? "Connected" : "Not connected"}</strong></div><button onClick={() => callIntegration("quickbooks_authorize", { return_to: window.location.href })}>{report?.connections?.quickbooks ? "Reconnect" : "Connect"}</button><button disabled={!report?.connections?.quickbooks || !!working} onClick={() => callIntegration("sync_quickbooks")}>Sync posted</button></article><label className="qb-import"><span>Banking “For review”</span><strong>Import QuickBooks CSV</strong><input type="file" accept=".csv,text/csv" onChange={importExport} disabled={!!working} /></label></div>
    </details>
    <details className="qb-collapsible">
      <summary><span>Posted transaction history</span><small>{postedRows.length} synced transactions</small></summary>
      {!postedRows.length ? <div className="qb-empty"><span>No posted transactions have been synced yet.</span></div> : <div className="qb-table-wrap"><table className="qb-table"><thead><tr><th>Vendor</th><th>Date / account</th><th>Amount</th><th>Receipt</th><th>Status</th></tr></thead><tbody>{postedRows.map((transaction) => <ApprovalRow transaction={transaction} onComplete={load} key={transaction.id} />)}</tbody></table></div>}
    </details>
  </section>;
}
