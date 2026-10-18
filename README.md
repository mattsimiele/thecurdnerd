# The Curd Nerd Data House

An invite-only manager reporting portal for The Curd Nerd and The Wedge. The interface is a static Next.js export suitable for GitHub Pages; Supabase Auth identifies managers, and protected PostgreSQL functions return only the reports assigned to that manager.

## Security model

- The browser contains only the Supabase project URL and publishable key.
- Public sign-up and anonymous sign-in are disabled in Supabase.
- Anonymous execution of every manager reporting function is revoked.
- Authenticated functions filter all sales and accounting data through `app.user_business_access`.
- Raw Square, normalized sales, ingestion, and accounting tables are not exposed to browser roles.
- `SUPABASE_DB_URL`, the database password, Square tokens, and QuickBooks secrets remain server-only.
- Every generated page carries `noindex, nofollow, noarchive, nocache`, and `robots.txt` disallows crawling. Authentication—not crawler directives—is the actual security boundary.

## Local development

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env.local`.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Leave `NEXT_PUBLIC_BASE_PATH` empty locally.
5. Run `pnpm dev`.

## Invite and authorize managers

1. In Supabase, open **Authentication → Users → Invite user**.
2. Invite the manager's email address. Self-service sign-up is disabled.
3. Run a customized copy of [`supabase/manager-access.example.sql`](supabase/manager-access.example.sql) in the Supabase SQL Editor.
4. Assign `the-curd-nerd`, `the-wedge`, or both, with a role of `owner`, `manager`, or `viewer`.

A signed-in user with no assignment sees no report data. Selecting a business without an assignment returns an access-denied response from PostgreSQL.

## Reports available now

- Arbitrary date ranges up to three years
- Daily and weekly sales
- Same-date-range year-over-year comparison
- Category and item performance
- Hourly sales aggregation
- Transaction count and average ticket
- QuickBooks movement and COGS summary when accounting data exists for the selected period

The hosted Drive/QuickBooks integration contract is documented in
[`docs/hosted-integrations.md`](docs/hosted-integrations.md). GitHub Pages is
the dashboard; Supabase Edge Functions are the secure integration layer.

## QuickBooks receipt workflow

The dashboard includes the complete receipt review interface. Google Drive and
QuickBooks OAuth, recursive PDF indexing, matching, attachment uploads, and
status updates run in the `receipt-workflow` Supabase Edge Function. Secrets
never enter the GitHub Pages bundle.

QuickBooks' public Accounting API does not expose Banking "For review" as a
queryable entity. The dashboard therefore imports that queue from the standard
QuickBooks CSV export. Posted accounting entities sync through the API. Receipt
matching uses exact cents and date proximity first; vendor text only increases
confidence. Approval queues the PDF. After the user posts the banking row, the
next QuickBooks sync discovers its entity ID and attaches the queued PDF to the
posted transaction.

## GitHub Pages deployment

The workflow at [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) builds a static export for `/thecurdnerd/salesreports/` and stages it beneath `salesreports/` in the Pages artifact. For the requested final URL, the GitHub Pages project repository should be named `thecurdnerd` and inherit the `siimiele.net` custom domain from the account site.

Create these GitHub repository **variables**, not secrets:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_RECEIPTS_API_URL` (for example, `https://PROJECT.supabase.co/functions/v1/receipt-workflow`)

Both are public by design. Do not create repository variables for the database URL, database password, Square token, QuickBooks secret, or any Supabase secret/service-role key.

Deploy the database migration and Edge Function before publishing the UI:

```sh
supabase db push
supabase functions deploy receipt-workflow --no-verify-jwt
```

Then set the Google and QuickBooks OAuth credentials as Supabase secrets. The
callback URLs are the function URL with `?action=google_callback` and
`?action=quickbooks_callback` respectively.

Enable **Settings → Pages → Source: GitHub Actions**, then run the workflow. The exact domain/repository topology must be confirmed before the first deployment so the workflow does not replace an existing Pages site.

## Square synchronization

The server-side job remains separate from GitHub Pages. Run [`scripts/sync_square_to_supabase.py`](scripts/sync_square_to_supabase.py) on the Mac server with:

- `SUPABASE_DB_URL`
- `SQUARE_ACCESS_TOKEN`
- `SQUARE_LOCATION_IDS=LVB650CJD1FCD,LRJKGMZV2MY77`
- `SQUARE_BASE_URL=https://connect.squareup.com`
- `SQUARE_LOOKBACK_DAYS=7`

The job upserts raw orders and normalized line items. It never deletes historical CSV records.

## Database migrations

- `20261016170000_initial_analytics.sql`: private schemas and normalized model
- `20261016190000_normalize_legacy_data.sql`: deterministic legacy cleanup
- `20261016200000_repair_legacy_transaction_ids.sql`: historical order grouping
- `20261016210000_manager_reporting_api.sql`: protected sales and accounting reports
- `20261016211000_manager_business_access_api.sql`: authenticated business assignments and available date bounds

See [`docs/data-cleanup.md`](docs/data-cleanup.md) for the imported-data audit.
