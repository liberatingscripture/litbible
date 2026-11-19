// The Greek search builder's word box in a real DOM (E162): a command clicked
// in the commands list while a box has focus goes into that box, and a comma
// typed there moves the typing on to the next word's box.

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
  const builder = createGreekBuilder({
    put: (text) => {
      field.value = text;
      return true;
    },
    announce: () => {},
  });
  document.body.append(builder.el);
  builder.follow(field);
  return { builder, field, box: (i) => builder.el.querySelector(`[data-key="w${i}"]`) };
}

function type(el, value) {
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

test("E162: a command goes into the word box that has focus", async () => {
  const { builder, field, box } = build();
  box(0).focus();
  type(box(0), "πίστις");
  box(0).setSelectionRange(6, 6);
  assert.equal(builder.insertHere(".gen"), true);
  assert.equal(box(0).value, "πίστις.gen");
  assert.equal(field.value, "πίστις.gen");
  await settle(30);
  assert.equal(builder.el.querySelector('[data-key="c0.case.genitive"]')?.getAttribute("aria-pressed"), "true");
});

test("E162: with no box focused, a command is left to the field", () => {
  const { builder, field } = build();
  field.focus();
  assert.equal(builder.insertHere(".gen"), false);
  assert.equal(field.value, "");
});

test("E162: a comma clicked or typed in a box moves the typing to the next word's box", async () => {
  const { builder, field, box } = build();
  box(0).focus();
  type(box(0), "πίστις");
  box(0).setSelectionRange(6, 6);
  builder.insertHere(", ");
  assert.equal(field.value, "πίστις", "an empty card writes nothing yet");
  assert.ok(box(1), "a second card");
  assert.equal(document.activeElement, box(1), "the typing has moved on");
  assert.equal(box(0).value, "πίστις");
  type(box(1), "ἀγάπη > ἐλπ");
  assert.equal(field.value, "πίστις > ἀγάπη > ἐλπ");
  assert.equal(document.activeElement, box(2));
  assert.equal(box(2).value, "ἐλπ");
});

test("E162: leaving a box tidies it to the notation, or keeps what didn't read with a note", async () => {
  const { builder, box } = build();
  box(0).focus();
  type(box(0), "πίστις genitive");
  box(0).blur();
  assert.equal(box(0).value, "πίστις.gen");
  box(0).focus();
  type(box(0), "πίστις.gen.dat");
  box(0).blur();
  assert.equal(box(0).value, "πίστις.gen.dat");
  assert.match(builder.el.textContent, /can’t be both genitive and dative/);
  // A menu choice rewrites the box to match the card, and the note goes.
  await settle(300);
  const dative = builder.el.querySelector('[data-key="c0.case.dative"]');
  assert.ok(dative, "πίστις has a dative");
  dative.click();
  assert.equal(box(0).value, "πίστις.gen/dat");
  assert.doesNotMatch(builder.el.textContent, /can’t be both/);
});
