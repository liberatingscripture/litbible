// src/lib/desk-marks.mjs
//
// "Your marks" (SITE-FEATHERBOA.md, "Display"; DI-11, DI-13, DI-18): one
// switch for everything of the reader's drawn on the text, which H flips,
// with its finer choices on All settings (/settings). It merged the four
// switches the Display tray and the Notebook panel had ("Notes in the
// margin," "My bookmarks," "My highlights," and "Hide my marks") without a
// key of its own, so no reader lost a setting:
//   - the finer choices are the settings they were, each "on" or "off" under
//     its own key: notes in the margin (lit-desk-notes), bookmarks
//     (lit-desk-bookmarks), and highlights (lit-desk-highlights), with Read
//     View's own highlights (lit-desk-read-highlights, off by default), which
//     no page offers since Read View retired but which the hide still keeps
//     and puts back with the rest (queue Q88);
//   - the switch is on while any of them is on, as "Hide my marks" was
//     unchecked, so a reader with highlights off and notes on finds the
//     switch on and highlights still off;
//   - turning it off is "Hide my marks" (M1) as it was: it remembers what
//     showed (lit-desk-hide; the first hide's memory wins, NB8-6), turns all
//     of them off, and turning it on puts them back, or the defaults where
//     what it remembered would show nothing. H does the same.
// Pure: note-settings.js applies it to the page and to localStorage, and
// test/desk-marks.test.js runs it over every combination.

/** The settings the switch stands for, each with its key and its default. */
export const MARK_SETTINGS = Object.freeze({
  notes: Object.freeze({ key: "lit-desk-notes", fallback: "on" }),
  bookmarks: Object.freeze({ key: "lit-desk-bookmarks", fallback: "on" }),
  highlights: Object.freeze({ key: "lit-desk-highlights", fallback: "on" }),
  readHighlights: Object.freeze({ key: "lit-desk-read-highlights", fallback: "off" }),
});

/** Where turning the switch off keeps what showed, as JSON ({ notes: "on", … }). */
export const HIDE_KEY = "lit-desk-hide";

/** The finer choices All settings offers, in its order (DI-13). */
export const FINER_MARKS = Object.freeze(["notes", "bookmarks", "highlights"]);

const NAMES = Object.freeze(Object.keys(MARK_SETTINGS));

const onOff = (value) => (value === "on" ? "on" : "off");

/**
 * Whether "Your marks" is on, given each setting's value ("on" or "off"):
 * while any of them is on.
 */
export function marksOn(values) {
  return NAMES.some((name) => values[name] === "on");
}

/**
 * Turning the switch off: the record to keep for the way back, and what each
 * setting becomes (off). `before` is a record an earlier hide kept, whose
 * "on" wins over a setting turned off since (NB8-6: hiding again, after
 * turning one back on, must not make the way back bring that one alone).
 * @param {Record<string, string>} values
 * @param {Record<string, string> | null} [before]
 */
export function hideMarks(values, before = null) {
  const saved = Object.fromEntries(NAMES.map((name) => [name, before?.[name] === "on" ? "on" : onOff(values[name])]));
  return { saved, values: Object.fromEntries(NAMES.map((name) => [name, "off"])) };
}

/**
 * Turning it on: what each setting becomes, from the record the hide kept
 * (null when there is none). A record that would show nothing brings the
 * defaults back, so turning the switch on always shows something.
 * @param {Record<string, string> | null} saved
 */
export function showMarks(saved) {
  const back = (name) => (saved?.[name] === "on" || saved?.[name] === "off" ? saved[name] : MARK_SETTINGS[name].fallback);
  const nothing = NAMES.every((name) => back(name) === "off");
  return Object.fromEntries(NAMES.map((name) => [name, nothing ? MARK_SETTINGS[name].fallback : back(name)]));
}

/** The record lit-desk-hide holds: an object, or null when it holds none or can't be read. */
export function readHidden(text) {
  try {
    const value = JSON.parse(text || "null");
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}
