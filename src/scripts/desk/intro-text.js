// src/scripts/desk/intro-text.js
//
// The pure parts of the Book Intro pane (intro-pane.js, E53): the introduction's
// text as the pane shows it, and the rule for when a reference the reader
// follows keeps the pane on its book. They sit apart from intro-pane.js because
// that file reads `import.meta.env` and the site's base path when it loads, which
// Node tests can't; this file imports only dom.js, so a test can run it
// (Audit 3, LG3-9, item d). Behavior is unchanged by the move.

import { make } from "./dom.js";

/**
 * The introduction's text as the pane shows it: a copy, its headings one level
 * under the pane's own (the pane's name is an h2, the introduction's title an
 * h3), no ids, and every link opening a new tab except where the pane takes a
 * plain click itself. The copy is made from `body`, which is left as it was,
 * so the cached page text can be shown again.
 */
export function introText(body) {
  const box = make("div", "desk-intro__text");
  for (const node of body.childNodes) box.append(document.importNode(node, true));
  for (const h of box.querySelectorAll("h2, h3, h4")) {
    const level = Math.min(6, Number(h.tagName[1]) + 2);
    const to = document.createElement(`h${level}`);
    to.className = "desk-intro__heading";
    to.append(...h.childNodes);
    h.replaceWith(to);
  }
  for (const el of box.querySelectorAll("[id]")) el.removeAttribute("id");
  for (const a of box.querySelectorAll("a[href]")) {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  }
  return box;
}

/**
 * Whether a passage that moved the LIT pane leaves the pane on its book: it does
 * when a reference sent the LIT to the book the pane holds (`held`), so reading
 * Galatians 2:11 from Romans's introduction doesn't swap the introduction.
 */
export function keepsBook(held, bookKey) {
  return Boolean(held) && bookKey === held;
}

/**
 * What the pane holds after a plain click on a reference: the book the reference
 * sent the LIT to, or null when that is the pane's own book (nothing to keep).
 */
export function heldAfterReference(book, referencedBook) {
  return referencedBook === book ? null : referencedBook;
}
