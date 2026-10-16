import { z } from "zod";

const paymentSchema = z.object({
  id: z.string(),
  location_id: z.string().optional(),
  status: z.string(),
  amount_money: z.object({ amount: z.number(), currency: z.string() }).optional(),
  total_money: z.object({ amount: z.number(), currency: z.string() }).optional(),
  created_at: z.string().optional(),
});

const responseSchema = z.object({ payments: z.array(paymentSchema).default([]), cursor: z.string().optional() });

export async function listSquarePayments({ beginTime, endTime, locationId }: { beginTime: string; endTime: string; locationId?: string }) {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error("Square is not configured.");
  const baseUrl = process.env.SQUARE_ENVIRONMENT === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
  const url = new URL("/v2/payments", baseUrl);
  url.searchParams.set("begin_time", beginTime);
  url.searchParams.set("end_time", endTime);
  url.searchParams.set("sort_order", "ASC");
  if (locationId) url.searchParams.set("location_id", locationId);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "Square-Version": "2025-10-16", "Content-Type": "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error(`Square request failed with status ${response.status}.`);
  return responseSchema.parse(await response.json());
}
