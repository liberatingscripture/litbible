// src/lib/ebible-refs.mjs
//
// The apocrypha half of the reference linker's outward links (audit X14,
// owner 2026-09-28): "Sirach 14:20" in a note links to that verse in the World
// English Bible on eBible.org. The WEB is public domain and the site is a
// nonprofit with no ads. The owner chose it for all the apocrypha over
// Sefaria, whose English covers only parts of them (translated from the Hebrew
// fragments, and numbered differently in places). The WEB numbers these books
// as English Bibles do, so unlike the Hebrew Bible (sefaria-refs.mjs) there is
// no map. Sirach 30–36 is the one stretch where English Bibles themselves
// disagree (Greek manuscripts order it differently), so check a citation there
// against the page before trusting its link.
//
// Not in the WEB, and so left plain: 1 Enoch. The Greek additions to Esther
// and Daniel are in it, but a note cites them under the book's own name in the
// Greek numbering ("Daniel 3:35"), which the linker reads as the Hebrew Bible,
// where that verse doesn't exist, so they stay plain too.
//
// A range links its first verse: eBible's pages mark each verse with an
// anchor (#V20) but can't highlight a span.
//
// Pure: no fs, no network.

/**
 * key, eBible's book code, the names the text uses, and the verses per chapter
 * as eBible numbers them (read from its pages, 2026-09-28). `verseOnly` names
 * are ordinary words too, so they link only with a verse ("Wisdom 3:1", never
 * "wisdom 2").
 */
export const APOCRYPHA = [
  ["tobit", "TOB", ["Tobit", "Tob"], [22, 14, 17, 21, 22, 17, 18, 21, 6, 12, 19, 22, 18, 15]],
  ["judith", "JDT", ["Judith", "Jdt"], [16, 28, 10, 15, 24, 21, 32, 36, 14, 23, 23, 20, 20, 19, 13, 25]],
  ["wisdom", "WIS", ["Wisdom of Solomon", "Wisdom", "Wis"], [16, 24, 19, 20, 23, 25, 30, 21, 18, 21, 26, 27, 19, 31, 19, 29, 21, 25, 22], ["Wisdom"]],
  ["sirach", "SIR", ["Sirach", "Ecclesiasticus", "Ben Sira", "Sir"], [30, 18, 31, 31, 15, 37, 36, 19, 18, 31, 34, 18, 26, 27, 20, 30, 32, 33, 30, 32, 28, 27, 28, 34, 26, 29, 30, 26, 28, 25, 31, 24, 33, 26, 20, 26, 31, 34, 35, 30, 24, 25, 33, 23, 26, 20, 25, 25, 16, 29, 30], ["Sir"]],
  ["baruch", "BAR", ["Baruch", "Bar"], [22, 35, 37, 37, 9, 73], ["Bar"]],
  ["1maccabees", "1MA", ["1 Maccabees", "1 Macc"], [64, 70, 60, 61, 68, 63, 50, 32, 73, 89, 74, 53, 53, 49, 41, 24]],
  ["2maccabees", "2MA", ["2 Maccabees", "2 Macc"], [36, 32, 40, 50, 27, 31, 42, 36, 29, 38, 38, 45, 26, 46, 39]],
  ["3maccabees", "3MA", ["3 Maccabees", "3 Macc"], [29, 33, 30, 21, 51, 41, 23]],
  ["4maccabees", "4MA", ["4 Maccabees", "4 Macc"], [35, 24, 21, 26, 38, 35, 25, 28, 32, 21, 27, 20, 27, 20, 32, 25, 24, 24]],
  ["1esdras", "1ES", ["1 Esdras", "1 Esd"], [58, 30, 24, 63, 73, 34, 15, 96, 55]],
  ["2esdras", "2ES", ["2 Esdras", "2 Esd"], [40, 48, 36, 52, 56, 59, 140, 63, 47, 59, 46, 51, 58, 48, 63, 78]],
  ["manasseh", "MAN", ["Prayer of Manasseh", "Prayer of Manasses", "Pr Man"], [15]],
].map(([key, code, names, verses, verseOnly]) => ({ key, code, names, verses, verseOnly }));

/**
 * Verses the WEB leaves out, as modern English Bibles do (secondary Greek
 * additions); a chapter's count runs past them.
 */
const GAPS = {
  sirach: { 11: [16], 16: [16], 19: [19], 22: [10], 26: [20, 21, 22, 23, 24, 25, 26, 27] },
};

const BOOK = Object.fromEntries(APOCRYPHA.map((b) => [b.key, b]));

/** How many chapters the book has (0 if it isn't one of these). */
export function chapterCount(key) {
  return BOOK[key]?.verses.length ?? 0;
}

/** Whether this chapter (and verse, when given) is on eBible's page. */
export function isLinkable(key, chapter, verse = null) {
  const count = BOOK[key]?.verses[chapter - 1];
  if (!count) return false;
  if (verse == null) return true;
  return verse >= 1 && verse <= count && !GAPS[key]?.[chapter]?.includes(verse);
}

/**
 * The eBible address for a reference, or null when it can't be linked.
 * `start` and `end` are { chapter, verse }, verse null for a whole chapter;
 * `end` only has to exist, since the link opens at the start.
 */
export function ebibleHref(key, start, end = null) {
  if (!isLinkable(key, start.chapter, start.verse)) return null;
  if (end && !isLinkable(key, end.chapter, end.verse)) return null;
  const page = `https://ebible.org/eng-web/${BOOK[key].code}${String(start.chapter).padStart(2, "0")}.htm`;
  return start.verse == null ? page : `${page}#V${start.verse}`;
}
