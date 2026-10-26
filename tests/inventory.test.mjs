import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(fs.readFileSync('src/lib/inventory.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {recommendation,proposedPar,orderCsv}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const now=Date.parse('2026-10-26T12:00:00Z');
const item={id:'1',business_id:'a',name:'Cheese',unit:'lb',supplier:'Vendor',par:20,pack_size:5,lead_days:2,buffer_days:2,on_hand:6,inbound:3,counted_at:new Date(now).toISOString(),notes:'',revision:1};
test('rounds shortages to supplier packs and subtracts inbound once',()=>assert.deepEqual(recommendation(item,now),{quantity:15,packs:3,missing:[]}));
test('zero is a real count, missing and stale counts block ordering',()=>{
 assert.equal(recommendation({...item,on_hand:0,inbound:0},now).quantity,20);
 assert.equal(recommendation({...item,on_hand:null,counted_at:null},now).quantity,null);
 assert.equal(recommendation(item,now+86400001).quantity,null);
 assert.equal(recommendation({...item,par:0},now).quantity,0);
 assert.equal(recommendation({...item,supplier:''},now).quantity,null);
});
test('fractional packs do not add a phantom pack',()=>assert.equal(recommendation({...item,par:0.3,on_hand:0,inbound:0,pack_size:0.1},now).quantity,0.3));
test('par covers review interval, lead and buffer',()=>assert.equal(proposedPar(7,2,2),11));
test('CSV includes blocked items without fake zeros and escapes formulas',()=>{
 const csv=orderCsv([{...item,name:'=HYPERLINK("x")',on_hand:null,counted_at:null}],'Curd',now);
 assert.match(csv,/Count stock/);assert.match(csv,/"'=HYPERLINK/);assert.match(csv, /"","","Count stock"/);
});
