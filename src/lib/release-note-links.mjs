// src/lib/release-note-links.mjs
//
// Turns one release-notes change `description` into HTML with a link to what
// changed. Website only: release-notes.json is the apps' Translation Updates
// feed and keeps its plain text (see "Release notes are automated" in
// CLAUDE.md).
//
// The descriptions are written by scripts/lib/release-notes-core.mjs in a few
// fixed shapes, so each maps back to a page:
//   "Matthew 21:21–22 — text updated"      → the scripture linker
//   "Mark Introduction updated"            → /mark-intro/
//   "Glossary entry for Good [1] updated"  → /glossary/#<id>
//   "Article updated: faithfulness as …"   → /articles/<slug>/
// Anything that names no page it can find stays plain text.

import { BOOK_ORDER, bookKeyToLabel } from "../data/books.js";

const LABEL_TO_KEY = new Map(BOOK_ORDER.map((k) => [bookKeyToLabel(k), k]));

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * @param {string} description
 * @param {object} deps
 * @param {(html: string) => string} deps.linkRefs  The scripture linker.
 * @param {(traditional: string) => string | null} deps.glossaryId
 * @param {Set<string>} deps.articleSlugs
 * @returns {string} HTML
 */
export function linkChangeDescription(description, { linkRefs, glossaryId, articleSlugs }) {
  const text = escapeHtml(description);

  const intro = description.match(/^(.+) Introduction (added|updated)$/);
  if (intro && LABEL_TO_KEY.has(intro[1])) {
    return `<a href="/${LABEL_TO_KEY.get(intro[1])}-intro/">${escapeHtml(intro[1])} Introduction</a> ${intro[2]}`;
  }

  const gloss = description.match(/^Glossary entry for (.+) (added|updated)$/);
  if (gloss) {
    const id = glossaryId(gloss[1]);
    return id
      ? `Glossary entry for <a href="/glossary/#${id}">${escapeHtml(gloss[1])}</a> ${gloss[2]}`
      : text;
  }

  const article = description.match(/^Article (added|updated): (.+)$/);
  if (article) {
    const slug = article[2].trim().replace(/ /g, "-");
    return articleSlugs.has(slug)
      ? `Article ${article[1]}: <a href="/articles/${slug}/">${escapeHtml(article[2])}</a>`
      : text;
  }

  return linkRefs(text);
}
