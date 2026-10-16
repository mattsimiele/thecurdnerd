export type Business = {
  id: "business-a" | "business-b";
  name: string;
  squareLocationIds: string[];
  quickBooksRealmId?: string;
  openTableRestaurantId?: string;
};

const split = (value?: string) => value?.split(",").map((part) => part.trim()).filter(Boolean) ?? [];

export const businesses: Business[] = [
  { id: "business-a", name: process.env.BUSINESS_A_NAME || "Business A", squareLocationIds: split(process.env.BUSINESS_A_SQUARE_LOCATION_IDS), quickBooksRealmId: process.env.BUSINESS_A_QUICKBOOKS_REALM_ID, openTableRestaurantId: process.env.BUSINESS_A_OPENTABLE_RESTAURANT_ID },
  { id: "business-b", name: process.env.BUSINESS_B_NAME || "Business B", squareLocationIds: split(process.env.BUSINESS_B_SQUARE_LOCATION_IDS), quickBooksRealmId: process.env.BUSINESS_B_QUICKBOOKS_REALM_ID, openTableRestaurantId: process.env.BUSINESS_B_OPENTABLE_RESTAURANT_ID },
];
