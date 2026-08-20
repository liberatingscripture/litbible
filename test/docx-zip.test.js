// The .docx reader, exercised against archives built in the test itself.
//
// No fixture file is committed, deliberately: the only real .docx files this
// code will ever see are the author's Word masters, which are read-only from
// this repo and never committed. Building the archives here also lets the
// refusal cases be tested at all — there is no way to obtain a zip64 or
// data-descriptor .docx to check in.
import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readDocxEntry, readDocxParts } from "../scripts/lib/docx-zip.mjs";

/**
 * Build a zip from {name: contents}. Written by hand rather than with a
 * library so the structure under test is the structure produced here.
 * @param {Record<string,string>} entries
 * @param {{store?: boolean, flags?: number}} [opts]
 */
function buildZip(entries, opts = {}) {
  const locals = [];
  const central = [];
  let offset = 0;

  for (const [name, text] of Object.entries(entries)) {
    const nameBuf = Buffer.from(name, "utf8");
    const raw = Buffer.from(text, "utf8");
    const body = opts.store ? raw : deflateRawSync(raw);
    const method = opts.store ? 0 : 8;
    const flags = opts.flags ?? 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(0, 14); // crc — unused by the reader
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, body);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(flags, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt32LE(body.length, 20);
    cd.writeUInt32LE(raw.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);

    offset += 30 + nameBuf.length + body.length;
  }

  const localPart = Buffer.concat(locals);
  const centralPart = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(entries).length, 8);
  eocd.writeUInt16LE(Object.keys(entries).length, 10);
  eocd.writeUInt32LE(centralPart.length, 12);
  eocd.writeUInt32LE(localPart.length, 16);
  return Buffer.concat([localPart, centralPart, eocd]);
}

/** Write a zip to a temp file and hand it to `run`, then clean up. */
function withZip(buf, run) {
  const dir = mkdtempSync(join(tmpdir(), "lit-docx-"));
  try {
    const file = join(dir, "test.docx");
    writeFileSync(file, buf);
    return run(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("reads a deflated entry", () => {
  const xml = `<w:document><w:t>${"a".repeat(5000)}</w:t></w:document>`;
  withZip(buildZip({ "word/document.xml": xml }), (file) => {
    assert.equal(readDocxEntry(file, "word/document.xml"), xml);
  });
});

test("reads a stored entry", () => {
  withZip(buildZip({ "word/document.xml": "<w:p/>" }, { store: true }), (file) => {
    assert.equal(readDocxEntry(file, "word/document.xml"), "<w:p/>");
  });
});

test("reads UTF-8 beyond ASCII, so a macron survives the round trip", () => {
  const xml = "<w:t>sōtēr — “curly”</w:t>";
  withZip(buildZip({ "word/document.xml": xml }), (file) => {
    assert.equal(readDocxEntry(file, "word/document.xml"), xml);
  });
});

test("a missing entry is null, not a throw", () => {
  withZip(buildZip({ "word/document.xml": "<w:p/>" }), (file) => {
    assert.equal(readDocxEntry(file, "word/footnotes.xml"), null);
  });
});

test("readDocxParts returns both parts, with null footnotes for a document with none", () => {
  withZip(buildZip({ "word/document.xml": "<d/>", "word/footnotes.xml": "<f/>" }), (file) => {
    assert.deepEqual(readDocxParts(file), { document: "<d/>", footnotes: "<f/>" });
  });
  withZip(buildZip({ "word/document.xml": "<d/>" }), (file) => {
    assert.deepEqual(readDocxParts(file), { document: "<d/>", footnotes: null });
  });
});

test("a file with no document.xml is refused by name", () => {
  withZip(buildZip({ "word/settings.xml": "<s/>" }), (file) => {
    assert.throws(() => readDocxParts(file), /no word\/document\.xml/);
  });
});

test("a non-zip is refused rather than read as empty", () => {
  withZip(Buffer.from("this is not a zip archive at all"), (file) => {
    assert.throws(() => readDocxEntry(file, "word/document.xml"), /not a zip archive/);
  });
});

test("an encrypted archive is refused", () => {
  withZip(buildZip({ "word/document.xml": "<d/>" }, { flags: 0x0001 }), (file) => {
    assert.throws(() => readDocxEntry(file, "word/document.xml"), /encrypted/);
  });
});

test("an unsupported compression method is named rather than guessed at", () => {
  const buf = buildZip({ "word/document.xml": "<d/>" });
  // Method 12 (bzip2) in both the local header and the central directory.
  buf.writeUInt16LE(12, 8);
  const cdStart = buf.readUInt32LE(buf.length - 6);
  buf.writeUInt16LE(12, cdStart + 10);
  withZip(buf, (file) => {
    assert.throws(() => readDocxEntry(file, "word/document.xml"), /unsupported compression method 12/);
  });
});
