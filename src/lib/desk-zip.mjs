// src/lib/desk-zip.mjs
//
// A zip file written by hand, for the documents under a sheet's "Save as"
// (STUDY-DESK-FIXES.md, E37): a .docx and an .odt are zips of XML. It writes
// what those need and nothing more: stored (method 0) and deflated (method 8)
// entries, no zip64, no encryption, no comments. Compression is the
// browser's own CompressionStream("deflate-raw"), as desk-sheet-share.mjs
// uses, so no library is loaded. Node has CompressionStream too, which is
// how the tests run it.
//
// Entries are written in the order given, which OpenDocument depends on: its
// `mimetype` entry must come first and be stored, uncompressed and with no
// extra field, so a program can read the type at a fixed offset.

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const END = 0x06054b50;
const VERSION = 20; // 2.0: deflate

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** The CRC-32 a zip entry carries (the IEEE polynomial, as zlib's). */
export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function deflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A date as a zip's two DOS words, in local time (as zip programs read them). */
function dosTime(date) {
  const d = new Date(date);
  const year = Math.min(Math.max(d.getFullYear(), 1980), 2107);
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/**
 * A zip of `entries`, in order.
 *
 * @param {{ name: string, data: Uint8Array | string, store?: boolean }[]} entries
 *   `store` keeps an entry uncompressed; a string is written as UTF-8. An entry
 *   deflate would make no smaller is stored anyway.
 * @param {{ date?: Date | number }} [opts] the entries' time (now by default)
 * @returns {Promise<Uint8Array>}
 */
export async function zipFiles(entries, { date = Date.now() } = {}) {
  const encoder = new TextEncoder();
  const when = dosTime(date);
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const raw = typeof entry.data === "string" ? encoder.encode(entry.data) : entry.data;
    let body = raw;
    let method = 0;
    if (!entry.store) {
      const packed = await deflateRaw(raw);
      if (packed.length < raw.length) {
        body = packed;
        method = 8;
      }
    }
    const crc = crc32(raw);
    // Bit 11 says the name is UTF-8; every name the writers use is ASCII.
    const flags = /[^\x20-\x7e]/.test(entry.name) ? 0x0800 : 0;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, LOCAL, true);
    local.setUint16(4, VERSION, true);
    local.setUint16(6, flags, true);
    local.setUint16(8, method, true);
    local.setUint16(10, when.time, true);
    local.setUint16(12, when.date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, body.length, true);
    local.setUint32(22, raw.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    locals.push(new Uint8Array(local.buffer), name, body);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, CENTRAL, true);
    central.setUint16(4, VERSION, true);
    central.setUint16(6, VERSION, true);
    central.setUint16(8, flags, true);
    central.setUint16(10, method, true);
    central.setUint16(12, when.time, true);
    central.setUint16(14, when.date, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, body.length, true);
    central.setUint32(24, raw.length, true);
    central.setUint16(28, name.length, true);
    // Extra field, comment, disk number, and the two attribute words stay 0.
    central.setUint32(42, offset, true);
    centrals.push(new Uint8Array(central.buffer), name);

    offset += 30 + name.length + body.length;
  }

  const centralSize = centrals.reduce((n, part) => n + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, END, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  const parts = [...locals, ...centrals, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
