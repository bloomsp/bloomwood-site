// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import cloudflare from '@astrojs/cloudflare';

import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // IMPORTANT: Used for canonical URLs, OpenGraph URLs, and sitemap generation.
  // Without this, prerendered pages can end up with localhost canonicals.
  site: 'https://bloomwood.com.au',

  vite: {
    plugins: [tailwindcss()]
  },

  // Explicitly set the session driver so the Cloudflare adapter doesn't auto-enable
  // sessions (and print the "Enabling sessions..." message) during config setup.
  session: {
    driver: 'cloudflare-kv-binding',
    options: {
      binding: 'SESSION'
    }
  },

  adapter: cloudflare({
    routes: {
      extend: {
        // Ensure sitemap files are served as static assets (not routed through the SSR worker).
        // Otherwise Cloudflare Pages Functions can return HTML for these URLs.
        exclude: [{ pattern: '/sitemap-index.xml' }, { pattern: '/sitemap-*.xml' }]
      }
    }
  }),
  integrations: [react(), mdx(), sitemap()]
});
