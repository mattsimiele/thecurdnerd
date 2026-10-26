export type InventoryItem = {
 id: string; business_id: string; name: string; unit: string; supplier: string;
 par: number | null; pack_size: number | null; lead_days: number | null; buffer_days: number;
 on_hand: number | null; inbound: number; counted_at: string | null; notes: string; revision: number;
};
export type Candidate = {business_id:string; item_name:string; variation_name:string; quantity_unit:string; quantity:number; selling_days:number; sales_cents:number};
export type InventoryReport = {startDate:string;endDate:string;serverNow:string;businesses:{id:string;slug:string;name:string;role:string;salesThrough:string|null}[];items:InventoryItem[];candidates:Candidate[]};
export function recommendation(item: InventoryItem, now = Date.now()) {
 const missing: string[] = [];
 if (item.par === null) missing.push('Set par');
 if (!item.supplier.trim()) missing.push('Add supplier');
 if (item.pack_size === null || item.pack_size <= 0) missing.push('Set pack size');
 if (item.lead_days === null) missing.push('Set lead time');
 if (item.on_hand === null || !item.counted_at) missing.push('Count stock');
 else if (!Number.isFinite(Date.parse(item.counted_at)) || now-Date.parse(item.counted_at)>24*60*60*1000 || Date.parse(item.counted_at)>now+60000) missing.push('Refresh count');
 if (missing.length) return {quantity:null,packs:null,missing};
 const shortage = Math.max(0,Number(item.par)-Number(item.on_hand)-Number(item.inbound));
 const packs = Math.ceil(Math.max(0,shortage/Number(item.pack_size)-1e-9));
 return {quantity:Math.round(packs*Number(item.pack_size)*1000000)/1000000,packs,missing};
}
export function proposedPar(weekly:number,lead:number,buffer:number) {
 return Math.ceil(weekly*(7+lead+buffer)/7*100)/100;
}
// Quoting alone does not prevent spreadsheet formula execution.
export function csvCell(value: unknown) {
 const text=String(value??'');
 return '"'+(/^[\s]*[=+@-]/.test(text)?"'"+text:text).replaceAll('"','""')+'"';
}
export function orderCsv(items:InventoryItem[],business:string,now=Date.now()) {
 const rows:unknown[][]=[['Business','Supplier','Item','Unit','Par','Usable on hand','Confirmed inbound','Pack size','Packs to order','Quantity to order','Status','Counted at','Notes']];
 for(const item of [...items].sort((a,b)=>a.supplier.localeCompare(b.supplier)||a.name.localeCompare(b.name))){
 const r=recommendation(item,now);
 rows.push([business,item.supplier,item.name,item.unit,item.par,item.on_hand,item.inbound,item.pack_size,r.packs,r.quantity,r.missing.join('; ')||(r.quantity?'Review and order':'At par'),item.counted_at,item.notes]);
 }
 return rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
