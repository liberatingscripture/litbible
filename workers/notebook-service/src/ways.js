// Ways to sign in: several ways in to one account
// (STUDY-DESK-ENCRYPTION.md, "The service's interface": "Ways to sign in").
//
// THE RULE EVERY REQUEST HERE KEEPS: once an account has a notebook, adding
// or removing a way in needs an OPEN session, one that has proved the
// notebook's key. A sign-in alone is not enough, so someone who steals a
// reader's Apple or Google sign-in can't add a way in of their own and stay,
// or take the reader's away. Before there is a notebook there is nothing to
// protect, and a signed-in session may.
//
// Every change to an account's ways in moves the lists' version, in the same
// batch, guarded on what was read (src/db.js). That is what keeps the
// requests that read an account's passkeys (setting up, adding a holder,
// changing the key) from acting on a passkey that was removed under them, and
// what keeps two removals at once from taking the last way in.

import { answer, notAllowed, now, readJson, refuse } from "./http.js";
import { LIMITS, toBase64url } from "./check.js";
import { commit, guard, transact } from "./db.js";
import { authenticate, needOpen } from "./session.js";
import { moveLists } from "./lists.js";
import { ProviderDown } from "./jwt.js";
import { appleExchange, appleOn, appleRevoke } from "./providers.js";
import { creationOptions, needRegistration, passkeyConfig, rpIdFor } from "./passkey-form.js";
import {
  identified,
  insertPasskey,
  issueChallenge,
  keepAppleToken,
  needProviderSignIn,
  providerCheck,
  registered,
  wayOut,
} from "./signin.js";

/** Open, once the account has a notebook; signed in, before it has one. */
const needKeyOnceThereIsOne = (auth) => (auth.kid > 0 ? needOpen(auth) : auth);

const session = async (request, env) => needKeyOnceThereIsOne(await authenticate(request, env));

/** Refuses another way in once the account has as many as it may. */
async function needRoomForWay(env, account) {
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM ways WHERE account = ?").bind(account).first();
  if (n >= LIMITS.ways) refuse(429, "too_many", { what: "ways", limit: LIMITS.ways });
}

/** The account's user handle, made the first time a passkey ceremony asks for it. */
async function handleOf(env, account) {
  await env.DB.prepare("UPDATE accounts SET handle = ? WHERE id = ? AND handle IS NULL")
    .bind(toBase64url(crypto.getRandomValues(new Uint8Array(32))), account)
    .run();
  return (await env.DB.prepare("SELECT handle FROM accounts WHERE id = ?").bind(account).first()).handle;
}

/**
 * POST /ways/passkey/options: what to ask in order to make a passkey for this
 * account. Its challenge is good for this account alone. The account's
 * passkeys are named in `excludeCredentials`, so a provider that already
 * holds one says so instead of replacing it.
 */
export async function postWayPasskeyOptions({ request, env }) {
  const auth = await session(request, env);
  const handle = await handleOf(env, auth.account);
  const { results } = await env.DB.prepare(
    "SELECT subject FROM ways WHERE account = ? AND kind = 'passkey' AND public IS NOT NULL ORDER BY created, id",
  )
    .bind(auth.account)
    .all();
  const { challenge, expires } = await issueChallenge(env, "passkey_add", { account: auth.account });
  const publicKey = creationOptions({
    rpId: rpIdFor(passkeyConfig(env), request),
    challenge,
    handle,
    exclude: results.map((way) => way.subject),
  });
  return answer({ publicKey, expires });
}

/**
 * POST /ways/passkey: { credential }, a new passkey's answer. Checked as a
 * sign-in's is, against a challenge made for this account; then that no
 * account has the passkey already, and that there is room.
 */
export async function postWayPasskey({ request, env }) {
  let auth = await session(request, env);
  const given = await needRegistration((await readJson(request)).credential);
  const { challenge, passkey } = await registered(env, given, "passkey_add");
  // A challenge made for another account is no challenge here. It is spent all the same.
  if (challenge.account !== auth.account) refuse(410, "gone", { what: "challenge" });

  return transact(async (again) => {
    if (again) auth = await session(request, env);
    const taken = await env.DB.prepare(
      "SELECT 1 FROM ways WHERE kind = 'passkey' AND subject = ? AND (public IS NOT NULL OR account = ?)",
    )
      .bind(given.id, auth.account)
      .first();
    if (taken) refuse(409, "exists", { what: "passkey" });
    await needRoomForWay(env, auth.account);
    const way = { id: crypto.randomUUID(), account: auth.account, kind: "passkey", subject: given.id, syncs: passkey.syncs ? 1 : 0, created: now() };
    await commit(env.DB, [
      guard(env.DB, auth.account, { kid: auth.kid, lists: auth.lists }),
      insertPasskey(env.DB, { id: way.id, account: way.account, credential: given.id, passkey, time: way.created }),
      moveLists(env.DB, auth.account),
    ]);
    return answer({ way: wayOut(way), lists: auth.lists + 1 });
  });
}

/**
 * POST /ways/apple and POST /ways/google: { challenge, idToken }, and for
 * Apple { code, redirect? }. The token is checked as a sign-in's is; then
 * that the provider account isn't a way in to any account already, and that
 * there is room.
 */
function addProvider(provider) {
  return async ({ request, env }) => {
    let auth = await session(request, env);
    const input = needProviderSignIn(await readJson(request), provider);
    const { subject, client } = await identified(env, provider, input);
    const taken = () => env.DB.prepare("SELECT 1 FROM ways WHERE kind = ? AND subject = ?").bind(provider, subject).first();
    // Before Apple is asked for anything: a code is spent only on a way in that can be added.
    if (await taken()) refuse(409, "exists", { what: "way" });
    await needRoomForWay(env, auth.account);
    const refresh =
      provider === "apple"
        ? await providerCheck(provider, () => appleExchange(env, { client, code: input.code, redirect: input.redirect }))
        : null;

    return transact(async (again) => {
      if (again) {
        auth = await session(request, env);
        if (await taken()) refuse(409, "exists", { what: "way" });
        await needRoomForWay(env, auth.account);
      }
      const way = { id: crypto.randomUUID(), account: auth.account, kind: provider, created: now() };
      await commit(env.DB, [
        guard(env.DB, auth.account, { kid: auth.kid, lists: auth.lists }),
        env.DB.prepare("INSERT INTO ways (id, account, kind, subject, created) VALUES (?, ?, ?, ?, ?)").bind(
          way.id,
          way.account,
          provider,
          subject,
          way.created,
        ),
        ...(refresh ? [keepAppleToken(env.DB, { way: way.id, client, token: refresh, time: way.created })] : []),
        moveLists(env.DB, auth.account),
      ]);
      return answer({ way: wayOut(way), lists: auth.lists + 1 });
    });
  };
}

export const postWayApple = addProvider("apple");
export const postWayGoogle = addProvider("google");

/** A way that can sign a reader in. A passkey the preview listed with no ceremony has no key and can't. */
const signsIn = (way) => way.kind !== "passkey" || way.public !== null;

/**
 * DELETE /ways/<id>. Checks, in order: the way is one of this account's; it
 * isn't the last that can sign the reader in; a passkey that holds the
 * notebook's key is removed as a holder first (by a change of key). An Apple
 * way's refresh tokens are revoked with Apple before it goes. Then the way is
 * removed, and so is every session that came in through it but the caller's.
 */
export async function deleteWay({ request, env, params }) {
  let auth = await session(request, env);
  let revoked = false;
  return transact(async (again) => {
    if (again) auth = await session(request, env);
    const [ways, holders, tokens] = await env.DB.batch([
      env.DB.prepare("SELECT id, kind, subject, public FROM ways WHERE account = ?").bind(auth.account),
      env.DB.prepare("SELECT credential FROM holders WHERE account = ? AND credential IS NOT NULL").bind(auth.account),
      env.DB.prepare("SELECT t.client, t.token FROM apple_tokens t JOIN ways w ON w.id = t.way WHERE w.account = ? AND t.way = ?").bind(
        auth.account,
        params.id,
      ),
    ]);
    const way = ways.results.find((w) => w.id === params.id);
    if (!way) refuse(410, "gone", { what: "way" });
    if (signsIn(way) && ways.results.filter(signsIn).length <= 1) notAllowed("last_way");
    if (way.kind === "passkey" && holders.results.some((h) => h.credential === way.subject)) notAllowed("passkey_holds_key");

    // Apple is told before the way goes, so a token is never dropped unrevoked. Done once, however
    // many times the step below is tried.
    if (way.kind === "apple" && !revoked && tokens.results.length > 0) {
      if (!appleOn(env)) refuse(502, "provider", { which: "apple" });
      try {
        for (const { client, token } of tokens.results) await appleRevoke(env, { client, token });
      } catch (error) {
        if (error instanceof ProviderDown) refuse(502, "provider", { which: "apple" });
        throw error;
      }
      revoked = true;
    }

    await commit(env.DB, [
      guard(env.DB, auth.account, { kid: auth.kid, lists: auth.lists }),
      env.DB.prepare("DELETE FROM ways WHERE account = ? AND id = ?").bind(auth.account, way.id),
      env.DB.prepare("DELETE FROM sessions WHERE account = ? AND way = ? AND token_hash <> ?").bind(auth.account, way.id, auth.tokenHash),
      moveLists(env.DB, auth.account),
    ]);
    return answer({ lists: auth.lists + 1 });
  });
}
