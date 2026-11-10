// The sheet editor's add bar (sheets/add-bar.js) driven in a browser DOM
// (Audit 8, LG8-8). The module is imported FIRST, before anything that imports
// sheets/sheet-editor.js: it once leaned on an import cycle through the editor
// and failed when it was the entry point.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle } from "./helpers/browser-env.mjs";

const { createAddBar } = await import("../src/scripts/desk/sheets/add-bar.js");

const sheetWith = (...types) => ({ modules: types.map((type) => ({ type })) });

function makeBar(extra = {}) {
  const added = [];
  const host = {
    ctx: () => ({ contentVersion: "v1" }),
    store: { all: async () => [] },
    sheet: () => sheetWith(),
    ...extra,
  };
  const bar = createAddBar({ addPart: (type) => added.push(type), addHost: host, idSuffix: "t" });
  document.body.replaceChildren(bar.el);
  return { bar, added };
}
const named = (bar, text) => [...bar.el.querySelectorAll("button")].find((b) => b.textContent === text);

test("imported on its own, the bar draws all seven buttons and each add button asks for its part", () => {
  const { bar, added } = makeBar();
  const labels = [...bar.el.querySelectorAll(".desk-sheet__add-row > button")].map((b) => b.textContent);
  assert.deepEqual(labels, ["+ Passage", "+ Your text", "+ Question", "+ From my notes…", "+ Space to write", "+ Page break", "+ Key terms box"]);
  named(bar, "+ Your text").click();
  named(bar, "+ Question").click();
  named(bar, "+ Space to write").click();
  named(bar, "+ Page break").click();
  named(bar, "+ Key terms box").click();
  assert.deepEqual(added, ["text", "question", "space", "pageBreak", "keyTerms"]);
});

test("every button has a hover line and a description a screen reader can reach", () => {
  const { bar } = makeBar();
  for (const b of bar.el.querySelectorAll(".desk-sheet__add-row > button")) {
    assert.ok(b.title, `${b.textContent} has a tooltip`);
    const ids = (b.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
    assert.ok(ids.length, `${b.textContent} is described`);
    for (const id of ids) assert.ok(bar.el.querySelector(`#${CSS.escape(id)}`)?.textContent, `${b.textContent}: #${id} has text`);
  }
});

test("+ Passage opens and closes its form, and the field takes focus", () => {
  const { bar, added } = makeBar();
  const btn = named(bar, "+ Passage");
  const form = bar.el.querySelector(".desk-sheet__passage-form");
  assert.equal(btn.getAttribute("aria-expanded"), "false");
  assert.equal(form.hidden, true);
  assert.equal(btn.getAttribute("aria-controls"), form.id);
  btn.click();
  assert.equal(btn.getAttribute("aria-expanded"), "true");
  assert.equal(form.hidden, false);
  assert.equal(document.activeElement, form.querySelector("input"));
  assert.deepEqual(added, [], "opening the form adds nothing");
  btn.click();
  assert.equal(form.hidden, true);
  assert.equal(btn.getAttribute("aria-expanded"), "false");
});

test("a sheet holds one key terms box: the button is disabled with the reason, and comes back", () => {
  const { bar } = makeBar();
  const btn = named(bar, "+ Key terms box");
  bar.sheetChanged(sheetWith("passage"));
  assert.equal(btn.disabled, false);
  bar.sheetChanged(sheetWith("passage", "keyTerms"));
  assert.equal(btn.disabled, true);
  assert.match(btn.title, /one key terms box/);
  assert.equal(bar.el.querySelectorAll(".desk-title__hint").length, 1);
  assert.equal(btn.nextElementSibling.textContent, "already on the sheet");
  bar.sheetChanged(sheetWith("keyTerms")); // drawn again: no second reason
  assert.equal(bar.el.querySelectorAll(".desk-title__hint").length, 1);
  bar.sheetChanged(sheetWith("passage"));
  assert.equal(btn.disabled, false);
  assert.equal(bar.el.querySelectorAll(".desk-title__hint").length, 0);
  assert.doesNotMatch(btn.title, /one key terms box/);
});

test("+ From my notes… opens its chooser, Escape closes it and gives focus back to the button", async () => {
  const { bar } = makeBar();
  const btn = named(bar, "+ From my notes…");
  const picker = bar.el.querySelector(".desk-sheet__from-notes");
  btn.click();
  assert.equal(btn.getAttribute("aria-expanded"), "true");
  await settle();
  assert.equal(picker.hidden, false);
  // No notes: the chooser offers Cancel and focuses it.
  assert.equal(document.activeElement.textContent, "Cancel");
  document.activeElement.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  assert.equal(picker.hidden, true);
  assert.equal(btn.getAttribute("aria-expanded"), "false");
  assert.equal(document.activeElement, btn);
});
