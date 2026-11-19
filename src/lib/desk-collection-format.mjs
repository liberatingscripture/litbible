// src/lib/desk-collection-format.mjs
//
// The collection record (kind 12) as STUDY-DESK-FORMAT.md, "Collections (kind
// 12)", defines it: the limits, the member types, the orders, and the check a
// collection must pass before it is saved (validateCollection). Pure: no DOM,
// no storage, no clock. Making and changing a collection, and showing one, is
// desk-collections.mjs.
//
// Decisions behind it (STUDY-DESK.md, D13, and its order of work; BVJ,
// 2026-11-18):
//   - Kept as the sheet's format is (desk-sheet-format.mjs): a member of a type
//     this code doesn't know, a rule whose `match` names a kind or a field it
//     doesn't know, and an `order` it doesn't know are all kept and never
//     refused (principle 6). Only what this code reads is checked.
//   - Limits: 1,000 members and 512 KB as JSON, a sheet's size. The format
//     first proposed 256 KB, but a passage carries its verses' words
//     (`verseCopy`), so a thousand one-verse passages need about 400 KB.
//   - A passage is whole verses (BVJ, 2026-11-18): this code never writes a
//     `quote` on one. A passage that arrives with one keeps it untouched, as a
//     field this code doesn't read, and is shown as whole verses.

import { passageVerseProblems } from "./desk-sheet-format.mjs";

/** The version of the collection section of the format this code writes. */
export const COLLECTION_FORMAT = 1;

/** `bytes` is the collection as JSON; the text limits count characters (code points). */
export const COLLECTION_LIMITS = Object.freeze({
  bytes: 524288,
  members: 1000,
  name: 200,
  description: 1000,
  heading: 200,
});

export const MEMBER_TYPES = Object.freeze(["item", "passage", "rule", "heading"]);

/**
 * How the reader has chosen to see a collection: Bible order (the default,
 * and what an absent `order` means), by type (grouped as Sheets, Passages,
 * Notes, Highlights, Bookmarks and Pinned footnotes, each in Bible order), or
 * the reader's own order. Only "mine" shows the members as `members` lists
 * them; the other two are worked out for display and never rewrite them.
 */
export const COLLECTION_ORDERS = Object.freeze(["bible", "type", "mine"]);

/** A collection's order as this code shows it: an absent or unknown one is Bible order (and kept as it is). */
export function collectionOrder(collection) {
  return COLLECTION_ORDERS.includes(collection?.order) ? collection.order : "bible";
}

/** The size limit's words, which `collectionTooBig` recognizes. */
export const TOO_BIG = `a collection is at most ${COLLECTION_LIMITS.bytes / 1024} KB`;
/** The member limit's words, which `collectionTooBig` recognizes too. */
export const TOO_MANY = `a collection holds at most ${COLLECTION_LIMITS.members} members`;

/** Whether an error is a collection's size or member limit refusing a change. */
export function collectionTooBig(error) {
  const message = String(error?.message ?? "");
  return message.includes(TOO_BIG) || message.includes(TOO_MANY);
}

/* ── Checking a collection ───────────────────────────────────────────── */

/** The length of a string in characters (code points), as a reader counts them. */
const chars = (s) => Array.from(s).length;
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const nonEmpty = (v) => typeof v === "string" && v.length > 0;

function jsonBytes(r) {
  try {
    return new TextEncoder().encode(JSON.stringify(r)).length;
  } catch {
    return Infinity;
  }
}

/**
 * Problems with a collection's own fields and members, as plain sentences;
 * empty when there are none. validateRecord calls it for a collection once
 * the fields every record carries have passed. A member of a type this code
 * doesn't know is checked only for its `id` and `type`, and a rule's `match`
 * only when it names a kind this code knows (principle 6).
 *
 * @param {object} r a record of kind "collection"
 * @returns {string[]}
 */
export function validateCollection(r) {
  const problems = [];
  const need = (ok, msg) => ok || problems.push(msg);

  need(Number.isInteger(r?.collectionFormat) && r.collectionFormat >= 1, "collectionFormat is not a positive integer");
  // Too big is reason enough to refuse it, so its members aren't checked one
  // by one to find more (as a sheet's aren't, BA67).
  if (jsonBytes(r) > COLLECTION_LIMITS.bytes) {
    problems.push(TOO_BIG);
    return problems;
  }
  need(
    nonEmpty(r?.name) && chars(r.name) <= COLLECTION_LIMITS.name,
    `name is not text of 1 to ${COLLECTION_LIMITS.name} characters`,
  );
  need(
    r?.description == null || (typeof r.description === "string" && chars(r.description) <= COLLECTION_LIMITS.description),
    `description is not text of at most ${COLLECTION_LIMITS.description} characters`,
  );
  // An order this code doesn't know is kept, and shown as Bible order.
  need(r?.order == null || typeof r.order === "string", "order is not text");

  if (!Array.isArray(r?.members)) {
    problems.push("members is not a list");
    return problems;
  }
  if (r.members.length > COLLECTION_LIMITS.members) problems.push(TOO_MANY);

  const ids = new Set();
  r.members.forEach((m, i) => {
    const at = `Member ${i + 1}`;
    if (!isObject(m)) return problems.push(`${at} is not an object`);
    if (!nonEmpty(m.id)) problems.push(`${at} has no id`);
    else if (ids.has(m.id)) problems.push(`${at} repeats the id of another member`);
    else ids.add(m.id);
    if (!nonEmpty(m.type)) return problems.push(`${at} has no type`);
    if (!MEMBER_TYPES.includes(m.type)) return;

    const here = `${at} (${m.type})`;
    const check = (ok, msg) => ok || problems.push(`${here}: ${msg}`);
    switch (m.type) {
      case "item":
        check(nonEmpty(m.recordId), "recordId is empty");
        break;
      case "passage":
        // Whole verses: a `quote` that arrives on one is kept and not read.
        problems.push(...passageVerseProblems(m, here));
        break;
      case "rule":
        if (!isObject(m.match)) {
          check(false, "match is not an object");
          break;
        }
        // A match of a kind this code doesn't know is kept, and matches nothing here.
        if (m.match.kind === "bookmark") {
          check(nonEmpty(m.match.label), "match.label is empty");
          check(Array.isArray(m.except) && m.except.every((id) => typeof id === "string"), "except is not a list of IDs");
        }
        break;
      case "heading":
        check(typeof m.text === "string" && chars(m.text) <= COLLECTION_LIMITS.heading, `text is not text of at most ${COLLECTION_LIMITS.heading} characters`);
        break;
      default:
        break;
    }
  });
  return problems;
}
