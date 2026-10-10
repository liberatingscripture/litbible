// src/scripts/desk/change-notice.js
//
// The change notice, as the page shows it (STUDY-DESK.md N3 and C3, phase 1c).
// When a later publish changes the words a reader's note or highlight was made
// on, the mark says so, shows exactly what changed, and offers Keep, Delete and
// "Show in the text": the apps' "Re-read in Context, Keep, Delete". The rules
// (what counts as a change, what Keep writes, the words) are in
// src/lib/desk-change.mjs, pure and unit-tested; this file reads the page,
// draws the card and does what the reader chooses.
//
// Nothing is written until the reader acts (format principle 5). Keep rewrites
// the mark where it is now, through the store, and the undo bar and Ctrl+Z take
// it back like any other change. Delete is the notebook's ordinary delete.
//
// A notice is judged only where the chapter's text is on the page: a Study
// View chapter, or a chapter of the book Read View shows, or the glossary
// entry or article a prose note is on. The "Everything" list therefore shows
// none for other chapters, by design. The text is read fresh on every call:
// the map it carries points at today's DOM nodes (CLAUDE.md).
//
// Everything a reader wrote (a note's words, a highlight's quote) is put on the
// page as text, never as HTML.

import { offsetsToRange } from "../../lib/desk-anchor-dom.mjs";
import {
  changeNotice,
  excerptDiff,
  mayKeep,
  noticeWords,
  planKeep,
  proseNotice,
  releaseNoteFor,
} from "../../lib/desk-change.mjs";
import { proseAnchorText } from "../../lib/desk-prose-anchor.mjs";
import { shortQuote } from "../../lib/desk-notes.mjs";
import { canEdit, compareContentVersions, proseTarget } from "../../lib/desk-records.mjs";
import { recordReference } from "../../lib/desk-store-core.mjs";
import { closePanel, showPanel } from "../lit-panel.js";
import { glyph } from "./glyphs.js";
import { undoEntry } from "./history.js";
import { prosePage, targetOf } from "./note-sources.js";
import { chapterTextFor } from "./page.js";
import { announce, showUndo } from "./undo-bar.js";

/** The content version of the text this page is showing. */
const pageVersion = () => document.documentElement.dataset.contentVersion || "unversioned";

/* ── Reading the page ────────────────────────────────────────────── */

/**
 * A reader of the page's anchor texts that reads each body once, for the
 * records it is asked about. `textOf(record)` gives the chapter's text for a
 * note or highlight on verses, or the body's for a note on a glossary entry or
 * an article; null where this page doesn't show it.
 */
function textReader() {
  const chapters = new Map();
  const bodies = new Map();
  let page;
  return (record) => {
    const target = proseTarget(record);
    if (target) {
      page ??= prosePage() ?? null;
      const there = page ? targetOf(page, record) : null;
      if (!there) return null;
      if (!bodies.has(there)) bodies.set(there, proseAnchorText(there.root));
      return bodies.get(there);
    }
    if (!record?.bookKey || !record.chapter) return null;
    const key = `${record.bookKey}/${record.chapter}`;
    if (!chapters.has(key)) chapters.set(key, chapterTextFor(record.bookKey, record.chapter));
    return chapters.get(key);
  };
}

/**
 * The notice a record carries in `text`, or null. It is desk-change's notice
 * plus `markedNow`: the words now standing where the mark is drawn, which the
 * card shows when there is no verse copy to compare (a record from an app, or
 * a note on an entry).
 */
function noticeIn(record, text) {
  if (!text) return null;
  try {
    const notice = proseTarget(record)
      ? proseNotice(text, record)
      : changeNotice(text, record, pageVersion());
    if (!notice) return null;
    const markedNow =
      notice.kind === "changed" && Number.isInteger(notice.start) && Number.isInteger(notice.end)
        ? text.text.slice(notice.start, notice.end)
        : null;
    return { ...notice, markedNow };
  } catch (err) {
    // One record the rules can't read (a bad quote from somewhere else) must
    // not take the others' notices with it.
    console.error("Study Desk: a change notice couldn't be worked out", err);
    return null;
  }
}

/**
 * The notices on this page for these records: a Map from a record's id to its
 * notice, with the records that carry none left out.
 */
export function noticesFor(records) {
  const out = new Map();
  const textOf = textReader();
  for (const r of records ?? []) {
    if (r?.kind !== "note" && r?.kind !== "highlight") continue;
    const notice = noticeIn(r, textOf(r));
    if (notice) out.set(r.id, notice);
  }
  return out;
}

/** The record's notice on this page, or null. */
export function noticeFor(record) {
  return noticesFor([record]).get(record?.id) ?? null;
}

const toRange = (pts) => {
  const range = document.createRange();
  range.setStart(pts.startContainer, pts.startOffset);
  range.setEnd(pts.endContainer, pts.endOffset);
  return range;
};

/**
 * The notices on records on verses that are drawn on this page today, each
 * with the words the mark sits on as a live Range: `[{ record, notice, range }]`.
 * A mark that is lost is not drawn, so it is left out.
 */
export function drawnNotices(records) {
  const out = [];
  const chapters = new Map();
  for (const r of records ?? []) {
    if (!r?.bookKey || !r.chapter || proseTarget(r)) continue;
    const key = `${r.bookKey}/${r.chapter}`;
    if (!chapters.has(key)) chapters.set(key, chapterTextFor(r.bookKey, r.chapter));
    const text = chapters.get(key);
    const notice = noticeIn(r, text);
    if (!notice || notice.start == null) continue;
    const pts = offsetsToRange(text, notice.start, notice.end);
    if (pts) out.push({ record: r, notice, range: toRange(pts) });
  }
  return out;
}

/* ── Names ───────────────────────────────────────────────────────── */

/** "Yellow highlight" or "Note", as the lists name a record. */
export function markName(record) {
  if (record?.kind === "highlight") {
    const c = typeof record.color === "string" ? record.color : "";
    return c ? `${c[0].toUpperCase()}${c.slice(1)} highlight` : "Highlight";
  }
  return "Note";
}

const lowerFirst = (s) => `${s[0].toLowerCase()}${s.slice(1)}`;

/** What a flag says, in a few words. */
export const flagText = (notice) => (notice?.kind === "lost" ? "Not in the text" : "Wording changed");

/* ── The flag ────────────────────────────────────────────────────── */

// Two curved arrows, as "updated" is drawn elsewhere: legible at 14px, and
// currentColor, so the flag is muted by its text and not by a colour of its own.
const CHANGED_PATHS = `<path d="M20 11a8 8 0 0 0-14.3-4.5L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.3 4.5l1.7-2M20 20v-4.5h-4.5"/>`;

/** The changed glyph as SVG markup. Decorative: the flag's words say it. */
export function changedGlyph(cls = "desk-changed-glyph") {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${CHANGED_PATHS}</svg>`;
}

/**
 * The flag on a row of a list (My Notes, This verse): the glyph and
 * "Wording changed · Review" (or "Not in the text · Review"), a button that
 * opens the card. `open(button)` is what pressing it does. Its name carries
 * what it is about, so a list of them reads one by one.
 */
export function flagButton(record, notice, open) {
  const ref = recordReference(record);
  const b = document.createElement("button");
  b.type = "button";
  b.className = "desk-flag desk-flag--row";
  b.setAttribute("aria-haspopup", "dialog");
  b.innerHTML = changedGlyph();
  const words = document.createElement("span");
  words.className = "desk-flag__text";
  words.append(flagText(notice));
  const stop = document.createElement("span");
  stop.className = "sr-only";
  stop.textContent = ".";
  const dot = document.createElement("span");
  dot.setAttribute("aria-hidden", "true");
  dot.textContent = " · ";
  const review = document.createElement("span");
  review.append("Review");
  const about = document.createElement("span");
  about.className = "sr-only";
  about.textContent = ` ${lowerFirst(markName(record))}${ref ? ` on ${ref}` : ""}`;
  words.append(stop, dot, review, about);
  b.append(words);
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    open(b);
  });
  return b;
}

/* ── What the notice says about itself ───────────────────────────── */

let releaseNotes = null;

/** The release notes, fetched once per page and only when a card asks; null if they can't be had. */
function loadReleaseNotes() {
  releaseNotes ??= fetch("/api/data/release-notes.json")
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);
  return releaseNotes;
}

/** The newest published version, for two publishes on one day; null when it can't be had. */
async function liveVersion() {
  try {
    const res = await fetch("/api/version.json", { cache: "no-store" });
    if (!res.ok) return null;
    const body = await res.json();
    return typeof body?.version === "string" ? body.version : null;
  } catch {
    return null;
  }
}

/**
 * Whether this page may rewrite the record (never on older text than the
 * record's). When the two versions can't be ordered the page asks the site
 * what the newest version is, once.
 */
async function keepAllowed(record) {
  const version = pageVersion();
  if (mayKeep(record, version)) return true;
  if (compareContentVersions(record.contentVersion, version) !== null) return false;
  return mayKeep(record, version, await liveVersion());
}

/* ── The card ────────────────────────────────────────────────────── */

let seq = 0;

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

/**
 * The diff as a paragraph: unchanged words as they read, deleted words struck
 * through, added words underlined, each with a hidden "Removed:" or "Added:"
 * for a screen reader (the pattern of the release notes page). Null when
 * there is nothing to show.
 */
function diffParagraph(notice) {
  const runs = excerptDiff(notice.diff ?? []);
  if (!runs.length) return null;
  const p = el("p", "desk-notice__diff");
  for (const run of runs) {
    if (run.lead) p.append(run.lead);
    if (run.op === "same") {
      p.append(run.text);
      continue;
    }
    const mark = el(run.op === "del" ? "del" : "ins");
    mark.append(el("span", "sr-only", run.op === "del" ? "Removed: " : "Added: "), run.text);
    p.append(mark);
  }
  return p;
}

/**
 * Open the card for a record's notice, in the shared floating panel beside
 * `trigger`. Does nothing if the record carries no notice on this page.
 *
 * @param {Element} trigger what the card opens beside
 * @param {object} record
 * @param {object} options
 * @param {object} options.store
 * @param {() => { client: string, contentVersion: string }} options.ctx
 * @param {{ can(record: object): boolean, go(record: object): void } | null} [options.showInText]
 *   takes the reader to the mark on the page, where it can
 * @param {Element} [options.restoreFocus] where focus goes when the card closes (the trigger)
 * @param {(what: "keep" | "delete" | "show", record: object) => void} [options.onDone]
 *   called after the card has closed on a choice, for a list to redraw and place focus
 * @returns {HTMLElement | null}
 */
export function openNotice(trigger, record, { store, ctx, showInText = null, restoreFocus = trigger, onDone = null }) {
  const notice = noticeFor(record);
  if (!notice) return null;
  const n = ++seq;
  const ref = recordReference(record);
  const words = noticeWords(notice, record, ref);
  const noun = record.kind === "highlight" ? "highlight" : "note";

  const panel = el("div", "lit-panel--menu desk-notice");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-labelledby", `deskNoticeTitle${n}`);
  panel.tabIndex = -1;
  panel.setAttribute("data-desk-notice", "");

  const header = el("div", "lit-panel__header");
  const heading = el("p", "lit-panel__heading", words.title);
  heading.id = `deskNoticeTitle${n}`;
  const close = el("button", "lit-panel__close", "×");
  close.type = "button";
  close.setAttribute("aria-label", "Close");
  close.addEventListener("click", closePanel);
  header.append(heading, close);
  panel.append(header);

  // The mark: "Yellow highlight · Romans 8:3", or its marker, "My note · Romans 8:3"
  // and the first two lines of its words.
  const mark = el("p", "desk-notice__mark");
  if (record.kind === "highlight") {
    const chip = el("span", "desk-notice__chip");
    if (typeof record.color === "string") chip.dataset.color = record.color;
    chip.setAttribute("aria-hidden", "true");
    mark.append(chip);
    mark.append(el("span", "desk-notice__kind", markName(record)));
  } else {
    mark.insertAdjacentHTML("beforeend", glyph(record.marker, "desk-glyph desk-notice__glyph"));
    mark.append(el("span", "desk-notice__kind", "My note"));
  }
  if (ref) mark.append(" · ", el("span", "desk-notice__ref", ref));
  panel.append(mark);
  if (record.kind === "note" && record.body) panel.append(el("p", "desk-notice__body", record.body));

  panel.append(el("p", "desk-notice__text", words.text));

  // When, and why: filled in once the release notes are in, if they are.
  const when = el("p", "desk-notice__when");
  when.hidden = notice.kind === "lost";
  when.textContent = "Changed after you made this";
  panel.append(when);
  loadReleaseNotes().then((entries) => {
    const found = entries ? releaseNoteFor(entries, record) : null;
    if (!found || !panel.isConnected) return;
    const link = el("a", null, "Release note");
    link.href = found.href;
    when.hidden = false;
    when.replaceChildren(`Changed ${found.label} · `, link);
  });

  // What changed, word by word. Without a verse copy to compare (a record
  // from an app, a note on an entry) the words now standing in place of the
  // marked ones are shown instead.
  const diff = diffParagraph(notice);
  if (diff) {
    panel.append(el("p", "desk-notice__label", "What changed"), diff);
  } else if (notice.markedNow) {
    panel.append(el("p", "desk-notice__label", "Now it reads"), el("p", "desk-notice__quote", `‘${shortQuote(notice.markedNow, 40)}’`));
  }
  // The words the reader marked, which are no longer there.
  if (notice.kind !== "reworded" && record.quote?.exact) {
    const marked = el("p", "desk-notice__marked");
    marked.append(`You marked: ‘${shortQuote(record.quote.exact, 24)}’`);
    panel.append(marked);
  }

  const error = el("p", "desk-notice__error");
  error.setAttribute("role", "alert");
  error.hidden = true;
  panel.append(error);

  // Keep first (the one that writes, so it leads), then Show in the text,
  // then Delete at the far end. Tab order follows the picture.
  const actions = el("div", "desk-notice__actions");
  const keep = words.keep && canEdit(record) ? el("button", "desk-notice__keep", words.keep) : null;
  if (keep) {
    keep.type = "button";
    actions.append(keep);
  }
  const show = showInText && notice.kind !== "lost" && showInText.can(record) ? el("button", "desk-notice__show", "Show in the text") : null;
  if (show) {
    show.type = "button";
    actions.append(show);
  }
  const del = el("button", "desk-notice__delete", "Delete");
  del.type = "button";
  actions.append(del);
  panel.append(actions);

  const buttons = [...actions.querySelectorAll("button")];
  const busy = (on) => {
    for (const b of buttons) b.disabled = on;
  };
  const fail = (message) => {
    error.hidden = false;
    error.textContent = message;
    busy(false);
  };

  async function doKeep() {
    busy(true);
    error.hidden = true;
    try {
      // The record as it is now, and its notice worked out again: the card may
      // have been open while something else changed it.
      const fresh = await store.get(record.id);
      if (!fresh || fresh.kind === "trash") return closePanel();
      const textOf = textReader();
      const text = textOf(fresh);
      const current = noticeIn(fresh, text);
      if (!current) return closePanel();
      if (!(await keepAllowed(fresh))) {
        return fail("This page is older than your mark. Reload the page, then try again.");
      }
      const next = planKeep({ text, record: fresh, notice: current, ctx: ctx() });
      if (!next) return fail(`That ${noun} can't be kept here.`);
      await store.save(next);
      // The change this made, read at once: the undo button, like Ctrl+Z,
      // takes back exactly this one (history.js).
      const entry = store.lastEntry();
      closePanel();
      const said = `Kept your ${noun} on ${ref}.`;
      if (entry) showUndo(said, () => undoEntry(entry));
      else announce(said);
      onDone?.("keep", fresh);
    } catch (err) {
      console.error("Study Desk: the mark wasn't kept", err);
      fail(`The ${noun} couldn't be kept in this browser.`);
    }
  }

  async function doDelete() {
    busy(true);
    error.hidden = true;
    try {
      const trash = await store.remove(record.id);
      const entry = trash ? store.lastEntry() : null;
      closePanel();
      if (entry) showUndo(`${markName(record)} on ${ref} deleted.`, () => undoEntry(entry));
      onDone?.("delete", record);
    } catch (err) {
      console.error("Study Desk: the mark wasn't deleted", err);
      fail(`The ${noun} couldn't be deleted.`);
    }
  }

  keep?.addEventListener("click", doKeep);
  del.addEventListener("click", doDelete);
  show?.addEventListener("click", () => {
    closePanel();
    showInText.go(record);
    onDone?.("show", record);
  });

  showPanel(trigger, panel, {
    restoreFocus,
    sheet: false,
    extra: { kind: "change-notice" },
  });
  panel.focus({ preventScroll: true });
  return panel;
}
