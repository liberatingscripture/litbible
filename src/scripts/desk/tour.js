// src/scripts/desk/tour.js
//
// The tour (STUDY-DESK.md D8; BVJ: "a tutorial sequence ... that runs on a
// user's first encounter and can be replayed later"). A run of small cards in
// three parts (marking the text, the Notebook, finding and keeping), each
// beside the thing it is about on the page in front of the reader, and each
// showing that thing working: the verse menu opened, the note editor with an
// example in it, an example note in the margin, a footnote's Pin, the
// panel's tabs, the search box answering a query (BVJ,
// 2026-10-13: "more thorough in walking through how to use the features",
// with steps that act).
//
// It never starts by itself. It starts when the reader asks: "Yes" on the
// quiet offer made right after the first-time choice (first-use.js), "Take
// the tour" at the panel's foot, the search box's `tour` command (a
// `lit:desk-command` event on `document`), or `?desk-tour` on a chapter's
// address, which the help page links to. Anywhere the reader is mid-reading
// it is therefore their own doing, never over scripture unasked (CLAUDE.md,
// "One announcement popover at a time", whose spirit this keeps; the tour is
// not an announcement and doesn't use that slot).
//
// It leaves nothing behind (BVJ, 2026-10-13): no step writes a record, and
// when it ends everything it changed is put back.
//   - The note editor opens in its example mode (note-editor.js's
//     setEditorPreview): read-only words, and Save does nothing.
//   - The example note is drawn by the tour, outside the notebook (a
//     `desk-tour-demo` element), and removed with the step.
//   - Menus, the footnote popover and any selection it made are closed.
//   - The Notebook goes back as it was, shown, minimized or closed, on the
//     same tab, with the keys that remember those unchanged (panel.js's
//     snapshot and restore).
//   - The search box gets its words back and its tray closes.
//   - The page scrolls back to where the reader was, and while the tour runs
//     `data-desk-tour` on <html> keeps "Continue reading" (and a bookmark that
//     moves as the reader reads) from recording the places it scrolls through.
// What the reader does themselves during the tour (a highlight they choose,
// a pin they press) is theirs, and stays.
//
// Keyboard and screen readers: each card is a non-modal dialog that takes
// focus, Back / Next / Done, "Skip this part" and "Skip the tour" are real
// buttons, Escape ends the tour, and focus goes back to where the reader
// was. Reduced motion is respected (the card doesn't animate in and the page
// jumps to a target instead of scrolling). The card is part of the desk's
// frame (data-desk-dock), so clicks in it don't close a floating panel and
// the single-key shortcuts stand down while focus is in it.
//
// "Seen" (localStorage['lit-desk-tour']) is the list of step ids; every step
// of a run is marked as the run starts, so closing early is the same as
// finishing, and a later phase that adds a step offers just that.

import { closePanel, currentPanel } from "../lit-panel.js";
import { createTourRunner } from "./tour-runner.js";
import { readingSurface } from "../desk-frame.js";
import { WAYS_HREF, parseTourState, planTour, withSeen, TOUR_STEPS } from "../../lib/desk-first-use.mjs";
import { NOTE_GAP, NOTE_LINES, marginMode, noteWidth } from "../../lib/desk-notes.mjs";
import { COMMAND_EVENT, getTourRaw, saveTourList } from "./first-use.js";
import { glyph } from "./glyphs.js";
import { editorHolds, setEditorPreview } from "./note-editor.js";
import { pageChapter } from "./page.js";
import { prosePage } from "./note-sources.js";

const SETTLE_MS = 450; // a selection panel opens 200ms after the selection settles
const EXAMPLE_NOTE =
  "An example. Your own words go here: a question, a connection, something to come back to.";
const EXAMPLE_MARGIN =
  "An example note. Yours sit here in the margin, beside the words they’re on. A long one shows three lines until you hover over it or select it, and then the rest of it appears, the way this one does.";

const visible = (e) => Boolean(e && e.getClientRects().length && e.getBoundingClientRect().width > 4);
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** "study" (a chapter), "read" (Read View) or "prose" (an article or the glossary). */
function viewOfPage() {
  if (document.querySelector("[data-rm-root]")) return "read";
  return pageChapter() ? "study" : "prose";
}

/**
 * @param {{ panel: { el: HTMLElement, open: Function, close: Function,
 *   isOpen: () => boolean, showTab: (id: string, opts?: object) => boolean,
 *   showGreekWord: Function | null, snapshot: () => object, restore: (s: object) => void },
 *   canKeep?: boolean }} options
 *   `canKeep` is false where this browser keeps no notebook: the steps about
 *   marking the text and keeping it are left out, since there they don't work
 *   (BA34).
 */
export function createTour({ panel, canKeep = true }) {
  const runner = createTourRunner();
  let state = { verse: null, snap: null };
  const view = viewOfPage();

  // What a step opened, to undo before the next step and at the end.
  const later = (fn) => runner.later(fn);

  /* ── The page's pieces ────────────────────────────────────────── */

  const column = () => {
    const surface = readingSurface();
    return surface ? document.querySelector(surface.column[0]) : null;
  };

  const inView = (e) => {
    const r = e.getBoundingClientRect();
    return r.top >= 90 && r.bottom <= window.innerHeight - 40;
  };

  // The text a selection is made in: Chapter View's or Read View's paragraphs,
  // or an article's or a glossary entry's own words.
  const textParagraphs = () => {
    if (view === "prose") {
      const page = prosePage();
      return page ? page.targets.flatMap((t) => Array.from(t.root.querySelectorAll("p"))) : [];
    }
    const root = view === "read" ? document.querySelector(".rm-reader") : document.querySelector(".chapter-paragraphs");
    return root ? Array.from(root.querySelectorAll("p")) : [];
  };

  // The verse every Chapter View step uses, chosen once per run: the first
  // verse number in view, else the chapter's first.
  const pickVerse = () => {
    const numbers = Array.from(document.querySelectorAll(".chapter-paragraphs sup.vn")).filter(visible);
    return numbers.find(inView) ?? numbers[0] ?? null;
  };
  const verseNumber = () => Number.parseInt(state.verse?.id?.slice(1) ?? "", 10) || 1;

  const byText = (root, ...texts) =>
    Array.from(root?.querySelectorAll("button, a") ?? []).find((b) => texts.some((t) => b.textContent.trim().startsWith(t)));

  // Instant, not the stylesheet's smooth scroll, so the step measures where
  // things are once they're there.
  const bringIntoView = async (el) => {
    if (!el || inView(el)) return;
    el.scrollIntoView({ block: "center", behavior: "instant" });
    await frame();
  };

  /* ── What the steps do ────────────────────────────────────────── */

  // The verse menu, opened as a reader opens it: a click on its number.
  async function openVerseMenu() {
    if (!state.verse) return null;
    closePanel();
    await bringIntoView(state.verse);
    state.verse.click();
    await frame();
    return currentPanel()?.el ?? null;
  }

  // A selection of a few words, as a reader would make one, and the panel it
  // opens.
  async function selectWords() {
    const paras = textParagraphs().filter((p) => p.textContent.trim().length > 40);
    const p = paras.find(inView) ?? paras[0];
    if (!p) return null;
    await bringIntoView(p);
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        n.nodeValue.trim().length > 24 && !n.parentElement.closest("sup, .sr-only, [aria-hidden='true']")
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP,
    });
    const node = walker.nextNode();
    if (!node) return null;
    const text = node.nodeValue;
    const start = text.search(/\S/);
    // About five words, ending at a word's end.
    let end = start;
    for (let words = 0; words < 5 && end < text.length; words++) {
      const next = text.slice(end).search(/\S\s/);
      if (next < 0) {
        end = text.length;
        break;
      }
      end += next + 1;
    }
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    closePanel();
    // A gesture's start and end around it, as a reader's selection has: the
    // selection panels show the same words again only after a new gesture.
    const pointer = (type) =>
      p.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: "mouse", isPrimary: true }));
    pointer("pointerdown");
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    pointer("pointerup");
    later(() => {
      window.getSelection()?.removeAllRanges();
      closePanel();
    });
    await wait(SETTLE_MS);
    return currentPanel()?.el ?? null;
  }

  // An example note in the margin, drawn by the tour beside `line` where the
  // margin holds notes in full; null where it doesn't.
  function exampleNote(line) {
    const box = (view === "prose" ? prosePage()?.box : document.querySelector(".chapter-paragraphs"))?.getBoundingClientRect();
    if (!box || !line || marginMode(box.left) !== "full") return null;
    const width = noteWidth(box.left, box.width);
    const wrap = document.createElement("div");
    wrap.className = "desk-notes desk-tour-demo";
    wrap.setAttribute("aria-hidden", "true");
    const note = document.createElement("div");
    note.className = "desk-note";
    note.style.left = `${box.left + window.scrollX - NOTE_GAP - width}px`;
    note.style.top = `${line.getBoundingClientRect().top + window.scrollY - 3}px`;
    note.style.width = `${width}px`;
    note.innerHTML = `<span class="desk-note__toggle">${glyph("note", "desk-glyph desk-note__glyph")}<span class="desk-note__text"></span></span>`;
    note.querySelector(".desk-note__text").textContent = EXAMPLE_MARGIN;
    wrap.append(note);
    document.body.append(wrap);
    const lh = parseFloat(getComputedStyle(note).lineHeight) || 23;
    if (note.querySelector(".desk-note__toggle").scrollHeight > NOTE_LINES * lh + 0.5) {
      note.classList.add("desk-note--cut");
      note.style.setProperty("--desk-note-max", `${NOTE_LINES * lh + 3}px`);
    }
    later(() => wrap.remove());
    return note;
  }

  // Each step's act: what it opens or draws, and what its card points at.
  // `el` places the card; `marks` are outlined (default: el, when small).
  // Only controls are outlined (E30): where a step lands on the page's own
  // text, a verse number or a footnote letter, it passes `marks: []`. "Open
  // the menu" (the step that names Highlight) outlines nothing either: the
  // menu it opens is the thing, and BVJ found the dashed line there unneeded.
  // What a step opens is undone by `later`, before the next step and at the
  // end.
  const STEPS = {
    async actions() {
      const el = view === "study" ? await openVerseMenu() : await selectWords();
      return el ? { el, side: "right", marks: [] } : state.verse ? { el: state.verse, marks: [] } : null;
    },

    async note() {
      const menu = view === "study" ? await openVerseMenu() : await selectWords();
      const add = byText(menu, "Add a note");
      if (!add) return menu ? { el: menu, side: "right" } : null;
      setEditorPreview(EXAMPLE_NOTE);
      try {
        add.click();
      } finally {
        setEditorPreview(null);
      }
      await frame();
      const editor = currentPanel()?.el;
      return editor ? { el: editor, side: "right", marks: [] } : null;
    },

    async margin() {
      closePanel();
      const real = Array.from(document.querySelectorAll("aside.desk-notes .desk-note")).find((e) => visible(e) && inView(e));
      if (real) return { el: real, side: "left" };
      const line = view === "study" ? state.verse : textParagraphs().find(inView) ?? textParagraphs()[0];
      await bringIntoView(line);
      const demo = exampleNote(line);
      // Below the note, in the margin, rather than beside it over the text.
      return demo ? { el: demo } : column() && { el: column(), side: "right" };
    },

    async pin() {
      closePanel();
      const refs = Array.from(document.querySelectorAll(".chapter-paragraphs .fn-ref a")).filter(visible);
      const after = refs.find((a) => state.verse && state.verse.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING);
      const ref = refs.find(inView) ?? after ?? refs[0];
      if (!ref) return null;
      await bringIntoView(ref);
      ref.click();
      await frame();
      const pop = currentPanel()?.el;
      later(() => closePanel());
      // The Pin button is a thumbtack with no words (E18), so it is found by its mark.
      const pin = pop?.querySelector("button[data-desk-pin]");
      return pop ? { el: pop, side: "right", marks: pin ? [pin] : [] } : { el: ref, marks: [] };
    },

    async panel() {
      closePanel();
      panel.showTab("mine", { focus: false, remember: false });
      const marks = [".desk-panel__collapse"].map((s) => panel.el.querySelector(s)).filter(visible);
      return { el: panel.el, side: "left", marks };
    },

    async verse() {
      closePanel();
      panel.showTab("verse", { focus: false, remember: false });
      return { el: panel.el, side: "left", marks: tabButton("verse") };
    },

    async greek() {
      closePanel();
      if (panel.showGreekWord) await panel.showGreekWord(verseNumber(), firstWord(), { focus: false, remember: false });
      else panel.showTab("greek", { focus: false, remember: false });
      return { el: panel.el, side: "left", marks: tabButton("greek") };
    },

    async undo() {
      closePanel();
      panel.showTab("settings", { focus: false, remember: false });
      const hide = panel.el.querySelector('input[data-desk-hide-check]')?.closest("label");
      return { el: panel.el, side: "left", marks: visible(hide) ? [hide] : [] };
    },

    async search() {
      closePanel();
      const input = document.getElementById("site-search-input");
      if (!visible(input)) return null;
      const root = input.closest("[data-searchbar]");
      const before = input.value;
      // The click on the card that brought the tour here is still bubbling,
      // and the tray closes on any click outside itself (searchbar.js), so
      // the tray is opened only once that click is over; opened within it,
      // it shut at once and the step showed an empty box.
      await frame();
      // ">" lists the box's commands, the one thing a reader with an empty
      // notebook can be shown. The commands are the box's desk part, loaded
      // on its first focus (searchbar.js listens for focusin), and once it
      // arrives a query already in the box is searched again, so the list
      // comes up as soon as it is ready.
      root?.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      input.value = ">";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      later(() => {
        input.value = before;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        root?.querySelector(".searchbar__close")?.click();
      });
      await wait(200);
      // Beside the box, not under it, where the card would cover the list.
      return { el: input, side: "right", marks: [input] };
    },

    // The notebook page's link and the foot that says where it's kept.
    async kept() {
      closePanel();
      panel.showTab("settings", { focus: false, remember: false });
      const link = panel.el.querySelector(".desk-panel__page a");
      const foot = panel.el.querySelector(".desk-home");
      return { el: panel.el, side: "left", marks: [link, foot].filter(visible) };
    },
  };

  const tabButton = (id) => {
    const b = panel.el.querySelector(`[role="tab"][data-tab="${id}"]`);
    return visible(b) ? [b] : [];
  };

  // The verse's first Greek word, in MorphGNT's numbering: 1 in every verse
  // the Greek has.
  const firstWord = () => 1;

  // Whether a step can be shown on this page at all. The rest are judged
  // when the step is reached, and fall back to a card in the middle.
  const available = () => {
    const ids = new Set(TOUR_STEPS.filter((s) => s.views.includes(view)).map((s) => s.id));
    if (!visible(document.getElementById("site-search-input"))) ids.delete("search");
    if (!document.querySelector(".chapter-paragraphs .fn-ref a")) ids.delete("pin");
    if (!document.querySelector('#deskPanel [role="tab"][data-tab="greek"]')) ids.delete("greek");
    if (!document.querySelector('#deskPanel [role="tab"][data-tab="verse"]')) ids.delete("verse");
    if (view !== "study" ? !textParagraphs().length : !pickVerse()) {
      for (const id of ["actions", "note", "margin"]) ids.delete(id);
    }
    return ids;
  };

  /* ── Starting ─────────────────────────────────────────────────── */

  function start({ only = null } = {}) {
    if (runner.running()) return;
    // A note being written isn't thrown away for the tour (BA37).
    if (editorHolds("Save or cancel this note first, then take the tour.")) return;
    closePanel(); // a verse menu or note card open over the text would sit under the tour
    const steps = planTour({ available: available(), only, view, canKeep });
    if (!steps.length) return;

    // Seen from the moment it starts, so ending early is the same as ending.
    saveTourList(withSeen(parseTourState(getTourRaw()).list, TOUR_STEPS.map((s) => s.id)));
    state = { verse: view === "study" ? pickVerse() : null, snap: panel.snapshot() };
    runner.start({
      steps,
      view,
      act: (step) => STEPS[step.id]?.() ?? null,
      more: (step) => (step.id === "kept" ? { href: WAYS_HREF, text: "Ways to keep your notebook" } : null),
      afterUndo: () => {
        closePanel();
        setEditorPreview(null);
      },
      // The Notebook back as it was, shown, minimized or closed.
      finish: () => panel.restore(state.snap),
      // Where the tour was started from (a button in the offer window, which
      // the tour closes, or in a panel it folds away) may be gone: the
      // Notebook's tab when it is folded, the panel when it is open, else
      // the page's heading (LV3-4).
      returnFallback: () => {
        const tab = document.querySelector(".desk-tab");
        if (tab && tab.getClientRects().length) return tab;
        if (panel.isOpen()) return panel.el;
        const heading = document.querySelector("main h1");
        if (heading && !heading.hasAttribute("tabindex")) heading.tabIndex = -1;
        return heading;
      },
    });
  }

  /* ── The ways in ──────────────────────────────────────────────── */

  document.addEventListener(COMMAND_EVENT, (e) => {
    if (e.detail?.id !== "tour") return;
    start({ only: Array.isArray(e.detail.only) ? e.detail.only : null });
  });

  // `?desk-tour` on an address: take it off, and start once the page and the
  // panel have settled.
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has("desk-tour")) {
      url.searchParams.delete("desk-tour");
      history.replaceState(history.state, "", url.pathname + url.search + url.hash);
      const later = () => setTimeout(() => start(), 600);
      if (document.readyState === "complete") later();
      else window.addEventListener("load", later, { once: true });
    }
  } catch (_) {}

  return { start };
}
