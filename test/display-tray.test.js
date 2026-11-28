// The Display tray (SITE-FEATHERBOA.md, "Display"; DI-01 to DI-09, DI-11 to
// DI-15): its markup, drawn by src/lib/display-tray.mjs, and its behavior,
// src/scripts/display-tray.js, driven in happy-dom. Elements are never
// compared with assert.equal (a failing comparison of two happy-dom nodes
// hangs): an index, a string, or a boolean is.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { settle } from "./helpers/browser-env.mjs";

const { SETTINGS_HREF, TRAY_SETTINGS, trayHtml } = await import("../src/lib/display-tray.mjs");
const { initDisplayTray, setTraySetting, traySetting } = await import("../src/scripts/display-tray.js");

const root = document.documentElement;

/** The tray's markup as elements, outside any page. */
function trayOf(options) {
  const box = document.createElement("div");
  box.innerHTML = trayHtml(options);
  return box.firstElementChild;
}

const legends = (tray) => Array.from(tray.querySelectorAll(".font-tray__legend"), (p) => p.textContent);
const words = (els) => Array.from(els, (el) => el.getAttribute("aria-label") || el.textContent.trim());

test("the tray's rows, in order: Text, Size, Line spacing, Justify, Theme, View, then All settings (DI-01 to DI-09)", () => {
  const tray = trayOf({ view: true, justify: true });
  assert.equal(tray.id, "fontTray");
  assert.equal(tray.getAttribute("role"), "dialog");
  assert.ok(tray.hidden);
  assert.equal(tray.querySelector("#fontTrayHeading").textContent, "Display");
  assert.deepEqual(legends(tray), ["Text", "Size", "Line spacing", "Theme", "View"]);
  // Justify directly under Line spacing (RP-36): the row after it.
  const rows = Array.from(tray.querySelectorAll(".font-tray__row"));
  const justifyAt = rows.findIndex((r) => r.querySelector('[data-tray-switch="justify"]'));
  const spacingAt = rows.findIndex((r) => r.querySelector('[data-tray-choices="leading"]'));
  assert.equal(justifyAt, spacingAt + 1);
  assert.equal(tray.querySelector('[data-tray-switch="justify"]').textContent, "Justify");
  // The faces, each named in its own face (RP-25).
  assert.deepEqual(words(tray.querySelectorAll('[data-tray-choices="font"] [role="radio"]')), ["Default", "Atkinson", "OpenDyslexic"]);
  for (const face of ["default", "atkinson", "dyslexic"]) {
    assert.ok(tray.querySelector(`[data-tray-choice="${face}"] .font-tray__face-name--${face}`), face);
  }
  // Four dots between a small A and a large A, named for a screen reader.
  const size = tray.querySelector(".font-tray__size");
  assert.equal(size.firstElementChild.className, "font-tray__size-a font-tray__size-a--small");
  assert.equal(size.lastElementChild.className, "font-tray__size-a font-tray__size-a--large");
  assert.equal(size.firstElementChild.getAttribute("aria-hidden"), "true");
  assert.deepEqual(words(tray.querySelectorAll('[data-tray-choices="size"] [role="radio"]')), ["Small", "Medium", "Large", "Extra large"]);
  assert.equal(tray.querySelectorAll('[data-tray-choices="size"] .font-tray__dot-mark').length, 4);
  assert.deepEqual(words(tray.querySelectorAll('[data-tray-choices="leading"] [role="radio"]')), ["Normal", "Roomy"]);
  assert.deepEqual(words(tray.querySelectorAll('[data-tray-choices="theme"] [role="radio"]')), ["Auto", "Light", "Dark"]);
  // View, not Show (DI-08); the desk adds "Your marks" after these.
  assert.deepEqual(words(tray.querySelectorAll("[data-tray-view] [role='switch']")), ["Verse and chapter numbers", "Footnote letters", "Key terms"]);
  // All settings at the foot (BP-19).
  const all = tray.querySelector(".font-tray__foot a");
  assert.equal(all.getAttribute("href"), SETTINGS_HREF);
  assert.equal(SETTINGS_HREF, "/settings/");
  assert.equal(all.textContent, "All settings →");
  assert.ok(tray.lastElementChild.classList.contains("font-tray__foot"));
});

test("what left the tray is gone from it: Reset widths, Show the Notebook, the lettering, Keyboard (DI-16, DI-25)", () => {
  const html = trayHtml({ view: true, justify: true });
  for (const gone of ["Reset widths", "Show the Notebook", "lettering", "Keyboard", "Show</", "My "]) {
    assert.ok(!html.includes(gone), gone);
  }
});

test("View is a chapter's page's, and Justify is where the LIT's text is", () => {
  const plain = trayOf({});
  assert.deepEqual(legends(plain), ["Text", "Size", "Line spacing", "Theme"]);
  assert.equal(plain.querySelector('[data-tray-switch="justify"]'), null);
  assert.equal(plain.querySelector("[data-tray-view]"), null);
  const study = trayOf({ justify: true });
  assert.ok(study.querySelector('[data-tray-switch="justify"]'));
  assert.equal(study.querySelector("[data-tray-view]"), null);
  // The header passes the two from its props.
  const header = readFileSync(new URL("../src/components/SiteHeader.astro", import.meta.url), "utf8");
  assert.match(header, /trayHtml\(\{ view: scriptureControls === "study", justify: Boolean\(scriptureControls \|\| deskTitle\) \}\)/);
  assert.match(header, /<Fragment set:html=\{tray\} \/>/);
});

test("every control is the kit's: rows, choices, switches, an icon alone, and a plain link (CT-10, CT-11, KT-11)", () => {
  const tray = trayOf({ view: true, justify: true });
  for (const b of tray.querySelectorAll("button")) {
    const kit = ["kit-row", "kit-tab", "kit-switch", "kit-icon"].filter((c) => b.classList.contains(c));
    assert.equal(kit.length, 1, b.outerHTML);
    assert.equal(b.getAttribute("type"), "button");
  }
  for (const r of tray.querySelectorAll('[role="radio"]')) {
    assert.ok(r.closest('[role="radiogroup"]').getAttribute("aria-labelledby"));
    assert.equal(r.getAttribute("aria-checked"), "false");
  }
  for (const s of tray.querySelectorAll('[role="switch"]')) assert.ok(s.classList.contains("kit-switch"));
  const close = tray.querySelector(".font-tray__close");
  assert.ok(close.classList.contains("kit-icon"));
  assert.equal(close.getAttribute("aria-label"), "Close display settings");
  assert.ok(close.querySelector('svg[data-icon="close"]'));
  assert.ok(tray.querySelector(".font-tray__all").classList.contains("kit-btn--plain"));
  // Every radio group names a setting the tray knows, and so does every switch.
  for (const g of tray.querySelectorAll("[data-tray-choices]")) assert.ok(g.dataset.trayChoices in TRAY_SETTINGS);
  for (const s of tray.querySelectorAll("[data-tray-switch]")) assert.ok(s.dataset.traySwitch in TRAY_SETTINGS);
});

test("each setting is the attribute and key the head's script stamps before first paint", () => {
  const layout = readFileSync(new URL("../src/layouts/Layout.astro", import.meta.url), "utf8");
  for (const [name, { attr, key, legacy }] of Object.entries(TRAY_SETTINGS)) {
    if (name === "theme") assert.match(layout, /lit-theme/);
    else assert.ok(layout.includes(key), `${key} is not read before first paint`);
    for (const old of legacy) assert.ok(layout.includes(old), `${old}, a fallback, is not read before first paint`);
    assert.ok(layout.includes(attr) || layout.includes(attr.replace(/^data-/, "")), attr);
  }
  // Read View's numbers stay the numbers' fallbacks (queue Q89).
  assert.deepEqual(TRAY_SETTINGS.vn.legacy, ["lit-read-numbers", "lit_rm_markers"]);
});

// ---------- Behavior ----------

document.body.innerHTML = `
  <header>
    <button type="button" data-font-toggle aria-expanded="false" aria-controls="fontTray">Aa</button>
    ${trayHtml({ view: true, justify: true })}
  </header>
  <main><div class="chapter-paragraphs"><p>In the beginning was the Word.</p></div></main>`;
localStorage.clear();
// A reader's settings from before, stamped as the head's script would.
root.setAttribute("data-size", "lg");
root.setAttribute("data-vn", "off");
localStorage.setItem("lit-size", "lg");
localStorage.setItem("lit-read-numbers", "off");
localStorage.setItem("lit_rm_markers", "off");
initDisplayTray();
const tray = document.getElementById("fontTray");
const toggle = document.querySelector("[data-font-toggle]");
const radios = (name) => Array.from(tray.querySelectorAll(`[data-tray-choices="${name}"] [role="radio"]`));
const checkedOf = (name) => radios(name).findIndex((r) => r.getAttribute("aria-checked") === "true");
const stops = (name) => radios(name).filter((r) => r.tabIndex === 0).length;
const key = (el, k) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));

test("the tray moves to <body>, opens from Aa, and shows what the page has", async () => {
  assert.equal(tray.parentElement.tagName, "BODY");
  toggle.click();
  assert.equal(tray.hidden, false);
  assert.equal(toggle.getAttribute("aria-expanded"), "true");
  await settle();
  assert.ok(document.activeElement === tray.querySelector(".font-tray__close"), "focus goes to the close button");
  assert.equal(checkedOf("size"), 2); // Large
  assert.equal(checkedOf("font"), 0); // Default
  assert.equal(checkedOf("leading"), 0);
  assert.equal(checkedOf("theme"), 0); // Auto
  for (const name of ["size", "font", "leading", "theme"]) assert.equal(stops(name), 1, `${name}: one stop for Tab`);
  assert.equal(radios("size")[2].tabIndex, 0);
  const sw = (n) => tray.querySelector(`[data-tray-switch="${n}"]`).getAttribute("aria-checked");
  assert.equal(sw("vn"), "false");
  assert.equal(sw("fn"), "true");
  assert.equal(sw("terms"), "true");
  assert.equal(sw("justify"), "false"); // off by default (RP-36)
});

test("the arrows, Home, and End move through a row and choose as they go", () => {
  const sizes = radios("size");
  sizes[2].focus();
  key(sizes[2], "ArrowRight");
  assert.equal(root.getAttribute("data-size"), "xl");
  assert.equal(localStorage.getItem("lit-size"), "xl");
  assert.equal(checkedOf("size"), 3);
  assert.ok(document.activeElement === sizes[3]);
  // Past the end it wraps, as a radio group does.
  key(sizes[3], "ArrowDown");
  assert.equal(checkedOf("size"), 0);
  assert.equal(root.getAttribute("data-size"), "sm");
  key(sizes[0], "ArrowLeft");
  assert.equal(checkedOf("size"), 3);
  key(sizes[3], "Home");
  assert.equal(checkedOf("size"), 0);
  key(sizes[0], "End");
  assert.equal(checkedOf("size"), 3);
  // Medium is the default: no attribute and no key.
  key(sizes[3], "ArrowUp");
  key(sizes[2], "ArrowUp");
  assert.equal(checkedOf("size"), 1);
  assert.equal(root.hasAttribute("data-size"), false);
  assert.equal(localStorage.getItem("lit-size"), null);
  assert.equal(stops("size"), 1);
  // Held with Ctrl, an arrow is the browser's.
  const before = checkedOf("size");
  key(radios("size")[1], "ArrowRight");
  assert.equal(checkedOf("size"), before + 1);
  radios("size")[2].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", ctrlKey: true, bubbles: true }));
  assert.equal(checkedOf("size"), before + 1);
  radios("size")[1].click();
  assert.equal(checkedOf("size"), 1);
});

test("a face is chosen by a press, and the retired key goes with any change", () => {
  localStorage.setItem("dyslexic-font", "true");
  radios("font")[2].click();
  assert.equal(root.getAttribute("data-font"), "dyslexic");
  assert.equal(localStorage.getItem("lit-font"), "dyslexic");
  assert.equal(localStorage.getItem("dyslexic-font"), null);
  radios("font")[1].click();
  assert.equal(traySetting("font"), "atkinson");
  radios("font")[0].click();
  assert.equal(root.hasAttribute("data-font"), false);
  assert.equal(localStorage.getItem("lit-font"), null);
});

test("Theme sets the attribute and the color scheme, and Auto clears both", () => {
  radios("theme")[2].click();
  assert.equal(root.getAttribute("data-theme"), "dark");
  assert.equal(root.style.colorScheme, "dark");
  assert.equal(localStorage.getItem("lit-theme"), "dark");
  radios("theme")[0].click();
  assert.equal(root.hasAttribute("data-theme"), false);
  assert.equal(root.style.colorScheme, "");
  assert.equal(localStorage.getItem("lit-theme"), null);
});

test("a switch flips its setting; the numbers' switch clears Read View's fallbacks", () => {
  const vn = tray.querySelector('[data-tray-switch="vn"]');
  vn.click();
  assert.equal(vn.getAttribute("aria-checked"), "true");
  assert.equal(root.hasAttribute("data-vn"), false);
  assert.equal(localStorage.getItem("lit-verse-numbers"), null);
  assert.equal(localStorage.getItem("lit-read-numbers"), null);
  assert.equal(localStorage.getItem("lit_rm_markers"), null);
  vn.click();
  assert.equal(root.getAttribute("data-vn"), "off");
  assert.equal(localStorage.getItem("lit-verse-numbers"), "off");
  vn.click();
  const justify = tray.querySelector('[data-tray-switch="justify"]');
  justify.click();
  assert.equal(root.getAttribute("data-justify"), "on");
  assert.equal(localStorage.getItem("lit-justify"), "on");
  justify.click();
  assert.equal(root.hasAttribute("data-justify"), false);
  assert.equal(localStorage.getItem("lit-justify"), null);
  setTraySetting("terms", "off");
  assert.equal(root.getAttribute("data-terms"), "off");
  setTraySetting("terms", "on");
  assert.equal(root.hasAttribute("data-terms"), false);
});

test("Escape closes the tray and gives focus back to Aa; so does its close button", async () => {
  assert.equal(tray.hidden, false);
  key(radios("leading")[0], "Escape");
  assert.equal(tray.hidden, true);
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.ok(document.activeElement === toggle);
  toggle.click();
  await settle();
  tray.querySelector(".font-tray__close").click();
  assert.equal(tray.hidden, true);
  assert.ok(document.activeElement === toggle);
  // A press elsewhere closes it too, leaving focus where the press put it.
  toggle.click();
  document.body.click();
  assert.equal(tray.hidden, true);
});

test("the reader's scroll closes the tray, but not the page's own when a chapter comes in above (read-on.js)", async () => {
  toggle.click();
  await settle();
  assert.equal(tray.hidden, false);
  // read-on.js says a chapter came, then holds the line with a scroll; in a
  // browser that scroll's event follows within the frame.
  document.dispatchEvent(new CustomEvent("lit:read-on", { detail: { type: "loaded", book: "john", chapter: 2 } }));
  window.dispatchEvent(new Event("scroll"));
  assert.equal(tray.hidden, false, "the line's hold isn't the reader's scroll");
  await settle();
  await settle();
  window.dispatchEvent(new Event("scroll"));
  assert.equal(tray.hidden, true, "the reader's own scroll closes it");
  // A chapter's place, the other kind of report, is no reason to stay open.
  toggle.click();
  await settle();
  document.dispatchEvent(new CustomEvent("lit:read-on", { detail: { type: "place", book: "john", chapter: 3 } }));
  window.dispatchEvent(new Event("scroll"));
  assert.equal(tray.hidden, true);
});

test("keyboard shortcuts stand down inside the tray's dialog and radio groups", () => {
  const src = readFileSync(new URL("../src/scripts/keyboard-shortcuts.js", import.meta.url), "utf8");
  assert.match(src, /"\[role='dialog'\]"/);
  assert.match(src, /"\[role='radiogroup'\]"/);
});
