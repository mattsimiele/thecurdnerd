"use client";

import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import { aggregateAccounts, categoryShares, percentChange, presetRange, rangeError, type DateRange } from '@/lib/operating-report';
import type { ExpenseLinePage, OperatingReport } from '@/lib/report-types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useMemo, useState } from 'react';

const money = (value: number | null | undefined) => value == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value)/100);
const exactMoney = (value: number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value/100);
const number = (value: number) => new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value);
const change = (current: number, prior: number) => { const p=percentChange(current,prior); return p===null ? 'No positive prior baseline' : `${p>=0?'+':''}${p.toFixed(1)}%`; };
const date = (value: string | null) => value ? new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(`${value.slice(0,10)}T12:00:00Z`)) : 'Not available';
const imported = (value: string | null) => value ? new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York',timeZoneName:'short'}).format(new Date(value)) : 'No import recorded';
const labels: Record<string,string> = {'the-curd-nerd':'The Curd Nerd','the-wedge':'The Wedge',shared:'Shared',unassigned:'Unassigned',all:'All accessible costs'};

export function DashboardClient() {
  const router=useRouter();
  const [view,setView]=useState<'brief'|'expenses'|'sales'>('brief');
  const [range,setRange]=useState<DateRange>(()=>presetRange('fourWeeks'));
  const [draft,setDraft]=useState(range);
  const [validation,setValidation]=useState<string|null>(null);
  const [report,setReport]=useState<OperatingReport>();
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string>();
  const [retry,setRetry]=useState(0);
  const [allocation,setAllocation]=useState('all');
  const [salesScope,setSalesScope]=useState('all');
  const [search,setSearch]=useState('');
  const [sort,setSort]=useState('spend');
  const [account,setAccount]=useState<string>();
  const [offset,setOffset]=useState(0);
  const [lineResult,setLineResult]=useState<{key:string;page:ExpenseLinePage}>();
  const lineKey=JSON.stringify([account,allocation,offset,report?.startDate,report?.endDate]);
  const lines=lineResult?.key===lineKey?lineResult.page:undefined;
  const [lineError,setLineError]=useState<string>();
  const [lineLoading,setLineLoading]=useState(false);

  useEffect(()=>{
    let active=true;
    setLoading(true);setReport(undefined);setError(undefined);setAccount(undefined);setLineResult(undefined);
    async function load(){
      try {
        const client=getSupabaseBrowserClient();
        const {data:session}=await client.auth.getSession();
        if(!active)return;
        if(!session.session){router.replace('/login');return;}
        const response=await client.rpc('manager_operating_report',{p_start_date:range.start,p_end_date:range.end});
        if(!active)return;
        if(response.error)throw response.error;
        setReport(response.data as OperatingReport);
      } catch(e) {
        if(active)setError((e as {code?:string}).code==='42501'?'Your account does not have access to these reports.': 'The reports could not be loaded. Retry, or check that the operating-report database update has been installed.');
      } finally {if(active)setLoading(false);}
    }
    load();return()=>{active=false;};
  },[range,retry,router]);

  useEffect(()=>{
    let active=true;
    setLineResult(undefined);setLineError(undefined);
    if(!account||!report){setLineLoading(false);return;}
    setLineLoading(true);
    getSupabaseBrowserClient().rpc('manager_expense_lines',{p_start_date:report.startDate,p_end_date:report.endDate,p_account:account,p_allocation:allocation==='all'?null:allocation,p_offset:offset})
      .then(({data,error})=>{if(!active)return;if(error)setLineError('Transaction details could not be loaded. Close and reopen this account to retry.');else setLineResult({key:JSON.stringify([account,allocation,offset,report.startDate,report.endDate]),page:data as ExpenseLinePage});setLineLoading(false);},()=>{if(active){setLineError('Transaction details could not be loaded.');setLineLoading(false);}});
    return()=>{active=false;};
  },[account,allocation,offset,report]);

  const accounts=useMemo(()=>aggregateAccounts(report?.accounts??[],allocation).filter(r=>r.account.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>sort==='increase'?(b.current_cents-b.previous_cents)-(a.current_cents-a.previous_cents):b.current_cents-a.current_cents),[report,allocation,search,sort]);
  const total=(report?.accounts??[]).reduce((s,r)=>s+Number(r.current_cents),0);
  const shared=(report?.accounts??[]).filter(r=>r.allocation==='shared').reduce((s,r)=>s+Number(r.current_cents),0);
  const unassigned=(report?.accounts??[]).filter(r=>r.allocation==='unassigned').reduce((s,r)=>s+Number(r.current_cents),0);
  const shownBusinesses=report?.businesses.filter(b=>salesScope==='all'||b.slug===salesScope)??[];
  const categories=categoryShares((report?.categories??[]).filter(c=>salesScope==='all'||c.slug===salesScope));
  const vendors=useMemo(()=>{
    const groups=new Map<string,{vendor:string;current:number;previous:number}>();
    (report?.vendors??[]).filter(v=>v.account===account&&(allocation==='all'||v.allocation===allocation)).forEach(v=>{const r=groups.get(v.vendor)??{vendor:v.vendor,current:0,previous:0};r.current+=Number(v.current_cents);r.previous+=Number(v.previous_cents);groups.set(v.vendor,r);});
    return [...groups.values()].sort((a,b)=>b.current-a.current);
  },[report,account,allocation]);
  function choosePreset(key:'week'|'fourWeeks'|'month'){const next=presetRange(key);setDraft(next);setRange(next);setValidation(null);}
  function showAccount(name:string){setView('expenses');setAllocation('all');setSearch('');setAccount(name);setOffset(0);}
  async function signOut(){await getSupabaseBrowserClient().auth.signOut();router.replace('/login');}

  return <main className="ops-shell">
    <a className="ops-skip" href="#operating-content">Skip to reports</a>
    <header className="ops-mast"><Link href="/dashboard/" className="ops-wordmark">THE CURD NERD<span>DATA HOUSE</span></Link><nav aria-label="Dashboard"><button aria-current={view==='brief'?'page':undefined} onClick={()=>setView('brief')}>Owner brief</button><button aria-current={view==='expenses'?'page':undefined} onClick={()=>setView('expenses')}>Expense review</button><button aria-current={view==='sales'?'page':undefined} onClick={()=>setView('sales')}>Sales detail</button><Link href="/dashboard/receipts/">Receipts</Link></nav><button className="ops-signout" onClick={signOut}>Sign out</button></header>
    <section className="ops-content" id="operating-content">
      <div className="ops-heading"><div><p className="ops-eyebrow">{report?.businesses.map(b=>b.name).join(" + ")||"Business reports"}</p><h1>{view==='brief'?'Your owner brief':view==='expenses'?'Understand the spend':'See what is selling'}</h1><p>{view==='brief'?'Business performance, costs, and the next things to review.':view==='expenses'?'Start with an account. Follow the dollars to vendors and transactions.':'Sales history with product variants and units kept intact.'}</p></div></div>
      <div className="ops-range"><div className="ops-presets" aria-label="Date presets"><button onClick={()=>choosePreset('week')}>Last complete week</button><button onClick={()=>choosePreset('fourWeeks')}>Last 4 complete weeks</button><button onClick={()=>choosePreset('month')}>Last calendar month</button></div><form onSubmit={e=>{e.preventDefault();const err=rangeError(draft);setValidation(err);if(!err)setRange({...draft});}}><label>From<input type="date" value={draft.start} onChange={e=>setDraft({...draft,start:e.target.value})}/></label><label>Through<input type="date" value={draft.end} onChange={e=>setDraft({...draft,end:e.target.value})}/></label><button className="ops-primary" disabled={loading}>Apply</button></form></div>
      {validation&&<p role="alert" className="ops-error">{validation}</p>}
      {loading&&<div className="ops-loading" role="status"><h2>Preparing your reports</h2><p>Loading both businesses and checking the comparison period…</p><div/><div/></div>}
      {error&&<div role="alert" className="ops-error"><p>{error}</p><button onClick={()=>setRetry(retry+1)}>Retry reports</button></div>}
      {report&&!loading&&<>
        <p className="ops-period"><strong>{date(report.startDate)} – {date(report.endDate)}</strong><span>Compared with {date(report.previousStartDate)} – {date(report.previousEndDate)} · equal-length preceding period</span></p>
        {view==='brief'&&<>
          <div className="ops-businesses">{report.businesses.map(b=><article className="ops-business" key={b.slug}><div className="ops-business-title"><h2>{b.name}</h2><span>{change(b.sales_cents,b.previous_sales_cents)}</span></div><p className="ops-eyebrow">Item sales · before return reconciliation</p><strong className="ops-value">{money(b.sales_cents)}</strong><p className="ops-comparison">Previous {money(b.previous_sales_cents)}{!b.previous_observed_days?' · no recorded comparison sales':''}</p><dl><div><dt>Sales transactions</dt><dd>{number(b.tickets)} <small>previous {number(b.previous_tickets)}</small></dd></div><div><dt>Average sales ticket</dt><dd>{b.tickets?money(b.sales_cents/b.tickets):'—'}</dd></div><div><dt>Direct expenses</dt><dd>{money(b.direct_expense_cents)}</dd></div></dl><p className="ops-note">Shared costs excluded. This is not business profit.</p><div className="ops-freshness"><span>Sales through {date(b.sales_through)}</span><small>Imported {imported(b.sales_imported_at)}</small><span>Direct accounting through {date(b.accounting_through)}</span><small>Imported {imported(b.accounting_imported_at)} · books not certified closed</small></div></article>)}</div>
          <section className="ops-section"><div className="ops-section-head"><h2>What needs attention</h2><span>Evidence to review, not automatic spending cuts</span></div>
            {report.sharedVisible?<div className="ops-action"><span className="ops-action-number">01</span><div><h3>{money(shared+unassigned)} still sits outside the business split</h3><p>{money(shared)} shared · {money(unassigned)} unassigned{total>0?` · ${(shared/total*100).toFixed(1)}% of imported expenses are shared`:''}. Review allocation before comparing business profitability.</p></div><button onClick={()=>{setView('expenses');setAllocation('shared');setAccount(undefined);}}>Review shared costs</button></div>:<div className="ops-notice">Shared costs are outside your access scope. These reports show direct business expenses only.</div>}
            {(()=>{const all=aggregateAccounts(report.accounts,'all');const tax=all.find(a=>a.account==='Payroll expenses:Payroll taxes');const wages=all.find(a=>a.account==='Payroll expenses:Salaries & wages');return tax&&tax.current_cents!==0?<div className="ops-action"><span className="ops-action-number">02</span><div><h3>Reconcile {money(tax.current_cents)} in payroll taxes</h3><p>{wages&&wages.current_cents>0?`${(tax.current_cents/wages.current_cents*100).toFixed(1)}% of imported wages. `:''}Confirm employee withholding, employer taxes, and ADP settlement entries before judging labor cost.</p></div><button onClick={()=>showAccount(tax.account)}>Review account</button></div>:null;})()}
            <div className="ops-action"><span className="ops-action-number">03</span><div><h3>Keep sales definitions visible</h3><p>{money(report.businesses.reduce((s,b)=>s+Number(b.gift_card_cents),0))} confirmed gift-card issuance excluded; {money(report.businesses.reduce((s,b)=>s+Number(b.unverified_gift_card_cents),0))} historical gift-card-labelled rows held out for verification. Recorded item returns: {money(report.recordedReturns.reduce((s,r)=>s+Number(r.return_cents),0))}, shown separately.</p></div><button onClick={()=>setView('sales')}>Review sales</button></div>
          </section>
          <section className="ops-section"><div className="ops-section-head"><h2>Largest imported accounts</h2><button onClick={()=>{setView('expenses');setAllocation('all');}}>All expense accounts</button></div><div className="ops-table-wrap"><table><thead><tr><th>Account</th><th className="num">Selected period</th><th className="num">Previous period</th><th className="num">Change</th></tr></thead><tbody>{aggregateAccounts(report.accounts,'all').sort((a,b)=>b.current_cents-a.current_cents).slice(0,5).map(a=><tr key={a.account}><td><button className="ops-link" onClick={()=>showAccount(a.account)}>{a.account}</button></td><td className="num">{money(a.current_cents)}</td><td className="num">{money(a.previous_cents)}</td><td className="num">{money(a.current_cents-a.previous_cents)}</td></tr>)}</tbody></table></div>{!report.accounts.length&&<p>No classified expense lines in either period. Check accounting coverage before interpreting this as zero spending.</p>}</section>
        </>}
        {view==='expenses'&&<>
          <div className="ops-cost-summary"><div><span>Total accessible expenses</span><strong>{money(total)}</strong></div><div><span>Direct business costs</span><strong>{money(total-shared-unassigned)}</strong></div><div><span>Shared / unassigned</span><strong>{report.sharedVisible?money(shared+unassigned):'Outside access'}</strong></div></div>
          <p className="ops-note">Accounting transactions through {date(report.accountingDataThrough)} · imported {imported(report.accountingImportedAt)} · books not certified closed.</p>
          <p className="ops-note">Expenses include purchases classified as COGS. Purchase timing is not inventory usage or profit. Shared costs are not silently split between businesses.</p>
          <div className="ops-filters"><label>Business / allocation<select value={allocation} onChange={e=>{setAllocation(e.target.value);setAccount(undefined);setOffset(0);}}><option value="all">All accessible costs</option>{report.businesses.map(b=><option key={b.slug} value={b.slug}>{b.name} · direct only</option>)}{report.sharedVisible&&<><option value="shared">Shared</option><option value="unassigned">Unassigned</option></>}</select></label><label>Find account<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Account name"/></label><label>Sort by<select value={sort} onChange={e=>setSort(e.target.value)}><option value="spend">Largest spend</option><option value="increase">Largest dollar increase</option></select></label></div>
          <div className="ops-table-wrap"><table><thead><tr><th>Account</th><th className="num">Selected period</th><th className="num">Previous</th><th className="num">Difference</th><th className="num">Change</th><th className="num">Lines</th></tr></thead><tbody>{accounts.map(a=><Fragment key={a.account}><tr className={account===a.account?'ops-selected':''}><td><button className="ops-link" aria-expanded={account===a.account} onClick={()=>{setAccount(account===a.account?undefined:a.account);setOffset(0);}}>{a.account}</button><small className="ops-cell-note">{a.account_type}</small></td><td className="num">{money(a.current_cents)}</td><td className="num">{money(a.previous_cents)}</td><td className="num">{money(a.current_cents-a.previous_cents)}</td><td className="num">{change(a.current_cents,a.previous_cents)}</td><td className="num">{number(a.line_count)}</td></tr>{account===a.account&&<tr><td colSpan={6} className="ops-expanded"><h3>{a.account} · {labels[allocation]??allocation}</h3><div className="ops-vendors">{vendors.map(v=><div key={v.vendor}><span>{v.vendor}</span><strong>{money(v.current)}</strong><small>Previous {money(v.previous)}</small></div>)}</div><h4>Source transactions</h4>{lineLoading&&<p role="status">Loading transaction details…</p>}{lineError&&<p role="alert" className="ops-error">{lineError}</p>}{lines&&<><table aria-label={`${a.account} transactions`}><thead><tr><th>Date</th><th>Vendor</th><th>Allocation</th><th>Source reference</th><th className="num">Amount</th></tr></thead><tbody>{lines.rows.map(l=><tr key={l.id}><td>{date(l.transaction_date)}</td><td>{l.vendor}</td><td>{labels[l.allocation]??l.allocation}</td><td>{l.entity_type} {l.source_id??'—'}</td><td className="num">{exactMoney(l.amount_cents)}</td></tr>)}</tbody></table>{!lines.total&&<p>No expense lines in the selected period.</p>}<div className="ops-pagination"><span>{lines.total?`${offset+1}–${Math.min(offset+50,lines.total)} of ${number(lines.total)} lines`:'0 lines'}</span><button disabled={offset===0||lineLoading} onClick={()=>setOffset(Math.max(0,offset-50))}>Previous</button><button disabled={offset+50>=lines.total||lineLoading} onClick={()=>setOffset(offset+50)}>Next</button><Link href="/dashboard/receipts/">Open receipt desk</Link></div></>}</td></tr>}</Fragment>)}</tbody></table></div>{!accounts.length&&<p className="ops-notice">No accounts match this view. Missing imports do not mean zero spending.</p>}
        </>}
        {view==='sales'&&<>
          <div className="ops-filters"><label htmlFor="sales-business">Business<select id="sales-business" aria-label="Business" value={salesScope} onChange={e=>setSalesScope(e.target.value)}><option value="all">Both accessible businesses</option>{report.businesses.map(b=><option key={b.slug} value={b.slug}>{b.name}</option>)}</select></label></div>
          <div className="ops-notice"><strong>What this sales measure includes</strong><p>Completed item sales, excluding confirmed gift-card issuance and separately flagged historical gift-card names. Recorded item returns are displayed below, not deducted again from mixed historical imports. This measure is not certified net revenue.</p>{shownBusinesses.map(b=><p key={b.slug}>{b.name}: {money(b.gift_card_cents)} confirmed gift cards excluded · {money(b.unverified_gift_card_cents)} awaiting gift-card verification · {number(b.uncategorized_lines)} uncategorized lines · {number(b.unknown_unit_lines)} lines without a known unit · {money(report.recordedReturns.find(r=>r.slug===b.slug)?.return_cents??0)} recorded item returns.</p>)}</div>
          <section className="ops-section"><div className="ops-section-head"><h2>Daily item sales</h2><span>Every calendar day · no rows does not establish a closure or zero sales</span></div><div className="ops-table-wrap ops-daily"><table><thead><tr><th>Date</th>{shownBusinesses.map(b=><th key={b.slug} className="num">{b.name}</th>)}</tr></thead><tbody>{[...new Set(report.daily.map(d=>d.business_date))].map(day=><tr key={day}><td>{date(day)}</td>{shownBusinesses.map(b=>{const r=report.daily.find(d=>d.business_date===day&&d.slug===b.slug);return <td className="num" key={b.slug}>{r?.source_lines?money(r.sales_cents):<span className="ops-cell-note">No recorded rows</span>}</td>;})}</tr>)}</tbody></table></div></section>
          <section className="ops-section"><div className="ops-section-head"><h2>Category mix</h2><span>All categories included in the denominator</span></div><div className="ops-category-list">{categories.map(c=><div key={c.category}><span>{c.category}</span><strong>{money(c.cents)}</strong><span>{c.share===null?'—':`${c.share.toFixed(1)}%`}</span></div>)}</div></section>
          <section className="ops-section"><div className="ops-section-head"><h2>Item and variant performance</h2><span>Top 50 item / variant / unit groups per business · quantities are never summed across units</span></div><div className="ops-table-wrap"><table><thead><tr><th>Business</th><th>Item / variant</th><th className="num">Quantity</th><th>Unit</th><th className="num">Item sales</th></tr></thead><tbody>{report.items.filter(i=>salesScope==='all'||i.slug===salesScope).map((i,index)=><tr key={`${i.slug}-${i.catalog_variation_id}-${index}`}><td>{labels[i.slug]??i.slug}</td><td>{i.item_name}<small className="ops-cell-note">{i.variation_name||'No named variant'}</small></td><td className="num">{number(i.quantity)}</td><td>{i.quantity_unit}</td><td className="num">{money(i.sales_cents)}</td></tr>)}</tbody></table></div></section>
        </>}
        <footer className="ops-footer">Source: Square item imports and classified QuickBooks expense lines. Current months may be incomplete; equal-length comparisons are not seasonally adjusted. <Link href="/privacy/">Privacy</Link> · <Link href="/terms/">Terms</Link></footer>
      </>}
    </section>
  </main>;
}
