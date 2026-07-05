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

function clearHashHighlight() {
  if (!supportsHighlight) return;
  if (!CSS.highlights.has("lit-verse-range")) return;
  CSS.highlights.delete("lit-verse-range");
  removeClearChip();
  if (/^#v\d+(?:-\d+)?$/.test(window.location.hash)) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
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

function initVerseHighlight(container) {
  if (!supportsHighlight) return;

  function applyFromHash() {
    CSS.highlights.delete("lit-verse-range");
    removeClearChip();
    const m = window.location.hash.match(/^#v(\d+)(?:-(\d+))?$/);
    if (!m) return;
    const start = Number(m[1]);
    const end = m[2] ? Math.max(start, Number(m[2])) : start;
    const ranges = verseRanges(container, start, end);
    if (!ranges.length) return;
    CSS.highlights.set("lit-verse-range", new Highlight(...ranges));
    showClearChip(formatRef(start, end));
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

function getVerseUrl(start, end) {
  const base = window.location.origin + window.location.pathname.replace(/\/$/, "");
  return base + "#v" + start + (end > start ? "-" + end : "");
}

/**
 * Extract the plain text of one verse from its data-verse span(s),
 * skipping verse-number markers and footnote refs. Spans in different
 * blocks (poetry lines, paragraph breaks) join with a space.
 */
function getSingleVerseText(container, verse) {
  const parts = verseSpans(container, verse).map((span) => {
    const clone = span.cloneNode(true);
    clone.querySelectorAll("sup.fn-ref, sup.vn").forEach((s) => s.remove());
    return clone.textContent;
  });

  return parts
    .join(" ")
    .replace(/[​‌‍⁠﻿]/g, "") // zero-width characters
    .replace(/\s+/g, " ")
    .trim();
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

function openVerseMenu(container, sup, anchorVerse, start, end) {
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

  const hint = document.createElement("p");
  hint.className = "lit-panel__hint";
  hint.textContent = "Tap another verse number to select a range.";
  panel.appendChild(hint);

  showPanel(sup, panel, {
    preferAbove: true,
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

function initVerseMenu(container) {
  container.addEventListener("click", (e) => {
    const sup = e.target.closest("sup.vn");
    if (!sup || !container.contains(sup)) return;

    const verse = parseInt(sup.textContent, 10);
    if (!Number.isFinite(verse)) return;
    e.stopPropagation();

    // Menu already open: tapping the selection's only verse closes it;
    // tapping any other verse number extends the selection to a range.
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
        Math.max(anchorVerse, verse)
      );
      return;
    }

    openVerseMenu(container, sup, verse, verse, verse);
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
    const content = note.querySelector("p")?.cloneNode(true);
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
