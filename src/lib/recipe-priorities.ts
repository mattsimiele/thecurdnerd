import type { MenuSale } from './recipes';

// Agreed setup order, not an automatically changing sales ranking. Quantities
// and yields remain user-entered; these prompts are not ingredient assumptions.
export const recipePriorities = [
 {name:'Mac & Cheese',variations:['Regular'],label:'Mac & Cheese',ingredients:'Dry pasta weight; each cheese separately; all sauce ingredients, toppings, and garnishes actually used.',yield:'Enter total purchased quantities for one batch, the actual sellable portions it produces, and portion size in recipe notes.'},
 {name:'Steak Frites',variations:['8oz Bavette'],label:'Steak Frites · 8oz Bavette',ingredients:'Purchased steak weight, fries, and any sauce, butter, seasoning, or garnish included on the plate.',yield:'Use a yield of 1 for one complete plate. Record trim loss and whether 8oz means purchased, trimmed raw, or cooked weight.'},
 {name:'Cheese Flight',variations:['Regular'],label:'Cheese Flight',ingredients:'Each cheese and its weight per flight, plus quantities of all accompaniments actually included.',yield:'Use a yield of 1 flight. Record rotating cheese selections in notes and update the recipe when they change.'},
 {name:'Martini 101',variations:[''],label:'Martini 101',ingredients:'Exact products and liquid quantities per drink, plus garnish. Record dilution separately if batching.',yield:'Use 1 drink, or the actual number of drinks a batch produces. Express liquids in the ingredient’s stock unit.'},
 {name:'"The Wedge" Salad',variations:['Regular'],label:'“The Wedge” Salad',ingredients:'Purchased lettuce quantity or usable wedges per head; dressing, cheese, and all toppings actually included.',yield:'Use 1 plate. Expand dressing into purchased ingredients, using its batch yield to calculate the amount for one salad.'},
 {name:'Steak Frites',variations:['18oz Kansas City'],label:'Steak Frites · 18oz Kansas City',ingredients:'This cut’s purchased weight, bone/trim allowance, fries, and all included accompaniments.',yield:'Use 1 plate. Keep this recipe separate from Bavette; confirm what the stated 18oz measures.'},
 {name:'Girl Dinner',variations:['Regular','With Truffle Fries'],label:'Girl Dinner · both variations',ingredients:'Define everything included in Regular and With Truffle Fries, including any drink. Enter quantities for each complete order.',yield:'Create a separate recipe with yield 1 for each variation. Confirm every difference; do not assume fries are the only change.'},
];
export function priorityFor(sale: Pick<MenuSale,'item_name'|'variation_name'>) {
 return recipePriorities.find(p=>p.name===sale.item_name&&p.variations.includes(sale.variation_name));
}
