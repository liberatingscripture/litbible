// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { scanDraftChapters, scanDraftIntros } from './src/lib/draft-chapters.mjs';
import { claudeDocsGuard, isClaudeDocPath } from './src/lib/claude-docs-guard.mjs';

// Chapter slugs marked "indexed": false (in-progress drafts) are noindex'd,
// so they must also stay out of the sitemap (src/lib/draft-chapters.mjs).
const { noindexSlugs } = scanDraftChapters();
// Placeholder book intros are noindex'd the same way (see scanDraftIntros).
const draftIntroSlugs = new Set([...scanDraftIntros()].map((book) => `${book}-intro`));

// Two facts about where this checkout is, for the dev server (see `vite`
// below). A session's worktree lives at .claude/worktrees/<name>/ inside the
// main checkout and borrows its node_modules, so neither is where a plain
// checkout has it.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const slashed = (/** @type {string} */ file) => String(file).split(path.sep).join('/').toLowerCase();
const ownClaudeDir = slashed(path.join(projectRoot, '.claude'));
const inOwnClaudeDir = (/** @type {string} */ file) => {
  const f = slashed(file);
  return f === ownClaudeDir || f.startsWith(`${ownClaudeDir}/`);
};
// The node_modules in use: this checkout's, or the nearest one above it.
let modulesHome = projectRoot;
while (!fs.existsSync(path.join(modulesHome, 'node_modules', 'astro'))) {
  const up = path.dirname(modulesHome);
  if (up === modulesHome) { modulesHome = projectRoot; break; }
  modulesHome = up;
}

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
    // The Study Desk's help page was /notebook/help/ until it covered the whole desk.
    '/notebook/help': '/desk/help/',
  },
  integrations: [
    sitemap({
      filter: (page) => {
        if (page.includes('/search')) return false;
        const slug = new URL(page).pathname.replace(/^\/|\/$/g, '');
        if (isClaudeDocPath(slug)) return false; // the repo's own docs (claudeDocsGuard, below)
        if (slug === 'unsubscribe') return false; // noindex utility page
        if (slug === 'contact/thanks') return false; // noindex form-success page
        if (slug === 'app-support/thanks') return false; // noindex form-success page
        // The account-deletion page (noindex and unlinked until accounts open)
        if (slug === 'delete-account') return false;
        // The account page and the page a device's QR code leads to (noindex, closed until accounts open)
        if (slug === 'account' || slug.startsWith('account/')) return false;
        // The Study Desk's notebook page and everything under it (noindex utility pages)
        if (slug === 'notebook' || slug.startsWith('notebook/')) return false;
        // The Study Desk as a page of its own (noindex, a preview)
        if (slug === 'desk' || slug === 'desk/help') return false;
        // A sheet's own address (noindex, a preview, and only the reader's own sheets)
        if (slug === 'sheets' || slug.startsWith('sheets/')) return false;
        // The collections page (noindex, a preview, and only the reader's own collections)
        if (slug === 'collections' || slug.startsWith('collections/')) return false;
        // Read View's old addresses, which forward to the chapters' pages (noindex)
        if (slug.startsWith('read/')) return false;
        return !noindexSlugs.has(slug) && !draftIntroSlugs.has(slug);
      },
    }),
    // Takes every CLAUDE.md, and the page Astro makes of src/pages/CLAUDE.md,
    // out of dist/ when the build ends.
    claudeDocsGuard(),
  ],
  vite: {
    cacheDir: path.join(os.tmpdir(), 'litbible-vite-cache'),
    // Sessions keep their worktrees under .claude/worktrees/, each a whole
    // copy of the repo with its own dist/. Watching them made the dev server
    // crawl dozens of copies at start (two minutes, and a content-config
    // timeout) and reload on another session's build. The rule names THIS
    // checkout's .claude only: as '**/.claude/**' it also matched every file
    // of a dev server started inside a worktree, which then watched nothing
    // and went on serving each file as it was first read.
    // fs.allow: a worktree's fonts come from the main checkout's
    // node_modules, outside its own root, and Vite refused to serve them
    // ("outside of Vite serving allow list"), so its pages drew in fallback
    // faces. In a plain checkout both entries are inside the root already.
    server: {
      watch: { ignored: [inOwnClaudeDir] },
      fs: { allow: [projectRoot, path.join(modulesHome, 'node_modules')] },
    },
  },
});
