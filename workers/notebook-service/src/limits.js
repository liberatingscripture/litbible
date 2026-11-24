// How often a client may ask (STUDY-DESK-ENCRYPTION.md, "The service's
// interface": "How often a client may ask").
//
// Two limits, both counted by the address a request comes from, with
// Cloudflare's rate limiting binding for Workers (`ratelimits` in
// wrangler.jsonc):
//
//   SIGN_IN_LIMIT   the requests that begin a sign-in. They take no session,
//                   and each writes a challenge or checks an answer, so they
//                   are what a client with nothing to lose can ask without
//                   end. The preview's own way in is counted with them.
//   REQUEST_LIMIT   every other request, with a session or without.
//
// The numbers are in wrangler.jsonc, beside the bindings, and in the spec.
//
// WHY THE BINDING, and not a table in D1 or a rule on the zone. The counters
// live in Cloudflare's memory at the edge: asking costs no query and no
// write, so a flood can't spend the database to be counted. And the service
// would otherwise have to STORE the address it counts by, which it stores
// nowhere else. Here the address is handed to the limiter as a key for one
// call and kept nowhere by this code: not in D1, not in a log.
//
// WHAT IT IS NOT. As Cloudflare documents the binding, the counters are kept
// for each Cloudflare location and are not exact: a burst may get a few
// requests past the number, and a client that reaches several locations has
// a count in each. (Its page was read on 2026-11-24, after this was written,
// and says so; and the deployed preview showed it that day: the 62nd request
// of a burst was refused and two of the next three were not. The local copy
// the tests run against counts exactly.) The same page advises against an
// address as the key, since many people can share one. A sign-in's first
// requests have nothing else to be counted by, so the numbers must leave
// room for people behind one address; whether they do is the spec's "Still
// open," 68. It slows a client down. It is not a wall, and nothing's
// safety rests on it: a session's wrong proofs are counted exactly, in the
// database (src/session.js), and so are an account's approvals in progress.
//
// A deployment with a binding missing answers "error" to everything, loudly,
// instead of running unlimited without anyone knowing. If the limiter itself
// fails, the request goes through: the limiter is a brake, and a brake that
// sticks must not stop the service.

import { refuse } from "./http.js";

/** What a refused client is told to wait, in seconds: the limiter's period. */
export const RETRY_SECONDS = 60;

const SIGN_IN = /^POST \/(sign-in\/|preview\/session$)/;

/** Which limit a route is counted under. `route` is the route's name, or undefined for no such path. */
export const limitFor = (route) => (route && SIGN_IN.test(route) ? "SIGN_IN_LIMIT" : "REQUEST_LIMIT");

/** Refuses with "slow_down" when the caller's address has asked too often. */
export async function limit(env, request, route) {
  const name = limitFor(route);
  const limiter = env[name];
  if (!limiter || typeof limiter.limit !== "function") throw new Error(`no ${name} binding`);
  // Cloudflare sets this header itself on every request and overwrites one a client sends.
  const key = request.headers.get("cf-connecting-ip") ?? "none";
  let outcome;
  try {
    outcome = await limiter.limit({ key });
  } catch {
    return;
  }
  if (outcome && outcome.success === false) refuse(429, "slow_down", { retry: RETRY_SECONDS });
}
