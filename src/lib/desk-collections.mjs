// src/lib/desk-collections.mjs
//
// Collections (STUDY-DESK.md, D13; STUDY-DESK-FORMAT.md, "Collections (kind
// 12)"): making one, the changes it takes, and what it shows, with no UI of
// its own. A collection is one record, so every change returns the whole
// collection, changed through editRecord (the one place `modified` moves,
// principle 4), and is written by planCollectionChange over the notebook as it
// is read in the write's own transaction, as every change to a sheet is
// (BA129). Pure: no DOM, no storage, and no clock or randomness unless the
// caller leaves `now` or an id out. The record's checks are
// desk-collection-format.mjs.
//
// The rules it keeps, and why (BVJ, 2026-11-18, D13 and its order of work):
//   - A change that changes nothing returns the collection it was given, the
//     very same object, so nothing is written and `modified` doesn't move.
//   - Every write drops the `item` members whose record is gone for good: held
//     only as a tombstone (a trash record whose 30 days are over, `record`
//     gone). A record in the trash, or not yet synced here, keeps its member,
//     so a restore or a sync brings it back into its collections.
//   - A member of a type this code doesn't know, and a rule matching what
//     this code doesn't know, is kept where it is (principle 6): it can be
//     moved past and removed, never edited, and shows nothing.
//   - A passage is whole verses: no `quote` is ever written on one, and two
//     passages on the same verses are never added.
//   - Three orders (`collectionOrder`): Bible order (sheets first under
//     "Sheets," then everything on a verse in Bible order, a passage before
//     an item on the same verse, then anything with no verse), by type
//     (Sheets, Passages, Notes, Highlights, Bookmarks, Pinned footnotes, each
//     in Bible order) and My order (`members` as they stand, with headings).
//     Moving anything, or adding a heading, switches to My order (D13,
//     decision 6). Sheets keep the reader's order in the first two, since a
//     sheet has no verse.
//   - A rule's bookmarks: every live bookmark carrying any id of its label
//     (joined as kind 8 joins them, `labelGroups`), less `except`. In Bible
//     order they fall among the rest, by type under Bookmarks, and in My order
//     after every member, in Bible order, until the reader moves one, which
//     makes it an `item` member at that spot. A bookmark reached by an item
//     and a rule shows once, at the item's place, still tagged with the rule.
//   - A move in My order lands where the reader put it, exactly. A rule's
//     bookmark moved, or passed over by a row moved below it, becomes an item
//     where it stands, since only members keep a place; the rest of the rule's
//     bookmarks stay at the end.
//   - Names needn't differ, so restoring one from the trash never refuses.
//   - A highlight that changes id (absorbed by a merge, covered by another
//     colour, split in two) takes its collections with it in the same write
//     (`carryHighlights`, called by planHighlight), so one undo reverts both.
//     A new colour over part of a collected highlight joins it there (E182).

import { BOOK_ORDER } from "../data/books.js";
import {
  COLLECTION_FORMAT,
  COLLECTION_LIMITS,
  COLLECTION_ORDERS,
  TOO_MANY,
  collectionOrder,
  collectionTooBig,
} from "./desk-collection-format.mjs";
import { canEdit, createRecord, editRecord, newId, validateRecord } from "./desk-records.mjs";
import { labelGroups, labelIds, readsAsNothing } from "./desk-labels.mjs";
import { planSave } from "./desk-store-core.mjs";
import { fold } from "./desk-notebook.mjs";

export { collectionOrder, collectionTooBig };

/** The kinds of record an `item` member may name, and that a collection shows. */
export const ITEM_KINDS = Object.freeze(["note", "highlight", "bookmark", "footnotePin", "sheet"]);

/**
 * How many collections "Add to collection ▸" lists, the five changed last (a
 * flyout like Add to sheet's, D13 decisions 9 and 10). Past that it ends in
 * "All collections…".
 */
export const ADD_MENU_COLLECTIONS = 5;

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const chars = (s) => Array.from(s).length;
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/* ── Names and text ──────────────────────────────────────────────────── */

/** A collection's name for a list: its name, or "Untitled collection". */
export const collectionName = (c) => (typeof c?.name === "string" && c.name.trim() ? c.name.trim() : "Untitled collection");

/** One line of plain text as it is kept: NFC, runs of whitespace made one space, trimmed. */
const cleanLine = (text) => String(text ?? "").normalize("NFC").replace(/\s+/g, " ").trim();

function cleanName(name) {
  const clean = cleanLine(name);
  if (readsAsNothing(clean)) throw new Error("desk-collections: a collection needs a name");
  if (chars(clean) > COLLECTION_LIMITS.name) throw new Error(`desk-collections: a name is at most ${COLLECTION_LIMITS.name} characters`);
  return clean;
}

function cleanDescription(text) {
  const clean = String(text ?? "").normalize("NFC").replace(/\r\n?/g, "\n").trim();
  if (chars(clean) > COLLECTION_LIMITS.description) {
    throw new Error(`desk-collections: a description is at most ${COLLECTION_LIMITS.description} characters`);
  }
  return clean;
}

function cleanHeading(text) {
  const clean = cleanLine(text);
  if (chars(clean) > COLLECTION_LIMITS.heading) throw new Error(`desk-collections: a heading is at most ${COLLECTION_LIMITS.heading} characters`);
  return clean;
}

/* ── Members ─────────────────────────────────────────────────────────── */

/** An `item` member: one of the reader's records, by id. */
export function itemMember(recordId, { id } = {}) {
  if (typeof recordId !== "string" || !recordId) throw new Error("desk-collections: an item needs a record id");
  return { id: id ?? newId(), type: "item", recordId };
}

/**
 * A `passage` member: whole verses of one chapter, with the comparison copy
 * when the fields carry one. Whatever else they carry (a sheet passage's
 * `quote`, `blanks` or `footnotes`) is left behind.
 */
export function passageMember(fields, { id } = {}) {
  const { bookKey, chapter, verse, endVerse, verseCopy, verseCopyAsOf } = fields ?? {};
  return {
    id: id ?? newId(),
    type: "passage",
    bookKey,
    chapter,
    verse,
    ...(Number.isInteger(endVerse) ? { endVerse } : {}),
    ...(typeof verseCopy === "string" ? { verseCopy } : {}),
    ...(typeof verseCopyAsOf === "string" ? { verseCopyAsOf } : {}),
  };
}

/** A `rule` member: every bookmark carrying the label `labelId` (any id of it), now and later. */
export function ruleMember(labelId, { id } = {}) {
  if (typeof labelId !== "string" || !labelId) throw new Error("desk-collections: a rule needs a label id");
  return { id: id ?? newId(), type: "rule", match: { kind: "bookmark", label: labelId }, except: [] };
}

/** A `heading` member: a line of plain text dividing My order into sections. */
export function headingMember(text, { id } = {}) {
  return { id: id ?? newId(), type: "heading", text: cleanHeading(text) };
}

/** Whether a member is a rule this code knows: every bookmark with a label. */
export const isBookmarkRule = (m) =>
  m?.type === "rule" && isObject(m.match) && m.match.kind === "bookmark" && typeof m.match.label === "string" && m.match.label !== "";

const isItem = (m) => m?.type === "item" && typeof m.recordId === "string";

/** Whether two passages name the same verses (a missing `endVerse` is the first verse). */
export function sameVerses(a, b) {
  return (
    a?.bookKey === b?.bookKey &&
    a?.chapter === b?.chapter &&
    a?.verse === b?.verse &&
    (a?.endVerse ?? a?.verse) === (b?.endVerse ?? b?.verse)
  );
}

/** Whether the collection holds the record `recordId` as an item. */
export function holdsItem(collection, recordId) {
  return Array.isArray(collection?.members) && collection.members.some((m) => isItem(m) && m.recordId === recordId);
}

/** Whether the collection holds a passage on these verses. */
export function holdsPassage(collection, fields) {
  return Array.isArray(collection?.members) && collection.members.some((m) => m?.type === "passage" && sameVerses(m, fields));
}

/** The ids of `recordIds` the collection doesn't hold as items yet, each once, in the order given. */
export function notHeld(collection, recordIds) {
  const held = new Set((collection?.members ?? []).filter(isItem).map((m) => m.recordId));
  const out = [];
  for (const id of recordIds ?? []) {
    if (typeof id !== "string" || !id || held.has(id)) continue;
    held.add(id);
    out.push(id);
  }
  return out;
}

/* ── Making one ──────────────────────────────────────────────────────── */

/**
 * A new collection, in Bible order. The name is required (a collection's name
 * is its purpose, D13 decision 14) and need not differ from another's.
 *
 * @param {{ name: string, description?: string, members?: object[] }} fields
 * @param {{ now?: string, client: string, contentVersion: string, id?: string }} ctx
 */
export function createCollection({ name, description = "", members = [] } = {}, ctx) {
  const desc = cleanDescription(description);
  if (members.length > COLLECTION_LIMITS.members) throw new Error(`desk-collections: ${TOO_MANY}`);
  return createRecord(
    "collection",
    {
      collectionFormat: COLLECTION_FORMAT,
      name: cleanName(name),
      ...(desc ? { description: desc } : {}),
      order: "bible",
      members: [...members],
    },
    ctx,
  );
}

/* ── Changing one ────────────────────────────────────────────────────── */

function mustEdit(c) {
  if (c?.kind !== "collection") throw new Error("desk-collections: not a collection");
  if (!canEdit(c)) throw new Error(`desk-collections: collection ${c.id} can't be edited here (collection format ${c.collectionFormat})`);
  if (!Array.isArray(c.members)) throw new Error(`desk-collections: collection ${c.id} has no list of members`);
}

function roomFor(c, n) {
  if (c.members.length + n > COLLECTION_LIMITS.members) throw new Error(`desk-collections: ${TOO_MANY}`);
}

const withMembers = (c, members, ctx, extra = {}) => editRecord(c, { members, ...extra }, ctx);

function indexOfMember(c, memberId, type = null) {
  const at = c.members.findIndex((m) => m?.id === memberId);
  if (at < 0) throw new Error(`desk-collections: the collection has no member "${memberId}"`);
  if (type && c.members[at].type !== type) throw new Error(`desk-collections: member "${memberId}" is not a ${type}`);
  return at;
}

const FIELDS = ["name", "description"];

/**
 * The collection renamed or described; the collection itself when neither
 * differs. An empty description takes the field away.
 */
export function setCollectionFields(c, changes, ctx) {
  mustEdit(c);
  for (const f of Object.keys(changes)) {
    if (!FIELDS.includes(f)) throw new Error(`desk-collections: "${f}" isn't a field to set here (${FIELDS.join(", ")})`);
  }
  const next = {};
  if ("name" in changes) next.name = cleanName(changes.name);
  if ("description" in changes) next.description = cleanDescription(changes.description);
  const same = (!("name" in next) || next.name === c.name) && (!("description" in next) || next.description === (c.description ?? ""));
  if (same) return c;
  const drop = next.description === "";
  const out = editRecord(c, drop ? { ...next, description: undefined } : next, ctx);
  if (drop) delete out.description;
  return out;
}

/**
 * Records added as items, at the end of My order (new arrivals go there, D13).
 * One already held is skipped (`notHeld` says which are new). Refuses to pass
 * the member limit.
 */
export function addItems(c, recordIds, ctx) {
  mustEdit(c);
  const fresh = notHeld(c, recordIds);
  if (!fresh.length) return c;
  roomFor(c, fresh.length);
  return withMembers(c, [...c.members, ...fresh.map((id) => itemMember(id))], ctx);
}

/** A passage added at the end of My order; the collection itself when it holds those verses already. */
export function addPassage(c, fields, ctx) {
  mustEdit(c);
  if (holdsPassage(c, fields)) return c;
  roomFor(c, 1);
  return withMembers(c, [...c.members, passageMember(fields)], ctx);
}

/**
 * "Every bookmark labeled X, now and later": a rule for the label `labelId`.
 * The collection itself when it has a rule for that label already (any id of
 * it, `labelIds`).
 */
export function addRule(c, labelId, records, ctx) {
  mustEdit(c);
  const ids = new Set(labelIds(records ?? [], labelId));
  if (c.members.some((m) => isBookmarkRule(m) && ids.has(m.match.label))) return c;
  roomFor(c, 1);
  return withMembers(c, [...c.members, ruleMember(labelId)], ctx);
}

/** A member taken out. An item's record stays in the notebook; a rule's bookmarks held as items stay too. */
export function removeMember(c, memberId, ctx) {
  mustEdit(c);
  const at = indexOfMember(c, memberId);
  return withMembers(c, c.members.filter((_, i) => i !== at), ctx);
}

/** A rule taken out ("Remove" on its line). The bookmarks held as items stay. */
export function removeRule(c, memberId, ctx) {
  mustEdit(c);
  indexOfMember(c, memberId, "rule");
  return removeMember(c, memberId, ctx);
}

/** Every item naming `recordId` taken out; the collection itself when there is none. */
export function removeItem(c, recordId, ctx) {
  mustEdit(c);
  const members = c.members.filter((m) => !(isItem(m) && m.recordId === recordId));
  return members.length === c.members.length ? c : withMembers(c, members, ctx);
}

/**
 * "Leave it out of this collection" for a bookmark: its id goes in `except`
 * on every rule that reaches it now, and any item naming it is taken out, so
 * it is out of the collection whichever way it came in. The collection itself
 * when nothing changes.
 */
export function leaveOut(c, bookmarkId, records, ctx) {
  mustEdit(c);
  const live = liveById(records);
  const labels = labelIndex(records);
  const bookmark = live.get(bookmarkId);
  let changed = false;
  const members = [];
  for (const m of c.members) {
    if (isItem(m) && m.recordId === bookmarkId) {
      changed = true;
      continue;
    }
    if (bookmark && isBookmarkRule(m) && matches(m, bookmark, labels)) {
      const except = Array.isArray(m.except) ? m.except : [];
      if (!except.includes(bookmarkId)) {
        members.push({ ...m, except: [...except, bookmarkId] });
        changed = true;
        continue;
      }
    }
    members.push(m);
  }
  return changed ? withMembers(c, members, ctx) : c;
}

/**
 * Where an item naming the bookmark sits in `members`, read before
 * `leaveOut` takes it out: `{ memberId, after, before }` (the ids of the
 * members just before and after it, or null at an end), or null when no item
 * names it (a bookmark only a rule brought in was at the end anyway). The
 * record format keeps no place for a left-out item, so a caller remembers
 * this for as long as it wants and hands it to `bringBack`.
 */
export function leftOutPlace(c, bookmarkId) {
  if (!Array.isArray(c?.members)) return null;
  const at = c.members.findIndex((m) => isItem(m) && m.recordId === bookmarkId);
  if (at < 0) return null;
  return {
    memberId: c.members[at].id ?? null,
    after: c.members[at - 1]?.id ?? null,
    before: c.members[at + 1]?.id ?? null,
  };
}

/**
 * A bookmark left out brought back: its id taken off every rule's `except`.
 * With `place` (from `leftOutPlace`) and no item for the bookmark held now, an
 * item goes back where it was: before the member `place.before` if that is
 * still there, else after `place.after` if it is, else at the end. It reuses
 * `place.memberId` as its id when that is free. The collection itself when
 * nothing changes; refuses to pass the member limit.
 */
export function bringBack(c, bookmarkId, ctx, place = null) {
  mustEdit(c);
  let changed = false;
  let members = c.members.map((m) => {
    if (!isBookmarkRule(m) || !Array.isArray(m.except) || !m.except.includes(bookmarkId)) return m;
    changed = true;
    return { ...m, except: m.except.filter((id) => id !== bookmarkId) };
  });
  if (place && changed && !holdsItem(c, bookmarkId)) {
    roomFor(c, 1);
    const free = typeof place.memberId === "string" && !c.members.some((m) => m?.id === place.memberId);
    const item = itemMember(bookmarkId, free ? { id: place.memberId } : undefined);
    const before = place.before ? members.findIndex((m) => m?.id === place.before) : -1;
    const after = place.after ? members.findIndex((m) => m?.id === place.after) : -1;
    const at = before >= 0 ? before : after >= 0 ? after + 1 : members.length;
    members = [...members.slice(0, at), item, ...members.slice(at)];
    changed = true;
  }
  return changed ? withMembers(c, members, ctx) : c;
}

/**
 * A rule turned into the items it holds now ("Stop adding new ones," and
 * deleting a label a rule uses, D13): the rule goes, and each of its
 * bookmarks not held already becomes an item at the end of My order, in Bible
 * order, which is where My order showed them. A rule this code doesn't know
 * can't be turned.
 */
export function ruleToItems(c, ruleId, records, ctx) {
  mustEdit(c);
  const at = indexOfMember(c, ruleId, "rule");
  const rule = c.members[at];
  if (!isBookmarkRule(rule)) throw new Error(`desk-collections: rule "${ruleId}" matches something this version doesn't know`);
  const info = ruleInfo(rule, liveById(records), labelIndex(records));
  const fresh = notHeld(c, info.bookmarks.map((b) => b.id)).map((id) => itemMember(id));
  const members = [...c.members.filter((_, i) => i !== at), ...fresh];
  if (members.length > COLLECTION_LIMITS.members) throw new Error(`desk-collections: ${TOO_MANY}`);
  return withMembers(c, members, ctx);
}

/**
 * Members rearranged so My order shows `target` (rows from `collectionRows`
 * in My order, as `list` was before the change, in their new order). Members
 * that show no row (a rule, an item whose record isn't here, a type this code
 * doesn't know) keep their place after the member they followed. A rule's
 * bookmark that `target` puts before the last member, or `forced`, becomes an
 * item where it stands; the rest stay at the end, where the rule shows them.
 */
function arrange(c, list, target, forced) {
  const shown = new Set(list.filter((r) => r.member).map((r) => r.member.id));
  const after = new Map([[null, []]]);
  let anchor = null;
  for (const m of c.members) {
    if (isObject(m) && shown.has(m.id)) {
      anchor = m.id;
      continue;
    }
    if (!after.has(anchor)) after.set(anchor, []);
    after.get(anchor).push(m);
  }
  let last = -1;
  target.forEach((r, i) => {
    if (r.member || r === forced) last = i;
  });
  const out = [...after.get(null)];
  for (let i = 0; i <= last; i++) {
    const r = target[i];
    if (r.member) out.push(r.member, ...(after.get(r.member.id) ?? []));
    else out.push(itemMember(r.record.id));
  }
  return out;
}

const myOrderRows = (c, records) => collectionRows(c, records, { order: "mine" }).rows;

/**
 * A row of My order moved to sit before the row `before` (a row's `key`), or
 * last when `before` is null, and the collection switched to My order. A
 * rule's bookmark moved becomes an item at that spot (and so does any of the
 * rule's bookmarks the move puts above a member). The collection itself when
 * the row is already there.
 */
export function moveRow(c, key, before, records, ctx) {
  mustEdit(c);
  const list = myOrderRows(c, records);
  const from = list.findIndex((r) => r.key === key);
  if (from < 0) throw new Error(`desk-collections: the collection shows no row "${key}"`);
  if (before === key) return c;
  const moving = list[from];
  const rest = list.filter((_, i) => i !== from);
  const at = before == null ? rest.length : rest.findIndex((r) => r.key === before);
  if (at < 0) throw new Error(`desk-collections: the collection shows no row "${before}"`);
  const target = [...rest.slice(0, at), moving, ...rest.slice(at)];
  if (target.every((r, i) => r === list[i])) return c;
  const members = arrange(c, list, target, moving);
  if (members.length > COLLECTION_LIMITS.members) throw new Error(`desk-collections: ${TOO_MANY}`);
  return withMembers(c, members, ctx, { order: "mine" });
}

/**
 * Where the click route moves a row of My order (Move up, Move down, To top,
 * To bottom; XA8-1): `{ before }` for moveRow, or null when it is there
 * already. `rows` are My order's rows.
 *
 * @param {object[]} rows
 * @param {string} key
 * @param {"up" | "down" | "top" | "bottom"} where
 * @returns {{ before: string | null } | null}
 */
export function moveTarget(rows, key, where) {
  const list = (rows ?? []).filter((r) => r.type !== "group");
  const i = list.findIndex((r) => r.key === key);
  if (i < 0) return null;
  switch (where) {
    case "up":
      return i > 0 ? { before: list[i - 1].key } : null;
    case "down":
      return i < list.length - 1 ? { before: list[i + 2]?.key ?? null } : null;
    case "top":
      return i > 0 ? { before: list[0].key } : null;
    case "bottom":
      return i < list.length - 1 ? { before: null } : null;
    default:
      throw new Error(`desk-collections: "${where}" is not a way to move a row`);
  }
}

/**
 * A heading added, before the row `before` of My order, or after every member
 * when `before` is null (above a rule's bookmarks, which stay at the end), and
 * the collection switched to My order, where headings show.
 */
export function addHeading(c, text, before, records, ctx) {
  mustEdit(c);
  roomFor(c, 1);
  const heading = headingMember(text);
  if (before == null) return withMembers(c, [...c.members, heading], ctx, { order: "mine" });
  const list = myOrderRows(c, records);
  const at = list.findIndex((r) => r.key === before);
  if (at < 0) throw new Error(`desk-collections: the collection shows no row "${before}"`);
  const row = { type: "heading", key: heading.id, member: heading, text: heading.text };
  const members = arrange(c, list, [...list.slice(0, at), row, ...list.slice(at)], row);
  if (members.length > COLLECTION_LIMITS.members) throw new Error(`desk-collections: ${TOO_MANY}`);
  return withMembers(c, members, ctx, { order: "mine" });
}

/** A heading's words changed; the collection itself when they are the same. */
export function editHeading(c, memberId, text, ctx) {
  mustEdit(c);
  const at = indexOfMember(c, memberId, "heading");
  const clean = cleanHeading(text);
  if (c.members[at].text === clean) return c;
  return withMembers(c, c.members.map((m, i) => (i === at ? { ...m, text: clean } : m)), ctx);
}

/**
 * The order the reader chose: "bible", "type" or "mine". The collection itself
 * when it is already that (an absent order is Bible order). Bible order and
 * By type never rewrite `members`, so My order is there to return to.
 */
export function setOrder(c, order, ctx) {
  mustEdit(c);
  if (!COLLECTION_ORDERS.includes(order)) throw new Error(`desk-collections: "${order}" is not one of ${COLLECTION_ORDERS.join(", ")}`);
  if ((c.order ?? "bible") === order) return c;
  return editRecord(c, { order }, ctx);
}

/* ── Writing a change ────────────────────────────────────────────────── */

/** Which ids are gone for good: held by a tombstone alone, with no live record and no trash still holding it. */
function goneForGood(records) {
  const live = new Set();
  const held = new Set();
  const dead = new Set();
  for (const r of records ?? []) {
    if (!isObject(r)) continue;
    if (r.kind === "trash") {
      if (typeof r.deletedId !== "string") continue;
      if (r.record != null) held.add(r.deletedId);
      else dead.add(r.deletedId);
    } else if (typeof r.id === "string") live.add(r.id);
  }
  return (id) => dead.has(id) && !held.has(id) && !live.has(id);
}

/**
 * The collection without the items whose record is gone for good (held only
 * as a tombstone); the collection itself when there is none. Run on every
 * write, never on its own, since dropping one isn't the reader changing it.
 */
export function pruneMembers(collection, records) {
  if (!Array.isArray(collection?.members)) return collection;
  const gone = goneForGood(records);
  const members = collection.members.filter((m) => !(isItem(m) && gone(m.recordId)));
  return members.length === collection.members.length ? collection : { ...collection, members };
}

/**
 * Plan one change to a collection over the notebook as it is now (`records`,
 * read in the same transaction as the write), never over a copy read
 * earlier. `op` is one of the changes above, given the collection.
 *
 * - `{ gone: true }`: there is no collection here to change (deleted
 *   meanwhile, or in a format this code can't edit), so nothing is written.
 * - `{ refused: error }`: the change refused (the 1,001st member, a heading
 *   too long); `collectionTooBig(error)` says whether it was a limit.
 * - `{ collection: current, changed: false }`: it changed nothing.
 * - `{ collection: next, changed: true, put: [next], remove: [] }`: the plan,
 *   with the items whose record is gone for good dropped.
 *
 * Throws as planSave does when the changed collection can't be saved (over
 * its 512 KB), so the caller's transaction writes nothing.
 */
export function planCollectionChange(records, id, op) {
  const current = (records ?? []).find((r) => r?.id === id && r.kind !== "trash") ?? null;
  if (current?.kind !== "collection" || !canEdit(current)) return { gone: true };
  let next;
  try {
    next = op(current);
  } catch (refused) {
    return { refused };
  }
  if (next === current) return { collection: current, changed: false };
  next = pruneMembers(next, records);
  return { collection: next, changed: true, ...planSave(next) };
}

/** Records added as items: planCollectionChange's result, plus `added`, the ids that weren't held before. */
export function planAddItems(records, id, recordIds, ctx) {
  let added = [];
  const plan = planCollectionChange(records, id, (c) => {
    added = notHeld(c, recordIds);
    return addItems(c, recordIds, ctx);
  });
  return { ...plan, added: plan.changed ? added : [] };
}

/**
 * A passage added: planCollectionChange's result, plus `again` when the
 * collection holds those verses already, in which case nothing is written and
 * the reader is told (D13 decision 12).
 */
export function planAddPassage(records, id, fields, ctx) {
  let again = false;
  const plan = planCollectionChange(records, id, (c) => {
    again = holdsPassage(c, fields);
    return addPassage(c, fields, ctx);
  });
  return { ...plan, again };
}

/**
 * The rules that use a label (any id of it), for asking before it is deleted
 * (D13: "Advent is used by Advent series. Keep its 12 bookmarks there?").
 *
 * @returns {{ collection: object, rule: object }[]}
 */
export function rulesUsing(records, labelId) {
  const ids = new Set(labelIds(records ?? [], labelId));
  const out = [];
  for (const c of records ?? []) {
    if (c?.kind !== "collection" || !Array.isArray(c.members)) continue;
    for (const m of c.members) if (isBookmarkRule(m) && ids.has(m.match.label)) out.push({ collection: c, rule: m });
  }
  return out;
}

/**
 * Every rule using a label turned into its items, across the collections,
 * planned before the label is deleted (while it still matches), to go in the
 * same write as the deletion so one undo restores both. `refused` lists the
 * collections that couldn't take them (the member limit), which keep the rule.
 */
export function planLabelRulesToItems(records, labelId, ctx) {
  const put = [];
  const refused = [];
  const byCollection = new Map();
  for (const { collection, rule } of rulesUsing(records, labelId)) {
    if (!byCollection.has(collection.id)) byCollection.set(collection.id, []);
    byCollection.get(collection.id).push(rule.id);
  }
  for (const [id, ruleIds] of byCollection) {
    const plan = planCollectionChange(records, id, (c) => ruleIds.reduce((next, ruleId) => ruleToItems(next, ruleId, records, ctx), c));
    if (plan.refused) refused.push(id);
    else if (plan.changed) put.push(...plan.put);
  }
  return { put, remove: [], refused };
}

/* ── The highlight carry ─────────────────────────────────────────────── */

/**
 * The collections rewritten when highlights change id (D13's order of work):
 * `moved` maps a highlight deleted by a merge or covered by another colour to
 * the highlight that took its place, and `split` maps a highlight cut in two
 * to the new record holding its second piece. An item naming a moved one
 * names the survivor instead, under its own member id, or goes when the
 * collection holds the survivor already; the second piece of a split goes in
 * as a new item right after the first's. `joined` maps a highlight a new
 * colour took only part of (trimmed or split) to `{ id, before }`, the new
 * mark, which goes in as a new item beside it (E182; BVJ, 2026-11-19): before
 * it when only its right part is left, else after it, and so between the two
 * pieces of a split. Recolouring part of a collected highlight keeps all of
 * its words in the collection, as covering the whole of it does. A highlight
 * erased outright is a plain deletion and isn't here, so its item stays and a
 * restore brings it back. Only collections this code can edit are touched (a newer format keeps
 * its ids), each pruned as every write is, stamped with `ctx`. A new piece is
 * left out where it would pass the limits, and a collection that still
 * wouldn't save is left alone rather than fail the highlight. The apps don't
 * do this (STUDY-DESK-FORMAT.md, kind 12).
 *
 * @param {object[]} records the notebook, read in the highlight's transaction
 * @param {{ moved?: Map<string, string>, split?: Map<string, string>,
 *   joined?: Map<string, { id: string, before: boolean }> }} change
 * @param {{ now?: string, client?: string }} ctx
 * @returns {object[]} the collections changed, as they are to be written
 */
export function carryHighlights(records, { moved = new Map(), split = new Map(), joined = new Map() } = {}, ctx = {}) {
  if (!moved.size && !split.size && !joined.size) return [];
  const out = [];
  for (const c of records ?? []) {
    if (c?.kind !== "collection" || !canEdit(c) || !Array.isArray(c.members)) continue;
    const touched = (m) => isItem(m) && (moved.has(m.recordId) || split.has(m.recordId) || joined.has(m.recordId));
    if (!c.members.some(touched)) continue;
    const held = new Set(c.members.filter((m) => isItem(m) && !moved.has(m.recordId)).map((m) => m.recordId));
    const members = [];
    const pieces = new Set();
    // A new item for `id`, unless the collection holds it already.
    const add = (id) => {
      if (!id || held.has(id)) return;
      held.add(id);
      const item = itemMember(id);
      pieces.add(item.id);
      members.push(item);
    };
    for (const m of c.members) {
      if (isItem(m) && moved.has(m.recordId)) {
        const to = moved.get(m.recordId);
        if (held.has(to)) continue;
        held.add(to);
        members.push({ ...m, recordId: to });
        continue;
      }
      const join = isItem(m) ? joined.get(m.recordId) : undefined;
      if (join?.before) add(join.id);
      members.push(m);
      if (join && !join.before) add(join.id);
      if (isItem(m)) add(split.get(m.recordId));
    }
    const pruned = pruneMembers({ ...c, members }, records).members;
    const without = pruned.filter((m) => !pieces.has(m.id));
    const tries = pruned.length > COLLECTION_LIMITS.members ? [without] : pieces.size ? [pruned, without] : [pruned];
    // A list that ends up as the collection already was isn't a change.
    const same = (list) => list.length === c.members.length && list.every((m, i) => m === c.members[i]);
    const next = tries
      .filter((list) => !same(list))
      .map((list) => editRecord(c, { members: list }, ctx))
      .find((r) => validateRecord(r).length === 0);
    if (next) out.push(next);
  }
  return out;
}

/* ── What a collection shows ─────────────────────────────────────────── */

/** The live records by id: everything but trash. */
function liveById(records) {
  const map = new Map();
  for (const r of records ?? []) if (isObject(r) && r.kind !== "trash" && typeof r.id === "string" && !map.has(r.id)) map.set(r.id, r);
  return map;
}

/** Every live label record's id to its label group (`labelGroups`: the label as shown, and every id of it). */
function labelIndex(records) {
  const byId = new Map();
  for (const g of labelGroups((records ?? []).filter((r) => r?.kind !== "trash")).values()) for (const id of g.ids) byId.set(id, g);
  return byId;
}

/** Whether a bookmark carries any id of the rule's label. */
function matches(rule, bookmark, labels) {
  const group = labels.get(rule.match.label);
  if (!group || bookmark?.kind !== "bookmark" || !Array.isArray(bookmark.labels)) return false;
  return bookmark.labels.some((id) => group.ids.includes(id));
}

const bookIndex = (key) => {
  const i = BOOK_ORDER.indexOf(key);
  return i === -1 ? BOOK_ORDER.length : i;
};

/** Whether a record or passage sits on a verse (a note on a glossary entry or an article doesn't). */
const onVerse = (x) => typeof x?.bookKey === "string" && Number.isInteger(x.chapter) && Number.isInteger(x.verse);

/** What a row is sorted by in Bible order. A passage comes before a record on the same verse. */
function placeOf(row) {
  const x = row.type === "passage" ? row.member : row.record;
  return {
    book: bookIndex(x.bookKey),
    chapter: x.chapter,
    verse: x.verse,
    rank: row.type === "passage" ? 0 : 1,
    end: Number.isInteger(x.endVerse) ? x.endVerse : x.verse,
    created: row.type === "passage" ? "" : String(x.created ?? ""),
    id: String(x.id ?? ""),
  };
}

/** Bible order: book, chapter and verse, a passage first, then the last verse, when it was made, and its id. */
function byBible(a, b) {
  const p = placeOf(a);
  const q = placeOf(b);
  return p.book - q.book || p.chapter - q.chapter || p.verse - q.verse || p.rank - q.rank || p.end - q.end || cmp(p.created, q.created) || cmp(p.id, q.id);
}

/** Rows with no verse: by when they were made, then id. */
const byMade = (a, b) => cmp(String(a.record.created ?? ""), String(b.record.created ?? "")) || cmp(a.record.id, b.record.id);

/** Rows in Bible order: those on a verse, then those on none. */
function bibleOrder(rows) {
  const placed = rows.filter((r) => (r.type === "passage" ? onVerse(r.member) : onVerse(r.record)));
  const rest = rows.filter((r) => !placed.includes(r));
  return [...placed.sort(byBible), ...rest.sort(byMade)];
}

const sorted = (records) => [...records].sort((a, b) => byBible({ type: "record", record: a }, { type: "record", record: b }));

/**
 * A rule as the page shows it: whether this code knows what it matches, its
 * label as shown (null when the label is gone for good: it matches nothing,
 * and the page says the label is gone), the bookmarks it brings in (live,
 * carrying any id of the label, not left out), and those left out, each in
 * Bible order.
 */
function ruleInfo(member, live, labels) {
  const none = { member, known: false, label: null, gone: false, bookmarks: [], leftOut: [] };
  if (!isBookmarkRule(member)) return none;
  const group = labels.get(member.match.label);
  if (!group) return { ...none, known: true, gone: true };
  const except = new Set(Array.isArray(member.except) ? member.except : []);
  const all = sorted([...live.values()].filter((r) => matches(member, r, labels)));
  return {
    member,
    known: true,
    label: group.label,
    gone: false,
    bookmarks: all.filter((b) => !except.has(b.id)),
    leftOut: all.filter((b) => except.has(b.id)),
  };
}

/**
 * Every live bookmark carrying the label `labelId` (any id of it), in Bible
 * order: what "Only the 12 labeled Advent now" adds as items.
 */
export function labelBookmarks(records, labelId) {
  const labels = labelIndex(records);
  const rule = ruleMember(labelId, { id: "probe" });
  return sorted([...liveById(records).values()].filter((r) => matches(rule, r, labels)));
}

/** The type groups of By type, in order, with what each holds. */
const TYPE_GROUPS = Object.freeze([
  { title: "Sheets", holds: (r) => r.type === "record" && r.record.kind === "sheet" },
  { title: "Passages", holds: (r) => r.type === "passage" },
  { title: "Notes", holds: (r) => r.type === "record" && r.record.kind === "note" },
  { title: "Highlights", holds: (r) => r.type === "record" && r.record.kind === "highlight" },
  { title: "Bookmarks", holds: (r) => r.type === "record" && r.record.kind === "bookmark" },
  { title: "Pinned footnotes", holds: (r) => r.type === "record" && r.record.kind === "footnotePin" },
]);

const group = (title) => ({ type: "group", key: `group:${title}`, title });

/**
 * What a collection shows, in an order (its own, `collectionOrder`, unless
 * given):
 *
 *   rows    in order, each one of
 *             { type: "group", key, title }              Sheets, and By type's groups
 *             { type: "heading", key, member, text }     My order only
 *             { type: "passage", key, member }
 *             { type: "record", key, member, record, rule }
 *           A record's `member` is its item, or null for a rule's bookmark
 *           not held as one (its key is `rule:<id>`); `rule` is the rule that
 *           brings it in, or null. A row's `key` is what moveRow takes.
 *   shown   how many passages and records it shows: a list's count
 *   rules   each rule member as `ruleInfo` reads it, in member order, for the
 *           rule's line ("Every bookmark labeled Advent · 12")
 *
 * Left out: records not live (in the trash, gone, not synced here), records
 * of kinds a collection can't hold, members of types this code doesn't know,
 * a second item for a record already shown, and headings outside My order.
 * The members themselves are kept.
 */
export function collectionRows(collection, records, { order } = {}) {
  const want = COLLECTION_ORDERS.includes(order) ? order : collectionOrder(collection);
  const live = liveById(records);
  const labels = labelIndex(records);
  const members = Array.isArray(collection?.members) ? collection.members : [];

  const rules = members.filter((m) => m?.type === "rule").map((m) => ruleInfo(m, live, labels));
  const ruleOf = new Map();
  for (const info of rules) for (const b of info.bookmarks) if (!ruleOf.has(b.id)) ruleOf.set(b.id, info.member);

  const seen = new Set();
  const own = [];
  for (const m of members) {
    if (!isObject(m) || typeof m.id !== "string") continue;
    if (m.type === "heading" && typeof m.text === "string") own.push({ type: "heading", key: m.id, member: m, text: m.text });
    else if (m.type === "passage" && onVerse(m)) own.push({ type: "passage", key: m.id, member: m });
    else if (isItem(m)) {
      const r = live.get(m.recordId);
      if (!r || !ITEM_KINDS.includes(r.kind) || seen.has(r.id)) continue;
      seen.add(r.id);
      own.push({ type: "record", key: m.id, member: m, record: r, rule: ruleOf.get(r.id) ?? null });
    }
  }
  const tail = [];
  for (const info of rules) {
    for (const b of info.bookmarks) {
      if (seen.has(b.id)) continue;
      seen.add(b.id);
      tail.push({ type: "record", key: `rule:${b.id}`, member: null, record: b, rule: info.member });
    }
  }

  const entries = [...own.filter((r) => r.type !== "heading"), ...tail];
  let rows;
  if (want === "mine") {
    rows = [...own, ...bibleOrder(tail)];
  } else if (want === "type") {
    rows = TYPE_GROUPS.flatMap(({ title, holds }) => {
      const mine = entries.filter(holds);
      if (!mine.length) return [];
      return [group(title), ...(title === "Sheets" ? mine : bibleOrder(mine))];
    });
  } else {
    const sheets = entries.filter((r) => r.type === "record" && r.record.kind === "sheet");
    rows = [...(sheets.length ? [group("Sheets"), ...sheets] : []), ...bibleOrder(entries.filter((r) => !sheets.includes(r)))];
  }
  return { order: want, rows, shown: entries.length, rules };
}

/** How many passages and records a collection shows, for a list ("Advent series · 12"). */
export function collectionCount(collection, records) {
  return collectionRows(collection, records, { order: "bible" }).shown;
}

/**
 * The collection's members in My order as the Markdown copy lists them: a
 * heading's text, a passage, a record (live, of a kind a collection holds,
 * once), and a rule as its label (`gone` when deleted). Nothing else, and a
 * rule's bookmarks are not listed one by one.
 *
 * @returns {({ type: "heading", text: string } | { type: "passage", member: object }
 *   | { type: "record", record: object } | { type: "rule", label: object | null, gone: boolean })[]}
 */
export function collectionOutline(collection, records) {
  const live = liveById(records);
  const labels = labelIndex(records);
  const seen = new Set();
  const out = [];
  for (const m of Array.isArray(collection?.members) ? collection.members : []) {
    if (!isObject(m)) continue;
    if (m.type === "heading" && typeof m.text === "string" && m.text.trim()) out.push({ type: "heading", text: m.text });
    else if (m.type === "passage" && onVerse(m)) out.push({ type: "passage", member: m });
    else if (isItem(m)) {
      const r = live.get(m.recordId);
      if (!r || !ITEM_KINDS.includes(r.kind) || seen.has(r.id)) continue;
      seen.add(r.id);
      out.push({ type: "record", record: r });
    } else if (isBookmarkRule(m)) {
      const info = ruleInfo(m, live, labels);
      out.push({ type: "rule", label: info.label, gone: info.gone });
    }
  }
  return out;
}

/* ── Ways in ─────────────────────────────────────────────────────────── */

/**
 * Every collection that can take something: the reader's own (none a newer
 * format made, none already full), changed last first, then by name. "All
 * collections…" lists them all. "Used most recently" is read from `modified`,
 * as Add to sheet's is: an add writes the collection, so no key is kept.
 *
 * @returns {{ id: string, name: string, modified: string | null }[]}
 */
export function addableCollections(records) {
  return (records ?? [])
    .filter((r) => r?.kind === "collection" && canEdit(r) && Array.isArray(r.members) && r.members.length < COLLECTION_LIMITS.members)
    .sort(
      (a, b) =>
        String(b.modified ?? "").localeCompare(String(a.modified ?? "")) ||
        collectionName(a).localeCompare(collectionName(b)) ||
        cmp(a.id, b.id),
    )
    .map((c) => ({ id: c.id, name: collectionName(c), modified: c.modified ?? null }));
}

/** The flyout's collections: `addableCollections`' first `max`. */
export function addMenuCollections(records, max = ADD_MENU_COLLECTIONS) {
  return addableCollections(records)
    .slice(0, max)
    .map(({ id, name }) => ({ id, name }));
}

/** Whether the flyout ends in "All collections…": only when it can't list them all. */
export function needsAllCollections(collections, max = ADD_MENU_COLLECTIONS) {
  return (collections?.length ?? 0) > max;
}

/**
 * The collections that hold a verse, for This verse's Collections line: as a
 * passage covering it, or through a record on it (an item, or a rule's
 * bookmark). A sheet holds no verse here. By name, then id.
 *
 * @param {object[]} records
 * @param {{ bookKey: string, chapter: number, verse: number }} where
 * @returns {{ id: string, name: string }[]}
 */
export function collectionsHolding(records, { bookKey, chapter, verse }) {
  const live = liveById(records);
  const labels = labelIndex(records);
  const covers = (x) =>
    x?.bookKey === bookKey &&
    x.chapter === chapter &&
    Number.isInteger(x.verse) &&
    x.verse <= verse &&
    verse <= (Number.isInteger(x.endVerse) ? x.endVerse : x.verse);
  const out = [];
  for (const c of live.values()) {
    if (c.kind !== "collection" || !Array.isArray(c.members)) continue;
    const holds = c.members.some((m) => {
      if (m?.type === "passage") return covers(m);
      if (isItem(m)) {
        const r = live.get(m.recordId);
        return Boolean(r) && r.kind !== "sheet" && ITEM_KINDS.includes(r.kind) && covers(r);
      }
      return isBookmarkRule(m) && ruleInfo(m, live, labels).bookmarks.some(covers);
    });
    if (holds) out.push({ id: c.id, name: collectionName(c) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || cmp(a.id, b.id));
}

/* ── Search (step 6) ──────────────────────────────────────────────────── */

/**
 * Every live collection, by name, then id. A collection a newer format made
 * is listed too, since it can be read. (My Notes and My Notebook had a
 * collection filter that chose from these until E175 took it out.)
 *
 * @returns {{ id: string, name: string }[]}
 */
export function filterableCollections(records) {
  const out = [];
  for (const c of liveById(records).values()) if (c.kind === "collection") out.push({ id: c.id, name: collectionName(c) });
  return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || cmp(a.id, b.id));
}

/**
 * The collections whose name holds every word of `query` (case, accents and
 * spacing ignored, as the notebook's search folds them), for the notebook
 * search's "Collections" group. Nothing for a query with no words.
 *
 * @returns {{ id: string, name: string }[]}
 */
export function collectionsNamed(records, query) {
  const words = fold(query).split(" ").filter(Boolean);
  if (!words.length) return [];
  return filterableCollections(records).filter((c) => {
    const hay = fold(c.name);
    return words.every((w) => hay.includes(w));
  });
}
