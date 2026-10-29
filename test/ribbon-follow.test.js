// A ribbon that follows the reader (src/scripts/desk/ribbon-follow.js), driven
// with stubbed storage, events and a fake store: STUDY-DESK-AUDIT-1.md BA99 to
// BA102. Each page is a fresh copy of the follower (a query on its URL), as a
// page load would give; last-read.js is shared, as it is on one page.
import test from "node:test";
import assert from "node:assert/strict";

const base = { schema: 1, created: "2026-10-01T00:00:00Z", modified: "2026-10-01T00:00:00Z", client: "web/test", contentVersion: "v1", labels: [] };
const ribbon = (extra = {}) => ({ ...base, id: "r1", kind: "place", ribbon: true, name: "Thursday group", bookKey: "romans", chapter: 8, verse: 30, endVerse: 30, ...extra });

function storage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

/** A tab on `path`, sharing `session` (sessionStorage) and `local` across its pages. */
function tab(path, { session = storage(), local = storage() } = {}) {
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
  globalThis.document = {
    documentElement: { dataset: {}, hasAttribute: () => false },
    querySelector: () => null,
  };
  return { session, local };
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
  return import(`../src/scripts/desk/ribbon-follow.js?page=${pages}`);
}
const { saveLastRead } = await import("../src/scripts/last-read.js");
const ctx = () => ({ client: "web/test" });
const settle = () => new Promise((r) => setTimeout(r, 50));
const flagFor = (r) => JSON.stringify({ id: r.id, bookKey: r.bookKey });

test("BA99: following a ribbon's link within the page keeps it at its own verse until the reader moves", async () => {
  tab("/romans-8/");
  saveLastRead({ book: "romans", chapter: 8, verse: 2, view: "study" }); // the reader is at 8:2
  const store = fakeStore([ribbon()]);
  const { initRibbonFollow, followRibbon } = await loadFollower();
  initRibbonFollow({ store, ctx });

  followRibbon(ribbon(), "/romans-8/#v30");
  await settle();
  assert.equal(store.map.get("r1").verse, 30, "the old place (8:2) isn't written to the ribbon");
  assert.equal(store.writes.length, 0);

  // After the jump the page says where the reader is, and the ribbon follows.
  saveLastRead({ book: "romans", chapter: 8, verse: 31, view: "study" });
  await settle();
  assert.equal(store.map.get("r1").verse, 31);
  assert.equal(store.writes[0].opts.record, false, "reading makes no history entry");
});

test("BA99: in Read View, a ribbon's link elsewhere in the book doesn't take the reader's old place", async () => {
  tab("/read/romans/");
  saveLastRead({ book: "romans", chapter: 3, verse: 1, view: "read" });
  const store = fakeStore([ribbon({ chapter: 12, verse: 1, endVerse: 1 })]);
  const { initRibbonFollow, followRibbon } = await loadFollower();
  initRibbonFollow({ store, ctx });
  followRibbon(ribbon(), "/read/romans/#romans-12-v1");
  await settle();
  assert.equal(store.map.get("r1").chapter, 12);
});

test("BA99: a link to another page leaves this page's last report (its pagehide save) alone", async () => {
  const t = tab("/romans-8/");
  const store = fakeStore([ribbon({ chapter: 11, verse: 1, endVerse: 1 })]);
  const { initRibbonFollow, followRibbon } = await loadFollower();
  initRibbonFollow({ store, ctx });
  followRibbon(ribbon(), "/romans-11/#v1");
  assert.ok(t.session.getItem("lit-desk-ribbon"), "the flag is left for the next page");
  saveLastRead({ book: "romans", chapter: 8, verse: 5, view: "study" }); // pagehide
  await settle();
  assert.equal(store.writes.length, 0);
});

test("BA100: arriving in Read View starts from this page's own place, not another tab's in the book", async () => {
  const r = ribbon({ chapter: 8, verse: 3, endVerse: 3 });
  const session = storage({ "lit-desk-ribbon": flagFor(r) });
  // Tab B, reading Romans 12 in Read View, saved last.
  const local = storage({ lit_last_read: JSON.stringify({ v: 1, book: "romans", chapter: 12, verse: 1, view: "read", t: 1 }) });
  tab("/read/romans/", { session, local });
  saveLastRead({ book: "romans", chapter: 8, verse: 3, view: "read" }); // this page landed at 8:3
  local.setItem("lit_last_read", JSON.stringify({ v: 1, book: "romans", chapter: 12, verse: 1, view: "read", t: 2 }));
  const store = fakeStore([r]);
  const { initRibbonFollow } = await loadFollower();
  initRibbonFollow({ store, ctx });
  await settle();
  assert.equal(store.map.get("r1").chapter, 8);
  assert.equal(store.writes.length, 0, "already there: nothing written");
});

test("BA101: a page without the shell drops the flag, so the book's next page doesn't move the ribbon", async () => {
  const session = storage({ "lit-desk-ribbon": flagFor(ribbon()) });
  tab("/search/", { session }); // the desk is off or the page has no reading surface
  await import(`../src/scripts/desk-gate.js?page=${++pages}`);
  assert.equal(session.getItem("lit-desk-ribbon"), null);

  tab("/romans-11/", { session });
  saveLastRead({ book: "romans", chapter: 11, verse: 1, view: "study" });
  const store = fakeStore([ribbon()]);
  const { initRibbonFollow } = await loadFollower();
  initRibbonFollow({ store, ctx });
  await settle();
  assert.equal(store.writes.length, 0);
});

test("BA101: back to a page in the book from the back-forward cache re-reads the flag", async () => {
  const session = storage();
  tab("/romans-8/", { session });
  const store = fakeStore([ribbon()]);
  const { initRibbonFollow, followRibbon } = await loadFollower();
  initRibbonFollow({ store, ctx });
  followRibbon(ribbon(), "/romans-8/#v30");
  // The reader went home (which dropped the flag) and came back with Back.
  session.removeItem("lit-desk-ribbon");
  window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
  saveLastRead({ book: "romans", chapter: 8, verse: 9, view: "study" });
  await settle();
  assert.equal(store.writes.length, 0);
});

test("BA101: the flag is dropped outside the book even when the notebook didn't open", async () => {
  const session = storage({ "lit-desk-ribbon": flagFor(ribbon()) });
  tab("/john-3/", { session });
  const { initRibbonFollow } = await loadFollower();
  initRibbonFollow({ store: null, ctx });
  assert.equal(session.getItem("lit-desk-ribbon"), null);
});

test("BA102: the move is read and written in one change, so a rename in between isn't saved over", async () => {
  const session = storage({ "lit-desk-ribbon": flagFor(ribbon()) });
  tab("/romans-8/", { session });
  // Another tab renames the ribbon just as the follower reads it.
  const rename = (s) => s.change(async ({ get }) => ({ put: [{ ...(await get("r1")), name: "Renamed elsewhere" }], remove: [] }));
  const store = fakeStore([ribbon()], { onGet: rename });
  const { initRibbonFollow } = await loadFollower();
  initRibbonFollow({ store, ctx });
  saveLastRead({ book: "romans", chapter: 8, verse: 12, view: "study" });
  await settle();
  const r = store.map.get("r1");
  assert.equal(r.verse, 12);
  assert.equal(r.name, "Renamed elsewhere");
});

test("BA102: a ribbon deleted as the follower reads it is not brought back", async () => {
  const session = storage({ "lit-desk-ribbon": flagFor(ribbon()) });
  tab("/romans-8/", { session });
  const trash = (s) => s.change(async () => ({ put: [{ ...base, id: "r1", kind: "trash" }], remove: [] }));
  const store = fakeStore([ribbon()], { onGet: trash });
  const { initRibbonFollow } = await loadFollower();
  initRibbonFollow({ store, ctx });
  saveLastRead({ book: "romans", chapter: 8, verse: 12, view: "study" });
  await settle();
  assert.equal(store.map.get("r1").kind, "trash");
});

test("a deleted ribbon stops following", async () => {
  const session = storage({ "lit-desk-ribbon": flagFor(ribbon()) });
  tab("/romans-8/", { session });
  const store = fakeStore([{ ...base, id: "r1", kind: "trash" }]);
  const { initRibbonFollow } = await loadFollower();
  initRibbonFollow({ store, ctx });
  saveLastRead({ book: "romans", chapter: 8, verse: 12, view: "study" });
  await settle();
  assert.equal(store.writes.length, 0);
  assert.equal(session.getItem("lit-desk-ribbon"), null);
});
