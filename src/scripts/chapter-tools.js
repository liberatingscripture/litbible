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
//
// A verse that spans blocks (a quotation set as a block quote, a mid-verse
// speaker change) can also be shared one PART at a time — see "parts" below.

import { stripBracketMarkers } from "../lib/bracket-markers.mjs";

function init(container) {
  initVerseHighlight(container);
  initVerseMenu(container);
  initFootnotePopovers(container);
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
 * small screens). Returns the panel element.
 */
function showPanel(trigger, el, { restoreFocus = null, onClose = null, extra = null, preferAbove = false } = {}) {
  closePanel();
  el.classList.add("lit-panel");

  if (isSmallScreen()) {
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
    const lines = spans.map((span) => cleanForShare(blockText(span))).filter(Boolean);
    if (!lines.length) continue;
    // A quotation set as poetry keeps its line breaks when shared — the line
    // structure is part of what is being quoted. Prose spans inside one block
    // are just wrapped text, so they join with a space. (The whole-verse
    // "Copy verse" above still space-joins throughout; see FIXLIST.)
    const text = lines.join(block.tagName === "BLOCKQUOTE" ? "\n" : " ");
    parts.push({ id: block.id, text, plain: lines.join(" ") });
  }
  return parts;
}

/** A short preview of a part, for its menu button. */
function partLabel(text) {
  const MAX = 34;
  if (text.length <= MAX) return text;
  // Trim back to a word boundary so the preview doesn't end mid-word.
  return text.slice(0, MAX).replace(/\s+\S*$/, "") + "…";
}

/** Plain text of one element, minus verse numbers and footnote letters. */
function blockText(el) {
  const clone = el.cloneNode(true);
  clone.querySelectorAll("sup.fn-ref, sup.vn").forEach((s) => s.remove());
  return clone.textContent;
}

/** Tidy extracted text for the clipboard / share sheet. */
function cleanForShare(text) {
  // Bracket markers are reader-facing on the page but junk once the text is
  // lifted off it — strip BEFORE collapsing, per src/lib/bracket-markers.mjs.
  return stripBracketMarkers(text)
    .replace(/[​‌‍⁠﻿]/g, "") // zero-width characters
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract the plain text of one verse from its data-verse span(s),
 * skipping verse-number markers and footnote refs. Spans in different
 * blocks (poetry lines, paragraph breaks) join with a space.
 */
function getSingleVerseText(container, verse) {
  return cleanForShare(verseSpans(container, verse).map(blockText).join(" "));
}

/**
 * Text for a verse range. Multi-verse selections include the verse number
 * before each verse after the first, e.g.:
 *   "…agelong life. 17 God did not send… 18 The one who…"
 */
function getVerseText(container, start, end) {
  const parts = [];
  for (let v = start; v <= end; v++) {
    const text = getSingleVerseText(container, v);
    if (!text) continue; // known SBLGNT omissions leave gaps
    parts.push(parts.length === 0 ? text : v + " " + text);
  }
  return parts.join(" ");
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
      // No added quotation marks — verses containing dialogue would
      // otherwise produce nested double quotes; attribution carries it.
      return copyToClipboard(text + "\n— " + ref + " (LIT)\n" + url);
    })
  );
  panel.appendChild(menuButton("Copy link", () => copyToClipboard(url)));

  if (navigator.share) {
    const shareBtn = document.createElement("button");
    shareBtn.type = "button";
    shareBtn.className = "lit-panel__btn";
    shareBtn.textContent = "Share…";
    shareBtn.addEventListener("click", async () => {
      const text = getVerseText(container, start, end);
      try {
        await navigator.share({
          title: ref + " (LIT)",
          text: text ? text + "\n— " + ref + " (LIT)" : ref + " (LIT)",
          url,
        });
        closePanel();
      } catch {
        /* user cancelled the share sheet */
      }
    });
    panel.appendChild(shareBtn);
  }

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
        copyToClipboard(part.text + "\n— " + ref + " (LIT)\n" + partUrl)
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

/* ── Kickoff (after all module-level declarations) ────────────────────── */

const container = document.querySelector(".chapter-paragraphs");
if (container) init(container);
