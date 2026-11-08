// test/desk-sheet-doc.test.js
//
// A sheet's copy as a document (STUDY-DESK-FIXES.md, E37): the model
// (src/lib/desk-sheet-doc.mjs) read from the copy on screen by
// src/scripts/desk/sheets/sheet-word.js, Copy as its HTML and plain text writer,
// the hand-written zip (desk-zip.mjs), and the .docx, .odt and .rtf writers.
//
// Copy is held to what it put on the clipboard before it moved onto the
// model (test/fixtures/sheet-copy-golden.json, made by the old code). The
// files are unzipped here with node:zlib, every XML part is read by a strict
// reader (helpers/xml-check.js), and each format is checked for the parts a
// program needs and for the copy's shapes: headings, lists, raised verse
// numbers, footnotes, blanks, Greek and Hebrew, the credit line, and escaping.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32 as zlibCrc32, deflateSync, inflateRawSync } from "node:zlib";

import { miniDocument, parseHtml } from "./helpers/mini-dom.js";
import { findAll, parseXml, textOf } from "./helpers/xml-check.js";
import {
  DOC_CREDIT,
  SAVE_GROUPS,
  docHref,
  docHtml,
  docRuns,
  docText,
  documentFileName,
  scriptSegments,
  xmlEscape,
} from "../src/lib/desk-sheet-doc.mjs";
import { LIT_CREDIT_LINE } from "../src/lib/lit-credit.mjs";
import { crc32, zipFiles } from "../src/lib/desk-zip.mjs";
import { docxFile, docxParts } from "../src/lib/desk-doc-docx.mjs";
import { ODT_MIME, odtFile } from "../src/lib/desk-doc-odt.mjs";
import { rtfEscape, rtfFile, rtfText } from "../src/lib/desk-doc-rtf.mjs";

globalThis.Node ??= /** @type {any} */ ({ TEXT_NODE: 3, ELEMENT_NODE: 1 });
globalThis.document ??= /** @type {any} */ (miniDocument);
const { block, copyForWord, readCopy } = await import("../src/scripts/desk/sheets/sheet-word.js");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GOLDEN = JSON.parse(readFileSync(join(root, "test/fixtures/sheet-copy-golden.json"), "utf8"));
const article = (name) => parseHtml(GOLDEN.copies[name].article).children[0];

/* ── A real (tiny) PNG, for the codes to scan ─────────────────────────── */

function png() {
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, "latin1");
    data.copy(out, 8);
    out.writeUInt32BE(zlibCrc32(Buffer.concat([Buffer.from(type, "latin1"), data])), 8 + data.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(2, 0);
  header.writeUInt32BE(2, 4);
  header.set([8, 0, 0, 0, 0], 8); // 8-bit grayscale
  const pixels = Buffer.from([0, 0, 255, 0, 255, 0]); // two rows, each a filter byte and two pixels
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))]));
}

/** The leader's copy as a model, with its code drawn as the page would. */
function leaderDoc() {
  const doc = readCopy(article("leader"));
  for (const b of doc.blocks) if (b.type === "code") Object.assign(b, { png: png(), pixels: 2 });
  return doc;
}

/* ── A small unzip, independent of the writer ─────────────────────────── */

function unzip(bytes) {
  const buf = Buffer.from(bytes);
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(end >= 0, "has an end of central directory record");
  const count = buf.readUInt16LE(end + 10);
  assert.equal(buf.readUInt16LE(end + 8), count, "every entry is on this disk");
  let at = buf.readUInt32LE(end + 16);
  assert.equal(at + buf.readUInt32LE(end + 12), end, "the central directory ends where the end record begins");
  const entries = [];
  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(at), 0x02014b50, "a central directory header");
    const method = buf.readUInt16LE(at + 10);
    const crc = buf.readUInt32LE(at + 16);
    const size = buf.readUInt32LE(at + 20);
    const raw = buf.readUInt32LE(at + 24);
    const nameLength = buf.readUInt16LE(at + 28);
    const local = buf.readUInt32LE(at + 42);
    const name = buf.toString("utf8", at + 46, at + 46 + nameLength);
    assert.equal(buf.readUInt32LE(local), 0x04034b50, `${name}: a local header`);
    assert.equal(buf.readUInt16LE(local + 8), method, `${name}: the same method in both headers`);
    assert.equal(buf.readUInt32LE(local + 14), crc, `${name}: the same CRC in both headers`);
    const extra = buf.readUInt16LE(local + 28);
    const start = local + 30 + buf.readUInt16LE(local + 26) + extra;
    const body = buf.subarray(start, start + size);
    const data = method === 8 ? inflateRawSync(body) : Buffer.from(body);
    assert.equal(data.length, raw, `${name}: its size`);
    assert.equal(zlibCrc32(data), crc, `${name}: its CRC`);
    entries.push({ name, method, extra, offset: local, data });
    at += 46 + nameLength + buf.readUInt16LE(at + 30) + buf.readUInt16LE(at + 32);
  }
  return entries;
}

const xmlOf = (entries, name) => {
  const e = entries.find((x) => x.name === name);
  assert.ok(e, `${name} is in the file`);
  return parseXml(e.data.toString("utf8"));
};

/* ── Copy: unchanged by the model ─────────────────────────────────────── */

for (const name of Object.keys(GOLDEN.copies)) {
  test(`Copy writes the ${name} fixture exactly as before the model`, () => {
    const { html, text } = copyForWord(article(name));
    assert.equal(html, GOLDEN.copies[name].html);
    assert.equal(text, GOLDEN.copies[name].text);
  });
}

test("Copy's two writers read the model, not the page", () => {
  const doc = readCopy(article("participant"));
  assert.equal(docHtml(doc), GOLDEN.copies.participant.html);
  assert.equal(docText(doc), GOLDEN.copies.participant.text);
});

test("readCopy keeps the parts' shapes and the code to scan, which Copy leaves out", () => {
  const doc = readCopy(article("leader"));
  assert.equal(doc.title, "Rivers & “Wells” <study>");
  const types = doc.blocks.map((b) => b.type);
  assert.deepEqual(types.slice(0, 5), ["title", "subtitle", "section", "tag", "code"]);
  const code = doc.blocks.find((b) => b.type === "code");
  assert.equal(code.caption, "Scan to read John 3");
  assert.equal(code.label, "A code to scan for John 3");
  assert.ok(!GOLDEN.copies.leader.html.includes("Scan to read"));
  assert.equal(doc.blocks.filter((b) => b.type === "foot" && b.credit).length, 1);
  // A javascript: link is dropped to its words; a span with no known style is too.
  const words = JSON.stringify(doc.blocks);
  assert.ok(!words.includes("javascript:"));
  assert.ok(!words.includes('"nope"'));
});

/* ── Runs ─────────────────────────────────────────────────────────────── */

test("docRuns collapses spaces as a browser shows them, across runs and at a line's ends", () => {
  const runs = docRuns([
    { t: "text", text: "  For God \n so " },
    { t: "em", kids: [{ t: "text", text: " loved " }] },
    { t: "text", text: " the world " },
    { t: "br" },
    { t: "text", text: "  next" },
  ]);
  assert.deepEqual(runs, [{ text: "For God so " }, { text: "loved ", i: true }, { text: "the world" }, { br: true }, { text: "next" }]);
});

test("docRuns sets a verse number, a footnote letter, and both kinds of blank as Copy does", () => {
  const runs = docRuns([
    { t: "vn", text: "16" },
    { t: "text", text: "God gave the " },
    { t: "blank", answer: "only Child", hint: "Greek: monogenēs" },
    { t: "fn", text: "a" },
    { t: "text", text: " and " },
    { t: "blank", answer: null, hint: "" },
  ]);
  assert.deepEqual(runs[0], { text: "16", b: true, sup: true });
  assert.deepEqual(runs[1], { text: "\u00a0" });
  assert.deepEqual(runs[3], { text: "only Child", u: true, b: true });
  assert.deepEqual(runs[5], { text: "(Greek: monogenēs)", size: 0.8 });
  assert.deepEqual(runs[6], { text: "a", sup: true });
  assert.deepEqual(runs.at(-1), { text: "\u00a0".repeat(16), u: true });
});

test("docRuns carries styles, links and sizes, colors as hex", () => {
  const [run] = docRuns([{ t: "style", color: "red", mark: "yellow", size: "large", kids: [{ t: "link", href: "https://x.org/", kids: [{ t: "strong", kids: [{ t: "text", text: "go" }] }] }] }]);
  assert.deepEqual(run, { text: "go", color: "#b3261e", mark: "#ffeea3", size: 1.2, href: "https://x.org/", b: true });
});

test("scriptSegments keeps a Hebrew or Greek phrase whole, its spaces included", () => {
  assert.deepEqual(scriptSegments("Hebrew: שָׁלוֹם עֲלֵיכֶם, and Greek ἀγάπη τοῦ θεοῦ."), [
    { text: "Hebrew: ", script: null },
    { text: "שָׁלוֹם עֲלֵיכֶם", script: "hebrew" },
    { text: ", and Greek ", script: null },
    { text: "ἀγάπη τοῦ θεοῦ", script: "greek" },
    { text: ".", script: null },
  ]);
  assert.deepEqual(scriptSegments("monogenēs"), [{ text: "monogenēs", script: null }]);
});

test("xmlEscape escapes markup and quotes, and drops what XML can't hold", () => {
  assert.equal(xmlEscape(`a & <b> "c"\u0001\uD800`), "a &amp; &lt;b&gt; &quot;c&quot;");
});

/* ── Names and the menu ───────────────────────────────────────────────── */

test("documentFileName: the sheet's name and the version, safe on every system", () => {
  assert.equal(documentFileName("Romans 8 study", "leader", "docx"), "Romans 8 study (leader).docx");
  assert.equal(documentFileName('a/b\\c:d*e?f"g<h>i|j', "participant", "odt"), "a b c d e f g h i j (participant).odt");
  assert.equal(documentFileName(" ..Lent: “Week 2”. ", "leader", "rtf"), "Lent “Week 2” (leader).rtf");
  assert.equal(documentFileName("", "leader", "rtf"), "Sheet (leader).rtf");
});

test("Save as holds the document group, and PDF runs Print", () => {
  assert.deepEqual(SAVE_GROUPS.map((g) => g.label), ["A document", "Slides"]);
  const [doc] = SAVE_GROUPS;
  assert.deepEqual(doc.items.map((i) => i.label), ["Word document (.docx)", "OpenDocument text (.odt)", "Rich text (.rtf)", "PDF…"]);
  const pdf = doc.items.find((i) => i.id === "pdf");
  assert.equal(pdf.print, true);
  assert.match(pdf.hint, /“Save as PDF”/);
  for (const i of doc.items.filter((x) => !x.print)) assert.ok(i.ext && i.mime, `${i.id} has a type`);
});

/* ── The zip ──────────────────────────────────────────────────────────── */

test("zipFiles round-trips through an independent unzip, in order, stored where asked", async () => {
  const text = "The same words again. ".repeat(50);
  const binary = new Uint8Array(256).map((_, i) => (i * 97) & 0xff);
  const zip = await zipFiles(
    [
      { name: "mimetype", data: "application/x-test", store: true },
      { name: "a/text.txt", data: text },
      { name: "b.bin", data: binary },
    ],
    { date: new Date(2026, 10, 6, 9, 30, 12) },
  );
  const entries = unzip(zip);
  assert.deepEqual(entries.map((e) => e.name), ["mimetype", "a/text.txt", "b.bin"]);
  assert.equal(entries[0].method, 0);
  assert.equal(entries[1].method, 8, "text that shrinks is deflated");
  assert.equal(entries[1].data.toString("utf8"), text);
  assert.deepEqual(new Uint8Array(entries[2].data), binary);
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

/* ── .docx ────────────────────────────────────────────────────────────── */

const W = (el, name) => findAll(el, `w:${name}`);
const style = (p) => W(p, "pStyle")[0]?.attrs["w:val"] ?? null;

test(".docx: its parts in order, each well-formed, each named in the content types", async () => {
  const entries = unzip(await docxFile(leaderDoc(), { version: "Leader version", date: Date.UTC(2026, 10, 6) }));
  assert.deepEqual(entries.map((e) => e.name), [
    "[Content_Types].xml",
    "_rels/.rels",
    "docProps/core.xml",
    "docProps/custom.xml",
    "word/document.xml",
    "word/styles.xml",
    "word/numbering.xml",
    "word/fontTable.xml",
    "word/_rels/document.xml.rels",
    "word/media/code1.png",
  ]);
  for (const e of entries) if (/\.(xml|rels)$/.test(e.name)) parseXml(e.data.toString("utf8"));
  const types = xmlOf(entries, "[Content_Types].xml");
  const overrides = findAll(types, "Override").map((o) => o.attrs.PartName);
  for (const e of entries.filter((x) => x.name.endsWith(".xml") && x.name !== "[Content_Types].xml")) {
    assert.ok(overrides.includes(`/${e.name}`), `${e.name} has a content type`);
  }
  assert.ok(findAll(types, "Default").some((d) => d.attrs.Extension === "png"));
  // Every relationship to a part points at a part that is there.
  const rels = findAll(xmlOf(entries, "word/_rels/document.xml.rels"), "Relationship");
  for (const r of rels.filter((x) => x.attrs.TargetMode !== "External")) {
    assert.ok(entries.some((e) => e.name === `word/${r.attrs.Target}`), `word/${r.attrs.Target} exists`);
  }
});

test(".docx: headings, lists, raised verse numbers, footnotes and blanks", () => {
  const parts = docxParts(leaderDoc(), { date: 0 });
  const doc = parseXml(parts.find((p) => p.name === "word/document.xml").data);
  const paras = W(doc, "p");
  const byStyle = (s) => paras.filter((p) => style(p) === s).map(textOf);
  assert.deepEqual(byStyle("Heading1"), ["Rivers & “Wells” <study>"]);
  assert.deepEqual(byStyle("Heading2"), ["John 3:16–17", "Mark 99", "Opening", "Key terms"]);
  assert.deepEqual(byStyle("Heading3"), ["Read <slowly>"]);
  assert.deepEqual(byStyle("PartTag"), ["Leader only", "Leader only"]);
  assert.equal(byStyle("Ruled").length, 3, "two lines under the question, one for the space");

  const verse = W(doc, "r").find((r) => textOf(r) === "16");
  assert.equal(W(verse, "vertAlign")[0].attrs["w:val"], "superscript");
  assert.ok(W(verse, "b").length, "a verse number is bold");
  const answer = W(doc, "r").find((r) => textOf(r) === "only Child");
  assert.ok(W(answer, "u").length && W(answer, "b").length, "the leader's answer is underlined and bold");
  const note = paras.find((p) => style(p) === "Footnote");
  assert.match(textOf(note), /^a Or only begotten; see John 1:14 & Psalm 2:7\.$/);
  assert.equal(W(W(note, "r")[0], "vertAlign")[0].attrs["w:val"], "superscript");

  // Lists: bullets share one definition, each numbered list its own.
  const listed = paras.filter((p) => W(p, "numPr").length);
  assert.deepEqual(listed.map(textOf), ["One", "One a", "Two spaced", "First", "Second", "trust / faithfulness, traditionally faith, pistis", `${"\u00a0".repeat(16)}, traditionally sin, hamartia`]);
  const level = (p) => W(p, "ilvl")[0].attrs["w:val"];
  const num = (p) => W(p, "numId")[0].attrs["w:val"];
  assert.deepEqual(listed.map(level), ["0", "1", "0", "0", "0", "0", "0"]);
  assert.equal(num(listed[0]), "1");
  assert.notEqual(num(listed[3]), "1");
  const numbering = parseXml(parts.find((p) => p.name === "word/numbering.xml").data);
  const nums = findAll(numbering, "w:num").map((n) => n.attrs["w:numId"]);
  assert.ok(nums.includes(num(listed[3])), "the numbered list's definition is there");
  const abstract = findAll(numbering, "w:abstractNum").find((a) => a.attrs["w:abstractNumId"] === String(Number(num(listed[3])) - 1));
  assert.equal(W(abstract, "numFmt")[0].attrs["w:val"], "decimal");

  // The page break, the poetry indent, alignment, and the code beside its caption.
  assert.ok(W(doc, "br").some((b) => b.attrs["w:type"] === "page"));
  const poetry = paras.find((p) => textOf(p).startsWith("The Lord said"));
  assert.equal(W(poetry, "ind")[0].attrs["w:left"], "480");
  assert.equal(W(paras.find((p) => textOf(p) === "Read <slowly>"), "jc")[0].attrs["w:val"], "center");
  assert.equal(W(paras.find((p) => textOf(p) === "Right."), "jc")[0].attrs["w:val"], "right");
  assert.equal(findAll(doc, "wp:docPr")[0].attrs.descr, "A code to scan for John 3");
  assert.deepEqual(byStyle("CodeCaption"), ["Scan to read John 3"]);
});

test(".docx: Greek and Hebrew runs, Hebrew right to left", () => {
  const parts = docxParts(leaderDoc(), { date: 0 });
  const doc = parseXml(parts.find((p) => p.name === "word/document.xml").data);
  const runs = W(doc, "r");
  const hebrew = runs.find((r) => textOf(r) === "שָׁלוֹם עֲלֵיכֶם");
  assert.ok(W(hebrew, "rtl").length, "Hebrew is right to left");
  assert.equal(W(hebrew, "lang")[0].attrs["w:bidi"], "he-IL");
  assert.equal(W(hebrew, "rFonts")[0].attrs["w:cs"], "Cardo");
  const greek = runs.find((r) => textOf(r) === "ἀγάπη τοῦ θεοῦ");
  assert.equal(W(greek, "lang")[0].attrs["w:val"], "el-GR");
  assert.ok(!W(greek, "rtl").length);
});

test(".docx: links are relationships, a bad one is dropped, and markup in the words is escaped", () => {
  const parts = docxParts(leaderDoc(), { date: 0 });
  const doc = parseXml(parts.find((p) => p.name === "word/document.xml").data);
  const rels = findAll(parseXml(parts.find((p) => p.name === "word/_rels/document.xml.rels").data), "Relationship");
  const target = (id) => rels.find((r) => r.attrs.Id === id);
  const links = findAll(doc, "w:hyperlink").map((h) => ({ text: textOf(h), rel: target(h.attrs["r:id"]) }));
  assert.deepEqual(links.map((l) => [l.text, l.rel.attrs.Target, l.rel.attrs.TargetMode]), [
    ["John 1:14", "https://litbible.net/john-1/#v14", "External"],
    ["Psalm 2:7", "https://www.sefaria.org/Psalms.2.7", "External"],
    ["mail", "mailto:a@b.org?x=1&y=%222%22", "External"], // a valid URI (DK3-9)
  ]);
  assert.ok(!parts.some((p) => typeof p.data === "string" && p.data.includes("javascript:")));
  assert.ok(textOf(doc).includes("A new line & more"));
});

test(".docx: the credit line is the last paragraph and in the file's properties; the paper is the reader's", () => {
  const parts = docxParts(leaderDoc(), { version: "Leader version", paper: "a4", date: Date.UTC(2026, 10, 6, 12) });
  const doc = parseXml(parts.find((p) => p.name === "word/document.xml").data);
  const paras = W(doc, "p");
  assert.equal(textOf(paras.at(-1)), LIT_CREDIT_LINE);
  assert.equal(paras.filter((p) => textOf(p) === LIT_CREDIT_LINE).length, 1, "written once, not again from the foot");
  assert.equal(textOf(paras.at(-2)), "Text as of October 18, 2026");
  const core = parseXml(parts.find((p) => p.name === "docProps/core.xml").data);
  assert.equal(textOf(findAll(core, "dc:description")[0]), DOC_CREDIT);
  assert.equal(textOf(findAll(core, "dc:title")[0]), "Rivers & “Wells” <study>");
  assert.equal(textOf(findAll(core, "dc:subject")[0]), "Leader version");
  assert.equal(textOf(findAll(core, "dcterms:created")[0]), "2026-11-06T12:00:00Z");
  const custom = parseXml(parts.find((p) => p.name === "docProps/custom.xml").data);
  assert.equal(findAll(custom, "property")[0].attrs.name, "Rights");
  assert.equal(textOf(findAll(custom, "vt:lpwstr")[0]), DOC_CREDIT);
  assert.equal(W(doc, "pgSz")[0].attrs["w:w"], "11906");
});

test(".docx: a copy with no foot still ends with the credit line", () => {
  const parts = docxParts({ title: "Bare", blocks: [{ type: "title", text: "Bare" }] }, { date: 0 });
  const doc = parseXml(parts.find((p) => p.name === "word/document.xml").data);
  assert.equal(textOf(W(doc, "p").at(-1)), LIT_CREDIT_LINE);
});

test(".docx: the participant's blanks are underlined lines with the hint after", async () => {
  const entries = unzip(await docxFile(readCopy(article("participant")), { date: 0 }));
  const doc = xmlOf(entries, "word/document.xml");
  const runs = W(doc, "r");
  const blank = runs.find((r) => textOf(r) === "\u00a0".repeat(16));
  assert.ok(W(blank, "u").length);
  const i = runs.indexOf(blank);
  assert.equal(textOf(runs[i + 2]), "(a legal word)");
  assert.equal(W(runs[i + 2], "sz")[0].attrs["w:val"], "19", "the hint at 0.8 of 12pt");
  assert.ok(!entries.some((e) => e.name.startsWith("word/media/")), "no code, no picture");
});

/* ── .odt ─────────────────────────────────────────────────────────────── */

test(".odt: mimetype first and stored, then the manifest's parts, each well-formed", async () => {
  const bytes = await odtFile(leaderDoc(), { version: "Leader version", date: 0 });
  const entries = unzip(bytes);
  assert.deepEqual(entries.map((e) => e.name), ["mimetype", "META-INF/manifest.xml", "content.xml", "styles.xml", "meta.xml", "Pictures/code1.png"]);
  const [mime] = entries;
  assert.equal(mime.method, 0);
  assert.equal(mime.extra, 0);
  assert.equal(mime.offset, 0);
  assert.equal(Buffer.from(bytes).toString("latin1", 30, 38), "mimetype");
  assert.equal(Buffer.from(bytes).toString("latin1", 38, 38 + ODT_MIME.length), ODT_MIME);
  for (const e of entries) if (e.name.endsWith(".xml")) parseXml(e.data.toString("utf8"));
  const listed = findAll(xmlOf(entries, "META-INF/manifest.xml"), "manifest:file-entry").map((f) => f.attrs["manifest:full-path"]);
  assert.deepEqual(listed, ["/", "content.xml", "styles.xml", "meta.xml", "Pictures/code1.png"]);
});

test(".odt: headings, lists, raised verse numbers, footnotes, Greek, Hebrew and the credit line", async () => {
  const entries = unzip(await odtFile(leaderDoc(), { version: "Leader version", paper: "a4", date: 0 }));
  const content = xmlOf(entries, "content.xml");
  const heads = findAll(content, "text:h").map((h) => [h.attrs["text:outline-level"], textOf(h)]);
  assert.deepEqual(heads, [["1", "Rivers & “Wells” <study>"], ["2", "John 3:16–17"], ["2", "Mark 99"], ["2", "Opening"], ["3", "Read <slowly>"], ["2", "Key terms"]]);

  const auto = new Map(findAll(content, "style:style").map((s) => [s.attrs["style:name"], s]));
  const props = (span) => findAll(auto.get(span.attrs["text:style-name"]), "style:text-properties")[0].attrs;
  const spans = findAll(content, "text:span");
  const verse = spans.find((s) => textOf(s) === "16");
  assert.equal(props(verse)["style:text-position"], "super 58%");
  assert.equal(props(verse)["fo:font-weight"], "bold");
  const hebrew = spans.find((s) => textOf(s) === "שָׁלוֹם עֲלֵיכֶם");
  assert.equal(props(hebrew)["style:language-complex"], "he");
  const greek = spans.find((s) => textOf(s) === "ἀγάπη τοῦ θεοῦ");
  assert.equal(props(greek)["fo:language"], "el");

  const lists = findAll(content, "text:list");
  assert.deepEqual(lists.map((l) => l.attrs["text:style-name"] ?? "nested"), ["LB", "nested", "LN", "LB"]);
  assert.deepEqual(findAll(lists[2], "text:p").map(textOf), ["First", "Second"]);

  const paras = findAll(content, "text:p");
  const note = paras.find((p) => p.attrs["text:style-name"] === "Note");
  assert.match(textOf(note), /^a Or only begotten; see John 1:14 & Psalm 2:7\.$/);
  assert.deepEqual(findAll(note, "text:a").map((a) => a.attrs["xlink:href"]), ["https://litbible.net/john-1/#v14", "https://www.sefaria.org/Psalms.2.7"]);
  assert.equal(paras.filter((p) => p.attrs["text:style-name"] === "Ruled").length, 3);
  assert.equal(textOf(paras.at(-1)), LIT_CREDIT_LINE);
  assert.equal(findAll(content, "draw:image")[0].attrs["xlink:href"], "Pictures/code1.png");

  const meta = xmlOf(entries, "meta.xml");
  assert.equal(textOf(findAll(meta, "dc:description")[0]), DOC_CREDIT);
  assert.equal(findAll(meta, "meta:user-defined")[0].attrs["meta:name"], "Rights");
  assert.equal(textOf(findAll(meta, "meta:user-defined")[0]), DOC_CREDIT);
  const page = findAll(xmlOf(entries, "styles.xml"), "style:page-layout-properties")[0];
  assert.equal(page.attrs["fo:page-width"], "210mm");
});

/* ── .rtf ─────────────────────────────────────────────────────────────── */

/** Braces balanced, once escaped ones are set aside. */
function balanced(rtf) {
  let depth = 0;
  for (let i = 0; i < rtf.length; i++) {
    if (rtf[i] === "\\") {
      i++;
      continue;
    }
    if (rtf[i] === "{") depth++;
    if (rtf[i] === "}" && --depth < 0) return false;
  }
  return depth === 0;
}

test(".rtf: seven-bit text, balanced, with Greek and Hebrew as \\uN? and Hebrew right to left", async () => {
  const bytes = await rtfFile(leaderDoc(), { version: "Leader version" });
  assert.ok(bytes.every((b) => b < 0x80), "ASCII only");
  const rtf = new TextDecoder().decode(bytes);
  assert.ok(rtf.startsWith("{\\rtf1\\ansi"));
  assert.ok(balanced(rtf));
  assert.ok(rtf.includes(rtfEscape("ἀγάπη τοῦ θεοῦ")) && rtf.includes("\\lang1032"));
  assert.match(rtf, /\{\\rtlch\\af1\\alang1037\\f1 \\u1513\?/);
  assert.equal(rtfEscape("שׁ"), "\\u1513?\\u1473?");
  assert.equal(rtfEscape("𝔊"), "\\u-10187?\\u-8950?", "past the BMP as a surrogate pair");
  assert.equal(rtfEscape("a{b}\\c\u00a0d"), "a\\{b\\}\\\\c\\~d");
});

test(".rtf: headings, lists, raised verse numbers, footnotes, links, and the credit line last", () => {
  const rtf = rtfText(leaderDoc(), { version: "Leader version", paper: "a4" });
  assert.match(rtf, /\\s1\\keepn[^ ]* \{Rivers & \\u8220\?Wells\\u8221\? <study>\}\\par/);
  assert.match(rtf, /\\s2[^ ]* \{John 3:16\\u8211\?17\}\\par/);
  assert.match(rtf, / \{Week 2 \\u183\? Leader version\}\\par/, "a plain-text part's spaces as a browser shows them");
  assert.match(rtf, /\\s3[^ ]*\\qc \{Read <slowly>\}\\par/);
  assert.match(rtf, /\{\\b\\super 16\}\{\\~\}/);
  assert.match(rtf, /\\li240[^ ]* \{\\super a\}\{ \}\{Or \}\{\\i only begotten\}/);
  assert.match(rtf, /\{\\field\{\\\*\\fldinst\{HYPERLINK "https:\/\/litbible.net\/john-1\/#v14"\}\}\{\\fldrslt\{\\ul\\cf2 \{John 1:14\}\}\}\}/);
  assert.match(rtf, /HYPERLINK "mailto:a@b.org\?x=1&y=%222%22"/);
  assert.match(rtf, /\\li720\\tx720 \\u8226\?\\tab \{One\}\\par\n\\pard\\plain\\sa60\\f0\\fs24\\fi-360\\li1080\\tx1080 \\u9702\?\\tab \{One a\}/);
  assert.match(rtf, /1\.\\tab \{First\}\\par\n.*2\.\\tab \{Second\}/);
  assert.equal((rtf.match(/\\brdrbtw/g) ?? []).length, 3, "three lines to write on");
  assert.match(rtf, /\\page\n/);
  assert.match(rtf, /\{\\pict\\pngblip\\picw2\\pich2\\picwgoal1304\\pichgoal1304\n89504e47/);
  assert.match(rtf, /\{\\doccomm Scripture and footnote quotations/);
  assert.match(rtf, /\\paperw11906\\paperh16838/);
  const lastPara = rtf.trimEnd().split("\\par\n").at(-2);
  assert.ok(lastPara.endsWith(`{${LIT_CREDIT_LINE}}`), lastPara);
  assert.ok(!rtf.includes("javascript"));
});

test(".rtf: a nested ordered list counts in letters, then roman numerals, then decimal again", () => {
  const t = (text) => ({ t: "text", text });
  const doc = { title: "N", blocks: [{ type: "list", ordered: true, items: [
    { inlines: [t("first")], lists: [] },
    { inlines: [t("second")], lists: [{ type: "list", ordered: true, items: [
      { inlines: [t("nested a")], lists: [{ type: "list", ordered: true, items: [
        { inlines: [t("third")], lists: [{ type: "list", ordered: true, items: [{ inlines: [t("deep")], lists: [] }] }] },
      ] }] },
      { inlines: [t("nested b")], lists: [] },
    ] }] },
  ] }] };
  const rtf = rtfText(doc, {});
  assert.match(rtf, /\\li720\\tx720 1\.\\tab \{first\}\\par/, "the top level is decimal");
  assert.match(rtf, /\\li720\\tx720 2\.\\tab \{second\}\\par/, "the top level is decimal");
  assert.match(rtf, /\\li1080\\tx1080 a\.\\tab \{nested a\}\\par/, "depth 1 is letters");
  assert.match(rtf, /\\li1080\\tx1080 b\.\\tab \{nested b\}\\par/, "depth 1 is letters");
  assert.match(rtf, /\\li1440\\tx1440 i\.\\tab \{third\}\\par/, "depth 2 is lowercase roman");
  assert.match(rtf, /\\li1800\\tx1800 1\.\\tab \{deep\}\\par/, "depth 3 goes back to decimal");
  // Past z the letters double, as Word and LibreOffice count: 27 is aa, 28 is bb.
  const many = { title: "N", blocks: [{ type: "list", ordered: true, items: [{ inlines: [t("one")], lists: [
    { type: "list", ordered: true, items: Array.from({ length: 28 }, (_, i) => ({ inlines: [t(`item ${i + 1}`)], lists: [] })) },
  ] }] }] };
  const long = rtfText(many, {});
  assert.match(long, /\\li1080\\tx1080 z\.\\tab \{item 26\}/);
  assert.match(long, /\\li1080\\tx1080 aa\.\\tab \{item 27\}/);
  assert.match(long, /\\li1080\\tx1080 bb\.\\tab \{item 28\}/);
});

/* ── The key terms box (E57) ──────────────────────────────────────────── */

test("the key terms box is read as a box, its tag outside it", () => {
  const blocks = leaderDoc().blocks;
  const box = blocks.find((b) => b.type === "box");
  assert.ok(box, "a box block");
  assert.deepEqual(box.blocks[0], { type: "section", text: "Key terms", flush: true });
  assert.deepEqual(box.blocks.slice(1).map((b) => b.type), ["list", "para"]);
  assert.equal(blocks.filter((b) => b.type === "box").length, 1);
});

test("the key terms box keeps its rule in .docx, .odt and .rtf", async () => {
  const doc = parseXml(docxParts(leaderDoc(), { date: 0 }).find((p) => p.name === "word/document.xml").data);
  const tables = W(doc, "tbl");
  assert.equal(tables.length, 1);
  const borders = W(tables[0], "tblBorders")[0];
  for (const side of ["top", "left", "bottom", "right"]) {
    const b = W(borders, side)[0];
    assert.equal(b.attrs["w:val"], "single", side);
    assert.equal(b.attrs["w:sz"], "6", side);
  }
  const head = W(tables[0], "p")[0];
  assert.equal(textOf(head), "Key terms");
  assert.equal(W(head, "spacing")[0].attrs["w:before"], "0", "no space above the box's heading");
  const gap = doc.children[0].children.find((n, i, all) => all[i + 1] === tables[0]);
  assert.equal(W(gap, "spacing")[0].attrs["w:line"], "200", "10pt of space above the box");

  const entries = unzip(await odtFile(leaderDoc(), { date: 0 }));
  const content = xmlOf(entries, "content.xml");
  const table = findAll(content, "table:table");
  assert.equal(table.length, 1);
  const cell = findAll(table[0], "table:table-cell")[0];
  const cellStyle = findAll(content, "style:style").find((s) => s.attrs["style:name"] === cell.attrs["table:style-name"]);
  assert.match(findAll(cellStyle, "style:table-cell-properties")[0].attrs["fo:border"], /^0\.75pt solid #1D231C$/i);
  const odtHead = findAll(cell, "text:h")[0];
  assert.equal(textOf(odtHead), "Key terms");
  const styleOf = (name) => findAll(content, "style:style").find((s) => s.attrs["style:name"] === name);
  assert.equal(findAll(styleOf(odtHead.attrs["text:style-name"]), "style:paragraph-properties")[0].attrs["fo:margin-top"], "0in");
  assert.equal(findAll(styleOf("Box"), "style:table-properties")[0].attrs["fo:margin-top"], "10pt");

  const rtf = rtfText(leaderDoc(), {});
  const row = rtf.match(/\\trowd[^\n]*\n/);
  assert.ok(row, "a table row");
  for (const side of ["t", "l", "b", "r"]) assert.ok(row[0].includes(`\\clbrdr${side}\\brdrs\\brdrw15`), side);
  const inBox = rtf.slice(row.index, rtf.indexOf("\\row\n"));
  assert.ok(inBox.includes("{Key terms}") && inBox.trimEnd().endsWith("\\cell"));
  assert.match(inBox, /\\s2[^ ]*\\sb0 \{Key terms\}/, "no space above the box's heading");
  assert.ok(rtf.slice(0, row.index).endsWith("\\sl-200\\slmult0\\f0\\fs2 \\par\n"), "10pt of space above the box");
  for (const p of inBox.split("\\pard").slice(1)) assert.ok(p.startsWith("\\intbl"), p.slice(0, 40));
  assert.ok(balanced(rtf));
});

/* ── Loading ──────────────────────────────────────────────────────────── */

const STATIC_IMPORT = /^\s*(?:import|export)\s[^;]*?\sfrom\s+["'](\.[^"']+)["']|^\s*import\s+["'](\.[^"']+)["']/gm;

function staticClosure(entry) {
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
  walk(join(root, entry));
  return seen;
}

test("the writers load only when chosen: the sheet page reaches none by a static import", () => {
  const reached = staticClosure("src/scripts/desk/sheets/sheet-page.js");
  for (const file of ["desk-doc-docx.mjs", "desk-doc-odt.mjs", "desk-doc-rtf.mjs", "desk-zip.mjs"]) {
    assert.ok(!reached.has(`src/lib/${file}`), `${file} is not in the sheet page's chunk`);
  }
  assert.ok(reached.has("src/scripts/desk/sheets/sheet-save.js"));
  const save = readFileSync(join(root, "src/scripts/desk/sheets/sheet-save.js"), "utf8");
  for (const file of ["desk-doc-docx.mjs", "desk-doc-odt.mjs", "desk-doc-rtf.mjs"]) assert.ok(save.includes(`import("../../../lib/${file}")`));
});

/* ── Audit 3, session 3 ───────────────────────────────────────────────── */

/** A model with a list inside a quotation, one outside, and lines to write on. */
function quotedListDoc() {
  const t = (text) => ({ t: "text", text });
  return {
    title: "Q",
    blocks: [
      { type: "quote", blocks: [
        { type: "para", inlines: [t("A quotation.")] },
        { type: "list", ordered: false, items: [{ inlines: [t("in the quote")], lists: [{ type: "list", ordered: true, items: [{ inlines: [t("deeper")], lists: [] }] }] }] },
      ] },
      { type: "list", ordered: false, items: [{ inlines: [t("outside")], lists: [] }] },
      { type: "lines", count: 3 },
    ],
  };
}

test("a list inside a quotation keeps the quotation's margins in .docx, .odt and .rtf (DK3-4)", async () => {
  const doc = parseXml(docxParts(quotedListDoc(), { date: 0 }).find((p) => p.name === "word/document.xml").data);
  const ind = (text) => W(W(doc, "p").find((p) => textOf(p) === text), "ind")[0]?.attrs ?? {};
  assert.deepEqual([ind("in the quote")["w:left"], ind("in the quote")["w:right"], ind("in the quote")["w:hanging"]], ["1440", "720", "360"]);
  assert.equal(ind("deeper")["w:left"], "1800", "a deeper level moves in from the quote's indent");
  assert.deepEqual(ind("outside"), {}, "a list outside a quotation takes its numbering's indent");

  const entries = unzip(await odtFile(quotedListDoc(), { date: 0 }));
  const content = xmlOf(entries, "content.xml");
  const lists = findAll(content, "text:list").filter((l) => l.attrs["text:style-name"]);
  assert.deepEqual(lists.map((l) => l.attrs["text:style-name"]), ["LBQ", "LNQ", "LB"], "a nested list of the other kind names its quoted style");
  const listStyle = findAll(content, "text:list-style").find((s) => s.attrs["style:name"] === "LBQ");
  assert.equal(findAll(listStyle, "style:list-level-label-alignment")[0].attrs["fo:margin-left"], "1in");
  const item = findAll(lists[0], "text:p")[0];
  const style = findAll(content, "style:style").find((s) => s.attrs["style:name"] === item.attrs["text:style-name"]);
  assert.equal(findAll(style, "style:paragraph-properties")[0].attrs["fo:margin-right"], "0.5in");
  const plain = unzip(await odtFile(leaderDoc(), { date: 0 }));
  assert.ok(!findAll(xmlOf(plain, "content.xml"), "text:list-style").some((s) => s.attrs["style:name"] === "LBQ"), "no quoted list style where no list is quoted");

  const rtf = rtfText(quotedListDoc(), {});
  assert.match(rtf, /\\fi-360\\li1440\\ri720\\tx1440 [^\n]*\{in the quote\}/);
  assert.match(rtf, /\\fi-360\\li1800\\ri720\\tx1800 [^\n]*\{deeper\}/);
  assert.match(rtf, /\\fi-360\\li720\\tx720 [^\n]*\{outside\}/);
  assert.ok(balanced(rtf));
});

test(".rtf: lines to write on are each an exact height, with no space before to lose (DK3-10)", () => {
  const rtf = rtfText(quotedListDoc(), {});
  const lines = rtf.split("\n").filter((l) => l.includes("\\brdrbtw"));
  assert.equal(lines.length, 3);
  for (const l of lines) assert.match(l, /^\\pard\\plain\\sb0\\sa0\\sl-640\\slmult0\\brdrb/);
});

test("readCopy reads the reader's own superscript as raised words, not a footnote letter (DK3-5)", () => {
  const el = parseHtml('<div class="desk-rich"><p>The 1<sup>st</sup> and x<sup><em>2</em></sup> and a note<sup class="fn-ref sheet-copy__fnref" data-note="fn1">a</sup>.</p></div>').children[0];
  const out = [];
  for (const child of el.children) block(child, out);
  const [p] = out;
  assert.deepEqual(p.inlines.filter((n) => n.t === "sup" || n.t === "fn").map((n) => [n.t, n.text ?? JSON.stringify(n.kids)]), [
    ["sup", JSON.stringify([{ t: "text", text: "st" }])],
    ["sup", JSON.stringify([{ t: "em", kids: [{ t: "text", text: "2" }] }])],
    ["fn", "a"],
  ]);
  const doc = { title: "S", blocks: out };
  assert.equal(docText(doc).trim(), "The 1st and x2 and a note[a].", "plain text reads a superscript as its words");
  assert.match(docHtml(doc), /1<sup>st<\/sup> and x<sup><em>2<\/em><\/sup>/);
  const runs = docRuns(p.inlines);
  assert.deepEqual(runs.filter((r) => r.sup).map((r) => [r.text, Boolean(r.i)]), [["st", false], ["2", true], ["a", false]]);
});

test("a link's address is written as a valid URI in every writer (DK3-9)", () => {
  assert.equal(docHref("https://x.com/a b"), "https://x.com/a%20b");
  assert.equal(docHref("https://x.com/a%20b"), "https://x.com/a%20b", "an encoded address isn't encoded twice");
  assert.equal(docHref("https://x.com/ünï"), "https://x.com/%C3%BCn%C3%AF");
  assert.equal(docHref("javascript:alert(1)"), null);
  assert.equal(docHref("https://"), null, "one that can't be read");
  const el = parseHtml('<div><p>See <a href="https://x.com/a b">this</a> and <a href="/john-3/#v16">John 3:16</a>.</p></div>').children[0];
  const out = [];
  for (const child of el.children) block(child, out);
  assert.deepEqual(out[0].inlines.filter((n) => n.t === "link").map((n) => n.href), ["https://x.com/a%20b", "https://litbible.net/john-3/#v16"]);
  const parts = docxParts({ title: "L", blocks: out }, { date: 0 });
  const rels = findAll(parseXml(parts.find((p) => p.name === "word/_rels/document.xml.rels").data), "Relationship");
  assert.ok(rels.some((r) => r.attrs.Target === "https://x.com/a%20b"));
  assert.ok(!rels.some((r) => / /.test(r.attrs.Target)), "no target holds a space");
});

test("a code's SVG is given a size before it is drawn, and a code left out is counted (DK3-6)", async () => {
  const { CODES_MISSING, drawCodes, sizedSvg } = await import("../src/scripts/desk/sheets/sheet-save.js");
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29"><rect width="29" height="29"/></svg>';
  assert.match(sizedSvg(svg, 232), /^<svg width="232" height="232" xmlns=/);
  assert.equal(sizedSvg('<svg width="10" viewBox="0 0 1 1"/>', 232), '<svg width="10" viewBox="0 0 1 1"/>', "one with a size keeps it");
  // No Image here, so drawing fails as a refusing browser's would: the file
  // goes without the code, and the count says so.
  const quiet = console.error;
  console.error = () => {};
  let doc;
  try {
    doc = await drawCodes({ title: "C", blocks: [{ type: "code", svg, caption: "c", label: "l" }, { type: "para", inlines: [] }] });
  } finally {
    console.error = quiet;
  }
  assert.equal(doc.codesMissing, 1);
  assert.ok(!doc.blocks[0].png);
  assert.match(CODES_MISSING, /couldn’t be drawn/);
});

test("docRuns stays linear on a paragraph of very many runs (DK3-11)", () => {
  const many = Array.from({ length: 60000 }, (_, i) => (i % 2 ? { t: "em", kids: [{ t: "text", text: " w " }] } : { t: "text", text: " v " }));
  const start = performance.now();
  const runs = docRuns(many);
  const took = performance.now() - start;
  assert.equal(runs.length, 60000);
  assert.equal(runs[0].text, "v ", "no space at the line's start");
  assert.equal(runs.at(-1).text, "w", "none at its end");
  assert.ok(runs.slice(1).every((r) => !r.text.startsWith(" ")), "one space at most between words");
  assert.ok(took < 1500, `took ${Math.round(took)} ms`);
});
