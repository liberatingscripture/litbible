// "Share image…" inside the Share flyout (E111, BVJ 2026-11-12), driven in a
// browser DOM through the real actionRows, flyoutRow and imageStep: choosing it
// keeps the flyout open and the questions replace it there, one after another;
// closing the flyout puts the button back; the flat and chip layouts carry the
// same name. Compare indexes and booleans, never two elements (a failing
// assert.equal on DOM nodes hangs out of memory).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { settle, resetDom, window } from "./helpers/browser-env.mjs";

window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} }); // reduced motion: swaps are immediate
globalThis.matchMedia = window.matchMedia;
document.fonts = { load: async () => [] };
window.Image = class {
  decode() {
    return Promise.reject(new Error("no emblem here"));
  }
};
globalThis.Image = window.Image;

// A canvas that accepts every drawing call, measures text at `measureWidth`
// per string, and "encodes" an empty PNG.
let measureWidth = 10;
const canvasProto = window.HTMLCanvasElement.prototype;
canvasProto.getContext = function getContext() {
  return new Proxy({}, { get: (t, k) => (k === "measureText" ? () => ({ width: measureWidth }) : k in t ? t[k] : () => ({ addColorStop() {} })), set: (t, k, v) => ((t[k] = v), true) });
};
canvasProto.toBlob = function toBlob(cb) {
  cb(new Blob(["png"], { type: "image/png" }));
};

const { actionRows } = await import("../src/scripts/panel-pieces.js");
const { imageStep } = await import("../src/scripts/verse-image.js");

let done;
function build({ touch = false, share = true, pointerFocus = true, text = "In the beginning was the Word." } = {}) {
  done = 0;
  const image = imageStep({ content: () => ({ text, ref: "John 1:1", url: "https://litbible.net/john-1#v1", shareText: text }), onDone: () => done++ });
  const shareBtn = share ? Object.assign(document.createElement("button"), { textContent: "Share text…" }) : null;
  const rows = actionRows({
    touch,
    copies: [["Copy text", () => true], ["Copy link", () => true], ["Copy with footnotes", () => true]],
    shareBtn,
    image,
    pointerFocus,
  });
  const panel = document.createElement("div");
  panel.append(...rows);
  document.body.append(panel);
  return { panel, rows, image, shareRow: rows[1] };
}
const labels = (el) => [...el.querySelectorAll("button")].map((b) => b.textContent);
const click = (el, detail = 1) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, detail }));
const flyout = (shareRow) => shareRow.querySelector(".lit-flyout__menu");
const trigger = (shareRow) => shareRow.querySelector(".lit-flyout__trigger");

beforeEach(() => resetDom());

test("the flyout holds Share text… and Share image…, and the Share row stays in the panel", () => {
  const { shareRow } = build();
  assert.deepEqual(labels(flyout(shareRow)), ["Share text…", "Share image…"]);
  assert.equal(trigger(shareRow).textContent, "Share");
});

test("choosing Share image… keeps the flyout open and the questions replace it in its place", async () => {
  const { shareRow, image } = build();
  click(trigger(shareRow));
  assert.equal(flyout(shareRow).hidden, false);
  click(image.querySelector("button"), 0);
  await settle();
  assert.equal(flyout(shareRow).hidden, false, "the flyout stays open");
  assert.equal(trigger(shareRow).hidden, false, "the Share row stays");
  assert.deepEqual(labels(flyout(shareRow)), ["Share text…", "Ink", "Paper"]);
  click([...image.querySelectorAll("button")][0], 0);
  await settle();
  assert.deepEqual(labels(flyout(shareRow)), ["Share text…", "Square", "Story"]);
  assert.equal(flyout(shareRow).hidden, false);
});

test("a keyboard press focuses the first question; the questions are menu items the arrows and Home/End reach", async () => {
  const { shareRow, image } = build();
  click(trigger(shareRow), 0);
  const start = image.querySelector("button");
  start.focus();
  click(start, 0);
  await settle();
  const choices = [...image.querySelectorAll("button")];
  assert.ok(document.activeElement === choices[0], "focus is on the first choice");
  assert.ok(choices.every((b) => b.getAttribute("role") === "menuitem"));
  const key = (k) => document.activeElement.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true }));
  key("ArrowDown");
  assert.ok(document.activeElement === choices[1]);
  key("Home");
  assert.equal(document.activeElement.textContent, "Share text…");
  key("End");
  assert.ok(document.activeElement === choices[1]);
});

test("a mouse press in the selection panel (pointerFocus: false) moves no focus", async () => {
  const { shareRow, image } = build({ pointerFocus: false });
  click(trigger(shareRow));
  click(image.querySelector("button"), 1);
  await settle();
  assert.equal(document.activeElement.closest(".lit-flyout") === null, true, "focus did not go into the flyout");
});

test("closing the flyout mid-question puts Share image… back", async () => {
  const { shareRow, image } = build();
  click(trigger(shareRow));
  click(image.querySelector("button"), 1);
  await settle();
  assert.deepEqual(labels(image), ["Ink", "Paper"]);
  shareRow.closeFlyout();
  assert.deepEqual(labels(flyout(shareRow)), ["Share text…", "Share image…"]);
  assert.equal(image.classList.contains("lit-image--open"), false);
  click(trigger(shareRow));
  assert.deepEqual(labels(flyout(shareRow)), ["Share text…", "Share image…"]);
});

test("the flyout holds while a swap drops focus for a beat, and while the pointer is over it", async () => {
  const { shareRow, image } = build();
  click(trigger(shareRow), 0);
  const start = image.querySelector("button");
  start.focus();
  click(start, 0);
  await settle(300);
  assert.equal(flyout(shareRow).hidden, false, "still open after the focus handoff");
  // A hover-opened flyout with the pointer resting on it does not time out.
  shareRow.closeFlyout();
  shareRow.dispatchEvent(new window.Event("pointerenter"));
  shareRow.querySelector(".lit-flyout__trigger").dispatchEvent(new window.Event("pointerenter"));
  assert.equal(flyout(shareRow).hidden, false);
  shareRow.dispatchEvent(new window.Event("focusout", { bubbles: true }));
  await settle(300);
  assert.equal(flyout(shareRow).hidden, false);
});

test("too long: the reason replaces the step, Share text… stays above it, and keyboard focus lands on it", async () => {
  const { shareRow, image } = build({ text: "word ".repeat(60).trim() });
  measureWidth = 1000; // every word fills a line, so 60 words overflow both sizes
  try {
    click(trigger(shareRow), 0);
    const start = image.querySelector("button");
    start.focus();
    click(start, 0);
    await settle();
  } finally {
    measureWidth = 10;
  }
  const note = image.querySelector(".lit-image__note");
  assert.ok(note !== null, "the reason is shown: " + image.textContent);
  assert.equal(flyout(shareRow).hidden, false, "in the flyout, which stays open");
  assert.ok(document.activeElement === note, "focus is on the reason");
  assert.deepEqual(labels(flyout(shareRow)), ["Share text…"], "Share text… is still there");
  document.activeElement.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  assert.equal(document.activeElement.textContent, "Share text…", "an arrow key leaves the reason for Share text…");
  shareRow.closeFlyout();
  assert.deepEqual(labels(flyout(shareRow)), ["Share text…", "Share image…"], "reopening starts over");
});

test("with no share sheet the row is a flat Share image… button; a finger's chip says the same", () => {
  const flat = build({ share: false });
  assert.equal(flat.rows[1].querySelector("button").textContent, "Share image…");
  assert.equal(flat.rows[1].querySelector(".lit-flyout__menu"), null);
  resetDom();
  const chips = build({ touch: true });
  assert.deepEqual(labels(chips.rows[1]), ["Share text…", "Share image…"]);
});
