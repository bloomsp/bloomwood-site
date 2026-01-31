// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import cloudflare from '@astrojs/cloudflare';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
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

  adapter: cloudflare(),
  integrations: [react()]
});