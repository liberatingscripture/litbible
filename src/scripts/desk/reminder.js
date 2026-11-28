// src/scripts/desk/reminder.js
//
// What the backup reminder (STUDY-DESK-FIXES.md, E113) needs to know about the
// notebook. Since Featherboa's Phase 5 the reminder is the words of the
// Notebook's foot line ("Last backed up 9 days ago." beside "Back up…";
// first-use.js draws it), not a bar or a dot ("Nothing interrupts the
// reader," SITE-FEATHERBOA.md). The rules (when it is due, the words) are
// src/lib/desk-reminder.mjs.

import { readLastExport } from "../../lib/desk-reminder.mjs";
import { readLink, SYNC_META } from "../../lib/desk-sync-link.mjs";

/**
 * The facts the rules need, from a notebook the page already has open:
 * `{ lastExport, hasRecords, oldest, linked }`, or null when it can't tell.
 * `oldest` is the oldest live record's `created`; `linked` is whether the
 * browser syncs (the line's words differ, UX9b-2).
 */
export async function factsFromStore(store) {
  try {
    const records = await store.all();
    let oldest = null;
    let hasRecords = false;
    for (const r of records) {
      if (!r || r.kind === "trash") continue;
      hasRecords = true;
      if (typeof r.created === "string" && (oldest === null || r.created < oldest)) oldest = r.created;
    }
    const lastExport = readLastExport(await store.getMeta?.("lastExport"));
    let linked = false;
    try { linked = readLink(await store.getMeta?.(SYNC_META)) != null; } catch (_) {}
    return { lastExport, hasRecords, oldest, linked };
  } catch (_) {
    return null;
  }
}
