// src/scripts/desk/history.js
//
// Ctrl+Z (⌘Z) and redo for the notebook, for one visit to a page. Every
// change this tab makes for the reader (a note added, edited or deleted, a
// bookmark, a highlight that merges with its neighbours) is an entry the
// store hands over (store.onEntry; src/lib/desk-history.mjs says what an entry
// holds and decides what undoing it writes). This file keeps the two stacks,
// listens for the keys, and says what happened through the undo bar.
//
// What is and isn't a change to remember:
//   - Changes from the reader's other tabs are never entries, and neither is
//     the purge of expired trash or the history's own undo and redo; the store
//     makes an entry only for what this tab writes for the reader.
//   - 50 are kept, the oldest forgotten first, and a new change clears what
//     could have been redone, as in any editor.
//   - An entry is undone only while the notebook still holds what it left. If
//     another tab or a later change has moved one of its records on, undoing
//     would erase that work, so the history says so and forgets the entry.
//
// The keys never act while the reader is typing, or has a note open in the
// editor, or is in a control that owns undo (a text field, a select, an
// editable area): the browser's own undo runs there, untouched. They are not
// tied to the site's Keyboard switch. That switch exists because a single
// letter can fire when someone dictates a word (WCAG 2.1.4), and Ctrl+Z is not
// a single-key shortcut.
//
// The undo bar's Undo button asks for the same thing (undoEntry), so a
// deletion undone from the bar is undone exactly as Ctrl+Z would, can be
// redone, and isn't itself a new change to undo.

import {
  HISTORY_LIMIT,
  describeEntry,
  inversePlan,
  lowerFirst,
  pushEntry,
  redoPlan,
  stillCurrent,
} from "../../lib/desk-history.mjs";
import { announce, hideUndo, showNotice, showUndo } from "./undo-bar.js";

/** Input types that are not a place to type, so they don't own undo. */
const NOT_TEXT = new Set(["checkbox", "radio", "button", "submit", "reset", "image", "range", "color", "file"]);

/** Whether `el` is somewhere the browser's own undo belongs. */
function owningUndo(el) {
  if (!(el instanceof Element)) return false;
  const field = el.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])");
  if (!field) return false;
  return field instanceof HTMLInputElement ? !NOT_TEXT.has(field.type) : true;
}

/** Whether the browser's own undo should be left to run, for a key pressed at `target`. */
function leaveToBrowser(target) {
  return (
    owningUndo(target) ||
    owningUndo(document.activeElement) ||
    // The note editor's own textarea is covered above, but its marker choices
    // and buttons are too: the editor is an open piece of work.
    Boolean(document.querySelector("[data-desk-editor]"))
  );
}

/** The modifier the reader presses: ⌘ on a Mac, Ctrl elsewhere. For labels. */
export function undoModifier() {
  const platform = navigator.userAgentData?.platform || navigator.platform || "";
  return /mac/i.test(platform) ? "⌘" : "Ctrl";
}

let active = null;

/**
 * Start the history for this page. Once the store is open; a second call
 * returns the first.
 *
 * @param {{ store: object, ctx: () => { client: string } }} options
 * @returns {{ undo: () => Promise<boolean>, redo: () => Promise<boolean>,
 *   undoEntry: (entry: object) => Promise<boolean>, redoEntry: (entry: object) => Promise<boolean> }}
 */
export function createHistory({ store, ctx }) {
  if (active) return active;

  const stacks = { undo: [], redo: [] };
  // The bar's notice that offers a Redo, so a new change can take it down
  // along with the redo stack it spoke for.
  let redoNotice = null;

  store.onEntry((entry) => {
    stacks.undo = pushEntry(stacks.undo, entry, HISTORY_LIMIT);
    stacks.redo = [];
    if (redoNotice !== null) hideUndo(redoNotice);
    redoNotice = null;
  });

  // One at a time: a second press while the first is still reading the
  // notebook would check records that don't have its result yet.
  let tail = Promise.resolve();
  function enqueue(task) {
    const run = tail.then(task);
    tail = run.catch(() => {});
    return run;
  }

  const forget = (id) => {
    stacks.undo = stacks.undo.filter((e) => e.id !== id);
    stacks.redo = stacks.redo.filter((e) => e.id !== id);
  };

  /** The notebook's records under the ids an entry touched, as they are now. */
  async function currentOf(entry) {
    const have = new Map();
    for (const { id } of entry.after) have.set(id, (await store.get(id)) ?? null);
    return have;
  }

  /**
   * Take an entry back (`side` "undo") or do it again ("redo"). True when it
   * was; false when it was overtaken (and has been forgotten), which the bar
   * says. A store that fails to write throws, for the caller to report.
   */
  async function step(entry, side) {
    const from = side === "undo" ? "undo" : "redo";
    const into = side === "undo" ? "redo" : "undo";

    if (!stillCurrent(entry, await currentOf(entry), side)) {
      forget(entry.id);
      showNotice(`That was changed since, so it can’t be ${side === "undo" ? "undone" : "redone"} here.`);
      return false;
    }

    const stamp = { now: new Date().toISOString(), client: ctx().client };
    const plan = side === "undo" ? inversePlan(entry, stamp) : redoPlan(entry, stamp);
    await store.commit(plan, { record: false });

    stacks[from] = stacks[from].filter((e) => e.id !== entry.id);
    stacks[into] = pushEntry(stacks[into], entry, HISTORY_LIMIT);

    const what = lowerFirst(describeEntry(entry));
    if (side === "undo") {
      redoNotice = showUndo(`Undone: ${what}`, () => redoEntry(entry), { label: "Redo" });
    } else {
      redoNotice = null;
      showUndo(`Redone: ${what}`, () => undoEntry(entry), { label: "Undo" });
    }
    return true;
  }

  const undo = () =>
    enqueue(async () => {
      const entry = stacks.undo.at(-1);
      if (!entry) {
        announce("Nothing to undo.");
        return false;
      }
      return step(entry, "undo");
    });

  const redo = () =>
    enqueue(async () => {
      const entry = stacks.redo.at(-1);
      if (!entry) {
        announce("Nothing to redo.");
        return false;
      }
      return step(entry, "redo");
    });

  /**
   * Take back one particular entry, which may no longer be the latest (the
   * undo bar's button holds the entry of the change it spoke for). Allowed
   * whenever the notebook still holds what the entry left.
   */
  const undoEntry = (entry) =>
    enqueue(async () => {
      if (!entry) throw new Error("desk-history: no change to undo");
      if (stacks.redo.some((e) => e.id === entry.id)) {
        announce("Already undone.");
        return false;
      }
      return step(entry, "undo");
    });

  /** Do one particular undone entry again; only one still waiting to be redone. */
  const redoEntry = (entry) =>
    enqueue(async () => {
      if (!entry) throw new Error("desk-history: no change to redo");
      if (!stacks.redo.some((e) => e.id === entry.id)) {
        announce("Nothing to redo.");
        return false;
      }
      return step(entry, "redo");
    });

  const failed = (err, what) => {
    console.error(`Study Desk: ${what} failed`, err);
    showNotice(`That couldn’t be ${what === "undo" ? "undone" : "redone"}.`);
  };

  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.isComposing) return;
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    let again; // redo, rather than undo
    if (key === "z") again = e.shiftKey;
    // Ctrl+Y is redo where Ctrl is the key; ⌘Y is a browser's History.
    else if (key === "y" && e.ctrlKey && !e.metaKey && !e.shiftKey) again = true;
    else return;
    if (leaveToBrowser(e.target)) return;
    e.preventDefault();
    if (again) redo().catch((err) => failed(err, "redo"));
    else undo().catch((err) => failed(err, "undo"));
  });

  active = { undo, redo, undoEntry, redoEntry };
  return active;
}

function running() {
  if (!active) throw new Error("desk-history: the history isn't running");
  return active;
}

/** Take back one entry (see createHistory). The undo bar's Undo button calls this. */
export const undoEntry = (entry) => running().undoEntry(entry);

/** Do one entry again (see createHistory). The Redo button calls this. */
export const redoEntry = (entry) => running().redoEntry(entry);
