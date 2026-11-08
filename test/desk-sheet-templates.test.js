// test/desk-sheet-templates.test.js
//
// The templates "New sheet" offers (src/lib/desk-sheet-templates.mjs): each
// makes a sheet that passes the record check, with formatted text already in
// the sanitizer's canonical form, and new ids on every call; and no part
// holds text that could print, only structure and a prompt (SH5-2).

import { test } from "node:test";
import assert from "node:assert/strict";

import { validateRecord } from "../src/lib/desk-records.mjs";
import { SHEET_LIMITS, sanitizeSheetHtml } from "../src/lib/desk-sheet-format.mjs";
import { createSheet, makeModule } from "../src/lib/desk-sheets.mjs";
import { TEMPLATES, readingPart, templateModules } from "../src/lib/desk-sheet-templates.mjs";

const ctx = { client: "web/2026.10", contentVersion: "v20261012.1a2b3c4d" };

test("the templates are the five, in order", () => {
  assert.deepEqual(TEMPLATES.map((t) => t.id), ["bible-study", "sermon", "class", "lectio-divina", "blank"]);
  for (const t of TEMPLATES) {
    assert.ok(t.name && t.description, t.id);
    // The parts line under the description was dropped (BVJ, 2026-11-08).
    assert.equal(t.parts, undefined, t.id);
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

test("the class template keeps the background for the leader, and one answer prompt", () => {
  const mods = templateModules("class");
  assert.equal(mods[2].leaderOnly, true);
  assert.match(mods[2].prompt, /leader’s version only/);
  assert.equal(mods[3].answer, "");
  assert.match(mods[3].answerPrompt, /^Optional\./);
  assert.equal(mods[4].answer, "");
  assert.equal(mods[4].answerPrompt, undefined);
});

/* ── Structure and prompts, never text that prints (SH5-2) ───────────── */

const prompts = (m) => [m.prompt, m.answerPrompt].filter((p) => p !== undefined);

for (const { id } of TEMPLATES) {
  test(`${id}: every text part is a heading alone (or empty) with a prompt, every question empty with one`, () => {
    for (const m of templateModules(id)) {
      if (m.type === "text") {
        assert.match(m.html, id === "blank" ? /^$/ : /^<h2>[^<]+<\/h2>$/, `${id}: ${m.html}`);
        if (id === "blank") assert.equal(m.prompt, undefined);
        else assert.ok(typeof m.prompt === "string" && m.prompt.length > 0, `${id} ${m.html} has no prompt`);
      } else if (m.type === "question") {
        assert.equal(m.html, "", id);
        assert.equal(m.answer, "", id);
        assert.equal(m.lines, 3, id);
        assert.ok(typeof m.prompt === "string" && m.prompt.length > 0, `${id} question has no prompt`);
      } else {
        assert.deepEqual(prompts(m), [], `${id} ${m.type} carries a prompt`);
      }
    }
  });

  test(`${id}: prompts are plain text within the limit, in the site's typography`, () => {
    for (const m of templateModules(id)) {
      for (const p of prompts(m)) {
        assert.equal(typeof p, "string");
        assert.ok(Array.from(p).length <= SHEET_LIMITS.prompt, `${id}: ${p}`);
        assert.doesNotMatch(p, /</, `${id}: ${p}`);
        assert.doesNotMatch(p, /—|"|'/, `${id} prompt uses an em dash or straight quote: ${p}`);
      }
    }
  });
}

test("the sermon template's key terms box is last (SH5-13)", () => {
  const mods = templateModules("sermon");
  assert.equal(mods.at(-1).type, "keyTerms");
  assert.equal(mods.filter((m) => m.type === "keyTerms").length, 1);
});

test("an unknown template throws", () => {
  assert.throws(() => templateModules("nope"), /unknown template/);
  assert.throws(() => templateModules("toString"), /unknown template/);
  assert.throws(() => templateModules(), /unknown template/);
});

/* ── The reading part (BA69, BA70) ───────────────────────────────────── */

test("no template's text tells the reader about the editor, since it prints (BA70)", () => {
  for (const { id } of TEMPLATES) {
    const modules = templateModules(id);
    const reading = readingPart({ modules });
    for (const m of modules) {
      assert.doesNotMatch(`${m.html ?? ""} ${m.answer ?? ""}`, /\+ Passage|LIT pane/, id);
      // Only the reading part's prompt may name the tools: it never prints.
      if (m === reading) continue;
      for (const p of prompts(m)) assert.doesNotMatch(p, /\+ Passage|LIT pane/, `${id}: ${p}`);
    }
  }
});

test("the reading part's prompt says how to add the passage (BA70, SH5-4)", () => {
  for (const id of ["bible-study", "sermon", "class"]) {
    const reading = readingPart({ modules: templateModules(id) });
    assert.match(reading.prompt, /form below/, id); // the form is open under the part (E61)
    assert.match(reading.html, /^<h2>[^<]+<\/h2>$/, id);
  }
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
