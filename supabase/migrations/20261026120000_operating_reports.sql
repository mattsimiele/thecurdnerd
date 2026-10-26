begin;

-- Private reporting views keep original imports intact. Raw Square metadata is
-- read on demand, so the existing nightly importer needs no coordinated rollout.
create or replace view reporting.operating_sales_lines as
select s.*, coalesce(nullif(btrim(s.category), ''), 'Uncategorized') category_label,
  li.value->>'catalog_object_id' catalog_variation_id,
  case when li.value->>'item_type' = 'GIFT_CARD' then 'gift_card'
       when li.value is null and lower(btrim(s.item_name)) in ('gift card','egift card') then 'gift_card_unverified'
       else 'sale' end sale_kind,
  case when li.value->'quantity_unit'->'measurement_unit'->>'weight_unit' = 'IMPERIAL_POUND' then 'lb'
       when li.value->'quantity_unit' is not null then coalesce(
         li.value->'quantity_unit'->'measurement_unit'->>'weight_unit',
         li.value->'quantity_unit'->'measurement_unit'->>'volume_unit',
         li.value->'quantity_unit'->'measurement_unit'->'custom_unit'->>'abbreviation', 'Unknown')
       when li.value->>'item_type' = 'ITEM' then 'each'
       else coalesce(nullif(btrim(legacy.unit),''),'Unknown') end quantity_unit
from core.sales_line_items s
left join ingest.square_orders_raw raw on raw.order_id=s.square_order_id and raw.business_id=s.business_id
left join lateral (
  select value from jsonb_array_elements(raw.payload->'line_items')
  where value->>'uid'=s.square_line_item_uid limit 1
) li on true
left join ingest.square_item_sales_legacy legacy
  on legacy.legacy_row_id=case when s.square_line_item_uid ~ '^legacy-line:[0-9]+$' then substring(s.square_line_item_uid from 13)::bigint end;

create or replace view reporting.operating_expense_lines as
select a.*, coalesce(nullif(btrim(a.account_name),''),'Unclassified') account_label,
  coalesce(nullif(btrim(a.vendor_name),''),'Vendor not recorded') vendor_label,
  b.slug business_slug
from core.accounting_transactions a
left join app.businesses b on b.id=a.business_id
where a.expense_amount_cents is not null
and (a.quickbooks_realm_id <> 'legacy-import' or
  (a.allocation_status='assigned' and (b.quickbooks_live_from is null or a.transaction_date<b.quickbooks_live_from)) or
  (a.allocation_status='shared' and not exists (
    select 1 from app.businesses live where live.active and live.quickbooks_live_from<=a.transaction_date
  )));

revoke all on reporting.operating_sales_lines, reporting.operating_expense_lines from public, anon, authenticated;

create or replace function public.manager_operating_report(p_start_date date, p_end_date date)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,app,core,reporting,ingest,ops
as $$
declare
  allowed uuid[]; can_shared boolean; previous_start date; result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_start_date is null or p_end_date is null or p_end_date<p_start_date or p_end_date-p_start_date>1095
    then raise exception 'Choose a date range of at most three years' using errcode='22007'; end if;
  select array_agg(b.id) into allowed from app.businesses b join app.user_business_access u on u.business_id=b.id
    where u.user_id=auth.uid() and b.active;
  if allowed is null then raise exception 'Business access denied' using errcode='42501'; end if;
  -- Shared figures are visible only to a user assigned every active business.
  select count(*)>=2 and bool_and(id=any(allowed)) into can_shared from app.businesses where active;
  previous_start:=p_start_date-(p_end_date-p_start_date+1);
  with sales as materialized (
    select * from reporting.operating_sales_lines where business_id=any(allowed)
      and business_date between previous_start and p_end_date and order_state='COMPLETED'
  ), expenses as materialized (
    select * from reporting.operating_expense_lines where transaction_date between previous_start and p_end_date
      and (business_id=any(allowed) or (can_shared and allocation_status in ('shared','unassigned')))
  ), business_summary as (
    select b.slug,b.name,
      coalesce(sum(s.net_sales_cents) filter(where s.business_date>=p_start_date and s.sale_kind='sale'),0) sales_cents,
      coalesce(sum(s.net_sales_cents) filter(where s.business_date<p_start_date and s.sale_kind='sale'),0) previous_sales_cents,
      count(distinct s.square_order_id) filter(where s.business_date>=p_start_date and s.sale_kind='sale') tickets,
      count(distinct s.square_order_id) filter(where s.business_date<p_start_date and s.sale_kind='sale') previous_tickets,
      count(distinct s.business_date) filter(where s.business_date>=p_start_date) observed_days,
      count(distinct s.business_date) filter(where s.business_date<p_start_date) previous_observed_days,
      coalesce(sum(s.net_sales_cents) filter(where s.business_date>=p_start_date and s.sale_kind='gift_card'),0) gift_card_cents,
      coalesce(sum(s.net_sales_cents) filter(where s.business_date>=p_start_date and s.sale_kind='gift_card_unverified'),0) unverified_gift_card_cents,
      count(*) filter(where s.business_date>=p_start_date and s.sale_kind='sale' and s.category_label='Uncategorized') uncategorized_lines,
      count(*) filter(where s.business_date>=p_start_date and s.sale_kind='sale' and s.quantity_unit='Unknown') unknown_unit_lines,
      (select max(business_date) from core.sales_line_items where business_id=b.id) sales_through,
      (select max(imported_at) from core.sales_line_items where business_id=b.id) sales_imported_at,
      (select max(transaction_date) from reporting.operating_expense_lines where business_id=b.id) accounting_through,
      (select max(imported_at) from reporting.operating_expense_lines where business_id=b.id) accounting_imported_at,
      coalesce((select sum(expense_amount_cents) from expenses e where e.business_id=b.id and transaction_date>=p_start_date),0) direct_expense_cents
    from app.businesses b left join sales s on s.business_id=b.id where b.id=any(allowed) group by b.id
  ), daily as (
    select b.slug, d::date business_date, count(s.id) source_lines,
      coalesce(sum(s.net_sales_cents) filter(where s.sale_kind='sale'),0) sales_cents
    from app.businesses b cross join generate_series(p_start_date::timestamp,p_end_date::timestamp,interval '1 day') d
    left join sales s on s.business_id=b.id and s.business_date=d::date
    where b.id=any(allowed) group by b.slug,d
  ), categories as (
    select b.slug,s.category_label category,sum(s.net_sales_cents) sales_cents
    from sales s join app.businesses b on b.id=s.business_id
    where s.business_date>=p_start_date and s.sale_kind='sale' group by 1,2
  ), items as (
    select b.slug,s.item_name,s.variation_name,s.catalog_variation_id,s.quantity_unit,
      sum(s.quantity) quantity,sum(s.net_sales_cents) sales_cents,
      row_number() over(partition by b.slug order by sum(s.net_sales_cents) desc,s.item_name,s.variation_name) ranking
    from sales s join app.businesses b on b.id=s.business_id where s.business_date>=p_start_date and s.sale_kind='sale'
    group by 1,2,3,4,5
  ), accounts as (
    select account_label account,account_type,coalesce(business_slug,allocation_status) allocation,
      coalesce(sum(expense_amount_cents) filter(where transaction_date>=p_start_date),0) current_cents,
      coalesce(sum(expense_amount_cents) filter(where transaction_date<p_start_date),0) previous_cents,
      count(*) filter(where transaction_date>=p_start_date) line_count
    from expenses group by 1,2,3
  ), vendors as (
    select account_label account,vendor_label vendor,coalesce(business_slug,allocation_status) allocation,
      coalesce(sum(expense_amount_cents) filter(where transaction_date>=p_start_date),0) current_cents,
      coalesce(sum(expense_amount_cents) filter(where transaction_date<p_start_date),0) previous_cents
    from expenses group by 1,2,3
  ), returns as (
    -- Item-return evidence is shown separately, not silently deducted from a
    -- mixed CSV/API sales measure whose historical refund basis is unverified.
    select b.slug,count(*) return_lines,
      sum(coalesce((li->'total_money'->>'amount')::bigint,0)-coalesce((li->'total_tax_money'->>'amount')::bigint,0)) return_cents
    from ingest.square_orders_raw r join app.businesses b on b.id=r.business_id
    cross join lateral jsonb_array_elements(r.payload->'returns') ret
    cross join lateral jsonb_array_elements(ret->'return_line_items') li
    where r.business_id=any(allowed) and (r.closed_at at time zone b.timezone)::date between p_start_date and p_end_date
      and coalesce(li->>'item_type','')<>'GIFT_CARD'
    group by b.slug
  ) select jsonb_build_object(
    'startDate',p_start_date,'endDate',p_end_date,'previousStartDate',previous_start,'previousEndDate',p_start_date-1,
    'sharedVisible',can_shared,
    'accountingDataThrough',(select max(transaction_date) from reporting.operating_expense_lines where business_id=any(allowed) or (can_shared and allocation_status in ('shared','unassigned'))),
    'accountingImportedAt',(select max(imported_at) from reporting.operating_expense_lines where business_id=any(allowed) or (can_shared and allocation_status in ('shared','unassigned'))),
    'businesses',coalesce((select jsonb_agg(to_jsonb(x) order by slug) from business_summary x),'[]'::jsonb),
    'daily',coalesce((select jsonb_agg(to_jsonb(x) order by business_date,slug) from daily x),'[]'::jsonb),
    'categories',coalesce((select jsonb_agg(to_jsonb(x) order by sales_cents desc) from categories x),'[]'::jsonb),
    'items',coalesce((select jsonb_agg(to_jsonb(x) order by slug,ranking) from items x where ranking<=50),'[]'::jsonb),
    'accounts',coalesce((select jsonb_agg(to_jsonb(x) order by current_cents desc,account,allocation) from accounts x),'[]'::jsonb),
    'vendors',coalesce((select jsonb_agg(to_jsonb(x) order by current_cents desc) from vendors x),'[]'::jsonb),
    'recordedReturns',coalesce((select jsonb_agg(to_jsonb(x)) from returns x),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.manager_expense_lines(
  p_start_date date,p_end_date date,p_account text,p_allocation text default null,p_offset integer default 0
) returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,app,core,reporting
as $$
declare allowed uuid[]; can_shared boolean; result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_start_date is null or p_end_date is null or p_end_date<p_start_date or p_end_date-p_start_date>1095 or p_offset is null or p_offset<0
    then raise exception 'Invalid report parameters' using errcode='22007'; end if;
  select array_agg(b.id) into allowed from app.businesses b join app.user_business_access u on u.business_id=b.id
    where u.user_id=auth.uid() and b.active;
  if allowed is null then raise exception 'Business access denied' using errcode='42501'; end if;
  select count(*)>=2 and bool_and(id=any(allowed)) into can_shared from app.businesses where active;
  with matches as materialized (
    select id,transaction_date,account_label account,vendor_label vendor,expense_amount_cents amount_cents,
      coalesce(business_slug,allocation_status) allocation,quickbooks_entity_type entity_type,
      source_transaction_id,quickbooks_entity_id,quickbooks_realm_id
    from reporting.operating_expense_lines
    where transaction_date between p_start_date and p_end_date and account_label=p_account
      and (p_allocation is null or coalesce(business_slug,allocation_status)=p_allocation)
      and (business_id=any(allowed) or (can_shared and allocation_status in ('shared','unassigned')))
  ), page as (
    select id,transaction_date,account,vendor,amount_cents,allocation,entity_type,
      coalesce(source_transaction_id,quickbooks_entity_id) source_id
    from matches order by transaction_date desc,id limit 50 offset p_offset
  ) select jsonb_build_object('total',(select count(*) from matches),
    'rows',coalesce((select jsonb_agg(to_jsonb(p) order by transaction_date desc,id) from page p),'[]'::jsonb)) into result;
  return result;
end;
$$;
revoke all on function public.manager_operating_report(date,date) from public,anon;
revoke all on function public.manager_expense_lines(date,date,text,text,integer) from public,anon;
grant execute on function public.manager_operating_report(date,date) to authenticated;
grant execute on function public.manager_expense_lines(date,date,text,text,integer) to authenticated;
notify pgrst, 'reload schema';
commit;
