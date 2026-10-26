begin;
-- Preserve observed units independently of fallback inference. Conflicting
-- evidence stays unresolved rather than selecting one arbitrarily.
create table if not exists app.sales_unit_reference (
 business_id uuid not null references app.businesses(id),item_name text not null,
 variation_name text not null,unit text not null,
 primary key(business_id,item_name,variation_name,unit)
);
alter table app.sales_unit_reference enable row level security;
revoke all on app.sales_unit_reference from public,anon,authenticated;

create or replace function reporting.normalize_sales_unit(value text)
returns text language sql immutable set search_path=pg_catalog as $$
 select case when lower(btrim(value)) in ('ea','each') then 'each'
 when lower(btrim(value)) in ('lb','lbs','pound','pounds') then 'lb'
 when lower(btrim(value)) in ('','unknown') then null else btrim(value) end;
$$;

create or replace function reporting.square_sales_unit(line jsonb)
returns text language sql immutable set search_path=pg_catalog as $$
 select case
 when line->'quantity_unit'->'measurement_unit'->>'weight_unit'='IMPERIAL_POUND' then 'lb'
 when line->'quantity_unit' is not null and line->'quantity_unit'<>'null'::jsonb then coalesce(
 line->'quantity_unit'->'measurement_unit'->>'weight_unit',
 line->'quantity_unit'->'measurement_unit'->>'volume_unit',
 line->'quantity_unit'->'measurement_unit'->'custom_unit'->>'abbreviation')
 when line->>'item_type'='ITEM' then 'each' end;
$$;

-- Seed only original evidence: historical explicit labels and current Square
-- metadata. On rerun, never promote inferred labels back into evidence.
do $$
begin
 if not exists(select 1 from information_schema.columns where table_schema='reporting' and table_name='operating_sales_lines' and column_name='quantity_unit_source') then
 insert into app.sales_unit_reference
 select distinct business_id,item_name,coalesce(variation_name,''),reporting.normalize_sales_unit(quantity_unit)
 from reporting.operating_sales_lines where quantity_unit<>'Unknown' and sale_kind='sale'
 and lower(btrim(item_name)) not in ('','unnamed item','custom amount')
 on conflict do nothing;
 end if;
end $$;

create or replace function app.capture_square_unit_reference()
returns trigger language plpgsql security definer set search_path=pg_catalog,app,reporting as $$
begin
 insert into app.sales_unit_reference(business_id,item_name,variation_name,unit)
 select new.business_id,l->>'name',coalesce(l->>'variation_name',''),reporting.square_sales_unit(l)
 from jsonb_array_elements(case when jsonb_typeof(new.payload->'line_items')='array' then new.payload->'line_items' else '[]'::jsonb end) l
 where reporting.square_sales_unit(l) is not null and l->>'item_type'='ITEM'
 and lower(btrim(coalesce(l->>'name',''))) not in ('','unnamed item','custom amount')
 on conflict do nothing;
 return new;
end $$;
drop trigger if exists capture_square_units on ingest.square_orders_raw;
create trigger capture_square_units after insert or update of payload on ingest.square_orders_raw
 for each row execute function app.capture_square_unit_reference();
revoke all on function app.capture_square_unit_reference(),reporting.square_sales_unit(jsonb),reporting.normalize_sales_unit(text) from public,anon,authenticated;

create or replace view reporting.operating_sales_lines as
select s.*, coalesce(nullif(btrim(s.category), ''), 'Uncategorized') category_label,
  li.value->>'catalog_object_id' catalog_variation_id,
  case when li.value->>'item_type' = 'GIFT_CARD' then 'gift_card'
       when li.value is null and lower(btrim(s.item_name)) in ('gift card','egift card') then 'gift_card_unverified'
       else 'sale' end sale_kind,
  coalesce(reporting.square_sales_unit(li.value),reporting.normalize_sales_unit(legacy.unit),
    case when ref.unit_count=1 then ref.unit when ref.unit_count>1 then 'Unknown'
      when s.quantity<>trunc(s.quantity) then 'lb' else 'each' end) quantity_unit,
  case when reporting.square_sales_unit(li.value) is not null then 'square'
    when reporting.normalize_sales_unit(legacy.unit) is not null then 'legacy'
    when ref.unit_count=1 then 'matched_item' when ref.unit_count>1 then 'conflicting_item'
    else 'quantity_fallback' end quantity_unit_source
from core.sales_line_items s
left join ingest.square_orders_raw raw on raw.order_id=s.square_order_id and raw.business_id=s.business_id
left join lateral (
  select value from jsonb_array_elements(raw.payload->'line_items')
  where value->>'uid'=s.square_line_item_uid limit 1
) li on true
left join (select business_id,item_name,variation_name,min(unit) unit,count(*) unit_count from app.sales_unit_reference group by 1,2,3) ref
 on ref.business_id=s.business_id and ref.item_name=s.item_name and ref.variation_name=coalesce(s.variation_name,'')
left join ingest.square_item_sales_legacy legacy
  on legacy.legacy_row_id=case when s.square_line_item_uid ~ '^legacy-line:[0-9]+$' then substring(s.square_line_item_uid from 13)::bigint end;


revoke all on reporting.operating_sales_lines from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
