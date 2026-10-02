// Build-time shell for src/lib/scripture-refs.mjs: supplies the two lookups
// the pure linker needs from the chapter files on disk, and exposes the one
// call the pages use.
//
// hasVerse — whether a chapter page carries #vN. A verse the source text
//   omits (Matthew 17:21) or a draft chapter's verse has no anchor, so a
//   reference to it links the chapter instead of a fragment that check:links
//   would (rightly) reject.
// isDraft — draft chapters ("indexed": false), from scanDraftChapters(), so
//   the preview can say the chapter is still being translated.
//
// Reads with node:fs and resolves from the working directory, the same way
// draft-chapters.mjs does and for the same reason (Vite rewrites
// import.meta.url when it bundles Astro frontmatter).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanDraftChapters } from "./draft-chapters.mjs";
import { linkScriptureRefs } from "./scripture-refs.mjs";
import { openExternalLinks } from "./external-links.mjs";

function resolveChaptersDir() {
  const fromCwd = path.resolve(process.cwd(), "src/data/chapters");
  if (existsSync(fromCwd)) return fromCwd;
  return fileURLToPath(new URL("../data/chapters", import.meta.url));
}

let verseSets = null;

function loadVerseSets() {
  if (verseSets) return verseSets;
  verseSets = new Map();
  const dir = resolveChaptersDir();
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const slug = f.replace(/\.json$/, "");
    let paragraphs = [];
    try {
      paragraphs = JSON.parse(readFileSync(path.join(dir, f), "utf-8")).paragraphs ?? [];
    } catch {
      paragraphs = [];
    }
    const verses = new Set();
    for (const p of paragraphs) {
      for (const m of String(p).matchAll(/id="v(\d+)"/g)) verses.add(Number(m[1]));
    }
    verseSets.set(slug, verses);
  }
  return verseSets;
}

export const refLinkOptions = {
  hasVerse: (key, chapter, verse) => loadVerseSets().get(`${key}-${chapter}`)?.has(verse) ?? false,
  isDraft: (key, chapter) => scanDraftChapters().noindexSlugs.has(`${key}-${chapter}`),
};

/**
 * Links the NT references in a rendered HTML string (website only), then opens
 * every link that leaves the site in a new tab. This is the one call every
 * rendered body already passes through (footnotes, intros, articles, glossary,
 * release notes), which is why the new-tab rule lives here rather than in
 * each page; the Sefaria and eBible links the linker writes get it too.
 */
export function linkRefs(html) {
  return openExternalLinks(linkScriptureRefs(html, refLinkOptions));
}
