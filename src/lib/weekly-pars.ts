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
 const weeklyAverage=unitIssue?null:(Number(row.baselineKnown)+Number(row.baselineUnknown))/4;
 const sold=!unitIssue&&report.salesThrough&&report.salesThrough>=report.weekStart?Number(row.currentKnown)+Number(row.currentUnknown):null;
 const remaining=sold!==null&&row.par!==null?Math.max(0,Number(row.par)-sold):null;
 const over=sold!==null&&row.par!==null?Math.max(0,sold-Number(row.par)):null;
 const percent=sold!==null&&row.par!==null&&row.par>0?sold/row.par*100:null;
 return {unitIssue,weeklyAverage,sold,remaining,over,percent};
}
