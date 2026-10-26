"""Rollback-only weekly grouping, scope, and concurrency checks."""
import json,uuid
from pathlib import Path
import psycopg2
from dotenv import dotenv_values
conn=psycopg2.connect(dotenv_values('.env.local')['SUPABASE_DB_URL'],connect_timeout=15)
c=conn.cursor()
def denied(sql,args,code):
 c.execute('savepoint denied')
 try:
  c.execute(sql,args);raise AssertionError('Unexpectedly accepted')
 except psycopg2.Error as e:assert e.pgcode==code,(e.pgcode,code)
 c.execute('rollback to savepoint denied')
try:
 c.execute("set local statement_timeout='90s'")
 sql=Path('supabase/migrations/20261027010000_weekly_menu_pars.sql').read_text().strip();c.execute(sql[6:-7])
 c.execute('select user_id from app.user_business_access group by user_id having count(*)>=2 limit 1');uid=c.fetchone()[0]
 c.execute("select set_config('request.jwt.claim.sub',%s,true)",(str(uid),))
 c.execute("select id from app.businesses where slug='the-wedge'");bid=c.fetchone()[0]
 read='select public.manager_weekly_menu_pars(%s)'
 c.execute(read,(bid,));r=c.fetchone()[0]
 import datetime
 assert datetime.date.fromisoformat(r['weekStart']).weekday()==0
 assert datetime.date.fromisoformat(r['weekEnd']).weekday()==6
 assert (datetime.date.fromisoformat(r['weekStart'])-datetime.date.fromisoformat(r['baselineStart'])).days==28
 dessert=[x for x in r['rows'] if x['name']=='Dessert'];assert len(dessert)==1 and len(dessert[0]['members'])>1
 assert not any(x['name']=='Cheesecake' for x in r['rows'])
 key=dessert[0]['key'];save='select public.manager_save_weekly_menu_par(%s,%s::jsonb,%s,%s,%s)'
 c.execute(save,(bid,json.dumps(key),dessert[0]['revision'],60,True));saved=c.fetchone()[0];rev=saved['revision']
 c.execute(read,(bid,));d=next(x for x in c.fetchone()[0]['rows'] if x['name']=='Dessert');assert d['par']==60 and d['confirmed']
 denied(save,(bid,json.dumps(key),rev-1,70,True),'40001')
 denied(save,(bid,json.dumps(key),rev,-1,True),'23514')
 c.execute('savepoint viewer');c.execute("update app.user_business_access set role='viewer' where user_id=%s",(uid,))
 denied(save,(bid,json.dumps(key),rev,70,True),'42501');c.execute('rollback to savepoint viewer')
 # A current-week sale must appear only in current progress, not the baseline.
 patch=json.dumps({'id':str(uuid.uuid4()),'square_order_id':'weekly-test-'+str(uuid.uuid4()),'square_line_item_uid':'weekly-test','business_date':r['today'],'category':'Desserts','quantity':3,'item_name':'Test dessert','order_state':'COMPLETED'})
 c.execute('insert into core.sales_line_items select (jsonb_populate_record(null::core.sales_line_items,to_jsonb(s)||%s::jsonb)).* from core.sales_line_items s where business_id=%s limit 1',(patch,bid))
 c.execute(read,(bid,));after=c.fetchone()[0];d2=next(x for x in after['rows'] if x['name']=='Dessert')
 assert d2['baselineKnown']==d['baselineKnown'] and d2['baselineUnknown']==d['baselineUnknown']
 assert d2['currentUnknown']==d['currentUnknown']+3
 c.execute('delete from app.user_business_access where user_id=%s and business_id=%s',(uid,bid))
 denied(read,(bid,),'42501')
 c.execute("select set_config('request.jwt.claim.sub','',true)");denied(read,(bid,),'42501')
 c.execute("select has_function_privilege('anon','public.manager_weekly_menu_pars(uuid)','execute'),has_table_privilege('authenticated','app.weekly_menu_pars','select')");assert c.fetchone()==(False,False)
 print('PASS: Monday–Sunday, four complete baseline weeks, one Dessert group, current-week isolation, saved pars, conflicts, validation, and access controls; rolled back')
finally:conn.rollback();conn.close()
