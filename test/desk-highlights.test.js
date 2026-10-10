// test/desk-highlights.test.js
//
// src/lib/desk-highlights.mjs: how a reader's highlights meet. These guard the
// rule STUDY-DESK-FORMAT.md settles ("Highlights that meet") and the format's
// principles it leans on: only what the reader changes gets a new `modified`
// (4), what a client can't read is left alone (6), and a mark made on newer
// text is never rewritten by older (7).

import { test } from "node:test";
import assert from "node:assert/strict";

import { assembleChapter } from "../src/lib/anchor-core.mjs";
import {
  COLOR_WORDS,
  overlappingHighlights,
  placeHighlights,
  planHighlight,
} from "../src/lib/desk-highlights.mjs";
import { COLORS, createRecord, quoteFields, validateRecord, verseCopyFor } from "../src/lib/desk-records.mjs";
import { planWrite } from "../src/lib/desk-store-core.mjs";

const VERSION = "v20261005.5d2c847d";
const LATER = "v20261009.0a1b2c3d";
const before = "2026-10-05T12:00:00.000Z";
const NOW = "2026-10-09T08:30:00.000Z";
const ctx = { client: "web/2026.10", contentVersion: VERSION };
const where = { bookKey: "1corinthians", chapter: 13 };

const V1 = "Love is patient, love is kind.";
const V2 = "It is not envious.";
const V3 = "It does not boast.";
const chapter = assembleChapter(
  new Map([
    [1, V1],
    [2, V2],
    [3, V3],
  ]),
);
const TEXT = chapter.text;

/** The [start, end) of the first `needle` at or after `from`. */
function at(needle, from = 0) {
  const start = TEXT.indexOf(needle, from);
  assert.notEqual(start, -1, `"${needle}" is in the test chapter`);
  return [start, start + needle.length];
}

let n = 0;
/** A highlight on chapter text [start, end), as an earlier visit would have left it. */
function highlight([start, end], color = "yellow", extra = {}) {
  const { created = before, ...rest } = extra;
  return {
    ...createRecord(
      "highlight",
      {
        ...where,
        ...quoteFields(chapter, start, end),
        color,
        verseCopy: verseCopyFor(chapter, quoteFields(chapter, start, end).verse, quoteFields(chapter, start, end).endVerse),
        verseCopyAsOf: before,
      },
      { ...ctx, now: before, id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}` },
    ),
    created,
    ...rest,
  };
}

const place = (records, version = VERSION) => placeHighlights(chapter, records, version);

/** Plan a mark on [start, end) among `records`. */
function plan(records, [start, end], color, extra = {}) {
  return planHighlight({ chapter, placed: place(records), start, end, color, where, now: NOW, ctx, ...extra });
}

const rangeOfRecord = (r) => {
  const [p] = place([r]);
  return [p.start, p.end];
};
const quoteOf = (r) => r.quote.exact;
const byId = (list, id) => list.find((r) => r.id === id);

/** A tiny stand-in for the store: apply a plan to a map of records by id. */
function apply(records, { put, remove }) {
  const out = new Map(records.map((r) => [r.id, r]));
  for (const r of put) out.set(r.id, r);
  for (const id of remove) out.delete(id);
  return out;
}

/* ── Reading ─────────────────────────────────────────────────────────── */

test("the colour words are the four stored colours", () => {
  assert.deepEqual(Object.keys(COLOR_WORDS), [...COLORS]);
  for (const c of COLORS) assert.equal(COLOR_WORDS[c], c);
});

test("placeHighlights places only highlights, in today's text", () => {
  const h = highlight(at("patient"));
  const note = createRecord("note", { ...where, verse: 1, body: "mine", marker: "note" }, { ...ctx, now: before });
  const placed = place([note, h]);
  assert.equal(placed.length, 1);
  assert.equal(placed[0].record, h);
  assert.deepEqual([placed[0].start, placed[0].end, placed[0].status, placed[0].editable], [...at("patient"), "found", true]);
});

test("placeHighlights leaves out a highlight whose verses are gone", () => {
  const gone = highlight(at("patient"), "yellow", { verse: 9, endVerse: 9, quote: { exact: "zzzz", prefix: "", suffix: "" } });
  assert.deepEqual(place([gone]), []);
});

test("placeHighlights marks a highlight with a change notice, a newer schema, or newer text as not editable", () => {
  const changed = highlight(at("patient"), "yellow", {
    quote: { exact: "patience", prefix: "Love is ", suffix: ", love is kind. It is not enviou" },
  });
  const newerSchema = highlight(at("kind"), "green", { schema: 2 });
  const newerText = highlight(at("envious"), "blue", { contentVersion: LATER });
  const found = highlight(at("boast"), "pink");
  const placed = place([changed, newerSchema, newerText, found]);
  const by = (r) => placed.find((p) => p.record === r);
  assert.equal(by(changed).status, "changed");
  assert.equal(by(changed).editable, false);
  assert.equal(by(newerSchema).editable, false);
  assert.equal(by(newerText).editable, false);
  assert.equal(by(found).editable, true);
});

test("placeHighlights calls a highlight whose words moved editable, and one that fell back to its verse not", () => {
  const moved = highlight(at("boast"), "yellow", { verse: 1, endVerse: 1 });
  const verseOnly = highlight(at("boast"), "yellow", { verse: 3, endVerse: 3, quote: { exact: "xxxxxxxx", prefix: "zz", suffix: "qq" } });
  const placed = place([moved, verseOnly]);
  assert.equal(placed.find((p) => p.record === moved).status, "moved");
  assert.equal(placed.find((p) => p.record === moved).editable, true);
  assert.equal(placed.find((p) => p.record === verseOnly).status, "verse");
  assert.equal(placed.find((p) => p.record === verseOnly).editable, false);
});

test("overlappingHighlights is half open and returns only editable entries", () => {
  const a = highlight(at("patient"));
  const b = highlight(at("kind"), "green", { schema: 2 });
  const placed = place([a, b]);
  const [s, e] = at("patient");
  assert.deepEqual(overlappingHighlights(placed, s, e).map((p) => p.record), [a]);
  assert.deepEqual(overlappingHighlights(placed, e, e + 3), [], "starting where it ends is not overlap");
  assert.deepEqual(overlappingHighlights(placed, s - 3, s), [], "ending where it starts is not overlap");
  assert.deepEqual(overlappingHighlights(placed, s + 3, e + 3).map((p) => p.record), [a]);
  const [ks, ke] = at("kind");
  assert.deepEqual(overlappingHighlights(placed, ks, ke), [], "a record this client can't edit is never offered");
});

/* ── A fresh highlight ───────────────────────────────────────────────── */

test("a highlight on bare text makes one valid record", () => {
  const p = plan([], at("patient"), "green");
  assert.equal(p.put.length, 1);
  assert.deepEqual(p.remove, []);
  const h = p.put[0];
  assert.equal(p.created, h);
  assert.equal(h.kind, "highlight");
  assert.equal(h.color, "green");
  assert.equal(h.bookKey, "1corinthians");
  assert.equal(h.chapter, 13);
  assert.equal(h.verse, 1);
  assert.equal(h.endVerse, 1);
  assert.deepEqual(h.quote, { exact: "patient", prefix: "Love is ", suffix: ", love is kind. It is not enviou" });
  assert.equal(h.verseCopy, V1);
  assert.equal(h.verseCopyAsOf, NOW);
  assert.equal(h.created, NOW);
  assert.equal(h.modified, NOW);
  assert.equal(h.client, "web/2026.10");
  assert.equal(h.contentVersion, VERSION);
  assert.deepEqual(h.labels, []);
  assert.deepEqual(validateRecord(h), []);
  assert.deepEqual(p.summary, { merged: 0, trimmed: 0, removed: 0, split: 0, otherColors: 0 });
  assert.deepEqual(p.undo, { put: [], remove: [h.id] });
});

test("the spaces at the edges of the mark are not highlighted", () => {
  const [s, e] = at("is");
  const p = plan([], [s - 1, e + 1], "yellow");
  assert.equal(quoteOf(p.put[0]), "is");
  assert.equal(p.put[0].quote.prefix, "Love ");
  assert.equal(p.put[0].quote.suffix.slice(0, 8), " patient");
});

test("a mark of nothing but spaces is no mark", () => {
  const i = TEXT.indexOf(" ");
  for (const color of [...COLORS, null]) {
    const p = plan([], [i, i + 1], color);
    assert.deepEqual([p.put, p.remove, p.created], [[], [], null]);
    assert.deepEqual(p.undo, { put: [], remove: [] });
  }
  assert.deepEqual(plan([], [5, 5], "yellow").put, []);
});

test("a mark that isn't a colour, or has no ends, is refused", () => {
  assert.throws(() => plan([], at("patient"), "teal"), /not a highlight colour/);
  assert.throws(() => plan([], at("patient"), undefined), /not a highlight colour/);
  assert.throws(() => planHighlight({ chapter, placed: [], start: null, end: 4, color: "yellow", where, now: NOW, ctx }), /start and an end/);
});

test("a highlight across two verses names both and copies both", () => {
  const [s] = at("kind.");
  const [, e] = at("It is");
  const p = plan([], [s, e], "pink");
  const h = p.put[0];
  assert.equal(h.verse, 1);
  assert.equal(h.endVerse, 2);
  assert.equal(quoteOf(h), "kind. It is");
  assert.equal(h.verseCopy, `${V1} ${V2}`);
  assert.deepEqual(validateRecord(h), []);
});

test("a highlight across paragraphs is one record", () => {
  const blockAt = (pos) => (pos < TEXT.indexOf("It is not") ? "p1" : "p2");
  const [s] = at("kind");
  const [, e] = at("not envious");
  const p = plan([], [s, e], "blue", { blockAt });
  assert.equal(p.put.length, 1);
  assert.equal(quoteOf(p.put[0]), "kind. It is not envious");
});

/* ── Same colour merges ──────────────────────────────────────────────── */

test("the same colour, overlapping, widens the old highlight into one", () => {
  const old = { ...highlight(at("patient, love")), futureField: { kept: true } };
  const [s, e] = at("love is kind.");
  const p = plan([old], [s, e], "yellow");
  assert.equal(p.put.length, 1, "no second record");
  assert.deepEqual(p.remove, []);
  const h = p.put[0];
  assert.equal(h.id, old.id);
  assert.equal(p.created, h);
  assert.equal(quoteOf(h), "patient, love is kind.");
  assert.equal(h.modified, NOW);
  assert.equal(h.created, before, "it is still the same highlight");
  assert.equal(h.verseCopyAsOf, NOW);
  assert.deepEqual(h.futureField, { kept: true });
  assert.deepEqual(validateRecord(h), []);
  assert.deepEqual(p.summary, { merged: 1, trimmed: 0, removed: 0, split: 0, otherColors: 0 });
  assert.deepEqual(p.undo, { put: [{ ...old, modified: NOW }], remove: [] });
});

test("an edited highlight is now made on today's text", () => {
  const old = highlight(at("patient"), "yellow", { contentVersion: "v20260901.aaaaaaaa", client: "ios/3.2" });
  const p = plan([old], at("is patient,"), "yellow");
  assert.equal(p.put[0].contentVersion, VERSION);
  assert.equal(p.put[0].client, "web/2026.10");
});

test("the same colour, across a single space, becomes one highlight", () => {
  const old = highlight(at("Love is patient,"));
  const p = plan([old], at("love is kind."), "yellow");
  assert.equal(p.put.length, 1);
  assert.equal(p.put[0].id, old.id);
  assert.equal(quoteOf(p.put[0]), "Love is patient, love is kind.");
});

test("the same colour, with nothing between, becomes one highlight", () => {
  const old = highlight(at("Love is patient"));
  const [, end] = at("Love is patient");
  const p = plan([old], [end, end + 1], "yellow");
  assert.equal(p.put.length, 1);
  assert.equal(p.put[0].id, old.id);
  assert.equal(quoteOf(p.put[0]), "Love is patient,");
});

test("the same colour, across words, stays two highlights", () => {
  const old = highlight(at("Love"));
  const p = plan([old], at("patient"), "yellow");
  assert.equal(p.put.length, 1);
  assert.notEqual(p.put[0].id, old.id);
  assert.equal(quoteOf(p.put[0]), "patient");
  assert.equal(p.summary.merged, 0);
  assert.equal(p.remove.length, 0);
});

test("the same colour, across a block boundary, stays apart", () => {
  const split = TEXT.indexOf("It is not");
  const old = highlight(at("kind."));
  const mark = at("It is not");
  const apart = plan([old], mark, "yellow", { blockAt: (pos) => (pos < split ? "p1" : "p2") });
  assert.equal(apart.put.length, 1);
  assert.notEqual(apart.put[0].id, old.id);
  assert.deepEqual(apart.summary, { merged: 0, trimmed: 0, removed: 0, split: 0, otherColors: 0 });

  const together = plan([old], mark, "yellow", { blockAt: () => "p1" });
  assert.equal(together.put.length, 1);
  assert.equal(together.put[0].id, old.id);
  assert.equal(quoteOf(together.put[0]), "kind. It is not");
});

test("a block the page can't name counts as the same block", () => {
  const old = highlight(at("kind."));
  for (const blockAt of [undefined, () => null, (pos) => (pos < 20 ? undefined : "p2"), (pos) => (pos < 20 ? "p1" : null)]) {
    const p = plan([old], at("It is not"), "yellow", { blockAt });
    assert.equal(p.put[0].id, old.id);
  }
});

test("overlapping highlights merge even when the page puts their ends in different blocks", () => {
  const old = highlight(at("kind. It is"));
  const p = plan([old], at("It is not envious."), "yellow", { blockAt: (pos) => (pos < TEXT.indexOf("It is not") ? "p1" : "p2") });
  assert.equal(p.put[0].id, old.id);
  assert.equal(quoteOf(p.put[0]), "kind. It is not envious.");
});

test("a mark wholly inside a highlight of its colour changes nothing", () => {
  const old = highlight(at("patient, love"));
  const p = plan([old], at("patient"), "yellow");
  assert.deepEqual(p.put, []);
  assert.deepEqual(p.remove, []);
  assert.equal(p.created, null);
  assert.deepEqual(p.summary, { merged: 0, trimmed: 0, removed: 0, split: 0, otherColors: 0 });
  assert.deepEqual(p.undo, { put: [], remove: [] });
  const same = plan([old], at("patient, love"), "yellow");
  assert.deepEqual([same.put, same.remove], [[], []]);
});

test("a chain of highlights joins into the one made first, and the others go to the trash", () => {
  const a = highlight(at("Love is"), "yellow", { created: "2026-10-03T00:00:00.000Z" });
  const b = highlight(at("patient,"), "yellow", { created: "2026-10-01T00:00:00.000Z" });
  const c = highlight(at("love is kind."), "yellow", { created: "2026-10-02T00:00:00.000Z" });
  const p = plan([a, c, b], at("is patient, love"), "yellow");

  const survivor = byId(p.put, b.id);
  assert.equal(quoteOf(survivor), "Love is patient, love is kind.");
  assert.equal(survivor.created, b.created);
  assert.equal(survivor.modified, NOW);
  assert.equal(p.created, survivor);

  const trash = p.put.filter((r) => r.kind === "trash");
  assert.equal(trash.length, 2);
  assert.deepEqual(trash.map((t) => t.deletedId).sort(), [a.id, c.id].sort());
  assert.deepEqual(byId(trash.map((t) => ({ ...t, id: t.deletedId })), a.id).record, a, "the trash holds the highlight as it was");
  assert.deepEqual([...p.remove].sort(), [a.id, c.id].sort());
  assert.equal(p.put.length, 3);
  assert.deepEqual(p.summary, { merged: 3, trimmed: 0, removed: 0, split: 0, otherColors: 0 });
  assert.doesNotThrow(() => planWrite(p));
});

test("when two highlights were made at the same moment, the smaller id is kept", () => {
  const a = highlight(at("Love is"), "yellow", { id: "bbbbbbbb-0000-4000-8000-000000000000" });
  const b = highlight(at("love is kind."), "yellow", { id: "aaaaaaaa-0000-4000-8000-000000000000" });
  const p = plan([a, b], at("patient,"), "yellow");
  assert.equal(p.created.id, b.id);
  assert.deepEqual(p.remove, [a.id]);
});

test("a highlight that can't be touched is not merged into, even when it overlaps", () => {
  const newer = highlight(at("patient"), "yellow", { schema: 2 });
  const p = plan([newer], at("is patient,"), "yellow");
  assert.equal(p.put.length, 1);
  assert.notEqual(p.put[0].id, newer.id);
  assert.deepEqual(p.remove, []);
});

/* ── A different colour trims ────────────────────────────────────────── */

test("a new colour trims the old one from the left, and the remainder loses its leading space", () => {
  const old = highlight(at("patient, love is"), "yellow");
  const p = plan([old], at("Love is patient,"), "green");
  const trimmedOld = byId(p.put, old.id);
  assert.equal(quoteOf(trimmedOld), "love is");
  assert.equal(trimmedOld.color, "yellow");
  assert.equal(trimmedOld.modified, NOW);
  const fresh = p.put.find((r) => r.color === "green");
  assert.equal(quoteOf(fresh), "Love is patient,");
  assert.equal(p.created, fresh);
  assert.equal(p.put.length, 2);
  assert.deepEqual(p.remove, []);
  assert.deepEqual(p.summary, { merged: 0, trimmed: 1, removed: 0, split: 0, otherColors: 1 });
  assert.deepEqual(p.undo.put, [{ ...old, modified: NOW }]);
  assert.deepEqual(p.undo.remove, [fresh.id]);
});

test("a new colour trims the old one from the right, and the remainder loses its trailing space", () => {
  const old = highlight(at("Love is patient, love"), "yellow");
  const p = plan([old], at("patient, love is kind."), "blue");
  assert.equal(quoteOf(byId(p.put, old.id)), "Love is");
  assert.deepEqual(p.summary, { merged: 0, trimmed: 1, removed: 0, split: 0, otherColors: 1 });
});

test("a new colour in the middle of the old one splits it, and the new piece keeps its colour and labels", () => {
  const old = highlight(at(V1), "yellow", { labels: ["label-1", "label-2"], futureField: 7 });
  const p = plan([old], at("patient,"), "green");
  assert.equal(p.put.length, 3);
  const first = byId(p.put, old.id);
  assert.equal(quoteOf(first), "Love is");
  assert.equal(first.futureField, 7);
  assert.deepEqual(first.labels, ["label-1", "label-2"]);
  const piece = p.put.find((r) => r.color === "yellow" && r.id !== old.id);
  assert.equal(quoteOf(piece), "love is kind.");
  assert.deepEqual(piece.labels, ["label-1", "label-2"]);
  assert.notEqual(piece.labels, old.labels, "a copy, not the same list");
  assert.equal(piece.created, NOW);
  assert.equal(piece.verse, 1);
  assert.equal(piece.verseCopy, V1);
  assert.deepEqual(validateRecord(piece), []);
  const green = p.put.find((r) => r.color === "green");
  assert.equal(quoteOf(green), "patient,");
  assert.equal(p.created, green);
  assert.deepEqual(p.summary, { merged: 0, trimmed: 0, removed: 0, split: 1, otherColors: 1 });
  assert.deepEqual(p.undo.put, [{ ...old, modified: NOW }]);
  assert.deepEqual([...p.undo.remove].sort(), [piece.id, green.id].sort());
  assert.doesNotThrow(() => planWrite(p));
});

test("a new colour that covers the old one deletes it", () => {
  const old = highlight(at("patient"), "yellow");
  const p = plan([old], at("is patient, love"), "pink");
  const trash = p.put.find((r) => r.kind === "trash");
  assert.equal(trash.deletedId, old.id);
  assert.deepEqual(trash.record, old);
  assert.deepEqual(p.remove, [old.id]);
  assert.equal(p.put.length, 2);
  assert.deepEqual(p.summary, { merged: 0, trimmed: 0, removed: 1, split: 0, otherColors: 1 });
  assert.deepEqual(p.undo.put, [{ ...old, modified: NOW }]);
  assert.ok(p.undo.remove.includes(trash.id));
  assert.ok(p.undo.remove.includes(p.created.id));
});

test("a new colour that exactly covers the old one deletes it too", () => {
  const old = highlight(at("patient"), "yellow");
  const p = plan([old], at("patient"), "green");
  assert.equal(p.put.filter((r) => r.kind === "trash").length, 1);
  assert.equal(p.summary.removed, 1);
});

test("a new colour and the old colour's touching neighbour: only overlap is cut, only the same colour joins", () => {
  const yellowLeft = highlight(at("Love is"), "yellow");
  const greenRight = highlight(at("love is kind."), "green");
  const p = plan([yellowLeft, greenRight], at("patient,"), "green");
  assert.deepEqual(p.summary, { merged: 1, trimmed: 0, removed: 0, split: 0, otherColors: 0 });
  assert.equal(p.created.id, greenRight.id);
  assert.equal(quoteOf(p.created), "patient, love is kind.");
  assert.equal(byId(p.put, yellowLeft.id), undefined, "the yellow beside it is left alone");
});

test("a trimmed remainder is rebuilt from today's text", () => {
  const old = highlight(at("Love is patient, love"), "yellow", { contentVersion: "v20260901.aaaaaaaa", verseCopy: "older wording" });
  const p = plan([old], at("patient, love"), "green");
  const left = byId(p.put, old.id);
  assert.equal(left.verseCopy, V1);
  assert.equal(left.verseCopyAsOf, NOW);
  assert.equal(left.contentVersion, VERSION);
  assert.deepEqual(left.quote, { exact: "Love is", prefix: "", suffix: " patient, love is kind. It is no" });
});

test("a mark that covers one highlight, trims another and joins a third does all three", () => {
  const green = highlight(at("kind."), "green");
  const yellow = highlight(at("Love is patient"), "yellow");
  const blue = highlight(at("is kind. It"), "blue");
  const p = plan([green, yellow, blue], at("patient, love is"), "green");
  assert.equal(quoteOf(byId(p.put, yellow.id)), "Love is");
  assert.equal(quoteOf(byId(p.put, blue.id)), "kind. It");
  assert.equal(p.created.id, green.id);
  assert.equal(quoteOf(p.created), "patient, love is kind.");
  assert.deepEqual(p.summary, { merged: 1, trimmed: 2, removed: 0, split: 0, otherColors: 2 });
});

/* ── Erasing ─────────────────────────────────────────────────────────── */

test("erasing trims a highlight of any colour and writes nothing new", () => {
  const yellow = highlight(at("Love is patient"), "yellow");
  const blue = highlight(at("love is kind."), "blue");
  const p = plan([yellow, blue], at("patient, love"), null);
  assert.equal(quoteOf(byId(p.put, yellow.id)), "Love is");
  assert.equal(quoteOf(byId(p.put, blue.id)), "is kind.");
  assert.equal(p.put.length, 2);
  assert.deepEqual(p.remove, []);
  assert.equal(p.created, null);
  assert.deepEqual(p.summary, { merged: 0, trimmed: 2, removed: 0, split: 0, otherColors: 2 });
  assert.deepEqual(p.undo.remove, []);
  assert.equal(p.undo.put.length, 2);
});

test("erasing the middle of a highlight splits it", () => {
  const old = highlight(at(V1), "pink", { labels: ["a"] });
  const p = plan([old], at("is patient, love"), null);
  const quotes = p.put.map(quoteOf).sort();
  assert.deepEqual(quotes, ["Love", "is kind."]);
  const piece = p.put.find((r) => r.id !== old.id);
  assert.equal(piece.color, "pink");
  assert.deepEqual(piece.labels, ["a"]);
  assert.deepEqual(p.summary, { merged: 0, trimmed: 0, removed: 0, split: 1, otherColors: 1 });
  assert.deepEqual(p.undo.remove, [piece.id]);
  assert.equal(p.created, null);
});

test("erasing a whole highlight, or more than it, deletes it", () => {
  const old = highlight(at("patient"), "green");
  const p = plan([old], at("Love is patient, love"), null);
  assert.equal(p.put.length, 1);
  assert.equal(p.put[0].kind, "trash");
  assert.deepEqual(p.remove, [old.id]);
  assert.deepEqual(p.summary, { merged: 0, trimmed: 0, removed: 1, split: 0, otherColors: 1 });
});

test("erasing where nothing is highlighted changes nothing", () => {
  const old = highlight(at("boast"));
  const p = plan([old], at("patient"), null);
  assert.deepEqual([p.put, p.remove, p.created], [[], [], null]);
});

test("a remainder that is only a stray space is dropped, so the highlight goes", () => {
  // A highlight read from elsewhere may carry a space at its edge; the placed
  // range is what counts.
  const old = highlight(at("Love"));
  const [s, e] = at("Love");
  const placed = [{ record: old, start: s, end: e + 1, status: "found", editable: true }];
  const p = planHighlight({ chapter, placed, start: s, end: e, color: null, where, now: NOW, ctx });
  assert.equal(p.put[0].kind, "trash");
  assert.deepEqual(p.remove, [old.id]);
  assert.equal(p.summary.removed, 1);
});

/* ── What is never touched ───────────────────────────────────────────── */

test("a highlight with a change notice is never trimmed or erased", () => {
  const changed = highlight(at("patient"), "yellow", {
    quote: { exact: "patience", prefix: "Love is ", suffix: ", love is kind. It is not enviou" },
  });
  const [placedChanged] = place([changed]);
  assert.equal(placedChanged.status, "changed");
  for (const color of ["green", null]) {
    const p = plan([changed], at("Love is patient,"), color);
    assert.deepEqual(p.remove, []);
    assert.equal(p.put.filter((r) => r.id === changed.id).length, 0, "not edited");
    assert.equal(p.put.some((r) => r.kind === "trash"), false);
    assert.equal(p.summary.otherColors, 0);
  }
});

test("a highlight written by a newer schema, or on newer text, is carried untouched", () => {
  const newerSchema = highlight(at("patient"), "yellow", { schema: 2 });
  const newerText = highlight(at("love is kind."), "blue", { contentVersion: LATER });
  const p = plan([newerSchema, newerText], at("is patient, love is"), "green");
  assert.equal(p.put.length, 1);
  assert.equal(p.put[0].color, "green");
  assert.deepEqual(p.remove, []);
  const erase = plan([newerSchema, newerText], at("is patient, love is"), null);
  assert.deepEqual([erase.put, erase.remove], [[], []]);
});

test("an editable highlight beside an untouchable one is still trimmed", () => {
  const stuck = highlight(at("kind."), "blue", { schema: 2 });
  const free = highlight(at("patient, love"), "yellow");
  const p = plan([stuck, free], at("love is kind."), "green");
  assert.equal(quoteOf(byId(p.put, free.id)), "patient,");
  assert.equal(byId(p.put, stuck.id), undefined);
});

/* ── Undo ────────────────────────────────────────────────────────────── */

test("undo puts every original back and removes everything the plan made", () => {
  const a = highlight(at("Love is"), "yellow", { created: "2026-10-03T00:00:00.000Z" });
  const b = highlight(at("love is kind."), "yellow", { created: "2026-10-01T00:00:00.000Z" });
  const covered = highlight(at("envious"), "pink");
  const cut = highlight(at("It is not envious. It does"), "blue");
  const records = [a, b, covered, cut];
  const bridge = [...at("patient,")];
  bridge[1] = at("envious")[1];
  const p = plan(records, bridge, "yellow");

  const after = apply(records, p);
  assert.ok(after.has(p.created.id));
  const back = apply([...after.values()], p.undo);
  assert.deepEqual([...back.keys()].sort(), records.map((r) => r.id).sort());
  for (const original of records) {
    assert.deepEqual(back.get(original.id), { ...original, modified: NOW }, `${original.id} is back as it was`);
  }
});

test("undoing a plan that changes nothing does nothing", () => {
  const old = highlight(at("patient, love"));
  const p = plan([old], at("patient"), "yellow");
  assert.deepEqual(p.undo, { put: [], remove: [] });
  assert.deepEqual(apply([old], p.undo).get(old.id), old);
});

test("undo removes the trash records the plan wrote", () => {
  const old = highlight(at("patient"), "yellow");
  const p = plan([old], at("patient"), "green");
  const trash = p.put.find((r) => r.kind === "trash");
  assert.ok(p.undo.remove.includes(trash.id));
  const gone = apply([old], p);
  assert.equal(gone.has(old.id), false);
  const back = apply([...gone.values()], p.undo);
  assert.equal(back.has(trash.id), false);
  assert.equal(back.get(old.id).quote.exact, "patient");
});

test("undo carries the reader's client, and leaves it alone when there is none", () => {
  const old = highlight(at("patient"), "yellow", { client: "ios/3.2" });
  const p = plan([old], at("is patient, love"), "pink");
  assert.equal(p.undo.put[0].client, "web/2026.10");
  const q = planHighlight({ chapter, placed: place([old]), start: at("is patient, love")[0], end: at("is patient, love")[1], color: "pink", where, now: NOW, ctx: { contentVersion: VERSION } });
  assert.equal(q.undo.put[0].client, "ios/3.2");
});

/* ── The plan is a valid write ───────────────────────────────────────── */

test("every plan passes planWrite, and nothing is both written and removed", () => {
  const records = [
    highlight(at("Love is"), "yellow"),
    highlight(at("patient,"), "yellow"),
    highlight(at("kind. It"), "blue"),
    highlight(at("envious"), "green"),
  ];
  for (const color of [...COLORS, null]) {
    for (const range of [at("patient"), at("is patient, love is kind. It"), at(V1), at("envious. It")]) {
      const p = plan(records, range, color);
      const checked = planWrite(p);
      assert.deepEqual(checked, { put: p.put, remove: p.remove });
      const ids = new Set(p.put.map((r) => r.id));
      assert.equal(ids.size, p.put.length, "no record twice");
      assert.ok(p.remove.every((id) => !ids.has(id)));
    }
  }
});

test("a plan never changes the records it was given", () => {
  const old = highlight(at("patient, love"));
  const frozen = structuredClone(old);
  const placed = place([old]);
  planHighlight({ chapter, placed, ...rangeFor(at("love is kind.")), color: "yellow", where, now: NOW, ctx });
  planHighlight({ chapter, placed, ...rangeFor(at("is patient")), color: "green", where, now: NOW, ctx });
  planHighlight({ chapter, placed, ...rangeFor(at("is patient")), color: null, where, now: NOW, ctx });
  assert.deepEqual(old, frozen);
  assert.deepEqual(rangeOfRecord(old), at("patient, love"));
});

function rangeFor([start, end]) {
  return { start, end };
}
