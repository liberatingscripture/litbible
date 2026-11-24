// Sign-in (STUDY-DESK-ENCRYPTION.md, "The service's interface": "Signing in").
//
// Signing in tells the service which account a device belongs to, and no
// more. It opens nothing: the session these requests hand back is "signed
// in," and becomes "open" only by the key proof (src/session.js). So nothing
// here touches a key, a keyring, or a row.
//
// Three ways in, each off unless the deployment configures it:
//
//   a passkey   WebAuthn, with litbible.net as the relying party
//               (src/webauthn.js, src/passkey-form.js)
//   Apple       an identity token and an authorization code (src/providers.js)
//   Google      an identity token (src/providers.js)
//
// EVERY SIGN-IN ANSWERS A CHALLENGE THE SERVICE MADE: 32 random bytes, good
// once and for five minutes. A passkey signs it. Apple and Google carry it
// back as the token's `nonce`. A response or a token made for another
// challenge, or used a second time, is refused, so nothing captured can be
// played again.
//
// A provider's own id for the account (`sub`) is all that is kept from a
// token, and a passkey's public key, id, and flags from a registration. No
// name and no email address is read, stored, or logged.

import { after, answer, bad, now, readJson, refuse } from "./http.js";
import { LIMITS, fromBase64url, needBytes, toBase64url } from "./check.js";
import { raced } from "./db.js";
import { createSession } from "./session.js";
import { ProviderDown, TokenRefused } from "./jwt.js";
import { appleExchange, appleOn, appleRevoke, checkIdToken, googleOn } from "./providers.js";
import { checkAssertion, checkRegistration } from "./webauthn.js";
import {
  CHALLENGE_MS,
  creationOptions,
  needAssertion,
  needRegistration,
  passkeyCheck,
  passkeyConfig,
  passkeysOn,
  refusePasskey,
  requestOptions,
  rpIdFor,
} from "./passkey-form.js";

/** Which ways to sign in this deployment offers, in the order a client might show them. */
export function signInWays(env) {
  return [...(passkeysOn(env) ? ["passkey"] : []), ...(appleOn(env) ? ["apple"] : []), ...(googleOn(env) ? ["google"] : [])];
}

/** GET /sign-in, from anyone: which ways to sign in are on here. */
export function getSignIn({ env }) {
  return answer({ ways: signInWays(env) });
}

/* ── Challenges ─────────────────────────────────────────────────────────── */

/** Makes a challenge for one purpose. Challenges that ran out are swept here, where the next one is made. */
export async function issueChallenge(env, purpose, { account = null, handle = null } = {}) {
  const challenge = toBase64url(crypto.getRandomValues(new Uint8Array(LIMITS.challengeBytes)));
  const time = now();
  const expires = after(time, CHALLENGE_MS);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM challenges WHERE expires <= ?").bind(time),
    env.DB.prepare("INSERT INTO challenges (id, purpose, account, handle, expires) VALUES (?, ?, ?, ?, ?)").bind(
      challenge,
      purpose,
      account,
      handle,
      expires,
    ),
  ]);
  return { challenge, expires };
}

/**
 * Uses a challenge up: it is deleted as it is read, so of two requests that
 * answer one challenge only the first finds it. One that ran out, was used,
 * was made for another purpose, or never was is "gone," and whatever purpose
 * it had, it is spent.
 */
export async function useChallenge(env, challenge, purpose) {
  const row = await env.DB.prepare("DELETE FROM challenges WHERE id = ? RETURNING purpose, account, handle, expires")
    .bind(challenge)
    .first();
  if (!row || row.expires <= now() || row.purpose !== purpose) refuse(410, "gone", { what: "challenge" });
  return row;
}

/** POST /sign-in/challenge, from anyone: a challenge for Apple or Google to carry back as the token's nonce. */
export async function postChallenge({ env }) {
  return answer(await issueChallenge(env, "provider"));
}

/* ── What a sign-in answers ─────────────────────────────────────────────── */

/** A way in as an answer carries it, the same as in `GET /account`. A provider's own account id is never sent back. */
export const wayOut = (way) => ({
  id: way.id,
  kind: way.kind,
  added: way.created,
  ...(way.kind === "passkey" ? { credential: way.subject, syncs: way.syncs === 1 } : {}),
});

async function signedIn(env, way, created) {
  const { token, expires } = await createSession(env, { account: way.account, way: way.id });
  return answer({ token, expires, created, way: wayOut(way) });
}

/* ── A passkey ──────────────────────────────────────────────────────────── */

/** The RP ID a passkey answering from `origin` must be for, or a refusal. */
export function needOrigin(env, origin) {
  return passkeyConfig(env).rps.get(origin) ?? refusePasskey("origin");
}

/** POST /sign-in/passkey/options, from anyone: what to ask a passkey in order to sign in. */
export async function postPasskeyOptions({ request, env }) {
  const { challenge, expires } = await issueChallenge(env, "passkey_sign_in");
  return answer({ publicKey: requestOptions({ rpId: rpIdFor(passkeyConfig(env), request), challenge }), expires });
}

/**
 * POST /sign-in/passkey, from anyone: { credential }, a passkey's answer.
 * Checks, in order: its form, and that it carries no PRF result; the client
 * data's type; the challenge (used up here, whatever follows); the origin;
 * that the passkey is one the service knows; the user handle, if one came;
 * the authenticator data (the RP, presence, verification, the backup flags);
 * the signature; and that the counter went forward.
 */
export async function postPasskeySignIn({ request, env }) {
  const given = await needAssertion((await readJson(request)).credential);
  await useChallenge(env, given.challenge, "passkey_sign_in");
  const rpId = needOrigin(env, given.origin);
  const way = await env.DB.prepare(
    `SELECT w.id, w.account, w.kind, w.subject, w.syncs, w.created, w.public, a.handle
       FROM ways w JOIN accounts a ON a.id = w.account
      WHERE w.kind = 'passkey' AND w.subject = ? AND w.public IS NOT NULL`,
  )
    .bind(given.id)
    .first();
  if (!way) refusePasskey("unknown");
  if (given.userHandle !== null && given.userHandle !== way.handle) refusePasskey("user");
  const { count } = await passkeyCheck(() =>
    checkAssertion({ ...given, rpId, jwk: JSON.parse(way.public), syncs: way.syncs === 1 }),
  );
  // Checked and written as one step: a counter moves only forward, and stays at 0 for a passkey that keeps none.
  const moved = await env.DB.prepare(
    "UPDATE ways SET count = ?1 WHERE id = ?2 AND ((count = 0 AND ?1 = 0) OR count < ?1) RETURNING id",
  )
    .bind(count, way.id)
    .first();
  if (!moved) {
    // Nothing was written either because the counter didn't go forward, or because the passkey was
    // removed as a way in while its answer was being checked. Say which.
    const still = await env.DB.prepare("SELECT 1 FROM ways WHERE id = ?").bind(way.id).first();
    refusePasskey(still ? "counter" : "unknown");
  }
  return signedIn(env, way, false);
}

/** POST /sign-in/new-passkey/options, from anyone: what to ask in order to make a passkey and an account with it. */
export async function postNewPasskeyOptions({ request, env }) {
  const handle = toBase64url(crypto.getRandomValues(new Uint8Array(32)));
  const { challenge, expires } = await issueChallenge(env, "passkey_new", { handle });
  return answer({ publicKey: creationOptions({ rpId: rpIdFor(passkeyConfig(env), request), challenge, handle }), expires });
}

/**
 * Checks a new passkey's answer against the challenge it must be for, and
 * returns what the service keeps of it and the challenge's own row. Shared
 * with "Ways to sign in" (src/ways.js).
 */
export async function registered(env, given, purpose) {
  const challenge = await useChallenge(env, given.challenge, purpose);
  const rpId = needOrigin(env, given.origin);
  const passkey = await passkeyCheck(() =>
    checkRegistration({ attestationObject: given.attestationObject, credentialId: fromBase64url(given.id), rpId }),
  );
  return { challenge, passkey };
}

/** The statement that stores a real passkey as a way in. */
export function insertPasskey(db, { id, account, credential, passkey, time }) {
  return db
    .prepare("INSERT INTO ways (id, account, kind, subject, syncs, created, public, count) VALUES (?, ?, 'passkey', ?, ?, ?, ?, ?)")
    .bind(id, account, credential, passkey.syncs ? 1 : 0, time, JSON.stringify(passkey.jwk), passkey.count);
}

/**
 * POST /sign-in/new-passkey, from anyone: { credential }, a new passkey's
 * answer. Checks as `POST /sign-in/passkey` does, for a registration, and
 * that no account has the passkey already. Then: a new account, with the
 * passkey as its one way in, and a session.
 */
export async function postNewPasskey({ request, env }) {
  const given = await needRegistration((await readJson(request)).credential);
  const { challenge, passkey } = await registered(env, given, "passkey_new");
  const way = { id: crypto.randomUUID(), account: crypto.randomUUID(), kind: "passkey", subject: given.id, syncs: passkey.syncs ? 1 : 0, created: now() };
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO accounts (id, created, handle) VALUES (?, ?, ?)").bind(way.account, way.created, challenge.handle),
      insertPasskey(env.DB, { id: way.id, account: way.account, credential: given.id, passkey, time: way.created }),
    ]);
  } catch (error) {
    // The passkey is already someone's way in (the index ways_passkey): nothing was made.
    if (raced(error)) refuse(409, "exists", { what: "passkey" });
    throw error;
  }
  return signedIn(env, way, true);
}

/* ── Apple and Google ───────────────────────────────────────────────────── */

/** A failed check of an identity token, or a provider that couldn't be reached, as the refusal a client is sent. */
export async function providerCheck(provider, check) {
  try {
    return await check();
  } catch (error) {
    if (error instanceof TokenRefused) return refuse(403, "token_refused", { reason: error.reason });
    if (error instanceof ProviderDown) return refuse(502, "provider", { which: provider });
    throw error;
  }
}

const PRINTABLE = /^[\x21-\x7e]+$/;

/** What a sign-in with Apple or Google sends: { challenge, idToken }, and for Apple { code, redirect? }. */
export function needProviderSignIn(body, provider) {
  const input = { challenge: needBytes(body.challenge, "challenge", LIMITS.challengeBytes) };
  if (typeof body.idToken !== "string" || body.idToken.length > LIMITS.idTokenChars || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(body.idToken)) {
    bad("idToken");
  }
  input.idToken = body.idToken;
  if (provider === "apple") {
    if (typeof body.code !== "string" || body.code.length > LIMITS.codeChars || !PRINTABLE.test(body.code)) bad("code");
    input.code = body.code;
    const none = body.redirect === undefined || body.redirect === null;
    if (!none && (typeof body.redirect !== "string" || body.redirect.length > LIMITS.redirectChars || !/^https:\/\/[\x21-\x7e]+$/.test(body.redirect))) {
      bad("redirect");
    }
    input.redirect = none ? null : body.redirect;
  }
  return input;
}

/**
 * The challenge, then the token: who the provider says this is, and through
 * which of the service's clients. The challenge is used up whatever follows.
 */
export async function identified(env, provider, input) {
  await useChallenge(env, input.challenge, "provider");
  return providerCheck(provider, () => checkIdToken(env, provider, input.idToken, input.challenge));
}

const findWay = (env, kind, subject) =>
  env.DB.prepare("SELECT id, account, kind, subject, syncs, created FROM ways WHERE kind = ? AND subject = ?").bind(kind, subject).first();

/** Whether the service already holds Apple's refresh token for this way in and this client. */
export async function hasAppleToken(env, way, client) {
  return (await env.DB.prepare("SELECT 1 FROM apple_tokens WHERE way = ? AND client = ?").bind(way, client).first()) !== null;
}

/**
 * The statement that keeps Apple's refresh token for a way in. It writes
 * nothing if that way in is gone, so it never fails on a way removed a moment
 * before; the caller reads `meta.changes` where that can happen.
 */
export const keepAppleToken = (db, { way, client, token, time }) =>
  db
    .prepare(
      `INSERT OR REPLACE INTO apple_tokens (way, client, token, created)
       SELECT ?1, ?2, ?3, ?4 WHERE EXISTS (SELECT 1 FROM ways WHERE id = ?1)`,
    )
    .bind(way, client, token, time);

/**
 * POST /sign-in/apple and POST /sign-in/google, from anyone.
 * Checks, in order: the form; the challenge (used up here); the identity
 * token (its signature, issuer, audience, times, nonce, and subject). Then
 * the account that provider account signs in to, or a new one if there is
 * none, and a session.
 *
 * For Apple, the first sign-in through each client also trades the code for
 * Apple's refresh token, before anything is written: an account is never made
 * with an Apple way in that the service couldn't later revoke.
 */
function providerSignIn(provider) {
  return async ({ request, env }) => {
    const input = needProviderSignIn(await readJson(request), provider);
    const { subject, client } = await identified(env, provider, input);

    let way = await findWay(env, provider, subject);
    let refresh = null;
    if (provider === "apple" && !(way && (await hasAppleToken(env, way.id, client)))) {
      refresh = await providerCheck(provider, () => appleExchange(env, { client, code: input.code, redirect: input.redirect }));
    }
    let created = false;
    if (!way) {
      const time = now();
      const account = crypto.randomUUID();
      const handle = toBase64url(crypto.getRandomValues(new Uint8Array(32)));
      try {
        await env.DB.batch([
          env.DB.prepare("INSERT INTO accounts (id, created, handle) VALUES (?, ?, ?)").bind(account, time, handle),
          env.DB.prepare("INSERT INTO ways (id, account, kind, subject, created) VALUES (?, ?, ?, ?, ?)").bind(
            crypto.randomUUID(),
            account,
            provider,
            subject,
            time,
          ),
        ]);
        created = true;
      } catch (error) {
        // Two first sign-ins at once (the index ways_sign_in): the second finds the first's account.
        if (!raced(error)) throw error;
      }
      way = await findWay(env, provider, subject);
      if (!way) refuse(503, "busy");
    }
    if (refresh) {
      const kept = await keepAppleToken(env.DB, { way: way.id, client, token: refresh, time: now() }).run();
      if (kept.meta.changes !== 1) {
        // The way in was removed while Apple was being asked. The token just obtained has nowhere
        // to be kept, so it is handed back to Apple (as well as can be), and the client tries again.
        await appleRevoke(env, { client, token: refresh }).catch(() => {});
        refuse(503, "busy");
      }
    }
    return signedIn(env, way, created);
  };
}

export const postAppleSignIn = providerSignIn("apple");
export const postGoogleSignIn = providerSignIn("google");
