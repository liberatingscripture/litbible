// src/scripts/desk-gate.js
//
// The Study Desk's gate (STUDY-DESK.md, phase 1b). Layout.astro's pre-paint
// script sets <html data-desk="on"> only on a computer and only where the
// preview is switched on (?desk=on). The desk loads only there, and only on a
// page with a reading column for its panel to sit beside (desk-frame.js).
// Everywhere else this is the whole of the desk a reader downloads: the shell
// is a dynamic import, which Vite splits into chunks of its own.

import { readingSurface } from "./desk-frame.js";

/**
 * A passage the reader hid (STUDY-DESK.md, N8) is hidden in the first moments
 * of the page, before the desk has loaded and read the notebook. hidden.js
 * keeps a list of where each one sits in localStorage ({ "john-3": [[3, 5]] },
 * never a note to self); this blurs those verses at once, inline, since the
 * desk's stylesheet isn't here yet. hidden.js takes the marks over when it
 * has read the notebook, and removes any that no longer belong. It can't
 * import desk code (only the gate's own `data-desk` check may run for a
 * reader), so the key and the marks are repeated there.
 */
function hideEarly() {
  try {
    const raw = localStorage.getItem("lit-desk-hidden-cache");
    if (!raw) return;
    const cache = JSON.parse(raw);
    const mark = (selector, ranges) => {
      for (const [from, to] of ranges) {
        for (let v = from; v <= Math.min(to, from + 400); v++) {
          for (const el of document.querySelectorAll(`${selector} [data-verse="${v}"]`)) {
            el.setAttribute("data-desk-hidden", "");
            el.setAttribute("aria-hidden", "true");
            el.setAttribute("inert", "");
            el.style.filter = "blur(0.4em)";
            el.style.userSelect = "none";
          }
        }
      }
    };
    const article = document.querySelector("article.chapter[data-last-read-book]");
    if (article && document.querySelector(".chapter-paragraphs")) {
      const ranges = cache[`${article.dataset.lastReadBook}-${article.dataset.lastReadChapter}`];
      if (ranges) mark(".chapter-paragraphs", ranges);
      return;
    }
    const book = document.querySelector("[data-rm-root]")?.dataset.rmBook;
    if (!book) return;
    for (const key of Object.keys(cache)) {
      const chapter = key.startsWith(`${book}-`) ? key.slice(book.length + 1) : "";
      if (/^\d+$/.test(chapter)) mark(`[data-rm-text] .rm-block[data-chapter="${chapter}"]`, cache[key]);
    }
  } catch (_) {
    /* no storage, or a list that isn't ours: the desk hides what it finds */
  }
}

if (document.documentElement.dataset.desk === "on" && readingSurface()) {
  hideEarly();
  import("./desk/shell.js").catch((err) => {
    console.error("Study Desk: the shell didn't load", err);
  });
}
