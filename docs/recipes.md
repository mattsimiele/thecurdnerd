# Wedge recipe mapping

Inventory → The Wedge → Recipes & ingredient demand connects exact menu item, variation, and source-unit combinations to purchased ingredients. No recipes, yields, counts, or ingredient quantities are guessed or seeded.

## Workflow

1. Add Wedge ingredient stock items with correct purchasing units using Add inventory item. Set supplier, pack size, lead time, and buffer for order planning; counts and pars can be added later.
2. Choose a menu combination and enter sellable units per batch. For a single portion, use a yield of 1. Enter each purchased ingredient's quantity consumed for the entire batch, in its inventory unit. For example, 8 oz is entered as 0.5 when stock is measured in lb. Include trim/cooking losses in purchased quantities and actual sellable yield; do not add the same loss again. Expand prepared sub-recipes into purchased ingredients.
3. Confirm the source unit, variation, yield, and quantities. `Unknown` source units require manual verification of what one sold quantity means. They remain separate from `each` sales even when names match. Modifiers, substitutions, and item renames are not automatically linked.
4. Inspect mapping coverage and ingredient demand. The source period is four complete Monday–Sunday weeks. Each exact menu combination's weekly quantity is four-week quantity / 4. Multiply it by ingredient batch quantity / batch yield, then sum across mapped dishes. Current recipes are applied retrospectively to this period; this is a planning estimate, not historical consumption accounting.
5. Review proposed pars: weekly demand × (7 + lead days + buffer days) / 7, rounded up to 0.01 stock units. The order preview subtracts usable stock and confirmed inbound and rounds to supplier packs using the existing inventory rules. It needs current stock counts and complete supplier setup. Applying a par is explicit, revision-checked, and leaves counts/inbound untouched. Return to the weekly order list for count updates and CSV export.

Every positive-quantity menu combination is included, not just the inventory shortlist. Unmapped/disabled recipes contribute no calculated demand and are counted as gaps. A recipe referencing an archived or missing ingredient is wholly excluded and flagged for repair; it never silently contributes only its remaining ingredients. Saved recipes with no current-period sales remain editable. Partial coverage is prominently labeled, and managers must acknowledge gaps before applying a suggested par. Imports behind the period end disable par application. Latest sale date cannot establish that every import or day is complete; review data freshness and stockouts separately.

Saved manual pars remain unchanged until explicitly replaced. No automatic stock depletion, sub-recipe expansion, unit conversion, supplier submission, seasonal forecasting, or modifier consumption is performed. Events and other uses must be included manually when confirming pars.

## Backend and validation

Apply `supabase/migrations/20261026230000_recipes.sql` after inventory. Private RLS-enabled recipe, ingredient-link, and history tables have no direct client access. Authenticated Wedge members may read through `manager_recipe_plan`; only Wedge owners/managers may write through `manager_save_recipe`. Writes require same-business ingredients, positive quantities/yields, immutable menu identity, and a current revision. All edits retain snapshots. Disable a mapping rather than deleting history.

Run `node --test tests/*.test.mjs` for demand and existing planning tests. `tests/recipes-db.py` requires psycopg2/python-dotenv and the configured `.env.local`; all schema changes and fixtures roll back. It verifies full-menu coverage, batch persistence, same-business ingredients, stale revisions, invalid quantities, mapping activation, permissions, and history.
