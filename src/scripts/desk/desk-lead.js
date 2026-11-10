// src/scripts/desk/desk-lead.js
//
// What /desk's leading LIT pane tells the rest of the page (E28; BVJ,
// 2026-11-06): a bookmark that moves as the reader reads follows that pane
// (bookmark-follow.js, run with `page: DESK_PAGE`), and Continue reading
// offers its place back (desk-last-read.js). Other LIT panes never move
// either, and the opening place, a restore and the tour report nothing. Cut
// from desk-page.js's `start()` (Audit 8, LG8-8), which calls `tell()` after
// each commit.

import { DESK_PAGE } from "../../lib/desk-bookmarks.mjs";
import { findPane, litPlace } from "../../lib/desk-layout.mjs";
import { parsePassage } from "../../lib/desk-passage.mjs";
import { initBookmarkFollow } from "./bookmark-follow.js";
import { showPausedBar } from "./bookmark-stop.js";
import { createDeskLastRead } from "./desk-last-read.js";

/**
 * @param {{ store: object | null, ctx: () => object, drafts: object,
 *   getLayout: () => object, frozen: () => boolean }} options
 *   `getLayout` is the desk's layout as it stands; `frozen` is true while a
 *   tour has the panes, which aren't the reader's reading.
 * @returns {{ tell: () => void, position: () => (object | null) }}
 */
export function createLeadReporter({ store, ctx, drafts, getLayout, frozen }) {
  // The leading LIT pane and its place, in last-read's shape; null with no
  // LIT pane leading.
  const leadingPane = () => {
    const layout = getLayout();
    const pane = findPane(layout.root, layout.active);
    return pane?.kind === "lit" ? pane : null;
  };
  const position = () => {
    const pane = leadingPane();
    const p = pane ? parsePassage(litPlace(getLayout(), pane.id)) : null;
    return p ? { book: p.bookKey, chapter: p.chapter, verse: p.verse ?? null, view: "desk" } : null;
  };
  const follower = initBookmarkFollow({ store, ctx, tell: showPausedBar, page: DESK_PAGE, place: position });
  // What the follower was last told: nothing at load, since the place the
  // panes open at isn't reading (and a chapter alone would mean verse 1).
  let toldLead = leadingPane()?.id ?? null;
  let toldAt = toldLead ? litPlace(getLayout(), toldLead) : null;
  // Reading in the leading LIT pane is what Continue reading offers back.
  const lastRead = createDeskLastRead(drafts);

  /** After a commit: report the leading pane's place, or a new leading pane. */
  function tell() {
    if (frozen()) return;
    const id = leadingPane()?.id ?? null;
    const at = id ? litPlace(getLayout(), id) : null;
    if (id === toldLead && at === toldAt) return;
    const newLead = id !== toldLead;
    toldLead = id;
    toldAt = at;
    if (id) lastRead.note(position());
    if (!id || !follower) return;
    if (newLead) follower.lead(position());
    else follower.hear(position());
  }

  return { tell, position };
}
