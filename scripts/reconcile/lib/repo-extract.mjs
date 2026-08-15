// Adapted from the v1 audit (docx-audit/lib/repo-extract.mjs in the session
// scratchpad). v1 hard-coded an absolute path to scripts/lib/verse-text.mjs
// (see the approved plan's Phase 1 note on docx-verses.mjs:21-24 and
// repo-extract.mjs:4-7) so it would only ever run from one checkout. This
// copy imports it as a normal relative specifier instead - scripts/reconcile
// sits two levels under scripts/, so scripts/lib is "../../lib" from here.
//
// Repo-side extraction: chapter JSON -> verse map + footnote reading order.
import { splitChapterVerses } from "../../lib/verse-text.mjs";

export { splitChapterVerses };

function footnoteHtmlToText(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

const SUP_RE = /<sup id="v(\d+)" class="vn">|<sup class="fn-ref"><a id="fnref-([^"]+)"/g;

/**
 * Walk paragraphs[] HTML in order, tracking current verse via id="vN"
 * markers, and recording each fn-ref anchor's reading-order position + the
 * verse it falls under.
 * @returns {Array<{refId:string, verse:number|null, orderIndex:number, footnote:object|null}>}
 */
export function extractRepoFootnoteOrder(paragraphs, footnotesArr) {
  const footnotesByRefId = new Map();
  for (const fn of footnotesArr || []) {
    footnotesByRefId.set(fn.refId, fn);
  }
  const order = [];
  let currentVerse = null;
  let idx = 0;
  for (const p of paragraphs) {
    SUP_RE.lastIndex = 0;
    let m;
    while ((m = SUP_RE.exec(p))) {
      if (m[1] !== undefined) {
        currentVerse = Number(m[1]);
      } else if (m[2] !== undefined) {
        const refId = `fnref-${m[2]}`;
        const fn = footnotesByRefId.get(refId) || null;
        idx += 1;
        order.push({
          refId,
          verse: currentVerse,
          orderIndex: idx,
          footnote: fn,
          text: fn ? footnoteHtmlToText(fn.html) : null,
        });
      }
    }
  }
  return order;
}

export { footnoteHtmlToText };
