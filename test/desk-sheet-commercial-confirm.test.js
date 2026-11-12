// The confirmation before a commercial sheet leaves the Sheets page (E94;
// src/scripts/desk/sheets/commercial-confirm.js), driven in a browser DOM.
// It asks only for a sheet marked commercial whose check finds something
// beyond the terms, never blocks, and asks once per set of counts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle } from "./helpers/browser-env.mjs";
import { commercialShare } from "../src/lib/desk-sheet-lit.mjs";

const { createCommercialGate } = await import("../src/scripts/desk/sheets/commercial-confirm.js");

const counts = (lit, own, extra = {}) => ({ ...commercialShare(lit, own), whole: [], notesOff: 0, blanks: 0, ...extra });

/** A gate over a sheet the test changes, with counts it hands in, and an opener to return focus to. */
function gate(sheet, result) {
  let current = sheet;
  let made = 0;
  const g = createCommercialGate({
    getSheet: () => current,
    counts: async () => {
      made += 1;
      if (result instanceof Error) throw result;
      return typeof result === "function" ? result() : result;
    },
  });
  const opener = document.createElement("button");
  opener.textContent = "Print";
  document.body.replaceChildren(opener);
  opener.focus();
  return {
    g,
    opener,
    made: () => made,
    change(next) {
      current = next;
      g.refresh();
    },
  };
}

const dialog = () => document.querySelector("dialog.sheets-page__commercial");
const press = (label) => [...dialog().querySelectorAll("button")].find((b) => b.textContent === label).click();

test("a sheet not marked commercial goes ahead without counting or asking", async () => {
  const { g, made } = gate({ id: "s1", commercial: false }, counts(90, 10));
  assert.equal(await g.ask(null, "Print"), true);
  assert.equal(made(), 0);
  assert.equal(dialog(), null);
});

test("a commercial sheet within the terms goes ahead without asking", async () => {
  const { g } = gate({ id: "s1", commercial: true }, counts(30, 70));
  assert.equal(await g.ask(null, "Print"), true);
  assert.equal(dialog(), null);
});

test("a commercial sheet beyond the terms asks, listing only what goes beyond, with Cancel focused", async () => {
  const { g, opener } = gate({ id: "s1", commercial: true }, counts(10, 90, { blanks: 2 }));
  const answer = g.ask(opener, "Print");
  await settle(20);
  const d = dialog();
  assert.ok(d, "the dialog opened");
  assert.equal(d.querySelector("h2").textContent, "This sheet goes beyond the commercial terms");
  const items = [...d.querySelectorAll("ul li")].map((li) => li.textContent);
  assert.deepEqual(items, ["This sheet leaves 2 blanks. The commercial terms ask that the text be quoted as written; blanks are part of the noncommercial terms."]);
  // The note about the whole work is for the 50% alone.
  assert.doesNotMatch(d.textContent, /counted against the whole work/);
  assert.equal(document.activeElement?.textContent, "Cancel");
  const links = [...d.querySelectorAll("a")];
  assert.ok(links.length === 2 && links.every((a) => a.target === "_blank" && /noopener/.test(a.rel)), "both links open a new tab");
  press("Cancel");
  assert.equal(await answer, false);
  assert.equal(dialog(), null, "the dialog is gone");
  assert.equal(document.activeElement, opener, "focus is back on the button pressed");
});

test("going ahead holds until the counts change, and the × cancels", async () => {
  let c = counts(80, 20);
  const { g, opener, change } = gate({ id: "s1", commercial: true }, () => c);
  let answer = g.ask(opener, "Copy");
  await settle(20);
  assert.match(dialog().textContent, /LIT material: 80 of 100 words \(80%\)\. The commercial terms allow at most 50%\./);
  assert.match(dialog().textContent, /counted against the whole work/);
  press("Copy anyway");
  assert.equal(await answer, true);
  // Copy, then Print: asked once.
  assert.equal(await g.ask(opener, "Print"), true);
  assert.equal(dialog(), null);
  // A part added: new counts, so it asks again.
  c = counts(85, 20);
  change({ id: "s1", commercial: true, modules: [1] });
  answer = g.ask(opener, "Print");
  await settle(20);
  assert.ok(dialog(), "asked again after the counts moved");
  press("×");
  assert.equal(await answer, false);
});

test("going ahead answers within the press, so a copy or full screen still has its gesture; Escape cancels", async () => {
  const { g, opener } = gate({ id: "s1", commercial: true }, counts(80, 20));
  let answered = null;
  const first = g.ask(opener, "Present").then((v) => { answered = v; });
  await settle(20);
  press("Present anyway");
  // The answer is settled before the press's task ends: only microtasks have run.
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(answered, true);
  await first;
  // Escape closes the dialog, which counts as Cancel.
  const { g: g2 } = gate({ id: "s2", commercial: true }, counts(81, 19));
  const second = g2.ask(null, "Print");
  await settle(20);
  dialog().close();
  assert.equal(await second, false);
  assert.equal(dialog(), null);
});

test("a count that fails never costs the reader their copy", async () => {
  const realError = console.error;
  console.error = () => {};
  try {
    const { g } = gate({ id: "s1", commercial: true }, new Error("offline"));
    assert.equal(await g.ask(null, "Save"), true);
    assert.equal(dialog(), null);
  } finally {
    console.error = realError;
  }
});
