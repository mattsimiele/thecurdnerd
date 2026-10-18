"use client";

import { QuickBooksWorkflow } from "@/components/quickbooks-workflow";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function ReceiptsClient() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    getSupabaseBrowserClient().auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) router.replace("/login");
      else setReady(true);
    });
    return () => { active = false; };
  }, [router]);

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
    router.replace("/login");
  }

  if (!ready) return <main className="dashboard-loading"><div className="wordmark">THE CURD NERD<span>DATA HOUSE</span></div><p>Preparing the receipt queue…</p></main>;

  return <main className="dashboard-shell">
    <aside className="dash-sidebar">
      <div className="wordmark">THE CURD NERD<span>DATA HOUSE</span></div>
      <nav><Link href="/dashboard/">Financial dashboard</Link><Link className="active" href="/dashboard/receipts/">Receipts</Link></nav>
      <div className="sidebar-foot"><span className="status-dot" /> Authenticated data<button type="button" onClick={signOut}>Sign out</button></div>
    </aside>
    <section className="dash-content receipt-page">
      <header className="dash-header receipt-page-header"><div><p>QuickBooks + Google Drive</p><h1>Receipt desk</h1></div><Link className="button button-light" href="/dashboard/">Back to financials</Link></header>
      <QuickBooksWorkflow />
    </section>
  </main>;
}
