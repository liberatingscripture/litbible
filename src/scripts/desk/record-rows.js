// src/scripts/desk/record-rows.js
//
// One row of the notebook page's lists (notebook-page.js): the record's
// reference, linked to its verse, its kind, its words, its labels as small
// chips, and its buttons: Edit (notes), Labels… and Delete (Unpin for a pinned
// footnote). The same facts the panel's My Notes tab shows (tab-mine.js), set
// out for a page rather than a narrow column, so the words are in full.
//
// Everything a reader wrote goes on the page as text, never as HTML (a note's
// body is escaped and its scripture references linked, note-words.js). The
// build-up is deliberately plain: the page decides what happens when a button
// is pressed (`actions`), this only draws.

import { COLORS, canEdit, onFootnote } from "../../lib/desk-records.mjs";
import { labelsOf } from "../../lib/desk-labels.mjs";
import { shortQuote } from "../../lib/desk-notes.mjs";
import { kindName, recordHref, recordReference, recordWhere } from "../../lib/desk-store-core.mjs";
import { glyph } from "./glyphs.js";
import { fillNoteWords } from "./note-words.js";

/** A highlight's colour if the format knows it; null for anything else, which is shown plainly. */
const colorOf = (r) => (r?.kind === "highlight" && COLORS.includes(r.color) ? r.color : null);

/** What a reader calls a record's kind: "Yellow highlight", or the plain kind name. */
export function nameOf(r) {
  const color = colorOf(r);
  return color ? `${color[0].toUpperCase()}${color.slice(1)} highlight` : kindName(r.kind);
}

/** A highlight's words wearing its colour, as the page and the panel show them. */
function highlightedWords(color, words) {
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

const button = (className, text, label, onClick) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = className;
  b.textContent = text;
  b.setAttribute("aria-label", label);
  b.addEventListener("click", () => onClick(b));
  return b;
};

/**
 * @param {object} record
 * @param {{ labels: Map<string, object>,
 *   onEdit?: (record: object, trigger: Element) => void,
 *   onLabels: (record: object, trigger: Element) => void,
 *   onDelete: (record: object, li: Element) => void }} actions
 * @returns {HTMLLIElement}
 */
export function recordRow(record, { labels, onEdit = null, onLabels, onDelete }) {
  const r = record;
  const li = document.createElement("li");
  li.className = "desk-item desk-np-row";
  li.dataset.id = r.id;
  const ref = recordReference(r);
  const href = recordHref(r);
  // A note on a footnote (M11) is "on a footnote in Romans 8:3", not on the verse.
  const where = recordWhere(r);
  const subject = `${nameOf(r).toLowerCase()}${where ? ` on ${where}` : ""}`;

  const head = document.createElement(href ? "a" : "span");
  head.className = "desk-item__ref";
  head.textContent = ref || kindName(r.kind);
  if (href) head.href = href;
  const kind = document.createElement("span");
  kind.className = "desk-item__kind";
  kind.textContent = nameOf(r);
  li.append(head, kind);
  // It says what it is on, and quotes the footnote's opening words.
  if (onFootnote(r)) {
    const line = document.createElement("p");
    line.className = "desk-item__on-fn";
    line.textContent = `On a footnote: “${shortQuote(r.footnote, 12)}”`;
    li.append(line);
  }

  // The reader's words. Always text.
  if (r.kind === "note") {
    const words = document.createElement("p");
    words.className = "desk-item__words desk-np-row__note";
    words.innerHTML = glyph(r.marker, "desk-glyph desk-item__glyph");
    const text = document.createElement("span");
    text.className = "desk-np-row__text";
    fillNoteWords(text, r.body, "(the marker only)");
    words.append(text);
    li.append(words);
    if (r.quote?.exact) li.append(quoteLine(r.quote.exact));
  } else if (r.kind === "highlight") {
    const quote = r.quote?.exact;
    if (quote) {
      const words = document.createElement("p");
      words.className = "desk-item__highlight desk-np-row__highlight";
      words.append(highlightedWords(colorOf(r), quote));
      li.append(words);
    }
  } else if (r.kind === "footnotePin") {
    const words = document.createElement("p");
    words.className = "desk-item__words desk-item__pin-text desk-np-row__pin";
    words.textContent = r.footnote ?? "";
    li.append(words);
  } else {
    const text = r.label ?? r.name ?? r.body ?? r.note ?? r.title ?? r.quote?.exact;
    if (typeof text === "string" && text) {
      const words = document.createElement("p");
      words.className = "desk-item__words";
      words.textContent = text;
      li.append(words);
    }
  }

  const chips = labelsOf(r, labels);
  if (chips.length) {
    const ul = document.createElement("ul");
    ul.className = "desk-chips";
    ul.setAttribute("aria-label", "Labels");
    for (const l of chips) {
      const chip = document.createElement("li");
      chip.className = "desk-chip";
      chip.textContent = l.name;
      ul.append(chip);
    }
    li.append(ul);
  }

  const buttons = document.createElement("div");
  buttons.className = "desk-np-row__buttons";
  if (r.kind === "note" && onEdit && canEdit(r)) {
    buttons.append(button("desk-item__edit", "Edit", `Edit ${subject}`, (b) => onEdit(r, b)));
  }
  if (canEdit(r)) {
    buttons.append(button("desk-item__edit desk-item__labels", "Labels…", `Labels for ${subject}`, (b) => onLabels(r, b)));
  }
  buttons.append(
    button(
      "desk-item__delete",
      r.kind === "footnotePin" ? "Unpin" : "Delete",
      `${r.kind === "footnotePin" ? "Unpin" : "Delete"} ${subject}`,
      () => onDelete(r, li),
    ),
  );
  li.append(buttons);
  return li;
}

function quoteLine(exact) {
  const q = document.createElement("blockquote");
  q.className = "desk-np-row__quote";
  q.textContent = exact;
  return q;
}
