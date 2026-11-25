// src/lib/desk-account-session.mjs
//
// What an account page does that needs no key: signing in, reading the
// account, its ways in, a request that is waiting its seven days, deleting
// the account, and ending a session. STUDY-DESK-ENCRYPTION.md, "The
// service's interface," is the contract; each function here is one of its
// requests, or one ceremony made of them.
//
// It imports the passkey forms and nothing else: no encryption code, so a
// page that holds no notebook (the account's basics on a phone, and
// /delete-account/) can load it alone. Everything that touches the
// notebook's key is desk-account.mjs.
//
// `call(method, path, body)` is the service, as sync/service.js makes it: it
// resolves to { status, body } for any answer and throws when there is no
// answer. A sign-in's `call` carries no session.

import { makePasskey, usePasskey } from "./desk-passkey.mjs";

/** The word a device calls itself in an approval, a card, and a request that waits. */
export const PLATFORM = "web";

/**
 * The service refused. `word` is its one word (`sign_in`, `not_open`,
 * `gone`, …); `detail` is the rest of what it said (`what`, `rule`,
 * `reason`, `kid`, `lists`, `left`, `retry`).
 */
export class AccountRefusal extends Error {
  constructor(status, body, what) {
    const word = typeof body?.error === "string" ? body.error : "error";
    super(`${what}: ${status} ${word}`);
    this.name = "AccountRefusal";
    this.status = status;
    this.word = word;
    this.detail = body && typeof body === "object" ? body : {};
  }

  /** True for this word, and for this `what`, `rule`, or `reason` when one is given. */
  is(word, about) {
    if (this.word !== word) return false;
    if (about === undefined) return true;
    return this.detail.what === about || this.detail.rule === about || this.detail.reason === about;
  }
}

/** Sends a request and returns the body of a 200, or throws AccountRefusal. */
export async function must(call, method, path, body, what = `${method} ${path}`) {
  const res = await call(method, path, body);
  if (res.status !== 200) throw new AccountRefusal(res.status, res.body, what);
  return res.body ?? {};
}

/* ── Signing in ─────────────────────────────────────────────────────────── */

/**
 * What the service offers here: { ways, turnstile }. `ways` is which ways
 * to sign in are on, in the order to show them; `turnstile` is the site key
 * of the check a new account passes first, or null where there is none.
 */
export async function signInWays(call) {
  const body = await must(call, "GET", "/sign-in");
  return {
    ways: Array.isArray(body.ways) ? body.ways : [],
    turnstile: typeof body.turnstile === "string" && body.turnstile ? body.turnstile : null,
  };
}

/**
 * Signs in with a passkey the reader has. Returns
 *   { token, expires, created, way, passkey: { id, prf, rpId } }
 * where `passkey.id` is the credential that answered and `passkey.prf` its
 * PRF output (bytes, or null: not asked for, or not given), which the
 * caller uses to open a holder and then drops. `rpId` is the relying party
 * the service named, for a later prompt of the page's own (`prfOnly`).
 *
 * A passkey the service doesn't know throws AccountRefusal
 * `passkey_refused` with reason `unknown`: the page offers to make an
 * account. A closed prompt throws PasskeyStopped.
 */
export async function signInWithPasskey({ call, credentials, prfInput, signal }) {
  const { publicKey } = await must(call, "POST", "/sign-in/passkey/options");
  const used = await usePasskey({ credentials, publicKey, prfInput, signal });
  const session = await must(call, "POST", "/sign-in/passkey", { credential: used.credential }, "sign in with a passkey");
  return { ...session, passkey: { id: used.id, prf: used.prf.output, rpId: publicKey.rpId } };
}

/**
 * Makes an account with a new passkey. `turnstile` is the check's token,
 * where the service asks for one. Returns
 *   { token, expires, created: true, way, passkey: { id, prfEnabled, prf, rpId } }
 * `way.syncs` says whether the passkey is the kind that syncs, which with
 * `prfEnabled` is what lets it hold the notebook's key.
 */
export async function signUpWithPasskey({ call, credentials, prfInput, turnstile, signal }) {
  const { publicKey } = await must(call, "POST", "/sign-in/new-passkey/options", turnstile ? { turnstile } : undefined);
  const made = await makePasskey({ credentials, publicKey, prfInput, signal });
  const session = await must(call, "POST", "/sign-in/new-passkey", { credential: made.credential }, "make an account");
  return { ...session, passkey: { id: made.id, prfEnabled: made.prf.enabled, prf: made.prf.output, rpId: publicKey.rp.id } };
}

/**
 * A challenge for Apple or Google to carry back as the token's nonce. The
 * page keeps it until the provider sends the reader back.
 */
export const signInChallenge = (call) => must(call, "POST", "/sign-in/challenge");

/**
 * Finishes a sign-in with Apple or Google. `provider` is "apple" or
 * "google"; `redirect` is the address the page's own flow used (Apple asks
 * for the same one back). Returns { token, expires, created, way }.
 */
export function signInWithProvider({ call, provider, challenge, idToken, code, redirect }) {
  const body = { challenge, idToken };
  if (provider === "apple") {
    body.code = code;
    if (redirect) body.redirect = redirect;
  }
  return must(call, "POST", `/sign-in/${provider}`, body, `sign in with ${provider}`);
}

/* ── The account ────────────────────────────────────────────────────────── */

/** `GET /account`, as the service answers it. */
export const readAccount = (call) => must(call, "GET", "/account");

/** Ends this session and no other: a device that signed in and never joined. */
export const endSession = (call) => must(call, "DELETE", "/session");

/* ── Ways to sign in ────────────────────────────────────────────────────── */

/**
 * Adds a passkey as a way to sign in. Once the account has a notebook the
 * session must be open. Returns { way, lists, passkey: { id, prfEnabled, prf, rpId } }.
 * A password manager that already has the account's passkey throws
 * PasskeyStopped "exists".
 */
export async function addPasskeyWay({ call, credentials, prfInput, signal }) {
  const { publicKey } = await must(call, "POST", "/ways/passkey/options");
  const made = await makePasskey({ credentials, publicKey, prfInput, signal });
  const answer = await must(call, "POST", "/ways/passkey", { credential: made.credential }, "add a passkey");
  return { ...answer, passkey: { id: made.id, prfEnabled: made.prf.enabled, prf: made.prf.output, rpId: publicKey.rp.id } };
}

/** Adds an Apple or a Google account as a way to sign in. Returns { way, lists }. */
export function addProviderWay({ call, provider, challenge, idToken, code, redirect }) {
  const body = { challenge, idToken };
  if (provider === "apple") {
    body.code = code;
    if (redirect) body.redirect = redirect;
  }
  return must(call, "POST", `/ways/${provider}`, body, `add ${provider}`);
}

/**
 * Removes a way to sign in. The service refuses the last one (rule
 * `last_way`) and a passkey that still holds the key (`passkey_holds_key`:
 * remove it as a holder first, which is a change of key).
 */
export const removeWay = (call, id) => must(call, "DELETE", `/ways/${encodeURIComponent(id)}`, undefined, "remove a way in");

/* ── Deleting, and the seven days ───────────────────────────────────────── */

/**
 * Whether deleting the account from this session happens at once: only for
 * a session that has proved the key, or on an account with no notebook.
 * Otherwise the request waits seven days.
 */
export const deletesAtOnce = (account) => !account.notebook || account.session?.open === true;

/**
 * Deletes the account, or asks to. Returns { deleted: true }, or
 * { deleted: false, waiting } when the request has to wait. A request
 * already waiting throws AccountRefusal `exists` (what: "waiting").
 *
 * The platform always travels, as the spec asks of a device that isn't
 * open; the service reads it only when the request waits.
 */
export const deleteAccount = (call) => must(call, "DELETE", `/account?platform=${PLATFORM}`, undefined, "delete the account");

/**
 * Asks to replace the notebook, for a reader who has lost every way to open
 * it. It waits seven days. Returns { waiting }.
 */
export const askToReplace = (call) => must(call, "POST", "/notebook/replace", { platform: PLATFORM }, "replace the notebook");

/** Cancels the request that is waiting: for a session with the key, and for the one that asked. */
export const cancelWaiting = (call) => must(call, "DELETE", "/waiting", undefined, "cancel the request");
