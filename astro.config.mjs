// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import os from 'os';
import path from 'path';
import { scanDraftChapters } from './src/lib/draft-chapters.mjs';

// Chapter slugs marked "indexed": false (in-progress drafts) are noindex'd,
// so they must also stay out of the sitemap. We also track per-book draft
// status: a /read/<book> aggregate page is de-indexed only when EVERY chapter
// of that book is a draft (mirrors src/pages/read/[book].astro), so books with
// even one published chapter (e.g. Luke) keep their read page in the sitemap.
// Derivation is shared with ReadMenu.astro via src/lib/draft-chapters.mjs.
const { noindexSlugs, fullyDraftBooks } = scanDraftChapters();

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
        if (slug === 'contact/thanks') return false; // noindex form-success page
        // /read/<book> aggregate pages for books that are entirely drafts
        if (slug.startsWith('read/') && fullyDraftBooks.has(slug.slice('read/'.length))) {
          return false;
        }
        return !noindexSlugs.has(slug);
      },
    }),
  ],
  vite: {
    cacheDir: path.join(os.tmpdir(), 'litbible-vite-cache'),
  },
});
