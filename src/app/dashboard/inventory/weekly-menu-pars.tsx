'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import { weeklyParProgress, type WeeklyParReport, type WeeklyParRow } from '@/lib/weekly-pars';
const number=(n:number|null)=>n===null?'—':new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n);
export function WeeklyMenuPars({businessId,canEdit,onEditingChange}:{businessId:string;canEdit:boolean;onEditingChange:(busy:boolean)=>void}) {
 const [report,setReport]=useState<WeeklyParReport>();
 const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [retry,setRetry]=useState(0);
 const [search,setSearch]=useState('');const [page,setPage]=useState(0);
 const [editing,setEditing]=useState<WeeklyParRow>();const [target,setTarget]=useState('');const [confirmed,setConfirmed]=useState(false);
 const [saving,setSaving]=useState(false);const [saveError,setSaveError]=useState('');const [notice,setNotice]=useState('');
 useEffect(()=>{let active=true;setLoading(true);setError('');setPage(0);
 getSupabaseBrowserClient().rpc('manager_weekly_menu_pars',{p_business_id:businessId}).then(({data,error})=>{
 if(!active)return;if(error)setError('Weekly pars could not be loaded. Retry to reconnect.');else setReport(data);setLoading(false);
 },()=>{if(active){setError('Weekly pars could not be loaded. Retry to reconnect.');setLoading(false);}});
 return()=>{active=false;};},[businessId,retry]);
 useEffect(()=>{onEditingChange(!!editing||saving);return()=>onEditingChange(false);},[editing,saving,onEditingChange]);
 function edit(row:WeeklyParRow){setEditing(row);setTarget(row.par===null?'':String(row.par));setConfirmed(row.confirmed);setSaveError('');setNotice('');}
 async function save(e:FormEvent){e.preventDefault();if(!editing||saving)return;setSaving(true);setSaveError('');
 try{const {data,error}=await getSupabaseBrowserClient().rpc('manager_save_weekly_menu_par',{p_business_id:businessId,p_key:editing.key,p_revision:editing.revision,p_par:Number(target),p_confirmed:confirmed});
 if(error)throw error;setReport(old=>old?{...old,rows:old.rows.map(r=>JSON.stringify(r.key)===JSON.stringify(editing.key)?{...r,par:Number(data.weekly_par),confirmed:data.unknown_units_confirmed,revision:data.revision}:r)}:old);
 setNotice(`Saved weekly par for ${editing.name}.`);setEditing(undefined);
 }catch(e){setSaveError(['40001','23505'].includes((e as {code?:string}).code??'')?'This par changed elsewhere. Close the editor and refresh before saving again.':'Could not save the weekly par. Check the quantity and your connection.');}finally{setSaving(false);}}
 if(loading)return <section className="ops-loading" role="status">Loading Monday–Sunday sales and weekly pars…</section>;
 if(error)return <p className="ops-error" role="alert">{error} <button onClick={()=>setRetry(n=>n+1)}>Retry weekly pars</button></p>;
 if(!report)return null;
 const visible=report.rows.filter(r=>`${r.name} ${r.variation} ${r.members.join(' ')}`.toLowerCase().includes(search.toLowerCase()));
 const hasCurrent=!!report.salesThrough&&report.salesThrough>=report.weekStart;
 const draft=editing?weeklyParProgress({...editing,confirmed},report):null;
 return <section className="ops-section">
 <div className="ops-section-head"><h2>This week against prep pars</h2><button disabled={saving||!!editing} onClick={()=>setRetry(n=>n+1)}>Refresh weekly sales</button></div>
 <p><strong>Monday {report.weekStart} – Sunday {report.weekEnd}</strong></p>
 <p className="ops-note">Historical average: four complete Monday–Sunday weeks, {report.baselineStart} – {report.baselineEnd}. Sales available through {report.salesThrough??'unknown'}; this is imported data, not a live till count.</p>
 <div className="ops-notice">Dessert is one combined category alongside the other menu items. A weekly prep par is the number of servings you plan to cover for Monday–Sunday. “Remaining to par” is par minus recorded sales—not stock on hand. Ingredient order pars still include supplier lead time and buffer stock in the weekly order list.</div>
 {!hasCurrent?<p className="ops-notice" role="status">No sales have been imported for this week yet. Progress stays blank until current-week sales arrive.</p>:report.salesThrough!<report.today&&<p className="ops-notice">This week is partial: sales are only available through {report.salesThrough}. Later sales are not included in progress.</p>}
 {notice&&<p className="ops-notice" role="status">{notice}</p>}
 {editing&&<form className="inv-editor ops-section" onSubmit={save} aria-label="Weekly par editor">
 <div className="ops-section-head"><h3>Weekly par · {editing.name}{editing.variation?` · ${editing.variation}`:''}</h3><button type="button" disabled={saving} onClick={()=>setEditing(undefined)}>Close weekly par</button></div>
 <label>Monday–Sunday par ({editing.unit})<input autoFocus required type="number" min="0" max="1000000" step="any" value={target} onChange={e=>setTarget(e.target.value)}/></label>
 {editing.unknownLines>0&&<><p className="ops-note">Four-week source quantities: {number(editing.baselineKnown)} with a known unit + {number(editing.baselineUnknown)} with an unknown unit. This week: {number(editing.currentKnown)} known + {number(editing.currentUnknown)} unknown. Verify that unknown quantities represent the same selling unit before combining them.</p><label className="inv-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I verified that unknown source quantities represent {editing.unit==='each'?'individual servings / orders':editing.unit} for this group.</label></>}
 {draft?.weeklyAverage!==null&&draft?.weeklyAverage!==undefined&&<p className="ops-note">Observed four-week average: {number(draft.weeklyAverage)} {editing.unit} per week. <button type="button" onClick={()=>setTarget(String(editing.unit==='each'?Math.ceil(draft.weeklyAverage!):Math.ceil(draft.weeklyAverage!*100)/100))}>Use historical average</button> Adjust for expected demand before saving.</p>}
 {draft?.unitIssue&&<p className="ops-note">{draft.unitIssue}. You can save a planning par now; combined historical averages need verified units. Current-week progress uses this week’s units independently.</p>}
 {saveError&&<p className="ops-error" role="alert">{saveError}</p>}<button className="ops-primary" disabled={saving} type="submit">{saving?'Saving…':'Save weekly par'}</button>
 </form>}
 <p className="ops-note">Units use explicit Square or historical labels first, then a consistent unit for the same item and variation. If neither exists, fractional quantities use lb and whole quantities use each. Conflicting item units remain unverified. Current-week progress also requires imported sales.</p>
 <div className="ops-filters"><label>Find menu item or dessert<input value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}/></label></div>
 <div className="ops-table-wrap"><table aria-label="Weekly prep par progress"><thead><tr><th>Menu item</th><th className="num">Last 4 weeks sold</th><th className="num">Average / week</th><th className="num">Weekly par</th><th className="num">Sold this week</th><th className="num">Remaining to par</th><th>Week progress</th><th>Action</th></tr></thead><tbody>{visible.slice(page*15,(page+1)*15).map(row=>{
 const progress=weeklyParProgress(row,report);
 return <tr key={JSON.stringify(row.key)}><td><strong>{row.name}</strong><span className="ops-cell-note">{row.variation|| (row.key[0]==='category'?'All dessert selections':'Standard variation')} · {row.unit}</span>{row.key[0]==='category'&&<details><summary>Included desserts</summary><p className="ops-note">{row.members.length?row.members.join(', '):'No dessert sales in this period.'}</p></details>}</td>
 <td className="num">{number(row.baselineKnown)} {row.unit}{Number(row.baselineUnknown)!==0&&<span className="ops-cell-note">+ {number(row.baselineUnknown)} {row.confirmed?row.unit:'unverified units'}</span>}</td>
 <td className="num">{progress.weeklyAverage!==null?number(progress.weeklyAverage):<>{number(Number(row.baselineKnown)/4)} {row.unit}<span className="ops-cell-note">+ {number(Number(row.baselineUnknown)/4)} unverified / week</span></>}{progress.weeklyAverage===null&&<span className="ops-cell-note">Shown separately; not a confirmed total</span>}</td>
 <td className="num">{row.par===null?'Not set':number(row.par)}</td>
 <td className="num">{!hasCurrent?'Awaiting imports':progress.sold!==null?number(progress.sold):<>{number(row.currentKnown)} {row.unit}<span className="ops-cell-note">+ {number(row.currentUnknown)} unverified units</span></>}</td>
 <td className="num">{progress.remaining===null?(row.par===null?'Set par first':!hasCurrent?'Awaiting imports':'Verify units'):number(progress.remaining)}</td>
 <td>{!hasCurrent?'Awaiting this week’s imports':progress.currentIssue??(row.par===null?'Set weekly par':progress.over!>0?`${number(progress.over)} over par`:progress.remaining===0?'Par reached':`${number(progress.percent)}% of weekly par`)}{progress.percent!==null&&<progress aria-label={`${row.name} sold against weekly par`} max={100} value={Math.min(100,Math.max(0,progress.percent))}/>}</td>
 <td>{canEdit?<button disabled={saving||!!editing} onClick={()=>edit(row)}>{row.par===null?'Set weekly par':'Edit weekly par'}</button>:'View only'}</td></tr>;
 })}</tbody></table></div>
 {!visible.length&&<p className="ops-notice">No menu items match this view.</p>}
 {visible.length>15&&<div className="ops-pagination"><span>{page*15+1}–{Math.min((page+1)*15,visible.length)} of {visible.length}</span><button disabled={!page} onClick={()=>setPage(p=>p-1)}>Previous items</button><button disabled={(page+1)*15>=visible.length} onClick={()=>setPage(p=>p+1)}>Next items</button></div>}
 <p className="ops-note">A partial week is never averaged as a completed week. Dessert progress counts servings across the category; ingredient demand still uses each dessert’s own recipe. Weekly pars repeat each week until you edit them. Spoilage, production, reservations, and incoming stock are not inferred from sales.</p>
 </section>;
}
