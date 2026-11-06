"""Rollback-only tests for weekly snapshots, validation, and membership isolation."""
import json
from pathlib import Path
import psycopg2
from dotenv import dotenv_values
conn=psycopg2.connect(dotenv_values('.env.local')['SUPABASE_DB_URL'],connect_timeout=15)
c=conn.cursor()
def denied(sql,args,code):
 c.execute('savepoint denied')
 try:
  c.execute(sql,args);raise AssertionError('Unexpectedly accepted')
 except psycopg2.Error as e:assert e.pgcode==code,(e.pgcode,str(e))
 c.execute('rollback to savepoint denied')
try:
 c.execute("set local statement_timeout='90s'")
 sql=Path('supabase/migrations/20261105010000_wedge_anchor_weeks.sql').read_text().strip();c.execute(sql[6:-7])
 c.execute("select u.user_id,b.id from app.user_business_access u join app.businesses b on b.id=u.business_id where b.slug='the-wedge' and u.role in ('owner','manager') limit 1");uid,bid=c.fetchone()
 c.execute("select set_config('request.jwt.claim.sub',%s,true)",(str(uid),))
 read='select public.manager_wedge_anchor_week(%s,%s::date)'
 save='select public.manager_save_wedge_anchor_week(%s,%s::date,%s,%s::jsonb)'
 week='2026-10-26';c.execute(read,(bid,week));r=c.fetchone()[0]
 keys=[x['key'] for x in r['candidates'] if x['name']=='Girl Dinner' and x['unit']=='each'];assert len(keys)>=2
 g={'id':'girl','name':'Girl Dinner','members':keys,'opening':30,'closing':12,'waste':1,'adjustment':0,'deliveries':[{'date':'2026-10-27','quantity':20,'cost':100.25,'reference':'test invoice allocation'}],'activityComplete':True,'notes':'test'}
 c.execute(save,(bid,week,r['revision'],json.dumps([g])));saved=c.fetchone()[0];assert saved['groups']==[g]
 denied(save,(bid,week,r['revision'],json.dumps([g])),'40001')
 denied(save,(bid,week,saved['revision'],json.dumps([g,{**g,'id':'duplicate'}])),'22023')
 denied(save,(bid,week,saved['revision'],json.dumps([{**g,'members':[['Girl Dinner','Regular','lb']]}])),'22023')
 denied(save,(bid,week,saved['revision'],json.dumps([{**g,'opening':-1}])),'22023')
 denied(save,(bid,week,saved['revision'],json.dumps([{**g,'deliveries':[{'date':'2026-11-02','quantity':1,'cost':10}]}])),'22023')
 denied(read,(bid,'2026-10-27'),'22023')
 c.execute(read,(bid,'2026-11-02'));nxt=c.fetchone()[0];assert nxt['template']==[g] and nxt['groups'] is None
 c.execute(save,(bid,'2026-11-02',None,json.dumps([{**g,'opening':None,'closing':None,'deliveries':[]}])));c.fetchone()
 c.execute(read,(bid,week));assert c.fetchone()[0]['groups']==[g]
 c.execute('savepoint viewer');c.execute("update app.user_business_access set role='viewer' where user_id=%s and business_id=%s",(uid,bid))
 c.execute(read,(bid,week));assert c.fetchone()[0]['groups']==[g]
 denied(save,(bid,week,saved['revision'],json.dumps([g])),'42501');c.execute('rollback to savepoint viewer')
 c.execute('delete from app.user_business_access where user_id=%s and business_id=%s',(uid,bid));denied(read,(bid,week),'42501')
 c.execute("select has_table_privilege('authenticated','app.wedge_anchor_weeks','select'),has_function_privilege('anon','public.manager_wedge_anchor_week(uuid,date)','execute')");assert c.fetchone()==(False,False)
 print('PASS: grouped menu variants, weekly snapshots, decimal deliveries, duplicate prevention, dates/count validation, conflicts, viewer and membership isolation. Rolled back.')
finally:conn.rollback();conn.close()
