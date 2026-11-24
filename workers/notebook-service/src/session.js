// Sessions: who is asking, and whether they have proved the notebook's key.
//
// The interface knows three kinds of session ("Three kinds of session"):
//
//   signed in  the service knows which account the session belongs to;
//   open       signed in, attached to an entry in the device list, and proved
//              for the account's current kid;
//   neither    gets nothing.
//
// "Open" is never stored. It is worked out on every request from three facts:
// the session's device still has an entry, the kid the session proved, and
// the account's kid now. So a change of key closes every other session by
// moving one number, and removing a device closes its sessions by deleting
// its entry.
//
// HOW A SESSION BEGINS is not this file's business. Step 4c has one way in,
// for the preview only (src/preview.js). Step 4e adds the real ones (Apple,
// Google, passkeys); each ends by calling createSession() and changes nothing
// here or in any request that reads a session.
//
// A session token is 32 random bytes, sent as `Authorization: Bearer <token>`.
// It is made from no key and stands in for none, and only its SHA-256 is
// stored, so a copy of the database holds no usable session.

import { after, now, readJson, refuse } from "./http.js";
import { fromBase64url, toBase64url } from "./check.js";
import { transact } from "./db.js";

export const SESSION_DAYS = 30;
/** A session that sends this many wrong key proofs is ended. */
export const MAX_WRONG_PROOFS = 5;
/** A device's "last seen" is written at most this often. */
const SEEN_EVERY_MS = 60 * 60 * 1000;

const BEARER = /^Bearer ([A-Za-z0-9_-]{43})$/;

const sha256 = async (bytes) => new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));

/** SHA-256 of a text's UTF-8 bytes. */
export const digestText = (text) => sha256(new TextEncoder().encode(text));

/** base64url(SHA-256(text)): how a session token is kept. */
export const hashText = async (text) => toBase64url(await digestText(text));

/** Compares two SHA-256 digests without leaking where they differ. */
export const sameDigest = (a, b) => a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b);

/** Starts a session for an account. Returns the token, which is shown this once. */
export async function createSession(env, { account, way }) {
  const token = toBase64url(crypto.getRandomValues(new Uint8Array(32)));
  const created = now();
  const expires = after(created, SESSION_DAYS * 24 * 60 * 60 * 1000);
  await env.DB.prepare("INSERT INTO sessions (token_hash, account, way, created, expires) VALUES (?, ?, ?, ?, ?)")
    .bind(await hashText(token), account, way, created, expires)
    .run();
  return { token, expires };
}

/**
 * The session a request carries, with its account as it stands now. Refuses
 * with "sign_in" when there is none. Nothing in a request's body or address
 * is ever taken as proof of who is asking.
 */
export async function authenticate(request, env) {
  const match = BEARER.exec(request.headers.get("authorization") ?? "");
  if (!match) refuse(401, "sign_in");
  const tokenHash = await hashText(match[1]);
  const row = await env.DB.prepare(
    `SELECT s.account, s.way, s.device, s.open_kid, s.expires,
            a.notebook, a.kid, a.proof_hash, a.lists, a.rev,
            d.id AS entry, d.seen
       FROM sessions s
       JOIN accounts a ON a.id = s.account
       LEFT JOIN devices d ON d.account = s.account AND d.id = s.device
      WHERE s.token_hash = ?`,
  )
    .bind(tokenHash)
    .first();
  const time = now();
  if (!row || row.expires <= time) refuse(401, "sign_in");

  const attached = row.entry !== null;
  const open = row.kid > 0 && attached && row.open_kid === row.kid;
  if (open && Date.parse(time) - Date.parse(row.seen) > SEEN_EVERY_MS) {
    await env.DB.prepare("UPDATE devices SET seen = ? WHERE account = ? AND id = ?")
      .bind(time, row.account, row.device)
      .run();
  }
  return {
    tokenHash,
    account: row.account,
    way: row.way,
    expires: row.expires,
    /** The device this session is attached to, or null. Null too once that device's entry is gone. */
    device: attached ? row.device : null,
    /** The device id the session last attached to, whether or not its entry still stands. */
    sessionDevice: row.device,
    open,
    notebook: row.notebook,
    kid: row.kid,
    proofHash: row.proof_hash,
    lists: row.lists,
    rev: row.rev,
  };
}

/** Refuses a session that is signed in and no more. */
export function needOpen(auth) {
  if (!auth.open) refuse(403, "not_open", { kid: auth.kid });
  return auth;
}

/** Refuses an account that has no notebook yet. */
export function needNotebook(auth) {
  if (auth.kid === 0) refuse(409, "no_notebook");
  return auth;
}

/** Refuses a `kid` that isn't the account's current one. */
export function needCurrentKid(auth, kid) {
  if (kid !== auth.kid) refuse(409, "old_key", { kid: auth.kid });
}

/** Refuses a `lists` version that isn't the account's current one. */
export function needCurrentLists(auth, lists) {
  if (lists !== auth.lists) refuse(409, "lists_changed", { lists: auth.lists });
}

/**
 * The key proof: its SHA-256 must be the hash stored for the current kid,
 * compared in constant time. A wrong proof is counted against the session
 * that sent it, and the fifth ends that session. It is counted by session and
 * not by account on purpose: someone with a stolen sign-in could otherwise
 * lock the reader's own devices out by guessing, and guessing 32 bytes is out
 * of reach at any rate.
 *
 * `proof` has already been checked to be 32 bytes of base64url.
 */
export async function needProof(env, auth, proof) {
  const given = await sha256(fromBase64url(proof));
  if (sameDigest(given, fromBase64url(auth.proofHash))) return;
  const counted = await env.DB.prepare(
    "UPDATE sessions SET proof_failures = proof_failures + 1 WHERE token_hash = ? RETURNING proof_failures",
  )
    .bind(auth.tokenHash)
    .first();
  const failures = counted?.proof_failures ?? MAX_WRONG_PROOFS;
  if (failures >= MAX_WRONG_PROOFS) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(auth.tokenHash).run();
    refuse(401, "sign_in", { reason: "wrong_proofs" });
  }
  refuse(403, "wrong_proof", { left: MAX_WRONG_PROOFS - failures });
}

/** The statement that opens a session for `kid`, attached to `device`. Goes in the same batch as what earned it. */
export function openSession(env, auth, device, kid) {
  return env.DB.prepare("UPDATE sessions SET device = ?, open_kid = ?, proof_failures = 0 WHERE token_hash = ?").bind(
    device,
    kid,
    auth.tokenHash,
  );
}

/**
 * A request that changes something: the session, then the body (read once and
 * checked by `parse`, before anything is read from the database on its
 * account), then `step(auth, input)`, run again from a fresh read of the
 * session if the account moved under its batch (src/db.js).
 */
export async function changing(request, env, parse, step) {
  let auth = await authenticate(request, env);
  const input = parse ? parse(await readJson(request)) : undefined;
  return transact(async (again) => {
    if (again) auth = await authenticate(request, env);
    return step(auth, input);
  });
}
