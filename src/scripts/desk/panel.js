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
// Whether it's open is kept in localStorage['lit-desk-panel'], so the next
// page opens with it. Where the margin is wide enough, which it is on most
// computers, nothing moves when it appears.
//
// In a window too narrow for it (margin.js says when), it floats: the reader
// can collapse it to a tab at the window's edge and expand it again (BVJ,
// 2026-10-07). It collapses by itself whenever it starts floating without
// the reader asking to see it, so it never lands on the text unasked. The
// Notebook buttons then expand it, Escape collapses it rather than closing
// it, and its × still closes it.
//
// Tabs (BVJ, 2026-10-08; "Decisions", the Greek tab, items 1 and 12): "My
// Notes" (tab-mine.js) everywhere, and on Study View chapters "This verse"
// (tab-verse.js). Greek (phase 1f) and Versions (held until the API.bible
// questions are settled) join the TABS table below. A surface with one tab
// shows no tab row. The tab last chosen is remembered in
// localStorage['lit-desk-tab'] and used wherever the page has it.
//
// The foot belongs to My Notes and shows only with it: the "My notes",
// Handwriting / Plain, "My bookmarks" and "Hide my notes" switches (the same
// settings as the Display tray's), the list's "in full" toggle, and where
// the notebook is kept.

import { keepReadingPlace } from "../keep-reading-place.js";
import { createRail } from "./margin.js";
import { HIDE_EVENT, SETTINGS_EVENT, getSetting, panelNoteControls, setSetting } from "./note-settings.js";
import { pageChapter } from "./page.js";
import { createMineTab } from "./tab-mine.js";
import { createVerseTab } from "./tab-verse.js";

const OPEN_KEY = "lit-desk-panel";
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
 *   goHere?: { can(record: object): boolean, go(record: object): void } }} options
 *   `store` is null when this browser can't keep a notebook. `onEdit` opens
 *   a note in the editor, and `onAddNote` a new one; `goHere` takes the reader to a record on this page
 *   without leaving it, where it can (`can`). Elsewhere a record's links go to
 *   its verse in the view the reader is in: Read View from Read View (BVJ,
 *   2026-10-08), Study View from anywhere else.
 * @returns {{ open: (from?: Element) => void, close: () => void,
 *   showVerse: ((verse: number) => void) | null }}
 *   `showVerse` opens the panel on "This verse" at a verse; null where the
 *   page has no such tab.
 */
export function createPanel({ store, storeError, onEdit = null, onAddNote = null, goHere = null }) {
  const root = document.documentElement;
  const here = pageChapter();
  const toggles = Array.from(document.querySelectorAll("[data-desk-toggle]"));
  const inReadView = Boolean(document.querySelector("[data-rm-root]"));

  const panel = document.createElement("aside");
  panel.id = "deskPanel";
  panel.className = "desk-panel";
  panel.setAttribute("data-desk-dock", "");
  panel.setAttribute("aria-labelledby", "deskPanelTitle");
  panel.tabIndex = -1;
  let startOpen = false;
  try { startOpen = localStorage.getItem(OPEN_KEY) === "open"; } catch (_) {}
  panel.hidden = !startOpen;

  const visible = () => !panel.hidden;

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
          here,
          inReadView,
          visible: () => visible() && activeTab === "mine",
          afterRender: renderPersistence,
          onEdit,
          goHere,
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
      <button type="button" class="desk-panel__collapse" aria-label="Collapse the notebook">${ICON_COLLAPSE}</button>
      <button type="button" class="desk-panel__close" aria-label="Close the notebook">${ICON_CLOSE}</button>
    </div>
    ${withRow ? `<div class="desk-panel__tabs" role="tablist" aria-label="Notebook">${TABS.map(
      (t) =>
        `<button type="button" role="tab" id="deskTab-${t.id}" data-tab="${t.id}" aria-controls="deskTabpanel-${t.id}"
           aria-selected="false" tabindex="-1">${escapeHtml(t.label)}</button>`,
    ).join("")}</div>` : ""}
    <div class="desk-panel__foot">
      <div class="desk-panel__settings-slot"></div>
      <label class="desk-setting">
        <input type="checkbox" class="desk-setting__input desk-panel__full" />
        <span class="desk-setting__label">Show notes in full in this list</span>
      </label>
      <p class="desk-panel__kept">Kept in this browser.</p>
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

  let activeTab = TABS[0].id;
  try {
    const kept = localStorage.getItem(TAB_KEY);
    if (kept && tabs.has(kept)) activeTab = kept;
  } catch (_) {}
  for (const t of tabs.values()) {
    t.view = t.make();
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
  function syncToggles() {
    for (const t of toggles) t.setAttribute("aria-expanded", String(shown()));
  }

  // On Study View chapters the column narrows from 52 to 48 while the panel
  // is open (global.css; BVJ, 2026-10-08), which reflows the text, so both
  // directions keep the line being read where it was. Elsewhere nothing
  // reflows and keepReadingPlace does nothing.
  function open(from, { focus = true } = {}) {
    lastToggle = from ?? lastToggle;
    keepReadingPlace(() => root.setAttribute("data-desk-panel", "open"));
    panel.hidden = false;
    rail.show({ expand: true });
    try { localStorage.setItem(OPEN_KEY, "open"); } catch (_) {}
    syncToggles();
    render();
    if (focus) panel.focus({ preventScroll: true });
  }

  function close() {
    keepReadingPlace(() => root.removeAttribute("data-desk-panel"));
    panel.hidden = true;
    rail.hide();
    try { localStorage.removeItem(OPEN_KEY); } catch (_) {}
    syncToggles();
    // Back to the button that opened it, or the first one showing, unless
    // focus has already gone elsewhere (M1's shortcut closes it from the page).
    if (!panel.contains(document.activeElement) && document.activeElement !== document.body) return;
    const back = [lastToggle, ...toggles].find((t) => t && t.offsetParent !== null);
    back?.focus({ preventScroll: true });
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
  // Escape first. Floating, it collapses instead, the way a floating window
  // gets out of the way: the text comes back and the notebook stays a tab
  // away. Stopped here, so Study View's Escape fallback (clearing a selected
  // verse) doesn't run as well.
  panel.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (document.querySelector(".lit-panel")) return;
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
  // them on a Study View chapter, and "My bookmarks" alone in Read View.
  // "Hide my notes" (M1) goes with either.
  const slot = panel.querySelector(".desk-panel__settings-slot");
  if (here) slot.replaceWith(panelNoteControls());
  else if (inReadView) slot.replaceWith(panelNoteControls({ notes: false }));
  else slot.remove();
  const fullBox = panel.querySelector(".desk-panel__full");
  const syncFull = () => {
    fullBox.checked = getSetting("listFull") === "full";
  };
  syncFull();
  fullBox.addEventListener("change", () => setSetting("listFull", fullBox.checked ? "full" : "lines"));
  document.addEventListener(SETTINGS_EVENT, syncFull);

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

  return { open, close, showVerse: tabs.has("verse") ? showVerse : null };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
