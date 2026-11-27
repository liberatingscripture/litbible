// test/desk-sync-stop.test.js
//
// A stop is final (Audit 9, SY9b-2): "Stop syncing" and signing out end a
// pass already running. Once `unlink` returns, nothing more comes in to the
// notebook, nothing more goes to the service, and nothing of the sync is
// written to storage again. The audit's two races are driven here with a
// gated service: S1, a pull in flight as the reader stops, and S2, a push in
// flight. Beside them, each part that holds it alone: the loop's own stop
// (src/lib/desk-sync-engine.mjs), the carrier's signal (sync/service.js), the
// Web Lock let go only once the pass has ended (sync/connector.js), and a
// sync storage handle that stays closed (sync/sync-db.js).

import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";

import "./helpers/browser-env.mjs";
import { bodies, count, freshBrowser, handTimers, moment, note, until } from "./helpers/sync-browser.mjs";
import { createFakeService, join } from "./helpers/fake-notebook-service.mjs";
import { firstDevice, memoryNotebook, nextDevice, settleAll, testClock } from "./helpers/sync-rig.mjs";
import { SERVICES, SYNC_DB, SYNC_META, readLink } from "../src/lib/desk-sync-link.mjs";

const { openStore } = await import("../src/scripts/desk/store.js");
const sync = await import("../src/scripts/desk/sync/start.js");
const { openSyncDb } = await import("../src/scripts/desk/sync/sync-db.js");
const { CHANGE_WAIT_MS, createConnector } = await import("../src/scripts/desk/sync/connector.js");
const { createApi } = await import("../src/scripts/desk/sync/service.js");

const ctx = () => ({ client: "test-web", contentVersion: "2026.11.24" });
const aMinuteAgo = () => testClock(new Date(Date.now() - 60_000).toISOString());
const state = (connector) => connector.status().state;
const inStep = (connector) => until(() => state(connector) === "upToDate", "the notebook in step");
const isChange = (ms) => ms === CHANGE_WAIT_MS;

/**
 * Holds the service's answer to the first request `pick` takes, until
 * `release()`. `reached` resolves when that request arrives; `done` once the
 * service has carried it out (whether or not anyone is still waiting for the
 * answer).
 */
function gate(service, pick) {
  let open;
  const held = new Promise((resolve) => {
    open = resolve;
  });
  let arrived;
  const reached = new Promise((resolve) => {
    arrived = resolve;
  });
  let finished;
  const done = new Promise((resolve) => {
    finished = resolve;
  });
  let armed = true;
  let holding = false;
  const before = service.onCall;
  service.onCall = async (call) => {
    await before?.(call);
    if (!armed || !pick(call)) return;
    armed = false;
    holding = true;
    arrived(call);
    await held;
    holding = false;
    // The service carries the request out once onCall returns; a moment later it has.
    setTimeout(finished, 20);
  };
  return { reached, done, release: () => open(), holding: () => holding };
}

/** Everything the sync keeps in a browser, read with a handle of its own. */
async function syncStorage() {
  const db = await openSyncDb();
  try {
    return {
      kept: await db.getAll(["link", "token", "device", "told", "meta"]),
      loop: await db.read(),
    };
  } finally {
    db.close();
  }
}

const EMPTY = {
  kept: { link: undefined, token: undefined, device: undefined, told: undefined, meta: undefined },
  loop: { meta: {}, rows: [], held: [] },
};

/**
 * A browser linked to an account another device set up, in step (as
 * test/desk-sync-connector.test.js makes one). `uncut` gives it a fetch that
 * never hears an abort, so an answer can arrive after the stop.
 */
async function linkedBrowser({ before = [], uncut = false } = {}) {
  const browser = freshBrowser();
  const { service } = browser;
  const env = uncut ? { ...browser.env, fetch: (url, init) => service.fetch(url, { ...init, signal: undefined }) } : browser.env;
  await sync.setSyncEnv(env);
  const other = await firstDevice(browser.service, "reader", { clock: aMinuteAgo() });
  await other.sync();
  const store = await openStore({ ctx });
  for (const body of before) await store.save(note(body));
  const mine = await join(browser.service, other.by);
  const connector = await sync.linkNotebook({
    store,
    service: SERVICES.local,
    token: mine.token,
    notebook: mine.keyring.notebook,
    device: { id: mine.id, key: mine.key },
    keyring: mine.keyring,
  });
  await inStep(connector);
  // The account's notice asks what is new once the page is in step (as linkedPage in
  // desk-sync-status-line.test.js waits for): a test that counts the calls counts only its own.
  await until(() => count(service, "GET", "/devices") === 1, "the account notice's look at what is new");
  return { ...browser, env, other, mine, store, connector };
}

const mineOnly = (mine, method, path) => (call) => call.token === mine.token && call.method === method && call.path.startsWith(path);

/* ── The audit's two races, in a browser ───────────────────────────────── */

test("S1: a pull in flight when “Stop syncing” returns merges nothing and writes nothing of the sync again", async () => {
  const { service, store, other, mine, connector } = await linkedBrowser({ before: ["mine"] });
  other.note("late arrival from the other device");
  await other.sync();

  const pull = gate(service, mineOnly(mine, "GET", "/rows"));
  await connector.syncNow();
  await pull.reached;
  const calls = service.calls.length;

  await sync.unlink({ store });
  assert.equal(readLink(await store.getMeta(SYNC_META)), null, "the browser is no longer linked");
  assert.deepEqual(await syncStorage(), EMPTY, "the sync's storage is empty as unlink returns");

  pull.release();
  await pull.done;
  await moment(60);
  assert.deepEqual(await bodies(store), ["mine"], "nothing that arrived after the stop was merged");
  assert.deepEqual(await syncStorage(), EMPTY, "and nothing of the sync was written again");
  assert.equal(service.calls.length, calls, "no request followed the stop");
});

test("S2: a push in flight when “Stop syncing” returns is followed by no request, and writes nothing of the sync again", async () => {
  const { service, store, timers, mine } = await linkedBrowser();
  const push = gate(service, mineOnly(mine, "POST", "/rows"));
  await store.save(note("sent as the reader stopped"));
  await moment();
  await timers.fire(isChange);
  await push.reached;
  const calls = service.calls.length;

  await sync.unlink({ store });
  assert.deepEqual(await syncStorage(), EMPTY, "the sync's storage is empty as unlink returns");

  push.release();
  await push.done;
  await moment(60);
  // The request had already gone, and the service may take it, as a real one may. Nothing follows it.
  assert.equal(service.calls.length, calls, "no request followed the stop");
  assert.deepEqual(await syncStorage(), EMPTY, "and nothing of the sync was written again");
  assert.deepEqual(await bodies(store), ["sent as the reader stopped"], "the notebook is whole");
});

test("with a request a browser can't cut off, unlink waits for the pass, and the answer that comes is not read", async () => {
  // A fetch that never hears the abort: the answer arrives after the stop, and the loop's own check holds.
  const { service, store, other, mine, connector } = await linkedBrowser({ before: ["mine"], uncut: true });
  other.note("late arrival from the other device");
  await other.sync();

  const pull = gate(service, mineOnly(mine, "GET", "/rows"));
  await connector.syncNow();
  await pull.reached;
  const calls = service.calls.length;

  let returned = false;
  const unlinking = sync.unlink({ store }).then(() => {
    returned = true;
  });
  await moment(60);
  assert.equal(returned, false, "unlink waits while the pass's request is out");
  pull.release();
  await unlinking;
  await moment(60);
  assert.deepEqual(await bodies(store), ["mine"], "the answer that came after the stop was not merged");
  assert.deepEqual(await syncStorage(), EMPTY);
  assert.equal(service.calls.length, calls, "no request followed it");
});

/* ── The Web Lock ──────────────────────────────────────────────────────── */

test("a stopped tab lets another lead only once its pass has ended", async () => {
  const { service, store, mine, connector, env } = await linkedBrowser({ uncut: true });
  const link = readLink(await store.getMeta(SYNC_META));
  const timersB = handTimers();
  const storeB = await openStore({ ctx });
  const dbB = await openSyncDb();
  const tabB = await createConnector({ store: storeB, db: dbB, link, env: { ...env, setTimer: timersB.set, clearTimer: timersB.clear } });
  await until(() => state(tabB) === "upToDate", "the second tab hearing the status");
  assert.equal(tabB.status().leader, false);

  const pull = gate(service, mineOnly(mine, "GET", "/rows"));
  await connector.syncNow();
  await pull.reached;

  // The first tab closes while its pull is out.
  const stopping = connector.stop();
  assert.equal(typeof stopping?.then, "function", "a stop can be waited for");
  assert.equal(connector.stop() === stopping, true, "asked again, it is the same stop");
  const closing = sync.setSyncEnv(env);
  await moment(60);
  assert.equal(tabB.status().leader, false, "the second tab doesn't lead while the first tab's pass runs");
  pull.release();
  await stopping;
  await closing;
  await until(() => tabB.status().leader === true, "the second tab leading");
  await until(() => state(tabB) === "upToDate", "the second tab in step");
  await tabB.stop();
  dbB.close();
});

/* ── The loop's own stop ───────────────────────────────────────────────── */

test("a stopped engine reads no answer that arrives after the stop, writes nothing, says nothing, and counts no failure", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const b = await nextDevice(service, a);
  await settleAll(service, [a, b]);
  a.note("late arrival");
  await a.sync();

  const pull = gate(service, (c) => c.token === b.by.token && c.method === "GET" && c.path.startsWith("/rows"));
  const passing = b.sync();
  await pull.reached;
  const before = b.notebook.snapshot();
  const writes = b.state.writes;
  const said = b.statuses.length;
  const calls = service.calls.length;

  const stopping = b.engine.stop();
  pull.release();
  const ended = await stopping;
  assert.equal((await passing).state, ended.state);
  assert.deepEqual(b.notebook.snapshot(), before, "nothing was merged into the notebook");
  assert.equal(b.state.writes, writes, "nothing was written to the sync's state");
  assert.equal(b.statuses.length, said, "no status was published");
  assert.equal(service.calls.length, calls, "no request followed");
  assert.equal(b.engine.failures(), 0, "a stop is not a failure");

  // From here, nothing starts.
  b.note("written after the stop");
  await b.engine.pass();
  await b.engine.tally();
  await assert.rejects(() => b.engine.adopt(b.by.keyring), (err) => err.name === "Stopped");
  assert.equal(service.calls.length, calls, "a pass after the stop makes no request");
  assert.equal(b.state.writes, writes, "and writes nothing");
  assert.equal(b.statuses.length, said);
});

test("a stopped engine sends nothing after a push that was in flight", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const b = await nextDevice(service, a);
  await settleAll(service, [a, b]);
  b.note("pushed as the stop came");

  const push = gate(service, (c) => c.token === b.by.token && c.method === "POST" && c.path === "/rows");
  b.sync();
  await push.reached;
  const writes = b.state.writes;
  const calls = service.calls.length;
  const stopping = b.engine.stop();
  push.release();
  await stopping;
  await push.done;
  assert.equal(service.calls.length, calls, "no pull follows the push");
  assert.equal(b.state.writes, writes, "its answer was not written");
});

test("the merge checks the stop inside the notebook's own transaction", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  // A notebook whose change waits for a transaction (as one behind another does) when asked to.
  const inner = memoryNotebook();
  let holdNext = false;
  let open;
  const held = new Promise((resolve) => {
    open = resolve;
  });
  let arrived;
  const reached = new Promise((resolve) => {
    arrived = resolve;
  });
  const notebook = {
    ...inner,
    async change(build, options) {
      if (holdNext) {
        holdNext = false;
        arrived();
        await held;
      }
      return inner.change(build, options);
    },
  };
  const b = await nextDevice(service, a, { notebook });
  await settleAll(service, [a, b]);
  a.note("late arrival");
  await a.sync();

  holdNext = true;
  b.sync();
  await reached;
  const before = b.notebook.snapshot();
  const writes = b.state.writes;
  const stopping = b.engine.stop();
  open();
  await stopping;
  assert.deepEqual(b.notebook.snapshot(), before, "the merge wrote nothing");
  assert.equal(b.state.writes, writes);
});

test("an engine stopped with no pass running resolves at once, and starts none", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  await a.sync();
  const calls = service.calls.length;
  const ended = await a.engine.stop();
  assert.equal(ended.state, "upToDate");
  a.note("after");
  assert.equal((await a.engine.pass()).state, "upToDate");
  assert.equal(service.calls.length, calls);
});

/* ── The carrier ───────────────────────────────────────────────────────── */

const PAGE = "http://localhost:4321";

test("the carrier sends nothing once its signal is aborted", async () => {
  const sent = [];
  const fetch = async (url) => {
    sent.push(url);
    return { status: 200, text: async () => "{}" };
  };
  const ending = new AbortController();
  const api = createApi({ service: SERVICES.local, token: () => "a-session", fetch, pageOrigin: PAGE, signal: ending.signal });
  assert.equal((await api.call("GET", "/account")).status, 200);
  ending.abort();
  await assert.rejects(() => api.call("GET", "/account"), (err) => err.name === "Offline");
  assert.equal(sent.length, 1, "nothing went after the abort");
});

test("an abort while a request is out ends it at once as Offline, and a request that finished lets go of the signal", async () => {
  const fetch = (url, init) =>
    new Promise((resolve, reject) => {
      // A request that never answers, and fails when its own signal is aborted, as a browser's does.
      init.signal.addEventListener("abort", () => reject(new DOMException("The operation was aborted.", "AbortError")));
    });
  const ending = new AbortController();
  // Its own time limit is short here only so that a carrier deaf to the signal ends the test soon.
  const api = createApi({ service: SERVICES.local, token: () => "a-session", fetch, pageOrigin: PAGE, signal: ending.signal, timeout: 2000 });
  const out = api.call("GET", "/rows?since=0");
  await moment(10);
  ending.abort();
  const ended = await Promise.race([out.then(() => "answered", (err) => err.name), moment(200).then(() => "still out")]);
  assert.equal(ended, "Offline", "cut off at once, not at the time limit");

  // A signal that counts who listens: a call listens while it is out, and leaves nobody behind.
  const listening = new Set();
  let heard = 0;
  const signal = {
    aborted: false,
    addEventListener: (_, fn) => {
      heard++;
      listening.add(fn);
    },
    removeEventListener: (_, fn) => listening.delete(fn),
  };
  const quick = createApi({ service: SERVICES.local, token: () => "a-session", fetch: async () => ({ status: 200, text: async () => "{}" }), pageOrigin: PAGE, signal });
  await quick.call("GET", "/account");
  assert.equal(heard, 1, "the call listened while it was out");
  assert.equal(listening.size, 0, "and let go when it finished");
});

/* ── The sync's storage ────────────────────────────────────────────────── */

test("a closed handle on the sync's storage refuses every call, and opens nothing again", async () => {
  const idb = new IDBFactory();
  const db = await openSyncDb({ idb });
  await db.set({ token: "a-session" });
  db.close();
  const refused = (err) => /closed/.test(err.message);
  await assert.rejects(() => db.get("token"), refused);
  await assert.rejects(() => db.getAll(["token"]), refused);
  await assert.rejects(() => db.set({ token: "another" }), refused);
  await assert.rejects(() => db.read(), refused);
  await assert.rejects(() => db.write({ meta: { cursor: 3 } }), refused);
  await assert.rejects(() => db.clear(), refused);

  // Deleted meanwhile: the closed handle doesn't make the database again.
  await new Promise((resolve, reject) => {
    const req = idb.deleteDatabase(SYNC_DB);
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  });
  await assert.rejects(() => db.write({ meta: { cursor: 3 } }), refused);
  assert.deepEqual((await idb.databases()).map((d) => d.name), []);
});

test("a connection the browser takes away (another tab deleting the database) is opened again", async () => {
  const idb = new IDBFactory();
  const db = await openSyncDb({ idb });
  await db.set({ token: "a-session" });
  await new Promise((resolve, reject) => {
    const req = idb.deleteDatabase(SYNC_DB);
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("the handle held the database open"));
  });
  assert.equal(await db.get("token"), undefined, "it reads the database made anew");
  await db.set({ token: "after" });
  assert.equal(await db.get("token"), "after");
  db.close();
});
