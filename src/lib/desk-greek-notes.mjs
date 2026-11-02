// src/lib/desk-greek-notes.mjs
//
// Whether a Greek search lists the reader's matching notes (E11, BVJ
// 2026-10-28). Since BA40 a Greek search under "All types" lists them ahead of
// the Greek, in the search tray and on /search; this is the reader's switch for
// that, a checkbox labeled "My notes" beside the Greek search's other controls.
//
// On by default, so nothing is stored until the reader turns it off:
// localStorage['lit-desk-greek-notes'] is "off" or absent. Pure: `get` is a
// key -> string | null function, so the tests need no browser. The reading and
// writing of localStorage are src/scripts/desk/notebook-search.js's, which both
// search surfaces already load lazily, so the key lives here and nowhere else.
// English searches are not governed by it, and neither is the desk's Search
// pane, which lists no notes for a Greek search.

export const GREEK_NOTES_KEY = "lit-desk-greek-notes";

/** Whether Greek searches list the reader's notes. Anything but "off" is on. */
export function greekNotesOn(get) {
  return get(GREEK_NOTES_KEY) !== "off";
}

/** The value to store for a choice, or null to remove the key (back to the default). */
export function greekNotesStored(on) {
  return on ? null : "off";
}
