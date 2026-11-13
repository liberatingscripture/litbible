// src/scripts/desk/sheets/search-sheet.js
//
// A sheet from /search (STUDY-DESK.md, M5): the verses a search found, or the
// chapters a topic names, gathered into a sheet. Reached
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
// forgotten when the query changes, and a tick on a verse the results no
// longer hold (a book filter) is dropped.
//
// Each group gets a head row (E116; BVJ, 2026-11-12, option A): for the
// verses, a box that checks every verse (all of them, not only the page on
// screen; unchecked it clears them, and it shows mixed when some are
// checked), in the column the rows' boxes sit in, and a card holding one line
// and one primary button whose label carries the count ("Add 4 verses to a
// sheet…"), which opens the chooser. Nothing checked adds nothing: until a
// box is checked the button is aria-disabled, stays focusable, and is
// described by the line, which says how to check; a press only says it again.
// The topic's chapters go whole, all of them, so their head row has no box and
// its button is never disabled. The card and every checked result share a
// green rule, and the row is sticky while its group is on screen.
//
// What it makes is the rules in src/lib/desk-sheet-gather.mjs: passages in
// Bible order, runs of consecutive verses as one range, no more than a sheet
// holds. The notebook is opened only when the reader presses the button (this
// browser's notebook is never created by looking at a search), and the write
// goes through the same store as every other change, so it is one undo entry.
// Everything happens in this browser; nothing about the query is sent anywhere.

import { canEdit } from "../../../lib/desk-records.mjs";
import { planSave, webClient } from "../../../lib/desk-store-core.mjs";
import {
  addChaptersLabel,
  addToSheetLabel,
  chaptersLine,
  checkAllLabel,
  checkedLine,
  checkedSaid,
  gatherMessage,
  includeLabel,
  passagesFromChapters,
  passagesFromVerses,
  roomOnSheet,
  searchSheetTitle,
} from "../../../lib/desk-sheet-gather.mjs";
import { planAddPassages } from "../../../lib/desk-sheet-add.mjs";
import { sheetName, sortSheets } from "../../../lib/desk-sheet-passages.mjs";
import { createSheet, isOwnTemplate, makeModule } from "../../../lib/desk-sheets.mjs";
import { createHistory, undoEntry } from "../history.js";
import { openStore } from "../store.js";
import { buttons, make } from "../dom.js";
import { plural } from "../desk-text.js";
import { addSearchStyle } from "../search-style.js";

const button = buttons("desk-gather__btn");

const BASE = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
const contentVersion = document.documentElement.dataset.contentVersion || "unversioned";
const ctx = () => ({ client: webClient(contentVersion), contentVersion });

/* ── Small helpers ───────────────────────────────────────────────────── */

const verseKey = (r) => `${r.bookKey} ${r.chapter}:${r.verse}`;

// The bar's styles come with this file, as notebook-search.js's do: /search
// isn't a page the desk's shell runs on (desk-search.css, through
// search-style.js; all of desk.css until LG8-10).
const ensureStyles = addSearchStyle;

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

// One head row per group, made once and kept: search.js re-renders the lists
// inside the groups, never the groups themselves.
const bars = { verses: null, chapters: null };

function ensureBar(kind) {
  if (bars[kind]?.root.isConnected) return bars[kind];
  const group = kind === "verses" ? keywordGroup() : subjectGroup();
  if (!group) return null;
  const verses = kind === "verses";
  const root = make("div", "desk-gather desk-gather--head");
  root.setAttribute("data-desk-gather", kind);
  // The box that checks every verse, in the rows' column of boxes.
  const all = verses ? make("input", "desk-gather__tick desk-gather__all") : null;
  if (all) all.type = "checkbox";
  const card = make("div", "desk-gather__card");
  const main = make("div", "desk-gather__main");
  const lead = make("p", "desk-gather__lead");
  lead.id = `desk-gather-lead-${kind}`;
  const count = make("span", "desk-gather__count");
  const text = make("span", "desk-gather__text");
  lead.append(count, text);
  const clear = button("Clear checks", "desk-gather__btn desk-gather__btn--quiet desk-gather__clear");
  clear.hidden = true;
  if (verses) lead.append(clear);
  const actions = make("div", "desk-gather__actions-row");
  const go = button(null, "desk-gather__btn desk-gather__btn--primary desk-gather__go");
  go.setAttribute("aria-haspopup", "dialog");
  go.setAttribute("aria-expanded", "false");
  go.append(make("span", "desk-gather__label"));
  actions.append(go);
  main.append(lead, actions);
  // The chooser and the line after a write, in the card under its line.
  const slot = make("div", "desk-gather__slot");
  slot.setAttribute("role", "status");
  card.append(main, slot);
  // What a screen reader hears when a box changes: once per change.
  const said = make("p", "sr-only");
  said.setAttribute("role", "status");
  root.append(...(all ? [all] : []), card, said);
  group.querySelector(".group-title")?.after(root);

  const bar = { kind, root, all, lead, count, text, go, clear, slot, said, panel: null };
  go.addEventListener("click", () => {
    if (go.getAttribute("aria-disabled") === "true") {
      // Nothing checked adds nothing; the press says how to check (E116).
      speak(bar, checkedLine(0, detail?.verses.length ?? 0).text);
      return;
    }
    if (bar.panel) closePanel(bar);
    else openPanel(bar);
  });
  all?.addEventListener("change", () => {
    if (all.checked) for (const r of detail?.verses ?? []) ticked.add(verseKey(r));
    else ticked.clear();
    syncTicks({ said: true });
  });
  clear.addEventListener("click", () => {
    ticked.clear();
    syncTicks({ said: true });
    // Clear checks hides itself, so focus goes to the box that checks them all.
    all?.focus();
  });
  bars[kind] = bar;
  return bar;
}

/** Words for a polite live region, cleared first so the same words twice are heard twice. */
function speak(bar, words) {
  bar.said.textContent = "";
  requestAnimationFrame(() => {
    bar.said.textContent = words;
  });
}

function closePanel(bar, { focus = true } = {}) {
  bar.panel?.remove();
  bar.panel = null;
  bar.go.setAttribute("aria-expanded", "false");
  if (focus) bar.go.focus();
}

/** The verses a press would gather: the checked ones, never all by default (E116). */
function chosenVerses() {
  return (detail?.verses ?? []).filter((r) => ticked.has(verseKey(r)));
}

/** The head row's button: its label, over invisible copies of the longest it can read. */
function nameGo(bar, label, room = []) {
  bar.go.querySelector(".desk-gather__label").textContent = label;
  for (const old of bar.go.querySelectorAll(".desk-gather__label-room")) old.remove();
  for (const words of room) {
    const ghost = make("span", "desk-gather__label-room", words);
    ghost.setAttribute("aria-hidden", "true");
    bar.go.append(ghost);
  }
  bar.go.setAttribute("aria-label", label);
}

function describeBar(bar) {
  if (bar.kind === "verses") {
    const total = detail.verses.length;
    const k = ticked.size;
    const line = checkedLine(k, total);
    bar.count.textContent = line.count;
    bar.text.textContent = line.text;
    bar.clear.hidden = !k;
    bar.all.checked = k > 0 && k === total;
    bar.all.indeterminate = k > 0 && k < total;
    bar.all.setAttribute("aria-label", checkAllLabel(total));
    nameGo(bar, addToSheetLabel(k, total), [addToSheetLabel(0, total), addToSheetLabel(total, total)]);
    if (k) {
      bar.go.removeAttribute("aria-disabled");
      bar.go.removeAttribute("aria-describedby");
    } else {
      bar.go.setAttribute("aria-disabled", "true");
      bar.go.setAttribute("aria-describedby", bar.lead.id);
    }
    bar.root.classList.toggle("desk-gather--some", k > 0);
    // An open chooser names what it adds; with nothing left checked it has nothing to add.
    if (bar.panel && !k) closePanel(bar, { focus: false });
    const title = bar.panel?.querySelector(".desk-gather__title");
    if (title) title.textContent = addToSheetLabel(k, total, { ellipsis: false });
  } else {
    const n = detail.chapters.length;
    bar.count.textContent = "";
    bar.text.textContent = chaptersLine(n);
    nameGo(bar, addChaptersLabel(n));
    // Every chapter goes, so the rule is always there.
    bar.root.classList.add("desk-gather--some");
  }
}

/** Boxes on the verse results on screen. */
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
    box.setAttribute("aria-label", includeLabel(labelOf(li, ref)));
    box.addEventListener("change", () => {
      if (box.checked) ticked.add(verseKey(ref));
      else ticked.delete(verseKey(ref));
      syncTicks({ said: true });
    });
    li.classList.add("desk-gather__row-item");
    li.classList.toggle("desk-gather__row-item--picked", box.checked);
    li.prepend(box);
  }
}

// "John 3:16" for a box's name, from the result's own chapter heading.
function labelOf(li, ref) {
  const title = li.closest(".result-group")?.querySelector(".result-group__title")?.textContent?.trim();
  return `${title || `${ref.bookKey} ${ref.chapter}`}:${ref.verse}`;
}

/** The rows' boxes and marks and the head row, from the ticks; `said` speaks the count, once per change. */
function syncTicks({ said = false } = {}) {
  for (const box of document.querySelectorAll("#results-keyword .desk-gather__tick")) {
    const li = box.closest("li");
    const ref = refOfLink(li?.querySelector("a.result-link")?.getAttribute("href"));
    if (!ref) continue;
    box.checked = ticked.has(verseKey(ref));
    li.classList.toggle("desk-gather__row-item--picked", box.checked);
  }
  if (!bars.verses || !detail?.verses.length) return;
  describeBar(bars.verses);
  if (said) speak(bars.verses, checkedSaid(ticked.size, detail.verses.length));
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
  // A tick on a verse the results no longer hold (the book filter changed
  // them, not the query) would count in the bar and gather nothing (BA132).
  const shown = new Set((next.verses ?? []).map(verseKey));
  let dropped = false;
  for (const key of ticked) {
    if (shown.has(key)) continue;
    ticked.delete(key);
    dropped = true;
  }
  if (dropped && bars.verses) closePanel(bars.verses, { focus: false });
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
  syncTicks();
}

/* ── The chooser, and the write ──────────────────────────────────────── */

async function openPanel(bar) {
  if (bar.panel) return;
  const verses = bar.kind === "verses";
  const count = verses ? chosenVerses().length : detail.chapters.length;
  if (!count) return;

  const panel = make("div", "desk-gather__panel");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Add to a sheet");
  const heading = make(
    "p",
    "desk-gather__title",
    verses ? addToSheetLabel(count, detail.verses.length, { ellipsis: false }) : addChaptersLabel(count, { ellipsis: false }),
  );
  const fresh = button("New sheet", "desk-gather__btn desk-gather__btn--primary");
  const intro = make("p", "desk-gather__note", "Or add them to one of your sheets:");
  const list = make("ul", "desk-gather__sheets");
  // An ordinary button (E126), as every Cancel is.
  const cancel = button("Cancel");
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
    sheets = sortSheets((await store.all()).filter((r) => r.kind === "sheet" && !isOwnTemplate(r)));
  } catch (err) {
    console.error("Study Desk: couldn’t read the sheets", err);
    if (bar.panel === panel) {
      intro.textContent = "This browser isn’t letting the site keep a notebook, so sheets can’t be saved here. Private windows sometimes don’t. Open the site in a regular window to keep sheets.";
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
    // What the Sheets pane's list shows, so two sheets with one title can be told apart.
    const modified = sheet.modified ? new Date(sheet.modified) : null;
    const meta = [
      sheet.subtitle,
      plural(n, "part", "parts"),
      modified && !Number.isNaN(modified.getTime())
        ? `changed ${modified.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
        : "",
    ].filter(Boolean).join(" · ");
    pick.append(make("span", "desk-gather__sheet-meta", meta));
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

  // What was pressed for, taken now: the results can change during the
  // waits below (a new query, the book filter), and the sheet is made of
  // these, titled by this query (BA130).
  const verses = bar.kind === "verses";
  const picked = verses ? chosenVerses() : detail.chapters;
  const title = verses
    ? searchSheetTitle(detail.query)
    : searchSheetTitle(detail.query, { kind: "topic", label: commonLabel(detail.chapters) });

  let store;
  try {
    store = await notebook();
  } catch (err) {
    console.error("Study Desk: couldn’t open the notebook", err);
    fail("This browser isn’t letting the site keep a notebook, so sheets can’t be saved here. Private windows sometimes don’t. Open the site in a regular window to keep sheets.");
    return;
  }
  // The fetching comes first, so the sheet is read only inside the write.
  const chapters = verses ? null : await withLastVerses(picked);
  const passagesFor = (room) => (verses ? passagesFromVerses(picked, { room }) : passagesFromChapters(chapters, { room }));

  // The sheet is read and added to in one transaction, since another tab, or
  // /desk, may have changed it since the list was drawn (BA130).
  let outcome;
  try {
    outcome = await store.change(async ({ get }) => {
      const now = new Date().toISOString();
      const target = made ? null : await get(into.id);
      if (!made && (target?.kind !== "sheet" || !canEdit(target))) return { gone: true };
      const result = passagesFor(roomOnSheet(target?.modules?.length ?? 0));
      if (!result.passages.length) return { result };
      if (made) {
        const sheet = createSheet(
          { title, template: "search", modules: result.passages.map((p) => makeModule("passage", p)) },
          { now, ...ctx() },
        );
        return { result, sheet, ...planSave(sheet) };
      }
      // Over the editor's own rules: the sheet in today's canonical form, and
      // each passage where `passageInsertIndex` puts it (SH8-3).
      const plan = planAddPassages(target, result.passages, { now, ...ctx() });
      if (plan.gone) return { gone: true };
      if (plan.refused) throw plan.refused;
      return { result, ...plan };
    });
  } catch (err) {
    console.error("Study Desk: the sheet couldn’t be made", err);
    fail("The sheet couldn’t be saved. Nothing was changed. Try again in a moment.");
    return;
  }
  if (outcome.gone) {
    fail("That sheet couldn’t be changed. It may have been deleted or made by a newer version of the LIT. Start a new sheet instead.");
    return;
  }
  const { result, sheet } = outcome;
  if (!sheet) {
    fail(
      result.unknown
        ? "Those chapters couldn’t be read just now, so nothing was added. Try again in a moment."
        : "There was no room to add anything to that sheet.",
    );
    return;
  }
  const entry = store.lastEntry();

  closePanel(bar, { focus: false });
  say(
    bar,
    gatherMessage({ made, name: sheetName(sheet), added: result.passages.length, leftOut: result.leftOut, unread: result.unknown ?? 0 }),
    { sheet, entry },
  );
}

/** A line in the bar's live slot, with a link to the sheet and Undo when there is one. */
function say(bar, text, { sheet = null, entry = null } = {}) {
  const line = make("p", "desk-gather__done");
  line.append(make("span", null, text));
  let target = null;
  if (sheet) {
    // It opens where the search was, on /sheets, and the Study Desk is
    // offered beside it (S12, part 2; BVJ, 2026-11-08, decision 4).
    const open = make("a", "desk-gather__link", "Open the sheet");
    open.href = `${BASE}sheets/?id=${encodeURIComponent(sheet.id)}`;
    const desk = make("a", "desk-gather__link", "open it in the Study Desk");
    desk.href = `${BASE}desk/?sheet=${encodeURIComponent(sheet.id)}`;
    line.append(" ", open, ", or ", desk, ".");
    target = open;
    if (entry) {
      const undo = button("Undo");
      undo.addEventListener("click", async () => {
        undo.disabled = true;
        let ok = false;
        try {
          ok = await undoEntry(entry);
        } catch (err) {
          console.error("Study Desk: couldn’t undo the sheet", err);
        }
        if (ok) line.replaceChildren(make("span", null, "Undone."));
        else line.replaceChildren(make("span", null, "That couldn’t be undone here, so the sheet is as it was."), " ", open, make("span", null, " to change it."));
      });
      line.append(" ", undo);
      target ??= undo;
    }
  }
  bar.slot.replaceChildren(line);
  // The panel that held focus is gone, so focus would fall to the top of the
  // page (SH5-10): the link to the sheet, else Undo, else the message itself.
  if (!target) {
    line.tabIndex = -1;
    target = line;
  }
  target.focus();
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
