// src/scripts/desk/panel.js
//
// The Notebook panel, in the right margin beside the text (STUDY-DESK.md,
// placement 3; BVJ 2026-10-06: it fills the margin rather than pushing the
// page aside). margin.js places it. It is part of the page frame, not one of
// the shared floating panels (audit C12): they keep clear of it, and a click
// inside it closes none of them.
//
// Not modal: the reader goes on reading with it open, so focus moves in when
// it opens and back to its button when it closes, and nothing is trapped.
// It starts open and minimized (BVJ, 2026-10-13), and a reader who closes
// it is remembered in localStorage['lit-desk-panel'] ("closed", or "open"
// once they open it again), so the next page opens the same way, unless the
// reader chose a start of their own on the notebook page
// (src/lib/desk-start.mjs). Where the margin is wide enough, which it is on most
// computers, nothing moves when it appears.
//
// The reader can minimize it to a tab at the window's edge and restore it
// (BVJ, 2026-10-09), the same tab a window too narrow for it uses: there
// (margin.js says when) it floats, and the reader can collapse and expand it
// the same way (BVJ, 2026-10-07). It collapses by itself whenever it starts floating without
// the reader asking to see it, so it never lands on the text unasked. The
// Notebook buttons then expand it, Escape collapses it rather than closing
// it, and its × still closes it.
//
// Tabs (BVJ, 2026-10-08; "Decisions", the Greek tab, items 1 and 12): "My
// Notes" (tab-mine.js) everywhere, on Study View chapters "This verse"
// (tab-verse.js), and "Greek" (tab-greek.js, phase 1f), which reads the
// SBLGNT with the dictionary beside it, on Study View chapters and on draft
// chapters too (BVJ, 2026-10-13), where there is no LIT text to go with it. A Versions tab is deferred
// indefinitely (BVJ, 2026-10-11). A surface with one tab
// shows no tab row. The tab last chosen is remembered in
// localStorage['lit-desk-tab'] and used wherever the page has it.
//
// The foot belongs to My Notes and shows only with it: the "My notes",
// Handwriting / Plain, "My bookmarks" and "Hide my notes" switches (the same
// settings as the Display tray's), "Reset widths" while the reader has
// dragged any, and where the notebook is kept. (The list's "Open all" is
// My Notes' own, above its list.)

import { keepReadingPlace } from "../keep-reading-place.js";
import { currentPanel } from "../lit-panel.js";
import { createRail } from "./margin.js";
import { HIDE_EVENT, panelNoteControls } from "./note-settings.js";
import { greekChapter, pageChapter } from "./page.js";
import { forChapter } from "../../lib/desk-store-core.mjs";
import { proseRecords, prosePage } from "./note-sources.js";
import { createFirstUse } from "./first-use.js";
import { createMineTab } from "./tab-mine.js";
import { createGreekTab } from "./tab-greek.js";
import { createVerseTab } from "./tab-verse.js";
import { resetWidthsButton } from "./widths.js";
import { MIN_KEY, OPEN_KEY, startState } from "../../lib/desk-start.mjs";

const TAB_KEY = "lit-desk-tab";

const ICON_NOTEBOOK = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 3v18M12.5 8h3M12.5 12h3" /></svg>`;

// Toward the window's edge, where the collapsed tab waits.
const ICON_COLLAPSE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M6 6l6 6-6 6M13 6l6 6-6 6" /></svg>`;

const ICON_CLOSE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" /></svg>`;

/**
 * Build the panel and wire every [data-desk-toggle] on the page to it.
 *
 * @param {{ store: object | null, storeError: unknown,
 *   onEdit?: (record: object, trigger: Element) => void,
 *   onAddNote?: (draft: object, trigger: Element) => void,
 *   goHere?: { can(record: object): boolean, go(record: object): void },
 *   ctx?: () => { client: string, contentVersion: string },
 *   showInText?: { can(record: object): boolean, go(record: object): void },
 *   printNotes?: { can(): boolean, print(): Promise<void> } | null,
 *   printRoom?: { can(): boolean, print(): Promise<void> } | null }} options
 *   `printNotes` is "Print with my notes" (print-notes.js, M6), a button at
 *   the foot on a Study View chapter and in Read View; `printRoom` is "Print
 *   with room to write" (print-room.js, N9), right after it, and needs no
 *   notebook.
 *   `store` is null when this browser can't keep a notebook. `ctx` and
 *   `showInText` are what a change notice's card needs (change-notice.js):
 *   what a write is stamped with, and a way to take the reader to the mark on
 *   the page. `onEdit` opens
 *   a note in the editor, and `onAddNote` a new one; `goHere` takes the reader to a record on this page
 *   without leaving it, where it can (`can`). Elsewhere a record's links go to
 *   its verse in the view the reader is in: Read View from Read View (BVJ,
 *   2026-10-08), Study View from anywhere else.
 * @returns {{ open: (from?: Element) => void, close: () => void,
 *   showTab: (id: string, opts?: { focus?: boolean, remember?: boolean }) => boolean,
 *   showVerse: ((verse: number) => void) | null }}
 *   `showVerse` opens the panel on "This verse" at a verse; null where the
 *   page has no such tab. `el`, `isOpen` and `showTab` are for the tour.
 */
export function createPanel({ store, storeError, onEdit = null, onAddNote = null, goHere = null, ctx = null, showInText = null, printNotes = null, printRoom = null }) {
  const root = document.documentElement;
  const here = pageChapter();
  const greekHere = here ?? greekChapter();
  const toggles = Array.from(document.querySelectorAll("[data-desk-toggle]"));
  const inReadView = Boolean(document.querySelector("[data-rm-root]"));

  const panel = document.createElement("aside");
  panel.id = "deskPanel";
  panel.className = "desk-panel";
  panel.setAttribute("data-desk-dock", "");
  panel.setAttribute("aria-labelledby", "deskPanelTitle");
  panel.tabIndex = -1;
  let startOpen = true;
  try { startOpen = startState((k) => localStorage.getItem(k)).open; } catch (_) {}
  panel.hidden = !startOpen;

  const visible = () => !panel.hidden;

  // What My Notes starts on: this chapter's records, or the notes on this
  // article or the glossary (N11); everything elsewhere.
  const prose = here ? null : prosePage();
  const mineScope = here
    ? {
        label: here.label,
        empty: `Nothing kept for ${here.label} yet.`,
        load: async (st) => forChapter(await st.byChapter(here.bookKey, here.chapter), here.bookKey, here.chapter),
      }
    : prose
      ? {
          label: prose.label,
          empty: prose.kind === "article" ? "No notes on this article yet." : "No notes on the glossary yet.",
          load: async (st) => proseRecords(prose, await st.all()),
        }
      : null;

  // The first-time choice (a card above My Notes), the foot's account of where
  // the notebook is kept, and the tour's offer (first-use.js). `reveal` shows
  // the panel the first time the reader writes something with no answer yet.
  const firstUse = createFirstUse({
    store,
    reveal: () => revealPanel(),
    panelEl: () => panel,
    panelShown: () => shown(),
  });

  // The tabs this page has, in order. Each tab module returns its element
  // and a render(); a tab is drawn only while it is the one showing.
  const TABS = [
    {
      id: "mine",
      label: "My Notes",
      make: () =>
        createMineTab({
          store,
          storeError,
          scope: mineScope,
          addAction: prose?.kind === "article" && onAddNote ? {
            label: "Add a note on this article",
            run: (trigger) => {
              const t = prose.targets[0];
              onAddNote({ [t.type]: t.id, targetTitle: t.title }, trigger);
            },
          } : null,
          inReadView,
          visible: () => visible() && activeTab === "mine",
          afterRender: () => { renderPersistence(); firstUse.refresh({ shown: true }); },
          onEdit,
          goHere,
          ctx,
          showInText,
        }),
    },
    ...(here
      ? [
          {
            id: "verse",
            label: "This verse",
            make: () =>
              createVerseTab({
                store,
                here,
                visible: () => visible() && activeTab === "verse",
                panelOpen: visible,
                onEdit,
                onAddNote,
                goHere,
                ctx,
                showInText,
                greek: { open: openGreekWord },
              }),
          },
        ]
      : []),
    ...(greekHere
      ? [
          {
            id: "greek",
            label: "Greek",
            make: () =>
              createGreekTab({
                here: greekHere,
                visible: () => visible() && activeTab === "greek",
                openVerse: (verse) => showVerse(verse),
              }),
          },
        ]
      : []),
  ];
  const withRow = TABS.length > 1;

  panel.innerHTML = `
    <div class="desk-panel__head">
      <h2 class="desk-panel__title" id="deskPanelTitle">Notebook</h2>
      <span class="desk-panel__badge">Preview</span>
      <button type="button" class="desk-panel__collapse" aria-label="Minimize the notebook" title="Minimize">${ICON_COLLAPSE}</button>
      <button type="button" class="desk-panel__close" aria-label="Close the notebook">${ICON_CLOSE}</button>
    </div>
    ${withRow ? `<div class="desk-panel__tabs" role="tablist" aria-label="Notebook">${TABS.map(
      (t) =>
        `<button type="button" role="tab" id="deskTab-${t.id}" data-tab="${t.id}" aria-controls="deskTabpanel-${t.id}"
           aria-selected="false" tabindex="-1">${escapeHtml(t.label)}</button>`,
    ).join("")}</div>` : ""}
    <div class="desk-panel__foot">
      <div class="desk-panel__settings-slot"></div>
      <p class="desk-panel__page"><a href="/notebook/">Open the notebook page</a></p>
      <p class="desk-panel__kept"></p>
      <p class="desk-panel__persist" hidden></p>
    </div>`;

  // One body per tab, each its own tabpanel, so a tab keeps its place (the
  // verse This verse shows, how far the list is scrolled) while another is
  // showing.
  const foot = panel.querySelector(".desk-panel__foot");
  const tabs = new Map();
  for (const t of TABS) {
    const body = document.createElement("div");
    body.className = "desk-panel__body";
    body.id = `deskTabpanel-${t.id}`;
    body.tabIndex = -1;
    if (withRow) {
      body.setAttribute("role", "tabpanel");
      body.setAttribute("aria-labelledby", `deskTab-${t.id}`);
    }
    foot.before(body);
    tabs.set(t.id, { ...t, body, view: null });
  }

  tabs.get("mine").body.prepend(firstUse.card);
  panel.querySelector(".desk-panel__kept").replaceWith(firstUse.foot);

  let activeTab = TABS[0].id;
  try {
    const kept = localStorage.getItem(TAB_KEY);
    if (kept && tabs.has(kept)) activeTab = kept;
  } catch (_) {}
  // Each tab is built on its own, so one that fails leaves the notebook and
  // its other tabs working, and says so in its place (BA29).
  for (const t of tabs.values()) {
    try {
      t.view = t.make();
    } catch (err) {
      console.error(`Study Desk: the ${t.label} tab didn't load`, err);
      t.view = brokenTab();
    }
    t.body.append(t.view.el);
  }

  // The collapsed notebook, at the window's edge. Its name is its visible
  // word; aria-expanded says the panel is folded away.
  const tab = document.createElement("button");
  tab.type = "button";
  tab.className = "desk-tab";
  tab.setAttribute("data-desk-dock", "");
  tab.setAttribute("aria-controls", "deskPanel");
  tab.setAttribute("aria-expanded", "false");
  tab.innerHTML = `${ICON_NOTEBOOK}<span class="desk-tab__label">Notebook</span>`;

  const rail = createRail(panel, tab, (state) => {
    syncToggles();
    // Focus follows the panel: off it as it folds away, unless the window
    // narrowing did that and focus was elsewhere.
    if (state.collapsed && panel.contains(document.activeElement)) tab.focus({ preventScroll: true });
  });

  const persistLine = panel.querySelector(".desk-panel__persist");
  const tabButtons = Array.from(panel.querySelectorAll('[role="tab"]'));
  let lastToggle = null;

  /* ── Opening and closing ─────────────────────────────────────────── */

  // Expanded means the reader can see it: open, and not folded to its tab.
  const shown = () => !panel.hidden && !rail.state().collapsed;

  // What a window that belongs to the panel needs to know: whether it is
  // showing and which tab (the Greek search's commands window, opened from
  // the Greek tab, closes with either; greek-commands.js).
  const announceState = () =>
    document.dispatchEvent(new CustomEvent("lit:notebook-state", { detail: { shown: shown(), tab: activeTab } }));

  function syncToggles() {
    for (const t of toggles) t.setAttribute("aria-expanded", String(shown()));
    // The tour offer opens beside it the first time it is shown, and closes
    // with it.
    firstUse.panelChanged();
    announceState();
  }

  // On Study View chapters the column narrows from 52 to 48 while the panel
  // is expanded (global.css; BVJ, 2026-10-08), which reflows the text. The
  // rail owns that switch (data-desk-expanded, margin.js) and keeps the line
  // being read where it was, in both directions.
  // `remember: false` (the tour) opens it on this page alone, writing neither
  // key, so a tour cut short leaves nothing behind (BA33).
  function open(from, { focus = true, remember = true } = {}) {
    lastToggle = from ?? lastToggle;
    keepReadingPlace(() => root.setAttribute("data-desk-panel", "open"));
    panel.hidden = false;
    rail.show({ expand: true, remember });
    if (remember) {
      try { localStorage.setItem(OPEN_KEY, "open"); } catch (_) {}
    }
    syncToggles();
    render();
    if (focus) panel.focus({ preventScroll: true });
  }

  function close() {
    keepReadingPlace(() => root.removeAttribute("data-desk-panel"));
    panel.hidden = true;
    rail.hide();
    try { localStorage.setItem(OPEN_KEY, "closed"); } catch (_) {}
    syncToggles();
    // Back to the button that opened it, or the first one showing, unless
    // focus has already gone elsewhere (M1's shortcut closes it from the page).
    if (!panel.contains(document.activeElement) && document.activeElement !== document.body) return;
    const back = [lastToggle, ...toggles].find((t) => t && t.offsetParent !== null);
    back?.focus({ preventScroll: true });
  }

  /** Show the panel without taking focus, and folded to its tab where it would float over the text. */
  function revealPanel() {
    if (shown()) return;
    open(null, { focus: false });
    if (rail.state().floating) collapse();
  }

  function expand() {
    rail.expand();
    panel.focus({ preventScroll: true });
  }

  function collapse() {
    rail.collapse();
    tab.focus({ preventScroll: true });
  }

  // A Notebook button opens the panel, expands it when it's folded to its
  // tab, and closes it when it's showing.
  for (const t of toggles) {
    t.addEventListener("click", (e) => {
      e.stopPropagation();
      if (panel.hidden) open(t);
      else if (rail.state().collapsed) {
        lastToggle = t;
        expand();
      } else close();
    });
  }
  tab.addEventListener("click", (e) => {
    e.stopPropagation();
    expand();
  });
  panel.querySelector(".desk-panel__collapse").addEventListener("click", collapse);
  panel.querySelector(".desk-panel__close").addEventListener("click", close);

  // Escape closes the panel when focus is in it and nothing floating is open
  // over it; a floating panel (lit-panel.js) or the Display tray takes its own
  // Escape first. A floating window (float-window.js: the tour offer, the
  // Greek commands) wears the panels' class but not their slot, and takes
  // Escape only from inside itself, so it doesn't count here (BA24).
  // Floating, it collapses instead, the way a floating window
  // gets out of the way: the text comes back and the notebook stays a tab
  // away. Stopped here, so Study View's Escape fallback (clearing a selected
  // verse) doesn't run as well.
  panel.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (currentPanel()) return;
    const tray = document.getElementById("fontTray");
    if (tray && !tray.hidden) return;
    e.stopPropagation();
    if (rail.state().floating) collapse();
    else close();
  });

  /* ── Tabs ───────────────────────────────────────────────────────── */

  function selectTab(id, { focus = false, remember = true } = {}) {
    if (!tabs.has(id)) return;
    activeTab = id;
    for (const b of tabButtons) {
      const on = b.dataset.tab === id;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    }
    for (const [tid, t] of tabs) t.body.hidden = tid !== id;
    foot.hidden = id !== "mine";
    if (remember) {
      try { localStorage.setItem(TAB_KEY, id); } catch (_) {}
    }
    render();
    announceState();
  }

  for (const b of tabButtons) {
    b.addEventListener("click", () => selectTab(b.dataset.tab));
    b.addEventListener("keydown", (e) => {
      const i = tabButtons.indexOf(b);
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabButtons.length - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      const next = tabButtons[(to + tabButtons.length) % tabButtons.length];
      selectTab(next.dataset.tab, { focus: true });
    });
  }

  /** Draw the tab that is showing. */
  function render() {
    if (panel.hidden) return;
    tabs.get(activeTab).view.render();
  }

  async function renderPersistence() {
    const persisted = await store?.persisted();
    if (persisted === false) {
      persistLine.hidden = false;
      persistLine.textContent = "Your browser may clear it to free up space.";
    } else {
      persistLine.hidden = true;
    }
  }

  /* ── Settings at the foot ───────────────────────────────────────── */

  // The margin's switches only mean something where the margin is: all of
  // them on a Study View chapter, "My bookmarks" alone in Read View, and the
  // notes' two on an article or the glossary (N11). "Hide my notes" (M1)
  // goes with any of them.
  const slot = panel.querySelector(".desk-panel__settings-slot");
  if (here) {
    const controls = panelNoteControls();
    // The widths the reader dragged, Study View's alone (widths.js).
    controls.append(resetWidthsButton("desk-panel__reset"));
    controls.append(...printBox());
    slot.replaceWith(controls);
  }
  else if (inReadView) {
    const controls = panelNoteControls({ notes: false });
    controls.append(...printBox());
    slot.replaceWith(controls);
  }
  else if (prose) slot.replaceWith(panelNoteControls({ bookmarks: false }));
  else slot.remove();

  /**
   * "Print with my notes" (M6) and "Print with room to write" (N9): each a
   * button and the line that says what it does (the line is the button's
   * description, so it is spoken with it). M6's is left out where this page
   * can't print notes or the browser keeps no notebook; N9's only where this
   * page can't print.
   */
  function printBox() {
    const boxes = [];
    if (printNotes?.can()) {
      boxes.push(printButton({
        label: "Print with my notes",
        hintId: "deskPrintHint",
        hint: inReadView
          ? "This book on paper, with my notes beside the text and my highlights tinted."
          : "This chapter on paper, with my notes beside the text and my highlights tinted.",
        print: () => printNotes.print(),
      }));
    }
    // N9 reads nothing from the notebook, so it is here even when `store` is
    // null and `printNotes` with it.
    if (printRoom?.can()) {
      boxes.push(printButton({
        label: "Print with room to write",
        hintId: "deskPrintRoomHint",
        hint: inReadView
          ? "This book on paper, with a ruled margin beside the text to write in."
          : "This chapter on paper, with a ruled margin beside the text to write in.",
        print: () => printRoom.print(),
        room: true,
      }));
    }
    return boxes;
  }

  function printButton({ label, hintId, hint: hintText, print, room = false }) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "desk-panel__print-button";
    button.textContent = label;
    button.setAttribute("aria-describedby", hintId);
    button.addEventListener("click", print);
    const hint = document.createElement("p");
    hint.className = "desk-panel__print-hint";
    hint.id = hintId;
    hint.textContent = hintText;
    const box = document.createElement("div");
    box.className = room ? "desk-panel__print desk-panel__print--room" : "desk-panel__print";
    box.append(button, hint);
    return box;
  }

  // M1 hides everything of the reader's at once, for sharing a screen, and
  // the panel lists it all, so it closes too, unless the reader hid them from
  // inside the panel itself.
  document.addEventListener(HIDE_EVENT, (e) => {
    if (e.detail?.hidden && !panel.hidden && e.detail.from !== "panel") close();
  });

  /* ── Keeping in step ────────────────────────────────────────────── */

  // Another tab's change, or this tab's own: either way the list is redrawn
  // from the database, so every tab shows the same notebook.
  store?.subscribe(() => render());

  // Another tab opening or closing the panel doesn't move this one: each tab
  // keeps its own layout until the next page load.

  if (startOpen) {
    root.setAttribute("data-desk-panel", "open");
    rail.show();
  }
  selectTab(activeTab, { remember: false });
  syncToggles();

  /** Open the panel on "This verse" at `verse`, and put focus on its heading. */
  function showVerse(verse) {
    const verseTab = tabs.get("verse");
    if (!verseTab) return;
    if (panel.hidden) open(null, { focus: false });
    else if (rail.state().collapsed) rail.expand();
    verseTab.view.setVerse(verse);
    selectTab("verse");
    verseTab.view.focusHeading();
  }

  /**
   * Open the Greek tab with a word selected and focused (a word in This
   * verse's Greek). The tour passes `focus: false, remember: false`.
   */
  async function openGreekWord(verse, t, { focus = true, remember = true } = {}) {
    const greekTab = tabs.get("greek");
    if (!greekTab || !showTab("greek", { focus, remember })) return;
    await greekTab.view.selectWord(verse, t, { focus });
  }

  /* ── The tour's snapshot ─────────────────────────────────────────── */

  // The tour opens the panel and its tabs to show them, then puts everything
  // back as it was: the panel shown, minimized or closed, the tab, and the
  // three keys that remember them, so nothing the tour did is remembered.
  const TOUR_KEYS = [OPEN_KEY, MIN_KEY, TAB_KEY];
  function snapshot() {
    const keys = {};
    for (const k of TOUR_KEYS) {
      try { keys[k] = localStorage.getItem(k); } catch (_) { keys[k] = null; }
    }
    return { hidden: panel.hidden, collapsed: rail.state().collapsed, tab: activeTab, keys };
  }

  function restore(s) {
    if (s.hidden) {
      if (!panel.hidden) close();
    } else {
      if (panel.hidden) open(null, { focus: false });
      if (s.collapsed && !rail.state().collapsed) rail.collapse();
      else if (!s.collapsed && rail.state().collapsed) rail.expand();
    }
    selectTab(s.tab, { remember: false });
    for (const k of TOUR_KEYS) {
      try {
        if (s.keys[k] === null) localStorage.removeItem(k);
        else localStorage.setItem(k, s.keys[k]);
      } catch (_) {}
    }
    syncToggles();
  }

  /**
   * Open the panel on a tab (the search box's commands, and the tour). With
   * `focus`, focus goes to the tab; the tour keeps it on its own card and
   * passes `remember: false`, so the reader's last tab is kept, and so is
   * whether the Notebook was closed or minimized. False where this page has
   * no such tab.
   */
  function showTab(id, { focus = true, remember = true } = {}) {
    if (!tabs.has(id)) return false;
    if (panel.hidden) open(null, { focus: false, remember });
    else if (rail.state().collapsed) rail.expand({ remember });
    selectTab(id, { focus, remember });
    return true;
  }

  return {
    open,
    close,
    showTab,
    showVerse: tabs.has("verse") ? showVerse : null,
    // A Greek search result (greek-link.js): the Greek tab, at that word.
    showGreekWord: tabs.has("greek") ? openGreekWord : null,
    // What the tour (tour.js) needs.
    el: panel,
    isOpen: shown,
    snapshot,
    restore,
  };
}

/**
 * A tab that failed to build (BA29): a line saying so where its content would
 * be, and every call the panel makes on a tab's view answered with nothing.
 */
function brokenTab() {
  const el = document.createElement("p");
  el.className = "desk-panel__empty";
  el.textContent = "This tab couldn’t load. Reloading the page may bring it back.";
  return { el, render() {}, setVerse() {}, focusHeading() {}, async selectWord() {} };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
