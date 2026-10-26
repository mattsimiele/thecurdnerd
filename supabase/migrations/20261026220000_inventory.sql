begin;

-- Counts are explicit snapshots; sales never silently deplete ingredient stock.
create table if not exists app.inventory_items (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references app.businesses(id),
 name text not null check(length(btrim(name)) between 1 and 160),
 unit text not null check(unit in ('lb','oz','kg','g','each','L','mL')),
 supplier text not null default '' check(length(supplier)<=160),
 par numeric check(par>=0 and par<=1000000), pack_size numeric check(pack_size>0 and pack_size<=1000000),
 lead_days integer check(lead_days between 0 and 90), buffer_days integer not null default 2 check(buffer_days between 0 and 30),
 on_hand numeric check(on_hand>=0 and on_hand<=1000000), inbound numeric not null default 0 check(inbound>=0 and inbound<=1000000),
 counted_at timestamptz, notes text not null default '' check(length(notes)<=2000),
 active boolean not null default true, revision integer not null default 1,
 updated_at timestamptz not null default now(), updated_by uuid not null references auth.users(id),
 check ((on_hand is null and counted_at is null) or (on_hand is not null and counted_at is not null))
);
create unique index if not exists inventory_unique_active on app.inventory_items(business_id,lower(btrim(name)),unit) where active;
create table if not exists app.inventory_history (
 id bigint generated always as identity primary key, item_id uuid not null references app.inventory_items(id),
 recorded_at timestamptz not null default now(), recorded_by uuid not null references auth.users(id), snapshot jsonb not null
);
alter table app.inventory_items enable row level security;
alter table app.inventory_history enable row level security;
revoke all on app.inventory_items,app.inventory_history from public,anon,authenticated;

create or replace function public.manager_inventory()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,app,reporting as $$
declare allowed uuid[]; finish date; result jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select array_agg(b.id) into allowed from app.businesses b join app.user_business_access u on u.business_id=b.id where b.active and u.user_id=auth.uid();
 if allowed is null then raise exception 'Business access denied' using errcode='42501'; end if;
 finish:=date_trunc('week',now() at time zone 'America/New_York')::date-1;
 with candidates as (
 select s.business_id,s.item_name,coalesce(s.variation_name,'') variation_name,s.quantity_unit,
 sum(s.quantity) quantity,sum(s.net_sales_cents) sales_cents,count(distinct s.business_date) selling_days
 from reporting.operating_sales_lines s
 where s.business_id=any(allowed) and s.business_date between finish-27 and finish
 and s.order_state='COMPLETED' and s.sale_kind='sale'
 group by 1,2,3,4 having sum(s.quantity)>0
 ), ranked as (
 select *,row_number() over(partition by business_id order by sales_cents desc,item_name,variation_name,quantity_unit) ranking from candidates
 ) select jsonb_build_object(
 'startDate',finish-27,'endDate',finish,'serverNow',now(),
 'businesses',(select jsonb_agg(jsonb_build_object('id',b.id,'slug',b.slug,'name',b.name,'role',u.role,
 'salesThrough',(select max(business_date) from core.sales_line_items where business_id=b.id))) from app.businesses b join app.user_business_access u on u.business_id=b.id where b.id=any(allowed) and u.user_id=auth.uid()),
 'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.name) from app.inventory_items i where i.business_id=any(allowed) and i.active),'[]'::jsonb),
 'candidates',coalesce((select jsonb_agg(to_jsonb(r) order by r.business_id,r.ranking) from ranked r where ranking<=100),'[]'::jsonb)
 ) into result;
 return result;
end $$;

create or replace function public.manager_save_inventory(p_business_id uuid,p_item_id uuid,p_revision integer,p_values jsonb,p_count boolean default false)
returns jsonb language plpgsql security definer set search_path=pg_catalog,app as $$
declare item app.inventory_items; prior app.inventory_items;
begin
 if auth.uid() is null or not exists(select 1 from app.user_business_access u join app.businesses b on b.id=u.business_id where u.user_id=auth.uid() and b.id=p_business_id and b.active and u.role in ('owner','manager')) then
 raise exception 'Inventory editing access denied' using errcode='42501'; end if;
 if p_values is null or jsonb_typeof(p_values)<>'object' or p_count is null then raise exception 'Invalid inventory fields' using errcode='22023'; end if;
 if p_item_id is not null then
 select * into prior from app.inventory_items where id=p_item_id and business_id=p_business_id for update;
 if not found then raise exception 'Inventory item not found' using errcode='42501'; end if;
 if p_revision is distinct from prior.revision then raise exception 'This item changed. Reload before saving.' using errcode='40001'; end if;
 if p_values->>'unit' is distinct from prior.unit then raise exception 'Create a new item to change units' using errcode='22023'; end if;
 end if;
 item.id:=coalesce(p_item_id,gen_random_uuid());item.business_id:=p_business_id;
 item.name:=btrim(p_values->>'name');item.unit:=p_values->>'unit';item.supplier:=btrim(coalesce(p_values->>'supplier',''));
 item.par:=nullif(p_values->>'par','')::numeric;item.pack_size:=nullif(p_values->>'pack_size','')::numeric;
 item.lead_days:=nullif(p_values->>'lead_days','')::integer;item.buffer_days:=coalesce(nullif(p_values->>'buffer_days','')::integer,2);
 item.notes:=coalesce(p_values->>'notes','');item.active:=coalesce((p_values->>'active')::boolean,true);
 if p_count then
 item.on_hand:=(p_values->>'on_hand')::numeric;item.inbound:=(p_values->>'inbound')::numeric;item.counted_at:=now();
 if item.on_hand is null or item.inbound is null then raise exception 'Count and inbound quantity required' using errcode='22023'; end if;
 else item.on_hand:=prior.on_hand;item.inbound:=coalesce(prior.inbound,0);item.counted_at:=prior.counted_at;
 end if;
 item.revision:=coalesce(prior.revision,0)+1;item.updated_at:=now();item.updated_by:=auth.uid();
 insert into app.inventory_items select (item).* on conflict(id) do update set
 name=excluded.name,supplier=excluded.supplier,par=excluded.par,pack_size=excluded.pack_size,lead_days=excluded.lead_days,buffer_days=excluded.buffer_days,
 on_hand=excluded.on_hand,inbound=excluded.inbound,counted_at=excluded.counted_at,notes=excluded.notes,active=excluded.active,
 revision=excluded.revision,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
 insert into app.inventory_history(item_id,recorded_by,snapshot) values(item.id,auth.uid(),to_jsonb(item));
 return to_jsonb(item);
end $$;
revoke all on function public.manager_inventory() from public,anon;
revoke all on function public.manager_save_inventory(uuid,uuid,integer,jsonb,boolean) from public,anon;
grant execute on function public.manager_inventory() to authenticated;
grant execute on function public.manager_save_inventory(uuid,uuid,integer,jsonb,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
