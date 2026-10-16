"use client";

import type { AccountingReport, ManagerBusiness, SalesReport } from "@/lib/report-types";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function cents(value: number | null | undefined) {
  return money.format(Number(value ?? 0) / 100);
}

export function DashboardClient() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<ManagerBusiness[]>([]);
  const [scope, setScope] = useState("combined");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedRange, setAppliedRange] = useState<{ start: string; end: string }>();
  const [sales, setSales] = useState<SalesReport>();
  const [accounting, setAccounting] = useState<AccountingReport>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    async function initialize() {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }
      const { data, error: businessError } = await supabase.rpc("manager_businesses");
      if (!active) return;
      if (businessError) {
        setError("Your account is signed in but has not been assigned to a business.");
        setLoading(false);
        return;
      }
      const access = (data ?? []) as ManagerBusiness[];
      if (!access.length) {
        setError("Your account is signed in but has not been assigned to a business.");
        setLoading(false);
        return;
      }
      const latest = access.map((item) => item.latest_sales_date).sort().at(-1)!;
      const initialRange = { start: shiftDate(latest, -6), end: latest };
      setBusinesses(access);
      setScope(access.length > 1 ? "combined" : access[0].slug);
      setStartDate(initialRange.start);
      setEndDate(initialRange.end);
      setAppliedRange(initialRange);
    }
    initialize();
    return () => { active = false; };
  }, [router]);

  const loadReports = useCallback(async () => {
    if (!appliedRange) return;
    setLoading(true);
    setError(undefined);
    const supabase = getSupabaseBrowserClient();
    const args = {
      p_business_slug: scope === "combined" ? null : scope,
      p_start_date: appliedRange.start,
      p_end_date: appliedRange.end,
    };
    const [salesResponse, accountingResponse] = await Promise.all([
      supabase.rpc("manager_sales_report", args),
      supabase.rpc("manager_accounting_report", args),
    ]);
    if (salesResponse.error) {
      setError(salesResponse.error.message.includes("access denied") ? "You do not have access to that business." : "The sales report could not be loaded.");
      setLoading(false);
      return;
    }
    setSales(salesResponse.data as SalesReport);
    setAccounting(accountingResponse.error ? undefined : accountingResponse.data as AccountingReport);
    setLoading(false);
  }, [appliedRange, scope]);

  useEffect(() => { loadReports(); }, [loadReports]);

  const dailySeries = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of sales?.daily ?? []) totals.set(row.business_date, (totals.get(row.business_date) ?? 0) + Number(row.net_sales_cents));
    return [...totals.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, value]) => ({ date, value }));
  }, [sales]);
  const maxDaily = Math.max(...dailySeries.map((point) => point.value), 1);
  const chartPoints = dailySeries.length > 1 ? dailySeries.map((point, index) => `${index / (dailySeries.length - 1) * 100},${96 - point.value / maxDaily * 88}`).join(" ") : "0,96 100,96";
  const categoryTotal = (sales?.categories ?? []).reduce((sum, item) => sum + Number(item.net_sales_cents), 0);
  const colors = ["#d8ff52", "#b45c34", "#789876", "#d8aa52", "#7583a5"];
  const categoryStops = (sales?.categories ?? []).slice(0, 5).reduce<{ offset: number; stops: string[] }>((result, item, index) => {
    const share = categoryTotal ? Number(item.net_sales_cents) / categoryTotal * 100 : 0;
    const end = result.offset + share;
    result.stops.push(`${colors[index]} ${result.offset}% ${end}%`);
    result.offset = end;
    return result;
  }, { offset: 0, stops: [] }).stops.join(", ");

  function applyDates(event: FormEvent) {
    event.preventDefault();
    if (startDate && endDate && startDate <= endDate) setAppliedRange({ start: startDate, end: endDate });
  }

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
    router.replace("/login");
  }

  if (!sales && loading) return <main className="dashboard-loading"><div className="wordmark">THE CURD NERD<span>DATA HOUSE</span></div><p>Preparing your reports…</p></main>;
  if (!sales && error) return <main className="dashboard-loading"><div className="wordmark">THE CURD NERD<span>DATA HOUSE</span></div><p>{error}</p><button className="button button-dark" onClick={signOut}>Sign out</button></main>;
  if (!sales) return null;

  const scopeLabel = scope === "combined" ? "Combined" : businesses.find((item) => item.slug === scope)?.name ?? scope;
  const yoy = sales.yearOverYear.percentChange;
  const uncategorized = sales.categories.find((item) => item.category === "Uncategorized");

  return <main className="dashboard-shell">
    <aside className="dash-sidebar">
      <div className="wordmark">THE CURD NERD<span>DATA HOUSE</span></div>
      <nav><a className="active" href="#overview">Overview</a><a href="#sales">Sales history</a><a href="#items">Items</a><a href="#finance">Finance</a></nav>
      <div className="sidebar-foot"><span className="status-dot" /> Authenticated data<button type="button" onClick={signOut}>Sign out</button></div>
    </aside>
    <section className="dash-content" id="overview">
      <header className="dash-header"><div><p>{shortDate.format(new Date(`${appliedRange!.start}T12:00:00Z`))}–{shortDate.format(new Date(`${appliedRange!.end}T12:00:00Z`))}</p><h1>{scopeLabel}</h1></div><div className="business-switcher">{businesses.length > 1 && <button className={scope === "combined" ? "selected" : ""} onClick={() => setScope("combined")}>Combined</button>}{businesses.map((business) => <button className={scope === business.slug ? "selected" : ""} onClick={() => setScope(business.slug)} key={business.slug}>{business.name}</button>)}</div></header>
      <form className="report-controls" onSubmit={applyDates}><label>From<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label>Through<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label><button disabled={loading}>{loading ? "Refreshing…" : "Apply range"}</button></form>
      {error && <p className="report-error" role="alert">{error}</p>}
      <section className="brief"><div><p>Historical manager report</p><h2>{yoy === null ? "No comparable prior-year period is available." : `Net sales are ${Math.abs(yoy).toFixed(1)}% ${yoy >= 0 ? "ahead of" : "behind"} the same dates last year.`}</h2></div><span>{sales.summary.latestImportAt ? `Updated ${shortDate.format(new Date(sales.summary.latestImportAt))}` : "No import recorded"}</span></section>
      <section className="metric-grid">
        <article><p>Net sales</p><strong>{cents(sales.summary.netSalesCents)}</strong><span>{yoy === null ? "No prior-year comparison" : `${yoy >= 0 ? "↑" : "↓"} ${Math.abs(yoy).toFixed(1)}% year over year`}</span></article>
        <article><p>Transactions</p><strong>{integer.format(sales.summary.transactionCount)}</strong><span>Distinct Square transactions</span></article>
        <article><p>Average ticket</p><strong>{cents(sales.summary.averageTicketCents)}</strong><span>Net sales per transaction</span></article>
        <article><p>Items sold</p><strong>{integer.format(sales.summary.itemQuantity)}</strong><span>{cents(sales.summary.taxCents)} collected tax</span></article>
      </section>
      <section className="dashboard-grid" id="sales">
        <article className="sales-chart"><div className="panel-head"><div><p>Selected period</p><h3>Daily net sales</h3></div><div className="legend"><span><i className="today" />{dailySeries.length} days with sales</span></div></div><div className="chart-wrap"><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Daily net sales"><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d8ff52" stopOpacity=".38"/><stop offset="1" stopColor="#d8ff52" stopOpacity="0"/></linearGradient></defs><polygon points={`0,100 ${chartPoints} 100,100`} fill="url(#chartFill)"/><polyline points={chartPoints} fill="none" stroke="#d8ff52" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg><div className="chart-labels"><span>{dailySeries.at(0)?.date}</span><span>Daily history</span><span>{dailySeries.at(-1)?.date}</span></div></div></article>
        <article className="mix-panel"><div className="panel-head"><div><p>Revenue mix</p><h3>Top categories</h3></div></div><div className="donut" style={{ background: `conic-gradient(${categoryStops || "#d8ff52 0 100%"})` }}><div><strong>{cents(sales.summary.netSalesCents)}</strong><span>net sales</span></div></div><div className="mix-legend">{sales.categories.slice(0, 5).map((item, index) => <div key={item.category}><span><i style={{ background: colors[index] }} />{item.category}</span><strong>{categoryTotal ? (Number(item.net_sales_cents) / categoryTotal * 100).toFixed(1) : "0.0"}%</strong></div>)}</div></article>
        <article className="attention-panel"><div className="panel-head"><div><p>Data quality</p><h3>Known items to review</h3></div></div><ul><li><i className={uncategorized ? "critical" : "good"} /><div><strong>{integer.format(Number(uncategorized?.item_quantity ?? 0))} uncategorized items</strong><span>Within the selected date range</span></div><b>{uncategorized ? "Review" : "Clear"}</b></li><li><i /><div><strong>{accounting?.summary.transactionCount ?? 0} accounting rows</strong><span>Available for this date range and access scope</span></div><b>Imported</b></li><li><i className="good" /><div><strong>Access filtered</strong><span>Reports include only assigned businesses</span></div><b>Secure</b></li></ul></article>
        <article className="prime-panel" id="finance"><p>QuickBooks COGS</p><strong>{cents(accounting?.summary.cogsCents)}</strong><div><i style={{ width: sales.summary.netSalesCents ? `${Math.min(100, Number(accounting?.summary.cogsCents ?? 0) / sales.summary.netSalesCents * 100)}%` : "0%" }} /></div><span>Accounting data through {accounting?.summary.latestTransactionDate ?? "not available"}</span></article>
      </section>
      <section className="report-table-panel" id="items"><div className="panel-head"><div><p>Item performance</p><h3>Top items by net sales</h3></div></div><div className="report-table-wrap"><table><thead><tr><th>Item</th><th>Category</th><th>Quantity</th><th>Net sales</th></tr></thead><tbody>{sales.items.map((item) => <tr key={`${item.category}-${item.item_name}`}><td>{item.item_name}</td><td>{item.category}</td><td>{integer.format(Number(item.item_quantity))}</td><td>{cents(item.net_sales_cents)}</td></tr>)}</tbody></table></div></section>
    </section>
  </main>;
}
