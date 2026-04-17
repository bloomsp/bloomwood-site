import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
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

  const supabaseUrl = env.PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = env.PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return redirect('/crm/login?error=missing_supabase_config', 302);
  }

  const safeNext = next.startsWith('/crm') ? next : '/crm';
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Signing you in...</title>
  </head>
  <body style="font-family: system-ui, sans-serif; padding: 2rem; color: #0f172a;">
    <p>Signing you in...</p>
    <script type="module">
      import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

      const supabase = createClient(${JSON.stringify(supabaseUrl)}, ${JSON.stringify(supabaseAnonKey)});
      const next = ${JSON.stringify(safeNext)};
      const loginUrl = '/crm/login';

      async function run() {
        const current = new URL(window.location.href);
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const query = current.searchParams;

        const accessToken = hash.get('access_token');
        const refreshToken = hash.get('refresh_token');
        const code = query.get('code');
        const tokenHash = query.get('token_hash');
        const type = query.get('type');

        try {
          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            if (error) throw error;
            window.location.replace(next);
            return;
          }

          if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) throw error;
            window.location.replace(next);
            return;
          }

          if (tokenHash && type) {
            const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
            if (error) throw error;
            window.location.replace(next);
            return;
          }

          window.location.replace(loginUrl + '?error=missing_auth_params');
        } catch (error) {
          const message = error instanceof Error ? error.message : 'auth_callback_failed';
          window.location.replace(loginUrl + '?error=' + encodeURIComponent(message));
        }
      }

      run();
    </script>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
};
