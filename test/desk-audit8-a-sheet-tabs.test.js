// test/desk-audit8-a-sheet-tabs.test.js
//
// Audit 8's fixes to two tabs on one sheet (STUDY-DESK.md, S12, part 4):
// - DI8-8: two tabs opening one sheet within ASK_WAIT_MS never asked each
//   other, since a tab counted as editing only once its editor was drawn.
// - SH8-8: two editors in one tab asking about one sheet at once overwrote
//   each other's question, so one never heard the answer.
// - SH8-2: "Keep mine" wrote every field of the card, putting older words
//   back over a field the other tab had changed, and that field went on
//   showing the old words; now the rules work field by field.
// - DI8-4: a closing tab writes over the newest copy it has heard of.
// The page side, sheet-tabs.js, runs here as two tabs: the module imported
// twice (each with its own tab id) over a BroadcastChannel stand-in.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ASK_WAIT_MS,
  editingMessage,
  editingReply,
  keptFields,
  movedUnderReader,
  newerSheet,
  readEditingMessage,
} from "../src/lib/desk-sheet-tabs.mjs";

// Messages reach every other channel of the name, later, as a browser's do.
const channels = new Map();
globalThis.BroadcastChannel = class {
  constructor(name) {
    this.name = name;
    this.onmessage = null;
    if (!channels.has(name)) channels.set(name, new Set());
    channels.get(name).add(this);
  }
  postMessage(data) {
    const copy = structuredClone(data);
    for (const other of channels.get(this.name)) {
      if (other !== this) setTimeout(() => other.onmessage?.({ data: copy }), 5);
    }
  }
  close() {
    channels.get(this.name)?.delete(this);
  }
};

/** A tab: sheet-tabs.js with a module instance, and so a tab id, of its own. */
let tabs = 0;
const newTab = () => import(`../src/scripts/desk/sheets/sheet-tabs.js?tab=${++tabs}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test("a `here` from a tab still asking says so, and nothing else carries it", () => {
  assert.deepEqual(readEditingMessage(editingMessage("here", "t1", "s1", { asking: true })), { type: "here", tab: "t1", sheet: "s1", asking: true });
  assert.deepEqual(readEditingMessage(editingMessage("here", "t1", "s1")), { type: "here", tab: "t1", sheet: "s1" });
  assert.equal(editingMessage("who", "t1", "s1", { asking: true }).asking, undefined);
  assert.equal(readEditingMessage({ ...editingMessage("who", "t1", "s1"), asking: true }).asking, undefined);
});

test("two askers: each answers the other's `who`, and of two that heard each other only the larger id counts", () => {
  const whoA = readEditingMessage(editingMessage("who", "a", "s1"));
  assert.equal(editingReply(whoA, { tab: "b", asking: "s1" }), "answer-asking");
  assert.equal(editingReply(whoA, { tab: "b", asking: "s2" }), null, "another sheet");
  const hereA = readEditingMessage(editingMessage("here", "a", "s1", { asking: true }));
  const hereB = readEditingMessage(editingMessage("here", "b", "s1", { asking: true }));
  // Both heard each other's `who`.
  assert.equal(editingReply(hereB, { tab: "a", asking: "s1", heard: ["b"] }), null, "the smaller id doesn't ask");
  assert.equal(editingReply(hereA, { tab: "b", asking: "s1", heard: ["a"] }), "count", "the larger id asks");
  // Only one heard: the other began asking after the first `who` went by.
  assert.equal(editingReply(hereB, { tab: "a", asking: "s1", heard: [] }), "count");
  // A tab already editing is counted whatever the ids.
  assert.equal(editingReply(readEditingMessage(editingMessage("here", "b", "s1")), { tab: "a", asking: "s1", heard: ["b"] }), "count");
});

test("two tabs opening one sheet together: exactly one of them asks (DI8-8)", async () => {
  const [a, b] = [await newTab(), await newTab()];
  const answers = await Promise.all([a.editedElsewhere("sheet-1"), b.editedElsewhere("sheet-1")]);
  assert.equal(answers.filter(Boolean).length, 1, `answers: ${answers}`);
});

test("a tab opening a sheet just after another began to: the later one asks (DI8-8)", async () => {
  const [a, b] = [await newTab(), await newTab()];
  const first = a.editedElsewhere("sheet-2");
  await wait(ASK_WAIT_MS / 4);
  const second = b.editedElsewhere("sheet-2");
  assert.deepEqual(await Promise.all([first, second]), [false, true]);
});

test("a tab editing the sheet is still found, by every editor asking at once (SH8-8)", async () => {
  const [editing, asking] = [await newTab(), await newTab()];
  const stop = editing.addEditor(() => "sheet-3");
  // Two Sheets panes in one tab restoring the same sheet share the question.
  const both = await Promise.all([asking.editedElsewhere("sheet-3"), asking.editedElsewhere("sheet-3")]);
  assert.deepEqual(both, [true, true]);
  stop();
  assert.equal(await asking.editedElsewhere("sheet-3"), false, "nobody once it stops");
});

test("a part's fields, when its saved text moves while the reader is in the card (SH8-2)", () => {
  const stored = { id: "m1", type: "question", html: "<p>Why?</p>", answer: "<p>Because B</p>" };
  // Typing in the question; the other tab changed only the answer.
  assert.deepEqual(
    movedUnderReader([{ name: "html", shown: "<p>Why?</p>", busy: true }, { name: "answer", shown: "<p>Because</p>", busy: false }], stored),
    { load: ["answer"], conflict: [] },
    "the answer is loaded, and no line, since the question didn't move",
  );
  // The other tab changed the question being typed in.
  assert.deepEqual(
    movedUnderReader([{ name: "html", shown: "<p>Why</p>", busy: true }, { name: "answer", shown: "<p>Because B</p>", busy: false }], stored),
    { load: [], conflict: ["html"] },
  );
  // Only the minutes moved.
  assert.deepEqual(movedUnderReader([{ name: "html", shown: "<p>Why?</p>", busy: true }], { ...stored, minutes: 5 }), { load: [], conflict: [] });
  // A field absent from the record reads as empty.
  assert.deepEqual(movedUnderReader([{ name: "answer", shown: "", busy: true }], { id: "m1" }), { load: [], conflict: [] });
});

test("Keep mine writes only the fields whose words differ from the other version (SH8-2)", () => {
  const theirs = { html: "<p>Why?</p>", answer: "<p>Because B</p>" };
  assert.deepEqual(keptFields({ html: "<p>Why not?</p>", answer: "<p>Because B</p>" }, theirs), { html: "<p>Why not?</p>" });
  assert.deepEqual(keptFields({ html: "<p>Why?</p>", answer: "<p>Because B</p>" }, theirs), {});
  assert.deepEqual(keptFields({ answer: "" }, { html: "x" }), {}, "an absent field is empty");
});

test("a closing tab writes over the newer of its saved copy and the one it heard of (DI8-4)", () => {
  const saved = { id: "s", modified: "2026-11-09T12:00:00.000Z", title: "mine" };
  const heard = { id: "s", modified: "2026-11-09T12:00:01.000Z", title: "theirs" };
  assert.equal(newerSheet(saved, heard), heard);
  assert.equal(newerSheet(heard, saved), heard);
  assert.equal(newerSheet(saved, null), saved);
  assert.equal(newerSheet(null, heard), heard);
  assert.equal(newerSheet(saved, { ...heard, id: "other" }), saved, "another sheet's copy is never taken");
});

test("the editor works field by field, and its closing write and heads follow the rules", () => {
  const src = readFileSync(new URL("../src/scripts/desk/sheets/sheet-editor.js", import.meta.url), "utf8");
  assert.match(src, /movedUnderReader\(/);
  assert.match(src, /keptFields\(/);
  assert.match(src, /let next = newerSheet\(sheet, heard\?\.id === sheet\.id \? heard : null\);/);
  // SH8-4 and DI8-7: a card's own save keeps its head key, and a head is redrawn in place.
  assert.match(src, /card\.json = json\(m\);\s*card\.head = headKey\(m\);/);
  assert.match(src, /card\.setHead\?\.\(m\);/);
  // SH8-8: the live region doesn't wait for a frame, which a hidden tab never draws.
  assert.doesNotMatch(src, /requestAnimationFrame\(\(\) => \{ live\.textContent/);
  // XA8-10: with the last part removed, the empty sheet's line takes focus.
  assert.match(src, /none\.tabIndex = -1/);
  // DI8-5: a save the upgraded notebook refused says to reload, and leaves the words to copy.
  assert.match(src, /if \(err\?\.name === NOTEBOOK_UPGRADED\) \{[^}]*reload this page[^}]*return;\s*\}/);
  const cards = readFileSync(new URL("../src/scripts/desk/sheets/part-cards.js", import.meta.url), "utf8");
  // SH8-4: the minutes field puts back what the sheet holds now, and the space's preview follows its field.
  assert.match(cards, /field\.value = now\(\)\.minutes \?\? "";/);
  assert.match(cards, /onLines\?\.\(lines\);/);
});
