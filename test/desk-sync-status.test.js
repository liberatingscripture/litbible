// test/desk-sync-status.test.js
//
// What the sync's status line says (src/lib/desk-sync-status.mjs, the plan's
// step 4g): a sentence for every state a pass can end in, the lines under
// it, and when a stop is said aloud. Two of BVJ's standing requirements are
// held here in words: no state that stops the sync is silent, and each one
// says the notebook is still on this computer.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CLOCK_NOTICE_MS,
  NEWS_EVERY_MS,
  NEWS_WORDS,
  REVIEW_WORDS,
  STOPPED_WORDS,
  TELL_AGAIN_MS,
  WAITING_WORDS,
  needsReader,
  newsCheckDue,
  newsOutside,
  noticeDay,
  roughly,
  shouldTell,
  shouldTellWaiting,
  statusWords,
  waitingKey,
  waitingOutside,
  waitingSentence,
  worthSaying,
} from "../src/lib/desk-sync-status.mjs";

const STATES = ["starting", "syncing", "upToDate", "offline", "signedOut", "slowed", "full", "removed", "otherNotebook", "noKeys", "cantOpen", "error"];
const status = (state, extra = {}) => ({ state, pending: 0, problems: {}, lastSynced: null, clock: null, account: null, ...extra });
const format = { time: () => "3:42 PM", day: () => "December 1" };

/** Every sentence a status can produce, for the checks that read them all. */
function everySentence() {
  const out = [];
  const problems = { stuck: 2, blocked: 1, unread: 3, aside: 1, ahead: 2 };
  for (const state of STATES) {
    for (const pending of [0, 1, 3]) {
      for (const extra of [
        {},
        { problems },
        { problems: { stuck: 1, blocked: 2, unread: 1, aside: 2, ahead: 1 } },
        { clock: 2 * 60 * 60_000 },
        { clock: -12 * 60_000 },
        { lastSynced: "2026-11-24T12:00:00.000Z" },
        { retry: 90 },
        { limits: { rows: 100_000, bytes: 100_000_000 }, retry: 3600 },
        { replaced: { when: "2026-11-20T00:00:00.000Z", platform: "ios", through: "apple" } },
        { account: { waiting: { what: "delete", mine: true, due: "2026-12-01T00:00:00.000Z" } } },
        { account: { waiting: { what: "replace", mine: false, due: "2026-12-01T00:00:00.000Z" } } },
      ]) {
        const words = statusWords(status(state, { pending, ...extra }), format);
        out.push(words.line, ...words.detail);
      }
    }
  }
  return out;
}

test("every state has a sentence, and only a pass in flight or one in step has no button", () => {
  for (const state of STATES) {
    const words = statusWords(status(state), format);
    assert.match(words.line, /^[A-Z].+\.$/, state);
    const quiet = state === "starting" || state === "syncing" || state === "upToDate";
    assert.equal(words.action, quiet ? null : "Reconnect", state);
    assert.equal(words.busy, state === "starting" || state === "syncing", state);
    assert.equal(words.ok, state === "upToDate", state);
  }
  assert.equal(statusWords(undefined).line, "Getting ready to sync.");
  assert.match(statusWords(status("somethingNew")).line, /ran into a problem/, "a state this code doesn't know reads as a problem, never as in step");
  assert.equal(statusWords(status("somethingNew")).action, "Reconnect");
});

test("every state that stops the sync says the notebook is still on this computer", () => {
  for (const state of ["offline", "signedOut", "removed", "otherNotebook", "noKeys", "cantOpen", "error"]) {
    assert.match(statusWords(status(state)).line, /on this computer/, state);
  }
});

test("what waits is counted, in the singular and the plural", () => {
  assert.match(statusWords(status("offline", { pending: 1 })).line, /1 change will sync when you’re back online\./);
  assert.match(statusWords(status("offline", { pending: 3 })).line, /3 changes will sync when you’re back online\./);
  assert.match(statusWords(status("offline")).line, /your changes will sync/);
  assert.match(statusWords(status("signedOut", { pending: 2 })).line, /2 changes will sync after you sign in again\./);
  assert.equal(statusWords(status("syncing", { pending: 4 })).line, "Syncing 4 changes.");
  assert.equal(statusWords(status("syncing")).line, "Syncing.");
  assert.deepEqual(statusWords(status("removed", { pending: 1 })).detail, ["1 change made here will sync once this computer joins your notebook again."]);
  assert.match(statusWords(status("cantOpen")).detail[0], /^It will sync once/);
});

test("a full account says what it holds, that the changes wait in this browser, and when sync tries again", () => {
  const limits = { rows: 100_000, bytes: 100_000_000 };
  const words = statusWords(status("full", { pending: 3, limits, retry: 3600 }));
  assert.equal(words.line, "Your account is full, so changes made here aren’t syncing. They are saved in this browser.");
  assert.deepEqual(words.detail, [
    "An account can hold up to 100,000 entries and 100 MB.",
    "3 changes will wait here. Sync will try again in about an hour. Choose “Reconnect” to try now.",
  ]);
  assert.equal(words.action, "Reconnect");
  assert.equal(words.ok, false);
  assert.deepEqual(statusWords(status("full", { pending: 1, limits, retry: 600 })).detail, [
    "An account can hold up to 100,000 entries and 100 MB.",
    "1 change will wait here. Sync will try again in about 10 minutes. Choose “Reconnect” to try now.",
  ]);
  // A refusal that named no ceiling says none, and nothing waiting says so by leaving the count out.
  assert.deepEqual(statusWords(status("full")).detail, ["Sync will try again in about an hour. Choose “Reconnect” to try now."]);
  // A wait the timer settles, like the limiter's: never one of the stops that need the reader, and never a notice.
  assert.equal(needsReader("full"), false);
  assert.equal(shouldTell(undefined, "full", Date.now()), false);
});
test("in step says when, if it is told how to write a time", () => {
  const at = { lastSynced: "2026-11-24T12:00:00.000Z" };
  assert.deepEqual(statusWords(status("upToDate", at), format).detail, ["Last synced at 3:42 PM."]);
  assert.deepEqual(statusWords(status("upToDate", at)).detail, []);
});

test("the limiter's wait is said in round words", () => {
  assert.match(statusWords(status("slowed", { retry: 30 })).line, /try again in about 1 minute\./);
  assert.match(statusWords(status("slowed", { retry: 600 })).line, /about 10 minutes\./);
  assert.equal(roughly(89 * 60_000), "about 89 minutes");
  assert.equal(roughly(60 * 60_000), "about an hour");
  assert.equal(roughly(54 * 60_000), "about 54 minutes");
  assert.equal(roughly(66 * 60_000), "about 66 minutes");
  assert.equal(roughly(2 * 60 * 60_000), "about 2 hours");
  assert.equal(roughly(-3 * 24 * 60 * 60_000), "about 3 days");
});

test("a replaced notebook says when, from where, and how it was signed in", () => {
  const replaced = { when: "2026-11-20T00:00:00.000Z", platform: "ios", through: "apple" };
  const line = statusWords(status("otherNotebook", { replaced }), format).line;
  assert.match(line, /was replaced on December 1 from an iPhone or iPad, signed in with Apple, so this computer isn’t syncing\./);
  assert.match(line, /nothing in it was changed\.$/);
  assert.match(statusWords(status("otherNotebook", { replaced: { platform: "telegraph" } })).line, /was replaced, so/, "a platform this code doesn't know is left out");
});

test("what couldn't be synced is listed under the line, each kind in its own sentence", () => {
  const detail = statusWords(status("upToDate", { problems: { stuck: 1, blocked: 1, unread: 1, aside: 1, ahead: 1 } })).detail;
  assert.equal(detail.length, 5);
  assert.match(detail[0], /^1 entry couldn’t be sent to your account\. It is still in your notebook on this computer\.$/);
  assert.match(detail[1], /^1 change from another device is dated later than this computer’s clock/);
  assert.match(detail[2], /^1 change made here is waiting behind an entry/);
  assert.match(detail[3], /^1 entry in your account was written by a newer version of LIT Bible/);
  assert.match(detail[4], /^1 entry in your account couldn’t be read on this computer and was left as it is\.$/);
  const many = statusWords(status("upToDate", { problems: { stuck: 2, unread: 2 } })).detail;
  assert.match(many[0], /^2 entries couldn’t be sent to your account\. They are still/);
  assert.match(many[1], /were left as they are\.$/);
});

test("a clock five minutes off is said, with which way it errs", () => {
  assert.deepEqual(statusWords(status("upToDate", { clock: CLOCK_NOTICE_MS - 1 })).detail, []);
  assert.match(statusWords(status("upToDate", { clock: CLOCK_NOTICE_MS })).detail[0], /clock is about 5 minutes ahead\. Until it is set right, changes made here can replace later ones/);
  assert.match(statusWords(status("upToDate", { clock: -2 * 60 * 60_000 })).detail[0], /clock is about 2 hours behind\. Until it is set right, changes made here can lose to earlier ones/);
});

test("a deletion or a replacement that is waiting is said, with who asked and when it takes effect", () => {
  const mine = statusWords(status("upToDate", { account: { waiting: { what: "delete", mine: true, due: "2026-12-01T00:00:00.000Z" } } }), format).detail;
  assert.deepEqual(mine, ["You asked to delete your account. It takes effect on December 1."]);
  const theirs = statusWords(status("upToDate", { account: { waiting: { what: "replace", mine: false } } }), format).detail;
  assert.deepEqual(theirs, ["Someone signed in to your account asked to replace your account’s notebook."]);
  assert.deepEqual(statusWords(status("upToDate", { account: { waiting: { what: "somethingElse" } } })).detail, []);
});

test("the words follow the site's conventions: curly quotes, no em dashes, sentences that end", () => {
  for (const sentence of everySentence()) {
    assert.ok(!/[—–]/.test(sentence), `a dash in: ${sentence}`);
    assert.ok(!/['"]/.test(sentence), `a straight quote in: ${sentence}`);
    assert.match(sentence, /\.$/, `no full stop on: ${sentence}`);
    assert.ok(!/\b(undefined|null|NaN)\b/.test(sentence), `a stray value in: ${sentence}`);
    assert.ok(!/\bcolour|synchronis|cancelled\b/.test(sentence), `British spelling in: ${sentence}`);
  }
});

test("a change of state is said aloud, and a pass passing through is not", () => {
  assert.equal(worthSaying(null, status("starting")), false);
  assert.equal(worthSaying(null, status("syncing")), false);
  assert.equal(worthSaying(null, status("upToDate")), true);
  assert.equal(worthSaying(status("upToDate"), status("upToDate", { pending: 2 })), false, "in step again is not news");
  assert.equal(worthSaying(status("upToDate"), status("offline")), true);
  assert.equal(worthSaying(status("offline", { pending: 1 }), status("offline", { pending: 2 })), true, "what waits grew");
  assert.equal(worthSaying(status("offline", { pending: 2 }), status("offline", { pending: 2 })), false);
  assert.equal(worthSaying(status("offline"), undefined), false);
});

test("the states only the reader can settle", () => {
  assert.deepEqual(
    STATES.filter(needsReader),
    ["signedOut", "removed", "otherNotebook", "noKeys", "cantOpen"],
  );
  assert.equal(needsReader(undefined), false);
  assert.ok(STOPPED_WORDS.length > 0);
});

test("a stop is told once, again for another stop, and again a day later", () => {
  const at = Date.parse("2026-11-24T12:00:00.000Z");
  assert.equal(shouldTell(undefined, "signedOut", at), true);
  assert.equal(shouldTell(null, "signedOut", at), true);
  assert.equal(shouldTell({ state: "signedOut", at }, "signedOut", at + 60_000), false);
  assert.equal(shouldTell({ state: "signedOut", at }, "removed", at + 60_000), true);
  assert.equal(shouldTell({ state: "signedOut", at }, "signedOut", at + TELL_AGAIN_MS), true);
  assert.equal(shouldTell({ state: "signedOut", at }, "signedOut", at - 60_000), true, "a clock set back doesn't silence it");
  assert.equal(shouldTell({ state: "signedOut", at: "yesterday" }, "signedOut", at), true);
  assert.equal(shouldTell(undefined, "offline", at), false, "a state that mends itself is never a notice");
  assert.equal(shouldTell(undefined, "upToDate", at), false);
});

/* ── The account's notices, outside the account page ────────────────────── */

const asked = (extra = {}) => ({ what: "delete", asked: "2026-11-25T18:00:00.000Z", due: "2026-12-02T18:00:00.000Z", platform: "web", through: "passkey", mine: false, ...extra });

test("a request that waits is one sentence, the status line's own and the notice's", () => {
  assert.equal(waitingSentence(asked(), format), "Someone signed in to your account asked to delete your account. It takes effect on December 1.");
  assert.equal(waitingSentence(asked({ what: "replace", mine: true }), format), "You asked to replace your account’s notebook. It takes effect on December 1.");
  assert.equal(waitingSentence(asked()), "Someone signed in to your account asked to delete your account.", "with no way to write a day, the day is left out");
  assert.equal(waitingSentence(null, format), null);
  assert.equal(waitingSentence(asked({ what: "rename" }), format), null, "a kind of request this page doesn't know says nothing");
  // The status line says the same sentence, word for word.
  assert.deepEqual(statusWords(status("upToDate", { account: { waiting: asked() } }), format).detail, [waitingSentence(asked(), format)]);
});

test("a waiting request is this page's to tell unless this browser's sign-in made it, or the sync is stopped", () => {
  const waiting = asked();
  assert.equal(waitingOutside(status("upToDate", { account: { waiting } })), waiting);
  assert.equal(waitingOutside(status("offline", { account: { waiting } })), waiting, "what the last pass heard still stands");
  assert.equal(waitingOutside(status("upToDate", { account: { waiting: asked({ mine: true }) } })), null, "its reader made it here");
  assert.equal(waitingOutside(status("upToDate", { account: { waiting: asked({ what: "rename" }) } })), null);
  assert.equal(waitingOutside(status("upToDate", { account: { waiting: null } })), null);
  assert.equal(waitingOutside(status("upToDate")), null);
  assert.equal(waitingOutside(undefined), null);
  for (const state of STATES.filter(needsReader)) {
    assert.equal(waitingOutside(status(state, { account: { waiting } })), null, `${state}: the stop is what the page says`);
  }
});

test("a waiting request is told once, again for another request, and again a day later", () => {
  const at = Date.parse("2026-11-25T12:00:00.000Z");
  const key = waitingKey(asked());
  assert.notEqual(key, waitingKey(asked({ what: "replace" })));
  assert.notEqual(key, waitingKey(asked({ asked: "2026-11-26T09:00:00.000Z" })), "the same kind of request, asked again, is a new one");
  assert.equal(shouldTellWaiting(undefined, key, at), true);
  assert.equal(shouldTellWaiting({ key, at }, key, at + 60_000), false);
  assert.equal(shouldTellWaiting({ key: "replace:x", at }, key, at + 60_000), true);
  assert.equal(shouldTellWaiting({ key, at }, key, at + TELL_AGAIN_MS), true);
  assert.equal(shouldTellWaiting({ key, at }, key, at - 60_000), true, "a clock set back doesn't silence it");
  assert.equal(shouldTellWaiting({ key, at: "yesterday" }, key, at), true);
});

test("who can open the notebook is read to see what is new at most every fifteen minutes", () => {
  const at = Date.parse("2026-11-25T12:00:00.000Z");
  assert.equal(NEWS_EVERY_MS, 15 * 60_000);
  assert.equal(newsCheckDue(undefined, at), true);
  assert.equal(newsCheckDue({ at, unseen: [], told: [] }, at + NEWS_EVERY_MS - 1), false);
  assert.equal(newsCheckDue({ at, unseen: [], told: [] }, at + NEWS_EVERY_MS), true);
  assert.equal(newsCheckDue({ at, unseen: [], told: [] }, at - 1), true, "a clock set back doesn't put it off");
  assert.equal(newsCheckDue({ at: "noon" }, at), true);
});

test("a device this computer approved isn't news on its reading pages; everything else the account's home says is", () => {
  const items = [
    { what: "device", id: "d2", how: "approval", by: "me" },
    { what: "device", id: "d3", how: "approval", by: "d2" },
    { what: "device", id: "d4", how: "recovery", by: null },
    { what: "device", id: "d5", how: "passkey", by: null },
    { what: "holder", id: "h1", kind: "recovery", by: "d2" },
  ];
  assert.deepEqual(newsOutside(items, "me").map((item) => item.id), ["d3", "d4", "d5", "h1"]);
  assert.deepEqual(newsOutside(items, "someone-else").map((item) => item.id), ["d2", "d3", "d4", "d5", "h1"]);
});

test("a notice's day leaves this year out, and keeps the number on its month's line", () => {
  const nowMs = Date.parse("2026-11-25T12:00:00.000Z");
  assert.equal(noticeDay("2026-12-02T18:00:00.000Z", { locale: "en-US", nowMs }), "December\u00a02");
  assert.equal(noticeDay("2027-01-03T18:00:00.000Z", { locale: "en-US", nowMs }), "January\u00a03, 2027");
  assert.equal(noticeDay("2025-03-09T18:00:00.000Z", { locale: "en-US", nowMs }), "March\u00a09, 2025");
  assert.equal(noticeDay("", { locale: "en-US", nowMs }), "");
  assert.equal(noticeDay("not a day", { locale: "en-US", nowMs }), "");
});

test("the notices' own words follow the site's conventions", () => {
  for (const words of [WAITING_WORDS, NEWS_WORDS, REVIEW_WORDS]) {
    assert.ok(words.length > 0);
    assert.doesNotMatch(words, /["'\u2014]/, `${words}: curly quotes only, and no em dash`);
  }
});
