// src/scripts/desk/pins.js
//
// Pinned footnotes (STUDY-DESK.md, "Draft 4d"; BDR, 2026-10-09): a Pin button
// wherever a footnote is read on a Study View chapter, in the popover a
// footnote letter opens and on each note in the Footnotes list at the foot of
// the page, and in the Notebook's "This verse" tab. "Pinned footnotes" in the
// panel (tab-mine.js) lists them. Readers see exactly "Pin", "Unpin" and
// "Pinned footnotes", as in the two apps.
//
// The rules (what a pin keeps, how it is found again, when it carries a change
// notice) are src/lib/desk-footnotes.mjs and desk-change.mjs, pure and
// unit-tested; this file reads the page, draws the buttons and writes records
// through the store, so Ctrl+Z, the undo bar and the other tabs all work as
// for every other record. Nothing here changes the footnote's text or the
// scripture: a button sits beside the note, never inside `.fn-body`, which is
// what the popover, the handout and the desk's own reading of a note copy.
//
// A pin never stores the footnote's letter, so a button works from the note's
// id in its chapter and finds its pin by the note's words (findPin), exactly
// as a pin made in an app is found. Buttons are found in the DOM by their
// `data-desk-pin` attribute whenever the notebook changes, so a popover that
// has closed or a tab that has redrawn leaves nothing to clean up.
//
// Study View chapters, and /desk (3g), where a note belongs to whichever
// chapter its pane shows: every button names its chapter (`where`, kept in
// `data-desk-pin-book` and `-chapter`) and the notebook is read per chapter.
// The footnotes of a chapter that isn't the page's come from its fetched Study
// View page (chapter-page.js). Read View has no footnotes, and intros, drafts,
// the glossary and articles have none to pin.

import { createRecord } from "../../lib/desk-records.mjs";
import { pinFields, placePins } from "../../lib/desk-footnotes.mjs";
import { recordReference } from "../../lib/desk-store-core.mjs";
import { loadChapterPage } from "./chapter-page.js";
import { flagButton, noticesFor, openNotice } from "./change-notice.js";
import { undoEntry } from "./history.js";
import { footnoteList, pageChapter } from "./page.js";
import { announce, showUndo } from "./undo-bar.js";

/** What the buttons need: the notebook, what a write is stamped with, the card's "Show" button. */
let env = null;

/** "john 3" -> footnote id -> { record, found }, for the pins that sit on a footnote of that chapter now. */
let current = new Map();

/** "john 3" -> how many reads of that chapter have begun, so an older one can tell it has been overtaken. */
const reads = new Map();

const keyOf = (where) => `${where.bookKey} ${where.chapter}`;
const whereOf = (button) => ({ bookKey: button.dataset.deskPinBook, chapter: Number(button.dataset.deskPinChapter) });

/* ── Reading the notebook ────────────────────────────────────────── */

/** A chapter's footnotes as the pin rules read them: the page's own, else its fetched page's. Null if unavailable. */
async function listFor(where) {
  const here = pageChapter();
  if (here && here.bookKey === where.bookKey && here.chapter === where.chapter) return footnoteList();
  try {
    return (await loadChapterPage(where.bookKey, where.chapter)).footnoteList();
  } catch (_) {
    return null;
  }
}

/** This chapter's pins and where each is in the footnotes as the page has them. */
async function placedPins(where) {
  if (!env || !where) return null;
  const list = await listFor(where);
  if (!list) return null;
  const records = (await env.store.byChapter(where.bookKey, where.chapter)).filter((r) => r.kind === "footnotePin");
  return { where, list, records, placed: placePins(list, records) };
}

/* ── Pinning and unpinning ───────────────────────────────────────── */

/**
 * Delete a pin through the notebook's trash and say so in the undo bar, the
 * way every other deletion does. Resolves to whether anything was deleted.
 *
 * @param {object} store
 * @param {object} record the pin
 * @param {{ afterUndo?: () => unknown }} [options] what a list does once the
 *   undo has brought the pin back (redraw, place focus)
 */
export async function unpinRecord(store, record, { afterUndo = null } = {}) {
  const trash = await store.remove(record.id);
  if (!trash) return false;
  // The change this made, read at once: the undo button, like Ctrl+Z, takes
  // back exactly this one (history.js).
  const entry = store.lastEntry();
  const ref = recordReference(record);
  const said = `Footnote${ref ? ` on ${ref}` : ""} unpinned.`;
  if (entry) {
    showUndo(said, async () => {
      await undoEntry(entry);
      await afterUndo?.();
    });
  } else {
    announce(said);
  }
  return true;
}

/** Pin the footnote with this id in this chapter, or unpin it if it is pinned. */
async function toggle(id, label, where) {
  const found = await placedPins(where);
  if (!found || !found.list.some((f) => f.id === id)) return;
  const existing = found.placed.find((p) => p.found.id === id);
  if (existing) {
    await unpinRecord(env.store, existing.record);
    return;
  }
  const record = createRecord(
    "footnotePin",
    { bookKey: where.bookKey, chapter: where.chapter, ...pinFields(found.list, id) },
    { now: new Date().toISOString(), ...env.ctx() },
  );
  await env.store.save(record);
  announce(`Footnote ${label} pinned.`);
}

/* ── The button ──────────────────────────────────────────────────── */

/** Set a button's words and name from whether its footnote is pinned. */
function paint(button) {
  const pinned = Boolean(current.get(keyOf(whereOf(button)))?.has(button.dataset.deskPin));
  const word = pinned ? "Unpin" : "Pin";
  button.textContent = word;
  // The visible word leads the name (label in name); the letter says which.
  button.setAttribute("aria-label", `${word} footnote ${button.dataset.deskPinLabel}`);
}

/**
 * A Pin / Unpin button for a footnote, kept in step with the notebook for as
 * long as it is in the document. `id` is the note's id in its chapter's page
 * (`fn-a`) and `label` its letter, which names it for a screen reader and is
 * never stored. `where` is the chapter, `{ bookKey, chapter }`: the page's own
 * by default, a pane's on /desk. Null where pins aren't on (no notebook, no
 * chapter).
 *
 * @param {string} id
 * @param {string} label
 * @param {{ bookKey: string, chapter: number } | null} [where]
 * @returns {HTMLButtonElement | null}
 */
export function pinButton(id, label, where = pageChapter()) {
  if (!env || !where?.bookKey || !where.chapter) return null;
  const at = { bookKey: where.bookKey, chapter: where.chapter };
  const button = document.createElement("button");
  button.type = "button";
  button.className = "desk-pin";
  button.dataset.deskPin = id;
  button.dataset.deskPinLabel = label;
  button.dataset.deskPinBook = at.bookKey;
  button.dataset.deskPinChapter = String(at.chapter);
  paint(button);
  // A chapter nothing has read yet (a pane's, on /desk) doesn't know its pins.
  if (!current.has(keyOf(at))) load(at).then(() => paint(button));
  button.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (button.disabled) return;
    button.disabled = true;
    try {
      await toggle(id, label, at);
    } catch (err) {
      console.error("Study Desk: the footnote couldn't be pinned or unpinned", err);
    } finally {
      button.disabled = false;
      paint(button);
    }
  });
  return button;
}

/* ── Showing a pin on the page ───────────────────────────────────── */

/** The footnote a pin sits on in this chapter now, as findPin says, or null. Study View only. */
function footnoteOf(record) {
  const here = pageChapter();
  if (!env || !here || here.bookKey !== record.bookKey || here.chapter !== record.chapter) return null;
  const list = footnoteList();
  if (!list) return null;
  const [one] = placePins(list, [record]);
  return one && one.found.id ? document.getElementById(one.found.id) : null;
}

/**
 * Whether a pin can be shown in this page's Footnotes list: it is this
 * chapter's and a footnote stands where it points.
 */
export function canRevealFootnote(record) {
  return Boolean(footnoteOf(record));
}

/**
 * Scroll to the footnote a pin is on and put focus there, the way "See in
 * footnotes" does from the popover. True if there was one.
 */
export function revealFootnote(record) {
  const li = footnoteOf(record);
  if (!li) return false;
  try {
    if (window.location.hash !== `#${li.id}`) history.pushState(null, "", `#${li.id}`);
  } catch (_) {}
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  li.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  li.setAttribute("tabindex", "-1");
  li.focus({ preventScroll: true });
  return true;
}

/* ── Keeping the page in step ────────────────────────────────────── */

/** The lists that carry a flag under a note: Study View's Footnotes list and the Footnotes pane's. */
const FLAG_HOSTS = ".footnotes > li.desk-fn, li.desk-fns__item";

/** The flag for a pin whose footnote was rewritten: a row under the note, rebuilt only when it changes. */
function drawFlag(li, entry, notice) {
  const slot = li.querySelector(":scope > .desk-fn__flag");
  const sig = notice ? `${entry.record.id}|${notice.kind}|${notice.id ?? ""}` : "";
  if (!notice) {
    slot?.remove();
    return;
  }
  if (slot?.dataset.sig === sig) return;
  const box = slot ?? document.createElement("div");
  box.className = "desk-fn__flag";
  box.dataset.sig = sig;
  box.replaceChildren(
    flagButton(entry.record, notice, (trigger) =>
      openNotice(trigger, entry.record, {
        store: env.store,
        ctx: env.ctx,
        // The reader is looking at the note: no button to take them there.
        showInText: null,
        restoreFocus: trigger,
        onDone: async () => {
          await refreshPins();
          li.querySelector(":scope > .desk-pin")?.focus({ preventScroll: true });
        },
      }),
    ),
  );
  if (!slot) li.append(box);
}

/** The buttons in the document for this chapter. */
function buttonsFor(where) {
  const selector = `button[data-desk-pin][data-desk-pin-book="${where.bookKey}"][data-desk-pin-chapter="${where.chapter}"]`;
  return document.querySelectorAll(selector);
}

/** Read the notebook for one chapter and bring its buttons and flags up to date. */
async function load(where) {
  const k = keyOf(where);
  const n = (reads.get(k) ?? 0) + 1;
  reads.set(k, n);
  const found = await placedPins(where);
  if (reads.get(k) !== n) return;

  const map = new Map();
  for (const p of found?.placed ?? []) {
    if (p.found.id && !map.has(p.found.id)) map.set(p.found.id, p);
  }
  current.set(k, map);
  const buttons = buttonsFor(where);
  for (const button of buttons) paint(button);
  if (!found) return;

  const notices = noticesFor(found.records);
  for (const button of buttons) {
    const li = button.closest("li");
    if (!li?.matches(FLAG_HOSTS)) continue;
    const entry = map.get(button.dataset.deskPin);
    drawFlag(li, entry, entry ? notices.get(entry.record.id) ?? null : null);
  }
}

/**
 * Read the notebook and bring every button and flag on the page up to date:
 * the page's own chapter on Study View, and every chapter a button is drawn
 * for on /desk. A list that has redrawn its notes calls it too.
 */
export async function refreshPins() {
  if (!env) return;
  const chapters = new Map();
  const here = pageChapter();
  if (here) chapters.set(keyOf(here), { bookKey: here.bookKey, chapter: here.chapter });
  for (const button of document.querySelectorAll("button[data-desk-pin]")) {
    const where = whereOf(button);
    chapters.set(keyOf(where), where);
  }
  // A chapter with no button left is forgotten, so the next one reads afresh.
  for (const k of Array.from(current.keys())) if (!chapters.has(k)) current.delete(k);
  await Promise.all(Array.from(chapters.values(), load));
}

/**
 * Start pinned footnotes on this page: a button on each note in the Footnotes
 * list, one in the popover every footnote letter opens, and the flags. Does
 * nothing off a Study View chapter (or /desk, `desk: true`, where the panes
 * ask for their own buttons) or without a notebook.
 *
 * @param {{ store: object | null, ctx: () => { client: string, contentVersion: string },
 *   desk?: boolean }} options
 * @returns {{ reveal: (record: object) => boolean, canReveal: (record: object) => boolean } | null}
 */
export function initPins({ store, ctx, desk = false }) {
  if (!store || !(desk || pageChapter())) return null;
  env = { store, ctx };

  for (const li of document.querySelectorAll(".footnotes-wrap ol.footnotes > li[id]")) {
    const label = li.querySelector(".footnote-backlink")?.textContent.trim() ?? "";
    const button = pinButton(li.id, label);
    if (!button) continue;
    li.classList.add("desk-fn");
    li.append(button);
  }

  // chapter-tools.js offers the popover before placing it, and so does /desk's
  // LIT pane, which names its chapter in the detail (`book`, `chapter`). The
  // Pin button shares the line "See in footnotes" has, so the popover grows no
  // taller.
  document.addEventListener("lit:footnote-actions", (e) => {
    const { panel, note, ref, book, chapter } = e.detail ?? {};
    if (!panel || !note?.id) return;
    const where = book && chapter ? { bookKey: book, chapter } : undefined;
    const button = pinButton(note.id, ref?.textContent.trim() ?? "", where);
    if (!button) return;
    const row = document.createElement("div");
    row.className = "desk-pin-row";
    const jump = panel.querySelector(".lit-panel__jump");
    if (jump) {
      jump.replaceWith(row);
      row.append(jump, button);
    } else {
      row.append(button);
      panel.append(row);
    }
  });

  // This tab's own changes and other tabs' alike.
  store.subscribe(() => refreshPins());
  refreshPins();

  return { reveal: revealFootnote, canReveal: canRevealFootnote };
}
