// test/desk-sync-fake-service.test.js
//
// The sync's tests run against a stand-in for the notebook service
// (test/helpers/fake-notebook-service.mjs), written by hand to the service's
// order of checks and words. Audit 9 (SY9-2) found it had drifted: it read
// the body's size before the session, called the body's refusal `what:
// "body"`, handed out tokens the service would refuse, and reset the
// revision counter when a notebook was replaced. This file sends the same
// requests to it and to the service's own code
// (test/helpers/real-notebook-service.mjs) and compares what each answers,
// so the next drift fails here. Accounts and sessions are written into the
// real service's database directly: the order of checks is the point, not
// how a session is made.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";

import { createFakeService, setUp } from "./helpers/fake-notebook-service.mjs";
import { realService } from "./helpers/real-notebook-service.mjs";

const BODY_LIMIT = 4 * 1024 * 1024;
const TIME = "2026-11-25T12:00:00.000Z";
const LATER = "2027-11-25T12:00:00.000Z";

const b64url = (bytes) => Buffer.from(bytes).toString("base64url");
const newToken = () => b64url(randomBytes(32));
const hashOf = (token) => b64url(createHash("sha256").update(token).digest());

/**
 * The real service with one account in each state a request can meet: none
 * (no session), signed in to an account with no notebook, signed in to one
 * with a notebook, and open on it.
 */
function realWorld() {
  const service = realService();
  const run = (sql, ...values) => service.sql.prepare(sql).run(...values);
  const account = (id, notebook) => {
    run("INSERT INTO accounts (id, created, notebook, kid, proof_hash, lists, rev) VALUES (?, ?, ?, ?, ?, 1, 7)", id, TIME, notebook, notebook ? 1 : 0, notebook ? b64url(randomBytes(32)) : null);
    run("INSERT INTO ways (id, account, kind, subject, created) VALUES (?, ?, 'passkey', ?, ?)", `way-${id}`, id, `credential-${id}`, TIME);
  };
  const session = (id, { device = null, openKid = 0 } = {}) => {
    const token = newToken();
    run("INSERT INTO sessions (token_hash, account, way, device, open_kid, created, expires) VALUES (?, ?, ?, ?, ?, ?, ?)", hashOf(token), id, `way-${id}`, device, openKid, TIME, LATER);
    return token;
  };
  account("empty", null);
  account("reader", "notebook-1");
  const device = "0b8f5a4e-6a63-4f43-9d3e-0a0c1f2b3c4d";
  run(
    "INSERT INTO devices (account, id, card_kid, card_nonce, card_ct, keyring_kid, keyring_enc, keyring_ct, added, added_how, seen) VALUES ('reader', ?, 1, 'n', 'c', 1, 'e', 'k', ?, 'setup', ?)",
    device,
    TIME,
    TIME,
  );
  return {
    fetch: (path, init) => service.fetch(`${service.origin}${path}`, init),
    tokens: { none: null, empty: session("empty"), signedIn: session("reader"), open: session("reader", { device, openKid: 1 }) },
  };
}

/** The stand-in, with the same four states. */
async function fakeWorld() {
  const service = createFakeService({ now: () => TIME });
  const reader = await setUp(service, "reader");
  return {
    fetch: (path, init) => service.fetch(`https://notebook.example${path}`, init),
    tokens: { none: null, empty: service.signIn("empty"), signedIn: service.signIn("reader"), open: reader.token },
  };
}

/** Sends one request; answers the status and the members a client reads off a refusal. */
async function ask(world, who, method, path, body) {
  const token = world.tokens[who];
  const res = await world.fetch(path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const answered = JSON.parse(await res.text());
  const { error = null, what, limit, kid } = answered;
  return { status: res.status, error, ...(what === undefined ? {} : { what }), ...(limit === undefined ? {} : { limit }), ...(kid === undefined || error === null ? {} : { kid }) };
}

/** A body a little over the service's limit, still a JSON object. */
const oversized = (fields) => ({ ...fields, pad: "x".repeat(BODY_LIMIT) });

const CASES = [
  ["no session, a body too large: the session is checked first", "none", "POST", "/rows", oversized({ put: [], remove: [] })],
  ["signed in, not open, a body too large: what the route needs of the session comes before the body", "signedIn", "POST", "/rows", oversized({ put: [], remove: [] })],
  ["open, a body too large: the body's own refusal, with its limit and no `what`", "open", "POST", "/rows", oversized({ put: [], remove: [] })],
  ["open, too many rows: the rows' own refusal, `what: \"rows\"`", "open", "POST", "/rows", { put: [], remove: Array.from({ length: 501 }, (_, i) => ({ id: `r${i}`, rev: 1 })) }],
  ["a proof to an account with no notebook, a body too large: no_notebook comes first", "empty", "POST", "/session/proof", oversized({ device: "x", kid: 1, proof: "x" })],
  ["a proof, a body too large: the body after the notebook", "signedIn", "POST", "/session/proof", oversized({ device: "x", kid: 1, proof: "x" })],
  ["a token that isn't one: signed out", "none", "GET", "/account", undefined],
];

test("the stand-in answers as the service does where the order of checks decides the answer", async () => {
  const real = realWorld();
  const fake = await fakeWorld();
  for (const [name, who, method, path, body] of CASES) {
    const want = await ask(real, who, method, path, body);
    const got = await ask(fake, who, method, path, body);
    assert.deepEqual(got, want, name);
  }
  // The answers themselves, so that a change to both at once is seen too.
  assert.deepEqual(await ask(real, "open", "POST", "/rows", oversized({ put: [], remove: [] })), { status: 413, error: "too_large", limit: BODY_LIMIT });
  assert.deepEqual(await ask(real, "signedIn", "POST", "/rows", oversized({ put: [], remove: [] })), { status: 403, error: "not_open", kid: 1 });
});

test("the stand-in's session tokens have the service's form, and a header that isn't one signs nothing in", async () => {
  const service = createFakeService();
  const token = service.signIn("someone");
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  const res = await service.fetch("https://notebook.example/account", { method: "GET", headers: { Authorization: `Bearer ${token}x` } });
  assert.equal(res.status, 401);
  assert.equal(JSON.parse(await res.text()).error, "sign_in");
});

test("replacing the notebook keeps the account's revision counter, as the service does", async () => {
  const service = createFakeService();
  const reader = await setUp(service, "reader");
  const before = service.account("reader");
  before.rev = 12;
  service.replaceNotebook("reader");
  assert.equal(service.account("reader").rev, 12, "the next notebook's rows take revisions past every one a device pulled");
  assert.equal(service.account("reader").waiting, null, "and the request that replaced it is gone");
  assert.ok(reader.token);
});
