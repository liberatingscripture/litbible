// test/desk-account-providers.test.js
//
// The website's half of Sign in with Apple and with Google (the plan's step
// 4h; src/lib/desk-account-providers.mjs). Both are OFF: the website has no
// client id for either, so the first tests hold that no reader meets them.
// The rest turn them on with made-up ids and drive the real page against the
// service's own code, with both providers stood in for
// (test/helpers/fake-providers.mjs). Neither provider itself has ever been
// tried; what these tests prove is the page's side and that the two halves
// fit each other.

import { test } from "node:test";
import assert from "node:assert/strict";

import "./helpers/browser-env.mjs";

const { browser, openPage, saveCode, synced, until, world } = await import("./helpers/account-page.mjs");
const { fakeProviders, APPLE_WEB_CLIENT, GOOGLE_WEB_CLIENT } = await import("./helpers/fake-providers.mjs");
const { WORDS } = await import("../src/lib/desk-account-words.mjs");
const { openSyncDb } = await import("../src/scripts/desk/sync/sync-db.js");
const P = await import("../src/lib/desk-account-providers.mjs");

/** What a browser's sync storage holds under `key`. */
async function kept(b, key) {
  const db = await openSyncDb({ idb: b.idb });
  try {
    return await db.get(key);
  } finally {
    db.close();
  }
}

/* ── Off ────────────────────────────────────────────────────────────────── */

test("no client id is configured, and none is guessed", () => {
  assert.deepEqual({ ...P.PROVIDER_CLIENTS }, { apple: null, google: null });
  assert.equal(P.anyClient(), false);
  assert.deepEqual(P.offered(["passkey", "apple", "google"]), [], "on at the service is not enough");
});

test("with no client id the page offers neither, and asks the service nothing more than before", async () => {
  const idp = await fakeProviders();
  try {
    const w = world(idp.env); // on at the service
    const page = await openPage(browser(w));
    await page.shows(WORDS.signInPasskey);
    await new Promise((r) => setTimeout(r, 20));
    assert.deepEqual(page.labels(), [WORDS.signInPasskey, WORDS.create]);
    assert.deepEqual(w.sent.map((r) => r.path), [], "a signed-out page asks nothing until a button is pressed");
  } finally {
    idp.restore();
  }
});

/* ── The pure half ──────────────────────────────────────────────────────── */

test("a provider is offered only when the service lists it and the website has its client id", () => {
  const both = { apple: "a", google: "g" };
  assert.deepEqual(P.offered(["passkey", "google", "apple"], both), ["apple", "google"], "in the page's order");
  assert.deepEqual(P.offered(["passkey", "google"], both), ["google"]);
  assert.deepEqual(P.offered(["passkey", "apple", "google"], { apple: null, google: "g" }), ["google"]);
  assert.deepEqual(P.offered(["passkey", "apple"], { apple: "", google: "g" }), []);
  assert.deepEqual(P.offered(null, both), []);
  assert.equal(P.anyClient({ apple: null, google: "g" }), true);
});

test("a reader comes back to the page they left, and only an account page is such a page", () => {
  assert.equal(P.returnAddress({ origin: "https://litbible.net", pathname: "/account/" }), "https://litbible.net/account/");
  assert.equal(P.returnAddress({ origin: "https://litbible.net", pathname: "/delete-account/" }), "https://litbible.net/delete-account/");
  assert.equal(P.returnAddress({ origin: "https://litbible.net", pathname: "/account/connect/" }), null);
  assert.equal(P.returnAddress({ origin: "https://litbible.net", pathname: "/john-3/" }), null);
});

test("each provider's address carries the client, the way back, the challenge as the nonce, and the state, and asks for no name or email", () => {
  const sent = { client: "the.client", redirect: "https://litbible.net/account/", challenge: "c".repeat(43), state: "s".repeat(32) };
  const google = new URL(P.authorizeAddress("google", sent));
  assert.equal(google.origin + google.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.deepEqual(Object.fromEntries(google.searchParams), {
    client_id: "the.client", redirect_uri: sent.redirect, response_type: "id_token", scope: "openid", nonce: sent.challenge, state: sent.state,
  });
  const appleText = P.authorizeAddress("apple", sent);
  const apple = new URL(appleText);
  assert.equal(apple.origin + apple.pathname, "https://appleid.apple.com/auth/authorize");
  assert.deepEqual(Object.fromEntries(apple.searchParams), {
    client_id: "the.client", redirect_uri: sent.redirect, response_type: "code id_token", response_mode: "fragment", nonce: sent.challenge, state: sent.state,
  });
  assert.match(appleText, /response_type=code%20id_token/, "a space is %20");
  assert.equal(apple.searchParams.has("scope"), false, "Apple answers after the # only when no scope is asked for");
  assert.equal(P.authorizeAddress("github", sent), null);
  assert.equal(P.authorizeAddress("google", { ...sent, client: null }), null);
});

test("only a provider's answer is read from the address", () => {
  assert.deepEqual(P.readReturn("#state=abc&id_token=t.o.k"), { state: "abc", idToken: "t.o.k", code: null, error: null });
  assert.deepEqual(P.readReturn("#code=c1&id_token=t.o.k&state=abc"), { state: "abc", idToken: "t.o.k", code: "c1", error: null });
  assert.deepEqual(P.readReturn("#error=access_denied&state=abc"), { state: "abc", idToken: null, code: null, error: "access_denied" });
  for (const other of ["", "#", "#sign-out", "#a=ABCD1234EFGH5678", "#state=abc", "#id_token=t.o.k", "#realstate=abc&id_token=t"]) assert.equal(P.readReturn(other), null, other);
});

test("an answer is taken only for what this browser kept: the same state, the same service, in time", () => {
  const at = 1_000_000;
  const keptOne = { v: 1, provider: "google", purpose: "signIn", challenge: "c", state: "s".repeat(32), redirect: "r", service: "https://svc", at };
  const back = { state: "s".repeat(32), idToken: "t" };
  const ok = (b, k, now = at + 1000) => P.answersKept(b, k, { service: "https://svc", now });
  assert.equal(ok(back, keptOne), true);
  assert.equal(ok({ ...back, state: "x".repeat(32) }, keptOne), false, "another state");
  assert.equal(ok(back, null), false, "nothing kept: a link someone else made");
  assert.equal(ok(back, { ...keptOne, service: "https://other" }), false);
  assert.equal(ok(back, { ...keptOne, provider: "github" }), false);
  assert.equal(ok(back, { ...keptOne, state: "short" }), false);
  assert.equal(ok({ ...back, state: "short" }, { ...keptOne, state: "short" }), false);
  assert.equal(ok(back, keptOne, at + P.RETURN_MS + 1), false, "too late");
  assert.equal(ok(back, keptOne, at - 1), false, "a clock that went back");
});

/* ── The page, with both on ─────────────────────────────────────────────── */

/** A world with both providers on, and what a page in it is handed. */
async function on() {
  const idp = await fakeProviders();
  const w = world(idp.env);
  const went = [];
  return { idp, w, went, env: { providerClients: idp.clients, go: (href) => went.push(href) } };
}

test("Sign in with Google: the page leaves with the service's challenge, and comes back signed in to a new account", async () => {
  const { idp, w, went, env } = await on();
  try {
    const b = browser(w);
    let page = await openPage(b, { env });
    await until(() => page.button(WORDS.signInGoogle), "the providers' buttons");
    assert.deepEqual(page.labels(), [WORDS.signInPasskey, WORDS.create, WORDS.signInApple, WORDS.signInGoogle]);

    await page.press(WORDS.signInGoogle);
    assert.equal(went.length, 1);
    const asked = new URL(went[0]).searchParams;
    assert.equal(asked.get("client_id"), GOOGLE_WEB_CLIENT);
    assert.equal(asked.get("redirect_uri"), "https://litbible.net/account/");
    const held = await kept(b, "provider");
    assert.equal(held.provider, "google");
    assert.equal(held.purpose, "signIn");
    assert.equal(asked.get("nonce"), held.challenge, "the token's nonce will be the service's challenge");
    assert.match(asked.get("state"), /^[0-9a-f]{32}$/);
    assert.equal(asked.get("state"), held.state);

    // Google sends the reader back with the token after the #.
    page = await openPage(b, { env, hash: await idp.answer(went[0]) });
    await page.shows(WORDS.setupTitle);
    assert.equal(window.location.hash, "", "the token is taken out of the address");
    assert.equal(await kept(b, "provider"), undefined, "what was kept is used once");
    assert.deepEqual(page.ctx.S.account.ways.map((way) => way.kind), ["google"]);
    assert.equal(page.root.querySelector("#account-key-account").disabled, true, "no passkey, so the key can't follow the account");

    // Setting up from here is the ordinary setup: this device only, and a recovery code.
    await page.press(WORDS.setupContinue);
    await page.shows(WORDS.codeTitle);
    await saveCode(page);
    await page.shows(WORDS.homeTitle);
    await synced(page);
    assert.deepEqual(w.service.failures, []);
  } finally {
    idp.restore();
  }
});

test("Sign in with Apple sends the code and the way back with the token, and the same Apple account signs in to the same account again", async () => {
  const { idp, w, went, env } = await on();
  try {
    const b = browser(w);
    let page = await openPage(b, { env });
    await until(() => page.button(WORDS.signInApple), "the providers' buttons");
    await page.press(WORDS.signInApple);
    assert.equal(new URL(went[0]).searchParams.get("client_id"), APPLE_WEB_CLIENT);
    page = await openPage(b, { env, hash: await idp.answer(went[0], { subject: "apple-reader" }) });
    await page.shows(WORDS.setupTitle);
    const first = page.ctx.S.account.id ?? page.ctx.S.account.account;
    const sent = w.sent.find((r) => r.path === "/sign-in/apple").body;
    assert.deepEqual(Object.keys(sent).sort(), ["challenge", "code", "idToken", "redirect"]);
    assert.equal(sent.redirect, "https://litbible.net/account/");
    const traded = idp.calls.find((c) => c.url === "https://appleid.apple.com/auth/token");
    assert.equal(traded.form.code, "code-apple-reader");
    assert.equal(traded.form.redirect_uri, "https://litbible.net/account/", "Apple is given the same way back the page used");

    // Another browser, the same Apple account.
    const other = browser(w);
    let again = await openPage(other, { env });
    await until(() => again.button(WORDS.signInApple), "the providers' buttons");
    await again.press(WORDS.signInApple);
    again = await openPage(other, { env, hash: await idp.answer(went[1], { subject: "apple-reader" }) });
    await again.shows(WORDS.setupTitle);
    assert.equal(again.ctx.S.account.id ?? again.ctx.S.account.account, first);
    assert.deepEqual(w.service.failures, []);
  } finally {
    idp.restore();
  }
});

test("an answer this browser didn't ask for is refused before anything is sent, and a closed sign-in says so", async () => {
  const { idp, w, went, env } = await on();
  try {
    // A link someone else made, with a real token in it: this browser kept nothing for it.
    const maker = browser(w);
    const theirs = await openPage(maker, { env });
    await until(() => theirs.button(WORDS.signInGoogle), "the providers' buttons");
    await theirs.press(WORDS.signInGoogle);
    const link = await idp.answer(went[0], { subject: "someone-else" });

    const victim = browser(w);
    const before = w.sent.length;
    const page = await openPage(victim, { env, hash: link });
    await page.shows(WORDS.providerStale);
    assert.equal(window.location.hash, "");
    assert.equal(w.sent.slice(before).some((r) => r.path.startsWith("/sign-in/google")), false, "the token was never sent");
    assert.equal(page.ctx.S.session, null);

    // The reader closes the provider's page: it answers with an error and the same state.
    const b = browser(w);
    let mine = await openPage(b, { env });
    await until(() => mine.button(WORDS.signInGoogle), "the providers' buttons");
    await mine.press(WORDS.signInGoogle);
    mine = await openPage(b, { env, hash: await idp.answer(went[1], { cancel: true }) });
    await mine.shows(WORDS.providerCanceled);
    assert.equal(await kept(b, "provider"), undefined);
    assert.ok(mine.button(WORDS.signInPasskey), "and the ways to sign in are offered again");
  } finally {
    idp.restore();
  }
});

test("a token the service refuses says so, and nothing is signed in", async () => {
  const { idp, w, went, env } = await on();
  try {
    const b = browser(w);
    let page = await openPage(b, { env });
    await until(() => page.button(WORDS.signInGoogle), "the providers' buttons");
    await page.press(WORDS.signInGoogle);
    // The right state, and a token made for another challenge.
    const real = new URL(went[0]);
    real.searchParams.set("nonce", "A".repeat(43));
    page = await openPage(b, { env, hash: await idp.answer(real.href) });
    await until(() => page.alert() !== "", "the refusal to be said");
    assert.equal(page.alert(), "That sign-in wasn’t accepted, so nothing was changed. Try again.");
    assert.equal(page.ctx.S.session, null);
    assert.ok(page.button(WORDS.signInPasskey));
  } finally {
    idp.restore();
  }
});

test("a signed-in reader adds Google as another way in from the account's home", async () => {
  const { idp, w, went, env } = await on();
  try {
    const b = browser(w);
    let page = await openPage(b, { env });
    await page.press(WORDS.create);
    await page.shows(WORDS.setupTitle);
    page.root.querySelector("#account-key-device").checked = true;
    await page.press(WORDS.setupContinue);
    await page.shows(WORDS.codeTitle);
    await saveCode(page);
    await page.shows(WORDS.homeTitle);
    await synced(page);
    await until(() => page.button(WORDS.wayAddGoogle), "“Add Sign in with Google”");
    assert.ok(page.button(WORDS.wayAddApple));

    await page.press(WORDS.wayAddGoogle);
    assert.equal((await kept(b, "provider")).purpose, "way");
    page = await openPage(b, { env, hash: await idp.answer(went[0], { subject: "google-reader" }) });
    await page.shows(WORDS.homeTitle);
    await synced(page);
    await page.shows(WORDS.wayAdded);
    await until(() => [...page.root.querySelectorAll(".account__item-name")].some((el) => el.textContent === "Google"), "Google among the ways to sign in");
    assert.deepEqual(page.ctx.S.account.ways.map((way) => way.kind).sort(), ["google", "passkey"]);
    await until(() => page.button(WORDS.wayAddApple), "Apple still offered");
    assert.equal(page.button(WORDS.wayAddGoogle), null, "an account has each provider once");
    assert.deepEqual(w.service.failures, []);
  } finally {
    idp.restore();
  }
});

test("the box on /delete-account/ offers the providers too, for an account whose only way in is one of them", async () => {
  const { idp, w, went, env } = await on();
  try {
    // An account made with Google and nothing else (as an app might make one).
    const first = browser(w, { desk: false });
    let page = await openPage(first, { env });
    await until(() => page.button(WORDS.signInGoogle), "the providers' buttons");
    await page.press(WORDS.signInGoogle);
    page = await openPage(first, { env, hash: await idp.answer(went[0], { subject: "only-google" }) });
    await page.shows(WORDS.signOut);

    // On another device, the delete page signs in with Google and deletes.
    const phone = browser(w, { desk: false });
    let box = await openPage(phone, { kind: "delete", env });
    await until(() => box.button(WORDS.signInGoogle), "the providers' buttons on the delete page");
    await box.press(WORDS.signInGoogle);
    assert.equal(new URL(went[1]).searchParams.get("redirect_uri"), "https://litbible.net/delete-account/");
    box = await openPage(phone, { kind: "delete", env, hash: await idp.answer(went[1], { subject: "only-google" }) });
    await box.shows(WORDS.deleteOpen);
    await box.press(WORDS.deleteOpen);
    await box.press(WORDS.deleteNow);
    await box.shows(WORDS.deletedNow);
    assert.deepEqual(w.service.failures, []);
  } finally {
    idp.restore();
  }
});
