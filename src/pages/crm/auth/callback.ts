import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const prerender = false;

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const next = url.searchParams.get('next') || '/crm';

  const supabase = createSupabaseServerClient({ cookies } as any);

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Supabase auth callback code exchange failed', error);
      return redirect('/crm/login?error=auth_callback_failed', 302);
    }

    return redirect(next.startsWith('/crm') ? next : '/crm', 302);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as any,
    });

    if (error) {
      console.error('Supabase auth callback OTP verification failed', error);
      return redirect('/crm/login?error=otp_verification_failed', 302);
    }

    return redirect(next.startsWith('/crm') ? next : '/crm', 302);
  }

  return redirect('/crm/login?error=missing_auth_params', 302);
};
