// src/scripts/desk/reading-display.js
//
// What the Reading arrangement does to the Display tray (E8; BVJ, 2026-11-04):
// one LIT pane with nothing between the reader and the words, so choosing it
// turns off verse numbers, footnote letters, key terms, and the reader's
// highlights, the four switches that mark up the text, and choosing another
// layout turns back on the ones Reading turned off. What Reading turned off is
// remembered (a key, so a reload in between doesn't forget), and a switch the
// reader has already turned back on by hand is left alone.
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

function remembered() {
  try {
    const ids = JSON.parse(localStorage.getItem(KEY) || "[]");
    return ITEMS.filter((item) => ids.includes(item.id));
  } catch (_) {
    return [];
  }
}

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

/** Choosing Reading: turn off whichever of the four are on. */
export function turnOffMarks() {
  const items = ITEMS.filter(isOn);
  return change(items, "off", items.map((item) => item.id));
}

/** Leaving Reading: turn back on what Reading turned off and is still off. */
export function turnOnMarks() {
  const items = remembered().filter((item) => !isOn(item));
  return change(items, "on", []);
}
