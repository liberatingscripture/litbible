// src/scripts/desk/highlights.js
//
// The reader's highlights, drawn on a Study View chapter or on the book Read
// View shows (STUDY-DESK.md, highlights). Four colours, one CSS Custom
// Highlight per colour (`desk-hl-yellow` and the rest; their look is in
// desk.css), so the scripture's text and markup are never touched: Copy text,
// the handout and the anchor reader all read the verses off the page, and a
// highlight adds nothing to them. A record carrying a colour this file
// doesn't know is left out of the drawing and never changed.
//
// Making, merging and removing highlights is not here (actions.js and
// src/lib/desk-highlights.mjs); this file only reads the notebook and paints
// what it finds. Where each highlight goes is worked out from its quote
// against today's text, the same way a note's words are (placeRecord), and a
// highlight whose words are gone is simply not painted.
//
// It draws again whenever the page's text changes, not only when the notebook
// does. Other scripts re-wrap the scripture's text nodes after load (the term
// lens wraps every key term in a span), and a Range made before that can end
// up pointing at nodes that have since been split or replaced. So the chapter
// is read fresh on every drawing, never kept: the map from a character to its
// text node (desk-anchor-dom.mjs) is only true until the next DOM change.
// Drawings are coalesced into one per frame, so a burst of changes costs one.

import { offsetsToRange } from "../../lib/desk-anchor-dom.mjs";
import { COLORS, placeRecord } from "../../lib/desk-records.mjs";
import { forChapter } from "../../lib/desk-store-core.mjs";
import { SETTINGS_EVENT, getSetting, highlightSetting } from "./note-settings.js";
import { chapterTextFor, pageChapter, readBook } from "./page.js";

const nameOf = (color) => `desk-hl-${color}`;

/**
 * @param {{ store: object }} options
 * @returns {{ refresh(): void } | null} null where the page has no highlights
 *   to draw (not a Study View chapter or Read View, or a browser without the
 *   CSS Custom Highlight API)
 */
export function createHighlights({ store }) {
  const supported = typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined";
  const study = pageChapter();
  const book = study ? null : readBook();
  if (!store || !supported || !(study || book)) return null;
  const textBox = study
    ? document.querySelector(".chapter-paragraphs")
    : document.querySelector("[data-rm-root] [data-rm-text]");
  if (!textBox) return null;

  let records = []; // this page's highlight records
  let loading = 0;

  /* ── Reading the notebook ─────────────────────────────────────────── */

  async function load() {
    const mine = ++loading;
    const found = study
      ? forChapter(await store.byChapter(study.bookKey, study.chapter), study.bookKey, study.chapter)
      : await store.all();
    if (mine !== loading) return; // a newer read has overtaken this one
    records = found.filter((r) => r.kind === "highlight" && (study || r.bookKey === book));
    schedule();
  }

  /* ── Drawing ─────────────────────────────────────────────────────── */

  let frame = 0;
  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  }

  function clear() {
    for (const color of COLORS) CSS.highlights.delete(nameOf(color));
  }

  function draw() {
    if (getSetting(highlightSetting()) !== "on") {
      clear();
      return;
    }
    const texts = new Map(); // chapter -> its text, read once for this drawing and dropped
    const byColor = new Map();
    for (const r of records) {
      if (!COLORS.includes(r.color)) continue;
      if (!texts.has(r.chapter)) texts.set(r.chapter, chapterTextFor(r.bookKey, r.chapter));
      const text = texts.get(r.chapter);
      if (!text) continue; // a chapter this page doesn't show (a draft in Read View)
      try {
        const at = placeRecord(text, r);
        if (at.status === "lost" || at.start == null) continue;
        const pts = offsetsToRange(text, at.start, at.end);
        if (!pts) continue;
        const range = document.createRange();
        range.setStart(pts.startContainer, pts.startOffset);
        range.setEnd(pts.endContainer, pts.endOffset);
        if (range.collapsed) continue;
        if (!byColor.has(r.color)) byColor.set(r.color, []);
        byColor.get(r.color).push(range);
      } catch (_) {
        // One record that can't be placed (a bad quote from somewhere else)
        // mustn't take the others' highlights with it.
      }
    }
    for (const color of COLORS) {
      const ranges = byColor.get(color);
      if (ranges?.length) {
        const highlight = new Highlight(...ranges);
        // Under the cues that come and go (the selected verse, a note's words
        // while it is hovered), which would otherwise tie with it.
        highlight.priority = -1;
        CSS.highlights.set(nameOf(color), highlight);
      } else {
        CSS.highlights.delete(nameOf(color));
      }
    }
  }

  /* ── Keeping up with the page ────────────────────────────────────── */

  store.subscribe(load);
  document.addEventListener(SETTINGS_EVENT, schedule);
  new MutationObserver(schedule).observe(textBox, { childList: true, subtree: true, characterData: true });
  load();

  return { refresh: schedule };
}
