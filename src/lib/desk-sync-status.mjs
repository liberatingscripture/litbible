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

/**
 * Where “Reconnect” leads for a stop only the reader can settle (BVJ,
 * 2026-11-24: the button keeps its word and opens the account page, which
 * names the real step: sign in again, join again, or decide about a
 * replaced notebook). For every other stop it asks for another pass.
 */
export const ACCOUNT_PAGE = "/account/";

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
      line = `You’re offline. Your notebook is in this browser, and ${waiting(pending)} when you’re back online.`;
      break;
    case "signedOut":
      line = `You’ve been signed out. Your notebook is still in this browser, and ${waiting(pending)} after you sign in again.`;
      break;
    case "slowed":
      line = `Sync is paused for a moment because it made too many requests. It will try again in ${roughly((status.retry ?? 60) * 1000)}.`;
      if (pending > 0) detail.push(`${plural(pending, "change")} will sync then. They are saved in this browser.`);
      break;
    case "removed":
      line = "This browser was removed from your notebook’s devices, so it isn’t syncing. Your notebook is still in this browser.";
      if (pending > 0) detail.push(`${plural(pending, "change")} made here will sync once this browser joins your notebook again.`);
      break;
    case "otherNotebook": {
      const how = status.replaced ? replacedWords(status.replaced, format) : "";
      line = `Your account’s notebook was replaced${how}, so this browser isn’t syncing. The notebook in this browser is still here, and nothing in it was changed.`;
      break;
    }
    case "noKeys":
    case "cantOpen":
      line = "This browser can’t open your synced notebook, so it isn’t syncing. Your notebook is still in this browser.";
      detail.push(
        pending > 0
          ? `${plural(pending, "change")} made here will sync once this browser joins your notebook again.`
          : "It will sync once this browser joins your notebook again.",
      );
      break;
    default:
      line = `Sync ran into a problem and will try again. Your notebook is in this browser, and ${waiting(pending)} when it works again.`;
  }

  const problems = status?.problems ?? {};
  if (problems.stuck > 0) {
    detail.push(`${plural(problems.stuck, "entry", "entries")} couldn’t be sent to your account. ${problems.stuck === 1 ? "It is" : "They are"} still in this browser’s notebook.`);
  }
  if (problems.ahead > 0) {
    detail.push(
      `${plural(problems.ahead, "change")} from another device ${problems.ahead === 1 ? "is" : "are"} dated later than this computer’s clock, and will show here once the clock reaches ${problems.ahead === 1 ? "it" : "them"}.`,
    );
  }
  if (problems.blocked > 0) {
    detail.push(`${plural(problems.blocked, "change")} made here ${problems.blocked === 1 ? "is" : "are"} waiting behind ${problems.blocked === 1 ? "an entry" : "entries"} this browser hasn’t been able to take in yet.`);
  }
  if (problems.aside > 0) {
    detail.push(`${plural(problems.aside, "entry", "entries")} in your account ${problems.aside === 1 ? "was" : "were"} written by a newer version of LIT Bible and can’t be shown here yet.`);
  }
  if (problems.unread > 0) {
    detail.push(`${plural(problems.unread, "entry", "entries")} in your account couldn’t be read in this browser and ${problems.unread === 1 ? "was" : "were"} left as ${problems.unread === 1 ? "it is" : "they are"}.`);
  }
  if (typeof status?.clock === "number" && Math.abs(status.clock) >= CLOCK_NOTICE_MS) {
    detail.push(
      status.clock > 0
        ? `This computer’s clock is ${roughly(status.clock)} ahead. Until it is set right, what you change or delete here can override newer changes from your other devices.`
        : `This computer’s clock is ${roughly(status.clock)} behind. Until it is set right, what you change or restore here can be overridden by older changes from your other devices.`,
    );
  }
  const asked = waitingSentence(status?.account?.waiting, format);
  if (asked) detail.push(asked);
  return { line, detail, action, busy, ok };
}

/* ── The account's notices, on whatever page the reader is on ───────────── */

// A request to delete the account or replace its notebook waits seven days so
// that a reader's devices can say so, and a device that joins can read the
// whole notebook at once. Both were only on the account's home, which a
// reader has to go looking for. So each is told where the reader is (BVJ,
// 2026-11-25, of Claude's mock and picks: "Go with all your recommendations
// and choices"); src/scripts/desk/sync/account-notice.js draws them.

/** What the dot means for a request that waits, and for a device or a way in that is new, to a screen reader. */
export const WAITING_WORDS = "A request is waiting on your account";
export const NEWS_WORDS = "New on your account";

/** The one button both notices share: it opens the account page, where the request can be canceled and a device removed. */
export const REVIEW_WORDS = "Review";

/**
 * A request that waits, in a sentence: the status line's own, and the
 * notice's. `asked` is the service's `{ what, due, mine }`; `format.day`
 * writes its day, and with none the day is left out. Null for no request.
 */
export function waitingSentence(asked, format = {}) {
  if (!asked || (asked.what !== "delete" && asked.what !== "replace")) return null;
  const what = asked.what === "delete" ? "delete your account" : "replace your account’s notebook";
  const who = asked.mine ? "You asked" : "Someone signed in to your account asked";
  const due = asked.due && format.day ? ` It takes effect on ${format.day(asked.due)}.` : "";
  return `${who} to ${what}.${due}`;
}

/**
 * The waiting request this page has to tell its reader of, or null: one that
 * this browser's own sign-in didn't make (its reader knows), and never while
 * the sync is stopped, when the stop is what the page says.
 */
export function waitingOutside(status) {
  const asked = status?.account?.waiting;
  if (!asked || asked.mine || (asked.what !== "delete" && asked.what !== "replace")) return null;
  return needsReader(status.state) ? null : asked;
}

/** What one waiting request is remembered by: a second request is a new thing to say. */
export const waitingKey = (asked) => `${asked.what}:${asked.asked ?? asked.due ?? ""}`;

/**
 * Whether to put the notice up for a waiting request: when this browser
 * hasn't said this one, or said it a day ago, as a stop is said. `told` is
 * what was kept the last time (`{ key, at }`), or nothing.
 */
export function shouldTellWaiting(told, key, nowMs) {
  if (!told || told.key !== key || !Number.isFinite(told.at)) return true;
  return nowMs - told.at >= TELL_AGAIN_MS || nowMs < told.at;
}

/** How often a syncing browser reads who can open its notebook, to see what is new: as often as a pass asks the account. */
export const NEWS_EVERY_MS = 15 * 60_000;

/** Whether that read is due. `kept` is what the last one left (`{ at, unseen, told }`), or nothing. */
export function newsCheckDue(kept, nowMs) {
  if (!kept || !Number.isFinite(kept.at)) return true;
  return nowMs - kept.at >= NEWS_EVERY_MS || nowMs < kept.at;
}

/**
 * What is news on a page that isn't the account's: everything the account's
 * home would announce (`news` in desk-account.mjs) but a device this very
 * computer approved, which its reader did here a moment ago. `own` is this
 * device's id.
 */
export const newsOutside = (items, own) => items.filter((item) => !(item.what === "device" && item.how === "approval" && item.by === own));

/**
 * A day as a notice writes it: "December 2", with the year only when it isn't
 * this one. The number keeps to its month's line, so a narrow bar never ends
 * a line on "December" and starts the next with "2."
 */
export function noticeDay(iso, { locale, nowMs = Date.now() } = {}) {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return "";
  const sameYear = date.getFullYear() === new Date(nowMs).getFullYear();
  const words = new Intl.DateTimeFormat(locale, { month: "long", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) }).format(date);
  return words.replace(/ (?=\d)/, " ");
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
