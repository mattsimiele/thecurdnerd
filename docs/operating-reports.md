# Operating reports

The dashboard now uses `manager_operating_report(date,date)` and
`manager_expense_lines(date,date,text,text,integer)`. Apply
`supabase/migrations/20261026120000_operating_reports.sql` before deploying the
frontend. The migration is additive: it leaves existing imports and report RPCs
intact. The new private reporting views are not available to browser roles.

## Definitions

- Default range: four completed Monday–Sunday weeks, in America/New_York.
- Comparison: the immediately preceding equal-length period. Calendar-month
  selection does not imply the books are closed.
- Item sales: completed normalized line totals, excluding source-typed
  GIFT_CARD rows. When raw metadata is missing, exact historical Gift Card and
  eGift Card names are held out separately as unverified, not certified issuance.
- Refunds: stored item returns are displayed separately, excluding gift-card
  returns. They are not automatically subtracted from mixed historical imports;
  this avoids claiming reconciled net revenue or double-subtracting historical
  returns. Full historical Square reconciliation remains outstanding.
- Transactions: distinct orders with included sales lines. Gift-card-only
  orders are excluded. Average ticket uses that same population.
- Units: source quantity-unit metadata, with ITEM/no measurement unit treated
  as each. Historical CSV units are recovered by their immutable staging row ID.
  Missing metadata is Unknown, never guessed as pounds.
  Item reporting retains variation names, catalog variation IDs, and units.
- Expenses: classified expense lines, including COGS purchases, respecting
  legacy/API cutovers. No inference of cash flow, true inventory consumption,
  or profit is made.
- Shared/unassigned costs: available only when a manager can access every
  active business and there are at least two active businesses. Direct business
  views do not allocate these costs. Restricted users cannot retrieve shared
  transaction detail through a different filter.
- All categories contribute to percentage totals. Item lists explicitly limit
  to 50 variant/unit groups per business. Expense lines page in groups of 50.
- No-row dates remain visible and are not asserted to be closures or verified
  zero-sales days. Freshness uses each business's full dataset, independent of
  the selected reporting window.

## Validation

Run `pnpm test`, `pnpm typecheck`, and `pnpm build`.
Run `python3 tests/operating-reports-db.py` for rollback-only integration checks
with `psycopg2-binary` and `python-dotenv` installed. This uses the configured
server database URL and requires an existing manager assigned both businesses. Database integration checks
should apply the migration inside a rollback-only transaction and verify:
category and daily totals match summaries; gift-card exclusions are visible;
units and variants are preserved; account line counts match paginated detail;
anonymous and unassigned users are denied; a single-business user cannot see
other-business or shared costs; raw views remain private.

For visual QA, use an authenticated local session or browser-only mocked RPC
responses. Never add sample business results or authentication bypasses to the
production bundle. Keep audit snapshots and screenshots in ignored local docs.

## Release

Apply the additive migration, then deploy the frontend using the existing
GitHub Pages workflow. To roll back the frontend, restore the preceding build;
old RPCs remain unchanged. The views and new functions may remain installed.
Do not drop them while a deployed client uses them.
