begin;

grant all privileges on table public.integration_connections to service_role;
grant all privileges on table public.oauth_states to service_role;
grant all privileges on table public.receipt_documents to service_role;
grant all privileges on table public.quickbooks_workflow_transactions to service_role;

commit;
