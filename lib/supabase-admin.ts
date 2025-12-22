import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseAdminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient() {
  if (supabaseAdminClient) return supabaseAdminClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Supabase admin key is missing. Please verify SUPABASE_SERVICE_ROLE_KEY is set.'
    );
  }

  supabaseAdminClient = createClient(supabaseUrl, serviceRoleKey);
  return supabaseAdminClient;
}
