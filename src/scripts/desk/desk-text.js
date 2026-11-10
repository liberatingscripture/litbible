// src/scripts/desk/desk-text.js
//
// Small wording helpers the desk's modules share (Audit 8, LG8-7). Each was
// copied into several files, so a fix (a date's format, a number's commas)
// had to be made in each. Pure: no DOM, so the lightest page can import it.

/**
 * "1 item", "3 items", "1,204 words": a count and its noun. `many` defaults to
 * `one` with an s.
 */
export const plural = (n, one, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

/** "November 9, 2026" for a stored ISO date; "" for one that doesn't parse. */
export function dateWords(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
