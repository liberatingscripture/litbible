// test/desk-slides.test.js
//
// A sheet as slides (STUDY-DESK-FIXES.md, E37 phase B): the rules in
// src/lib/desk-slides.mjs (what the slides are, how a long passage is cut,
// the paragraphs a text box holds) and the two writers, desk-slides-pptx.mjs
// and desk-slides-odp.mjs. Each file is unzipped with node:zlib and every XML
// part read by the strict reader (helpers/xml-check.js). Opening the files in
// PowerPoint and LibreOffice was checked by hand (2026-11-06); this holds the
// shapes that check found right.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

import { findAll, parseXml, textOf } from "./helpers/xml-check.js";
import { DOC_CREDIT, SAVE_GROUPS } from "../src/lib/desk-sheet-doc.mjs";
import { LIT_CREDIT_LINE } from "../src/lib/lit-credit.mjs";
import {
  SLIDE_CHARS,
  blankWords,
  coveredBlank,
  deckSlides,
  listLabel,
  slideBoxes,
  slideParagraphs,
  slideRuns,
  splitPassage,
} from "../src/lib/desk-slides.mjs";
import { PPTX_MIME, pptxFile } from "../src/lib/desk-slides-pptx.mjs";
import { ODP_MIME, odpFile } from "../src/lib/desk-slides-odp.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const T = (text) => ({ t: "text", text });
const vn = (n) => ({ t: "vn", text: String(n) });
const para = (...inlines) => ({ type: "para", inlines });
const PNG = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));

/** A passage of `verses` verses, each about 80 characters, with verse 2's "Word" blanked. */
function passage(verses) {
  const revealed = [];
  const covered = [];
  for (let v = 1; v <= verses; v++) {
    const words = " In the beginning was the Word, and the Word was with God, and so it was. ";
    revealed.push(vn(v), ...(v === 2 ? [T(" In the beginning was the "), { t: "blank", answer: "Word", hint: "" }, T(".")] : [T(words)]));
    covered.push(vn(v), ...(v === 2 ? [T(" In the beginning was the "), coveredBlank({ kind: "line", hint: "a name" }), T(".")] : [T(words)]));
  }
  return { revealed: [para(...revealed)], covered: [para(...covered)] };
}

function screens() {
  const p = passage(14);
  return [
    { kind: "start", title: "John 1", subtitle: "Sunday", codes: [{ png: PNG, pixels: 1, label: "John 1", printable: "litbible.net/john-1" }], addresses: "litbible.net/john-1", notes: [para(T("Welcome."))] },
    { kind: "passage", heading: "John 1:1–14", ...p, footnotes: [{ type: "note", label: "a", inlines: [T("Greek logos.")] }], notes: [para(T("Leader only: pause."))] },
    { kind: "question", blocks: [para(T("What is “the Word”? <ask> & wait"))], notes: [para(T("Answer")), para(T("Closeness."))] },
    { kind: "text", blocks: [{ type: "list", ordered: true, items: [{ inlines: [T("First")], lists: [{ ordered: true, items: [{ inlines: [T("inner")], lists: [] }] }] }, { inlines: [T("Second")], lists: [] }] }], notes: [] },
    { kind: "keyTerms", blocks: [{ type: "list", ordered: false, items: [{ inlines: [{ t: "strong", kids: [T("Word")] }, T(", traditionally word, "), { t: "em", kids: [T("logos")] }, T(" λόγος")], lists: [] }] }], notes: [] },
  ];
}

const deck = () => ({ title: "John 1", slides: deckSlides(screens(), { credit: DOC_CREDIT }) });

/* ── A small unzip, independent of the writers ────────────────────────── */

function unzip(bytes) {
  const buf = Buffer.from(bytes);
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(end >= 0, "has an end of central directory record");
  const count = buf.readUInt16LE(end + 10);
  let at = buf.readUInt32LE(end + 16);
  const entries = [];
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(at + 10);
    const size = buf.readUInt32LE(at + 20);
    const nameLength = buf.readUInt16LE(at + 28);
    const local = buf.readUInt32LE(at + 42);
    const name = buf.toString("utf8", at + 46, at + 46 + nameLength);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const body = buf.subarray(start, start + size);
    entries.push({ name, method, data: method === 8 ? inflateRawSync(body) : Buffer.from(body) });
    at += 46 + nameLength + buf.readUInt16LE(at + 30) + buf.readUInt16LE(at + 32);
  }
  return entries;
}

const xmlOf = (entries, name) => {
  const e = entries.find((x) => x.name === name);
  assert.ok(e, `${name} is in the file`);
  return parseXml(e.data.toString("utf8"));
};

/* ── The rules ────────────────────────────────────────────────────────── */

test("a passage with a blank is two slides, covered then filled in, with the words in the notes", () => {
  const slides = deckSlides([{ kind: "passage", heading: "John 1:1–2", ...passage(2), footnotes: [], notes: [para(T("Pause."))] }], { credit: "C" });
  assert.deepEqual(slides.map((s) => s.kind), ["passage", "passage", "end"]);
  const [covered, revealed] = slides;
  assert.equal(covered.covered, true);
  assert.equal(revealed.revealed, true);
  assert.deepEqual(blankWords(covered.blocks), [], "nothing to read off the covered slide");
  assert.deepEqual(blankWords(revealed.blocks), ["Word"]);
  assert.match(JSON.stringify(covered.notes[0]), /Blanks on this slide: Word\. The next slide fills them in\./);
  assert.equal(JSON.stringify(covered.notes[1]), JSON.stringify(para(T("Pause."))), "the leader's notes go with the first slide");
  assert.deepEqual(revealed.notes, []);
});

test("a passage without blanks is one slide, and its footnotes follow on their own slide", () => {
  const { revealed } = passage(2);
  const slides = deckSlides([{ kind: "passage", heading: "John 1:1–2", revealed, covered: null, footnotes: [{ type: "note", label: "a", inlines: [T("Note.")] }], notes: [] }], { credit: "C" });
  assert.deepEqual(slides.map((s) => [s.kind, s.heading]), [["passage", "John 1:1–2"], ["footnotes", "Footnotes to John 1:1–2"], ["end", null]]);
});

test("a long passage is cut before a verse number, both forms alike, and goes on as “(continued)”", () => {
  const { revealed, covered } = passage(14);
  const groups = splitPassage(revealed, covered);
  assert.ok(groups.length > 1);
  for (const g of groups) {
    assert.equal(g.revealed.length, g.covered.length);
    for (let i = 0; i < g.revealed.length; i++) {
      const first = (b) => b.inlines.find((n) => n.t === "vn")?.text;
      assert.equal(first(g.revealed[i]), first(g.covered[i]), "the two forms cut at the same verse");
      assert.equal(g.revealed[i].inlines[0].t, "vn", "every piece starts at a verse number");
    }
  }
  const verses = groups.flatMap((g) => g.revealed.flatMap((b) => b.inlines.filter((n) => n.t === "vn").map((n) => n.text)));
  assert.deepEqual(verses, Array.from({ length: 14 }, (_, i) => String(i + 1)), "no verse lost or repeated");

  const slides = deckSlides([{ kind: "passage", heading: "John 1:1–14", revealed, covered, footnotes: [], notes: [] }], { credit: "C" });
  const headings = slides.filter((s) => s.kind === "passage").map((s) => s.heading);
  assert.equal(headings[0], "John 1:1–14");
  assert.ok(headings.slice(2).every((h) => h === "John 1:1–14 (continued)"));
  assert.equal(slides.filter((s) => s.covered).length, 1, "only the piece holding the blank is shown twice");
});

test("a single verse longer than a slide stays whole", () => {
  const long = para(vn(1), T("word ".repeat(SLIDE_CHARS)));
  const groups = splitPassage([long]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].revealed, [long]);
});

test("the deck opens and closes with the credit line and the addresses", () => {
  const slides = deck().slides;
  assert.equal(slides[0].kind, "start");
  assert.equal(slides[0].credit, LIT_CREDIT_LINE);
  assert.equal(slides.at(-1).kind, "end");
  assert.equal(slides.at(-1).credit, LIT_CREDIT_LINE);
  assert.equal(slides.at(-1).addresses, "litbible.net/john-1");
  assert.equal(slideBoxes(slides[0]).codes.length, 1);
});

test("list marks by level: bullets, and 1. a. i.", () => {
  assert.deepEqual([0, 1, 2, 3].map((l) => listLabel(false, l, 1)), ["•", "◦", "▪", "•"]);
  assert.deepEqual([listLabel(true, 0, 3), listLabel(true, 1, 3), listLabel(true, 2, 4), listLabel(true, 2, 9), listLabel(true, 1, 27)], ["3.", "c.", "iv.", "ix.", "a."]);
});

test("slideParagraphs flattens lists, quotes, boxes and notes into indented paragraphs", () => {
  const ps = slideParagraphs([
    { type: "heading", level: 2, inlines: [T("Head")] },
    { type: "list", ordered: true, items: [{ inlines: [T("one")], lists: [{ ordered: false, items: [{ inlines: [T("sub")], lists: [] }] }] }, { inlines: [T("two")], lists: [] }] },
    { type: "quote", blocks: [para(T("quoted"))] },
    { type: "box", blocks: [{ type: "section", text: "Inside" }] },
    { type: "note", label: "a", inlines: [T("A note.")] },
    { type: "rule" },
  ]);
  assert.deepEqual(ps.map((p) => p.runs.map((r) => r.text).join("")), ["Head", "one", "sub", "two", "quoted", "Inside", "a A note."]);
  assert.equal(ps[0].heading, true);
  assert.equal(ps[0].scale, 1.2);
  assert.deepEqual(ps.slice(1, 4).map((p) => [p.list.label, p.list.level]), [["1.", 0], ["◦", 1], ["2.", 0]]);
  assert.ok(ps[2].marL > ps[1].marL, "a sub-list is indented further");
  assert.ok(ps[1].indent < 0, "a list item's mark hangs");
  assert.equal(ps[4].i, true, "a quote is italic");
  assert.equal(ps[5].b, true, "a section is bold");
  assert.equal(ps[6].runs[0].sup, true, "a footnote's letter is raised");
});

test("slideRuns moves a sheet's colors onto the dark ground", () => {
  const [run] = slideRuns([{ t: "style", color: "red", kids: [T("red")] }]);
  assert.equal(run.color, "#ff8a80");
});

/* ── The writers ──────────────────────────────────────────────────────── */

test(".pptx: every part well-formed and named in the content types, one slide each, notes where there are notes", async () => {
  const bytes = await pptxFile(deck(), { title: "John 1", date: Date.UTC(2026, 10, 6) });
  const entries = unzip(bytes);
  const names = entries.map((e) => e.name);
  for (const e of entries.filter((x) => /\.(xml|rels)$/.test(x.name))) parseXml(e.data.toString("utf8"));

  const types = xmlOf(entries, "[Content_Types].xml");
  const overrides = new Set(findAll(types, "Override").map((o) => o.attrs.PartName.slice(1)));
  for (const n of names.filter((x) => x.endsWith(".xml") && x !== "[Content_Types].xml")) assert.ok(overrides.has(n), `${n} has a content type`);

  const count = deck().slides.length;
  const slides = names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  assert.equal(slides.length, count);
  const pres = xmlOf(entries, "ppt/presentation.xml");
  assert.equal(findAll(pres, "p:sldId").length, count);
  assert.equal(findAll(pres, "p:sldSz")[0].attrs.cx, "12192000");

  const withNotes = deck().slides.map((s, i) => (s.notes.length ? i + 1 : null)).filter(Boolean);
  assert.deepEqual(names.filter((n) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n)).map((n) => +n.match(/\d+/)[0]), withNotes);
  assert.ok(names.includes("ppt/media/code1.png"));
});

test(".pptx: the credit line is on the first and last slides and in the properties; words are escaped", async () => {
  const entries = unzip(await pptxFile(deck(), { title: "John 1 <draft>", date: 0 }));
  const slides = entries.filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.name)).sort((a, b) => +a.name.match(/\d+/)[0] - +b.name.match(/\d+/)[0]);
  const text = (e) => findAll(parseXml(e.data.toString("utf8")), "a:t").map(textOf).join("");
  assert.ok(text(slides[0]).includes(LIT_CREDIT_LINE));
  assert.ok(text(slides.at(-1)).includes(LIT_CREDIT_LINE));
  assert.ok(slides.some((s) => text(s).includes("What is “the Word”? <ask> & wait")), "markup in the words survives as text");
  assert.ok(slides.some((s) => text(s).includes("λόγος")));
  assert.equal(textOf(findAll(xmlOf(entries, "docProps/core.xml"), "dc:title")[0]), "John 1 <draft>");
  assert.ok(textOf(xmlOf(entries, "docProps/custom.xml")).includes(LIT_CREDIT_LINE));
  const notes = entries.filter((e) => e.name.startsWith("ppt/notesSlides/notesSlide") && e.name.endsWith(".xml")).map(text).join("|");
  assert.match(notes, /Blanks on this slide: Word\./);
  assert.match(notes, /Closeness\./);
  assert.equal(PPTX_MIME, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
});

test(".odp: mimetype first and stored, the manifest's parts, each well-formed, one page a slide", async () => {
  const entries = unzip(await odpFile(deck(), { title: "John 1", date: 0 }));
  assert.equal(entries[0].name, "mimetype");
  assert.equal(entries[0].method, 0);
  assert.equal(entries[0].data.toString(), ODP_MIME);
  for (const e of entries.filter((x) => x.name.endsWith(".xml"))) parseXml(e.data.toString("utf8"));
  const manifest = xmlOf(entries, "META-INF/manifest.xml");
  const listed = new Set(findAll(manifest, "manifest:file-entry").map((f) => f.attrs["manifest:full-path"]));
  for (const e of entries.slice(1).filter((x) => x.name !== "META-INF/manifest.xml")) assert.ok(listed.has(e.name), `${e.name} is in the manifest`);

  const content = xmlOf(entries, "content.xml");
  const pages = findAll(content, "draw:page");
  assert.equal(pages.length, deck().slides.length);
  for (const p of pages) assert.equal(findAll(p, "presentation:notes").every((n) => !n.attrs["draw:style-name"]), true, "notes carry no style (Impress paints the slides with it)");
  const words = textOf(content);
  assert.ok(words.includes(LIT_CREDIT_LINE));
  assert.ok(words.includes("What is “the Word”? <ask> & wait"));
  assert.ok(textOf(xmlOf(entries, "meta.xml")).includes(LIT_CREDIT_LINE));
  assert.ok(entries.some((e) => e.name === "Pictures/code1.png"));
});

/* ── The menu, and loading ────────────────────────────────────────────── */

test("Save as has a Slides group: PowerPoint, OpenDocument, and a PDF through Print", () => {
  const slides = SAVE_GROUPS.find((g) => g.id === "slides");
  assert.ok(slides);
  assert.deepEqual(slides.items.map((i) => i.label), ["PowerPoint (.pptx)", "OpenDocument slides (.odp)", "PDF…"]);
  for (const i of slides.items) assert.equal(i.slides, true);
  assert.deepEqual(slides.items.filter((i) => !i.print).map((i) => i.mime), [PPTX_MIME, ODP_MIME]);
  assert.match(slides.items.find((i) => i.print).hint, /“Save as PDF”/);
});

const STATIC_IMPORT = /^\s*(?:import|export)\s[^;]*?\sfrom\s+["'](\.[^"']+)["']|^\s*import\s+["'](\.[^"']+)["']/gm;

test("the slides load only when chosen: the sheet page reaches none of them by a static import", () => {
  const seen = new Set();
  const walk = (file) => {
    const rel = relative(root, file).replaceAll("\\", "/");
    if (seen.has(rel)) return;
    seen.add(rel);
    for (const m of readFileSync(file, "utf8").matchAll(STATIC_IMPORT)) {
      const to = join(dirname(file), m[1] ?? m[2]);
      if (existsSync(to)) walk(to);
    }
  };
  walk(join(root, "src/scripts/desk/sheet-page.js"));
  for (const file of ["src/lib/desk-slides.mjs", "src/lib/desk-slides-pptx.mjs", "src/lib/desk-slides-odp.mjs", "src/scripts/desk/sheet-slides.js"]) {
    assert.ok(!seen.has(file), `${file} is not in the sheet page's chunk`);
  }
  const page = readFileSync(join(root, "src/scripts/desk/sheet-page.js"), "utf8");
  assert.ok(page.includes('import("./sheet-slides.js")'));
  const save = readFileSync(join(root, "src/scripts/desk/sheet-save.js"), "utf8");
  for (const file of ["desk-slides-pptx.mjs", "desk-slides-odp.mjs"]) assert.ok(save.includes(`import("../../lib/${file}")`));
});
