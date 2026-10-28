// src/scripts/desk/print-room.js
//
// "Print with room to write" (STUDY-DESK.md, N9): a Study View chapter, or the
// book Read View shows, printed with the text in a narrower column and a ruled
// margin beside it, like a journaling Bible. It is "Print with my notes"'s
// blank sibling (print-notes.js, M6): no notes, no highlights, nothing read
// from the notebook, so it works even where the browser keeps none.
//
// All of it is a variant of print.css. This file only stamps
// `data-desk-print="room"` on <html>, waits for the fonts the printed page
// uses, asks the browser to print, and takes the attribute away again on
// `afterprint`. The look is the end of desk.css, under @media print. It writes
// nothing and stores nothing, and plain printing (Ctrl+P) never has the
// attribute, so it is untouched. print-look.js does the stamping and the
// taking away, for both prints.

import { printFonts, surface } from "./print-notes.js";
import { printLook } from "./print-look.js";

/**
 * @returns {{ can(): boolean, print(): Promise<void> }}
 */
export function createPrintRoom() {
  /** Whether this page can print with room to write: a Study View chapter, or Read View. */
  const can = () => Boolean(surface()?.container);

  async function print() {
    if (!can()) return;
    await printLook("room", { ready: () => printFonts(), what: "printing with room to write" });
  }

  return { can, print };
}
