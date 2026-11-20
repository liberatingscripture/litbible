// src/scripts/desk/collections/add-passage.js
//
// A passage put into a collection from outside its page (D13): the verse
// menu's and the selection panel's "Add to collection ▸" (step 3) and This
// verse's "Add to collection…" (step 4) both end here, so they say the same
// words. It is one write (planAddPassage, over the notebook as the write's
// own transaction reads it), so one Ctrl+Z takes it back, and the undo bar
// says where it went: "John 3:16 added to Advent series." with Undo and
// "Open the collection" (decision 12, as Add to sheet's "Open the sheet").
// Verses the collection already holds are not added twice, and the reader is
// told so, with the same link. The collection page's own "Add ▾ › Passage…" says
// the same words in its field.
//
// `fields` are whole verses (decision 20): passageFromVerses
// (desk-sheet-passages.mjs) over the verses a selection touches, never a
// selection's start and end words. passageMember keeps only what a
// collection's passage holds.

import { collectionTooBig } from "../../../lib/desk-collection-format.mjs";
import { collectionName, planAddPassage } from "../../../lib/desk-collections.mjs";
import { passageReference } from "../../../lib/desk-sheet-passages.mjs";
import { undoEntry } from "../history.js";
import { showNotice, showUndo } from "../undo-bar.js";

const BASE = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");

/** The list of collections. */
export const collectionsHref = `${BASE}collections/`;

/** A collection's own page. */
export const collectionHref = (id) => `${BASE}collections/?id=${encodeURIComponent(id)}`;

// What "Open the collection" does on a plain click where the page has said
// (D13, decision 27): on /desk it shows the collection in a Collections pane
// by E127's rule (desk-page.js sets it); everywhere else it stays the link to
// the collection's page, in a new tab.
let opener = null;

/** Make the bar's "Open the collection" act here, or (null) go back to the link. */
export function setCollectionOpener(fn) {
  opener = typeof fn === "function" ? fn : null;
}

/**
 * The undo bar's "Open the collection" for collection `id`, every place that
 * says it, or null where that collection's view is on screen already (the
 * view carries `data-collection-shown`): then the notice has no link.
 */
export function collectionLink(id) {
  if (document.querySelector(`[data-collection-shown="${CSS.escape(id)}"]`)) return null;
  const link = { label: "Open the collection", href: collectionHref(id) };
  if (opener) {
    const open = opener;
    link.open = () => open(id);
  }
  return link;
}

const openLink = collectionLink;

/**
 * What a passage being added adds to the collection's own words when its verses
 * lie wholly inside passages the collection already holds (same book and
 * chapter, within their verses): " It’s also inside Luke 1:46–55.", naming the
 * smallest such passage (ties to the first in Bible order), or "" when none
 * does. `collection` is as it was before the add.
 *
 * @param {object | null} collection
 * @param {{ bookKey: string, chapter: number, verse: number, endVerse?: number }} fields
 * @returns {string}
 */
export function alsoInside(collection, fields) {
  const end = fields.endVerse ?? fields.verse;
  const holders = (collection?.members ?? []).filter(
    (m) =>
      m?.type === "passage" &&
      m.bookKey === fields.bookKey &&
      m.chapter === fields.chapter &&
      m.verse <= fields.verse &&
      (m.endVerse ?? m.verse) >= end,
  );
  if (!holders.length) return "";
  const span = (m) => (m.endVerse ?? m.verse) - m.verse;
  holders.sort((a, b) => span(a) - span(b) || a.verse - b.verse);
  return ` It’s also inside ${passageReference(holders[0])}.`;
}

/**
 * Add the passage `fields` to the collection `collectionId`, and tell the
 * reader on the undo bar. Resolves to what happened: "added", "again" (the
 * verses were there already; nothing written), or "failed" (the reader has
 * been told why). `name` is what the caller showed the collection as, for the
 * words when the write is refused before the collection is read.
 *
 * @param {{ store: object, ctx: () => object, collectionId: string, fields: object, name?: string }} options
 * @returns {Promise<"added" | "again" | "failed">}
 */
export async function addPassageToCollection({ store, ctx, collectionId, fields, name: shownAs = "" }) {
  const where = passageReference(fields);
  let plan = null;
  let inside = "";
  try {
    await store.change(async ({ all }) => {
      const records = await all();
      // Read before the add, so "also inside" compares with what it held.
      const before = records.find((r) => r?.id === collectionId && r.kind === "collection") ?? null;
      plan = planAddPassage(records, collectionId, fields, { now: new Date().toISOString(), ...ctx() });
      inside = plan.changed ? alsoInside(before, fields) : "";
      return plan.changed ? plan : null;
    });
  } catch (err) {
    if (!collectionTooBig(err)) console.error("Study Desk: the passage couldn’t be added to the collection", err);
    plan = { refused: err };
  }
  if (!plan || plan.gone) {
    showNotice("That collection couldn’t be changed. It may have been deleted. Nothing was added.");
    return "failed";
  }
  const name = plan.collection ? collectionName(plan.collection) : shownAs || "That collection";
  if (plan.refused) {
    showNotice(
      collectionTooBig(plan.refused)
        ? `${name} is full, so nothing was added.`
        : "The passage couldn’t be added. Nothing was changed. Try again in a moment.",
    );
    return "failed";
  }
  if (plan.again) {
    showNotice(`${where} is already in ${name}.`, { link: openLink(collectionId) });
    return "again";
  }
  if (!plan.changed) {
    showNotice("The passage couldn’t be added. Nothing was changed. Try again in a moment.");
    return "failed";
  }
  const entry = store.lastEntry();
  showUndo(`${where} added to ${name}.${inside}`, () => undoEntry(entry), { link: openLink(collectionId) });
  return "added";
}
