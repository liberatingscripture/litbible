// src/scripts/desk/trash-list.js
//
// "Trash" on the notebook page (STUDY-DESK-FIXES.md E12): what a deletion left, for
// the 30 days it waits, with Restore on each row and Restore all. A row is
// the ordinary record row (record-rows.js) with the line "Deleted Oct 28, 21
// days left" and Restore as its one button. The plans (what a restore writes,
// and the two cases it refuses) are src/lib/desk-notebook.mjs's; this file
// reads the notebook, asks, and says what happened.
//
// A restore is an ordinary change: it is remembered for Ctrl+Z and offers the
// undo bar, and undoing it puts the same trash record back (desk-history.mjs).
// "Empty the trash now" is not here; it stays under Delete everything, since
// it is the opposite act.

import { MAX_FOLLOWING } from "../../lib/desk-bookmarks.mjs";
import { labelMap } from "../../lib/desk-labels.mjs";
import {
  daysLeft,
  planRestore,
  planRestoreAll,
  trashItems,
} from "../../lib/desk-notebook.mjs";
import { describeEntry } from "../../lib/desk-history.mjs";
import { planWrite } from "../../lib/desk-store-core.mjs";
import { undoEntry } from "./history.js";
import { recordRow } from "./record-rows.js";
import { showUndo } from "./undo-bar.js";
import { el } from "./dom.js";
import { busy, isBusy } from "./focus-keep.js";

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Why a restore was refused, as a sentence. */
const REFUSED = {
  missing: "That item isn’t in the trash any more.",
  emptied: "Its words are gone, so it can’t be restored.",
  exists: "That item is already back in your notebook.",
  bookmark: "That verse already has a bookmark of the same kind, so this one stays in the trash.",
  label: "You already have a label with that name, so this one stays in the trash.",
};

const MOVES_NO_MORE = `It doesn’t move as you read, because ${MAX_FOLLOWING} bookmarks already do.`;

/** "Deleted Oct 28, 21 days left": when it went and how long its words stay. */
export function whenLine(trash, now = new Date().toISOString()) {
  const day = new Date(trash.deletedAt);
  const date = Number.isNaN(day.getTime()) ? "" : day.toLocaleDateString(undefined, { dateStyle: "medium" });
  const left = daysLeft(trash, now);
  const stays = left > 0 ? `${plural(left, "day", "days")} left` : "its words go the next time the notebook opens";
  return date ? `Deleted ${date}, ${stays}` : `Deleted ${stays}`;
}

/** What stayed behind after a Restore all, as a sentence; "" when nothing did. */
export function skippedLine(skipped) {
  const count = (reason) => skipped.filter((s) => s.reason === reason).length;
  const bookmarks = count("bookmark");
  const labels = count("label");
  const parts = [];
  if (bookmarks) parts.push(`${plural(bookmarks, "bookmark", "bookmarks")} stayed in the trash because ${bookmarks === 1 ? "its verse already has" : "their verses already have"} one of the same kind`);
  if (labels) parts.push(`${plural(labels, "label", "labels")} stayed because ${labels === 1 ? "its name is" : "their names are"} already in use`);
  return parts.length ? `${parts.join("; ")}.` : "";
}

/**
 * @param {{ store: object, ctx: () => object, announce: (message: string) => void,
 *   onChange?: () => Promise<void> | void }} options
 *   `onChange` redraws the rest of the page after a restore.
 * @returns {{ el: HTMLElement, draw: (records: object[]) => void }}
 */
export function createTrashList({ store, ctx, announce, onChange = () => {} }) {
  const root = el("div", "desk-trash");
  const count = el("p", "desk-np__count");
  count.setAttribute("aria-live", "polite");
  const all = el("button", "desk-np__restore-all", "Restore all");
  all.type = "button";
  const error = el("p", "desk-np__error");
  error.setAttribute("role", "alert");
  error.hidden = true;
  const list = el("ul", "desk-list");
  root.append(count, all, error, list);

  const say = (message) => {
    error.hidden = !message;
    error.textContent = message ?? "";
  };

  function draw(records) {
    const items = trashItems(records);
    const labels = labelMap(records);
    const now = new Date().toISOString();
    count.textContent = items.length
      ? `${plural(items.length, "deleted item", "deleted items")} in the trash.`
      : "The trash is empty.";
    all.hidden = items.length === 0;
    list.replaceChildren(
      ...items.map((t) =>
        recordRow(t.record, {
          labels,
          trash: { when: whenLine(t, now), onRestore: (_record, trigger) => restoreOne(t.id, trigger) },
        }),
      ),
    );
    if (!items.length) say(null);
  }

  /** Focus the Restore button now at `index`, or the count when none is left. */
  function focusAt(index) {
    const buttons = list.querySelectorAll(".desk-item__restore");
    const target = buttons[Math.min(index, buttons.length - 1)];
    if (target) target.focus();
    else {
      count.tabIndex = -1;
      count.focus();
    }
  }

  async function write(build) {
    let made = null;
    await store.change(async ({ all: everything }) => {
      made = build(await everything());
      return made?.plan ? planWrite(made.plan) : null;
    });
    return made;
  }

  async function finish(entry, message, index) {
    await onChange();
    announce(message);
    focusAt(index);
    if (entry) {
      showUndo(message, async () => {
        await undoEntry(entry);
        await onChange();
      });
    }
  }

  async function restoreOne(trashId, trigger) {
    say(null);
    const index = Array.from(list.querySelectorAll(".desk-item__restore")).indexOf(trigger);
    let made;
    try {
      made = await write((records) => planRestore(records, trashId, ctx()));
    } catch (err) {
      console.error("Study Desk: the item wasn't restored", err);
      say("That item couldn’t be restored in this browser, so it is still in the trash. Try again.");
      return;
    }
    if (!made?.ok) {
      say(REFUSED[made?.reason] ?? REFUSED.missing);
      // Another tab may have changed the trash; show it as it is.
      await onChange();
      return;
    }
    const entry = store.lastEntry();
    const sentence = entry ? describeEntry(entry) : "Restored.";
    await finish(entry, made.movesNoMore ? `${sentence} ${MOVES_NO_MORE}` : sentence, index);
  }

  async function restoreAll() {
    say(null);
    if (isBusy(all)) return;
    const idle = busy(all);
    let made;
    try {
      made = await write((records) => planRestoreAll(records, ctx()));
    } catch (err) {
      console.error("Study Desk: the trash wasn't restored", err);
      say("The trash couldn’t be restored in this browser, so everything is still in it. Try again.");
      return;
    } finally {
      idle();
    }
    if (!made?.restored) {
      say(skippedLine(made?.skipped ?? []) || "There is nothing in the trash that can be restored.");
      return;
    }
    const entry = store.lastEntry();
    const parts = [`Restored ${plural(made.restored, "item", "items")}.`, skippedLine(made.skipped)];
    if (made.movesNoMore) parts.push(MOVES_NO_MORE);
    await finish(entry, parts.filter(Boolean).join(" "), 0);
  }

  all.addEventListener("click", restoreAll);

  return { el: root, draw };
}
