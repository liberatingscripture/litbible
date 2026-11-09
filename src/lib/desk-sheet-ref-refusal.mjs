// src/lib/desk-sheet-ref-refusal.mjs
//
// Why the Sheets pane's passage form refused what was typed (SH6-4). The form
// reads a reference with `parseReference`, which answers only for a New
// Testament book, one chapter, and verses within it; anything else came back
// as the same "isn't a reference" sentence, so a leader typing "Isaiah 61:1-2"
// or "Matthew 5-7" took it for a typo. This names the two cases a reader can
// act on and leaves every other input to the form's own sentence. It changes
// nothing about `parseReference`.
//
// Pure: the parser and the book-name function are handed in, so this file
// imports no client code. The Hebrew Bible and apocrypha lists are the footnote
// linker's own (sefaria-refs.mjs, ebible-refs.mjs).

import { HB_BOOKS } from "./sefaria-refs.mjs";
import { APOCRYPHA } from "./ebible-refs.mjs";
import { BOOKS } from "../data/books.js";

const slug = (s) => String(s ?? "").toLowerCase().replace(/[^0-9a-z]/g, "");

/** Every spelling of a book outside the New Testament, to the name to show ("Ps" → "Psalms"). */
const NOT_NT = new Map();
for (const { key, sefaria, names } of HB_BOOKS) for (const n of [key, sefaria, ...names]) NOT_NT.set(slug(n), names[0]);
for (const { key, names } of APOCRYPHA) for (const n of [key, ...names]) NOT_NT.set(slug(n), names[0]);

/** A chapter, chapter:verse, or verse range on the end of what was typed (dashes already "-"). */
const TAIL = /\s*\d+(?:\s*:\s*\d+(?:\s*-\s*\d+(?:\s*:\s*\d+)?)?|\s*-\s*\d+)?\s*[.,;]?\s*$/;

/**
 * @param {string} text what was typed, with en and em dashes already turned to "-"
 * @param {{ parse: (s: string) => (object | null), label: (bookKey: string) => string }} tools
 * @returns {string | null} a sentence, or null to keep the form's own
 */
export function describeRefusal(text, { parse, label }) {
  const typed = String(text ?? "").trim();
  const tail = typed.match(TAIL);
  if (!tail) return null;
  const book = typed.slice(0, tail.index).trim().replace(/[.,;]+$/, "");
  if (!book) return null;

  const name = NOT_NT.get(slug(book));
  if (name) {
    return `The LIT is a translation of the New Testament, so ${name} isn’t in it. Try a New Testament book, such as Romans 5:6–10.`;
  }

  // A range across chapters: "Matthew 5-7", "John 3:16-4:2".
  const spans = /^\s*(\d+)\s*-\s*(\d+)\s*$/.test(tail[0]) || /:\s*\d+\s*-\s*\d+\s*:\s*\d+\s*$/.test(tail[0]);
  if (spans) {
    const first = parse(`${book} ${tail[0].match(/\d+/)[0]}`);
    if (first) {
      const name = label(first.bookKey);
      // "Jude 3-5" is the ordinary way to cite a one-chapter book: the numbers are verses (GF8c-2).
      if (BOOKS[first.bookKey] === 1) {
        return `${name} has one chapter, so give its verses as ${name} 1:3–5.`;
      }
      return `A passage is one chapter at a time. Add ${name} ${first.chapter} and then the next chapter, or give verses within one chapter, such as ${name} ${first.chapter}:3–12.`;
    }
  }
  return null;
}
