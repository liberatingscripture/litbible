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

// A bookmark that moves as the reader reads follows only while the reader reads
// on in its book (STUDY-DESK.md C25). The shell loads only on a reading
// surface, so every other page (home, search, /notebook, /desk) pauses the
// tab's flag here (BA101; it ended the follow until 2026-11-04). The key
// is FOLLOW_FLAG_KEY in src/lib/desk-bookmarks.mjs, which this file doesn't
// import, to stay small. (Telling a duplicated tab from its original is the
// shell's, bookmark-follow.js: a page here never moves a bookmark.)
if (!shellHere) {
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
