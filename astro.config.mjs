// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import os from 'os';
import path from 'path';
import { readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';

// Chapter slugs marked "indexed": false (in-progress drafts) are noindex'd,
// so they must also stay out of the sitemap.
const chaptersDir = fileURLToPath(new URL('./src/data/chapters', import.meta.url));
const noindexSlugs = new Set(
  readdirSync(chaptersDir)
    .filter((f) => f.endsWith('.json'))
    .filter((f) => {
      try {
        return JSON.parse(readFileSync(path.join(chaptersDir, f), 'utf-8')).indexed === false;
      } catch {
        return false;
      }
    })
    .map((f) => f.replace(/\.json$/, '')),
);

// https://astro.build/config
export default defineConfig({
  site: 'https://litbible.net',
  redirects: {
    '/read-now': '/read',
    '/podcast': '/found-in-translation-podcast',
  },
  integrations: [
    sitemap({
      filter: (page) => {
        if (page.includes('/search')) return false;
        const slug = new URL(page).pathname.replace(/^\/|\/$/g, '');
        if (slug === 'unsubscribe') return false; // noindex utility page
        return !noindexSlugs.has(slug);
      },
    }),
  ],
  vite: {
    cacheDir: path.join(os.tmpdir(), 'litbible-vite-cache'),
  },
});
