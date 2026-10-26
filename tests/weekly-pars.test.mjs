import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const js=ts.transpileModule(fs.readFileSync('src/lib/weekly-pars.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {weeklyParProgress}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const report={weekStart:'2026-10-26',salesThrough:'2026-10-28'};
const row={baselineKnown:160,baselineUnknown:40,currentKnown:20,currentUnknown:5,unknownLines:3,incompatibleLines:0,confirmed:true,par:50};
test('compares imported week-to-date sales with weekly par; baseline uses four completed weeks',()=>{
 const p=weeklyParProgress(row,report);assert.equal(p.weeklyAverage,50);assert.equal(p.sold,25);assert.equal(p.remaining,25);assert.equal(p.percent,50);
});
test('unknown units and incompatible dessert measures block combined progress',()=>{
 assert.equal(weeklyParProgress({...row,confirmed:false},report).sold,null);
 assert.equal(weeklyParProgress({...row,incompatibleLines:1},report).sold,null);
});
test('no current-week imports stay unknown rather than zero',()=>assert.equal(weeklyParProgress(row,{...report,salesThrough:'2026-10-25'}).sold,null));
test('missing and zero pars differ; sales over par do not create negative remaining',()=>{
 assert.equal(weeklyParProgress({...row,par:null},report).remaining,null);
 const p=weeklyParProgress({...row,par:0},report);assert.equal(p.remaining,0);assert.equal(p.over,25);assert.equal(p.percent,null);
 assert.equal(weeklyParProgress({...row,par:10},report).percent,250);
});
test('older unknown units do not block current-week sales with known units',()=>{
 const p=weeklyParProgress({...row,confirmed:false,currentUnknown:0},report);
 assert.equal(p.weeklyAverage,null);assert.equal(p.sold,20);assert.equal(p.remaining,30);assert.equal(p.percent,40);assert.equal(p.currentIssue,null);
});
