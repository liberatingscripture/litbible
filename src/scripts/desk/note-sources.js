// src/scripts/desk/note-sources.js
//
// What a page holds notes on, for the margin (notes-margin.js) and the
// Notebook's list: a Chapter View chapter's verses, or (STUDY-DESK.md N11,
// provisional, 2026-10-08) a glossary entry's or an article's own text. The
// same margin and the same switch serve both (decision 9 under "the margin
// switch"); only how a note is found on the page differs.
//
// N11 is out of version 1 (BVJ, 2026-10-29; "maybe v2"), so PROSE_NOTES is
// off and prosePage() finds no prose page. That one switch closes every way
// to write or show such a note: the margin (proseSource), the selection
// panel's "My Notebook" row and "Add a note on this article"
// (prose-actions.js, panel.js), the tray's Show group (note-settings.js), the
// tour's steps there (tour.js), and the change notice on those pages. The
// records themselves are untouched: the format still describes them,
// proseTarget, the merge and the export carry them, and My Notes and
// /notebook list them like any other note. Turning the switch back on is
// version 2's start (STUDY-DESK.md, N11).
//
// A source gives:
//   textBox   the element notes sit beside, in the margin to its left
//   lineEl()  an element whose line height the notes take their rhythm from
//   load(store)     this page's notes, bookmarks and highlights (the margin
//                   draws a flag for a highlight whose wording changed; a
//                   prose page has none)
//   placed(records) each record with its words as a live Range; a record not
//                   on the page (lost, or in an entry the glossary's filter
//                   hides) is left out. A note on a footnote (M11) is placed
//                   beside its footnote in the Footnotes list: its range is
//                   that footnote's words and `footnote` is the list item,
//                   which the margin marks in place of lighting verse words
//   owns(record)    whether a note is one of this page's

import { offsetsToRange } from "../../lib/desk-anchor-dom.mjs";
import { placeProse, proseAnchorText } from "../../lib/desk-prose-anchor.mjs";
import { onFootnote, placeRecord, proseTarget } from "../../lib/desk-records.mjs";
import { currentSlug, forChapter, forProse } from "../../lib/desk-store-core.mjs";
import articleSlugs from "../../data/article-slugs.json";
import { footnoteElementFor } from "./footnote-notes.js";
import { chapterBlocks, chapterText, pageChapter } from "./page.js";

// PROSE_NOTES and prosePage live in page-kind.js, which the first stage
// carries (note-settings.js reads them); the rest of the desk imports them here.
import { PROSE_NOTES, prosePage } from "./page-kind.js";
export { PROSE_NOTES, prosePage };

/** An article's old slugs and the ones they became (src/data/article-slugs.json). */
export const RENAMED_ARTICLES = articleSlugs.renamed ?? {};

const toRange = (pts) => {
  const range = document.createRange();
  range.setStart(pts.startContainer, pts.startOffset);
  range.setEnd(pts.endContainer, pts.endOffset);
  return range;
};

/** A Chapter View chapter's notes and bookmarks, on its verses. */
export function studySource() {
  const here = pageChapter();
  const textBox = document.querySelector(".chapter-paragraphs");
  if (!here || !textBox) return null;
  return {
    textBox,
    lineEl: () => {
      const first = chapterBlocks()[0];
      return first?.querySelector("p") ?? first ?? textBox;
    },
    async load(store) {
      const mine = forChapter(await store.byChapter(here.bookKey, here.chapter), here.bookKey, here.chapter);
      return {
        notes: mine.filter((r) => r.kind === "note"),
        bookmarks: mine.filter((r) => r.kind === "bookmark"),
        highlights: mine.filter((r) => r.kind === "highlight"),
      };
    },
    placed(records) {
      const text = chapterText();
      const out = [];
      for (const r of records) {
        if (onFootnote(r)) {
          // Beside its footnote, found as a pin is. A lost one is left out,
          // as a note whose words are lost is.
          const li = footnoteElementFor(r);
          if (!li) continue;
          const range = document.createRange();
          range.selectNodeContents(li.querySelector(".fn-body") ?? li);
          out.push({ record: r, range, footnote: li });
          continue;
        }
        const at = placeRecord(text, r);
        if (at.status === "lost" || at.start == null) continue;
        const pts = offsetsToRange(text, at.start, at.end);
        if (pts) out.push({ record: r, range: toRange(pts) });
      }
      return out;
    },
    owns: (r) => r?.kind === "note" && r.bookKey === here.bookKey && r.chapter === here.chapter,
  };
}

/** The page's target a note is on, following an article's rename. */
export function targetOf(page, record) {
  const t = proseTarget(record);
  if (!t) return null;
  const id = t.type === "article" ? currentSlug(t.id, RENAMED_ARTICLES) : t.id;
  return page.targets.find((x) => x.type === t.type && x.id === id) ?? null;
}

/** This page's notes, for the Notebook's list: the article's, or every glossary entry's. */
export function proseRecords(page, records) {
  if (page.kind === "article") return forProse(records, "article", page.targets[0].id, RENAMED_ARTICLES);
  return forProse(records, "glossaryEntry");
}

/** Notes on a glossary entry's or an article's own text (N11). */
export function proseSource() {
  const page = prosePage();
  if (!page || !page.targets.length) return null;
  const shown = (el) => el.getClientRects().length > 0;
  return {
    textBox: page.box,
    lineEl: () => page.targets[0].root.querySelector("p") ?? page.targets[0].root,
    async load(store) {
      const notes = proseRecords(page, await store.all()).filter((r) => targetOf(page, r));
      return { notes, bookmarks: [], highlights: [] };
    },
    placed(records) {
      const texts = new Map(); // read each body once per drawing
      const textOf = (t) => {
        if (!texts.has(t)) texts.set(t, proseAnchorText(t.root));
        return texts.get(t);
      };
      const out = [];
      for (const r of records) {
        const t = targetOf(page, r);
        if (!t || !shown(t.root)) continue;
        const text = textOf(t);
        const at = placeProse(text, r);
        let range = null;
        if (at.start != null) {
          const pts = offsetsToRange(text, at.start, at.end);
          if (pts) range = toRange(pts);
        }
        // A note on the whole entry or article, or one whose words are gone,
        // sits level with its heading.
        if (!range) {
          range = document.createRange();
          range.selectNodeContents(t.head);
        }
        out.push({ record: r, range });
      }
      return out;
    },
    owns: (r) => Boolean(targetOf(page, r)),
  };
}
