begin;

create table if not exists public.integration_connections (
  provider text primary key check (provider in ('google_drive', 'quickbooks')),
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  external_account_id text,
  external_account_name text,
  scope text,
  connected_by uuid references auth.users(id),
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.oauth_states (
  state text primary key,
  provider text not null check (provider in ('google_drive', 'quickbooks')),
  user_id uuid not null references auth.users(id) on delete cascade,
  return_to text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.receipt_documents (
  id uuid primary key default gen_random_uuid(),
  drive_file_id text not null unique,
  drive_parent_id text,
  file_name text not null,
  mime_type text not null,
  web_view_link text,
  modified_at timestamptz,
  size_bytes bigint,
  md5_checksum text,
  parsed_date date,
  parsed_vendor text,
  parsed_amount_cents bigint,
  indexed_at timestamptz not null default now(),
  active boolean not null default true
);

create table if not exists public.quickbooks_workflow_transactions (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  quickbooks_entity_type text,
  quickbooks_entity_id text,
  quickbooks_sync_token text,
  account_name text not null,
  transaction_date date not null,
  description text not null,
  amount_cents bigint not null,
  vendor text,
  category text,
  location text check (location in ('The Curd Nerd', 'The Wedge', 'TCN/Wedge')),
  receipt_id uuid references public.receipt_documents(id),
  receipt_confidence numeric check (receipt_confidence between 0 and 1),
  status text not null default 'needs_receipt'
    check (status in ('needs_receipt', 'matched', 'needs_review', 'approved', 'uploaded', 'posted', 'held')),
  source text not null check (source in ('quickbooks_api', 'quickbooks_export')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  uploaded_at timestamptz,
  posted_at timestamptz,
  quickbooks_attachable_id text,
  last_error text,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quickbooks_workflow_status_idx
  on public.quickbooks_workflow_transactions (status, transaction_date desc);
create index if not exists receipt_documents_match_idx
  on public.receipt_documents (parsed_amount_cents, parsed_date);

alter table public.integration_connections enable row level security;
alter table public.oauth_states enable row level security;
alter table public.receipt_documents enable row level security;
alter table public.quickbooks_workflow_transactions enable row level security;

revoke all on public.integration_connections, public.oauth_states,
  public.receipt_documents, public.quickbooks_workflow_transactions from public, anon, authenticated;

create or replace function public.manager_quickbooks_workflow()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, app
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from app.user_business_access access
    where access.user_id = auth.uid() and access.role in ('owner', 'manager')
  ) then
    raise exception 'Manager access required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'fetched_at', now(),
    'source', case when exists (
      select 1 from public.integration_connections where provider = 'quickbooks' and refresh_token is not null
    ) then 'quickbooks' else 'not_connected' end,
    'connections', jsonb_build_object(
      'google_drive', exists (select 1 from public.integration_connections where provider = 'google_drive' and refresh_token is not null),
      'quickbooks', exists (select 1 from public.integration_connections where provider = 'quickbooks' and refresh_token is not null)
    ),
    'transactions', coalesce(jsonb_agg(jsonb_build_object(
      'id', txn.id,
      'account_name', txn.account_name,
      'transaction_date', txn.transaction_date,
      'description', txn.description,
      'amount_cents', txn.amount_cents,
      'location', txn.location,
      'vendor', txn.vendor,
      'category', txn.category,
      'receipt_id', receipt.id,
      'receipt_path', receipt.web_view_link,
      'receipt_name', receipt.file_name,
      'receipt_confidence', txn.receipt_confidence,
      'status', txn.status,
      'source', txn.source,
      'last_error', txn.last_error,
      'updated_at', txn.updated_at
    ) order by txn.transaction_date desc, txn.created_at desc) filter (where txn.id is not null), '[]'::jsonb)
  ) into result
  from public.quickbooks_workflow_transactions txn
  left join public.receipt_documents receipt on receipt.id = txn.receipt_id
  where txn.status <> 'held';

  return result;
end;
$$;

create or replace function public.approve_quickbooks_receipt(
  p_transaction_id uuid,
  p_vendor text,
  p_category text,
  p_location text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app
as $$
declare
  changed public.quickbooks_workflow_transactions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from app.user_business_access access
    where access.user_id = auth.uid() and access.role in ('owner', 'manager')
  ) then
    raise exception 'Manager access required' using errcode = '42501';
  end if;
  if nullif(trim(p_vendor), '') is null or nullif(trim(p_category), '') is null
     or p_location not in ('The Curd Nerd', 'The Wedge', 'TCN/Wedge') then
    raise exception 'Vendor, category, and location are required' using errcode = '22023';
  end if;

  update public.quickbooks_workflow_transactions
  set vendor = trim(p_vendor), category = trim(p_category), location = p_location,
      status = 'approved', approved_by = auth.uid(), approved_at = now(),
      updated_at = now(), last_error = null
  where id = p_transaction_id and receipt_id is not null
    and status in ('matched', 'needs_review')
  returning * into changed;

  if changed.id is null then
    raise exception 'Transaction is not ready for approval' using errcode = 'P0002';
  end if;
  return jsonb_build_object('id', changed.id, 'status', changed.status);
end;
$$;

revoke all on function public.manager_quickbooks_workflow() from public, anon;
revoke all on function public.approve_quickbooks_receipt(uuid, text, text, text) from public, anon;
grant execute on function public.manager_quickbooks_workflow() to authenticated;
grant execute on function public.approve_quickbooks_receipt(uuid, text, text, text) to authenticated;

commit;
