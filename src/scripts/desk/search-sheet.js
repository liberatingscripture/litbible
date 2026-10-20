// src/scripts/desk/search-sheet.js
//
// "Make a sheet of these verses" on /search (STUDY-DESK.md, M5): the verses a
// search found, or the chapters a topic names, gathered into a sheet. Reached
// only through loadDeskSheets() in search-core.js, which imports this file
// only when <html data-desk="on">, so a reader without the preview downloads
// none of it and sees /search exactly as it was. It is the only place the
// search page meets the desk's sheets: search.js sends one plain event,
// `lit:search-results`, and this file draws everything else.
//
// The event's detail is { query, verses, chapters }:
//   verses   every verse hit of the search, not only the page showing:
//            [{ bookKey, chapter, verse }]
//   chapters every chapter by topic: [{ bookKey, chapter, labels }]
// It is sent after every render (a new query, a page turned, a sort), and
// this file draws again from it each time; ticks belong to a query and are
// forgotten when the query changes.
//
// What it makes is the rules in src/lib/desk-sheet-gather.mjs: passages in
// Bible order, runs of consecutive verses as one range, no more than a sheet
// holds. The notebook is opened only when the reader presses the button (this
// browser's notebook is never created by looking at a search), and the write
// goes through the same store as every other change, so it is one undo entry.
// Everything happens in this browser; nothing about the query is sent anywhere.

import deskCss from "../../styles/desk.css?inline";
import { canEdit } from "../../lib/desk-records.mjs";
import { webClient } from "../../lib/desk-store-core.mjs";
import {
  gatherMessage,
  passagesFromChapters,
  passagesFromVerses,
  roomOnSheet,
  searchSheetTitle,
} from "../../lib/desk-sheet-gather.mjs";
import { sheetName, sortSheets } from "../../lib/desk-sheet-passages.mjs";
import { addModule, createSheet, makeModule } from "../../lib/desk-sheets.mjs";
import { createHistory, undoEntry } from "./history.js";
import { openStore } from "./store.js";

const BASE = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
const contentVersion = document.documentElement.dataset.contentVersion || "unversioned";
const ctx = () => ({ client: webClient(contentVersion), contentVersion });

/* ── Small helpers ───────────────────────────────────────────────────── */

function make(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function button(label, cls = "desk-gather__btn") {
  const b = make("button", cls, label);
  b.type = "button";
  return b;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const verseKey = (r) => `${r.bookKey} ${r.chapter}:${r.verse}`;

// The desk's styles come with this file, as notebook-search.js does: /search
// isn't a page the desk's shell runs on. A second copy would change nothing.
function ensureStyles() {
  if (document.querySelector("style[data-desk], style[data-desk-search]")) return;
  const style = document.createElement("style");
  style.setAttribute("data-desk-search", "");
  style.textContent = deskCss;
  document.head.append(style);
}

/** A verse result's address: "/john-3#v16" is John 3:16. */
function refOfLink(href) {
  const m = /^\/?([0-9]?[a-z]+)-(\d+)\/?#v(\d+)$/i.exec(String(href ?? ""));
  return m ? { bookKey: m[1].toLowerCase(), chapter: Number(m[2]), verse: Number(m[3]) } : null;
}

/* ── The notebook, opened when it is first needed ────────────────────── */

let storePromise = null;

function notebook() {
  storePromise ||= openStore({ ctx }).then((store) => {
    createHistory({ store, ctx });
    return store;
  });
  // A failure isn't remembered, so a second press tries again.
  storePromise.catch(() => {
    storePromise = null;
  });
  return storePromise;
}

/** The last verse of each chapter, read from the verse files build:verses writes. */
async function withLastVerses(chapters) {
  return Promise.all(
    chapters.map(async (c) => {
      try {
        const res = await fetch(`${BASE}search/chapters/${c.bookKey}-${c.chapter}.json`);
        if (!res.ok) return { ...c, lastVerse: null };
        const verses = await res.json();
        return { ...c, lastVerse: Array.isArray(verses) && verses.length ? verses.length : null };
      } catch (_) {
        return { ...c, lastVerse: null };
      }
    }),
  );
}

/** The label every chapter of a topic carries, else null (a loose match has several). */
function commonLabel(chapters) {
  if (!chapters.length) return null;
  const [first, ...rest] = chapters.map((c) => c.labels ?? []);
  return first.find((label) => rest.every((labels) => labels.includes(label))) ?? null;
}

/* ── The page ────────────────────────────────────────────────────────── */

let getLast = () => null;
let detail = null; // the results on screen, as search.js last sent them
let query = null; // the query the ticks belong to
const ticked = new Set();

const keywordGroup = () => document.getElementById("group-keyword");
const subjectGroup = () => document.getElementById("group-subject");

// One bar per group, made once and kept: search.js re-renders the lists
// inside the groups, never the groups themselves.
const bars = { verses: null, chapters: null };

function ensureBar(kind) {
  if (bars[kind]?.root.isConnected) return bars[kind];
  const group = kind === "verses" ? keywordGroup() : subjectGroup();
  if (!group) return null;
  const root = make("div", "desk-gather");
  root.setAttribute("data-desk-gather", kind);
  const row = make("div", "desk-gather__row");
  const go = button(kind === "verses" ? "Make a sheet of these verses" : "Make a sheet of these chapters");
  go.setAttribute("aria-haspopup", "dialog");
  go.setAttribute("aria-expanded", "false");
  const hint = make("span", "desk-gather__hint");
  const clear = button("Clear ticks", "desk-gather__btn desk-gather__btn--quiet");
  clear.hidden = true;
  row.append(go, hint, clear);
  const slot = make("div", "desk-gather__slot");
  slot.setAttribute("role", "status");
  root.append(row, slot);
  group.querySelector(".group-title")?.after(root);

  const bar = { kind, root, go, hint, clear, slot, panel: null };
  go.addEventListener("click", () => (bar.panel ? closePanel(bar) : openPanel(bar)));
  clear.addEventListener("click", () => {
    ticked.clear();
    syncTicks();
  });
  bars[kind] = bar;
  return bar;
}

function closePanel(bar, { focus = true } = {}) {
  bar.panel?.remove();
  bar.panel = null;
  bar.go.setAttribute("aria-expanded", "false");
  if (focus) bar.go.focus();
}

/** Which verses a press would gather: the ticked ones, else every result. */
function chosenVerses() {
  const all = detail?.verses ?? [];
  if (!ticked.size) return all;
  return all.filter((r) => ticked.has(verseKey(r)));
}

function describeBar(bar) {
  if (bar.kind === "verses") {
    const n = detail.verses.length;
    bar.hint.textContent = ticked.size
      ? `${plural(ticked.size, "verse", "verses")} ticked.`
      : `Tick verses to choose; with none ticked, every result goes (${n}).`;
    bar.clear.hidden = !ticked.size;
  } else {
    const n = detail.chapters.length;
    bar.hint.textContent = `All ${plural(n, "chapter", "chapters")} go, each whole.`;
  }
}

/** Tick boxes on the verse results on screen. */
function enhanceRows() {
  const list = document.getElementById("results-keyword");
  if (!list) return;
  for (const li of list.querySelectorAll("li.result-occurrence")) {
    if (li.querySelector(".desk-gather__tick")) continue;
    const link = li.querySelector("a.result-link");
    const ref = refOfLink(link?.getAttribute("href"));
    if (!ref) continue;
    const box = make("input", "desk-gather__tick");
    box.type = "checkbox";
    box.checked = ticked.has(verseKey(ref));
    box.setAttribute("aria-label", `Include ${labelOf(li, ref)} in the sheet`);
    box.addEventListener("change", () => {
      if (box.checked) ticked.add(verseKey(ref));
      else ticked.delete(verseKey(ref));
      syncTicks();
    });
    li.classList.add("desk-gather__row-item");
    li.prepend(box);
  }
}

// "John 3:16" for a box's name, from the result's own chapter heading.
function labelOf(li, ref) {
  const title = li.closest(".result-group")?.querySelector(".result-group__title")?.textContent?.trim();
  return `${title || `${ref.bookKey} ${ref.chapter}`}:${ref.verse}`;
}

function syncTicks() {
  for (const box of document.querySelectorAll("#results-keyword .desk-gather__tick")) {
    const ref = refOfLink(box.closest("li")?.querySelector("a.result-link")?.getAttribute("href"));
    if (ref) box.checked = ticked.has(verseKey(ref));
  }
  if (bars.verses && detail) describeBar(bars.verses);
}

function update(next) {
  if (!next) return;
  ensureStyles();
  if (next.query !== query) {
    // A new query: its ticks are not these, and an open panel or message was
    // about the last one.
    ticked.clear();
    for (const bar of Object.values(bars)) {
      if (!bar) continue;
      closePanel(bar, { focus: false });
      bar.slot.replaceChildren();
    }
    query = next.query;
  }
  detail = next;
  for (const kind of ["verses", "chapters"]) {
    const bar = ensureBar(kind);
    if (!bar) continue;
    bar.root.hidden = !detail[kind].length;
    if (!detail[kind].length) {
      closePanel(bar, { focus: false });
      continue;
    }
    describeBar(bar);
  }
  enhanceRows();
}

/* ── The chooser, and the write ──────────────────────────────────────── */

async function openPanel(bar) {
  if (bar.panel) return;
  const verses = bar.kind === "verses";
  const count = verses ? chosenVerses().length : detail.chapters.length;
  if (!count) return;

  const panel = make("div", "desk-gather__panel");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Make a sheet");
  const heading = make(
    "p",
    "desk-gather__title",
    verses
      ? `Make a sheet of ${plural(count, "verse", "verses")}`
      : `Make a sheet of ${plural(count, "chapter", "chapters")}`,
  );
  const fresh = button("New sheet", "desk-gather__btn desk-gather__btn--primary");
  const intro = make("p", "desk-gather__note", "Or add them to one of your sheets:");
  const list = make("ul", "desk-gather__sheets");
  const cancel = button("Cancel", "desk-gather__btn desk-gather__btn--quiet");
  const actions = make("div", "desk-gather__actions");
  actions.append(fresh, cancel);
  panel.append(heading, actions, intro, list);
  bar.slot.replaceChildren(panel);
  bar.panel = panel;
  bar.go.setAttribute("aria-expanded", "true");
  fresh.focus();

  cancel.addEventListener("click", () => closePanel(bar));
  panel.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    closePanel(bar);
  });
  fresh.addEventListener("click", () => gather(bar, null));

  // The reader's sheets, newest first. Read when the panel opens.
  intro.textContent = "Reading your sheets…";
  let sheets = [];
  try {
    const store = await notebook();
    sheets = sortSheets((await store.all()).filter((r) => r.kind === "sheet"));
  } catch (err) {
    console.error("Study Desk: couldn’t read the sheets", err);
    if (bar.panel === panel) {
      intro.textContent = "This browser isn’t letting the site keep a notebook, so sheets can’t be saved here. Private windows sometimes don’t.";
      fresh.disabled = true;
    }
    return;
  }
  if (bar.panel !== panel) return;
  intro.textContent = sheets.length ? "Or add them to one of your sheets:" : "";
  intro.hidden = !sheets.length;
  for (const sheet of sheets) {
    const li = make("li");
    const pick = button("", "desk-gather__sheet");
    pick.append(make("span", "desk-gather__sheet-name", sheetName(sheet)));
    const n = sheet.modules?.length ?? 0;
    pick.append(make("span", "desk-gather__sheet-meta", plural(n, "part", "parts")));
    if (!canEdit(sheet)) {
      pick.disabled = true;
      pick.append(make("span", "desk-gather__sheet-meta", "Made by a newer version of the LIT"));
    } else if (roomOnSheet(n) === 0) {
      pick.disabled = true;
      pick.append(make("span", "desk-gather__sheet-meta", "Full"));
    } else {
      pick.addEventListener("click", () => gather(bar, sheet));
    }
    li.append(pick);
    list.append(li);
  }
}

/** Make the passages and write them: into a new sheet (`into` null) or `into`. */
async function gather(bar, into) {
  const panel = bar.panel;
  if (!panel) return;
  for (const b of panel.querySelectorAll("button")) b.disabled = true;
  const made = into == null;
  const fail = (text) => {
    if (bar.panel !== panel) return;
    closePanel(bar, { focus: false });
    say(bar, text);
  };

  let store;
  try {
    store = await notebook();
  } catch (err) {
    console.error("Study Desk: couldn’t open the notebook", err);
    fail("This browser isn’t letting the site keep a notebook, so sheets can’t be saved here.");
    return;
  }

  // The sheet is read again here, since another tab may have changed it
  // since the list was drawn.
  let target = null;
  if (!made) {
    try {
      target = await store.get(into.id);
    } catch (_) {}
    if (target?.kind !== "sheet" || !canEdit(target)) {
      fail("That sheet couldn’t be changed. It may have been deleted or made by a newer version of the LIT.");
      return;
    }
  }

  const room = roomOnSheet(target?.modules?.length ?? 0);
  let result;
  let title;
  if (bar.kind === "verses") {
    result = passagesFromVerses(chosenVerses(), { room });
    title = searchSheetTitle(detail.query);
  } else {
    const chapters = await withLastVerses(detail.chapters);
    result = passagesFromChapters(chapters, { room });
    const label = commonLabel(detail.chapters);
    title = searchSheetTitle(detail.query, { kind: "topic", label });
  }
  if (!result.passages.length) {
    fail(
      result.unknown
        ? "Those chapters couldn’t be read just now, so nothing was added. Try again in a moment."
        : "There was no room to add anything to that sheet.",
    );
    return;
  }

  let sheet;
  const now = new Date().toISOString();
  try {
    if (made) {
      sheet = createSheet(
        { title, template: "search", modules: result.passages.map((p) => makeModule("passage", p)) },
        { now, ...ctx() },
      );
    } else {
      sheet = target;
      for (const p of result.passages) sheet = addModule(sheet, makeModule("passage", p), undefined, { now, ...ctx() });
    }
    await store.save(sheet);
  } catch (err) {
    console.error("Study Desk: the sheet couldn’t be made", err);
    fail("The sheet couldn’t be saved. Nothing was changed.");
    return;
  }
  const entry = store.lastEntry();

  closePanel(bar, { focus: false });
  const left = result.leftOut + (result.unknown ?? 0);
  say(
    bar,
    gatherMessage({ made, name: sheetName(sheet), added: result.passages.length, leftOut: left }),
    { sheet, entry },
  );
}

/** A line in the bar's live slot, with a link to the sheet and Undo when there is one. */
function say(bar, text, { sheet = null, entry = null } = {}) {
  const line = make("p", "desk-gather__done");
  line.append(make("span", null, text));
  if (sheet) {
    const open = make("a", "desk-gather__link", "Open it on the Study Desk");
    open.href = `${BASE}desk/?sheet=${encodeURIComponent(sheet.id)}`;
    line.append(" ", open);
    if (entry) {
      const undo = button("Undo", "desk-gather__btn desk-gather__btn--quiet");
      undo.addEventListener("click", async () => {
        undo.disabled = true;
        let ok = false;
        try {
          ok = await undoEntry(entry);
        } catch (err) {
          console.error("Study Desk: couldn’t undo the sheet", err);
        }
        line.replaceChildren(make("span", null, ok ? "Undone." : "That couldn’t be undone."));
      });
      line.append(" ", undo);
    }
  }
  bar.slot.replaceChildren(line);
}

/**
 * Start listening. `last` gives the results search.js has already sent, if
 * any: this file loads after the first search may have finished.
 */
export function attachSearchSheets(last) {
  getLast = typeof last === "function" ? last : () => null;
  document.addEventListener("lit:search-results", (e) => update(e.detail));
  update(getLast());
}
