// test/desk-package-integrity.test.js
//
// The Study Desk's four package writers (Audit 3, LG3-8): the .docx and .odt
// (desk-doc-docx.mjs, desk-doc-odt.mjs, from the golden leader copy) and the
// .pptx and .odp (desk-slides-pptx.mjs, desk-slides-odp.mjs, from a deck). The
// writer tests check each XML part and the copy's shapes; this checks what a
// repair dialog in Word, PowerPoint or LibreOffice is made of, and needs no
// new dependency:
// - every entry's CRC-32 matches its data;
// - every relationship's Target (not External) names a part in the file;
// - every r:id, r:embed or r:link a part uses is defined in its own .rels;
// - no two relationships in one .rels share an Id;
// - every [Content_Types].xml Override names a part, and every part has a
//   content type (OOXML);
// - every manifest.xml entry is in the file (ODF).
// The checker is applied to the real packages, and to small broken ones, so
// it is shown to fail when a package breaks.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync, crc32 as zlibCrc32 } from "node:zlib";

import { miniDocument, parseHtml } from "./helpers/mini-dom.js";
import { DOC_CREDIT } from "../src/lib/desk-sheet-doc.mjs";
import { zipFiles } from "../src/lib/desk-zip.mjs";
import { docxFile } from "../src/lib/desk-doc-docx.mjs";
import { odtFile } from "../src/lib/desk-doc-odt.mjs";
import { deckSlides } from "../src/lib/desk-slides.mjs";
import { pptxFile } from "../src/lib/desk-slides-pptx.mjs";
import { odpFile } from "../src/lib/desk-slides-odp.mjs";

globalThis.Node ??= /** @type {any} */ ({ TEXT_NODE: 3, ELEMENT_NODE: 1 });
globalThis.document ??= /** @type {any} */ (miniDocument);
const { readCopy } = await import("../src/scripts/desk/sheets/sheet-word.js");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GOLDEN = JSON.parse(readFileSync(join(root, "test/fixtures/sheet-copy-golden.json"), "utf8"));
const article = (name) => parseHtml(GOLDEN.copies[name].article).children[0];

// A 1×1 PNG, the same one desk-slides.test.js draws its codes with.
const PNG = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));

/** The leader's copy as a model, with its codes drawn. */
function leaderDoc() {
  const doc = readCopy(article("leader"));
  for (const b of doc.blocks) if (b.type === "code") Object.assign(b, { png: PNG, pixels: 1 });
  return doc;
}

const T = (text) => ({ t: "text", text });
const vn = (n) => ({ t: "vn", text: String(n) });
const para = (...inlines) => ({ type: "para", inlines });

/** A deck with every kind of slide the writers draw: a code, a passage with a blank and a note, a list, key terms. */
function screens() {
  const words = " In the beginning was the Word, and the Word was with God, and so it was. ";
  const revealed = [vn(1), T(words), vn(2), T(words)];
  return [
    { kind: "start", title: "John 1", subtitle: "Sunday", codes: [{ png: PNG, pixels: 1, label: "John 1", printable: "litbible.net/john-1" }], addresses: "litbible.net/john-1", notes: [para(T("Welcome."))] },
    { kind: "passage", heading: "John 1:1–2", revealed: [para(...revealed)], covered: [para(...revealed)], footnotes: [{ type: "note", label: "a", inlines: [T("Greek logos.")] }], notes: [para(T("Pause."))] },
    { kind: "question", blocks: [para(T("What is “the Word”? & wait"))], notes: [] },
    { kind: "text", blocks: [{ type: "list", ordered: true, items: [{ inlines: [T("First")], lists: [] }, { inlines: [T("Second")], lists: [] }] }], notes: [] },
    { kind: "keyTerms", blocks: [{ type: "list", ordered: false, items: [{ inlines: [{ t: "strong", kids: [T("Word")] }, T(" λόγος")], lists: [] }] }], notes: [] },
  ];
}
const deck = () => ({ title: "John 1", slides: deckSlides(screens(), { credit: DOC_CREDIT }) });

/* ── Reading a package, and the checks ────────────────────────────────── */

/** The entries of a zip, read from its central directory: name, CRC as written, and the data. */
function readZip(bytes) {
  const buf = Buffer.from(bytes);
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(end >= 0, "has an end of central directory record");
  const count = buf.readUInt16LE(end + 10);
  let at = buf.readUInt32LE(end + 16);
  const entries = [];
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(at + 10);
    const crc = buf.readUInt32LE(at + 16);
    const size = buf.readUInt32LE(at + 20); // compressed
    const raw = buf.readUInt32LE(at + 24);
    const nameLength = buf.readUInt16LE(at + 28);
    const name = buf.toString("utf8", at + 46, at + 46 + nameLength);
    const local = buf.readUInt32LE(at + 42);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const body = buf.subarray(start, start + size);
    const data = method === 8 ? inflateRawSync(body) : Buffer.from(body);
    assert.equal(data.length, raw, `${name}: its size`);
    entries.push({ name, crc, data });
    at += 46 + nameLength + buf.readUInt16LE(at + 30) + buf.readUInt16LE(at + 32);
  }
  return entries;
}

/** Every way the package breaks, as readable lines; empty when it is sound. */
function packageProblems(bytes) {
  const entries = readZip(bytes);
  const byName = new Map(entries.map((e) => [e.name, e]));
  const names = new Set(byName.keys());
  const text = (name) => byName.get(name).data.toString("utf8");
  const problems = [];

  for (const e of entries) {
    if (zlibCrc32(e.data) !== e.crc) problems.push(`${e.name}: its CRC-32 doesn't match its data`);
  }

  if (names.has("META-INF/manifest.xml")) {
    // OpenDocument: every manifest entry is in the file.
    for (const m of text("META-INF/manifest.xml").matchAll(/<manifest:file-entry\b[^>]*\bmanifest:full-path="([^"]*)"/g)) {
      if (m[1] !== "/" && !names.has(m[1])) problems.push(`manifest.xml lists ${m[1]}, which is not in the file`);
    }
    return problems;
  }

  // OOXML: relationships, the parts they use, and the content types.
  const rels = entries.filter((e) => e.name.endsWith(".rels"));
  for (const e of rels) {
    const m = /^(.*?)_rels\/(.*)\.rels$/.exec(e.name);
    const base = m[1]; // the folder the relationship targets are relative to
    const owner = base + m[2]; // the part the .rels belongs to ("" for the package itself)
    const ids = new Set();
    for (const r of e.data.toString("utf8").matchAll(/<Relationship\s([^>]*)>/g)) {
      const id = /\bId="([^"]*)"/.exec(r[1])[1];
      if (ids.has(id)) problems.push(`${e.name}: relationship ${id} is defined twice`);
      ids.add(id);
      if (/TargetMode="External"/.test(r[1])) continue;
      const target = /\bTarget="([^"]*)"/.exec(r[1])[1];
      const part = target.startsWith("/") ? target.slice(1) : posix.normalize(base + target);
      if (!names.has(part)) problems.push(`${e.name}: relationship ${id} targets ${part}, which is not in the file`);
    }
    if (owner && names.has(owner)) {
      for (const u of text(owner).matchAll(/\br:(?:id|embed|link|pict)="([^"]*)"/g)) {
        if (!ids.has(u[1])) problems.push(`${owner} uses r:id "${u[1]}", which ${e.name} doesn't define`);
      }
    }
  }

  const ct = byName.get("[Content_Types].xml");
  if (ct) {
    const xml = ct.data.toString("utf8");
    const defaults = new Set([...xml.matchAll(/<Default\s[^>]*\bExtension="([^"]*)"/g)].map((x) => x[1].toLowerCase()));
    const overrides = [...xml.matchAll(/<Override\s[^>]*\bPartName="\/([^"]*)"/g)].map((x) => x[1]);
    for (const o of overrides) if (!names.has(o)) problems.push(`[Content_Types].xml overrides ${o}, which is not in the file`);
    for (const n of names) {
      if (n === "[Content_Types].xml") continue;
      const ext = n.split(".").pop().toLowerCase();
      if (!overrides.includes(n) && !defaults.has(ext)) problems.push(`${n} has no content type`);
    }
  }
  return problems;
}

/* ── The real packages ────────────────────────────────────────────────── */

const WRITERS = [
  ["docx", () => docxFile(leaderDoc(), { date: 0 })],
  ["odt", () => odtFile(leaderDoc(), { date: 0 })],
  ["pptx", () => pptxFile(deck(), { title: "John 1", date: 0 })],
  ["odp", () => odpFile(deck(), { title: "John 1", date: 0 })],
];

for (const [kind, write] of WRITERS) {
  test(`the .${kind} the writer builds is sound: CRCs, relationships, content types and manifest`, async () => {
    const bytes = await write();
    const parts = readZip(bytes);
    assert.ok(parts.length >= 5, `a real package has parts (it has ${parts.length})`);
    assert.deepEqual(packageProblems(bytes), []);
  });
}

/* ── The checker bites: small packages it must reject ─────────────────── */

test("a CRC-32 that doesn't match its data is reported", async () => {
  const bytes = Buffer.from(await zipFiles([{ name: "a.txt", data: "hello", store: true }], { date: 0 }));
  bytes[bytes.indexOf("hello")] = "j".charCodeAt(0); // flip one stored byte
  assert.match(packageProblems(bytes).join("\n"), /a\.txt: its CRC-32 doesn't match/);
});

test("a broken OOXML package is reported: dangling targets, undefined ids, duplicate ids, orphan overrides", async () => {
  const bytes = await zipFiles(
    [
      { name: "[Content_Types].xml", data: '<Types><Default Extension="rels"/><Default Extension="xml"/><Override PartName="/word/gone.xml"/></Types>' },
      { name: "_rels/.rels", data: '<Relationships><Relationship Id="rId1" Target="word/document.xml"/></Relationships>' },
      { name: "word/document.xml", data: '<w:document r:id="rId9"/>' },
      { name: "word/_rels/document.xml.rels", data: '<Relationships><Relationship Id="rId1" Target="media/missing.png"/><Relationship Id="rId1" Target="styles.xml"/></Relationships>' },
    ],
    { date: 0 },
  );
  const problems = packageProblems(bytes).join("\n");
  assert.match(problems, /relationship rId1 targets word\/media\/missing\.png/);
  assert.match(problems, /relationship rId1 is defined twice/);
  assert.match(problems, /word\/document\.xml uses r:id "rId9"/);
  assert.match(problems, /\[Content_Types\]\.xml overrides word\/gone\.xml/);
});

test("a broken ODF package is reported: a manifest entry that is not in the file", async () => {
  const bytes = await zipFiles(
    [
      { name: "mimetype", data: "application/vnd.oasis.opendocument.text", store: true },
      { name: "META-INF/manifest.xml", data: '<manifest:manifest><manifest:file-entry manifest:media-type="" manifest:full-path="/"/><manifest:file-entry manifest:full-path="Pictures/gone.png"/></manifest:manifest>' },
      { name: "content.xml", data: "<office:document-content/>" },
    ],
    { date: 0 },
  );
  assert.match(packageProblems(bytes).join("\n"), /manifest\.xml lists Pictures\/gone\.png/);
});
