// A small, strict CBOR decoder (RFC 8949), for the two things a passkey sends
// in CBOR: the attestation object, and the public key inside it.
//
// It reads only what those hold (whole numbers, byte strings, text, arrays,
// maps, and true, false, and null) and refuses everything else: a float, a
// tag, a length without an end, a map with the same key twice, a text string
// that isn't UTF-8, and anything nested deeper than a passkey ever nests. A
// refusal is a thrown CborError; nothing here trusts a length it was given
// further than the bytes it actually has.
//
// Why hand-written: see the header of src/webauthn.js.

export class CborError extends Error {}

const MAX_DEPTH = 8;
const text = new TextDecoder("utf-8", { fatal: true });

/**
 * Decodes one item that starts at `at`. Returns { value, end }, where `end`
 * is the offset just past it. A map is returned as a Map (its keys are
 * numbers or text), a byte string as a Uint8Array over a copy of its bytes.
 */
export function decodeCbor(bytes, at = 0, depth = 0) {
  if (depth > MAX_DEPTH) throw new CborError("nested too deep");
  if (at >= bytes.length) throw new CborError("ends early");
  const first = bytes[at];
  const major = first >> 5;
  const info = first & 0x1f;
  let pos = at + 1;

  // The argument: a count, a length, or the number itself.
  let arg;
  if (info < 24) arg = info;
  else if (info >= 24 && info <= 27) {
    const size = 1 << (info - 24);
    if (pos + size > bytes.length) throw new CborError("ends early");
    arg = 0;
    for (let i = 0; i < size; i++) arg = arg * 256 + bytes[pos + i];
    pos += size;
    if (!Number.isSafeInteger(arg)) throw new CborError("a number too large");
  } else throw new CborError("an indefinite or reserved length");

  switch (major) {
    case 0:
      return { value: arg, end: pos };
    case 1:
      return { value: -1 - arg, end: pos };
    case 2: {
      if (pos + arg > bytes.length) throw new CborError("ends early");
      return { value: bytes.slice(pos, pos + arg), end: pos + arg };
    }
    case 3: {
      if (pos + arg > bytes.length) throw new CborError("ends early");
      let value;
      try {
        value = text.decode(bytes.subarray(pos, pos + arg));
      } catch {
        throw new CborError("text that is not UTF-8");
      }
      return { value, end: pos + arg };
    }
    case 4: {
      // Every item takes at least one byte, so a count past what is left is a lie.
      if (arg > bytes.length - pos) throw new CborError("ends early");
      const value = [];
      for (let i = 0; i < arg; i++) {
        const item = decodeCbor(bytes, pos, depth + 1);
        value.push(item.value);
        pos = item.end;
      }
      return { value, end: pos };
    }
    case 5: {
      if (arg > (bytes.length - pos) / 2) throw new CborError("ends early");
      const value = new Map();
      for (let i = 0; i < arg; i++) {
        const key = decodeCbor(bytes, pos, depth + 1);
        if (typeof key.value !== "number" && typeof key.value !== "string") throw new CborError("a map key that is not a number or text");
        if (value.has(key.value)) throw new CborError("a map key twice");
        const item = decodeCbor(bytes, key.end, depth + 1);
        value.set(key.value, item.value);
        pos = item.end;
      }
      return { value, end: pos };
    }
    case 7:
      if (info === 20) return { value: false, end: pos };
      if (info === 21) return { value: true, end: pos };
      if (info === 22) return { value: null, end: pos };
      throw new CborError("a float or a simple value");
    default:
      throw new CborError("a tag");
  }
}

/** Decodes bytes that must be exactly one item, with nothing after it. */
export function decodeCborWhole(bytes) {
  const { value, end } = decodeCbor(bytes);
  if (end !== bytes.length) throw new CborError("bytes after the item");
  return value;
}
