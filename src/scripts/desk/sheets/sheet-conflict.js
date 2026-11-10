// src/scripts/desk/sheets/sheet-conflict.js
//
// What the sheet editor shows when another tab, or another Sheets pane, works
// on the sheet it shows (STUDY-DESK.md, S12, part 4; BVJ, 2026-11-08): the
// question asked before opening a sheet another tab is editing, and the line
// on a part whose saved text changed while the reader was typing in it. Cut
// from sheet-editor.js (Audit 8, LG8-8), which hands in what these need from
// its closure: where to draw, its id suffix, and its `change`, `opCtx` and
// `say`. Which tabs are editing is sheet-tabs.js; the field-by-field rules
// (movedUnderReader, keptFields) are src/lib/desk-sheet-tabs.mjs.

import { keptFields } from "../../../lib/desk-sheet-tabs.mjs";
import { updateModule } from "../../../lib/desk-sheets.mjs";
import { redraw } from "../focus-keep.js";
import { buttons, describe, make } from "../dom.js";

const button = buttons("desk-sheet__btn");

/**
 * "Already open in another tab", drawn in `content` in place of the editor:
 * resolves true for Continue, false for Cancel or Escape.
 * @param {{ content: HTMLElement, idSuffix: string }} host
 * @returns {Promise<boolean>}
 */
export function askContinue({ content, idSuffix }) {
  return new Promise((resolve) => {
    const box = make("div", "desk-sheet__ask");
    const text = make("p", "desk-sheet__ask-text", "This sheet is already open in another tab. Continue here?");
    text.id = `deskSheetAsk-${idSuffix}`;
    box.setAttribute("role", "group");
    box.setAttribute("aria-labelledby", text.id);
    const go = button("Continue", "desk-sheet__btn desk-sheet__btn--primary");
    const no = button("Cancel", "desk-sheet__btn desk-sheet__btn--quiet");
    const hint = describe(go, "Changes made in either tab show in the other.");
    go.addEventListener("click", () => resolve(true));
    no.addEventListener("click", () => resolve(false));
    box.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      resolve(false);
    });
    const row = make("div", "desk-sheet__ask-row");
    row.append(go, no);
    box.append(text, row, hint);
    redraw(content, [box], { fallback: () => go, force: true });
  });
}

/**
 * The line on a part whose saved text another tab (or pane) changed while
 * the reader was typing in it: the card keeps the reader's words, and the
 * line offers the other version. Under the part's text, so the words being
 * typed don't move. A later change from there only updates which version
 * "Show that version" shows (`card.theirs`).
 *
 * `card` is the editor's { el, inst, conflict, theirs }; `from` is "pane"
 * for another Sheets pane in this tab; `label` names the part when the line
 * is announced.
 * @param {object} card
 * @param {object} m the part as the other tab saved it
 * @param {string} from
 * @param {{ idSuffix: string, label: string, change: Function, opCtx: () => object, say: (text: string) => void }} host
 */
export function showConflict(card, m, from, { idSuffix, label, change, opCtx, say }) {
  card.theirs = m;
  if (card.conflict) return;
  const id = m.id;
  const line = make("div", "desk-sheet__conflict");
  const words = make("p", "desk-sheet__conflict-text", from === "pane" ? "Changed in another Sheets pane." : "Changed in another tab.");
  words.id = `deskSheetConflict-${idSuffix}-${id}`;
  line.setAttribute("role", "group");
  line.setAttribute("aria-labelledby", words.id);
  const show = button("Show that version", "desk-sheet__btn desk-sheet__btn--quiet");
  const keep = button("Keep mine", "desk-sheet__btn desk-sheet__btn--quiet");
  const fields = () => Object.entries(card.inst?.fields ?? {});
  show.addEventListener("click", () => {
    const theirs = card.theirs;
    clearConflict(card);
    for (const [f, ed] of fields()) ed.setHtml(theirs[f] ?? "");
    // Written again, since this tab's typing may have saved over it already.
    const put = Object.fromEntries(fields().map(([f]) => [f, theirs[f] ?? ""]));
    change((s) => updateModule(s, id, put, opCtx()), { source: id, announce: "Showing the other version." });
    card.inst?.focus?.();
  });
  keep.addEventListener("click", () => {
    const theirs = card.theirs;
    clearConflict(card);
    // Only the fields whose words here differ from the other version's, so
    // one this tab never changed doesn't put older words back (SH8-2).
    const put = keptFields(Object.fromEntries(fields().map(([f, ed]) => [f, ed.take()])), theirs);
    if (Object.keys(put).length) change((s) => updateModule(s, id, put, opCtx()), { source: id, announce: "Kept your version." });
    else say("Kept your version.");
    card.inst?.focus?.();
  });
  const row = make("div", "desk-sheet__conflict-row");
  row.append(show, keep);
  line.append(words, row);
  card.conflict = line;
  const zone = card.el.querySelector(":scope > .desk-sheet__after");
  card.el.insertBefore(line, zone);
  say(`${label}: ${words.textContent.toLowerCase()} Show that version, or keep yours.`);
}

/** Take a part's line down, and forget the other version. */
export function clearConflict(card) {
  card.conflict?.remove();
  card.conflict = null;
  card.theirs = null;
}
