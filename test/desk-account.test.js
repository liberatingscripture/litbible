// The account's flows (src/lib/desk-account.mjs, desk-account-session.mjs,
// desk-passkey.mjs), run against the notebook service's own code: every
// request below is answered by workers/notebook-service/src/ on a real
// SQLite database, and every passkey is a real key answering a real
// ceremony. So a pass here means the website's side and the service's side
// agree, with no hand-written copy of either between them.

import assert from "node:assert/strict";
import { test } from "node:test";

import { realService } from "./helpers/real-notebook-service.mjs";
import { fakeCredentials } from "./helpers/fake-credentials.mjs";
import * as ref from "../src/lib/desk-crypto.mjs";
import { createApi } from "../src/scripts/desk/sync/service.js";
import { PasskeyStopped, prfOnly } from "../src/lib/desk-passkey.mjs";
import * as session from "../src/lib/desk-account-session.mjs";
import * as account from "../src/lib/desk-account.mjs";

const PRF = (await ref.prfInput()).bytes;
const { AccountRefusal, AccountStop } = account;

/** A service, the way in to it, and a record of every body sent. `env` adds bindings to the service's. */
function world(env = {}) {
  const service = realService({ env });
  const sent = [];
  const fetch = (url, init = {}) => {
    sent.push({ method: init.method, path: new URL(url).pathname, body: init.body ? JSON.parse(init.body) : null });
    return service.fetch(url, init);
  };
  const carrier = (options) => createApi({ service: service.origin, fetch, pageOrigin: service.pageOrigin, ...options }).call;
  return { service, sent, door: carrier({ signIn: true }), api: (token) => carrier({ token: () => token }) };
}

const lastSent = (w, path) => w.sent.filter((request) => request.path === path).at(-1)?.body;

/** A reader makes an account in `browser`. Returns the session, its `call`, and the browser. */
async function signUp(w, browser = fakeCredentials()) {
  const made = await session.signUpWithPasskey({ call: w.door, credentials: browser, prfInput: PRF });
  return { ...made, browser, call: w.api(made.token) };
}

/** The same reader signs in from a browser that has the passkey (their own, or one it synced to). */
async function signIn(w, browser) {
  const made = await session.signInWithPasskey({ call: w.door, credentials: browser, prfInput: PRF });
  return { ...made, browser, call: w.api(made.token) };
}

/** A second computer whose password manager has the first one's passkeys, as a synced passkey would be. */
function syncedBrowser(from) {
  const browser = fakeCredentials();
  browser.passkeys.push(...from.passkeys);
  return browser;
}

/** The passkey's PRF output: what it gave already, or one more prompt for it. */
const prfFor = async (browser, passkey) =>
  passkey.prf ?? (await prfOnly({ credentials: browser, rpId: passkey.rpId, allow: [passkey.id], prfInput: PRF, random: ref.randomBytes })).output;

/** An account with a notebook, set up from one computer. `follows` is "follows my account." */
async function setUpReader(w, { follows = true, recovery = true, name = "Chrome on Windows" } = {}) {
  const first = await signUp(w);
  const device = await account.newDevice({ name });
  const passkey = follows ? { credential: first.passkey.id, prf: await prfFor(first.browser, first.passkey) } : null;
  const made = await account.setUp({ call: first.call, device, passkey, recovery });
  return { ...first, device, held: made.held, code: made.code, made };
}

/** A second computer joins with the recovery code. */
async function joinByCode(w, reader, name = "Firefox on a Mac") {
  const second = await signIn(w, syncedBrowser(reader.browser));
  const device = await account.newDevice({ name });
  const { notebook } = await session.readAccount(second.call);
  const opened = await account.openWithRecoveryCode({ call: second.call, notebook, code: reader.code });
  await account.join({ call: second.call, device, held: opened.held, holder: opened.holder });
  return { ...second, device, held: opened.held };
}

async function refused(run, word, about) {
  await assert.rejects(run, (error) => {
    assert.ok(error instanceof AccountRefusal, `expected the service to refuse, got ${error}`);
    assert.equal(error.word, word);
    if (about) assert.ok(error.is(word, about), `${word}, but not about ${about}: ${JSON.stringify(error.detail)}`);
    return true;
  });
}

const stops = (run, why) =>
  assert.rejects(run, (error) => {
    assert.ok(error instanceof AccountStop, `expected a stop, got ${error}`);
    assert.equal(error.why, why);
    return true;
  });

/* ── Signing in ─────────────────────────────────────────────────────────── */

test("the service says which ways to sign in are on", async () => {
  const w = world();
  assert.deepEqual(await session.signInWays(w.door), { ways: ["passkey"], turnstile: null });
});

// Cloudflare's published dummy keys for testing (the site key and secret that
// always pass), not LIT's. Siteverify is stood in for: the service's own call
// to it goes through the global fetch, which is replaced for the test.
const TURNSTILE = { TURNSTILE_SITE_KEY: "1x00000000000000000000AA", TURNSTILE_SECRET: "1x0000000000000000000000000000000AA" };
const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

async function withSiteverify(run) {
  const asked = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    assert.equal(String(url), "https://challenges.cloudflare.com/turnstile/v0/siteverify");
    const form = Object.fromEntries(new URLSearchParams(init.body));
    asked.push(form);
    return new Response(JSON.stringify({ success: form.response === DUMMY_TOKEN }), { status: 200 });
  };
  try {
    return await run(asked);
  } finally {
    globalThis.fetch = real;
  }
}

test("with Turnstile on, the service names its site key, and a new account needs the page's token", async () => {
  await withSiteverify(async (asked) => {
    // The website's page is a browser on https://litbible.net, so its requests carry that Origin.
    const w = world(TURNSTILE);
    assert.equal(w.service.pageOrigin, "https://litbible.net");
    assert.deepEqual(await session.signInWays(w.door), { ways: ["passkey"], turnstile: TURNSTILE.TURNSTILE_SITE_KEY });

    await refused(
      () => session.signUpWithPasskey({ call: w.door, credentials: fakeCredentials(), prfInput: PRF }),
      "not_allowed",
      "turnstile",
    );
    await refused(
      () => session.signUpWithPasskey({ call: w.door, credentials: fakeCredentials(), prfInput: PRF, turnstile: "not-the-token" }),
      "not_allowed",
      "turnstile",
    );

    const made = await session.signUpWithPasskey({ call: w.door, credentials: fakeCredentials(), prfInput: PRF, turnstile: DUMMY_TOKEN });
    assert.equal(made.created, true);
    assert.deepEqual(lastSent(w, "/sign-in/new-passkey/options"), { turnstile: DUMMY_TOKEN });
    assert.deepEqual(asked.map((form) => form.response), ["not-the-token", DUMMY_TOKEN]);
    assert.equal(asked[1].secret, TURNSTILE.TURNSTILE_SECRET);
    assert.equal(JSON.stringify(w.sent).includes(TURNSTILE.TURNSTILE_SECRET), false);
    assert.deepEqual(w.service.failures, []);
  });
});

test("a new passkey makes an account, and the PRF's output never leaves the browser", async () => {
  const w = world();
  const browser = fakeCredentials();
  browser.next = { prf: "create" };
  const reader = await signUp(w, browser);

  assert.equal(reader.created, true);
  assert.equal(reader.way.kind, "passkey");
  assert.equal(reader.way.syncs, true);
  assert.equal(reader.passkey.prfEnabled, true);
  assert.equal(reader.passkey.prf.length, 32, "the passkey gave its output when it was made");

  // The browser was asked with the fixed input, and nothing of the answer's secret was sent on.
  assert.deepEqual(new Uint8Array(browser.asked[0].extensions.prf.eval.first), PRF);
  const body = lastSent(w, "/sign-in/new-passkey");
  assert.deepEqual(body.credential.clientExtensionResults.prf, { enabled: true });
  assert.equal(JSON.stringify(w.sent).includes(ref.toBase64url(reader.passkey.prf)), false);

  const state = await session.readAccount(reader.call);
  assert.equal(state.notebook, null);
  assert.equal(state.session.open, false);
  assert.equal(session.deletesAtOnce(state), true);
  assert.deepEqual(w.service.failures, []);
});

test("signing in again finds the same account, and brings the PRF's output with it", async () => {
  const w = world();
  const reader = await signUp(w);
  const again = await signIn(w, reader.browser);

  assert.equal(again.created, false);
  assert.equal(again.way.id, reader.way.id);
  assert.deepEqual(again.passkey.id, reader.passkey.id);
  assert.equal(again.passkey.prf.length, 32);
  assert.equal(lastSent(w, "/sign-in/passkey").credential.clientExtensionResults.prf?.results, undefined);
  assert.equal(JSON.stringify(w.sent).includes(ref.toBase64url(again.passkey.prf)), false);
});

test("a passkey that can't do the PRF still signs in, and says it can't hold the key", async () => {
  const w = world();
  const browser = fakeCredentials();
  browser.next = { prf: false, syncs: false };
  const reader = await signUp(w, browser);
  assert.equal(reader.passkey.prfEnabled, false);
  assert.equal(reader.passkey.prf, null);
  assert.equal(reader.way.syncs, false);
  assert.equal((await signIn(w, browser)).passkey.prf, null);
});

test("a passkey the service doesn't know is refused as unknown, and a closed prompt is its own thing", async () => {
  const w = world();
  const elsewhere = world();
  const stranger = await signUp(elsewhere);
  await refused(() => signIn(w, stranger.browser), "passkey_refused", "unknown");

  const browser = fakeCredentials();
  browser.cancel = true;
  await assert.rejects(
    () => signUp(w, browser),
    (error) => error instanceof PasskeyStopped && error.why === "canceled",
  );
  await assert.rejects(
    () => signIn(w, fakeCredentials()),
    (error) => error instanceof PasskeyStopped && error.why === "canceled",
  );
});

/* ── Setting up ─────────────────────────────────────────────────────────── */

test("setup under “follows my account”: a passkey holder, a recovery code, and an open session", async () => {
  const w = world();
  const first = await signUp(w);
  const device = await account.newDevice({ name: "Chrome on Windows" });
  assert.equal(device.key.privateKey.extractable, false, "the device key can't be read out");
  assert.equal(device.sign.privateKey.extractable, false);

  const prf = await prfFor(first.browser, first.passkey);
  const kept = [];
  const made = await account.setUp({
    call: first.call,
    device,
    passkey: { credential: first.passkey.id, prf },
    recovery: true,
    keep: ({ code }) => kept.push({ code, sentYet: w.sent.some((request) => request.path === "/notebook") }),
  });

  assert.equal(made.kid, 1);
  assert.equal(made.code.length, 15);
  assert.deepEqual(kept, [{ code: made.code, sentYet: false }], "the code was kept before the request went");
  assert.deepEqual(made.holders.map((holder) => holder.kind), ["passkey", "recovery"]);

  const state = await session.readAccount(first.call);
  assert.equal(state.notebook, made.held.notebook);
  assert.deepEqual(state.session, { ...state.session, open: true, device: device.id });

  const lists = await account.readLists({ call: first.call, held: made.held });
  assert.deepEqual(
    lists.devices.map(({ id, opens, name, platform, how }) => ({ id, opens, name, platform, how })),
    [{ id: device.id, opens: true, name: "Chrome on Windows", platform: "web", how: "setup" }],
  );
  assert.equal(account.whereKeyLives(lists), "account");
  assert.equal(account.hasRecoveryCode(lists), true);

  // Nothing secret was in what the service was sent.
  const text = JSON.stringify(w.sent);
  for (const secret of [prf, made.code, ref.keyOf(made.held, 1)]) assert.equal(text.includes(ref.toBase64url(secret)), false);
  assert.deepEqual(w.service.failures, []);
});

test("setup under “this device only”: the recovery code alone, and it is required", async () => {
  const w = world();
  const reader = await setUpReader(w, { follows: false });
  const lists = await account.readLists({ call: reader.call, held: reader.held });
  assert.equal(account.whereKeyLives(lists), "device");
  assert.deepEqual(lists.holders.map((holder) => holder.kind), ["recovery"]);

  const other = await signUp(w);
  const before = w.sent.length;
  const spare = await account.newDevice({ name: "x" });
  await stops(() => account.setUp({ call: other.call, device: spare, passkey: null, recovery: false }), "holderNeeded");
  assert.equal(w.sent.length, before, "nothing was sent");
});

test("of two devices setting up, the second is told to join, and its code was never handed over", async () => {
  const w = world();
  const reader = await setUpReader(w, { follows: false });
  const second = await signIn(w, syncedBrowser(reader.browser));
  let kept = null;
  const device = await account.newDevice({ name: "Second" });
  await refused(() => account.setUp({ call: second.call, device, recovery: true, keep: ({ code }) => (kept = code) }), "already_set_up");
  // The page stored it before sending and drops it on the refusal; no holder for it exists.
  assert.equal(kept.length, 15);
  const { notebook } = await session.readAccount(second.call);
  await stops(() => account.openWithRecoveryCode({ call: second.call, notebook, code: kept }), "wrongCode");
});

/* ── Adding a device ────────────────────────────────────────────────────── */

test("a second computer joins with the passkey that signed it in: one prompt for all of it", async () => {
  const w = world();
  const reader = await setUpReader(w);
  const browser = syncedBrowser(reader.browser);
  const second = await signIn(w, browser);
  assert.equal(browser.prompts, 1);

  const state = await session.readAccount(second.call);
  const holders = await account.readHolders(second.call);
  assert.deepEqual(account.waysToOpen(holders).passkeys.map(ref.toBase64url), [ref.toBase64url(reader.passkey.id)]);
  assert.equal(account.waysToOpen(holders).recovery, true);

  const opened = await account.openWithPasskey({ call: second.call, notebook: state.notebook, credential: second.passkey.id, prf: second.passkey.prf, holders });
  assert.equal(opened.kind, "passkey");
  const device = await account.newDevice({ name: "Edge on a laptop" });
  const joined = await account.join({ call: second.call, device, held: opened.held, holder: opened.holder });
  assert.equal(joined.kid, 1);
  assert.equal(browser.prompts, 1, "no second prompt");

  // The first computer sees it, and is told how it came.
  const lists = await account.readLists({ call: reader.call, held: reader.held });
  assert.deepEqual(
    account.news({ lists, seen: account.seenIn({ devices: [{ id: reader.device.id }], holders: lists.holders }), own: reader.device.id }),
    [{ what: "device", id: device.id, name: "Edge on a laptop", how: "passkey", by: null, byName: null, added: lists.devices[1].added }],
  );
  assert.deepEqual(account.news({ lists, seen: account.seenIn(lists), own: reader.device.id }), []);
});

test("a passkey that holds nothing, or gives the wrong bytes, opens nothing and loses nothing", async () => {
  const w = world();
  const reader = await setUpReader(w, { follows: false });
  const second = await signIn(w, syncedBrowser(reader.browser));
  const { notebook } = await session.readAccount(second.call);
  assert.equal(await account.openWithPasskey({ call: second.call, notebook, credential: second.passkey.id, prf: second.passkey.prf }), null);

  const follows = world();
  const other = await setUpReader(follows);
  const third = await signIn(follows, syncedBrowser(other.browser));
  const state = await session.readAccount(third.call);
  const wrong = ref.randomBytes(32);
  assert.equal(await account.openWithPasskey({ call: third.call, notebook: state.notebook, credential: third.passkey.id, prf: wrong }), null);
  assert.equal(await account.openWithPasskey({ call: third.call, notebook: state.notebook, credential: third.passkey.id, prf: null }), null);
  // The holder is still there, and the right bytes still open it.
  assert.ok(await account.openWithPasskey({ call: third.call, notebook: state.notebook, credential: third.passkey.id, prf: third.passkey.prf }));
});

test("a second computer joins with the recovery code, and a wrong code is said to be wrong", async () => {
  const w = world();
  const reader = await setUpReader(w, { follows: false });
  const second = await signIn(w, syncedBrowser(reader.browser));
  const { notebook } = await session.readAccount(second.call);

  const wrong = Uint8Array.from(reader.code);
  wrong[3] ^= 1;
  await stops(() => account.openWithRecoveryCode({ call: second.call, notebook, code: wrong }), "wrongCode");

  // As the reader types it: lowercase, spaces, a dash a notes app swapped in.
  const typed = ref.formatRecoveryCode(reader.code).toLowerCase().replaceAll("-", " – ");
  const opened = await account.openWithRecoveryCode({ call: second.call, notebook, code: ref.readRecoveryCode(typed) });
  const device = await account.newDevice({ name: "Firefox on a Mac" });
  await account.join({ call: second.call, device, held: opened.held, holder: opened.holder });

  const lists = await account.readLists({ call: second.call, held: opened.held });
  assert.deepEqual(lists.devices.map((entry) => entry.how), ["setup", "recovery"]);
  assert.equal(lists.devices[1].by, opened.holder);
});

test("a notebook with no recovery code says so when one is typed", async () => {
  const w = world();
  const reader = await setUpReader(w, { recovery: false });
  const second = await signIn(w, syncedBrowser(reader.browser));
  const { notebook } = await session.readAccount(second.call);
  await stops(() => account.openWithRecoveryCode({ call: second.call, notebook, code: ref.randomBytes(15) }), "noRecovery");
});

test("approval: the new computer shows the code, the one with the notebook grants, and the new one checks", async () => {
  const w = world();
  const reader = await setUpReader(w, { follows: false });
  const second = await signIn(w, syncedBrowser(reader.browser));
  const device = await account.newDevice({ name: "Safari on an iPad" });

  const code = ref.randomBytes(10);
  const asked = await account.askToJoin({ call: second.call, device, code });
  assert.equal(await account.acceptApproval({ call: second.call, device, asked }), null, "no grant yet");

  // On the first computer the reader types what the new one shows.
  const found = await account.findRequest({ call: reader.call, code: ref.readApprovalCode(ref.formatApprovalCode(code)) });
  assert.equal(found.request.model, "Safari on an iPad");
  assert.equal(found.request.platform, "web");
  assert.equal(found.granted, false);
  await account.grant({ call: reader.call, held: reader.held, found });

  const accepted = await account.acceptApproval({ call: second.call, device, asked });
  assert.equal(accepted.held.notebook, reader.held.notebook);
  assert.equal(accepted.kid, 1);

  const lists = await account.readLists({ call: reader.call, held: reader.held });
  const added = lists.devices.find((entry) => entry.id === device.id);
  assert.deepEqual({ how: added.how, by: added.by, name: added.name }, { how: "approval", by: reader.device.id, name: "Safari on an iPad" });
  const [announced] = account.news({ lists, seen: [reader.device.id, ...lists.holders.map((holder) => holder.id)], own: "another device" });
  assert.equal(announced.byName, "Chrome on Windows");

  // The code never reached the service, in any form it could read.
  const text = JSON.stringify(w.sent);
  assert.equal(text.includes(ref.formatApprovalCode(code).replaceAll("-", "")), false);
  assert.equal(text.includes(ref.toBase64url(code)), false);
});

test("approval refuses what the code doesn't vouch for, on both sides", async () => {
  const w = world();
  const reader = await setUpReader(w, { follows: false });
  const second = await signIn(w, syncedBrowser(reader.browser));
  const device = await account.newDevice({ name: "New" });
  const code = ref.randomBytes(10);
  const asked = await account.askToJoin({ call: second.call, device, code });

  // A code no request answers to.
  await stops(() => account.findRequest({ call: reader.call, code: ref.randomBytes(10) }), "approvalGone");

  // A service that swaps in a key of its own at the request.
  const swapped = await ref.generateKeyPair();
  const lying = async (method, path, body) => {
    const res = await reader.call(method, path, body);
    if (method === "GET" && path.startsWith("/approvals/")) res.body.approval.public = ref.toBase64url(swapped.public);
    return res;
  };
  await stops(() => account.findRequest({ call: lying, code }), "approvalForged");

  // A grant whose keyring isn't the one the MAC vouches for: the new device accepts nothing.
  const found = await account.findRequest({ call: reader.call, code });
  await account.grant({ call: reader.call, held: reader.held, found });
  const before = w.sent.length;
  const forged = async (method, path, body) => {
    const res = await second.call(method, path, body);
    if (method === "GET" && path.startsWith("/approvals/")) res.body.approval.grant.keyring.ct = ref.toBase64url(ref.randomBytes(200));
    return res;
  };
  await stops(() => account.acceptApproval({ call: forged, device, asked }), "approvalForged");
  assert.equal(w.sent.slice(before).some((request) => request.path.endsWith("/accept")), false);

  // The honest answer still works.
  assert.ok(await account.acceptApproval({ call: second.call, device, asked }));
});

/* ── The lists ──────────────────────────────────────────────────────────── */

test("renaming a device rewrites its card and keeps the rest of it", async () => {
  const w = world();
  const reader = await setUpReader(w, { follows: false });
  const lists = await account.readLists({ call: reader.call, held: reader.held });
  const before = lists.devices[0].card;

  const answer = await account.renameDevice({ call: reader.call, device: reader.device, held: reader.held, lists, name: "The study’s computer" });
  assert.equal(answer.lists, lists.lists + 1);

  const after = (await account.readLists({ call: reader.call, held: reader.held })).devices[0];
  assert.equal(after.name, "The study’s computer");
  assert.deepEqual({ ...after.card, name: before.name }, before);
});

test("removing a device changes the key: it is out, and a kept device catches up", async () => {
  const w = world();
  const reader = await setUpReader(w, { follows: false });
  const lost = await joinByCode(w, reader, "A lost laptop");
  const kept = await joinByCode(w, reader, "The office computer");

  const lists = await account.readLists({ call: reader.call, held: reader.held });
  assert.equal(lists.devices.length, 3);
  const change = await account.removeDevices({ call: reader.call, device: reader.device, held: reader.held, lists, ids: [lost.device.id] });
  assert.equal(change.kid, 2);
  assert.equal(change.held.current, 2);
  assert.deepEqual(change.removed, { devices: [lost.device.id], holders: [] });

  // The one that made the change is still open, under the new key.
  const after = await account.readLists({ call: reader.call, held: change.held });
  assert.deepEqual(after.devices.map((entry) => entry.name), ["Chrome on Windows", "The office computer"]);
  assert.equal(account.hasRecoveryCode(after), true, "the recovery code still opens it");

  // The removed one has no session and no sealed keyring.
  await refused(() => session.readAccount(lost.call), "sign_in");

  // The kept one is told it is behind, fetches its keyring, checks it, and proves.
  await refused(() => account.readLists({ call: kept.call, held: kept.held }), "not_open");
  const { keyring } = await session.must(kept.call, "GET", `/keyring?device=${kept.device.id}`);
  const incoming = await ref.openKeyring({ recipient: kept.device.key, enc: ref.fromBase64url(keyring.enc), ct: ref.fromBase64url(keyring.ct) });
  const caughtUp = ref.checkKeyring({ held: kept.held, incoming });
  const proved = await account.prove({ call: kept.call, device: kept.device, held: caughtUp });
  assert.deepEqual({ open: proved.open, device: proved.device, kid: proved.kid }, { open: true, device: kept.device.id, kid: 2 });
  assert.equal((await account.readLists({ call: kept.call, held: caughtUp })).devices.length, 2);

  // A keyring older than the service's key is said to be behind, not used.
  await stops(() => account.readLists({ call: reader.call, held: reader.held }), "behind");
});

test("an entry whose card doesn't open is shown as unknown, and the next change of key removes it", async () => {
  const w = world();
  const reader = await setUpReader(w, { follows: false });

  // A device joins with the right proof and a card no one can open.
  const second = await signIn(w, syncedBrowser(reader.browser));
  const ghost = await account.newDevice({ name: "Ghost" });
  const recovery = (await account.readHolders(second.call)).find((holder) => holder.kind === "recovery");
  const sealed = await ref.sealKeyring({ keyring: reader.held, recipientPublic: ghost.key.public });
  await session.must(second.call, "POST", "/devices", {
    kid: 1,
    proof: await account.proofOf(reader.held),
    holder: recovery.id,
    device: {
      id: ghost.id,
      card: { nonce: ref.toBase64url(ref.randomBytes(12)), ct: ref.toBase64url(ref.randomBytes(180)) },
      keyring: { enc: ref.toBase64url(sealed.enc), ct: ref.toBase64url(sealed.ct) },
    },
  });

  const lists = await account.readLists({ call: reader.call, held: reader.held });
  const unknown = lists.devices.find((entry) => entry.id === ghost.id);
  assert.deepEqual({ opens: unknown.opens, name: unknown.name }, { opens: false, name: undefined });
  assert.equal(account.news({ lists, seen: [], own: reader.device.id })[0].name, null);

  const change = await account.changeKey({ call: reader.call, device: reader.device, held: reader.held, lists });
  assert.deepEqual(change.removed.devices, [ghost.id]);
  assert.equal((await account.readLists({ call: reader.call, held: change.held })).devices.length, 1);
});

test("a holder is what its card says: a service that names another passkey or kind for it is not believed", async () => {
  const w = world();
  const reader = await setUpReader(w);
  const lying = (change) => async (method, path, body) => {
    const res = await reader.call(method, path, body);
    if (method === "GET" && path === "/devices") for (const holder of res.body.holders) change(holder);
    return res;
  };
  const other = ref.toBase64url(ref.randomBytes(20));
  const renamed = await account.readLists({ call: lying((holder) => holder.kind === "passkey" && (holder.credential = other)), held: reader.held });
  // The two holders were added in the same instant, so the service lists them in the order of their random ids.
  const byKind = (lists) => Object.fromEntries(lists.holders.map((holder) => [holder.kind, holder.opens]));
  assert.deepEqual(byKind(renamed), { passkey: false, recovery: true });
  assert.equal(account.whereKeyLives(renamed), "device", "a holder that isn't believed doesn't count as the passkey's");

  const swapped = await account.readLists({ call: lying((holder) => (holder.kind = holder.kind === "passkey" ? "recovery" : "passkey")), held: reader.held });
  assert.deepEqual(swapped.holders.map((holder) => holder.opens), [false, false]);

  const honest = await account.readLists({ call: reader.call, held: reader.held });
  assert.equal(account.whereKeyLives(honest), "account");
});

test("a change of key that the lists moved under is refused whole, and done again", async () => {
  const w = world();
  const reader = await setUpReader(w, { follows: false });
  const stale = await account.readLists({ call: reader.call, held: reader.held });
  await joinByCode(w, reader);

  await refused(() => account.changeKey({ call: reader.call, device: reader.device, held: reader.held, lists: stale }), "lists_changed");
  const fresh = await account.readLists({ call: reader.call, held: reader.held });
  assert.equal(fresh.kid, 1, "nothing of the refused change was kept");
  assert.equal((await account.changeKey({ call: reader.call, device: reader.device, held: reader.held, lists: fresh })).kid, 2);
});

test("a device never removes itself, and never leaves the notebook without a holder", async () => {
  const w = world();
  const reader = await setUpReader(w, { follows: false });
  const lists = await account.readLists({ call: reader.call, held: reader.held });
  const before = w.sent.length;
  const common = { call: reader.call, device: reader.device, held: reader.held, lists };
  await stops(() => account.removeDevices({ ...common, ids: [reader.device.id] }), "ownCard");
  await stops(() => account.changeKey({ ...common, removeHolders: lists.holders.map((holder) => holder.id) }), "holderNeeded");
  assert.equal(w.sent.length, before, "neither was sent");
});

/* ── The recovery code, and where the key lives ─────────────────────────── */

test("a new recovery code brings a new key, and the old code opens nothing", async () => {
  const w = world();
  const reader = await setUpReader(w, { follows: false });
  const lists = await account.readLists({ call: reader.call, held: reader.held });
  const kept = [];
  const change = await account.newRecoveryCode({
    call: reader.call,
    device: reader.device,
    held: reader.held,
    lists,
    keep: ({ code }) => kept.push({ code, sentYet: w.sent.some((request) => request.path === "/notebook/key") }),
  });
  assert.equal(change.kid, 2);
  assert.notDeepEqual(change.code, reader.code);
  assert.deepEqual(kept, [{ code: change.code, sentYet: false }]);

  const second = await signIn(w, syncedBrowser(reader.browser));
  const { notebook } = await session.readAccount(second.call);
  await stops(() => account.openWithRecoveryCode({ call: second.call, notebook, code: reader.code }), "wrongCode");
  const opened = await account.openWithRecoveryCode({ call: second.call, notebook, code: change.code });
  assert.equal(opened.held.current, 2);
  assert.deepEqual(ref.keyOf(opened.held, 1), ref.keyOf(reader.held, 1), "the new keyring still holds the older key");
});

test("a first recovery code is added without a new key", async () => {
  const w = world();
  const reader = await setUpReader(w, { recovery: false });
  const lists = await account.readLists({ call: reader.call, held: reader.held });
  assert.equal(account.hasRecoveryCode(lists), false);

  const added = await account.addHolder({ call: reader.call, held: reader.held, lists, want: { kind: "recovery" } });
  assert.equal(added.code.length, 15);
  const after = await account.readLists({ call: reader.call, held: reader.held });
  assert.equal(after.kid, 1);
  assert.equal(account.hasRecoveryCode(after), true);

  const second = await signIn(w, syncedBrowser(reader.browser));
  const { notebook } = await session.readAccount(second.call);
  assert.ok(await account.openWithRecoveryCode({ call: second.call, notebook, code: added.code }));
});

test("“follows my account” is turned on later with a passkey holder, and off again with a new key", async () => {
  const w = world();
  const reader = await setUpReader(w, { follows: false });
  let lists = await account.readLists({ call: reader.call, held: reader.held });
  assert.equal(account.whereKeyLives(lists), "device");

  // On: the passkey the reader signs in with becomes a holder. The key doesn't change.
  const prf = await prfFor(reader.browser, reader.passkey);
  await account.addHolder({ call: reader.call, held: reader.held, lists, want: { kind: "passkey", credential: reader.passkey.id, prf } });
  lists = await account.readLists({ call: reader.call, held: reader.held });
  assert.equal(account.whereKeyLives(lists), "account");
  assert.equal(lists.kid, 1);

  const second = await signIn(w, syncedBrowser(reader.browser));
  const { notebook } = await session.readAccount(second.call);
  assert.ok(await account.openWithPasskey({ call: second.call, notebook, credential: second.passkey.id, prf: second.passkey.prf }));

  // While it holds the key the passkey can't be removed as a way in: not as the
  // only way, and not once there is another.
  await refused(() => session.removeWay(reader.call, reader.way.id), "not_allowed", "last_way");
  await session.addPasskeyWay({ call: reader.call, credentials: fakeCredentials(), prfInput: PRF });
  await refused(() => session.removeWay(reader.call, reader.way.id), "not_allowed", "passkey_holds_key");
  lists = await account.readLists({ call: reader.call, held: reader.held });

  // Off: a new key, and no passkey holder gets it. The recovery code stays.
  const change = await account.switchToDeviceOnly({ call: reader.call, device: reader.device, held: reader.held, lists });
  assert.equal(change.kid, 2);
  assert.equal(change.code, null, "the reader has a code already");
  lists = await account.readLists({ call: reader.call, held: change.held });
  assert.equal(account.whereKeyLives(lists), "device");

  // The passkey still signs in, and opens nothing.
  const third = await signIn(w, syncedBrowser(reader.browser));
  assert.equal(await account.openWithPasskey({ call: third.call, notebook, credential: third.passkey.id, prf: third.passkey.prf }), null);
});

test("switching to “this device only” without a recovery code makes one in the same step", async () => {
  const w = world();
  const reader = await setUpReader(w, { recovery: false });
  const lists = await account.readLists({ call: reader.call, held: reader.held });
  const change = await account.switchToDeviceOnly({ call: reader.call, device: reader.device, held: reader.held, lists });
  assert.equal(change.code.length, 15);
  const after = await account.readLists({ call: reader.call, held: change.held });
  assert.deepEqual(after.holders.map((holder) => holder.kind), ["recovery"]);
});

test("removing the only thing that opens the notebook makes a recovery code in the same step", async () => {
  const w = world();
  const reader = await setUpReader(w, { recovery: false });
  const lists = await account.readLists({ call: reader.call, held: reader.held });
  const change = await account.removePasskeyHolder({ call: reader.call, device: reader.device, held: reader.held, lists, holder: lists.holders[0].id });
  assert.equal(change.code.length, 15);
  const after = await account.readLists({ call: reader.call, held: change.held });
  assert.deepEqual(after.holders.map((holder) => holder.kind), ["recovery"]);
  assert.equal(account.whereKeyLives(after), "device");
});

test("one passkey stops opening the notebook, and can then be removed as a way in", async () => {
  const w = world();
  const reader = await setUpReader(w);

  // A second passkey, kept somewhere else (a security key, another password manager).
  const elsewhere = fakeCredentials();
  const second = await session.addPasskeyWay({ call: reader.call, credentials: elsewhere, prfInput: PRF });
  assert.equal(second.way.kind, "passkey");
  // The same password manager is told it has one already.
  await assert.rejects(
    () => session.addPasskeyWay({ call: reader.call, credentials: reader.browser, prfInput: PRF }),
    (error) => error instanceof PasskeyStopped && error.why === "exists",
  );

  const lists = await account.readLists({ call: reader.call, held: reader.held });
  const holder = lists.holders.find((entry) => entry.kind === "passkey");
  const change = await account.removePasskeyHolder({ call: reader.call, device: reader.device, held: reader.held, lists, holder: holder.id });
  assert.equal(change.kid, 2);
  assert.equal(change.code, null, "the recovery code is still a holder");

  assert.deepEqual(await session.removeWay(reader.call, reader.way.id).then((answer) => typeof answer.lists), "number");
  const state = await session.readAccount(reader.call);
  assert.deepEqual(state.ways.map((way) => way.id), [second.way.id]);
  await refused(() => session.removeWay(reader.call, second.way.id), "not_allowed", "last_way");
});

/* ── Signing out, deleting, and the seven days ──────────────────────────── */

test("signing out removes the device's entry and session, and nothing else", async () => {
  const w = world();
  const reader = await setUpReader(w, { follows: false });
  const second = await joinByCode(w, reader);

  const answer = await account.signOutDevice({ call: second.call, device: second.device });
  assert.equal(typeof answer.lists, "number");
  await refused(() => session.readAccount(second.call), "sign_in");
  // Again, from a session the service no longer knows: as good as done.
  assert.deepEqual(await account.signOutDevice({ call: second.call, device: second.device }), { lists: null });

  const lists = await account.readLists({ call: reader.call, held: reader.held });
  assert.deepEqual(lists.devices.map((entry) => entry.id), [reader.device.id]);
  assert.equal(lists.kid, 1, "the key didn't change");
});

test("a signed-in session that never joined ends with the session alone", async () => {
  const w = world();
  const reader = await signUp(w);
  await session.endSession(reader.call);
  await refused(() => session.readAccount(reader.call), "sign_in");
  assert.equal((await signIn(w, reader.browser)).created, false, "the account is still there");
});

test("deleting from a session that has the key happens at once", async () => {
  const w = world();
  const reader = await setUpReader(w, { follows: false });
  const state = await session.readAccount(reader.call);
  assert.equal(session.deletesAtOnce(state), true);
  assert.equal((await session.deleteAccount(reader.call)).deleted, true);

  await refused(() => session.readAccount(reader.call), "sign_in");
  // The passkey stays in the reader's password manager, and is no one's way in now.
  await refused(() => signIn(w, reader.browser), "passkey_refused", "unknown");
});

test("an account with no notebook is deleted at once, from a session that is only signed in", async () => {
  const w = world();
  const reader = await signUp(w);
  assert.equal((await session.deleteAccount(reader.call)).deleted, true);
  await refused(() => signIn(w, reader.browser), "passkey_refused", "unknown");
});

test("deleting from a session without the key waits seven days, and either side can cancel", async () => {
  const w = world();
  const reader = await setUpReader(w, { follows: false });
  const page = await signIn(w, syncedBrowser(reader.browser));
  const state = await session.readAccount(page.call);
  assert.equal(session.deletesAtOnce(state), false);

  const asked = await session.deleteAccount(page.call);
  assert.equal(asked.deleted, false);
  assert.deepEqual(
    { what: asked.waiting.what, platform: asked.waiting.platform, through: asked.waiting.through, mine: asked.waiting.mine },
    { what: "delete", platform: "web", through: "passkey", mine: true },
  );
  assert.equal(Date.parse(asked.waiting.due) - Date.parse(asked.waiting.asked), 7 * 24 * 60 * 60 * 1000);

  // Every device of the reader's is shown it; only the asking session's is "mine."
  const seen = (await session.readAccount(reader.call)).waiting;
  assert.deepEqual({ what: seen.what, mine: seen.mine, due: seen.due }, { what: "delete", mine: false, due: asked.waiting.due });
  await refused(() => session.deleteAccount(page.call), "exists", "waiting");

  // The session that asked takes it back.
  assert.equal((await session.cancelWaiting(page.call)).canceled, "delete");
  assert.equal((await session.readAccount(reader.call)).waiting, null);
  // With nothing waiting, a session without the key has nothing to cancel, and one with it is told so.
  await refused(() => session.cancelWaiting(page.call), "not_open");
  await refused(() => session.cancelWaiting(reader.call), "gone", "waiting");

  // Asked again, and canceled from the computer that has the key.
  await session.deleteAccount(page.call);
  assert.equal((await session.cancelWaiting(reader.call)).canceled, "delete");
});

test("a request no one cancels is carried out once its seven days are up, and not before", async () => {
  const w = world();
  const reader = await setUpReader(w, { follows: false });
  const page = await signIn(w, syncedBrowser(reader.browser));
  const { waiting } = await session.deleteAccount(page.call);

  await w.service.due(new Date(Date.parse(waiting.due) - 60_000).toISOString());
  assert.equal((await session.readAccount(reader.call)).waiting.what, "delete", "a minute early, nothing happens");

  await w.service.due(new Date(Date.parse(waiting.due) + 60_000).toISOString());
  await refused(() => session.readAccount(reader.call), "sign_in");
  await refused(() => signIn(w, reader.browser), "passkey_refused", "unknown");
  assert.deepEqual(w.service.failures, []);
});

test("a reader who can't open the notebook asks to replace it, and after seven days sets up again", async () => {
  const w = world();
  const reader = await setUpReader(w, { follows: false });
  const page = await signIn(w, syncedBrowser(reader.browser));

  // A device that has the key has no notebook to replace.
  await refused(() => session.askToReplace(reader.call), "not_allowed", "already_open");
  const { waiting } = await session.askToReplace(page.call);
  assert.equal(waiting.what, "replace");

  await w.service.due(new Date(Date.parse(waiting.due) + 60_000).toISOString());
  const state = await session.readAccount(page.call);
  assert.equal(state.notebook, null);
  assert.equal(state.kid, 0);
  assert.equal(state.replaced.platform, "web");

  // The old device is signed in and no more; the page sets a new notebook up.
  assert.equal((await session.readAccount(reader.call)).session.open, false);
  const device = await account.newDevice({ name: "Starting again" });
  const made = await account.setUp({ call: page.call, device, recovery: true });
  assert.notEqual(made.held.notebook, reader.held.notebook);
  assert.equal(made.kid, 1);
});

/* ── Small things ───────────────────────────────────────────────────────── */

test("the two groups asked back are two different groups, in order, and are read as the code is", () => {
  const code = ref.randomBytes(15);
  const shown = ref.formatRecoveryCode(code).split("-");
  for (let seed = 0; seed < 64; seed++) {
    let n = seed;
    const [first, second] = account.groupsToAsk(() => Uint8Array.of((n = (n * 31 + 7) % 251)));
    assert.ok(first >= 1 && second <= 6 && first < second, `${first}, ${second}`);
    assert.equal(ref.recoveryGroupMatches(code, first, shown[first - 1].toLowerCase()), true);
    assert.equal(ref.recoveryGroupMatches(code, second, shown[first - 1]), shown[first - 1] === shown[second - 1]);
  }
});

test("a refusal says its word and what it is about", async () => {
  const w = world();
  const reader = await signUp(w);
  try {
    await session.cancelWaiting(reader.call);
    assert.fail("nothing is waiting");
  } catch (error) {
    assert.equal(error.status, 410);
    assert.equal(error.is("gone"), true);
    assert.equal(error.is("gone", "waiting"), true);
    assert.equal(error.is("gone", "device"), false);
    assert.equal(error.is("exists"), false);
  }
});
