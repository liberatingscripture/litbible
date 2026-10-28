// src/scripts/desk/lit-pane.js
//
// The LIT pane on /desk (STUDY-DESK.md, D9; "Order of work", 3e): Study
// View's text, scrolling through the whole New Testament, Matthew 1 to
// Revelation 22, with no setting for a chapter or a book (BVJ, 2026-10-18,
// "Phase 3a's answers", 5).
//
// - **Study View's own text, a chapter at a time.** Each chapter's built page
//   is fetched (chapter-page.js, shared with the other panes) as the reader
//   nears it, and its paragraphs are taken as they are, ids aside
//   (src/lib/desk-lit-text.mjs), so the text is Study View's character for
//   character and a mark's anchor is measured against the same words
//   (test/desk-anchor-dom.test.js sweeps it).
// - **A chapter loading above doesn't move the text being read**: the line
//   at the reading line is measured before and put back after, as
//   keepReadingPlace does for the window (keep-reading-place.js). The
//   browser's own scroll anchoring is off here (desk.css), or the two would
//   both correct. **Nor does a new size** (BA54): a window or a split line
//   that rewraps every chapter above puts the verse at the reading line back
//   where it was, from a note of it taken whenever the pane settles.
// - **Drafts are a stub**: a run of drafts in one book is one, as in Read
//   View (src/lib/desk-corpus.mjs), and a passage in it lands on the stub.
// - **Popovers know their chapter**: a footnote letter opens its own
//   chapter's note, named "John 3:16, footnote a", since letters start again
//   every chapter; key terms are underlined per chapter (term-lens.js's
//   attachTermLens); scripture references in a note preview as they do
//   anywhere (ref-preview.js).
// - **Where the reader is** is the verse at the reading line, a quarter of
//   the way down, told to `onPlace` only when the reader's own scrolling
//   moved it (the Greek pane's rule), so a pane sent somewhere never chases
//   the panes that follow it. A chapter in a stub is told only once the
//   reader stops on it (BA64).
// - **The verse menu and the selection panel are Study View's own** (3f;
//   chapter-tools.js's attachVerseTools), with the pane as one more view:
//   each chapter names its own reference and link, and "Copy with
//   footnotes" reads the notes from the chapter's fetched page. Their "My
//   Notebook" row comes from actions.js, and "Add to sheet" from
//   sheet-pane.js, which read `book`, `chapter` and `textFor` from the
//   panel's detail.
//
// - **The reader's marks** (3g): the pane puts its text on the desk's list
//   (page.js, addDeskText), and the reader's highlights are drawn on it and
//   its verse numbers named for them (highlights.js, verse-labels.js), from
//   every pane showing a chapter. A footnote's popover offers Pin through
//   the same `lit:footnote-actions` event Study View's does (pins.js).
//   Nothing of the reader's sits beside the text (BVJ, 2026-10-19): notes
//   and bookmarks are in My Notes, which follows this pane.

import { corpusUnits, draftStubText, unitHeading, unitIndex } from "../../lib/desk-corpus.mjs";
import { litPrefix, prepareLitBlocks } from "../../lib/desk-lit-text.mjs";
import { checkPassage, passageLabel, sameChapter } from "../../lib/desk-passage.mjs";
import { pageAnchorText } from "../../lib/desk-anchor-dom.mjs";
import { bookKeyToLabel } from "../../data/books.js";
import { attachVerseTools } from "../chapter-tools.js";
import { closePanel, currentPanel, showPanel } from "../lit-panel.js";
import { footnotePanel } from "../panel-pieces.js";
import "../ref-preview.js";
import { attachTermLens } from "../term-lens.js";
import { chapterHref, loadChapterPage } from "./chapter-page.js";
import { addDeskText } from "./page.js";
import { createPassageBar } from "./passage-bar.js";

/** How far down the pane the reading line sits. */
const LINE = 0.25;
/** How much text to keep ready beyond each edge, in pane heights. */
const AHEAD = 1.5;
/** How long the reading line rests in a stub before its chapter is told, in ms. */
const STUB_SETTLE = 300;

function make(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/**
 * @param {{ paneId: string, start: object, drafts: Record<string, number[]>,
 *   onPlace: (passage: object) => void }} options
 *   `start` is the passage it opens at; `drafts` the draft chapters of each
 *   book (desk.astro writes them at build); `onPlace` hears where the
 *   reader is, and every passage the picker or the reader asks for.
 * @returns {{ el: HTMLElement, goTo: (passage: object) => void,
 *   keep: () => () => void, destroy: () => void }}
 */
export function createLitPane({ paneId, start, drafts, onPlace }) {
  const units = corpusUnits(drafts);
  const el = make("div", "desk-lit");
  const bar = createPassageBar({
    id: paneId,
    set: (p) => {
      goTo(p, { force: true });
      tell(p);
    },
  });
  const scroller = make("div", "desk-lit__scroll");
  scroller.tabIndex = 0;
  scroller.setAttribute("role", "region");
  scroller.setAttribute("aria-label", "The LIT text");
  const text = make("div", "desk-lit__text");
  scroller.append(text);
  el.append(bar.el, scroller);

  const sections = new Map(); // unit index → its section
  let lo = 0; // the first unit on the page
  let hi = -1; // the last
  let seq = 0; // bumped whenever the page is cleared, so late loads are dropped
  let loadingUp = false;
  let loadingDown = false;
  let stalled = false; // a chapter below failed to load; Try again clears it
  let stalledUp = false; // a chapter above failed to load; Try again clears it
  let told = null; // the passage last told to onPlace (or gone to)
  let stubWait = 0; // a place in a stub, told once the reader stops there (BA64)
  let readerMoved = false;
  let destroyed = false;
  const lenses = [];
  const offDesk = addDeskText(text);

  // ---- the verse menu and the selection panel (3f) ----

  // A chapter's name in this pane, as the verse tools pass it around.
  const keyOf = (bookKey, chapter) => `${bookKey} ${chapter}`;
  const parseKey = (key) => {
    const [bookKey, n] = String(key).split(" ");
    return { bookKey, chapter: Number(n) };
  };
  const sectionFor = (key) => text.querySelector(`.desk-lit__chapter[data-key="${key}"]`);
  const studyLink = (key) => {
    const { bookKey, chapter } = parseKey(key);
    return `${window.location.origin}/${bookKey}-${chapter}`;
  };
  const tools = attachVerseTools({
    name: "desk",
    container: text,
    chapterOf: (node) => node.closest?.(".desk-lit__chapter")?.dataset.key ?? null,
    spans: (key, verse) => Array.from(sectionFor(key)?.querySelectorAll(`[data-verse="${verse}"]`) ?? []),
    ref: (key, start, end) => {
      const { bookKey, chapter } = parseKey(key);
      return `${bookKeyToLabel(bookKey)} ${chapter}:${start}${end > start ? "–" + end : ""}`;
    },
    // Links go to the verse in Study View, as Read View's do.
    url: (key, start, end) => `${studyLink(key)}#v${start}${end > start ? "-" + end : ""}`,
    // A block's id here carries the pane's prefix; its link is the page's own.
    partUrl: (key, id) => {
      const { bookKey, chapter } = parseKey(key);
      const prefix = litPrefix(paneId, bookKey, chapter);
      return `${studyLink(key)}#${id.startsWith(prefix) ? id.slice(prefix.length) : id}`;
    },
    scope: (key) => {
      const { bookKey, chapter } = parseKey(key);
      return loadChapterPage(bookKey, chapter)
        .then((s) => (s.textBox ? { container: s.textBox, root: s.doc } : null))
        .catch(() => null);
    },
    detail: (key) => {
      const { bookKey, chapter } = parseKey(key);
      return {
        book: bookKey,
        chapter,
        paneId,
        // The chapter's anchor text, read fresh off the pane (it is Study
        // View's, character for character).
        textFor: () => {
          const box = sectionFor(key)?.querySelector(".chapter-paragraphs");
          return box ? pageAnchorText(box.children) : null;
        },
      };
    },
  });

  function tell(p) {
    told = p;
    bar.update(p);
    onPlace(p);
  }

  // ---- drawing a unit ----

  function stub(u, i) {
    const section = make("section", "desk-lit__chapter desk-lit__chapter--draft");
    section.dataset.unit = String(i);
    const h = make("h3", "desk-lit__heading", unitHeading(u));
    h.id = `deskLit-${paneId}-${i}`;
    section.setAttribute("aria-labelledby", h.id);
    section.append(h, make("p", "desk-lit__stub", `${draftStubText(u)} Its Greek is ready in a Greek pane.`));
    return section;
  }

  function failed(u, i, retry) {
    const section = make("section", "desk-lit__chapter desk-lit__chapter--failed");
    section.dataset.unit = String(i);
    section.append(make("h3", "desk-lit__heading", unitHeading(u)));
    const box = make("div", "desk-dp__status");
    box.setAttribute("role", "status");
    box.append(make("p", null, "This chapter couldn’t be loaded."));
    const b = make("button", "desk-dp__retry", "Try again");
    b.type = "button";
    b.addEventListener("click", retry);
    box.append(b);
    section.append(box);
    return section;
  }

  /** A unit as a section, fetched when it is a chapter. Never rejects. */
  async function render(i) {
    const u = units[i];
    if (u.draft) return stub(u, i);
    const chapter = u.chapters[0];
    let source;
    try {
      source = await loadChapterPage(u.bookKey, chapter);
    } catch (_) {
      return null;
    }
    if (source.draft || !source.textBox) return stub({ ...u, draft: true }, i);
    const section = make("section", "desk-lit__chapter");
    section.dataset.unit = String(i);
    section.dataset.book = u.bookKey;
    section.dataset.chapter = String(chapter);
    section.dataset.key = keyOf(u.bookKey, chapter);
    const h = make("h3", "desk-lit__heading");
    h.id = `deskLit-${paneId}-${i}`;
    const a = make("a", null, unitHeading(u));
    a.href = chapterHref(u.bookKey, chapter);
    a.title = "Open in Study View";
    h.append(a);
    section.setAttribute("aria-labelledby", h.id);
    const box = make("div", "chapter-paragraphs");
    const blocks = Array.from(source.textBox.children, (b) => document.importNode(b, true));
    prepareLitBlocks(blocks, litPrefix(paneId, u.bookKey, chapter));
    box.append(...blocks);
    tools.enableNumbers(box);
    section.append(h, box);
    if (source.termData) lenses.push(attachTermLens(box, source.termData));
    return section;
  }

  // ---- the reading line, and holding it ----

  const line = () => {
    const r = scroller.getBoundingClientRect();
    return r.top + r.height * LINE;
  };

  /** Room below the text, so its last line can reach the reading line (BA57). */
  function sizeBelow() {
    const h = scroller.clientHeight;
    if (h) text.style.setProperty("--desk-lit-below", `${Math.ceil(h * (1 - LINE))}px`);
  }

  /** The section the reading line is in, or the nearest one. */
  function sectionAtLine() {
    const y = line();
    let best = null;
    for (const s of text.children) {
      const r = s.getBoundingClientRect();
      if (r.top <= y) best = s;
      else break;
    }
    return best ?? text.firstElementChild;
  }

  /** Run `change` (which adds above), then put the text back where it was. */
  function hold(change) {
    const ref = sectionAtLine();
    const before = ref?.getBoundingClientRect().top;
    change();
    if (!ref?.isConnected || before === undefined) return;
    const delta = ref.getBoundingClientRect().top - before;
    if (Math.abs(delta) >= 1) scroller.scrollTop += delta;
  }

  /** Where the reader is: the passage at the reading line. */
  function placeNow() {
    const s = sectionAtLine();
    if (!s) return null;
    const u = units[Number(s.dataset.unit)];
    if (!u) return null;
    if (u.draft) {
      // The chapter of the run the line has reached, by how far through it is.
      const r = s.getBoundingClientRect();
      const share = Math.min(0.999, Math.max(0, (line() - r.top) / Math.max(1, r.height)));
      return { bookKey: u.bookKey, chapter: u.chapters[Math.floor(share * u.chapters.length)], verse: null };
    }
    const y = line();
    let verse = null;
    for (const m of s.querySelectorAll("sup.vn")) {
      if (m.getBoundingClientRect().top > y) break;
      const n = /v(\d+)$/.exec(m.id)?.[1];
      if (n) verse = Number(n);
    }
    if (verse == null) verse = Number(/v(\d+)$/.exec(s.querySelector("sup.vn")?.id ?? "")?.[1]) || null;
    return { bookKey: u.bookKey, chapter: u.chapters[0], verse };
  }

  /**
   * Note where the text is, before the page takes the pane off it to redraw
   * the panes (which resets its scrolling, BA51), and return what puts it
   * back: the verse number at or above the reading line goes back the same
   * distance from it, however a new width has rewrapped the lines. The move
   * isn't the reader's scrolling, so nothing is told.
   */
  function keep() {
    const s = sectionAtLine();
    if (!s || !scroller.clientHeight) return () => {};
    const y = line();
    let mark = s;
    for (const m of s.querySelectorAll("sup.vn")) {
      if (m.getBoundingClientRect().top > y) break;
      mark = m;
    }
    const offset = mark.getBoundingClientRect().top - y;
    return () => {
      if (destroyed || !mark.isConnected || !scroller.clientHeight) return;
      readerMoved = false;
      const delta = mark.getBoundingClientRect().top - line() - offset;
      if (Math.abs(delta) >= 1) scroller.scrollTop += delta;
    };
  }

  // The verse at the reading line, noted while the pane is settled, and the
  // size it was noted at. A new size rewraps the text above it, so the
  // ResizeObserver puts it back (BA54). A note is taken only at the size it
  // was last noted at, since a scroll after a resize but before the
  // observer runs would note the verse the rewrap left there.
  let held = null;
  const size = () => [scroller.clientWidth, scroller.clientHeight];
  function note() {
    const [w, h] = size();
    held = { back: keep(), w, h };
  }
  const resized = () => !held || held.w !== scroller.clientWidth || held.h !== scroller.clientHeight;

  // ---- loading as the reader nears an edge ----

  async function fill() {
    if (destroyed || hi < lo) return;
    const n = seq;
    const h = scroller.clientHeight || 400;
    const below = scroller.scrollHeight - scroller.scrollTop - h;
    if (!loadingDown && !stalled && below < h * AHEAD && hi < units.length - 1) {
      loadingDown = true;
      const i = hi + 1;
      const section = await render(i);
      loadingDown = false;
      if (n !== seq) return;
      if (!section) {
        // Shown at the foot, where the reader is headed; Try again redraws it.
        stalled = true;
        const f = failed(units[i], i, () => { f.remove(); stalled = false; fill(); });
        text.append(f);
        return;
      }
      text.append(section);
      sections.set(i, section);
      hi = i;
      fill();
      return;
    }
    if (!loadingUp && !stalledUp && scroller.scrollTop < h * AHEAD && lo > 0) {
      loadingUp = true;
      const i = lo - 1;
      const section = await render(i);
      loadingUp = false;
      if (n !== seq) return;
      if (!section) {
        // Shown at the top, as the case below is at the foot, and held so the
        // text being read doesn't move; Try again loads it again.
        stalledUp = true;
        const f = failed(units[i], i, () => { hold(() => f.remove()); stalledUp = false; fill(); });
        hold(() => text.prepend(f));
        return;
      }
      hold(() => text.prepend(section));
      sections.set(i, section);
      lo = i;
      if (!resized()) note();
      fill();
    }
  }

  // ---- going to a passage ----

  /** The element a passage points at in its section. */
  function targetIn(section, p) {
    if (!p.verse || section.classList.contains("desk-lit__chapter--draft")) return section;
    const prefix = litPrefix(paneId, p.bookKey, p.chapter);
    return section.querySelector(`[id="${prefix}v${p.verse}"]`)?.closest(".vglue, sup") ?? section;
  }

  function scrollTo(section, p) {
    const target = targetIn(section, p);
    const top = target.getBoundingClientRect().top;
    const box = scroller.getBoundingClientRect();
    // A verse sits just above the reading line; a chapter starts at the top.
    const want = target === section ? box.top + 4 : line() - 8;
    scroller.scrollTop += top - want;
  }

  /**
   * Show a passage. Within the chapters on the page it scrolls; elsewhere the
   * page starts again at that chapter and fills in around it.
   */
  async function goTo(passage, { force = false } = {}) {
    const p = checkPassage(passage);
    if (!p || destroyed) return;
    if (!force && told && sameChapter(told, p) && told.verse === p.verse) return;
    told = p;
    readerMoved = false;
    // A stub's place still waiting is the reader's old one: going elsewhere drops it.
    clearTimeout(stubWait);
    stubWait = 0;
    bar.update(p);
    const i = unitIndex(units, p.bookKey, p.chapter);
    if (i < 0) return;
    const there = sections.get(i);
    if (there?.isConnected) {
      scrollTo(there, p);
      if (!resized()) note();
      fill();
      return;
    }
    const n = ++seq;
    loadingUp = loadingDown = stalled = stalledUp = false;
    // Nothing is on the page until the chapter comes, so nothing fills in
    // around the old place meanwhile.
    lo = 0;
    hi = -1;
    sections.clear();
    for (const l of lenses.splice(0)) l?.destroy?.();
    text.replaceChildren(make("p", "desk-dp__status", `Loading ${passageLabel({ ...p, verse: null })}…`));
    const section = await render(i);
    if (n !== seq) return;
    if (!section) {
      text.replaceChildren(failed(units[i], i, () => goTo(p, { force: true })));
      return;
    }
    text.replaceChildren(section);
    sections.set(i, section);
    lo = hi = i;
    scrollTo(section, p);
    note();
    fill();
  }

  // ---- the reader's scrolling ----

  // Only the reader's own scrolling moves the place (the Greek pane's rule).
  const byReader = () => { readerMoved = true; };
  for (const type of ["wheel", "pointerdown", "touchstart", "keydown"]) {
    scroller.addEventListener(type, byReader, { passive: true });
  }

  let frame = 0;
  scroller.addEventListener("scroll", () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!resized()) note();
      fill();
      if (!readerMoved) return;
      clearTimeout(stubWait);
      stubWait = 0;
      const p = placeNow();
      if (!p || (told && sameChapter(told, p) && told.verse === p.verse)) return;
      // Scrolling past a stub runs through its chapters by the frame (Acts
      // has 28), and each would send the following panes to fetch one, so a
      // chapter there is told only once the reader stops on it (BA64).
      if (units[Number(sectionAtLine()?.dataset.unit)]?.draft) {
        stubWait = setTimeout(() => { stubWait = 0; tell(p); }, STUB_SETTLE);
        return;
      }
      tell(p);
    });
  }, { passive: true });

  // ---- footnote letters ----

  scroller.addEventListener("click", async (e) => {
    const a = e.target.closest?.(".fn-ref a[data-fn]");
    if (!a || !scroller.contains(a)) return;
    e.preventDefault();
    e.stopPropagation();
    if (currentPanel()?.trigger === a) {
      closePanel();
      return;
    }
    const section = a.closest(".desk-lit__chapter");
    const bookKey = section?.dataset.book;
    const chapter = Number(section?.dataset.chapter);
    if (!bookKey || !chapter) return;
    let source;
    try {
      source = await loadChapterPage(bookKey, chapter);
    } catch (_) {
      return;
    }
    const verse = Number(a.closest("[data-verse]")?.dataset.verse) || null;
    const letter = a.textContent.trim();
    const where = passageLabel({ bookKey, chapter, verse });
    const panel = footnotePanel({
      title: `${where}, footnote ${letter}`,
      label: `Footnote ${letter}, ${where}`,
      body: source.footnoteBody(a.dataset.fn),
    });
    // The same offer Study View's popover makes, naming the chapter since a
    // pane holds many; only pins.js listens (3g), and only with a notebook.
    document.dispatchEvent(
      new CustomEvent("lit:footnote-actions", { detail: { panel, note: { id: a.dataset.fn }, ref: a, book: bookKey, chapter } }),
    );
    showPanel(a, panel, { restoreFocus: a });
    panel.focus({ preventScroll: true });
  });

  const ro = new ResizeObserver(() => {
    sizeBelow();
    if (!scroller.clientHeight) return; // off the page for a moment (a redraw)
    // Not the reader's scrolling, so nothing is told (keep's rule).
    if (held && resized()) held.back();
    note();
    fill();
  });
  ro.observe(scroller);

  queueMicrotask(() => goTo(start, { force: true }));

  return {
    el,
    goTo,
    keep,
    destroy() {
      destroyed = true;
      seq++;
      ro.disconnect();
      if (frame) cancelAnimationFrame(frame);
      clearTimeout(stubWait);
      for (const l of lenses.splice(0)) l?.destroy?.();
      tools.destroy();
      offDesk();
      if (currentPanel()?.trigger instanceof Node && el.contains(currentPanel().trigger)) closePanel();
    },
  };
}
