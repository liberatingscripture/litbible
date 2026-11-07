// src/lib/desk-slides.mjs
//
// A sheet as slides (STUDY-DESK-FIXES.md, E37 phase B; BVJ, 2026-11-06, "Build
// the slides files as you recommended"), for "Save as ▾"'s Slides group. The
// rules only, pure so they can be tested without a page: what the slides are,
// in what order, and how they look. sheet-slides.js reads present mode's own
// screens into the input here, so a file shows what present mode shows; the
// writers (desk-slides-pptx.mjs, desk-slides-odp.mjs) and the PDF's print view
// each draw the deck this returns.
//
// BVJ's four decisions, as Claude proposed them:
//   1. A passage with blanks is two slides, covered and then filled in, rather
//      than animations, which PowerPoint, Impress and Google Slides each play
//      differently. Clicking forward is the reveal.
//   2. The Leader only parts and each question's answer go in the speaker
//      notes, as present mode sends them to the presenter view. Slides saved
//      while the participant version is on screen have no speaker notes at
//      all (SEC3-3; BVJ, 2026-11-07, decision 6): no answers, no Leader only
//      parts, no list of a slide's blanks.
//   3. The footnotes a passage shows get a slide of their own after it, so the
//      verses stay large.
//   4. The full credit line on the first slide and on a short closing slide,
//      and in the file's properties.
// A long passage is cut across slides by length (`SLIDE_CHARS`), between
// paragraphs or before a verse number, since a file can't measure its text as
// present mode does. A paragraph still too long (a text part's sermon notes, a
// verse without blanks longer than a slide) is cut after a sentence, across
// as many slides as it needs (DK3-1; BVJ, 2026-11-07), because PowerPoint
// doesn't shrink a text box's words when a file opens; a sentence longer than
// a slide is cut after a word. A long title is set smaller (`titlePoints`).
//
// The look is present mode's room screen (sheets-page.css, .present-stage):
// dark in either theme, its words, its green for a passage's reference, its
// colors for a sheet's own colored and highlighted words.

import { DOC_COLORS, DOC_MARKS, docRuns } from "./desk-sheet-doc.mjs";

/** The slide: 16:9, 13.333 by 7.5 inches, in EMU (914400 an inch) and inches. */
export const SLIDE = Object.freeze({ width: 12192000, height: 6858000, inchWidth: 13.333, inchHeight: 7.5 });

/** Present mode's room screen (sheets-page.css, .present-stage), as hex. */
export const SLIDE_LOOK = Object.freeze({
  ground: "#111511",
  words: "#f2eee4",
  quiet: "#a7ada3",
  accent: "#5fcf86",
});

/** A sheet's own colors as present mode shows them on the dark ground (--desk-rich-*). */
const COLOR_ON_DARK = new Map([
  [DOC_COLORS.red, "#ff8a80"],
  [DOC_COLORS.blue, "#8ab4ff"],
  [DOC_COLORS.green, "#7ed69c"],
  [DOC_COLORS.purple, "#c9a4f2"],
  [DOC_COLORS.gray, "#b3b8af"],
]);

/** Present mode's highlights (rgba over the ground), as the solid colors they show as. */
const MARK_ON_DARK = new Map([
  [DOC_MARKS.yellow, "#5d510c"],
  [DOC_MARKS.green, "#3c4e18"],
  [DOC_MARKS.blue, "#223e5d"],
  [DOC_MARKS.pink, "#582b3d"],
]);

/** The fonts the slides name: present mode's Fraunces for the titles and references. */
export const SLIDE_FONTS = Object.freeze({ heading: "Fraunces", headingFallback: "Georgia" });

/** Type sizes in points. */
export const SLIDE_PT = Object.freeze({
  title: 48,
  subtitle: 26,
  heading: 24,
  body: 28,
  question: 32,
  terms: 24,
  footnotes: 20,
  small: 14,
  notes: 12,
});

/** About how many characters a slide's body holds at `SLIDE_PT.body`, with room to spare. */
export const SLIDE_CHARS = 560;

/** The covered word's look: present mode's quiet italic over a dashed line. */
const COVER = { t: "style", color: "gray" };

/**
 * A block's inline pieces as runs for a slide: docRuns, with the colors and
 * highlights moved onto the dark ground as present mode moves them.
 */
export function slideRuns(inlines) {
  return docRuns(inlines).map((r) => {
    if (r.br) return r;
    const out = { ...r };
    if (out.color) out.color = COLOR_ON_DARK.get(out.color) ?? out.color;
    if (out.mark) out.mark = MARK_ON_DARK.get(out.mark) ?? out.mark;
    return out;
  });
}

/** A covered blank's inline piece: the traditional word as present mode shows it, or a line with its hint. */
export function coveredBlank(cover) {
  if (cover?.kind === "word" && cover.text) {
    return { ...COVER, kids: [{ t: "em", kids: [{ t: "u", kids: [{ t: "text", text: cover.text }] }] }] };
  }
  return { t: "blank", answer: null, hint: cover?.hint ?? "" };
}

/** A revealed blank's inline piece: its words, underlined and bold, as on the leader's paper copy. */
export function revealedBlank(words) {
  return { t: "blank", answer: words, hint: "" };
}

/* ── Length, and cutting a passage across slides ──────────────────────── */

const inlineText = (nodes) =>
  (nodes ?? [])
    .map((n) => (n.t === "text" || n.t === "vn" || n.t === "fn" ? n.text : n.t === "blank" ? n.answer ?? "        " : inlineText(n.kids)))
    .join("");

/** About how many characters a block shows. */
export function blockLength(b) {
  if (!b) return 0;
  if (b.inlines) return inlineText(b.inlines).replace(/\s+/g, " ").length;
  if (b.type === "list") return b.items.reduce((n, item) => n + inlineText(item.inlines).length + 4 + blocksLength(item.lists), 0);
  if (b.blocks) return blocksLength(b.blocks);
  if (b.text) return b.text.length;
  return 0;
}

/** About how many characters a run of blocks shows. A paragraph costs a little for its spacing. */
export function blocksLength(blocks) {
  return (blocks ?? []).reduce((n, b) => n + blockLength(b) + 20, 0);
}

/** Where a paragraph may be cut: before each of its verse numbers but the first, as top-level inline indexes. */
function verseCuts(inlines) {
  const at = [];
  inlines.forEach((n, i) => {
    if (n.t === "vn" && i > 0) at.push(i);
  });
  return at;
}

/**
 * Which of a paragraph's verse numbers to cut before (indexes into
 * verseCuts), so each piece is as near `max` as the verses allow. A single
 * verse longer than that stays whole.
 */
function chooseCuts(inlines, max) {
  const cuts = verseCuts(inlines);
  const chosen = [];
  let start = 0;
  for (let k = 0; k <= cuts.length; k++) {
    const end = k < cuts.length ? cuts[k] : inlines.length;
    if (k > 0 && cuts[k - 1] > start && inlineText(inlines.slice(start, end)).length > max) {
      chosen.push(k - 1);
      start = cuts[k - 1];
    }
  }
  return chosen;
}

/**
 * Where a paragraph's text may be cut between sentences: after a sentence's
 * closing mark, any closing quotes or brackets, and the space that follows,
 * as offsets into its text (inlineText).
 */
export function sentenceEnds(text) {
  const at = [];
  for (const m of String(text).matchAll(/[.!?…]+[”’"')\]]*\s+(?=\S)/g)) at.push(m.index + m[0].length);
  return at;
}

/**
 * Inline pieces cut at a character offset into their text: [before, after].
 * A text piece is split; one holding others (a link, a style) is split into
 * two of itself; a verse number, footnote letter or blank is never cut inside.
 */
function splitInlines(nodes, at) {
  const left = [];
  const right = [];
  let pos = 0;
  for (const n of nodes) {
    const len = inlineText([n]).length;
    if (pos + len <= at) left.push(n);
    else if (pos >= at) right.push(n);
    else if (n.t === "text") {
      left.push({ ...n, text: n.text.slice(0, at - pos) });
      right.push({ ...n, text: n.text.slice(at - pos) });
    } else if (n.kids) {
      const [l, r] = splitInlines(n.kids, at - pos);
      if (l.length) left.push({ ...n, kids: l });
      if (r.length) right.push({ ...n, kids: r });
    } else left.push(n);
    pos += len;
  }
  return [left, right];
}

/**
 * A paragraph longer than `max` cut after its sentences into pieces of about
 * `max` each, as chooseCuts cuts a passage before its verses. A sentence
 * longer than `max` on its own is cut after its last word that fits.
 */
function cutSentences(b, max) {
  const text = inlineText(b.inlines);
  const ends = sentenceEnds(text);
  const cuts = [];
  let start = 0;
  while (text.slice(start).replace(/\s+/g, " ").trim().length > max) {
    let cut = ends.filter((e) => e > start && e <= start + max).at(-1);
    if (cut === undefined) {
      let k = start + max - 1;
      while (k > start && !/\s/.test(text[k])) k--;
      cut = k > start ? k + 1 : undefined;
    }
    if (cut === undefined) break;
    cuts.push(cut);
    start = cut;
  }
  const pieces = [];
  let rest = b.inlines;
  let done = 0;
  for (const cut of cuts) {
    const [left, right] = splitInlines(rest, cut - done);
    pieces.push({ ...b, inlines: left });
    rest = right;
    done = cut;
  }
  pieces.push({ ...b, inlines: rest });
  return pieces;
}

/** A paragraph cut before the chosen verse numbers (by their order, so both forms of a passage cut alike). */
function cutAt(b, chosen) {
  const cuts = verseCuts(b.inlines);
  const at = [0, ...chosen.map((k) => cuts[k]), b.inlines.length];
  return at.slice(1).map((end, i) => ({ ...b, inlines: b.inlines.slice(at[i], end) }));
}

/**
 * A passage's blocks in slide-sized groups: whole paragraphs while they fit,
 * a long one cut before a verse number. `covered` is the same blocks with the
 * blanks covered, cut in the same places, or null when nothing is blanked.
 * Without a covered form, a piece still too long is cut after a sentence
 * (cutSentences), and a quotation or box too long is cut between its blocks;
 * with one, the two forms' words differ, so only verse numbers cut them.
 *
 * @returns {{ revealed: object[], covered: object[] | null }[]}
 */
export function splitPassage(revealed, covered = null, max = SLIDE_CHARS) {
  // Cut long paragraphs first, the two forms alike.
  const pairs = [];
  revealed.forEach((b, i) => {
    const c = covered?.[i] ?? null;
    // A covered form with other verse numbers than its revealed one (never
    // expected) leaves the paragraph whole rather than cut the two apart.
    const alike = !c || (c.inlines && verseCuts(c.inlines).length === verseCuts(b.inlines ?? []).length);
    if (b.inlines && alike && blockLength(b) > max) {
      const chosen = chooseCuts(b.inlines, max);
      const r = cutAt(b, chosen);
      const cs = c ? cutAt(c, chosen) : null;
      r.forEach((piece, k) => {
        if (!cs && blockLength(piece) > max) for (const s of cutSentences(piece, max)) pairs.push([s, null]);
        else pairs.push([piece, cs ? cs[k] : null]);
      });
    } else if (!covered && b.blocks && blockLength(b) > max) {
      for (const g of splitBlocks(b.blocks, max)) pairs.push([{ ...b, blocks: g }, null]);
    } else pairs.push([b, c]);
  });
  const groups = [];
  let group = [];
  let size = 0;
  for (const pair of pairs) {
    const n = blockLength(pair[0]) + 20;
    if (group.length && size + n > max) {
      groups.push(group);
      group = [];
      size = 0;
    }
    group.push(pair);
    size += n;
  }
  if (group.length) groups.push(group);
  return groups.map((g) => ({
    revealed: g.map((p) => p[0]),
    covered: covered ? g.map((p) => p[1]) : null,
  }));
}

/** Blocks of any kind in slide-sized groups, between blocks only. */
export function splitBlocks(blocks, max = SLIDE_CHARS) {
  return splitPassage(blocks, null, max).map((g) => g.revealed);
}

/** The blanks' words in a run of blocks, in reading order. */
export function blankWords(blocks) {
  const out = [];
  const walk = (nodes) => {
    for (const n of nodes ?? []) {
      if (n.t === "blank" && n.answer) out.push(n.answer);
      else if (n.kids) walk(n.kids);
    }
  };
  for (const b of blocks ?? []) {
    if (b.inlines) walk(b.inlines);
    if (b.items) for (const item of b.items) walk(item.inlines);
    if (b.blocks) out.push(...blankWords(b.blocks));
  }
  return out;
}

const para = (text) => ({ type: "para", inlines: [{ t: "text", text }] });

/* ── The deck ─────────────────────────────────────────────────────────── */

/**
 * The slides, from present mode's screens as sheet-slides.js reads them.
 *
 * Each screen is one of:
 *   { kind: "start", title, subtitle, codes, addresses, notes }
 *   { kind: "passage", heading, revealed, covered, footnotes, notes }
 *       `covered` is null when the passage has no blank; `footnotes` are
 *       { type: "note" } blocks
 *   { kind: "text" | "question" | "keyTerms", blocks, notes }
 * where `notes` are the speaker notes' blocks.
 *
 * A slide is { kind, heading, blocks, notes } (`kind` "start", "passage",
 * "footnotes", "text", "question", "keyTerms" or "end"); the start slide also
 * carries title, subtitle, codes, addresses and credit, and the end slide
 * credit and addresses.
 *
 * @param {object[]} screens
 * `participant`: the participant version is on screen, so no slide has
 * speaker notes (decision 2 above).
 *
 * @param {{ credit: string, max?: number, participant?: boolean }} opts
 * @returns {{ kind: string, heading: string | null, blocks: object[], notes: object[] }[]}
 */
export function deckSlides(screens, { credit, max = SLIDE_CHARS, participant = false }) {
  const slides = [];
  let addresses = "";
  for (const s of screens) {
    if (s.kind === "start") {
      addresses = s.addresses ?? "";
      slides.push({
        kind: "start",
        heading: null,
        title: s.title,
        subtitle: s.subtitle ?? "",
        codes: s.codes ?? [],
        addresses,
        credit,
        blocks: [],
        notes: s.notes ?? [],
      });
      continue;
    }
    if (s.kind === "passage") {
      const groups = splitPassage(s.revealed ?? [], s.covered ?? null, max);
      groups.forEach((g, i) => {
        const heading = i ? `${s.heading} (continued)` : s.heading;
        const notes = i ? [] : [...(s.notes ?? [])];
        const words = g.covered ? blankWords(g.revealed) : [];
        const differs = g.covered && JSON.stringify(g.covered) !== JSON.stringify(g.revealed);
        if (differs) {
          const told = words.length ? [para(`Blanks on this slide: ${words.join("; ")}. The next slide fills them in.`)] : [];
          slides.push({ kind: "passage", heading, blocks: g.covered, notes: [...told, ...notes], covered: true });
          slides.push({ kind: "passage", heading, blocks: g.revealed, notes: [], revealed: true });
        } else {
          slides.push({ kind: "passage", heading, blocks: g.revealed, notes });
        }
      });
      if (!groups.length) slides.push({ kind: "passage", heading: s.heading, blocks: [], notes: s.notes ?? [] });
      if (s.footnotes?.length) {
        const parts = splitBlocks(s.footnotes, max + 160);
        parts.forEach((blocks, i) =>
          slides.push({ kind: "footnotes", heading: `Footnotes to ${s.heading}${i ? " (continued)" : ""}`, blocks, notes: [] }),
        );
      }
      continue;
    }
    if (s.kind === "keyTerms") {
      splitBlocks(s.blocks ?? [], max + 160).forEach((blocks, i) =>
        slides.push({ kind: "keyTerms", heading: i ? "Key terms (continued)" : "Key terms", blocks, notes: i ? [] : s.notes ?? [] }),
      );
      continue;
    }
    // A text or a question: cut between its blocks if it's long.
    const parts = splitBlocks(s.blocks ?? [], s.kind === "question" ? Math.round(max * 0.8) : max);
    if (!parts.length) parts.push([]);
    parts.forEach((blocks, i) => slides.push({ kind: s.kind, heading: null, blocks, notes: i ? [] : s.notes ?? [] }));
  }
  slides.push({ kind: "end", heading: null, blocks: [], notes: [], credit, addresses });
  return participant ? slides.map((slide) => ({ ...slide, notes: [] })) : slides;
}

/* ── A text box's paragraphs ──────────────────────────────────────────── */

/** Inches of indent per list level. */
export const LIST_STEP = 0.4;
/** Inches a quotation is moved in, and a list inside one with it (DK3-4). */
const QUOTE_INSET = 0.5;

const BULLETS = ["•", "◦", "▪"];
const roman = (n) => {
  let out = "";
  for (const [v, s] of [[10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]]) while (n >= v) { out += s; n -= v; }
  return out;
};

/** A list item's mark: a bullet by level, or its number as 1., a., i. by level. */
export function listLabel(ordered, level, n) {
  if (!ordered) return BULLETS[level % BULLETS.length];
  const kind = level % 3;
  if (kind === 1) return `${String.fromCharCode(96 + (((n - 1) % 26) + 1))}.`;
  if (kind === 2) return `${roman(n)}.`;
  return `${n}.`;
}

/**
 * Blocks as the flat paragraphs a text box holds, for every writer alike.
 * Each is { runs, b, i, heading, scale, align, marL, indent, list }:
 * `scale` multiplies the body's size, `marL` and `indent` are inches (a
 * negative indent hangs), `heading` asks for the titles' font, and `list` is
 * { ordered, level, n, label } on a list item. `toRuns` turns inline pieces
 * into runs: slideRuns on a slide, docRuns in the speaker notes, which are
 * dark on white.
 */
export function slideParagraphs(blocks, { toRuns = slideRuns } = {}) {
  const out = [];
  const textRuns = (text) => toRuns([{ t: "text", text: text ?? "" }]);
  const list = (b, level, quoted = false) => {
    let n = 0;
    for (const item of b.items) {
      n += 1;
      out.push({
        runs: toRuns(item.inlines),
        i: quoted,
        marL: (quoted ? QUOTE_INSET : 0) + LIST_STEP * (level + 1),
        indent: -LIST_STEP * 0.8,
        list: { ordered: !!b.ordered, level, n, label: listLabel(!!b.ordered, level, n) },
      });
      for (const sub of item.lists ?? []) list(sub, level + 1, quoted);
    }
  };
  const walk = (list_, quoted) => {
    for (const b of list_) {
      switch (b.type) {
        case "para":
          out.push({ runs: toRuns(b.inlines), i: quoted, align: b.align, marL: b.poetry || quoted ? QUOTE_INSET : 0 });
          break;
        case "heading":
          out.push({ runs: toRuns(b.inlines), b: true, heading: true, scale: b.level === 2 ? 1.2 : 1.08, align: b.align });
          break;
        case "section":
        case "tag":
          out.push({ runs: textRuns(b.text), b: b.type === "section", i: b.type === "tag" });
          break;
        case "list": list(b, 0, quoted); break;
        case "quote":
        case "box":
          walk(b.blocks, quoted || b.type === "quote");
          break;
        case "note":
          out.push({ runs: [{ text: b.label, sup: true }, { text: " " }, ...toRuns(b.inlines)], marL: 0.3, indent: -0.3 });
          break;
        default:
          break;
      }
    }
  };
  walk(blocks ?? [], false);
  return out.map((p) => ({ b: false, i: false, heading: false, scale: 1, align: null, marL: 0, indent: 0, list: null, ...p }));
}

/**
 * The start slide's title size, in points: SLIDE_PT.title, or smaller for a
 * long title, so its lines fit the title's box and the room above it (a title
 * box grows upward, and PowerPoint doesn't shrink it when the file opens).
 * About 0.55 of the size per character, and lines 1.2 times the size.
 */
export function titlePoints(slide) {
  const box = slideBoxes({ ...slide, kind: "start" }).title;
  const room = box.y + box.h - 0.35;
  const chars = String(slide.title ?? "").length;
  for (const pt of [SLIDE_PT.title, 40, 34, 28, 24, 20]) {
    const perLine = Math.floor((box.w * 72) / (0.55 * pt));
    const lines = Math.max(1, Math.ceil(chars / perLine));
    if ((lines * 1.2 * pt) / 72 <= room) return pt;
  }
  return 20;
}

/** The type size of a slide's body, in points. */
export function bodyPoints(slide) {
  switch (slide.kind) {
    case "question": return SLIDE_PT.question;
    case "keyTerms": return SLIDE_PT.terms;
    case "footnotes": return SLIDE_PT.footnotes;
    default: return SLIDE_PT.body;
  }
}

/**
 * Where a slide's parts go, in inches from the top left: the heading's box,
 * the body's, and on the start slide the title, subtitle, codes and lines.
 * One rule for every writer and the print view, so they lay a slide out alike.
 */
export function slideBoxes(slide) {
  const side = 0.7;
  const width = SLIDE.inchWidth - 2 * side;
  if (slide.kind === "start") {
    const codes = slide.codes?.length ?? 0;
    const titleY = codes ? 0.9 : 1.9;
    const codeSize = codes > 2 ? 1.45 : 1.7;
    const gap = 0.5;
    const rowWidth = codes * codeSize + (codes - 1) * gap;
    return {
      title: { x: side, y: titleY, w: width, h: 1.35 },
      subtitle: { x: side, y: titleY + 1.4, w: width, h: 0.6 },
      follow: { x: side, y: 3.15, w: width, h: 0.45 },
      codes: Array.from({ length: codes }, (_, i) => ({
        x: (SLIDE.inchWidth - rowWidth) / 2 + i * (codeSize + gap),
        y: 3.65,
        w: codeSize,
        h: codeSize,
        label: { x: (SLIDE.inchWidth - rowWidth) / 2 + i * (codeSize + gap) - 0.3, y: 3.7 + codeSize, w: codeSize + 0.6, h: 0.35 },
      })),
      addresses: { x: side, y: codes ? 5.85 : 4.3, w: width, h: 0.4 },
      credit: { x: side, y: 6.75, w: width, h: 0.45 },
    };
  }
  if (slide.kind === "end") {
    return {
      credit: { x: side + 1, y: 2.9, w: width - 2, h: 1.1 },
      addresses: { x: side, y: 4.2, w: width, h: 0.45 },
    };
  }
  if (slide.heading) {
    return {
      heading: { x: side, y: 0.45, w: width, h: 0.6 },
      body: { x: side, y: 1.2, w: width, h: SLIDE.inchHeight - 1.2 - 0.45 },
    };
  }
  // A text or a question has no heading; a question sits a little lower, as present mode centers it.
  const top = slide.kind === "question" ? 1.4 : 0.7;
  return { body: { x: side, y: top, w: width, h: SLIDE.inchHeight - top - 0.6 } };
}
