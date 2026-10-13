// src/lib/desk-start.mjs
//
// How the Notebook panel starts on each page (BVJ, 2026-10-13). By default it
// starts open and minimized, and then as the reader left it: closing it is
// remembered in lit-desk-panel ("closed"), restoring it in lit-desk-min ("0").
// The reader can choose instead, on the notebook page, that every page opens
// it minimized, open or closed (lit-desk-start), whatever they did last.
//
// Layout.astro's pre-paint script repeats the `open` half, since it can't
// import; test/desk-prepaint.test.js holds the two together.

export const START_KEY = "lit-desk-start";
export const OPEN_KEY = "lit-desk-panel";
export const MIN_KEY = "lit-desk-min";

/** The reader's choices, in the order the notebook page lists them. */
export const START_CHOICES = [
  { value: "left", label: "As I left it" },
  { value: "min", label: "Minimized" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
];

/** The stored choice, "left" (the default) for anything else. */
export function startChoice(get) {
  const v = get(START_KEY);
  return v === "min" || v === "open" || v === "closed" ? v : "left";
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
