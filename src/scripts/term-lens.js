// src/scripts/term-lens.js
//
// The term lens (Study View only). Marks every use of the glossary terms the
// alignment dataset vouches for in this chapter with a quiet dotted underline
// (every use rather than the first of each, owner 2026-09-28), and opens
// a small card about the term on hover (mouse) or tap (touch):
//
//   the word as printed (a rendering split by another word reads as its
//   pieces joined: "speaks about … contemptuously")
//   Traditionally "flesh" · Greek "sarx"
//   Also rendered: body (65), family (10), …
//   a link to the glossary entry
//
// The marks come from the page (term-lens-data.mjs writes #term-lens-data at
// build): each is "the kth case-insensitive occurrence of this text in verse
// v". Located here by walking the verse's text, skipping verse numbers and
// footnote letters, so the chapter HTML and every data file stay untouched.
// A mark whose text isn't where the build said is skipped, never guessed.
//
// Deliberately NOT controls: a term is a plain span, with no role and no tab
// stop. A tab stop per term would interrupt scripture mid-sentence, up to 60
// times a chapter. /glossary and the chapter's links carry the same
// information for keyboard and screen-reader readers.
//
// The Display tray's "Key terms" box turns it off (html[data-terms="off"]).
import { showPanel, closePanel, currentPanel } from "./lit-panel.js";

const OPEN_DELAY = 350;
const CLOSE_DELAY = 250;

const dataEl = document.getElementById("term-lens-data");
const data = dataEl ? JSON.parse(dataEl.textContent || "null") : null;
const container = document.querySelector(".chapter-paragraphs");

const lensOff = () => document.documentElement.getAttribute("data-terms") === "off";

/* ── Placing the marks ──────────────────────────────────────────────── */

function skipsMarker(el) {
  return el.matches?.("sup.vn, sup.fn-ref");
}

/**
 * One verse's text as the lens reads it: whitespace collapsed to single
 * spaces, lower-cased, with each character's text node and offset, so a
 * match can be mapped back onto the DOM. A continuation paragraph's span
 * joins with a space, as the build's verse split joins it.
 */
function verseIndex(spans) {
  let text = "";
  const at = [];
  const push = (ch, node, offset) => {
    if (/\s/.test(ch)) {
      if (!text || text.endsWith(" ")) return;
      ch = " ";
    } else {
      const lower = ch.toLowerCase();
      if (lower.length === 1) ch = lower;
    }
    text += ch;
    at.push(node ? [node, offset] : null);
  };
  spans.forEach((span, i) => {
    if (i) push(" ", null, 0);
    const walker = document.createTreeWalker(span, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        n.nodeType === Node.TEXT_NODE
          ? NodeFilter.FILTER_ACCEPT
          : skipsMarker(n)
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_SKIP,
    });
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const s = n.nodeValue;
      for (let j = 0; j < s.length; j++) push(s[j], n, j);
    }
  });
  return { text, at };
}

/** Text-node pieces [node, start, end) covering chars s..e of the index. */
function piecesFor(index, s, e) {
  const pieces = [];
  for (let i = s; i < e; i++) {
    const pos = index.at[i];
    if (!pos) continue;
    const [node, off] = pos;
    const last = pieces[pieces.length - 1];
    if (last && last.node === node && last.end === off) last.end = off + 1;
    else pieces.push({ node, start: off, end: off + 1 });
  }
  return pieces;
}

function placeMarks() {
  if (!data?.marks?.length || !container) return;
  const byVerse = new Map();
  const spansOf = (v) => {
    if (!byVerse.has(v)) {
      const spans = [...container.querySelectorAll(`[data-verse="${v}"]`)];
      byVerse.set(v, spans.length ? verseIndex(spans) : null);
    }
    return byVerse.get(v);
  };

  const pieces = [];
  data.marks.forEach((mark, i) => {
    const index = spansOf(mark.v);
    if (!index) return;
    const needle = mark.text.replace(/\s+/g, " ").toLowerCase();
    let start = -1;
    for (let k = 0, from = 0; k <= mark.k; k++) {
      start = index.text.indexOf(needle, from);
      if (start === -1) break;
      from = start + 1;
    }
    if (start === -1) return;
    // Two records can claim the same words (one word rendering two terms, or
    // "unjustness" holding another term's "justness"). The first in reading
    // order keeps them; the other is skipped rather than nested.
    const end = start + needle.length;
    index.claimed ??= [];
    if (index.claimed.some(([s, e]) => start < e && s < end)) return;
    index.claimed.push([start, end]);
    for (const p of piecesFor(index, start, end)) pieces.push({ ...p, i });
  });

  // Wrap from the end of the chapter backwards, so splitting a text node never
  // moves a piece still waiting to be wrapped: the original node always keeps
  // the text before the split.
  pieces.sort((a, b) => {
    if (a.node === b.node) return b.start - a.start;
    return a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING ? 1 : -1;
  });
  for (const { node, start, end, i } of pieces) {
    const target = start > 0 ? node.splitText(start) : node;
    if (end - start < target.nodeValue.length) target.splitText(end - start);
    const span = document.createElement("span");
    span.className = "term";
    span.dataset.mark = String(i);
    target.parentNode.insertBefore(span, target);
    span.appendChild(target);
  }
}

/* ── The card ───────────────────────────────────────────────────────── */

function markOf(el) {
  const span = el?.closest?.(".term");
  if (!span || lensOff()) return null;
  const mark = data.marks[Number(span.dataset.mark)];
  return mark ? { span, mark } : null;
}

/** Every piece of one mark (a term can cross an <em>), in order. */
function markText(i) {
  return [...container.querySelectorAll(`.term[data-mark="${i}"]`)]
    .map((s) => s.textContent)
    .join("")
    .trim();
}

/** The marks of one rendering: just this one, or every piece of a split one. */
function groupOf(span, mark) {
  if (mark.g === undefined) return [Number(span.dataset.mark)];
  return data.marks.flatMap((m, i) => (m.g === mark.g ? [i] : []));
}

/**
 * The rendering as printed. A rendering split by another word ("speaks about
 * Christ contemptuously", where "Christ" renders something else) reads as its
 * pieces joined, "speaks about … contemptuously", the label the alignment
 * review tool gives it. A piece another term claimed was never placed, so it
 * has no text here and drops out.
 */
function renderingText(span, mark) {
  return groupOf(span, mark).map(markText).filter(Boolean).join(" … ");
}

/** Underline a split rendering's other pieces with the one under the pointer. */
function lightSiblings(span, mark, on) {
  if (mark.g === undefined) return;
  for (const i of groupOf(span, mark)) {
    for (const el of container.querySelectorAll(`.term[data-mark="${i}"]`)) {
      el.classList.toggle("is-sibling-hover", on);
    }
  }
}

function buildCard(span, mark) {
  const term = data.terms[mark.id];
  const word = renderingText(span, mark);

  const panel = document.createElement("div");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", `Key term: ${word}`);
  panel.tabIndex = -1;
  panel.classList.add("lit-panel--footnote", "term-card");

  const header = document.createElement("div");
  header.className = "lit-panel__header";
  const heading = document.createElement("p");
  heading.className = "lit-panel__heading";
  heading.textContent = word;
  header.appendChild(heading);
  const close = document.createElement("button");
  close.type = "button";
  close.className = "lit-panel__close";
  close.setAttribute("aria-label", "Close");
  close.textContent = "×";
  close.addEventListener("click", closePanel);
  header.appendChild(close);
  panel.appendChild(header);

  const body = document.createElement("div");
  body.className = "lit-panel__body";

  const origin = document.createElement("p");
  origin.className = "term-card__origin";
  const same = term.traditional.toLowerCase() === word.toLowerCase();
  if (!same) {
    origin.append("Traditionally ");
    const t = document.createElement("em");
    t.textContent = term.traditional.toLowerCase();
    origin.append(t, " · ");
  }
  origin.append("Greek ");
  const g = document.createElement("em");
  g.textContent = term.greek;
  origin.append(g);
  body.appendChild(origin);

  const others = term.renderings.filter((r) => r.form.toLowerCase() !== mark.form.toLowerCase()).slice(0, 4);
  if (others.length) {
    const also = document.createElement("p");
    also.className = "term-card__also";
    also.textContent =
      "Also rendered: " + others.map((r) => `${r.form} (${r.count})`).join(", ");
    body.appendChild(also);
  }
  panel.appendChild(body);

  const link = document.createElement("a");
  link.className = "lit-panel__jump";
  link.href = `/glossary/#${mark.id}`;
  link.textContent = `${term.title} in the glossary →`;
  panel.appendChild(link);
  return panel;
}

let hoverTimer = 0;
let closeTimer = 0;

function openCard(span, mark, { hover }) {
  const panel = buildCard(span, mark);
  showPanel(span, panel, {
    restoreFocus: null,
    extra: { kind: "term", hover },
  });
  if (hover) {
    panel.addEventListener("pointerenter", () => clearTimeout(closeTimer));
    panel.addEventListener("pointerleave", scheduleClose);
  } else {
    panel.focus({ preventScroll: true });
  }
}

function scheduleClose() {
  clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    const p = currentPanel();
    if (p?.kind === "term" && p.hover) closePanel();
  }, CLOSE_DELAY);
}

function wire() {
  // Mouse hover. As with reference previews, a panel someone opened on
  // purpose (the verse menu, a footnote, the selection bar) is never
  // replaced by one that merely passed under the pointer.
  container.addEventListener("pointerover", (e) => {
    if (e.pointerType !== "mouse") return;
    const hit = markOf(e.target);
    if (!hit) return;
    lightSiblings(hit.span, hit.mark, true);
    clearTimeout(closeTimer);
    const p = currentPanel();
    if (p?.trigger && p.kind === "term" && p.trigger.dataset.mark === hit.span.dataset.mark) return;
    if (p && !(p.kind === "term" && p.hover)) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => openCard(hit.span, hit.mark, { hover: true }), OPEN_DELAY);
  });
  container.addEventListener("pointerout", (e) => {
    if (e.pointerType !== "mouse") return;
    const hit = markOf(e.target);
    if (!hit || hit.span.contains(e.relatedTarget)) return;
    lightSiblings(hit.span, hit.mark, false);
    clearTimeout(hoverTimer);
    if (currentPanel()?.kind === "term") scheduleClose();
  });

  // A tap (or a click that selects nothing) opens it as a dialog.
  container.addEventListener("click", (e) => {
    const hit = markOf(e.target);
    if (!hit) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    const p = currentPanel();
    if (p?.kind === "term" && !p.hover && p.trigger === hit.span) {
      closePanel();
      return;
    }
    openCard(hit.span, hit.mark, { hover: false });
    e.stopPropagation();
  });

  // Ctrl+C copies the text, not the lens. Chrome and Safari serialize the
  // selection with each element's computed style inlined, after the copy
  // event and before the next task, so the underline comes off for exactly
  // that window. The copy itself is left to the browser: nothing is added
  // to or taken from what the reader selected.
  document.addEventListener("copy", () => {
    container.classList.add("is-copying");
    setTimeout(() => container.classList.remove("is-copying"));
  });
}

if (data && container) {
  placeMarks();
  wire();
}
