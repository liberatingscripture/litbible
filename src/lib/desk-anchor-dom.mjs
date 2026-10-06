// src/lib/desk-anchor-dom.mjs
//
// The browser half of the Study Desk's anchor text (STUDY-DESK-FORMAT.md,
// "Anchor text"): the same chapter text scripts/lib/anchor-text.mjs builds from
// a chapter's JSON, built instead from the page the reader is looking at, with
// a map from every character back to where it sits in the DOM. That map is what
// turns a reader's selection into a quote, and a found quote back into a range
// to draw.
//
// The two builders must agree character for character, or a note made on the
// website lands somewhere else in the apps. test/desk-anchor-dom.test.js holds
// them to it: it renders every published chapter through both views'
// pipelines (src/lib/chapter-html.ts) and compares. The page's own text models
// are NOT this: `countable` in chapter-tools.js keeps ⟦ ⟧ and drops all
// whitespace, and Copy text keeps line breaks (STUDY-DESK.md, review
// finding 3). Don't borrow either.
//
// How the page is read, which is a contract with everything that renders into
// the scripture blocks:
//   - verse text is whatever sits inside a `[data-verse]` span
//     (wrapVerseSegments in chapter-html.ts puts it there); anything outside
//     one is not scripture and is dropped;
//   - a verse number (`sup.vn`) and a footnote letter (`sup.fn-ref`) contribute
//     nothing, contents included;
//   - a block element is a space; every other element vanishes, so a word
//     split across inline tags rejoins.
// So **no client script may put visible text inside a verse span** that isn't
// scripture, unless it sits inside an element this file skips. The term lens
// only wraps existing text in spans, which changes nodes but not text; that is
// also why a map is built fresh each time it's needed and never kept across a
// DOM change.
//
// Steps 5 to 7 of the spec run here on a stream of characters that each
// remember their source, rather than on a string: composition per combining
// cluster, invisible characters dropped, bracket markers stripped (before
// whitespace collapses, as bracket-markers.mjs requires), whitespace collapsed
// and trimmed per verse.

import { INVISIBLE, assembleChapter } from "./anchor-core.mjs";

const ELEMENT = 1;
const TEXT = 3;

/** Elements whose text is never anchor text. */
function isSkipped(el) {
  if (String(el.tagName).toLowerCase() !== "sup") return false;
  const cls = ` ${el.getAttribute("class") ?? ""} `;
  return cls.includes(" vn ") || cls.includes(" fn-ref ");
}

/** Elements whose edges separate words. */
const BLOCK = new Set([
  "p", "blockquote", "br", "div", "li", "ul", "ol",
  "h1", "h2", "h3", "h4", "h5", "h6", "section", "article",
]);

const SINGLE_INVISIBLE = new RegExp(`^${INVISIBLE.source}$`);
const SPACE = /^\s$/;

/**
 * Walk the given blocks in document order and describe them as segments: one
 * per text node, carrying its verse (or null when it isn't verse text, or sits
 * in a verse number or footnote letter), and a boundary at each block edge.
 *
 * @param {Iterable<Node>} blocks the chapter's blocks: Study View's `.p`
 *   containers, or one chapter's `[data-chapter]` blocks in Read View
 */
export function segmentsFromDom(blocks) {
  const segments = [];
  const walk = (node, verse, skipped) => {
    if (node.nodeType === TEXT) {
      segments.push({ node, text: node.nodeValue ?? "", verse: skipped ? null : verse });
      return;
    }
    if (node.nodeType !== ELEMENT) return;
    const tag = String(node.tagName).toLowerCase();
    const block = BLOCK.has(tag);
    const v = node.getAttribute("data-verse");
    const here = v != null && /^\d+$/.test(v) ? Number(v) : verse;
    if (block) segments.push({ boundary: true });
    const skip = skipped || isSkipped(node);
    for (const child of node.childNodes) walk(child, here, skip);
    if (block) segments.push({ boundary: true });
  };
  for (const b of blocks) walk(b, null, false);
  return segments;
}

/**
 * Build the chapter's anchor text from segments, keeping a map back to the
 * source. Returns the anchor-core chapter shape ({ verses, spans, text }) plus
 * `toDom` and `fromDom`.
 *
 * Each kept character ("unit") remembers the text node it came from and the
 * [s, e) of the source characters it stands for. A collapsed run of whitespace
 * is one unit covering the whole run; a composed character covers its whole
 * combining cluster.
 */
export function anchorTextFromSegments(segments) {
  /** verse -> units; a unit is { ch, node, s, e } (node null for a joining space) */
  const raw = new Map();
  const order = []; // every text node, in document order
  const nodeIndex = new Map();
  let lastVerse = null;
  let pendingBreak = false;

  for (const seg of segments) {
    if (seg.boundary) {
      pendingBreak = true;
      continue;
    }
    nodeIndex.set(seg.node, order.length);
    order.push(seg.node);
    if (seg.verse == null) continue;
    let units = raw.get(seg.verse);
    if (!units) raw.set(seg.verse, (units = []));
    // A block edge, or the verse resuming after another verse, separates words.
    if (units.length && (pendingBreak || lastVerse !== seg.verse)) {
      units.push({ ch: " ", node: null, s: 0, e: 0 });
    }
    pendingBreak = false;
    lastVerse = seg.verse;
    // Compose one combining cluster at a time, so every output character still
    // knows where it came from (spec step 5).
    for (const m of seg.text.matchAll(/\P{M}\p{M}*|\p{M}+/gu)) {
      const s = m.index;
      const e = s + m[0].length;
      for (const ch of m[0].normalize("NFC")) {
        for (let i = 0; i < ch.length; i++) {
          units.push({ ch: ch[i], node: seg.node, s, e });
        }
      }
    }
  }

  const verses = new Map();
  const unitsByVerse = new Map();
  for (const [n, units] of raw) {
    const kept = collapse(stripMarkers(units.filter((u) => !SINGLE_INVISIBLE.test(u.ch))));
    if (!kept.length) continue;
    unitsByVerse.set(n, kept);
    verses.set(n, kept.map((u) => u.ch).join(""));
  }

  const chapter = assembleChapter(verses);

  // Global offset -> unit, and node -> its units with their global offsets.
  const at = new Array(chapter.text.length).fill(null);
  const byNode = new Map();
  for (const [n, [start]] of chapter.spans) {
    unitsByVerse.get(n).forEach((u, i) => {
      at[start + i] = u;
      if (!u.node) return;
      let list = byNode.get(u.node);
      if (!list) byNode.set(u.node, (list = []));
      list.push({ s: u.s, e: u.e, offset: start + i });
    });
  }

  /** The DOM point where a range starting (or ending) at `offset` begins (or ends). */
  function toDom(offset, edge = "start") {
    if (edge === "start") {
      for (let i = offset; i < at.length; i++) {
        if (at[i]?.node) return { node: at[i].node, offset: at[i].s };
      }
      edge = "end";
      offset = at.length;
    }
    for (let i = offset - 1; i >= 0; i--) {
      if (at[i]?.node) return { node: at[i].node, offset: at[i].e };
    }
    return null;
  }

  /**
   * The chapter offset for a DOM point inside a text node. A point inside text
   * that isn't anchor text (a verse number, a footnote letter, a dropped
   * character) moves forward to the next anchor character when it starts a
   * range, and back to the end of the previous one when it ends a range.
   */
  function fromDom(node, k, edge = "start") {
    const i = nodeIndex.get(node);
    if (i === undefined) return null;
    if (edge === "start") {
      for (let j = i; j < order.length; j++) {
        for (const u of byNode.get(order[j]) ?? []) {
          if (j > i || u.e > k) return u.offset;
        }
      }
      return chapter.text.length;
    }
    for (let j = i; j >= 0; j--) {
      const list = byNode.get(order[j]) ?? [];
      for (let x = list.length - 1; x >= 0; x--) {
        if (j < i || list[x].s < k) return list[x].offset + 1;
      }
    }
    return 0;
  }

  return { ...chapter, toDom, fromDom, textNodes: order };
}

/** Spec step 6: drop ⟦ ⟧ and the retired [| |], as stripBracketMarkers does. */
function stripMarkers(units) {
  const out = [];
  for (let i = 0; i < units.length; i++) {
    const c = units[i].ch;
    if (c === "⟦" || c === "⟧") continue;
    const next = units[i + 1]?.ch;
    if ((c === "[" && next === "|") || (c === "|" && next === "]")) {
      i++;
      continue;
    }
    out.push(units[i]);
  }
  return out;
}

/** Spec step 7: each run of whitespace becomes one space; trimmed at both ends. */
function collapse(units) {
  const out = [];
  for (const u of units) {
    if (!SPACE.test(u.ch)) {
      out.push(u);
      continue;
    }
    const last = out[out.length - 1];
    if (!last) continue; // leading whitespace
    if (last.ch === " " && last.space) {
      // Widen the run to cover this character too, where they share a node.
      if (u.node && (!last.node || last.node === u.node)) {
        if (!last.node) Object.assign(last, { node: u.node, s: u.s });
        last.e = u.e;
      }
      continue;
    }
    out.push({ ch: " ", space: true, node: u.node, s: u.s, e: u.e });
  }
  while (out.length && out[out.length - 1].space) out.pop();
  return out;
}

/**
 * The chapter as anchor text, read from the page.
 *
 * @param {Iterable<Node>} blocks see segmentsFromDom
 */
export function pageAnchorText(blocks) {
  return anchorTextFromSegments(segmentsFromDom(blocks));
}

/** The first text node at or after a DOM boundary point, or the last before it. */
function textPoint(container, offset, edge) {
  if (container.nodeType === TEXT) return { node: container, offset };
  const kids = container.childNodes;
  if (edge === "start") {
    const t = kids[offset] ? firstTextFrom(kids[offset]) : firstTextFrom(after(container));
    return t ? { node: t, offset: 0 } : null;
  }
  const t = offset > 0 ? lastTextFrom(kids[offset - 1]) : lastTextFrom(before(container));
  return t ? { node: t, offset: (t.nodeValue ?? "").length } : null;
}

/** The node after `n` in document order, skipping its descendants. */
function after(n) {
  while (n && !n.nextSibling) n = n.parentNode;
  return n ? n.nextSibling : null;
}

/** The node before `n` in document order, skipping its descendants. */
function before(n) {
  while (n && !n.previousSibling) n = n.parentNode;
  return n ? n.previousSibling : null;
}

function firstTextFrom(n) {
  for (; n; n = after(n)) {
    const t = firstText(n);
    if (t) return t;
  }
  return null;
}

function lastTextFrom(n) {
  for (; n; n = before(n)) {
    const t = lastText(n);
    if (t) return t;
  }
  return null;
}

function firstText(n) {
  if (n.nodeType === TEXT) return n;
  for (const c of n.childNodes ?? []) {
    const t = firstText(c);
    if (t) return t;
  }
  return null;
}

function lastText(n) {
  if (n.nodeType === TEXT) return n;
  const kids = n.childNodes ?? [];
  for (let i = kids.length - 1; i >= 0; i--) {
    const t = lastText(kids[i]);
    if (t) return t;
  }
  return null;
}

/**
 * A DOM Range (or anything with startContainer/startOffset/endContainer/
 * endOffset) as [start, end) chapter offsets, with edges moved off verse
 * numbers, footnote letters and spaces. Null when it covers no anchor text.
 */
export function rangeToOffsets(chapter, range) {
  const a = textPoint(range.startContainer, range.startOffset, "start");
  const b = textPoint(range.endContainer, range.endOffset, "end");
  if (!a || !b) return null;
  let start = chapter.fromDom(a.node, a.offset, "start");
  let end = chapter.fromDom(b.node, b.offset, "end");
  if (start == null || end == null) return null;
  while (start < end && chapter.text[start] === " ") start++;
  while (end > start && chapter.text[end - 1] === " ") end--;
  return end > start ? [start, end] : null;
}

/**
 * Chapter offsets [start, end) as DOM boundary points, ready for
 * `range.setStart(...)` / `range.setEnd(...)` or a CSS Highlight.
 */
export function offsetsToRange(chapter, start, end) {
  const a = chapter.toDom(start, "start");
  const b = chapter.toDom(end, "end");
  if (!a || !b) return null;
  return {
    startContainer: a.node,
    startOffset: a.offset,
    endContainer: b.node,
    endOffset: b.offset,
  };
}
