// src/scripts/desk/note-words.js
//
// How a note's body is drawn wherever the notebook shows it (N4, "your own
// chains"): the reader's words with any scripture reference in them turned
// into a link, which ref-preview.js previews on hover or tap. The work is
// src/lib/desk-chains.mjs (it escapes the body first and only then links, so
// nothing the reader typed can become markup); this is the one place the
// drawing code goes through, so every surface links the same way.
//
// Two things the callers need:
//   - A link inside a row that is itself a button or link would be nested
//     interactive content. The rows therefore stretch their own control over
//     the row with a pseudo-element (`.desk-stretch` in desk.css) and lift
//     the body's links above it, rather than wrapping the words in the
//     control. `onLink` is the click guard for rows that still listen on the
//     row: a click on a link in a note is the link's, never the row's.
//   - Search snippets, inputs and accessible names stay plain text; they
//     don't come through here.

import { noteBodyHtml } from "../../lib/desk-chains.mjs";

/**
 * Draw a note's body into `el`: linked where it cites scripture, plain
 * `fallback` text where there is no body (a marker with no words).
 */
export function fillNoteWords(el, body, fallback = "") {
  if (typeof body === "string" && body) {
    el.innerHTML = noteBodyHtml(body);
    el.classList.add("desk-chain-text");
  } else {
    el.textContent = fallback;
  }
  return el;
}

/** Whether a click landed on a link in a note's words (which is the link's to handle). */
export function onLink(e) {
  return e.target instanceof Element && Boolean(e.target.closest("a"));
}
