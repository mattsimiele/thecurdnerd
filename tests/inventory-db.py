"""Run from repo root with psycopg2/python-dotenv. All fixtures and DDL roll back."""
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
  raise AssertionError('Request unexpectedly accepted')
 except psycopg2.Error as e: assert e.pgcode==code,(e.pgcode,code)
 c.execute('rollback to savepoint denied')
try:
 c.execute("set local statement_timeout='90s'")
 sql=Path('supabase/migrations/20261026220000_inventory.sql').read_text().strip();c.execute(sql[6:-7])
 c.execute('select user_id from app.user_business_access group by user_id having count(*)>=2 limit 1');uid=c.fetchone()[0]
 c.execute("select set_config('request.jwt.claim.sub',%s,true)",(str(uid),))
 c.execute('select public.manager_inventory()');r=c.fetchone()[0];assert len(r['businesses'])==2 and len(r['candidates'])>0
 bid=r['businesses'][0]['id'];other=r['businesses'][1]['id']
 values=dict(name='__inventory_test__',unit='lb',supplier='Test supplier',par='20',pack_size='5',lead_days='2',on_hand='0',inbound='0')
 save='select public.manager_save_inventory(%s,%s,%s,%s::jsonb,%s)'
 c.execute(save,(bid,None,None,json.dumps(values),True));item=c.fetchone()[0];assert item['on_hand']==0 and item['revision']==1
 c.execute(save,(bid,item['id'],1,json.dumps({**values,'par':'25','on_hand':'999'}),False));updated=c.fetchone()[0];assert updated['on_hand']==0 and updated['revision']==2
 denied(save,(bid,item['id'],1,json.dumps(values),True),'40001')
 denied(save,(other,item['id'],2,json.dumps(values),True),'42501')
 denied(save,(bid,item['id'],2,json.dumps({**values,'unit':'each'}),True),'22023')
 denied(save,(bid,item['id'],2,json.dumps({**values,'on_hand':'-1'}),True),'23514')
 c.execute('select count(*) from app.inventory_history where item_id=%s',(item['id'],));assert c.fetchone()[0]==2
 c.execute('savepoint viewer');c.execute("update app.user_business_access set role='viewer' where user_id=%s",(uid,))
 denied(save,(bid,item['id'],2,json.dumps(values),True),'42501');c.execute('rollback to savepoint viewer')
 c.execute('delete from app.user_business_access where user_id=%s and business_id=%s',(uid,other))
 c.execute('select public.manager_inventory()');single=c.fetchone()[0];assert len(single['businesses'])==1;assert all(x['business_id']==bid for x in single['candidates'])
 denied(save,(other,None,None,json.dumps(values),True),'42501')
 c.execute("select set_config('request.jwt.claim.sub','',true)");denied('select public.manager_inventory()',None,'42501')
 c.execute("select has_function_privilege('anon','public.manager_inventory()','execute'),has_table_privilege('authenticated','app.inventory_items','select')");assert c.fetchone()==(False,False)
 print('PASS: scoped reads/writes, viewer denial, counts, revision conflicts, history, units, validation; all rolled back')
finally: conn.rollback();conn.close()
