import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseAdmin: SupabaseClient | undefined;

// Supabase issues either legacy keys (anon/service_role) or new-style keys
// (publishable/secret) depending on project age — accept all four.
function serverKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  );
}

export function isSupabaseConfigured() {
  const key = serverKey();
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && key.length > 0 && !key.startsWith('PASTE_YOUR');
}

// Lazily construct the client on first use. Next.js imports every API route
// module during build-time page-data collection, so eagerly calling
// createClient() at module scope throws "supabaseKey is required" whenever
// Supabase env vars aren't set at build time — even if the route never
// actually calls this function at runtime.
export function createServerClient() {
  if (!supabaseAdmin) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    supabaseAdmin = createClient(supabaseUrl, serverKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return supabaseAdmin;
}
