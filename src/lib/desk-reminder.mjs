// src/lib/desk-reminder.mjs
//
// The rules of the backup reminder (STUDY-DESK-FIXES.md, E113; BVJ,
// 2026-11-13): when it is due, what it says, and how a reader's "not now" is
// kept. Pure: no DOM, no storage, and the clock is always handed in.
//
// It is its own small module because the desk's first stage (a reading page
// before the shell loads) needs these rules and must stay light:
// desk-first-use.mjs imports desk-layout.mjs, so stage one never imports it.
// desk-first-use.mjs re-exports everything here, so its callers keep working.
// The code that draws the bar and the dots is src/scripts/desk/reminder.js,
// and the Settings notice is in src/scripts/desk/first-use.js.

/** A backup older than this many days (or none, with records this old) is reminded about. */
export const REMIND_AFTER_DAYS = 7;

/** Where the notebook lives (the reader's answer to the first-use card). */
export const HOME_KEY = "lit-desk-home";

/** The put-off: `{ until: ISO, kind: "tomorrow" | "week" }`, in localStorage. */
export const REMIND_KEY = "lit-desk-remind";

export const DAY_MS = 86_400_000;

export const PUT_OFF_KINDS = ["tomorrow", "week"];

export const wantsReminder = (home) => home === "browser-remind";

export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * When a backup was last saved, as an ISO string, or null. The backup code
 * writes it (META key `lastExport`); a stray shape reads as "never" rather
 * than breaking the foot.
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

/** The Settings tab's plain statement of when a backup was last made. */
export function savedLine(lastExport, now) {
  const days = daysSince(readLastExport(lastExport), now);
  return days === null ? "Not backed up yet." : `Last backed up ${agoPhrase(days)}.`;
}

/**
 * Whether the reader should be reminded to back up: they asked to be, the
 * notebook holds live records, and either the last backup is a week old or
 * there has been none and the oldest live record is a week old (a notebook
 * begun today has nothing to lose yet). `oldest` is the `created` time of the
 * oldest live record, or of any live record at least that old.
 */
export function reminderDue({ home, lastExport, oldest = null, now, hasRecords }) {
  if (!wantsReminder(home) || !hasRecords) return false;
  const last = daysSince(readLastExport(lastExport), now);
  if (last !== null) return last >= REMIND_AFTER_DAYS;
  const age = daysSince(oldest, now);
  return age !== null && age >= REMIND_AFTER_DAYS;
}

/** What the reminder says: "It’s been 9 days since you backed up your notebook." */
export function reminderText(lastExport, now) {
  const days = daysSince(readLastExport(lastExport), now);
  return days === null
    ? "You haven’t backed up your notebook yet."
    : `It’s been ${plural(days, "day")} since you backed up your notebook.`;
}

/* ── Putting the reminder off ─────────────────────────────────────── */

/** The start of tomorrow, local time. */
export function startOfTomorrow(now) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

/**
 * The stored put-off for a choice: "tomorrow" lasts until the start of the
 * next local day, "week" for seven days from now. A JSON string.
 */
export function putOffValue(kind, now) {
  const until = kind === "tomorrow" ? startOfTomorrow(now) : new Date(now.getTime() + REMIND_AFTER_DAYS * DAY_MS);
  return JSON.stringify({ until: until.toISOString(), kind });
}

/**
 * A stored put-off, read defensively: `{ kind, until }` while it holds, null
 * for none, a stray shape, or one whose time has passed.
 */
export function readPutOff(raw, now) {
  let v = raw;
  if (typeof raw === "string") {
    try { v = JSON.parse(raw); } catch (_) { return null; }
  }
  if (!v || typeof v !== "object" || !PUT_OFF_KINDS.includes(v.kind) || typeof v.until !== "string") return null;
  const until = Date.parse(v.until);
  if (!Number.isFinite(until) || until <= now.getTime()) return null;
  return { kind: v.kind, until: v.until };
}

/**
 * What to draw, from the facts. `due` is the rule above; the bar waits for
 * any put-off to pass; the dots and the Settings notice go only for "Not this
 * week", and stay through "Remind me tomorrow".
 */
export function reminderState({ home, lastExport, oldest = null, hasRecords, putOff = null, now }) {
  const due = reminderDue({ home, lastExport, oldest, now, hasRecords });
  const held = due ? readPutOff(putOff, now) : null;
  return {
    due,
    bar: due && !held,
    dots: due && held?.kind !== "week",
    text: reminderText(lastExport, now),
    putOff: held,
  };
}

/** What the bar says after "Remind me tomorrow" and "Not this week". */
export const TOMORROW_SAID = "You’ll be reminded tomorrow.";
export const WEEK_SAID = "You’ll be reminded in a week.";
/**
 * What "Back up now" says once the file is handed to the browser: the words
 * /notebook says for the same download (NB-19), since a page can't see a save
 * dialog the reader cancels or where the file was kept.
 */
export function backedUpSaid(name) {
  return `Started the download of ${name || "your backup"}. Your browser may ask where to keep it.`;
}

/** What the bar says once reminders are off; `onDesk` is the /desk page, which has no Notebook panel. */
export function remindersOffSaid(onDesk) {
  return `Reminders are off. You can turn them on again in the Notebook’s Settings${onDesk ? " on a chapter page" : ""}.`;
}
