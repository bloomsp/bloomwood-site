import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseConfig } from './config';

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    const { url, anonKey } = getSupabaseConfig();
    browserClient = createBrowserClient(url, anonKey);
  }

  return browserClient;
}
