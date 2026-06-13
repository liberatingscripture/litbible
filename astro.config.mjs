// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import os from 'os';
import path from 'path';
import { readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';

// Chapter slugs marked "indexed": false (in-progress drafts) are noindex'd,
// so they must also stay out of the sitemap. We also track per-book draft
// status: a /read/<book> aggregate page is de-indexed only when EVERY chapter
// of that book is a draft (mirrors src/pages/read/[book].astro), so books with
// even one published chapter (e.g. Luke) keep their read page in the sitemap.
const chaptersDir = fileURLToPath(new URL('./src/data/chapters', import.meta.url));
const noindexSlugs = new Set();
const bookDraftCounts = new Map(); // bookKey -> { total, drafts }
for (const f of readdirSync(chaptersDir).filter((f) => f.endsWith('.json'))) {
  let isDraft = false;
  try {
    isDraft = JSON.parse(readFileSync(path.join(chaptersDir, f), 'utf-8')).indexed === false;
  } catch {
    isDraft = false;
  }
  const slug = f.replace(/\.json$/, '');
  if (isDraft) noindexSlugs.add(slug);
  const bookKey = slug.replace(/-\d+$/, ''); // strip trailing -<chapter>
  const counts = bookDraftCounts.get(bookKey) ?? { total: 0, drafts: 0 };
  counts.total += 1;
  if (isDraft) counts.drafts += 1;
  bookDraftCounts.set(bookKey, counts);
}
const fullyDraftBooks = new Set(
  [...bookDraftCounts.entries()]
    .filter(([, c]) => c.total > 0 && c.total === c.drafts)
    .map(([bookKey]) => bookKey),
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
