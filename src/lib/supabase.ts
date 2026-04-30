import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Fall back to placeholder so the module doesn't throw when env vars are absent.
// Requests will fail gracefully; components guard with `if (data)` checks.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);

// Function-style export for components that expect createClient()
export function createClient() {
  return supabase;
}
