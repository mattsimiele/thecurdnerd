"""Rollback-only validation of Curd Nerd weekly sales targets and business isolation."""
import json
from pathlib import Path
import psycopg2
from dotenv import dotenv_values
conn=psycopg2.connect(dotenv_values('.env.local')['SUPABASE_DB_URL'],connect_timeout=15)
c=conn.cursor()
try:
 c.execute("set local statement_timeout='90s'")
 sql=Path('supabase/migrations/20261027030000_curd_weekly_pars.sql').read_text().strip()
 c.execute(sql[6:-7])
 c.execute('select user_id from app.user_business_access group by user_id having count(*)>=2 limit 1');uid=c.fetchone()[0]
 c.execute("select set_config('request.jwt.claim.sub',%s,true)",(str(uid),))
 c.execute("select id from app.businesses where slug='the-curd-nerd'");bid=c.fetchone()[0]
 c.execute('select public.manager_weekly_menu_pars(%s)',(bid,));r=c.fetchone()[0]
 assert r['rows'] and all(x['key'][0]=='item' for x in r['rows'])
 assert {'lb','each'}.issubset({x['unit'] for x in r['rows']})
 assert all(x['key'][3]==x['unit'] for x in r['rows'])
 c.execute("select item_name,coalesce(variation_name,''),quantity_unit,sum(quantity) from reporting.operating_sales_lines where business_id=%s and business_date between %s and %s and sale_kind='sale' and order_state='COMPLETED' group by 1,2,3",(bid,r['baselineStart'],r['baselineEnd']))
 for name,variant,unit,quantity in c.fetchall():
  row=next(x for x in r['rows'] if x['key']==['item',name,variant,unit])
  assert float(quantity)==float(row['baselineUnknown'] if unit=='Unknown' else row['baselineKnown'])
 row=next(x for x in r['rows'] if x['unit']=='lb');key=json.dumps(row['key'])
 save='select public.manager_save_weekly_menu_par(%s,%s::jsonb,%s,%s,%s)'
 c.execute(save,(bid,key,row['revision'],12.25,False));saved=c.fetchone()[0]
 assert float(saved['weekly_par'])==12.25
 c.execute(save,(bid,key,saved['revision'],0,False));assert c.fetchone()[0]['weekly_par']==0
 c.execute("select id from app.businesses where slug='the-wedge'");wedge=c.fetchone()[0]
 c.execute('select public.manager_weekly_menu_pars(%s)',(wedge,));wr=c.fetchone()[0]
 assert len([x for x in wr['rows'] if x['key'][0]=='category' and x['name']=='Dessert'])==1
 c.execute('savepoint viewer');c.execute("update app.user_business_access set role='viewer' where user_id=%s and business_id=%s",(uid,bid))
 try:
  c.execute(save,(bid,key,saved['revision']+1,10,False));raise AssertionError('Viewer allowed to save')
 except psycopg2.Error as e:assert e.pgcode=='42501'
 c.execute('rollback to savepoint viewer')
 c.execute('delete from app.user_business_access where user_id=%s and business_id=%s',(uid,bid))
 try:
  c.execute('select public.manager_weekly_menu_pars(%s)',(bid,));raise AssertionError('Missing membership allowed')
 except psycopg2.Error as e:assert e.pgcode=='42501'
 print('PASS: Curd item/variation/unit totals match corrected source; lb and each separate; decimal and zero saves; Wedge Dessert preserved; access enforced. Rolled back.')
finally:conn.rollback();conn.close()
