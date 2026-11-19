// src/scripts/desk/collections/new-collection.js
//
// "New collection…" (D13, mock part d): the name window (name-window.js) that
// makes a collection. The collection page's button opens it with nothing in
// it; step 3's "Add to collection ▸ / New collection…" opens it from a
// passage with `firstMember` (the passage as a member, or an item) and a
// `lead` saying what the new collection will start with ("Luke 2:10 will be
// its first passage."). So it is a module of its own, which knows nothing of
// the page: it writes through `store.change`, and hands the new collection to
// `onCreated`.
//
// The write is one step in the history (so Ctrl+Z takes the collection back,
// first member and all), and it is made inside the transaction's own read,
// so a collection another tab made a moment ago is never in the way (names
// needn't differ, D13 decision 14).

import { collectionTooBig } from "../../../lib/desk-collection-format.mjs";
import { createCollection } from "../../../lib/desk-collections.mjs";
import { planSave } from "../../../lib/desk-store-core.mjs";
import { openNameWindow } from "./name-window.js";

const FAILED = "That couldn’t be saved in this browser, so nothing was made. Try again.";

/**
 * Open the window. `ctx` is what a record is stamped with ({ client,
 * contentVersion }). `firstMember` becomes the collection's first member.
 * `onCreated(collection, entry)` is called after the write, with the history
 * entry that undoes it. `heading` names where the window was opened from: the
 * page passes "My collections"; from a passage it is "Add to collection".
 *
 * @param {{ store: object, ctx: () => object,
 *   near?: { left: number, top: number } | null,
 *   firstMember?: object | null, lead?: string, heading?: string,
 *   back?: HTMLElement | (() => HTMLElement | null) | null,
 *   onCreated?: (collection: object, entry: object | null) => void }} options
 */
export function openNewCollection({ store, ctx, near = null, firstMember = null, lead = "", heading = "Add to collection", back = null, onCreated = () => {} }) {
  return openNameWindow({
    heading,
    title: "New collection",
    lead,
    submit: "Create",
    fields: [{ key: "name", label: "Name", maxLength: 200 }],
    near,
    back,
    onSubmit: async ({ name }) => {
      let made = null;
      try {
        await store.change(async () => {
          made = createCollection({ name, members: firstMember ? [firstMember] : [] }, { now: new Date().toISOString(), ...ctx() });
          return planSave(made);
        });
      } catch (err) {
        if (collectionTooBig(err)) return "That collection is too big to keep.";
        console.error("Study Desk: the collection couldn’t be made", err);
        return FAILED;
      }
      onCreated(made, store.lastEntry?.() ?? null);
      return null;
    },
  });
}
