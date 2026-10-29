// src/scripts/desk/lit-records.js
//
// The reader's records for the chapters /desk's LIT panes show (3g), kept up
// to date for whatever draws on them: highlights (highlights.js) and the verse
// numbers' names (verse-labels.js). It is Study View's "this chapter's
// records" for a page whose panes hold many chapters, two panes sometimes the
// same one (page.js, deskChapterBoxes).
//
// `onChange(entries)` is called, at most once a frame, whenever the notebook
// changes, a pane adds or drops a chapter, or a chapter's text is re-wrapped
// (the term lens wraps every key term after load, which leaves an earlier
// Range pointing at nodes that are gone). Each entry is { box, bookKey,
// chapter, records }, the records live ones (forChapter), read from the
// notebook once per chapter however many panes show it.

import { forChapter } from "../../lib/desk-store-core.mjs";
import { DESK_TEXTS_EVENT, deskChapterBoxes, deskTextsListed } from "./page.js";

/**
 * @param {{ store: object, onChange: (entries: Array<{ box: Element,
 *   bookKey: string, chapter: number, records: object[] }>) => void }} options
 * @returns {{ refresh(): void }}
 */
export function watchLitRecords({ store, onChange }) {
  const byKey = new Map(); // "john 3" → { gen, records }, once read
  const reading = new Set(); // "gen|john 3" for each read under way
  let generation = 0; // bumped when the notebook changes

  const keyOf = (c) => `${c.bookKey} ${c.chapter}`;

  function read(c) {
    const key = keyOf(c);
    const gen = generation;
    if (reading.has(`${gen}|${key}`)) return;
    reading.add(`${gen}|${key}`);
    store
      .byChapter(c.bookKey, c.chapter)
      .then((found) => {
        // A read the notebook has moved past since is dropped; a newer one
        // is under way.
        if (gen !== generation) return;
        byKey.set(key, { gen, records: forChapter(found, c.bookKey, c.chapter) });
        schedule();
      })
      .catch(() => {})
      .finally(() => reading.delete(`${gen}|${key}`));
  }

  let frame = 0;
  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(emit);
  }

  // A chapter whose records are being read again after a change keeps
  // showing the ones it had until the new ones come, so nothing flickers.
  function emit() {
    const entries = [];
    for (const c of deskChapterBoxes()) {
      const had = byKey.get(keyOf(c));
      if (had?.gen !== generation) read(c);
      if (had) entries.push({ ...c, records: had.records });
    }
    onChange(entries);
  }

  // Each pane's text is watched for chapters coming and going and for a
  // chapter's words being re-wrapped. Attributes aren't watched, so setting a
  // verse number's name never sets this off again. The texts are the desk's
  // list, not those on the page: a new pane is built off the page, and its
  // chapters arrive after. A pane closed or switched to another kind is taken
  // off the list and let go here, or its text and every chapter it loaded
  // would stay in memory for the visit (BA123); an observer can't drop one
  // target, so it starts over on the texts there are.
  const observer = new MutationObserver(schedule);
  let watched = new Set();
  function watchTexts() {
    const now = new Set(deskTextsListed());
    const gone = [...watched].some((c) => !now.has(c));
    if (gone) {
      observer.disconnect();
      watched = new Set();
    }
    for (const c of now) {
      if (watched.has(c)) continue;
      watched.add(c);
      observer.observe(c, { childList: true, subtree: true, characterData: true });
    }
    schedule();
  }

  store.subscribe(() => {
    generation++;
    schedule();
  });
  document.addEventListener(DESK_TEXTS_EVENT, watchTexts);
  watchTexts();

  return { refresh: schedule };
}
