// src/scripts/desk-gate.js
//
// The Study Desk's gate (STUDY-DESK.md, phase 1b). Layout.astro's pre-paint
// script sets <html data-desk="on"> only on a computer and only where the
// preview is switched on (?desk=on). The desk loads only there, and only on a
// page with a reading column for its panel to sit beside (desk-frame.js).
// Everywhere else this is the whole of the desk a reader downloads: the shell
// is a dynamic import, which Vite splits into chunks of its own.

import { readingSurface, standDown } from "./desk-frame.js";

const shellHere = document.documentElement.dataset.desk === "on" && readingSurface();

// A ribbon follows the reader only while every page the tab lands on is in
// its book (STUDY-DESK.md C25). The shell drops the tab's flag on a page
// outside the book, but the shell loads only on a reading surface, so every
// other page (home, search, /notebook, /desk) drops it here (BA101). The key
// is RIBBON_FLAG_KEY in src/lib/desk-places.mjs, which this file doesn't
// import, to stay small.
if (!shellHere) {
  try {
    window.sessionStorage.removeItem("lit-desk-ribbon");
  } catch {
    /* no session storage: no ribbon was following */
  }
}

if (shellHere) {
  // Didn't load (offline, or an old page after a deploy): the page goes back
  // to what it is without the desk, rather than keeping the narrowed column
  // and Notebook buttons that do nothing (BA29). The shell does the same if
  // the Notebook fails to start.
  import("./desk/shell.js").catch((err) => {
    console.error("Study Desk: the shell didn't load", err);
    standDown();
  });
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
  import("./desk/sheet-page.js").catch((err) => {
    console.error("Study Desk: the sheet page didn't load", err);
    standDown(); // its "Loading" line gives way to the note again (BA153)
  });
}
