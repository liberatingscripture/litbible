// scripts/lib/api2-core.mjs
//
// The pure core of the content API, version 2 (API-2-FORMAT.md): one chapter
// served as its Study Desk anchor text (STUDY-DESK-FORMAT.md, "Anchor text")
// with every position the apps need laid over it — verses, blocks and their
// lines, emphasis runs, footnote letters, the ⟦ ⟧ spans. No fs of its own;
// scripts/build-api-v2.mjs is the shell.
//
// HOW IT STAYS EXACT. The anchor text is defined by a sequence of string
// rewrites (scripts/lib/verse-text.mjs, then normalizeAnchorText), and every
// one of them can move an offset: a tag vanishes, `&nbsp;` becomes one
// character, a bracket marker is stripped, whitespace collapses. Rather than
// re-derive the text some other way and hope it agrees, this file applies THE
// SAME rewrites, with the same regexes, in the same order, to a list of
// "cells": one per character, each remembering where it came from (its block,
// its poetry line, the <em>/<strong> elements open over it). Things the
// rewrites delete but the apps need to know about — a footnote letter, a
// bracket marker — leave a zero-width event cell behind. Every range is read
// off the finished cells, so it is in the final coordinates by construction.
//
// And because "by construction" is a claim, buildChapterV2 then compares its
// text and verse spans with chapterAnchorText (scripts/lib/anchor-text.mjs),
// the reference the apps' vectors come from, and throws on any difference.
// That assertion is the safety of the whole format; it is not a warning.
//
// If a rewrite is ever added to verse-text.mjs or normalizeAnchorText, add it
// here in the same place, or the assertion will (correctly) fail the build.

import { createHash } from "node:crypto";

import { chapterAnchorText } from "./anchor-text.mjs";
import { INVISIBLE } from "../../src/lib/anchor-core.mjs";
import { footnoteText } from "../../src/lib/desk-footnotes.mjs";

/** The `api` number of this format, and the only number an app checks. It
 *  also stands for the rules that make the words (`text`, the verse spans,
 *  each footnote's `text`): a change to those is a new api number and a new
 *  folder (/api/data/v3/), never a change under the same path, so within
 *  /api/data/v2/ they never change. The Study Desk's own rule number
 *  (ANCHOR_SPEC_VERSION) is not in a chapter file: it also moves when only the
 *  way a mark is found again changes, which alters no word here
 *  (BVJ, 2026-10-27). */
export const API_VERSION = 2;

/** The keys the shipping apps already handle in the version 1 manifest's
 *  `files` map. Nothing else may appear there: an installed Android build
 *  matches `chapters/<book>-<n>.json` ANYWHERE in a path and decodes it with
 *  every field defaulted, so a version 2 file listed there would replace the
 *  reader's chapter with an empty one. Version 2 lives under its own `v2` key. */
export const V1_FILE_PATTERNS = [
  /^chapters\/[a-z0-9]+-\d+\.json$/,
  /^intros\/[a-z0-9]+-intro\.md$/,
  /^images\/[A-Za-z0-9._-]+$/,
  /^glossary\.json$/,
  /^topics\.json$/,
  /^translation-commitments\.json$/,
  /^release-notes\.json$/,
];

/** Throws unless every key of a version 1 `files` map is one the shipping
 *  apps already handle, and none of them reaches into version 2. */
export function assertV1FilesMap(files) {
  for (const key of Object.keys(files ?? {})) {
    if (key.includes("v2/")) {
      throw new Error(`version 1 manifest lists a version 2 path: ${key}`);
    }
    if (!V1_FILE_PATTERNS.some((re) => re.test(key))) {
      throw new Error(`version 1 manifest lists a path the shipping apps don't know: ${key}`);
    }
  }
}

/**
 * The version 1 manifest with the `v2` key added, and nothing else changed.
 * Key order is kept (the key goes last), so the rest of the file serializes
 * byte for byte as before. A `v2` key from an earlier run is replaced.
 */
export function addV2ToManifest(manifest, v2) {
  assertV1FilesMap(manifest.files);
  const { v2: _earlier, ...v1 } = manifest;
  return { ...v1, v2 };
}

export function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

/* ── Cells ────────────────────────────────────────────────────────────────
 * A cell is { ch, ctx } for one UTF-16 code unit, or { ch: "", event } for
 * something deleted that the apps still need placed (a footnote letter, a
 * bracket marker). `ctx` is shared by every character written in the same
 * state, and is null for characters that belong to no block (the space
 * joining two paragraphs).
 */

const textOf = (cells) => cells.map((c) => c.ch).join("");

/**
 * Apply a regex rewrite to cells exactly as String.prototype.replace would
 * apply it to their text. `make(match, matchCells)` returns the cells that
 * replace a match; by default the replacement string, each new character
 * taking the context of the match's first character. Event cells lying
 * strictly inside a match are kept, at the match's start, so a footnote
 * letter between two spaces that collapse ends up before the one space left.
 */
function replaceCells(cells, regex, replacement, make) {
  const text = textOf(cells);
  const at = []; // string position -> cell index
  cells.forEach((c, i) => {
    if (c.ch) at.push(i);
  });
  const out = [];
  let ci = 0;
  // A non-global regex replaces its first match only, as replace() does.
  const global = regex.flags.includes("g");
  const re = new RegExp(regex.source, global ? regex.flags : regex.flags + "g");
  let m;
  while ((m = re.exec(text))) {
    if (m[0] === "") {
      re.lastIndex++;
      continue;
    }
    const first = at[m.index];
    const last = at[m.index + m[0].length - 1];
    while (ci < first) out.push(cells[ci++]);
    const inside = cells.slice(first, last + 1);
    out.push(...inside.filter((c) => !c.ch));
    const chars = inside.filter((c) => c.ch);
    if (make) out.push(...make(m, chars));
    else {
      const rep = typeof replacement === "function" ? replacement(m[0]) : replacement;
      for (const ch of rep) out.push({ ch, ctx: chars[0].ctx });
    }
    ci = last + 1;
    if (!global) break;
  }
  while (ci < cells.length) out.push(cells[ci++]);
  return out;
}

/** NFC, character by character where it can be: a base and its combining
 *  marks compose together and take the base's context. Throws if that ever
 *  disagrees with composing the whole string (it can't for this corpus,
 *  which is NFC already; the throw says so if that changes). */
function nfcCells(cells) {
  const text = textOf(cells);
  const want = text.normalize("NFC");
  if (want === text) return cells;
  const out = [];
  let cluster = [];
  const flush = () => {
    if (!cluster.length) return;
    const chars = cluster.filter((c) => c.ch);
    const composed = textOf(chars).normalize("NFC");
    out.push(...cluster.filter((c) => !c.ch));
    for (const ch of composed) {
      for (let k = 0; k < ch.length; k++) out.push({ ch: ch[k], ctx: chars[0].ctx });
    }
    cluster = [];
  };
  for (const c of cells) {
    if (c.ch && !/\p{M}/u.test(c.ch)) flush();
    cluster.push(c);
  }
  flush();
  if (textOf(out) !== want) throw new Error("NFC changed text across a cluster boundary; teach api2-core");
  return out;
}

const BRACKETS = /[⟦⟧]|\[\||\|\]/g;

/** stripBracketMarkers, keeping each ⟦ / ⟧ as an event. */
function stripBracketCells(cells) {
  return replaceCells(cells, BRACKETS, "", (m) => {
    if (m[0] === "⟦") return [{ ch: "", event: { kind: "open" } }];
    if (m[0] === "⟧") return [{ ch: "", event: { kind: "close" } }];
    return [];
  });
}

const collapse = (cells) => replaceCells(cells, /\s+/g, " ");
const trim = (cells) => replaceCells(replaceCells(cells, /^\s+/g, ""), /\s+$/g, "");

const FN_REF = /<sup\b[^>]*class=(['"])[^'"]*\bfn-ref\b[^'"]*\1[^>]*>[\s\S]*?<\/sup>/gi;

/** htmlToPlainText (scripts/lib/verse-text.mjs), step for step. */
function htmlToPlainCells(cells) {
  let c = replaceCells(cells, FN_REF, "", (m) => {
    const id = /href="#([^"]+)"/.exec(m[0])?.[1] ?? null;
    return [{ ch: "", event: { kind: "fn", id } }];
  });
  c = replaceCells(c, /<\/?(?:p|blockquote|br)\b[^>]*>/gi, " ");
  c = replaceCells(c, /<[^>]+>/g, "");
  c = replaceCells(c, /&nbsp;/g, " ");
  c = replaceCells(c, /&mdash;/g, "—");
  c = replaceCells(c, /&#39;/g, "'");
  c = replaceCells(c, /&amp;/g, "&");
  c = stripBracketCells(c);
  c = collapse(c);
  return trim(c);
}

/** normalizeAnchorText (src/lib/anchor-core.mjs), step for step. */
function normalizeCells(cells) {
  let c = nfcCells(cells);
  c = replaceCells(c, INVISIBLE, "");
  c = stripBracketCells(c);
  c = collapse(c);
  return trim(c);
}

/* ── Reading the HTML ─────────────────────────────────────────────────── */

const VOID = new Set(["br", "img", "hr", "wbr", "input", "meta", "link", "source"]);
const attr = (tag, name) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? null;

/**
 * One cell per character of `paragraphs.join(" ")` — the string the verse
 * split reads — with each character's provenance. Paragraphs that are not
 * blocks (a draft's <figure>) are returned separately and read as nothing.
 */
function readParagraphs(paragraphs, slug) {
  const cells = [];
  const blocks = [];
  const figures = [];
  let uid = 0;
  paragraphs.forEach((html, pi) => {
    if (pi > 0) cells.push({ ch: " ", ctx: null });
    const top = /^<([a-z0-9]+)\b[^>]*>/i.exec(html);
    const topName = top?.[1].toLowerCase();
    const blockId = top ? attr(top[0], "id") : null;
    const isBlock = (topName === "p" || topName === "blockquote") && blockId;
    if (isBlock) {
      const cls = attr(top[0], "class") ?? "";
      blocks.push({ id: blockId, kind: topName === "blockquote" ? (/\bhbq\b/.test(cls) ? "hbq" : "quote") : "p" });
    } else if (topName === "figure") {
      figures.push({ after: blocks.at(-1)?.id ?? null, html });
    }
    const hasBr = /<br\b/i.test(html);

    const stack = []; // { name, uid, kind, cls, seg }
    let ctx = null;
    const snapshot = () => {
      if (!isBlock) return (ctx = { block: null, line: null, runs: [] });
      const runs = stack.filter((e) => e.name === "em" || e.name === "strong").map((e) => ({ uid: e.uid, kind: e.name }));
      // The innermost element that is a line: a poetry line, or a paragraph
      // set as lines with <br>. Each <br> starts the next segment of it.
      const lineEl = [...stack].reverse().find((e) => e.line);
      return (ctx = {
        block: blockId,
        line: lineEl ? `${lineEl.uid}:${lineEl.seg}` : null,
        runs,
      });
    };
    snapshot();
    for (const tok of html.matchAll(/<[^>]*>|[^<]+/g)) {
      const t = tok[0];
      if (t[0] !== "<") {
        for (let k = 0; k < t.length; k++) cells.push({ ch: t[k], ctx });
        continue;
      }
      const tm = /^<(\/?)([a-zA-Z0-9]+)/.exec(t);
      for (let k = 0; k < t.length; k++) cells.push({ ch: t[k], ctx });
      if (!tm) continue;
      const closing = tm[1] === "/";
      const name = tm[2].toLowerCase();
      if (closing) {
        const at = stack.map((e) => e.name).lastIndexOf(name);
        if (at !== -1) stack.length = at;
      } else if (name === "br") {
        const lineEl = [...stack].reverse().find((e) => e.line);
        if (lineEl) lineEl.seg++;
      } else if (!VOID.has(name) && !t.endsWith("/>")) {
        const cls = attr(t, "class") ?? "";
        const isTopP = stack.length === 0 && name === "p";
        const line = (name === "p" && /\bhbq-line\b/.test(cls)) || (isTopP && hasBr);
        stack.push({ name, uid: ++uid, line, seg: 0 });
      }
      snapshot();
    }
    if (stack.length && isBlock) throw new Error(`${slug}: unclosed <${stack.at(-1).name}> in paragraph ${pi + 1}`);
  });
  return { cells, blocks, figures };
}

/** splitChapterVerses (scripts/lib/verse-text.mjs), on cells. */
function splitVerseCells(cells) {
  const text = textOf(cells);
  const at = [];
  cells.forEach((c, i) => {
    if (c.ch) at.push(i);
  });
  const re = /<sup\b[^>]*\bid="v(\d+)"[^>]*>/g;
  const cuts = [];
  for (const m of text.matchAll(re)) {
    cuts.push({ verse: Number(m[1]), from: at[m.index], to: at[m.index + m[0].length - 1] + 1 });
  }
  const byVerse = new Map();
  // Ahead of the first verse marker: the reference drops this text, but a
  // footnote letter can stand there (Colossians 4 opens on one), and the
  // format files such a letter under the first verse.
  const lead = cuts.length ? htmlToPlainCells(cells.slice(0, cuts[0].from)).filter((c) => !c.ch) : [];
  cuts.forEach((cut, i) => {
    const end = i + 1 < cuts.length ? cuts[i + 1].from : cells.length;
    let chunk = cells.slice(cut.to, end);
    chunk = replaceCells(chunk, /^\d+<\/sup>/, "");
    let plain = htmlToPlainCells(chunk);
    if (i === 0) plain = [...lead, ...plain];
    if (!plain.some((c) => c.ch)) {
      if (plain.length) throw new Error(`verse ${cut.verse} has no words but carries a footnote letter or bracket`);
      return;
    }
    byVerse.set(cut.verse, byVerse.has(cut.verse) ? [...byVerse.get(cut.verse), { ch: " ", ctx: null }, ...plain] : plain);
  });
  return byVerse;
}

/* ── A chapter ────────────────────────────────────────────────────────── */

const isSpace = (ch) => /\s/.test(ch);

/** [start, end) over the non-space characters for which `pick(ctx)` holds,
 *  grouped by the key it returns, in order of first appearance. */
function rangesBy(chars, key) {
  const ranges = new Map();
  chars.forEach((c, i) => {
    if (!c.ctx || isSpace(c.ch)) return;
    for (const k of [].concat(key(c.ctx) ?? [])) {
      const r = ranges.get(k);
      if (r) r.end = i + 1;
      else ranges.set(k, { start: i, end: i + 1 });
    }
  });
  return ranges;
}

/**
 * A chapter JSON as a version 2 chapter. Throws if the text or any verse span
 * differs from the reference anchor text, or if the chapter's shape is one
 * the format doesn't describe.
 */
export function buildChapterV2(data) {
  const slug = `${data.bookKey}-${data.chapter}`;
  const paragraphs = data.paragraphs ?? [];
  const indexed = data.indexed !== false;
  const { cells, blocks: blockList, figures } = readParagraphs(paragraphs, slug);

  if (indexed && figures.length) throw new Error(`${slug}: a <figure> in an indexed chapter`);
  if (indexed && blockList.length !== paragraphs.length) {
    throw new Error(`${slug}: a paragraph that is neither <p id> nor <blockquote id>`);
  }

  const byVerse = new Map();
  for (const [n, verseCells] of splitVerseCells(cells)) {
    const norm = normalizeCells(verseCells);
    if (norm.some((c) => c.ch)) byVerse.set(n, norm);
  }

  // assembleChapter: verses in number order, joined by one space.
  const all = [];
  const verses = [];
  for (const [n, vc] of [...byVerse].sort((a, b) => a[0] - b[0])) {
    if (all.length) all.push({ ch: " ", ctx: null });
    const start = all.filter((c) => c.ch).length;
    all.push(...vc);
    verses.push({ v: n, start, end: start + vc.filter((c) => c.ch).length });
  }

  const chars = [];
  const events = [];
  for (const c of all) {
    if (c.ch) chars.push(c);
    else events.push({ ...c.event, pos: chars.length });
  }
  const text = textOf(chars);

  // The fidelity assertion. Draft chapters are held to it too: their text is
  // whatever the reference makes of them, "" for a placeholder page and the
  // translation so far for a draft that holds one (a book imported ahead of
  // its publication). `indexed` tells an app which is which; the text is
  // never blanked here.
  const ref = chapterAnchorText(paragraphs);
  if (text !== ref.text) {
    let i = 0;
    while (i < text.length && text[i] === ref.text[i]) i++;
    throw new Error(
      `${slug}: version 2 text differs from the anchor text at ${i}: ` +
        `${JSON.stringify(text.slice(i, i + 40))} vs ${JSON.stringify(ref.text.slice(i, i + 40))}`,
    );
  }
  const refSpans = [...ref.spans].map(([v, [s, e]]) => `${v}:${s}-${e}`).join(",");
  const ourSpans = verses.map(({ v, start, end }) => `${v}:${start}-${end}`).join(",");
  if (refSpans !== ourSpans) throw new Error(`${slug}: version 2 verse spans differ from the anchor text`);
  // A placeholder figure beside verse text would put its caption's words into
  // the last verse (the anchor rule has no clause for a caption).
  if (figures.length && text) throw new Error(`${slug}: a <figure> in a chapter with verse text`);

  // Blocks and their lines.
  const blockRanges = rangesBy(chars, (ctx) => ctx.block);
  const lineRanges = rangesBy(chars, (ctx) => (ctx.line ? `${ctx.block}|${ctx.line}` : null));
  const blocks = [];
  for (const b of blockList) {
    const r = blockRanges.get(b.id);
    if (!r) {
      if (text) throw new Error(`${slug}: block ${b.id} has no words in the anchor text`);
      continue;
    }
    const prev = blocks.at(-1);
    if (prev && prev.end > r.start) throw new Error(`${slug}: blocks ${prev.id} and ${b.id} overlap`);
    const block = { id: b.id, kind: b.kind, start: r.start, end: r.end };
    const lines = [...lineRanges].filter(([k]) => k.startsWith(`${b.id}|`)).map(([, lr]) => ({ start: lr.start, end: lr.end }));
    if (lines.length) block.lines = lines;
    blocks.push(block);
  }
  // Every non-space character belongs to exactly one block.
  chars.forEach((c, i) => {
    if (!isSpace(c.ch) && !c.ctx?.block) throw new Error(`${slug}: character ${i} belongs to no block`);
  });

  // Emphasis runs, one per element, outermost first where two start together.
  const runKinds = new Map();
  const runRanges = rangesBy(chars, (ctx) =>
    ctx.runs.map((r) => {
      runKinds.set(r.uid, r.kind);
      return r.uid;
    }),
  );
  const runs = [...runRanges]
    .map(([uid, r]) => ({ kind: runKinds.get(uid), start: r.start, end: r.end }))
    .sort((a, b) => a.start - b.start || b.end - a.end);

  // Footnote letters: `at` is where the letter stood, before text[at].
  const letterAt = new Map();
  for (const e of events) {
    if (e.kind !== "fn") continue;
    if (letterAt.has(e.id)) throw new Error(`${slug}: footnote ${e.id} anchored twice`);
    letterAt.set(e.id, e.pos);
  }
  const footnotes = (data.footnotes ?? []).map((f) => ({
    id: f.id,
    refId: f.refId,
    label: f.label,
    at: letterAt.get(f.id) ?? null,
    html: f.html,
    text: footnoteText(f.html),
  }));
  for (const id of letterAt.keys()) {
    if (!footnotes.some((f) => f.id === id)) throw new Error(`${slug}: a letter for ${id}, which has no footnote`);
  }

  // ⟦ ⟧ spans. A mark starts at the first word after its ⟦ (so a ⟦ ahead of a
  // verse number starts at that verse) and ends after the last word before
  // its ⟧. A span this chapter only opens or only closes (John 7:53–8:11
  // crosses a chapter boundary) runs to the chapter's edge, and says so.
  const nextWord = (pos) => {
    let p = pos;
    while (p < text.length && isSpace(text[p])) p++;
    return p;
  };
  const prevWord = (pos) => {
    let p = pos;
    while (p > 0 && isSpace(text[p - 1])) p--;
    return p;
  };
  const marks = [];
  let open = null;
  for (const e of events) {
    if (e.kind === "open") {
      if (open) throw new Error(`${slug}: ⟦ inside an open ⟦`);
      open = { kind: "disputed", start: nextWord(e.pos), end: null, opens: true, closes: false };
    } else if (e.kind === "close") {
      const m = open ?? { kind: "disputed", start: 0, end: null, opens: false, closes: false };
      m.end = prevWord(e.pos);
      m.closes = true;
      marks.push(m);
      open = null;
    }
  }
  if (open) {
    open.end = text.length;
    marks.push(open);
  }

  return {
    api: API_VERSION,
    bookKey: data.bookKey,
    chapter: data.chapter,
    indexed,
    title: data.title,
    description: data.description,
    topics: data.topics ?? [],
    hash: sha256(Buffer.from(text, "utf8")),
    text,
    verses,
    blocks,
    runs,
    footnotes,
    marks,
    figures,
  };
}

/* ── The words, and the check that they don't change under one api ─────── */

/**
 * A fingerprint of what a chapter's marks are placed against: its text, its
 * verse spans and each footnote's text, in order. Ranges, letters' places and
 * metadata are left out, so a fix to those is not a change to the words.
 */
export function wordsHash(chapter) {
  return sha256(
    JSON.stringify({
      text: chapter.text,
      verses: chapter.verses.map((v) => [v.v, v.start, v.end]),
      footnotes: chapter.footnotes.map((f) => f.text),
    }),
  );
}

/**
 * Where regenerating the vectors would change the words under the same api,
 * which the spec forbids (a change to the rules that make the words is a new
 * api and folder). `previous` is the committed vectors; `hashes` the fresh
 * `{ slug: { source, words } }`; `rebuild` builds a chapter from a vector's
 * copied input. A chapter whose version 1 file changed since the vectors were
 * written can't be judged (its words may have changed for a good reason), so
 * it is skipped; the copied sample and synthetic inputs always can be.
 *
 * @returns {string[]} one line per chapter or case whose words moved
 */
export function wordsChanges(previous, hashes, rebuild) {
  if (!previous || previous.api !== API_VERSION) return [];
  const out = [];
  for (const [slug, old] of Object.entries(previous.hashes ?? {})) {
    const now = hashes[slug];
    if (!old.words || !now || now.source !== old.source) continue;
    if (now.words !== old.words) out.push(`${slug}: the same version 1 file now gives different words`);
  }
  for (const v of [...(previous.chapters ?? []), ...(previous.synthetic ?? [])]) {
    if (wordsHash(rebuild(v.input)) !== wordsHash(v.expected)) {
      out.push(`${v.slug ?? v.why}: its copied input now gives different words`);
    }
  }
  return out;
}
