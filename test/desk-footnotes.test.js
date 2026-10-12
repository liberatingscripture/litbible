// test/desk-footnotes.test.js
//
// src/lib/desk-footnotes.mjs: pinned footnotes (STUDY-DESK.md, "Draft 4d").
// What these guard, in order of how much a reader would feel it: a pin made
// on the page must be the same pin the apps make from the chapter JSON (the
// sweep reads every published chapter both ways), a pin is found again at its
// own footnote in every published chapter, a punctuation pass never makes a
// pin "changed", and a footnote genuinely rewritten is offered, not lost.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { prepareStudyParagraph } from "../src/lib/chapter-html.ts";
import { linkRefs } from "../src/lib/scripture-refs-data.mjs";
import {
  CHANGED_THRESHOLD,
  findPin,
  footnoteText,
  footnotesFromChapter,
  footnotesFromDom,
  pinFields,
  placePins,
} from "../src/lib/desk-footnotes.mjs";
import { createRecord, validateRecord } from "../src/lib/desk-records.mjs";
import { parseHtml } from "./helpers/mini-dom.js";

const CHAPTER_DIR = new URL("../src/data/chapters/", import.meta.url);

const published = readdirSync(CHAPTER_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(new URL(f, CHAPTER_DIR), "utf8")))
  .filter((c) => c.indexed !== false);

const note = (id, verse, text) => ({ id, verse, text });

/* ── footnoteText ────────────────────────────────────────────────────── */

test("footnoteText: tags vanish, blocks become spaces, entities decode, whitespace collapses", () => {
  assert.equal(footnoteText("The Greek reads <em>sarx</em>, “flesh.”"), "The Greek reads sarx, “flesh.”");
  assert.equal(footnoteText("<div>First.</div><div>Second.</div>"), "First. Second.");
  assert.equal(footnoteText("Line one<br>line two<br/>line three"), "Line one line two line three");
  assert.equal(footnoteText("<p>One.</p>\n<p>Two.</p>"), "One. Two.");
  // A word split across inline tags rejoins; a block edge does not.
  assert.equal(footnoteText("<em>ekd</em><em>emeo</em>"), "ekdemeo");
  assert.equal(footnoteText("Sin &amp; death&nbsp;&mdash; or&#8217;s &#x2019;"), "Sin & death — or’s ’");
  assert.equal(footnoteText("a > b <a href=\"x?y>z\">link</a>"), "a > b link");
  assert.equal(footnoteText("&lt;b&gt; is not a tag"), "<b> is not a tag");
  assert.equal(footnoteText("An unknown &entity; stays"), "An unknown &entity; stays");
  assert.equal(footnoteText("   "), "");
  assert.equal(footnoteText(null), "");
});

test("footnoteText: bracket markers go before whitespace collapses, as in a verse", () => {
  assert.equal(footnoteText("Some ⟦ words ⟧ here"), "Some words here");
});

test("footnoteText reads the page's re-serialized HTML as it reads the JSON", () => {
  // The browser's innerHTML writes &nbsp; and &amp; its own way and adds nothing else.
  const json = "Sin & death — <em>sarx</em>.";
  const page = "Sin &amp; death&nbsp;— <em>sarx</em>.";
  assert.equal(footnoteText(page), footnoteText(json));
  assert.equal(footnoteText(page), "Sin & death — sarx.");
});

/* ── The list, from JSON and from the page ───────────────────────────── */

const tiny = {
  paragraphs: [
    '<p id="x-1-p1"><sup class="fn-ref"><a id="fnref-a" href="#fn-a" role="doc-noteref">a</a></sup> <span class="vglue"><sup id="v1" class="vn">1</sup>&nbsp;Lords,</span><sup class="fn-ref"><a id="fnref-b" href="#fn-b" role="doc-noteref">b</a></sup> be fair.</p>',
    '<p id="x-1-p2">More of verse one.<sup class="fn-ref"><a id="fnref-c" href="#fn-c" role="doc-noteref">c</a></sup> <span class="vglue"><sup id="v2" class="vn">2</sup>&nbsp;Pray.</span><sup class="fn-ref"><a id="fnref-d" href="#fn-d" role="doc-noteref">d</a></sup></p>',
  ],
  footnotes: [
    { id: "fn-a", html: "Before everything." },
    { id: "fn-b", html: "Same." },
    { id: "fn-c", html: "Same." },
    { id: "fn-d", html: "<div>Two</div><div>blocks.</div>" },
  ],
};

test("footnotesFromChapter: each note takes the verse whose text holds its letter", () => {
  assert.deepEqual(footnotesFromChapter(tiny), [
    note("fn-a", 1, "Before everything."), // ahead of the first marker: the first verse
    note("fn-b", 1, "Same."),
    note("fn-c", 1, "Same."), // a continuation paragraph still belongs to verse 1
    note("fn-d", 2, "Two blocks."),
  ]);
});

test("footnotesFromChapter: a note with no letter, and a letter with no note, are left out", () => {
  const list = footnotesFromChapter({
    paragraphs: tiny.paragraphs,
    footnotes: [...tiny.footnotes.filter((f) => f.id !== "fn-d"), { id: "fn-z", html: "Orphan." }],
  });
  assert.deepEqual(list.map((f) => f.id), ["fn-a", "fn-b", "fn-c"]);
});

test("footnotesFromDom reads the same list off rendered blocks", () => {
  const seen = new Set();
  const state = { currentVerse: null };
  const html = tiny.paragraphs
    .map((p) => `<div class="p">${prepareStudyParagraph(p, "x", 1, seen, state)}</div>`)
    .join("\n");
  const blocks = parseHtml(html).childNodes.filter((n) => n.nodeType === 1);
  const byId = new Map(tiny.footnotes.map((f) => [f.id, f.html]));
  assert.deepEqual(footnotesFromDom(blocks, (id) => byId.get(id) ?? null), footnotesFromChapter(tiny));
});

test("sweep: every footnote in every published chapter has a verse", () => {
  let total = 0;
  let missing = 0;
  const lost = [];
  for (const c of published) {
    const list = footnotesFromChapter(c);
    total += list.length;
    for (const f of list) assert.ok(Number.isInteger(f.verse) && f.verse >= 1, `${c.bookKey}-${c.chapter} ${f.id} has no verse`);
    for (const fn of c.footnotes ?? []) {
      if (!list.some((f) => f.id === fn.id)) {
        missing++;
        lost.push(`${c.bookKey}-${c.chapter} ${fn.id}`);
      }
    }
  }
  assert.ok(total > 3000, `only ${total} footnotes found`);
  assert.deepEqual(lost, [], `${missing} footnotes have no letter in their chapter's text`);
});

test("sweep: the page's footnote list is the JSON's list, and the reference linker changes no note's text", () => {
  const failures = [];
  for (const c of published) {
    const want = footnotesFromChapter(c);
    // What the page shows: [slug].astro runs each note through linkRefs.
    const shown = new Map((c.footnotes ?? []).map((f) => [f.id, linkRefs(f.html)]));
    const seen = new Set();
    const state = { currentVerse: null };
    const html = c.paragraphs
      .map((p) => `<div class="p">${prepareStudyParagraph(p, c.bookKey, c.chapter, seen, state)}</div>`)
      .join("\n");
    const blocks = parseHtml(html).childNodes.filter((n) => n.nodeType === 1);
    const got = footnotesFromDom(blocks, (id) => shown.get(id) ?? null);
    try {
      assert.deepEqual(got, want);
    } catch {
      failures.push(`${c.bookKey}-${c.chapter}`);
    }
  }
  assert.deepEqual(failures, [], `the page and the JSON disagree in ${failures.length} chapters`);
});

test("sweep: a pin made on any footnote is found again at that footnote", () => {
  const failures = [];
  for (const c of published) {
    const list = footnotesFromChapter(c);
    for (const f of list) {
      const fields = pinFields(list, f.id);
      const found = findPin(list, fields);
      if (found.status !== "found" || found.id !== f.id) failures.push(`${c.bookKey}-${c.chapter} ${f.id} -> ${found.status} ${found.id}`);
    }
  }
  assert.deepEqual(failures, []);
});

test("sweep: a pin survives the chapter gaining a footnote earlier on (letters shift, text does not)", () => {
  // Letters are never stored, so adding a note at the start changes nothing a pin keeps.
  const c = published.find((x) => x.bookKey === "john" && x.chapter === 3);
  const list = footnotesFromChapter(c);
  const target = list[list.length - 1];
  const fields = pinFields(list, target.id);
  const shifted = [note("fn-new", list[0].verse, "A brand new note."), ...list];
  assert.equal(findPin(shifted, fields).id, target.id);
});

test("every footnote text a pin can store is a valid pin", () => {
  const c = published.find((x) => x.bookKey === "john" && x.chapter === 3);
  const list = footnotesFromChapter(c);
  const record = createRecord(
    "footnotePin",
    { bookKey: "john", chapter: 3, ...pinFields(list, list[0].id) },
    { client: "web/2026.10", contentVersion: "v20261012.5d2c847d" },
  );
  assert.deepEqual(validateRecord(record), []);
});

/* ── pinFields ───────────────────────────────────────────────────────── */

test("pinFields: the verse and the text; n only where a verse holds identical notes", () => {
  const list = [note("fn-a", 3, "Alone."), note("fn-b", 4, "Twice."), note("fn-c", 4, "Twice."), note("fn-d", 5, "Twice.")];
  assert.deepEqual(pinFields(list, "fn-a"), { verse: 3, footnote: "Alone." });
  assert.deepEqual(pinFields(list, "fn-b"), { verse: 4, footnote: "Twice.", n: 1 });
  assert.deepEqual(pinFields(list, "fn-c"), { verse: 4, footnote: "Twice.", n: 2 });
  assert.deepEqual(pinFields(list, "fn-d"), { verse: 5, footnote: "Twice." }, "alone in its own verse");
  assert.throws(() => pinFields(list, "fn-nope"), /no footnote/);
});

test("pinFields never carries the letter", () => {
  const list = [note("fn-a", 1, "x")];
  assert.ok(!("id" in pinFields(list, "fn-a")) && !("label" in pinFields(list, "fn-a")));
});

/* ── findPin ─────────────────────────────────────────────────────────── */

const LIST = [
  note("fn-a", 1, "Or “wisdom”."),
  note("fn-b", 2, "Twice."),
  note("fn-c", 2, "Twice."),
  note("fn-d", 5, "The Greek reads <sarx>, which can mean flesh, body, or human nature, depending on context."),
  note("fn-e", 9, "Elsewhere."),
];

test("findPin: found in the same verse, by its words, whatever its letter", () => {
  assert.deepEqual(findPin(LIST, { verse: 1, footnote: "Or “wisdom”." }), { status: "found", id: "fn-a", text: "Or “wisdom”.", verse: 1 });
});

test("findPin: n picks among identical notes in the verse", () => {
  assert.equal(findPin(LIST, { verse: 2, footnote: "Twice.", n: 1 }).id, "fn-b");
  assert.equal(findPin(LIST, { verse: 2, footnote: "Twice.", n: 2 }).id, "fn-c");
  assert.equal(findPin(LIST, { verse: 2, footnote: "Twice." }).id, "fn-b", "no n means the first");
  assert.equal(findPin(LIST, { verse: 2, footnote: "Twice.", n: 7 }).id, "fn-c", "n past the end takes the last");
  assert.equal(findPin([LIST[1]], { verse: 2, footnote: "Twice.", n: 2 }).status, "found", "one is left, so it is the one");
});

test("findPin: quotes, dashes and spacing alone never make a pin 'changed'", () => {
  const found = findPin(LIST, { verse: 1, footnote: 'Or "wisdom".' });
  assert.equal(found.status, "found");
  assert.equal(found.id, "fn-a");
  const dashed = [note("fn-x", 4, "Verses 3–5 agree.")];
  assert.equal(findPin(dashed, { verse: 4, footnote: "Verses 3-5  agree." }).status, "found");
});

test("findPin: identical words in another verse are 'moved', to the nearest verse", () => {
  const list = [note("fn-a", 2, "Shared."), note("fn-b", 6, "Shared."), note("fn-c", 8, "Shared.")];
  assert.deepEqual(findPin(list, { verse: 5, footnote: "Shared." }), { status: "moved", id: "fn-b", text: "Shared.", verse: 6 });
  assert.equal(findPin(list, { verse: 4, footnote: "Shared." }).id, "fn-a", "a tie takes the earlier verse");
  assert.equal(findPin(list, { verse: 40, footnote: "Shared." }).id, "fn-c");
});

test("findPin: a rewritten note that keeps half its words is 'changed', and the closest wins", () => {
  const old = "The Greek reads sarx, which can mean flesh or body.";
  const list = [
    note("fn-a", 5, "Unrelated remark about something else entirely."),
    note("fn-b", 5, "The Greek reads sarx, which can mean flesh, body, or human nature."),
    note("fn-c", 6, "The Greek reads sarx, which can mean flesh or body."), // wrong verse: 'moved', not 'changed'
  ];
  const found = findPin(list.slice(0, 2), { verse: 5, footnote: old });
  assert.equal(found.status, "changed");
  assert.equal(found.id, "fn-b");
  assert.equal(findPin(list, { verse: 5, footnote: old }).status, "moved");
});

test("findPin: past the threshold the pin is lost, not guessed", () => {
  assert.equal(CHANGED_THRESHOLD, 0.5);
  const old = "one two three four";
  // Two of four words survive: exactly half, offered.
  assert.equal(findPin([note("fn-a", 1, "one two nine ten")], { verse: 1, footnote: old }).status, "changed");
  // One of four: lost.
  assert.deepEqual(findPin([note("fn-a", 1, "one six seven eight")], { verse: 1, footnote: old }), {
    status: "lost",
    id: null,
    text: null,
    verse: null,
  });
  // A close note in a different verse is not looked at.
  assert.equal(findPin([note("fn-a", 2, "one two three five")], { verse: 1, footnote: old }).status, "lost");
  assert.equal(findPin([], { verse: 1, footnote: old }).status, "lost");
});

test("placePins pairs each pin with where it is, and skips other kinds", () => {
  const pin = { kind: "footnotePin", id: "p1", verse: 1, footnote: "Or “wisdom”." };
  const placed = placePins(LIST, [pin, { kind: "note", id: "n1", verse: 1 }, null]);
  assert.equal(placed.length, 1);
  assert.equal(placed[0].record, pin);
  assert.equal(placed[0].found.status, "found");
});

test("a one-word edit to a very long footnote is changed, not lost", () => {
  const long = Array.from({ length: 650 }, (_, i) => `word${i}`).join(" ");
  const edited = long.replace("word300", "altered");
  const list = [{ id: "fn-a", verse: 1, text: edited }];
  const got = findPin(list, { verse: 1, footnote: long });
  assert.equal(got.status, "changed");
  assert.equal(got.id, "fn-a");
});
