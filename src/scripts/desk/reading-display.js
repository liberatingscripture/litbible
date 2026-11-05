// src/scripts/desk/reading-display.js
//
// What the Reading arrangement does to the Display tray (E8; BVJ, 2026-11-04):
// one LIT pane with nothing between the reader and the words, so it turns off
// verse numbers, footnote letters, key terms, and the reader's highlights, the
// four switches that mark up the text. It is a one-time change made when
// Reading is chosen, never a mode: the reader can turn any of them back on
// from the tray, and choosing another arrangement leaves them as they are.
//
// The three Display switches are the tray's own (SiteHeader.astro's SETTINGS:
// an attribute on <html>, absent for the default, mirrored to one key), set
// here the same way; highlights go through note-settings.js.

import { getSetting, highlightSetting, setSetting } from "./note-settings.js";

const TRAY = [
  { label: "verse numbers", attr: "data-vn", key: "lit-verse-numbers" },
  { label: "footnote letters", attr: "data-fn", key: "lit-fn-letters" },
  { label: "key terms", attr: "data-terms", key: "lit-terms" },
];

const trayValue = (attr) => document.documentElement.getAttribute(attr) || "on";

function setTray({ attr, key }, value) {
  const root = document.documentElement;
  if (value === "on") root.removeAttribute(attr);
  else root.setAttribute(attr, value);
  try {
    if (value === "on") localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (_) {}
}

/**
 * Turn off whichever of the four are on. Returns the names of what was turned
 * off, for the message, and `undo`, which turns exactly those back on.
 */
export function turnOffMarks() {
  const trayOff = TRAY.filter((t) => trayValue(t.attr) === "on");
  const lights = highlightSetting();
  const lightsOff = getSetting(lights) === "on";
  for (const t of trayOff) setTray(t, "off");
  if (lightsOff) setSetting(lights, "off");
  return {
    names: [...trayOff.map((t) => t.label), ...(lightsOff ? ["highlights"] : [])],
    undo() {
      for (const t of trayOff) setTray(t, "on");
      if (lightsOff) setSetting(lights, "on");
    },
  };
}
