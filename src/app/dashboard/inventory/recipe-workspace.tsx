'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import { proposedPar, recommendation, type InventoryItem } from '@/lib/inventory';
import { ingredientDemand, menuKey, recipeProblem, type MenuSale, type Recipe, type RecipePlan } from '@/lib/recipes';

const format = (n:number) => new Intl.NumberFormat('en-US',{maximumFractionDigits:6}).format(n);
type Line = {item_id:string;quantity:string};
type Props = {
 businessId:string;canEdit:boolean;items:InventoryItem[];
 onItemUpdated:(item:InventoryItem)=>void;onEditingChange:(editing:boolean)=>void;
};

export function RecipeWorkspace({businessId,canEdit,items,onItemUpdated,onEditingChange}:Props) {
 const [plan,setPlan]=useState<RecipePlan>();
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [retry,setRetry]=useState(0);
 const [search,setSearch]=useState('');
 const [filter,setFilter]=useState('all');
 const [menuPage,setMenuPage]=useState(0);
 const [selected,setSelected]=useState<MenuSale>();
 const [editing,setEditing]=useState<Recipe>();
 const [yieldValue,setYieldValue]=useState('');
 const [lines,setLines]=useState<Line[]>([]);
 const [notes,setNotes]=useState('');
 const [active,setActive]=useState(true);
 const [verified,setVerified]=useState(false);
 const [reviewed,setReviewed]=useState(false);
 const [saving,setSaving]=useState(false);
 const [saveError,setSaveError]=useState('');
 const [notice,setNotice]=useState('');
 useEffect(()=>{
  let current=true;setLoading(true);setError('');setReviewed(false);setMenuPage(0);
  getSupabaseBrowserClient().rpc('manager_recipe_plan',{p_business_id:businessId}).then(({data,error})=>{
   if(!current)return;
   if(error)setError('Recipes could not be loaded. Retry to reconnect.');else setPlan(data);
   setLoading(false);
  },()=>{if(current){setError('Recipes could not be loaded. Retry to reconnect.');setLoading(false);}});
  return()=>{current=false;};
 },[businessId,retry]);
 useEffect(()=>{onEditingChange(!!selected||saving);return()=>onEditingChange(false);},[selected,saving,onEditingChange]);
 const demand=useMemo(()=>plan?ingredientDemand(plan,items):null,[plan,items]);
 const menu=useMemo(()=>{
  if(!plan)return [];
  const keys=new Set(plan.menu.map(menuKey));
  return [...plan.menu,...plan.recipes.filter(r=>!keys.has(menuKey(r))).map(r=>({...r,quantity:0,sales_cents:0}))];
 },[plan]);
 const visible=menu.filter(m=>{
  const r=plan?.recipes.find(r=>menuKey(r)===menuKey(m));
  return `${m.item_name} ${m.variation_name} ${m.sales_unit}`.toLowerCase().includes(search.toLowerCase())&&
   (filter==='all'||(filter==='unmapped'?!!recipeProblem(r,items):!recipeProblem(r,items)));
 });
 function open(sale:MenuSale){
  const recipe=plan?.recipes.find(r=>menuKey(r)===menuKey(sale));
  setSelected(sale);setEditing(recipe);setYieldValue(recipe?String(recipe.batch_yield):'');
  setLines(recipe?recipe.ingredients.map(c=>({item_id:c.item_id,quantity:String(c.quantity)})):[{item_id:'',quantity:''}]);
  setNotes(recipe?.notes??'');setActive(recipe?.active??true);setVerified(false);setSaveError('');setNotice('');
  setTimeout(()=>document.getElementById('recipe-editor')?.scrollIntoView({behavior:'smooth',block:'start'}),0);
 }
 function updateLine(index:number,patch:Partial<Line>){setLines(old=>old.map((line,i)=>i===index?{...line,...patch}:line));setVerified(false);}
 async function save(event:FormEvent){
  event.preventDefault();if(!selected||saving)return;
  if(new Set(lines.map(l=>l.item_id)).size!==lines.length){setSaveError('Combine repeated ingredients into a single batch quantity.');return;}
  setSaving(true);setSaveError('');
  try{
   const {data,error}=await getSupabaseBrowserClient().rpc('manager_save_recipe',{
    p_business_id:businessId,p_recipe_id:editing?.id??null,p_revision:editing?.revision??null,
    p_values:{item_name:selected.item_name,variation_name:selected.variation_name,sales_unit:selected.sales_unit,
     batch_yield:yieldValue,ingredients:lines,notes,active,verified}
   });
   if(error)throw error;
   setPlan(old=>old?{...old,recipes:[...old.recipes.filter(r=>r.id!==data.id),data]}:old);
   setSelected(undefined);setMenuPage(0);setReviewed(false);setNotice('Recipe saved. Ingredient demand has been recalculated; saved pars have not changed.');
  }catch(e){
   const code=(e as {code?:string}).code;
   setSaveError(code==='40001'||code==='23505'?'This mapping changed elsewhere. Close the form and reload recipes before saving again.':'Could not save. Check quantities, active ingredients, and access, then retry.');
  }finally{setSaving(false);}
 }
 async function applyPar(item:InventoryItem,par:number){
  if(saving)return;setSaving(true);setNotice('');setSaveError('');
  try{
   const {data,error}=await getSupabaseBrowserClient().rpc('manager_save_inventory',{
    p_business_id:businessId,p_item_id:item.id,p_revision:item.revision,p_values:{...item,par},p_count:false
   });
   if(error)throw error;onItemUpdated(data);setNotice(`Saved ${format(par)} ${item.unit} as the par for ${item.name}. Review the weekly order list after counting stock.`);
  }catch(e){setSaveError((e as {code?:string}).code==='40001'?'Inventory changed elsewhere. Refresh inventory before applying this par.':'The par could not be saved. Check your connection and retry.');}
  finally{setSaving(false);}
 }
 if(loading)return <section className="ops-loading" role="status">Loading Wedge recipes and menu sales…</section>;
 if(error)return <section className="ops-error" role="alert">{error} <button onClick={()=>setRetry(n=>n+1)}>Retry recipes</button></section>;
 if(!plan||!demand)return null;
 return <section className="ops-section">
  <div className="ops-section-head"><h2>From menu sales to ingredients</h2><button disabled={saving||!!selected} onClick={()=>setRetry(n=>n+1)}>Reload recipes</button></div>
  <p className="ops-note">{plan.startDate} – {plan.endDate} · four complete weeks · sales available through {plan.salesThrough??'unknown'}. Includes every positive-quantity menu / variation / source-unit combination in the period, beyond the top-100 shortlist.</p>
  <div className="ops-cost-summary"><div><span>Menu combinations mapped</span><strong>{demand.mapped} / {demand.total}</strong></div><div><span>Need a recipe or ingredient repair</span><strong>{demand.total-demand.mapped}</strong></div><div><span>Ingredients with mapped demand</span><strong>{demand.rows.length}</strong></div></div>
  <div className="ops-notice">Demand is an estimate from current recipes applied to recent sales, not stock depletion. Unmapped dishes, modifiers, substitutions, prep waste, events, and stockouts can change actual needs. Enter purchased ingredient quantities for a batch and its actual sellable yield; include trim or cooking loss in those quantities and yield, without adding it twice.</div>
  {!demand.fresh&&<p className="ops-error" role="alert">Sales have not reached the end of this planning period. Review imports before using suggested pars; applying them is disabled.</p>}
  {notice&&<p className="ops-notice" role="status">{notice}</p>}
  {!selected&&saveError&&<p className="ops-error" role="alert">{saveError}</p>}
  {!items.length&&<p className="ops-notice">Add Wedge’s purchased ingredients using “Add inventory item” above, then map them to dishes here. You can save ingredients before setting suppliers, counts, or pars.</p>}

  {selected&&<section className="inv-editor ops-section" id="recipe-editor" aria-label="Recipe editor">
   <div className="ops-section-head"><h2>{editing?'Edit recipe':'Map recipe'} · {selected.item_name}</h2><button disabled={saving} onClick={()=>setSelected(undefined)}>Close recipe</button></div>
   <p>{selected.variation_name||'Standard variation'} · source unit: <strong>{selected.sales_unit}</strong> · {format(selected.quantity/4)} sold per week</p>
   {selected.sales_unit==='Unknown'&&<p className="ops-error">Square did not supply a usable unit for these sales. Verify what one source quantity represents before mapping it. This mapping stays separate from “each” sales of the same dish.</p>}
   <form onSubmit={save}>
    <div className="inv-fields"><label>Sellable units produced per batch<input autoFocus required type="number" step="any" min="0.000001" max="1000000" value={yieldValue} onChange={e=>{setYieldValue(e.target.value);setVerified(false);}} placeholder="e.g. 12 portions"/></label><p className="ops-note">For one serving, enter 1 and its ingredient quantities. For a batch, enter its actual saleable yield. Yield must use the same selling quantity as this exact menu variation.</p></div>
    <h3>Purchased ingredients per batch</h3>
    <p className="ops-note">Quantities use each ingredient’s stock unit: for example, enter 0.5 lb for 8 oz. Use the purchased amount consumed, before trim or cooking loss. Prepared sub-recipes must be expanded into their purchased ingredients.</p>
    {lines.map((line,index)=>{
     const item=items.find(i=>i.id===line.item_id);
     const saved=editing?.ingredients.find(i=>i.item_id===line.item_id);
     return <div className="recipe-line" key={index}>
      <label>Ingredient {index+1}<select required value={line.item_id} onChange={e=>updateLine(index,{item_id:e.target.value,quantity:''})}><option value="">Choose an ingredient</option>{!item&&line.item_id&&<option value={line.item_id}>{saved?.name??'Missing ingredient'} (archived)</option>}{items.map(i=><option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}</select></label>
      <label>Batch quantity ({item?.unit??saved?.unit??'stock units'})<input required type="number" min="0.000001" max="1000000" step="any" value={line.quantity} onChange={e=>updateLine(index,{quantity:e.target.value})}/></label>
      <button type="button" disabled={lines.length===1||saving} onClick={()=>{setLines(old=>old.filter((_,i)=>i!==index));setVerified(false);}}>Remove ingredient {index+1}</button>
     </div>;
    })}
    <button type="button" disabled={lines.length>=100||saving} onClick={()=>{setLines(old=>[...old,{item_id:'',quantity:''}]);setVerified(false);}}>Add recipe ingredient</button>
    <label className="recipe-notes">Recipe notes<input maxLength={2000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Yield checks, preparation losses, substitutions…"/></label>
    <label className="inv-check"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/>Use this recipe in demand calculations</label>
    <label className="inv-check"><input type="checkbox" required={active} checked={verified} onChange={e=>setVerified(e.target.checked)}/>I verified the selling unit, variation, batch yield, and all ingredient quantities.</label>
    {saveError&&<p className="ops-error" role="alert">{saveError}</p>}
    <button className="ops-primary" disabled={saving||(!items.length&&active)} type="submit">{saving?'Saving…':'Save recipe'}</button>
   </form>
  </section>}

  <section className="ops-section"><div className="ops-section-head"><h2>1. Map the menu</h2><a href="#ingredient-demand">Jump to ingredient demand ↓</a></div>
   <div className="ops-filters"><label>Find menu item<input value={search} onChange={e=>{setSearch(e.target.value);setMenuPage(0);}} placeholder="Search dishes and variations"/></label><label>Recipe status<select value={filter} onChange={e=>{setFilter(e.target.value);setMenuPage(0);}}><option value="all">All menu items</option><option value="unmapped">Needs mapping / repair</option><option value="mapped">Mapped</option></select></label></div>
   {!visible.length?<p className="ops-notice">No menu items match this view.</p>:<div className="ops-table-wrap"><table aria-label="Menu recipe mappings"><thead><tr><th>Dish / variation</th><th>Source unit</th><th className="num">Weekly sales</th><th>Recipe status</th><th>Action</th></tr></thead><tbody>{visible.slice(menuPage*15,(menuPage+1)*15).map(sale=>{
    const r=plan.recipes.find(r=>menuKey(r)===menuKey(sale));const problem=recipeProblem(r,items);
    return <tr key={menuKey(sale)}><td>{sale.item_name}<span className="ops-cell-note">{sale.variation_name||'Standard variation'}{sale.quantity===0?' · No sales in this period':''}</span></td><td>{sale.sales_unit}</td><td className="num">{format(sale.quantity/4)}</td><td>{problem??`${r!.ingredients.length} ingredients · ${format(r!.batch_yield)} sale units / batch`}{r&&!r.active&&<span className="ops-cell-note">Mapping disabled</span>}</td><td>{canEdit?<button disabled={saving||!!selected} onClick={()=>open(sale)}>{r?'Edit recipe':'Map recipe'}</button>:'View only'}</td></tr>;
   })}</tbody></table></div>}
   {visible.length>15&&<div className="ops-pagination"><span>{menuPage*15+1}–{Math.min((menuPage+1)*15,visible.length)} of {visible.length} menu combinations</span><button disabled={menuPage===0} onClick={()=>setMenuPage(p=>p-1)}>Previous menu items</button><button disabled={(menuPage+1)*15>=visible.length} onClick={()=>setMenuPage(p=>p+1)}>Next menu items</button></div>}
  </section>

  <section className="ops-section" id="ingredient-demand"><div className="ops-section-head"><h2>2. Review ingredient demand</h2><span>{!demand.total?'No sales in this period':demand.mapped<demand.total?'Partial coverage — mapped dishes only':'All current menu combinations mapped'}</span></div>
   <p className="ops-note">Weekly ingredient demand = four-week menu sales ÷ 4 ÷ batch yield × batch ingredient quantity, summed across dishes. Suggested par covers 7 review days + supplier lead days + planning buffer. It replaces a confirmed par only when you apply it. This is a rolling average, not a forecast for a specific event or holiday.</p>
   {canEdit&&!!demand.rows.length&&<label className="inv-check"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>I reviewed mapping gaps, source units, sales freshness, and needs outside these recipes before applying pars.</label>}
   {!demand.rows.length?<p className="ops-notice">Map your first recipe to see ingredient demand. Missing mappings are not treated as zero demand.</p>:<div className="ops-table-wrap"><table><thead><tr><th>Ingredient / source dishes</th><th className="num">Demand / week</th><th className="num">Saved par</th><th className="num">Suggested par</th><th>Order preview with suggested par</th><th>Action</th></tr></thead><tbody>{demand.rows.map(row=>{
    const target=row.item.lead_days===null?null:proposedPar(row.weekly,row.item.lead_days,row.item.buffer_days);
    const validTarget=target!==null&&target<=1000000&&demand.fresh;
    const preview=validTarget?recommendation({...row.item,par:target}):null;
    return <tr key={row.item.id}><td><strong>{row.item.name}</strong><span className="ops-cell-note">{row.item.supplier||'Supplier needed'} · {row.item.unit}</span><details><summary>See {row.contributions.length} source dishes</summary>{row.contributions.map(c=><p className="ops-note" key={c.dish}>{c.dish}: {format(c.weekly)} {row.item.unit}/week</p>)}</details></td><td className="num">{format(row.weekly)} {row.item.unit}</td><td className="num">{row.item.par===null?'—':format(row.item.par)}</td><td className="num">{target===null?'Set lead time':format(target)}{target!==null&&<span className="ops-cell-note">{7+Number(row.item.lead_days)+row.item.buffer_days} days covered</span>}</td><td>{!validTarget?'Resolve lead time, sales freshness, or target limit':preview?.quantity===null?preview.missing.join(' · '):`${format(preview!.packs!)} packs · ${format(preview!.quantity!)} ${row.item.unit}`}<span className="ops-cell-note">Planning preview; review before ordering</span></td><td>{canEdit?<button disabled={!reviewed||!validTarget||saving||!!selected} onClick={()=>applyPar(row.item,target!)}>Apply suggested par</button>:'View only'}</td></tr>;
   })}</tbody></table></div>}
   <p className="ops-note">After applying a par, use “Weekly order list” to count stock and export the supplier review. Demand does not automatically subtract from on-hand stock or send orders.</p>
  </section>
 </section>;
}
