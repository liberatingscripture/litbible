// Sign in with Apple and Sign in with Google: checking the identity token a
// client was given, and the two calls the service makes to Apple.
//
// BOTH ARE OFF UNTIL THEY ARE CONFIGURED. A provider's requests are routed
// only when the deployment names the client ids it accepts (and, for Apple,
// holds the team's key), and no id is written in this repository: they come
// from the Apple developer account and the Google Cloud project, which are
// BDR's. Until then the paths answer "not_found" as a path never written
// does, exactly as the preview's way in does where it is off.
//
// NOT YET RUN AGAINST EITHER PROVIDER. The token check is tested with keys
// made inside the tests, and the calls to Apple against a stand-in for
// Apple's two addresses (test/providers.test.js). What a real token and a
// real answer from Apple look like is taken from each provider's
// documentation; the README lists what to check the day the ids arrive.
//
// What is kept from a token: `sub`, the provider's own id for the account,
// and nothing else. An email address or a name in a token is never read.

import { ProviderDown, TokenRefused, signEs256, verifyRs256 } from "./jwt.js";
import { LIMITS } from "./check.js";

/** A token may be this far ahead of or behind the service's clock, in seconds. */
const CLOCK_SKEW = 60;
/** How long the token Apple asks of the service is good for, in seconds. Apple allows up to six months. */
const APPLE_SECRET_SECONDS = 300;
const PROVIDER_TIMEOUT_MS = 8000;

const APPLE = "https://appleid.apple.com";

const PROVIDERS = {
  apple: {
    keys: `${APPLE}/auth/keys`,
    issuers: [APPLE],
    clients: (env) => list(env.APPLE_CLIENT_IDS),
  },
  google: {
    keys: "https://www.googleapis.com/oauth2/v3/certs",
    issuers: ["https://accounts.google.com", "accounts.google.com"],
    clients: (env) => list(env.GOOGLE_CLIENT_IDS),
  },
};

/** A comma-separated variable as its values. */
export function list(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const set = (value) => typeof value === "string" && value.trim() !== "";

/** Apple is on when the deployment has its client ids and all three parts of the team's key. */
export const appleOn = (env) =>
  list(env.APPLE_CLIENT_IDS).length > 0 && set(env.APPLE_TEAM_ID) && set(env.APPLE_KEY_ID) && set(env.APPLE_PRIVATE_KEY);

/** Google is on when the deployment has its client ids. */
export const googleOn = (env) => list(env.GOOGLE_CLIENT_IDS).length > 0;

export const providerOn = (env, provider) => (provider === "apple" ? appleOn(env) : googleOn(env));

/**
 * Checks an identity token: its signature under the provider's published
 * keys, then that it was issued by the provider, to one of this service's
 * clients, in time, and for the challenge the service gave (its `nonce`).
 * Returns the provider's id for the account and the client the token was
 * issued to. Throws TokenRefused or ProviderDown.
 */
export async function checkIdToken(env, provider, idToken, challenge) {
  const { keys, issuers, clients } = PROVIDERS[provider];
  const claims = await verifyRs256(idToken, keys, LIMITS.idTokenChars);
  const refused = (reason) => {
    throw new TokenRefused(reason);
  };
  if (!issuers.includes(claims.iss)) refused("issuer");
  // One audience, and it is one of ours. A token for several is not one a sign-in client makes.
  const aud = Array.isArray(claims.aud) && claims.aud.length === 1 ? claims.aud[0] : claims.aud;
  if (typeof aud !== "string" || !clients(env).includes(aud)) refused("audience");
  const at = Date.now() / 1000;
  if (!Number.isFinite(claims.exp) || !Number.isFinite(claims.iat)) refused("form");
  if (claims.exp + CLOCK_SKEW <= at) refused("expired");
  if (claims.iat - CLOCK_SKEW > at) refused("issued");
  if (typeof claims.nonce !== "string" || claims.nonce !== challenge) refused("nonce");
  if (typeof claims.sub !== "string" || claims.sub === "" || claims.sub.length > LIMITS.subjectChars) refused("subject");
  return { subject: claims.sub, client: aud };
}

/**
 * The token Apple asks the service to sign each time it calls: who is asking
 * (the team), for which client, and for the next few minutes
 * (Apple: "Creating a client secret").
 */
function appleClientSecret(env, client) {
  const at = Math.floor(Date.now() / 1000);
  return signEs256(
    { kid: env.APPLE_KEY_ID.trim() },
    { iss: env.APPLE_TEAM_ID.trim(), iat: at, exp: at + APPLE_SECRET_SECONDS, aud: APPLE, sub: client },
    env.APPLE_PRIVATE_KEY,
  );
}

/** One form posted to Apple. Returns { status, body } with the body parsed if it is JSON; throws ProviderDown if Apple can't be reached. */
async function appleCall(env, path, client, fields) {
  const form = new URLSearchParams({ client_id: client, client_secret: await appleClientSecret(env, client), ...fields });
  let res;
  let body = null;
  try {
    res = await fetch(`${APPLE}${path}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: form.toString(),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
    const text = await res.text();
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
  } catch {
    throw new ProviderDown();
  }
  return { status: res.status, body };
}

/**
 * Trades the authorization code a client got with its identity token for
 * Apple's refresh token (Apple: "Generate and validate tokens"). The service
 * keeps that token for one purpose: to revoke it when the way in is removed
 * or the account is deleted. `redirect` is passed on only when the client's
 * own flow used one (a web page's), since Apple then asks for the same one.
 *
 * A code Apple won't take is the client's fault and refuses the token
 * ("code"). Anything else is the service's or Apple's, and is ProviderDown.
 */
export async function appleExchange(env, { client, code, redirect }) {
  const { status, body } = await appleCall(env, "/auth/token", client, {
    code,
    grant_type: "authorization_code",
    ...(redirect ? { redirect_uri: redirect } : {}),
  });
  if (status === 200 && body && typeof body.refresh_token === "string" && body.refresh_token !== "") return body.refresh_token;
  if (status === 400 && body && body.error === "invalid_grant") throw new TokenRefused("code");
  throw new ProviderDown();
}

/** Revokes a refresh token (Apple: "Revoke tokens"). Throws ProviderDown unless Apple says it is done. */
export async function appleRevoke(env, { client, token }) {
  const { status } = await appleCall(env, "/auth/revoke", client, { token, token_type_hint: "refresh_token" });
  if (status !== 200) throw new ProviderDown();
}
