// test/desk-sheet-templates.test.js
//
// The templates "New sheet" offers (src/lib/desk-sheet-templates.mjs): each
// makes a sheet that passes the record check, with formatted text already in
// the sanitizer's canonical form, and new ids on every call.

import { test } from "node:test";
import assert from "node:assert/strict";

import { validateRecord } from "../src/lib/desk-records.mjs";
import { sanitizeSheetHtml } from "../src/lib/desk-sheet-format.mjs";
import { createSheet, makeModule } from "../src/lib/desk-sheets.mjs";
import { READING_HINT, TEMPLATES, readingPart, templateModules } from "../src/lib/desk-sheet-templates.mjs";

const ctx = { client: "web/2026.10", contentVersion: "v20261012.1a2b3c4d" };

test("the templates are the five, in order", () => {
  assert.deepEqual(TEMPLATES.map((t) => t.id), ["bible-study", "sermon", "class", "lectio-divina", "blank"]);
  for (const t of TEMPLATES) {
    assert.ok(t.name && t.description, t.id);
    assert.doesNotMatch(`${t.name} ${t.description}`, /—|"|'/, `${t.id} copy uses an em dash or straight quote`);
  }
});

for (const { id } of TEMPLATES) {
  test(`${id}: a sheet made from it passes the record check`, () => {
    const sheet = createSheet({ template: id, modules: templateModules(id) }, ctx);
    assert.deepEqual(validateRecord(sheet), []);
    assert.equal(sheet.template, id);
    assert.ok(sheet.modules.length >= 1);
  });

  test(`${id}: ids are unique and new on each call, and there is at most one key terms box`, () => {
    const a = templateModules(id);
    const b = templateModules(id);
    assert.equal(new Set(a.map((m) => m.id)).size, a.length);
    const ids = new Set(a.map((m) => m.id));
    assert.ok(b.every((m) => !ids.has(m.id)));
    assert.ok(a.filter((m) => m.type === "keyTerms").length <= 1);
  });

  test(`${id}: formatted text is already canonical`, () => {
    for (const m of templateModules(id)) {
      for (const f of ["html", "answer"]) {
        if (typeof m[f] === "string") assert.equal(sanitizeSheetHtml(m[f]), m[f], `${id} ${m.type} ${f}`);
      }
    }
  });
}

test("the blank template is one empty text module", () => {
  const [m, ...rest] = templateModules("blank");
  assert.equal(rest.length, 0);
  assert.equal(m.type, "text");
  assert.equal(m.html, "");
});

test("the class template keeps the background for the leader and one answer", () => {
  const mods = templateModules("class");
  assert.equal(mods[2].leaderOnly, true);
  assert.equal(mods[3].answer, "<p>An answer for the leader’s copy.</p>");
  assert.equal(mods[4].answer, "");
});

test("an unknown template throws", () => {
  assert.throws(() => templateModules("nope"), /unknown template/);
  assert.throws(() => templateModules("toString"), /unknown template/);
  assert.throws(() => templateModules(), /unknown template/);
});

/* ── The reading part (BA69, BA70) ───────────────────────────────────── */

test("no template's text tells the reader about the editor, since it prints (BA70)", () => {
  for (const { id } of TEMPLATES) {
    for (const m of templateModules(id)) {
      assert.doesNotMatch(`${m.html ?? ""} ${m.answer ?? ""}`, /\+ Passage|LIT pane/, id);
    }
  }
  assert.match(READING_HINT, /\+ Passage/);
});

test("readingPart: each template's passage part, by its heading", () => {
  const heading = (id) => readingPart({ modules: templateModules(id) })?.html.match(/^<h2>([^<]*)/)[1] ?? null;
  assert.equal(heading("bible-study"), "Reading");
  assert.equal(heading("sermon"), "The text");
  assert.equal(heading("class"), "Reading");
  assert.equal(heading("lectio-divina"), "Read");
  assert.equal(heading("blank"), null);
});

test("readingPart: none once the sheet holds a passage", () => {
  const modules = templateModules("bible-study");
  modules.push(makeModule("passage", { bookKey: "romans", chapter: 8, verse: 28, endVerse: 28 }));
  assert.equal(readingPart({ modules }), null);
});

test("readingPart: a renamed heading, or a question part, isn't taken for it", () => {
  const renamed = makeModule("text", { html: "<h2>Our passage</h2>" });
  const q = makeModule("question", { html: "<h2>Reading</h2>" });
  assert.equal(readingPart({ modules: [renamed, q] }), null);
  const spaced = makeModule("text", { html: "<h3> The  Reading </h3><p>Slowly.</p>" });
  assert.equal(readingPart({ modules: [renamed, spaced] }), spaced);
  assert.equal(readingPart(null), null);
});
