// src/lib/desk-reminder.mjs
//
// When the notebook's backup is due (STUDY-DESK-FIXES.md, E113) and what the
// Notebook's foot line says about it. Featherboa's Phase 5 made the reminder
// the foot line's words (SITE-FEATHERBOA.md, "Nothing interrupts the reader":
// NX-07, NX-16): one line at the panel's foot that changes its words, never
// its place, in place of the reminder's bar, its checkbox, its put-offs, and
// its dots. Pure, with the clock handed in, so the panel's foot line
// (desk/first-use.js), the notebook page, and the tests share it.
//
// The old reminder waited on the reader asking for it ("Remind me to back up
// my notebook," `lit-desk-home` set to "browser-remind") and could be put off
// for a day or a week (`lit-desk-remind`). Nothing writes either key now: the
// line says when a backup is due to every reader, and asks nothing.

/** A backup is due this many days after the last (or, with none, after the oldest record). */
export const REMIND_AFTER_DAYS = 7;

export const DAY_MS = 86_400_000;

export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * When a backup was last saved, as an ISO string, or null. The backup code
 * writes it (META key `lastExport`); a stray shape reads as "never" rather
 * than breaking the line.
 */
export function readLastExport(value) {
  const iso = typeof value === "string" ? value : value && typeof value.at === "string" ? value.at : null;
  return iso && Number.isFinite(Date.parse(iso)) ? iso : null;
}

/** Whole days from `iso` to `now`; 0 for a time in the future; null when `iso` is not a time. */
export function daysSince(iso, now) {
  const then = Date.parse(iso ?? "");
  if (!Number.isFinite(then)) return null;
  return Math.max(0, Math.floor((now.getTime() - then) / DAY_MS));
}

/** "today", "yesterday", "3 days ago". */
export function agoPhrase(days) {
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${plural(days, "day")} ago`;
}

/**
 * When a backup was last made: "Last backed up 9 days ago." or "Not backed
 * up yet." Where the notebook also syncs, "backed up" alone would read as the
 * account's copy standing behind (step 4j, BVJ 2026-11-25), so the line names
 * the file.
 * @param {{ linked?: boolean }} [opts] whether this browser's notebook syncs with an account
 */
export function savedLine(lastExport, now, { linked = false } = {}) {
  const days = daysSince(readLastExport(lastExport), now);
  const what = linked ? "backed up to a file" : "backed up";
  return days === null ? `Not ${what} yet.` : `Last ${what} ${agoPhrase(days)}.`;
}

/**
 * The first line of the notebook page (notebook-page.js). Unlinked it says the
 * notebook never leaves the browser; in a browser that syncs, that would be
 * false (step 4g's list; the words are step 4j's, BVJ 2026-11-25).
 * @param {boolean} linked
 */
export function notebookIntro(linked) {
  return linked
    ? "Everything the notebook keeps in this browser, in Bible order. It syncs with your account, locked with a key we never have."
    : "Everything the notebook keeps in this browser, in Bible order. It never leaves this browser unless you back it up.";
}

/**
 * The lead of the notebook page's "Back up your notebook" (export-import.js).
 * A backup file stays the one copy that needs nothing else, with an account or
 * without (step 4j, BVJ 2026-11-25).
 * @param {boolean} linked
 */
export function backupLede(linked) {
  return linked
    ? "A backup is a file you keep yourself. Your account keeps a synced copy too, but a file is the one copy that needs no browser, account, or key, so back up your notebook now and then."
    : "A backup is a file you keep yourself. Your notebook stays in this browser, and a browser can lose it, so back up your notebook now and then.";
}

/**
 * Whether a backup is due: the notebook holds live records, and either the
 * last backup is a week old, or there has been none and the oldest live
 * record is a week old (a notebook begun today has nothing to lose yet).
 * `oldest` is the `created` time of the oldest live record.
 */
export function backupDue({ lastExport = null, oldest = null, now, hasRecords = false }) {
  if (!hasRecords) return false;
  const last = daysSince(readLastExport(lastExport), now);
  if (last !== null) return last >= REMIND_AFTER_DAYS;
  const age = daysSince(oldest, now);
  return age !== null && age >= REMIND_AFTER_DAYS;
}

/** The foot line's first state (NB-34: "browser," since a notebook is kept in one browser). */
export const KEPT_HERE = "Kept in this browser only.";

/** Where a notebook that syncs is kept, said until the sync's own status line is drawn in its place. */
export const KEPT_LINKED = "Kept in this browser and in your account.";

/** The way to the backup, beside the line's words; it opens the notebook page's "Back up your notebook." */
export const BACK_UP = "Back up…";

/**
 * What the Notebook's foot line says, from what the notebook holds:
 *   - unlinked, nothing due: "Kept in this browser only.";
 *   - unlinked, a backup due: when the last was made ("Last backed up 9 days
 *     ago." or "Not backed up yet."), `due` true;
 *   - linked: KEPT_LINKED, which the sync's status line replaces in the same
 *     place (sync/status-line.js draws into the line's slot).
 * `backUp` says whether "Back up…" goes beside it: wherever the notebook holds
 * something to back up and doesn't sync (the sync's line has its own words).
 * @param {{ lastExport?: string | null, oldest?: string | null, hasRecords?: boolean, linked?: boolean, now: Date }} facts
 * @returns {{ text: string, due: boolean, backUp: boolean }}
 */
export function footLine({ lastExport = null, oldest = null, hasRecords = false, linked = false, now }) {
  if (linked) return { text: KEPT_LINKED, due: false, backUp: false };
  const due = backupDue({ lastExport, oldest, now, hasRecords });
  return { text: due ? savedLine(lastExport, now) : KEPT_HERE, due, backUp: hasRecords };
}
