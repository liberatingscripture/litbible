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
import { TEMPLATES, keyTermsPlacement, readingPart, templateModules } from "../src/lib/desk-sheet-templates.mjs";

const ctx = { client: "web/2026.10", contentVersion: "v20261012.1a2b3c4d" };

test("the templates are the seven, in order", () => {
  assert.deepEqual(TEMPLATES.map((t) => t.id), ["bible-study", "sermon", "class", "lectio-divina", "swedish", "contextual", "blank"]);
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
  assert.equal(mods[4].leaderOnly, true);
  assert.match(mods[4].prompt, /leader’s version only/);
  assert.equal(mods[5].answer, "");
  assert.match(mods[5].answerPrompt, /^Optional\./);
  assert.equal(mods[6].answer, "");
  assert.equal(mods[6].answerPrompt, undefined);
});

test("the group templates open with Before you lead, for the leader alone (Audit 5, D #4)", () => {
  for (const id of ["bible-study", "class", "lectio-divina", "swedish", "contextual"]) {
    const [first] = templateModules(id);
    assert.equal(first.html, "<h2>Before you lead</h2>", id);
    assert.equal(first.leaderOnly, true, id);
    assert.match(first.prompt, /leader’s version only/, id);
  }
  for (const id of ["sermon", "blank"]) assert.notEqual(templateModules(id)[0].html, "<h2>Before you lead</h2>", id);
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

/* ── The key terms box before or after the reading (BVJ, 2026-11-08) ─── */

const kinds = (modules) => modules.map((m) => (m.type === "text" ? m.html.match(/^<h2>([^<]*)/)?.[1] ?? "text" : m.type));

test("Bible study and Class session start with the box just before the reading; Sermon keeps it last", () => {
  for (const id of ["bible-study", "class"]) {
    const mods = templateModules(id);
    const at = mods.findIndex((m) => m.type === "keyTerms");
    assert.equal(kinds(mods)[at + 1], "Reading", id);
    assert.equal(keyTermsPlacement({ modules: mods }).side, "before", id);
  }
  const sermon = templateModules("sermon");
  assert.equal(sermon.at(-1).type, "keyTerms");
  assert.equal(keyTermsPlacement({ modules: sermon }).side, "elsewhere");
});

test("keyTermsPlacement: the positions moveModule needs, against the passages once there are some", () => {
  const box = makeModule("keyTerms");
  const reading = makeModule("text", { html: "<h2>Reading</h2>" });
  const p1 = makeModule("passage", { bookKey: "romans", chapter: 8, verse: 1, endVerse: 4 });
  const p2 = makeModule("passage", { bookKey: "romans", chapter: 8, verse: 5, endVerse: 8 });
  const q = makeModule("question");
  const move = (modules, to) => {
    const rest = modules.filter((m) => m !== box);
    rest.splice(to, 0, box);
    return rest;
  };
  // after the passages: moving before puts it above the reading heading
  let mods = [reading, p1, p2, box, q];
  let where = keyTermsPlacement({ modules: mods });
  assert.equal(where.side, "after");
  mods = move(mods, where.before);
  assert.deepEqual(mods, [box, reading, p1, p2, q]);
  where = keyTermsPlacement({ modules: mods });
  assert.equal(where.side, "before");
  assert.deepEqual(move(mods, where.after), [reading, p1, p2, box, q]);
  // elsewhere, with no reading heading: against the first run of passages
  mods = [box, q, p1, p2];
  where = keyTermsPlacement({ modules: mods });
  assert.equal(where.side, "elsewhere");
  assert.deepEqual(move(mods, where.before), [q, box, p1, p2]);
  assert.deepEqual(move(mods, where.after), [q, p1, p2, box]);
  // no box, or nothing to place it against
  assert.equal(keyTermsPlacement({ modules: [reading, p1] }), null);
  assert.equal(keyTermsPlacement({ modules: [box, q] }), null);
});

test("the Swedish method: the three signs are headings, each with room to write, and the box after the reading", () => {
  const mods = templateModules("swedish");
  const heads = kinds(mods);
  for (const sign of ["Light: what shines out", "Question: what puzzles you", "Arrow: what speaks to you"]) {
    const at = heads.indexOf(sign);
    assert.ok(at > 0, sign);
    assert.equal(mods[at + 1].type, "space", sign);
  }
  assert.equal(keyTermsPlacement({ modules: mods }).side, "after");
  assert.equal(readingPart({ modules: mods }).html, "<h2>Reading</h2>");
});

test("Class session's questions observe, interpret, and apply (BVJ, 2026-11-08)", () => {
  const prompts = templateModules("class").filter((m) => m.type === "question").map((m) => m.prompt.split(":")[0]);
  assert.deepEqual(prompts, ["Observe", "Interpret", "Apply"]);
});

test("Contextual Bible Study: the group's reading, a close reading with the key terms, then context and action", () => {
  const heads = kinds(templateModules("contextual"));
  const at = (h) => heads.indexOf(h);
  assert.ok(at("Reading") < at("Reading closely"));
  assert.ok(at("Reading closely") < at("keyTerms") && at("keyTerms") < at("Our context"));
  assert.ok(at("Our context") < at("Action") && at("Action") < at("Closing"));
  assert.equal(readingPart({ modules: templateModules("contextual") }).html, "<h2>Reading</h2>");
});
