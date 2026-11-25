// Cloudflare Turnstile on the request that begins a new account
// (STUDY-DESK-ENCRYPTION.md, "Signing in"; "Still open," 86).
//
// OFF UNTIL IT IS CONFIGURED. The check is on only where the deployment
// holds both TURNSTILE_SITE_KEY (a variable, public: a browser shows the
// widget with it) and TURNSTILE_SECRET (a Wrangler secret). With either
// missing, nothing here changes any answer. No key or secret is written in
// this repository; the tests use Cloudflare's published dummy keys.
//
// Where it is on:
//   - GET /sign-in carries `turnstile`, the site key, so the website knows
//     to show the widget.
//   - POST /sign-in/new-passkey/options, from a request that carries an
//     `Origin` header, must carry { "turnstile": "<token>" }, and the token
//     is checked with Cloudflare's siteverify before a challenge is made or
//     anything is written.
//
// ONLY A REQUEST WITH AN `Origin` IS CHECKED. Only a browser sends one, and
// Turnstile needs a browser, so the iOS and Android apps (which send none)
// are not asked for a token. That means a program can skip the check by
// sending no `Origin` header: this closes the website's door and leaves the
// apps' open, until the apps attest themselves (App Attest, Play
// Integrity), which is an open question with BDR ("Still open," 86). The
// design is Claude's, for BDR to confirm.
//
// The secret goes to Cloudflare's siteverify and nowhere else: it is never
// in an answer or a log line. The address a request comes from is passed to
// siteverify as `remoteip`, as Cloudflare asks, and is not kept.

import { notAllowed, readJson, refuse } from "./http.js";

export const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** A token's length, in characters. Cloudflare's tokens are well under this. */
export const TOKEN_CHARS = 2048;

/** As long as the service waits for Apple or Google (src/providers.js). */
const SITEVERIFY_TIMEOUT_MS = 8000;

const set = (value) => typeof value === "string" && value.trim() !== "";

/** Turnstile is on where the deployment has both its site key and its secret. */
export const turnstileOn = (env) => set(env.TURNSTILE_SITE_KEY) && set(env.TURNSTILE_SECRET);

/** The site key a browser shows the widget with, or null where the check is off. */
export const turnstileSiteKey = (env) => (turnstileOn(env) ? env.TURNSTILE_SITE_KEY.trim() : null);

/**
 * Asks Cloudflare whether a token is good. Returns true or false; refuses
 * with `provider` (`which: "turnstile"`) when Cloudflare can't be reached,
 * answers other than 200, or answers something the service can't read, the
 * same refusal Apple or Google out of reach gives (src/signin.js,
 * providerCheck).
 */
async function siteverify(env, token, request) {
  const form = new URLSearchParams({ secret: env.TURNSTILE_SECRET.trim(), response: token });
  const address = request.headers.get("cf-connecting-ip");
  if (address) form.set("remoteip", address);
  let verdict;
  try {
    const res = await fetch(SITEVERIFY, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: form.toString(),
      signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
    });
    if (res.status !== 200) throw new Error("not 200");
    verdict = JSON.parse(await res.text());
  } catch {
    return refuse(502, "provider", { which: "turnstile" });
  }
  if (verdict === null || typeof verdict !== "object" || typeof verdict.success !== "boolean") {
    return refuse(502, "provider", { which: "turnstile" });
  }
  return verdict.success;
}

/**
 * The check on POST /sign-in/new-passkey/options. Does nothing where the
 * check is off or the request has no `Origin` (an app's), and then the body
 * is not read at all, as before the check existed. Otherwise it reads the
 * body (a request with none has no token) and refuses `not_allowed` by the
 * rule `turnstile` when the token is missing, not text of 1 to 2,048
 * characters, or refused by Cloudflare. Other members of the body are
 * ignored, as they were.
 */
export async function needTurnstile(env, request) {
  if (!turnstileOn(env)) return;
  // No Origin: an app, which can't show the widget. See the head of this file.
  if (!request.headers.has("origin")) return;
  const body = request.body ? await readJson(request) : {};
  const token = body.turnstile;
  if (typeof token !== "string" || token.length < 1 || token.length > TOKEN_CHARS) notAllowed("turnstile");
  if (!(await siteverify(env, token, request))) notAllowed("turnstile");
}
