// src/scripts/desk/collections/new-collection.js
//
// "New collection" (D13, mock part d), in two forms that write the same way:
//
// - `newCollectionForm`, the collections list's own (E190; BVJ, 2026-11-19:
//   "opening the new collection dialogue on the pane surface instead of a
//   window, like the sheets pane does"): a card under the list's "New
//   collection" button, in the Collections pane and on /collections/, as a
//   Sheets pane's "New sheet" opens its templates in place. The command row's
//   "New collection…" opens the same card in its pane.
// - `openNewCollection`, the name window (name-window.js), for the ways in
//   that have no list to open on: "Add to collection ▸ / New collection…"
//   opens it from a passage with `firstMember` (the passage as a member, or
//   an item) and a `lead` saying what the new collection will start with
//   ("Luke 2:10 will be its first passage."), and the pick window's and My
//   Notebook's lines open it too.
//
// Both draw their fields with `nameForm` (name-window.js): Name, which is
// required, and an optional Description (E174). The module knows nothing of
// the page: it writes through `store.change` and hands the new collection to
// `onCreated`.
//
// The write is one step in the history (so Ctrl+Z takes the collection back,
// first member and all), and it is made inside the transaction's own read,
// so a collection another tab made a moment ago is never in the way (names
// needn't differ, D13 decision 14).

import { collectionTooBig } from "../../../lib/desk-collection-format.mjs";
import { createCollection } from "../../../lib/desk-collections.mjs";
import { planSave } from "../../../lib/desk-store-core.mjs";
import { make } from "../dom.js";
import { nameForm, openNameWindow } from "./name-window.js";

const FAILED = "That couldn’t be saved in this browser, so nothing was made. Try again.";

// A description can be given from the start, as Rename… lets it be changed
// later (E174); it is optional, since only the first field is.
const FIELDS = [
  { key: "name", label: "Name", maxLength: 200 },
  { key: "description", label: "Description", multiline: true, maxLength: 1000 },
];

/**
 * The write both forms make: the collection, with its first members, in one
 * step of the history. Resolves to a sentence saying what went wrong, or null
 * once `onCreated(collection, entry)` has been called.
 */
async function writeNew({ store, ctx, name, description = "", members = [], onCreated }) {
  let made = null;
  try {
    await store.change(async () => {
      made = createCollection({ name, description, members }, { now: new Date().toISOString(), ...ctx() });
      return planSave(made);
    });
  } catch (err) {
    if (collectionTooBig(err)) return "That collection is too big to keep.";
    console.error("Study Desk: the collection couldn’t be made", err);
    return FAILED;
  }
  onCreated(made, store.lastEntry?.() ?? null);
  return null;
}

/**
 * Open the window. `ctx` is what a record is stamped with ({ client,
 * contentVersion }). `firstMember` becomes the collection's first member; `members`
 * (step 5: "Add these 12 to a collection…" and a label's shortcut) start it
 * with several, or with a rule.
 * `onCreated(collection, entry)` is called after the write, with the history
 * entry that undoes it. `heading` names where the window was opened from:
 * from a passage it is "Add to collection".
 *
 * @param {{ store: object, ctx: () => object,
 *   near?: { left: number, top: number } | null,
 *   firstMember?: object | null, members?: object[], lead?: string, heading?: string,
 *   back?: HTMLElement | (() => HTMLElement | null) | null,
 *   onCreated?: (collection: object, entry: object | null) => void }} options
 */
export function openNewCollection({ store, ctx, near = null, firstMember = null, members = [], lead = "", heading = "Add to collection", back = null, onCreated = () => {} }) {
  return openNameWindow({
    heading,
    title: "New collection",
    lead,
    submit: "Create",
    fields: FIELDS,
    near,
    back,
    onSubmit: ({ name, description = "" }) =>
      writeNew({ store, ctx, name, description, members: firstMember ? [firstMember] : members, onCreated }),
  });
}

/**
 * The list's form, opened in place under `opener` (E190), as a Sheets pane's
 * template chooser opens under "New sheet" (my-sheets.js, `templateChooser`).
 * Hidden until asked for. The opener says what pressing it does now, as New
 * sheet's does (E121): its own name and the primary look while the form is
 * shut, "Cancel" in the ordinary look while it is open, so the form's Create
 * is the view's one primary button then (E126). Cancel, the opener and Escape
 * close it, giving focus back to the opener; Create closes it and hands the
 * new collection to `onCreated`.
 *
 * The list is drawn again at every change to the notebook, so what the form
 * holds lives in `state` ({ open, name, description }), the host's, and a
 * form drawn again opens as the last one was left. `keys(name)` gives a
 * control's focus key ("new-name", "new-description", "new-create",
 * "new-cancel"), so the host can keep focus in a field across a redraw.
 *
 * @param {{ store: object, ctx: () => object, opener: HTMLButtonElement, idSuffix?: string,
 *   state: { open: boolean, name: string, description: string },
 *   keys: (name: string) => string,
 *   onCreated: (collection: object, entry: object | null) => void }} options
 * @returns {HTMLElement & { toggle: () => void, show: (focus?: boolean) => void }}
 */
export function newCollectionForm({ store, ctx, opener, idSuffix = "", state, keys, onCreated }) {
  const id = `collectionNew${idSuffix ? `-${idSuffix}` : ""}`;
  const shutName = opener.textContent;
  const showState = (open) => {
    opener.textContent = open ? "Cancel" : shutName;
    opener.classList.toggle("desk-sheet__btn--primary", !open);
    opener.setAttribute("aria-expanded", String(open));
  };
  const box = make("div", "desk-sheet__passage-form collection-page__new");
  box.id = id;
  // Cancel means it: what was typed goes with the form, as a cancelled
  // window's words do, so the next "New collection" starts empty.
  const close = () => {
    state.open = false;
    state.name = "";
    state.description = "";
    for (const input of inputs.values()) input.value = "";
    problem.textContent = "";
    box.hidden = true;
    showState(false);
    opener.focus();
  };
  const { form, inputs, problem, cancel, save } = nameForm({
    id,
    submit: "Create",
    fields: FIELDS.map((f) => ({ ...f, value: state[f.key] ?? "" })),
    onSubmit: ({ name, description = "" }) =>
      writeNew({
        store,
        ctx,
        name,
        description,
        // The form is put away before the host takes over the view, as a
        // template picked shuts the Sheets chooser.
        onCreated: (made, entry) => {
          state.open = false;
          state.name = "";
          state.description = "";
          box.hidden = true;
          showState(false);
          onCreated(made, entry);
        },
      }),
    onCancel: close,
    onDone: () => {},
  });
  form.setAttribute("aria-label", "New collection");
  for (const [key, input] of inputs) {
    input.dataset.focusKey = keys(`new-${key}`);
    input.addEventListener("input", () => (state[key] = input.value));
  }
  cancel.dataset.focusKey = keys("new-cancel");
  save.dataset.focusKey = keys("new-create");
  box.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    close();
  });
  box.append(form);
  opener.setAttribute("aria-controls", id);

  const name = inputs.get("name");
  /** Open it (it may be open already), focus in Name unless `focus` is false. */
  box.show = (focus = true) => {
    state.open = true;
    box.hidden = false;
    showState(true);
    if (focus) name.focus();
  };
  box.toggle = () => (box.hidden ? box.show() : close());
  box.hidden = !state.open;
  showState(state.open);
  return box;
}
