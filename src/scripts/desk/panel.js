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
// Phase 1b holds the frame only: a list of what the notebook keeps, with
// Delete, and (preview only) a way to add a sample note so delete, undo and
// the tabs keeping in step can be tried before 1c brings the real ways in.

import { createRecord, verseCopyFor } from "../../lib/desk-records.mjs";
import { forChapter, kindName, liveRecords, recordHref, recordReference } from "../../lib/desk-store-core.mjs";
import { pageAnchorText } from "../../lib/desk-anchor-dom.mjs";
import { bookKeyToLabel } from "../../data/books.js";
import { createRail } from "./margin.js";
import { showUndo } from "./undo-bar.js";

const OPEN_KEY = "lit-desk-panel";

/** The Study View chapter this page shows, or null (an intro, a draft, Read View, any other page). */
function pageChapter() {
  const article = document.querySelector("article.chapter[data-last-read-book]");
  const bookKey = article?.dataset.lastReadBook;
  const chapter = Number(article?.dataset.lastReadChapter);
  return bookKey && chapter ? { bookKey, chapter, label: `${bookKeyToLabel(bookKey)} ${chapter}` } : null;
}

const ICON_CLOSE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" /></svg>`;

/**
 * Build the panel and wire every [data-desk-toggle] on the page to it.
 *
 * @param {{ store: object | null, storeError: unknown, ctx: () => object }} options
 *   `store` is null when this browser can't keep a notebook.
 */
export function createPanel({ store, storeError, ctx }) {
  const root = document.documentElement;
  const here = pageChapter();
  const toggles = Array.from(document.querySelectorAll("[data-desk-toggle]"));

  const panel = document.createElement("aside");
  panel.id = "deskPanel";
  panel.className = "desk-panel";
  panel.setAttribute("data-desk-dock", "");
  panel.setAttribute("aria-labelledby", "deskPanelTitle");
  panel.tabIndex = -1;
  let startOpen = false;
  try { startOpen = localStorage.getItem(OPEN_KEY) === "open"; } catch (_) {}
  panel.hidden = !startOpen;

  const tabs = [
    ...(here ? [{ id: "chapter", label: here.label }] : []),
    { id: "everything", label: "Everything" },
  ];

  panel.innerHTML = `
    <div class="desk-panel__head">
      <h2 class="desk-panel__title" id="deskPanelTitle">Notebook</h2>
      <span class="desk-panel__badge">Preview</span>
      <button type="button" class="desk-panel__close" aria-label="Close the notebook">${ICON_CLOSE}</button>
    </div>
    ${tabs.length > 1 ? `<div class="desk-panel__tabs" role="tablist" aria-label="Notebook">${tabs
      .map(
        (t, i) =>
          `<button type="button" role="tab" id="deskTab-${t.id}" data-tab="${t.id}" aria-controls="deskTabpanel"
             aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${escapeHtml(t.label)}</button>`,
      )
      .join("")}</div>` : ""}
    <div class="desk-panel__body" id="deskTabpanel" ${tabs.length > 1 ? `role="tabpanel" aria-labelledby="deskTab-${tabs[0].id}"` : ""} tabindex="-1">
      <ul class="desk-list"></ul>
      <p class="desk-panel__empty" hidden></p>
    </div>
    ${here && store ? `
    <div class="desk-panel__preview">
      <p>Preview only, until the verse menu can make notes:</p>
      <button type="button" class="desk-panel__sample">Add a sample note to ${escapeHtml(here.label)}:1</button>
    </div>` : ""}
    <div class="desk-panel__foot">
      <p class="desk-panel__kept">Kept in this browser.</p>
      <p class="desk-panel__persist" hidden></p>
    </div>`;
  const rail = createRail(panel);

  const list = panel.querySelector(".desk-list");
  const empty = panel.querySelector(".desk-panel__empty");
  const body = panel.querySelector(".desk-panel__body");
  const persistLine = panel.querySelector(".desk-panel__persist");
  const tabButtons = Array.from(panel.querySelectorAll('[role="tab"]'));
  let activeTab = tabs[0].id;
  let lastToggle = null;

  /* ── Opening and closing ─────────────────────────────────────────── */

  const syncToggles = () => {
    for (const t of toggles) t.setAttribute("aria-expanded", String(!panel.hidden));
  };

  function open(from) {
    lastToggle = from ?? lastToggle;
    root.setAttribute("data-desk-panel", "open");
    panel.hidden = false;
    rail.show();
    try { localStorage.setItem(OPEN_KEY, "open"); } catch (_) {}
    syncToggles();
    render();
    panel.focus({ preventScroll: true });
  }

  function close() {
    root.removeAttribute("data-desk-panel");
    panel.hidden = true;
    rail.hide();
    try { localStorage.removeItem(OPEN_KEY); } catch (_) {}
    syncToggles();
    // Back to the button that opened it, or the first one showing.
    const back = [lastToggle, ...toggles].find((t) => t && t.offsetParent !== null);
    back?.focus({ preventScroll: true });
  }

  for (const t of toggles) {
    t.addEventListener("click", (e) => {
      e.stopPropagation();
      if (panel.hidden) open(t);
      else close();
    });
  }
  panel.querySelector(".desk-panel__close").addEventListener("click", close);

  // Escape closes the panel when focus is in it and nothing floating is open
  // over it; a floating panel (lit-panel.js) or the Display tray takes its own
  // Escape first. Stopped here, so Study View's Escape fallback (clearing a
  // selected verse) doesn't run as well.
  panel.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (document.querySelector(".lit-panel")) return;
    const tray = document.getElementById("fontTray");
    if (tray && !tray.hidden) return;
    e.stopPropagation();
    close();
  });

  /* ── Tabs ───────────────────────────────────────────────────────── */

  function selectTab(id, focus = false) {
    activeTab = id;
    for (const b of tabButtons) {
      const on = b.dataset.tab === id;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    }
    body.setAttribute("aria-labelledby", `deskTab-${id}`);
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
      selectTab(next.dataset.tab, true);
    });
  }

  /* ── The list ───────────────────────────────────────────────────── */

  let renderSeq = 0;
  async function render({ focusIndex = null } = {}) {
    if (panel.hidden && focusIndex === null) return;
    const seq = ++renderSeq;
    if (!store) {
      list.replaceChildren();
      empty.hidden = false;
      empty.textContent =
        "This browser isn't letting the site keep a notebook. Private windows sometimes don't.";
      if (storeError) console.error("Study Desk: the notebook didn't open", storeError);
      return;
    }
    const records =
      activeTab === "chapter" && here
        ? forChapter(await store.byChapter(here.bookKey, here.chapter), here.bookKey, here.chapter)
        : liveRecords(await store.all());
    if (seq !== renderSeq) return; // a newer render has started

    list.replaceChildren(...records.map(rowFor));
    empty.hidden = records.length > 0;
    empty.textContent =
      activeTab === "chapter" ? `Nothing kept for ${here.label} yet.` : "Nothing kept yet.";

    if (focusIndex !== null) {
      const rows = list.querySelectorAll(".desk-item__delete");
      const target = rows[Math.min(focusIndex, rows.length - 1)];
      (target ?? body).focus({ preventScroll: false });
    }
    renderPersistence();
  }

  function rowFor(r) {
    const li = document.createElement("li");
    li.className = "desk-item";
    li.dataset.id = r.id;
    const ref = recordReference(r);
    const href = recordHref(r);
    const head = document.createElement(href ? "a" : "span");
    head.className = "desk-item__ref";
    head.textContent = ref || kindName(r.kind);
    if (href) head.href = href;
    const kind = document.createElement("span");
    kind.className = "desk-item__kind";
    kind.textContent = kindName(r.kind);
    li.append(head, kind);
    // A note's body is the reader's own words: always text, never HTML.
    const words = r.kind === "note" ? r.body : r.label ?? r.name ?? r.quote?.exact;
    if (typeof words === "string" && words) {
      const p = document.createElement("p");
      p.className = "desk-item__words";
      p.textContent = words;
      li.append(p);
    }
    const del = document.createElement("button");
    del.type = "button";
    del.className = "desk-item__delete";
    del.textContent = "Delete";
    del.setAttribute("aria-label", `Delete ${kindName(r.kind).toLowerCase()}${ref ? ` on ${ref}` : ""}`);
    del.addEventListener("click", () => remove(r, li));
    li.append(del);
    return li;
  }

  async function remove(r, li) {
    const index = Array.from(list.children).indexOf(li);
    const trash = await store.remove(r.id);
    if (!trash) return;
    await render({ focusIndex: index });
    const ref = recordReference(r);
    showUndo(`${kindName(r.kind)}${ref ? ` on ${ref}` : ""} deleted.`, async () => {
      const back = await store.undo(trash.id);
      if (!back) throw new Error("nothing to bring back");
      await render();
      list.querySelector(`[data-id="${CSS.escape(back.id)}"] .desk-item__delete`)?.focus();
    });
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

  /* ── Preview only: a sample note ─────────────────────────────────── */

  panel.querySelector(".desk-panel__sample")?.addEventListener("click", async () => {
    const now = new Date().toISOString();
    const blocks = document.querySelector(".chapter-paragraphs")?.children ?? [];
    const verseCopy = verseCopyFor(pageAnchorText(blocks), 1);
    const note = createRecord(
      "note",
      {
        bookKey: here.bookKey,
        chapter: here.chapter,
        verse: 1,
        endVerse: 1,
        body: "A sample note from the Study Desk preview.",
        marker: "note",
        ...(verseCopy ? { verseCopy, verseCopyAsOf: now } : {}),
      },
      { now, ...ctx() },
    );
    await store.save(note);
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
  syncToggles();
  render();
  return { open, close };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
