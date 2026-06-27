// SERVER-ONLY. Never import this from src/ — it uses the service role key,
// which bypasses Row Level Security and must never reach the browser bundle.
import { createClient } from "@supabase/supabase-js";

export function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars on the server.");
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
