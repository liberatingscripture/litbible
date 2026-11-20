// src/scripts/desk/collections/add-records.js
//
// Records and a label's bookmarks put into a collection from My Notebook and My
// Notes (D13, step 5; E176; STUDY-DESK.md, "Getting things in"). Two windows,
// both E154's pick window (pick-window.js, decision 25: no look of their own):
//
//   openAddRecords  "Add these 12 to a collection…" under either list's count,
//                   while its search or label filter is on (kept-list.js,
//                   tab-mine.js): whatever the list shows that a collection can hold
//                   (ITEM_KINDS). A pick adds them as items; its "New
//                   collection…" row makes a collection holding them.
//   openAddLabel    a label's "Add all bookmarks labeled Advent…": the same
//                   window with decision 23's two choices above the list, "Only
//                   the 12 labeled Advent now" (items) and "These 12, and any
//                   you label Advent from now on" (a rule member).
//
// And two that start from the collection, its "Add ▾" (E177; collection-view.js):
//
//   openAddSheet    "Sheet…": the reader's sheets (no templates). A pick adds
//                   the sheet as an item.
//   openAddLabels   "A label's bookmarks…": the labels on a bookmark, with
//                   decision 23's two choices above the list, in words that
//                   name no label, since none is chosen yet.
//
// Every write is one `store.change` over the notebook as that transaction
// reads it (planAddItems, planCollectionChange with addRule), so one Ctrl+Z
// takes it back, and the undo bar says where it went, with "Open the
// collection", in add-passage.js's words for a refusal.

import { collectionTooBig } from "../../../lib/desk-collection-format.mjs";
import {
  addRule,
  addableCollections,
  collectionName,
  isBookmarkRule,
  itemMember,
  labelBookmarks,
  planAddItems,
  planCollectionChange,
  ruleMember,
} from "../../../lib/desk-collections.mjs";
import { kindName, recordReference } from "../../../lib/desk-store-core.mjs";
import { labelIds, liveLabels } from "../../../lib/desk-labels.mjs";
import { sheetName, sortSheets } from "../../../lib/desk-sheet-passages.mjs";
import { isOwnTemplate } from "../../../lib/desk-sheets.mjs";
import { undoEntry } from "../history.js";
import { openPickWindow } from "../pick-window.js";
import { showNotice, showUndo } from "../undo-bar.js";
import { dateWords, plural } from "../desk-text.js";
import { collectionLink } from "./add-passage.js";
import { openNewCollection } from "./new-collection.js";

const openLink = collectionLink;

const pickItems = (list) =>
  list.map((c) => ({ id: c.id, name: c.name, detail: c.modified && dateWords(c.modified) ? `Changed ${dateWords(c.modified)}` : "" }));

/**
 * What the bar calls one record that was added: a sheet by its name ("Week 1:
 * The Magnificat"), anything else by its kind and reference ("Note on John
 * 3:16"). Two or more are counted by the caller instead.
 */
function addedName(record) {
  if (record.kind === "sheet") return sheetName(record);
  const ref = recordReference(record);
  const kind = kindName(record.kind);
  return ref ? `${kind} on ${ref}` : kind;
}

const GONE = "That collection couldn’t be changed. It may have been deleted. Nothing was added.";
const FAILED = "They couldn’t be added. Nothing was changed. Try again in a moment.";

/**
 * Write `planFor(records)` (a collection plan) as one transaction. Resolves to
 * the plan, or `{ failed: true }`, or `{ refused }` for a size limit.
 */
async function write(store, planFor) {
  let plan = null;
  try {
    await store.change(async ({ all }) => {
      plan = planFor(await all());
      return plan.changed ? plan : null;
    });
  } catch (err) {
    if (!collectionTooBig(err)) console.error("Study Desk: the records couldn’t be added to the collection", err);
    return { refused: err };
  }
  return plan ?? { failed: true };
}

/** Say why a write that didn't go through didn't; true when it was one. */
function refusal(plan, shownAs) {
  if (plan.gone) {
    showNotice(GONE);
    return true;
  }
  const name = plan.collection ? collectionName(plan.collection) : shownAs || "That collection";
  if (plan.refused) {
    showNotice(collectionTooBig(plan.refused) ? `${name} is full, so nothing was added.` : FAILED);
    return true;
  }
  if (plan.failed) {
    showNotice(FAILED);
    return true;
  }
  return false;
}

/**
 * Add records to a collection as items, and say so on the undo bar: "12 added
 * to Advent series." Ones it holds already are left, and counted.
 *
 * @returns {Promise<"added" | "again" | "failed">}
 */
export async function addRecordsToCollection({ store, ctx, collectionId, recordIds, name = "" }) {
  const wanted = [...new Set(recordIds)];
  let only = null;
  const plan = await write(store, (records) => {
    only = wanted.length === 1 ? records.find((r) => r?.id === wanted[0]) ?? null : null;
    return planAddItems(records, collectionId, wanted, { now: new Date().toISOString(), ...ctx() });
  });
  if (refusal(plan, name)) return "failed";
  const where = collectionName(plan.collection);
  if (!plan.changed) {
    showNotice(`${wanted.length === 1 ? "That is" : "Those are"} in ${where} already.`, { link: openLink(collectionId) });
    return "again";
  }
  const skipped = wanted.length - plan.added.length;
  const entry = store.lastEntry();
  const what = only && plan.added.length === 1 ? addedName(only) : String(plan.added.length);
  showUndo(`${what} added to ${where}.${skipped > 0 ? ` ${skipped} ${skipped === 1 ? "was" : "were"} there already.` : ""}`, () => undoEntry(entry), {
    link: openLink(collectionId),
  });
  return "added";
}

/**
 * Add a label's bookmarks to a collection: as items (`rule` false), or as a
 * rule that keeps adding (`rule` true). The bookmarks are read in the write's
 * own transaction, so the count is what it held.
 *
 * @returns {Promise<"added" | "again" | "failed">}
 */
export async function addLabelToCollection({ store, ctx, collectionId, label, rule, name = "" }) {
  const stamp = () => ({ now: new Date().toISOString(), ...ctx() });
  let count = 0;
  let again = false;
  let only = null;
  const plan = await write(store, (records) => {
    const bookmarks = labelBookmarks(records, label.id);
    count = bookmarks.length;
    if (!rule) {
      only = bookmarks.length === 1 ? bookmarks[0] : null;
      const done = planAddItems(records, collectionId, bookmarks.map((b) => b.id), stamp());
      again = !done.changed && !done.gone && !done.refused;
      return done;
    }
    const done = planCollectionChange(records, collectionId, (c) => addRule(c, label.id, records, stamp()));
    again = !done.changed && !done.gone && !done.refused;
    return done;
  });
  if (refusal(plan, name)) return "failed";
  const where = collectionName(plan.collection);
  if (again) {
    showNotice(
      rule ? `${where} adds every bookmark labeled ${label.name} already.` : `Those bookmarks are in ${where} already.`,
      { link: openLink(collectionId) },
    );
    return "again";
  }
  const entry = store.lastEntry();
  showUndo(
    rule ? `${count} labeled ${label.name} added to ${where}, and new ones will be.` : `${only ? addedName(only) : count} added to ${where}.`,
    () => undoEntry(entry),
    { link: openLink(collectionId) },
  );
  return "added";
}

/** The collections a window lists, read when it opens. */
const readCollections = async (store) => addableCollections(await store.byKind("collection"));

/**
 * "Add these N to a collection…": the pick window over the records `recordIds`.
 *
 * @param {{ store: object, ctx: () => object, recordIds: string[],
 *   near?: { left: number, top: number } | null, back?: HTMLElement | (() => HTMLElement | null) | null }} options
 */
export async function openAddRecords({ store, ctx, recordIds, near = null, back = null }) {
  const ids = [...new Set(recordIds)];
  const these = ids.length === 1 ? "this one" : `these ${ids.length}`;
  const list = await readCollections(store);
  return openPickWindow({
    heading: "Add to collection",
    title: "Add to a collection",
    lead: `Choose the collection for ${these}.`,
    noun: ["collection", "collections"],
    items: pickItems(list),
    near,
    back,
    onPick: (pick) => addRecordsToCollection({ store, ctx, collectionId: pick.id, recordIds: ids, name: pick.name }),
    action: {
      label: "New collection…",
      onPress: () =>
        openNewCollection({
          store,
          ctx,
          near,
          members: ids.map((id) => itemMember(id)),
          lead: `It will start with ${these}.`,
          back,
          onCreated: async (made, entry) => {
            const only = ids.length === 1 ? (await store.all()).find((r) => r?.id === ids[0]) : null;
            showUndo(`${only ? addedName(only) : ids.length} added to ${collectionName(made)}.`, () => undoEntry(entry), { link: openLink(made.id) });
          },
        }),
    },
  });
}

/**
 * A label's "Add all bookmarks labeled Advent…": the pick window with decision
 * 23's two choices above the list.
 *
 * @param {{ store: object, ctx: () => object, label: { id: string, name: string }, count: number,
 *   near?: { left: number, top: number } | null, back?: HTMLElement | (() => HTMLElement | null) | null }} options
 */
export async function openAddLabel({ store, ctx, label, count, near = null, back = null }) {
  const list = await readCollections(store);
  return openPickWindow({
    heading: "Labels",
    title: "Add to a collection",
    noun: ["collection", "collections"],
    items: pickItems(list),
    near,
    back,
    choices: {
      label: "Which bookmarks",
      value: "rule",
      options: [
        { value: "now", label: `Only the ${count === 1 ? "one" : count} labeled ${label.name} now` },
        { value: "rule", label: `${count === 1 ? "This one" : `These ${count}`}, and any you label ${label.name} from now on` },
      ],
    },
    onPick: (pick, choice) =>
      addLabelToCollection({ store, ctx, collectionId: pick.id, label, rule: choice === "rule", name: pick.name }),
    action: {
      label: "New collection…",
      onPress: async (choice) => {
        const rule = choice === "rule";
        const records = await store.all();
        const members = rule ? [ruleMember(label.id)] : labelBookmarks(records, label.id).map((b) => itemMember(b.id));
        openNewCollection({
          store,
          ctx,
          near,
          members,
          // Decision 23's words: BVJ found "now and later" ambiguous.
          lead: rule
            ? `It will hold every bookmark labeled ${label.name}, and any you label ${label.name} from now on.`
            : `It will start with the ${plural(members.length, "bookmark", "bookmarks")} labeled ${label.name}.`,
          back,
          onCreated: async (collection, entry) => {
            const only = !rule && members.length === 1 ? (await store.all()).find((r) => r?.id === members[0].recordId) : null;
            showUndo(
              rule
                ? `${count} labeled ${label.name} added to ${collectionName(collection)}, and new ones will be.`
                : `${only ? addedName(only) : members.length} added to ${collectionName(collection)}.`,
              () => undoEntry(entry),
              { link: openLink(collection.id) },
            );
          },
        });
      },
    },
  });
}

/**
 * The sheets a collection's "Sheet…" offers: every sheet the reader has made,
 * no templates, newest change first.
 *
 * @param {object[]} records sheets, or the whole notebook
 */
export const sheetsToAdd = (records) => sortSheets((records ?? []).filter((r) => r?.kind === "sheet" && !isOwnTemplate(r)));

/**
 * The labels "A label's bookmarks…" offers: each label on at least one
 * bookmark, by name, with how many it is on.
 *
 * @param {object[]} records the notebook
 * @returns {{ label: { id: string, name: string }, count: number }[]}
 */
export function labelsToAdd(records) {
  return liveLabels(records ?? [])
    .map((label) => ({ label, count: labelBookmarks(records, label.id).length }))
    .filter((x) => x.count > 0);
}

/** `collection` as the notebook `records` holds it now, else as given. */
const latest = (records, collection) => records.find((r) => r?.id === collection.id && r.kind === "collection") ?? collection;

/** The ids of the records a collection holds as items. */
const heldIds = (collection) =>
  new Set((collection?.members ?? []).filter((m) => m?.type === "item").map((m) => m.recordId));

/**
 * A collection's "Add ▾ › Sheet…" (E177): the pick window over the reader's
 * sheets, each saying when it was last changed, or that the collection holds
 * it already. A pick adds that sheet as an item, as a sheet row's
 * "Collections…" does.
 *
 * @param {{ store: object, ctx: () => object, collection: object,
 *   near?: { left: number, top: number } | null, back?: HTMLElement | (() => HTMLElement | null) | null }} options
 */
export async function openAddSheet({ store, ctx, collection, near = null, back = null }) {
  let records = [];
  try {
    records = await store.all();
  } catch (err) {
    console.error("Study Desk: couldn’t read the sheets", err);
  }
  const sheets = sheetsToAdd(records);
  // The collection as it is now, which a view drawn a moment ago may not show yet.
  const now = latest(records, collection);
  const name = collectionName(now);
  const held = heldIds(now);
  return openPickWindow({
    heading: "Add to collection",
    title: "Choose a sheet",
    lead: `Choose the sheet to add to ${name}.`,
    noun: ["sheet", "sheets"],
    items: sheets.map((s) => ({
      id: s.id,
      name: sheetName(s),
      detail: held.has(s.id) ? `In ${name} already` : s.modified && dateWords(s.modified) ? `Changed ${dateWords(s.modified)}` : "",
    })),
    near,
    back,
    onPick: (pick) => addRecordsToCollection({ store, ctx, collectionId: collection.id, recordIds: [pick.id], name }),
  });
}

/**
 * A collection's "Add ▾ › A label's bookmarks…" (E177): the pick window over
 * the labels on a bookmark, with decision 23's two choices above the list. A
 * pick adds that label's bookmarks as items, or a rule that keeps adding, as a
 * label's "Add all bookmarks labeled Advent…" does.
 *
 * @param {{ store: object, ctx: () => object, collection: object,
 *   near?: { left: number, top: number } | null, back?: HTMLElement | (() => HTMLElement | null) | null }} options
 */
export async function openAddLabels({ store, ctx, collection, near = null, back = null }) {
  let records = [];
  try {
    records = await store.all();
  } catch (err) {
    console.error("Study Desk: couldn’t read the labels", err);
  }
  const now = latest(records, collection);
  const name = collectionName(now);
  // A label the collection adds new bookmarks from already says so.
  const ruled = new Set((now?.members ?? []).filter(isBookmarkRule).map((m) => m.match.label));
  return openPickWindow({
    heading: "Add to collection",
    title: "Choose a label",
    lead: `Choose the label whose bookmarks go in ${name}.`,
    noun: ["label", "labels"],
    filterLabel: "Filter by name",
    items: labelsToAdd(records).map(({ label, count }) => ({
      id: label.id,
      name: label.name,
      detail: labelIds(records, label.id).some((id) => ruled.has(id))
        ? `${plural(count, "bookmark", "bookmarks")}, new ones added already`
        : plural(count, "bookmark", "bookmarks"),
    })),
    near,
    back,
    choices: {
      label: "Which bookmarks",
      value: "rule",
      options: [
        { value: "now", label: "Only the ones with that label now" },
        { value: "rule", label: "Those, and any you give that label from now on" },
      ],
    },
    onPick: (pick, choice) =>
      addLabelToCollection({ store, ctx, collectionId: collection.id, label: { id: pick.id, name: pick.name }, rule: choice === "rule", name }),
  });
}
