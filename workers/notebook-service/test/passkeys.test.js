// Sign in with a passkey, one check at a time. Each test starts from a request
// that would be accepted and changes exactly one thing, so a refusal can only
// be the check the test names. The whole flows are in sign-in.test.js.
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { call, freshAccount } from "./call.js";
import {
  ANDROID_ORIGINS,
  FLAGS,
  LOCAL_ORIGIN,
  ORIGIN,
  assert,
  attest,
  authenticatorData,
  cbor,
  coseKey,
  concat,
  newPasskey,
  optionsFor,
  passkeySignInRequest,
  signAs,
  signInWithPasskey,
  signUpWithPasskey,
} from "./authenticator.js";
import { must, ref, signIn } from "./notebook.js";

const b64 = ref.toBase64url;
const un = ref.fromBase64url;
const utf8 = (text) => new TextEncoder().encode(text);
const bytesOf = (n) => b64(new Uint8Array(n).fill(5));
const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const PAST = "2000-01-01T00:00:00.000Z";

const count = async (table) => (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first()).n;
const storedCount = async (id) => (await env.DB.prepare("SELECT count FROM ways WHERE id = ?").bind(id).first()).count;
const challengeRow = (id) => env.DB.prepare("SELECT * FROM challenges WHERE id = ?").bind(id).first();
const snapshot = async () => ({ accounts: await count("accounts"), ways: await count("ways"), sessions: await count("sessions") });

const SIGN_IN = "/sign-in/passkey";
const NEW = "/sign-in/new-passkey";
const send = (path, body, options = {}) => call("POST", path, { body, ...options });
const clone = (value) => structuredClone(value);

/** Flags a passkey of this kind sets when all is well. */
const okFlags = (p) => FLAGS.UP | FLAGS.UV | (p.syncs ? FLAGS.BE : 0) | (p.backedUp ? FLAGS.BS : 0);

function expectRefused(res, status, error, extra = {}) {
  expect(res.status, JSON.stringify(res.body)).toBe(status);
  expect(res.body.error).toBe(error);
  for (const [name, value] of Object.entries(extra)) expect(res.body[name]).toBe(value);
}
const expectPasskeyRefused = (res, reason) => expectRefused(res, 403, "passkey_refused", { reason });
const expectBad = (res, field) => expectRefused(res, 400, "bad_request", { field });
const expectGone = (res) => expectRefused(res, 410, "gone", { what: "challenge" });

/** A registered passkey, and a sign-in request that would be accepted (`o` changes one thing). */
async function fresh(make = {}, o = {}, up = {}) {
  const made = await signUpWithPasskey(make, up);
  const request = await passkeySignInRequest(made.passkey, o);
  return { made, passkey: made.passkey, ...request };
}

/** A registration request that would be accepted. */
async function freshNew(make = {}, o = {}) {
  const passkey = await newPasskey(make);
  const { publicKey } = await optionsFor("/sign-in/new-passkey/options", o);
  return { passkey, publicKey, body: { credential: await attest(passkey, publicKey, o) } };
}

/** Authenticator data for a registration, by hand. */
const registrationData = (p, { rpId = "litbible.net", flags, attested, extensions, count: n = 0 } = {}) =>
  authenticatorData({
    rpId,
    flags: flags ?? okFlags(p) | FLAGS.AT | (extensions ? FLAGS.ED : 0),
    count: n,
    attested: attested === undefined ? { id: p.credentialId, key: coseKey(p) } : attested,
    extensions,
  });

/** Authenticator data for a sign-in, by hand. */
const signInData = (p, { rpId = "litbible.net", flags = okFlags(p), count: n = 0, attested = null, extensions = null } = {}) =>
  authenticatorData({ rpId, flags, count: n, attested, extensions });

const attestationOf = (authData, parts = {}) =>
  cbor(new Map([["fmt", parts.fmt ?? "none"], ["attStmt", parts.attStmt ?? new Map()], ["authData", authData]]));

/* ── 1. POST /sign-in/passkey/options ───────────────────────────────────── */

describe("POST /sign-in/passkey/options", () => {
  it("answers the challenge and what to ask a passkey, and nothing else", async () => {
    const res = await call("POST", "/sign-in/passkey/options");
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["time", "publicKey", "expires"]);
    expect(res.body.publicKey).toEqual({ challenge: expect.stringMatching(TOKEN), rpId: "litbible.net", timeout: 300000, userVerification: "required" });
    expect(ref.fromBase64url(res.body.publicKey.challenge)).toHaveLength(32);
    const span = Date.parse(res.body.expires) - Date.parse(res.body.time);
    expect(span).toBeGreaterThan(299000);
    expect(span).toBeLessThanOrEqual(300000);
  });

  it("makes a different challenge each time", async () => {
    const seen = new Set();
    for (let i = 0; i < 5; i++) seen.add((await must("POST", "/sign-in/passkey/options")).publicKey.challenge);
    expect(seen.size).toBe(5);
  });

  it("needs no body, and ignores whatever body it is given", async () => {
    const bodies = [
      { body: undefined },
      { body: { rpId: "evil.example", challenge: "x" } },
      { body: "not json at all", headers: { "content-type": "text/plain" } },
      { body: "[1,2]" },
    ];
    for (const options of bodies) {
      const res = await call("POST", "/sign-in/passkey/options", options);
      expect(res.status, JSON.stringify(options)).toBe(200);
      expect(res.body.publicKey.rpId).toBe("litbible.net");
    }
  });

  it("keeps the challenge as a row for the purpose passkey_sign_in, belonging to no account", async () => {
    const { publicKey, expires } = await must("POST", "/sign-in/passkey/options");
    const row = await challengeRow(publicKey.challenge);
    expect(row).toMatchObject({ id: publicKey.challenge, purpose: "passkey_sign_in", account: null, handle: null, expires });
  });

  it("sweeps challenges that ran out when it makes a new one, and keeps those that have not", async () => {
    const insert = (id, expires) =>
      env.DB.prepare("INSERT INTO challenges (id, purpose, account, handle, expires) VALUES (?, 'passkey_sign_in', NULL, NULL, ?)").bind(id, expires).run();
    const old = b64(randomBytes(32));
    const live = b64(randomBytes(32));
    await insert(old, PAST);
    await insert(live, "2999-01-01T00:00:00.000Z");
    expect(await challengeRow(old)).not.toBeNull();
    await must("POST", "/sign-in/passkey/options");
    expect(await challengeRow(old)).toBeNull();
    expect(await challengeRow(live)).not.toBeNull();
  });
});

/* ── 3. POST /sign-in/new-passkey/options ───────────────────────────────── */

describe("POST /sign-in/new-passkey/options", () => {
  it("keeps the challenge for the purpose passkey_new, with the user handle it named", async () => {
    const { publicKey, expires } = await must("POST", "/sign-in/new-passkey/options");
    const row = await challengeRow(publicKey.challenge);
    expect(row).toMatchObject({ purpose: "passkey_new", account: null, handle: publicKey.user.id, expires });
  });

  it("sweeps challenges that ran out, as the sign-in options do", async () => {
    const old = b64(randomBytes(32));
    await env.DB.prepare("INSERT INTO challenges (id, purpose, account, handle, expires) VALUES (?, 'passkey_new', NULL, NULL, ?)").bind(old, PAST).run();
    await must("POST", "/sign-in/new-passkey/options");
    expect(await challengeRow(old)).toBeNull();
  });
});

/* ── 2k. A sign-in that is accepted ─────────────────────────────────────── */

describe("POST /sign-in/passkey, accepted", () => {
  it("answers time, token, expires, created, and way, and nothing else", async () => {
    const { made, publicKey, body } = await fresh();
    void publicKey;
    const res = await send(SIGN_IN, body);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(["created", "expires", "time", "token", "way"]);
    expect(res.body.created).toBe(false);
    expect(res.body.token).toMatch(TOKEN);
    expect(res.body.way).toEqual({ id: made.way.id, kind: "passkey", added: made.way.added, credential: made.passkey.id, syncs: true });
    expect(res.body.way.id).toMatch(UUID);
  });

  it("gives a session that works on GET /account, belonging to the account the passkey made", async () => {
    const { made, body } = await fresh();
    const res = await send(SIGN_IN, body);
    const account = await must("GET", "/account", { token: res.body.token });
    expect(account.ways).toEqual([made.way]);
    expect(account.notebook).toBeNull();
    expect(res.body.token).not.toBe(made.token);
  });

  it("gives a session that expires about 30 days on", async () => {
    const { body } = await fresh();
    const res = await send(SIGN_IN, body);
    const days = (Date.parse(res.body.expires) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });

  it("adds one session, and moves nothing else", async () => {
    const { body } = await fresh();
    const before = await snapshot();
    await send(SIGN_IN, body);
    expect(await snapshot()).toEqual({ ...before, sessions: before.sessions + 1 });
  });

  it("answers the way of a passkey that does not sync with syncs false", async () => {
    const made = await signUpWithPasskey({ syncs: false });
    const res = await signInWithPasskey(made.passkey);
    expect(res.way.syncs).toBe(false);
  });

  it("accepts a Content-Type with a charset", async () => {
    const { body } = await fresh();
    const res = await send(SIGN_IN, body, { headers: { "content-type": "application/json; charset=utf-8" } });
    expect(res.status).toBe(200);
  });

  it("accepts an extension result without a PRF, a PRF that only says it is enabled, and an empty PRF", async () => {
    for (const results of [{}, { prf: { enabled: true } }, { prf: {} }, { prf: true }, { credProps: { rk: true } }]) {
      const { body } = await fresh({}, { clientExtensionResults: results });
      const res = await send(SIGN_IN, body);
      expect(res.status, JSON.stringify(results)).toBe(200);
    }
  });

  it("accepts clientExtensionResults that is null or missing", async () => {
    for (const edit of [(b) => (b.credential.clientExtensionResults = null), (b) => delete b.credential.clientExtensionResults]) {
      const { body } = await fresh();
      edit(body);
      expect((await send(SIGN_IN, body)).status).toBe(200);
    }
  });

  it("accepts a response with no rawId, and one whose rawId is the id", async () => {
    const { body } = await fresh();
    expect(body.credential.rawId).toBe(body.credential.id);
    expect((await send(SIGN_IN, body)).status).toBe(200);
    const other = await fresh();
    delete other.body.credential.rawId;
    expect((await send(SIGN_IN, other.body)).status).toBe(200);
  });

  it("accepts a user handle that is missing, null, or empty, and one that is the account's", async () => {
    for (const edit of [(b) => delete b.credential.response.userHandle, (b) => (b.credential.response.userHandle = null), (b) => (b.credential.response.userHandle = "")]) {
      const { body } = await fresh();
      edit(body);
      expect((await send(SIGN_IN, body)).status).toBe(200);
    }
    const { body, made } = await fresh();
    expect(body.credential.response.userHandle).toBe(made.passkey.handle);
    expect((await send(SIGN_IN, body)).status).toBe(200);
  });

  it("accepts an RS256 passkey that does not sync", async () => {
    const { body } = await fresh({ alg: -257, syncs: false });
    expect((await send(SIGN_IN, body)).status).toBe(200);
  });

  it("accepts authenticator data that carries a real extensions map", async () => {
    const { body } = await fresh({}, { extensions: new Map([["credBlob", true]]) });
    expect((await send(SIGN_IN, body)).status).toBe(200);
  });

  it("accepts a signature whose ASN.1 integer for r has a needless leading zero byte", async () => {
    const passkey = (await signUpWithPasskey()).passkey;
    const { publicKey } = await optionsFor("/sign-in/passkey/options");
    let body = null;
    for (let i = 0; i < 60 && !body; i++) {
      const candidate = { credential: await assert(passkey, publicKey) };
      const der = un(candidate.credential.response.signature);
      // Only an r whose first byte has the high bit clear can take a zero without turning negative, and the whole must stay within 72 bytes.
      if (der[2] === 0x02 && der[4] < 0x80 && der.length <= 71) {
        const rLength = der[3];
        const padded = concat(Uint8Array.of(0x30, der.length - 2 + 1, 0x02, rLength + 1, 0), der.subarray(4));
        candidate.credential.response.signature = b64(padded);
        body = candidate;
      }
    }
    expect(body, "no signature with a short r came up in 60 tries").not.toBeNull();
    expect((await send(SIGN_IN, body)).status).toBe(200);
  });

  describe("from each origin it accepts", () => {
    for (const origin of [ORIGIN, ...ANDROID_ORIGINS]) {
      it(origin, async () => {
        const { body } = await fresh({}, { origin });
        expect((await send(SIGN_IN, body)).status).toBe(200);
      });
    }
    it(`${LOCAL_ORIGIN}, on the preview`, async () => {
      const { body } = await fresh({}, { origin: LOCAL_ORIGIN }, { origin: LOCAL_ORIGIN });
      expect((await send(SIGN_IN, body)).status).toBe(200);
    });
  });
});

/* ── 2a. The form ───────────────────────────────────────────────────────── */

/** The members of a credential both kinds of response share, and what each refusal names. */
const SHARED_FORM = [
  ["credential is missing", "credential", (b) => delete b.credential],
  ["credential is null", "credential", (b) => (b.credential = null)],
  ["credential is an array", "credential", (b) => (b.credential = [])],
  ["credential is a string", "credential", (b) => (b.credential = "x")],
  ["type is missing", "credential.type", (b) => delete b.credential.type],
  ["type is not public-key", "credential.type", (b) => (b.credential.type = "password")],
  ["type is null", "credential.type", (b) => (b.credential.type = null)],
  ["id is missing", "credential.id", (b) => delete b.credential.id],
  ["id is empty", "credential.id", (b) => (b.credential.id = "")],
  ["id is padded", "credential.id", (b) => (b.credential.id += "=")],
  ["id has a plus sign", "credential.id", (b) => (b.credential.id = "AAA+AAAA")],
  ["id is a number", "credential.id", (b) => (b.credential.id = 12)],
  ["id is over 1,023 bytes", "credential.id", (b) => (b.credential.id = bytesOf(1024))],
  ["rawId differs from id", "credential.rawId", (b) => (b.credential.rawId = bytesOf(20))],
  ["rawId is a number", "credential.rawId", (b) => (b.credential.rawId = 5)],
  ["rawId is null", "credential.rawId", (b) => (b.credential.rawId = null)],
  ["response is missing", "credential.response", (b) => delete b.credential.response],
  ["response is null", "credential.response", (b) => (b.credential.response = null)],
  ["response is a string", "credential.response", (b) => (b.credential.response = "x")],
  ["response is an array", "credential.response", (b) => (b.credential.response = [])],
  ["clientExtensionResults is a string", "credential.clientExtensionResults", (b) => (b.credential.clientExtensionResults = "x")],
  ["clientExtensionResults is a number", "credential.clientExtensionResults", (b) => (b.credential.clientExtensionResults = 1)],
  ["clientExtensionResults is an array", "credential.clientExtensionResults", (b) => (b.credential.clientExtensionResults = [])],
  ["clientDataJSON is missing", "credential.response.clientDataJSON", (b) => delete b.credential.response.clientDataJSON],
  ["clientDataJSON is empty", "credential.response.clientDataJSON", (b) => (b.credential.response.clientDataJSON = "")],
  ["clientDataJSON is not base64url", "credential.response.clientDataJSON", (b) => (b.credential.response.clientDataJSON = "not base64url!")],
  ["clientDataJSON is over 4,096 bytes", "credential.response.clientDataJSON", (b) => (b.credential.response.clientDataJSON = bytesOf(4097))],
];

const SIGN_IN_FORM = [
  ["authenticatorData is missing", "credential.response.authenticatorData", (b) => delete b.credential.response.authenticatorData],
  ["authenticatorData is under 37 bytes", "credential.response.authenticatorData", (b) => (b.credential.response.authenticatorData = bytesOf(36))],
  ["authenticatorData is over 1,024 bytes", "credential.response.authenticatorData", (b) => (b.credential.response.authenticatorData = bytesOf(1025))],
  ["signature is missing", "credential.response.signature", (b) => delete b.credential.response.signature],
  ["signature is empty", "credential.response.signature", (b) => (b.credential.response.signature = "")],
  ["signature is over 1,024 bytes", "credential.response.signature", (b) => (b.credential.response.signature = bytesOf(1025))],
  ["userHandle is not base64url", "credential.response.userHandle", (b) => (b.credential.response.userHandle = "not base64url!")],
  ["userHandle is over 64 bytes", "credential.response.userHandle", (b) => (b.credential.response.userHandle = bytesOf(65))],
  ["userHandle is a number", "credential.response.userHandle", (b) => (b.credential.response.userHandle = 5)],
];

const REGISTRATION_FORM = [
  ["attestationObject is missing", "credential.response.attestationObject", (b) => delete b.credential.response.attestationObject],
  ["attestationObject is empty", "credential.response.attestationObject", (b) => (b.credential.response.attestationObject = "")],
  ["attestationObject is not base64url", "credential.response.attestationObject", (b) => (b.credential.response.attestationObject = "not base64url!")],
  ["attestationObject is over 16,384 bytes", "credential.response.attestationObject", (b) => (b.credential.response.attestationObject = bytesOf(16385))],
];

const REQUEST_FORM = [
  ["Content-Type is not JSON", "Content-Type", { headers: { "content-type": "text/plain" } }],
  ["Content-Type only starts like JSON", "Content-Type", { headers: { "content-type": "application/jsonx" } }],
  ["body is not JSON", "body", { raw: "not json" }],
  ["body is an array", "body", { raw: "[]" }],
  ["body is null", "body", { raw: "null" }],
  ["body is a number", "body", { raw: "5" }],
  ["body is a string", "body", { raw: '"x"' }],
  ["body is empty", "body", { raw: "" }],
];

/** The same checks of form, for each of the two requests that carry a credential. */
function formChecks(path, build, own) {
  describe("the form", () => {
    for (const [name, field, edit] of [...SHARED_FORM, ...own]) {
      it(`refuses ${name}, naming ${field}`, async () => {
        const { body } = await build();
        edit(body);
        const before = await snapshot();
        expectBad(await send(path, body), field);
        expect(await snapshot()).toEqual(before);
      });
    }
    for (const [name, field, options] of REQUEST_FORM) {
      it(`refuses a request whose ${name}, naming ${field}`, async () => {
        const { body } = await build();
        const res = await call("POST", path, { body: options.raw ?? body, headers: options.headers });
        expectBad(res, field);
      });
    }
    it("refuses a request with no body and no Content-Type, naming Content-Type", async () => {
      expectBad(await call("POST", path), "Content-Type");
    });
    it("refuses a request with a JSON Content-Type and no body, naming body", async () => {
      expectBad(await call("POST", path, { headers: { "content-type": "application/json" } }), "body");
    });
    it("refuses an empty object, naming credential", async () => {
      expectBad(await send(path, {}), "credential");
    });
    it("does not use the challenge up when the form is wrong: the same challenge, sent right, still works", async () => {
      const { body } = await build();
      const wrong = clone(body);
      delete wrong.credential.type;
      expectBad(await send(path, wrong), "credential.type");
      expect((await send(path, body)).status).toBe(200);
    });
  });
}

describe("POST /sign-in/passkey, the form", () => {
  formChecks(SIGN_IN, () => fresh(), SIGN_IN_FORM);
});

/* ── 2b. No PRF result ──────────────────────────────────────────────────── */

describe("a PRF result is refused", () => {
  const RESULTS = {
    "with a first": { results: { first: b64(randomBytes(32)) } },
    "with first and second": { results: { first: b64(randomBytes(32)), second: b64(randomBytes(32)) } },
    "that is empty": { results: {} },
    "that is null": { results: null },
    "alongside enabled": { enabled: true, results: { first: "AAAA" } },
  };
  for (const [path, label, build] of [
    [SIGN_IN, "sign-in", () => fresh()],
    [NEW, "new passkey", () => freshNew()],
  ]) {
    for (const [name, prf] of Object.entries(RESULTS)) {
      it(`refuses a ${label} whose prf has results ${name}, with not_allowed and the rule prf_results`, async () => {
        const { body } = await build();
        body.credential.clientExtensionResults = { prf };
        const before = await snapshot();
        expectRefused(await send(path, body), 422, "not_allowed", { rule: "prf_results" });
        expect(await snapshot()).toEqual(before);
      });
    }
  }

  it("refuses it before the challenge is used: the same challenge, answered again without results, signs in", async () => {
    const { passkey, publicKey, body } = await fresh();
    const withResults = clone(body);
    withResults.credential.clientExtensionResults = { prf: { results: { first: "AAAA" } } };
    expectRefused(await send(SIGN_IN, withResults), 422, "not_allowed", { rule: "prf_results" });
    expect(await challengeRow(publicKey.challenge)).not.toBeNull();
    expect((await send(SIGN_IN, body)).status).toBe(200);
    void passkey;
  });

  it("refuses it before it looks at a challenge the service never made", async () => {
    const { body } = await fresh({}, { clientData: { challenge: b64(randomBytes(32)) } });
    body.credential.clientExtensionResults = { prf: { results: {} } };
    expectRefused(await send(SIGN_IN, body), 422, "not_allowed", { rule: "prf_results" });
  });

  it("refuses a new passkey's PRF result before the challenge is used", async () => {
    const { publicKey, body } = await freshNew();
    const withResults = clone(body);
    withResults.credential.clientExtensionResults = { prf: { results: { first: "AAAA" } } };
    expectRefused(await send(NEW, withResults), 422, "not_allowed", { rule: "prf_results" });
    expect(await challengeRow(publicKey.challenge)).not.toBeNull();
    expect((await send(NEW, body)).status).toBe(200);
  });
});

/* ── 2c. The client data ────────────────────────────────────────────────── */

const clientBytes = (publicKey, over = {}, type = "webauthn.get") =>
  utf8(JSON.stringify({ type, challenge: publicKey.challenge, origin: ORIGIN, crossOrigin: false, ...over }));

describe("POST /sign-in/passkey, the client data", () => {
  const JUNK = {
    "is not JSON": () => utf8("this is not json"),
    "is not UTF-8": () => Uint8Array.of(0x7b, 0xff, 0xfe, 0x7d),
    "is an array": () => utf8("[]"),
    "is null": () => utf8("null"),
    "is a number": () => utf8("5"),
    "is a string": () => utf8('"x"'),
    "is an empty object": () => utf8("{}"),
  };
  for (const [name, make] of Object.entries(JUNK)) {
    it(`refuses client data that ${name}, with the reason client_data`, async () => {
      const { body } = await fresh({}, { clientDataJSON: make() });
      expectPasskeyRefused(await send(SIGN_IN, body), "client_data");
    });
  }

  for (const [name, edit] of [
    ["has no challenge", (data) => delete data.challenge],
    ["has a challenge that is a number", (data) => (data.challenge = 5)],
    ["has a challenge that is null", (data) => (data.challenge = null)],
    ["has no origin", (data) => delete data.origin],
    ["has an origin that is a number", (data) => (data.origin = 5)],
    ["has an origin that is an array", (data) => (data.origin = [ORIGIN])],
  ]) {
    it(`refuses client data that ${name}, with the reason client_data`, async () => {
      const { publicKey, passkey } = await fresh();
      const data = JSON.parse(new TextDecoder().decode(clientBytes(publicKey)));
      edit(data);
      const { body } = await passkeySignInRequest(passkey, { clientDataJSON: utf8(JSON.stringify(data)) });
      expectPasskeyRefused(await send(SIGN_IN, body), "client_data");
    });
  }

  for (const [name, type] of [
    ["webauthn.create", "webauthn.create"],
    ["a type of another kind", "webauthn.other"],
    ["a type with different case", "WebAuthn.get"],
    ["a type that is null", null],
  ]) {
    it(`refuses ${name} as the type, with the reason type`, async () => {
      const { body } = await fresh({}, { clientData: { type } });
      expectPasskeyRefused(await send(SIGN_IN, body), "type");
    });
  }

  it("refuses client data with no type, with the reason type", async () => {
    const { passkey } = await fresh();
    const { publicKey } = await optionsFor("/sign-in/passkey/options");
    const data = JSON.parse(new TextDecoder().decode(clientBytes(publicKey)));
    delete data.type;
    const { body } = await { body: { credential: await assert(passkey, publicKey, { clientDataJSON: utf8(JSON.stringify(data)) }) } };
    expectPasskeyRefused(await send(SIGN_IN, body), "type");
  });

  it("refuses crossOrigin true, with the reason cross_origin", async () => {
    const { body } = await fresh({}, { clientData: { crossOrigin: true } });
    expectPasskeyRefused(await send(SIGN_IN, body), "cross_origin");
  });

  it("accepts crossOrigin false, and client data with no crossOrigin at all", async () => {
    const { passkey, publicKey } = await fresh();
    const data = JSON.parse(new TextDecoder().decode(clientBytes(publicKey)));
    delete data.crossOrigin;
    const { body } = { body: { credential: await assert(passkey, publicKey, { clientDataJSON: utf8(JSON.stringify(data)) }) } };
    expect((await send(SIGN_IN, body)).status).toBe(200);
    const plain = await fresh();
    expect((await send(SIGN_IN, plain.body)).status).toBe(200);
  });

  it("refuses before the challenge is used: the same challenge, answered again rightly, signs in", async () => {
    const { passkey, publicKey, body } = await fresh({}, { clientData: { type: "webauthn.create" } });
    expectPasskeyRefused(await send(SIGN_IN, body), "type");
    expect(await challengeRow(publicKey.challenge)).not.toBeNull();
    const again = { credential: await assert(passkey, publicKey) };
    expect((await send(SIGN_IN, again)).status).toBe(200);
  });

  it("refuses a wrong type before it looks at a challenge the service never made", async () => {
    const { body } = await fresh({}, { clientData: { type: "webauthn.create", challenge: b64(randomBytes(32)) } });
    expectPasskeyRefused(await send(SIGN_IN, body), "type");
  });

  it("refuses crossOrigin before it looks at a challenge the service never made", async () => {
    const { body } = await fresh({}, { clientData: { crossOrigin: true, challenge: b64(randomBytes(32)) } });
    expectPasskeyRefused(await send(SIGN_IN, body), "cross_origin");
  });
});

/* ── 2d. The challenge ──────────────────────────────────────────────────── */

describe("POST /sign-in/passkey, the challenge", () => {
  it("refuses a challenge the service never made, with gone", async () => {
    const { body } = await fresh({}, { clientData: { challenge: b64(randomBytes(32)) } });
    const before = await snapshot();
    expectGone(await send(SIGN_IN, body));
    expect(await snapshot()).toEqual(before);
  });

  it("refuses a challenge that is not even a challenge's shape, with gone", async () => {
    const { body } = await fresh({}, { clientData: { challenge: "not a challenge" } });
    expectGone(await send(SIGN_IN, body));
  });

  it("refuses the very same accepted request a second time, with gone", async () => {
    const { body } = await fresh();
    expect((await send(SIGN_IN, body)).status).toBe(200);
    const sessions = await count("sessions");
    expectGone(await send(SIGN_IN, body));
    expect(await count("sessions")).toBe(sessions);
  });

  it("refuses a challenge that ran out, with gone", async () => {
    const { publicKey, body } = await fresh();
    await env.DB.prepare("UPDATE challenges SET expires = ? WHERE id = ?").bind(PAST, publicKey.challenge).run();
    expectGone(await send(SIGN_IN, body));
  });

  it("refuses a challenge made for a new passkey, with gone, and uses it up", async () => {
    const made = await signUpWithPasskey();
    const { publicKey: created } = await must("POST", "/sign-in/new-passkey/options");
    const asked = { challenge: created.challenge, rpId: "litbible.net" };
    const body = { credential: await assert(made.passkey, asked) };
    expectGone(await send(SIGN_IN, body));
    expect(await challengeRow(created.challenge)).toBeNull();
  });

  it("refuses a challenge made for a provider's nonce, with gone", async () => {
    const made = await signUpWithPasskey();
    const row = b64(randomBytes(32));
    await env.DB.prepare("INSERT INTO challenges (id, purpose, account, handle, expires) VALUES (?, 'provider', NULL, NULL, '2999-01-01T00:00:00.000Z')").bind(row).run();
    const body = { credential: await assert(made.passkey, { challenge: row, rpId: "litbible.net" }) };
    expectGone(await send(SIGN_IN, body));
    expect(await challengeRow(row)).toBeNull();
  });

  it("uses the challenge up even when the origin is refused: sent again with the right origin, it is gone", async () => {
    const { passkey, publicKey, body } = await fresh({}, { origin: "https://evil.example" });
    expectPasskeyRefused(await send(SIGN_IN, body), "origin");
    expect(await challengeRow(publicKey.challenge)).toBeNull();
    const again = { credential: await assert(passkey, publicKey) };
    expectGone(await send(SIGN_IN, again));
  });

  const LATER = [
    ["a passkey the service does not know", async () => {
      const passkey = await newPasskey();
      return passkeySignInRequest(passkey);
    }, "unknown"],
    ["another RP", async () => (await fresh({}, { rpId: "evil.example" })), "rp"],
    ["a wrong signature", async () => (await fresh({}, { signWith: await newPasskey() })), "signature"],
    ["a user handle that is not the account's", async () => (await fresh({}, { userHandle: b64(randomBytes(32)) })), "user"],
  ];
  for (const [name, build, reason] of LATER) {
    it(`uses the challenge up when the request is refused for ${name}`, async () => {
      const { publicKey, body } = await build();
      expectPasskeyRefused(await send(SIGN_IN, body), reason);
      expect(await challengeRow(publicKey.challenge)).toBeNull();
    });
  }

  it("uses the challenge up on a counter refusal too", async () => {
    const made = await signUpWithPasskey({ counting: true });
    await signInWithPasskey(made.passkey);
    const { publicKey, body } = await passkeySignInRequest(made.passkey, { count: 1 });
    expectPasskeyRefused(await send(SIGN_IN, body), "counter");
    expect(await challengeRow(publicKey.challenge)).toBeNull();
  });

  it("checks the challenge before the origin", async () => {
    const { body } = await fresh({}, { origin: "https://evil.example", clientData: { challenge: b64(randomBytes(32)) } });
    expectGone(await send(SIGN_IN, body));
  });
});

/* ── 2e. The origin ─────────────────────────────────────────────────────── */

describe("POST /sign-in/passkey, the origin", () => {
  const ORIGINS = {
    "another site": "https://evil.example",
    "the www host": "https://www.litbible.net",
    "a plain http address": "http://litbible.net",
    "an address with a trailing slash": "https://litbible.net/",
    "an address with the default port written": "https://litbible.net:443",
    "an address with a path": "https://litbible.net/read",
    "a different case": "https://LITBIBLE.NET",
    "an Android key hash that is not configured": "android:apk-key-hash:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "an Android prefix alone": "android:apk-key-hash:",
    "an empty origin": "",
  };
  for (const [name, origin] of Object.entries(ORIGINS)) {
    it(`refuses ${name} (${JSON.stringify(origin)}), with the reason origin`, async () => {
      const { body } = await fresh({}, { origin });
      const before = await snapshot();
      expectPasskeyRefused(await send(SIGN_IN, body), "origin");
      expect(await snapshot()).toEqual(before);
    });
  }

  it("refuses the local origin where the environment is not the preview", async () => {
    const { body } = await fresh({}, { origin: LOCAL_ORIGIN });
    expectPasskeyRefused(await send(SIGN_IN, body, { env: { ENVIRONMENT: "production" } }), "origin");
  });

  it("refuses the local origin where the environment is not set at all", async () => {
    const { body } = await fresh({}, { origin: LOCAL_ORIGIN });
    expectPasskeyRefused(await send(SIGN_IN, body, { env: { ENVIRONMENT: undefined } }), "origin");
  });

  it("refuses a local address on another port, or another scheme, even on the preview", async () => {
    for (const origin of ["http://localhost:4322", "https://localhost:4321", "http://localhost"]) {
      const { body } = await fresh({}, { origin });
      expectPasskeyRefused(await send(SIGN_IN, body), "origin");
    }
  });

  it("checks the origin before it looks for the passkey", async () => {
    const passkey = await newPasskey();
    const { body } = await passkeySignInRequest(passkey, { origin: "https://evil.example" });
    expectPasskeyRefused(await send(SIGN_IN, body), "origin");
  });
});

/* ── 2f. A passkey the service does not know ────────────────────────────── */

describe("POST /sign-in/passkey, a passkey the service does not know", () => {
  it("refuses one that was never registered, with the reason unknown", async () => {
    const passkey = await newPasskey();
    const { body } = await passkeySignInRequest(passkey);
    const before = await snapshot();
    expectPasskeyRefused(await send(SIGN_IN, body), "unknown");
    expect(await snapshot()).toEqual(before);
  });

  it("refuses one that the preview listed without a ceremony, because that way in has no public key", async () => {
    const passkey = await newPasskey();
    const token = await signIn(freshAccount());
    await must("POST", "/preview/passkeys", { token, body: { credential: passkey.id, syncs: true } });
    const { body } = await passkeySignInRequest(passkey);
    const before = await snapshot();
    expectPasskeyRefused(await send(SIGN_IN, body), "unknown");
    expect(await snapshot()).toEqual(before);
  });

  it("refuses a registered passkey's key under an id the service has never seen", async () => {
    const { body } = await fresh({}, { id: bytesOf(20) });
    expectPasskeyRefused(await send(SIGN_IN, body), "unknown");
  });

  it("looks for the passkey before it checks the user handle", async () => {
    const passkey = await newPasskey();
    const { body } = await passkeySignInRequest(passkey, { userHandle: b64(randomBytes(32)) });
    expectPasskeyRefused(await send(SIGN_IN, body), "unknown");
  });
});

/* ── 2g. The user handle ────────────────────────────────────────────────── */

describe("POST /sign-in/passkey, the user handle", () => {
  it("refuses a handle that is not the account's, with the reason user", async () => {
    const { body } = await fresh({}, { userHandle: b64(randomBytes(32)) });
    const before = await snapshot();
    expectPasskeyRefused(await send(SIGN_IN, body), "user");
    expect(await snapshot()).toEqual(before);
  });

  it("refuses another account's handle", async () => {
    const other = await signUpWithPasskey();
    const { body } = await fresh({}, { userHandle: other.passkey.handle });
    expectPasskeyRefused(await send(SIGN_IN, body), "user");
  });

  it("refuses a handle that differs from the account's by one character", async () => {
    const made = await signUpWithPasskey();
    const handle = made.passkey.handle;
    const changed = (handle[0] === "A" ? "B" : "A") + handle.slice(1);
    const { body } = await passkeySignInRequest(made.passkey, { userHandle: changed });
    expectPasskeyRefused(await send(SIGN_IN, body), "user");
  });

  it("accepts leaving the handle out", async () => {
    const made = await signUpWithPasskey();
    const { body } = await passkeySignInRequest(made.passkey, { userHandle: null });
    expect(body.credential.response).not.toHaveProperty("userHandle");
    expect((await send(SIGN_IN, body)).status).toBe(200);
  });

  it("checks the handle before the authenticator data", async () => {
    const { body } = await fresh({}, { userHandle: b64(randomBytes(32)), rpId: "evil.example" });
    expectPasskeyRefused(await send(SIGN_IN, body), "user");
  });
});

/* ── 2h. Authenticator data ─────────────────────────────────────────────── */

describe("POST /sign-in/passkey, the authenticator data", () => {
  /** Each row: a passkey kind, one change, and the reason. `change` may take the passkey. */
  const ROWS = [
    ["another RP (evil.example)", {}, { rpId: "evil.example" }, "rp"],
    ["the RP localhost, from the website's origin", {}, { rpId: "localhost" }, "rp"],
    ["the RP litbible.net, from the local origin", {}, { rpId: "litbible.net", origin: LOCAL_ORIGIN }, "rp", { origin: LOCAL_ORIGIN }],
    ["the RP's name with a different case", {}, { rpId: "LitBible.net" }, "rp"],
    ["the user-present flag clear", {}, { flags: FLAGS.UV | FLAGS.BE | FLAGS.BS }, "presence"],
    ["no flags at all", {}, { flags: 0 }, "presence"],
    ["the user-verified flag clear", {}, { flags: FLAGS.UP | FLAGS.BE | FLAGS.BS }, "verification"],
    ["backed up without backup-eligible, on a passkey that syncs", {}, { flags: FLAGS.UP | FLAGS.UV | FLAGS.BS }, "backup"],
    ["backed up without backup-eligible, on one that does not sync", { syncs: false }, { flags: FLAGS.UP | FLAGS.UV | FLAGS.BS }, "backup"],
    ["backup-eligible clear, on a passkey registered as backup-eligible", {}, { flags: FLAGS.UP | FLAGS.UV }, "backup"],
    ["backup-eligible set, on a passkey registered without it", { syncs: false }, { flags: FLAGS.UP | FLAGS.UV | FLAGS.BE }, "backup"],
  ];
  for (const [name, make, o, reason, up] of ROWS) {
    it(`refuses ${name}, with the reason ${reason}`, async () => {
      const { body } = await fresh(make, o, up);
      const before = await snapshot();
      expectPasskeyRefused(await send(SIGN_IN, body), reason);
      expect(await snapshot()).toEqual(before);
    });
  }

  const SHAPES = {
    "attested credential data, which only a registration carries": (p) =>
      signInData(p, { flags: okFlags(p) | FLAGS.AT, attested: { id: p.credentialId, key: coseKey(p) } }),
    "the attested-data flag with nothing after it": (p) => signInData(p, { flags: okFlags(p) | FLAGS.AT }),
    "the attested-data flag with the data cut short in its id": async (p) =>
      (await signInData(p, { flags: okFlags(p) | FLAGS.AT, attested: { id: p.credentialId, key: coseKey(p) } })).subarray(0, 37 + 18 + 5),
    "the attested-data flag with the data cut short in its key": async (p) =>
      (await signInData(p, { flags: okFlags(p) | FLAGS.AT, attested: { id: p.credentialId, key: coseKey(p) } })).slice(0, -5),
    "a byte after the end": async (p) => concat(await signInData(p), Uint8Array.of(0)),
    "bytes after the end": async (p) => concat(await signInData(p), randomBytes(16)),
    "the extension-data flag with no extension data": (p) => signInData(p, { flags: okFlags(p) | FLAGS.ED }),
    "the extension-data flag with data that is not a map": (p) =>
      signInData(p, { flags: okFlags(p) | FLAGS.ED, extensions: 5 }),
    "the extension-data flag with an array": (p) => signInData(p, { flags: okFlags(p) | FLAGS.ED, extensions: [1, 2] }),
    "extension data announced by no flag": (p) => signInData(p, { extensions: new Map([["credBlob", true]]) }),
    "extension data cut short": async (p) =>
      (await signInData(p, { flags: okFlags(p) | FLAGS.ED, extensions: new Map([["credBlob", true]]) })).slice(0, -3),
  };
  for (const [name, make] of Object.entries(SHAPES)) {
    it(`refuses ${name}, with the reason authenticator_data`, async () => {
      const made = await signUpWithPasskey();
      const authData = await make(made.passkey);
      const { body } = await passkeySignInRequest(made.passkey, { authData });
      expectPasskeyRefused(await send(SIGN_IN, body), "authenticator_data");
    });
  }

  it("accepts the extension-data flag with a real extensions map, and keeps the counter", async () => {
    const made = await signUpWithPasskey();
    const { body } = await passkeySignInRequest(made.passkey, { extensions: new Map([["credProps", new Map([["rk", true]])]]) });
    expect((await send(SIGN_IN, body)).status).toBe(200);
  });

  it("checks the RP before the user-present flag", async () => {
    const { body } = await fresh({}, { rpId: "evil.example", flags: FLAGS.UV });
    expectPasskeyRefused(await send(SIGN_IN, body), "rp");
  });

  it("checks the user-present flag before the user-verified flag", async () => {
    const { body } = await fresh({}, { flags: FLAGS.BE | FLAGS.BS });
    expectPasskeyRefused(await send(SIGN_IN, body), "presence");
  });

  it("checks attested data before the RP", async () => {
    const made = await signUpWithPasskey();
    const authData = await signInData(made.passkey, { rpId: "evil.example", flags: okFlags(made.passkey) | FLAGS.AT, attested: { id: made.passkey.credentialId, key: coseKey(made.passkey) } });
    const { body } = await passkeySignInRequest(made.passkey, { authData });
    expectPasskeyRefused(await send(SIGN_IN, body), "authenticator_data");
  });
});

/* ── 2i. The signature ──────────────────────────────────────────────────── */

describe("POST /sign-in/passkey, the signature", () => {
  const ALGS = [
    ["ES256", {}],
    ["RS256", { alg: -257, syncs: false }],
  ];
  for (const [label, make] of ALGS) {
    describe(label, () => {
      const ROWS = {
        "signed by another passkey's key": async (p) => ({ o: { signWith: await newPasskey(make) } }),
        "signed by a key of the other algorithm": async () => ({ o: { signWith: await newPasskey(make.alg ? {} : { alg: -257, syncs: false }) } }),
        "random bytes": async () => ({ o: { signature: randomBytes(make.alg ? 256 : 70) } }),
        "a single zero byte": async () => ({ o: { signature: Uint8Array.of(0) } }),
        "authenticator data altered after signing": async () => ({
          tamper: (body) => {
            const data = un(body.credential.response.authenticatorData);
            data[36] ^= 1;
            body.credential.response.authenticatorData = b64(data);
          },
        }),
        "client data altered after signing, still valid JSON with the same challenge": async () => ({
          tamper: (body) => {
            const data = JSON.parse(new TextDecoder().decode(un(body.credential.response.clientDataJSON)));
            data.extra = true;
            body.credential.response.clientDataJSON = b64(utf8(JSON.stringify(data)));
          },
        }),
        "client data with its members in another order": async () => ({
          tamper: (body) => {
            const data = JSON.parse(new TextDecoder().decode(un(body.credential.response.clientDataJSON)));
            body.credential.response.clientDataJSON = b64(utf8(JSON.stringify(Object.fromEntries(Object.entries(data).reverse()))));
          },
        }),
        "truncated": async () => ({
          tamper: (body) => {
            const signature = un(body.credential.response.signature);
            body.credential.response.signature = b64(signature.slice(0, make.alg ? 128 : signature.length - 8));
          },
        }),
        "one byte short": async () => ({
          tamper: (body) => {
            const signature = un(body.credential.response.signature);
            body.credential.response.signature = b64(signature.slice(0, -1));
          },
        }),
        "with a byte added at the end": async () => ({
          tamper: (body) => {
            body.credential.response.signature = b64(concat(un(body.credential.response.signature), Uint8Array.of(0)));
          },
        }),
        "with a bit flipped": async () => ({
          tamper: (body) => {
            const signature = un(body.credential.response.signature);
            signature[signature.length - 1] ^= 1;
            body.credential.response.signature = b64(signature);
          },
        }),
      };
      for (const [name, build] of Object.entries(ROWS)) {
        it(`refuses a signature that is ${name}, with the reason signature`, async () => {
          const made = await signUpWithPasskey(make);
          const { o = {}, tamper } = await build(made.passkey);
          const { body } = await passkeySignInRequest(made.passkey, o);
          tamper?.(body);
          const before = await snapshot();
          expectPasskeyRefused(await send(SIGN_IN, body), "signature");
          expect(await snapshot()).toEqual(before);
        });
      }
    });
  }

  it("refuses an ES256 signature that is the raw 64 bytes and not ASN.1", async () => {
    const made = await signUpWithPasskey();
    const { publicKey } = await optionsFor("/sign-in/passkey/options");
    const authData = await signInData(made.passkey);
    const clientDataJSON = clientBytes(publicKey);
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", clientDataJSON));
    const raw = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, made.passkey.keys.privateKey, concat(authData, hash)));
    const body = { credential: await assert(made.passkey, publicKey, { authData, clientDataJSON, signature: raw }) };
    expectPasskeyRefused(await send(SIGN_IN, body), "signature");
  });

  it("accepts the same hand-built request when the signature is in ASN.1, so the refusal above is the encoding", async () => {
    const made = await signUpWithPasskey();
    const { publicKey } = await optionsFor("/sign-in/passkey/options");
    const authData = await signInData(made.passkey);
    const clientDataJSON = clientBytes(publicKey);
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", clientDataJSON));
    const signature = await signAs(made.passkey, concat(authData, hash));
    const body = { credential: await assert(made.passkey, publicKey, { authData, clientDataJSON, signature }) };
    expect((await send(SIGN_IN, body)).status).toBe(200);
  });

  it("checks the signature before the counter", async () => {
    const made = await signUpWithPasskey({ counting: true });
    await signInWithPasskey(made.passkey);
    const { body } = await passkeySignInRequest(made.passkey, { count: 0, signWith: await newPasskey() });
    expectPasskeyRefused(await send(SIGN_IN, body), "signature");
    expect(await storedCount(made.way.id)).toBe(1);
  });
});

/* ── 2j. The counter ────────────────────────────────────────────────────── */

describe("POST /sign-in/passkey, the counter", () => {
  async function counted(times) {
    const made = await signUpWithPasskey({ counting: true });
    for (let i = 0; i < times; i++) await signInWithPasskey(made.passkey);
    return made;
  }

  it("moves the stored count forward with each sign-in", async () => {
    const made = await counted(3);
    expect(await storedCount(made.way.id)).toBe(3);
  });

  it("refuses a count equal to the last one stored, with the reason counter", async () => {
    const made = await counted(1);
    const { body } = await passkeySignInRequest(made.passkey, { count: 1 });
    const before = await snapshot();
    expectPasskeyRefused(await send(SIGN_IN, body), "counter");
    expect(await snapshot()).toEqual(before);
    expect(await storedCount(made.way.id)).toBe(1);
  });

  it("refuses the same sign-in sent twice only by its challenge being gone, and a fresh one at the same count by the counter", async () => {
    const made = await counted(2);
    const { body } = await passkeySignInRequest(made.passkey, { count: 2 });
    expectPasskeyRefused(await send(SIGN_IN, body), "counter");
    expectGone(await send(SIGN_IN, body));
  });

  for (const lower of [2, 1]) {
    it(`refuses a count of ${lower} after 3, with the reason counter`, async () => {
      const made = await counted(3);
      const { body } = await passkeySignInRequest(made.passkey, { count: lower });
      expectPasskeyRefused(await send(SIGN_IN, body), "counter");
      expect(await storedCount(made.way.id)).toBe(3);
    });
  }

  it("refuses a count of 0 after a nonzero count, with the reason counter", async () => {
    const made = await counted(2);
    const { body } = await passkeySignInRequest(made.passkey, { count: 0 });
    expectPasskeyRefused(await send(SIGN_IN, body), "counter");
    expect(await storedCount(made.way.id)).toBe(2);
  });

  it("accepts a counter that jumps ahead, stores it, and then refuses the one before it", async () => {
    const made = await counted(1);
    const jump = await passkeySignInRequest(made.passkey, { count: 100 });
    expect((await send(SIGN_IN, jump.body)).status).toBe(200);
    expect(await storedCount(made.way.id)).toBe(100);
    for (const stale of [100, 99, 2]) {
      const { body } = await passkeySignInRequest(made.passkey, { count: stale });
      expectPasskeyRefused(await send(SIGN_IN, body), "counter");
    }
    expect(await storedCount(made.way.id)).toBe(100);
  });

  it("accepts a count as large as four bytes hold", async () => {
    const made = await counted(1);
    const { body } = await passkeySignInRequest(made.passkey, { count: 0xffffffff });
    expect((await send(SIGN_IN, body)).status).toBe(200);
    expect(await storedCount(made.way.id)).toBe(0xffffffff);
  });

  it("lets a passkey that never counts sign in again and again, and leaves its count at 0", async () => {
    const made = await signUpWithPasskey();
    for (let i = 0; i < 4; i++) await signInWithPasskey(made.passkey);
    expect(await storedCount(made.way.id)).toBe(0);
  });

  it("lets a passkey that keeps a counter sign in at 0 while its stored count is still 0", async () => {
    const made = await signUpWithPasskey({ counting: true });
    const { body } = await passkeySignInRequest(made.passkey, { count: 0 });
    expect((await send(SIGN_IN, body)).status).toBe(200);
    expect(await storedCount(made.way.id)).toBe(0);
  });

  it("stores the count a registration gave, and counts from there", async () => {
    const passkey = await newPasskey({ counting: true });
    passkey.count = 7;
    const { publicKey } = await optionsFor("/sign-in/new-passkey/options");
    const made = await must("POST", NEW, { body: { credential: await attest(passkey, publicKey) } });
    expect(await storedCount(made.way.id)).toBe(7);
    for (const stale of [7, 3, 0]) {
      const { body } = await passkeySignInRequest(passkey, { count: stale });
      expectPasskeyRefused(await send(SIGN_IN, body), "counter");
    }
    expect((await signInWithPasskey(passkey)).created).toBe(false);
    expect(await storedCount(made.way.id)).toBe(8);
  });
});

/* ── 2l. A refused sign-in writes nothing ───────────────────────────────── */

describe("POST /sign-in/passkey, a refusal writes nothing", () => {
  const CASES = {
    "an origin": (p) => passkeySignInRequest(p, { origin: "https://evil.example" }),
    "an RP": (p) => passkeySignInRequest(p, { rpId: "evil.example" }),
    "a user": (p) => passkeySignInRequest(p, { userHandle: b64(randomBytes(32)) }),
    "a signature": async (p) => passkeySignInRequest(p, { signWith: await newPasskey({ counting: true }) }),
    "a counter": (p) => passkeySignInRequest(p, { count: 0 }),
    "a presence flag": (p) => passkeySignInRequest(p, { flags: FLAGS.UV | FLAGS.BE | FLAGS.BS }),
  };
  for (const [name, build] of Object.entries(CASES)) {
    it(`leaves the sessions and the stored count as they were, for ${name}`, async () => {
      const made = await signUpWithPasskey({ counting: true });
      await signInWithPasskey(made.passkey);
      const before = { ...(await snapshot()), count: await storedCount(made.way.id) };
      const { body } = await build(made.passkey);
      const res = await send(SIGN_IN, body);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect({ ...(await snapshot()), count: await storedCount(made.way.id) }).toEqual(before);
    });
  }
});

/* ── 4. POST /sign-in/new-passkey ───────────────────────────────────────── */

describe("POST /sign-in/new-passkey, accepted", () => {
  it("answers time, token, expires, created true, and the way, and nothing else", async () => {
    const { passkey, body } = await freshNew();
    const res = await send(NEW, body);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(["created", "expires", "time", "token", "way"]);
    expect(res.body.created).toBe(true);
    expect(res.body.way).toEqual({ id: expect.stringMatching(UUID), kind: "passkey", added: expect.any(String), credential: passkey.id, syncs: true });
    expect(res.body.token).toMatch(TOKEN);
  });

  it("makes an account with one way in and no notebook, and a session that works", async () => {
    const { publicKey, body } = await freshNew();
    const before = await snapshot();
    const res = await send(NEW, body);
    expect(await snapshot()).toEqual({ accounts: before.accounts + 1, ways: before.ways + 1, sessions: before.sessions + 1 });
    const account = await must("GET", "/account", { token: res.body.token });
    expect(account.notebook).toBeNull();
    expect(account.kid).toBe(0);
    expect(account.ways).toEqual([res.body.way]);
    const stored = await env.DB.prepare("SELECT a.handle FROM accounts a JOIN ways w ON w.account = a.id WHERE w.id = ?").bind(res.body.way.id).first();
    expect(stored.handle).toBe(publicKey.user.id);
  });

  it("accepts an RS256 passkey that does not sync", async () => {
    const { body } = await freshNew({ alg: -257, syncs: false });
    const res = await send(NEW, body);
    expect(res.status).toBe(200);
    expect(res.body.way.syncs).toBe(false);
  });

  it("reads nothing in the attestation statement: packed with a statement is accepted", async () => {
    const { body } = await freshNew({}, { fmt: "packed", attStmt: new Map([["alg", -7], ["sig", randomBytes(70)], ["x5c", [randomBytes(10)]]]) });
    expect((await send(NEW, body)).status).toBe(200);
  });

  it("reads no format name: any text is accepted", async () => {
    const { body } = await freshNew({}, { fmt: "something-new", attStmt: new Map([["anything", 1]]) });
    expect((await send(NEW, body)).status).toBe(200);
  });

  it("accepts extension data (the ED flag with a map)", async () => {
    const { body } = await freshNew({}, { extensions: new Map([["credProtect", 2]]) });
    expect((await send(NEW, body)).status).toBe(200);
  });

  it("accepts a PRF that only says it is enabled", async () => {
    const { body } = await freshNew({}, { clientExtensionResults: { prf: { enabled: true } } });
    expect((await send(NEW, body)).status).toBe(200);
  });

  it("accepts a response with no rawId, and with clientExtensionResults null", async () => {
    const { body } = await freshNew();
    delete body.credential.rawId;
    body.credential.clientExtensionResults = null;
    expect((await send(NEW, body)).status).toBe(200);
  });

  describe("from each origin it accepts", () => {
    for (const origin of [ORIGIN, ...ANDROID_ORIGINS, LOCAL_ORIGIN]) {
      it(origin, async () => {
        const { body } = await freshNew({}, { origin });
        expect((await send(NEW, body)).status).toBe(200);
      });
    }
  });
});

describe("POST /sign-in/new-passkey, the form", () => {
  formChecks(NEW, () => freshNew(), REGISTRATION_FORM);
});

describe("POST /sign-in/new-passkey, the client data", () => {
  for (const [name, type] of [["webauthn.get", "webauthn.get"], ["another type", "webauthn.other"], ["a null type", null]]) {
    it(`refuses ${name} as the type, with the reason type`, async () => {
      const { body } = await freshNew({}, { clientData: { type } });
      expectPasskeyRefused(await send(NEW, body), "type");
    });
  }

  for (const [name, bytes] of [
    ["is not JSON", utf8("nope")],
    ["is an array", utf8("[]")],
    ["is null", utf8("null")],
    ["is an empty object", utf8("{}")],
    ["is not UTF-8", Uint8Array.of(0x7b, 0xff, 0x7d)],
  ]) {
    it(`refuses client data that ${name}, with the reason client_data`, async () => {
      const { body } = await freshNew({}, { clientDataJSON: bytes });
      expectPasskeyRefused(await send(NEW, body), "client_data");
    });
  }

  for (const [name, edit] of [
    ["no challenge", (d) => delete d.challenge],
    ["a challenge that is a number", (d) => (d.challenge = 1)],
    ["no origin", (d) => delete d.origin],
    ["an origin that is a number", (d) => (d.origin = 1)],
  ]) {
    it(`refuses client data with ${name}, with the reason client_data`, async () => {
      const passkey = await newPasskey();
      const { publicKey } = await optionsFor("/sign-in/new-passkey/options");
      const data = JSON.parse(new TextDecoder().decode(clientBytes(publicKey, {}, "webauthn.create")));
      edit(data);
      const body = { credential: await attest(passkey, publicKey, { clientDataJSON: utf8(JSON.stringify(data)) }) };
      expectPasskeyRefused(await send(NEW, body), "client_data");
    });
  }

  it("refuses crossOrigin true, with the reason cross_origin", async () => {
    const { body } = await freshNew({}, { clientData: { crossOrigin: true } });
    expectPasskeyRefused(await send(NEW, body), "cross_origin");
  });

  it("refuses before the challenge is used", async () => {
    const { passkey, publicKey, body } = await freshNew({}, { clientData: { type: "webauthn.get" } });
    expectPasskeyRefused(await send(NEW, body), "type");
    expect(await challengeRow(publicKey.challenge)).not.toBeNull();
    expect((await send(NEW, { credential: await attest(passkey, publicKey) })).status).toBe(200);
  });
});

describe("POST /sign-in/new-passkey, the challenge", () => {
  it("refuses a challenge the service never made, with gone", async () => {
    const { body } = await freshNew({}, { clientData: { challenge: b64(randomBytes(32)) } });
    const before = await snapshot();
    expectGone(await send(NEW, body));
    expect(await snapshot()).toEqual(before);
  });

  it("refuses the very same accepted request a second time, with gone", async () => {
    const { body } = await freshNew();
    expect((await send(NEW, body)).status).toBe(200);
    const before = await snapshot();
    expectGone(await send(NEW, body));
    expect(await snapshot()).toEqual(before);
  });

  it("refuses a challenge that ran out, with gone", async () => {
    const { publicKey, body } = await freshNew();
    await env.DB.prepare("UPDATE challenges SET expires = ? WHERE id = ?").bind(PAST, publicKey.challenge).run();
    const before = await snapshot();
    expectGone(await send(NEW, body));
    expect(await snapshot()).toEqual(before);
  });

  it("refuses a challenge made for signing in, with gone, and uses it up", async () => {
    const passkey = await newPasskey();
    const { publicKey: asked } = await must("POST", "/sign-in/passkey/options");
    const fake = { challenge: asked.challenge, rp: { id: "litbible.net" }, user: { id: b64(randomBytes(32)) } };
    const body = { credential: await attest(passkey, fake) };
    expectGone(await send(NEW, body));
    expect(await challengeRow(asked.challenge)).toBeNull();
  });

  it("uses the challenge up even when the origin is refused: sent again with the right origin, it is gone", async () => {
    const { passkey, publicKey, body } = await freshNew({}, { origin: "https://evil.example" });
    expectPasskeyRefused(await send(NEW, body), "origin");
    expect(await challengeRow(publicKey.challenge)).toBeNull();
    expectGone(await send(NEW, { credential: await attest(passkey, publicKey) }));
  });

  it("uses the challenge up when the attestation is refused", async () => {
    const { publicKey, body } = await freshNew({}, { attestationObject: Uint8Array.of(0xff) });
    expectPasskeyRefused(await send(NEW, body), "attestation");
    expect(await challengeRow(publicKey.challenge)).toBeNull();
  });

  it("checks the challenge before the origin", async () => {
    const { body } = await freshNew({}, { origin: "https://evil.example", clientData: { challenge: b64(randomBytes(32)) } });
    expectGone(await send(NEW, body));
  });
});

describe("POST /sign-in/new-passkey, the origin", () => {
  const ORIGINS = {
    "another site": "https://evil.example",
    "the www host": "https://www.litbible.net",
    "a plain http address": "http://litbible.net",
    "an address with a trailing slash": "https://litbible.net/",
    "an address with the default port written": "https://litbible.net:443",
    "an Android key hash that is not configured": "android:apk-key-hash:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  };
  for (const [name, origin] of Object.entries(ORIGINS)) {
    it(`refuses ${name} (${origin}), with the reason origin`, async () => {
      const { body } = await freshNew({}, { origin });
      const before = await snapshot();
      expectPasskeyRefused(await send(NEW, body), "origin");
      expect(await snapshot()).toEqual(before);
    });
  }

  it("refuses the local origin where the environment is not the preview", async () => {
    const { body } = await freshNew({}, { origin: LOCAL_ORIGIN });
    expectPasskeyRefused(await send(NEW, body, { env: { ENVIRONMENT: "production" } }), "origin");
  });
});

describe("POST /sign-in/new-passkey, the attestation object", () => {
  const good = (p) => registrationData(p);
  const ROWS = {
    "bytes that are not CBOR": () => Uint8Array.of(0xff, 0xff),
    "bytes that end early": async (p) => (await attestationOf(await good(p))).slice(0, -10),
    "a float": () => Uint8Array.of(0xfb, 0, 0, 0, 0, 0, 0, 0, 0),
    "a CBOR array, not a map": () => cbor([1, 2]),
    "a CBOR number": () => cbor(5),
    "CBOR text": () => cbor("none"),
    "a map missing fmt": async (p) => cbor(new Map([["attStmt", new Map()], ["authData", await good(p)]])),
    "a map missing attStmt": async (p) => cbor(new Map([["fmt", "none"], ["authData", await good(p)]])),
    "a map missing authData": () => cbor(new Map([["fmt", "none"], ["attStmt", new Map()]])),
    "an empty map": () => cbor(new Map()),
    "a map with fmt that is a number": async (p) => cbor(new Map([["fmt", 1], ["attStmt", new Map()], ["authData", await good(p)]])),
    "a map with attStmt that is an array": async (p) => cbor(new Map([["fmt", "none"], ["attStmt", []], ["authData", await good(p)]])),
    "a map with attStmt that is text": async (p) => cbor(new Map([["fmt", "none"], ["attStmt", "x"], ["authData", await good(p)]])),
    "a map with authData that is text": () => cbor(new Map([["fmt", "none"], ["attStmt", new Map()], ["authData", "abc"]])),
    "a map with authData that is an array": () => cbor(new Map([["fmt", "none"], ["attStmt", new Map()], ["authData", [1, 2]]])),
    "a map followed by a byte": async (p) => concat(await attestationOf(await good(p)), Uint8Array.of(0)),
    "a map followed by a second map": async (p) => concat(await attestationOf(await good(p)), cbor(new Map())),
  };
  for (const [name, make] of Object.entries(ROWS)) {
    it(`refuses ${name}, with the reason attestation`, async () => {
      const passkey = await newPasskey();
      const { publicKey } = await optionsFor("/sign-in/new-passkey/options");
      const attestationObject = await make(passkey);
      const body = { credential: await attest(passkey, publicKey, { attestationObject }) };
      const before = await snapshot();
      expectPasskeyRefused(await send(NEW, body), "attestation");
      expect(await snapshot()).toEqual(before);
    });
  }

  it("refuses a map that names a key twice, with the reason attestation", async () => {
    const passkey = await newPasskey();
    const { publicKey } = await optionsFor("/sign-in/new-passkey/options");
    const data = await registrationData(passkey);
    // Three entries, the first key written twice: the encoder can't write that, so it is spelled out.
    const twice = concat(Uint8Array.of(0xa3), cbor("fmt"), cbor("none"), cbor("fmt"), cbor("none"), cbor("authData"), cbor(data));
    const body = { credential: await attest(passkey, publicKey, { attestationObject: twice }) };
    expectPasskeyRefused(await send(NEW, body), "attestation");
  });
});

describe("POST /sign-in/new-passkey, the authenticator data", () => {
  const ROWS = [
    ["another RP", {}, { rpId: "evil.example" }, "rp"],
    ["the RP localhost, from the website's origin", {}, { rpId: "localhost" }, "rp"],
    ["the user-present flag clear", {}, { flags: FLAGS.UV | FLAGS.BE | FLAGS.BS | FLAGS.AT }, "presence"],
    ["the user-verified flag clear", {}, { flags: FLAGS.UP | FLAGS.BE | FLAGS.BS | FLAGS.AT }, "verification"],
    ["backed up without backup-eligible", {}, { flags: FLAGS.UP | FLAGS.UV | FLAGS.BS | FLAGS.AT }, "backup"],
  ];
  for (const [name, make, o, reason] of ROWS) {
    it(`refuses ${name}, with the reason ${reason}`, async () => {
      const { body } = await freshNew(make, o);
      const before = await snapshot();
      expectPasskeyRefused(await send(NEW, body), reason);
      expect(await snapshot()).toEqual(before);
    });
  }

  it("accepts a passkey that does not sync, with no backup flags", async () => {
    const { body } = await freshNew({ syncs: false });
    expect((await send(NEW, body)).status).toBe(200);
  });

  const SHAPES = {
    "no attested credential data (the flag clear)": (p) => registrationData(p, { flags: okFlags(p), attested: null }),
    "the attested-data flag with nothing after it": (p) => registrationData(p, { attested: null, flags: okFlags(p) | FLAGS.AT }),
    "attested data cut short in its id": async (p) => (await registrationData(p)).subarray(0, 37 + 18 + 5),
    "attested data cut short in its key": async (p) => (await registrationData(p)).slice(0, -5),
    "a byte after the end": async (p) => concat(await registrationData(p), Uint8Array.of(0)),
    "the extension-data flag with no extension data": (p) => registrationData(p, { flags: okFlags(p) | FLAGS.AT | FLAGS.ED }),
    "authenticator data of under 37 bytes": async (p) => (await registrationData(p)).subarray(0, 36),
    "a credential id of length zero": (p) => registrationData(p, { attested: { id: new Uint8Array(0), key: coseKey(p) } }),
    "a key that is not a map": (p) => registrationData(p, { attested: { id: p.credentialId, key: 5 } }),
  };
  for (const [name, make] of Object.entries(SHAPES)) {
    it(`refuses ${name}, with the reason authenticator_data`, async () => {
      const passkey = await newPasskey();
      const { publicKey } = await optionsFor("/sign-in/new-passkey/options");
      const authData = await make(passkey);
      const body = { credential: await attest(passkey, publicKey, { authData }) };
      const before = await snapshot();
      expectPasskeyRefused(await send(NEW, body), "authenticator_data");
      expect(await snapshot()).toEqual(before);
    });
  }

  it("refuses a credential id inside the data that differs from the id the response names, with the reason credential", async () => {
    const { body } = await freshNew({}, { id: bytesOf(20) });
    expectPasskeyRefused(await send(NEW, body), "credential");
  });

  it("refuses the other way round: the data names another id than the response", async () => {
    const passkey = await newPasskey();
    const { publicKey } = await optionsFor("/sign-in/new-passkey/options");
    const body = { credential: await attest(passkey, publicKey, { attested: { id: randomBytes(20), key: coseKey(passkey) } }) };
    expectPasskeyRefused(await send(NEW, body), "credential");
  });

  it("refuses an id that is a prefix of the one in the data", async () => {
    const passkey = await newPasskey();
    const { publicKey } = await optionsFor("/sign-in/new-passkey/options");
    const body = { credential: await attest(passkey, publicKey, { id: b64(passkey.credentialId.slice(0, 19)) }) };
    expectPasskeyRefused(await send(NEW, body), "credential");
  });

  it("checks the RP before the credential id", async () => {
    const { body } = await freshNew({}, { rpId: "evil.example", id: bytesOf(20) });
    expectPasskeyRefused(await send(NEW, body), "rp");
  });
});

describe("POST /sign-in/new-passkey, the public key", () => {
  const KEYS = {
    "EdDSA (key type 1, algorithm -8)": [(x) => new Map([[1, 1], [3, -8], [-1, 6], [-2, x]]), "algorithm"],
    "P-384 (key type 2, algorithm -7, curve 2)": [(x, y) => new Map([[1, 2], [3, -7], [-1, 2], [-2, x], [-3, y]]), "algorithm"],
    "an EC key with algorithm -257": [(x, y) => new Map([[1, 2], [3, -257], [-1, 1], [-2, x], [-3, y]]), "algorithm"],
    "an RSA key type with algorithm -7": [(x, y) => new Map([[1, 3], [3, -7], [-1, x], [-2, y]]), "algorithm"],
    "no algorithm at all": [(x, y) => new Map([[1, 2], [-1, 1], [-2, x], [-3, y]]), "algorithm"],
    "no key type at all": [(x, y) => new Map([[3, -7], [-1, 1], [-2, x], [-3, y]]), "algorithm"],
    "an EC key with no curve": [(x, y) => new Map([[1, 2], [3, -7], [-2, x], [-3, y]]), "algorithm"],
    "an x of 31 bytes": [(x, y) => new Map([[1, 2], [3, -7], [-1, 1], [-2, x.slice(0, 31)], [-3, y]]), "key"],
    "an x of 33 bytes": [(x, y) => new Map([[1, 2], [3, -7], [-1, 1], [-2, concat(Uint8Array.of(0), x)], [-3, y]]), "key"],
    "a y of 31 bytes": [(x, y) => new Map([[1, 2], [3, -7], [-1, 1], [-2, x], [-3, y.slice(0, 31)]]), "key"],
    "a y of 33 bytes": [(x, y) => new Map([[1, 2], [3, -7], [-1, 1], [-2, x], [-3, concat(Uint8Array.of(0), y)]]), "key"],
    "no x": [(x, y) => new Map([[1, 2], [3, -7], [-1, 1], [-3, y]]), "key"],
    "no y": [(x) => new Map([[1, 2], [3, -7], [-1, 1], [-2, x]]), "key"],
    "an x that is a number": [(x, y) => new Map([[1, 2], [3, -7], [-1, 1], [-2, 5], [-3, y]]), "key"],
    "a point that is not on the curve (x and y both 0x01)": [() => new Map([[1, 2], [3, -7], [-1, 1], [-2, new Uint8Array(32).fill(1)], [-3, new Uint8Array(32).fill(1)]]), "key"],
    "the point at all zeros": [() => new Map([[1, 2], [3, -7], [-1, 1], [-2, new Uint8Array(32)], [-3, new Uint8Array(32)]]), "key"],
  };
  for (const [name, [make, reason]] of Object.entries(KEYS)) {
    it(`refuses ${name}, with the reason ${reason}`, async () => {
      const passkey = await newPasskey();
      const { publicKey } = await optionsFor("/sign-in/new-passkey/options");
      const key = make(un(passkey.jwk.x), un(passkey.jwk.y));
      const body = { credential: await attest(passkey, publicKey, { attested: { id: passkey.credentialId, key } }) };
      const before = await snapshot();
      expectPasskeyRefused(await send(NEW, body), reason);
      expect(await snapshot()).toEqual(before);
    });
  }

  const RSA = {
    "a modulus of 255 bytes": (n) => n.slice(0, 255),
    "a modulus of 1 byte": () => Uint8Array.of(7),
    "a modulus of 1,025 bytes": (n) => concat(n, new Uint8Array(769)),
  };
  for (const [name, change] of Object.entries(RSA)) {
    it(`refuses an RSA key with ${name}, with the reason key`, async () => {
      const passkey = await newPasskey({ alg: -257, syncs: false });
      const { publicKey } = await optionsFor("/sign-in/new-passkey/options");
      const key = coseKey(passkey);
      key.set(-1, change(un(passkey.jwk.n)));
      const body = { credential: await attest(passkey, publicKey, { attested: { id: passkey.credentialId, key } }) };
      expectPasskeyRefused(await send(NEW, body), "key");
    });
  }

  it("refuses an RSA key with an exponent of 9 bytes, or none, with the reason key", async () => {
    for (const exponent of [new Uint8Array(9).fill(1), new Uint8Array(0)]) {
      const passkey = await newPasskey({ alg: -257, syncs: false });
      const { publicKey } = await optionsFor("/sign-in/new-passkey/options");
      const key = coseKey(passkey);
      key.set(-2, exponent);
      const body = { credential: await attest(passkey, publicKey, { attested: { id: passkey.credentialId, key } }) };
      expectPasskeyRefused(await send(NEW, body), "key");
    }
  });
});

describe("POST /sign-in/new-passkey, a passkey that is already someone's", () => {
  it("refuses the same passkey registered a second time, with exists naming passkey, and makes no second account", async () => {
    const passkey = await newPasskey();
    const first = await optionsFor("/sign-in/new-passkey/options");
    const one = await send(NEW, { credential: await attest(passkey, first.publicKey) });
    expect(one.status).toBe(200);
    const second = await optionsFor("/sign-in/new-passkey/options");
    const body = { credential: await attest(passkey, second.publicKey) };
    const before = await snapshot();
    expectRefused(await send(NEW, body), 409, "exists", { what: "passkey" });
    expect(await snapshot()).toEqual(before);
    const account = await must("GET", "/account", { token: one.body.token });
    expect(account.ways).toHaveLength(1);
  });

  it("refuses it from another origin too", async () => {
    const passkey = await newPasskey();
    const first = await optionsFor("/sign-in/new-passkey/options");
    expect((await send(NEW, { credential: await attest(passkey, first.publicKey) })).status).toBe(200);
    const second = await optionsFor("/sign-in/new-passkey/options");
    const body = { credential: await attest(passkey, second.publicKey, { origin: ANDROID_ORIGINS[0] }) };
    expectRefused(await send(NEW, body), 409, "exists", { what: "passkey" });
  });

  it("leaves the first account able to sign in with the passkey", async () => {
    const passkey = await newPasskey();
    const first = await optionsFor("/sign-in/new-passkey/options");
    const one = await must("POST", NEW, { body: { credential: await attest(passkey, first.publicKey) } });
    const handle = passkey.handle;
    const second = await optionsFor("/sign-in/new-passkey/options");
    await send(NEW, { credential: await attest(passkey, second.publicKey) });
    passkey.handle = handle;
    const again = await signInWithPasskey(passkey);
    expect(again.way.id).toBe(one.way.id);
  });
});

describe("POST /sign-in/new-passkey, a refusal makes nothing", () => {
  const CASES = {
    "a form": (b) => delete b.credential.type,
    "a PRF result": (b) => (b.credential.clientExtensionResults = { prf: { results: {} } }),
  };
  for (const [name, edit] of Object.entries(CASES)) {
    it(`makes no account, way, or session for ${name}`, async () => {
      const { body } = await freshNew();
      edit(body);
      const before = await snapshot();
      expect((await send(NEW, body)).status).toBeGreaterThanOrEqual(400);
      expect(await snapshot()).toEqual(before);
    });
  }
  const OVERRIDES = {
    "an origin": { origin: "https://evil.example" },
    "an RP": { rpId: "evil.example" },
    "a flag": { flags: FLAGS.AT },
    "a key": { attested: { id: new Uint8Array(0), key: new Map() } },
  };
  for (const [name, o] of Object.entries(OVERRIDES)) {
    it(`makes no account, way, or session for ${name}`, async () => {
      const { body } = await freshNew({}, o);
      const before = await snapshot();
      expect((await send(NEW, body)).status).toBeGreaterThanOrEqual(400);
      expect(await snapshot()).toEqual(before);
    });
  }
});

/* ── 5. Where passkeys are not configured ───────────────────────────────── */

describe("where passkeys are not configured", () => {
  const OFF = {
    "PASSKEY_RP_ID is not set": { PASSKEY_RP_ID: undefined },
    "PASSKEY_RP_ID is empty": { PASSKEY_RP_ID: "" },
    "PASSKEY_RP_ID is only spaces": { PASSKEY_RP_ID: "   " },
    "PASSKEY_ORIGINS is empty": { PASSKEY_ORIGINS: "" },
    "PASSKEY_ORIGINS is not set": { PASSKEY_ORIGINS: undefined },
  };
  const ROUTES = [SIGN_IN + "/options", SIGN_IN, NEW + "/options", NEW, "/ways/passkey/options", "/ways/passkey"];

  for (const [name, off] of Object.entries(OFF)) {
    describe(name, () => {
      for (const path of ROUTES) {
        it(`answers POST ${path} as it answers a path that was never written`, async () => {
          const token = await signIn(freshAccount());
          const body = { credential: { id: "AAAA" } };
          const asked = await call("POST", path, { token, env: off, body });
          const never = await call("POST", "/sign-in/never-written", { token, env: off, body });
          expect(asked.status).toBe(404);
          expect(asked.body.error).toBe("not_found");
          expect({ ...asked.body, time: 0 }).toEqual({ ...never.body, time: 0 });
          expect([...asked.headers].filter(([k]) => k !== "date")).toEqual([...never.headers].filter(([k]) => k !== "date"));
        });
      }

      it("makes no challenge, and GET /sign-in lists no passkey", async () => {
        const before = await count("challenges");
        await call("POST", SIGN_IN + "/options", { env: off });
        await call("POST", NEW + "/options", { env: off });
        expect(await count("challenges")).toBe(before);
        const listed = await must("GET", "/sign-in", { env: off });
        expect(listed.ways).not.toContain("passkey");
      });
    });
  }

  it("is on with the default configuration, so the cases above are the configuration's doing", async () => {
    expect((await must("GET", "/sign-in")).ways).toContain("passkey");
  });
});
