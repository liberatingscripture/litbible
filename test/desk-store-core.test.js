// test/desk-store-core.test.js
//
// src/lib/desk-store-core.mjs: what each notebook change writes. The
// IndexedDB shell (src/scripts/desk/store.js) commits these plans as they
// come, so a plan that's wrong here is a notebook that's wrong in the browser.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createRecord } from "../src/lib/desk-records.mjs";
import {
  CHANNEL,
  changeMessage,
  currentSlug,
  forChapter,
  forProse,
  kindName,
  liveRecords,
  planDelete,
  planPurge,
  planSave,
  planUndo,
  planWrite,
  readChangeMessage,
  recordHref,
  recordReadHref,
  recordReference,
  touched,
  webClient,
} from "../src/lib/desk-store-core.mjs";

const base = { client: "web/2026.10", contentVersion: "v20261005.5d2c847d" };
let n = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

function note(where, extra = {}) {
  return createRecord(
    "note",
    { body: "mine", marker: "note", ...where, ...extra },
    { ...base, now: "2026-10-05T12:00:00.000Z", id: nextId() },
  );
}

test("planSave puts a valid record and refuses a malformed one", () => {
  const r = note({ bookKey: "romans", chapter: 8, verse: 3 });
  assert.deepEqual(planSave(r), { put: [r], remove: [] });
  assert.throws(() => planSave({ ...r, marker: "star" }), /not saved/);
  assert.throws(() => planSave({ ...r, chapter: 17 }), /chapter is out of range/);
});

function highlight(where, extra = {}) {
  return createRecord(
    "highlight",
    {
      ...where,
      color: "yellow",
      quote: { exact: "patient", prefix: "Love is ", suffix: ", love is kind." },
      ...extra,
    },
    { ...base, now: "2026-10-05T12:00:00.000Z", id: nextId() },
  );
}

test("planWrite passes a plan whose records are all well formed, and keeps only put and remove", () => {
  const a = highlight({ bookKey: "1corinthians", chapter: 13, verse: 1 });
  const b = highlight({ bookKey: "1corinthians", chapter: 13, verse: 1, endVerse: 2 }, { color: "pink" });
  const gone = highlight({ bookKey: "1corinthians", chapter: 13, verse: 3 });
  const plan = { put: [a, b], remove: [gone.id], created: a, summary: { merged: 0 }, undo: { put: [], remove: [] } };
  const checked = planWrite(plan);
  assert.deepEqual(checked, { put: [a, b], remove: [gone.id] });
  assert.deepEqual(touched(checked), [a.id, b.id, gone.id]);
  assert.notEqual(checked.put, plan.put, "a copy, so the caller's plan can't change under the commit");
});

test("planWrite refuses the whole plan when one record is malformed", () => {
  const good = highlight({ bookKey: "1corinthians", chapter: 13, verse: 1 });
  const bad = highlight({ bookKey: "1corinthians", chapter: 13, verse: 1 }, { color: "teal" });
  assert.throws(() => planWrite({ put: [good, bad], remove: [] }), /desk-store: not saved \(color "teal"/);
  assert.throws(() => planWrite({ put: [good, { ...good, quote: undefined }], remove: [] }), /a highlight needs a quote/);
  assert.throws(() => planWrite({ put: [{ ...good, chapter: 17 }], remove: ["x"] }), /chapter is out of range/);
});

test("planWrite does not judge a trash record, which holds a record of any kind", () => {
  const r = highlight({ bookKey: "1corinthians", chapter: 13, verse: 1 }, { color: "teal" });
  const trash = planDelete(r, { ...base, now: "2026-10-06T00:00:00.000Z" });
  assert.deepEqual(planWrite(trash), { put: [trash.trash], remove: [r.id] });
});

test("planWrite takes the plans the other operations make, and an empty one", () => {
  const r = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const deleted = planDelete(r, { ...base, now: "2026-10-06T00:00:00.000Z" });
  assert.deepEqual(planWrite(deleted).remove, [r.id]);
  const undone = planUndo(deleted.trash, { ...base, now: "2026-10-06T00:00:05.000Z" });
  assert.deepEqual(planWrite(undone), { put: [undone.record], remove: [deleted.trash.id] });
  assert.deepEqual(planWrite({ put: [], remove: [] }), { put: [], remove: [] });
  assert.deepEqual(planWrite({}), { put: [], remove: [] });
  assert.throws(() => planWrite({ put: [{ id: "x" }], remove: [] }), /not saved/);
});

test("planDelete puts the trash record and removes the live one", () => {
  const r = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const plan = planDelete(r, { ...base, now: "2026-10-06T00:00:00.000Z" });
  assert.equal(plan.put.length, 1);
  assert.equal(plan.put[0], plan.trash);
  assert.equal(plan.trash.kind, "trash");
  assert.equal(plan.trash.deletedId, r.id);
  assert.deepEqual(plan.remove, [r.id]);
  assert.deepEqual(touched(plan), [plan.trash.id, r.id]);
});

test("planUndo puts the record back and removes its trash record", () => {
  const r = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const { trash } = planDelete(r, { ...base, now: "2026-10-06T00:00:00.000Z" });
  const plan = planUndo(trash, { ...base, now: "2026-10-06T00:00:05.000Z" });
  assert.equal(plan.record.id, r.id);
  assert.equal(plan.record.modified, "2026-10-06T00:00:05.000Z");
  assert.deepEqual(plan.put, [plan.record]);
  assert.deepEqual(plan.remove, [trash.id]);
});

test("planUndo has nothing to do once the trash is emptied", () => {
  const r = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const { trash } = planDelete(r, { ...base, now: "2026-08-01T00:00:00.000Z" });
  const [emptied] = planPurge([trash], "2026-10-01T00:00:00.000Z").put;
  assert.equal(planUndo(emptied, base), null);
});

test("planPurge empties only trash past its 30 days", () => {
  const r = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const old = planDelete(r, { ...base, now: "2026-08-01T00:00:00.000Z" }).trash;
  const fresh = planDelete(note({ bookKey: "john", chapter: 3, verse: 16 }), { ...base, now: "2026-09-30T00:00:00.000Z" }).trash;
  const plan = planPurge([r, old, fresh], "2026-10-01T00:00:00.000Z");
  assert.equal(plan.put.length, 1);
  assert.equal(plan.put[0].id, old.id);
  assert.equal("record" in plan.put[0], false);
  assert.deepEqual(plan.remove, []);
  assert.deepEqual(planPurge([r, fresh], "2026-10-01T00:00:00.000Z"), { put: [], remove: [] });
});

test("change messages: what tabs send each other, and nothing else is read", () => {
  assert.equal(CHANNEL, "lit-desk");
  assert.deepEqual(changeMessage(["a", "b", "a"]), { v: 1, ids: ["a", "b"] });
  assert.deepEqual(readChangeMessage({ v: 1, ids: ["a"] }), ["a"]);
  assert.deepEqual(readChangeMessage({ v: 1, ids: [] }), []);
  for (const bad of [null, "a", { v: 2, ids: ["a"] }, { v: 1 }, { v: 1, ids: [1] }]) {
    assert.equal(readChangeMessage(bad), null);
  }
});

test("liveRecords leaves trash out and orders by Bible order, then verse, then age", () => {
  const john = note({ bookKey: "john", chapter: 3, verse: 16 });
  const rom8v28 = note({ bookKey: "romans", chapter: 8, verse: 28 });
  const rom8v3 = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const matt = note({ bookKey: "matthew", chapter: 5, verse: 3 });
  const label = createRecord("label", { name: "Lent" }, { ...base, id: nextId() });
  const { trash } = planDelete(note({ bookKey: "mark", chapter: 1, verse: 1 }), base);
  const got = liveRecords([rom8v28, label, john, trash, rom8v3, matt]);
  assert.deepEqual(got.map((r) => r.id), [matt.id, john.id, rom8v3.id, rom8v28.id, label.id]);
});

test("forChapter keeps one chapter's records", () => {
  const a = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const b = note({ bookKey: "romans", chapter: 9, verse: 3 });
  const c = note({ bookKey: "1corinthians", chapter: 8, verse: 1 });
  assert.deepEqual(forChapter([a, b, c], "romans", 8), [a]);
});

test("references and links use the site's address form", () => {
  const one = { bookKey: "1corinthians", chapter: 13, verse: 4 };
  const range = { ...one, endVerse: 7 };
  assert.equal(recordReference(one), "1 Corinthians 13:4");
  assert.equal(recordReference(range), "1 Corinthians 13:4–7");
  assert.equal(recordReference({ ...one, endVerse: 4 }), "1 Corinthians 13:4");
  assert.equal(recordReference({ kind: "label" }), "");
  assert.equal(recordHref(one), "/1corinthians-13/#v4");
  assert.equal(recordHref(range), "/1corinthians-13/#v4-7");
  assert.equal(recordHref({ bookKey: "romans", chapter: 8 }), "/romans-8/");
  assert.equal(recordHref({ kind: "sheet" }), null);
});

test("kindName names every kind but trash, and an unknown kind plainly", () => {
  assert.equal(kindName("note"), "Note");
  assert.equal(kindName("hidden"), "Hidden passage");
  assert.equal(kindName("voiceMemo"), "Item");
});

test("webClient is the year and month of the page's text", () => {
  assert.equal(webClient("v20261005.5d2c847d"), "web/2026.10");
  assert.equal(webClient("unversioned"), "web/dev");
  assert.equal(webClient(undefined), "web/dev");
});

/* ── Notes on a glossary entry or an article (N11, provisional) ────────── */

/** The record as if made on the given day of October 2026 (createRecord takes no `created`). */
const on = (record, day) => ({ ...record, created: `2026-10-0${day}T12:00:00.000Z` });

test("forProse keeps an article's notes, matched by its slug", () => {
  const a = note({ article: "many-and-all" });
  const b = note({ article: "where-theres-a-will" });
  const verse = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const entry = note({ glossaryEntry: "flesh-body" });
  assert.deepEqual(forProse([verse, b, a, entry], "article", "many-and-all"), [a]);
  assert.deepEqual(forProse([verse, b, a, entry], "article", "no-such-article"), []);
});

test("forProse lists a glossary entry's notes by its id, oldest first", () => {
  const newer = on(note({ glossaryEntry: "flesh-body" }), 3);
  const older = on(note({ glossaryEntry: "flesh-body" }), 1);
  const other = on(note({ glossaryEntry: "hell-hades" }), 2);
  assert.deepEqual(forProse([newer, other, older], "glossaryEntry", "flesh-body"), [older, newer]);
});

test("forProse follows a renamed article: a note made under the old slug is found under the new one", () => {
  const renamed = { "old-slug": "new-slug" };
  const before = on(note({ article: "old-slug" }), 1);
  const after = on(note({ article: "new-slug" }), 2);
  const other = on(note({ article: "another-article" }), 3);
  assert.deepEqual(forProse([after, other, before], "article", "new-slug", renamed), [before, after]);
  assert.deepEqual(forProse([after, other, before], "article", "another-article", renamed), [other]);
});

test("forProse knows no renames for glossary entries", () => {
  const entry = note({ glossaryEntry: "old-id" });
  assert.deepEqual(forProse([entry], "glossaryEntry", "new-id", { "old-id": "new-id" }), []);
  assert.deepEqual(forProse([entry], "glossaryEntry", "old-id", { "old-id": "new-id" }), [entry]);
});

test("forProse leaves out trashed records, and anything that isn't a note", () => {
  const live = note({ article: "many-and-all" });
  const gone = note({ article: "many-and-all" });
  const { trash } = planDelete(gone, { ...base, now: "2026-10-06T00:00:00.000Z" });
  const forced = { ...live, id: "forced", kind: "trash" };
  const bookmark = { ...live, id: "bookmark", kind: "bookmark" };
  assert.deepEqual(forProse([trash, forced, bookmark, live], "article", "many-and-all"), [live]);
  assert.deepEqual(forProse([trash, forced, bookmark], "article"), []);
});

test("forProse ignores a target that isn't text", () => {
  const odd = note({ article: 42 });
  const nothing = note({ article: null });
  assert.deepEqual(forProse([odd, nothing], "article"), []);
  assert.deepEqual(forProse([odd, nothing], "article", "42"), []);
});

test("forProse with no id takes every note of that type, and no other", () => {
  const e1 = on(note({ glossaryEntry: "flesh-body" }), 2);
  const e2 = on(note({ glossaryEntry: "hell-hades" }), 1);
  const a1 = note({ article: "many-and-all" });
  const verse = note({ bookKey: "john", chapter: 3, verse: 16 });
  const records = [e1, a1, verse, e2];
  assert.deepEqual(forProse(records, "glossaryEntry"), [e2, e1]);
  assert.deepEqual(forProse(records, "glossaryEntry", null), [e2, e1]);
  assert.deepEqual(forProse(records, "article", null, { "old-slug": "many-and-all" }), [a1]);
  assert.deepEqual(forProse([], "article"), []);
});

test("a note on a glossary entry reads as 'Glossary: <title>' and links to the entry", () => {
  const titled = { kind: "note", glossaryEntry: "flesh-body", targetTitle: "Flesh" };
  assert.equal(recordReference(titled), "Glossary: Flesh");
  assert.equal(recordHref(titled), "/glossary/#flesh-body");
  assert.equal(recordReference({ ...titled, targetTitle: undefined }), "Glossary: flesh-body", "the id stands in for a missing title");
  assert.equal(recordReference({ ...titled, targetTitle: "" }), "Glossary: flesh-body");
});

test("a note on an article reads as its title, or its slug, and links to the article", () => {
  const titled = { kind: "note", article: "many-and-all", targetTitle: "Many and All" };
  assert.equal(recordReference(titled), "Many and All");
  assert.equal(recordHref(titled), "/articles/many-and-all/");
  assert.equal(recordReference({ ...titled, targetTitle: undefined }), "many-and-all");
  assert.equal(recordReference({ ...titled, targetTitle: "" }), "many-and-all");
});

test("a prose target wins over verse fields, and a prose note has no Read View address", () => {
  const stray = { glossaryEntry: "flesh-body", bookKey: "romans", chapter: 8, verse: 3 };
  assert.equal(recordReference(stray), "Glossary: flesh-body");
  assert.equal(recordHref(stray), "/glossary/#flesh-body");
  assert.equal(recordReadHref({ glossaryEntry: "flesh-body" }), null);
  assert.equal(recordReadHref({ article: "many-and-all" }), null);
  assert.equal(recordReference({ article: 5 }), "", "a target that isn't text is no target");
  assert.equal(recordHref({ article: 5 }), null);
});

test("forProse follows a chain of renames to the current slug", () => {
  const n = note({ article: "a" });
  assert.deepEqual(forProse([n], "article", "c", { a: "b", b: "c" }), [n]);
});

test("currentSlug stops at a loop instead of running forever", () => {
  assert.equal(currentSlug("a", { a: "b", b: "a" }), "b");
  assert.equal(currentSlug("x", {}), "x");
});
