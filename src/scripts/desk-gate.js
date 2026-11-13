// src/scripts/desk-gate.js
//
// The Study Desk's gate (STUDY-DESK.md, phase 1b). Layout.astro's pre-paint
// script sets <html data-desk="on"> only on a computer and only where the
// preview is switched on (?desk=on). The desk loads only there, and only on a
// page with the Notebook panel (desk-frame.js: Chapter View and Read View) or
// on one of the desk's own pages; the glossary takes its headings' fit alone.
// Everywhere else this is the whole of the desk a reader downloads: the desk
// is a dynamic import, which Vite splits into chunks of its own.

import { readingSurface, standDown } from "./desk-frame.js";

const shellHere = document.documentElement.dataset.desk === "on" && readingSurface();
// /desk (the desk as a page) follows the reader itself, through its leading LIT
// pane (STUDY-DESK-FIXES.md E28; BVJ, 2026-11-06).
const deskPageHere = document.documentElement.dataset.desk === "on" && document.querySelector("[data-desk-page]") != null;

// A bookmark that moves as the reader reads follows only while the reader reads
// on in its book (STUDY-DESK.md C25). The shell loads only on a reading
// surface, so every other page (home, search, /notebook, and since E124 book
// introductions, articles and the glossary) pauses the tab's
// flag here (BA101; it ended the follow until 2026-11-04). /desk is the
// exception: its leading LIT pane is reading, and desk-page.js runs the same
// follower the shell does (E28). The key
// is FOLLOW_FLAG_KEY in src/lib/desk-bookmarks.mjs, which this file doesn't
// import, to stay small. (Telling a duplicated tab from its original is the
// shell's, bookmark-follow.js: a page here never moves a bookmark.)
if (!shellHere && !deskPageHere) {
  try {
    const raw = window.sessionStorage.getItem("lit-desk-follow");
    const flag = raw ? JSON.parse(raw) : null;
    if (flag && flag.paused !== true) {
      // Paused rather than ended (BVJ, 2026-11-04): the next chapter the reader
      // reads decides whether it moves, and a bar offers to bring it along.
      window.sessionStorage.setItem("lit-desk-follow", JSON.stringify({ ...flag, paused: true, since: Date.now(), told: false }));
    }
  } catch {
    /* no session storage: no bookmark was following */
  }
}

/**
 * Load the desk's first stage and start it (`start()` on the module). If it
 * doesn't load (offline, or an old page after a deploy) or throws as it
 * starts, `stand` puts the page back to what it is without the desk, rather
 * than keeping the narrowed column and Notebook buttons that do nothing
 * (BA29). The first stage and the shell do the same for stage two.
 * @param {() => Promise<{ start: () => unknown }>} importer
 * @returns {Promise<void>}
 */
export function loadShell(importer, stand = standDown) {
  return Promise.resolve()
    .then(importer)
    .then((m) => m.start())
    .then(
      () => {},
      (err) => {
        console.error("Study Desk: the desk didn't load", err);
        stand();
      },
    );
}

if (shellHere) {
  // On a reading page the desk comes in two stages (Audit 3, LG3-2): the
  // Notebook's tab and a look at the notebook first, and the shell
  // (desk/shell.js) when there is something to draw or the reader asks.
  loadShell(() => import("./desk/first-stage.js"));
} else if (document.documentElement.dataset.desk === "on" && document.querySelector("[data-notebook-page]")) {
  // The notebook page (/notebook/) is not a reading surface: it has no panel
  // and its own module opens the notebook.
  import("./desk/notebook-page.js").catch((err) => {
    console.error("Study Desk: the notebook page didn't load", err);
    standDown(); // its "Loading" line gives way to the note again (BA153)
  });
} else if (document.documentElement.dataset.desk === "on" && document.querySelector("[data-desk-page]")) {
  // The desk as a page of its own (/desk/, D9): panes rather than a panel.
  import("./desk/desk-page.js").catch((err) => {
    console.error("Study Desk: the desk page didn't load", err);
    standDown(); // its "Loading" line gives way to the note again (BA153)
  });
} else if (document.documentElement.dataset.desk === "on" && document.querySelector("[data-sheet-page]")) {
  // A sheet's own address (/sheets/, 3i): shown, printed and copied, never edited.
  // The desk's styles are a download of their own there (LG8-10), asked for
  // here too so it runs beside the page's; sheet-page.js handles a failure.
  import("./desk/boot.js").catch(() => {});
  import("./desk/sheets/sheet-page.js").catch((err) => {
    console.error("Study Desk: the sheet page didn't load", err);
    standDown(); // its "Loading" line gives way to the note again (BA153)
  });
} else if (document.documentElement.dataset.desk === "on" && document.querySelector(".glossary-entries")) {
  // The glossary keeps its reading column with the desk on (pages/glossary.css)
  // but has no Notebook panel while N11 is off (E124), so of the desk it takes
  // only the headings' fit, which the first stage brings where it runs.
  // Unfitted headings still read, so a failure is only logged.
  import("./desk/glossary-titles.js")
    .then((m) => m.fitGlossaryTitles())
    .catch((err) => console.error("Study Desk: the glossary's headings didn't fit", err));
}
