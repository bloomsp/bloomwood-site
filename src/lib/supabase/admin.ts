import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config';

export function createSupabasePublicClient() {
  const { url, anonKey } = getSupabaseConfig();
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
