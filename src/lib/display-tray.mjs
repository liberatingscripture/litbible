// src/lib/display-tray.mjs
//
// The Display tray ("Aa"; SITE-FEATHERBOA.md, "Display"): its settings and
// its markup, pure, so SiteHeader.astro draws it and the tests render the
// same thing in happy-dom. src/scripts/display-tray.js runs it.
//
// It keeps what changes how the page reads, in this order: Text, Size, Line
// spacing, Justify, Theme, and on a chapter's page View, then "All settings →"
// at its foot. The keyboard switch, the finer mark choices, and the Notebook's
// own settings are on /settings. Every control is the kit's: a face is a
// list row, the sizes, spacings, and themes a row of choices (each a
// role="radio" button in a role="radiogroup"), and Justify and View's
// settings switches.

import { icon } from "./icons.mjs";

/** All settings, the page the tray's foot opens (BP-19). */
export const SETTINGS_HREF = "/settings/";

/**
 * Each setting the tray sets: an attribute on <html>, absent for the
 * default, and one localStorage key, absent for the default too.
 * Layout.astro's head script stamps each before first paint; `legacy` names
 * older keys that script still reads as fallbacks, so a change removes them
 * or they could bring an older choice back (src/styles/CLAUDE.md, "The
 * Display tray").
 */
export const TRAY_SETTINGS = Object.freeze({
  font: { attr: "data-font", key: "lit-font", legacy: ["dyslexic-font"], fallback: "default" },
  size: { attr: "data-size", key: "lit-size", legacy: ["lit_rm_fontSize"], fallback: "md" },
  leading: { attr: "data-leading", key: "lit-leading", legacy: ["lit_rm_lineHeight"], fallback: "normal" },
  justify: { attr: "data-justify", key: "lit-justify", legacy: [], fallback: "off" },
  theme: { attr: "data-theme", key: "lit-theme", legacy: [], fallback: "system" },
  vn: { attr: "data-vn", key: "lit-verse-numbers", legacy: ["lit-read-numbers", "lit_rm_markers"], fallback: "on" },
  fn: { attr: "data-fn", key: "lit-fn-letters", legacy: [], fallback: "on" },
  terms: { attr: "data-terms", key: "lit-terms", legacy: [], fallback: "on" },
});

/** The three reading faces, each named in its own face (RP-25, DI-02). */
export const TRAY_FACES = Object.freeze([
  { value: "default", label: "Default" },
  { value: "atkinson", label: "Atkinson" },
  { value: "dyslexic", label: "OpenDyslexic" },
]);

/** Four sizes, drawn as dots between a small A and a large A, named for a screen reader (DI-03, DI-04). */
export const TRAY_SIZES = Object.freeze([
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
  { value: "xl", label: "Extra large" },
]);

export const TRAY_SPACINGS = Object.freeze([
  { value: "normal", label: "Normal" },
  { value: "roomy", label: "Roomy" },
]);

/** "Auto" follows the device, as "System" did (DI-07). */
export const TRAY_THEMES = Object.freeze([
  { value: "system", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
]);

/**
 * View's switches on a chapter's page (DI-08, DI-09, DI-14). With the Study
 * preview, the desk adds "Your marks" after them (note-settings.js).
 */
export const TRAY_VIEW = Object.freeze([
  { name: "vn", label: "Verse and chapter numbers" },
  { name: "fn", label: "Footnote letters" },
  { name: "terms", label: "Key terms" },
]);

// A row of choices: one stop for Tab, the arrows inside (display-tray.js).
function choices(name, labelId, items, { group = "kit-choices", item = "kit-tab", inner = (it) => it.label, named = false } = {}) {
  const buttons = items
    .map(
      (it) =>
        `<button type="button" class="${item}" role="radio" aria-checked="false" tabindex="-1" data-tray-choice="${it.value}"${named ? ` aria-label="${it.label}"` : ""}>${inner(it)}</button>`,
    )
    .join("");
  return `<div class="${group}" role="radiogroup" aria-labelledby="${labelId}" data-tray-choices="${name}">${buttons}</div>`;
}

const switchButton = (name, label) =>
  `<button type="button" class="kit-switch" role="switch" aria-checked="false" data-tray-switch="${name}">${label}</button>`;

const row = (labelId, label, body, extra = "") =>
  `<div class="font-tray__row"${extra}><p class="font-tray__legend" id="${labelId}">${label}</p>${body}</div>`;

/**
 * The tray's markup, closed. `view` draws View (a chapter's page); `justify`
 * draws Justify where the LIT's text is (a chapter's page, Study), since it
 * sets nothing else.
 *
 * @param {{ view?: boolean, justify?: boolean }} [options]
 */
export function trayHtml({ view = false, justify = false } = {}) {
  const faces = choices("font", "fontTrayText", TRAY_FACES, {
    group: "font-tray__faces",
    item: "kit-row font-tray__face",
    inner: (it) => `<span class="font-tray__face-name font-tray__face-name--${it.value}">${it.label}</span>`,
  });
  const sizes = `<div class="font-tray__size"><span class="font-tray__size-a font-tray__size-a--small" aria-hidden="true">A</span>${choices(
    "size",
    "fontTraySize",
    TRAY_SIZES,
    { group: "kit-choices font-tray__dots", item: "kit-tab font-tray__dot", inner: () => `<span class="font-tray__dot-mark" aria-hidden="true"></span>`, named: true },
  )}<span class="font-tray__size-a font-tray__size-a--large" aria-hidden="true">A</span></div>`;
  const parts = [
    `<div class="font-tray__header"><p class="font-tray__heading" id="fontTrayHeading">Display</p><button type="button" class="kit-icon font-tray__close" aria-label="Close display settings">${icon("close")}</button></div>`,
    row("fontTrayText", "Text", faces),
    row("fontTraySize", "Size", sizes),
    row("fontTrayLeading", "Line spacing", choices("leading", "fontTrayLeading", TRAY_SPACINGS)),
    // Directly under Line spacing, since it is about how the lines sit (RP-36).
    justify ? `<div class="font-tray__row font-tray__row--switch">${switchButton("justify", "Justify")}</div>` : "",
    row("fontTrayTheme", "Theme", choices("theme", "fontTrayTheme", TRAY_THEMES)),
    view
      ? row(
          "fontTrayView",
          "View",
          `<div class="font-tray__switches" data-tray-view>${TRAY_VIEW.map((s) => switchButton(s.name, s.label)).join("")}</div>`,
          ` role="group" aria-labelledby="fontTrayView"`,
        )
      : "",
    `<div class="font-tray__foot"><a class="kit-btn kit-btn--plain font-tray__all" href="${SETTINGS_HREF}">All settings →</a></div>`,
  ];
  return `<div class="font-tray" id="fontTray" hidden role="dialog" aria-labelledby="fontTrayHeading">${parts.join("")}</div>`;
}
