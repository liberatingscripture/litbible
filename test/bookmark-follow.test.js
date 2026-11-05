// A bookmark that moves the reader (src/scripts/desk/bookmark-follow.js), driven
// with stubbed storage, events and a fake store: STUDY-DESK-AUDIT-1.md BA99 to
// BA102. Each page is a fresh copy of the follower (a query on its URL), as a
// page load would give; last-read.js is shared, as it is on one page.
import test from "node:test";
import assert from "node:assert/strict";

const base = { schema: 1, created: "2026-10-01T00:00:00Z", modified: "2026-10-01T00:00:00Z", client: "web/test", contentVersion: "v1", labels: [] };
const bookmark = (extra = {}) => ({ ...base, id: "r1", kind: "bookmark", follow: true, label: "Thursday group", bookKey: "romans", chapter: 8, verse: 30, endVerse: 30, ...extra });

function storage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

/**
 * A BroadcastChannel shared by the pages given it: a page's message reaches
 * every other page's channel of that name a turn later, never its own.
 */
function bus() {
  const open = new Set();
  return class FakeChannel {
    constructor(name) {
      this.name = name;
      this.listeners = [];
      open.add(this);
    }
    addEventListener(type, fn) {
      if (type === "message") this.listeners.push(fn);
    }
    postMessage(data) {
      for (const c of open) {
        if (c !== this && c.name === this.name) setTimeout(() => c.listeners.forEach((fn) => fn({ data: structuredClone(data) })), 0);
      }
    }
  };
}

/**
 * A tab on `path`, sharing `session` (sessionStorage) and `local` across its
 * pages. Without `channel` the page has no BroadcastChannel, so it doesn't
 * wait to learn whether it is a duplicate (Node's own would keep the test
 * process open).
 */
function tab(path, { session = storage(), local = storage(), channel } = {}) {
  const win = new EventTarget();
  const origin = "https://litbible.net";
  Object.assign(win, {
    sessionStorage: session,
    localStorage: local,
    location: { origin, pathname: path, href: origin + path, hash: "" },
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (t) => clearTimeout(t),
  });
  globalThis.window = win;
  globalThis.BroadcastChannel = channel;
  globalThis.document = {
    documentElement: { dataset: {}, hasAttribute: () => false },
    querySelector: () => null,
  };
  return { session, local, win };
}

/**
 * A store holding `records`. Its changes run one at a time, as IndexedDB's
 * transactions do; `onGet` runs another tab's change straight after a read.
 */
function fakeStore(records, { onGet = null } = {}) {
  const map = new Map(records.map((r) => [r.id, r]));
  const writes = [];
  let queue = Promise.resolve();
  const serial = (fn) => {
    const run = queue.then(fn);
    queue = run.catch(() => {});
    return run;
  };
  const read = async (id) => {
    const r = map.get(id) ?? null;
    if (onGet) {
      const hook = onGet;
      onGet = null;
      hook(store);
    }
    return r;
  };
  const store = {
    map,
    writes,
    // The follower before BA102 read and wrote in two steps; kept so these
    // tests show what that code did.
    get: read,
    commit: (plan, opts) =>
      serial(() => {
        for (const r of plan.put) map.set(r.id, r);
        writes.push({ plan, opts });
      }),
    change: (build, opts) =>
      serial(async () => {
        const plan = await build({ get: read, all: async () => [...map.values()] });
        if (!plan) return null;
        for (const r of plan.put) map.set(r.id, r);
        writes.push({ plan, opts });
        return plan;
      }),
  };
  return store;
}

let pages = 0;
async function loadFollower() {
  pages += 1;
  return import(`../src/scripts/desk/bookmark-follow.js?page=${pages}`);
}
const { saveLastRead } = await import("../src/scripts/last-read.js");
const ctx = () => ({ client: "web/test" });
const settle = () => new Promise((r) => setTimeout(r, 50));
const flagFor = (r) => JSON.stringify({ id: r.id, bookKey: r.bookKey });

test("BA99: following a bookmark's link within the page keeps it at its own verse until the reader moves", async () => {
  tab("/romans-8/");
  saveLastRead({ book: "romans", chapter: 8, verse: 2, view: "study" }); // the reader is at 8:2
  const store = fakeStore([bookmark()]);
  const { initBookmarkFollow, followBookmark } = await loadFollower();
  initBookmarkFollow({ store, ctx });

  followBookmark(bookmark(), "/romans-8/#v30");
  await settle();
  assert.equal(store.map.get("r1").verse, 30, "the old place (8:2) isn't written to the bookmark");
  assert.equal(store.writes.length, 0);

  // After the jump the page says where the reader is, and the bookmark follows.
  saveLastRead({ book: "romans", chapter: 8, verse: 31, view: "study" });
  await settle();
  assert.equal(store.map.get("r1").verse, 31);
  assert.equal(store.writes[0].opts.record, false, "reading makes no history entry");
});

test("BA99: in Read View, a bookmark's link elsewhere in the book doesn't take the reader's old place", async () => {
  tab("/read/romans/");
  saveLastRead({ book: "romans", chapter: 3, verse: 1, view: "read" });
  const store = fakeStore([bookmark({ chapter: 12, verse: 1, endVerse: 1 })]);
  const { initBookmarkFollow, followBookmark } = await loadFollower();
  initBookmarkFollow({ store, ctx });
  followBookmark(bookmark(), "/read/romans/#romans-12-v1");
  await settle();
  assert.equal(store.map.get("r1").chapter, 12);
});

test("BA99: a link to another page leaves this page's last report (its pagehide save) alone", async () => {
  const t = tab("/romans-8/");
  const store = fakeStore([bookmark({ chapter: 11, verse: 1, endVerse: 1 })]);
  const { initBookmarkFollow, followBookmark } = await loadFollower();
  initBookmarkFollow({ store, ctx });
  followBookmark(bookmark(), "/romans-11/#v1");
  assert.ok(t.session.getItem("lit-desk-follow"), "the flag is left for the next page");
  saveLastRead({ book: "romans", chapter: 8, verse: 5, view: "study" }); // pagehide
  await settle();
  assert.equal(store.writes.length, 0);
});

test("BA100: arriving in Read View starts from this page's own place, not another tab's in the book", async () => {
  const r = bookmark({ chapter: 8, verse: 3, endVerse: 3 });
  const session = storage({ "lit-desk-follow": flagFor(r) });
  // Tab B, reading Romans 12 in Read View, saved last.
  const local = storage({ lit_last_read: JSON.stringify({ v: 1, book: "romans", chapter: 12, verse: 1, view: "read", t: 1 }) });
  tab("/read/romans/", { session, local });
  saveLastRead({ book: "romans", chapter: 8, verse: 3, view: "read" }); // this page landed at 8:3
  local.setItem("lit_last_read", JSON.stringify({ v: 1, book: "romans", chapter: 12, verse: 1, view: "read", t: 2 }));
  const store = fakeStore([r]);
  const { initBookmarkFollow } = await loadFollower();
  initBookmarkFollow({ store, ctx });
  await settle();
  assert.equal(store.map.get("r1").chapter, 8);
  assert.equal(store.writes.length, 0, "already there: nothing written");
});

test("BA101: a page without the shell pauses the flag, so a far chapter doesn't move the bookmark", async () => {
  const session = storage({ "lit-desk-follow": flagFor(bookmark()) });
  tab("/search/", { session }); // the desk is off or the page has no reading surface
  await import(`../src/scripts/desk-gate.js?page=${++pages}`);
  assert.equal(JSON.parse(session.getItem("lit-desk-follow")).paused, true);

  tab("/romans-11/", { session });
  saveLastRead({ book: "romans", chapter: 11, verse: 1, view: "study" });
  const store = fakeStore([bookmark()]);
  const { initBookmarkFollow } = await loadFollower();
  initBookmarkFollow({ store, ctx });
  await settle();
  assert.equal(store.writes.length, 0);
});

test("BA101: back to a page in the book from the back-forward cache re-reads the flag", async () => {
  const session = storage();
  tab("/romans-8/", { session });
  const store = fakeStore([bookmark()]);
  const { initBookmarkFollow, followBookmark } = await loadFollower();
  initBookmarkFollow({ store, ctx });
  followBookmark(bookmark(), "/romans-8/#v30");
  // The reader went home (which dropped the flag) and came back with Back.
  session.removeItem("lit-desk-follow");
  window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
  saveLastRead({ book: "romans", chapter: 8, verse: 9, view: "study" });
  await settle();
  assert.equal(store.writes.length, 0);
});

test("a page outside the book leaves the follow in place, and the next chapter read decides it", async () => {
  const session = storage({ "lit-desk-follow": flagFor(bookmark()) });
  tab("/search/", { session });
  const { initBookmarkFollow } = await loadFollower();
  initBookmarkFollow({ store: null, ctx });
  assert.ok(session.getItem("lit-desk-follow"), "a page with no notebook doesn't end it");
});

test("a jump pauses the bookmark where it was and tells the reader once; reading on from there resumes it", async () => {
  const session = storage({ "lit-desk-follow": flagFor(bookmark()) });
  tab("/john-3/", { session });
  saveLastRead({ book: "john", chapter: 3, verse: 5, view: "study" }); // far from Romans 8
  const store = fakeStore([bookmark()]);
  const told = [];
  const { initBookmarkFollow } = await loadFollower();
  initBookmarkFollow({ store, ctx, tell: (about) => told.push(about) });
  await settle();
  assert.equal(store.map.get("r1").verse, 30, "it stays where the reader left off");
  assert.equal(JSON.parse(session.getItem("lit-desk-follow")).paused, true);
  assert.equal(told.length, 1, "the reader is told once");
  assert.equal(told[0].record.id, "r1");

  // Back in Romans, next to where it sits: it resumes and moves.
  tab("/romans-9/", { session });
  saveLastRead({ book: "romans", chapter: 9, verse: 4, view: "study" });
  const again = await loadFollower();
  again.initBookmarkFollow({ store, ctx, tell: (about) => told.push(about) });
  await settle();
  assert.equal(JSON.parse(session.getItem("lit-desk-follow")).paused, undefined);
  assert.equal(store.map.get("r1").chapter, 9);
  assert.equal(told.length, 1);
});

test("a pause that has run out is let go when a page loads", async () => {
  const old = JSON.stringify({ id: "r1", bookKey: "romans", paused: true, since: 1 });
  const session = storage({ "lit-desk-follow": old });
  tab("/romans-8/", { session });
  const { initBookmarkFollow } = await loadFollower();
  initBookmarkFollow({ store: null, ctx });
  assert.equal(session.getItem("lit-desk-follow"), null);
});

test("BA102: the move is read and written in one change, so a rename in between isn't saved over", async () => {
  const session = storage({ "lit-desk-follow": flagFor(bookmark()) });
  tab("/romans-8/", { session });
  // Another tab renames the bookmark just as the follower reads it.
  const rename = (s) => s.change(async ({ get }) => ({ put: [{ ...(await get("r1")), label: "Renamed elsewhere" }], remove: [] }));
  const store = fakeStore([bookmark()], { onGet: rename });
  const { initBookmarkFollow } = await loadFollower();
  initBookmarkFollow({ store, ctx });
  saveLastRead({ book: "romans", chapter: 8, verse: 12, view: "study" });
  await settle();
  const r = store.map.get("r1");
  assert.equal(r.verse, 12);
  assert.equal(r.label, "Renamed elsewhere");
});

test("BA102: a bookmark deleted as the follower reads it is not brought back", async () => {
  const session = storage({ "lit-desk-follow": flagFor(bookmark()) });
  tab("/romans-8/", { session });
  const trash = (s) => s.change(async () => ({ put: [{ ...base, id: "r1", kind: "trash" }], remove: [] }));
  const store = fakeStore([bookmark()], { onGet: trash });
  const { initBookmarkFollow } = await loadFollower();
  initBookmarkFollow({ store, ctx });
  saveLastRead({ book: "romans", chapter: 8, verse: 12, view: "study" });
  await settle();
  assert.equal(store.map.get("r1").kind, "trash");
});

test("a deleted bookmark stops following", async () => {
  const session = storage({ "lit-desk-follow": flagFor(bookmark()) });
  tab("/romans-8/", { session });
  const store = fakeStore([{ ...base, id: "r1", kind: "trash" }]);
  const { initBookmarkFollow } = await loadFollower();
  initBookmarkFollow({ store, ctx });
  saveLastRead({ book: "romans", chapter: 8, verse: 12, view: "study" });
  await settle();
  assert.equal(store.writes.length, 0);
  assert.equal(session.getItem("lit-desk-follow"), null);
});

/* ── One tab follows (BVJ's Duplicate tab check, 2026-10-29) ─────────── */

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const tabFlag = (r, tabToken) => JSON.stringify({ id: r.id, bookKey: r.bookKey, tab: tabToken });

test("a duplicated tab finds its original following and doesn't move the bookmark", async () => {
  const channel = bus();
  const store = fakeStore([bookmark()]);
  const a = tab("/romans-8/", { session: storage({ "lit-desk-follow": tabFlag(bookmark(), "T1") }), channel });
  const pageA = await loadFollower();
  pageA.initBookmarkFollow({ store, ctx });
  await wait(300); // nobody holds T1: the original keeps following
  const before = store.map.get("r1");

  // Duplicate tab: session storage copied, flag and token with it.
  const b = tab("/romans-9/", { session: storage({ "lit-desk-follow": tabFlag(bookmark(), "T1") }), channel });
  const pageB = await loadFollower();
  pageB.initBookmarkFollow({ store, ctx });
  saveLastRead({ book: "romans", chapter: 9, verse: 5, view: "study" });
  await wait(300);
  assert.equal(b.session.getItem("lit-desk-follow"), null, "the copy drops the flag");
  assert.equal(store.map.get("r1").chapter, before.chapter, "and the bookmark stays where the original put it");
  assert.ok(a.session.getItem("lit-desk-follow"), "the original keeps following");
});

test("opening a bookmark's link in another tab takes it over", async () => {
  const channel = bus();
  const store = fakeStore([bookmark()]);
  const a = tab("/romans-8/", { session: storage({ "lit-desk-follow": tabFlag(bookmark(), "T1") }), channel });
  const pageA = await loadFollower();
  pageA.initBookmarkFollow({ store, ctx });
  await wait(300);

  const b = tab("/romans-12/", { channel });
  const pageB = await loadFollower();
  pageB.initBookmarkFollow({ store, ctx });
  pageB.followBookmark(bookmark(), "/romans-8/#v30");
  const taken = JSON.parse(b.session.getItem("lit-desk-follow"));
  assert.ok(taken.tab && taken.tab !== "T1", "the new tab has its own token");
  globalThis.window = a.win; // the first tab hears the announcement
  await wait(50);
  assert.equal(a.session.getItem("lit-desk-follow"), null, "the first tab stops following");
});

test("a flag stored before tokens gets one, and still follows", async () => {
  const session = storage({ "lit-desk-follow": flagFor(bookmark()) });
  tab("/romans-8/", { session, channel: bus() });
  const { initBookmarkFollow } = await loadFollower();
  initBookmarkFollow({ store: fakeStore([bookmark()]), ctx });
  const f = JSON.parse(session.getItem("lit-desk-follow"));
  assert.equal(f.id, "r1");
  assert.ok(typeof f.tab === "string" && f.tab);
});

test("stopping by hand ends the following and leaves the bookmark where it was, switch still on", async () => {
  tab("/romans-8/");
  saveLastRead({ book: "romans", chapter: 8, verse: 2, view: "study" });
  const store = fakeStore([bookmark()]);
  const { initBookmarkFollow, followBookmark, stopFollowing, isFollowedHere, bookmarkState } = await loadFollower();
  initBookmarkFollow({ store, ctx });

  followBookmark(bookmark(), "/romans-8/#v30");
  assert.equal(isFollowedHere("r1"), true);
  assert.equal(bookmarkState(bookmark()).word, "Following");
  saveLastRead({ book: "romans", chapter: 8, verse: 31, view: "study" });
  await settle();
  assert.equal(store.map.get("r1").verse, 31);

  stopFollowing();
  assert.equal(isFollowedHere("r1"), false);
  assert.equal(bookmarkState(bookmark()).word, "Moves", "the switch stays on");
  saveLastRead({ book: "romans", chapter: 8, verse: 35, view: "study" });
  await settle();
  assert.equal(store.map.get("r1").verse, 31, "it stays where it last was");
  assert.equal(store.map.get("r1").follow, true);
});
