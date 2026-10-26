"""Rollback-only source preservation, inference, and future-import checks."""
import json,uuid
from pathlib import Path
import psycopg2
from dotenv import dotenv_values
conn=psycopg2.connect(dotenv_values('.env.local')['SUPABASE_DB_URL'],connect_timeout=15)
c=conn.cursor()
try:
 c.execute("set local statement_timeout='180s'")
 c.execute("create temporary table before_units on commit drop as select id,quantity_unit from reporting.operating_sales_lines where business_date>='2026-09-28'")
 sql=Path('supabase/migrations/20261027020000_sales_unit_recovery.sql').read_text().strip();c.execute(sql[6:-7])
 c.execute("select count(*) from before_units old join reporting.operating_sales_lines s using(id) where old.quantity_unit<>'Unknown' and reporting.normalize_sales_unit(old.quantity_unit)<>s.quantity_unit");assert c.fetchone()[0]==0
 c.execute("select id from app.businesses where slug='the-wedge'");bid=c.fetchone()[0]
 def fixture(name,qty):
  uid=str(uuid.uuid4());patch={'id':uid,'square_order_id':'unit-test-'+uid,'square_line_item_uid':'unit-test','item_name':name,'variation_name':'Unit test','quantity':qty,'business_date':'2026-10-25','business_id':str(bid)}
  c.execute('insert into core.sales_line_items select (jsonb_populate_record(null::core.sales_line_items,to_jsonb(s)||%s::jsonb)).* from core.sales_line_items s where business_id=%s limit 1',(json.dumps(patch),bid))
  c.execute('select quantity_unit,quantity_unit_source from reporting.operating_sales_lines where id=%s',(uid,));return c.fetchone()
 assert fixture('__whole_unit_test__',2)==('each','quantity_fallback')
 assert fixture('__fraction_unit_test__',0.25)==('lb','quantity_fallback')
 c.execute("insert into app.sales_unit_reference values(%s,'__weighted_unit_test__','Unit test','lb'),(%s,'__split_unit_test__','Unit test','each')",(bid,bid))
 assert fixture('__weighted_unit_test__',1)==('lb','matched_item')
 assert fixture('__split_unit_test__',0.5)==('each','matched_item')
 c.execute("insert into app.sales_unit_reference values(%s,'__split_unit_test__','Unit test','lb')",(bid,))
 assert fixture('__split_unit_test__',0.5)==('Unknown','conflicting_item')
 # A newly imported Square order contributes explicit reference evidence.
 name='__new_import_unit_test__';payload={'line_items':[{'name':name,'variation_name':'Unit test','item_type':'ITEM','quantity':'1','quantity_unit':{'measurement_unit':{'weight_unit':'IMPERIAL_POUND'}}}]}
 patch={'order_id':'unit-test-'+str(uuid.uuid4()),'business_id':str(bid),'payload':payload}
 c.execute('insert into ingest.square_orders_raw select (jsonb_populate_record(null::ingest.square_orders_raw,to_jsonb(r)||%s::jsonb)).* from ingest.square_orders_raw r where business_id=%s limit 1',(json.dumps(patch),bid))
 assert fixture(name,1)==('lb','matched_item')
 patch['order_id']='unit-test-null-'+str(uuid.uuid4());patch['payload']={'line_items':None}
 c.execute('insert into ingest.square_orders_raw select (jsonb_populate_record(null::ingest.square_orders_raw,to_jsonb(r)||%s::jsonb)).* from ingest.square_orders_raw r where business_id=%s limit 1',(json.dumps(patch),bid))
 # Reporting still runs and Wedge split servings are recovered as each.
 c.execute("select count(*) from reporting.operating_sales_lines s join app.businesses b on b.id=s.business_id where b.slug='the-wedge' and item_name='Mac & Cheese' and quantity<>trunc(quantity) and quantity_unit='each' and quantity_unit_source='matched_item'");assert c.fetchone()[0]>0
 c.execute('select user_id from app.user_business_access where business_id=%s limit 1',(bid,));uid=c.fetchone()[0];c.execute("select set_config('request.jwt.claim.sub',%s,true)",(str(uid),))
 c.execute('select public.manager_weekly_menu_pars(%s)',(bid,));r=c.fetchone()[0];d=next(x for x in r['rows'] if x['name']=='Dessert');assert d['incompatibleLines']==0
 c.execute("select has_table_privilege('authenticated','app.sales_unit_reference','select')");assert c.fetchone()[0] is False
 c.execute("select b.slug,s.quantity_unit_source,count(*) from reporting.operating_sales_lines s join app.businesses b on b.id=s.business_id where business_date>='2026-09-28' and s.square_line_item_uid<>'unit-test' group by 1,2 order by 1,2")
 print(json.dumps({'status':'passed; all changes rolled back','resolution_counts':c.fetchall()},default=str))
finally:conn.rollback();conn.close()
