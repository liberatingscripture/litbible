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
// attribute, so it is untouched.

import { printFonts, surface } from "./print-notes.js";

const ATTR = "data-desk-print";

/**
 * @returns {{ can(): boolean, print(): Promise<void> }}
 */
export function createPrintRoom() {
  let finish = null; // what takes the attribute away, while a print is under way

  /** Whether this page can print with room to write: a Study View chapter, or Read View. */
  const can = () => Boolean(surface()?.container);

  async function print() {
    if (finish || !can()) return;
    const root = document.documentElement;
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      window.removeEventListener("afterprint", end);
      root.removeAttribute(ATTR);
      finish = null;
    };
    finish = end; // set first, so a second press while fonts load does nothing
    try {
      window.addEventListener("afterprint", end);
      root.setAttribute(ATTR, "room");
      await printFonts();
      window.print();
    } catch (err) {
      console.error("Study Desk: printing with room to write didn't start", err);
      end();
    }
  }

  return { can, print };
}
