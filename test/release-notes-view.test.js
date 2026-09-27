// test/release-notes-view.test.js
//
// src/lib/release-notes-view.mjs: how /release-notes presents
// release-notes.json. The detail strings below are real ones from the feed.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  changeBook,
  changeKind,
  entryIds,
  groupByMonth,
  parseDetail,
  renderDetailHtml,
  renderRelabelHtml,
} from "../src/lib/release-notes-view.mjs";

test("entry ids are the date, and a second publish that day counts from the oldest", () => {
  const entries = [
    { date: "2026-09-26" },
    { date: "2026-04-12" }, // the later of the day's two publishes
    { date: "2026-04-12" },
    { date: "2026-03-29" },
  ];
  assert.deepEqual(entryIds(entries), ["2026-09-26", "2026-04-12-2", "2026-04-12", "2026-03-29"]);
  // A third publish that day, prepended, leaves the existing two alone.
  assert.deepEqual(entryIds([{ date: "2026-04-12" }, ...entries.slice(1)]).slice(0, 3), [
    "2026-04-12-3",
    "2026-04-12-2",
    "2026-04-12",
  ]);
});

test("months group consecutive entries, newest first, with change counts", () => {
  const entries = [
    { date: "2026-09-26", changes: [{}, {}] },
    { date: "2026-09-02", changes: [{}] },
    { date: "2026-08-30", changes: [{}] },
  ];
  const months = groupByMonth(entries);
  assert.deepEqual(
    months.map((m) => [m.key, m.label, m.count, m.entries.map((e) => e.id)]),
    [
      ["2026-09", "September 2026", 3, ["2026-09-26", "2026-09-02"]],
      ["2026-08", "August 2026", 1, ["2026-08-30"]],
    ],
  );
});

test("change kinds: metadata rows belong to no filter", () => {
  assert.equal(changeKind("text_updated"), "wording");
  assert.equal(changeKind("footnote_added"), "footnotes");
  assert.equal(changeKind("footnote_updated"), "footnotes");
  assert.equal(changeKind("intro_updated"), "intros");
  assert.equal(changeKind("metadata_updated"), null);
});

test("a change's book comes from location, else from the description's label", () => {
  assert.equal(changeBook({ description: "x", location: { bookKey: "james" } }), "james");
  assert.equal(changeBook({ description: "John 1:49 — text updated" }), "john");
  assert.equal(changeBook({ description: "1 John 4:10 — text updated" }), "1john");
  assert.equal(changeBook({ description: "Romans Introduction updated" }), "romans");
  assert.equal(changeBook({ description: "Philemon added" }), "philemon");
  assert.equal(changeBook({ description: "Glossary entry for Spirit updated" }), null);
  assert.equal(changeBook({ description: "Article updated: 2 corinthians 13 10 mistranslation" }), null);
  assert.equal(changeBook({ description: "Metadata updated (6 chapters)" }), null);
  // A label must end at a word boundary: "Johnson" is not John.
  assert.equal(changeBook({ description: "Johnson 3 added" }), null);
});

test("detail: one before → after", () => {
  assert.deepEqual(parseDetail(`"meshiah!" → "mashiach!"`), [
    { label: null, kind: "change", old: "meshiah!", new: "mashiach!" },
  ]);
});

test("detail: verse-prefixed segments joined with ; ", () => {
  assert.deepEqual(parseDetail(`v. 21: "faithfulness" → "trust"; v. 22: "faithfulness.”" → "trust.”"`), [
    { label: "v. 21", kind: "change", old: "faithfulness", new: "trust" },
    { label: "v. 22", kind: "change", old: "faithfulness.”", new: "trust.”" },
  ]);
});

test("detail: footnote prefixes, added, removed, and formatting", () => {
  assert.deepEqual(
    parseDetail(`fn. g (v. 13): added "Traditionally, ‘woe to.’"; fn. t (v. 23): removed "Traditionally, ‘blessed.’"; fn. ff: minor formatting change`),
    [
      { label: "fn. g (v. 13)", kind: "added", text: "Traditionally, ‘woe to.’" },
      { label: "fn. t (v. 23)", kind: "removed", text: "Traditionally, ‘blessed.’" },
      { label: "fn. ff", kind: "formatting" },
    ],
  );
});

test("detail: straight quotes inside the quoted text (the 2026-08 quote cleanup)", () => {
  assert.deepEqual(parseDetail(`fn. f (v. 4): ""prophecy,"" → "“prophecy,”"; fn. g (v. 5): ""covered" and" → "“covered” and"`), [
    { label: "fn. f (v. 4)", kind: "change", old: `"prophecy,"`, new: "“prophecy,”" },
    { label: "fn. g (v. 5)", kind: "change", old: `"covered" and`, new: "“covered” and" },
  ]);
});

test("detail: an older entry's trailing relabel note", () => {
  assert.deepEqual(parseDetail(`fn. t (v. 29): "old…" → "new…"; footnotes formerly t–mm relabeled u–nn`), [
    { label: "fn. t (v. 29)", kind: "change", old: "old…", new: "new…" },
    { label: null, kind: "relabel", text: "footnotes formerly t–mm relabeled u–nn" },
  ]);
});

test("detail: anything off-grammar is null, so the page shows it as written", () => {
  assert.equal(parseDetail(undefined), null);
  assert.equal(parseDetail(""), null);
  assert.equal(parseDetail(`fn. a (v. 1): added “curly delimiters”`), null);
  assert.equal(parseDetail(`"a" → "b"; and something else`), null);
});

test("rendered detail: del/ins with spoken labels, escaped, one span per segment", () => {
  assert.equal(
    renderDetailHtml(`v. 2: "<b>" → "&"`),
    '<span class="rn-diff"><span class="rn-diff__label">v. 2</span> ' +
      '<del><span class="sr-only">Removed: </span>&lt;b&gt;</del> ' +
      '<ins><span class="sr-only">Added: </span>&amp;</ins></span>',
  );
  assert.equal(
    renderDetailHtml(`added "of the Life-breath"`),
    '<span class="rn-diff"><ins><span class="sr-only">Added: </span>of the Life-breath</ins></span>',
  );
  assert.equal(renderDetailHtml(`fn. a (v. 1): added “x”`), "fn. a (v. 1): added “x”");
  assert.equal(
    renderRelabelHtml("footnotes formerly ee–nn relabeled ff–oo"),
    '<span class="rn-diff rn-diff--note">Footnotes formerly ee–nn relabeled ff–oo</span>',
  );
});
