import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const js=ts.transpileModule(fs.readFileSync('src/lib/recipes.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {ingredientDemand,menuKey,recipeProblem}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const item={id:'cheese',business_id:'wedge',name:'Cheddar',unit:'lb'};
const mac={item_name:'Mac',variation_name:'Regular',sales_unit:'each',quantity:80,sales_cents:10000};
const recipe={id:'r',business_id:'wedge',...mac,batch_yield:10,active:true,ingredients:[{item_id:'cheese',name:'Cheddar',unit:'lb',quantity:5}]};
const plan={startDate:'2026-09-28',endDate:'2026-10-25',salesThrough:'2026-10-25',menu:[mac],recipes:[recipe]};
test('batch yield converts four-week sales to weekly purchased demand',()=>{
 const d=ingredientDemand(plan,[item]);assert.equal(d.rows[0].weekly,10);assert.equal(d.mapped,1);assert.equal(d.fresh,true);
});
test('shared ingredients sum across dishes without mixing variations or units',()=>{
 const toast={...mac,item_name:'Toast',quantity:40};
 const d=ingredientDemand({...plan,menu:[mac,toast,{...mac,sales_unit:'Unknown'},{...mac,variation_name:'Large'}],recipes:[recipe,{...recipe,...toast,id:'r2',batch_yield:1,ingredients:[{...recipe.ingredients[0],quantity:0.25}]}]},[item]);
 assert.equal(d.rows[0].weekly,12.5);assert.equal(d.mapped,2);assert.equal(d.total,4);assert.equal(d.rows[0].contributions.length,2);
 assert.notEqual(menuKey(mac),menuKey({...mac,sales_unit:'Unknown'}));
});
test('disabled, missing, and archived ingredients cannot silently contribute partial recipes',()=>{
 assert.equal(ingredientDemand({...plan,recipes:[{...recipe,active:false}]},[item]).rows.length,0);
 assert.equal(ingredientDemand(plan,[]).mapped,0);
 const broken={...recipe,ingredients:[...recipe.ingredients,{item_id:'missing',quantity:2,unit:'lb'}]};
 assert.equal(ingredientDemand({...plan,recipes:[broken]},[item]).rows.length,0);
 assert.match(recipeProblem(broken,[item]),/archived/);
});
test('no recent sales is not fabricated demand, stale source is flagged',()=>{
 assert.equal(ingredientDemand({...plan,menu:[]},[item]).rows.length,0);
 assert.equal(ingredientDemand({...plan,salesThrough:'2026-10-20'},[item]).fresh,false);
});
