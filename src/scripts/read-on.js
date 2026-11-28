// src/scripts/read-on.js
//
// The reading page reads on (SITE-FEATHERBOA.md, "A whole book"; WB-01 to
// WB-12): a published chapter's page loads the next chapter below as the
// reader nears its end, and the one before above when they scroll up, so a
// book reads straight through on one page.
//
// - Each chapter comes from its own built page, fetched once and parsed,
//   never run: its text, its Go deeper section and its footnotes, every id
//   prefixed with its book and chapter ("john-4-v16"; prepareLitBlocks in
//   src/lib/read-on.mjs), so none repeats the page's. Its heading is the
//   chapter's name alone, close above it, with Go deeper at its right (WB-14,
//   WB-15). A run of drafts is one entry, "Luke 23–24," saying it is still
//   being translated, with a line to its Greek in Study (WB-29, WB-32); a
//   draft asked for by its address still opens its own page (WB-31).
// - A loaded chapter gets the page's tools: the verse menu, footnote popovers
//   and the selection panel (chapter-tools.js, attachChapter), and the key
//   terms (term-lens.js, attachTermLens); reference previews listen on the
//   document already. The Study Desk finds it through `lit:read-on` and
//   src/scripts/desk/page.js, never an import: shared code never imports the
//   desk (test/desk-gate-imports.test.js).
// - The reader's line never moves when a chapter loads above: the page
//   scrolls by what was added (the browser's scroll anchoring is off,
//   reading-page.css, on body as well as the root: off on the root alone,
//   Chrome kept a reader at the page's very end at the new end as each
//   chapter arrived, so every one called for the next).
// - The address follows the chapter at the reading line (10% down, as
//   Continue reading's) through history.replaceState, so a reload or a copied
//   address lands there and Back still leaves the book: nothing is pushed.
//   The place line, the phone's row and bar, the title, the passage picker's
//   current chapter and the progress line (by verses through the book, WB-34)
//   follow it, and so does Continue reading, which asks `placeNow`
//   (last-read.js).
// - ‹ › and ← → [ ] (keyboard-shortcuts.js presses ‹ ›) go to the start of
//   the chapter before or after in the book, loading it first; into another
//   book they are links as ever.
// - A print is one chapter: the one being read (reading-page.css).
// - A loaded chapter is never a page view of the site's own: lit_pv counts
//   page loads (announcement-gate.js), and replaceState loads nothing.
//   Cloudflare's beacon is another matter: where the browser has the
//   Navigation API it hears replaceState's `navigate` event and reports the
//   new address as a page view (src/pages/CLAUDE.md, "Measuring the Read page").
//
// Without JavaScript none of this runs: the page is one chapter, with the
// way on at its foot.

import { bookKeyToLabel } from "../data/books.js";
import {
  bookProgress,
  bookUnits,
  draftGreekLink,
  draftStubText,
  indexAtLine,
  prepareLitBlocks,
  readOnPrefix,
  unitBeside,
  unitHeading,
} from "../lib/read-on.mjs";
import { attachChapter } from "./chapter-tools.js";
import { readingLine } from "./last-read.js";
import { attachTermLens } from "./term-lens.js";
import { setTip } from "./tip.js";

/** The next chapter loads once the last one's end is this many windows below the window's top. */
const BELOW = 2.5;
/** The one before loads on a scroll up within this many windows of the page's top. */
const ABOVE = 1;

/** The event the Study Desk hears: { type: "loaded" | "place", book, chapter, box? }. */
export const READ_ON_EVENT = "lit:read-on";

const parseJson = (text) => {
  try {
    return JSON.parse(text ?? "null");
  } catch {
    return null;
  }
};

const make = (tag, className, text) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
};

const plainClick = (e) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

/** An element's first line's top, in the window (a verse can start mid-line). */
const firstTop = (el) => (el.getClientRects()[0] ?? el.getBoundingClientRect()).top;

/**
 * Start reading on from this chapter's page. `root` is the page's
 * `article.chapter`, drawn only for a published chapter. Returns
 * `{ placeNow }`, which says where the reading line is ({ book, chapter,
 * verse }, verse null before a chapter's first; null on a draft's entry), or
 * null where the page doesn't read on.
 *
 * @param {HTMLElement} root
 */
export function startReadingOn(root) {
  const data = parseJson(document.getElementById("read-on-data")?.textContent);
  const main = root?.closest(".scripture-main");
  const title = document.getElementById("chapter-title");
  const head = main && title ? [...main.children].find((el) => el.contains(title)) : null;
  const text = root?.querySelector(":scope > .chapter-paragraphs");
  if (!data?.book || !data.chapter || !main || !head || !text) return null;

  const html = document.documentElement;
  const book = data.book;
  const bookName = bookKeyToLabel(book);
  const units = bookUnits(book, data.drafts ?? []);
  const nav = data.nav ?? {};
  const unitOf = (n) => units.find((u) => u.chapters.includes(n)) ?? null;
  const titleTail = document.title.includes(" | ") ? document.title.slice(document.title.indexOf(" | ")) : "";
  const pageAddress = window.location.pathname + window.location.search;
  const endTemplate = root.querySelector("template[data-read-on-end]");

  // The page's own chapter is the first entry; the ones read on into come
  // before and after it, each its own article.
  const page = { kind: "page", unit: unitOf(data.chapter), chapter: data.chapter, parts: [head, root], text, heading: title, title: document.title };
  if (!page.unit) return null;
  /** @type {Array<{ kind: string, unit: object, chapter: number, parts: Element[], text: Element | null, heading: Element | null, title: string, lens?: object | null }>} */
  const entries = [page];
  const before = make("div", "read-on read-on--before");
  const after = make("div", "read-on read-on--after");
  head.before(before);
  root.after(after);
  head.setAttribute("data-read-on-page", "");
  root.setAttribute("data-read-on-page", "");
  html.setAttribute("data-read-on", "");
  if (unitBeside(units, data.chapter, 1)) html.setAttribute("data-read-on-more", "");

  const topOf = (entry) => entry.parts[0].getBoundingClientRect().top;
  const bottomOf = (entry) => entry.parts.at(-1).getBoundingClientRect().bottom;
  const entryFor = (n) => entries.find((e) => e.unit.chapters.includes(n)) ?? null;

  /* ── Fetching a chapter's page ───────────────────────────────────── */

  const pages = new Map(); // chapter -> Promise<Document>, once a visit
  function fetchPage(n) {
    if (!pages.has(n)) {
      const got = fetch(`/${book}-${n}/`, { credentials: "same-origin" })
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${r.status}`))))
        .then((body) => new DOMParser().parseFromString(body, "text/html"));
      // A failure is forgotten, so Try again fetches again.
      got.catch(() => pages.delete(n));
      pages.set(n, got);
    }
    return pages.get(n);
  }

  /* ── Building an entry ───────────────────────────────────────────── */

  function headRow(prefix) {
    const row = make("div", "chapter-head");
    const heading = make("h2", "chapter-head__title read-on__heading");
    heading.id = `${prefix}heading`;
    heading.tabIndex = -1;
    row.append(heading);
    return { row, heading };
  }

  function article(unit, modifier) {
    const n = unit.chapters[0];
    const prefix = readOnPrefix(book, n);
    const box = make("article", `read-on__chapter${modifier ? ` read-on__chapter--${modifier}` : ""}`);
    box.dataset.book = book;
    box.dataset.chapter = String(n);
    box.setAttribute("aria-labelledby", `${prefix}heading`);
    const { row, heading } = headRow(prefix);
    box.append(row);
    return { box, row, heading, prefix, n };
  }

  /** A published chapter, from its page. Null when the page has no text (a stale draft list). */
  function chapterEntry(unit, doc) {
    const source = doc.querySelector("article.chapter[data-last-read-book]");
    const words = source?.querySelector(":scope > .chapter-paragraphs");
    if (!words) return null;
    const { box, row, heading, prefix, n } = article(unit, null);
    heading.textContent = unitHeading(unit);
    const intro = source.querySelector(":scope > .chapter-intro-link");
    const deeper = source.querySelector(":scope > .go-deeper");
    const notes = source.querySelector(":scope > .footnotes-wrap");
    const parts = [intro, words, deeper, notes].filter(Boolean);
    prepareLitBlocks(parts, prefix);
    // As the page's own inline script names them.
    for (const a of words.querySelectorAll(".fn-ref a")) {
      if (!a.hasAttribute("aria-label")) a.setAttribute("aria-label", `Footnote reference ${a.textContent.trim()}`);
    }
    if (deeper) {
      const go = make("span", "chapter-head__go");
      const a = make("a", "kit-btn kit-btn--plain", "Go deeper");
      a.href = `#${prefix}go-deeper-title`;
      a.dataset.goDeeper = "";
      a.dataset.book = book;
      a.dataset.chapter = String(n);
      go.append(a);
      row.append(go);
    }
    box.append(...parts);
    const lens = parseJson(doc.getElementById("term-lens-data")?.textContent);
    return { kind: "chapter", unit, chapter: n, parts: [box], text: words, heading, title: doc.title || `${unitHeading(unit)}${titleTail}`, lens };
  }

  /** A run of drafts: one entry saying it is still being translated, with its Greek in Study. */
  function draftEntry(unit) {
    const { box, heading, n } = article(unit, "draft");
    box.dataset.chapters = unit.chapters.join(" ");
    heading.textContent = unitHeading(unit);
    const greek = draftGreekLink(unit);
    const line = make("p", "read-on__stub read-on__greek");
    const link = make("a", "kit-inline", greek.label);
    link.href = greek.href;
    line.append(link);
    box.append(make("p", "read-on__stub", draftStubText(unit)), line);
    return { kind: "draft", unit, chapter: n, parts: [box], text: null, heading, title: `${unitHeading(unit)}${titleTail}` };
  }

  /** A chapter that didn't load: its heading links to its page, and Try again fetches it again. */
  function failedEntry(unit, dir) {
    const { box, heading, n } = article(unit, "failed");
    const link = make("a", "kit-inline", unitHeading(unit));
    link.href = `/${book}-${n}/`;
    heading.append(link);
    const retry = make("div", "read-on__retry");
    const again = make("button", "kit-btn kit-btn--plain", "Try again");
    again.type = "button";
    retry.append(again);
    box.append(make("p", "read-on__stub", "This chapter didn’t load."), retry);
    const entry = { kind: "failed", unit, chapter: n, parts: [box], text: null, heading, title: `${unitHeading(unit)}${titleTail}` };
    again.addEventListener("click", () => {
      const at = entries.indexOf(entry);
      if (at >= 0) entries.splice(at, 1);
      const hold = dir < 0 ? lineHold() : null;
      box.remove();
      hold?.();
      stalled[dir] = false;
      load(dir).then(() => entryFor(n)?.heading?.focus({ preventScroll: true }));
    });
    return entry;
  }

  /** The page's tools on a chapter just put in, and the desk told. */
  function attach(entry) {
    if (entry.kind !== "chapter") return;
    try {
      attachChapter(entry.text, { book, chapter: entry.chapter, label: unitHeading(entry.unit) });
    } catch (err) {
      console.error("Reading on: the chapter's tools didn't start", err);
    }
    if (entry.lens) {
      try {
        attachTermLens(entry.text, entry.lens);
      } catch (err) {
        console.error("Reading on: the key terms didn't start", err);
      }
    }
    document.dispatchEvent(new CustomEvent(READ_ON_EVENT, { detail: { type: "loaded", book, chapter: entry.chapter, box: entry.text } }));
  }

  /* ── Loading on ──────────────────────────────────────────────────── */

  const busy = { 1: null, [-1]: null };
  const stalled = { 1: false, [-1]: false };
  let endBlock = null;

  /** What keeps the reader's line where it is through a change above it: call it after the change. */
  function lineHold() {
    const line = readingLine([text.querySelector("sup.vn")].filter(Boolean));
    const entry = entries.find((e) => bottomOf(e) > line) ?? entries.at(-1);
    // Its last part, not its top: the page's own heading, its first part,
    // grows once a chapter is above it (ScriptureHeader.astro), and only the
    // text below takes the whole change, wherever the line is (on a phone
    // the app banner can put it above that heading).
    const ref = entry.parts.at(-1);
    const was = ref.getBoundingClientRect().top;
    return () => {
      const delta = ref.getBoundingClientRect().top - was;
      if (Math.abs(delta) >= 1) window.scrollBy({ top: delta, left: 0, behavior: "instant" });
    };
  }

  /** The book's way on, after its last chapter, once that has loaded. */
  function placeEnd() {
    if (endBlock || !endTemplate) return;
    endBlock = make("div", "read-on__end");
    endBlock.append(endTemplate.content.cloneNode(true));
    after.append(endBlock);
  }

  /**
   * Load the unit after the last entry (dir 1) or before the first (-1).
   * Resolves once it is on the page (or has failed, or there is none).
   */
  function load(dir) {
    if (busy[dir]) return busy[dir];
    if (stalled[dir]) return Promise.resolve();
    const edge = dir > 0 ? entries.at(-1) : entries[0];
    const unit = unitBeside(units, dir > 0 ? edge.unit.chapters.at(-1) : edge.unit.chapters[0], dir);
    if (!unit) {
      if (dir > 0) placeEnd();
      return Promise.resolve();
    }
    const job = (async () => {
      let entry = null;
      try {
        entry = unit.draft ? draftEntry(unit) : chapterEntry(unit, await fetchPage(unit.chapters[0]));
        if (!entry) entry = draftEntry({ ...unit, draft: true });
      } catch {
        entry = failedEntry(unit, dir);
        stalled[dir] = true;
      }
      if (dir > 0) {
        after.insertBefore(entry.parts[0], endBlock);
        entries.push(entry);
        attach(entry);
        if (!unitBeside(units, unit.chapters.at(-1), 1) && entry.kind !== "failed") placeEnd();
      } else {
        const hold = lineHold();
        before.prepend(entry.parts[0]);
        entries.unshift(entry);
        attach(entry);
        // Before the hold measures: it may grow the page's own heading.
        html.setAttribute("data-read-on-above", "");
        hold();
      }
    })().finally(() => {
      busy[dir] = null;
      schedule();
    });
    busy[dir] = job;
    return job;
  }

  /** Load what the reader is nearing: below as they read on, above as they scroll up near the top. */
  function nearing(up) {
    const room = window.innerHeight;
    if (bottomOf(entries.at(-1)) < room * BELOW) load(1);
    if (up && topOf(entries[0]) > -room * ABOVE) load(-1);
  }

  /* ── Where the reader is ─────────────────────────────────────────── */

  const lineNow = () => readingLine([text.querySelector("sup.vn")].filter(Boolean));

  function entryAt(line) {
    const at = indexAtLine(
      (function* () {
        for (const e of entries) yield topOf(e);
      })(),
      line,
    );
    return entries[Math.max(0, at)];
  }

  /**
   * The verse at the line in an entry, read from the verses' `[data-verse]`
   * spans, never their numbers, which the Display tray may hide; 0 above the
   * first.
   */
  function verseIn(entry, line) {
    if (!entry.text) return 0;
    const spans = entry.text.querySelectorAll("[data-verse]");
    const at = indexAtLine(
      (function* () {
        for (const s of spans) yield firstTop(s);
      })(),
      line,
    );
    return at < 0 ? 0 : Number.parseInt(spans[at].dataset.verse, 10) || 0;
  }

  /** Where Continue reading records the reader: null on a draft's or a failed entry. */
  function placeNow() {
    const line = lineNow();
    const entry = entryAt(line);
    if (entry.kind !== "page" && entry.kind !== "chapter") return null;
    return { book, chapter: entry.chapter, verse: verseIn(entry, line) || null };
  }

  /* ── Following the reader ────────────────────────────────────────── */

  let current = page;
  let moved = false; // the address has left the page's own

  const historyState = () => (history.state && typeof history.state === "object" ? history.state : {});

  function setAddress(entry, verse = null) {
    const to = entry === page ? pageAddress : `/${book}-${entry.chapter}/`;
    try {
      history.replaceState({ ...historyState(), readOn: { book, chapter: entry.chapter, verse } }, "", to);
      if (!moved) {
        // The browser would put a reload of the new address at the old
        // page's scroll: this page restores the verse itself (below).
        history.scrollRestoration = "manual";
        moved = true;
      }
    } catch {
      /* a browser that refuses (too many calls) keeps the address it had */
    }
  }

  function setTurn(a, to, word, named) {
    if (!a) return;
    if (to?.[0]) {
      a.setAttribute("href", to[0]);
      a.setAttribute("rel", word === "Previous" ? "prev" : "next");
      a.removeAttribute("role");
      a.removeAttribute("aria-disabled");
      a.setAttribute("aria-label", `${word}: ${to[1]}`);
    } else {
      a.removeAttribute("href");
      a.removeAttribute("rel");
      a.setAttribute("role", "link");
      a.setAttribute("aria-disabled", "true");
      if (named) a.setAttribute("aria-label", word);
      else a.removeAttribute("aria-label");
    }
    if (a.hasAttribute("data-tip")) setTip(a, a.getAttribute("aria-label") ?? "");
  }

  /** The passage picker's current chapter, in its template and wherever it is drawn. */
  function followPicker(n) {
    const roots = [...document.querySelectorAll("[data-picker]")];
    for (const t of document.querySelectorAll("template[data-picker-template]")) roots.push(...t.content.querySelectorAll("[data-picker]"));
    for (const picker of roots) {
      if (picker.dataset.book !== book) continue;
      picker.dataset.chapter = String(n);
      for (const cell of picker.querySelectorAll(`[data-picker-section="${book}"] [data-picker-chapter]`)) {
        if (Number(cell.dataset.pickerChapter) === n) cell.setAttribute("aria-current", "page");
        else if (cell.getAttribute("aria-current") === "page") cell.removeAttribute("aria-current");
      }
    }
  }

  /** Everything that names the chapter being read, for this entry's. */
  function showPlace(entry) {
    const n = entry.chapter;
    const pick = document.querySelector('.place-line__pick[data-picker-open="chapters"]');
    const words = pick ? [...pick.childNodes].find((c) => c.nodeType === 3 && c.data.trim()) : null;
    if (words) words.data = `Chapter ${n}`;
    const [prevHref = "", prevLabel = "", nextHref = "", nextLabel = ""] = nav[n] ?? [];
    const prev = [prevHref, prevLabel];
    const next = [nextHref, nextLabel];
    const turn = document.querySelectorAll(".place-line__turn > a");
    setTurn(turn[0], prev, "Previous", true);
    setTurn(turn[turn.length - 1], next, "Next", true);
    const bar = [...document.querySelectorAll(".phone-bar > .phone-bar__item")].filter(
      (a) => !a.hasAttribute("data-bar-search") && !a.hasAttribute("data-menu-toggle"),
    );
    if (bar.length >= 2) {
      setTurn(bar[0], prev, "Previous", false);
      setTurn(bar.at(-1), next, "Next", false);
    }
    const label = document.querySelector(".site-header__picker-label");
    if (label) label.textContent = `${bookName} ${n}`;
    for (const study of document.querySelectorAll("a[data-study-place]")) {
      study.textContent = `Study ${bookName} ${n}`;
      study.setAttribute("href", `/desk/?place=${book}-${n}`);
    }
    document.title = entry.title;
    followPicker(n);
    document.dispatchEvent(new CustomEvent(READ_ON_EVENT, { detail: { type: "place", book, chapter: n } }));
  }

  function follow() {
    const line = lineNow();
    const entry = entryAt(line);
    const verse = verseIn(entry, line);
    html.style.setProperty("--read-progress", String(bookProgress(book, entry.chapter, verse)));
    if (entry === current) return;
    current = entry;
    showPlace(entry);
    setAddress(entry);
  }

  let frame = 0;
  let lastY = window.scrollY;
  function tick() {
    frame = 0;
    const y = window.scrollY;
    const up = y < lastY;
    lastY = y;
    follow();
    nearing(up);
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(tick);
  }

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });

  // At the page's top a scroll up moves nothing, so no scroll event says the
  // reader wants the chapter before: the wheel, a finger drawn down, and the
  // keys that scroll up say it instead.
  const atTop = () => window.scrollY < window.innerHeight * ABOVE;
  const wantAbove = () => {
    if (atTop()) load(-1);
  };
  window.addEventListener("wheel", (e) => {
    if (e.deltaY < 0) wantAbove();
  }, { passive: true });
  let touchY = null;
  window.addEventListener("touchstart", (e) => {
    touchY = e.touches[0]?.clientY ?? null;
  }, { passive: true });
  window.addEventListener("touchmove", (e) => {
    const y = e.touches[0]?.clientY;
    if (touchY != null && y != null && y - touchY > 12) wantAbove();
  }, { passive: true });
  window.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!["ArrowUp", "PageUp", "Home"].includes(e.key) && !(e.key === " " && e.shiftKey)) return;
    const t = e.target;
    if (t instanceof Element && t.closest("input, textarea, select, [contenteditable], [role=listbox], [role=menu], [role=grid], dialog")) return;
    wantAbove();
  });

  /* ── Turning chapters ────────────────────────────────────────────── */

  /** Go to the start of chapter `n` in this book, loading it (and what lies between) first. */
  async function goTo(n) {
    let entry = entryFor(n);
    const dir = n > current.chapter ? 1 : -1;
    while (!entry) {
      const count = entries.length;
      await load(dir);
      entry = entryFor(n);
      if (entries.length === count) break;
    }
    if (!entry || entry.kind === "failed") {
      window.location.assign(`/${book}-${n}/`);
      return;
    }
    entry.parts[0].scrollIntoView({ block: "start", behavior: "instant" });
    // The page's own h1 takes focus as a loaded chapter's heading does.
    if (entry.heading && !entry.heading.hasAttribute("tabindex")) entry.heading.tabIndex = -1;
    entry.heading?.focus({ preventScroll: true });
    follow();
  }

  const chapterIn = (href) => {
    const m = /^\/([a-z0-9]+)-(\d+)\/?$/.exec(new URL(href, window.location.href).pathname);
    const n = m && m[1] === book ? Number(m[2]) : 0;
    return n && unitOf(n) ? n : 0;
  };

  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || !plainClick(e) || !(e.target instanceof Element)) return;

    // ‹ › and the phone bar's Previous and Next, within the book.
    const turn = e.target.closest(".place-line a[rel][href], .phone-bar a[rel][href]");
    if (turn) {
      const n = chapterIn(turn.getAttribute("href"));
      if (!n) return;
      e.preventDefault();
      goTo(n);
      return;
    }

    // Go deeper: the chapter's own section where it is drawn; where the
    // Notebook panel runs, it has left the flow (WB-18), and the Notebook's
    // This verse shows it under "This chapter" instead.
    const deeper = e.target.closest("a[data-go-deeper]");
    if (deeper) {
      e.preventDefault();
      const target = document.getElementById((deeper.getAttribute("href") ?? "").slice(1));
      if (target && target.getClientRects().length > 0) {
        target.scrollIntoView({ block: "start", behavior: "instant" });
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
      } else {
        document.dispatchEvent(
          new CustomEvent("lit:desk-command", {
            detail: { id: "show-this-chapter", book: deeper.dataset.book, chapter: Number(deeper.dataset.chapter) },
          }),
        );
      }
      return;
    }

    // A link inside a loaded chapter to another part of it (a footnote's
    // letter and its way back): scrolled to in place, so the address keeps
    // the chapter's own and no history entry is pushed.
    const inner = e.target.closest(".read-on__chapter a[href^='#']");
    if (inner) {
      const target = document.getElementById(inner.getAttribute("href").slice(1));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ block: "start", behavior: "instant" });
      if (!target.matches("a, button, [tabindex]")) target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }
  });

  /* ── Printing: one chapter ───────────────────────────────────────── */

  let printing = null;
  window.addEventListener("beforeprint", () => {
    // The Study Desk's prints are of the page's own chapter (print-notes.js,
    // print-part.js); a plain print is of the chapter being read.
    const desk = html.hasAttribute("data-desk-print") || html.hasAttribute("data-desk-part");
    const entry = !desk && current.kind === "chapter" ? current : page;
    html.setAttribute("data-read-on-print", "");
    for (const el of entry.parts) el.setAttribute("data-read-on-printing", "");
    const credit = document.querySelectorAll(".print-credit p")[1];
    const was = credit?.textContent ?? null;
    if (credit && was && entry !== page) credit.textContent = was.replace(/\/[^/]*$/, `/${book}-${entry.chapter}`);
    printing = { entry, credit, was };
  });
  window.addEventListener("afterprint", () => {
    if (!printing) return;
    html.removeAttribute("data-read-on-print");
    for (const el of printing.entry.parts) el.removeAttribute("data-read-on-printing");
    if (printing.credit && printing.was != null) printing.credit.textContent = printing.was;
    printing = null;
  });

  /* ── Coming back ─────────────────────────────────────────────────── */

  // Where the reader was when the page was left, for a reload or a return
  // from another page that the browser didn't keep whole.
  window.addEventListener("pagehide", () => {
    if (!moved) return;
    const at = placeNow();
    try {
      history.replaceState({ ...historyState(), readOn: { book, chapter: current.chapter, verse: at?.verse ?? null } }, "");
    } catch {
      /* nothing kept: the page opens at the chapter's top */
    }
  });
  let navigation = "";
  try {
    navigation = performance.getEntriesByType?.("navigation")?.[0]?.type ?? "";
  } catch {
    navigation = "";
  }
  const kept = historyState().readOn;
  if ((navigation === "reload" || navigation === "back_forward") && kept?.book === book && kept.chapter === data.chapter) {
    moved = true;
    history.scrollRestoration = "manual";
    const verse = Number(kept.verse) || 0;
    if (verse) text.querySelector(`[data-verse="${verse}"]`)?.scrollIntoView({ block: "start", behavior: "instant" });
  }

  // The first look, once the page has its layout; then the next chapter's
  // page is fetched ahead, so reading on never waits on it.
  requestAnimationFrame(() => {
    lastY = window.scrollY;
    follow();
    nearing(false);
    const next = unitBeside(units, data.chapter, 1);
    if (next && !next.draft) fetchPage(next.chapters[0]).catch(() => {});
  });

  return { placeNow };
}
