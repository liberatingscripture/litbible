// Single source of truth for which chapters are drafts ("indexed": false).
//
// Consumed by astro.config.mjs (sitemap filter — runs in plain Node before
// Vite) and ReadMenu.astro ("(draft)" chapter markers — Astro frontmatter at
// build time), so it reads the chapter JSON directly from disk with node:fs
// rather than import.meta.glob. Slugs derive from filenames because the
// site's routes are filename-addressed ({bookKey}-{chapter}.json ↔
// /{bookKey}-{chapter}); an unparseable file counts as a non-draft chapter.
//
// Plain .mjs (not .ts): astro.config.mjs imports it before any TS tooling
// is in play.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolved from the working directory, not import.meta.url: when Vite
// bundles this module for the Astro build, import.meta.url points at the
// output chunk, not the source tree. Both consumers (astro.config.mjs and
// Astro frontmatter) run with the project root as cwd; the import.meta.url
// form is kept as a fallback for direct Node execution from elsewhere.
function resolveChaptersDir() {
  const fromCwd = path.resolve(process.cwd(), "src/data/chapters");
  if (existsSync(fromCwd)) return fromCwd;
  return fileURLToPath(new URL("../data/chapters", import.meta.url));
}

let cached = null;

/**
 * @returns {{
 *   noindexSlugs: Set<string>,            // "john-3"-style slugs of draft chapters
 *   draftChaptersByBook: Record<string, number[]>, // bookKey -> sorted draft chapter numbers
 *   fullyDraftBooks: Set<string>,         // books where EVERY chapter is a draft
 * }}
 */
export function scanDraftChapters() {
  if (cached) return cached;

  const chaptersDir = resolveChaptersDir();
  const noindexSlugs = new Set();
  const draftChaptersByBook = {};
  const bookCounts = new Map(); // bookKey -> { total, drafts }

  for (const f of readdirSync(chaptersDir).filter((f) => f.endsWith(".json"))) {
    let isDraft = false;
    try {
      isDraft =
        JSON.parse(readFileSync(path.join(chaptersDir, f), "utf-8"))
          .indexed === false;
    } catch {
      isDraft = false;
    }

    const slug = f.replace(/\.json$/, "");
    const bookKey = slug.replace(/-\d+$/, "");
    const chapter = Number(slug.slice(bookKey.length + 1));

    if (isDraft) {
      noindexSlugs.add(slug);
      if (Number.isFinite(chapter)) {
        (draftChaptersByBook[bookKey] ??= []).push(chapter);
      }
    }

    const counts = bookCounts.get(bookKey) ?? { total: 0, drafts: 0 };
    counts.total += 1;
    if (isDraft) counts.drafts += 1;
    bookCounts.set(bookKey, counts);
  }

  for (const chapters of Object.values(draftChaptersByBook)) {
    chapters.sort((a, b) => a - b);
  }

  const fullyDraftBooks = new Set(
    [...bookCounts.entries()]
      .filter(([, c]) => c.total > 0 && c.total === c.drafts)
      .map(([bookKey]) => bookKey),
  );

  cached = { noindexSlugs, draftChaptersByBook, fullyDraftBooks };
  return cached;
}
