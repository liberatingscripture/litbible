// src/scripts/desk/dom.js
//
// The small DOM helpers the desk's modules share (Audit 2, LG-13). Each was
// copied into a dozen files, so a fix had to be made in every one. Only the
// copies that were identical are here; `announce` and `say` look alike but
// differ in what they do, so they stay where they are.

/**
 * An element with a class and text. `text` is set with textContent, so it is
 * never read as markup; null or undefined sets none.
 */
export function make(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** `make` under the name some modules use. */
export const el = make;

/**
 * Text made safe to put in element text or in a double-quoted attribute. It
 * leaves `'` alone, so never use it inside a single-quoted attribute.
 */
export function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
