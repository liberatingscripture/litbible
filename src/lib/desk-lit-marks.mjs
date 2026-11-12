// src/lib/desk-lit-marks.mjs
//
// What marks up the text in a LIT pane on /desk, each of which the pane's
// "Show" turns on or off (STUDY-DESK-FIXES.md, E108): verse numbers (and with
// them the chapter headings, since chapters run together there, E29),
// footnote letters, key terms, and the reader's highlights.
//
// **Each LIT pane keeps its own** (BVJ, 2026-11-12: "Different LIT panes open
// at the same time should be able to have different settings active
// simultaneously"). A pane's record in the layout lists the marks it hides
// (`hide`, ids in this table's order; absent while it shows everything), so
// the list is kept with the layout and travels with the pane through every
// change to it (desk-layout.mjs, which also has Reading turn them off and
// back on). Chapter View's switches, in its Display tray, are the chapter
// pages' own and never set a pane.
//
// Pure: the table, and the list a layout keeps.

/**
 * `label` is the switch's name in a pane's "Show" menu; `name` is how a
 * sentence lists it ("Turned off verse numbers and key terms.").
 */
export const LIT_MARKS = [
  { id: "vn", label: "Verse and chapter numbers", name: "verse numbers" },
  { id: "fn", label: "Footnote letters", name: "footnote letters" },
  { id: "terms", label: "Key terms", name: "key terms" },
  { id: "highlights", label: "My highlights", name: "highlights" },
];

export const MARK_IDS = LIT_MARKS.map((mark) => mark.id);

/**
 * A list of mark ids, checked: the ones this table has, each once, in its
 * order. Anything else (a stored value of another shape, an id from a later
 * version) gives what is left, down to none.
 */
export function markList(value) {
  return Array.isArray(value) ? MARK_IDS.filter((id) => value.includes(id)) : [];
}

/** The marks' names for a sentence, in the table's order. */
export function markNames(ids) {
  return LIT_MARKS.filter((mark) => ids.includes(mark.id)).map((mark) => mark.name);
}
