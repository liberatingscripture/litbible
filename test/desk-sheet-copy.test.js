// test/desk-sheet-copy.test.js
//
// What a sheet on paper holds (STUDY-DESK.md, "Order of work", 3i): the pure
// module src/lib/desk-sheet-copy.mjs. Covers the leader and participant copies,
// the chapter codes, the key terms box as each copy prints it, the sheet's own
// formatted words, the paper, and the plain-text blank.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

import {
  COPIES,
  COPY_NAMES,
  PAPERS,
  SITE,
  blankedTermsNote,
  chapterCodes,
  defaultPaper,
  keyTermsForCopy,
  modulesForCopy,
  pageRule,
  paperName,
  plainBlank,
  sheetHtmlForShow,
  verseUrl,
} from "../src/lib/desk-sheet-copy.mjs";

/* ── Constants ───────────────────────────────────────────────────────── */

test("COPIES and COPY_NAMES: the two copies, by name", () => {
  assert.deepEqual([...COPIES], ["leader", "participant"]);
  assert.equal(COPY_NAMES.leader, "Leader copy");
  assert.equal(COPY_NAMES.participant, "Participant copy");
  assert.equal(SITE, "https://litbible.net");
});

/* ── modulesForCopy ──────────────────────────────────────────────────── */

test("modulesForCopy: the participant copy drops leader-only modules, the leader's keeps them", () => {
  const sheet = {
    modules: [
      { type: "text", html: "<p>Hello</p>" },
      { type: "question", text: "Why?", leaderOnly: true },
      { type: "space", leaderOnly: false },
    ],
  };
  assert.deepEqual(
    modulesForCopy(sheet, "participant").map((m) => m.type),
    ["text", "space"],
  );
  assert.deepEqual(
    modulesForCopy(sheet, "leader").map((m) => m.type),
    ["text", "question", "space"],
  );
});

test("modulesForCopy: a module of an unknown type prints on neither copy", () => {
  const sheet = { modules: [{ type: "video", src: "x" }, { type: "text", html: "" }] };
  assert.deepEqual(
    modulesForCopy(sheet, "leader").map((m) => m.type),
    ["text"],
  );
  assert.deepEqual(
    modulesForCopy(sheet, "participant").map((m) => m.type),
    ["text"],
  );
});

test("modulesForCopy: null entries are skipped; an empty or missing sheet gives nothing", () => {
  assert.deepEqual(modulesForCopy({ modules: [null, { type: "space" }] }, "leader").length, 1);
  assert.deepEqual(modulesForCopy({ modules: [] }, "leader"), []);
  assert.deepEqual(modulesForCopy({}, "participant"), []);
  assert.deepEqual(modulesForCopy(null, "leader"), []);
  assert.deepEqual(modulesForCopy(undefined, "participant"), []);
});

/* ── verseUrl ────────────────────────────────────────────────────────── */

test("verseUrl: a single verse", () => {
  assert.equal(verseUrl("romans", 8, 1), "https://litbible.net/romans-8/#v1");
});

test("verseUrl: a range", () => {
  assert.equal(verseUrl("romans", 8, 1, 4), "https://litbible.net/romans-8/#v1-4");
});

test("verseUrl: an endVerse equal to the verse gives no range", () => {
  assert.equal(verseUrl("romans", 8, 1, 1), "https://litbible.net/romans-8/#v1");
  assert.equal(verseUrl("romans", 8, 28, 28), "https://litbible.net/romans-8/#v28");
});

test("verseUrl: no verse gives the chapter address alone", () => {
  assert.equal(verseUrl("romans", 8, null), "https://litbible.net/romans-8/");
});

/* ── chapterCodes ────────────────────────────────────────────────────── */

test("chapterCodes: one code per chapter, in the order the copy first quotes each", () => {
  const modules = [
    { type: "passage", id: "p1", bookKey: "romans", chapter: 8, verse: 1, endVerse: 4 },
    { type: "passage", id: "p2", bookKey: "john", chapter: 3, verse: 16 },
    { type: "passage", id: "p3", bookKey: "romans", chapter: 8, verse: 28 },
  ];
  const codes = chapterCodes(modules);
  assert.deepEqual(
    codes.map((c) => c.key),
    ["romans-8", "john-3"],
  );
});

test("chapterCodes: a second passage from the same chapter adds nothing, and the url uses the first passage's range", () => {
  const modules = [
    { type: "passage", id: "first", bookKey: "romans", chapter: 8, verse: 1, endVerse: 4 },
    { type: "passage", id: "second", bookKey: "romans", chapter: 8, verse: 28, endVerse: 30 },
  ];
  const codes = chapterCodes(modules);
  assert.equal(codes.length, 1);
  assert.equal(codes[0].url, "https://litbible.net/romans-8/#v1-4");
  assert.equal(codes[0].moduleId, "first");
});

test("chapterCodes: the printable address, the label and the module id", () => {
  const [code] = chapterCodes([
    { type: "passage", id: "m7", bookKey: "romans", chapter: 8, verse: 28 },
  ]);
  assert.equal(code.printable, "litbible.net/romans-8");
  assert.equal(code.label, "Romans 8");
  assert.equal(code.moduleId, "m7");
  assert.equal(code.url, "https://litbible.net/romans-8/#v28");
  assert.equal(code.bookKey, "romans");
  assert.equal(code.chapter, 8);
});

test("chapterCodes: a numbered book's label comes from the book list", () => {
  const [code] = chapterCodes([{ type: "passage", id: "c", bookKey: "1corinthians", chapter: 13, verse: 4 }]);
  assert.equal(code.label, "1 Corinthians 13");
  assert.equal(code.key, "1corinthians-13");
  assert.equal(code.printable, "litbible.net/1corinthians-13");
});

test("chapterCodes: a passage with no verse opens the chapter itself", () => {
  const [code] = chapterCodes([{ type: "passage", id: "c", bookKey: "romans", chapter: 8 }]);
  assert.equal(code.url, "https://litbible.net/romans-8/");
});

test("chapterCodes: non-passage modules are ignored, as are malformed passages", () => {
  const modules = [
    { type: "text", bookKey: "romans", chapter: 8, html: "" },
    { type: "question", bookKey: "romans", chapter: 8, text: "Why?" },
    { type: "passage", id: "no-book", chapter: 8, verse: 1 },
    { type: "passage", id: "bad-chapter", bookKey: "romans", chapter: "8", verse: 1 },
    null,
  ];
  assert.deepEqual(chapterCodes(modules), []);
  assert.deepEqual(chapterCodes(undefined), []);
});

/* ── keyTermsForCopy ─────────────────────────────────────────────────── */

const TERMS = [
  { id: "hamartia", renderings: ["deviation"], traditional: "sin", greek: "hamartia" },
  { id: "sarx", renderings: ["self-preservation", "family"], traditional: "flesh", greek: "sarx" },
  { id: "gone", renderings: ["grace"], traditional: "grace", greek: "charis", omitted: true },
];

test("keyTermsForCopy: omitted terms are dropped on both copies", () => {
  for (const copy of ["leader", "participant"]) {
    const { terms } = keyTermsForCopy(TERMS, [], copy);
    assert.deepEqual(
      terms.map((t) => t.id),
      ["hamartia", "sarx"],
    );
  }
});

test("keyTermsForCopy: on the participant copy a rendering sharing a word stem with a blank prints blank", () => {
  const { terms, blanked } = keyTermsForCopy(TERMS, [{ exact: "deviating" }], "participant");
  const hamartia = terms.find((t) => t.id === "hamartia");
  assert.deepEqual(hamartia.renderings, [{ text: "deviation", blank: true }]);
  assert.equal(blanked, 1);
});

test("keyTermsForCopy: blanked counts terms, not renderings", () => {
  // Both renderings of "sarx" would be blanked by a blank on "families".
  const blanks = [{ exact: "families" }, { exact: "preserving" }];
  const { terms, blanked } = keyTermsForCopy(TERMS, blanks, "participant");
  const sarx = terms.find((t) => t.id === "sarx");
  assert.equal(sarx.renderings.filter((r) => r.blank).length, 2);
  assert.equal(blanked, 1);
  // A second term blanked by a different word counts too.
  const more = keyTermsForCopy(TERMS, [{ exact: "deviating" }, { exact: "family" }], "participant");
  assert.equal(more.blanked, 2);
});

test("keyTermsForCopy: on the leader copy nothing is blank and blanked is 0", () => {
  const { terms, blanked } = keyTermsForCopy(TERMS, [{ exact: "deviating" }, { exact: "family" }], "leader");
  assert.equal(blanked, 0);
  for (const t of terms) for (const r of t.renderings) assert.equal(r.blank, false);
  assert.equal(terms.find((t) => t.id === "hamartia").renderings[0].text, "deviation");
});

test("keyTermsForCopy: blanks unrelated to any rendering blank nothing", () => {
  const { terms, blanked } = keyTermsForCopy(TERMS, [{ exact: "grace" }], "participant");
  assert.equal(blanked, 0);
  for (const t of terms) for (const r of t.renderings) assert.equal(r.blank, false);
});

test("keyTermsForCopy: keeps traditional and greek, and tolerates missing lists", () => {
  const { terms } = keyTermsForCopy(TERMS, [], "leader");
  assert.equal(terms[0].traditional, "sin");
  assert.equal(terms[0].greek, "hamartia");
  assert.deepEqual(keyTermsForCopy(null, null, "participant"), { terms: [], blanked: 0 });
});

/* ── blankedTermsNote ────────────────────────────────────────────────── */

test("blankedTermsNote: none gives no line", () => {
  assert.equal(blankedTermsNote(0), "");
});

test("blankedTermsNote: one term", () => {
  assert.equal(blankedTermsNote(1), "One term is left blank here. Its answer is on the leader copy.");
});

test("blankedTermsNote: two or more terms", () => {
  assert.equal(blankedTermsNote(2), "2 terms are left blank here. Their answers are on the leader copy.");
  assert.equal(blankedTermsNote(5), "5 terms are left blank here. Their answers are on the leader copy.");
});

/* ── sheetHtmlForShow ────────────────────────────────────────────────── */

test("sheetHtmlForShow: strips a script and an onclick", () => {
  const out = sheetHtmlForShow('<p onclick="steal()">Hello</p><script>alert(1)</script>');
  assert.equal(out.includes("<script"), false);
  assert.equal(out.includes("alert"), false);
  assert.equal(out.includes("onclick"), false);
  assert.equal(out.includes("steal"), false);
  assert.ok(out.includes("Hello"));
});

test("no desk script draws a sheet's stored html without sheetHtmlForShow (BA66)", () => {
  // The read-only Sheet pane once did `box.innerHTML = html`, and a sheet in
  // a newer format, never checked by validateSheet, ran its own script.
  const dir = new URL("../src/scripts/desk/", import.meta.url);
  const raw = /\.innerHTML\s*=(?!\s*sheetHtmlForShow\()[^;`"'\n]*\b(?:html|answer)\b/;
  assert.match("box.innerHTML = html ?? \"\";", raw, "the old line is caught");
  assert.match("box.innerHTML = m.answer;", raw);
  for (const name of readdirSync(dir).filter((f) => /sheet.*\.js$/.test(f))) {
    const src = readFileSync(new URL(name, dir), "utf8");
    assert.doesNotMatch(src, raw, name);
  }
  assert.match(readFileSync(new URL("sheet-pane.js", dir), "utf8"), /innerHTML = sheetHtmlForShow\(html\)/);
});

test("sheetHtmlForShow: strips the attack from a sheet in a newer format (BA66)", () => {
  const out = sheetHtmlForShow('<p>Read<img src=x onerror="alert(document.domain)"></p><svg onload="x()"></svg>');
  assert.equal(out, "<p>Read</p>");
});

test("sheetHtmlForShow: links a typed scripture reference", () => {
  const out = sheetHtmlForShow("<p>Read Romans 8:28 today.</p>");
  assert.ok(out.includes('class="sref"'), out);
  assert.ok(out.includes("/romans-8/#v28"), out);
});

test("sheetHtmlForShow: reads references in note mode, as a note does (BVJ, 2026-10-29)", () => {
  const list = sheetHtmlForShow("<p>Romans 8:28, 30</p>");
  assert.ok(list.includes("/romans-8/#v28"), list);
  assert.ok(!list.includes("#v30"), list);
  const short = sheetHtmlForShow("<p>See jn 3:16.</p>");
  assert.ok(short.includes("/john-3/#v16"), short);
  assert.ok(!sheetHtmlForShow("<p>Luke 2:100</p>").includes('class="sref"'));
});

test("sheetHtmlForShow: an external http link opens in a new tab", () => {
  const out = sheetHtmlForShow('<p><a href="https://example.com/page">a page</a></p>');
  assert.ok(out.includes('href="https://example.com/page"'), out);
  assert.ok(out.includes('target="_blank"'), out);
  assert.ok(out.includes('rel="noopener noreferrer"'), out);
});

test("sheetHtmlForShow: empty or missing input gives an empty string", () => {
  assert.equal(sheetHtmlForShow(""), "");
  assert.equal(sheetHtmlForShow(null), "");
  assert.equal(sheetHtmlForShow(undefined), "");
});

/* ── Paper ───────────────────────────────────────────────────────────── */

test("defaultPaper: en-US is Letter", () => {
  assert.equal(defaultPaper(["en-US"]), "letter");
});

test("defaultPaper: en-GB is A4", () => {
  assert.equal(defaultPaper(["en-GB"]), "a4");
});

test("defaultPaper: a bare en is taken as the United States, so Letter", () => {
  assert.equal(defaultPaper(["en"]), "letter");
});

test("defaultPaper: de is A4", () => {
  assert.equal(defaultPaper(["de"]), "a4");
});

test("defaultPaper: Latin American and Canadian regions are Letter", () => {
  assert.equal(defaultPaper(["es-MX"]), "letter");
  assert.equal(defaultPaper(["fr-CA"]), "letter");
});

test("defaultPaper: no languages gives Letter", () => {
  assert.equal(defaultPaper([]), "letter");
  assert.equal(defaultPaper(undefined), "letter");
});

test("defaultPaper: a garbage tag is skipped and the next one decides", () => {
  assert.equal(defaultPaper(["not a tag!!", "en-GB"]), "a4");
  assert.equal(defaultPaper(["not a tag!!", "en-US"]), "letter");
});

test("paperName: the two papers pass, anything else is null", () => {
  assert.equal(paperName("letter"), "letter");
  assert.equal(paperName("a4"), "a4");
  assert.equal(paperName("a3"), null);
  assert.equal(paperName("LETTER"), null);
  assert.equal(paperName(undefined), null);
  assert.equal(paperName("constructor"), null);
});

test("PAPERS: the two papers and their sizes", () => {
  assert.equal(PAPERS.letter.name, "US Letter");
  assert.equal(PAPERS.a4.name, "A4");
});

test("pageRule: a4 gives A4", () => {
  const rule = pageRule("a4");
  assert.ok(rule.includes("size: A4"), rule);
  assert.equal(rule, "@page { size: A4; margin: 18mm; }");
});

test("pageRule: letter gives letter, and a bad value falls back to letter", () => {
  assert.equal(pageRule("letter"), "@page { size: letter; margin: 0.75in; }");
  assert.equal(pageRule("bogus"), pageRule("letter"));
  assert.equal(pageRule(undefined), pageRule("letter"));
});

/* ── plainBlank ──────────────────────────────────────────────────────── */

test("plainBlank: a bare line without a hint", () => {
  assert.equal(plainBlank(), "________");
  assert.equal(plainBlank(""), "________");
  assert.equal(plainBlank(null), "________");
});

test("plainBlank: the hint follows the line in brackets", () => {
  assert.equal(plainBlank("traditionally flesh"), "________ (traditionally flesh)");
});
