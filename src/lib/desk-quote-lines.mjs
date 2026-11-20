// src/lib/desk-quote-lines.mjs
//
// Where a highlight's quoted words fall among the lines of its verses, so a
// row can show them broken as the chapter breaks them (a poetry line, a
// paragraph), not as one run (BVJ, 2026-11-20, E198). Pure: the caller reads the chapter's lines.

const collapse = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/**
 * Split `quote` at the line boundaries that fall inside it.
 *
 * @param {string[]} lines the verses' lines in order, each as its words
 *   (whitespace may differ from the quote's; it is collapsed on both sides)
 * @param {{ exact?: string, prefix?: string } | string} quote the highlight's
 *   quote, or just its exact words
 * @returns {string[] | null} the quote's pieces, one per line it touches, or
 *   null when the quote can't be found in the lines
 */
export function splitQuoteIntoLines(lines, quote) {
  const exact = collapse(typeof quote === "string" ? quote : quote?.exact);
  const prefix = collapse(typeof quote === "string" ? "" : quote?.prefix);
  if (!exact || !Array.isArray(lines)) return null;
  const parts = lines.map(collapse).filter(Boolean);
  if (!parts.length) return null;

  // Each line's start in the joined text (lines are joined by one space).
  const starts = [];
  let joined = "";
  for (const p of parts) {
    if (joined) joined += " ";
    starts.push(joined.length);
    joined += p;
  }

  // Every place the quote occurs; one whose preceding words end like the
  // quote's prefix wins, else the first.
  const places = [];
  for (let at = joined.indexOf(exact); at >= 0; at = joined.indexOf(exact, at + 1)) places.push(at);
  if (!places.length) return null;
  let start = places[0];
  if (prefix && places.length > 1) {
    const tail = prefix.slice(-12);
    const hit = places.find((p) => joined.slice(0, p).trimEnd().endsWith(tail));
    if (hit != null) start = hit;
  }
  const end = start + exact.length;

  const out = [];
  parts.forEach((p, i) => {
    const from = Math.max(start, starts[i]);
    const to = Math.min(end, starts[i] + p.length);
    if (to > from) out.push(joined.slice(from, to));
  });
  return out.length ? out : null;
}
