// src/scripts/desk/first-stage.js
//
// The Study Desk on a reading page, stage one (Audit 3, LG3-2; BVJ,
// 2026-11-07, decision 3: load the desk lazily). desk-gate.js loads this on a
// page with a reading column. It draws the minimized Notebook's tab (and its
// stylesheet, desk-tab.css, alone), puts the Notebook's switches in the
// Display tray (note-settings.js, which the shell finds already started, so
// the tray, the H key and "Show the Notebook" need no shell; BVJ, 2026-11-07),
// and takes a look at the notebook; the rest of the desk, the shell and
// desk.css, comes only when there is something to draw on this page or the
// reader reaches for it. The rules are src/lib/desk-first-stage.mjs.
//
// The shell loads at once, with no tab drawn here, when the Notebook starts
// expanded, a bookmark is following, or the address asks for a desk action
// (`loadAtOnce`). Otherwise it loads when:
//   - the notebook holds records this page draws (`peekNotebook`: this
//     chapter's in Chapter View, the book's in Read View; nothing elsewhere
//     while N11 is off), or can't say, or another tab writes to it;
//   - the reader presses the tab, Read View's Notebook button or "Skip to
//     the Notebook" (which the Notebook then opens for, so no press is lost),
//     or turns "Show the Notebook" on where the Notebook starts expanded;
//   - the reader starts toward a menu the desk adds to: a verse number or a
//     footnote letter pressed or focused, or words selected (a head start);
//   - an event the desk answers arrives first: `lit:panel-actions`,
//     `lit:footnote-actions`, `lit:desk-command`, `lit:greek-word`. Each is
//     held and sent again once the shell is
//     up; a menu still open then gets its rows late, and is moved to keep its
//     place (`grownPanelShift`).
// If either stage fails to load, the page stands down as it always has.

import { standDown } from "../desk-frame.js";
import { currentPanel } from "../lit-panel.js";
import { startState } from "../../lib/desk-start.mjs";
import { CHANNEL, grownPanelShift, loadAtOnce, loadStageTwo, peekNotebook } from "../../lib/desk-first-stage.mjs";
import { createRail } from "./margin.js";
import { fitGlossaryTitles } from "./glossary-titles.js";
import { addTabStyle, notebookTab } from "./notebook-tab.js";
import { SETTINGS_EVENT, initNoteSettings } from "./note-settings.js";

const root = document.documentElement;
const readLocal = (k) => {
  try { return localStorage.getItem(k); } catch (_) { return null; }
};
const readSession = (k) => {
  try { return sessionStorage.getItem(k); } catch (_) { return null; }
};

// Where this page's records are drawn, read as page.js reads it (which this
// file doesn't import, to stay small): a Chapter View chapter, or Read View's
// book, or null (an intro, an article, the glossary).
function drawnHere() {
  const article = document.querySelector("article.chapter[data-last-read-book]");
  const chapter = Number(article?.dataset.lastReadChapter);
  if (article?.dataset.lastReadBook && chapter && document.querySelector(".chapter-paragraphs")) {
    return { bookKey: article.dataset.lastReadBook, chapter };
  }
  const rm = document.querySelector("[data-rm-root]");
  if (rm?.dataset.rmBook && rm.querySelector("[data-rm-text]")) return { bookKey: rm.dataset.rmBook };
  return null;
}

// A chapter whose Greek the Notebook shows (greekChapter in page.js).
const greekHere = () => Boolean(document.querySelector("article.chapter[data-last-read-book], article.chapter[data-draft-book]"));

/**
 * Run the first stage. Resolves once the tab is drawn and the listeners are
 * on; a throw stands the page down (desk-gate.js).
 * @param {{ importShell?: () => Promise<object> }} [options]
 */
export async function start({ importShell = () => import("./shell.js") } = {}) {
  addTabStyle();
  // First, so the glossary's headings settle as early as they can.
  if (document.querySelector(".glossary-entries")) fitGlossaryTitles();
  // The settings onto <html>, the Display tray's Notebook switches, and H.
  initNoteSettings();

  const where = drawnHere();
  let state = { open: true, minimized: true };
  try { state = startState(readLocal); } catch (_) {}
  const now = loadAtOnce({ start: state, session: readSession, params: new URL(window.location.href).searchParams });
  if (now) {
    await loadStageTwo(importShell, { stand: standDown });
    return;
  }
  const leave = { rail: null, skip: null, teardown: () => {} };
  try {
    await drawAndWait({ where, state, importShell, leave });
  } catch (err) {
    // Gone before the page stands down (desk-gate.js), or the rail would
    // place itself again on the next resize.
    leave.teardown();
    leave.rail?.destroy();
    leave.skip?.remove();
    throw err;
  }
}

async function drawAndWait({ where, state, importShell, leave }) {
  /* ── The tab ─────────────────────────────────────────────────────── */

  // A stand-in for the panel, which the rail needs and never shows: the tab
  // is all this stage draws.
  const stub = document.createElement("aside");
  stub.id = "deskPanel";
  stub.className = "desk-panel";
  stub.hidden = true;
  const tab = notebookTab();
  const rail = createRail(stub, tab, () => {}, { widths: false });
  leave.rail = rail;
  let railShown = false;
  const showRail = (on) => {
    if (on === railShown) return;
    railShown = on;
    if (on) rail.show();
    else rail.hide();
  };
  showRail(state.open);

  // A way in for a keyboard reader, as panel.js adds (NB-4).
  const skip = document.createElement("a");
  skip.href = "#deskPanel";
  skip.className = "skip-link";
  // So desk-tab.css hides it while "Show the Notebook" is off, as panel.js's
  // link is hidden (NB3-10; NB6-1), and the page-text readers pass it over.
  skip.setAttribute("data-desk-skip", "");
  skip.textContent = "Skip to the Notebook";
  const firstSkip = document.querySelector("a.skip-link");
  if (firstSkip) firstSkip.after(skip);
  else document.body.prepend(skip);
  leave.skip = skip;

  /* ── Loading stage two ───────────────────────────────────────────── */

  let loading = null;
  let up = false;
  let openFrom = undefined; // a press to open the Notebook for: an element, or null
  const held = [];
  let hadFocus = false;
  const listeners = [];
  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    listeners.push(() => target.removeEventListener(type, fn, opts));
  };
  let channel = null;

  function teardown() {
    for (const off of listeners.splice(0)) off();
    try { channel?.close(); } catch (_) {}
    channel = null;
  }
  leave.teardown = teardown;

  // Called by the shell just before the panel draws its own tab.
  function handOver() {
    hadFocus = tab === document.activeElement || skip === document.activeElement;
    teardown();
    rail.destroy();
    skip.remove();
  }

  function want() {
    if (loading) return loading;
    loading = loadStageTwo(importShell, {
      handOver,
      stand: () => {
        const focused = tab === document.activeElement || skip === document.activeElement;
        teardown();
        rail.destroy();
        skip.remove();
        standDown();
        // The pressed tab is gone: focus goes to the page's text, not <body> (NB6-2).
        const main = focused && document.getElementById("main-content");
        if (main) {
          if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
          main.focus({ preventScroll: true });
        }
      },
    }).then((api) => {
      up = true;
      busy?.removeAttribute("aria-busy");
      if (!api) return;
      const { panel } = api;
      if (openFrom !== undefined) panel.open(openFrom);
      else if (hadFocus) document.querySelector(".desk-tab")?.focus({ preventScroll: true });
      for (const e of held.splice(0)) replay(e);
    });
    return loading;
  }

  // The reader asked for the Notebook: open it once it is here.
  let busy = null;
  function openWhenUp(from, trigger) {
    openFrom = from;
    busy = trigger;
    trigger.setAttribute("aria-busy", "true");
    want();
  }

  /** Send a held event again, now that the shell listens. */
  function replay({ type, detail }) {
    const panelOf = type === "lit:panel-actions" || type === "lit:footnote-actions";
    if (!panelOf) {
      document.dispatchEvent(new CustomEvent(type, { detail, cancelable: true }));
      return;
    }
    // Only into the menu still open: one closed or replaced since needs no rows.
    const open = currentPanel();
    if (!open || open.el !== detail?.panel) return;
    const el = detail.panel;
    const before = el.getBoundingClientRect();
    const trigger = open.trigger?.getBoundingClientRect?.() ?? null;
    document.dispatchEvent(new CustomEvent(type, { detail }));
    if (el.classList.contains("lit-panel--sheet")) return;
    const dy = grownPanelShift({ before, after: el.getBoundingClientRect(), trigger, viewport: window.innerHeight });
    if (dy) el.style.top = `${(parseFloat(el.style.top) || 0) + dy}px`;
  }

  /* ── What brings it ──────────────────────────────────────────────── */

  on(tab, "click", (e) => {
    e.stopPropagation();
    openWhenUp(null, tab);
  });
  on(skip, "click", (e) => {
    e.preventDefault();
    openWhenUp(null, tab);
  });
  // Read View's Notebook button (the header's are links to /desk).
  for (const t of document.querySelectorAll("button[data-desk-toggle]")) {
    on(t, "click", (e) => {
      e.stopPropagation();
      openWhenUp(t, t);
    });
  }
  // A head start: the pointer on its way to the tab.
  on(tab, "pointerenter", () => want());

  // Toward a menu the desk adds a row to (a head start; the events below are
  // the guarantee). Only where the desk adds one: Chapter View and Read View.
  if (where) {
    const toward = (e) => {
      if (e.target instanceof Element && e.target.closest("sup.vn, .fn-ref a")) want();
    };
    on(document, "pointerdown", toward, true);
    on(document, "focusin", toward);
    on(document, "selectionchange", () => {
      const sel = document.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      const node = sel.getRangeAt(0).commonAncestorContainer;
      const el = node instanceof Element ? node : node.parentElement;
      if (el?.closest(".chapter-paragraphs, [data-rm-text]")) want();
    });
  }

  // Events the shell answers, held until it does.
  const hold = (type, { ifHere = () => true, take = false } = {}) =>
    on(document, type, (e) => {
      if (up || !ifHere(e.detail)) return;
      if (take) e.preventDefault();
      held.push({ type, detail: e.detail });
      want();
    });
  // The verse menu and the selection panel: "My Notebook" (actions.js), in
  // Chapter View and Read View only (the glossary's row is N11's, off).
  hold("lit:panel-actions", { ifHere: (d) => Boolean(where) && (d?.view === "study" || d?.view === "read") });
  // A footnote's popover: Pin and "Add a note" (pins.js), on a chapter.
  hold("lit:footnote-actions", { ifHere: () => Boolean(where?.chapter) });
  hold("lit:desk-command");
  // A Greek result for this chapter: taken now, so the search box keeps its
  // link from loading, and shown by greek-link.js once it is here.
  hold("lit:greek-word", { ifHere: greekHere, take: true });

  // "Show the Notebook" (the Display tray's, or another tab's through
  // note-settings.js), as panel.js follows it: off hides the tab and writes
  // none of the reader's panel keys; on brings the Notebook back as they left
  // it, which needs the shell only where it was left expanded.
  on(document, SETTINGS_EVENT, (e) => {
    if (e.detail?.name !== "show") return;
    if (e.detail.value === "off") {
      root.removeAttribute("data-desk-panel");
      showRail(false);
      return;
    }
    let st = { open: true, minimized: true };
    try { st = startState(readLocal); } catch (_) {}
    if (!st.open) return;
    root.setAttribute("data-desk-panel", "open");
    showRail(true);
    if (!st.minimized) want();
  });

  /* ── The look at the notebook ────────────────────────────────────── */

  if (!globalThis.indexedDB) {
    // As the shell would say: the search box's commands leave out what needs
    // a notebook (BA34). Nothing kept, nothing to draw.
    root.setAttribute("data-desk-no-notebook", "");
    return;
  }
  const look = () =>
    peekNotebook({ idb: indexedDB, KeyRange: IDBKeyRange, where }).then((found) => {
      if (found !== false) want();
    });
  // Another tab's write may be one this page draws, and a page back from the
  // back-forward cache heard none of them.
  if (where && typeof BroadcastChannel === "function") {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => {
      if (!loading) look();
    };
  }
  if (where) on(window, "pageshow", (e) => { if (e.persisted && !loading) look(); });
  await look();
}
