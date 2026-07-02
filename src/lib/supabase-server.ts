import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseAdmin: SupabaseClient | undefined;

// Lazily construct the client on first use. Next.js imports every API route
// module during build-time page-data collection, so eagerly calling
// createClient() at module scope throws "supabaseKey is required" whenever
// Supabase env vars aren't set at build time — even if the route never
// actually calls this function at runtime.
export function createServerClient() {
  if (!supabaseAdmin) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    // Prefer the service role key for server-side operations (bypasses RLS).
    // If not set, fall back to the anon key (requires RLS policies to be open).
    const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    supabaseAdmin = createClient(supabaseUrl, serverKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return supabaseAdmin;
}
