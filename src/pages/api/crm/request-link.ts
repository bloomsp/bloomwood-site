import type { APIRoute } from 'astro';
import { createSupabasePublicClient } from '@/lib/supabase/admin';

export const prerender = false;

export const POST: APIRoute = async ({ request, url }) => {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return new Response(JSON.stringify({ error: 'Unsupported content type' }), {
        status: 415,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json().catch(() => null) as { email?: string; next?: string } | null;
    const email = String(body?.email ?? '').trim().toLowerCase();
    const next = String(body?.next ?? '/crm').trim();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createSupabasePublicClient();
    const redirectTo = new URL('/crm/auth/callback', url.origin);
    redirectTo.searchParams.set('next', next.startsWith('/crm') ? next : '/crm');

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo.toString(),
        shouldCreateUser: false,
      },
    });

    if (error) {
      console.error('Supabase magic link request failed', error);
      return new Response(JSON.stringify({ error: error.message || 'Magic link request failed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('CRM magic link request failed', error);
    const message = error instanceof Error ? error.message : 'Request failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
