// src/scripts/desk-gate.js
//
// The Study Desk's gate (STUDY-DESK.md, phase 1b). Layout.astro's pre-paint
// script sets <html data-desk="on"> only on a computer and only where the
// preview is switched on (?desk=on). Everywhere else this is the whole of
// the desk a reader downloads: the shell is a dynamic import, which Vite
// splits into chunks of its own.

if (document.documentElement.dataset.desk === "on") {
  import("./desk/shell.js").catch((err) => {
    console.error("Study Desk: the shell didn't load", err);
  });
}
