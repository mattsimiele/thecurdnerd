"""Rollback-only integration checks; requires psycopg2 and python-dotenv."""
import json
from pathlib import Path
import psycopg2
from dotenv import dotenv_values
conn=psycopg2.connect(dotenv_values('.env.local')['SUPABASE_DB_URL'],connect_timeout=15)
c=conn.cursor()
def denied(sql,args,code):
 c.execute('savepoint denied')
 try:
  c.execute(sql,args)
  raise AssertionError('Unexpectedly accepted')
 except psycopg2.Error as e: assert e.pgcode==code,(e.pgcode,code)
 c.execute('rollback to savepoint denied')
try:
 c.execute("set local statement_timeout='90s'")
 sql=Path('supabase/migrations/20261026230000_recipes.sql').read_text().strip();c.execute(sql[6:-7])
 c.execute('select user_id from app.user_business_access group by user_id having count(*)>=2 limit 1');uid=c.fetchone()[0]
 c.execute("select set_config('request.jwt.claim.sub',%s,true)",(str(uid),))
 c.execute("select id from app.businesses where slug='the-wedge'");wedge=c.fetchone()[0]
 c.execute("select id from app.businesses where slug='the-curd-nerd'");curd=c.fetchone()[0]
 c.execute('select public.manager_recipe_plan(%s)',(wedge,));plan=c.fetchone()[0]
 assert len(plan['menu'])>100,'Recipe planner must not truncate menu to shortlist'
 sale=next(m for m in plan['menu'] if m['sales_unit']=='each')
 inv='select public.manager_save_inventory(%s,null,null,%s::jsonb,false)'
 ingredient=dict(name='__recipe_test_ingredient__',unit='lb',supplier='Test',par='10',pack_size='5',lead_days='2')
 c.execute(inv,(wedge,json.dumps(ingredient)));stock=c.fetchone()[0]
 c.execute(inv,(curd,json.dumps(ingredient)));other=c.fetchone()[0]
 values={**sale,'batch_yield':'10','verified':True,'ingredients':[{'item_id':stock['id'],'quantity':'5'}]}
 save='select public.manager_save_recipe(%s,%s,%s,%s::jsonb)'
 c.execute(save,(wedge,None,None,json.dumps(values)));recipe=c.fetchone()[0]
 assert recipe['batch_yield']==10 and recipe['ingredients'][0]['quantity']==5
 c.execute('select public.manager_recipe_plan(%s)',(wedge,));assert any(r['id']==recipe['id'] for r in c.fetchone()[0]['recipes'])
 denied(save,(wedge,recipe['id'],0,json.dumps(values)),'40001')
 denied(save,(wedge,recipe['id'],1,json.dumps({**values,'batch_yield':0})),'23514')
 denied(save,(wedge,recipe['id'],1,json.dumps({**values,'verified':False})),'22023')
 denied(save,(wedge,recipe['id'],1,json.dumps({**values,'ingredients':[]})),'22023')
 denied(save,(wedge,recipe['id'],1,json.dumps({**values,'ingredients':[{'item_id':other['id'],'quantity':1}]})),'22023')
 denied(save,(wedge,recipe['id'],1,json.dumps({**values,'ingredients':values['ingredients']*2})),'23505')
 denied(save,(wedge,recipe['id'],1,json.dumps({**values,'variation_name':'different'})),'22023')
 denied(save,(curd,None,None,json.dumps(values)),'42501')
 # Disable and restore are revision-checked and audited.
 c.execute(save,(wedge,recipe['id'],1,json.dumps({**values,'active':False,'verified':False})));assert c.fetchone()[0]['active'] is False
 c.execute(save,(wedge,recipe['id'],2,json.dumps(values)));assert c.fetchone()[0]['active'] is True
 c.execute('select count(*) from app.inventory_recipe_history where recipe_id=%s',(recipe['id'],));assert c.fetchone()[0]==3
 c.execute('savepoint archived');c.execute('update app.inventory_items set active=false where id=%s',(stock['id'],))
 denied(save,(wedge,recipe['id'],3,json.dumps(values)),'22023');c.execute('rollback to savepoint archived')
 c.execute('savepoint viewer');c.execute("update app.user_business_access set role='viewer' where user_id=%s",(uid,))
 c.execute('select public.manager_recipe_plan(%s)',(wedge,));assert c.fetchone()[0]['menu']
 denied(save,(wedge,recipe['id'],3,json.dumps(values)),'42501');c.execute('rollback to savepoint viewer')
 c.execute('delete from app.user_business_access where user_id=%s and business_id=%s',(uid,wedge))
 denied('select public.manager_recipe_plan(%s)',(wedge,),'42501')
 denied(save,(wedge,recipe['id'],3,json.dumps(values)),'42501')
 c.execute("select set_config('request.jwt.claim.sub','',true)");denied('select public.manager_recipe_plan(%s)',(wedge,),'42501')
 c.execute("select has_function_privilege('anon','public.manager_recipe_plan(uuid)','execute'),has_table_privilege('authenticated','app.inventory_recipes','select')");assert c.fetchone()==(False,False)
 print('PASS: full menu, batch/ingredient persistence, revisions, disabled mappings, validation, same-business ingredients, viewer/anonymous denial, history; all rolled back')
finally: conn.rollback();conn.close()
