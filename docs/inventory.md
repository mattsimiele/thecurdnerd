# Weekly inventory and pars

`/dashboard/inventory/` is an authenticated planning workspace for each accessible business. Owners/managers can edit; viewers can read and export. No stock, suppliers, counts, or recipes are seeded from guesses.

## Start a weekly review

1. Choose a business and open the recent-sales shortlist. It contains the top 100 item / variation / source-unit combinations by net sales over the last four complete Monday–Sunday weeks. Gift cards are excluded. All four weeks are in the denominator, including zero-sale days; stockouts or incomplete imports can understate demand.
2. Add purchased stock items, verify units, enter supplier, order-pack size, and lead time. Curd Nerd can use a matching-unit sales rate as a starting par: weekly average × (7 review days + lead days + buffer days) / 7. The default two-day buffer is editable. Confirm the result against waste, shelf life, seasonality, and events. Pars are saved explicitly and do not drift with sales.
3. Wedge menu quantities are references for prioritizing ingredients, not ingredient demand. Enter ingredient pars manually. Recipe/yield mapping is a future step.
4. Count usable stock now, excluding spoiled or reserved stock. Enter confirmed, unreceived inbound quantities expected within the par coverage window. Zero is valid; missing is never assumed to be zero. Reconfirm both values after receiving deliveries.
5. Review orders grouped by supplier. Suggested quantity is max(0, par − usable stock − confirmed inbound), rounded up to whole supplier packs. Supplier, par, lead time, pack size, and a count no older than 24 hours are required. Count timestamps are server-generated. Export includes blocked rows for follow-up; it does not send or record purchase orders.

Inventory is a snapshot. Sales do not automatically deplete stock; ingredient recipes, waste, transfers, automatic receiving, purchase-order tracking, price estimates, supplier minimums, and shelf-life constraints are not yet modeled. Recount before ordering. Each business has separate inventory even for the same item. Unit changes require a new record to avoid reinterpreting old counts.

## Backend

Apply `supabase/migrations/20261026220000_inventory.sql` after the operating-report migration. It adds private RLS-enabled stock and history tables and authenticated-only `manager_inventory` / `manager_save_inventory` RPCs. Every write checks active business membership and owner/manager role, locks the record, and requires its current revision. Counts and edits append a full snapshot to private history. Archive retains history. SQL functions use fixed search paths; direct client table access is revoked.

Validation: `node --test tests/*.test.mjs`; `tests/inventory-db.py` uses psycopg2 and python-dotenv with `.env.local` and rolls all test fixtures and schema changes back. It checks read/write scope, viewer denial, stale revisions, unit immutability, zero counts, history, and quantity constraints. Never commit database fixtures or credentials.
