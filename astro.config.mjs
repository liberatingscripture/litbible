// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import os from 'os';
import path from 'path';

// https://astro.build/config
export default defineConfig({
  site: 'https://litbible.net',
  redirects: {
    '/read-now': '/read',
    '/podcast': '/found-in-translation-podcast',
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/search'),
    }),
  ],
  vite: {
    cacheDir: path.join(os.tmpdir(), 'litbible-vite-cache'),
  },
});
