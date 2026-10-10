// src/scripts/desk/note-sources.js
//
// What a page holds notes on, for the margin (notes-margin.js) and the
// Notebook's list: a Study View chapter's verses, or (STUDY-DESK.md N11,
// provisional, 2026-10-08) a glossary entry's or an article's own text. The
// same margin and the same switch serve both (decision 9 under "the margin
// switch"); only how a note is found on the page differs.
//
// A source gives:
//   textBox   the element notes sit beside, in the margin to its left
//   lineEl()  an element whose line height the notes take their rhythm from
//   load(store)     this page's notes, bookmarks and highlights (the margin
//                   draws a flag for a highlight whose wording changed; a
//                   prose page has none)
//   placed(records) each record with its words as a live Range; a record not
//                   on the page (lost, or in an entry the glossary's filter
//                   hides) is left out
//   owns(record)    whether a note is one of this page's

import { offsetsToRange } from "../../lib/desk-anchor-dom.mjs";
import { placeProse, proseAnchorText } from "../../lib/desk-prose-anchor.mjs";
import { placeRecord, proseTarget } from "../../lib/desk-records.mjs";
import { currentSlug, forChapter, forProse } from "../../lib/desk-store-core.mjs";
import articleSlugs from "../../data/article-slugs.json";
import { chapterBlocks, chapterText, pageChapter } from "./page.js";

/** An article's old slugs and the ones they became (src/data/article-slugs.json). */
export const RENAMED_ARTICLES = articleSlugs.renamed ?? {};

const toRange = (pts) => {
  const range = document.createRange();
  range.setStart(pts.startContainer, pts.startOffset);
  range.setEnd(pts.endContainer, pts.endOffset);
  return range;
};

/** A Study View chapter's notes and bookmarks, on its verses. */
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

/**
 * The glossary or an article, as notes see it: its targets, each with the
 * element holding its own text (`root`) and its heading (`head`, where a
 * note on the whole entry or article sits). Null on any other page, and on
 * the glossary unless the desk is on, which gives it a reading column.
 *
 * @returns {{ kind: "article" | "glossary", box: Element, label: string,
 *   targets: Array<{ type: string, id: string, title: string, root: Element, head: Element }> } | null}
 */
export function prosePage() {
  const card = document.querySelector(".article__card");
  const body = card?.querySelector(".article__body");
  if (card && body) {
    const slug = /^\/articles\/([^/]+)\/?$/.exec(window.location.pathname)?.[1];
    if (!slug) return null;
    const head = card.querySelector(".article__title") ?? body;
    const title = head.textContent.trim() || slug;
    return {
      kind: "article",
      box: card,
      label: "This article",
      targets: [{ type: "article", id: decodeURIComponent(slug), title, root: body, head }],
    };
  }
  const wrap = document.querySelector(".glossary-entries .entries-wrap");
  if (wrap && document.documentElement.hasAttribute("data-desk")) {
    const targets = Array.from(wrap.querySelectorAll("article.entry[data-entry]"))
      .map((el) => ({
        type: "glossaryEntry",
        id: el.dataset.entry,
        title: el.querySelector(".entries-strike strong")?.textContent.trim() || el.dataset.entry,
        root: el.querySelector(".entry-body"),
        // The heading's visible words: it also holds an off-screen label for
        // the site search, whose box would misplace the note.
        head: el.querySelector(".entries-strike") ?? el.querySelector(".entry-title") ?? el,
      }))
      .filter((t) => t.root);
    return { kind: "glossary", box: wrap, label: "The glossary", targets };
  }
  return null;
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
