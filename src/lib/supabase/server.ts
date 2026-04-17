import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { APIContext, AstroCookies } from 'astro';
import { getSupabaseConfig } from './config';

function createCookieAdapter(cookies: AstroCookies) {
  return {
    getAll() {
      return cookies.getAll().map((cookie) => ({
        name: cookie.key,
        value: cookie.value,
      }));
    },
    setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
      cookiesToSet.forEach(({ name, value, options }) => {
        cookies.set(name, value, options);
      });
    },
  };
}

export function createSupabaseServerClient(context: Pick<APIContext, 'cookies'>) {
  const { url, anonKey } = getSupabaseConfig();
  return createServerClient(url, anonKey, {
    cookies: createCookieAdapter(context.cookies),
  });
}
