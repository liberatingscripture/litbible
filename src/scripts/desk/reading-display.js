// src/scripts/desk/reading-display.js
//
// What the Reading arrangement does to the Display tray (E8; BVJ, 2026-11-04):
// one LIT pane with nothing between the reader and the words, so choosing it
// turns off verse numbers, footnote letters, key terms, and the reader's
// highlights, the four switches that mark up the text, and choosing another
// layout turns back on the ones Reading turned off. What Reading turned off is
// remembered (a key, so a reload in between doesn't forget), and a switch the
// reader has already turned back on by hand is left alone. Choosing Reading
// again adds to what is remembered rather than replacing it (LV3-2), or a
// second press, finding the marks already off, would forget them all. Any way
// out of Reading brings them back (DK3-2; desk-page.js `leaveReading`), and
// the key is cleared then, so it is set only while Reading is on the screen.
//
// The three Display switches are the tray's own (SiteHeader.astro's SETTINGS:
// an attribute on <html>, absent for the default, mirrored to one key), set
// here the same way; highlights go through note-settings.js.

import { getSetting, highlightSetting, setSetting } from "./note-settings.js";

const KEY = "lit-desk-reading-off";

const ITEMS = [
  { id: "vn", label: "verse numbers", attr: "data-vn", key: "lit-verse-numbers" },
  { id: "fn", label: "footnote letters", attr: "data-fn", key: "lit-fn-letters" },
  { id: "terms", label: "key terms", attr: "data-terms", key: "lit-terms" },
  { id: "highlights", label: "highlights" },
];

const isOn = (item) =>
  item.id === "highlights"
    ? getSetting(highlightSetting()) === "on"
    : (document.documentElement.getAttribute(item.attr) || "on") === "on";

function set(item, value) {
  if (item.id === "highlights") {
    setSetting(highlightSetting(), value);
    return;
  }
  const root = document.documentElement;
  if (value === "on") root.removeAttribute(item.attr);
  else root.setAttribute(item.attr, value);
  try {
    if (value === "on") localStorage.removeItem(item.key);
    else localStorage.setItem(item.key, value);
  } catch (_) {}
}

function remember(ids) {
  try {
    if (ids.length) localStorage.setItem(KEY, JSON.stringify(ids));
    else localStorage.removeItem(KEY);
  } catch (_) {}
}

function rememberedIds() {
  try {
    const ids = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(ids) ? ids : [];
  } catch (_) {
    return [];
  }
}

const remembered = () => {
  const ids = rememberedIds();
  return ITEMS.filter((item) => ids.includes(item.id));
};

/** Whether Reading has marks to bring back: the one sign that leaving it should. */
export const marksRemembered = () => remembered().length > 0;

/** The result of a change: what it was, for the message, and how to take it back. */
function change(items, to, remembering) {
  const back = to === "off" ? "on" : "off";
  for (const item of items) set(item, to);
  remember(remembering);
  return {
    names: items.map((item) => item.label),
    undo() {
      for (const item of items) set(item, back);
      remember(to === "off" ? [] : items.map((item) => item.id));
    },
  };
}

/**
 * Choosing Reading: turn off whichever of the four are on, and remember them
 * with whatever an earlier press remembered (LV3-2).
 */
export function turnOffMarks() {
  const items = ITEMS.filter(isOn);
  const before = rememberedIds();
  const ids = ITEMS.filter((item) => items.includes(item) || before.includes(item.id)).map((item) => item.id);
  const result = change(items, "off", ids);
  return {
    names: result.names,
    // Undo turns back on what this press turned off, and remembers what was
    // remembered before it.
    undo() {
      result.undo();
      remember(ITEMS.filter((item) => before.includes(item.id)).map((item) => item.id));
    },
  };
}

/** Leaving Reading: turn back on what Reading turned off and is still off. */
export function turnOnMarks() {
  const items = remembered().filter((item) => !isOn(item));
  return change(items, "on", []);
}
