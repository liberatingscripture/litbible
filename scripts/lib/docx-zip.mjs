// Minimal reader for the two XML parts of a .docx.
//
// A .docx is a zip. The repo has no zip dependency and does not want one for
// this, so rather than make every import start with a manual unpack step
// (which is what MASTER_XML_DIR exists for, and which is fine for the
// read-only reconciliation tooling) this reads the archive directly:
// End of Central Directory -> central directory -> local header -> inflate.
//
// Deliberately NOT a general zip library. It reads stored (method 0) and
// deflate (method 8) entries, which is all Word writes, and throws on
// anything else rather than guessing. Encrypted, spanned, and zip64 archives
// are refused by name.
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

const EOCD_SIG = 0x06054b50;
const CD_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;
const ZIP64_EOCD_LOCATOR_SIG = 0x07064b50;

/** Find the End of Central Directory record, scanning back from the tail.
 *  Its position is only discoverable this way — the trailing comment is
 *  variable-length, so there is no fixed offset. */
function findEocd(buf) {
  const min = Math.max(0, buf.length - 0xffff - 22);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) !== EOCD_SIG) continue;
    const commentLen = buf.readUInt16LE(i + 20);
    if (i + 22 + commentLen === buf.length) return i;
  }
  throw new Error("not a zip archive: no End of Central Directory record");
}

/** Map every entry name to its local-header offset. */
function centralDirectory(buf) {
  const eocd = findEocd(buf);
  if (eocd >= 20 && buf.readUInt32LE(eocd - 20) === ZIP64_EOCD_LOCATOR_SIG) {
    throw new Error("zip64 archives are not supported; unpack the .docx by hand");
  }
  let count = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16);
  const out = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(ptr) !== CD_SIG) throw new Error(`corrupt central directory at entry ${i}`);
    const flags = buf.readUInt16LE(ptr + 8);
    if (flags & 0x0001) throw new Error("encrypted archive");
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const name = buf.toString("utf8", ptr + 46, ptr + 46 + nameLen);
    out.set(name, buf.readUInt32LE(ptr + 42));
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/**
 * Read one entry from a .docx as a UTF-8 string.
 * @param {string} file  path to the .docx
 * @param {string} name  archive-relative name, e.g. "word/document.xml"
 * @returns {string|null} the entry's text, or null if the archive has no such entry
 */
export function readDocxEntry(file, name) {
  const buf = readFileSync(file);
  const offset = centralDirectory(buf).get(name);
  if (offset === undefined) return null;

  if (buf.readUInt32LE(offset) !== LOCAL_SIG) throw new Error(`corrupt local header for ${name}`);
  const method = buf.readUInt16LE(offset + 8);
  let size = buf.readUInt32LE(offset + 18); // compressed size
  const nameLen = buf.readUInt16LE(offset + 26);
  const extraLen = buf.readUInt16LE(offset + 28);
  let start = offset + 30 + nameLen + extraLen;

  // A streamed entry writes zeros here and puts the real sizes in a trailing
  // data descriptor. Word does not do this, but say so plainly if it ever does
  // rather than silently inflating an empty slice.
  if (size === 0 && (buf.readUInt16LE(offset + 6) & 0x0008))
    throw new Error(`${name}: entry uses a data descriptor; unpack the .docx by hand`);

  const body = buf.subarray(start, start + size);
  if (method === 0) return body.toString("utf8");
  if (method === 8) return inflateRawSync(body).toString("utf8");
  throw new Error(`${name}: unsupported compression method ${method}`);
}

/** The two parts an import needs. `footnotes` is null for a document with none. */
export function readDocxParts(file) {
  const document = readDocxEntry(file, "word/document.xml");
  if (document === null) throw new Error(`${file}: no word/document.xml — not a .docx?`);
  return { document, footnotes: readDocxEntry(file, "word/footnotes.xml") };
}
