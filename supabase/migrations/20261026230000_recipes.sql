begin;

create table if not exists app.inventory_recipes (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references app.businesses(id),
 item_name text not null check(length(btrim(item_name)) between 1 and 300),
 variation_name text not null default '' check(length(variation_name)<=300),
 sales_unit text not null check(length(btrim(sales_unit)) between 1 and 100),
 batch_yield numeric not null check(batch_yield>0 and batch_yield<=1000000),
 notes text not null default '' check(length(notes)<=2000),
 active boolean not null default true,
 revision integer not null default 1,
 updated_at timestamptz not null default now(),
 updated_by uuid not null references auth.users(id),
 unique(business_id,item_name,variation_name,sales_unit)
);
create table if not exists app.inventory_recipe_ingredients (
 recipe_id uuid not null references app.inventory_recipes(id),
 item_id uuid not null references app.inventory_items(id),
 quantity numeric not null check(quantity>0 and quantity<=1000000),
 primary key(recipe_id,item_id)
);
create table if not exists app.inventory_recipe_history (
 id bigint generated always as identity primary key,
 recipe_id uuid not null references app.inventory_recipes(id),
 recorded_at timestamptz not null default now(),
 recorded_by uuid not null references auth.users(id),
 snapshot jsonb not null
);
alter table app.inventory_recipes enable row level security;
alter table app.inventory_recipe_ingredients enable row level security;
alter table app.inventory_recipe_history enable row level security;
revoke all on app.inventory_recipes,app.inventory_recipe_ingredients,app.inventory_recipe_history from public,anon,authenticated;

create or replace function public.manager_recipe_plan(p_business_id uuid)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,app,reporting as $$
declare finish date;
begin
 if auth.uid() is null or not exists(select 1 from app.user_business_access u join app.businesses b on b.id=u.business_id where u.user_id=auth.uid() and b.id=p_business_id and b.active and b.slug='the-wedge') then
 raise exception 'Wedge access required' using errcode='42501'; end if;
 finish:=date_trunc('week',now() at time zone 'America/New_York')::date-1;
 return jsonb_build_object(
 'startDate',finish-27,'endDate',finish,
 'salesThrough',(select max(business_date) from core.sales_line_items where business_id=p_business_id),
 'menu',coalesce((select jsonb_agg(to_jsonb(m) order by m.sales_cents desc,m.item_name,m.variation_name,m.sales_unit) from (
 select item_name,coalesce(variation_name,'') variation_name,quantity_unit sales_unit,
 sum(quantity) quantity,sum(net_sales_cents) sales_cents
 from reporting.operating_sales_lines where business_id=p_business_id and business_date between finish-27 and finish and order_state='COMPLETED' and sale_kind='sale'
 group by 1,2,3 having sum(quantity)>0) m),'[]'::jsonb),
 'recipes',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('ingredients',(
 select jsonb_agg(jsonb_build_object('item_id',l.item_id,'quantity',l.quantity,'name',i.name,'unit',i.unit) order by i.name)
 from app.inventory_recipe_ingredients l join app.inventory_items i on i.id=l.item_id where l.recipe_id=r.id
 )) order by r.item_name,r.variation_name,r.sales_unit) from app.inventory_recipes r where r.business_id=p_business_id),'[]'::jsonb)
 );
end $$;

create or replace function public.manager_save_recipe(p_business_id uuid,p_recipe_id uuid,p_revision integer,p_values jsonb)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,app,reporting as $$
declare r app.inventory_recipes; prior app.inventory_recipes; component jsonb; n integer; result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from app.user_business_access u join app.businesses b on b.id=u.business_id where u.user_id=auth.uid() and b.id=p_business_id and b.active and b.slug='the-wedge' and u.role in ('owner','manager')) then
 raise exception 'Wedge editing access required' using errcode='42501'; end if;
 if p_values is null or jsonb_typeof(p_values)<>'object' then raise exception 'Invalid recipe' using errcode='22023'; end if;
 if p_recipe_id is not null then
 select * into prior from app.inventory_recipes where id=p_recipe_id and business_id=p_business_id for update;
 if not found then raise exception 'Recipe not found' using errcode='42501'; end if;
 if p_revision is distinct from prior.revision then raise exception 'Recipe changed; reload before saving' using errcode='40001'; end if;
 end if;
 r.id:=coalesce(p_recipe_id,gen_random_uuid());r.business_id:=p_business_id;
 r.item_name:=p_values->>'item_name';r.variation_name:=coalesce(p_values->>'variation_name','');r.sales_unit:=p_values->>'sales_unit';
 if p_recipe_id is not null and (r.item_name is distinct from prior.item_name or r.variation_name is distinct from prior.variation_name or r.sales_unit is distinct from prior.sales_unit) then
 raise exception 'Menu identity cannot change' using errcode='22023'; end if;
 if p_recipe_id is null and not exists(select 1 from reporting.operating_sales_lines s where s.business_id=p_business_id and s.item_name=r.item_name and coalesce(s.variation_name,'')=r.variation_name and s.quantity_unit=r.sales_unit and s.sale_kind='sale' and s.order_state='COMPLETED') then
 raise exception 'Choose an existing menu item and source unit' using errcode='22023'; end if;
 r.batch_yield:=(p_values->>'batch_yield')::numeric;r.notes:=coalesce(p_values->>'notes','');r.active:=coalesce((p_values->>'active')::boolean,true);
 if r.active and (p_values->>'verified')::boolean is distinct from true then raise exception 'Confirm recipe quantities and selling units' using errcode='22023'; end if;
 if jsonb_typeof(p_values->'ingredients') is distinct from 'array' then raise exception 'Ingredient list required' using errcode='22023'; end if;
 n:=jsonb_array_length(p_values->'ingredients');
 if n<1 or n>100 then raise exception 'Choose between 1 and 100 ingredients' using errcode='22023'; end if;
 -- Lock ingredient rows for the duration of the save. Archived ingredients
 -- invalidate active mappings; their history may still be retained on disable.
 for component in select value from jsonb_array_elements(p_values->'ingredients') loop
 perform 1 from app.inventory_items where id=(component->>'item_id')::uuid and business_id=p_business_id and (active or not r.active) for share;
 if not found then raise exception 'Ingredient must belong to this business and be active' using errcode='22023'; end if;
 end loop;
 r.revision:=coalesce(prior.revision,0)+1;r.updated_at:=now();r.updated_by:=auth.uid();
 insert into app.inventory_recipes select (r).* on conflict(id) do update set
 batch_yield=excluded.batch_yield,notes=excluded.notes,active=excluded.active,revision=excluded.revision,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
 delete from app.inventory_recipe_ingredients where recipe_id=r.id;
 insert into app.inventory_recipe_ingredients(recipe_id,item_id,quantity)
 select r.id,(v->>'item_id')::uuid,(v->>'quantity')::numeric from jsonb_array_elements(p_values->'ingredients') v;
 result:=to_jsonb(r)||jsonb_build_object('ingredients',(
 select jsonb_agg(jsonb_build_object('item_id',l.item_id,'quantity',l.quantity,'name',i.name,'unit',i.unit) order by i.name)
 from app.inventory_recipe_ingredients l join app.inventory_items i on i.id=l.item_id where l.recipe_id=r.id));
 insert into app.inventory_recipe_history(recipe_id,recorded_by,snapshot) values(r.id,auth.uid(),result);
 return result;
end $$;
revoke all on function public.manager_recipe_plan(uuid),public.manager_save_recipe(uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.manager_recipe_plan(uuid),public.manager_save_recipe(uuid,uuid,integer,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
