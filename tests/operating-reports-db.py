"""Rollback-only integration checks. Requires psycopg2, python-dotenv, and the configured database. Run from repository root."""
import sys,json,time
from pathlib import Path
import psycopg2
from dotenv import dotenv_values
cfg=dotenv_values('.env.local')
conn=psycopg2.connect(cfg['SUPABASE_DB_URL'],connect_timeout=15)
c=conn.cursor()
sql=Path('supabase/migrations/20261026120000_operating_reports.sql').read_text().strip()
assert sql.startswith('begin;') and sql.endswith('commit;')
try:
 c.execute("SET LOCAL statement_timeout='90s'")
 c.execute(sql[6:-7])
 c.execute('select user_id from app.user_business_access group by user_id having count(*)>=2 limit 1')
 uid=c.fetchone()[0]
 c.execute("select set_config('request.jwt.claim.sub',%s,true)",(str(uid),))
 start=time.monotonic();c.execute("select public.manager_operating_report('2026-09-28','2026-10-25')")
 r=c.fetchone()[0]
 assert len(r['businesses'])==2
 assert len(r['daily'])==56
 assert len(r['categories'])>20
 assert r['sharedVisible'] is True
 assert sum(x['gift_card_cents'] for x in r['businesses'])>0
 assert any(x['quantity_unit']=='lb' for x in r['items'])
 for b in r['businesses']:
  assert sum(x['sales_cents'] for x in r['categories'] if x['slug']==b['slug'])==b['sales_cents']
  assert sum(x['sales_cents'] for x in r['daily'] if x['slug']==b['slug'])==b['sales_cents']
 a=r['accounts'][0]
 c.execute("select public.manager_expense_lines('2026-09-28','2026-10-25',%s,%s,0)",(a['account'],a['allocation']))
 p=c.fetchone()[0];assert p['total']==a['line_count'];assert len(p['rows'])<=50
 # A single-business manager cannot see shared rows or the other business.
 c.execute('SAVEPOINT single_scope')
 c.execute('delete from app.user_business_access where user_id=%s and business_id=(select id from app.businesses where slug=%s)',(uid,'the-wedge'))
 c.execute("select public.manager_operating_report('2026-09-28','2026-10-25')")
 single=c.fetchone()[0]
 assert len(single['businesses'])==1 and single['sharedVisible'] is False
 assert all(x['allocation']=='the-curd-nerd' for x in single['accounts'])
 c.execute("select public.manager_expense_lines('2026-09-28','2026-10-25','Payroll expenses:Payroll taxes','shared',0)")
 assert c.fetchone()[0]['total']==0
 c.execute('ROLLBACK TO SAVEPOINT single_scope')
 # Anonymous, unassigned, invalid date requests must fail, not return zeros.
 for claim,dates,expected in [('',('2026-09-28','2026-10-25'),'42501'),('00000000-0000-0000-0000-000000000001',('2026-09-28','2026-10-25'),'42501'),(str(uid),('2026-10-25','2026-09-28'),'22007')]:
  c.execute('SAVEPOINT denied');c.execute("select set_config('request.jwt.claim.sub',%s,true)",(claim,))
  try:
   c.execute('select public.manager_operating_report(%s,%s)',dates)
   raise AssertionError('Unauthorized/invalid request accepted')
  except psycopg2.Error as e: assert e.pgcode==expected,(e.pgcode,expected)
  c.execute('ROLLBACK TO SAVEPOINT denied')
 c.execute("select has_function_privilege('anon','public.manager_operating_report(date,date)','EXECUTE')")
 assert not c.fetchone()[0]
 c.execute("select has_table_privilege('authenticated','reporting.operating_sales_lines','SELECT')")
 assert not c.fetchone()[0]
 print(json.dumps({'status':'passed; all DB changes rolled back','seconds':round(time.monotonic()-start,2),'businesses':len(r['businesses']),'categories':len(r['categories']),'accounts':len(r['accounts'])}))
finally:
 conn.rollback();conn.close()
