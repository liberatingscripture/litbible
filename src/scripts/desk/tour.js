// src/scripts/desk/tour.js
//
// The tour (STUDY-DESK.md D8; BVJ: "a tutorial sequence ... that runs on a
// user's first encounter and can be replayed later"). A run of small cards in
// three parts (marking the text, the Notebook, finding and keeping), each
// beside the thing it is about on the page in front of the reader, and each
// showing that thing working: the verse menu opened, the note editor with an
// example in it, an example note in the margin, a preview of a highlight, a
// footnote's Pin, the panel's tabs, the search box answering a query (BVJ,
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
//   - The example note and the highlight's preview are drawn by the tour,
//     outside the notebook (a `desk-tour-demo` element, and a Custom
//     Highlight of its own), and removed with the step.
//   - Menus, the footnote popover and any selection it made are closed.
//   - The Notebook goes back as it was, shown, minimized or closed, on the
//     same tab, with the keys that remember those unchanged (panel.js's
//     snapshot and restore).
//   - The search box gets its words back and its tray closes.
//   - The Greek tab's search field gets its words and its open or closed
//     state back, and the search commands window closes. The tour opens that
//     window with `remember: false`, so `lit-greek-commands` is never set by it.
//   - The page scrolls back to where the reader was, and while the tour runs
//     `data-desk-tour` on <html> keeps "Continue reading" (and a ribbon that
//     follows the reader) from recording the places it scrolls through.
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
import { readingSurface } from "../desk-frame.js";
import { WAYS_HREF, parseTourState, planTour, stepBody, withSeen, TOUR_STEPS } from "../../lib/desk-first-use.mjs";
import { NOTE_GAP, NOTE_LINES, marginMode, noteWidth } from "../../lib/desk-notes.mjs";
import { COMMAND_EVENT, getTourRaw, saveTourList } from "./first-use.js";
import { glyph } from "./glyphs.js";
import { closeGreekCommands, greekCommandsOpenFor, openGreekCommands } from "../greek-commands.js";
import { setEditorPreview } from "./note-editor.js";
import { pageChapter } from "./page.js";
import { prosePage } from "./note-sources.js";

const GAP = 12;
const EDGE = 12;
const DEMO_HIGHLIGHT = "desk-tour-hl";
const SETTLE_MS = 450; // a selection panel opens 200ms after the selection settles
const GREEK_EXAMPLE = "πίστις.gen, Ἰησοῦς/Χριστός.gen";
const EXAMPLE_NOTE =
  "An example. Your own words go here: a question, a connection, something to come back to.";
const EXAMPLE_MARGIN =
  "An example note. Yours sit here in the margin, beside the words they’re on. A long one shows three lines until you hover over it or select it, and then the rest of it appears, the way this one does.";

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
 *   showGreekWord: Function | null, snapshot: () => object, restore: (s: object) => void } }} options
 */
export function createTour({ panel }) {
  let run = null;
  const view = viewOfPage();

  /* ── The page's pieces ────────────────────────────────────────── */

  const column = () => {
    const surface = readingSurface();
    return surface ? document.querySelector(surface.column[0]) : null;
  };

  const inView = (e) => {
    const r = e.getBoundingClientRect();
    return r.top >= 90 && r.bottom <= window.innerHeight - 40;
  };

  // The text a selection is made in: Study View's or Read View's paragraphs,
  // or an article's or a glossary entry's own words.
  const textParagraphs = () => {
    if (view === "prose") {
      const page = prosePage();
      return page ? page.targets.flatMap((t) => Array.from(t.root.querySelectorAll("p"))) : [];
    }
    const root = view === "read" ? document.querySelector(".rm-reader") : document.querySelector(".chapter-paragraphs");
    return root ? Array.from(root.querySelectorAll("p")) : [];
  };

  // The verse every Study View step uses, chosen once per run: the first
  // verse number in view, else the chapter's first.
  const pickVerse = () => {
    const numbers = Array.from(document.querySelectorAll(".chapter-paragraphs sup.vn")).filter(visible);
    return numbers.find(inView) ?? numbers[0] ?? null;
  };
  const verseNumber = () => Number.parseInt(run.verse?.id?.slice(1) ?? "", 10) || 1;

  const byText = (root, ...texts) =>
    Array.from(root?.querySelectorAll("button, a") ?? []).find((b) => texts.some((t) => b.textContent.trim().startsWith(t)));

  // The "My Notebook" heading in a menu and the rows under it, up to the
  // next heading.
  const notebookRow = (el) => {
    const heading = Array.from(el?.querySelectorAll(".lit-panel__subheading") ?? []).find(
      (h) => h.textContent.trim() === "My Notebook",
    );
    if (!heading) return [];
    const out = [heading];
    for (let n = heading.nextElementSibling; n && !n.classList.contains("lit-panel__subheading"); n = n.nextElementSibling) {
      out.push(n);
    }
    return out;
  };

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
    if (!run.verse) return null;
    closePanel();
    await bringIntoView(run.verse);
    run.verse.click();
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
    run.selected = true;
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
  // What a step opens is undone by `later`, before the next step and at the
  // end.
  const STEPS = {
    async actions() {
      const el = view === "study" ? await openVerseMenu() : await selectWords();
      const marks = notebookRow(el);
      return el ? { el, side: "right", marks: marks.length ? marks : [el] } : run.verse ? { el: run.verse } : null;
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
      const line = view === "study" ? run.verse : textParagraphs().find(inView) ?? textParagraphs()[0];
      await bringIntoView(line);
      const demo = exampleNote(line);
      // Below the note, in the margin, rather than beside it over the text.
      return demo ? { el: demo } : column() && { el: column(), side: "right" };
    },

    async highlight() {
      const menu = await openVerseMenu();
      // The preview: the verse tinted yellow by a highlight of the tour's
      // own, never one of the reader's.
      if (typeof CSS !== "undefined" && CSS.highlights && typeof Highlight !== "undefined") {
        const ranges = Array.from(document.querySelectorAll(`.chapter-paragraphs [data-verse="${verseNumber()}"]`)).map(
          (span) => {
            const r = document.createRange();
            r.selectNodeContents(span);
            return r;
          },
        );
        if (ranges.length) {
          CSS.highlights.set(DEMO_HIGHLIGHT, new Highlight(...ranges));
          later(() => CSS.highlights.delete(DEMO_HIGHLIGHT));
        }
      }
      const row = menu?.querySelector(".desk-hl-row");
      return menu ? { el: menu, side: "right", marks: row ? [row] : [] } : null;
    },

    async bookmark() {
      const el = view === "study" ? await openVerseMenu() : await selectWords();
      const marks = [byText(el, "Bookmark", "Remove bookmark")].filter(Boolean);
      return el ? { el, side: "right", marks } : null;
    },

    async ribbon() {
      const el = view === "study" ? await openVerseMenu() : await selectWords();
      const marks = [byText(el, "Ribbon here")].filter(Boolean);
      return el ? { el, side: "right", marks } : null;
    },

    async pin() {
      closePanel();
      const refs = Array.from(document.querySelectorAll(".chapter-paragraphs .fn-ref a")).filter(visible);
      const after = refs.find((a) => run.verse && run.verse.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING);
      const ref = refs.find(inView) ?? after ?? refs[0];
      if (!ref) return null;
      await bringIntoView(ref);
      ref.click();
      await frame();
      const pop = currentPanel()?.el;
      later(() => closePanel());
      const pin = byText(pop, "Pin", "Unpin");
      return pop ? { el: pop, side: "right", marks: pin ? [pin] : [] } : { el: ref };
    },

    async panel() {
      closePanel();
      panel.showTab("mine", { focus: false, remember: false });
      const marks = [".desk-panel__collapse", ".desk-panel__close"].map((s) => panel.el.querySelector(s)).filter(visible);
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

    // The Greek tab's search field with a command search in it and the
    // commands window beside it. The field's words and open state are put
    // back, and the window is opened without marking it seen
    // (`lit-greek-commands` stays as the reader had it).
    async "greek-commands"() {
      closePanel();
      if (!panel.showTab("greek", { focus: false, remember: false })) return null;
      const input = panel.el.querySelector(".desk-greek__find-input");
      const form = panel.el.querySelector(".desk-greek__find");
      const openBtn = panel.el.querySelector(".desk-greek__find-btn");
      const closeBtn = panel.el.querySelector(".desk-greek__find-close");
      const cmdBtn = panel.el.querySelector(".desk-greek__cmds");
      if (!input || !form || !openBtn || !closeBtn) return null;
      const wasOpen = !form.hidden;
      const before = input.value;
      const hadWindow = greekCommandsOpenFor(input);
      later(() => {
        if (!hadWindow) closeGreekCommands("tour");
        if (wasOpen) {
          input.value = before;
          input.dispatchEvent(new Event("input", { bubbles: true }));
        } else if (!form.hidden) {
          closeBtn.click();
        }
      });
      if (!wasOpen) openBtn.click();
      input.value = GREEK_EXAMPLE;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      // The results take a moment: the Greek index and the verses load.
      const token = run.token;
      for (let waited = 0; waited < 4000; waited += 100) {
        const hits = panel.el.querySelector(".desk-greek__hits");
        if (hits && !hits.hidden) break;
        await wait(100);
        if (!run || run.token !== token) return null;
      }
      openGreekCommands({ field: input, source: "notebook", focus: false, remember: false });
      await frame();
      const win = document.querySelector("[data-greek-commands]");
      return { el: win ?? panel.el, side: "left", marks: visible(cmdBtn) ? [cmdBtn] : [] };
    },

    async widths() {
      closePanel();
      panel.showTab("mine", { focus: false, remember: false });
      await frame();
      const gutter = Array.from(document.querySelectorAll(".desk-gutter")).find(visible);
      return gutter ? { el: gutter, side: "right", marks: [gutter] } : { el: panel.el, side: "left" };
    },

    async undo() {
      closePanel();
      panel.showTab("mine", { focus: false, remember: false });
      const hide = panel.el.querySelector('input[aria-keyshortcuts="h"]')?.closest("label");
      return { el: panel.el, side: "left", marks: visible(hide) ? [hide] : [] };
    },

    async search() {
      closePanel();
      const input = document.getElementById("site-search-input");
      if (!visible(input)) return null;
      const root = input.closest("[data-searchbar]");
      const before = input.value;
      input.value = "notebook";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      later(() => {
        input.value = before;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        root?.querySelector(".searchbar__close")?.click();
      });
      await wait(200);
      return { el: input, marks: [input] };
    },

    async "notebook-page"() {
      closePanel();
      panel.showTab("mine", { focus: false, remember: false });
      const link = panel.el.querySelector(".desk-panel__page a");
      return { el: panel.el, side: "left", marks: visible(link) ? [link] : [] };
    },

    async kept() {
      closePanel();
      panel.showTab("mine", { focus: false, remember: false });
      const foot = panel.el.querySelector(".desk-home");
      return { el: panel.el, side: "left", marks: visible(foot) ? [foot] : [] };
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
    if (!document.querySelector('#deskPanel [role="tab"][data-tab="greek"]')) {
      ids.delete("greek");
      ids.delete("greek-commands");
    }
    if (!document.querySelector('#deskPanel [role="tab"][data-tab="verse"]')) ids.delete("verse");
    if (!document.querySelector(".desk-gutter")) ids.delete("widths");
    if (view !== "study" ? !textParagraphs().length : !pickVerse()) {
      for (const id of ["actions", "note", "highlight", "bookmark", "ribbon", "margin"]) ids.delete(id);
    }
    return ids;
  };

  /* ── Starting and ending ──────────────────────────────────────── */

  function start({ only = null } = {}) {
    if (run) return;
    closePanel(); // a verse menu or note card open over the text would sit under the tour
    const steps = planTour({ available: available(), only, view });
    if (!steps.length) return;

    // Seen from the moment it starts, so ending early is the same as ending.
    saveTourList(withSeen(parseTourState(getTourRaw()).list, TOUR_STEPS.map((s) => s.id)));
    document.documentElement.setAttribute("data-desk-tour", "");

    run = {
      steps,
      index: 0,
      returnTo: document.activeElement instanceof HTMLElement ? document.activeElement : null,
      snap: panel.snapshot(),
      scroll: { x: window.scrollX, y: window.scrollY },
      verse: view === "study" ? pickVerse() : null,
      selected: false,
      undo: [],
      card: null,
      marked: [],
      token: 0,
      placeFrame: 0,
      target: null,
    };
    const card = document.createElement("div");
    card.className = "desk-tour";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "false");
    card.setAttribute("data-desk-dock", "");
    card.tabIndex = -1;
    card.innerHTML = `
      <p class="desk-tour__count"></p>
      <h3 class="desk-tour__title" id="deskTourTitle"></h3>
      <p class="desk-tour__body" id="deskTourBody"></p>
      <p class="desk-tour__more" hidden><a href="${WAYS_HREF}">Ways to keep your notebook</a></p>
      <div class="desk-tour__row">
        <span class="desk-tour__skips">
          <button type="button" class="desk-tour__skip">Skip the tour</button>
          <button type="button" class="desk-tour__skip desk-tour__skip-part">Skip this part</button>
        </span>
        <span class="desk-tour__nav">
          <button type="button" class="desk-tour__back">Back</button>
          <button type="button" class="desk-tour__next"></button>
        </span>
      </div>`;
    card.setAttribute("aria-labelledby", "deskTourTitle");
    card.setAttribute("aria-describedby", "deskTourBody");
    run.card = card;
    document.body.append(card);

    card.querySelector(".desk-tour__skip").addEventListener("click", () => end());
    card.querySelector(".desk-tour__skip-part").addEventListener("click", () => {
      const next = run.steps[run.index].nextPart;
      if (next === null) end();
      else go(next);
    });
    card.querySelector(".desk-tour__back").addEventListener("click", () => go(run.index - 1));
    card.querySelector(".desk-tour__next").addEventListener("click", () => {
      if (run.index === run.steps.length - 1) end();
      else go(run.index + 1);
    });
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", queuePlace);
    window.addEventListener("scroll", queuePlace, { passive: true });
    go(0);
  }

  function onKey(e) {
    if (e.key !== "Escape" || !run) return;
    e.preventDefault();
    e.stopPropagation();
    end();
  }

  // What a step opened, to undo before the next step and at the end.
  function later(fn) {
    run?.undo.push(fn);
  }

  function undoStep() {
    if (!run) return;
    unmark();
    const fns = run.undo.splice(0).reverse();
    for (const fn of fns) {
      try {
        fn();
      } catch (_) {}
    }
    closePanel();
    setEditorPreview(null);
  }

  function end() {
    if (!run) return;
    const { card, returnTo, snap, scroll } = run;
    run.token++;
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", queuePlace);
    window.removeEventListener("scroll", queuePlace);
    cancelAnimationFrame(run.placeFrame);
    undoStep();
    card.remove();
    run = null;
    // Everything back as the tour found it: the Notebook, then the place on
    // the page (the panel's width can move the text), then focus.
    panel.restore(snap);
    requestAnimationFrame(() => {
      window.scrollTo({ left: scroll.x, top: scroll.y, behavior: "instant" });
      if (returnTo && returnTo.isConnected) returnTo.focus({ preventScroll: true });
      // Held past last-read.js's 500ms wait after a scroll, so the scroll
      // back records nothing, not even a new time on the same verse.
      setTimeout(() => document.documentElement.removeAttribute("data-desk-tour"), 900);
    });
  }

  /* ── One step ─────────────────────────────────────────────────── */

  async function go(i) {
    const step = run.steps[Math.max(0, Math.min(i, run.steps.length - 1))];
    run.index = run.steps.indexOf(step);
    const token = ++run.token;
    undoStep();

    const card = run.card;
    card.querySelector(".desk-tour__count").textContent = `${step.partName} · Step ${step.number} of ${step.of}`;
    card.querySelector(".desk-tour__title").textContent = step.title;
    card.querySelector(".desk-tour__body").textContent = stepBody(step, view);
    card.querySelector(".desk-tour__more").hidden = step.id !== "kept";
    card.querySelector(".desk-tour__back").hidden = run.index === 0;
    card.querySelector(".desk-tour__skip-part").hidden = step.nextPart === null;
    card.querySelector(".desk-tour__next").textContent = run.index === run.steps.length - 1 ? "Done" : "Next";

    let target = null;
    try {
      target = (await STEPS[step.id]?.()) ?? null;
    } catch (err) {
      console.error("Study Desk: a tour step couldn't show itself", err);
    }
    // The reader moved on while this step was opening.
    if (!run || token !== run.token) return;
    // The page may still be settling (the panel opening reflows a Study View
    // chapter), so the target is placed after a frame.
    await frame();
    if (!run || token !== run.token) return;
    if (target?.el) {
      const r = target.el.getBoundingClientRect();
      // A small target scrolled out of sight is brought into view first.
      if (r.height < window.innerHeight * 0.5 && (r.bottom < 0 || r.top > window.innerHeight)) {
        target.el.scrollIntoView({ block: "center", behavior: reduced() ? "auto" : "smooth" });
      }
      const marks = target.marks ?? (r.height < window.innerHeight * 0.5 ? [target.el] : []);
      mark(marks);
    }
    run.target = target;
    place();
    card.classList.add("desk-tour--on");
    card.focus({ preventScroll: true });
  }

  function mark(els) {
    run.marked = els.filter(Boolean);
    for (const e of run.marked) e.classList.add("desk-tour-target");
  }

  function unmark() {
    for (const e of run?.marked ?? []) e.classList.remove("desk-tour-target");
    if (run) run.marked = [];
  }

  /* ── Placing the card beside its target ───────────────────────── */

  function queuePlace() {
    if (!run) return;
    cancelAnimationFrame(run.placeFrame);
    run.placeFrame = requestAnimationFrame(place);
  }

  function place() {
    if (!run?.card) return;
    const card = run.card;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, Math.max(lo, hi)));
    let x = (vw - cw) / 2;
    let y = (vh - ch) / 2;
    const t = run.target;
    if (t?.el?.isConnected) {
      const r = t.el.getBoundingClientRect();
      const tall = r.height > vh * 0.5 || r.width > vw * 0.5;
      const roomRight = vw - r.right;
      const roomLeft = r.left;
      const sideX = () => {
        const wantRight = t.side === "right" ? roomRight >= cw + GAP || roomRight >= roomLeft : t.side === "left" ? roomLeft < cw + GAP && roomRight > roomLeft : roomRight >= roomLeft;
        return wantRight ? r.right + GAP : r.left - cw - GAP;
      };
      if (tall || t.side) {
        x = clamp(sideX(), EDGE, vw - cw - EDGE);
        y = clamp(Math.max(r.top, 0) + 8, EDGE, vh - ch - EDGE);
      } else if (r.bottom + GAP + ch <= vh - EDGE) {
        x = clamp(r.left, EDGE, vw - cw - EDGE);
        y = r.bottom + GAP;
      } else if (r.top - GAP - ch >= EDGE) {
        x = clamp(r.left, EDGE, vw - cw - EDGE);
        y = r.top - GAP - ch;
      } else {
        x = clamp(sideX(), EDGE, vw - cw - EDGE);
        y = clamp(r.top, EDGE, vh - ch - EDGE);
      }
    }
    card.style.left = `${Math.round(x)}px`;
    card.style.top = `${Math.round(y)}px`;
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
