import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const js=ts.transpileModule(fs.readFileSync('src/lib/anchor-weeks.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {anchorTotals,initialAnchors,emptyAnchor,shiftWeek}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const item=(name,variation,sold,revenueCents)=>({name,variation,key:[name,variation,'each'],unit:'each',sold,revenueCents});
const report={weekStart:'2026-10-26',weekEnd:'2026-11-01',today:'2026-11-05',salesThrough:'2026-11-01',groups:null,template:null,candidates:[item('Girl Dinner','Regular',10,20000),item('Girl Dinner','With Truffle Fries',5,12000),item('"The Wedge" Salad','Regular',4,6000),item('Fries for the Table','Truffle Fries',3,3000),item('Sweet Potato Fries','Regular',2,2000),item('Steak Frites','8oz Bavette',6,20000),item('Cheese Flight','Regular',7,14000)]};
test('default anchor groups use real menu labels and combine variants without matching unrelated sides',()=>{
 const groups=initialAnchors(report);assert.equal(groups.length,5);
 assert.equal(groups.find(g=>g.id==='salad').members.length,1);
 assert.equal(groups.find(g=>g.id==='fries').members.length,1);
 const g=groups.find(g=>g.id==='girl');assert.equal(g.members.length,2);
 const t=anchorTotals(g,report);assert.equal(t.sold,15);assert.equal(t.revenue,320);assert.equal(t.expected,null);
});
test('portion reconciliation sums receipts and allocated costs; counts are never invented',()=>{
 const g={...initialAnchors(report).find(g=>g.id==='girl'),opening:20,closing:12,waste:1,adjustment:-2,activityComplete:true,deliveries:[{quantity:10,cost:42.10},{quantity:1,cost:0.20}]};
 const t=anchorTotals(g,report);assert.equal(t.received,11);assert.equal(t.spent,42.30);assert.equal(t.expected,13);assert.equal(t.variance,-1);
 assert.equal(anchorTotals({...g,opening:null},report).expected,null);
 assert.equal(anchorTotals({...g,activityComplete:false},report).expected,null);
 assert.equal(anchorTotals({...g,waste:null},report).expected,null);
 assert.equal(anchorTotals({...g,opening:0},report).expected,-7);
});
test('missing imports and lagging periods do not fabricate stock or zero sales',()=>{
 const g={...initialAnchors(report)[0],opening:10,waste:0,adjustment:0,activityComplete:true};
 assert.equal(anchorTotals(g,{...report,salesThrough:'2026-10-25'}).sold,null);
 assert.equal(anchorTotals(g,{...report,salesThrough:'2026-10-30'}).expected,null);
 assert.equal(anchorTotals({...g,members:[['missing','','each']]},report).sold,null);
});
test('new weeks copy group mapping only; saved reports retain counts and mappings',()=>{
 const prior={...emptyAnchor('g','Girl Dinner',[['Girl Dinner','Regular','each']]),opening:20,closing:5,activityComplete:true};
 const next=initialAnchors({...report,template:[prior]});assert.equal(next[0].opening,null);assert.equal(next[0].closing,null);assert.equal(next[0].activityComplete,false);assert.deepEqual(next[0].members,prior.members);
 assert.deepEqual(initialAnchors({...report,groups:[prior]}),[prior]);
 assert.equal(shiftWeek('2026-10-26',7),'2026-11-02');
});
