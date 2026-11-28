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
// reader chose a start of their own on All settings (src/lib/desk-start.mjs).
// Where the margin is wide enough, which it is on most computers, nothing
// moves when it appears.
//
// The reader can minimize it to a tab at the window's edge and restore it
// (BVJ, 2026-10-09), the same tab a window too narrow for it uses: there
// (margin.js says when) it floats, and the reader can collapse and expand it
// the same way (BVJ, 2026-10-07). It collapses by itself whenever it starts
// floating without the reader asking to see it, so it never lands on the text
// unasked. The Notebook buttons then expand it, and Escape collapses it. The
// column keeps the open notebook's measure whether it is expanded or
// minimized, so opening and minimizing it move no scripture (BS-15).
//
// Featherboa's Phase 5 (SITE-FEATHERBOA.md, "The Notebook panel" and "Nothing
// interrupts the reader") made it this:
//   - Three tabs (BS-13, ST-61): Notes (tab-mine.js), the chapter in
//     view's notes, highlights, bookmarks, and pinned footnotes, under "This
//     chapter" and a link to the whole notebook; Footnotes (tab-footnotes.js),
//     the chapter in view's footnotes, each whole; and This verse
//     (tab-verse.js), everything about one verse of the page's own chapter,
//     whose Greek words lead into Study at that word. Greek left the panel for
//     Study. A draft chapter's page has Notes alone. The chapter in view
//     follows the reader as the page reads on into the chapters around it
//     (`lit:read-on`, read-on.js). The tab last chosen is remembered in
//     localStorage['lit-desk-tab'] and used wherever the page has it.
//   - The panel takes the margin's column (BS-15): while it is shown
//     (expanded, not folded to its tab) <html data-desk-shown> says so, and
//     the margin leaves the notes to its Notes list (notes-margin.js);
//     minimizing it brings them back.
//   - Its title is a menu, "Notebook ▾" (notebook-menu.js; BS-25 to BS-31):
//     Print…, the whole notebook, Notebook actions, Take the tour, Help, and
//     Feedback. The Settings tab is gone and nothing in it is lost (DI-17):
//     its switches are the Display tray's and All settings', where the
//     notebook is kept is the foot line, and the rest is the title menu.
//   - "Start here: Take the tour" heads it until the tour is taken or the
//     reader says they know their way around (NX-19, NX-20), and its foot
//     line says where the notebook is kept and when a backup is due (BS-23,
//     NX-07, NX-16; first-use.js). Nothing opens by itself or asks to be
//     dismissed: the card that asked where the notebook is kept, its dot on
//     the tab, the backup reminder's bar and dots, and the tour's floating
//     offer are gone.
//
// The Notebook has no way to close from its own controls (BVJ, 2026-10-29): it
// only minimizes to its tab, and Escape minimizes too.

import { keepReadingPlace } from "../keep-reading-place.js";
import { currentPanel } from "../lit-panel.js";
import { createRail } from "./margin.js";
import { HIDE_EVENT } from "./note-settings.js";
import { chapterOnPage, greekChapter, pageChapter } from "./page.js";
import { printPlain } from "./print-link.js";
import { NO_CHAPTER_KINDS, QUIET_KINDS, forChapter } from "../../lib/desk-store-core.mjs";
import { proseRecords, prosePage } from "./note-sources.js";
import { createFootLine, createStartHere, replyAtFirstUse, requestTour } from "./first-use.js";
import { createMineTab } from "./tab-mine.js";
import { createFootnotesTab } from "./tab-footnotes.js";
import { notebookTab } from "./notebook-tab.js";
import { createNotebookMenu } from "./notebook-menu.js";
import { MIN_KEY, OPEN_KEY, startState } from "../../lib/desk-start.mjs";
import { DESK_STAGE, SHOW_ME_HOW } from "../../lib/desk-first-use.mjs";
import { greekWordHref } from "../../lib/greek-detect.mjs";
import { icon } from "../../lib/icons.mjs";
import { escapeHtml } from "./dom.js";
import { setTip } from "../tip.js";

const TAB_KEY = "lit-desk-tab";

// How long the foot line waits after the notebook changes before reading it
// again, so a run of writes reads it once.
const FOOT_DELAY_MS = 400;

/**
 * Build the panel and wire every button[data-desk-toggle] on the page to it.
 * (The header's Notebook controls are links to /desk, not toggles.)
 *
 * @param {{ store: object | null, storeError: unknown,
 *   onEdit?: (record: object, trigger: Element) => void,
 *   onAddNote?: (draft: object, trigger: Element) => void,
 *   goHere?: { can(record: object): boolean, go(record: object): void },
 *   ctx?: () => { client: string, contentVersion: string },
 *   showInText?: { can(record: object): boolean, go(record: object): void },
 *   printNotes?: { can(): boolean, print(): Promise<void> } | null,
 *   printRoom?: { can(): boolean, print(): Promise<void> } | null }} options
 *   `printNotes` is "Print with my notes" (print-notes.js, M6) and `printRoom`
 *   "Print with room to write" (print-room.js, N9, which needs no notebook);
 *   the title menu's "Print…" opens the shared Print menu (print-menu.js, E16)
 *   on a chapter's page that can print.
 *   `store` is null when this browser can't keep a notebook. `ctx` and
 *   `showInText` are what a change notice's card needs (change-notice.js):
 *   what a write is stamped with, and a way to take the reader to the mark on
 *   the page. `onEdit` opens a note in the editor, and `onAddNote` a new one;
 *   `goHere` takes the reader to a record on this page without leaving it,
 *   where it can (`can`). Elsewhere a record's links go to its verse on its
 *   chapter's page.
 * @returns {{ open: (from?: Element | null, opts?: { focus?: boolean, remember?: boolean }) => void,
 *   close: () => void,
 *   showTab: (id: string, opts?: { focus?: boolean, remember?: boolean }) => boolean,
 *   showVerse: ((verse: number, opts?: { notes?: boolean }) => void) | null,
 *   showChapter: ((bookKey: string, chapter: number) => void) | null,
 *   showFootnote: ((id: string) => boolean) | null,
 *   el: HTMLElement, isOpen: () => boolean,
 *   snapshot: () => object, restore: (s: object) => void }}
 *   `showVerse` opens the panel on "This verse" at a verse, and `showChapter`
 *   at "This chapter" (the reading page's Go deeper); null where the page has
 *   no such tab. `el`, `isOpen`, `showTab`, `snapshot` and `restore` are for
 *   the tour.
 */
export function createPanel({ store, storeError, onEdit = null, onAddNote = null, goHere = null, ctx = null, showInText = null, printNotes = null, printRoom = null }) {
  const root = document.documentElement;
  const here = pageChapter();
  // A draft chapter's page, which has no LIT text yet: its chapter, for Notes.
  const draftHere = here ? null : greekChapter();
  // The page's own chapter as the Notebook names it (page.js).
  const own = here
    ? chapterOnPage(here.bookKey, here.chapter)
    : draftHere
      ? chapterOnPage(draftHere.bookKey, draftHere.chapter)
      : null;
  const toggles = Array.from(document.querySelectorAll("button[data-desk-toggle]"));

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

  /* ── The chapter in view ─────────────────────────────────────────── */

  // What Notes and Footnotes list: the page's own chapter until the page
  // reads on, then whichever chapter the reader is in (read-on.js says so as
  // they move). A reload lands on the page's own chapter, since the address
  // follows the chapter in view.
  let inView = own;

  /* ── Tabs ───────────────────────────────────────────────────────── */

  // What Notes lists: beside a chapter, the chapter in view's records; on an
  // article or the glossary, the notes on this page (N11); everything
  // elsewhere. With N11 out of version 1 prosePage() is null, so an article
  // and the glossary list everything, notes already kept on them included,
  // and no panel shows there (E124).
  const prose = own ? null : prosePage();
  const emptyLine = (p) =>
    p?.draft
      ? `${p.label} ${p.plural ? "are" : "is"} still being translated.`
      : `No notes on ${p?.label ?? own?.label ?? ""} yet. Select a verse number or any words, then choose Note, Highlight, or Bookmark.`;
  const mineScope = own
    ? {
        label: own.label,
        dynamic: true,
        empty: (p) => emptyLine(p ?? inView),
        load: async (st, p) => {
          const at = p ?? inView;
          return at && !at.draft ? forChapter(await st.byChapter(at.bookKey, at.chapter), at.bookKey, at.chapter) : [];
        },
      }
    : prose
      ? {
          label: prose.label,
          empty: prose.kind === "article" ? "No notes on this article yet." : "No notes on the glossary yet.",
          load: async (st) => proseRecords(prose, await st.all()),
        }
      : null;

  // The tabs this page has, in order. Each tab module returns its element
  // and a render(); a tab is drawn only while it is the one showing.
  const TABS = [
    {
      id: "mine",
      label: "Notes",
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
          inReadView: false,
          inPanel: Boolean(own),
          // "Show me how" (NX-13): the tour, under the line a chapter with
          // nothing kept shows; a draft has nothing to mark yet.
          emptyAction: own ? { label: SHOW_ME_HOW, run: () => requestTour(), when: (p) => !(p ?? inView)?.draft } : null,
          // Drawn only while expanded: a minimized Notebook would rebuild its list on every
          // change, a bookmark's moves every two seconds included (NB8-3).
          visible: () => shown() && activeTab === "mine",
          onEdit,
          goHere,
          ctx,
          showInText,
        }),
    },
    ...(here
      ? [
          {
            id: "footnotes",
            label: "Footnotes",
            make: () => createFootnotesTab({ store, place: () => inView, visible: () => shown() && activeTab === "footnotes" }),
          },
          {
            id: "verse",
            label: "This verse",
            make: () =>
              lazyTab(() => import("./tab-verse.js").then((m) => m.createVerseTab), {
                listensForVerse: visible,
              }, {
                store,
                here,
                visible: () => shown() && activeTab === "verse",
                panelOpen: visible,
                onEdit,
                onAddNote,
                goHere,
                ctx,
                showInText,
                // A word of the verse's Greek opens Study at the verse, its
                // Greek pane at that word (ST-62; Greek left the Notebook, BS-13).
                greek: { href: (verse, t) => greekWordHref({ book: here.bookKey, chapter: here.chapter, verse, t }) },
              }),
          },
        ]
      : []),
  ];
  const withRow = TABS.length > 1;

  const stage = `${DESK_STAGE.charAt(0).toUpperCase()}${DESK_STAGE.slice(1)}`;
  panel.innerHTML = `
    <div class="desk-panel__head">
      <div class="desk-panel__name">
        <h2 class="desk-panel__title" id="deskPanelTitle"><button type="button" class="kit-btn kit-btn--plain desk-panel__title-button"
          aria-haspopup="menu" aria-expanded="false" aria-controls="deskPanelMenu"><span class="desk-panel__title-text">Notebook</span>${icon("down", { size: 16 })}</button></h2>
        <span class="desk-panel__badge">${stage}</span>
      </div>
      <button type="button" class="kit-icon desk-panel__collapse" aria-label="Minimize the Notebook">${icon("forward")}</button>
    </div>
    ${withRow ? `<div class="kit-tabs desk-panel__tabs" role="tablist" aria-label="Notebook">${TABS.map(
      (t) =>
        `<button type="button" class="kit-tab" role="tab" id="deskTab-${t.id}" data-tab="${t.id}" aria-controls="deskTabpanel-${t.id}"
           aria-selected="false" tabindex="-1">${escapeHtml(t.label)}</button>`,
    ).join("")}</div>` : ""}
    `;
  const titleButton = panel.querySelector(".desk-panel__title-button");
  const collapseButton = panel.querySelector(".desk-panel__collapse");

  // "Start here" heads the Notebook, under its title, until the tour is taken
  // (NX-19, NX-20); "I know my way around" takes it away and gives focus to
  // the title, whose menu holds the tour from then on.
  const startHere = createStartHere({ afterSkip: () => titleButton.focus({ preventScroll: true }) });
  panel.querySelector(".desk-panel__head").after(startHere.el);

  // One body per tab, each its own tabpanel, so a tab keeps its place (the
  // verse This verse shows, how far the list is scrolled) while another is
  // showing.
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
    panel.append(body);
    tabs.set(t.id, { ...t, body, view: null });
  }

  // The foot line, under every tab: where the notebook is kept, "Back up…",
  // and when a backup is due, the last one's age (BS-23, NX-16); in a browser
  // that syncs, the sync's own status line in the same place (NX-15).
  const foot = createFootLine({ store });
  panel.append(foot.el);

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

  // The collapsed notebook, at the window's edge: the same tab the first
  // stage drew, if it drew one (notebook-tab.js).
  const tab = notebookTab();

  // Whether hiding the marks folded the panel, so un-hiding opens it again
  // (below). Any other fold or expand, the reader's own included, makes that
  // untrue: the callback clears the flag unless the hide handler is the one
  // folding (NB3-7).
  let foldedByHide = false;
  let foldingByHide = false;
  const rail = createRail(panel, tab, (state) => {
    if (!foldingByHide) foldedByHide = false;
    syncToggles();
    if (!state.collapsed) render();
    // Focus follows the panel: off it as it folds away, unless the window
    // narrowing did that and focus was elsewhere.
    if (state.collapsed && panel.contains(document.activeElement)) tab.focus({ preventScroll: true });
  });

  // The title menu (notebook-menu.js), hanging from the title over the notes.
  // Print… opens the shared Print menu on a chapter's page that can print:
  // its picker starts at the chapter in view, which prints here when it is
  // the page's own, and any other chapter opens its page in a new tab, ready
  // to print (a plain print of this page prints the chapter in view, and the
  // Study Desk's own prints the page's chapter, read-on.js).
  const ownPrint = here ? { bookKey: here.bookKey, chapter: here.chapter } : null;
  const inViewIsOwn = () => Boolean(here && inView && inView.bookKey === here.bookKey && inView.chapter === here.chapter);
  const menu = createNotebookMenu({
    button: titleButton,
    host: panel,
    print: here && printRoom?.can()
      ? {
          start: () => (inView && !inView.draft && !inView.failed ? { bookKey: inView.bookKey, chapter: inView.chapter } : ownPrint),
          here: () => (inViewIsOwn() ? ownPrint : null),
          notebook: Boolean(store),
          inPlace: {
            plain: printPlain,
            notes: () => printNotes?.print(),
            room: () => printRoom.print(),
          },
        }
      : null,
    onTour: () => requestTour(),
    beside: panel,
  });

  const tabButtons = Array.from(panel.querySelectorAll('[role="tab"]'));
  let lastToggle = null;

  /* ── Opening and closing ─────────────────────────────────────────── */

  // Expanded means the reader can see it: open, and not folded to its tab.
  const shown = () => !panel.hidden && !rail.state().collapsed;

  // Notes names the chapter in view from the start. Here, not where the tabs
  // are built: following draws the list when it shows, which asks `shown`,
  // and that needs the rail.
  if (own) tabs.get("mine").view.follow?.(inView);

  function syncToggles() {
    const on = shown();
    for (const t of toggles) t.setAttribute("aria-expanded", String(on));
    // While it shows, the notes are its Notes list, not beside their lines
    // (BS-15; notes-margin.js reads this).
    root.toggleAttribute("data-desk-shown", on);
    if (!on) {
      menu.close({ focus: false });
      menu.closePrint({ focus: false });
    }
  }

  // Opening fades the panel in at the Settled speed ("Motion": panels);
  // minimizing is at once. Only when the reader opens it, never on a page
  // that starts with it showing.
  function fadeIn() {
    panel.classList.add("desk-panel--opening");
  }
  panel.addEventListener("animationend", () => panel.classList.remove("desk-panel--opening"));

  // The column keeps the open notebook's measure, minimized or expanded
  // (global.css; BS-15). The rail owns that switch (data-desk-expanded,
  // margin.js) and keeps the line being read where it was.
  // `remember: false` (the tour) opens it on this page alone, writing neither
  // key, so a tour cut short leaves nothing behind (BA33).
  function open(from, { focus = true, remember = true } = {}) {
    lastToggle = from ?? lastToggle;
    keepReadingPlace(() => root.setAttribute("data-desk-panel", "open"));
    panel.hidden = false;
    fadeIn();
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

  function expand() {
    fadeIn();
    rail.expand();
    panel.focus({ preventScroll: true });
  }

  function collapse() {
    rail.collapse();
    tab.focus({ preventScroll: true });
  }

  // A Notebook button opens the panel, expands it when it's folded to its
  // tab, and minimizes it when it's showing.
  for (const t of toggles) {
    t.addEventListener("click", (e) => {
      e.stopPropagation();
      if (panel.hidden) open(t);
      else if (rail.state().collapsed) {
        lastToggle = t;
        expand();
      } else collapse();
    });
  }
  tab.addEventListener("click", (e) => {
    e.stopPropagation();
    expand();
  });
  // A glyph with no words: the shared tooltip, on hover and on keyboard focus (E72).
  setTip(collapseButton, "Minimize the Notebook");
  collapseButton.addEventListener("click", collapse);

  // Escape minimizes the panel when focus is in it and nothing floating is open
  // over it; a floating panel (lit-panel.js) or the Display tray takes its own
  // Escape first, and so do the title menu and its Print window. A floating
  // window (float-window.js: the Notebook actions) wears the panels' class but
  // not their slot, and takes Escape only from inside itself, so it doesn't
  // count here (BA24). Floating, it collapses instead, the way a floating window
  // gets out of the way: the text comes back and the notebook stays a tab
  // away. Stopped here, so the reading page's Escape fallback (clearing a
  // selected verse) doesn't run as well.
  panel.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (currentPanel()) return;
    const tray = document.getElementById("fontTray");
    if (tray && !tray.hidden) return;
    // In a search field holding words, Escape means "clear this" and nothing
    // else (NB3-6, LV3-1). Cleared here rather than left to the browser, which
    // sends no `input` for it and in some engines doesn't clear at all; the
    // field's owner hears an ordinary `input`. The next Escape folds the panel.
    const t = e.target;
    if (t instanceof HTMLInputElement && t.type === "search" && t.value !== "") {
      e.preventDefault();
      e.stopPropagation();
      t.value = "";
      t.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    e.stopPropagation();
    collapse();
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
    // Not while folded to its tab: nobody can see it, and the rail draws it
    // once when it expands (NB8-3).
    if (!shown()) return;
    tabs.get(activeTab).view.render();
  }

  // M1 hides everything of the reader's at once, for sharing a screen, and
  // the panel lists it all, so it folds to its tab (Audit 2, NB-1; BVJ,
  // 2026-11-03: decision 1 of Audit 2). It used to close, and with the header's
  // Notebook buttons now links to /desk nothing on the page brought it back.
  // Un-hiding opens it again only if hiding was what folded it. Focus stays
  // where it is, as the close did.
  // (`foldedByHide` and `foldingByHide` are declared above the rail, whose
  // change callback clears the first on any other fold or expand; NB3-7.)
  document.addEventListener(HIDE_EVENT, (e) => {
    if (e.detail?.from === "panel") return;
    if (e.detail?.hidden) {
      if (panel.hidden || rail.state().collapsed) return;
      foldingByHide = true;
      try { rail.collapse(); } finally { foldingByHide = false; }
      foldedByHide = true;
    } else if (foldedByHide) {
      foldedByHide = false;
      if (!panel.hidden && rail.state().collapsed) rail.expand();
    }
  });

  /* ── Keeping in step ────────────────────────────────────────────── */

  // Another tab's change, or this tab's own: either way the list is redrawn
  // from the database, so every tab shows the same notebook. Not a place or a
  // sheet: Notes lists neither, and a sheet autosaves every few hundred
  // milliseconds in another tab (NB8-1). A bookmark moving is heard (NB8-3).
  store?.subscribe(() => render(), { except: NO_CHAPTER_KINDS });
  // Notes' What's new line reads the notebook's meta, which the notebook
  // page moves on when it is looked at, in any tab (BA96); the foot line
  // reads the last backup's time there.
  store?.onMeta?.(() => {
    render();
    refreshFoot();
  });
  // The foot line: whether the notebook holds anything, and since when. A
  // place and a bookmark's moves change neither, and a sheet or a collection
  // is left to the next time the window takes focus (createFootLine), since a
  // sheet in another tab autosaves every few hundred milliseconds (NB8-1).
  let footTimer = 0;
  function refreshFoot() {
    clearTimeout(footTimer);
    footTimer = setTimeout(() => foot.refresh(), FOOT_DELAY_MS);
  }
  store?.subscribe(refreshFoot, { except: [...NO_CHAPTER_KINDS, ...QUIET_KINDS] });

  // The chapter in view, as the reader moves through the chapters the page
  // has read on into (read-on.js): Notes and Footnotes follow it. A chapter
  // that failed and then loaded on "Try again" is read again.
  document.addEventListener("lit:read-on", (e) => {
    const d = e.detail;
    if (!own || !d?.book || !d.chapter) return;
    const chapter = Number(d.chapter);
    if (d.type === "loaded" && !(inView?.bookKey === d.book && inView.chapter === chapter)) return;
    if (d.type !== "place" && d.type !== "loaded") return;
    const at = chapterOnPage(d.book, chapter);
    if (!at) return;
    inView = at;
    tabs.get("mine").view.follow?.(inView);
    if (activeTab === "footnotes") render();
  });

  // Another tab opening or closing the panel doesn't move this one: each tab
  // keeps its own layout until the next page load.

  if (startOpen) {
    root.setAttribute("data-desk-panel", "open");
    rail.show();
  }
  selectTab(activeTab, { remember: false });
  syncToggles();
  // The sync's status line draws into the foot's slot in a browser that
  // syncs (sync/status-line.js); everywhere else nothing hears this.
  foot.showSlot();
  // The first highlight, note, or bookmark offers the tour in the line its
  // action brings (NX-21).
  replyAtFirstUse({ store });

  /**
   * Open the panel on "This verse" at `verse`, and put focus on its heading,
   * or with `notes`, bring its notes into view and mark them (E147: the
   * margin's "N more notes").
   */
  function showVerse(verse, { notes = false } = {}) {
    const verseTab = tabs.get("verse");
    if (!verseTab) return;
    if (panel.hidden) open(null, { focus: false });
    else if (rail.state().collapsed) {
      fadeIn();
      rail.expand();
    }
    verseTab.view.setVerse(verse);
    selectTab("verse");
    if (notes) verseTab.view.showNotes?.();
    else verseTab.view.focusHeading();
  }

  /**
   * Open the panel on Footnotes at one of the chapter in view's notes, by its
   * id on the page: a pinned footnote's link, where the page's list is out of
   * the flow (pins.js, WB-18). False where the tab doesn't hold it.
   */
  function showFootnote(id) {
    const fnTab = tabs.get("footnotes");
    if (!fnTab) return false;
    if (panel.hidden) open(null, { focus: false });
    else if (rail.state().collapsed) {
      fadeIn();
      rail.expand();
    }
    selectTab("footnotes");
    return Boolean(fnTab.view.showNote?.(id));
  }

  /**
   * Open the panel on "This verse" at "This chapter," a chapter's Go deeper
   * rows (the reading page's Go deeper, WB-18; commands.js).
   */
  function showChapter(bookKey, chapter) {
    const verseTab = tabs.get("verse");
    if (!verseTab || !bookKey || !chapter) return;
    if (panel.hidden) open(null, { focus: false });
    else if (rail.state().collapsed) {
      fadeIn();
      rail.expand();
    }
    selectTab("verse");
    verseTab.view.showChapter?.(bookKey, chapter);
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
    else if (rail.state().collapsed) {
      fadeIn();
      rail.expand({ remember });
    }
    selectTab(id, { focus, remember });
    return true;
  }

  // A way in for a keyboard reader (NB-4; BVJ, 2026-11-04: a skip link). The
  // panel comes after the footer in the page, so this sits beside "Skip to
  // content", visible only while focused, and opens, expands and focuses it.
  const skipToNotebook = document.createElement("a");
  skipToNotebook.href = "#deskPanel";
  skipToNotebook.className = "skip-link";
  // Marked as the desk's own, so no reader of the page's text counts it
  // (desk-prose-anchor.mjs). "Show the Notebook," which hid it (NB3-10), is
  // gone since Featherboa's Phase 4.
  skipToNotebook.setAttribute("data-desk-skip", "");
  skipToNotebook.textContent = "Skip to the Notebook";
  skipToNotebook.addEventListener("click", (e) => {
    e.preventDefault();
    if (panel.hidden) open(skipToNotebook);
    else if (rail.state().collapsed) expand();
    else panel.focus({ preventScroll: true });
  });
  const firstSkip = document.querySelector("a.skip-link");
  if (firstSkip) firstSkip.after(skipToNotebook);
  else document.body.prepend(skipToNotebook);

  return {
    open,
    close,
    showTab,
    showVerse: tabs.has("verse") ? showVerse : null,
    showChapter: tabs.has("verse") ? showChapter : null,
    showFootnote: tabs.has("footnotes") ? showFootnote : null,
    // What the tour (tour.js) needs.
    el: panel,
    isOpen: shown,
    snapshot,
    restore,
  };
}

/**
 * A tab whose module comes only when the tab is first drawn (Audit 2, LG-10):
 * the Notebook starts minimized, so a reader who never opens This verse never
 * downloads it. It stands in for the real view with the same few methods and
 * holds a call made before the module arrives (a verse to show) until it
 * does. `listensForVerse` repeats This verse's own rule, that a verse menu
 * opened while the Notebook is open moves the tab to that verse, for the time
 * before the tab exists.
 */
function lazyTab(load, { listensForVerse } = {}, options) {
  const el = document.createElement("div");
  el.style.display = "contents";
  let real = null;
  let loading = null;
  let wantVerse = null;
  let wantFocus = false;
  const onActions = (e) => {
    const d = e.detail;
    if (real || d?.kind !== "verse" || d.view !== "study" || !listensForVerse?.()) return;
    // A chapter the reading page loaded beside the page's isn't This verse's.
    const here = pageChapter();
    if (d.chapter && here && (d.book !== here.bookKey || d.chapter !== here.chapter)) return;
    wantVerse = d.start;
  };
  if (listensForVerse) document.addEventListener("lit:panel-actions", onActions);

  function ready() {
    if (real) return Promise.resolve(real);
    loading ??= load()
      .then((create) => {
        real = create(options);
        document.removeEventListener("lit:panel-actions", onActions);
        el.replaceChildren(real.el);
        if (wantVerse != null) real.setVerse(wantVerse);
        if (wantFocus) real.focusHeading();
        return real;
      })
      .catch((err) => {
        console.error("Study Desk: a tab didn't load", err);
        loading = null; // the next draw asks again
        const broken = brokenTab();
        el.replaceChildren(broken.el);
        return null;
      });
    return loading;
  }

  return {
    el,
    render() {
      if (!real) el.replaceChildren(Object.assign(document.createElement("p"), { className: "desk-panel__empty", textContent: "Loading…" }));
      ready().then((v) => v?.render());
    },
    setVerse(verse) {
      wantVerse = verse;
      real?.setVerse(verse);
    },
    focusHeading() {
      if (real) real.focusHeading();
      else wantFocus = true;
    },
    async showNotes() {
      const v = await ready();
      return v?.showNotes?.();
    },
    async showChapter(...args) {
      const v = await ready();
      return v?.showChapter?.(...args);
    },
    destroy: () => {
      document.removeEventListener("lit:panel-actions", onActions);
      real?.destroy?.();
    },
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
  return { el, render() {}, setVerse() {}, focusHeading() {} };
}
