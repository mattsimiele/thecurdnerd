import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient<any> | undefined;

export function getSupabaseBrowserClient(): SupabaseClient<any> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) throw new Error("Supabase browser configuration is missing.");

  browserClient ??= createClient<any>(url, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return browserClient;
}
