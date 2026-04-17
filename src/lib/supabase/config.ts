import { env } from 'cloudflare:workers';

export function getSupabaseUrl() {
  const value = env.PUBLIC_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
  if (!value) {
    throw new Error('Missing PUBLIC_SUPABASE_URL');
  }
  return value;
}

export function getSupabaseAnonKey() {
  const value = env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!value) {
    throw new Error('Missing PUBLIC_SUPABASE_ANON_KEY');
  }
  return value;
}

export function getSupabaseConfig() {
  return {
    url: getSupabaseUrl(),
    anonKey: getSupabaseAnonKey(),
  };
}
