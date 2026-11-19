// src/scripts/desk/sheets/sheet-add.js
//
// "Add to sheet ▸" in Chapter View's verse menu and selection panel
// (STUDY-DESK.md, S12, part 2, way 3; BVJ, 2026-11-08, decision 3): the
// reader's sheets, newest change first, and "New sheet". It adds without
// leaving the page, and the undo bar offers Undo and "Open the sheet". The
// rules are src/lib/desk-sheet-add.mjs; this reads the notebook and the page.
//
// The flyout lists the five sheets changed last. Where the reader has more, it
// ends in "All sheets…" (E154; BVJ, 2026-11-18), which closes the menu and
// opens the pick window (../pick-window.js) over every sheet the flyout could
// take, with a filter box. A pick there adds exactly as a flyout pick does. The
// passage is read when "All sheets…" is pressed, since the selection is gone
// once the menu closes.
//
// /desk's LIT pane has its own "Add to “…”" (sheet-pane.js), aimed at the
// Sheets pane last worked in, so this offers nothing there.

import { rangeToOffsets } from "../../../lib/desk-anchor-dom.mjs";
import { ADD_MENU_SHEETS, addableSheets, addedMessage, needsAllSheets, newSheetWithPassage, planAddToSheet } from "../../../lib/desk-sheet-add.mjs";
import { passageFromOffsets, passageFromVerses, passageReference, sheetName } from "../../../lib/desk-sheet-passages.mjs";
import { closePanel, currentPanel } from "../../lit-panel.js";
import { flyoutRow } from "../../panel-flyout.js";
import { undoEntry } from "../history.js";
import { chapterTextFor } from "../page.js";
import { openPickWindow } from "../pick-window.js";
import { showNotice, showUndo } from "../undo-bar.js";
import { dateWords } from "../desk-text.js";
import { buttons } from "../dom.js";

const button = buttons("lit-panel__btn");

const BASE = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");

/** The pick window's rows: each sheet's name, and when it was last changed. */
const pickItems = (list) =>
  list.map((s) => ({ id: s.id, name: s.name, detail: s.modified && dateWords(s.modified) ? `Changed ${dateWords(s.modified)}` : "" }));

/**
 * Start listening; call once. `store` null (no notebook here) offers nothing.
 * @returns {(d: object, where: { bookKey: string, chapter: number }) => HTMLElement | null}
 *   the row for one panel, or null where it has none
 */
export function createSheetAdd({ store, ctx }) {
  if (!store) return () => null;
  // Every sheet that can take a passage (`addableSheets`), read once and again
  // only after a sheet changes, so a menu opened afterwards draws them at once.
  let sheets = null;
  let reading = null;
  // The open "All sheets…" window, kept up to date while it is open.
  let picker = null;
  const read = () =>
    (reading ??= store
      .byKind("sheet")
      .then((records) => (sheets = addableSheets(records)))
      .catch((err) => {
        console.error("Study Desk: the verse menu couldn't read the sheets", err);
        return [];
      })
      .finally(() => { reading = null; }));
  store.subscribe(
    () => {
      sheets = null;
      // A sheet made, renamed, filled or deleted (here or in another tab) while
      // the window is open shows there at once.
      if (!picker?.isOpen()) return;
      store
        .byKind("sheet")
        .then((records) => {
          if (picker?.isOpen()) picker.update(pickItems(addableSheets(records)));
        })
        .catch((err) => console.error("Study Desk: the sheets window couldn't read the sheets", err));
    },
    { kinds: ["sheet"] },
  );
  read();

  return function sheetRow(d, where) {
    if (d.view !== "study") return null;
    const box = document.createElement("div");
    box.className = "desk-sheet-add";
    const draw = (list) => box.replaceChildren(row(d, where, list));
    if (sheets) draw(sheets);
    else read().then(() => draw(sheets ?? []));
    return box;
  };

  function row(d, where, list) {
    const items = list.slice(0, ADD_MENU_SHEETS).map((s) => {
      const b = button(`“${s.name}”`);
      b.addEventListener("click", () => add(d, where, s));
      return b;
    });
    const fresh = button("New sheet");
    fresh.title = "Start a new sheet holding this passage";
    fresh.addEventListener("click", () => add(d, where, null));
    items.push(fresh);
    // More sheets than the flyout lists: the rest are a window away (E154).
    if (needsAllSheets(list)) {
      const more = button("All sheets…");
      more.setAttribute("aria-haspopup", "dialog");
      more.addEventListener("click", () => openAll(d, where));
      items.push(more);
    }
    // A finger's chips stay flat, under a small heading, as Print's do.
    if (d.panel?.classList.contains("lit-panel--chips")) {
      const flat = document.createElement("div");
      const label = document.createElement("p");
      label.className = "lit-panel__subheading";
      label.textContent = "Add to sheet";
      flat.append(label);
      for (const b of items) {
        const r = document.createElement("div");
        r.className = "lit-panel__row";
        r.append(b);
        flat.append(r);
      }
      return flat;
    }
    return flyoutRow("Add to sheet", items, { pointerFocus: d.kind !== "selection" });
  }

  /** The passage the panel names: the selected words, else its verses. */
  function passageOf(d, where) {
    const { contentVersion } = ctx();
    let text = null;
    try {
      text = chapterTextFor(where.bookKey, where.chapter);
      if (d.kind === "selection" && d.range && text) {
        const offsets = rangeToOffsets(text, d.range);
        if (offsets) return passageFromOffsets(text, where, offsets[0], offsets[1], contentVersion);
      }
      return passageFromVerses(text, where, d.start, d.end, contentVersion);
    } catch (err) {
      console.error("Study Desk: couldn't read the passage for the sheet", err);
      return passageFromVerses(null, where, d.start, d.end);
    }
  }

  /**
   * Read the passage and close the panel, as every pick does. Returns the
   * passage, and the element focus goes back to after a window: the verse
   * number a keyboard opened the menu from, else the passage's first.
   */
  function takePassage(d, where) {
    d.acting?.();
    const fields = passageOf(d, where);
    const open = currentPanel();
    const from = open?.el === d.panel ? open.restoreFocus : null;
    if (d.kind === "selection") window.getSelection()?.removeAllRanges();
    return { fields, from };
  }

  /** Add to `pick` ({ id, name }), or to a new sheet when it is null. One change, one undo. */
  function add(d, where, pick) {
    const { fields } = takePassage(d, where);
    closePanel();
    return write(fields, pick);
  }

  /**
   * "All sheets…": every sheet that can take the passage, in a window with a
   * filter box. The menu closes first, and the window opens where it was.
   */
  function openAll(d, where) {
    const { fields, from } = takePassage(d, where);
    const near = d.panel?.isConnected ? d.panel.getBoundingClientRect() : null;
    // The window takes focus, and gives it back to the verse number when it
    // closes, so the menu doesn't hand it there on the way out too.
    const open = currentPanel();
    if (open?.el === d.panel) open.restoreFocus = null;
    closePanel();
    picker = openPickWindow({
      heading: "Add to sheet",
      title: "All sheets",
      lead: `Choose the sheet for ${passageReference(fields)}.`,
      noun: ["sheet", "sheets"],
      items: pickItems(sheets ?? []),
      near,
      back: () => (from?.isConnected ? from : document.getElementById(`v${d.start}`)),
      onPick: (item) => write(fields, { id: item.id, name: item.name }),
    });
    // The list may be a moment old: read it again, as a menu opening would.
    if (!sheets) read().then(() => picker?.isOpen() && picker.update(pickItems(sheets ?? [])));
    return picker;
  }

  /** Write `fields` to `pick`, or to a new sheet when it is null, and say so. */
  async function write(fields, pick) {
    let why = null;
    let outcome = null;
    try {
      outcome = await store.change(async ({ get }) => {
        const opCtx = { now: new Date().toISOString(), ...ctx() };
        if (!pick) {
          const sheet = newSheetWithPassage(fields, opCtx);
          return { sheet, made: true, put: [sheet], remove: [] };
        }
        // Read in this transaction: another tab may have changed it (BA129).
        const plan = planAddToSheet(await get(pick.id), fields, opCtx);
        if (plan.full || plan.gone || plan.refused) {
          why = plan.full ? "full" : "gone";
          return null;
        }
        return plan;
      });
    } catch (err) {
      console.error("Study Desk: the passage couldn't be added to the sheet", err);
      why = "failed";
    }
    if (!outcome?.sheet) {
      showNotice(
        why === "full"
          ? `“${pick.name}” is full, so nothing was added.`
          : why === "gone"
            ? `“${pick.name}” couldn’t be changed. It may have been deleted. Nothing was added.`
            : "The passage couldn’t be added. Nothing was changed. Try again in a moment.",
      );
      return;
    }
    const entry = store.lastEntry();
    const message = addedMessage(fields, sheetName(outcome.sheet), { made: Boolean(outcome.made), again: outcome.again });
    showUndo(message, () => undoEntry(entry), {
      link: { label: "Open the sheet", href: `${BASE}sheets/?id=${encodeURIComponent(outcome.sheet.id)}` },
    });
  }
}
