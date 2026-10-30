// src/scripts/desk/print-link.js
//
// A Study View page opened with `?print=plain|notes|room` (/desk's Print
// menu; rules in src/lib/desk-print-notes.mjs) prints itself once it has
// loaded: plainly, with the reader's notes (M6) or with room to write (N9).
// The parameter is taken out of the address first, so a reload or a copied
// link never prints again.

import { PRINT_PARAM, parsePrintParam } from "../../lib/desk-print-notes.mjs";
import { printFonts } from "./print-notes.js";

/**
 * @param {{ printNotes: { can(): boolean, print(): Promise<void> } | null,
 *   printRoom: { can(): boolean, print(): Promise<void> } | null }} prints
 */
export function initPrintLink({ printNotes, printRoom }) {
  const url = new URL(location.href);
  if (!url.searchParams.has(PRINT_PARAM)) return;
  const kind = parsePrintParam(url.searchParams.get(PRINT_PARAM));
  url.searchParams.delete(PRINT_PARAM);
  history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
  if (!kind) return;

  const go = async () => {
    try {
      if (kind === "notes") {
        if (printNotes?.can()) await printNotes.print();
      } else if (kind === "room") {
        if (printRoom?.can()) await printRoom.print();
      } else {
        // Plain printing is print.css's, in Crimson Text, which the screen
        // never loads, so wait for it as the other two prints do.
        await printFonts();
        window.print();
      }
    } catch (err) {
      console.error("Study Desk: the chapter didn't print", err);
    }
  };
  if (document.readyState === "complete") go();
  else addEventListener("load", go, { once: true });
}
