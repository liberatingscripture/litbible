// The preview's way in. NOT part of the interface, and never in production.
//
// Real sign-in (Apple, Google, passkeys) is step 4e. Until it exists, the
// apps' sessions and the website's connector need a session to build
// against, so the preview service hands one out for a named test account to
// whoever holds the preview's secret.
//
// It can't be reached in production, three times over:
//
//   1. The requests are routed only when the environment's own configuration
//      says PREVIEW_SIGN_IN = "on". Only `env.preview` in wrangler.jsonc sets
//      it; the top level, which is production's, has no such variable.
//   2. They are routed only in an environment that names itself "preview":
//      an allow-list, so production is safe whether or not anyone remembers
//      to name it, and so is any environment added later.
//   3. They need PREVIEW_SECRET, a Wrangler secret that production is never
//      given, and refuse to work with one too short to be a real secret.
//
// When any of the three fails, the paths answer "not_found" exactly as a
// path that was never written does (test/preview.test.js holds it to that).
//
// Everything on the preview is test data and may be wiped at any time.

import { answer, bad, now, readJson, refuse } from "./http.js";
import { LIMITS, base64urlBytes } from "./check.js";
import { raced } from "./db.js";
import { authenticate, createSession, digestText, needOpen, sameDigest } from "./session.js";

const MIN_SECRET_CHARS = 32;
/** A test account's name: a made-up label, never a person's name or address. */
const ACCOUNT_NAME = /^[A-Za-z0-9._-]{1,64}$/;

/** Whether this deployment routes the preview's requests at all. */
export function previewOn(env) {
  return (
    env.PREVIEW_SIGN_IN === "on" &&
    env.ENVIRONMENT === "preview" &&
    typeof env.PREVIEW_SECRET === "string" &&
    env.PREVIEW_SECRET.length >= MIN_SECRET_CHARS
  );
}

/**
 * POST /preview/session with { secret, account }: a session for the test
 * account of that name, which is made if it doesn't exist. The same name
 * always gives the same account, so several devices can share one.
 */
export async function previewSession({ request, env }) {
  const body = await readJson(request);
  const given = typeof body.secret === "string" ? body.secret : "";
  // Compared as digests, in constant time: neither the length nor the place of a difference leaks.
  if (!sameDigest(await digestText(given), await digestText(env.PREVIEW_SECRET))) refuse(401, "preview_secret");
  if (typeof body.account !== "string" || !ACCOUNT_NAME.test(body.account)) bad("account");

  const find = () =>
    env.DB.prepare("SELECT id, account FROM ways WHERE kind = 'preview' AND subject = ?").bind(body.account).first();
  let way = await find();
  if (!way) {
    const time = now();
    const account = crypto.randomUUID();
    try {
      await env.DB.batch([
        env.DB.prepare("INSERT INTO accounts (id, created) VALUES (?, ?)").bind(account, time),
        env.DB.prepare("INSERT INTO ways (id, account, kind, subject, created) VALUES (?, ?, 'preview', ?, ?)").bind(
          crypto.randomUUID(),
          account,
          body.account,
          time,
        ),
      ]);
    } catch (error) {
      // Two sessions asking for a new name at once: the second finds the first's account.
      if (!raced(error)) throw error;
    }
    way = await find();
  }
  const { token, expires } = await createSession(env, { account: way.account, way: way.id });
  return answer({ token, expires });
}

/**
 * POST /preview/passkeys with { credential, syncs }: lists a passkey as one of
 * the account's ways in, with no ceremony, so a client can exercise the
 * passkey holder's checks before step 4e can register a real one. It follows
 * the rule the real request will: once the account has a notebook, adding a
 * way in needs an open session.
 */
export async function previewPasskey({ request, env }) {
  const auth = await authenticate(request, env);
  const body = await readJson(request);
  const bytes = base64urlBytes(body.credential);
  if (bytes < 1 || bytes > LIMITS.credentialBytes) bad("credential");
  if (typeof body.syncs !== "boolean") bad("syncs");
  if (auth.kid > 0) needOpen(auth);
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare("INSERT INTO ways (id, account, kind, subject, syncs, created) VALUES (?, ?, 'passkey', ?, ?, ?)")
      .bind(id, auth.account, body.credential, body.syncs ? 1 : 0, now())
      .run();
  } catch (error) {
    if (raced(error)) refuse(409, "exists", { what: "passkey" });
    throw error;
  }
  return answer({ id, credential: body.credential, syncs: body.syncs });
}
