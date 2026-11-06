export type AnchorCandidate={key:string[];name:string;variation:string;unit:string;sold:number;revenueCents:number;lastSale:string};
export type AnchorDelivery={date:string;quantity:number;cost:number|null;reference:string};
export type AnchorGroup={id:string;name:string;members:string[][];opening:number|null;closing:number|null;waste:number|null;adjustment:number|null;deliveries:AnchorDelivery[];activityComplete:boolean;notes:string};
export type AnchorReport={weekStart:string;weekEnd:string;today:string;salesThrough:string|null;revision:number|null;updatedAt:string|null;groups:AnchorGroup[]|null;template:AnchorGroup[]|null;templateWeek:string|null;candidates:AnchorCandidate[]};
export const keyOf=(key:string[])=>JSON.stringify(key);
export function emptyAnchor(id:string,name:string,members:string[][]=[]):AnchorGroup{return {id,name,members,opening:null,closing:null,waste:null,adjustment:null,deliveries:[],activityComplete:false,notes:''};}
export function initialAnchors(report:AnchorReport):AnchorGroup[]{
 if(report.groups)return report.groups;
 if(report.template)return report.template.map(g=>emptyAnchor(g.id,g.name,g.members));
 const definitions:[string,string,RegExp][]=[['salad','Wedge Salads',/wedge["”]?\s+salad/i],['fries','French Fries',/^(french\s+fries|fries|truffle\s+fries|fries\s+for\s+the\s+table)$/i],['steak','Steak Frites',/steak\s+frites/i],['girl','Girl Dinner',/girl\s+dinner/i],['cheese','Cheese Flights',/cheese\s+flight/i]];
 return definitions.map(([id,name,pattern])=>emptyAnchor(id,name,report.candidates.filter(c=>c.unit==='each'&&pattern.test(c.name)).map(c=>c.key)));
}
export function anchorTotals(group:AnchorGroup,report:AnchorReport){
 const selected=report.candidates.filter(c=>group.members.some(k=>keyOf(k)===keyOf(c.key)));
 const missing=selected.length!==group.members.length||selected.some(c=>c.unit!=='each');
 const available=!!report.salesThrough&&report.salesThrough>=report.weekStart&&group.members.length>0&&!missing;
 const sold=available?selected.reduce((sum,c)=>sum+Number(c.sold),0):null;
 const revenue=available?selected.reduce((sum,c)=>sum+Number(c.revenueCents),0)/100:null;
 const received=group.deliveries.reduce((sum,d)=>sum+Number(d.quantity),0);
 const spent=group.deliveries.some(d=>d.cost===null)?null:group.deliveries.reduce((sum,d)=>sum+Math.round(Number(d.cost)*100),0)/100;
 const through=report.weekEnd<report.today?report.weekEnd:report.today;
 const lag=!report.salesThrough||report.salesThrough<through;
 const expected=group.opening!==null&&group.waste!==null&&group.adjustment!==null&&group.activityComplete&&sold!==null&&!lag?Number(group.opening)+received-sold-Number(group.waste)+Number(group.adjustment):null;
 const variance=expected!==null&&group.closing!==null?Number(group.closing)-expected:null;
 const issue=!group.members.length?'Choose menu items':missing?'Review missing or incompatible selections':!available?'Awaiting sales imports':lag?'Sales imports lag this period':group.opening===null?'Enter opening count':!group.activityComplete||group.waste===null||group.adjustment===null?'Confirm deliveries and other usage':group.closing===null?(report.weekEnd>report.today?'Week in progress':'Enter closing count'):null;
 return {sold,revenue,received,spent,expected,variance,issue};
}
export function shiftWeek(date:string,days:number){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
