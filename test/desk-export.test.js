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
  MAX_NESTING,
  describeAhead,
  describeLastExport,
  describeSummary,
  escapeBody,
  exportFilename,
  nestedTooDeep,
  parseImport,
  parseReference,
  planChanges,
  planImport,
  planOpen,
  sameOpen,
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
  assert.equal(lines[1], "<!-- lit-notebook 1 · saved 2026-10-12 12:04 · 2026-10-12T12:04:00.000Z -->");
  assert.match(md, /^## Romans 8:3–4\n<!-- lit:id=00000000-0000-4000-8000-\d{12} modified=2026-09-12T08:00:00\.000Z -->\nhttps:\/\/litbible\.net\/romans-8\/#v3-4\nNote · 2026-09-12 · Labels: Prayer\n\n> rendered a verdict\n\nSelf-preservation as the drive\nto protect my standing\./m);
  assert.match(md, /^## John 3:16$/m);
  assert.match(md, /^Note \(question\) · 2026-09-12$/m);
  assert.match(md, /^Highlight \(yellow\) · 2026-09-12$/m);
  assert.match(md, /^## Glossary: Flesh$/m);
  assert.match(md, /^https:\/\/litbible\.net\/glossary\/#flesh-body$/m);
  assert.match(md, /^## Places\n- Thursday group: Luke 15:11 <!-- lit:id=\S+ -->$/m, "a list item carries no modified");
  assert.match(md, /^## Labels\n- Prayer <!-- lit:id=\S+ -->$/m);
  assert.ok(md.includes(LIT_CREDIT_LINE));
  assert.ok(md.includes("https://litbible.net/read/#license-terms"));
  assert.ok(!md.includes("gone"), "trash stays out");
  // Bible order: John (4th gospel) before Romans, Romans 4 before Romans 8.
  assert.ok(md.indexOf("## Mark 4:35") < md.indexOf("## John 3:16"));
  assert.ok(md.indexOf("## Romans 4:7") < md.indexOf("## Romans 8:3–4"));
});

test("escaping keeps a note's lines from being read as structure, and undoes cleanly", () => {
  const tricky = "## not a heading\n> not a quote\n<!-- not a comment -->\n\\already\n\\#both\nplain\n\\<kept\nmid \\< and < and <b>x</b>\n<!-- last -->";
  assert.equal(unescapeBody(escapeBody(tricky)), tricky);
  assert.ok(escapeBody(tricky).split("\n").slice(0, 5).every((l) => l.startsWith("\\")));
  assert.ok(!/(?<!\\)</.test(escapeBody(tricky)), "every < is escaped");
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
  assert.deepEqual(plan.summary, { added: 0, updated: 1, unchanged: 0, keptHere: 0, deleted: 0, trash: 0, skipped: 0 });
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

test("E10: an incoming note marked bookmark is kept, and reads as ribbon", () => {
  const old = make("note", { bookKey: "luke", chapter: 15, verse: 20, endVerse: 20, body: "Ran to meet him.", marker: "bookmark" });
  const out = planImport([], [old], { now: "2026-10-13T00:00:00.000Z" });
  assert.deepEqual(out.skipped, []);
  assert.deepEqual(out.plan.put, [{ ...old, marker: "ribbon" }]);
  assert.equal(out.plan.put[0].modified, old.modified, "renaming the marker isn't an edit");
  assert.equal(out.summary.added, 1);
  // The notebook holding it (read as ribbon) and a copy still saying bookmark agree.
  const again = planImport(out.plan.put, [old], { now: "2026-10-13T00:00:00.000Z" });
  assert.deepEqual(again.plan, { put: [], remove: [] });
  assert.equal(again.summary.unchanged, 1);
  // So does a note deleted while it said bookmark: undoing brings back a ribbon.
  const trash = planDelete(old, { ...ctx, now: "2026-10-01T00:00:00.000Z" }).trash;
  assert.equal(planImport([], [trash], { now: "2026-10-13T00:00:00.000Z" }).plan.put[0].record.marker, "ribbon");
});

test("E10: ribbon opens as itself, and an unknown marker is still skipped", () => {
  const ribbon = make("note", { bookKey: "luke", chapter: 15, verse: 21, endVerse: 21, body: "", marker: "ribbon" });
  const star = make("note", { bookKey: "luke", chapter: 15, verse: 22, endVerse: 22, body: "Robe.", marker: "star" });
  const out = planImport([], [ribbon, star], { now: "2026-10-13T00:00:00.000Z" });
  assert.deepEqual(out.plan.put, [ribbon]);
  assert.equal(out.skipped.length, 1);
  assert.equal(out.skipped[0].record, star);
  assert.match(out.skipped[0].reason, /^Marker "star" is not one of note, emphasis, question, heart, ribbon, lightbulb, flame\.$/);
});

test("E10: Markdown says ribbon, and an old copy's “Note (bookmark)” reads as ribbon", () => {
  const old = make("note", { bookKey: "luke", chapter: 15, verse: 20, endVerse: 20, body: "Ran to meet him.", marker: "bookmark" });
  assert.match(toMarkdown([old], opts), /^Note \(ribbon\) · /m);
  const text = `# My LIT notebook
## Luke 15:20
Note (bookmark) · 2026-10-01

Ran to meet him.
`;
  const back = parseImport(text, { local: [], ctx });
  assert.deepEqual(back.problems, []);
  assert.equal(back.records[0].marker, "ribbon");
  const unknown = parseImport(text.replace("(bookmark)", "(star)"), { local: [], ctx });
  assert.equal(unknown.records[0].marker, "note", "an unknown marker in Markdown is a plain note, as before");
});

test("planImport adds new records and leaves identical ones alone", () => {
  const out = planImport([romans], [romans, asked], { now: "2026-10-13T00:00:00.000Z" });
  assert.deepEqual(out.plan.put, [asked]);
  assert.deepEqual(out.plan.remove, []);
  assert.deepEqual(out.summary, { added: 1, updated: 0, unchanged: 1, keptHere: 0, deleted: 0, trash: 0, skipped: 0 });
});

test("planImport lets the newer writing win either way and says which copy stayed", () => {
  const theirs = later(romans, { body: "newer words" }, "2026-10-10T00:00:00.000Z");
  const a = planImport([romans], [theirs], { now: "2026-10-13T00:00:00.000Z" });
  assert.deepEqual(a.plan.put, [theirs]);
  assert.equal(a.summary.updated, 1);
  const b = planImport([theirs], [romans], { now: "2026-10-13T00:00:00.000Z" });
  assert.deepEqual(b.plan.put, []);
  assert.deepEqual(b.summary, { added: 0, updated: 0, unchanged: 0, keptHere: 1, deleted: 0, trash: 0, skipped: 0 });
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

test("planImport sanitizes a sheet's text whatever its format, in the trash too (BA66)", () => {
  // The audit's reproduction: a backup holding a sheet in a newer format,
  // whose text would run a script when the read-only Sheet pane drew it.
  const evil = '<p>Read<img src=x onerror="alert(document.domain)"></p>';
  const fields = {
    sheetFormat: 2,
    title: "From a newer version",
    subtitle: "",
    template: "blank",
    modules: [
      { id: "t", type: "text", html: evil },
      { id: "q", type: "question", html: evil, answer: evil, lines: 2 },
    ],
  };
  const newer = make("sheet", fields);
  const gone = planDelete(make("sheet", fields), { ...ctx, now: "2026-10-01T00:00:00.000Z" }).trash;
  const file = parseImport(toBackupJson([newer, gone], opts));
  const out = planImport([], file.records, { now: "2026-10-13T00:00:00.000Z" });
  assert.equal(out.plan.put.length, 2);
  for (const r of out.plan.put) assert.doesNotMatch(JSON.stringify(r), /onerror|<img/, r.kind);
  const sheetHere = out.plan.put.find((r) => r.id === newer.id);
  assert.equal(sheetHere.modules[0].html, "<p>Read</p>");
  assert.equal(sheetHere.sheetFormat, 2, "the rest of the record is carried as it arrived");
  // A sheet already clean is the same object, so a second import changes nothing.
  assert.equal(planChanges(planImport(out.plan.put, file.records, { now: "2026-10-13T00:00:00.000Z" }).plan), false);
});

/** `levels` objects nested one inside the next, the first being depth 1. */
function nest(levels) {
  let v = {};
  for (let i = 1; i < levels; i++) v = { in: v };
  return v;
}

test("nestedTooDeep counts the record itself as depth 1, and a limit of 64 by default", () => {
  assert.equal(MAX_NESTING, 64);
  assert.equal(nestedTooDeep({}), false);
  assert.equal(nestedTooDeep("text"), false);
  assert.equal(nestedTooDeep(null), false);
  assert.equal(nestedTooDeep(nest(MAX_NESTING)), false, "exactly at the limit");
  assert.equal(nestedTooDeep(nest(MAX_NESTING + 1)), true);
  assert.equal(nestedTooDeep(nest(3), 3), false);
  assert.equal(nestedTooDeep(nest(4), 3), true);
  // Arrays count as a level, and a wide record is not a deep one.
  assert.equal(nestedTooDeep({ a: [[{ b: 1 }]] }, 4), false);
  assert.equal(nestedTooDeep({ a: [[{ b: {} }]] }, 4), true);
  assert.equal(nestedTooDeep({ a: Array.from({ length: 5000 }, () => ({ b: 1 })) }), false);
});

test("nestedTooDeep reads a very deep value without overflowing the stack", () => {
  assert.equal(nestedTooDeep(nest(10000)), true);
});

test("planImport skips a record nested too deeply, live or in the trash, and still imports the rest", () => {
  // The audit's reproduction: a file whose record nests thousands deep, which a
  // browser would refuse to store (a structured-clone RangeError) halfway through.
  const deepNote = { ...make("note", { bookKey: "acts", chapter: 2, verse: 1, body: "x", marker: "note" }), extra: nest(10000) };
  const deepGone = { ...trash, id: nextId(), record: { ...trash.record, extra: nest(10000) } };
  const out = planImport([], [deepNote, yellow, deepGone, mark], { now: "2026-10-13T00:00:00.000Z" });
  assert.deepEqual(out.plan.put.sort((a, b) => (a.id < b.id ? -1 : 1)), [yellow, mark].sort((a, b) => (a.id < b.id ? -1 : 1)));
  assert.equal(out.skipped.length, 2);
  assert.equal(out.summary.skipped, 2);
  assert.deepEqual(out.skipped.map((s) => s.reason), ["It is nested too deeply to be kept.", "It is nested too deeply to be kept."]);
  assert.deepEqual(out.skipped.map((s) => s.record), [deepNote, deepGone]);
});

test("planImport keeps a record nested exactly to the limit, and a sheet inside a trash record is well within it", () => {
  // The record is depth 1, so its `extra` may hold the other 63 levels.
  const edge = { ...make("note", { bookKey: "acts", chapter: 2, verse: 2, body: "x", marker: "note" }), extra: nest(MAX_NESTING - 1) };
  const over = { ...make("note", { bookKey: "acts", chapter: 2, verse: 3, body: "x", marker: "note" }), extra: nest(MAX_NESTING) };
  const gone = planDelete(sheet, { ...ctx, now: "2026-10-01T00:00:00.000Z" }).trash;
  assert.equal(nestedTooDeep(edge), false);
  assert.equal(nestedTooDeep(over), true);
  assert.equal(nestedTooDeep(gone), false);
  const out = planImport([], [edge, over, gone], { now: "2026-10-13T00:00:00.000Z" });
  assert.deepEqual(out.plan.put.map((r) => r.id).sort(), [edge.id, gone.id].sort());
  assert.equal(out.summary.skipped, 1);
  assert.equal(out.skipped[0].record, over);
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

/* ── Opening an older copy (BA1, BA2, BA41, BA9, BA10) ─────────────────── */

const SAVED = opts.exported; // 2026-10-12T12:04:00.000Z
const DAY = 86400000;
const at = (iso, days) => new Date(Date.parse(iso) + days * DAY).toISOString();

test("an older copy opened after a local edit keeps the newer local words (BA1)", () => {
  const md = toMarkdown([romans, label], opts);
  const mine = later(romans, { body: "words I wrote after saving" }, at(SAVED, 1));
  const now = at(SAVED, 2);
  const back = parseImport(md, { local: [mine, label], ctx, now });
  assert.equal(back.records.length, 1);
  assert.equal(back.records[0].modified, romans.modified, "stamped with the file's own time, not now");
  const out = planImport([mine, label], back.records, { now });
  assert.equal(planChanges(out.plan), false);
  assert.deepEqual(out.summary, { added: 0, updated: 0, unchanged: 0, keptHere: 1, deleted: 0, trash: 0, skipped: 0 });
});

test("a note edited in the file and not here since still comes back as an edit stamped now (BA1)", () => {
  const md = toMarkdown([romans, label], opts).replace("to protect my standing.", "to guard my standing.");
  const now = at(SAVED, 2);
  const back = parseImport(md, { local: [romans, label], ctx, now });
  assert.equal(back.records[0].modified, now);
  assert.equal(back.records[0].body, "Self-preservation as the drive\nto guard my standing.");
  const out = planImport([romans, label], back.records, { now });
  assert.equal(out.summary.updated, 1);
  assert.equal(out.summary.keptHere, 0);
});

test("a copy saved before entries carried a time protects a newer local edit by the header's minute (BA1)", () => {
  const md = toMarkdown([romans, label], opts)
    .replace(/ modified=\S+/g, "")
    .replace(` · ${SAVED} -->`, " -->");
  assert.ok(!md.includes("modified="));
  assert.ok(md.includes("<!-- lit-notebook 1 · saved 2026-10-12 12:04 -->"));
  const now = at(SAVED, 2);
  // Edited here after the file was saved: kept.
  const mine = later(romans, { body: "words I wrote after saving" }, at(SAVED, 1));
  const kept = parseImport(md, { local: [mine, label], ctx, now });
  const keptOut = planImport([mine, label], kept.records, { now });
  assert.equal(planChanges(keptOut.plan), false);
  assert.equal(keptOut.summary.keptHere, 1);
  // Last touched here before the minute it was saved: the difference is an edit in the file.
  const edited = md.replace("to protect my standing.", "to guard my standing.");
  const taken = parseImport(edited, { local: [romans, label], ctx, now });
  assert.equal(taken.records[0].modified, now);
  // The minute is rounded down, so a local edit inside that minute still counts as newer.
  const inside = later(romans, { body: "mid-minute" }, "2026-10-12T12:04:30.000Z");
  const tie = parseImport(md, { local: [inside, label], ctx, now });
  assert.equal(planImport([inside, label], tie.records, { now }).summary.keptHere, 1);
});

test("a file with no time at all never overwrites a differing note (BA1)", () => {
  const md = toMarkdown([romans, label], opts)
    .replace(/ modified=\S+/g, "")
    .replace(/<!-- lit-notebook[^\n]*-->/, "<!-- lit-notebook 1 -->")
    .replace("to protect my standing.", "to guard my standing.");
  const now = at(SAVED, 2);
  const back = parseImport(md, { local: [romans, label], ctx, now });
  assert.equal(back.records.length, 1);
  assert.equal(back.records[0].modified, romans.modified, "a tie, stamped with the local time");
  const out = planImport([romans, label], back.records, { now });
  assert.equal(planChanges(out.plan), false);
  assert.equal(out.summary.keptHere, 1);
  assert.equal(out.summary.updated, 0);
});

test("an older copy never brings back a note deleted here since it was saved (BA2)", () => {
  const fresh = make("note", { bookKey: "romans", chapter: 5, verse: 8, body: "While we were still sinners.", marker: "note" });
  const md = toMarkdown([fresh, label], opts);
  const gone = planDelete(fresh, { ...ctx, now: at(SAVED, 1) }).trash;
  const local = [label, gone];
  const now = at(SAVED, 2);
  const back = parseImport(md, { local, ctx, now });
  assert.deepEqual(back.records, [], "no note is made with that id");
  assert.equal(back.problems.length, 1);
  assert.equal(
    back.problems[0].message,
    "“Romans 5:8” has been deleted here since this copy was saved, so it was left out. It is in the trash, if you want it back.",
  );
  assert.equal(typeof back.problems[0].line, "number");
  const out = planImport(local, back.records, { now });
  assert.equal(planChanges(out.plan), false);
  assert.ok(!out.plan.put.some((r) => r.id === fresh.id || r.kind === "note"));
  assert.deepEqual(out.plan.remove, []);
});

test("a tombstone holds the id too, and the message leaves out the way back (BA2)", () => {
  const fresh = make("note", { bookKey: "romans", chapter: 5, verse: 8, body: "While we were still sinners.", marker: "note" });
  const md = toMarkdown([fresh], opts);
  const { record, ...tombstone } = planDelete(fresh, { ...ctx, now: at(SAVED, 1) }).trash;
  assert.ok(record && !("record" in tombstone));
  const back = parseImport(md, { local: [tombstone], ctx, now: at(SAVED, 2) });
  assert.deepEqual(back.records, []);
  assert.equal(back.problems.length, 1);
  assert.equal(back.problems[0].message, "“Romans 5:8” has been deleted here since this copy was saved, so it was left out.");
  assert.equal(planChanges(planImport([tombstone], back.records, { now: at(SAVED, 2) }).plan), false);
});

test("a note's typed HTML is escaped in the Markdown file and comes back identical (BA41)", () => {
  const html = "<b>bold</b> and <img src=x onerror=alert(1)>\n<!-- sneaky -->\n\\<kept\n<script>x</script>";
  const r = make("note", { bookKey: "romans", chapter: 8, verse: 1, body: html, marker: "note" });
  const md = toMarkdown([r], opts);
  const bodyLines = md.split("\n").filter((l) => /bold|sneaky|kept|script/.test(l));
  assert.equal(bodyLines.length, 4);
  for (const l of bodyLines) assert.doesNotMatch(l, /(?<!\\)</, l);
  assert.equal(unescapeBody(escapeBody(html)), html);
  const back = parseImport(md, { local: [r], ctx });
  assert.deepEqual(back.problems, []);
  assert.deepEqual(back.records, [r]);
});

test("an annotation list that isn't a list is a problem, not a throw (BA9)", () => {
  const text = JSON.stringify({ type: "AnnotationCollection", first: { items: "abc" } });
  let back;
  assert.doesNotThrow(() => {
    back = parseImport(text);
  });
  assert.equal(back.kind, "webAnnotation");
  assert.deepEqual(back.records, []);
  assert.deepEqual(back.problems, [{ line: null, message: "This file’s list of annotations couldn’t be read." }]);
});

test("a Markdown file of 80,000 headings is read in linear time (BA10)", () => {
  const text = ["# My LIT notebook", ...Array.from({ length: 80000 }, () => "## Romans 8:3")].join("\n");
  const start = performance.now();
  const back = parseImport(text, { local: [], ctx });
  const ms = performance.now() - start;
  assert.equal(back.kind, "markdown");
  assert.equal(back.problems.length, 80000);
  assert.ok(ms < 2000, `took ${Math.round(ms)} ms`);
});

/* ── words ─────────────────────────────────────────────────────────── */

test("describeSummary and the file names read in plain words", () => {
  assert.equal(describeSummary({ added: 3, updated: 1, unchanged: 12, keptHere: 0, deleted: 0, trash: 0, skipped: 0 }), "3 new, 1 updated, 12 already here.");
  assert.equal(describeSummary({ added: 0, updated: 0, unchanged: 0, keptHere: 0, deleted: 0, trash: 0, skipped: 0 }), "Nothing to open in this file.");
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

/* ── Notes on a footnote (M11) ───────────────────────────────────────── */

const FOOTNOTE = "Greek sarx, flesh; here the whole self turned inward.";
const footnoteNote = make("note", {
  bookKey: "romans",
  chapter: 8,
  verse: 3,
  footnote: FOOTNOTE,
  body: "Paul's own word for it.",
  marker: "question",
});
const plainFootnoteNote = make("note", { bookKey: "romans", chapter: 8, verse: 3, footnote: FOOTNOTE, body: "Just a note.", marker: "note" });

test("the Markdown file names a note on a footnote, and quotes the footnote", () => {
  const md = toMarkdown([footnoteNote, plainFootnoteNote], opts);
  assert.match(md, /^## Romans 8:3$/m);
  assert.match(md, /^Note on a footnote \(question\) · 2026-09-12$/m);
  assert.match(md, /^Note on a footnote · 2026-09-12$/m);
  assert.ok(md.includes(`> ${FOOTNOTE}`), "the footnote's text is the quoted line");
});

test("a note on a footnote read from a file with no matching id is refused, not made into a verse note", () => {
  const back = parseImport(toMarkdown([footnoteNote], opts), { local: [], ctx });
  assert.equal(back.records.length, 0, "no verse note comes of it");
  assert.equal(back.problems.length, 1);
  assert.match(back.problems[0].message, /note on a footnote/);
});

test("a note on a footnote whose id is in the notebook still takes an edit to its body", () => {
  const md = toMarkdown([footnoteNote], opts).replace("Paul's own word for it.", "Paul's own word for the self.");
  const now = "2026-10-13T09:00:00.000Z";
  const back = parseImport(md, { local: [footnoteNote], ctx, now });
  assert.deepEqual(back.problems, []);
  assert.equal(back.records.length, 1);
  const edited = back.records[0];
  assert.equal(edited.id, footnoteNote.id);
  assert.equal(edited.body, "Paul's own word for the self.");
  assert.equal(edited.footnote, FOOTNOTE, "the footnote it is on doesn't change");
  assert.equal(edited.modified, now);
});

test("the Web Annotation of a note on a footnote targets the footnote's text", () => {
  const c = webAnnotationCollection([footnoteNote], opts);
  const a = c.first.items.find((x) => x.lit.record.id === footnoteNote.id);
  assert.equal(a.motivation, "questioning");
  assert.deepEqual(a.target.selector.at(-1), { type: "TextQuoteSelector", exact: FOOTNOTE });
});

/* ── Merging and opening a copy (BA3, BA4, BA11) ───────────────────────── */

const applyPlan = (local, plan) => {
  const held = new Map(local.map((r) => [r.id, r]));
  for (const id of plan.remove) held.delete(id);
  for (const r of plan.put) held.set(r.id, r);
  return [...held.values()];
};
const NOTHING = "Nothing to open in this file.";

test("planOpen reads and plans a file; an unknown file gives a message, and sameOpen is false for it (BA3)", () => {
  const now = at(SAVED, 2);
  const file = toBackupJson([romans, asked, label], opts);
  const first = planOpen(file, { local: [romans, label], ctx, now });
  assert.equal(first.message, undefined);
  assert.equal(first.read.kind, "backup");
  assert.deepEqual(first.planned.plan.put, [asked]);
  assert.equal(first.sentence, "1 new, 2 already here.");
  assert.equal(first.ahead, null);

  const bad = planOpen("not a notebook at all", { local: [], ctx, now });
  assert.equal(typeof bad.message, "string");
  assert.ok(bad.message.length > 0);
  assert.equal(sameOpen(bad, first), false);
  assert.equal(sameOpen(first, bad), false);
  assert.equal(sameOpen(bad, bad), false);
});

test("opening the same file with nothing changed between reads the same, so Open goes ahead (BA3)", () => {
  const now = at(SAVED, 2);
  const file = toBackupJson([romans, asked, label], opts);
  const a = planOpen(file, { local: [romans, label], ctx, now });
  const b = planOpen(file, { local: [romans, label], ctx, now });
  assert.equal(sameOpen(a, b), true);
});

test("a note edited in another tab after the file was read isn’t overwritten when Open is pressed (BA3)", () => {
  const now = at(SAVED, 2);
  const theirs = later(romans, { body: "words from the file" }, "2026-10-10T00:00:00.000Z");
  const file = toBackupJson([theirs, label], opts);
  const local = [romans, label];
  const first = planOpen(file, { local, ctx, now });
  assert.equal(first.planned.summary.updated, 1);
  assert.deepEqual(first.planned.plan.put, [theirs]);

  const other = later(romans, { body: "words from the other tab, newer" }, at(SAVED, 1));
  const second = planOpen(file, { local: [other, label], ctx, now });
  assert.equal(sameOpen(first, second), false, "the reader is shown the new plan, not the old one");
  assert.equal(second.planned.summary.updated, 0);
  assert.equal(second.planned.summary.keptHere, 1);
  assert.equal(planChanges(second.planned.plan), false);
  assert.ok(!second.planned.plan.put.some((r) => r.id === romans.id), "the newer edit isn’t overwritten");
});

test("a note deleted in another tab after the file was read isn’t brought back when Open is pressed (BA3)", () => {
  const now = at(SAVED, 2);
  const theirs = later(romans, { body: "words from the file" }, "2026-10-10T00:00:00.000Z");
  const file = toBackupJson([theirs, label], opts);
  const first = planOpen(file, { local: [romans, label], ctx, now });
  assert.equal(first.planned.summary.updated, 1);

  const gone = planDelete(romans, { ...ctx, now: at(SAVED, 1) }).trash;
  const local = [gone, label];
  const second = planOpen(file, { local, ctx, now });
  assert.equal(sameOpen(first, second), false);
  assert.equal(second.planned.summary.keptHere, 1);
  // The deletion stands; the only change is the trash record, which now holds the file's newer words for an undo.
  assert.ok(second.planned.plan.put.every((r) => r.kind === "trash" && r.deletedId === romans.id));
  assert.deepEqual(second.planned.plan.remove, []);
  assert.equal(second.planned.summary.trash, 1);
  const after = applyPlan(local, second.planned.plan);
  assert.ok(!after.some((r) => r.id === romans.id), "the deleted note stays deleted");
  assert.ok(after.some((r) => r.kind === "trash" && r.deletedId === romans.id));
});

test("a Markdown copy replanned after an edit here keeps the edit (BA3)", () => {
  const now = at(SAVED, 2);
  const md = toMarkdown([romans, label], opts).replace("to protect my standing.", "to guard my standing.");
  const first = planOpen(md, { local: [romans, label], ctx, now });
  assert.equal(first.planned.summary.updated, 1);
  assert.equal(first.planned.plan.put[0].body, "Self-preservation as the drive\nto guard my standing.");

  const mine = later(romans, { body: "words I wrote in the meantime" }, at(SAVED, 1));
  const second = planOpen(md, { local: [mine, label], ctx, now });
  assert.equal(sameOpen(first, second), false);
  assert.equal(planChanges(second.planned.plan), false);
  assert.equal(second.planned.summary.keptHere, 1);
});

/* BA11: the summary counts every write */

test("a trash record in the file with a live note’s own id never replaces the note, and is reported (BA11)", () => {
  const now = at(SAVED, 2);
  const impostor = { ...planDelete(asked, { ...ctx, now: at(SAVED, 1) }).trash, id: romans.id };
  assert.notEqual(impostor.deletedId, impostor.id);
  const file = toBackupJson([impostor], opts);
  const local = [romans, label];
  const open = planOpen(file, { local, ctx, now });
  assert.equal(planChanges(open.planned.plan), false);
  assert.deepEqual(open.planned.plan.remove, []);
  assert.ok(!open.planned.plan.put.some((r) => r.id === romans.id));
  assert.equal(open.planned.skipped.length, 1);
  assert.equal(open.planned.summary.skipped, 1);
  assert.equal(open.planned.summary.added, 0);
  assert.notEqual(open.sentence, NOTHING);
  assert.match(open.sentence, /1 left out/);
  assert.deepEqual(applyPlan(local, open.planned.plan).find((r) => r.id === romans.id), romans);
});

test("whenever a plan changes anything, its sentence never says there is nothing to open (BA11)", () => {
  const now = at(SAVED, 2);
  const cases = [];

  // A file of trash records for notes that were never in this notebook.
  const strangers = [
    planDelete(make("note", { bookKey: "acts", chapter: 7, verse: 1, body: "one", marker: "note" }), { ...ctx, now: at(SAVED, -1) }).trash,
    planDelete(make("note", { bookKey: "acts", chapter: 7, verse: 2, body: "two", marker: "note" }), { ...ctx, now: at(SAVED, -1) }).trash,
  ];
  cases.push({ name: "only trash records for notes never here", local: [romans], incoming: strangers, expect: /2 changes in the trash/ });
  cases.push({ name: "one such trash record", local: [romans], incoming: [strangers[0]], expect: /1 change in the trash/ });

  // A local trash record past its 30 days, which the merge empties.
  const old = planDelete(make("note", { bookKey: "acts", chapter: 8, verse: 1, body: "old", marker: "note" }), { ...ctx, now: at(now, -45) }).trash;
  assert.ok("record" in old);
  cases.push({ name: "a local trash record past 30 days", local: [old], incoming: [yellow], expect: /1 change in the trash/ });

  // A new record, an update, a deletion by the file.
  cases.push({ name: "a new record", local: [], incoming: [asked], expect: /1 new/ });
  const newer = later(romans, { body: "newer" }, at(SAVED, -1));
  cases.push({ name: "an update", local: [romans], incoming: [newer], expect: /1 updated/ });
  const theirTrash = planDelete(romans, { ...ctx, now: at(SAVED, 1) }).trash;
  cases.push({ name: "a deletion in the file", local: [romans], incoming: [theirTrash], expect: /1 deleted/ });

  // The audit’s scenario.
  const impostor = { ...planDelete(asked, { ...ctx, now: at(SAVED, 1) }).trash, id: romans.id };
  cases.push({ name: "a trash record with a live note’s id", local: [romans], incoming: [impostor], expect: /1 left out/, noChange: true });

  for (const c of cases) {
    const out = planImport(c.local, c.incoming, { now });
    const sentence = describeSummary(out.summary);
    if (c.noChange) assert.equal(planChanges(out.plan), false, c.name);
    else assert.equal(planChanges(out.plan), true, c.name);
    if (planChanges(out.plan)) assert.notEqual(sentence, NOTHING, c.name);
    assert.notEqual(sentence, NOTHING, c.name);
    assert.match(sentence, c.expect, c.name);
  }
});

test("a file of trash records for notes never here counts them in summary.trash, not as new notes (BA11)", () => {
  const now = at(SAVED, 2);
  const strangers = [
    planDelete(make("note", { bookKey: "acts", chapter: 7, verse: 3, body: "three", marker: "note" }), { ...ctx, now: at(SAVED, -1) }).trash,
    planDelete(make("note", { bookKey: "acts", chapter: 7, verse: 4, body: "four", marker: "note" }), { ...ctx, now: at(SAVED, -1) }).trash,
  ];
  const out = planImport([romans], strangers, { now });
  assert.equal(out.plan.put.length, 2);
  assert.equal(out.summary.trash, 2);
  assert.equal(out.summary.added, 0);
  assert.equal(describeSummary(out.summary), "2 changes in the trash.");
});

test("a local trash record past its 30 days is emptied by the merge and counted as a change in the trash (BA11)", () => {
  const now = at(SAVED, 2);
  const old = planDelete(make("note", { bookKey: "acts", chapter: 8, verse: 2, body: "old", marker: "note" }), { ...ctx, now: at(now, -45) }).trash;
  const out = planImport([old], [], { now });
  assert.equal(out.plan.put.length, 1);
  assert.equal(out.plan.put[0].id, old.id);
  assert.ok(!("record" in out.plan.put[0]), "only the tombstone is kept");
  assert.equal(out.summary.trash, 1);
  assert.equal(describeSummary(out.summary), "1 change in the trash.");
  // And a second pass has nothing left to empty.
  assert.equal(planChanges(planImport(applyPlan([old], out.plan), [], { now }).plan), false);
});

test("describeSummary counts changes in the trash and still says nothing only when nothing happens (BA11)", () => {
  const zero = { added: 0, updated: 0, unchanged: 0, keptHere: 0, deleted: 0, trash: 0, skipped: 0 };
  assert.equal(describeSummary({ ...zero, trash: 1 }), "1 change in the trash.");
  assert.equal(describeSummary({ ...zero, trash: 3, added: 1 }), "1 new, 3 changes in the trash.");
  assert.equal(describeSummary(zero), NOTHING);
});

/* BA4: a clock running ahead */

test("a Markdown file saved by a fast clock never beats an edit made here, and opening it twice changes nothing (BA4)", () => {
  const now = at(SAVED, 2);
  const fast = at(now, 30); // the file claims to be from a month from now
  const filed = later(romans, { body: "words from a fast clock" }, fast);
  const md = toMarkdown([filed, label], { ...opts, exported: fast });
  assert.ok(md.includes(fast.slice(0, 10)), "the file really is dated ahead");

  const mine = later(romans, { body: "my edit made here" }, at(SAVED, 1));
  const local = [mine, label];
  const back = parseImport(md, { local, ctx, now });
  assert.equal(back.records.length, 1);
  assert.equal(back.records[0].modified, mine.modified, "a time later than now counts as no time: a tie, stamped with the local time");
  const first = planImport(local, back.records, { now });
  assert.equal(planChanges(first.plan), false);
  assert.equal(first.summary.keptHere, 1);
  assert.equal(first.summary.updated, 0);

  // Opened again, even a day on (the file is still ahead), nothing changes.
  const nextDay = at(now, 1);
  const held = applyPlan(local, first.plan);
  const again = parseImport(md, { local: held, ctx, now: nextDay });
  const second = planImport(held, again.records, { now: nextDay });
  assert.equal(planChanges(second.plan), false);
  assert.deepEqual(held.find((r) => r.id === romans.id), mine);
});

test("a Markdown entry dated ahead on its own, in a file whose header isn’t, is also read as no time (BA4)", () => {
  const now = at(SAVED, 2);
  const filed = later(romans, { body: "words from a fast clock" }, at(now, 10));
  const md = toMarkdown([filed, label], opts); // header: SAVED, in the past
  const mine = later(romans, { body: "my edit made here" }, at(SAVED, 1));
  const back = parseImport(md, { local: [mine, label], ctx, now });
  const out = planImport([mine, label], back.records, { now });
  assert.equal(planChanges(out.plan), false);
  assert.equal(out.summary.keptHere, 1);
});

test("a backup says when it was saved, and a Markdown file doesn’t (BA4)", () => {
  const back = parseImport(toBackupJson([romans], opts));
  assert.equal(back.exported, opts.exported);
  const annotations = parseImport(JSON.stringify(webAnnotationCollection([romans], opts)));
  assert.equal(annotations.kind, "webAnnotation");
  assert.equal(annotations.exported, opts.exported);
  assert.equal(parseImport(toMarkdown([romans], opts), { local: [], ctx }).exported, undefined);
  assert.equal(parseImport(JSON.stringify({ format: "lit-notebook", version: 1, exported: "not a time", records: [] })).exported, undefined);
});

test("a record in a backup dated after the backup is capped at the backup’s time, and never replaces yours (BA4)", () => {
  const now = at(SAVED, 2);
  const filed = later(romans, { body: "from a clock running ahead" }, at(SAVED, 1)); // after the file’s own time
  const file = toBackupJson([filed, label], opts);
  const read = parseImport(file);
  assert.equal(read.exported, SAVED);

  // Yours is older than the file’s time and the record’s claim, but the claim can’t be ordered: yours stays.
  const a = planImport([romans, label], read.records, { now, exported: read.exported });
  assert.equal(planChanges(a.plan), false);
  assert.ok(!a.plan.put.some((r) => r.id === romans.id));
  assert.equal(a.ahead.length, 1);
  assert.equal(a.ahead[0].written, false);
  assert.deepEqual(a.ahead[0].record, filed, "the record as it arrived");

  // Without the file’s time the cap would be now, and the same record would win.
  const b = planImport([romans, label], read.records, { now });
  assert.equal(b.ahead.length, 0);
  assert.equal(b.plan.put.find((r) => r.id === romans.id).body, "from a clock running ahead");

  // A record dated ahead that nothing here holds is added, at the cap.
  const fresh = make("note", { bookKey: "romans", chapter: 5, verse: 1, body: "new, from the fast clock", marker: "note" }, at(SAVED, 1));
  const c = planImport([label], [fresh], { now, exported: SAVED });
  assert.equal(c.plan.put.length, 1);
  assert.equal(c.plan.put[0].id, fresh.id);
  assert.equal(c.plan.put[0].modified, SAVED, "written with the capped time");
  assert.deepEqual(c.ahead, [{ record: fresh, written: true }]);
  assert.equal(c.summary.added, 1);
});

test("a deletion dated ahead in a backup doesn’t delete a note here, and opening twice agrees (BA4)", () => {
  const now = at(SAVED, 2);
  const gone = planDelete(romans, { ...ctx, now: at(SAVED, 1) }).trash; // dated after the file’s time
  const file = toBackupJson([gone], opts);
  const local = [romans, label];
  const first = planOpen(file, { local, ctx, now });
  assert.equal(planChanges(first.planned.plan), false);
  assert.deepEqual(first.planned.plan.remove, []);
  assert.equal(first.planned.ahead.length, 1);
  assert.match(first.ahead, /dated by a clock running ahead/);
  const second = planOpen(file, { local: applyPlan(local, first.planned.plan), ctx, now: at(now, 5) });
  assert.equal(planChanges(second.planned.plan), false);
});

test("describeAhead says what happened to one record kept here, one added, and a mix (BA4)", () => {
  const rec = { id: "a" };
  assert.equal(describeAhead([]), null);
  assert.equal(describeAhead(undefined), null);
  assert.equal(
    describeAhead([{ record: rec, written: false }]),
    "One record in this file was dated by a clock running ahead. Such a record never replaces, deletes or brings back anything here: yours is kept as it is.",
  );
  assert.equal(
    describeAhead([{ record: rec, written: true }]),
    "One record in this file was dated by a clock running ahead. Such a record never replaces, deletes or brings back anything here: it was added with an earlier date.",
  );
  assert.equal(
    describeAhead([{ record: rec, written: false }, { record: rec, written: false }]),
    "2 records in this file were dated by a clock running ahead. Such a record never replaces, deletes or brings back anything here: yours are kept as they are.",
  );
  assert.equal(
    describeAhead([{ record: rec, written: true }, { record: rec, written: true }]),
    "2 records in this file were dated by a clock running ahead. Such a record never replaces, deletes or brings back anything here: they were added with an earlier date.",
  );
  assert.equal(
    describeAhead([{ record: rec, written: true }, { record: rec, written: false }]),
    "2 records in this file were dated by a clock running ahead. Such a record never replaces, deletes or brings back anything here: 1 added with an earlier date, and yours kept for the other.",
  );
});

test("planOpen carries the ahead sentence, and a different one makes sameOpen false (BA4, BA3)", () => {
  const now = at(SAVED, 2);
  const filed = later(romans, { body: "from a clock running ahead" }, at(SAVED, 1));
  const file = toBackupJson([filed, label], opts);
  const open = planOpen(file, { local: [romans, label], ctx, now });
  assert.equal(open.ahead, describeAhead(open.planned.ahead));
  assert.match(open.ahead, /yours is kept as it is/);
  assert.equal(sameOpen(open, { ...open, ahead: null }), false);
  assert.equal(sameOpen(open, { ...open, sentence: "something else." }), false);
  assert.equal(sameOpen(open, { ...open }), true);
});
