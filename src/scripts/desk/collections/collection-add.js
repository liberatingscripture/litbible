// src/scripts/desk/collections/collection-add.js
//
// "Add to collection ▸" in the verse menu and the selection panel (D13, step
// 3; STUDY-DESK.md, "Getting things in"), the twin of Add to sheet's row
// (../sheets/sheet-add.js): the five collections changed last, "New
// collection…", and, past five, "All collections…" (E154's pick window). It
// is in Chapter View and in /desk's LIT pane, which has no Add to sheet row
// (its own "Add to “…”" aims at the Sheets pane). Read View and the glossary
// get none.
//
// A pick adds the passage through addPassageToCollection (add-passage.js), so
// the words, the undo bar and the repeat check are that module's. Nothing is
// remembered: the row never becomes "Add to “X”" (decision 17). A passage is
// whole verses (decision 20): a selection adds every verse it touches, never
// its start and end words. The passage is read when a row is pressed, since a
// selection is gone once the menu closes.

import { rangeToOffsets } from "../../../lib/desk-anchor-dom.mjs";
import { ADD_MENU_COLLECTIONS, addableCollections, collectionName, needsAllCollections, passageMember } from "../../../lib/desk-collections.mjs";
import { passageFromOffsets, passageFromVerses, passageReference } from "../../../lib/desk-sheet-passages.mjs";
import { closePanel, currentPanel } from "../../lit-panel.js";
import { flyoutRow } from "../../panel-flyout.js";
import { undoEntry } from "../history.js";
import { chapterTextFor } from "../page.js";
import { openPickWindow } from "../pick-window.js";
import { showUndo } from "../undo-bar.js";
import { dateWords } from "../desk-text.js";
import { buttons } from "../dom.js";
import { addPassageToCollection, collectionHref } from "./add-passage.js";
import { openNewCollection } from "./new-collection.js";

const button = buttons("lit-panel__btn");

/** The pick window's rows: each collection's name, and when it was last changed. */
const pickItems = (list) =>
  list.map((c) => ({ id: c.id, name: c.name, detail: c.modified && dateWords(c.modified) ? `Changed ${dateWords(c.modified)}` : "" }));

/**
 * Start listening; call once. `store` null (no notebook here) offers nothing.
 * @returns {(d: object, where: { bookKey: string, chapter: number }) => HTMLElement | null}
 *   the row for one panel, or null where it has none
 */
export function createCollectionAdd({ store, ctx }) {
  if (!store) return () => null;
  // Every collection that can take a passage (`addableCollections`), read once
  // and again only after a collection changes.
  let collections = null;
  let reading = null;
  let picker = null;
  const read = () =>
    (reading ??= store
      .byKind("collection")
      .then((records) => (collections = addableCollections(records)))
      .catch((err) => {
        console.error("Study Desk: the verse menu couldn’t read the collections", err);
        return [];
      })
      .finally(() => { reading = null; }));
  store.subscribe(
    () => {
      collections = null;
      if (!picker?.isOpen()) return;
      store
        .byKind("collection")
        .then((records) => {
          if (picker?.isOpen()) picker.update(pickItems(addableCollections(records)));
        })
        .catch((err) => console.error("Study Desk: the collections window couldn’t read the collections", err));
    },
    { kinds: ["collection"] },
  );
  read();

  return function collectionRow(d, where) {
    if (d.view !== "study" && d.view !== "desk") return null;
    const box = document.createElement("div");
    box.className = "desk-collection-add";
    const draw = (list) => box.replaceChildren(row(d, where, list));
    if (collections) draw(collections);
    else read().then(() => draw(collections ?? []));
    return box;
  };

  function row(d, where, list) {
    const items = list.slice(0, ADD_MENU_COLLECTIONS).map((c) => {
      const b = button(`“${c.name}”`);
      b.addEventListener("click", () => add(d, where, c));
      return b;
    });
    const fresh = button("New collection…");
    fresh.title = "Start a new collection holding this passage";
    fresh.setAttribute("aria-haspopup", "dialog");
    fresh.addEventListener("click", () => openNew(d, where));
    items.push(fresh);
    if (needsAllCollections(list)) {
      const more = button("All collections…");
      more.setAttribute("aria-haspopup", "dialog");
      more.addEventListener("click", () => openAll(d, where));
      items.push(more);
    }
    // A finger's chips stay flat, under a small heading, as Add to sheet's do.
    if (d.panel?.classList.contains("lit-panel--chips")) {
      const flat = document.createElement("div");
      const label = document.createElement("p");
      label.className = "lit-panel__subheading";
      label.textContent = "Add to collection";
      flat.append(label);
      for (const b of items) {
        const r = document.createElement("div");
        r.className = "lit-panel__row";
        r.append(b);
        flat.append(r);
      }
      return flat;
    }
    return flyoutRow("Add to collection", items, { pointerFocus: d.kind !== "selection" });
  }

  /** The whole verses the panel names: a selection's are every verse it touches. */
  function passageOf(d, where) {
    const { contentVersion } = ctx();
    let text = null;
    try {
      text = d.textFor?.() ?? chapterTextFor(where.bookKey, where.chapter);
      let first = d.start;
      let last = d.end;
      if (d.kind === "selection" && d.range && text) {
        const offsets = rangeToOffsets(text, d.range);
        if (offsets) {
          const touched = passageFromOffsets(text, where, offsets[0], offsets[1], contentVersion);
          first = touched.verse;
          last = touched.endVerse;
        }
      }
      return passageFromVerses(text, where, first, last, contentVersion);
    } catch (err) {
      console.error("Study Desk: couldn’t read the passage for the collection", err);
      return passageFromVerses(null, where, d.start, d.end);
    }
  }

  /** Read the passage and tell the panel it is acting; a selection is cleared, as every pick does. */
  function takePassage(d, where) {
    d.acting?.();
    const fields = passageOf(d, where);
    const open = currentPanel();
    const from = open?.el === d.panel ? open.restoreFocus : null;
    const near = d.panel?.isConnected ? d.panel.getBoundingClientRect() : null;
    if (d.kind === "selection") window.getSelection()?.removeAllRanges();
    return { fields, from, near };
  }

  /** Close the menu for a window that takes focus and gives it back to the verse number. */
  function closeForWindow(d) {
    const open = currentPanel();
    if (open?.el === d.panel) open.restoreFocus = null;
    closePanel();
  }

  function backTo(d, from) {
    return () => (from?.isConnected ? from : document.getElementById(`v${d.start}`));
  }

  function add(d, where, pick) {
    const { fields } = takePassage(d, where);
    closePanel();
    return addPassageToCollection({ store, ctx, collectionId: pick.id, fields, name: pick.name });
  }

  /** "New collection…": the name window, with the passage as the first member. */
  function openNew(d, where) {
    const { fields, from, near } = takePassage(d, where);
    closeForWindow(d);
    const reference = passageReference(fields);
    return openNewCollection({
      store,
      ctx,
      near,
      firstMember: passageMember(fields),
      lead: `${reference} will be its first passage.`,
      back: backTo(d, from),
      onCreated: (collection, entry) => {
        showUndo(`${reference} added to ${collectionName(collection)}.`, () => undoEntry(entry), {
          link: { label: "Open the collection", href: collectionHref(collection.id) },
        });
      },
    });
  }

  /** "All collections…": every collection that can take the passage, with a filter box. */
  function openAll(d, where) {
    const { fields, from, near } = takePassage(d, where);
    closeForWindow(d);
    picker = openPickWindow({
      heading: "Add to collection",
      title: "All collections",
      lead: `Choose the collection for ${passageReference(fields)}.`,
      noun: ["collection", "collections"],
      items: pickItems(collections ?? []),
      near,
      back: backTo(d, from),
      onPick: (item) => addPassageToCollection({ store, ctx, collectionId: item.id, fields, name: item.name }),
    });
    if (!collections) read().then(() => picker?.isOpen() && picker.update(pickItems(collections ?? [])));
    return picker;
  }
}
