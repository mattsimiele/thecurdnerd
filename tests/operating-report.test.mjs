import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/lib/operating-report.ts',import.meta.url),'utf8');
const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
const {presetRange,rangeError,aggregateAccounts,categoryShares,percentChange,businessToday}=await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('presets use completed Monday-Sunday weeks and correct month boundaries',()=>{
 assert.deepEqual(presetRange('fourWeeks','2026-10-26'),{start:'2026-09-28',end:'2026-10-25'});
 assert.deepEqual(presetRange('week','2026-10-25'),{start:'2026-10-12',end:'2026-10-18'});
 assert.deepEqual(presetRange('month','2024-03-01'),{start:'2024-02-01',end:'2024-02-29'});
 assert.deepEqual(presetRange('month','2026-01-01'),{start:'2025-12-01',end:'2025-12-31'});
 assert.equal(businessToday(new Date('2026-10-26T02:00:00Z')),'2026-10-25');
});
test('invalid dates and reversed or overly large ranges are rejected',()=>{
 assert.ok(rangeError({start:'2026-02-30',end:'2026-03-02'}));
 assert.ok(rangeError({start:'',end:'2026-10-25'}));
 assert.ok(rangeError({start:'2026-10-26',end:'2026-10-25'}));
 assert.ok(rangeError({start:'2020-01-01',end:'2026-10-25'}));
 assert.equal(rangeError({start:'2026-10-25',end:'2026-10-25'}),null);
});
test('shared costs remain explicit and credits are not discarded',()=>{
 const rows=[{account:'Supplies',account_type:'Expense',allocation:'the-curd-nerd',current_cents:10000,previous_cents:9000,line_count:2},{account:'Supplies',account_type:'Expense',allocation:'shared',current_cents:5000,previous_cents:2000,line_count:1},{account:'Supplies',account_type:'Expense',allocation:'the-wedge',current_cents:-1000,previous_cents:1000,line_count:1}];
 assert.equal(aggregateAccounts(rows,'all')[0].current_cents,14000);
 assert.equal(aggregateAccounts(rows,'the-curd-nerd')[0].current_cents,10000);
 assert.equal(aggregateAccounts(rows,'shared')[0].current_cents,5000);
 assert.equal(aggregateAccounts(rows,'the-wedge')[0].current_cents,-1000);
 assert.equal(aggregateAccounts(rows,'all')[0].line_count,4);
});
test('all categories contribute to mix, including those beyond the former top 20',()=>{
 const rows=Array.from({length:43},(_,i)=>({category:`Category ${i}`,sales_cents:100}));
 const shares=categoryShares(rows);
 assert.equal(shares.length,43);
 assert.ok(Math.abs(shares.reduce((s,r)=>s+r.share,0)-100)<1e-9);
 assert.equal(categoryShares([{category:'Zero',sales_cents:0}])[0].share,null);
 assert.equal(percentChange(100,0),null);
 assert.equal(percentChange(50,100),-50);
});
