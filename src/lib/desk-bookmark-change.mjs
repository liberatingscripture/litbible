// src/lib/desk-bookmark-change.mjs
//
// What changing a bookmark's name and its "Move as I read" switch decide, as a
// plan over the records the notebook holds *now* (STUDY-DESK-AUDIT-1.md BA102,
// kept through STUDY-DESK.md E9). The function takes the `{ get, all }` that
// `store.change` hands its builder, so the read and the write are one
// transaction: a bookmark another tab (or a /desk pane) deleted meanwhile is
// reported as gone and nothing is written, instead of the reader's stale copy
// coming back beside its own trash record, and the six-bookmark limit on the
// ones that move is checked against what the notebook holds at the write, not
// what the form saw when it opened.
//
// Pure: no DOM, no store of its own. It resolves to `{ plan, problem, record }`:
// `plan` is what to write (null for nothing), `problem` a plain sentence for
// the reader when the change was refused, and `record` the bookmark as it will
// be (or, when nothing needed writing, as it is).

import { canEdit, editRecord } from "./desk-records.mjs";
import { canFollowMore, cleanBookmarkName } from "./desk-bookmarks.mjs";
import { planSave } from "./desk-store-core.mjs";

/** Said when the bookmark being changed is no longer in the notebook. */
export const BOOKMARK_GONE = "That bookmark has been deleted.";

/** Said when the notebook filled up with bookmarks that move while one was being edited. */
export const FOLLOW_LIMIT_REACHED = "Six of your bookmarks already move as you read. Turn that off on one of them first.";

/** Said when a newer version of the Study Desk wrote the bookmark. */
export const BOOKMARK_NEWER = "That bookmark was made by a newer version and can’t be changed here.";

const refused = (problem) => ({ plan: null, problem, record: null });

/**
 * Change a bookmark's name and whether it moves as the reader reads. `change`
 * is `{ name?, follow? }`; a field left out stays as it is. Refused when the
 * bookmark is gone, or when it would be the seventh to move. A name that
 * comes out empty removes the bookmark's `label`; `follow: false` removes
 * `follow`, so a plain bookmark is the record it always was. The same values
 * over themselves write nothing.
 *
 * @param {{ now?: string, client?: string }} stamp
 */
export async function planBookmarkEdit({ get, all }, id, change, stamp) {
  const current = await get(id);
  if (!current || current.kind !== "bookmark") return refused(BOOKMARK_GONE);
  if (!canEdit(current)) return refused(BOOKMARK_NEWER);

  const fields = {};
  if (change.name !== undefined) {
    const name = cleanBookmarkName(change.name);
    if (name !== (current.label ?? "")) fields.label = name || undefined;
  }
  if (change.follow !== undefined) {
    const follow = change.follow === true;
    if (follow !== (current.follow === true)) {
      if (follow && !canFollowMore(await all(), id)) return refused(FOLLOW_LIMIT_REACHED);
      fields.follow = follow ? true : undefined;
    }
  }
  if (!Object.keys(fields).length) return { plan: null, problem: null, record: current };
  const record = withoutUndefined(editRecord(current, fields, stamp));
  return { plan: planSave(record), problem: null, record };
}

/** A record without the fields an edit set to `undefined`, which are the fields it removes. */
function withoutUndefined(record) {
  return Object.fromEntries(Object.entries(record).filter(([, v]) => v !== undefined));
}
