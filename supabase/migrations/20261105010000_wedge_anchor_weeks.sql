begin;
create table if not exists app.wedge_anchor_weeks (
 business_id uuid not null references app.businesses(id), week_start date not null,
 groups jsonb not null check(jsonb_typeof(groups)='array'), revision integer not null default 1,
 updated_at timestamptz not null default now(), updated_by uuid not null references auth.users(id),
 primary key(business_id,week_start), check(extract(isodow from week_start)=1)
);
alter table app.wedge_anchor_weeks enable row level security;
revoke all on app.wedge_anchor_weeks from public,anon,authenticated;

create or replace function public.manager_wedge_anchor_week(p_business_id uuid,p_week date default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,app,reporting as $$
declare monday date; today date; saved app.wedge_anchor_weeks; template app.wedge_anchor_weeks; candidates jsonb;
begin
 if auth.uid() is null or not exists(select 1 from app.user_business_access u join app.businesses b on b.id=u.business_id where u.user_id=auth.uid() and b.id=p_business_id and b.active and b.slug='the-wedge') then
 raise exception 'Wedge access required' using errcode='42501'; end if;
 today:=(now() at time zone 'America/New_York')::date;
 monday:=coalesce(p_week,date_trunc('week',today)::date);
 if extract(isodow from monday)<>1 or monday>today or monday<date '2020-01-06' then raise exception 'Choose a Monday in the reporting range' using errcode='22023'; end if;
 select * into saved from app.wedge_anchor_weeks where business_id=p_business_id and week_start=monday;
 select * into template from app.wedge_anchor_weeks where business_id=p_business_id and week_start<monday order by week_start desc limit 1;
 -- Retain saved selections even when their last sale is outside the recent picker window.
 with source as materialized (
 select item_name,coalesce(variation_name,'') variation,quantity_unit,quantity,net_sales_cents,business_date
 from reporting.operating_sales_lines
 where business_id=p_business_id and order_state='COMPLETED' and sale_kind='sale' and business_date<=least(monday+6,today)
 and business_date>=monday-180
 ) select coalesce(jsonb_agg(jsonb_build_object('key',jsonb_build_array(item_name,variation,quantity_unit),'name',item_name,'variation',variation,'unit',quantity_unit,
 'sold',sold,'revenueCents',revenue,'lastSale',last_sale) order by item_name,variation,quantity_unit),'[]'::jsonb) into candidates
 from (select item_name,variation,quantity_unit,coalesce(sum(quantity) filter(where business_date>=monday),0) sold,
 coalesce(sum(net_sales_cents) filter(where business_date>=monday),0) revenue,max(business_date) last_sale from source group by 1,2,3) s;
 -- Old selections without recent sales stay selectable with zero quantities, without scanning all history.
 select candidates||coalesce(jsonb_agg(jsonb_build_object('key',k,'name',k->>0,'variation',k->>1,'unit',k->>2,'sold',0,'revenueCents',0,'lastSale',null)),'[]'::jsonb) into candidates from (select distinct m.value k from jsonb_array_elements(coalesce(saved.groups,template.groups,'[]'::jsonb)) g cross join lateral jsonb_array_elements(g->'members') m where not exists(select 1 from jsonb_array_elements(candidates) c where c->'key'=m.value)) old;
 return jsonb_build_object('weekStart',monday,'weekEnd',monday+6,'today',today,'revision',saved.revision,'updatedAt',saved.updated_at,
 'groups',saved.groups,'template',template.groups,'templateWeek',template.week_start,'candidates',candidates,
 'salesThrough',(select max(business_date) from core.sales_line_items where business_id=p_business_id and order_state='COMPLETED' and business_date<=least(monday+6,today)));
end $$;

create or replace function public.manager_save_wedge_anchor_week(p_business_id uuid,p_week date,p_revision integer,p_groups jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,app,reporting as $$
declare prior app.wedge_anchor_weeks; g jsonb; m jsonb; d jsonb; field text; n numeric; seen jsonb:='[]'; ids text[]:='{}'; today date; normalized jsonb:='[]'; clean jsonb;
begin
 if auth.uid() is null or not exists(select 1 from app.user_business_access u join app.businesses b on b.id=u.business_id where u.user_id=auth.uid() and b.id=p_business_id and b.active and b.slug='the-wedge' and u.role in ('owner','manager')) then
 raise exception 'Wedge editing access required' using errcode='42501'; end if;
 today:=(now() at time zone 'America/New_York')::date;
 if p_week is null or extract(isodow from p_week)<>1 or p_week>today or p_week<date '2020-01-06' then raise exception 'Invalid report week' using errcode='22023'; end if;
 if p_groups is null or jsonb_typeof(p_groups)<>'array' or jsonb_array_length(p_groups)>50 then raise exception 'Invalid groups' using errcode='22023'; end if;
 -- Serialize creation and updates for this business; revision prevents stale replacement.
 perform pg_advisory_xact_lock(hashtextextended(p_business_id::text||':anchor-weeks',0));
 select * into prior from app.wedge_anchor_weeks where business_id=p_business_id and week_start=p_week for update;
 if p_revision is distinct from prior.revision then raise exception 'Weekly report changed; reload before saving' using errcode='40001'; end if;
 for g in select value from jsonb_array_elements(p_groups) loop
 if jsonb_typeof(g)<>'object' or coalesce(length(btrim(g->>'name')),0) not between 1 and 100 or coalesce(length(g->>'id'),0) not between 1 and 80 or g->>'id'=any(ids)
 or jsonb_typeof(g->'members') is distinct from 'array' or jsonb_array_length(g->'members')>100
 or jsonb_typeof(g->'deliveries') is distinct from 'array' or jsonb_array_length(g->'deliveries')>100
 or jsonb_typeof(g->'activityComplete') is distinct from 'boolean' or coalesce(length(g->>'notes'),0)>2000 then raise exception 'Invalid group fields' using errcode='22023'; end if;
 ids:=array_append(ids,g->>'id');
 for m in select value from jsonb_array_elements(g->'members') loop
 if jsonb_typeof(m)<>'array' or jsonb_array_length(m)<>3 or m->>2<>'each' or seen @> jsonb_build_array(m) then raise exception 'Use each-based menu selections once per report' using errcode='22023'; end if;

 seen:=seen||jsonb_build_array(m);
 end loop;
 clean:=jsonb_build_object('id',g->>'id','name',btrim(g->>'name'),'members',g->'members','activityComplete',g->'activityComplete','notes',coalesce(g->>'notes',''));
 foreach field in array array['opening','closing','waste','adjustment'] loop
 if g->>field is null then n:=null; else
 if jsonb_typeof(g->field)<>'number' then raise exception 'Invalid count' using errcode='22023'; end if;
 n:=(g->>field)::numeric;
 if n>1000000 or n<(case when field='adjustment' then -1000000 else 0 end) then raise exception 'Count outside range' using errcode='22023'; end if;
 end if;
 if field='closing' and n is not null and p_week+6>today then raise exception 'Closing count is for Sunday end of week; leave blank during the week' using errcode='22023'; end if;
 clean:=clean||jsonb_build_object(field,n);
 end loop;
 for d in select value from jsonb_array_elements(g->'deliveries') loop
 if jsonb_typeof(d)<>'object' or coalesce(d->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' or (d->>'date')::date not between p_week and least(p_week+6,today)
 or jsonb_typeof(d->'quantity') is distinct from 'number' or (d->>'quantity')::numeric<=0 or (d->>'quantity')::numeric>1000000
 or jsonb_typeof(d->'cost') is distinct from 'number' or (d->>'cost')::numeric<0 or (d->>'cost')::numeric>10000000 or round((d->>'cost')::numeric,2)<>(d->>'cost')::numeric
 or coalesce(length(d->>'reference'),0)>200 then raise exception 'Invalid delivery date, portions, or dollar cost' using errcode='22023'; end if;
 end loop;
 clean:=clean||jsonb_build_object('deliveries',g->'deliveries');
 normalized:=normalized||jsonb_build_array(clean);
 end loop;
 if exists(select value from jsonb_array_elements(seen) except (select jsonb_build_array(s.item_name,coalesce(s.variation_name,''),s.quantity_unit) from reporting.operating_sales_lines s where s.business_id=p_business_id and s.order_state='COMPLETED' and s.sale_kind='sale' and s.business_date between p_week-180 and least(p_week+6,today) union select member_row.value from app.wedge_anchor_weeks w cross join lateral jsonb_array_elements(w.groups) group_row cross join lateral jsonb_array_elements(group_row.value->'members') member_row where w.business_id=p_business_id and w.week_start<=p_week)) then raise exception 'Unknown menu selection' using errcode='22023'; end if;
 insert into app.wedge_anchor_weeks(business_id,week_start,groups,updated_by) values(p_business_id,p_week,normalized,auth.uid())
 on conflict(business_id,week_start) do update set groups=excluded.groups,revision=app.wedge_anchor_weeks.revision+1,updated_at=now(),updated_by=auth.uid();
 return public.manager_wedge_anchor_week(p_business_id,p_week);
end $$;
revoke all on function public.manager_wedge_anchor_week(uuid,date),public.manager_save_wedge_anchor_week(uuid,date,integer,jsonb) from public,anon;
grant execute on function public.manager_wedge_anchor_week(uuid,date),public.manager_save_wedge_anchor_week(uuid,date,integer,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
