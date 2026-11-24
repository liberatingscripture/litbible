// The LIT notebook service: a Cloudflare Worker with D1 that holds each
// signed-in reader's Study Desk notebook, sealed so that the service can't
// read it. The website and both apps sync through it.
//
// Its specification is STUDY-DESK-ENCRYPTION.md, "The service's interface":
// every request here, and every check it makes, is a row of that section's
// tables. This file routes; each group of requests has a file of its own.
//
// WHAT NEVER REACHES A LOG: a request's body, a key proof, a session token,
// an id, or an account. One line is logged for each request: the route as it
// is written below (never the address that was asked for), the status, the
// refusal's word, and how long it took.

import { Refusal, answer, now, refusalAnswer } from "./http.js";
import { getAccount, postNotebook, postProof } from "./account.js";
import { deleteDevice, getDevices, getHolders, getKeyring, postDevices, postHolders, putDevice } from "./devices.js";
import { postNotebookKey } from "./key.js";
import { getRows, postRows } from "./rows.js";
import { getApproval, postAccept, postApprovals, postGrant } from "./approvals.js";
import { previewOn, previewPasskey, previewSession } from "./preview.js";

/** The interface's version: the `/1` of the spec's labels. */
const INTERFACE = 1;

// Step 4e adds sign-in here ("Ways to sign in"); step 4f adds DELETE /account,
// POST /notebook/replace, and DELETE /waiting ("Waiting seven days"). Neither
// changes a line below.
const ROUTES = [
  ["GET", "/", root],
  ["GET", "/account", getAccount],
  ["POST", "/session/proof", postProof],
  ["POST", "/notebook", postNotebook],
  ["POST", "/notebook/key", postNotebookKey],
  ["GET", "/holders", getHolders],
  ["POST", "/holders", postHolders],
  ["GET", "/keyring", getKeyring],
  ["GET", "/devices", getDevices],
  ["POST", "/devices", postDevices],
  ["PUT", "/devices/:id", putDevice],
  ["DELETE", "/devices/:id", deleteDevice],
  ["GET", "/rows", getRows],
  ["POST", "/rows", postRows],
  ["POST", "/approvals", postApprovals],
  ["GET", "/approvals/:id", getApproval],
  ["POST", "/approvals/:id/grant", postGrant],
  ["POST", "/approvals/:id/accept", postAccept],
];

/** Routed only where previewOn(env) holds. See src/preview.js. */
const PREVIEW_ROUTES = [
  ["POST", "/preview/session", previewSession],
  ["POST", "/preview/passkeys", previewPasskey],
];

function root({ env }) {
  return answer({ service: "lit-notebook", interface: INTERFACE, preview: previewOn(env) });
}

/** The route for a request, with the values of its `:name` segments, or null. */
function match(routes, method, path) {
  const asked = path.split("/");
  for (const [routeMethod, pattern, handler] of routes) {
    if (routeMethod !== method) continue;
    const parts = pattern.split("/");
    if (parts.length !== asked.length) continue;
    const params = {};
    const fits = parts.every((part, i) => {
      if (!part.startsWith(":")) return part === asked[i];
      params[part.slice(1)] = asked[i];
      return asked[i] !== "";
    });
    if (fits) return { name: `${routeMethod} ${pattern}`, handler, params };
  }
  return null;
}

/**
 * Cross-origin answers for the website's connector, which calls from the
 * site's own origin. Only the origins the environment names are answered, and
 * never with credentials: a session travels in the Authorization header, not
 * in a cookie.
 */
function corsHeaders(request, env) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const allowed = String(env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!allowed.includes(origin)) return null;
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, PUT, DELETE",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function withCors(response, cors) {
  if (!cors) return response;
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(cors)) headers.set(name, value);
  return new Response(response.body, { status: response.status, headers });
}

export default {
  async fetch(request, env) {
    const started = Date.now();
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: cors ? 204 : 403, headers: cors ?? {} });
    }

    const path = url.pathname.length > 1 && url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
    const routes = previewOn(env) ? [...ROUTES, ...PREVIEW_ROUTES] : ROUTES;
    const route = match(routes, request.method, path);
    let response;
    let word;
    try {
      if (!route) throw new Refusal(404, "not_found");
      response = await route.handler({ request, env, url, params: route.params });
    } catch (error) {
      if (error instanceof Refusal) {
        word = error.code;
        response = refusalAnswer(error);
      } else {
        word = "error";
        // A D1 error names tables and columns and never a bound value; anything
        // else might quote what it was given, so only its kind is kept.
        const message = String(error?.message ?? "");
        console.error(
          JSON.stringify({
            at: now(),
            route: route?.name ?? "unmatched",
            failure: error?.name ?? "Error",
            ...(message.startsWith("D1_") ? { d1: message.slice(0, 300) } : {}),
          }),
        );
        response = refusalAnswer(new Refusal(500, "error"));
      }
    }
    console.log(
      JSON.stringify({
        at: now(),
        route: route?.name ?? "unmatched",
        status: response.status,
        ...(word ? { refused: word } : {}),
        ms: Date.now() - started,
      }),
    );
    return withCors(response, cors);
  },
};
