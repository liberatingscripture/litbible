// src/lib/desk-sync-status.mjs
//
// What the sync's status line says (the plan's step 4g): one sentence for
// each state a pass can end in, the lines under it for what couldn't be
// synced, and whether "Reconnect" is offered. Pure, so the words are tested
// without a browser; src/scripts/desk/sync/status-line.js draws them.
//
// The wording is Claude's, and BVJ said yes to it as written (2026-11-24),
// so a new sentence here is a new thing to show BVJ. Two things it
// holds to, which are BVJ's standing requirements for sync: a reader is never
// signed out silently, and never left to wonder whether work was lost, so
// every state that stops the sync says where the notebook is (on this
// computer, whole) and what happens to the changes that wait.
//
// The states are the engine's (src/lib/desk-sync-engine.mjs), with two of the
// connector's own: "noKeys" (the link is there and this browser's keys are
// not) and "follower" states are the leader tab's, passed along as they are.

/** Past this, the reader is told their clock is off: the format's own room for skew (desk-records.mjs). */
export const CLOCK_NOTICE_MS = 5 * 60_000;

/**
 * The states that stop the sync until the reader does something: sign in
 * again, join the notebook again, or decide about a replaced notebook. No
 * timer retries them (the connector), and none of them is ever silent
 * (sync/stopped-notice.js).
 */
const NEEDS_READER = new Set(["signedOut", "removed", "otherNotebook", "cantOpen", "noKeys"]);
export const needsReader = (state) => NEEDS_READER.has(state);

/** A stop the reader was told of and hasn't settled is said again this long after. */
export const TELL_AGAIN_MS = 24 * 60 * 60_000;

/** What the dot on the Notebook's tab and buttons means, for a screen reader. */
export const STOPPED_WORDS = "Sync has stopped";

/**
 * Whether to put the notice up for a stop: when this browser hasn't said it
 * for this state, or said it a day ago. `told` is what was kept the last time
 * (`{ state, at }`, `at` in milliseconds), or nothing.
 */
export function shouldTell(told, state, nowMs) {
  if (!needsReader(state)) return false;
  if (!told || told.state !== state || !Number.isFinite(told.at)) return true;
  return nowMs - told.at >= TELL_AGAIN_MS || nowMs < told.at;
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "about 2 hours", "about 12 minutes", "about 3 days". */
export function roughly(ms) {
  const minutes = Math.round(Math.abs(ms) / 60_000);
  if (minutes < 90) return `about ${plural(Math.max(1, minutes), "minute")}`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `about ${plural(hours, "hour")}`;
  return `about ${plural(Math.round(hours / 24), "day")}`;
}

/** What waits, as the end of a sentence: "3 changes will sync", "1 change will sync", "your changes will sync". */
const waiting = (pending) => (pending > 0 ? `${plural(pending, "change")} will sync` : "your changes will sync");

const WAYS = { apple: "Apple", google: "Google", passkey: "a passkey", preview: "the preview’s sign-in" };
const PLATFORMS = { ios: "an iPhone or iPad", android: "an Android device", web: "the website" };

/**
 * The words for a status.
 *
 * @param {object} status the engine's status
 * @param {{ time?: (iso: string) => string, day?: (iso: string) => string }} [format]
 *   how a time of day and a day are written for this reader ("3:42 PM",
 *   "December 1"); with none, the times are left out
 * @returns {{ line: string, detail: string[], action: "Reconnect" | null, busy: boolean, ok: boolean }}
 *   `line` is the state in a sentence; `detail` the lines under it; `action`
 *   the button's label, or null for no button; `busy` while a pass runs;
 *   `ok` when nothing needs the reader.
 */
export function statusWords(status, format = {}) {
  const state = status?.state ?? "starting";
  const pending = status?.pending ?? 0;
  const detail = [];
  let line;
  let action = "Reconnect";
  let busy = false;
  let ok = false;

  switch (state) {
    case "starting":
      line = "Getting ready to sync.";
      action = null;
      busy = true;
      break;
    case "syncing":
      line = pending > 0 ? `Syncing ${plural(pending, "change")}.` : "Syncing.";
      action = null;
      busy = true;
      break;
    case "upToDate":
      line = "Your notebook is in sync.";
      if (status.lastSynced && format.time) detail.push(`Last synced at ${format.time(status.lastSynced)}.`);
      action = null;
      ok = true;
      break;
    case "offline":
      line = `You’re offline. Your notebook is on this computer, and ${waiting(pending)} when you’re back online.`;
      break;
    case "signedOut":
      line = `You’ve been signed out. Your notebook is still on this computer, and ${waiting(pending)} after you sign in again.`;
      break;
    case "slowed":
      line = `Sync is paused for a moment because it made too many requests. It will try again in ${roughly((status.retry ?? 60) * 1000)}.`;
      if (pending > 0) detail.push(`${plural(pending, "change")} will sync then. They are saved on this computer.`);
      break;
    case "removed":
      line = "This computer was removed from your notebook’s devices, so it isn’t syncing. Your notebook is still on this computer.";
      if (pending > 0) detail.push(`${plural(pending, "change")} made here will sync once this computer joins your notebook again.`);
      break;
    case "otherNotebook": {
      const how = status.replaced ? replacedWords(status.replaced, format) : "";
      line = `Your account’s notebook was replaced${how}, so this computer isn’t syncing. The notebook on this computer is still here, and nothing in it was changed.`;
      break;
    }
    case "noKeys":
    case "cantOpen":
      line = "This computer can’t open your synced notebook, so it isn’t syncing. Your notebook is still on this computer.";
      detail.push(
        pending > 0
          ? `${plural(pending, "change")} made here will sync once this computer joins your notebook again.`
          : "It will sync once this computer joins your notebook again.",
      );
      break;
    default:
      line = `Sync ran into a problem and will try again. Your notebook is on this computer, and ${waiting(pending)} when it works again.`;
  }

  const problems = status?.problems ?? {};
  if (problems.stuck > 0) {
    detail.push(`${plural(problems.stuck, "entry", "entries")} couldn’t be sent to your account. ${problems.stuck === 1 ? "It is" : "They are"} still in your notebook on this computer.`);
  }
  if (problems.ahead > 0) {
    detail.push(
      `${plural(problems.ahead, "change")} from another device ${problems.ahead === 1 ? "is" : "are"} dated later than this computer’s clock, and will show here once the clock reaches ${problems.ahead === 1 ? "it" : "them"}.`,
    );
  }
  if (problems.blocked > 0) {
    detail.push(`${plural(problems.blocked, "change")} made here ${problems.blocked === 1 ? "is" : "are"} waiting behind ${problems.blocked === 1 ? "an entry" : "entries"} this computer hasn’t been able to take in yet.`);
  }
  if (problems.aside > 0) {
    detail.push(`${plural(problems.aside, "entry", "entries")} in your account ${problems.aside === 1 ? "was" : "were"} written by a newer version of LIT Bible and can’t be shown here yet.`);
  }
  if (problems.unread > 0) {
    detail.push(`${plural(problems.unread, "entry", "entries")} in your account couldn’t be read on this computer and ${problems.unread === 1 ? "was" : "were"} left as ${problems.unread === 1 ? "it is" : "they are"}.`);
  }
  if (typeof status?.clock === "number" && Math.abs(status.clock) >= CLOCK_NOTICE_MS) {
    detail.push(
      status.clock > 0
        ? `This computer’s clock is ${roughly(status.clock)} ahead. Until it is set right, changes made here can replace later ones from your other devices.`
        : `This computer’s clock is ${roughly(status.clock)} behind. Until it is set right, changes made here can lose to earlier ones from your other devices.`,
    );
  }
  const asked = status?.account?.waiting;
  if (asked && (asked.what === "delete" || asked.what === "replace")) {
    const what = asked.what === "delete" ? "delete your account" : "replace your account’s notebook";
    const who = asked.mine ? "You asked" : "Someone signed in to your account asked";
    const due = asked.due && format.day ? ` It takes effect on ${format.day(asked.due)}.` : "";
    detail.push(`${who} to ${what}.${due}`);
  }
  return { line, detail, action, busy, ok };
}

function replacedWords(replaced, format) {
  const from = PLATFORMS[replaced.platform];
  const through = WAYS[replaced.through];
  const when = replaced.when && format.day ? ` on ${format.day(replaced.when)}` : "";
  const where = from ? ` from ${from}` : "";
  const how = through ? `, signed in with ${through}` : "";
  return `${when}${where}${how}`;
}

/**
 * Whether a change of status is worth saying aloud to a screen reader: a
 * change of state, never the same state again or a pass that only passed
 * through "syncing."
 */
export function worthSaying(before, after) {
  if (!after || after.state === "starting" || after.state === "syncing") return false;
  return before?.state !== after.state || (after.state !== "upToDate" && before?.pending !== after.pending);
}
