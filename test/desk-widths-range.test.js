// The text's line keeps to 45 to 75 characters a line in the reader's face
// (Featherboa, "Sizes, space, and the measure"; SZ-17, DI-24), driven in a
// browser DOM: what the line says it is to a screen reader, where its menu's
// steps stop, and how far an arrow key moves it. The rules themselves
// (measureRange and the drags) are test/desk-margin.test.js's; the pre-paint
// script's hold on a kept measure is test/desk-prepaint.test.js's.

import { test } from "node:test";
import assert from "node:assert/strict";
import { window } from "./helpers/browser-env.mjs";

const { createWidths } = await import("../src/scripts/desk/widths.js");
const { lineLimit } = await import("../src/scripts/desk/line-menu.js");
const { measureChars } = await import("../src/lib/desk-margin.mjs");

// The page: a 1800px window, the column from x 300, the Notebook from x 1400.
// happy-dom lays nothing out, so one --ch is widths.js's fallback, 10px.
document.body.innerHTML = `
  <main id="main">
    <div class="scripture-main" style="padding-left: 16px; padding-right: 16px"><p>In the beginning</p></div>
  </main>
  <div class="desk-panel" id="panel"></div>`;
const root = document.documentElement;
Object.defineProperty(root, "clientWidth", { configurable: true, get: () => 1800 });
const column = document.querySelector(".scripture-main");
const panel = document.getElementById("panel");
const box = (left, top, width, height) => () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top });
column.getBoundingClientRect = box(300, 100, 600, 1900);
panel.getBoundingClientRect = box(1400, 100, 384, 800);

const widths = createWidths({ column, panel, onChange: () => {} });
const text = document.querySelector(".desk-gutter--text");
const book = document.querySelector(".desk-gutter--book");
const place = () => widths.placeHandles({ top: 100, height: 1900, column: column.getBoundingClientRect(), panelLeft: 1400 });

function face(name) {
  sessionStorage.clear();
  if (name) root.setAttribute("data-font", name);
  else root.removeAttribute("data-font");
  place();
}
const values = (line) => ["aria-valuemin", "aria-valuenow", "aria-valuemax"].map((a) => line.getAttribute(a));
const key = (line, k) => line.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
const kept = () => sessionStorage.getItem("lit-desk-measure");

test("the text's line reads in the face's characters, from 45 to 75, at the 48 a chapter opens with", () => {
  face("");
  assert.deepEqual(values(text), ["45", "57", "75"]);
  assert.equal(text.getAttribute("aria-valuetext"), "Text 57 characters wide");

  face("atkinson");
  assert.deepEqual(values(text), ["45", "70", "75"]);
  assert.equal(text.getAttribute("aria-valuetext"), "Text 70 characters wide");

  // OpenDyslexic's 48 is 33 of its characters, so its narrowest is that 48.
  face("dyslexic");
  assert.deepEqual(values(text), ["33", "33", "75"]);
  assert.equal(lineLimit({ now: 33, min: 33, max: 75 }), "min", "Narrower text is unavailable there");
  face("");
});

test("an arrow key moves the text a character of the face, and stops at the range's ends", () => {
  face("");
  key(text, "ArrowLeft");
  assert.equal(kept(), "48.8", "a character wider: 0.84 of a --ch in Source Sans 3");
  assert.equal(Math.round(measureChars(Number(kept()))), 58);

  face("dyslexic");
  key(text, "ArrowLeft");
  assert.equal(kept(), "49.5", "1.47 of a --ch in OpenDyslexic");
  face("dyslexic");
  key(text, "ArrowRight");
  assert.equal(kept(), "48", "no narrower than the 48 it opens with");

  face("atkinson");
  key(text, "End");
  assert.equal(kept(), "30.8", "End narrows it as far as it goes: 45 characters");
  face("atkinson");
  key(text, "Home");
  assert.equal(kept(), "51.3", "Home widens it to 75");
  face("");
});

test("a measure kept in another face is read, and placed, as this face's nearest", () => {
  face("");
  sessionStorage.setItem("lit-desk-measure", "60");
  sessionStorage.setItem("lit-desk-width", "384");
  root.setAttribute("data-font", "atkinson");
  place();
  assert.equal(widths.layout().measure, 51.3);
  assert.deepEqual(values(text), ["45", "75", "75"]);
  assert.equal(sessionStorage.getItem("lit-desk-measure"), "60", "what the reader kept is left alone");
  root.removeAttribute("data-font");
  place();
  assert.equal(widths.layout().measure, 60, "and comes back in its own face");
  face("");
});

test("the Notebook's line counts its pixels, and can give the text only what the range lets it take", () => {
  face("");
  // 384px now; at the text's narrowest it would have (48 - 37.8) x 10 more.
  assert.deepEqual(values(book), ["280", "384", "486"]);
  face("dyslexic");
  assert.deepEqual(values(book), ["280", "384", "384"], "OpenDyslexic's text can't narrow past 48");
  face("");
});
