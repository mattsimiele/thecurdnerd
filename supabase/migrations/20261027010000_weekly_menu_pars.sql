begin;
-- Menu prep pars are distinct from ingredient inventory targets.
create table if not exists app.weekly_menu_pars (
 business_id uuid not null references app.businesses(id), menu_key jsonb not null,
 weekly_par numeric not null check(weekly_par>=0 and weekly_par<=1000000),
 unknown_units_confirmed boolean not null default false,
 revision integer not null default 1, updated_at timestamptz not null default now(),
 updated_by uuid not null references auth.users(id),
 primary key(business_id,menu_key),
 check(jsonb_typeof(menu_key)='array' and jsonb_array_length(menu_key)=4)
);
alter table app.weekly_menu_pars enable row level security;
revoke all on app.weekly_menu_pars from public,anon,authenticated;
create or replace view reporting.weekly_menu_sales as
select s.*,
 case when lower(btrim(category_label)) in ('dessert','desserts') then jsonb_build_array('category','Dessert','','each')
 else jsonb_build_array('item',item_name,coalesce(variation_name,''),case when quantity_unit='Unknown' then 'each' else quantity_unit end) end menu_key,
 lower(btrim(category_label)) in ('dessert','desserts') and quantity_unit not in ('each','Unknown') incompatible
from reporting.operating_sales_lines s where sale_kind='sale' and order_state='COMPLETED';
revoke all on reporting.weekly_menu_sales from public,anon,authenticated;

create or replace function public.manager_weekly_menu_pars(p_business_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,app,reporting as $$
declare today date; monday date;
begin
 if auth.uid() is null or not exists(select 1 from app.user_business_access u join app.businesses b on b.id=u.business_id where u.user_id=auth.uid() and b.id=p_business_id and b.active and b.slug='the-wedge') then
 raise exception 'Wedge access required' using errcode='42501'; end if;
 today:=(now() at time zone 'America/New_York')::date;
 monday:=date_trunc('week',today)::date;
 return (with sales as materialized (
 select * from reporting.weekly_menu_sales where business_id=p_business_id and business_date between monday-28 and today
 ), grouped as (
 select menu_key,
 coalesce(sum(quantity) filter(where business_date<monday and quantity_unit<>'Unknown' and not incompatible),0) baseline_known,
 coalesce(sum(quantity) filter(where business_date<monday and quantity_unit='Unknown'),0) baseline_unknown,
 coalesce(sum(quantity) filter(where business_date>=monday and quantity_unit<>'Unknown' and not incompatible),0) current_known,
 coalesce(sum(quantity) filter(where business_date>=monday and quantity_unit='Unknown'),0) current_unknown,
 count(*) filter(where quantity_unit='Unknown') unknown_lines,
 count(*) filter(where incompatible) incompatible_lines,
 coalesce(sum(net_sales_cents) filter(where business_date<monday),0) baseline_sales_cents,
 jsonb_agg(distinct item_name) members
 from sales group by menu_key
 ), keys as (
 select menu_key from grouped union select menu_key from app.weekly_menu_pars where business_id=p_business_id
 ) select jsonb_build_object(
 'weekStart',monday,'weekEnd',monday+6,'today',today,'baselineStart',monday-28,'baselineEnd',monday-1,
 'salesThrough',(select max(business_date) from core.sales_line_items where business_id=p_business_id and business_date<=today and order_state='COMPLETED'),
 'importedAt',(select max(imported_at) from core.sales_line_items where business_id=p_business_id),
 'rows',coalesce((select jsonb_agg(jsonb_build_object(
 'key',k.menu_key,'name',k.menu_key->>1,'variation',k.menu_key->>2,'unit',k.menu_key->>3,
 'baselineKnown',coalesce(g.baseline_known,0),'baselineUnknown',coalesce(g.baseline_unknown,0),
 'currentKnown',coalesce(g.current_known,0),'currentUnknown',coalesce(g.current_unknown,0),
 'unknownLines',coalesce(g.unknown_lines,0),'incompatibleLines',coalesce(g.incompatible_lines,0),
 'members',coalesce(g.members,'[]'::jsonb),'par',p.weekly_par,'confirmed',coalesce(p.unknown_units_confirmed,false),'revision',p.revision
 ) order by (k.menu_key->>0='category') desc,g.baseline_sales_cents desc nulls last,k.menu_key::text)
 from keys k left join grouped g using(menu_key) left join app.weekly_menu_pars p on p.business_id=p_business_id and p.menu_key=k.menu_key),'[]'::jsonb)
 ));
end $$;

create or replace function public.manager_save_weekly_menu_par(p_business_id uuid,p_key jsonb,p_revision integer,p_par numeric,p_confirmed boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog,app,reporting as $$
declare prior app.weekly_menu_pars; result app.weekly_menu_pars;
begin
 if auth.uid() is null or not exists(select 1 from app.user_business_access u join app.businesses b on b.id=u.business_id where u.user_id=auth.uid() and b.id=p_business_id and b.active and b.slug='the-wedge' and u.role in ('owner','manager')) then
 raise exception 'Wedge editing access required' using errcode='42501'; end if;
 select * into prior from app.weekly_menu_pars where business_id=p_business_id and menu_key=p_key for update;
 if p_revision is distinct from prior.revision then raise exception 'Weekly par changed; reload before saving' using errcode='40001'; end if;
 if prior.revision is null and not exists(select 1 from reporting.weekly_menu_sales where business_id=p_business_id and menu_key=p_key) then
 raise exception 'Choose an existing menu group' using errcode='22023'; end if;
 if prior.revision is null then
 insert into app.weekly_menu_pars(business_id,menu_key,weekly_par,unknown_units_confirmed,updated_by)
 values(p_business_id,p_key,p_par,p_confirmed,auth.uid()) returning * into result;
 else
 update app.weekly_menu_pars set weekly_par=p_par,unknown_units_confirmed=p_confirmed,revision=revision+1,updated_at=now(),updated_by=auth.uid()
 where business_id=p_business_id and menu_key=p_key returning * into result;
 end if;
 return to_jsonb(result);
end $$;
revoke all on function public.manager_weekly_menu_pars(uuid),public.manager_save_weekly_menu_par(uuid,jsonb,integer,numeric,boolean) from public,anon;
grant execute on function public.manager_weekly_menu_pars(uuid),public.manager_save_weekly_menu_par(uuid,jsonb,integer,numeric,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
