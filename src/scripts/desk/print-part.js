// src/scripts/desk/print-part.js
//
// "Print ▸" in the verse menu and the selection panel (STUDY-DESK-FIXES.md,
// E40): just some verses, or just the words selected, on paper, plainly, with
// the reader's notes on them, or with room to write. Whole chapters are
// print-notes.js's and print-room.js's; this reuses both looks and only
// narrows what is printed. The rules are src/lib/desk-print-part.mjs.
//
//   - Verses (Chapter View's verse menu): the verses outside the range are
//     hidden for the one print, not removed: each block, verse span and
//     footnote the print leaves out gets `data-desk-print-skip`, which
//     desk.css hides on paper only. What stays is the real text, so the
//     verse numbers, the footnote letters and the notes cited by those
//     letters print as they do for a chapter, and M6's notes and N9's ruled
//     margin work unchanged (a chapter's `build` is handed the verse range).
//   - A selection: the words, as Copy text gives them (the verse menu's join,
//     italics and verse numbers kept), set as one passage in a print-only
//     excerpt added to the text's container, with everything else hidden the
//     same way. No footnote letters, as in Copy text; "with my notes" adds
//     the notes on the selection's verses after it.
//
// Either way a heading names the passage, the page's chrome is hidden under
// `html[data-desk-part]`, and print.css's credit and notice print as ever.
// Everything is taken away again by print-look.js (afterprint, or the
// reader's next move), and nothing is written or stored.

import { handoutHtml } from "../../lib/handout-rich.mjs";
import { onFootnote } from "../../lib/desk-records.mjs";
import {
  SELECTION_NOTES_TITLE,
  citedFootnoteIds,
  notesForPart,
  partHeading,
  planVerses,
} from "../../lib/desk-print-part.mjs";
import { forChapter } from "../../lib/desk-store-core.mjs";
import { noteElement, printFonts, surface } from "./print-notes.js";
import { printLook } from "./print-look.js";

const SKIP = "data-desk-print-skip";
const PART = "data-desk-part";
const EXTRA = "data-desk-print-extra";

/** Hides `el` on paper; the returned list collects the undos. */
function skipper(undo) {
  return (el) => {
    el.setAttribute(SKIP, "");
    undo.push(() => el.removeAttribute(SKIP));
  };
}

function heading(ref) {
  const h = document.createElement("h2");
  h.className = "desk-print-part-ref";
  h.setAttribute("aria-hidden", "true");
  h.setAttribute(EXTRA, "");
  h.textContent = partHeading(ref);
  return h;
}

/**
 * @param {{ store: object | null,
 *   printNotes: { build(s: object, only?: object | null): Promise<{ noteText: string, undo(): void }> } | null }} options
 * @returns {{ can(): boolean,
 *   printVerses(kind: "plain" | "notes" | "room", part: { start: number, end: number, ref: string }): Promise<void>,
 *   printSelection(kind: "plain" | "notes" | "room", part: { start: number, end: number, ref: string,
 *     bookKey: string, chapter: number, richText: string }): Promise<void> }}
 */
export function createPrintPart({ store, printNotes }) {
  /** Whether this page can print a part: a Chapter View chapter, or Read View. */
  const can = () => Boolean(surface()?.container);

  /** True when `kind` may go ahead; otherwise says why not. */
  function allowed(kind) {
    if (kind !== "notes") return true;
    // "Hide my marks" is about the screen only (BVJ, 2026-11-10): a print that
    // says "with my notes" prints them.
    return Boolean(store && printNotes);
  }

  async function printVerses(kind, { start, end, ref }) {
    const s = surface();
    if (!s?.container || !allowed(kind)) return;
    await printLook(
      kind,
      {
        build: async () => {
          const undo = [];
          const skip = skipper(undo);
          const root = document.documentElement;
          // The blocks and spans the verses don't need.
          const blocks = Array.from(s.blocksOf(s.only ?? undefined));
          const spans = blocks.map((b) => Array.from(b.querySelectorAll("[data-verse]")));
          const plan = planVerses(
            spans.map((list) => list.map((el) => Number(el.getAttribute("data-verse")))),
            start,
            end,
          );
          const hrefs = [];
          blocks.forEach((block, i) => {
            if (!plan[i].any) return skip(block);
            spans[i].forEach((span, j) => {
              if (!plan[i].keep[j]) return skip(span);
              for (const a of span.querySelectorAll("sup.fn-ref a")) hrefs.push(a.getAttribute("href"));
            });
            // A poetry line left with none of the verses' words.
            for (const line of block.querySelectorAll("p")) {
              const own = line.querySelectorAll("[data-verse]");
              if (own.length && Array.from(own).every((el) => el.hasAttribute(SKIP))) skip(line);
            }
          });
          // Only the footnotes the kept verses cite.
          const cited = new Set(citedFootnoteIds(hrefs));
          for (const li of document.querySelectorAll(".footnotes > li")) if (!cited.has(li.id)) skip(li);
          if (!cited.size) for (const wrap of document.querySelectorAll(".footnotes-wrap")) skip(wrap);
          root.setAttribute(PART, "verses");
          undo.push(() => root.removeAttribute(PART));

          // The notes (M6) of just these verses, placed beside what is kept.
          let notes = null;
          const title = heading(ref);
          const put = () => {
            notes?.undo();
            title.remove();
            for (const fn of undo.reverse()) fn();
          };
          try {
            notes = kind === "notes" ? await printNotes.build(s, { start, end }) : null;
            s.container.prepend(title);
          } catch (err) {
            put(); // printLook only undoes what build returned
            throw err;
          }
          return { noteText: notes?.noteText ?? "", undo: put };
        },
        ready: (built) => printFonts(built.noteText),
        what: "printing verses",
      },
    );
  }

  async function printSelection(kind, { start, end, ref, bookKey, chapter, richText }) {
    const s = surface();
    if (!s?.container || !allowed(kind)) return;
    await printLook(
      kind,
      {
        build: async () => {
          const undo = [];
          const skip = skipper(undo);
          const root = document.documentElement;
          // Everything the text's container holds, and the footnotes, are out.
          for (const block of Array.from(s.container.children)) skip(block);
          for (const wrap of document.querySelectorAll(".footnotes-wrap")) skip(wrap);

          const excerpt = document.createElement("div");
          excerpt.className = "desk-print-excerpt";
          excerpt.setAttribute("aria-hidden", "true");
          excerpt.setAttribute(EXTRA, "");
          const body = document.createElement("div");
          body.className = "desk-print-excerpt__text";
          body.innerHTML = handoutHtml(richText);
          excerpt.append(heading(ref), body);

          const put = () => {
            excerpt.remove();
            root.removeAttribute(PART);
            for (const fn of undo.reverse()) fn();
          };
          let noteText = "";
          if (kind === "notes" && store) {
            let records;
            try {
              records = forChapter(await store.byChapter(bookKey, chapter), bookKey, chapter);
            } catch (err) {
              put();
              throw err;
            }
            const mine = notesForPart(records, start, end).filter((r) => !onFootnote(r));
            if (mine.length) {
              const section = document.createElement("section");
              section.className = "desk-print-strays";
              const title = document.createElement("h2");
              title.className = "desk-print-strays__title";
              title.textContent = SELECTION_NOTES_TITLE;
              section.append(title);
              for (const r of mine) section.append(noteElement(r, "here"));
              excerpt.append(section);
              noteText = mine.map((r) => r.body ?? "").join(" ");
            }
          }
          s.container.append(excerpt);
          root.setAttribute(PART, "selection");
          return { noteText, undo: put };
        },
        ready: (built) => printFonts(built.noteText),
        what: "printing a selection",
      },
    );
  }

  return { can, printVerses, printSelection };
}
