// test/desk-sync-connector.test.js
//
// The website's connector in a browser (the plan's step 4g): the real store,
// the real sync storage, the real carrier, and the loop, over fake-indexeddb
// and the fake service (test/helpers/sync-browser.mjs). The loop's own rules
// are held in desk-sync-engine*.test.js; this holds what the browser adds:
// linking and the first merge, a reload, when a pass runs, one tab syncing
// for the rest, a new session, a new keyring, and unlinking.

import { test } from "node:test";
import assert from "node:assert/strict";

import "./helpers/browser-env.mjs";
import { bodies, count, freshBrowser, handTimers, moment, note, until } from "./helpers/sync-browser.mjs";
import { changeKey, join, setUp } from "./helpers/fake-notebook-service.mjs";
import { firstDevice, testClock } from "./helpers/sync-rig.mjs";
import * as ref from "../src/lib/desk-crypto.mjs";
import { SERVICES, SYNC_CHANNEL, SYNC_DB, SYNC_META, makeLink, readLink } from "../src/lib/desk-sync-link.mjs";

const { openStore } = await import("../src/scripts/desk/store.js");
const sync = await import("../src/scripts/desk/sync/start.js");
const { openSyncDb } = await import("../src/scripts/desk/sync/sync-db.js");
const { CHANGE_WAIT_MS, createConnector } = await import("../src/scripts/desk/sync/connector.js");

const ctx = () => ({ client: "test-web", contentVersion: "2026.11.24" });
const aMinuteAgo = () => testClock(new Date(Date.now() - 60_000).toISOString());
const state = (connector) => connector.status().state;
const inStep = (connector) => until(() => state(connector) === "upToDate", "the notebook in step");
const isChange = (ms) => ms === CHANGE_WAIT_MS;

/**
 * A browser linked to an account that another device set up. Returns the
 * browser's parts, the other device (a rig over a notebook in memory), the
 * browser's own device, its store, and its connector, in step.
 */
async function linkedBrowser({ before = [], theirs = [] } = {}) {
  const browser = freshBrowser();
  await sync.setSyncEnv(browser.env);
  const other = await firstDevice(browser.service, "reader", { clock: aMinuteAgo() });
  for (const body of theirs) other.note(body);
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
  return { ...browser, other, mine, store, connector };
}

test("an unlinked browser starts nothing and makes no second database", async () => {
  const browser = freshBrowser();
  await sync.setSyncEnv(browser.env);
  const store = await openStore({ ctx });
  await store.save(note());
  await moment();
  assert.equal(await sync.currentSync(), null);
  assert.deepEqual((await indexedDB.databases()).map((d) => d.name), ["lit-desk"]);
  assert.equal(browser.service.calls.length, 0);
});

test("linking merges this browser's notebook into the account's, and the account's into it", async () => {
  const { service, other, store, connector, mine } = await linkedBrowser({ before: ["mine 1", "mine 2"], theirs: ["theirs 1", "theirs 2"] });
  assert.deepEqual(await bodies(store), ["mine 1", "mine 2", "theirs 1", "theirs 2"]);
  assert.equal(service.account("reader").rows.size, 4, "all four are in the account");
  await other.sync();
  assert.deepEqual((await other.live()).map((r) => r.body).sort(), ["mine 1", "mine 2", "theirs 1", "theirs 2"]);
  assert.equal(connector.status().pending, 0);

  // What linking left in the browser.
  const link = readLink(await store.getMeta(SYNC_META));
  assert.equal(link.notebook, mine.keyring.notebook);
  assert.equal(link.service, SERVICES.local);
  const db = await openSyncDb();
  const kept = await db.getAll(["link", "token", "device"]);
  const { meta } = await db.read();
  db.close();
  assert.equal(kept.link, link.link, "the sync's storage carries the link's id");
  assert.equal(kept.token, mine.token);
  assert.equal(kept.device.id, mine.id);
  assert.equal(kept.device.key.privateKey.extractable, false, "the device's key can't be read out");
  assert.ok(meta.sealed?.enc && meta.sealed?.ct, "the keyring is kept sealed");
  const stored = JSON.stringify(meta);
  for (const { key } of mine.keyring.keys) assert.ok(!stored.includes(ref.toBase64url(key)), "no notebook key is stored in the clear");
});

test("every request goes out as the spec carries one: the session as a bearer, no cookie, nothing cached", async () => {
  const { service, mine } = await linkedBrowser({ before: ["one"] });
  assert.ok(service.fetched.length > 0);
  for (const { url, init } of service.fetched) {
    assert.ok(url.startsWith(`${SERVICES.local}/`), url);
    assert.equal(init.headers.Authorization, `Bearer ${mine.token}`);
    assert.equal(init.credentials, "omit");
    assert.equal(init.cache, "no-store");
    assert.equal(init.redirect, "error");
    assert.equal(init.referrerPolicy, "no-referrer");
    assert.equal(init.headers["Content-Type"], init.body === undefined ? undefined : "application/json");
  }
});

test("a reload carries on from storage and sends nothing again", async () => {
  const { service, env } = await linkedBrowser({ before: ["one", "two"], theirs: ["three"] });
  const posts = count(service, "POST", "/rows");
  await sync.setSyncEnv(env); // the page closes
  assert.equal(await sync.currentSync(), null);

  const calls = service.calls.length;
  const store = await openStore({ ctx }); // and opens again: the store finds the link and starts the connector
  await until(async () => (await sync.currentSync()) != null, "the connector starting from the store");
  const connector = await sync.currentSync();
  await inStep(connector);
  assert.equal(count(service, "POST", "/rows"), posts, "nothing was pushed again");
  const pulls = service.calls.slice(calls).filter((c) => c.method === "GET" && c.path.startsWith("/rows"));
  assert.ok(pulls.length >= 1);
  assert.ok(pulls.every((c) => !c.path.includes("since=0")), "it asks from where it left off");
  assert.deepEqual(await bodies(store), ["one", "three", "two"]);
});

test("a page with no store of its own starts the sync alone", async () => {
  const { service, env, other } = await linkedBrowser();
  await sync.setSyncEnv(env);
  other.note("written elsewhere");
  await other.sync();
  const connector = await sync.startSyncAlone();
  await inStep(connector);
  assert.ok(service.account("reader").rows.size === 1);
  assert.equal(await sync.startSyncAlone(), connector, "asked twice, it is the same connector");
});

test("a change goes out once the reader stops, and the loop's own merge asks for nothing", async () => {
  const { service, timers, store, other, connector } = await linkedBrowser();
  assert.deepEqual(timers.waiting().filter(isChange), [], "linking and the first pass left no change waiting");

  await store.save(note("first"));
  await store.save(note("second"));
  await moment();
  assert.deepEqual(timers.waiting().filter(isChange), [CHANGE_WAIT_MS], "two changes, one wait");
  assert.equal(service.account("reader").rows.size, 0, "nothing goes while the reader is still writing");
  await timers.fire(isChange);
  await connector.idle();
  assert.equal(service.account("reader").rows.size, 2);

  // What another device wrote arrives, is merged into the notebook, and that write asks for no pass.
  other.note("theirs");
  await other.sync();
  await connector.syncNow();
  await until(async () => (await bodies(store)).includes("theirs"), "the other device's note");
  await connector.idle();
  await moment();
  assert.deepEqual(timers.waiting().filter(isChange), []);
});

test("offline says so with what waits, tries again by itself, and loses nothing", async () => {
  const { service, timers, store, connector } = await linkedBrowser();
  service.offline();
  await store.save(note("written offline"));
  await moment();
  await timers.fire(isChange);
  await until(() => state(connector) === "offline", "offline");
  assert.equal(connector.status().pending, 1);
  assert.deepEqual(timers.waiting(), [5000], "one retry is waiting");

  // More written while a retry waits is counted, and sends nothing.
  const calls = service.calls.length;
  await store.save(note("and another"));
  await moment();
  await timers.fire(isChange);
  await until(() => connector.status().pending === 2, "the second change counted");
  assert.equal(service.calls.length, calls);

  service.online();
  await timers.fire((ms) => ms === 5000);
  await inStep(connector);
  assert.equal(service.account("reader").rows.size, 2);
  assert.equal(connector.status().pending, 0);
});

test("the browser coming back online, or the tab being looked at again, asks for a pass", async () => {
  const { service, connector } = await linkedBrowser();
  const pulls = () => count(service, "GET", "/rows");
  let before = pulls();
  window.dispatchEvent(new window.Event("online"));
  await until(() => pulls() > before, "a pass after coming online");
  await connector.idle();

  before = pulls();
  document.dispatchEvent(new window.Event("visibilitychange"));
  await moment();
  assert.equal(pulls(), before, "a tab looked at again a moment after a pass asks for nothing");
});

test("signed out by the service is said and not retried, and a new session picks up where it left", async () => {
  const { service, timers, store, connector, mine } = await linkedBrowser({ before: ["kept"] });
  service.endSession(mine.token);
  await connector.syncNow();
  await until(() => state(connector) === "signedOut", "signed out");
  await connector.idle();
  assert.deepEqual(timers.waiting(), [], "no timer tries again: only the reader can");

  const calls = service.calls.length;
  await store.save(note("written signed out"));
  await moment();
  await timers.fire(isChange);
  await until(() => connector.status().pending === 1, "the change counted");
  assert.equal(service.calls.length, calls, "and nothing is sent");
  assert.deepEqual(await bodies(store), ["kept", "written signed out"], "the notebook is whole");

  const again = service.signIn("reader");
  await connector.setSession(again);
  await inStep(connector);
  assert.equal(service.account("reader").rows.size, 2);
  const db = await openSyncDb();
  assert.equal(await db.get("token"), again);
  db.close();
  await assert.rejects(() => connector.setSession(""), /not a session/);
});

test("the account pages' own requests go out with the browser's session", async () => {
  const { connector, mine } = await linkedBrowser();
  const { status, body } = await connector.call("GET", "/account");
  assert.equal(status, 200);
  assert.equal(body.notebook, mine.keyring.notebook);
  assert.equal(connector.device().id, mine.id);
  assert.equal(connector.device().key.privateKey.extractable, false);
  const keyring = await connector.keyring();
  assert.equal(keyring.notebook, mine.keyring.notebook);
  assert.equal(keyring.current, 1);
});

test("one tab syncs for the browser: another shows its status, asks it, and takes over when it closes", async () => {
  const { service, env, store, connector } = await linkedBrowser();
  const link = readLink(await store.getMeta(SYNC_META));

  // A second tab: its own store, its own connection to the sync's storage, its own timers.
  const timersB = handTimers();
  const storeB = await openStore({ ctx });
  const dbB = await openSyncDb();
  const tabB = await createConnector({ store: storeB, db: dbB, link, env: { ...env, setTimer: timersB.set, clearTimer: timersB.clear } });
  await until(() => state(tabB) === "upToDate", "the second tab hearing the status");
  assert.equal(connector.status().leader, true);
  assert.equal(tabB.status().leader, false);

  // Written in the tab that follows: it asks the tab that syncs, which sends it.
  await storeB.save(note("from the second tab"));
  await moment();
  assert.deepEqual(timersB.waiting().filter(isChange), [CHANGE_WAIT_MS]);
  await timersB.fire(isChange);
  await until(() => service.account("reader").rows.size === 1, "the first tab pushing the second tab's note");
  await connector.idle();

  // "Reconnect" in the tab that follows is a pass in the tab that syncs.
  const pulls = count(service, "GET", "/rows");
  await tabB.syncNow();
  await until(() => count(service, "GET", "/rows") > pulls, "a pass asked for from the second tab");
  await connector.idle();

  // The first tab closes. The second takes the lock, reads the state from storage, and carries on.
  const posts = count(service, "POST", "/rows");
  await sync.setSyncEnv(env);
  await until(() => tabB.status().leader === true, "the second tab leading");
  await until(() => state(tabB) === "upToDate", "the second tab in step");
  assert.equal(count(service, "POST", "/rows"), posts, "it pushes nothing again");
  await storeB.save(note("after the first tab closed"));
  await moment();
  await timersB.fire(isChange);
  await until(() => service.account("reader").rows.size === 2, "the second tab pushing");
  tabB.stop();
  dbB.close();
});

test("a new keyring handed to a tab that follows reaches the tab that syncs, sealed", async () => {
  const { service, env, store, connector, other, mine } = await linkedBrowser({ before: ["sealed under the first key"] });
  const link = readLink(await store.getMeta(SYNC_META));
  const storeB = await openStore({ ctx });
  const dbB = await openSyncDb();
  const tabB = await createConnector({ store: storeB, db: dbB, link, env: { ...env, setTimer: () => null, clearTimer: () => {} } });
  await until(() => state(tabB) === "upToDate", "the second tab hearing the status");

  const heard = [];
  const listener = new BroadcastChannel(SYNC_CHANNEL);
  listener.onmessage = (e) => heard.push(e.data);

  // Another device changes the key, keeping this browser's device.
  const next = await changeKey(service, other.by, { kept: [other.by, mine] });
  await other.engine.adopt(next);
  await tabB.adopt(next);
  await until(async () => (await connector.keyring())?.current === 2, "the tab that syncs holding the new key");
  await inStep(connector);
  listener.close();

  const sent = heard.find((m) => m.t === "adopt");
  assert.ok(sent?.sealed?.enc && sent.sealed.ct, "it travelled sealed");
  const said = JSON.stringify(heard);
  for (const { key } of next.keys) assert.ok(!said.includes(ref.toBase64url(key)), "no key crossed between tabs in the clear");
  // And the browser's rows are resealed under the new key.
  await other.sync();
  await until(async () => {
    await connector.syncNow();
    await connector.idle();
    return [...service.account("reader").rows.values()].every((row) => row.kid === 2);
  }, "every row under the new key");

  // A keyring for another notebook is refused in the tab it was handed to, and nothing is sent.
  const forged = ref.firstKeyring(ref.newId(), ref.randomBytes(32));
  await assert.rejects(() => tabB.adopt(forged), (err) => err.why === "notebook");
  tabB.stop();
  dbB.close();
});

test("linking refuses what it shouldn't take, and writes nothing when it does", async () => {
  const browser = freshBrowser();
  await sync.setSyncEnv(browser.env);
  const first = await setUp(browser.service, "reader");
  const store = await openStore({ ctx });
  const good = { store, service: SERVICES.local, token: first.token, notebook: first.keyring.notebook, device: { id: first.id, key: first.key }, keyring: first.keyring };
  const refused = (options, why) => assert.rejects(() => sync.linkNotebook({ ...good, ...options }), (err) => err.name === "LinkRefused" && err.why === why, why);

  await refused({ service: "https://notebook.example.com" }, "service");
  await refused({ token: "" }, "session");
  await refused({ device: { id: first.id } }, "device");
  const readable = await crypto.subtle.generateKey({ name: "X25519" }, true, ["deriveBits"]);
  await refused({ device: { id: first.id, key: { privateKey: readable.privateKey, public: first.key.public } } }, "device");
  await refused({ notebook: ref.newId() }, "keyring");
  assert.equal(await store.getMeta(SYNC_META), undefined, "no link was written");
  assert.equal(await sync.currentSync(), null);
  assert.equal(browser.service.calls.length, 0);

  // Linked to one notebook, it joins another only on the reader's yes.
  const connector = await sync.linkNotebook(good);
  await inStep(connector);
  const elsewhere = await setUp(browser.service, "someone else");
  const other = { token: elsewhere.token, notebook: elsewhere.keyring.notebook, device: { id: elsewhere.id, key: elsewhere.key }, keyring: elsewhere.keyring };
  await assert.rejects(() => sync.linkNotebook({ ...good, ...other }), (err) => err.why === "otherNotebook" && err.notebook === first.keyring.notebook);
  assert.equal(readLink(await store.getMeta(SYNC_META)).notebook, first.keyring.notebook, "still linked to the first");
  assert.equal(await sync.currentSync(), connector, "and still syncing it");

  const moved = await sync.linkNotebook({ ...good, ...other, replace: true });
  await inStep(moved);
  assert.equal(readLink(await store.getMeta(SYNC_META)).notebook, elsewhere.keyring.notebook);
});

test("unlinking forgets the keys and the session, stops the sync, and leaves the notebook whole", async () => {
  const { service, timers, store } = await linkedBrowser({ before: ["one", "two"] });
  await sync.unlink({ store });
  assert.equal(await store.getMeta(SYNC_META), null);
  assert.equal(await sync.currentSync(), null);
  const db = await openSyncDb();
  assert.deepEqual(await db.getAll(["link", "token", "device", "told"]), { link: undefined, token: undefined, device: undefined, told: undefined });
  assert.deepEqual(await db.read(), { meta: {}, rows: [], held: [] });
  db.close();
  assert.deepEqual(await bodies(store), ["one", "two"]);

  const calls = service.calls.length;
  await store.save(note("after"));
  await moment();
  await timers.fire();
  await moment();
  assert.equal(service.calls.length, calls, "nothing more is sent");
  assert.equal(service.account("reader").rows.size, 2, "and what was synced is still in the account");
});

test("a link with no keys behind it says so and sends nothing", async () => {
  const browser = freshBrowser();
  await sync.setSyncEnv(browser.env);
  const store = await openStore({ ctx });
  await store.save(note("mine"));
  // The sync's storage was cleared apart from the notebook (or belongs to another copy of it).
  const other = await openSyncDb();
  await other.set({ link: "11111111-1111-4111-8111-111111111111", token: "someone-else" });
  other.close();
  await store.setMeta(SYNC_META, makeLink({ id: "22222222-2222-4222-8222-222222222222", notebook: ref.newId(), service: SERVICES.local, now: new Date().toISOString() }));
  await until(async () => (await sync.currentSync()) != null, "the connector starting");
  const connector = await sync.currentSync();
  await until(() => state(connector) === "noKeys", "no keys");
  await connector.syncNow();
  await moment();
  assert.equal(state(connector), "noKeys");
  assert.equal(browser.service.calls.length, 0, "another link's session is never used");
  assert.equal(connector.device(), null);
  assert.equal(await connector.keyring(), null);
  await assert.rejects(() => connector.adopt(ref.firstKeyring(ref.newId(), ref.randomBytes(32))), /holds no keys/);
  assert.deepEqual(await bodies(store), ["mine"]);
});

test("a link to a service this page may not talk to starts nothing", async () => {
  const browser = freshBrowser();
  await sync.setSyncEnv({ ...browser.env, pageOrigin: "https://litbible.net" });
  const store = await openStore({ ctx });
  await store.setMeta(SYNC_META, makeLink({ id: "22222222-2222-4222-8222-222222222222", notebook: ref.newId(), service: SERVICES.local, now: new Date().toISOString() }));
  await moment(60);
  assert.equal(await sync.currentSync(), null);
  assert.equal(browser.service.calls.length, 0);
});

test("the sync's database is the one name the privacy page gives", () => {
  assert.equal(SYNC_DB, "lit-desk-sync");
});

test("a key changed while the browser was closed is taken from the service when it opens", async () => {
  const { service, env, other, mine, store } = await linkedBrowser({ before: ["before the change"] });
  await sync.setSyncEnv(env);
  await changeKey(service, other.by, { kept: [other.by, mine] });
  await other.engine.adopt(other.by.keyring);
  other.note("after the change");
  await other.sync();

  const reopened = await openStore({ ctx });
  await until(async () => (await sync.currentSync()) != null, "the connector starting");
  const connector = await sync.currentSync();
  await inStep(connector);
  assert.deepEqual(await bodies(reopened), ["after the change", "before the change"]);
  assert.equal((await connector.keyring()).current, 2, "it took the new key from the service by itself");
  assert.deepEqual(await bodies(store), await bodies(reopened), "both stores on the page read one notebook");
});
