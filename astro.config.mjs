// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
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

  // Astro 7 changed this default from `true` to `'jsx'`, which strips
  // whitespace between elements using JSX rules. That is wrong for a site of
  // hand-written HTML: it joins adjacent inline text that was deliberately
  // spaced ("LIT Bible" + "Free. No account, no ads." became
  // "LIT BibleFree. No account, no ads.", the "Aa" trigger's sr-only label
  // became "AaDisplay settings", and the whole nav collapsed into
  // "AboutCommitmentsGlossaryPodcastArticles"). Prose bodies survive, but
  // accessible names and Pagefind's extracted text do not. Astro 6 behavior
  // is what the markup was authored against, so we pin it.
  compressHTML: true,

  // Astro 7 renders .md with Sätteri, its native pipeline, instead of
  // remark/rehype. On this content that changed published copy two ways: a
  // closing curly quote flipped to an opening one in an article, and "..."
  // rendered as ". . ." in the glossary. Staying on the unified processor
  // keeps rendering identical to Astro 6; revisit deliberately, as a content
  // change with the owner, rather than as an upgrade side effect.
  // (Sätteri also stopped auto-closing an unclosed <li>/<ul> in
  // 2peter-intro.md. That was a real latent bug, not a Sätteri fault, and it
  // is now fixed — so it is NOT a reason to stay on unified. All Markdown
  // content currently balances, so a future switch would not resurface it.)
  markdown: { processor: unified() },

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
        if (slug === 'app-support/thanks') return false; // noindex form-success page
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
