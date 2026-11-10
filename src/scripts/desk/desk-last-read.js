// src/scripts/desk/desk-last-read.js
//
// Reading in the LIT pane on /desk writes "Continue reading" (BVJ, 2026-11-10,
// Audit 8 decision 11), the same record Chapter View writes (last-read.js's
// saveLastRead, `view: "study"`), so a reader who read Romans 8 on the desk is
// offered Romans 8 on the home page, not the last chapter page they happened
// on. desk-page.js hands this the leading LIT pane's place whenever it changes,
// and it is saved once the reader has stayed 500 ms, as Chapter View's scroll
// handler does. A draft chapter is never recorded.

import { saveLastRead } from "../last-read.js";

export const LAST_READ_WAIT_MS = 500;

/**
 * @param {Record<string, number[]>} drafts the draft chapters of each book
 * @returns {{ note: (position: { book: string, chapter: number, verse: number | null } | null) => void,
 *   flush: () => void, destroy: () => void }}
 */
export function createDeskLastRead(drafts = {}) {
  let timer = 0;
  let pending = null;

  const isDraft = (p) => Array.isArray(drafts?.[p.book]) && drafts[p.book].includes(p.chapter);

  function flush() {
    window.clearTimeout(timer);
    timer = 0;
    const p = pending;
    pending = null;
    if (!p || isDraft(p)) return;
    saveLastRead({ book: p.book, chapter: p.chapter, verse: p.verse ?? null, view: "study" });
  }

  return {
    note(position) {
      if (!position || !position.book || !position.chapter) return;
      pending = position;
      window.clearTimeout(timer);
      timer = window.setTimeout(flush, LAST_READ_WAIT_MS);
    },
    flush,
    destroy() {
      window.clearTimeout(timer);
      timer = 0;
      pending = null;
    },
  };
}
