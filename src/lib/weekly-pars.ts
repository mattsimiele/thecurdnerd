export type WeeklyParRow = {
 key:string[];name:string;variation:string;unit:string;baselineKnown:number;baselineUnknown:number;
 currentKnown:number;currentUnknown:number;unknownLines:number;incompatibleLines:number;members:string[];
 par:number|null;confirmed:boolean;revision:number|null;
};
export type WeeklyParReport = {
 weekStart:string;weekEnd:string;today:string;baselineStart:string;baselineEnd:string;
 salesThrough:string|null;importedAt:string|null;rows:WeeklyParRow[];
};
export function weeklyParProgress(row:WeeklyParRow,report:WeeklyParReport) {
 const unitIssue=row.incompatibleLines>0?'Incompatible source units':row.unknownLines>0&&!row.confirmed?'Verify unknown selling units':null;
 const baselineIssue=row.incompatibleLines>0||(Number(row.baselineUnknown)!==0&&!row.confirmed);
 const currentIssue=row.incompatibleLines>0?'Incompatible source units':Number(row.currentUnknown)!==0&&!row.confirmed?'Verify this week’s selling units':null;
 const weeklyAverage=baselineIssue?null:(Number(row.baselineKnown)+Number(row.baselineUnknown))/4;
 const sold=!currentIssue&&report.salesThrough&&report.salesThrough>=report.weekStart?Number(row.currentKnown)+Number(row.currentUnknown):null;
 const remaining=sold!==null&&row.par!==null?Math.max(0,Number(row.par)-sold):null;
 const over=sold!==null&&row.par!==null?Math.max(0,sold-Number(row.par)):null;
 const percent=sold!==null&&row.par!==null&&row.par>0?sold/row.par*100:null;
 return {unitIssue,currentIssue,weeklyAverage,sold,remaining,over,percent};
}

export function suggestedWeeklyPar(row:WeeklyParRow,report:WeeklyParReport):{quantity:number|null;reason:string|null} {
 if(row.unit==='Unknown')return {quantity:null,reason:'Resolve the selling unit first'};
 const average=weeklyParProgress(row,report).weeklyAverage;
 if(average===null)return {quantity:null,reason:'Verify historical units'};
 if(!report.salesThrough||report.salesThrough<report.baselineEnd)return {quantity:null,reason:'Historical imports are incomplete'};
 if(!Number.isFinite(average)||average<=0)return {quantity:null,reason:'No positive historical sales'};
 const quantity=row.unit==='each'?Math.ceil(average):Math.ceil(average*100)/100;
 if(quantity>1000000)return {quantity:null,reason:'Quantity needs manual review'};
 return {quantity,reason:null};
}
