// The Greek search builder's composition flag, driven (Audit 8, GK8-6): a
// compositionstart whose compositionend never came (an input method that was
// cancelled, a box left mid-word) must not leave the builder frozen. An input
// event outside a composition, and leaving the box, clear the flag.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { settle, resetDom } from "./helpers/browser-env.mjs";

const publicRoot = new URL("../public/", import.meta.url);
globalThis.fetch = async (url) => {
  const path = String(url).replace(/^https?:\/\/[^/]+/, "").replace(/^\//, "").split("?")[0];
  const file = new URL(path, publicRoot);
  if (!existsSync(file)) return { ok: false, status: 404, json: async () => ({}) };
  const text = readFileSync(file, "utf8");
  return { ok: true, status: 200, json: async () => JSON.parse(text) };
};

const { createGreekBuilder } = await import("../src/scripts/greek-builder.js");

function build() {
  resetDom();
  const field = document.body.appendChild(document.createElement("input"));
  const spoken = [];
  const builder = createGreekBuilder({
    put: (text) => {
      field.value = text;
      return true;
    },
    announce: (s) => spoken.push(s),
  });
  document.body.append(builder.el);
  builder.follow(field);
  return { builder, field, word: builder.el.querySelector('[data-key="w0"]') };
}

const compose = (el, type, init = {}) => el.dispatchEvent(new Event(type, { bubbles: true, ...init }));
function inputEvent(el, value, isComposing) {
  el.value = value;
  const e = new Event("input", { bubbles: true });
  Object.defineProperty(e, "isComposing", { value: isComposing });
  el.dispatchEvent(e);
}
/** What the builder drew for the card: its html after the word's lookup had time to land. */
const drawn = (builder) => builder.el.innerHTML;

test("GK8-6: while composing, typing redraws nothing; compositionend draws", async () => {
  const { builder, word } = build();
  const before = drawn(builder);
  compose(word, "compositionstart");
  inputEvent(word, "θε", true);
  await settle(30);
  assert.equal(drawn(builder), before, "nothing redrawn mid-composition");
  compose(word, "compositionend");
  await settle(30);
  assert.ok(builder.el.querySelector('[data-key="w0"]'));
});

test("GK8-6: an input outside a composition clears a flag left set, so the builder redraws", async () => {
  const stuck = build();
  compose(stuck.word, "compositionstart"); // compositionend never comes
  inputEvent(stuck.word, "θεός", false);
  await settle(300);
  const control = build();
  inputEvent(control.word, "θεός", false);
  await settle(300);
  assert.equal(drawn(stuck.builder), drawn(control.builder), "a stuck flag leaves no difference once an ordinary input arrives");
  assert.equal(stuck.field.value, control.field.value);
});

test("GK8-6: leaving the box clears a flag left set", async () => {
  const stuck = build();
  compose(stuck.word, "compositionstart");
  stuck.word.dispatchEvent(new Event("blur"));
  stuck.word.value = "θεός";
  stuck.word.dispatchEvent(new Event("change", { bubbles: true }));
  // A redraw triggered from elsewhere (the field changing under the builder) now goes through.
  stuck.field.value = "θεός.nom";
  stuck.field.dispatchEvent(new Event("input", { bubbles: true }));
  await settle(300);
  const control = build();
  control.field.value = "θεός.nom";
  control.field.dispatchEvent(new Event("input", { bubbles: true }));
  await settle(300);
  assert.equal(drawn(stuck.builder), drawn(control.builder));
});
