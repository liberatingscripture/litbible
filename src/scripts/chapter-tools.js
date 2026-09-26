// src/scripts/chapter-tools.js
//
// Chapter-page (Study View) reader tools. All progressive enhancement:
// without JS the page still scrolls to #vN anchors and footnote links
// still jump to the footnotes section.
//
// 1. Verse-range highlighting — #v16 or #v16-18 softly highlights the
//    addressed verses via the CSS Custom Highlight API (no-op where
//    unsupported; the scroll still works). A floating chip (or Esc)
//    clears the highlight.
// 2. Verse menu — tapping a verse number opens Copy verse / Copy link /
//    Share. Tapping more verse numbers while the menu is open extends
//    the selection to a range (e.g. John 3:16–18).
// 3. Footnote popovers — tapping a footnote letter shows the note inline
//    (bottom sheet on small screens), with a link through to the full
//    footnotes section.
// 4. Selection sharing — selecting any run of scripture text offers Copy
//    with reference / Share, for a half-sentence or a phrase crossing two
//    verses, which the verse menu can't reach.
//
// A verse that spans blocks (a quotation set as a block quote, a mid-verse
// speaker change) can also be shared one PART at a time — see "parts" below.

import { stripBracketMarkers } from "../lib/bracket-markers.mjs";

function init(container) {
  initVerseHighlight(container);
  initVerseMenu(container);
  initFootnotePopovers(container);
  initSelectionShare(container);
}

/* ── Shared: verse span lookup ────────────────────────────────────────── */

// Each verse's content is wrapped in `<span data-verse="N">` at build time
// (see wrapVerseSegments in src/lib/chapter-html.ts); a verse that crosses
// block boundaries has one span per block, all with the same number.

function verseSpans(container, verse) {
  return [...container.querySelectorAll(`[data-verse="${verse}"]`)];
}

/**
 * DOM Ranges covering verses start..end — one per verse span, so
 * paragraph-crossing verses need no boundary math. Empty array when the
 * verses do not exist.
 */
function verseRanges(container, start, end) {
  const ranges = [];
  for (let v = start; v <= end; v++) {
    for (const span of verseSpans(container, v)) {
      const range = document.createRange();
      range.selectNodeContents(span);
      ranges.push(range);
    }
  }
  return ranges;
}

/* ── Shared: one floating panel at a time ─────────────────────────────── */

let openPanel = null;

function closePanel() {
  if (!openPanel) return;
  const { el, restoreFocus, onClose } = openPanel;
  openPanel = null;
  el.remove();
  if (onClose) onClose();
  if (restoreFocus && document.contains(restoreFocus)) restoreFocus.focus();
}

document.addEventListener("click", (e) => {
  if (openPanel && !openPanel.el.contains(e.target) && e.target !== openPanel.trigger && !openPanel.trigger?.contains?.(e.target)) {
    closePanel();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (openPanel) closePanel();
  else clearHashHighlight();
});

function isSmallScreen() {
  return window.matchMedia("(max-width: 640px)").matches;
}

/**
 * Show a panel near an inline trigger element (or as a bottom sheet on
 * small screens). Returns the panel element. The trigger only needs
 * getBoundingClientRect, so a selection can stand in for an element. `place`
 * overrides both layouts: it gets the attached panel and returns its
 * document-relative {left, top}.
 */
function showPanel(trigger, el, { restoreFocus = null, onClose = null, extra = null, preferAbove = false, place = null } = {}) {
  closePanel();
  el.classList.add("lit-panel");

  if (place) {
    document.body.appendChild(el);
    const { left, top } = place(el);
    el.style.left = left + "px";
    el.style.top = top + "px";
  } else if (isSmallScreen()) {
    el.classList.add("lit-panel--sheet");
    document.body.appendChild(el);
  } else {
    document.body.appendChild(el);
    const rect = trigger.getBoundingClientRect();
    const panelWidth = Math.min(380, window.innerWidth - 24);
    el.style.maxWidth = panelWidth + "px";
    const width = el.offsetWidth;
    let left = window.scrollX + rect.left + rect.width / 2 - width / 2;
    left = Math.max(window.scrollX + 12, Math.min(left, window.scrollX + window.innerWidth - width - 12));
    const height = el.offsetHeight;
    const fitsAbove = rect.top > height + 16;
    const fitsBelow = rect.bottom + height + 16 <= window.innerHeight;
    let top;
    if (preferAbove ? fitsAbove : !fitsBelow && fitsAbove) {
      // Above the trigger (the verse menu prefers this so the text that
      // follows — where the user taps to extend a selection — stays clear)
      top = window.scrollY + rect.top - height - 8;
    } else {
      top = window.scrollY + rect.bottom + 8;
    }
    // Final clamp: keep the panel fully inside the viewport even when
    // neither side has room (e.g. very long footnotes)
    top = Math.max(
      window.scrollY + 12,
      Math.min(top, window.scrollY + window.innerHeight - height - 12)
    );
    el.style.left = left + "px";
    el.style.top = top + "px";
  }

  // Keep Tab cycling inside the panel while it's open (it's appended to the
  // end of <body>, so without this Tab would silently leave the dialog).
  // Escape closes and, for keyboard-opened panels, restores focus.
  el.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const focusables = el.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  openPanel = { el, trigger, restoreFocus, onClose, ...extra };
  return el;
}

/* ── 1. Verse-range highlighting (from the URL hash) ──────────────────── */

const supportsHighlight = "highlights" in CSS;
let clearChip = null;

function removeClearChip() {
  clearChip?.remove();
  clearChip = null;
}

// The hash the current highlight came from, so clearing knows whether the hash
// in the address bar is ours to drop. Covers both forms (#v16, #v16-18 and a
// part anchor like #1peter-2-p2) without re-testing their patterns here.
let highlightedHash = null;

function clearHashHighlight() {
  if (!supportsHighlight) return;
  if (!CSS.highlights.has("lit-verse-range")) return;
  CSS.highlights.delete("lit-verse-range");
  removeClearChip();
  if (highlightedHash && window.location.hash === highlightedHash) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  highlightedHash = null;
}

function showClearChip(refLabel) {
  if (clearChip) return;
  clearChip = document.createElement("button");
  clearChip.type = "button";
  clearChip.className = "lit-clear-chip";
  clearChip.textContent = (refLabel ? refLabel + " " : "") + "✕";
  clearChip.setAttribute(
    "aria-label",
    refLabel ? "Clear highlight for " + refLabel : "Clear highlight"
  );
  clearChip.addEventListener("click", clearHashHighlight);
  document.body.appendChild(clearChip);
}

/**
 * Ranges + label for a PART anchor (`#john-8-p9`, `#1peter-2-p2`) — the id of
 * a single paragraph or block quote, as produced by the verse menu's part
 * buttons. Highlighting these means a link to part of a verse lands the same
 * way `#v16` does instead of merely scrolling. Returns null for any other hash.
 */
function partHighlight(container, hash) {
  // Guard the selector: ids here are always `<book>-<ch>-p<n>`, and anything
  // exotic (a footnote hash, an injected value) must not reach querySelector.
  if (!/^#[A-Za-z][\w-]*$/.test(hash)) return null;

  const el = container.querySelector(hash);
  if (!el || !el.matches("p[id], blockquote[id]")) return null;

  const spans = [...el.querySelectorAll("[data-verse]")];
  if (!spans.length) return null;

  const ranges = spans.map((span) => {
    const range = document.createRange();
    range.selectNodeContents(span);
    return range;
  });
  const verses = [...new Set(spans.map((s) => Number(s.dataset.verse)))].sort(
    (a, b) => a - b
  );
  return { ranges, label: formatRef(verses[0], verses[verses.length - 1]) };
}

function initVerseHighlight(container) {
  if (!supportsHighlight) return;

  function applyFromHash() {
    CSS.highlights.delete("lit-verse-range");
    removeClearChip();
    highlightedHash = null;

    const hash = window.location.hash;
    const m = hash.match(/^#v(\d+)(?:-(\d+))?$/);

    let ranges, label;
    if (m) {
      const start = Number(m[1]);
      const end = m[2] ? Math.max(start, Number(m[2])) : start;
      ranges = verseRanges(container, start, end);
      label = formatRef(start, end);
    } else {
      const part = partHighlight(container, hash);
      if (!part) return;
      ({ ranges, label } = part);
    }

    if (!ranges.length) return;
    CSS.highlights.set("lit-verse-range", new Highlight(...ranges));
    highlightedHash = hash;
    showClearChip(label);
  }

  applyFromHash();
  window.addEventListener("hashchange", applyFromHash);
}

/* ── 2. Verse menu (copy / share, single verse or range) ──────────────── */

function getChapterRef() {
  const h1 = document.getElementById("chapter-title");
  return h1 ? h1.textContent.trim().replace(/\s+/g, " ") : "";
}

function formatRef(start, end) {
  const base = getChapterRef() + ":" + start;
  return end > start ? base + "–" + end : base;
}

function pageUrl() {
  return window.location.origin + window.location.pathname.replace(/\/$/, "");
}

function getVerseUrl(start, end) {
  return pageUrl() + "#v" + start + (end > start ? "-" + end : "");
}

/**
 * The blocks one verse's content is spread across, in document order.
 *
 * Most verses occupy a single <p>. Two shapes spill past one block: a
 * quotation set as poetry lives in a <blockquote> (one .hbq-line <p> per line,
 * every line carrying the same data-verse), and a mid-verse speaker change
 * opens a new <p> that carries no verse marker of its own. In both cases a
 * reader may want the quoted part on its own rather than the whole verse —
 * 19 published block quotes continue a verse this way (1 Peter 2:6, 1 Timothy
 * 3:16, 1 Corinthians 6:18 …).
 *
 * Grouped by the OUTERMOST block, so a poetry quotation is one part rather
 * than one per line, and narrowed to this verse's spans, so a blockquote
 * holding two verses doesn't hand back both. Only blocks carrying an id are
 * offered: the id is what makes a part linkable, and every authored paragraph
 * and blockquote has one, already book-namespaced (`john-8-p9`,
 * `1peter-2-p2`) so the same anchor resolves in Reading Mode too.
 */
function verseParts(container, verse) {
  const byBlock = new Map(); // insertion order = document order
  for (const span of verseSpans(container, verse)) {
    const block = span.closest("blockquote[id]") || span.closest("p[id]");
    if (!block) continue;
    if (!byBlock.has(block)) byBlock.set(block, []);
    byBlock.get(block).push(span);
  }

  const parts = [];
  for (const [block, spans] of byBlock) {
    const text = joinPieces(spans.map((span) => spanPiece(span)));
    if (!text) continue;
    // `plain` feeds one-line button labels, so every line break flattens.
    parts.push({ id: block.id, text, plain: text.replace(/\n/g, " ") });
  }
  return parts;
}

/**
 * One verse span as a piece of shareable text, carrying what joinPieces needs.
 * `text` defaults to the whole span; a selection passes in only its share.
 */
function spanPiece(span, text = cleanForShare(blockText(span))) {
  return { verse: Number(span.dataset.verse), lines: isSetAsLines(span), text };
}

/**
 * Join span pieces into shareable text. This is the one rule behind Copy
 * verse, Copy verses, the per-part copy, and a shared selection, so a
 * selection of whole verses copies exactly what the verse menu does.
 *
 * Text set as lines keeps its line breaks — for a quotation set as poetry the
 * line structure is part of what is being quoted. Within a verse, a newline
 * falls at every boundary touching lines: between a poetry block's lines, and
 * between lines and the prose leading into or out of them. Anything else is
 * wrapped text or a mid-verse paragraph break, which join with a space.
 *
 * Each verse after the first opens with its number:
 *   "…agelong life. 17 God did not send… 18 The one who…"
 * A verse ending inside lines keeps that break before the number, so the next
 * verse does not run on from its last line.
 */
function joinPieces(pieces) {
  let out = "";
  let prev = null;
  for (const piece of pieces) {
    if (!piece.text) continue;
    if (!prev) {
      out = piece.text;
    } else if (piece.verse === prev.verse) {
      out += (piece.lines || prev.lines ? "\n" : " ") + piece.text;
    } else {
      out += (prev.lines ? "\n" : " ") + piece.verse + " " + piece.text;
    }
    prev = piece;
  }
  return out;
}

/** Is this span one line of a quotation set as poetry? */
function isPoetry(span) {
  return !!span.closest("blockquote");
}

/**
 * Is this span set as lines — poetry, or a paragraph broken with <br>?
 *
 * Kept apart from isPoetry on purpose: `hbq` is a claim that the lines are
 * quoted scripture, while a <br> sets lines that are not (2 Corinthians 6:2,
 * Paul's own application of the Isaiah quotation). Both still copy as lines.
 */
function isSetAsLines(span) {
  return isPoetry(span) || !!span.querySelector("br");
}

/** A short preview of a part, for its menu button. */
function partLabel(text) {
  const MAX = 34;
  if (text.length <= MAX) return text;
  // Trim back to a word boundary so the preview doesn't end mid-word.
  return text.slice(0, MAX).replace(/\s+\S*$/, "") + "…";
}

/**
 * Marks a <br> in blockText's output until cleanForShare turns it into a
 * newline. Not "\n" itself: source whitespace is insignificant and gets
 * collapsed, so only a real <br> may survive as a line break.
 */
const LINE_BREAK = "\u2028";

/** Plain text of one element, minus verse numbers and footnote letters. */
function blockText(el) {
  const clone = el.cloneNode(true);
  clone.querySelectorAll("sup.fn-ref, sup.vn").forEach((s) => s.remove());
  // textContent drops a <br> with no separator, welding the lines either side
  // into one word ("a welcome time!Look! Now is…").
  clone.querySelectorAll("br").forEach((br) => br.replaceWith(LINE_BREAK));
  return clone.textContent;
}

/** Tidy extracted text for the clipboard / share sheet. */
function cleanForShare(text) {
  // Bracket markers are reader-facing on the page but junk once the text is
  // lifted off it — strip BEFORE collapsing, per src/lib/bracket-markers.mjs.
  return stripBracketMarkers(text)
    .replace(/[​‌‍⁠﻿]/g, "") // zero-width characters
    .split(LINE_BREAK)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * Text for a verse or verse range, from its data-verse spans, skipping
 * verse-number markers and footnote refs. Known SBLGNT omissions have no
 * spans, so a gap simply contributes nothing. Joined per joinPieces.
 */
function getVerseText(container, start, end) {
  const pieces = [];
  for (let v = start; v <= end; v++) {
    for (const span of verseSpans(container, v)) pieces.push(spanPiece(span));
  }
  return joinPieces(pieces);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function menuButton(label, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "lit-panel__btn";
  btn.textContent = label;
  btn.addEventListener("click", async () => {
    const done = await onClick();
    if (done === false) {
      // Clipboard can fail (permissions policy, embedded webviews) —
      // never fail silently.
      btn.textContent = "Couldn’t copy — try selecting the text";
      btn.classList.add("lit-panel__btn--error");
      return;
    }
    btn.textContent = "Copied ✓";
    btn.classList.add("lit-panel__btn--done");
    setTimeout(closePanel, 700);
  });
  return btn;
}

/**
 * Shared text with its attribution line. No added quotation marks — verses
 * containing dialogue would otherwise produce nested double quotes; the
 * attribution carries it.
 */
function withReference(text, ref) {
  return text + "\n— " + ref + " (LIT)";
}

/** A Share… button for the native share sheet, or null where there is none. */
function shareButton(ref, url, getText) {
  if (!navigator.share) return null;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "lit-panel__btn";
  btn.textContent = "Share…";
  btn.addEventListener("click", async () => {
    const text = getText();
    try {
      await navigator.share({
        title: ref + " (LIT)",
        text: text ? withReference(text, ref) : ref + " (LIT)",
        url,
      });
      closePanel();
    } catch {
      /* user cancelled the share sheet */
    }
  });
  return btn;
}

function setSelectionHighlight(container, start, end) {
  if (!supportsHighlight) return;
  const ranges = verseRanges(container, start, end);
  if (ranges.length)
    CSS.highlights.set("lit-verse-select", new Highlight(...ranges));
}

function openVerseMenu(container, sup, anchorVerse, start, end, { restoreFocus = null } = {}) {
  const ref = formatRef(start, end);
  const url = getVerseUrl(start, end);

  const panel = document.createElement("div");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", ref + " options");
  panel.tabIndex = -1;
  panel.classList.add("lit-panel--menu");

  const heading = document.createElement("p");
  heading.className = "lit-panel__heading";
  heading.textContent = ref + " (LIT)";
  panel.appendChild(heading);

  panel.appendChild(
    menuButton(end > start ? "Copy verses" : "Copy verse", async () => {
      const text = getVerseText(container, start, end);
      if (!text) return false;
      return copyToClipboard(withReference(text, ref) + "\n" + url);
    })
  );
  panel.appendChild(menuButton("Copy link", () => copyToClipboard(url)));

  const shareBtn = shareButton(ref, url, () => getVerseText(container, start, end));
  if (shareBtn) panel.appendChild(shareBtn);

  // Parts: only for a single verse. A range already spans blocks by nature, so
  // offering a part per block would bury the whole-range actions.
  const parts = start === end ? verseParts(container, start) : [];
  if (parts.length > 1) {
    const partsHeading = document.createElement("p");
    partsHeading.className = "lit-panel__subheading";
    partsHeading.id = "lit-parts-heading";
    partsHeading.textContent = "Or copy one part";
    panel.appendChild(partsHeading);

    const list = document.createElement("div");
    list.setAttribute("role", "group");
    list.setAttribute("aria-labelledby", partsHeading.id);

    for (const part of parts) {
      const partUrl = pageUrl() + "#" + part.id;
      const btn = menuButton(partLabel(part.plain), () =>
        copyToClipboard(withReference(part.text, ref) + "\n" + partUrl)
      );
      // The visible label is truncated; give assistive tech the full text.
      btn.setAttribute("aria-label", "Copy “" + part.plain + "”");
      list.appendChild(btn);
    }
    panel.appendChild(list);
  }

  const hint = document.createElement("p");
  hint.className = "lit-panel__hint";
  hint.textContent = "Tap another verse number to select a range.";
  panel.appendChild(hint);

  showPanel(sup, panel, {
    preferAbove: true,
    // Only keyboard activations restore focus to the verse number on close —
    // for pointer taps a focus() could scroll the page back to the verse.
    restoreFocus,
    onClose: () => {
      if (supportsHighlight) CSS.highlights.delete("lit-verse-select");
    },
    extra: { kind: "verse", anchorVerse, start, end },
  });
  // After showPanel: its closePanel() of a previous menu would otherwise
  // delete the selection highlight we just set.
  setSelectionHighlight(container, start, end);
  panel.focus({ preventScroll: true });
}

function handleVerseActivation(container, sup, { viaKeyboard = false } = {}) {
  const verse = parseInt(sup.textContent, 10);
  if (!Number.isFinite(verse)) return;

  const opts = { restoreFocus: viaKeyboard ? sup : null };

  // Menu already open: activating the selection's only verse closes it;
  // activating any other verse number extends the selection to a range.
  if (openPanel?.kind === "verse") {
    const { anchorVerse, start, end } = openPanel;
    if (start === end && verse === start) {
      closePanel();
      return;
    }
    openVerseMenu(
      container,
      sup,
      anchorVerse,
      Math.min(anchorVerse, verse),
      Math.max(anchorVerse, verse),
      opts
    );
    return;
  }

  openVerseMenu(container, sup, verse, verse, verse, opts);
}

function initVerseMenu(container) {
  // Verse numbers act as buttons (open the copy/share menu), so expose them
  // to the keyboard and accessibility tree. Enhancement-only, like the menu
  // itself: without JS they stay plain superscripts.
  container.querySelectorAll("sup.vn").forEach((sup) => {
    sup.setAttribute("role", "button");
    sup.setAttribute("tabindex", "0");
    sup.setAttribute("aria-label", "Verse " + (sup.textContent || "").trim());
    sup.setAttribute("aria-haspopup", "dialog");
  });

  container.addEventListener("click", (e) => {
    const sup = e.target.closest("sup.vn");
    if (!sup || !container.contains(sup)) return;
    e.stopPropagation();
    handleVerseActivation(container, sup);
  });

  container.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const sup = e.target.closest?.("sup.vn");
    if (!sup || !container.contains(sup)) return;
    e.preventDefault();
    e.stopPropagation();
    handleVerseActivation(container, sup, { viaKeyboard: true });
  });
}

/* ── 3. Footnote popovers ─────────────────────────────────────────────── */

function initFootnotePopovers(container) {
  container.querySelectorAll(".fn-ref a").forEach((a) => {
    a.setAttribute("aria-haspopup", "dialog");
  });

  container.addEventListener("click", (e) => {
    const a = e.target.closest(".fn-ref a");
    if (!a || !container.contains(a)) return;

    const noteId = (a.getAttribute("href") || "").replace("#", "");
    const note = document.getElementById(noteId);
    if (!note) return; // fall back to the default anchor jump

    e.preventDefault();
    e.stopPropagation();

    if (openPanel && openPanel.trigger === a) {
      closePanel();
      return;
    }

    const label = a.textContent.trim();

    const panel = document.createElement("div");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Footnote " + label);
    panel.tabIndex = -1;
    panel.classList.add("lit-panel--footnote");

    const header = document.createElement("div");
    header.className = "lit-panel__header";

    const heading = document.createElement("p");
    heading.className = "lit-panel__heading";
    heading.textContent = "Footnote " + label;
    header.appendChild(heading);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "lit-panel__close";
    closeBtn.setAttribute("aria-label", "Close footnote");
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", closePanel);
    header.appendChild(closeBtn);

    panel.appendChild(header);

    const body = document.createElement("div");
    body.className = "lit-panel__body";
    // The note's content wrapper is <div class="fn-body"> ([slug].astro —
    // a div because footnote HTML can contain block elements); "p" is the
    // pre-2026-07 markup, kept as a fallback.
    const content = note.querySelector(".fn-body, p")?.cloneNode(true);
    if (content) {
      content.querySelector(".footnote-backlink")?.remove();
      body.appendChild(content);
    }
    panel.appendChild(body);

    // Link through to the full footnotes section.
    const jump = document.createElement("a");
    jump.className = "lit-panel__jump";
    jump.href = "#" + noteId;
    jump.textContent = "See in footnotes ↓";
    jump.addEventListener("click", (ev) => {
      ev.preventDefault();
      // Don't restore focus to the ref — that would scroll back up and
      // fight the navigation to the footnotes section.
      if (openPanel) openPanel.restoreFocus = null;
      closePanel();
      history.pushState(null, "", "#" + noteId);
      note.scrollIntoView({ behavior: "smooth", block: "start" });
      note.setAttribute("tabindex", "-1");
      note.focus({ preventScroll: true });
    });
    panel.appendChild(jump);

    showPanel(a, panel, { restoreFocus: a });
    panel.focus({ preventScroll: true });
  });
}

/* ── 4. Selection sharing ─────────────────────────────────────────────── */

// Select any run of scripture text and a small panel offers Copy with
// reference / Share, for what the verse menu can't reach: a half-sentence, a
// phrase crossing two verses, part of a poetry quotation. The reference names
// the verses the selection touches in plain numbers ("John 3:16", never
// "16a" — the quoted words already show it's partial), and the link is the
// ordinary verse link.
//
// It always sits beside the selection, where the reader is looking; where
// exactly follows the input. A mouse selection gets the panel just above the
// text. A touch selection has to share that space with the phone's own
// Copy / Share bubble, which a page can't add to or move, so the panel takes
// the side the bubble isn't on (placeBesideTouchSelection). A bar pinned to
// the bottom edge was tried first and was easy to miss, and it covered any
// selection made near the bottom of the screen. Ordinary Copy is left alone:
// the reference is only ever added on request. The verse menu stays the
// keyboard route, since this panel answers a pointer gesture and never takes
// focus.

let lastPointerType = "mouse";
let pointerDown = false;
// The selection the panel was last shown for, so a dismissed panel (Escape,
// or closing itself after a copy) stays closed until the selection changes.
let shownKey = null;

// Word characters for snapping. An apostrophe or hyphen counts only between
// two of them ("don’t", "One-of-a-kind"), so a closing quote is never pulled
// into the selection.
const WORD_CHAR = /[\p{L}\p{M}\p{N}]/u;
const WORD_JOINER = /['’-]/;

function isWordCharAt(text, i) {
  const ch = text[i];
  if (!ch) return false;
  if (WORD_CHAR.test(ch)) return true;
  return (
    WORD_JOINER.test(ch) &&
    WORD_CHAR.test(text[i - 1] || "") &&
    WORD_CHAR.test(text[i + 1] || "")
  );
}

/**
 * Widen a range that starts or ends mid-word to take in the whole word. Phones
 * already select whole words; a mouse drag often doesn't. Within one text node
 * only — a word split across nodes is rare enough to leave as selected.
 */
function snapToWords(range) {
  const { startContainer: s, endContainer: e } = range;
  if (s.nodeType === Node.TEXT_NODE) {
    let i = range.startOffset;
    if (isWordCharAt(s.data, i - 1) && isWordCharAt(s.data, i)) {
      while (i > 0 && isWordCharAt(s.data, i - 1)) i--;
      range.setStart(s, i);
    }
  }
  if (e.nodeType === Node.TEXT_NODE) {
    let j = range.endOffset;
    if (isWordCharAt(e.data, j - 1) && isWordCharAt(e.data, j)) {
      while (j < e.data.length && isWordCharAt(e.data, j)) j++;
      range.setEnd(e, j);
    }
  }
}

/**
 * Move a boundary that sits inside a verse number or footnote letter out past
 * it. A range lying wholly inside one clones as bare digits, with no <sup>
 * left for blockText to strip, so a selected "16" would share as scripture.
 */
function excludeMarkers(range) {
  const markerAt = (node) =>
    (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement)?.closest(
      "sup.vn, sup.fn-ref"
    );
  const s = markerAt(range.startContainer);
  if (s) range.setStartAfter(s);
  const e = markerAt(range.endContainer);
  if (e) range.setEndBefore(e);
}

/**
 * What a selection would share, or null when it holds no scripture. Clamped
 * to the verse spans, so a selection running into a heading or the footnotes
 * shares only its scripture; snapped out to whole words; and joined by the
 * same joinPieces rule as the verse menu, so selecting whole verses copies
 * exactly what Copy verses does.
 */
function selectionShare(container, selection) {
  if (!selection || !selection.rangeCount || selection.isCollapsed) return null;
  const first = selection.getRangeAt(0);
  const last = selection.getRangeAt(selection.rangeCount - 1);
  const range = document.createRange();
  range.setStart(first.startContainer, first.startOffset);
  range.setEnd(last.endContainer, last.endOffset);
  if (!range.intersectsNode(container)) return null;
  excludeMarkers(range);
  snapToWords(range);

  const pieces = [];
  let extent = null; // the scripture actually shared, for placing the panel
  for (const span of container.querySelectorAll("[data-verse]")) {
    if (!range.intersectsNode(span)) continue;
    const part = document.createRange();
    part.selectNodeContents(span);
    if (part.compareBoundaryPoints(Range.START_TO_START, range) < 0) {
      part.setStart(range.startContainer, range.startOffset);
    }
    if (part.compareBoundaryPoints(Range.END_TO_END, range) > 0) {
      part.setEnd(range.endContainer, range.endOffset);
    }
    const holder = document.createElement("div");
    holder.append(part.cloneContents());
    const piece = spanPiece(span, cleanForShare(blockText(holder)));
    if (!piece.text) continue; // e.g. only a verse number was caught
    if (!extent) {
      extent = document.createRange();
      extent.setStart(part.startContainer, part.startOffset);
    }
    extent.setEnd(part.endContainer, part.endOffset);
    pieces.push(piece);
  }
  if (!pieces.length) return null;

  const text = joinPieces(pieces);
  const start = pieces[0].verse;
  const end = pieces[pieces.length - 1].verse;
  return { text, start, end, rect: extent.getBoundingClientRect(), key: start + "-" + end + ":" + text };
}

// Room the phone's own selection UI needs, which a page can't measure: the
// drag handle hanging below the last line, and the Copy / Share bubble, which
// the OS puts above the selection when there's room and below it otherwise.
const HANDLE_CLEARANCE = 28;
const OS_BUBBLE_CLEARANCE = 64;
const PANEL_EDGE = 12;

/**
 * Placement for a touch selection: beside it, where the reader is looking,
 * on whichever side the OS bubble isn't. Normally just below the selection;
 * below the bubble when a selection near the top pushes the bubble down; and
 * above the bubble when there's no room below. A selection filling the screen
 * leaves no clear side, so it falls back to the bottom edge.
 */
function placeBesideTouchSelection(rect) {
  return (el) => {
    el.style.maxWidth = window.innerWidth - 2 * PANEL_EDGE + "px";
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const viewH = window.innerHeight;
    const bubbleAbove = rect.top >= OS_BUBBLE_CLEARANCE;

    const below = rect.bottom + HANDLE_CLEARANCE + (bubbleAbove ? 0 : OS_BUBBLE_CLEARANCE);
    const above = rect.top - height - PANEL_EDGE - (bubbleAbove ? OS_BUBBLE_CLEARANCE : 0);
    let top;
    if (below + height <= viewH - PANEL_EDGE) top = below;
    else if (above >= PANEL_EDGE) top = above;
    else top = viewH - height - PANEL_EDGE;

    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(PANEL_EDGE, Math.min(left, window.innerWidth - width - PANEL_EDGE));
    return { left: window.scrollX + left, top: window.scrollY + top };
  };
}

function openSelectionPanel(share, { touch }) {
  const ref = formatRef(share.start, share.end);
  const url = getVerseUrl(share.start, share.end);

  const panel = document.createElement("div");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Share selected text from " + ref);
  panel.classList.add("lit-panel--menu", "lit-panel--selection");
  if (touch) panel.classList.add("lit-panel--touch");
  // Pressing a button would otherwise clear the selection (and move focus)
  // before the click lands.
  panel.addEventListener("mousedown", (e) => e.preventDefault());

  const heading = document.createElement("p");
  heading.className = "lit-panel__heading";
  heading.textContent = ref + " (LIT)";
  panel.appendChild(heading);

  // Once a button is pressed the panel finishes on its own ("Copied ✓", or
  // the share sheet), even though a tap on a phone clears the selection.
  const acting = () => {
    if (openPanel?.el === panel) openPanel.acting = true;
  };

  panel.appendChild(
    menuButton("Copy with reference", () => {
      acting();
      return copyToClipboard(withReference(share.text, ref) + "\n" + url);
    })
  );
  const shareBtn = shareButton(ref, url, () => {
    acting();
    return share.text;
  });
  if (shareBtn) panel.appendChild(shareBtn);

  showPanel({ getBoundingClientRect: () => share.rect }, panel, {
    preferAbove: true,
    place: touch ? placeBesideTouchSelection(share.rect) : null,
    extra: { kind: "selection" },
  });
}

function initSelectionShare(container) {
  let timer = null;
  const settle = () => {
    clearTimeout(timer);
    timer = setTimeout(update, 200);
  };

  document.addEventListener(
    "pointerdown",
    (e) => {
      lastPointerType = e.pointerType || "mouse";
      pointerDown = true;
      // A new gesture may select the same words again; let it show the panel.
      if (!openPanel?.el.contains(e.target)) shownKey = null;
    },
    true
  );
  const release = () => {
    pointerDown = false;
    settle();
  };
  document.addEventListener("pointerup", release, true);
  document.addEventListener("pointercancel", release, true);
  document.addEventListener("selectionchange", settle);

  function update() {
    // Mid-drag with a mouse: wait for the button to come up rather than
    // chasing the selection as it grows.
    if (pointerDown && lastPointerType === "mouse") return;

    const share = selectionShare(container, document.getSelection());
    const current = openPanel?.kind === "selection" ? openPanel : null;
    if (!share) {
      if (current && !current.acting) closePanel();
      shownKey = null;
      return;
    }
    if (share.key === shownKey) return;
    shownKey = share.key;
    openSelectionPanel(share, { touch: lastPointerType !== "mouse" });
  }
}

/* ── Kickoff (after all module-level declarations) ────────────────────── */

const container = document.querySelector(".chapter-paragraphs");
if (container) init(container);
