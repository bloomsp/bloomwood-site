import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const cspDirectives = {
  'default-src': ["'self'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'self'"],
  'object-src': ["'none'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'",
    'https://app.cal.com',
    'https://challenges.cloudflare.com',
    'https://cdn-cookieyes.com',
    'https://embed.tawk.to',
    'https://static.cloudflareinsights.com',
    'https://cdn.jsdelivr.net',
    'https://esm.sh',
  ],
  'script-src-elem': [
    "'self'",
    "'unsafe-inline'",
    'https://app.cal.com',
    'https://challenges.cloudflare.com',
    'https://cdn-cookieyes.com',
    'https://embed.tawk.to',
    'https://static.cloudflareinsights.com',
    'https://cdn.jsdelivr.net',
    'https://esm.sh',
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'",
    'https://fonts.googleapis.com',
    'https://embed.tawk.to',
  ],
  'style-src-elem': [
    "'self'",
    "'unsafe-inline'",
    'https://fonts.googleapis.com',
    'https://embed.tawk.to',
  ],
  'font-src': [
    "'self'",
    'data:',
    'https://cal.com',
    'https://fonts.gstatic.com',
    'https://embed.tawk.to',
  ],
  'img-src': [
    "'self'",
    'data:',
    'blob:',
    'https://cdn-cookieyes.com',
    'https://embed.tawk.to',
    'https://*.tawk.to',
    'https://va.tawk.to',
  ],
  'connect-src': [
    "'self'",
    'https://app.cal.com',
    'https://challenges.cloudflare.com',
    'https://cdn-cookieyes.com',
    'https://log.cookieyes.com',
    'https://embed.tawk.to',
    'https://va.tawk.to',
    'https://cloudflareinsights.com',
    'https://static.cloudflareinsights.com',
    'https://*.supabase.co',
    'https://esm.sh',
    'wss://*.tawk.to',
  ],
  'frame-src': [
    "'self'",
    'https://app.cal.com',
    'https://challenges.cloudflare.com',
    'https://embed.tawk.to',
    'https://va.tawk.to',
    'https://www.youtube.com',
    'https://www.youtube-nocookie.com',
  ],
  'worker-src': ["'self'", 'blob:'],
  'media-src': ["'self'", 'blob:', 'https://*.tawk.to'],
} as const;

const contentSecurityPolicy = Object.entries(cspDirectives)
  .map(([directive, values]) => `${directive} ${values.join(' ')}`)
  .join('; ');

export const onRequest = defineMiddleware(async (context, next) => {
  let supabaseUser = null;

  if (import.meta.env.PUBLIC_SUPABASE_URL && import.meta.env.PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const supabase = createSupabaseServerClient(context);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      supabaseUser = user;
      context.locals.supabase = supabase;
      context.locals.supabaseUser = user;
    } catch (error) {
      console.error('Supabase middleware check failed', error);
    }
  }

  const pathname = context.url.pathname;
  const isCrmPath = pathname === '/crm' || pathname.startsWith('/crm/');
  const isCrmLogin = pathname === '/crm/login';
  const isCrmCallback = pathname === '/crm/auth/callback';

  if (isCrmPath && !isCrmLogin && !isCrmCallback && !supabaseUser) {
    const nextPath = pathname === '/crm' ? '/crm' : pathname;
    return context.redirect(`/crm/login?next=${encodeURIComponent(nextPath)}`);
  }

  const response = await next();
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('text/html')) {
    response.headers.set('Content-Security-Policy', contentSecurityPolicy);
  }

  return response;
});
