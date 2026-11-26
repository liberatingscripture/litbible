// src/scripts/desk/sync/service.js
//
// One request to the LIT notebook service and its answer
// (STUDY-DESK-ENCRYPTION.md, "How a request is carried"): JSON over HTTPS,
// the session as `Authorization: Bearer`, never a cookie, nothing cached.
// The loop (src/lib/desk-sync-engine.mjs) decides what every answer means;
// this file only carries them, and says "offline" when no answer came.
//
// It imports neither the loop nor the encryption, so the account's basics on
// a phone can carry a sign-in with it (../account/page.js).

import { Offline } from "../../../lib/desk-sync-offline.mjs";
import { allowedService } from "../../../lib/desk-sync-link.mjs";

/** How long a request may take before it counts as no answer. A page of rows can be four megabytes. */
export const REQUEST_TIMEOUT_MS = 45_000;

/**
 * @param {{ service: string, token: () => string | null | Promise<string | null>, signIn?: boolean,
 *   fetch?: typeof fetch, pageOrigin?: string, timeout?: number, signal?: AbortSignal | null }} options
 *   `service` is the service's origin, checked here against the ones a page
 *   may talk to; `token` gives the session, or null when there is none.
 *   `signIn: true` makes a carrier for the requests that begin a session
 *   (`GET /sign-in` and the ones under "Signing in"): it has no session to
 *   send, and sends none. `signal`, when given, ends the carrier: once it is
 *   aborted the request in flight is cut off and no other is sent, each
 *   throwing Offline (the connector's stop; Audit 9, SY9b-2).
 * @returns {{ call: (method: string, path: string, body?: object) => Promise<{ status: number, body: object }> }}
 */
export function createApi({ service, token, signIn = false, fetch: send = globalThis.fetch, pageOrigin = globalThis.location?.origin, timeout = REQUEST_TIMEOUT_MS, signal = null }) {
  const origin = allowedService(service, pageOrigin);
  if (!origin) throw new Error("desk-sync: not a service this page may sync with");

  return {
    async call(method, path, body) {
      // A carrier that was ended sends nothing more.
      if (signal?.aborted) throw new Offline("the sync was stopped");
      const session = signIn ? null : await token();
      // No session on this computer: the same as the service ending it, and no request is made.
      if (!signIn && !session) return { status: 401, body: { error: "sign_in", reason: "none" } };
      if (signal?.aborted) throw new Offline("the sync was stopped");
      const control = new AbortController();
      const timer = setTimeout(() => control.abort(), timeout);
      const cut = () => control.abort();
      signal?.addEventListener("abort", cut);
      let res;
      let text;
      try {
        res = await send(`${origin}${path}`, {
          method,
          headers: {
            ...(session ? { Authorization: `Bearer ${session}` } : {}),
            ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          mode: "cors",
          credentials: "omit",
          cache: "no-store",
          redirect: "error",
          referrerPolicy: "no-referrer",
          signal: control.signal,
        });
        // The whole answer, inside the same time limit: a page of rows that stops arriving is no answer.
        text = await res.text();
      } catch (err) {
        // No connection, a blocked request, no answer in time, or the carrier ended meanwhile.
        throw new Offline(undefined, { cause: err });
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", cut);
      }
      let answered = null;
      try {
        answered = JSON.parse(text);
      } catch {
        /* not JSON: something between the page and the service answered */
      }
      if (!answered || typeof answered !== "object" || Array.isArray(answered)) {
        // A gateway's own error page, or an answer cut short. Never read as success.
        return { status: res.status === 200 ? 502 : res.status, body: { error: "error", reason: "unreadable" } };
      }
      return { status: res.status, body: answered };
    },
  };
}
