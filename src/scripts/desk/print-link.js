// src/scripts/desk/print-link.js
//
// A Chapter View page opened with `?print=plain|notes|room` (/desk's Print
// menu; rules in src/lib/desk-print-notes.mjs) prints itself once it has
// loaded: plainly, with the reader's notes (M6) or with room to write (N9).
// The parameter is taken out of the address first, so a reload or a copied
// link never prints again. Only the Print menu's press prints, and "Hide my
// marks" holds back the notes (SEC-4): a link posted in a chat while the reader
// shares their screen must not put their notes on it.

import { PRINT_ASK_KEY, PRINT_PARAM, parsePrintParam, printWasAsked } from "../../lib/desk-print-notes.mjs";
import { pageChapter } from "./page.js";
import { printFonts } from "./print-notes.js";

/**
 * The chapter or book on this page, printed plainly (print.css's look, in
 * Crimson Text, which the screen never loads, so wait for it as the other two
 * prints do).
 */
export async function printPlain() {
  await printFonts();
  window.print();
}

/** Whether the Print menu just asked for `href`. The mark works once. */
function takeAsk(href) {
  try {
    const stored = localStorage.getItem(PRINT_ASK_KEY);
    localStorage.removeItem(PRINT_ASK_KEY);
    return printWasAsked(stored, href, Date.now());
  } catch (_) {
    return false;
  }
}

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
  if (!kind || !takeAsk(`${url.pathname}?${PRINT_PARAM}=${kind}`)) return;

  const go = async () => {
    try {
      if (kind === "notes") {
        if (printNotes?.can()) await printNotes.print();
      } else if (kind === "room") {
        if (printRoom?.can()) await printRoom.print();
      } else {
        // A draft page has no text, so its address prints nothing.
        if (pageChapter()) await printPlain();
      }
    } catch (err) {
      console.error("Study Desk: the chapter didn't print", err);
    }
  };
  if (document.readyState === "complete") go();
  else addEventListener("load", go, { once: true });
}
