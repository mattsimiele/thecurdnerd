# Weekly inventory and pars

`/dashboard/inventory/` is an authenticated planning workspace for each accessible business. Owners/managers can edit; viewers can read and export. No stock, suppliers, counts, or recipes are seeded from guesses.

## Start a weekly review

1. Choose a business and open the recent-sales shortlist. It contains the top 100 item / variation / source-unit combinations by net sales over the last four complete Monday–Sunday weeks. Gift cards are excluded. All four weeks are in the denominator, including zero-sale days; stockouts or incomplete imports can understate demand.
2. Add purchased stock items, verify units, enter supplier, order-pack size, and lead time. Curd Nerd can use a matching-unit sales rate as a starting par: weekly average × (7 review days + lead days + buffer days) / 7. The default two-day buffer is editable. Confirm the result against waste, shelf life, seasonality, and events. Pars are saved explicitly and do not drift with sales.
3. Wedge menu quantities are references for prioritizing ingredients, not ingredient demand. You can enter ingredient pars manually or use Recipes & ingredient demand to map exact menu variations, enter batch yields, and apply reviewed ingredient pars. See [recipe mapping](recipes.md).
4. Count usable stock now, excluding spoiled or reserved stock. Enter confirmed, unreceived inbound quantities expected within the par coverage window. Zero is valid; missing is never assumed to be zero. Reconfirm both values after receiving deliveries.
5. Review orders grouped by supplier. Suggested quantity is max(0, par − usable stock − confirmed inbound), rounded up to whole supplier packs. Supplier, par, lead time, pack size, and a count no older than 24 hours are required. Count timestamps are server-generated. Export includes blocked rows for follow-up; it does not send or record purchase orders.

Inventory is a snapshot. Sales and recipe demand estimates do not automatically deplete stock. Waste tracking, transfers, automatic receiving, purchase-order tracking, price estimates, supplier minimums, and shelf-life constraints are not yet modeled. Recount before ordering. Each business has separate inventory even for the same item. Unit changes require a new record to avoid reinterpreting old counts.

## Backend

Apply `supabase/migrations/20261026220000_inventory.sql` after the operating-report migration. It adds private RLS-enabled stock and history tables and authenticated-only `manager_inventory` / `manager_save_inventory` RPCs. Every write checks active business membership and owner/manager role, locks the record, and requires its current revision. Counts and edits append a full snapshot to private history. Archive retains history. SQL functions use fixed search paths; direct client table access is revoked.

Validation: `node --test tests/*.test.mjs`; `tests/inventory-db.py` uses psycopg2 and python-dotenv with `.env.local` and rolls all test fixtures and schema changes back. It checks read/write scope, viewer denial, stale revisions, unit immutability, zero counts, history, and quantity constraints. Never commit database fixtures or credentials.

## Wedge weekly prep pars

Wedge’s Recent sales & weekly pars view groups source categories `Dessert` and `Desserts` into one Dessert row; other menu items remain separate by variation and selling unit. Individual desserts remain separate in recipe mapping because their ingredient requirements differ.

The current week is Monday–Sunday in America/New_York. Baseline demand is the preceding four complete Monday–Sunday weeks; the unfinished week is never included in that average. Managers explicitly save recurring weekly prep pars. Sales-to-date, percent of par, and remaining-to-par use imported current-week sales. Missing current-week imports show unknown progress, not zero. Import lag is labeled. These figures are planning comparisons, not inventory balances; they do not adjust ingredient pars or stock counts.

Unknown source quantities remain visible separately from known quantities; combining them requires manager confirmation. Historical unknown units do not block current-week progress when the current quantities have known units. Incompatible measured units in Dessert block combined progress. A saved zero par is valid and distinct from an unset par; sales above par show an overage without a negative remainder. Apply `20261027010000_weekly_menu_pars.sql` after the reporting and inventory migrations. The new functions are Wedge-scoped and role-checked, with private table access and revision checks on edits. `tests/weekly-pars-db.py` checks grouping, week boundaries, current-week isolation, and access inside a rolled-back transaction; `tests/weekly-pars.test.mjs` checks progress arithmetic and missing-data states.

## Recovering missing sales units

`20261027020000_sales_unit_recovery.sql` preserves explicit Square/legacy units (normalizing ea to each and pound aliases to lb), then uses a consistent observed unit for the same business, item name, and variation. A private reference table retains original evidence, and a trigger on raw Square order imports adds new explicit evidence. Generic unnamed/custom items are excluded from matching. Conflicting evidence stays Unknown. Only when no reliable match exists does the owner-approved fallback classify a fractional quantity as lb and a whole quantity as each. Explicit or matched each-unit split portions stay each; whole-number pound sales stay lb when backed by source/item evidence. The reporting view exposes `quantity_unit_source` for auditability, without rewriting imported quantities or source payloads. The migration does not rewrite saved recipe identities. The rollback-only `tests/sales-unit-recovery-db.py` verifies preservation, fallback, matching, conflicts, and future-import behavior.

### Starting weekly prep pars
Wedge shows suggested pars from corrected sales over the previous four completed Monday–Sunday weeks, rounded up to whole each or 0.01 measured units. Dessert remains one combined category. Opening an unset par prefills the suggestion for review; existing targets (including zero) are preserved. Suggestions only become active after Save weekly par. Unresolved historical units, stale imports, or nonpositive history withhold suggestions. These are historical starting points without an added buffer; review event demand and upcoming bookings before saving.
