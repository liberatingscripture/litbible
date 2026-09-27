// src/scripts/ref-preview.js
//
// Scripture reference previews. Hovering a reference link with a mouse, or
// tapping one on a touch screen, shows the verses in a panel with a link
// through to the chapter. Progressive enhancement: without JS, or from the
// keyboard, the link simply goes to the verse.
//
//   mouse   hover ~350ms opens; the panel stays while the pointer is over the
//           link or the panel; it never takes focus; a click navigates as it
//           always did
//   touch   the first tap opens the panel as a dialog (a bottom sheet on a
//           phone) instead of navigating; its "Open …" link navigates
//   keys    Enter follows the link; focus alone opens nothing
//
// Which links: the ones the render-time linker made (a.sref, from
// src/lib/scripture-refs.mjs, plus the glossary's "Where it appears" lists) and
// hand-written scripture links in an article body. Chapter navigation, the
// passage picker and the like are never previewed.
//
// Text comes from public/search/chapters/<book>-<chapter>.json (written by
// build-verse-index.mjs; drafts have none), fetched once per chapter.

import { BOOKS, bookKeyToLabel } from "../data/books.js";
import { showPanel, closePanel, currentPanel } from "./lit-panel.js";

const SELECTOR = "a.sref, .article__body a[href]";
const HREF_RE = /^\/([0-9a-z]+)-(\d+)\/?(?:#v(\d+)(?:-(\d+))?)?$/;
const MAX_VERSES = 6;
const OPEN_DELAY = 350;
const CLOSE_DELAY = 250;

/** { key, chapter, verse, end } for a scripture link, or null. */
function parseRef(a) {
  const href = a.getAttribute("href") || "";
  const m = href.match(HREF_RE);
  if (!m || !(m[1] in BOOKS)) return null;
  const chapter = Number(m[2]);
  if (chapter < 1 || chapter > BOOKS[m[1]]) return null;
  return {
    key: m[1],
    chapter,
    verse: m[3] ? Number(m[3]) : null,
    end: m[4] ? Number(m[4]) : null,
    href,
  };
}

function refLabel({ key, chapter, verse, end }) {
  let label = `${bookKeyToLabel(key)} ${chapter}`;
  if (verse) label += `:${verse}`;
  if (verse && end && end > verse) label += `–${end}`;
  return label;
}

const chapterCache = new Map();

function loadChapter(key, chapter) {
  const id = `${key}-${chapter}`;
  if (!chapterCache.has(id)) {
    chapterCache.set(
      id,
      fetch(`/search/chapters/${id}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
    );
  }
  return chapterCache.get(id);
}

function buildPanel(ref, draft) {
  const label = refLabel(ref);
  const panel = document.createElement("div");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Preview of " + label);
  panel.tabIndex = -1;
  panel.classList.add("lit-panel--footnote", "lit-panel--preview");

  const header = document.createElement("div");
  header.className = "lit-panel__header";
  const heading = document.createElement("p");
  heading.className = "lit-panel__heading";
  heading.textContent = label;
  header.appendChild(heading);
  const close = document.createElement("button");
  close.type = "button";
  close.className = "lit-panel__close";
  close.setAttribute("aria-label", "Close preview");
  close.textContent = "×";
  close.addEventListener("click", closePanel);
  header.appendChild(close);
  panel.appendChild(header);

  const body = document.createElement("div");
  body.className = "lit-panel__body";
  const text = document.createElement("p");
  text.className = "ref-preview__text";
  text.textContent = draft ? "" : "Loading…";
  body.appendChild(text);
  panel.appendChild(body);

  const chapterName = `${bookKeyToLabel(ref.key)} ${ref.chapter}`;
  const open = document.createElement("a");
  open.className = "lit-panel__jump";
  open.href = ref.href;
  open.textContent = `Open ${chapterName} →`;
  panel.appendChild(open);

  const setUnavailable = () => {
    text.textContent = `${chapterName} is still being translated.`;
  };

  if (draft) {
    setUnavailable();
  } else {
    loadChapter(ref.key, ref.chapter).then((verses) => {
      if (!Array.isArray(verses)) return setUnavailable();
      const first = ref.verse ?? 1;
      const last = Math.min(
        ref.verse ? ref.end ?? ref.verse : 3,
        first + MAX_VERSES - 1,
        verses.length
      );
      text.textContent = "";
      let shown = 0;
      for (let v = first; v <= last; v++) {
        const t = verses[v - 1];
        if (!t) continue;
        if (shown) text.append(" ");
        const n = document.createElement("sup");
        n.className = "ref-preview__vn";
        n.textContent = String(v);
        text.append(n, " " + t);
        shown++;
      }
      const wanted = ref.verse ? ref.end ?? ref.verse : verses.length;
      if (last < wanted) text.append(" …");
      if (!shown) setUnavailable();
    });
  }
  return panel;
}

/* ── Opening ────────────────────────────────────────────────────────── */

let hoverTimer = 0;
let closeTimer = 0;

function openPreview(a, { hover }) {
  const ref = parseRef(a);
  if (!ref) return;
  const panel = buildPanel(ref, a.hasAttribute("data-draft"));
  showPanel(a, panel, {
    restoreFocus: hover ? null : a,
    extra: { kind: "preview", hover },
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
    if (p?.kind === "preview" && p.hover) closePanel();
  }, CLOSE_DELAY);
}

function previewLink(target) {
  const a = target?.closest?.(SELECTOR);
  return a && parseRef(a) ? a : null;
}

// Mouse hover. A panel someone opened on purpose (a verse menu, a footnote,
// a tapped preview) is never replaced by one that merely passed under the
// pointer.
document.addEventListener("pointerover", (e) => {
  if (e.pointerType !== "mouse") return;
  const a = previewLink(e.target);
  if (!a) return;
  clearTimeout(closeTimer);
  const p = currentPanel();
  if (p?.trigger === a) return;
  if (p && !(p.kind === "preview" && p.hover)) return;
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => openPreview(a, { hover: true }), OPEN_DELAY);
});

document.addEventListener("pointerout", (e) => {
  if (e.pointerType !== "mouse") return;
  const a = previewLink(e.target);
  if (!a || a.contains(e.relatedTarget)) return;
  clearTimeout(hoverTimer);
  if (currentPanel()?.trigger === a) scheduleClose();
});

// Touch: the first tap previews instead of navigating. The pointer type is
// read from the pointerdown that precedes the click, since a click event
// doesn't carry one everywhere.
let lastPointerType = "mouse";
document.addEventListener(
  "pointerdown",
  (e) => {
    lastPointerType = e.pointerType;
  },
  true
);

document.addEventListener("click", (e) => {
  if (lastPointerType === "mouse" || e.detail === 0) return; // mouse or keyboard
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = previewLink(e.target);
  if (!a) return;
  const p = currentPanel();
  if (p?.kind === "preview" && p.trigger === a) {
    closePanel();
  } else {
    openPreview(a, { hover: false });
  }
  e.preventDefault();
  e.stopPropagation();
});
