// src/scripts/desk/sheets/sheet-add.js
//
// "Add to sheet ▸" in the verse menu and the selection panel, in Chapter View
// and in /desk's LIT pane (STUDY-DESK.md, S12, part 2, way 3; BVJ, 2026-11-08,
// decision 3; the LIT pane since E170, BVJ 2026-11-19): the five sheets changed
// last, "New sheet…", and, past five, "All sheets…". It adds without leaving the
// page, and the undo bar offers Undo and "Open the sheet". The rules are
// src/lib/desk-sheet-add.mjs; this reads the notebook and the page.
//
// It is Add to collection's twin (../collections/collection-add.js; E172, BVJ
// 2026-11-19: "It should match what we did with collections"). Nothing is
// remembered and no add is one press: the row never becomes "Add to “X”", not
// even while a Sheets pane shows a sheet, since one press could put a passage
// on the wrong sheet unseen (D13's decision 17). "New sheet…" opens the name
// window (../collections/name-window.js), the title starting as the passage's
// reference. "All sheets…" (E154; BVJ, 2026-11-18) closes the menu and opens the
// pick window (../pick-window.js) over every sheet the flyout could take, with a
// filter box. Each reads the passage when it is pressed, since the selection is
// gone once the menu closes.
//
// On /desk a pick of the sheet a Sheets pane shows goes through that pane's
// editor (`paneSheet`, sheet-pane.js, handed in by desk-page.js), so the passage
// shows there at once. Read View and the glossary get no row.

import { rangeToOffsets } from "../../../lib/desk-anchor-dom.mjs";
import { ADD_MENU_SHEETS, addableSheets, addedMessage, needsAllSheets, newSheetWithPassage, planAddToSheet } from "../../../lib/desk-sheet-add.mjs";
import { SHEET_LIMITS } from "../../../lib/desk-sheet-format.mjs";
import { passageFromOffsets, passageFromVerses, passageReference, sheetName } from "../../../lib/desk-sheet-passages.mjs";
import { closePanel, currentPanel } from "../../lit-panel.js";
import { flyoutRow } from "../../panel-flyout.js";
import { openNameWindow } from "../collections/name-window.js";
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

/** A sentence saying why nothing was added, shown as a notice; none says nothing. */
const tell = (said) => {
  if (said) showNotice(said);
};

/**
 * Start listening; call once. `store` null (no notebook here) offers nothing.
 * `paneSheet` is /desk's: the sheet a Sheets pane shows, as
 * `{ id, name, add(fields) }`, or null while none shows one.
 * @returns {(d: object, where: { bookKey: string, chapter: number }) => HTMLElement | null}
 *   the row for one panel, or null where it has none
 */
export function createSheetAdd({ store, ctx, paneSheet = null }) {
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
    if (d.view !== "study" && d.view !== "desk") return null;
    const box = document.createElement("div");
    box.className = "desk-sheet-add";
    const draw = (list) => box.replaceChildren(row(d, where, list));
    if (sheets) draw(sheets);
    else read().then(() => draw(sheets ?? []));
    return box;
  };

  function row(d, where, list) {
    // On /desk, the sheet a Sheets pane shows: a pick of it goes through the pane.
    const inPane = d.view === "desk" ? paneSheet?.() ?? null : null;
    const items = list.slice(0, ADD_MENU_SHEETS).map((s) => {
      const b = button(`“${s.name}”`);
      b.addEventListener("click", () => (inPane?.id === s.id ? addToPane(d, where, inPane, b) : add(d, where, s)));
      return b;
    });
    const fresh = button("New sheet…");
    fresh.title = "Start a new sheet holding this passage";
    fresh.setAttribute("aria-haspopup", "dialog");
    fresh.addEventListener("click", () => openNew(d, where));
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
      // A LIT pane's panel reads its own chapter's text (`textFor`).
      text = d.textFor?.() ?? chapterTextFor(where.bookKey, where.chapter);
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
   * Read the passage, as every pick does, and tell the panel it is acting.
   * Returns the passage, the element focus goes back to after a window (the
   * verse number a keyboard opened the menu from, else the passage's first),
   * and where the menu was, for a window to open there.
   */
  function takePassage(d, where) {
    d.acting?.();
    const fields = passageOf(d, where);
    const open = currentPanel();
    const from = open?.el === d.panel ? open.restoreFocus : null;
    const near = d.panel?.isConnected ? d.panel.getBoundingClientRect() : null;
    if (d.kind === "selection") window.getSelection()?.removeAllRanges();
    return { fields, from, near };
  }

  /**
   * Close the menu for a window, which takes focus and gives it back to the
   * verse number when it closes, so the menu doesn't hand it there on the way
   * out too.
   */
  function closeForWindow(d) {
    const open = currentPanel();
    if (open?.el === d.panel) open.restoreFocus = null;
    closePanel();
  }

  function backTo(d, from) {
    return () => (from?.isConnected ? from : document.getElementById(`v${d.start}`));
  }

  /**
   * Add to the sheet in the Sheets pane, through its editor, which shows the
   * passage and announces it; the flyout's item says how it went and the panel
   * closes. A passage already on the sheet is added again, and the line saying
   * so stays long enough to read (BA75).
   */
  async function addToPane(d, where, inPane, btn) {
    d.acting?.();
    const fields = passageOf(d, where);
    let added = false;
    try {
      added = await inPane.add(fields);
    } catch (err) {
      console.error("Study Desk: the passage couldn't be added to the sheet", err);
    }
    const again = added?.again === true;
    btn.textContent = !added ? "Couldn’t add it" : again ? "Added again ✓" : "Added ✓";
    if (again) {
      const hint = document.createElement("p");
      hint.className = "lit-panel__hint";
      hint.textContent = added.message;
      (btn.closest(".lit-panel__row") ?? btn).after(hint);
    }
    if (d.kind === "selection") window.getSelection()?.removeAllRanges();
    setTimeout(closePanel, again ? 2500 : 700);
  }

  /** Add to `pick` ({ id, name }). One change, one undo. */
  function add(d, where, pick) {
    const { fields } = takePassage(d, where);
    closePanel();
    return write(fields, pick).then(tell);
  }

  /**
   * "New sheet…" (E172): the name window, as "New collection…" opens it, the
   * title starting as the passage's reference. Create makes the sheet with the
   * passage on it; Cancel adds nothing. A failed write is said in the window,
   * which stays open.
   */
  function openNew(d, where) {
    const { fields, from, near } = takePassage(d, where);
    closeForWindow(d);
    const reference = passageReference(fields);
    return openNameWindow({
      heading: "Add to sheet",
      title: "New sheet",
      lead: `${reference} will be its first passage.`,
      submit: "Create",
      fields: [{ key: "title", label: "Title", value: reference, maxLength: SHEET_LIMITS.title }],
      near,
      back: backTo(d, from),
      onSubmit: ({ title }) => write(fields, null, title),
    });
  }

  /**
   * "All sheets…": every sheet that can take the passage, in a window with a
   * filter box. The menu closes first, and the window opens where it was.
   */
  function openAll(d, where) {
    const { fields, from, near } = takePassage(d, where);
    closeForWindow(d);
    picker = openPickWindow({
      heading: "Add to sheet",
      title: "All sheets",
      lead: `Choose the sheet for ${passageReference(fields)}.`,
      noun: ["sheet", "sheets"],
      items: pickItems(sheets ?? []),
      near,
      back: backTo(d, from),
      onPick: (item) => write(fields, { id: item.id, name: item.name }).then(tell),
    });
    // The list may be a moment old: read it again, as a menu opening would.
    if (!sheets) read().then(() => picker?.isOpen() && picker.update(pickItems(sheets ?? [])));
    return picker;
  }

  /**
   * Write `fields` to `pick`, or to a new sheet titled `title` when it is
   * null, and show the undo bar. Resolves null, or the sentence saying why
   * nothing was added, for the caller to show.
   */
  async function write(fields, pick, title = "") {
    let why = null;
    let outcome = null;
    try {
      outcome = await store.change(async ({ get }) => {
        const opCtx = { now: new Date().toISOString(), ...ctx() };
        if (!pick) {
          const sheet = newSheetWithPassage(fields, opCtx, title);
          return { sheet, put: [sheet], remove: [] };
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
      return why === "full"
        ? `“${pick.name}” is full, so nothing was added.`
        : why === "gone"
          ? `“${pick.name}” couldn’t be changed. It may have been deleted. Nothing was added.`
          : "The passage couldn’t be added. Nothing was changed. Try again in a moment.";
    }
    const entry = store.lastEntry();
    showUndo(addedMessage(fields, sheetName(outcome.sheet), { again: outcome.again }), () => undoEntry(entry), {
      link: { label: "Open the sheet", href: `${BASE}sheets/?id=${encodeURIComponent(outcome.sheet.id)}` },
    });
    return null;
  }
}
