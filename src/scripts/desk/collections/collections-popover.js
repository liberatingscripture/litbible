// src/scripts/desk/collections/collections-popover.js
//
// The "Collections…" popover on a row (D13, decision 24; STUDY-DESK.md):
// Labels…'s twin (labels-ui.js), with the same classes and the same floating
// panel (lit-panel.js), so Escape and an outside click close it and focus
// goes back to the button that opened it. It has a checkbox for each
// collection, checked where the collection holds the record: checking puts
// the record in, unchecking takes it out, and a field at the foot makes a new
// collection with this record as its first member.
//
// Every change is one store.change over the notebook read in the write's own
// transaction (planCollectionChange), so it is one step in the history, as a
// label toggle is, and it writes the collection only, never the record (its
// `modified` stays put). There is no undo bar: ticking a box is too small to
// announce twice. The list is drawn again whenever the notebook changes
// (another tab, an undo).

import { canEdit } from "../../../lib/desk-records.mjs";
import {
  ITEM_KINDS,
  addableCollections,
  collectionName,
  createCollection,
  holdsItem,
  itemMember,
  planAddItems,
  planCollectionChange,
  removeItem,
} from "../../../lib/desk-collections.mjs";
import { collectionTooBig } from "../../../lib/desk-collection-format.mjs";
import { kindName, planSave } from "../../../lib/desk-store-core.mjs";
import { sheetName } from "../../../lib/desk-sheet-passages.mjs";
import { closePanel, currentPanel, showPanel } from "../../lit-panel.js";

let seq = 0;

const MESSAGES = {
  empty: "Type a name first.",
  gone: "That collection isn’t there any more. Close this and try again.",
  full: "That collection is full, so nothing was added.",
  missing: "That item isn’t in the notebook any more.",
};

/**
 * What the popover calls a record: "note on Romans 8:3", or “sheet "Name"”.
 * `reference` is the record's reference (recordReference), unused for a sheet.
 */
export function collectionsSubject(record, reference) {
  if (record?.kind === "sheet") return `sheet “${sheetName(record)}”`;
  return `${kindName(record.kind).toLowerCase()}${reference ? ` on ${reference}` : ""}`;
}

/**
 * What a "Collections…" button says: where the record is, by the test the
 * popover itself uses for a ticked box (`listed`, `holdsItem`), so the two
 * never disagree. "In Advent small group", "In 2 collections", or
 * "Collections…" when it is in none.
 */
export function collectionsWords(records, recordId) {
  const held = listed(records, recordId).filter((c) => holdsItem(c, recordId));
  if (held.length === 0) return "Collections…";
  if (held.length === 1) return `In ${collectionName(held[0])}`;
  return `In ${held.length} collections`;
}

/**
 * Sets a row's "Collections…" button's visible words and its label now (the
 * words are "Collections…" until the store has been read) and keeps them
 * current: it listens for a collection's write itself, since that wakes no
 * view of marks, and stops once the button has left the document, so a list
 * drawn again leaves no listener behind. The label begins with the visible
 * words (WCAG 2.5.3) and names the item: "In Advent, collections for note on
 * John 3:16".
 *
 * @param {HTMLElement} button
 * @param {{ store: object, recordId: string, subject: string, records?: object[] | null }} options
 */
export function keepCollectionsWords(button, { store, recordId, subject, records = null }) {
  const entry = {
    button,
    born: Date.now(),
    seen: false,
    show(all) {
      const words = all ? collectionsWords(all, recordId) : "Collections…";
      button.textContent = words;
      button.setAttribute(
        "aria-label",
        words === "Collections…" ? `Collections for ${subject}` : `${words}, collections for ${subject}`,
      );
    },
  };
  // A caller that has just read the notebook hands it over, so the first words cost no second read.
  entry.show(records);
  const w = watcher(store);
  w.entries.add(entry);
  if (!records) readOnce(store).then((all) => entry.show(all), () => {});
  return () => w.entries.delete(entry);
}

// Every button a store's lists draw shares one listener and one read of the
// notebook per change, since a list of 200 rows is drawn again at every change
// to the notebook. A button gone from the document is dropped at the next
// change of any kind, so a list drawn again leaves nothing behind for long.
const watchers = new WeakMap();
const reads = new WeakMap();

/** The notebook as one read gives it to every button asking in the same moment. */
function readOnce(store) {
  let p = reads.get(store);
  if (!p) {
    p = Promise.resolve(store.all()).finally(() => reads.delete(store));
    reads.set(store, p);
  }
  return p;
}

function watcher(store) {
  let w = watchers.get(store);
  if (w) return w;
  w = { entries: new Set() };
  watchers.set(store, w);
  store.subscribe((_ids, _origin, kinds) => {
    const now = Date.now();
    const live = [];
    for (const e of w.entries) {
      if (e.button.isConnected) {
        e.seen = true;
        live.push(e);
      } else if (e.seen || now - e.born > 10_000) w.entries.delete(e);
    }
    // Only a collection's change, or one that names no kinds (an older tab), changes the words.
    if (!live.length || (Array.isArray(kinds) && !kinds.includes("collection"))) return;
    readOnce(store).then((all) => {
      for (const e of live) if (e.button.isConnected) e.show(all);
    }, () => {});
  });
  return w;
}

/**
 * The quiet "Collections…" button of My Notes' and This verse's rows (the
 * `desk-item__tag` Labels… has there), which opens the popover. `track(id)` is
 * told which record's popover is open, and `track(null)` when it closes, so a
 * list drawn again can hand the open popover the new button. Null when the
 * record can't go in a collection or can't be changed here.
 *
 * @param {{ store: object | null, ctx: (() => object) | null, record: object, reference?: string,
 *   track?: (id: string | null) => void }} options
 */
export function collectionsTag({ store, ctx, record, reference = "", track = () => {} }) {
  if (!store || !ctx || !ITEM_KINDS.includes(record.kind) || !canEdit(record)) return null;
  const subject = collectionsSubject(record, reference);
  const tag = document.createElement("button");
  tag.type = "button";
  tag.className = "desk-item__tag desk-item__collections";
  keepCollectionsWords(tag, { store, recordId: record.id, subject });
  tag.addEventListener("click", () => {
    track(record.id);
    openCollectionsPopover({ trigger: tag, store, ctx, recordId: record.id, name: subject }).then(() => {
      const open = currentPanel();
      if (!open) return;
      const done = open.onClose;
      open.onClose = () => {
        done?.();
        track(null);
      };
    });
  });
  return tag;
}

/**
 * The collections the popover lists: those that can take it, plus any that
 * hold it and can't take more (full). By name, as Labels… lists labels, never
 * changed-last: a tick writes the collection, which would otherwise carry it
 * to the top, out from under the pointer.
 */
function listed(records, recordId) {
  const ids = new Set(addableCollections(records).map((c) => c.id));
  return records
    .filter((r) => r?.kind === "collection" && canEdit(r) && (ids.has(r.id) || holdsItem(r, recordId)))
    .sort(
      (a, b) =>
        collectionName(a).localeCompare(collectionName(b)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
}

/**
 * @param {object} options
 * @param {Element} options.trigger the button the popover opens beside
 * @param {object} options.store
 * @param {() => object} options.ctx
 * @param {string} options.recordId the record the collections are for
 * @param {string} [options.name] what to call it in the popover ("note on Romans 8:3")
 * @returns {Promise<HTMLElement>} the panel
 */
export async function openCollectionsPopover({ trigger, store, ctx, recordId, name = "" }) {
  const n = ++seq;
  const panel = document.createElement("div");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-labelledby", `deskCollectionsTitle${n}`);
  panel.tabIndex = -1;
  panel.classList.add("lit-panel--menu", "desk-labels");
  panel.innerHTML = `
    <div class="lit-panel__header">
      <p class="lit-panel__heading" id="deskCollectionsTitle${n}">Collections</p>
      <button type="button" class="lit-panel__close" aria-label="Close">×</button>
    </div>
    ${name ? `<p class="desk-labels__for"></p>` : ""}
    <ul class="desk-labels__list"></ul>
    <p class="desk-labels__none" hidden>No collections yet. Make one below.</p>
    <form class="desk-labels__new">
      <label class="sr-only" for="deskCollectionsNew${n}">New collection</label>
      <input class="desk-labels__input" id="deskCollectionsNew${n}" type="text" maxlength="200" placeholder="New collection" autocomplete="off" />
      <button type="submit" class="desk-labels__add">Add</button>
    </form>
    <p class="desk-labels__error" role="alert" hidden></p>`;
  if (name) panel.querySelector(".desk-labels__for").textContent = name;

  const list = panel.querySelector(".desk-labels__list");
  const none = panel.querySelector(".desk-labels__none");
  const input = panel.querySelector(".desk-labels__input");
  const error = panel.querySelector(".desk-labels__error");
  const say = (message) => {
    error.hidden = !message;
    error.textContent = message ?? "";
  };
  const opCtx = () => ({ now: new Date().toISOString(), ...ctx() });

  async function draw() {
    const records = await store.all();
    const record = records.find((r) => r.id === recordId && r.kind !== "trash");
    if (!record) return closePanel();
    const collections = listed(records, recordId);
    const focused = list.contains(document.activeElement) ? document.activeElement.dataset.collectionId : null;
    none.hidden = collections.length > 0;
    list.hidden = collections.length === 0;
    list.replaceChildren(
      ...collections.map((c) => {
        const li = document.createElement("li");
        const row = document.createElement("label");
        row.className = "desk-setting desk-labels__row";
        const box = document.createElement("input");
        box.type = "checkbox";
        box.className = "desk-setting__input";
        box.checked = holdsItem(c, recordId);
        box.dataset.collectionId = c.id;
        const text = document.createElement("span");
        text.className = "desk-setting__label";
        text.textContent = collectionName(c);
        row.append(box, text);
        li.append(row);
        box.addEventListener("change", () => toggle(c.id, box));
        return li;
      }),
    );
    if (focused) list.querySelector(`[data-collection-id="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
  }

  async function toggle(collectionId, box) {
    say(null);
    const putIn = box.checked;
    let plan = null;
    try {
      // Read and written together, so another tab's edit isn't overwritten.
      await store.change(async ({ all }) => {
        const records = await all();
        if (!records.some((r) => r.id === recordId && r.kind !== "trash")) {
          plan = { missing: true };
          return null;
        }
        plan = putIn
          ? planAddItems(records, collectionId, [recordId], opCtx())
          : planCollectionChange(records, collectionId, (c) => removeItem(c, recordId, opCtx()));
        return plan.changed ? plan : null;
      });
    } catch (err) {
      if (!collectionTooBig(err)) console.error("Study Desk: the collection wasn’t changed", err);
      plan = { refused: err };
    }
    if (plan?.changed || (plan && !plan.gone && !plan.refused && !plan.missing)) return; // written, or already as asked
    box.checked = !putIn;
    if (plan?.missing) return say(MESSAGES.missing);
    if (plan?.gone) return say(MESSAGES.gone);
    if (plan?.refused && collectionTooBig(plan.refused)) return say(MESSAGES.full);
    say("That couldn’t be saved in this browser, so nothing changed. Try again.");
  }

  panel.querySelector(".desk-labels__new").addEventListener("submit", async (e) => {
    e.preventDefault();
    say(null);
    if (!input.value.trim()) return say(MESSAGES.empty);
    let missing = false;
    try {
      await store.change(async ({ all }) => {
        const records = await all();
        const record = records.find((r) => r.id === recordId && r.kind !== "trash");
        if (!record || !ITEM_KINDS.includes(record.kind)) {
          missing = true;
          return null;
        }
        return planSave(createCollection({ name: input.value, members: [itemMember(recordId)] }, opCtx()));
      });
      if (missing) return say(MESSAGES.missing);
      input.value = "";
      input.focus({ preventScroll: true });
    } catch (err) {
      console.error("Study Desk: the collection wasn’t made", err);
      say("The collection couldn’t be saved in this browser. Its name is still in the field: try again.");
    }
  });
  panel.querySelector(".lit-panel__close").addEventListener("click", closePanel);

  const off = store.subscribe(() => draw());
  // Drawn before it is placed, so the popover is its full height when it finds room.
  await draw();
  showPanel(trigger, panel, {
    restoreFocus: trigger,
    sheet: false,
    onClose: off,
    extra: { kind: "collections", collectionsFor: recordId },
  });
  panel.focus({ preventScroll: true });
  return panel;
}
