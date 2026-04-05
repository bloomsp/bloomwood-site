import { defineMiddleware } from 'astro:middleware';

const cspDirectives = {
  'default-src': ["'self'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'self'"],
  'object-src': ["'none'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'",
    'https://challenges.cloudflare.com',
    'https://cdn-cookieyes.com',
    'https://embed.tawk.to',
    'https://static.cloudflareinsights.com',
    'https://cdn.jsdelivr.net',
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
  'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
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
    'https://challenges.cloudflare.com',
    'https://cdn-cookieyes.com',
    'https://log.cookieyes.com',
    'https://embed.tawk.to',
    'https://va.tawk.to',
    'https://cloudflareinsights.com',
    'https://static.cloudflareinsights.com',
    'wss://*.tawk.to',
  ],
  'frame-src': [
    "'self'",
    'https://challenges.cloudflare.com',
    'https://embed.tawk.to',
    'https://va.tawk.to',
  ],
  'worker-src': ["'self'", 'blob:'],
  'media-src': ["'self'", 'blob:', 'https://*.tawk.to'],
} as const;

const contentSecurityPolicy = Object.entries(cspDirectives)
  .map(([directive, values]) => `${directive} ${values.join(' ')}`)
  .join('; ');

export const onRequest = defineMiddleware(async (_, next) => {
  const response = await next();
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('text/html')) {
    response.headers.set('Content-Security-Policy', contentSecurityPolicy);
  }

  return response;
});
