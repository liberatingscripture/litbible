// src/scripts/desk/print-notes.js
//
// "Print with my notes" (STUDY-DESK.md, M6): a Study View chapter, or the book
// Read View shows, printed with the reader's notes in a column beside the
// text and their highlights tinted. The rules are src/lib/desk-print-notes.mjs;
// this file reads the page and the notebook, builds what print needs, asks
// the browser to print, and takes all of it away again. The look is the end
// of desk.css, under @media print and `html[data-desk-print="notes"]`.
//
// What it does, in order:
//   1. reads the chapter's notes and highlights (a book's, in Read View) and
//      finds each note's first word on the page, the way the margin does
//      (placeRecord against the page's own anchor text), so a note lands
//      beside the block that holds those words;
//   2. adds one print-only <aside> after each block that has notes, and a
//      closing list for any note with no block at all. They are `display: none`
//      everywhere but the printed page, so the screen never changes, and they
//      hold no verse text (`[data-verse]`), so the anchor reader never meets
//      them;
//   3. paints the highlights as CSS Custom Highlights under names of their
//      own (`desk-print-hl-<colour>`), which Chrome prints as a tint;
//   4. stamps `data-desk-print="notes"` on <html>, waits for the fonts the
//      page will print in, and calls window.print();
//   5. on `afterprint` removes the asides, the highlights and the attribute,
//      leaving the page as it was. It never writes a record.
//
// The reader's screen switches ("My notes", "My highlights", Read View's own,
// "Hide my notes") do not apply: the reader asked for notes on paper, and
// Read View hides highlights by default only so the book reads straight
// through. Plain printing (Ctrl+P) is untouched and stays the text and its
// footnotes.

import { offsetsToRange } from "../../lib/desk-anchor-dom.mjs";
import { MARKER_NAMES } from "../../lib/desk-notes.mjs";
import { COLORS, placeRecord } from "../../lib/desk-records.mjs";
import { forChapter, liveRecords, recordReference } from "../../lib/desk-store-core.mjs";
import {
  STRAYS_TITLE,
  blockForVerse,
  planNotes,
  printHeading,
  standing,
} from "../../lib/desk-print-notes.mjs";
import { glyph } from "./glyphs.js";
import { fillNoteWords } from "./note-words.js";
import { chapterBlocks, chapterTextFor, pageChapter, readBook, readChapterBlocks } from "./page.js";

const ATTR = "data-desk-print";
const hlName = (color) => `desk-print-hl-${color}`;
const supportsHighlight = typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined";

/** Where this page's chapters are, or null: Study View's chapter, or the book in Read View. */
function surface() {
  const here = pageChapter();
  if (here) {
    return {
      bookKey: here.bookKey,
      container: document.querySelector(".chapter-paragraphs"),
      blocksOf: () => Array.from(chapterBlocks()).filter((b) => !b.matches("[data-desk-print-extra]")),
      only: here.chapter,
    };
  }
  const book = readBook();
  if (!book) return null;
  return {
    bookKey: book,
    container: document.querySelector("[data-rm-root] [data-rm-text]"),
    blocksOf: (chapter) => Array.from(readChapterBlocks(chapter)),
    only: null,
  };
}

const versesOf = (block) =>
  Array.from(block.querySelectorAll("[data-verse]"), (el) => Number(el.getAttribute("data-verse"))).filter(Number.isInteger);

/** One printed note. */
function noteElement(record, how) {
  const head = printHeading(record, recordReference(record), how);
  const el = document.createElement("section");
  el.className = "desk-print-note";
  const top = document.createElement("p");
  top.className = "desk-print-note__head";
  top.insertAdjacentHTML("beforeend", glyph(record.marker, "desk-print-note__glyph"));
  const ref = document.createElement("span");
  ref.className = "desk-print-note__ref";
  ref.textContent = head.ref;
  top.append(ref);
  if (head.quote) {
    const quote = document.createElement("span");
    quote.className = "desk-print-note__quote";
    quote.textContent = ` ‘${head.quote}’`;
    top.append(quote);
  }
  el.append(top);
  if (head.warning) {
    const warn = document.createElement("p");
    warn.className = "desk-print-note__warn";
    warn.textContent = head.warning;
    el.append(warn);
  }
  const body = document.createElement("p");
  body.className = "desk-print-note__body";
  fillNoteWords(body, record.body, MARKER_NAMES[record.marker] ?? "Note");
  el.append(body);
  return el;
}

/**
 * Fonts the printed page needs that the screen may not have loaded: the
 * serif print.css sets (used only in print, so a page laid out for the screen
 * hasn't fetched it), and the notes' own face. Bounded, so a slow network
 * never holds the print dialog back for long.
 */
async function printFonts(noteText) {
  if (!document.fonts?.load) return;
  const page = (document.querySelector("main")?.textContent ?? "").slice(0, 30000);
  const loads = [
    document.fonts.load('12pt "Crimson Text"', page),
    document.fonts.load('italic 12pt "Crimson Text"', page),
    document.fonts.load('bold 12pt "Crimson Text"', page),
    document.fonts.load('500 10pt "Playpen Sans"', noteText),
    document.fonts.load('10pt Inter', noteText),
  ].map((p) => p.catch(() => []));
  const patience = new Promise((resolve) => setTimeout(resolve, 2500));
  await Promise.race([Promise.all(loads).then(() => document.fonts.ready), patience]);
}

/**
 * @param {{ store: object | null }} options
 * @returns {{ can(): boolean, print(): Promise<void> } | null} null where the
 *   browser can't keep a notebook
 */
export function createPrintNotes({ store }) {
  if (!store) return null;
  let undo = null; // what takes it all away, while a print is under way

  /** Whether this page can print with notes: a Study View chapter, or Read View. */
  const can = () => Boolean(surface()?.container);

  async function build(s) {
    const mine = s.only
      ? forChapter(await store.byChapter(s.bookKey, s.only), s.bookKey, s.only)
      : liveRecords(await store.all()).filter((r) => r.bookKey === s.bookKey);
    const notes = mine.filter((r) => r.kind === "note");
    const marks = mine.filter((r) => r.kind === "highlight");

    // Each chapter the records touch, read once: its text, and its blocks
    // numbered across the whole page so a plan can name one.
    const chapters = new Map();
    const allBlocks = [];
    const chapterOf = (n) => {
      if (!chapters.has(n)) {
        const blocks = s.blocksOf(n);
        chapters.set(n, { text: chapterTextFor(s.bookKey, n), blocks, base: allBlocks.length, verses: blocks.map(versesOf) });
        allBlocks.push(...blocks);
      }
      return chapters.get(n);
    };

    // Read every chapter's text before anything is added to the page.
    for (const r of [...notes, ...marks]) chapterOf(r.chapter);

    // 1. Where each note goes.
    const info = new Map();
    const items = notes.map((r, rank) => {
      const c = chapterOf(r.chapter);
      let how = "lost";
      let block = null;
      let offset = null;
      if (c.text) {
        try {
          const at = placeRecord(c.text, r);
          how = standing(at.status);
          if (at.start != null) {
            const node = c.text.toDom(at.start, "start")?.node;
            const k = node ? c.blocks.findIndex((b) => b.contains(node)) : -1;
            if (k >= 0) {
              block = c.base + k;
              offset = at.start;
            }
          }
        } catch (_) {
          // A note that can't be placed (a bad quote from somewhere else)
          // still prints, beside its verse.
        }
        if (block == null) {
          const k = blockForVerse(c.verses, r.verse, r.endVerse);
          if (k != null) block = c.base + k;
        }
      }
      info.set(r.id, { record: r, how });
      return { id: r.id, block, offset, verse: r.verse ?? null, rank };
    });
    const plan = planNotes(items);

    // 2. The asides, each after its block.
    const added = [];
    for (const row of plan.rows) {
      const aside = document.createElement("aside");
      aside.className = "desk-print-notes";
      aside.setAttribute("aria-hidden", "true");
      aside.setAttribute("data-desk-print-extra", "");
      for (const id of row.ids) aside.append(noteElement(info.get(id).record, info.get(id).how));
      allBlocks[row.block].after(aside);
      added.push(aside);
    }
    if (plan.strays.length && s.container) {
      const strays = document.createElement("section");
      strays.className = "desk-print-strays";
      strays.setAttribute("aria-hidden", "true");
      strays.setAttribute("data-desk-print-extra", "");
      const title = document.createElement("h2");
      title.className = "desk-print-strays__title";
      title.textContent = STRAYS_TITLE;
      strays.append(title);
      for (const id of plan.strays) strays.append(noteElement(info.get(id).record, "lost"));
      s.container.append(strays);
      added.push(strays);
    }

    // 3. The highlights, one named Custom Highlight per colour.
    const painted = [];
    if (supportsHighlight) {
      const byColor = new Map();
      for (const r of marks) {
        if (!COLORS.includes(r.color)) continue;
        const c = chapterOf(r.chapter);
        if (!c.text) continue;
        try {
          const at = placeRecord(c.text, r);
          if (at.status === "lost" || at.start == null) continue;
          const pts = offsetsToRange(c.text, at.start, at.end);
          if (!pts) continue;
          const range = document.createRange();
          range.setStart(pts.startContainer, pts.startOffset);
          range.setEnd(pts.endContainer, pts.endOffset);
          if (range.collapsed) continue;
          if (!byColor.has(r.color)) byColor.set(r.color, []);
          byColor.get(r.color).push(range);
        } catch (_) {
          // One highlight that can't be placed mustn't take the others'.
        }
      }
      for (const [color, ranges] of byColor) {
        CSS.highlights.set(hlName(color), new Highlight(...ranges));
        painted.push(color);
      }
    }

    const noteText = notes.map((r) => `${r.body ?? ""} ${recordReference(r)}`).join(" ");
    return {
      noteText,
      undo() {
        for (const el of added) el.remove();
        for (const color of painted) CSS.highlights.delete(hlName(color));
      },
    };
  }

  async function print() {
    const s = surface();
    if (undo || !s?.container) return;
    const root = document.documentElement;
    let built = null;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.removeEventListener("afterprint", finish);
      root.removeAttribute(ATTR);
      built?.undo();
      undo = null;
    };
    undo = finish; // set first, so a second press while this is building does nothing
    try {
      built = await build(s);
      window.addEventListener("afterprint", finish);
      root.setAttribute(ATTR, "notes");
      await printFonts(built.noteText);
      window.print();
    } catch (err) {
      console.error("Study Desk: printing with notes didn't start", err);
      finish();
    }
  }

  return { can, print };
}
