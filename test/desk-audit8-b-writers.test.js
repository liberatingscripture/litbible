// Audit 8, batch B: the document writers (GF8c-3, GF8c-7).
import { test } from "node:test";
import assert from "node:assert/strict";
import { miniDocument, parseHtml } from "./helpers/mini-dom.js";
import { docHtml, docText } from "../src/lib/desk-sheet-doc.mjs";

globalThis.Node ??= /** @type {any} */ ({ TEXT_NODE: 3, ELEMENT_NODE: 1 });
globalThis.document ??= /** @type {any} */ (miniDocument);
const { inlines } = await import("../src/scripts/desk/sheets/sheet-word.js");

const note = (html) => inlines(parseHtml(`<span>${html}</span>`).children[0].childNodes);

test("a footnote's blocks each take a line, and its <b> and <i> keep their weight (GF8c-3)", () => {
  const html =
    'The chiasm is as follows:<div class="chiasm"><div class="chiasm-line lvl-0"><span class="chiasm-key"><b>A</b>:</span><span class="chiasm-text">Verse 2</span></div>' +
    '<div class="chiasm-line lvl-1"><span class="chiasm-key"><b>B</b>:</span><span class="chiasm-text">Verse 3</span></div></div> After.';
  const kids = note(html);
  const text = docText({ title: "S", blocks: [{ type: "note", label: "b", inlines: kids }] });
  assert.match(text, /as follows:\s*\n\s*A: Verse 2\s*\n\s*B: Verse 3\s*\n\s*After\./);
  const out = docHtml({ title: "S", blocks: [{ type: "para", inlines: kids }] });
  assert.match(out, /<strong>A<\/strong>/);
  assert.doesNotMatch(out, /follows:A:/);
  const plain = note("a <i>kept</i> and <b>bold</b> word");
  assert.deepEqual(plain.filter((n) => n.t !== "text").map((n) => n.t), ["em", "strong"]);
});

test("a block at the very end leaves no trailing break", () => {
  const kids = note("<div>one</div><div>two</div>");
  assert.notEqual(kids[kids.length - 1].t, "br");
  assert.equal(kids.filter((n) => n.t === "br").length, 1);
});

test("plain text numbers an ordered list and indents a nested one (GF8c-7)", () => {
  const t = (text) => ({ t: "text", text });
  const doc = { title: "S", blocks: [{ type: "list", ordered: true, items: [
    { inlines: [t("Opening")], lists: [] },
    { inlines: [t("The text")], lists: [{ type: "list", ordered: false, items: [{ inlines: [t("a point")], lists: [] }] }] },
    { inlines: [t("The turn")], lists: [{ type: "list", ordered: true, items: [{ inlines: [t("one")], lists: [] }, { inlines: [t("two")], lists: [] }] }] },
  ] }] };
  assert.equal(docText(doc), "1. Opening\n2. The text\n  • a point\n3. The turn\n  1. one\n  2. two\n");
});

test("a part holding only zero-width characters prints nothing (GF8b-11)", async () => {
  const { printsOnPaper } = await import("../src/lib/desk-sheet-copy.mjs");
  const zw = String.fromCharCode(0x200b, 0x200d, 0xfeff, 0x2060);
  assert.equal(printsOnPaper({ type: "text", html: `<p>${zw}</p>`, leaderOnly: true }, "leader"), false);
  assert.equal(printsOnPaper({ type: "question", html: `<p>${zw}</p>`, answer: `<p>${zw}</p>` }, "leader"), false);
  assert.equal(printsOnPaper({ type: "text", html: `<p>${zw}words</p>` }, "participant"), true);
});

test("the leak check's first-word prefilter changes no result (LG8-4)", async () => {
  const { findLeaks } = await import("../src/lib/desk-sheet-leaks.mjs");
  const blanks = [
    { passageId: "p1", ref: "Romans 3:23", exact: "fall short" },
    { passageId: "p1", ref: "Romans 3:23", exact: "glory" },
    { passageId: "p2", ref: "John 1:1", exact: "Word" },
  ];
  const surfaces = [
    { kind: "text", where: "text 1", text: "Everyone will fall short, and the glory is God’s." },
    { kind: "question", where: "question 1", text: "Short of what? Fall." },
    { kind: "passage", where: "John 1:1", text: "In the beginning was the Word", passageId: "p2" },
    { kind: "title", where: "the title", text: "The WORD" },
  ];
  const got = findLeaks(blanks, surfaces).map((l) => `${l.words}@${l.where}`).sort();
  assert.deepEqual(got, ["Word@the title", "fall short@text 1", "glory@text 1"]);
});

test("a long list is cut across slides between its items, numbering carried on (GF8c-6)", async () => {
  const { splitBlocks, slideParagraphs, blockLength } = await import("../src/lib/desk-slides.mjs");
  const items = Array.from({ length: 40 }, (_, i) => ({ inlines: [{ t: "text", text: `Outline point number ${i + 1} with some words` }], lists: [] }));
  const list = { type: "list", ordered: true, items };
  assert.ok(blockLength(list) > 1500);
  const groups = splitBlocks([list], 560);
  assert.ok(groups.length >= 3);
  for (const g of groups) assert.ok(g.reduce((n, b) => n + blockLength(b), 0) <= 600);
  const labels = groups.flatMap((g) => slideParagraphs(g).map((p) => p.list.label));
  assert.deepEqual(labels, items.map((_, i) => `${i + 1}.`));
  assert.equal(groups.flat().reduce((n, b) => n + b.items.length, 0), 40);
  // a bullet list is cut the same way; a short one is left whole
  assert.equal(splitBlocks([{ ...list, ordered: false }], 560).length, groups.length);
  assert.equal(splitBlocks([{ type: "list", ordered: true, items: items.slice(0, 3) }], 560).length, 1);
});

/* ── Copy in DOM code, held by its source ─────────────────────────────── */
// The presenter view's focus (SH8-6, XA8-9), the Paragraph style button's
// name (XA8-5) and the commercial check (GF8b-1, GF8b-2, GF8b-13) are driven
// in desk-audit8-dom-sheets-output.test.js.

import { readFileSync } from "node:fs";
const src = (f) => readFileSync(new URL(`../src/scripts/desk/sheets/${f}`, import.meta.url), "utf8");

test("the notebook chooser's words are American (PC8A-1)", () => {
  const s = src("add-forms.js");
  assert.match(s, /Check what to bring\./);
  assert.doesNotMatch(s, /Tick what/);
});
