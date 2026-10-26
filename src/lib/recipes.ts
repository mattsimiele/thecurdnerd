import type { InventoryItem } from './inventory';

export type MenuSale = { item_name: string; variation_name: string; sales_unit: string; quantity: number; sales_cents: number };
export type RecipeIngredient = { item_id: string; quantity: number; name: string; unit: string };
export type Recipe = {
 id: string; business_id: string; item_name: string; variation_name: string; sales_unit: string;
 batch_yield: number; notes: string; active: boolean; revision: number; ingredients: RecipeIngredient[];
};
export type RecipePlan = { startDate: string; endDate: string; salesThrough: string | null; menu: MenuSale[]; recipes: Recipe[] };
export const menuKey = (m: Pick<MenuSale, 'item_name'|'variation_name'|'sales_unit'>) => JSON.stringify([m.item_name,m.variation_name,m.sales_unit]);

export function recipeProblem(recipe: Recipe | undefined, items: InventoryItem[]) {
 if (!recipe || !recipe.active) return 'Not mapped';
 if (!(recipe.batch_yield > 0) || !recipe.ingredients?.length) return 'Recipe needs quantities';
 if (recipe.ingredients.some(c => !items.some(i => i.id === c.item_id && i.unit === c.unit))) return 'Ingredient archived or unit changed';
 if (recipe.ingredients.some(c => !(c.quantity > 0))) return 'Recipe needs quantities';
 return null;
}

export function ingredientDemand(plan: RecipePlan, items: InventoryItem[]) {
 const recipes = new Map(plan.recipes.map(r => [menuKey(r),r]));
 const rows = new Map<string,{item:InventoryItem;weekly:number;contributions:{dish:string;weekly:number}[]}>();
 let mapped = 0;
 for (const sale of plan.menu) {
  const recipe = recipes.get(menuKey(sale));
  if (recipeProblem(recipe,items) || !recipe) continue;
  mapped++;
  for (const component of recipe.ingredients) {
   const item=items.find(i=>i.id===component.item_id)!;
   const weekly=Number(sale.quantity)/4/Number(recipe.batch_yield)*Number(component.quantity);
   const row=rows.get(item.id)??{item,weekly:0,contributions:[]};
   row.weekly+=weekly;
   row.contributions.push({dish:[sale.item_name,sale.variation_name,`[${sale.sales_unit}]`].filter(Boolean).join(' · '),weekly});
   rows.set(item.id,row);
  }
 }
 return {mapped,total:plan.menu.length,rows:[...rows.values()].sort((a,b)=>a.item.name.localeCompare(b.item.name)),
  fresh:!!plan.salesThrough && plan.salesThrough>=plan.endDate};
}
