// src/lib/desk-start.mjs
//
// How the Notebook panel starts on each page (BVJ, 2026-10-13). By default it
// starts open and minimized, and then as the reader left it: closing it is
// remembered in lit-desk-panel ("closed"), restoring it in lit-desk-min ("0").
// The reader can choose instead, on /settings (and on the notebook page until
// Phase 10 moves it), that every page opens it minimized, open or closed
// (lit-desk-start), whatever they did last.
//
// The Display tray's "Show the Notebook" left the tray in Featherboa's
// Phase 4 (DI-16): the place line's Notebook button opens and folds the
// panel, so a stored "off" (lit-desk-show) is read as shown, and
// desk/note-settings.js removes it.
//
// Layout.astro's pre-paint script repeats the `open` half, since it can't
// import; test/desk-prepaint.test.js holds the two together.

export const START_KEY = "lit-desk-start";
export const OPEN_KEY = "lit-desk-panel";
export const MIN_KEY = "lit-desk-min";

/**
 * The reader's choices, in the order All settings lists them (NB-25: "Open,
 * Minimized, or As I left it"). "Closed" is the fourth stored value from
 * before the Notebook lost its Close (BVJ, 2026-10-29): still honored, and
 * offered only to a reader who chose it (`shownStartChoices`).
 */
export const START_CHOICES = [
  { value: "open", label: "Open" },
  { value: "min", label: "Minimized" },
  { value: "left", label: "As I left it" },
  { value: "closed", label: "Closed" },
];

/** The stored choice, "left" (the default) for anything else. */
export function startChoice(get) {
  const v = get(START_KEY);
  return v === "min" || v === "open" || v === "closed" ? v : "left";
}

/**
 * The choices to offer a reader whose stored choice is `current`: the
 * record's three, and "Closed" too while it is theirs, so no reader loses a
 * setting and no one new is offered a start the Notebook has no way out of.
 */
export function shownStartChoices(current) {
  return START_CHOICES.filter((c) => c.value !== "closed" || current === "closed");
}

/**
 * Whether the panel starts open, and minimized, on this page.
 * `get` reads localStorage (a key → string | null function).
 */
export function startState(get) {
  const choice = startChoice(get);
  if (choice === "closed") return { open: false, minimized: true };
  if (choice === "min") return { open: true, minimized: true };
  if (choice === "open") return { open: true, minimized: false };
  return { open: get(OPEN_KEY) !== "closed", minimized: get(MIN_KEY) !== "0" };
}
