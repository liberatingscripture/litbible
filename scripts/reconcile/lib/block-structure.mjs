// The block-tag structure of a chapter paragraph string.
//
// One list of block tags for the whole toolchain, because three consumers have
// to agree about it and disagreeing is how the defect this module exists for
// went unnoticed: a verse rebuilt from master text took its paragraph's `</p>`
// with it in 59 places, and nothing compared the before and after.
//
//   build-ledger.mjs   holds the closing run back so a restore can only ever
//                      rewrite a paragraph's CONTENT
//   apply.mjs          refuses a write that changes any paragraph's balance
//   repair-unclosed-paragraphs.mjs   repairs what already shipped
//
// INLINE tags are deliberately not here. An `</em>` or `</span>` at the end of
// a verse is part of what the verse says and a restore may legitimately
// replace it; a `</p>` is the paragraph's own structure and never belongs to
// the master, which carries no markup at all.

const BLOCK = "p|blockquote|div|ul|ol|li|h[1-6]";

const BLOCK_TAG_RE = new RegExp(`<(/?)(${BLOCK})\\b[^>]*>`, "gi");
const BLOCK_OPEN_RE = new RegExp(`<(?:${BLOCK})\\b`, "gi");
const BLOCK_CLOSE_RE = new RegExp(`</(?:${BLOCK})>`, "gi");
const TRAILING_BLOCK_CLOSE_RE = new RegExp(`(?:\\s*</(?:${BLOCK})>)+$`, "i");

/** Opens minus closes. Zero for a well-formed paragraph; positive for one that
 *  lost a closing tag. Compared BEFORE against AFTER rather than against zero,
 *  so a run reports the damage it introduces without failing on damage already
 *  on disk. */
export function blockDelta(html) {
  const s = String(html ?? "");
  return (s.match(BLOCK_OPEN_RE) || []).length - (s.match(BLOCK_CLOSE_RE) || []).length;
}

/**
 * Split a string into its content and the block-closing markup at the end.
 *
 * The last verse in a paragraph owns the string to its end, closing tags
 * included, so anything that rebuilds that span from master text drops them
 * unless they are held back.
 */
export function splitTrailingBlockClose(span) {
  const s = String(span ?? "");
  const m = TRAILING_BLOCK_CLOSE_RE.exec(s);
  return m ? { body: s.slice(0, m.index), close: m[0] } : { body: s, close: "" };
}

/** The trailing run of block-closing tags, or "" if there is none. */
export function trailingBlockClose(span) {
  return splitTrailingBlockClose(span).close;
}

/**
 * The closing tags this string is missing, in the order they must be appended,
 * or "" when it is already balanced.
 *
 * Returns null when the markup is MIS-NESTED rather than merely truncated,
 * which is a different defect and not one to repair by inference.
 */
export function missingClosers(html) {
  const stack = [];
  BLOCK_TAG_RE.lastIndex = 0;
  let m;
  while ((m = BLOCK_TAG_RE.exec(String(html ?? "")))) {
    const [, slash, name] = m;
    if (!slash) {
      stack.push(name);
      continue;
    }
    const top = stack.pop();
    if (top === undefined || top.toLowerCase() !== name.toLowerCase()) return null;
  }
  return stack
    .reverse()
    .map((n) => `</${n}>`)
    .join("");
}
