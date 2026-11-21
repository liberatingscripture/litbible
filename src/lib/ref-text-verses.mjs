// src/lib/ref-text-verses.mjs
//
// Which verses a hand-written scripture link names IN ITS WORDS, for the
// reference preview (src/scripts/ref-preview.js).
//
// The render-time linker writes `href="/romans-13/#v6-10"`, and the preview
// reads its verses from that anchor. But about fifty links in the articles are
// written by hand as `<a href="/romans-13">Romans 13:6-10 LIT</a>`: the
// target is the chapter, on purpose (the linker never rewrites a hand-written
// link, "scripture-refs.mjs" rule 5), and the verses are only in the words.
// With nothing to read, the preview fell back to the chapter's first three
// verses. This module reads the words instead.
//
// Pure and import-free so `node --test` and the browser bundle both reach it.
// It never guesses: a link whose words name another chapter than its href
// (`<a href="/mark-14">Mark 7:21-22</a>`), or no verse at all ("Romans 13"),
// gets null, and the preview behaves as it always did.

// A hyphen, the Unicode dashes (en and em among them) and the minus sign: the
// articles use both a typed hyphen and an en dash between verse numbers.
const DASH = "[\\-\\u2010-\\u2015\\u2212]";

// The first "chapter:verse" in the words, not the tail of a longer number.
const FIRST = /(?<![\d:])(\d{1,3}):(\d{1,3})/;

// One span: "6", "6-10", "15b-24", or a range running into the next chapter
// ("38-13:2"), whose end carries its own "chapter:".
const SPAN = new RegExp(
  `\\s*(\\d{1,3})[a-z]?(?:\\s*${DASH}\\s*(?:(\\d{1,3}):)?(\\d{1,3})[a-z]?)?`,
  "y"
);

// A comma before another span of THIS chapter. A number followed by a colon
// ("8:28, 9:1") is a different chapter's reference, so the list stops there.
const NEXT = /\s*,\s*(?=\d{1,3}[a-z]?(?![\d:]))/y;

/**
 * The verses a link's words name in `chapter`, or null.
 *
 * @param {string} text     the link's text ("Galatians 3:11, 14-17 LIT")
 * @param {number} chapter  the chapter its href points at
 * @returns {{ spans: [number, number][], cited: string } | null}
 *   `spans` are inclusive [first, last] pairs in the order written; a range
 *   that runs into the next chapter ends at Infinity, which the caller clamps
 *   to the chapter's last verse. `cited` is the verse part as written, with
 *   typed hyphens set as en dashes ("11, 14–17"), for the preview's heading.
 */
export function versesFromLinkText(text, chapter) {
  const words = typeof text === "string" ? text : "";
  const first = FIRST.exec(words);
  if (!first || Number(first[1]) !== chapter) return null;

  const begin = first.index + first[1].length + 1; // past the colon
  const spans = [];
  let at = begin;
  for (;;) {
    SPAN.lastIndex = at;
    const m = SPAN.exec(words);
    if (!m) break;
    const from = Number(m[1]);
    let to = m[3] ? Number(m[3]) : from;
    if (m[2] && Number(m[2]) !== chapter) to = Infinity; // into the next chapter
    if (to < from) return null; // "10-6": not a passage, so not guessed at
    spans.push([from, to]);
    at = SPAN.lastIndex;
    NEXT.lastIndex = at;
    if (!NEXT.test(words)) break;
    at = NEXT.lastIndex;
  }
  if (!spans.length) return null;

  const cited = words
    .slice(begin, at)
    .trim()
    .replace(new RegExp(`\\s*${DASH}\\s*`, "g"), "–")
    .replace(/\s*,\s*/g, ", ");
  return { spans, cited };
}

/**
 * The verse numbers a preview lists for those spans, in the order written,
 * with repeats and verses past the chapter's end dropped, and whether more
 * were asked for than fit.
 *
 * @param {[number, number][]} spans
 * @param {number} count  how many verses the chapter has
 * @param {number} max    how many a preview shows
 * @returns {{ numbers: number[], more: boolean }}
 */
export function previewNumbers(spans, count, max) {
  const all = [];
  const seen = new Set();
  for (const [from, to] of spans) {
    for (let v = from; v <= Math.min(to, count); v++) {
      if (!seen.has(v)) {
        seen.add(v);
        all.push(v);
      }
    }
  }
  return { numbers: all.slice(0, max), more: all.length > max };
}
