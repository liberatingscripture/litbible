// Byte-safe, structural single-string-field replacement for chapter JSON.
//
// THIS IS THE SAFETY-CRITICAL MODULE (see the approved plan's "Top risks"
// #3 and #4). `scripts/build-api-manifest.mjs` hashes chapter files by raw
// bytes, and 169 of 260 files on `main` are NOT in Prettier's canonical
// format - a `JSON.parse` -> `JSON.stringify` round trip would reformat
// every one of them, changing every hash and forcing every app install to
// re-download files whose CONTENT never changed. So a splice here is never
// "parse, mutate, reserialize" - it is "find the exact byte span of one
// string value and replace only that span," leaving every other byte
// (indentation, key order, trailing commas' absence, one-line vs. multi-line
// footnote objects, BOM, trailing-newline presence) untouched.
//
// Two building blocks:
//   locateStringSpan(raw, path)  - a recursive-descent JSON reader that
//     walks `raw` following `path` (object keys / array indices) WITHOUT
//     ever calling JSON.parse on the whole file, and returns the exact
//     [start, end) span of the target string literal, quotes included.
//     Addressing is always STRUCTURAL (path), never a content search - see
//     the module docs on why (fnref ids repeat inside paragraph HTML,
//     bracketed footnote pairs are byte-identical, some notes repeat
//     verbatim across chapters).
//   spliceValue(raw, path, oldValue, newValue) - replaces exactly that span,
//     re-encoding newValue to match the span's own escaping convention
//     (encodeLike), and running all seven assertions from the plan's
//     "Phase 3" section, IN ORDER, each throwing on failure:
//       1. parse succeeds            - `raw` itself must be valid JSON
//       2. get(path) === oldValue    - stale-ledger guard
//       3. span round-trips          - the located span, JSON.parse'd alone,
//                                       must decode to exactly oldValue
//       4. result parses             - the spliced file must still be valid JSON
//       5. deep-equal against the clone with only `path` changed
//       6. bytes outside the span identical
//       7. BOM/newline state unchanged

// ---------------------------------------------------------------------
// Low-level scanner: recursive descent over the raw string, byte-for-byte
// (well, UTF-16-code-unit-for-code-unit - see "On byte vs. character
// offsets" at the bottom of this file for why that's the right unit here).
// ---------------------------------------------------------------------

function isJsonWs(c) {
  return c === " " || c === "\t" || c === "\n" || c === "\r";
}

function skipWs(s, i) {
  while (i < s.length && isJsonWs(s[i])) i++;
  return i;
}

/** s[i] must be '"'. Returns the [start,end) span of the whole string
 *  literal (quotes included), without decoding it. */
function scanStringSpan(s, i) {
  if (s[i] !== '"') {
    throw new Error(`json-splice: expected '"' at offset ${i}, found ${JSON.stringify(s[i])}`);
  }
  let j = i + 1;
  while (j < s.length) {
    const c = s[j];
    if (c === "\\") {
      // Every JSON escape is backslash + exactly one further character
      // (\", \\, \/, \b, \f, \n, \r, \t, or \u followed by 4 hex digits -
      // those 4 hex digits are never '"' or '\\', so simply skipping the
      // backslash + its immediate next character and resuming the normal
      // scan handles \uXXXX correctly too, without special-casing it).
      j += 2;
      continue;
    }
    if (c === '"') return { start: i, end: j + 1 };
    if (c === "\n" || c === "\r") {
      throw new Error(`json-splice: unescaped newline inside a JSON string at offset ${j}`);
    }
    j++;
  }
  throw new Error(`json-splice: unterminated string starting at offset ${i}`);
}

/** s[i] at the start of any JSON value. Returns its [start,end) span
 *  without building a JS value - used to skip over object members / array
 *  elements that aren't on the path we're following. */
function skipValue(s, i) {
  i = skipWs(s, i);
  const start = i;
  const c = s[i];
  if (c === undefined) throw new Error(`json-splice: unexpected end of input at offset ${i}`);
  if (c === '"') return scanStringSpan(s, i);
  if (c === "{") return skipObject(s, i);
  if (c === "[") return skipArray(s, i);
  if (c === "t") {
    if (s.slice(i, i + 4) !== "true") throw new Error(`json-splice: invalid literal at offset ${i}`);
    return { start, end: i + 4 };
  }
  if (c === "f") {
    if (s.slice(i, i + 5) !== "false") throw new Error(`json-splice: invalid literal at offset ${i}`);
    return { start, end: i + 5 };
  }
  if (c === "n") {
    if (s.slice(i, i + 4) !== "null") throw new Error(`json-splice: invalid literal at offset ${i}`);
    return { start, end: i + 4 };
  }
  if (c === "-" || (c >= "0" && c <= "9")) {
    let j = i;
    if (s[j] === "-") j++;
    if (s[j] === "0") {
      j++;
    } else if (s[j] >= "1" && s[j] <= "9") {
      while (j < s.length && s[j] >= "0" && s[j] <= "9") j++;
    } else {
      throw new Error(`json-splice: invalid number at offset ${i}`);
    }
    if (s[j] === ".") {
      j++;
      if (!(s[j] >= "0" && s[j] <= "9")) throw new Error(`json-splice: invalid number at offset ${i}`);
      while (j < s.length && s[j] >= "0" && s[j] <= "9") j++;
    }
    if (s[j] === "e" || s[j] === "E") {
      j++;
      if (s[j] === "+" || s[j] === "-") j++;
      if (!(s[j] >= "0" && s[j] <= "9")) throw new Error(`json-splice: invalid number at offset ${i}`);
      while (j < s.length && s[j] >= "0" && s[j] <= "9") j++;
    }
    return { start, end: j };
  }
  throw new Error(`json-splice: unexpected character ${JSON.stringify(c)} at offset ${i}`);
}

/** s[i] must be '{'. Returns the [start,end) span of the whole object. */
function skipObject(s, i) {
  let j = skipWs(s, i + 1);
  if (s[j] === "}") return { start: i, end: j + 1 };
  while (true) {
    j = skipWs(s, j);
    if (s[j] !== '"') throw new Error(`json-splice: expected object key (string) at offset ${j}`);
    const keySpan = scanStringSpan(s, j);
    j = skipWs(s, keySpan.end);
    if (s[j] !== ":") throw new Error(`json-splice: expected ':' at offset ${j}`);
    j = skipWs(s, j + 1);
    const valSpan = skipValue(s, j);
    j = skipWs(s, valSpan.end);
    if (s[j] === ",") {
      j = skipWs(s, j + 1);
      continue;
    }
    if (s[j] === "}") return { start: i, end: j + 1 };
    throw new Error(`json-splice: expected ',' or '}' at offset ${j}`);
  }
}

/** s[i] must be '['. Returns the [start,end) span of the whole array. */
function skipArray(s, i) {
  let j = skipWs(s, i + 1);
  if (s[j] === "]") return { start: i, end: j + 1 };
  while (true) {
    j = skipWs(s, j);
    const valSpan = skipValue(s, j);
    j = skipWs(s, valSpan.end);
    if (s[j] === ",") {
      j = skipWs(s, j + 1);
      continue;
    }
    if (s[j] === "]") return { start: i, end: j + 1 };
    throw new Error(`json-splice: expected ',' or ']' at offset ${j}`);
  }
}

/** Position (index into `s`) of an object member's VALUE, by key. s[i] must
 *  be '{'. Throws if the key isn't found. */
function findObjectValuePos(s, i, targetKey) {
  let j = skipWs(s, i + 1);
  if (s[j] === "}") {
    throw new Error(`json-splice: key ${JSON.stringify(targetKey)} not found (empty object at offset ${i})`);
  }
  while (true) {
    j = skipWs(s, j);
    if (s[j] !== '"') throw new Error(`json-splice: expected object key (string) at offset ${j}`);
    const keySpan = scanStringSpan(s, j);
    const keyValue = JSON.parse(s.slice(keySpan.start, keySpan.end));
    j = skipWs(s, keySpan.end);
    if (s[j] !== ":") throw new Error(`json-splice: expected ':' at offset ${j}`);
    const valueStart = skipWs(s, j + 1);
    if (keyValue === targetKey) return valueStart;
    const valSpan = skipValue(s, valueStart);
    j = skipWs(s, valSpan.end);
    if (s[j] === ",") {
      j = skipWs(s, j + 1);
      continue;
    }
    if (s[j] === "}") {
      throw new Error(`json-splice: key ${JSON.stringify(targetKey)} not found in object ending at offset ${j}`);
    }
    throw new Error(`json-splice: expected ',' or '}' at offset ${j}`);
  }
}

/** Position of an array element's VALUE, by index. s[i] must be '['. Throws
 *  if the index is out of bounds. */
function findArrayValuePos(s, i, targetIndex) {
  if (!Number.isInteger(targetIndex) || targetIndex < 0) {
    throw new Error(`json-splice: array index must be a non-negative integer, got ${JSON.stringify(targetIndex)}`);
  }
  let j = skipWs(s, i + 1);
  if (s[j] === "]") {
    throw new Error(`json-splice: array index ${targetIndex} out of bounds (empty array at offset ${i})`);
  }
  let idx = 0;
  while (true) {
    j = skipWs(s, j);
    if (idx === targetIndex) return j;
    const valSpan = skipValue(s, j);
    j = skipWs(s, valSpan.end);
    idx++;
    if (s[j] === ",") {
      j = skipWs(s, j + 1);
      continue;
    }
    if (s[j] === "]") {
      throw new Error(`json-splice: array index ${targetIndex} out of bounds (length ${idx}, at offset ${j})`);
    }
    throw new Error(`json-splice: expected ',' or ']' at offset ${j}`);
  }
}

/**
 * Recursive-descent locate of a STRING value's span by structural path,
 * never by content search (a substring like an fnref id can appear
 * elsewhere in the file legitimately - see module header).
 * @param {string} raw
 * @param {Array<string|number>} path e.g. ["footnotes", 5, "html"] or ["paragraphs", 3]
 * @returns {{start:number, end:number}} span of the string literal, quotes included
 */
export function locateStringSpan(raw, path) {
  if (!Array.isArray(path) || path.length === 0) {
    throw new Error(`json-splice: path must be a non-empty array, got ${JSON.stringify(path)}`);
  }
  let pos = skipWs(raw, 0);
  for (let level = 0; level < path.length; level++) {
    const seg = path[level];
    const isLast = level === path.length - 1;
    if (typeof seg === "number") {
      if (raw[pos] !== "[") {
        throw new Error(
          `json-splice: expected array at path ${JSON.stringify(path.slice(0, level))} (offset ${pos}), found ${JSON.stringify(raw[pos])}`,
        );
      }
      pos = findArrayValuePos(raw, pos, seg);
    } else if (typeof seg === "string") {
      if (raw[pos] !== "{") {
        throw new Error(
          `json-splice: expected object at path ${JSON.stringify(path.slice(0, level))} (offset ${pos}), found ${JSON.stringify(raw[pos])}`,
        );
      }
      pos = findObjectValuePos(raw, pos, seg);
    } else {
      throw new Error(`json-splice: invalid path segment ${JSON.stringify(seg)} (must be string or number)`);
    }
    pos = skipWs(raw, pos);
    if (isLast) {
      if (raw[pos] !== '"') {
        throw new Error(
          `json-splice: path ${JSON.stringify(path)} does not point to a string value (found ${JSON.stringify(raw[pos])} at offset ${pos})`,
        );
      }
      return scanStringSpan(raw, pos);
    }
  }
  /* istanbul ignore next - unreachable: the loop always returns on isLast */
  throw new Error("json-splice: unreachable");
}

// ---------------------------------------------------------------------
// Encoding: re-serialize a replacement string to match the EXISTING span's
// own escaping convention. This is per-STRING, not per-file: the corpus has
// files where some string values use literal UTF-8 for curly quotes/dashes
// and others use \uXXXX escapes for the SAME characters (confirmed by
// inspecting colossians-3.json, ephesians-5.json, luke-13.json directly -
// luke-13 escapes every non-ASCII character throughout, colossians-3 is
// almost entirely literal with exactly one escaped string, and ephesians-5
// has one string that mixes both conventions internally). So the style is
// read off the OLD span being replaced, not the file as a whole.
// ---------------------------------------------------------------------

const MANDATORY_ESCAPES = {
  0x22: '\\"',
  0x5c: "\\\\",
  0x08: "\\b",
  0x0c: "\\f",
  0x0a: "\\n",
  0x0d: "\\r",
  0x09: "\\t",
};

function hex4(code) {
  return `\\u${code.toString(16).padStart(4, "0")}`;
}

/**
 * Encode `value` as a JSON string literal (quotes included). Mandatory JSON
 * escapes (quote, backslash, control characters) are always applied,
 * regardless of style. When `unicodeEscapes` is true, every code unit above
 * U+007E is ALSO escaped as \uXXXX (this naturally produces a correct
 * surrogate-pair escape for any character outside the BMP, since we walk by
 * UTF-16 code unit).
 */
export function encodeJsonString(value, { unicodeEscapes = false } = {}) {
  let out = '"';
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    const mandatory = MANDATORY_ESCAPES[code];
    if (mandatory !== undefined) {
      out += mandatory;
      continue;
    }
    if (code < 0x20) {
      out += hex4(code);
      continue;
    }
    if (unicodeEscapes && code > 0x7e) {
      out += hex4(code);
      continue;
    }
    out += value[i];
  }
  out += '"';
  return out;
}

/** True if `oldRawSpan` (the exact source text of an existing string
 *  literal, quotes included) uses \uXXXX escapes for non-ASCII content. */
export function usesUnicodeEscapes(oldRawSpan) {
  return /\\u[0-9a-fA-F]{4}/.test(oldRawSpan);
}

/** Encode `value` to match `oldRawSpan`'s own escaping style. */
export function encodeLike(value, oldRawSpan) {
  return encodeJsonString(value, { unicodeEscapes: usesUnicodeEscapes(oldRawSpan) });
}

// ---------------------------------------------------------------------
// Path get/set over an already-parsed value (used only for the assertions -
// never as a substitute for locateStringSpan when producing the actual edit).
// ---------------------------------------------------------------------

function getAtPath(obj, path) {
  let cur = obj;
  for (const seg of path) {
    if (cur == null) return undefined;
    cur = cur[seg];
  }
  return cur;
}

function deepClone(value) {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function setAtPath(obj, path, value) {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]];
  cur[path[path.length - 1]] = value;
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== "object") return false; // primitives already handled by === above
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

// ---------------------------------------------------------------------
// BOM / trailing-newline fingerprint (assertion 7).
// ---------------------------------------------------------------------

function fileFingerprint(raw) {
  return {
    bom: raw.charCodeAt(0) === 0xfeff,
    trailingNewline: raw.endsWith("\n"),
    trailingCRLF: raw.endsWith("\r\n"),
  };
}

/**
 * Replace the string value at `path` in `raw` (a whole chapter JSON file's
 * raw text) from `oldValue` to `newValue`, running all seven Phase 3
 * assertions in order. Throws (never returns a partially-applied result) on
 * the first failure. Returns the new raw file text on success.
 *
 * Does NOT write anything to disk - callers (apply.mjs, not built in this
 * session) own file I/O and must re-locate spans after each splice when
 * applying multiple edits to the same file (a splice shifts every later
 * offset in that file).
 */
export function spliceValue(raw, path, oldValue, newValue) {
  // 1. parse succeeds
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`json-splice: assertion 1 (parse succeeds) failed: ${e.message}`);
  }

  // 2. get(path) === oldValue (stale-ledger guard)
  const current = getAtPath(parsed, path);
  if (current !== oldValue) {
    throw new Error(
      `json-splice: assertion 2 (get(path) === oldValue) failed at path ${JSON.stringify(path)} - ` +
        `expected ${JSON.stringify(oldValue)}, found ${JSON.stringify(current)}. The ledger is stale; re-derive it before applying.`,
    );
  }

  const span = locateStringSpan(raw, path);
  const oldRawSpan = raw.slice(span.start, span.end);

  // 3. span round-trips
  let decodedOld;
  try {
    decodedOld = JSON.parse(oldRawSpan);
  } catch (e) {
    throw new Error(`json-splice: assertion 3 (span round-trips) failed to parse the located span: ${e.message}`);
  }
  if (decodedOld !== oldValue) {
    throw new Error(
      `json-splice: assertion 3 (span round-trips) failed - located span decodes to ${JSON.stringify(decodedOld)}, expected ${JSON.stringify(oldValue)}. locateStringSpan likely found the wrong span for path ${JSON.stringify(path)}.`,
    );
  }

  const newRawSpan = encodeLike(newValue, oldRawSpan);
  const newRaw = raw.slice(0, span.start) + newRawSpan + raw.slice(span.end);

  // 4. result parses
  let newParsed;
  try {
    newParsed = JSON.parse(newRaw);
  } catch (e) {
    throw new Error(`json-splice: assertion 4 (result parses) failed: ${e.message}`);
  }

  // 5. deep-equal against the clone with only `path` changed
  const expected = deepClone(parsed);
  setAtPath(expected, path, newValue);
  if (!deepEqual(newParsed, expected)) {
    throw new Error(
      `json-splice: assertion 5 (deep-equal against clone with only path changed) failed for path ${JSON.stringify(path)} - the splice altered structure beyond the target field.`,
    );
  }

  // 6. bytes outside the span identical
  const prefixLen = span.start;
  const newSuffixStart = span.start + newRawSpan.length;
  if (raw.slice(0, prefixLen) !== newRaw.slice(0, prefixLen)) {
    throw new Error("json-splice: assertion 6 (bytes outside the span identical) failed - prefix changed.");
  }
  if (raw.slice(span.end) !== newRaw.slice(newSuffixStart)) {
    throw new Error("json-splice: assertion 6 (bytes outside the span identical) failed - suffix changed.");
  }

  // 7. BOM/newline state unchanged
  const beforeFp = fileFingerprint(raw);
  const afterFp = fileFingerprint(newRaw);
  if (beforeFp.bom !== afterFp.bom || beforeFp.trailingNewline !== afterFp.trailingNewline || beforeFp.trailingCRLF !== afterFp.trailingCRLF) {
    throw new Error(
      `json-splice: assertion 7 (BOM/newline state unchanged) failed - before ${JSON.stringify(beforeFp)}, after ${JSON.stringify(afterFp)}.`,
    );
  }

  return newRaw;
}

// ---------------------------------------------------------------------
// On byte vs. character offsets: this module locates spans and reports
// them as JS string (UTF-16 code unit) indices, not raw file bytes. That is
// intentional, not a shortcut. Every chapter JSON file is read with
// `fs.readFileSync(path, "utf8")`, decoded once; all scanning happens on
// that decoded string, and the result is written back as one string via
// `fs.writeFileSync(path, newRaw)`, which Node re-encodes to UTF-8 on the
// way out. Because that decode/re-encode round trip is lossless and
// deterministic for valid UTF-8 (which every chapter file is - the
// validator enforces it), "identical outside the span" at the STRING level
// is equivalent to "identical outside the span" at the BYTE level: nothing
// this module does ever re-encodes a character outside [start, end), so
// the bytes representing every untouched character come out exactly as
// they went in.
