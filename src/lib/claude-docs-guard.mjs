// Keeps the repo's Claude docs off the public site.
//
// Each area's rules sit in a CLAUDE.md beside its code, and Claude Code loads
// one only by that name, from that folder. The ones under src/pages/ and
// public/ would be published: Astro makes a page of every .md file under
// src/pages/, and copies public/ into dist/ as it is. Astro skips a page file
// by name only when it starts with "_" or ".", and no hook takes a route away
// (astro:routes:resolved is handed copies), so the docs are taken back out of
// dist/ when the build ends.
//
// One rule for everything that needs it: astro.config.mjs (the integration
// below, and the sitemap filter), scripts/check-links.mjs (fails if one
// shipped anyway), and test/claude-docs-guard.test.js.

import { readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// What a CLAUDE.md is called in a built site: itself (public/ is copied), or
// the folder or flat .html file of the page made from one. Case matters, so a
// page at /articles/claude/ is an ordinary page.
const DOC_NAMES = new Set(["CLAUDE.md", "CLAUDE", "CLAUDE.html"]);

// The start of a site address or dist/ path, through its first part so named:
// the doc itself, or the folder of its page. Null when no part is.
function docRoot(sitePath) {
  const parts = sitePath.split("/");
  const at = parts.findIndex((part) => DOC_NAMES.has(part));
  return at < 0 ? null : parts.slice(0, at + 1).join("/");
}

/** Whether a site address, or a path in dist/ written with forward slashes,
 *  is a CLAUDE.md or built from one. */
export function isClaudeDocPath(sitePath) {
  return docRoot(sitePath) !== null;
}

/** The files in a built site that are, or were built from, a CLAUDE.md: paths
 *  from distDir, written with forward slashes and sorted. */
export async function findClaudeDocFiles(distDir) {
  const entries = await readdir(distDir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(distDir, path.join(entry.parentPath, entry.name)))
    .map((file) => file.split(path.sep).join("/"))
    .filter(isClaudeDocPath)
    .sort();
}

/** The addresses in a built site's sitemaps that are a CLAUDE.md's. */
export async function findClaudeDocSitemapUrls(distDir) {
  const sitemaps = (await readdir(distDir)).filter((name) => /^sitemap.*\.xml$/.test(name));
  const found = [];
  for (const name of sitemaps.sort()) {
    const xml = await readFile(path.join(distDir, name), "utf8");
    for (const [, url] of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      if (isClaudeDocPath(new URL(url).pathname)) found.push(url);
    }
  }
  return found;
}

/** Takes every CLAUDE.md, and every page made from one, out of a built site.
 *  Returns the files that went. */
export async function removeClaudeDocFiles(distDir) {
  const found = await findClaudeDocFiles(distDir);
  for (const file of found) {
    // A page's folder goes with its file.
    await rm(path.join(distDir, docRoot(file)), { recursive: true, force: true });
  }
  return found;
}

/** For astro.config.mjs. It works when the build ends, before Pagefind
 *  indexes dist/.
 *  @returns {import("astro").AstroIntegration} */
export function claudeDocsGuard() {
  return {
    name: "lit-claude-docs-guard",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        for (const file of await removeClaudeDocFiles(fileURLToPath(dir))) {
          logger.info(`left ${file} out of the site: a CLAUDE.md is the repo's own doc`);
        }
      },
    },
  };
}
