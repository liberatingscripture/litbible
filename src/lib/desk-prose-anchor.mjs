// src/lib/desk-prose-anchor.mjs
//
// Anchor text for prose: a glossary entry's body or an article's (STUDY-DESK.md
// N11, "Notes on glossary entries and articles", built provisionally,
// 2026-10-08). The format's anchor text is defined on a chapter's verses
// (STUDY-DESK-FORMAT.md, "Anchor text"); text with no verses needs a rule of
// its own, and this is the website's proposal, for BVJ to confirm:
//
//   the whole body is read as one verse, by the same steps 3 to 7: every
//   block boundary is a space, every other tag vanishes, characters are
//   composed, invisible ones dropped, whitespace collapsed and trimmed.
//
// That lets every other piece be the scripture's own: desk-anchor-dom.mjs's
// map back to the DOM, anchor-core's quote (exact, and up to 32 characters
// either side) and its search when the wording moves. With one verse there is
// no "moved"; a quote is `found` anywhere in the body, `changed` by the
// context rule, or, when nothing usable is left, the note goes on the whole
// entry or article (`whole`), as a scripture note goes on its whole verse.
//
// What isn't the body's own text is skipped, the way verse numbers and
// footnote letters are in scripture: anything marked `data-desk-skip`,
// `.sr-only` text, footnote references, and buttons a script adds.

import { makeAnchor, resolveAnchor } from "./anchor-core.mjs";
import { anchorTextFromSegments } from "./desk-anchor-dom.mjs";

const ELEMENT = 1;
const TEXT = 3;

const BLOCK = new Set([
  "p", "blockquote", "br", "div", "li", "ul", "ol", "dl", "dt", "dd", "table", "tr", "td", "th",
  "h1", "h2", "h3", "h4", "h5", "h6", "section", "article", "figure", "figcaption", "pre", "hr",
]);

/** Elements whose text is never the body's own. */
function isSkipped(el) {
  const tag = String(el.tagName).toLowerCase();
  if (tag === "button" || tag === "script" || tag === "style" || tag === "svg") return true;
  if (el.getAttribute("data-desk-skip") != null) return true;
  const cls = ` ${el.getAttribute("class") ?? ""} `;
  if (cls.includes(" sr-only ")) return true;
  // Article footnote references (a superscript number or letter linking to a
  // note), like the scripture's footnote letters.
  if (tag === "sup" && (cls.includes(" fn-ref ") || cls.includes(" footnote-ref ") || el.querySelector?.("a[href^='#fn']"))) return true;
  return false;
}

/**
 * The body's text as segments for desk-anchor-dom's builder, every text node
 * on "verse" 1, skipped ones on none.
 *
 * @param {Node} root the entry's `.entry-body` or the article's `.article__body`
 */
export function proseSegments(root) {
  const segments = [];
  const walk = (node, skipped) => {
    if (node.nodeType === TEXT) {
      segments.push({ node, text: node.nodeValue ?? "", verse: skipped ? null : 1 });
      return;
    }
    if (node.nodeType !== ELEMENT) return;
    const block = BLOCK.has(String(node.tagName).toLowerCase());
    if (block) segments.push({ boundary: true });
    const skip = skipped || isSkipped(node);
    for (const child of node.childNodes) walk(child, skip);
    if (block) segments.push({ boundary: true });
  };
  for (const child of root.childNodes) walk(child, false);
  return segments;
}

/**
 * The body as anchor text, with desk-anchor-dom's map back to the page
 * (`toDom`, `fromDom`). Read fresh each time: the map points at today's nodes.
 */
export function proseAnchorText(root) {
  return anchorTextFromSegments(proseSegments(root));
}

/** The `quote` a note keeps for body text [start, end). */
export function proseQuote(text, start, end) {
  const a = makeAnchor(text, start, end);
  return { exact: a.exact, prefix: a.prefix, suffix: a.suffix };
}

/**
 * Where a note sits in today's body: `found` or `changed` with [start, end),
 * or `whole` (no quote, or nothing usable left) with start and end null, and
 * the note goes on the whole entry or article.
 *
 * @param {object} text from proseAnchorText
 * @param {{ quote?: { exact: string, prefix: string, suffix: string } }} record
 */
export function placeProse(text, record) {
  if (!record?.quote?.exact || !text?.text) return { status: "whole", start: null, end: null };
  const at = resolveAnchor(text, { verse: 1, endVerse: 1, ...record.quote });
  if ((at.status === "found" || at.status === "moved" || at.status === "changed") && at.start != null) {
    return { status: at.status === "moved" ? "found" : at.status, start: at.start, end: at.end };
  }
  return { status: "whole", start: null, end: null };
}
