// src/scripts/desk/sheets/sheet-add.js
//
// "Add to sheet ▸" in Chapter View's verse menu and selection panel
// (STUDY-DESK.md, S12, part 2, way 3; BVJ, 2026-11-08, decision 3): the
// reader's sheets, newest change first, and "New sheet". It adds without
// leaving the page, and the undo bar offers Undo and "Open the sheet". The
// rules are src/lib/desk-sheet-add.mjs; this reads the notebook and the page.
//
// /desk's LIT pane has its own "Add to “…”" (sheet-pane.js), aimed at the
// Sheets pane last worked in, so this offers nothing there.

import { rangeToOffsets } from "../../../lib/desk-anchor-dom.mjs";
import { addMenuSheets, addedMessage, newSheetWithPassage, planAddToSheet } from "../../../lib/desk-sheet-add.mjs";
import { passageFromOffsets, passageFromVerses, sheetName } from "../../../lib/desk-sheet-passages.mjs";
import { closePanel } from "../../lit-panel.js";
import { flyoutRow } from "../../panel-flyout.js";
import { undoEntry } from "../history.js";
import { chapterTextFor } from "../page.js";
import { showNotice, showUndo } from "../undo-bar.js";

const BASE = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");

/**
 * Start listening; call once. `store` null (no notebook here) offers nothing.
 * @returns {(d: object, where: { bookKey: string, chapter: number }) => HTMLElement | null}
 *   the row for one panel, or null where it has none
 */
export function createSheetAdd({ store, ctx }) {
  if (!store) return () => null;
  // The sheets, read once and again only after a sheet changes, so a menu
  // opened afterwards draws them at once.
  let sheets = null;
  let reading = null;
  const read = () =>
    (reading ??= store
      .byKind("sheet")
      .then((records) => (sheets = addMenuSheets(records)))
      .catch((err) => {
        console.error("Study Desk: the verse menu couldn't read the sheets", err);
        return [];
      })
      .finally(() => { reading = null; }));
  store.subscribe(() => { sheets = null; }, { kinds: ["sheet"] });
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
    const items = list.map((s) => {
      const b = button(`“${s.name}”`);
      b.addEventListener("click", () => add(d, where, s));
      return b;
    });
    const fresh = button("New sheet");
    fresh.title = "Start a new sheet holding this passage";
    fresh.addEventListener("click", () => add(d, where, null));
    items.push(fresh);
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

  /** Add to `pick` ({ id, name }), or to a new sheet when it is null. One change, one undo. */
  async function add(d, where, pick) {
    d.acting?.();
    const fields = passageOf(d, where);
    if (d.kind === "selection") window.getSelection()?.removeAllRanges();
    closePanel();
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

function button(label) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "lit-panel__btn";
  b.textContent = label;
  return b;
}
