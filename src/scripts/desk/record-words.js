// src/scripts/desk/record-words.js
//
// How a record's kind and a highlight's words are shown, shared by the
// panel's My Notes tab (tab-mine.js) and the notebook page's rows
// (record-rows.js) so the two never drift (Audit 8, LG8-7).

import { COLORS } from "../../lib/desk-records.mjs";
import { kindName } from "../../lib/desk-store-core.mjs";

/** A highlight's color if the format knows it; null for anything else, which is shown plainly. */
export const colorOf = (r) => (r?.kind === "highlight" && COLORS.includes(r.color) ? r.color : null);

/** What a reader calls a record's kind: "Yellow highlight", or the plain kind name. */
export function nameOf(r) {
  const color = colorOf(r);
  return color ? `${color[0].toUpperCase()}${color.slice(1)} highlight` : kindName(r.kind);
}

/**
 * A highlight's words wearing its color: a swatch wrapped round a sample,
 * which desk.css tints (a tint only, the desk file's rule 7). A color the
 * format doesn't know gets plain text.
 */
export function highlightedWords(color, words) {
  if (!color) return document.createTextNode(words);
  const swatch = document.createElement("span");
  swatch.className = "desk-swatch";
  swatch.dataset.color = color;
  const sample = document.createElement("span");
  sample.className = "desk-swatch__sample";
  sample.textContent = words;
  swatch.append(sample);
  return swatch;
}
