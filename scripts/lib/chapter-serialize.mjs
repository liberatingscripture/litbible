/**
 * chapter-serialize.mjs
 *
 * The canonical on-disk form of a chapter JSON file — 2-space indented, but
 * with each footnote object written on ONE line:
 *
 *   "footnotes": [
 *     { "id": "fn-a", "refId": "fnref-a", "label": "a", "html": "…" },
 *     { "id": "fn-b", "refId": "fnref-b", "label": "b", "html": "…" }
 *   ]
 *
 * Why one line per footnote, rather than plain JSON.stringify(data, null, 2):
 *
 *  1. It is what the corpus already is. 133 of the 206 footnote-bearing chapters
 *     were written this way by hand; only 50 are fully expanded and 23 are mixed.
 *     `--fix` emitting the expanded form meant the normalizer disagreed with the
 *     majority of the files it was pointed at, so running it rewrote 169 of 260
 *     chapters and added ~19,000 lines of pure formatting churn. That is a trap
 *     for anyone who runs a documented command mid-task.
 *
 *  2. One line per footnote makes a footnote edit a ONE-LINE diff. That matters
 *     beyond tidiness: footnotes are reviewed by eye, and a letter cascade from
 *     an inserted note reads as a block of shifted lines rather than as hundreds
 *     of re-indented fragments.
 *
 * Everything else is ordinary JSON.stringify output, so key order is whatever
 * the object carries — this function normalizes layout, never content.
 */

/** @param {Record<string, unknown>} fn */
function serializeFootnote(fn) {
  const body = Object.entries(fn)
    .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    .join(", ");
  return body ? `{ ${body} }` : "{}";
}

/**
 * Serialize a parsed chapter object to its canonical file text, including the
 * trailing newline.
 *
 * @param {{ footnotes?: unknown[] }} data
 * @returns {string}
 */
export function serializeChapter(data) {
  const notes = Array.isArray(data?.footnotes) ? data.footnotes : null;

  // No footnotes array, or an empty one, needs no special handling — plain
  // stringify already emits `"footnotes": []` on a single line.
  if (!notes || notes.length === 0) {
    return `${JSON.stringify(data, null, 2)}\n`;
  }

  // Stringify with each footnote standing in as a placeholder string, so the
  // surrounding indentation comes from JSON.stringify rather than from hand-built
  // padding, then swap each placeholder for its one-line form. The token is
  // delimited by NUL, which chapter prose (HTML) cannot contain, so a placeholder
  // can never match real content.
  const NUL = String.fromCharCode(0);
  const token = (i) => `${NUL}chapter-footnote-${i}${NUL}`;
  const shell = { ...data, footnotes: notes.map((_, i) => token(i)) };

  let out = JSON.stringify(shell, null, 2);
  notes.forEach((fn, i) => {
    const placeholder = JSON.stringify(token(i));
    if (!out.includes(placeholder)) {
      throw new Error(`chapter serialization lost footnote ${i}`);
    }
    // Function replacement: footnote text is data and must never be interpreted
    // as a $-pattern.
    out = out.replace(placeholder, () => serializeFootnote(fn));
  });

  return `${out}\n`;
}
