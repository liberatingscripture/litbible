// src/lib/desk-account-providers.mjs
//
// The website's half of Sign in with Apple and with Google (the plan's step
// 4h): pure, and it imports nothing. The service's half is built and off
// (STUDY-DESK-ENCRYPTION.md, "Signing in"), and so is this one.
//
// BOTH ARE OFF. A provider is offered only when the service lists it
// (`GET /sign-in`) AND the website has a client id for it below. Neither id
// exists yet: they come from BDR's Apple developer account and Google Cloud
// project, none is configured, and none is guessed. So no reader sees a
// button, the page asks the service nothing more than before, and NEITHER
// PROVIDER HAS EVER BEEN TRIED from this page. It is tested against
// stand-ins (test/desk-account-providers.test.js); the two addresses below
// and the shape of what comes back are from each provider's documentation.
//
// THE FLOW, with no script of the provider's and no new origin in the CSP.
// The page asks the service for a challenge, keeps it with a random `state`,
// and sends the reader to the provider's own sign-in page, a navigation. The
// provider sends them back to the same page with an identity token after the
// `#`, which no server sees. The page takes it out of the address at once,
// checks `state` against what it kept, and hands the token and the challenge
// to the service, which checks the token (its signature, issuer, audience,
// times, and that its `nonce` is the challenge).
//
// The page asks for no scope beyond `openid`, so no name and no email
// address is requested ("we don't ask for your name or email address").
// Apple allows an answer after the `#` only when no scope is asked for.

/**
 * The website's client id at each provider: Apple's Services ID, and
 * Google's OAuth client id of type "Web application". Null means off.
 * The same ids must be among the service's APPLE_CLIENT_IDS and
 * GOOGLE_CLIENT_IDS, and each provider must have every address in
 * `RETURN_PATHS` registered as a redirect.
 */
export const PROVIDER_CLIENTS = Object.freeze({ apple: null, google: null });

/** The providers, in the order they are shown. */
export const PROVIDERS = Object.freeze(["apple", "google"]);

/** The pages a provider may send a reader back to. Each is registered with the provider as `https://litbible.net<path>`. */
export const RETURN_PATHS = Object.freeze(["/account/", "/delete-account/"]);

/** How long a sign-in that left for a provider may take to come back. The service's challenge lasts five minutes. */
export const RETURN_MS = 5 * 60 * 1000;

/** The providers to offer: on at the service, and with a client id here. */
export function offered(ways, clients = PROVIDER_CLIENTS) {
  const on = Array.isArray(ways) ? ways : [];
  return PROVIDERS.filter((provider) => on.includes(provider) && typeof clients?.[provider] === "string" && clients[provider] !== "");
}

/** Whether any provider has a client id, so the page knows to ask the service which are on. */
export const anyClient = (clients = PROVIDER_CLIENTS) => PROVIDERS.some((provider) => typeof clients?.[provider] === "string" && clients[provider] !== "");

/** The address a provider sends the reader back to: the page itself, with nothing after its path. Null on a page that isn't one of `RETURN_PATHS`. */
export function returnAddress(location) {
  const path = String(location?.pathname ?? "");
  return RETURN_PATHS.includes(path) ? `${location.origin}${path}` : null;
}

const ADDRESSES = {
  // Apple, "Request an authorization to the Sign in with Apple server."
  apple: ["https://appleid.apple.com/auth/authorize", { response_type: "code id_token", response_mode: "fragment" }],
  // Google, "OpenID Connect": the identity token alone, which comes back after the `#`.
  google: ["https://accounts.google.com/o/oauth2/v2/auth", { response_type: "id_token", scope: "openid" }],
};

/**
 * The provider's sign-in page for one sign-in. `challenge` is the service's
 * (it comes back as the token's `nonce`); `state` is the page's own random
 * value, which comes back beside the token.
 */
export function authorizeAddress(provider, { client, redirect, challenge, state }) {
  const known = ADDRESSES[provider];
  if (!known || !client || !redirect || !challenge || !state) return null;
  const [address, fixed] = known;
  const query = new URLSearchParams({ client_id: client, redirect_uri: redirect, ...fixed, nonce: challenge, state });
  // A space is written %20: Apple's own examples do, and "+" is only a form's spelling of it.
  return `${address}?${query.toString().replace(/\+/g, "%20")}`;
}

/**
 * What a provider sent back after the `#`, or null when the fragment is not
 * a provider's answer (a `#sign-out`, a `#a=<code>`, a heading's id).
 * Returns { state, idToken, code, error }: `idToken` on success, `error`
 * (the provider's word) when the reader closed its page or it refused.
 */
export function readReturn(hash) {
  const text = String(hash ?? "").replace(/^#/, "");
  if (!/(^|&)state=/.test(text)) return null;
  const answer = new URLSearchParams(text);
  const state = answer.get("state");
  const idToken = answer.get("id_token");
  const error = answer.get("error");
  if (!state || (!idToken && !error)) return null;
  return { state, idToken: idToken || null, code: answer.get("code") || null, error: idToken ? null : error };
}

/**
 * Whether what came back answers what the page kept when it sent the reader
 * off: the same `state`, the same service, and in time. `kept` is
 * { v, provider, purpose, challenge, state, redirect, service, at }.
 */
export function answersKept(back, kept, { service, now = Date.now() } = {}) {
  if (!back || !kept || kept.v !== 1) return false;
  if (typeof kept.state !== "string" || kept.state.length < 16 || kept.state !== back.state) return false;
  if (kept.service !== service || !PROVIDERS.includes(kept.provider)) return false;
  return typeof kept.at === "number" && now - kept.at >= 0 && now - kept.at <= RETURN_MS;
}
