// test/desk-export.test.js
//
// src/lib/desk-export.mjs: saving a copy of the notebook and opening one.
// What matters is that nothing is lost on the way out (the full backup and the
// Web Annotation file both re-import every record exactly), that Markdown
// edits come back as edits and nothing else, and that a file can never delete
// a record by leaving it out (audit C17).

import { test } from "node:test";
import assert from "node:assert/strict";

import { createRecord, editRecord, validateRecord } from "../src/lib/desk-records.mjs";
import { OSIS_BOOKS, osisRef } from "../src/lib/osis.mjs";
import { LIT_CREDIT_LINE } from "../src/lib/lit-credit.mjs";
import { planDelete } from "../src/lib/desk-store-core.mjs";
import {
  describeLastExport,
  describeSummary,
  escapeBody,
  exportFilename,
  parseImport,
  parseReference,
  planChanges,
  planImport,
  toBackupJson,
  toMarkdown,
  toWebAnnotation,
  unescapeBody,
  webAnnotationCollection,
} from "../src/lib/desk-export.mjs";

const ctx = { client: "web/2026.10", contentVersion: "v20261005.5d2c847d" };
const opts = { exported: "2026-10-12T12:04:00.000Z", contentVersion: ctx.contentVersion };
let n = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const make = (kind, fields, now = "2026-09-12T08:00:00.000Z") => createRecord(kind, fields, { ...ctx, now, id: nextId() });

const quote = (exact) => ({ exact, prefix: "under ", suffix: " so that" });
const label = make("label", { name: "Prayer" });
const romans = make(
  "note",
  { bookKey: "romans", chapter: 8, verse: 3, endVerse: 4, quote: quote("rendered a verdict"), body: "Self-preservation as the drive\nto protect my standing.", marker: "note", labels: [label.id] },
);
const asked = make("note", { bookKey: "john", chapter: 3, verse: 16, endVerse: 16, body: "Why “world”?", marker: "question" });
const yellow = make("highlight", { bookKey: "romans", chapter: 4, verse: 7, endVerse: 7, color: "yellow", quote: quote("Gratified") });
const mark = make("bookmark", { bookKey: "mark", chapter: 4, verse: 35, label: "Evening reading" });
const pin = make("footnotePin", { bookKey: "luke", chapter: 17, verse: 35, footnote: "Verse 36 is left out here." });
const glossary = make("note", { glossaryEntry: "flesh-body", targetTitle: "Flesh", body: "Compare sarx.", marker: "note" });
const article = make("note", { article: "some-article", targetTitle: "Some article", body: "Good point.", marker: "emphasis" });
const place = make("place", { bookKey: "luke", chapter: 15, verse: 11, endVerse: 11, name: "Thursday group", ribbon: true });
const hidden = make("hidden", { bookKey: "mark", chapter: 9, verse: 44, endVerse: 44, body: "Skip for now" });
const sheet = make("sheet", { title: "Study sheet", items: [] });
const future = { ...make("note", { bookKey: "acts", chapter: 2, verse: 1, body: "x", marker: "note" }), schema: 9, novel: { a: [1, 2] } };
const alien = { id: nextId(), kind: "starfield", schema: 1, created: "2026-09-12T08:00:00.000Z", modified: "2026-09-12T08:00:00.000Z", client: "ios/9", contentVersion: "v1", labels: [], shiny: true };
const trash = planDelete(make("note", { bookKey: "acts", chapter: 3, verse: 1, body: "gone", marker: "note" }), { ...ctx, now: "2026-10-01T00:00:00.000Z" }).trash;

const everything = [romans, asked, yellow, mark, pin, glossary, article, place, hidden, sheet, label, future, alien, trash];

/* ── osis ──────────────────────────────────────────────────────────── */

test("osisRef writes a verse, a range, a chapter, and nothing for an unknown book", () => {
  assert.equal(osisRef("romans", 8, 3), "Rom.8.3");
  assert.equal(osisRef("romans", 8, 3, 4), "Rom.8.3-Rom.8.4");
  assert.equal(osisRef("romans", 8, 3, 3), "Rom.8.3");
  assert.equal(osisRef("1corinthians", 13), "1Cor.13");
  assert.equal(osisRef("tobit", 1, 1), "");
  assert.equal(Object.keys(OSIS_BOOKS).length, 27);
});

/* ── full backup ───────────────────────────────────────────────────── */

test("the full backup holds every record unchanged, trash and unknown kinds included", () => {
  const text = toBackupJson(everything, opts);
  const data = JSON.parse(text);
  assert.equal(data.format, "lit-notebook");
  assert.equal(data.version, 1);
  assert.equal(data.exported, opts.exported);
  assert.equal(data.contentVersion, opts.contentVersion);
  assert.deepEqual(data.records, everything);
  const back = parseImport(text);
  assert.equal(back.kind, "backup");
  assert.deepEqual(back.records, everything);
  assert.deepEqual(back.problems, []);
});

test("a backup from a newer version is read, with a note", () => {
  const text = JSON.stringify({ format: "lit-notebook", version: 2, records: [romans] });
  const back = parseImport(text);
  assert.equal(back.records.length, 1);
  assert.match(back.notes[0], /newer version/);
});

/* ── Web Annotation ────────────────────────────────────────────────── */

test("the Web Annotation collection follows the W3C shape", () => {
  const c = webAnnotationCollection(everything, opts);
  assert.equal(c["@context"], "http://www.w3.org/ns/anno.jsonld");
  assert.equal(c.type, "AnnotationCollection");
  const items = c.first.items;
  assert.equal(c.total, items.length);
  const byId = (r) => items.find((a) => a.lit.record.id === r.id);

  const a = byId(romans);
  assert.equal(a.type, "Annotation");
  assert.equal(a.id, `urn:uuid:${romans.id}`);
  assert.equal(a.motivation, "commenting");
  assert.equal(a.target.source, "https://litbible.net/romans-8/");
  assert.deepEqual(a.target.selector, [
    { type: "FragmentSelector", value: "v3-4", conformsTo: "http://tools.ietf.org/rfc/rfc3986" },
    { type: "TextQuoteSelector", exact: "rendered a verdict", prefix: "under ", suffix: " so that" },
  ]);
  assert.deepEqual(a.body[0], { type: "TextualBody", value: romans.body, format: "text/plain", purpose: "commenting" });
  assert.deepEqual(a.body[1], { type: "TextualBody", value: "Prayer", format: "text/plain", purpose: "tagging" });
  assert.equal(a.lit.osis, "Rom.8.3-Rom.8.4");
  assert.equal(a.lit.kind, "note");
  assert.deepEqual(a.lit.record, romans);

  assert.equal(byId(asked).motivation, "questioning");
  assert.equal(byId(yellow).motivation, "highlighting");
  assert.equal(byId(yellow).body, undefined);
  assert.equal(byId(mark).motivation, "bookmarking");
  assert.equal(byId(mark).body[0].value, "Evening reading");
  assert.equal(byId(hidden).motivation, "commenting");
  assert.equal(byId(hidden).lit.kind, "hidden");

  const p = byId(pin);
  assert.equal(p.motivation, "bookmarking");
  assert.deepEqual(p.target.selector.at(-1), { type: "TextQuoteSelector", exact: "Verse 36 is left out here." });

  assert.equal(byId(glossary).target.source, "https://litbible.net/glossary/");
  assert.equal(byId(glossary).target.selector[0].value, "flesh-body");
  assert.equal(byId(article).target.source, "https://litbible.net/articles/some-article/");
});

test("records that aren't marks go in the collection's own list, and trash stays out", () => {
  const c = webAnnotationCollection(everything, opts);
  const ids = new Set(c.lit.records.map((r) => r.id));
  for (const r of [place, sheet, label, alien]) assert.ok(ids.has(r.id), r.kind);
  assert.equal(ids.has(trash.id), false);
  assert.ok(c.first.items.some((a) => a.lit.record.id === future.id), "a note from a newer schema is still a mark");
  assert.equal(c.first.items.some((a) => a.lit.record.id === place.id), false);
  assert.ok(!JSON.stringify(c).includes("gone"), "a deleted note's words aren't exported");
});

test("the Web Annotation file re-imports every live record exactly", () => {
  const live = everything.filter((r) => r.kind !== "trash");
  const back = parseImport(toWebAnnotation(everything, opts));
  assert.equal(back.kind, "webAnnotation");
  assert.deepEqual(back.problems, []);
  const sort = (rs) => [...rs].sort((a, b) => (a.id < b.id ? -1 : 1));
  assert.deepEqual(sort(back.records), sort(live));
});

test("an annotation the notebook didn't make is reported, not guessed at", () => {
  const foreign = JSON.stringify({
    "@context": "http://www.w3.org/ns/anno.jsonld",
    type: "AnnotationCollection",
    first: { type: "AnnotationPage", items: [{ id: "http://example.org/a1", type: "Annotation", motivation: "commenting" }] },
  });
  const back = parseImport(foreign);
  assert.equal(back.kind, "webAnnotation");
  assert.deepEqual(back.records, []);
  assert.equal(back.problems.length, 1);
  assert.match(back.problems[0].message, /example\.org\/a1/);
});

/* ── Markdown ──────────────────────────────────────────────────────── */

test("the Markdown file reads as the mocked file does", () => {
  const md = toMarkdown(everything, opts);
  const lines = md.split("\n");
  assert.equal(lines[0], "# My LIT notebook");
  assert.equal(lines[1], "<!-- lit-notebook 1 · saved 2026-10-12 12:04 -->");
  assert.match(md, /^## Romans 8:3–4\n<!-- lit:id=00000000-0000-4000-8000-\d{12} -->\nhttps:\/\/litbible\.net\/romans-8\/#v3-4\nNote · 2026-09-12 · Labels: Prayer\n\n> rendered a verdict\n\nSelf-preservation as the drive\nto protect my standing\./m);
  assert.match(md, /^## John 3:16$/m);
  assert.match(md, /^Note \(question\) · 2026-09-12$/m);
  assert.match(md, /^Highlight \(yellow\) · 2026-09-12$/m);
  assert.match(md, /^## Glossary: Flesh$/m);
  assert.match(md, /^https:\/\/litbible\.net\/glossary\/#flesh-body$/m);
  assert.match(md, /^## Places\n- Thursday group: Luke 15:11 <!-- lit:id=/m);
  assert.match(md, /^## Labels\n- Prayer <!-- lit:id=/m);
  assert.ok(md.includes(LIT_CREDIT_LINE));
  assert.ok(md.includes("https://litbible.net/read/#license-terms"));
  assert.ok(!md.includes("gone"), "trash stays out");
  // Bible order: John (4th gospel) before Romans, Romans 4 before Romans 8.
  assert.ok(md.indexOf("## Mark 4:35") < md.indexOf("## John 3:16"));
  assert.ok(md.indexOf("## Romans 4:7") < md.indexOf("## Romans 8:3–4"));
});

test("escaping keeps a note's lines from being read as structure, and undoes cleanly", () => {
  const tricky = "## not a heading\n> not a quote\n<!-- not a comment -->\n\\already\n\\#both\nplain";
  assert.equal(unescapeBody(escapeBody(tricky)), tricky);
  assert.ok(escapeBody(tricky).split("\n").slice(0, 5).every((l) => l.startsWith("\\")));
  const r = make("note", { bookKey: "romans", chapter: 8, verse: 1, body: tricky, marker: "note" });
  const back = parseImport(toMarkdown([r], opts), { local: [r], ctx });
  assert.deepEqual(back.records, [r], "unchanged");
});

test("an unchanged Markdown file reads back as the same records, so nothing is an edit", () => {
  const md = toMarkdown(everything, opts);
  const back = parseImport(md, { local: everything, ctx, now: "2026-10-13T00:00:00.000Z" });
  assert.equal(back.kind, "markdown");
  assert.deepEqual(back.problems, []);
  const byId = new Map(everything.map((r) => [r.id, r]));
  for (const r of back.records) assert.deepEqual(r, byId.get(r.id));
  const plan = planImport(everything, back.records, { now: "2026-10-13T00:00:00.000Z" });
  assert.equal(planChanges(plan.plan), false);
  assert.equal(plan.summary.unchanged, back.records.length);
});

test("a note whose words were edited in the file comes back as an edit of the body alone", () => {
  const md = toMarkdown([romans, label], opts).replace("to protect my standing.", "to guard my standing.");
  const now = "2026-10-13T09:00:00.000Z";
  const back = parseImport(md, { local: [romans, label], ctx, now });
  assert.equal(back.records.length, 1);
  const edited = back.records[0];
  assert.equal(edited.id, romans.id);
  assert.equal(edited.body, "Self-preservation as the drive\nto guard my standing.");
  assert.equal(edited.modified, now);
  assert.deepEqual({ ...edited, body: romans.body, modified: romans.modified }, romans);
  const plan = planImport([romans, label], back.records, { now });
  assert.deepEqual(plan.summary, { added: 0, updated: 1, unchanged: 0, keptHere: 0, deleted: 0, skipped: 0 });
});

test("a note missing from the file is never deleted", () => {
  const md = toMarkdown([asked], opts);
  const back = parseImport(md, { local: [romans, asked], ctx });
  const plan = planImport([romans, asked], back.records, { now: "2026-10-13T00:00:00.000Z" });
  assert.deepEqual(plan.plan.remove, []);
  assert.equal(plan.plan.put.length, 0);
});

test("a new well-formed entry becomes a new note; a malformed one goes to the problems with its line", () => {
  const text = [
    "# My LIT notebook",
    "",
    "## 1 Cor 13:4–7",
    "> Love is patient",
    "",
    "Read this at the wedding.",
    "",
    "## Narnia 3:1",
    "A note on a book that isn't here.",
    "",
    "## Romans 8",
    "Needs a verse.",
    "",
    "## Romans 9:1",
    "",
    "## Romans 20:1",
    "Chapter out of range.",
    "",
    "## Mark 4:35",
    "Highlight · 2026-01-01",
    "> something",
    "",
  ].join("\n");
  const now = "2026-10-13T09:00:00.000Z";
  const back = parseImport(text, { local: [], ctx, now });
  assert.equal(back.records.length, 1);
  const r = back.records[0];
  assert.equal(r.kind, "note");
  assert.deepEqual([r.bookKey, r.chapter, r.verse, r.endVerse], ["1corinthians", 13, 4, 7]);
  assert.equal(r.body, "Read this at the wedding.");
  assert.equal(r.quote.exact, "Love is patient");
  assert.equal(r.client, ctx.client);
  assert.equal(r.created, now);
  assert.deepEqual(validateRecord(r), []);
  assert.deepEqual(back.problems.map((p) => p.line), [8, 11, 14, 16, 19]);
  assert.match(back.problems[0].message, /Narnia 3:1/);
  assert.match(back.problems[1].message, /needs a verse/);
  assert.match(back.problems[2].message, /no note/);
  assert.match(back.problems[4].message, /highlight/);
});

test("a new entry on a glossary entry or an article is read from its link", () => {
  const text = [
    "# My LIT notebook",
    "## Glossary: Flesh",
    "https://litbible.net/glossary/#flesh-body",
    "Note · 2026-10-01",
    "",
    "Sarx again.",
    "",
    "## Some article",
    "https://litbible.net/articles/some-article/",
    "",
    "Nice.",
  ].join("\n");
  const back = parseImport(text, { local: [], ctx });
  assert.deepEqual(back.problems, []);
  assert.equal(back.records[0].glossaryEntry, "flesh-body");
  assert.equal(back.records[0].targetTitle, "Flesh");
  assert.equal(back.records[1].article, "some-article");
});

test("a Markdown entry with an unknown id and kind Note keeps that id, so a second import matches it", () => {
  const text = `# My LIT notebook\n## Romans 8:1\n<!-- lit:id=11111111-1111-4111-8111-111111111111 -->\nNote · 2026-10-01\n\nHello.\n`;
  const first = parseImport(text, { local: [], ctx });
  assert.equal(first.records[0].id, "11111111-1111-4111-8111-111111111111");
  const second = planImport(first.records, parseImport(text, { local: first.records, ctx }).records, {});
  assert.equal(second.summary.unchanged, 1);
});

test("parseImport detects the kind and refuses what it doesn't know", () => {
  assert.equal(parseImport("").kind, "unknown");
  assert.equal(parseImport("just some text").kind, "unknown");
  assert.equal(parseImport("{ not json").kind, "unknown");
  assert.equal(parseImport('{"hello": 1}').kind, "unknown");
  assert.equal(parseImport("﻿" + toBackupJson([romans], opts)).kind, "backup");
  assert.equal(parseImport(toMarkdown([romans], opts)).kind, "markdown");
  for (const bad of ["", "just some text", "{ not json"]) assert.equal(parseImport(bad).problems.length, 1);
});

test("a Windows file with CRLF line endings reads the same", () => {
  const md = toMarkdown([romans, label], opts).replace(/\n/g, "\r\n");
  const back = parseImport(md, { local: [romans, label], ctx });
  assert.deepEqual(back.records, [romans]);
});

test("parseReference reads references and refuses the rest", () => {
  assert.deepEqual(parseReference("Romans 8:3–4"), { bookKey: "romans", chapter: 8, verse: 3, endVerse: 4 });
  assert.deepEqual(parseReference("Romans 8:3-4"), { bookKey: "romans", chapter: 8, verse: 3, endVerse: 4 });
  assert.deepEqual(parseReference("1 Cor. 13:4"), { bookKey: "1corinthians", chapter: 13, verse: 4, endVerse: 4 });
  assert.deepEqual(parseReference("john 3"), { bookKey: "john", chapter: 3, verse: null, endVerse: null });
  assert.equal(parseReference("Genesis 1:1"), null);
  assert.equal(parseReference("Romans"), null);
});

/* ── planImport ────────────────────────────────────────────────────── */

const later = (r, changes, at) => editRecord(r, changes, { now: at, client: "ios/2.1" });

test("planImport adds new records and leaves identical ones alone", () => {
  const out = planImport([romans], [romans, asked], { now: "2026-10-13T00:00:00.000Z" });
  assert.deepEqual(out.plan.put, [asked]);
  assert.deepEqual(out.plan.remove, []);
  assert.deepEqual(out.summary, { added: 1, updated: 0, unchanged: 1, keptHere: 0, deleted: 0, skipped: 0 });
});

test("planImport lets the newer writing win either way and says which copy stayed", () => {
  const theirs = later(romans, { body: "newer words" }, "2026-10-10T00:00:00.000Z");
  const a = planImport([romans], [theirs], { now: "2026-10-13T00:00:00.000Z" });
  assert.deepEqual(a.plan.put, [theirs]);
  assert.equal(a.summary.updated, 1);
  const b = planImport([theirs], [romans], { now: "2026-10-13T00:00:00.000Z" });
  assert.deepEqual(b.plan.put, []);
  assert.deepEqual(b.summary, { added: 0, updated: 0, unchanged: 0, keptHere: 1, deleted: 0, skipped: 0 });
});

test("planImport: a deletion here stands over an older copy in the file, and one in the file removes the record", () => {
  const mine = planDelete(romans, { ...ctx, now: "2026-10-05T00:00:00.000Z" });
  const a = planImport([mine.trash], [romans], { now: "2026-10-13T00:00:00.000Z" });
  assert.equal(a.summary.keptHere, 1);
  assert.equal(planChanges(a.plan), false);
  const theirs = planDelete(romans, { ...ctx, now: "2026-10-12T00:00:00.000Z" });
  const b = planImport([romans], [theirs.trash], { now: "2026-10-13T00:00:00.000Z" });
  assert.deepEqual(b.plan.remove, [romans.id]);
  assert.equal(b.summary.deleted, 1);
});

test("planImport reports malformed records and does not write them", () => {
  const bad = [
    { ...romans, id: nextId(), chapter: 99 },
    { ...asked, id: nextId(), marker: "star" },
    { nonsense: true },
    null,
    "text",
  ];
  const out = planImport([], [...bad, yellow], { now: "2026-10-13T00:00:00.000Z" });
  assert.deepEqual(out.plan.put, [yellow]);
  assert.equal(out.skipped.length, 5);
  assert.equal(out.summary.skipped, 5);
  assert.ok(out.skipped.every((s) => typeof s.reason === "string" && s.reason));
});

test("planImport carries unknown kinds and fields as they arrived", () => {
  const out = planImport([], [alien, future], { now: "2026-10-13T00:00:00.000Z" });
  assert.deepEqual(out.plan.put.sort((a, b) => (a.id < b.id ? -1 : 1)), [alien, future].sort((a, b) => (a.id < b.id ? -1 : 1)));
});

test("importing the same file twice writes nothing the second time", () => {
  const first = planImport([], everything, { now: "2026-10-13T00:00:00.000Z" });
  const held = first.plan.put;
  const second = planImport(held, everything, { now: "2026-10-13T00:00:00.000Z" });
  assert.equal(planChanges(second.plan), false);
});

test("every plan planImport makes passes the store's own check", async () => {
  const { planWrite } = await import("../src/lib/desk-store-core.mjs");
  const out = planImport([], everything, { now: "2026-10-13T00:00:00.000Z" });
  assert.doesNotThrow(() => planWrite(out.plan));
});

/* ── words ─────────────────────────────────────────────────────────── */

test("describeSummary and the file names read in plain words", () => {
  assert.equal(describeSummary({ added: 3, updated: 1, unchanged: 12, keptHere: 0, deleted: 0, skipped: 0 }), "3 new, 1 updated, 12 already here.");
  assert.equal(describeSummary({ added: 0, updated: 0, unchanged: 0, keptHere: 0, deleted: 0, skipped: 0 }), "Nothing to open in this file.");
  assert.match(describeSummary({ added: 0, updated: 0, unchanged: 0, keptHere: 2, deleted: 0, skipped: 1 }), /2 kept as they are here \(yours are newer\), 1 left out/);
  assert.equal(exportFilename("markdown", "2026-10-12T12:00:00.000Z"), "lit-notebook-2026-10-12.md");
  assert.equal(exportFilename("backup", "2026-10-12T12:00:00.000Z"), "lit-notebook-2026-10-12.json");
  assert.equal(exportFilename("webAnnotation", "2026-10-12T12:00:00.000Z"), "lit-notebook-2026-10-12.annotations.json");
});

test("describeLastExport says how long ago, or that it hasn't happened", () => {
  const now = "2026-10-12T12:00:00.000Z";
  assert.equal(describeLastExport(undefined, now), "Not saved yet.");
  assert.equal(describeLastExport("nonsense", now), "Not saved yet.");
  assert.equal(describeLastExport("2026-10-12T11:59:40.000Z", now), "Last saved a copy: just now.");
  assert.equal(describeLastExport("2026-10-12T11:30:00.000Z", now), "Last saved a copy: 30 minutes ago.");
  assert.equal(describeLastExport("2026-10-12T11:00:00.000Z", now), "Last saved a copy: 1 hour ago.");
  assert.equal(describeLastExport("2026-10-09T12:00:00.000Z", now), "Last saved a copy: 3 days ago.");
});
