// src/lib/sefaria-refs.mjs
//
// The Hebrew Bible half of the reference linker's outward links (audit X14,
// owner 2026-09-28): "Deuteronomy 30:15" in a footnote links to that verse on
// Sefaria, the free Jewish library, in the 2023 JPS Tanakh: Gender-Sensitive
// Edition (see ENGLISH_VERSION). The New Testament links to this site's own pages
// (scripture-refs.mjs) and the apocrypha to eBible.org (ebible-refs.mjs); this
// module knows only the Hebrew Bible's books and numbering.
//
// THE NUMBERING IS THE WHOLE JOB. The footnotes cite verses the way English
// Bibles number them, and Sefaria numbers the Hebrew Bible the Hebrew
// (Masoretic) way. The two agree almost everywhere, but not in 63 psalms,
// whose headings are verse 1 in Hebrew (English "Psalm 22:1" is Hebrew 22:2),
// and not in 63 chapters elsewhere, mostly where a verse sits at the end of
// one chapter in English and the start of the next in Hebrew ("Joel 2:28" is
// Hebrew 3:1). A link without this map opens the verse next door, a heading,
// or nothing.
//
// The map was derived by comparing KJV verse counts with Sefaria's chapter
// lengths for all 39 books, then checked verse by verse (2026-09-28): each of
// the 23,144 English verses against Sefaria's JPS 1917 text at the mapped
// address and the verses around it. Counts alone can't be trusted, and the
// text check is how Psalm 13 was found, since it is the same length in both.
// Change the map only after the same check. test/sefaria-refs.test.js pins
// one case of each kind.
//
// Pure: no fs, no network.

/** Hebrew Bible books in canonical order: key, Sefaria's title, the names the text uses. */
export const HB_BOOKS = [
  ["genesis", "Genesis", ["Genesis", "Gen"]],
  ["exodus", "Exodus", ["Exodus", "Exod"]],
  ["leviticus", "Leviticus", ["Leviticus", "Lev"]],
  ["numbers", "Numbers", ["Numbers", "Num"]],
  ["deuteronomy", "Deuteronomy", ["Deuteronomy", "Deut"]],
  ["joshua", "Joshua", ["Joshua", "Josh"]],
  ["judges", "Judges", ["Judges", "Judg"]],
  ["ruth", "Ruth", ["Ruth"]],
  ["1samuel", "I Samuel", ["1 Samuel", "1 Sam"]],
  ["2samuel", "II Samuel", ["2 Samuel", "2 Sam"]],
  ["1kings", "I Kings", ["1 Kings", "1 Kgs"]],
  ["2kings", "II Kings", ["2 Kings", "2 Kgs"]],
  ["1chronicles", "I Chronicles", ["1 Chronicles", "1 Chr"]],
  ["2chronicles", "II Chronicles", ["2 Chronicles", "2 Chr"]],
  ["ezra", "Ezra", ["Ezra"]],
  ["nehemiah", "Nehemiah", ["Nehemiah", "Neh"]],
  ["esther", "Esther", ["Esther", "Esth"]],
  ["job", "Job", ["Job"]],
  ["psalms", "Psalms", ["Psalms", "Psalm", "Pss", "Ps"]],
  ["proverbs", "Proverbs", ["Proverbs", "Prov"]],
  ["ecclesiastes", "Ecclesiastes", ["Ecclesiastes", "Eccl", "Qoheleth"]],
  ["songofsongs", "Song of Songs", ["Song of Songs", "Song of Solomon"]],
  ["isaiah", "Isaiah", ["Isaiah", "Isa"]],
  ["jeremiah", "Jeremiah", ["Jeremiah", "Jer"]],
  ["lamentations", "Lamentations", ["Lamentations", "Lam"]],
  ["ezekiel", "Ezekiel", ["Ezekiel", "Ezek"]],
  ["daniel", "Daniel", ["Daniel", "Dan"]],
  ["hosea", "Hosea", ["Hosea", "Hos"]],
  ["joel", "Joel", ["Joel"]],
  ["amos", "Amos", ["Amos"]],
  ["obadiah", "Obadiah", ["Obadiah", "Obad"]],
  ["jonah", "Jonah", ["Jonah"]],
  ["micah", "Micah", ["Micah", "Mic"]],
  ["nahum", "Nahum", ["Nahum", "Nah"]],
  ["habakkuk", "Habakkuk", ["Habakkuk", "Hab"]],
  ["zephaniah", "Zephaniah", ["Zephaniah", "Zeph"]],
  ["haggai", "Haggai", ["Haggai", "Hag"]],
  ["zechariah", "Zechariah", ["Zechariah", "Zech"]],
  ["malachi", "Malachi", ["Malachi", "Mal"]],
].map(([key, sefaria, names]) => ({ key, sefaria, names }));

const SEFARIA_TITLE = Object.fromEntries(HB_BOOKS.map((b) => [b.key, b.sefaria]));

/**
 * Verses per chapter in English numbering (the KJV's, which modern English
 * Bibles share), so a chapter or verse English Bibles don't have is left
 * unlinked rather than guessed at. Generated from a public-domain KJV text.
 */
const ENGLISH_VERSES = {
  genesis: [31,25,24,26,32,22,24,22,29,32,32,20,18,24,21,16,27,33,38,18,34,24,20,67,34,35,46,22,35,43,55,32,20,31,29,43,36,30,23,23,57,38,34,34,28,34,31,22,33,26],
  exodus: [22,25,22,31,23,30,25,32,35,29,10,51,22,31,27,36,16,27,25,26,36,31,33,18,40,37,21,43,46,38,18,35,23,35,35,38,29,31,43,38],
  leviticus: [17,16,17,35,19,30,38,36,24,20,47,8,59,57,33,34,16,30,37,27,24,33,44,23,55,46,34],
  numbers: [54,34,51,49,31,27,89,26,23,36,35,16,33,45,41,50,13,32,22,29,35,41,30,25,18,65,23,31,40,16,54,42,56,29,34,13],
  deuteronomy: [46,37,29,49,33,25,26,20,29,22,32,32,18,29,23,22,20,22,21,20,23,30,25,22,19,19,26,68,29,20,30,52,29,12],
  joshua: [18,24,17,24,15,27,26,35,27,43,23,24,33,15,63,10,18,28,51,9,45,34,16,33],
  judges: [36,23,31,24,31,40,25,35,57,18,40,15,25,20,20,31,13,31,30,48,25],
  ruth: [22,23,18,22],
  "1samuel": [28,36,21,22,12,21,17,22,27,27,15,25,23,52,35,23,58,30,24,42,15,23,29,22,44,25,12,25,11,31,13],
  "2samuel": [27,32,39,12,25,23,29,18,13,19,27,31,39,33,37,23,29,33,43,26,22,51,39,25],
  "1kings": [53,46,28,34,18,38,51,66,28,29,43,33,34,31,34,34,24,46,21,43,29,53],
  "2kings": [18,25,27,44,27,33,20,29,37,36,21,21,25,29,38,20,41,37,37,21,26,20,37,20,30],
  "1chronicles": [54,55,24,43,26,81,40,40,44,14,47,40,14,17,29,43,27,17,19,8,30,19,32,31,31,32,34,21,30],
  "2chronicles": [17,18,17,22,14,42,22,18,31,19,23,16,22,15,19,14,19,34,11,37,20,12,21,27,28,23,9,27,36,27,21,33,25,33,27,23],
  ezra: [11,70,13,24,17,22,28,36,15,44],
  nehemiah: [11,20,32,23,19,19,73,18,38,39,36,47,31],
  esther: [22,23,15,17,14,14,10,17,32,3],
  job: [22,13,26,21,27,30,21,22,35,22,20,25,28,22,35,22,16,21,29,29,34,30,17,25,6,14,23,28,25,31,40,22,33,37,16,33,24,41,30,24,34,17],
  psalms: [6,12,8,8,12,10,17,9,20,18,7,8,6,7,5,11,15,50,14,9,13,31,6,10,22,12,14,9,11,12,24,11,22,22,28,12,40,22,13,17,13,11,5,26,17,11,9,14,20,23,19,9,6,7,23,13,11,11,17,12,8,12,11,10,13,20,7,35,36,5,24,20,28,23,10,12,20,72,13,19,16,8,18,12,13,17,7,18,52,17,16,15,5,23,11,13,12,9,9,5,8,28,22,35,45,48,43,13,31,7,10,10,9,8,18,19,2,29,176,7,8,9,4,8,5,6,5,6,8,8,3,18,3,3,21,26,9,8,24,13,10,7,12,15,21,10,20,14,9,6],
  proverbs: [33,22,35,27,23,35,27,36,18,32,31,28,25,35,33,33,28,24,29,30,31,29,35,34,28,28,27,28,27,33,31],
  ecclesiastes: [18,26,22,16,20,12,29,17,18,20,10,14],
  songofsongs: [17,17,11,16,16,13,13,14],
  isaiah: [31,22,26,6,30,13,25,22,21,34,16,6,22,32,9,14,14,7,25,6,17,25,18,23,12,21,13,29,24,33,9,20,24,17,10,22,38,22,8,31,29,25,28,28,25,13,15,22,26,11,23,15,12,17,13,12,21,14,21,22,11,12,19,12,25,24],
  jeremiah: [19,37,25,31,31,30,34,22,26,25,23,17,27,22,21,21,27,23,15,18,14,30,40,10,38,24,22,17,32,24,40,44,26,22,19,32,21,28,18,16,18,22,13,30,5,28,7,47,39,46,64,34],
  lamentations: [22,22,66,22,22],
  ezekiel: [28,10,27,17,17,14,27,18,11,22,25,28,23,23,8,63,24,32,14,49,32,31,49,27,17,21,36,26,21,26,18,32,33,31,15,38,28,23,29,49,26,20,27,31,25,24,23,35],
  daniel: [21,49,30,37,31,28,28,27,27,21,45,13],
  hosea: [11,23,5,19,15,11,16,14,17,15,12,14,16,9],
  joel: [20,32,21],
  amos: [15,16,15,13,27,14,17,14,15],
  obadiah: [21],
  jonah: [17,10,10,11],
  micah: [16,13,12,13,15,16,20],
  nahum: [15,13,19],
  habakkuk: [17,20,19],
  zephaniah: [18,15,20],
  haggai: [15,23],
  zechariah: [21,13,10,14,11,15,14,23,17,12,17,14,9,21],
  malachi: [14,17,18,6],
};

/**
 * Where English and Hebrew numbering part, outside the Psalms:
 * [English chapter, first verse, last verse, Hebrew chapter, Hebrew verse,
 *  kind, split end]. "shift" (the default) moves the run verse for verse;
 * "merge" maps every verse of the run to one Hebrew verse (the short
 * commandments of the Decalogue are one verse in Hebrew); "split" maps one
 * English verse to two Hebrew verses, the second given as [chapter, verse];
 * "none" is a verse the Hebrew text doesn't have (Nehemiah 7:68), linked as
 * its chapter.
 */
const RULES = {
  genesis: [[31, 55, 55, 32, 1], [32, 1, 32, 32, 2]],
  exodus: [
    [8, 1, 4, 7, 26], [8, 5, 32, 8, 1],
    [20, 13, 16, 20, 13, "merge"], [20, 17, 26, 20, 14],
    [22, 1, 1, 21, 37], [22, 2, 31, 22, 1],
  ],
  leviticus: [[6, 1, 7, 5, 20], [6, 8, 30, 6, 1]],
  numbers: [[16, 36, 50, 17, 1], [17, 1, 13, 17, 16], [29, 40, 40, 30, 1], [30, 1, 16, 30, 2]],
  deuteronomy: [
    [5, 17, 20, 5, 17, "merge"], [5, 21, 33, 5, 18],
    [12, 32, 32, 13, 1], [13, 1, 18, 13, 2],
    [22, 30, 30, 23, 1], [23, 1, 25, 23, 2],
    [29, 1, 1, 28, 69], [29, 2, 29, 29, 1],
  ],
  "1samuel": [[20, 42, 42, 20, 42, "split", [21, 1]], [21, 1, 15, 21, 2], [23, 29, 29, 24, 1], [24, 1, 22, 24, 2]],
  "2samuel": [[18, 33, 33, 19, 1], [19, 1, 43, 19, 2]],
  "1kings": [[4, 21, 34, 5, 1], [5, 1, 18, 5, 15], [22, 43, 43, 22, 43, "split", [22, 44]], [22, 44, 53, 22, 45]],
  "2kings": [[11, 21, 21, 12, 1], [12, 1, 21, 12, 2]],
  "1chronicles": [[6, 1, 15, 5, 27], [6, 16, 81, 6, 1], [12, 4, 4, 12, 4, "split", [12, 5]], [12, 5, 40, 12, 6]],
  "2chronicles": [[2, 1, 1, 1, 18], [2, 2, 18, 2, 1], [14, 1, 1, 13, 23], [14, 2, 15, 14, 1]],
  nehemiah: [
    [4, 1, 6, 3, 33], [4, 7, 23, 4, 1],
    [7, 68, 68, 7, 0, "none"], [7, 69, 73, 7, 68],
    [9, 38, 38, 10, 1], [10, 1, 39, 10, 2],
  ],
  job: [[41, 1, 8, 40, 25], [41, 9, 34, 41, 1]],
  ecclesiastes: [[5, 1, 1, 4, 17], [5, 2, 20, 5, 1]],
  songofsongs: [[6, 13, 13, 7, 1], [7, 1, 13, 7, 2]],
  isaiah: [[9, 1, 1, 8, 23], [9, 2, 21, 9, 1], [64, 1, 1, 63, 19], [64, 2, 12, 64, 1]],
  jeremiah: [[9, 1, 1, 8, 23], [9, 2, 26, 9, 1]],
  ezekiel: [[20, 45, 49, 21, 1], [21, 1, 32, 21, 6]],
  daniel: [[4, 1, 3, 3, 31], [4, 4, 37, 4, 1], [5, 31, 31, 6, 1], [6, 1, 28, 6, 2]],
  hosea: [[1, 10, 11, 2, 1], [2, 1, 23, 2, 3], [11, 12, 12, 12, 1], [12, 1, 14, 12, 2], [13, 16, 16, 14, 1], [14, 1, 9, 14, 2]],
  joel: [[2, 28, 32, 3, 1], [3, 1, 21, 4, 1]],
  jonah: [[1, 17, 17, 2, 1], [2, 1, 10, 2, 2]],
  micah: [[5, 1, 1, 4, 14], [5, 2, 15, 5, 1]],
  nahum: [[1, 15, 15, 2, 1], [2, 1, 13, 2, 2]],
  zechariah: [[1, 18, 21, 2, 1], [2, 1, 13, 2, 5]],
  malachi: [[4, 1, 6, 3, 19]],
  // Psalm 13 is as long in both, which is why comparing counts missed it: the
  // heading is Hebrew verse 1, and English 5–6 are one Hebrew verse.
  psalms: [[13, 1, 4, 13, 2], [13, 5, 6, 13, 6, "merge"]],
};

/**
 * Psalms whose Hebrew heading is numbered as a verse, by how many verses it
 * takes: every verse of the psalm is that many higher in Hebrew. Derived from
 * the two sets of chapter lengths, not typed from memory.
 */
const PSALM_HEADINGS = {
  1: [3, 4, 5, 6, 7, 8, 9, 12, 18, 19, 20, 21, 22, 30, 31, 34, 36, 38, 39, 40, 41, 42, 44, 45, 46, 47, 48, 49, 53, 55, 56, 57, 58, 59, 61, 62, 63, 64, 65, 67, 68, 69, 70, 75, 76, 77, 80, 81, 83, 84, 85, 88, 89, 92, 102, 108, 140, 142],
  2: [51, 52, 54, 60],
};
const PSALM_OFFSET = new Map();
for (const [offset, psalms] of Object.entries(PSALM_HEADINGS)) {
  for (const n of psalms) PSALM_OFFSET.set(n, Number(offset));
}

/** How many chapters English Bibles give the book (0 if it isn't one of ours). */
export function chapterCount(key) {
  return ENGLISH_VERSES[key]?.length ?? 0;
}

/** Whether this chapter (and verse, when given) exists in English Bibles. */
export function isLinkable(key, chapter, verse = null) {
  const counts = ENGLISH_VERSES[key];
  if (!counts || !(chapter >= 1 && chapter <= counts.length)) return false;
  return verse == null || (verse >= 1 && verse <= counts[chapter - 1]);
}

/**
 * One English verse in Sefaria's numbering: { chapter, verse }, plus `end`
 * when the English verse spans two Hebrew verses. `verse` is null for a verse
 * the Hebrew text doesn't have.
 */
export function toHebrew(key, chapter, verse) {
  for (const [ch, from, to, hebCh, hebVerse, kind = "shift", end] of RULES[key] ?? []) {
    if (ch !== chapter || verse < from || verse > to) continue;
    if (kind === "none") return { chapter: hebCh, verse: null };
    if (kind === "merge") return { chapter: hebCh, verse: hebVerse };
    if (kind === "split") return { chapter: hebCh, verse: hebVerse, end: { chapter: end[0], verse: end[1] } };
    return { chapter: hebCh, verse: hebVerse + (verse - from) };
  }
  if (key === "psalms") return { chapter, verse: verse + (PSALM_OFFSET.get(chapter) ?? 0) };
  return { chapter, verse };
}

const lastVerse = (key, chapter) => ENGLISH_VERSES[key]?.[chapter - 1] ?? 0;

/**
 * The Sefaria address for an English reference, or null when it can't be
 * linked (see isLinkable). `start` and `end` are { chapter, verse }, with
 * verse null for a whole chapter; `end` is optional.
 *
 * A whole chapter links as a chapter unless the numbering moves some of it to
 * another chapter, in which case it links the exact Hebrew range ("Joel 3" is
 * Joel 4:1–21; "Malachi 4" is Malachi 3:19–24).
 */
export function sefariaHref(key, start, end = null) {
  if (!SEFARIA_TITLE[key] || !isLinkable(key, start.chapter, start.verse)) return null;
  if (end && !isLinkable(key, end.chapter, end.verse)) return null;

  // Only a chapter the numbering moves needs its whole-chapter ends spelled out.
  const moves = (ch) => (RULES[key] ?? []).some((r) => r[0] === ch);

  let from;
  let to = null;
  if (start.verse == null) {
    const endCh = end?.chapter ?? start.chapter;
    if (!moves(start.chapter) && !moves(endCh)) {
      return url(key, endCh === start.chapter ? `${start.chapter}` : `${start.chapter}-${endCh}`);
    }
    from = toHebrew(key, start.chapter, 1);
    const tail = toHebrew(key, endCh, lastVerse(key, endCh));
    to = tail.end ?? tail;
  } else {
    from = toHebrew(key, start.chapter, start.verse);
    if (from.verse == null) return url(key, `${from.chapter}`);
    if (end) {
      const tail = toHebrew(key, end.chapter, end.verse ?? lastVerse(key, end.chapter));
      to = tail.end ?? tail;
    } else if (from.end) {
      to = from.end;
    }
    if (to && to.verse == null) to = null;
  }
  return url(key, rangeRef(from, to));
}

function rangeRef(from, to) {
  let ref = `${from.chapter}.${from.verse}`;
  if (to && !(to.chapter === from.chapter && to.verse === from.verse)) {
    ref += to.chapter === from.chapter ? `-${to.verse}` : `-${to.chapter}.${to.verse}`;
  }
  return ref;
}

// The English a reader meets, named in every link so a change to Sefaria's
// default can't change it (owner, 2026-09-29). It was already the default,
// and was kept over the 1985 JPS, the 1917 JPS and the Koren Jerusalem Bible
// as the one closest to the LIT's inclusive commitments; every Sefaria
// version follows the same Hebrew numbering, so the map above holds for it.
// Checked present in all 39 books. `ven` takes "english|<title>", spaces as _.
const ENGLISH_VERSION = "english%7CTHE_JPS_TANAKH:_Gender-Sensitive_Edition";

function url(key, ref) {
  return `https://www.sefaria.org/${SEFARIA_TITLE[key].replace(/ /g, "_")}.${ref}?lang=en&ven=${ENGLISH_VERSION}`;
}
