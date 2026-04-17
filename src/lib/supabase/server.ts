import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { parse } from 'cookie';
import type { APIContext, AstroCookies } from 'astro';
import { getSupabaseConfig } from './config';

function createCookieAdapter(cookies: AstroCookies, request: Request) {
  return {
    getAll(keyHints: string[] = []) {
      if (keyHints.length > 0) {
        return keyHints.flatMap((name) => {
          const value = cookies.get(name)?.value;
          return value === undefined ? [] : [{ name, value }];
        });
      }

      const cookieHeader = request.headers.get('cookie') ?? '';
      const parsed = parse(cookieHeader);

      return Object.entries(parsed).flatMap(([name, rawValue]) => {
        const value = cookies.get(name)?.value ?? rawValue;
        return value === undefined ? [] : [{ name, value }];
      });
    },
    setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
      cookiesToSet.forEach(({ name, value, options }) => {
        cookies.set(name, value, options);
      });
    },
  };
}

export function createSupabaseServerClient(context: Pick<APIContext, 'cookies' | 'request'>) {
  const { url, anonKey } = getSupabaseConfig();
  return createServerClient(url, anonKey, {
    cookies: createCookieAdapter(context.cookies, context.request),
  });
}
