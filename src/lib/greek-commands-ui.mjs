// src/lib/greek-commands-ui.mjs
//
// The pure pieces behind the Greek search commands' screens (STUDY-DESK.md,
// "Order of work", 2a): putting a command into the search field where the
// cursor is, building a word from the commands window's pickers, the query a
// word's parsing starts, and a result verse read off a chapter's Greek with
// every matched word marked. The rules for what a query means are
// greek-query.mjs's; the screens (the commands window, /search, the tray and
// the Notebook's Greek tab) draw with these.

import { FILTERS, codeFits, filterFor } from "./greek-query.mjs";
import { describeParse } from "./greek-parse.mjs";
import { SIGNS, W } from "./desk-greek.mjs";

/* ── Putting a command in the field ──────────────────────────────── */

// A command that joins the text before it (".gen", "/", "=", a quote).
const JOINS = /^[./=“”"]/;

/**
 * `text` put into `value` at the cursor (or over the selection start..end),
 * with the spacing a query wants. Returns { value, caret }.
 *   ", "         trims the space before it, and leaves one after
 *   . / = quote  join the text before them, with nothing added after
 *   "*"          a space before when it follows a word, nothing after, so
 *                ".gen" can follow it
 *   the rest     a space before when it follows a word, and one after (unless
 *                a space already follows)
 */
export function insertAtCursor(value, start, end, text) {
  const v = String(value ?? "");
  const s = Math.max(0, Math.min(start ?? v.length, v.length));
  const e = Math.max(s, Math.min(end ?? s, v.length));
  const before = v.slice(0, s);
  const after = v.slice(e);
  if (text === ", ") {
    const trimmed = before.replace(/\s+$/, "");
    return { value: `${trimmed}, ${after.replace(/^\s+/, "")}`, caret: trimmed.length + 2 };
  }
  const joins = JOINS.test(text);
  const pad = !joins && before && !/\s$/.test(before) ? " " : "";
  const tail = joins || text === "*" || /^\s/.test(after) ? "" : " ";
  const added = pad + text + tail;
  return { value: before + added + after, caret: (before + added).length };
}

/**
 * The smallest stretch of `before` to replace to make `after`: the field's
 * commands put text in as typing would (BA147), so undo takes back only what
 * changed. Characters common to both ends are left alone.
 *
 * @returns {{ start: number, end: number, text: string }} replace
 *   before[start, end) with `text`
 */
export function editSpan(before, after) {
  const a = String(before ?? "");
  const b = String(after ?? "");
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let tail = 0;
  while (tail < a.length - start && tail < b.length - start && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  return { start, end: a.length - tail, text: b.slice(start, b.length - tail) };
}

/** The filter words in the order a query reads best: part of speech, tense, voice, mood, case, person, number, gender, degree. */
const QUERY_AXES = ["pos", "tense", "voice", "mood", "case", "person", "number", "gender", "degree"];

export function sortFilterWords(words) {
  const rank = (w) => {
    const f = filterFor(w);
    return f ? QUERY_AXES.indexOf(f.axis) : QUERY_AXES.length;
  };
  return [...words].sort((a, b) => rank(a) - rank(b));
}

/**
 * What "Build a word" adds: the word and its filters joined with dots
 * (πίστις.gen), or "*" and its filters when there is no word (*.aor.impv).
 * An empty string when there is neither a word nor a filter.
 */
export function builderQuery(word, filterWords = []) {
  const w = String(word ?? "").trim();
  const words = sortFilterWords(filterWords.filter(Boolean));
  if (!w && !words.length) return "";
  return [w || "*", ...words].join(".");
}

/**
 * The query a word's parsing starts: "*." and every filter word of its part
 * of speech and parsing ("*.aor.act.impv.2nd.pl"). A verb's part of speech is
 * left out, since its tense and mood already say it. Null for a word with no
 * parsing to search by. `pos` is MorphGNT's two characters ("V-"), `parse`
 * the eight that follow.
 */
export function parsingQuery(pos, parse) {
  const code = String(pos ?? "").padEnd(2, "-") + String(parse ?? "").padEnd(8, "-");
  const words = [];
  for (const axis of QUERY_AXES) {
    if (axis === "pos" && code.startsWith("V-")) continue;
    for (const f of FILTERS) {
      if (f.axis === axis && codeFits([f], code)) words.push(f.words[0]);
    }
  }
  return words.length ? `*.${words.join(".")}` : null;
}

/**
 * `value` with the word `from` swapped for `to`, for "Did you mean…?": the
 * first place `from` stands as a whole word. Unchanged if it is not there.
 */
export function replaceWord(value, from, to) {
  const v = String(value ?? "");
  const f = String(from ?? "");
  if (!f) return v;
  const esc = f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, "iu");
  return v.replace(re, () => to);
}

/* ── A verse read off a chapter's Greek ──────────────────────────── */

const SIGN_RE = new RegExp(`[${SIGNS}]`, "g");
const bare = (s) => String(s ?? "").replace(SIGN_RE, "");
/** A word's letters alone: the text-critical signs and edge punctuation off. */
const letters = (s) => bare(s).replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");

/**
 * One verse of a chapter's Greek (public/greek/text/<book>-<chapter>.json) as
 * escaped HTML with the words numbered in `marked` (a list of `t`) wrapped in
 * <mark>, and those words as [{ t, form, pos, parse, said }] in reading
 * order: `form` is the word's letters, `said` its parsing in words. Empty
 * when the chapter has no such verse.
 */
export function verseGreek(data, verse, marked, escape) {
  const mark = new Set(marked ?? []);
  let html = "";
  const words = [];
  for (const para of data?.paragraphs ?? []) {
    for (const w of para) {
      if (w[W.verse] !== verse) continue;
      const mine = mark.has(w[W.t]);
      const text = escape(bare(w[W.text]));
      html += escape(bare(w[W.pre])) + (mine ? `<mark>${text}</mark>` : text) + escape(bare(w[W.post]));
      if (mine) {
        words.push({
          t: w[W.t],
          form: letters(w[W.text]),
          pos: w[W.pos],
          parse: w[W.parse],
          said: describeParse(w[W.pos], w[W.parse]) || "",
        });
      }
    }
  }
  words.sort((a, b) => a.t - b.t);
  return { html: html.replace(/\s+/g, " ").trim(), words };
}

/** The forms of a hit's marked words, joined for a one-line row: "πίστεως … Χριστοῦ". */
export function formsLine(words) {
  return words.map((w) => w.form).filter(Boolean).join(" … ");
}
