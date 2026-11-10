// src/scripts/desk/pins.js
//
// Pinned footnotes (STUDY-DESK.md, "Draft 4d"; BDR, 2026-10-09): a Pin button
// wherever a footnote is read on a Chapter View chapter, in the popover a
// footnote letter opens and on each note in the Footnotes list at the foot of
// the page, and in the Notebook's "This verse" tab. "Pinned footnotes" in the
// panel (tab-mine.js) lists them. The button is a glyph (E18) that shows its
// state, not the press to come (E67; BDR via BVJ, 2026-11-10, reversing E18's
// struck-through "unpin" glyph): one thumbtack, outlined while the footnote is
// not pinned and filled and tinted once it is, always named "Pin footnote 3"
// with `aria-pressed` carrying the state, as the pane lock does. The
// thumbtack means pinning a footnote and nothing else on the desk (a pane's
// "Stay here" is a lock). The panel's list is headed "Pinned footnotes", as
// in the two apps; its rows keep the word "Unpin", a command on a list of
// pinned things.
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
// Chapter View chapters, and /desk (3g), where a note belongs to whichever
// chapter its pane shows: every button names its chapter (`where`, kept in
// `data-desk-pin-book` and `-chapter`) and the notebook is read per chapter.
// The footnotes of a chapter that isn't the page's come from its fetched Study
// View page (chapter-page.js). Read View has no footnotes, and intros, drafts,
// the glossary and articles have none to pin.

import { createRecord } from "../../lib/desk-records.mjs";
import { pinFields, placePins } from "../../lib/desk-footnotes.mjs";
import { recordReference, MOVE_KIND, NO_CHAPTER_KINDS } from "../../lib/desk-store-core.mjs";
import { flagButton, noticesFor, openNotice } from "./change-notice.js";
import { footnoteElementFor, footnoteListFor, footnoteNotes, initFootnoteNotes } from "./footnote-notes.js";
import { busy, isBusy } from "./focus-keep.js";
import { footnotePills, initFootnotePills } from "./footnote-pills.js";
import { undoEntry } from "./history.js";
import { pageChapter } from "./page.js";
import { announce, showNotice, showUndo } from "./undo-bar.js";
import { setTip } from "../tip.js";

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
const listFor = footnoteListFor;

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

// A thumbtack in the text's own color (currentColor), so it follows the theme
// and forced colors. One glyph for both states (E67): the stylesheet fills it
// and tints the pill while `aria-pressed` is true.
const ICON_PIN = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path class="desk-pin__head" d="M8 3h8l-1 6 3 4H6l3-4z" /><path d="M12 17v5" /></svg>`;

/** Set a button's state and tooltip from whether its footnote is pinned. */
function paint(button) {
  const pinned = Boolean(current.get(keyOf(whereOf(button)))?.has(button.dataset.deskPin));
  const name = `Pin footnote ${button.dataset.deskPinLabel}`;
  button.setAttribute("aria-pressed", String(pinned));
  // No visible words, so the label is the name; the letter says which footnote.
  // The name stays put (aria-pressed is the state); the tooltip adds it in words.
  button.setAttribute("aria-label", name);
  setTip(button, pinned ? `${name} (pinned)` : name);
}

/**
 * A Pin button for a footnote, kept in step with the notebook for as
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
  button.className = "desk-pin desk-pin--glyph";
  button.dataset.deskPin = id;
  button.dataset.deskPinLabel = label;
  button.dataset.deskPinBook = at.bookKey;
  button.dataset.deskPinChapter = String(at.chapter);
  // The word shows where a list has room for it (E72: the Footnotes list, the
  // Footnotes pane, This verse); the popover keeps the glyph alone. It never
  // names the button, which is "Pin footnote 3" (aria-label).
  button.innerHTML = `${ICON_PIN}<span class="desk-pin__word" aria-hidden="true">Pin</span>`;
  paint(button);
  // A chapter nothing has read yet (a pane's, on /desk) doesn't know its pins.
  if (!current.has(keyOf(at))) load(at).then(() => paint(button));
  button.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (isBusy(button)) return;
    const done = busy(button);
    try {
      await toggle(id, label, at);
    } catch (err) {
      console.error("Study Desk: the footnote couldn't be pinned or unpinned", err);
      showNotice("The pin couldn’t be saved in this browser, so nothing changed. Try again.");
    } finally {
      done();
      paint(button);
    }
  });
  return button;
}

/* ── Showing a pin on the page ───────────────────────────────────── */

/**
 * The footnote a pin sits on in this chapter now, as findPin says, or null.
 * Chapter View only. It answers for a note on a footnote (M11) too, which names
 * its footnote the same way.
 */
function footnoteOf(record) {
  return env ? footnoteElementFor(record) : null;
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

/** The lists that carry a flag under a note: Chapter View's Footnotes list and the Footnotes pane's. */
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
          li.querySelector(".desk-pin")?.focus({ preventScroll: true });
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
 * the page's own chapter on Chapter View, and every chapter a button is drawn
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
 * nothing off a Chapter View chapter (or /desk, `desk: true`, where the panes
 * ask for their own buttons) or without a notebook.
 *
 * @param {{ store: object | null, ctx: () => { client: string, contentVersion: string },
 *   desk?: boolean }} options
 * @returns {{ reveal: (record: object) => boolean, canReveal: (record: object) => boolean } | null}
 */
export function initPins({ store, ctx, desk = false }) {
  if (!store || !(desk || pageChapter())) return null;
  env = { store, ctx };
  initFootnoteNotes({ store, ctx });

  for (const li of document.querySelectorAll(".footnotes-wrap ol.footnotes > li[id]")) {
    const label = li.querySelector(".footnote-backlink")?.textContent.trim() ?? "";
    const button = pinButton(li.id, label);
    if (!button) continue;
    li.classList.add("desk-fn");
    // Pin goes after the note, in the left margin where there is room (E49).
    // A note on this footnote (M11) sits in the margin beside it
    // (notes-margin.js), not under it. "Add a note" sat beside Pin until
    // notes on a footnote could no longer be added (BVJ, 2026-11-10, E79).
    li.append(footnotePills(button));
  }
  initFootnotePills(document.querySelector(".footnotes-wrap ol.footnotes"));

  // chapter-tools.js offers the popover before placing it, and so does /desk's
  // LIT pane, which names its chapter in the detail (`book`, `chapter`). The
  // Pin button shares the line "See in footnotes" has, so the popover grows no
  // taller, and the reader's notes on this footnote (M11), at most two, go
  // under that line.
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
    const mine = footnoteNotes(note.id, where, { compact: true });
    if (mine) row.after(mine);
  });

  // This tab's own changes and other tabs' alike, but not a place or a
  // bookmark moving as the reader reads, which writes every few seconds (BA107).
  store.subscribe(() => refreshPins(), { except: [...NO_CHAPTER_KINDS, MOVE_KIND] });
  refreshPins();

  return { reveal: revealFootnote, canReveal: canRevealFootnote };
}
