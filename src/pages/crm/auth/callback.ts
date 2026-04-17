import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const prerender = false;

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/crm';

  if (!code) {
    return redirect('/crm/login?error=missing_code', 302);
  }

  const supabase = createSupabaseServerClient({ cookies } as any);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('Supabase auth callback failed', error);
    return redirect('/crm/login?error=auth_callback_failed', 302);
  }

  return redirect(next.startsWith('/crm') ? next : '/crm', 302);
};
