// Sign in with Apple and Sign in with Google, one check at a time: where the
// paths are off, the challenge, and each check the two sign-in requests make
// in the order they make it. Each test is a request that would be accepted,
// with exactly one thing changed. The whole flows are in sign-in.test.js.
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetProviderKeys } from "../src/jwt.js";
import { call } from "./call.js";
import {
  APPLE_CLIENT,
  APPLE_KEYS,
  APPLE_TOKEN,
  APPLE_WEB_CLIENT,
  GOOGLE_CLIENT,
  GOOGLE_CLIENT_2,
  GOOGLE_KEYS,
  challengeFor,
  freshSubject,
  idToken,
  providerRequest,
  providersOn,
  signInWith,
  signToken,
  signingKey,
  standDown,
  standIns,
} from "./idp.js";
import { must, ref } from "./notebook.js";

const b64 = ref.toBase64url;
const ascii = (text) => new TextEncoder().encode(text);
const seg = (value) => b64(ascii(JSON.stringify(value)));
const rawSeg = (text) => b64(ascii(text));
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const PROVIDERS = ["apple", "google"];
const ISSUER = { apple: "https://appleid.apple.com", google: "https://accounts.google.com" };
const CLIENT = { apple: APPLE_CLIENT, google: GOOGLE_CLIENT };
const SECOND_CLIENT = { apple: APPLE_WEB_CLIENT, google: GOOGLE_CLIENT_2 };
const KEYS = { apple: APPLE_KEYS, google: GOOGLE_KEYS };
const OTHER = { apple: "google", google: "apple" };

let on;
let world;

const count = async (table, where = "1 = 1", ...binds) =>
  (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).bind(...binds).first()).n;
const everything = async (table) => JSON.stringify((await env.DB.prepare(`SELECT * FROM ${table}`).all()).results);
const snapshot = async () => ({
  accounts: await count("accounts"),
  ways: await count("ways"),
  sessions: await count("sessions"),
  apple_tokens: await count("apple_tokens"),
});
const post = (provider, body, options = {}) => call("POST", `/sign-in/${provider}`, { env: on, body, ...options });
const appleCalls = () => world.calls.filter((c) => c.url === APPLE_TOKEN).length;

/** Claims a provider would issue for `challenge`, for tokens that are built by hand. */
function claimsFor(provider, challenge, over = {}) {
  const at = Math.floor(Date.now() / 1000);
  const all = { iss: ISSUER[provider], aud: CLIENT[provider], sub: freshSubject(), iat: at, exp: at + 600, nonce: challenge, ...over };
  for (const name of Object.keys(all)) if (all[name] === undefined) delete all[name];
  return all;
}

/** A token with these exact segments, signed (over them) by `key`. */
async function rawToken(key, headerSegment, payloadSegment) {
  const signed = `${headerSegment}.${payloadSegment}`;
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key.keys.privateKey, ascii(signed)));
  return `${signed}.${b64(signature)}`;
}

const fakeSignature = (bytes = 256) => b64(new Uint8Array(bytes).fill(1));

/** Makes a challenge, builds the token for it, and sends the sign-in. */
async function via(provider, makeToken, extra = {}) {
  const challenge = await challengeFor(on);
  const body = { challenge, idToken: await makeToken(challenge), ...(provider === "apple" ? { code: `code-${freshSubject()}` } : {}), ...extra };
  return { body, res: await post(provider, body) };
}

const withClaims = (provider, claims, header) => (challenge) => idToken(provider, challenge, { claims, header });

/** Expects the token to be refused for `reason`, with nothing written and the challenge spent. */
async function refusedAs(provider, makeToken, reason) {
  const before = await snapshot();
  const exchanges = appleCalls();
  const { res, body } = await via(provider, makeToken);
  expect(res.status, JSON.stringify(res.body)).toBe(403);
  expect(res.body.error).toBe("token_refused");
  expect(res.body.reason).toBe(reason);
  expect(await snapshot()).toEqual(before);
  expect(await count("challenges", "id = ?", body.challenge)).toBe(0);
  expect(appleCalls()).toBe(exchanges);
  return res;
}

async function acceptedAs(provider, makeToken) {
  const { res } = await via(provider, makeToken);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  expect(res.body.created).toBe(true);
  return res.body;
}

/** The test's fetch, with one address answering something else. Returns what puts the old one back. */
function answerKeysWith(address, make) {
  const inner = globalThis.fetch;
  vi.stubGlobal("fetch", async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    if (url !== address) return inner(input, init);
    world.calls.push({ url, method: "GET", form: null, headers: {} });
    return make();
  });
  return () => vi.stubGlobal("fetch", inner);
}
const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

/** The configured environments, and what a path answers where it is off. */
const NONE = { GOOGLE_CLIENT_IDS: undefined, APPLE_CLIENT_IDS: undefined, APPLE_TEAM_ID: undefined, APPLE_KEY_ID: undefined, APPLE_PRIVATE_KEY: undefined };
const APPLE_PARTS = ["APPLE_CLIENT_IDS", "APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY"];

async function sameAsNeverWritten(path, environment) {
  const asked = await call("POST", path, { env: environment, body: {} });
  const never = await call("POST", "/sign-in/never-written", { env: environment, body: {} });
  expect(asked.status).toBe(404);
  expect(asked.body.error).toBe("not_found");
  expect({ ...asked.body, time: 0 }).toEqual({ ...never.body, time: 0 });
  expect([...asked.headers].filter(([k]) => k !== "date")).toEqual([...never.headers].filter(([k]) => k !== "date"));
}

const routed = async (path, environment) => (await call("POST", path, { env: environment, body: {} })).status !== 404;
/** The ways to sign in a deployment lists, less the passkey, whose own tests cover it. */
const providerWays = async (environment) => (await must("GET", "/sign-in", { env: environment })).ways.filter((w) => w !== "passkey");

describe("providers, where they are not configured", () => {
  const PATHS = ["/sign-in/challenge", "/sign-in/apple", "/sign-in/google", "/ways/apple", "/ways/google"];

  beforeEach(async () => {
    ({ env: on } = await providersOn());
  });

  for (const [name, environment] of [["the default test environment", {}], ["every provider variable unset", NONE]]) {
    for (const path of PATHS) {
      it(`answers POST ${path} as a path never written does, in ${name}`, async () => {
        await sameAsNeverWritten(path, environment);
      });
    }
  }

  it("lists neither Apple nor Google in the default test environment", async () => {
    expect(await providerWays({})).toEqual([]);
  });

  for (const value of [undefined, "", " ", ",", " , ", ", ,"]) {
    it(`treats GOOGLE_CLIENT_IDS of ${JSON.stringify(value)} as off, and leaves Apple's paths as they are`, async () => {
      const environment = { ...on, GOOGLE_CLIENT_IDS: value };
      for (const path of ["/sign-in/google", "/ways/google"]) await sameAsNeverWritten(path, environment);
      expect(await routed("/sign-in/apple", environment)).toBe(true);
      expect(await routed("/sign-in/challenge", environment)).toBe(true);
      expect(await providerWays(environment)).toEqual(["apple"]);
    });
  }

  for (const part of APPLE_PARTS) {
    const values = part === "APPLE_CLIENT_IDS" ? [undefined, "", "  ", " , "] : [undefined, "", "   "];
    for (const value of values) {
      it(`treats ${part} of ${JSON.stringify(value)} as turning Apple off, while Google still works`, async () => {
        const environment = { ...on, [part]: value };
        for (const path of ["/sign-in/apple", "/ways/apple"]) await sameAsNeverWritten(path, environment);
        expect(await routed("/sign-in/google", environment)).toBe(true);
        expect(await routed("/ways/google", environment)).toBe(true);
        expect(await routed("/sign-in/challenge", environment)).toBe(true);
        expect(await providerWays(environment)).toEqual(["google"]);
      });
    }
  }

  it("routes the challenge where only Google is on, and where only Apple is on", async () => {
    for (const environment of [{ ...on, ...NONE, GOOGLE_CLIENT_IDS: GOOGLE_CLIENT }, { ...on, GOOGLE_CLIENT_IDS: undefined }]) {
      const res = await call("POST", "/sign-in/challenge", { env: environment });
      expect(res.status).toBe(200);
      expect(res.body.challenge).toMatch(TOKEN);
    }
  });

  it("does not route the challenge where Apple is only partly configured and Google is off", async () => {
    for (const part of APPLE_PARTS) {
      await sameAsNeverWritten("/sign-in/challenge", { ...on, GOOGLE_CLIENT_IDS: undefined, [part]: undefined });
    }
  });

  it("lists the ways as { time, ways } in the order passkey, apple, google", async () => {
    const res = await call("GET", "/sign-in", { env: on });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["time", "ways"]);
    expect(res.body.ways).toContain("apple");
    expect(res.body.ways).toContain("google");
    expect(res.body.ways).toEqual(["passkey", "apple", "google"].filter((way) => res.body.ways.includes(way)));
  });

  it("lists apple only when all four of its variables are there", async () => {
    expect(await providerWays(on)).toEqual(["apple", "google"]);
    for (const part of APPLE_PARTS) expect(await providerWays({ ...on, [part]: undefined }), part).toEqual(["google"]);
  });
});

describe("POST /sign-in/challenge", () => {
  beforeEach(async () => {
    ({ env: on } = await providersOn());
  });

  it("needs no session and no body, and answers time, challenge, and expires", async () => {
    const res = await call("POST", "/sign-in/challenge", { env: on });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["time", "challenge", "expires"]);
    expect(res.body.challenge).toMatch(TOKEN);
    expect(ref.fromBase64url(res.body.challenge)).toHaveLength(32);
  });

  it("makes a different challenge each time", async () => {
    const seen = new Set();
    for (let i = 0; i < 8; i++) seen.add((await must("POST", "/sign-in/challenge", { env: on })).challenge);
    expect(seen.size).toBe(8);
  });

  it("expires the challenge five minutes on", async () => {
    const res = await call("POST", "/sign-in/challenge", { env: on });
    expect(res.body.expires).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    const span = Date.parse(res.body.expires) - Date.parse(res.body.time);
    expect(span).toBeGreaterThanOrEqual(299_000);
    expect(span).toBeLessThanOrEqual(301_000);
  });

  it("stores one row, for the purpose provider, with no account and no handle", async () => {
    const { challenge, expires } = await must("POST", "/sign-in/challenge", { env: on });
    const rows = (await env.DB.prepare("SELECT * FROM challenges WHERE id = ?").bind(challenge).all()).results;
    expect(rows).toEqual([{ id: challenge, purpose: "provider", account: null, handle: null, expires }]);
  });

  it("answers the same with a body and with a bearer token that means nothing", async () => {
    const res = await call("POST", "/sign-in/challenge", { env: on, body: { anything: 1 }, token: b64(ref.randomBytes(32)) });
    expect(res.status).toBe(200);
  });

  it("is a POST: a GET to the same path is not found", async () => {
    const res = await call("GET", "/sign-in/challenge", { env: on });
    expect(res.status).toBe(404);
  });

  it("sweeps a challenge that ran out when the next one is made", async () => {
    const old = await challengeFor(on);
    await env.DB.prepare("UPDATE challenges SET expires = ? WHERE id = ?").bind("2020-01-01T00:00:00.000Z", old).run();
    await challengeFor(on);
    expect(await count("challenges", "id = ?", old)).toBe(0);
  });
});

describe("POST /sign-in/apple and POST /sign-in/google", () => {
  beforeEach(async () => {
    ({ env: on } = await providersOn());
    world = await standIns();
  });
  afterEach(standDown);

  for (const provider of PROVIDERS) {
    describe(provider, () => {
      const apple = provider === "apple";
      const signingKid = `${provider}-key-1`;

      /* ── a. The form ──────────────────────────────────────────────────── */

      describe("the form", () => {
        const noWrite = async (run) => {
          const before = await snapshot();
          const res = await run();
          expect(await snapshot()).toEqual(before);
          return res;
        };
        const refusedForm = (res, field) => {
          expect(res.status, JSON.stringify(res.body)).toBe(400);
          expect(res.body.error).toBe("bad_request");
          expect(res.body.field).toBe(field);
        };

        const HEADERS = {
          "text/plain": { "content-type": "text/plain" },
          "application/jsonp": { "content-type": "application/jsonp" },
          "application/x-www-form-urlencoded": { "content-type": "application/x-www-form-urlencoded" },
        };
        for (const [name, headers] of Object.entries(HEADERS)) {
          it(`refuses a Content-Type of ${name}, naming Content-Type`, async () => {
            const request = await providerRequest(provider, on);
            const res = await noWrite(() => call("POST", `/sign-in/${provider}`, { env: on, headers, body: JSON.stringify(request) }));
            refusedForm(res, "Content-Type");
            expect(await count("challenges", "id = ?", request.challenge)).toBe(1);
          });
        }

        it("refuses a missing body, naming body", async () => {
          const res = await noWrite(() => call("POST", `/sign-in/${provider}`, { env: on, headers: { "content-type": "application/json" } }));
          refusedForm(res, "body");
        });

        for (const [name, text] of Object.entries({ "not JSON": "not json", "an array": "[]", "null": "null", "a string": '"x"', "a number": "5", "empty": "" })) {
          it(`refuses a body that is ${name}, naming body`, async () => {
            const res = await noWrite(() => call("POST", `/sign-in/${provider}`, { env: on, headers: { "content-type": "application/json" }, body: text }));
            refusedForm(res, "body");
          });
        }

        const GOOD_BYTES = (n) => b64(new Uint8Array(n).fill(9));
        const CHALLENGES = {
          "missing": undefined,
          "null": null,
          "a number": 5,
          "empty": "",
          "not base64url": "*".repeat(43),
          "spelled with a plus sign": `+${GOOD_BYTES(32).slice(1)}`,
          "spelled with a slash": `/${GOOD_BYTES(32).slice(1)}`,
          "padded": `${GOOD_BYTES(32)}=`,
          "31 bytes": GOOD_BYTES(31),
          "33 bytes": GOOD_BYTES(33),
          "64 bytes": GOOD_BYTES(64),
          "an array": [GOOD_BYTES(32)],
        };
        for (const [name, challenge] of Object.entries(CHALLENGES)) {
          it(`refuses a challenge that is ${name}, naming challenge`, async () => {
            const request = await providerRequest(provider, on);
            const res = await noWrite(() => post(provider, { ...request, challenge }));
            refusedForm(res, "challenge");
          });
        }

        it("refuses a challenge with leftover bits in its last character, naming challenge", async () => {
          const request = await providerRequest(provider, on);
          const res = await post(provider, { ...request, challenge: `${request.challenge.slice(0, -1)}B` });
          refusedForm(res, "challenge");
          expect(await count("challenges", "id = ?", request.challenge)).toBe(1);
        });

        const FAKE = "aaaa";
        const TOKENS = {
          "missing": undefined,
          "null": null,
          "a number": 5,
          "an array": [`${FAKE}.${FAKE}.${FAKE}`],
          "empty": "",
          "one segment": FAKE,
          "two segments": `${FAKE}.${FAKE}`,
          "four segments": `${FAKE}.${FAKE}.${FAKE}.${FAKE}`,
          "a segment with a plus sign": `${FAKE}+.${FAKE}.${FAKE}`,
          "a segment with an equals sign": `${FAKE}=.${FAKE}.${FAKE}`,
          "a segment with a slash": `${FAKE}.${FAKE}/.${FAKE}`,
          "a segment with a space": `${FAKE}.${FAKE} .${FAKE}`,
          "an empty first segment": `.${FAKE}.${FAKE}`,
          "an empty middle segment": `${FAKE}..${FAKE}`,
          "an empty signature": `${FAKE}.${FAKE}.`,
          "8,195 characters": `${"a".repeat(2731)}.${"a".repeat(2731)}.${"a".repeat(2731)}`,
          "far over 8,192 characters": `${"a".repeat(20_000)}.${FAKE}.${FAKE}`,
        };
        for (const [name, token] of Object.entries(TOKENS)) {
          it(`refuses an idToken that is ${name}, naming idToken, and leaves the challenge unspent`, async () => {
            const request = await providerRequest(provider, on);
            const res = await noWrite(() => post(provider, { ...request, idToken: token }));
            refusedForm(res, "idToken");
            expect(await count("challenges", "id = ?", request.challenge)).toBe(1);
          });
        }

        it("lets an idToken of exactly 8,192 characters through the form, to be refused as a token", async () => {
          const request = await providerRequest(provider, on);
          const long = `${"A".repeat(2730)}.${"A".repeat(2730)}.${"A".repeat(2730)}`;
          expect(long).toHaveLength(8192);
          const res = await post(provider, { ...request, idToken: long });
          expect(res.status).toBe(403);
          expect(res.body.error).toBe("token_refused");
          expect(res.body.reason).toBe("form");
        });

        it("does not use the challenge up when the form is wrong, so the same challenge then works", async () => {
          const request = await providerRequest(provider, on);
          const broken = await post(provider, { ...request, idToken: "not a token" });
          refusedForm(broken, "idToken");
          const fixed = await post(provider, request);
          expect(fixed.status, JSON.stringify(fixed.body)).toBe(200);
          expect(fixed.body.created).toBe(true);
        });

        it("checks the form before the challenge: an unknown challenge with a malformed token is bad_request, not gone", async () => {
          const res = await post(provider, { challenge: b64(ref.randomBytes(32)), idToken: "nope", ...(apple ? { code: "c" } : {}) });
          refusedForm(res, "idToken");
        });

        it("names the challenge before the idToken when both are wrong", async () => {
          const res = await post(provider, { challenge: "x", idToken: "y", ...(apple ? { code: " " } : {}) });
          refusedForm(res, "challenge");
        });

        if (apple) {
          it("names the idToken before the code when both are wrong", async () => {
            const request = await providerRequest(provider, on);
            refusedForm(await post(provider, { ...request, idToken: "y", code: "a b" }), "idToken");
          });

          it("names the code before the redirect when both are wrong", async () => {
            const request = await providerRequest(provider, on);
            refusedForm(await post(provider, { ...request, code: "", redirect: "http://x.example" }), "code");
          });

          const CODES = {
            "missing": undefined,
            "null": null,
            "empty": "",
            "a number": 5,
            "an array": ["abc"],
            "1,025 characters": "a".repeat(1025),
            "far over 1,024 characters": "a".repeat(5000),
            "spaced": "abc def",
            "led by a space": " abc",
            "broken by a line feed": "abc\ndef",
            "broken by a carriage return": "abc\rdef",
            "broken by a tab": "abc\tdef",
            "not ASCII": "abc\u00e9",
          };
          for (const [name, code] of Object.entries(CODES)) {
            it(`refuses a code that is ${name}, naming code, and leaves the challenge unspent`, async () => {
              const request = await providerRequest(provider, on);
              const res = await noWrite(() => post(provider, { ...request, code }));
              refusedForm(res, "code");
              expect(await count("challenges", "id = ?", request.challenge)).toBe(1);
              expect(appleCalls()).toBe(0);
            });
          }

          const REDIRECTS = {
            "a number": 5,
            "true": true,
            "an array": ["https://litbible.net/x"],
            "empty": "",
            "http": "http://litbible.net/x",
            "ftp": "ftp://litbible.net/x",
            "scheme-relative": "//litbible.net/x",
            "just the scheme": "https://",
            "spaced": "https://litbible.net/a b",
            "broken by a line feed": "https://litbible.net/a\nb",
            "2,049 characters": `https://${"a".repeat(2041)}`,
            "uppercase scheme": "HTTPS://litbible.net/x",
          };
          for (const [name, redirect] of Object.entries(REDIRECTS)) {
            it(`refuses a redirect that is ${name}, naming redirect, and leaves the challenge unspent`, async () => {
              const request = await providerRequest(provider, on);
              const res = await noWrite(() => post(provider, { ...request, redirect }));
              refusedForm(res, "redirect");
              expect(await count("challenges", "id = ?", request.challenge)).toBe(1);
              expect(appleCalls()).toBe(0);
            });
          }

          it("accepts a redirect that is missing, and one that is null, and sends neither on to Apple", async () => {
            for (const extra of [{}, { redirect: null }]) {
              const request = await providerRequest(provider, on);
              const res = await post(provider, { ...request, ...extra });
              expect(res.status, JSON.stringify(res.body)).toBe(200);
            }
            const sent = world.calls.filter((c) => c.url === APPLE_TOKEN);
            expect(sent).toHaveLength(2);
            for (const { form } of sent) expect(form.redirect_uri).toBeUndefined();
          });

          it("accepts a redirect of exactly 2,048 characters, and sends it on", async () => {
            const redirect = `https://${"a".repeat(2040)}`;
            expect(redirect).toHaveLength(2048);
            const request = await providerRequest(provider, on, { redirect });
            const res = await post(provider, request);
            expect(res.status, JSON.stringify(res.body)).toBe(200);
            expect(world.calls.find((c) => c.url === APPLE_TOKEN).form.redirect_uri).toBe(redirect);
          });

          it("accepts a code of exactly 1,024 characters, and every printable punctuation mark", async () => {
            for (const code of ["c".repeat(1024), "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~"]) {
              const request = await providerRequest(provider, on, { code });
              const res = await post(provider, request);
              expect(res.status, code.slice(0, 20)).toBe(200);
              expect(world.calls.filter((c) => c.url === APPLE_TOKEN).at(-1).form.code).toBe(code);
            }
          });
        } else {
          it("does not ask Google for a code, and ignores one that comes with the request", async () => {
            const request = await providerRequest(provider, on);
            const res = await post(provider, { ...request, code: "has spaces and a\nline break", redirect: 5 });
            expect(res.status, JSON.stringify(res.body)).toBe(200);
            expect(appleCalls()).toBe(0);
          });
        }
      });

      /* ── b. The challenge ─────────────────────────────────────────────── */

      describe("the challenge", () => {
        const gone = (res) => {
          expect(res.status, JSON.stringify(res.body)).toBe(410);
          expect(res.body.error).toBe("gone");
          expect(res.body.what).toBe("challenge");
        };

        it("refuses a challenge the service never made, and writes nothing", async () => {
          const before = await snapshot();
          const challenge = b64(ref.randomBytes(32));
          const request = { challenge, idToken: await idToken(provider, challenge), ...(apple ? { code: "code-x" } : {}) };
          gone(await post(provider, request));
          expect(await snapshot()).toEqual(before);
          expect(appleCalls()).toBe(0);
        });

        it("refuses the same accepted request sent twice, and makes one session", async () => {
          const request = await providerRequest(provider, on);
          const before = await snapshot();
          const first = await post(provider, request);
          expect(first.status).toBe(200);
          const second = await post(provider, request);
          gone(second);
          expect((await snapshot()).sessions).toBe(before.sessions + 1);
          expect((await snapshot()).accounts).toBe(before.accounts + 1);
        });

        it("refuses a challenge that ran out, and spends it", async () => {
          const request = await providerRequest(provider, on);
          await env.DB.prepare("UPDATE challenges SET expires = ? WHERE id = ?").bind(new Date(Date.now() - 1000).toISOString(), request.challenge).run();
          const before = await snapshot();
          gone(await post(provider, request));
          expect(await snapshot()).toEqual(before);
          expect(await count("challenges", "id = ?", request.challenge)).toBe(0);
        });

        it("refuses a challenge that was made for a passkey sign-in, and spends it", async () => {
          const { publicKey } = await must("POST", "/sign-in/passkey/options", { env: on });
          const challenge = publicKey.challenge;
          expect(await count("challenges", "id = ?", challenge)).toBe(1);
          const before = await snapshot();
          gone(await post(provider, { challenge, idToken: await idToken(provider, challenge), ...(apple ? { code: "code-x" } : {}) }));
          expect(await snapshot()).toEqual(before);
          expect(await count("challenges", "id = ?", challenge)).toBe(0);
        });

        it("refuses a challenge that was made for a new passkey, and spends it", async () => {
          const { publicKey } = await must("POST", "/sign-in/new-passkey/options", { env: on });
          const challenge = publicKey.challenge;
          gone(await post(provider, { challenge, idToken: await idToken(provider, challenge), ...(apple ? { code: "code-x" } : {}) }));
          expect(await count("challenges", "id = ?", challenge)).toBe(0);
        });

        it("checks the challenge before the token: an unknown challenge with a bad token is gone, not token_refused", async () => {
          const challenge = b64(ref.randomBytes(32));
          const token = await idToken(provider, challenge, { claims: { iss: "https://evil.example" } });
          gone(await post(provider, { challenge, idToken: token, ...(apple ? { code: "code-x" } : {}) }));
        });

        it("spends the challenge when the token is then refused, so the right token for it comes too late", async () => {
          const challenge = await challengeFor(on);
          const code = apple ? { code: "code-x" } : {};
          const bad = await post(provider, { challenge, idToken: await idToken(provider, challenge, { claims: { iss: "https://evil.example" } }), ...code });
          expect(bad.status).toBe(403);
          gone(await post(provider, { challenge, idToken: await idToken(provider, challenge), ...code }));
        });

        it("spends the challenge when the provider's keys can't be had", async () => {
          const challenge = await challengeFor(on);
          const code = apple ? { code: "code-x" } : {};
          world.down.add(KEYS[provider]);
          const down = await post(provider, { challenge, idToken: await idToken(provider, challenge), ...code });
          expect(down.status).toBe(502);
          world.down.delete(KEYS[provider]);
          gone(await post(provider, { challenge, idToken: await idToken(provider, challenge), ...code }));
        });

        it("lets one of two requests at once for one challenge through, and refuses the other", async () => {
          const request = await providerRequest(provider, on);
          const both = await Promise.all([post(provider, request), post(provider, request)]);
          expect(both.map((r) => r.status).sort()).toEqual([200, 410]);
          gone(both.find((r) => r.status === 410));
        });
      });

      /* ── c. The token ─────────────────────────────────────────────────── */

      describe("the token", () => {
        const fromRogue = () => signingKey("rogue-rsa-key");
        const header = { alg: "RS256", kid: signingKid, typ: "JWT" };

        describe("its form", () => {
          const HEADER_SEGMENTS = {
            "text that is not JSON": rawSeg("not json"),
            "bytes that are not UTF-8": b64(Uint8Array.of(0xff, 0xfe, 0xfd, 0xfc)),
            "a single character": "A",
            "a JSON array": seg(["RS256"]),
            "a JSON string": seg("RS256"),
            "a JSON number": seg(7),
            "JSON null": seg(null),
            "JSON true": seg(true),
          };
          for (const [name, headerSegment] of Object.entries(HEADER_SEGMENTS)) {
            it(`refuses a header that is ${name}, as form`, async () => {
              await refusedAs(provider, (c) => `${headerSegment}.${seg(claimsFor(provider, c))}.${fakeSignature()}`, "form");
            });
          }

          const PAYLOAD_SEGMENTS = {
            "text that is not JSON": rawSeg("not json"),
            "bytes that are not UTF-8": b64(Uint8Array.of(0xff, 0xfe, 0xfd, 0xfc)),
            "a single character": "A",
            "a JSON array": seg(["a"]),
            "a JSON string": seg("claims"),
            "a JSON number": seg(7),
            "JSON null": seg(null),
          };
          for (const [name, payloadSegment] of Object.entries(PAYLOAD_SEGMENTS)) {
            it(`refuses a signed payload that is ${name}, as form`, async () => {
              const key = await signingKey(signingKid);
              await refusedAs(provider, () => rawToken(key, seg(header), payloadSegment), "form");
            });
          }

          for (const [name, change] of Object.entries({ "has no kid": { kid: undefined }, "has an empty kid": { kid: "" }, "has a kid that is a number": { kid: 5 }, "has a kid that is null": { kid: null } })) {
            it(`refuses a header that ${name}, as form`, async () => {
              await refusedAs(provider, (c) => `${seg({ ...header, ...change })}.${seg(claimsFor(provider, c))}.${fakeSignature()}`, "form");
            });
          }

          for (const bytes of [0, 1, 32, 255, 1025, 4000]) {
            it(`refuses a signature of ${bytes} bytes, as form`, async () => {
              const signature = bytes === 0 ? "A" : fakeSignature(bytes);
              await refusedAs(provider, (c) => `${seg(header)}.${seg(claimsFor(provider, c))}.${signature}`, "form");
            });
          }

          it("reads the header before the payload: a bad header and a bad payload is still the header's refusal", async () => {
            await refusedAs(provider, () => `${rawSeg("not json")}.${rawSeg("also not")}.${fakeSignature()}`, "form");
          });
        });

        describe("its algorithm", () => {
          for (const alg of ["none", "None", "HS256", "HS512", "ES256", "RS384", "RS512", "PS256", "", 256, null, ["RS256"]]) {
            it(`refuses an alg of ${JSON.stringify(alg)}, as algorithm, though signed by the provider's own key`, async () => {
              await refusedAs(provider, withClaims(provider, {}, { alg }), "algorithm");
            });
          }

          it("refuses a header with no alg, as algorithm", async () => {
            await refusedAs(provider, withClaims(provider, {}, { alg: undefined }), "algorithm");
          });

          it("refuses alg none with no kid and no signature of the right size, as algorithm", async () => {
            await refusedAs(provider, (c) => `${seg({ alg: "none" })}.${seg(claimsFor(provider, c))}.${fakeSignature(1)}`, "algorithm");
          });

          it("refuses alg none under a kid the provider doesn't publish, as algorithm and not key", async () => {
            await refusedAs(provider, (c) => `${seg({ alg: "none", kid: "no-such-key" })}.${seg(claimsFor(provider, c))}.${fakeSignature()}`, "algorithm");
          });

          it("refuses an HS256 token whose HMAC is keyed with the provider's public key (the classic attack), as algorithm", async () => {
            const key = await signingKey(signingKid);
            const spki = new Uint8Array(await crypto.subtle.exportKey("spki", key.keys.publicKey));
            const modulus = ascii(key.jwk.n);
            for (const secret of [spki, modulus]) {
              await refusedAs(
                provider,
                async (c) => {
                  const signed = `${seg({ alg: "HS256", kid: signingKid, typ: "JWT" })}.${seg(claimsFor(provider, c))}`;
                  const hmac = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
                  return `${signed}.${b64(new Uint8Array(await crypto.subtle.sign("HMAC", hmac, ascii(signed))))}`;
                },
                "algorithm",
              );
            }
          });

          it("checks the algorithm before the key is looked for, so a bad alg never fetches the provider's keys", async () => {
            await refusedAs(provider, withClaims(provider, {}, { alg: "HS256" }), "algorithm");
            expect(world.calls.filter((c) => c.url === KEYS[provider])).toHaveLength(0);
          });
        });

        describe("its key", () => {
          for (const kid of ["no-such-key", "APPLE-KEY-1", "google-KEY-1", `${signingKid} `, "x".repeat(300)]) {
            if (kid === signingKid) continue;
            it(`refuses a kid of ${JSON.stringify(kid.length > 30 ? `${kid.slice(0, 10)}...` : kid)} that the provider's set doesn't have, as key`, async () => {
              await refusedAs(provider, withClaims(provider, {}, { kid }), "key");
            });
          }

          it("refuses a kid that is not found even when the token is signed by a key that would verify elsewhere, as key", async () => {
            const key = await fromRogue();
            await refusedAs(provider, (c) => signToken(key, claimsFor(provider, c), { kid: "never-published" }), "key");
          });
        });

        describe("its signature", () => {
          it("refuses a token signed by another RSA key under the published key's kid, as signature", async () => {
            const key = await fromRogue();
            await refusedAs(provider, (c) => signToken(key, claimsFor(provider, c), { kid: signingKid }), "signature");
          });

          it("refuses a token whose payload was changed after signing, as signature", async () => {
            await refusedAs(
              provider,
              async (c) => {
                const good = await idToken(provider, c);
                const [h, , s] = good.split(".");
                return `${h}.${seg(claimsFor(provider, c, { sub: "someone-else" }))}.${s}`;
              },
              "signature",
            );
          });

          it("refuses a token whose header was changed after signing, as signature", async () => {
            await refusedAs(
              provider,
              async (c) => {
                const [, p, s] = (await idToken(provider, c)).split(".");
                return `${seg({ ...header, typ: "at+jwt" })}.${p}.${s}`;
              },
              "signature",
            );
          });

          it("refuses a token whose signature has one bit turned, as signature", async () => {
            await refusedAs(
              provider,
              async (c) => {
                const [h, p, s] = (await idToken(provider, c)).split(".");
                const bytes = ref.fromBase64url(s);
                bytes[10] ^= 1;
                return `${h}.${p}.${b64(bytes)}`;
              },
              "signature",
            );
          });

          it(`refuses ${OTHER[provider]}'s token on this path, as key, because each provider signs under its own kid`, async () => {
            await refusedAs(provider, (c) => idToken(OTHER[provider], c), "key");
          });

          it("refuses the other provider's token resigned under this provider's kid by the other provider's key, as signature", async () => {
            const other = await signingKey(`${OTHER[provider]}-key-1`);
            await refusedAs(provider, (c) => signToken(other, claimsFor(provider, c), { kid: signingKid }), "signature");
          });

          it("checks the signature before the claims: a forged token with a bad issuer is signature, not issuer", async () => {
            const key = await fromRogue();
            await refusedAs(provider, (c) => signToken(key, claimsFor(provider, c, { iss: "https://evil.example", aud: "nobody" }), { kid: signingKid }), "signature");
          });

          it("does not read the payload before the signature holds: a forged token with garbage claims is signature, not form", async () => {
            const key = await fromRogue();
            await refusedAs(provider, () => rawToken(key, seg(header), rawSeg("not json")), "signature");
          });

          it("checks the key before the claims: an unknown kid with a bad issuer is key", async () => {
            await refusedAs(provider, withClaims(provider, { iss: "https://evil.example" }, { kid: "no-such-key" }), "key");
          });
        });

        describe("its issuer", () => {
          for (const [name, iss] of Object.entries({
            "missing": undefined,
            "https://evil.example": "https://evil.example",
            "empty": "",
            "a number": 5,
            "an array holding the right one": [ISSUER[provider]],
            "the right one with a trailing slash": `${ISSUER[provider]}/`,
            "the right one in capitals": ISSUER[provider].toUpperCase(),
            "the right one with http": ISSUER[provider].replace("https", "http"),
          })) {
            it(`refuses an iss that is ${name}, as issuer`, async () => {
              await refusedAs(provider, withClaims(provider, { iss }), "issuer");
            });
          }

          it(`refuses ${OTHER[provider]}'s issuer on a token this provider's key signed, as issuer`, async () => {
            await refusedAs(provider, withClaims(provider, { iss: ISSUER[OTHER[provider]] }), "issuer");
          });

          it("accepts the provider's own issuer", async () => {
            await acceptedAs(provider, withClaims(provider, { iss: ISSUER[provider] }));
          });

          if (!apple) {
            it("accepts accounts.google.com without the scheme, as Google also issues it", async () => {
              await acceptedAs(provider, withClaims(provider, { iss: "accounts.google.com" }));
            });
          } else {
            it("refuses accounts.google.com as Apple's issuer", async () => {
              await refusedAs(provider, withClaims(provider, { iss: "accounts.google.com" }), "issuer");
            });
          }
        });

        describe("its audience", () => {
          const OTHER_CLIENT = CLIENT[OTHER[provider]];
          for (const [name, aud] of Object.entries({
            "missing": undefined,
            "a client id that isn't configured": "someone-elses-client",
            "the other provider's client id": OTHER_CLIENT,
            "the configured id in capitals": CLIENT[provider].toUpperCase(),
            "the configured id with a space after it": `${CLIENT[provider]} `,
            "the two ids joined by a comma": `${CLIENT[provider]},${SECOND_CLIENT[provider]}`,
            "empty": "",
            "a number": 5,
            "null": null,
            "an object": { id: CLIENT[provider] },
            "an empty array": [],
            "an array of two configured ids": [CLIENT[provider], SECOND_CLIENT[provider]],
            "an array of one configured id and another": [CLIENT[provider], "someone-elses-client"],
            "an array of two of the same configured id": [CLIENT[provider], CLIENT[provider]],
            "an array holding an id that isn't configured": ["someone-elses-client"],
            "an array holding a number": [5],
          })) {
            it(`refuses an aud that is ${name}, as audience`, async () => {
              await refusedAs(provider, withClaims(provider, { aud }), "audience");
            });
          }

          it("accepts a single configured id as a string", async () => {
            await acceptedAs(provider, withClaims(provider, { aud: CLIENT[provider] }));
          });

          it("accepts a one-element array holding a configured id", async () => {
            await acceptedAs(provider, withClaims(provider, { aud: [CLIENT[provider]] }));
          });

          it(`accepts the second configured id, ${SECOND_CLIENT[provider]}`, async () => {
            await acceptedAs(provider, withClaims(provider, { aud: SECOND_CLIENT[provider] }));
          });

          it("accepts an id the deployment names with spaces around it in its list", async () => {
            const environment = { ...on, [apple ? "APPLE_CLIENT_IDS" : "GOOGLE_CLIENT_IDS"]: `  other-client ,  ${CLIENT[provider]}  ` };
            const challenge = await challengeFor(environment);
            const res = await call("POST", `/sign-in/${provider}`, {
              env: environment,
              body: { challenge, idToken: await idToken(provider, challenge), ...(apple ? { code: "code-x" } : {}) },
            });
            expect(res.status, JSON.stringify(res.body)).toBe(200);
          });

          it("refuses a configured id that the deployment has taken out of its list, as audience", async () => {
            const environment = { ...on, [apple ? "APPLE_CLIENT_IDS" : "GOOGLE_CLIENT_IDS"]: SECOND_CLIENT[provider] };
            const challenge = await challengeFor(environment);
            const res = await call("POST", `/sign-in/${provider}`, {
              env: environment,
              body: { challenge, idToken: await idToken(provider, challenge), ...(apple ? { code: "code-x" } : {}) },
            });
            expect(res.status).toBe(403);
            expect(res.body.reason).toBe("audience");
          });
        });

        describe("its times", () => {
          const at = () => Math.floor(Date.now() / 1000);

          for (const [name, claims] of [
            ["exp missing", { exp: undefined }],
            ["exp a string", { exp: String(at() + 600) }],
            ["exp null", { exp: null }],
            ["exp an object", { exp: {} }],
            ["iat missing", { iat: undefined }],
            ["iat a string", { iat: String(at()) }],
            ["iat null", { iat: null }],
            ["both missing", { iat: undefined, exp: undefined }],
          ]) {
            it(`refuses a token with ${name}, as form`, async () => {
              await refusedAs(provider, withClaims(provider, claims), "form");
            });
          }

          for (const seconds of [90, 120, 3600, 86_400]) {
            it(`refuses an exp ${seconds} seconds in the past, as expired`, async () => {
              await refusedAs(provider, (c) => idToken(provider, c, { claims: { exp: at() - seconds, iat: at() - seconds - 600 } }), "expired");
            });
          }

          it("accepts an exp 30 seconds in the past, for clock skew", async () => {
            await acceptedAs(provider, (c) => idToken(provider, c, { claims: { exp: at() - 30 } }));
          });

          for (const seconds of [90, 120, 3600, 86_400]) {
            it(`refuses an iat ${seconds} seconds in the future, as issued`, async () => {
              await refusedAs(provider, (c) => idToken(provider, c, { claims: { iat: at() + seconds, exp: at() + seconds + 600 } }), "issued");
            });
          }

          it("accepts an iat 30 seconds in the future, for clock skew", async () => {
            await acceptedAs(provider, (c) => idToken(provider, c, { claims: { iat: at() + 30, exp: at() + 630 } }));
          });

          it("does not require exp to be after iat", async () => {
            await acceptedAs(provider, (c) => idToken(provider, c, { claims: { iat: at() + 10, exp: at() + 5 } }));
          });
        });

        describe("its nonce", () => {
          it("refuses a token with no nonce, as nonce", async () => {
            await refusedAs(provider, withClaims(provider, { nonce: undefined }), "nonce");
          });

          it("refuses another challenge's value, as nonce, though that challenge was the service's own", async () => {
            const other = await challengeFor(on);
            await refusedAs(provider, withClaims(provider, { nonce: other }), "nonce");
            expect(await count("challenges", "id = ?", other)).toBe(1);
          });

          it("refuses the right challenge with its letters' case swapped, as nonce", async () => {
            await refusedAs(
              provider,
              (c) => idToken(provider, c, { claims: { nonce: c.replace(/[a-z]/gi, (ch) => (ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase())) } }),
              "nonce",
            );
          });

          it("refuses the right challenge with a space after it, as nonce", async () => {
            await refusedAs(provider, (c) => idToken(provider, c, { claims: { nonce: `${c} ` } }), "nonce");
          });

          for (const [name, nonce] of Object.entries({ "a number": 12345, "null": null, "empty": "", "an array holding the challenge": "ARRAY", "an object": {} })) {
            it(`refuses a nonce that is ${name}, as nonce`, async () => {
              await refusedAs(provider, (c) => idToken(provider, c, { claims: { nonce: nonce === "ARRAY" ? [c] : nonce } }), "nonce");
            });
          }
        });

        describe("its subject", () => {
          for (const [name, sub] of Object.entries({
            "missing": undefined,
            "empty": "",
            "a number": 12345,
            "null": null,
            "an array": ["abc"],
            "256 characters": "s".repeat(256),
            "far over 255 characters": "s".repeat(5000),
          })) {
            it(`refuses a sub that is ${name}, as subject`, async () => {
              await refusedAs(provider, withClaims(provider, { sub }), "subject");
            });
          }

          for (const length of [1, 255]) {
            it(`accepts a sub of ${length} character${length === 1 ? "" : "s"}`, async () => {
              const sub = length === 1 ? "q" : `${freshSubject()}-`.padEnd(length, "y");
              const first = await via(provider, withClaims(provider, { sub }));
              expect(first.res.status, JSON.stringify(first.res.body)).toBe(200);
            });
          }

          it("stores a subject of 255 characters whole", async () => {
            const sub = `${freshSubject()}-`.padEnd(255, "z");
            await acceptedAs(provider, withClaims(provider, { sub }));
            expect(await count("ways", "kind = ? AND subject = ?", provider, sub)).toBe(1);
          });
        });

        describe("the order of the claims' checks", () => {
          const at = () => Math.floor(Date.now() / 1000);
          const expired = () => ({ exp: at() - 120, iat: at() - 700 });
          it("names the issuer before the audience", async () => {
            await refusedAs(provider, withClaims(provider, { iss: "https://evil.example", aud: "nobody" }), "issuer");
          });
          it("names the audience before a missing exp", async () => {
            await refusedAs(provider, withClaims(provider, { aud: "nobody", exp: undefined }), "audience");
          });
          it("names a missing exp before the nonce", async () => {
            await refusedAs(provider, withClaims(provider, { exp: undefined, nonce: "wrong" }), "form");
          });
          it("names expired before the nonce", async () => {
            await refusedAs(provider, withClaims(provider, { ...expired(), nonce: "wrong" }), "expired");
          });
          it("names issued before the nonce", async () => {
            await refusedAs(provider, withClaims(provider, { iat: at() + 120, exp: at() + 720, nonce: "wrong" }), "issued");
          });
          it("names the nonce before the subject", async () => {
            await refusedAs(provider, withClaims(provider, { nonce: "wrong", sub: "" }), "nonce");
          });
        });
      });

      /* ── d. The provider's keys ───────────────────────────────────────── */

      describe("the provider's keys", () => {
        const expectProviderDown = (res) => {
          expect(res.status, JSON.stringify(res.body)).toBe(502);
          expect(res.body.error).toBe("provider");
          expect(res.body.which).toBe(provider);
        };

        it("answers provider when the keys address is down, writes nothing, and works once it is back", async () => {
          const before = await snapshot();
          world.down.add(KEYS[provider]);
          const { res } = await via(provider, (c) => idToken(provider, c));
          expectProviderDown(res);
          expect(await snapshot()).toEqual(before);
          expect(appleCalls()).toBe(0);
          world.down.delete(KEYS[provider]);
          const again = await signInWith(provider, on);
          expect(again.created).toBe(true);
        });

        const BAD_ANSWERS = {
          "a status of 500, with a good set": () => jsonResponse({ keys: [] }, 500),
          "a status of 404": () => jsonResponse({}, 404),
          "an empty object": () => jsonResponse({}),
          "keys that is a string": () => jsonResponse({ keys: "abc" }),
          "keys that is an object": () => jsonResponse({ keys: { a: 1 } }),
          "an array at the top": () => jsonResponse([]),
          "null": () => new Response("null", { status: 200 }),
          "text that is not JSON": () => new Response("<html>nope</html>", { status: 200 }),
          "an empty body": () => new Response("", { status: 200 }),
          "an empty list of keys": () => jsonResponse({ keys: [] }),
          "a set of one EC key": () => jsonResponse({ keys: [{ kty: "EC", kid: signingKid, crv: "P-256", x: "AAAA", y: "AAAA" }] }),
          "a set whose only RSA key is meant for encryption": () =>
            jsonResponse({ keys: [{ kty: "RSA", kid: signingKid, use: "enc", n: "AAAA", e: "AQAB" }] }),
          "a set whose RSA key has no kid": () => jsonResponse({ keys: [{ kty: "RSA", use: "sig", n: "AAAA", e: "AQAB" }] }),
          "a set whose RSA key has no modulus": () => jsonResponse({ keys: [{ kty: "RSA", kid: signingKid, use: "sig", e: "AQAB" }] }),
          "a set whose RSA key has no exponent": () => jsonResponse({ keys: [{ kty: "RSA", kid: signingKid, use: "sig", n: "AAAA" }] }),
          "a set of nulls": () => jsonResponse({ keys: [null, 5, "x"] }),
        };
        for (const [name, make] of Object.entries(BAD_ANSWERS)) {
          it(`answers provider when the keys address answers ${name}, writes nothing, and works when it answers again`, async () => {
            const restore = answerKeysWith(KEYS[provider], make);
            const before = await snapshot();
            const { res } = await via(provider, (c) => idToken(provider, c));
            expectProviderDown(res);
            expect(await snapshot()).toEqual(before);
            expect(appleCalls()).toBe(0);
            restore();
            expect((await signInWith(provider, on)).created).toBe(true);
          });
        }

        it("skips a key it can't use and takes the usable one beside it", async () => {
          const good = (await signingKey(signingKid)).jwk;
          world.keys[provider] = [{ kty: "EC", kid: "ec-key" }, { ...good, kid: "enc-key", use: "enc" }, { kty: "RSA", n: "AAAA", e: "AQAB" }, good];
          expect((await signInWith(provider, on)).created).toBe(true);
        });

        it("answers provider when the published key can't be imported", async () => {
          const good = (await signingKey(signingKid)).jwk;
          world.keys[provider] = [{ ...good, n: "!!" }];
          const { res } = await via(provider, (c) => idToken(provider, c));
          expectProviderDown(res);
        });

        it("does not call Apple's token address when the keys failed", async () => {
          world.down.add(KEYS[provider]);
          await via(provider, (c) => idToken(provider, c));
          expect(appleCalls()).toBe(0);
        });

        it("fetches the key set once and reuses it for later sign-ins", async () => {
          await signInWith(provider, on);
          await signInWith(provider, on);
          await signInWith(provider, on);
          expect(world.calls.filter((c) => c.url === KEYS[provider])).toHaveLength(1);
        });

        it("keeps a set for each provider, each fetched once, from its own address", async () => {
          await signInWith("apple", on);
          await signInWith("google", on);
          await signInWith("apple", on);
          await signInWith("google", on);
          expect(world.calls.filter((c) => c.url === APPLE_KEYS)).toHaveLength(1);
          expect(world.calls.filter((c) => c.url === GOOGLE_KEYS)).toHaveLength(1);
        });

        it("does not cache a failed fetch: the next request fetches again", async () => {
          world.down.add(KEYS[provider]);
          await via(provider, (c) => idToken(provider, c));
          await via(provider, (c) => idToken(provider, c));
          expect(world.calls.filter((c) => c.url === KEYS[provider])).toHaveLength(2);
        });

        it("refuses as key, with no second fetch, a kid that appeared at the provider after the set was fetched, within a minute", async () => {
          await signInWith(provider, on);
          const fresh = await signingKey(`${provider}-key-2`);
          world.keys[provider] = [...world.keys[provider], fresh.jwk];
          await refusedAs(provider, (c) => idToken(provider, c, { key: fresh }), "key");
          expect(world.calls.filter((c) => c.url === KEYS[provider])).toHaveLength(1);
        });

        it("fetches the set again after forgetProviderKeys(), and then takes the new key", async () => {
          await signInWith(provider, on);
          const fresh = await signingKey(`${provider}-key-2`);
          world.keys[provider] = [...world.keys[provider], fresh.jwk];
          forgetProviderKeys();
          const made = await acceptedAs(provider, (c) => idToken(provider, c, { key: fresh }));
          expect(made.created).toBe(true);
          expect(world.calls.filter((c) => c.url === KEYS[provider])).toHaveLength(2);
        });

        describe("with the clock moved", () => {
          afterEach(() => vi.useRealTimers());

          it("fetches the set again for a kid it lacks once a minute has passed, and takes the new key", async () => {
            await signInWith(provider, on);
            const fresh = await signingKey(`${provider}-key-2`);
            world.keys[provider] = [...world.keys[provider], fresh.jwk];
            vi.useFakeTimers({ toFake: ["Date"] });
            vi.setSystemTime(Date.now() + 61_000);
            const made = await acceptedAs(provider, (c) => idToken(provider, c, { key: fresh }));
            expect(made.created).toBe(true);
            expect(world.calls.filter((c) => c.url === KEYS[provider])).toHaveLength(2);
          });

          it("still refuses a kid the provider never published after a minute, with one more fetch and no more", async () => {
            await signInWith(provider, on);
            vi.useFakeTimers({ toFake: ["Date"] });
            vi.setSystemTime(Date.now() + 61_000);
            await refusedAs(provider, withClaims(provider, {}, { kid: "never-published" }), "key");
            expect(world.calls.filter((c) => c.url === KEYS[provider])).toHaveLength(2);
            await refusedAs(provider, withClaims(provider, {}, { kid: "never-published" }), "key");
            expect(world.calls.filter((c) => c.url === KEYS[provider])).toHaveLength(2);
          });

          it("does not fetch again for a known kid before the set is an hour old", async () => {
            await signInWith(provider, on);
            vi.useFakeTimers({ toFake: ["Date"] });
            vi.setSystemTime(Date.now() + 30 * 60_000);
            await acceptedAs(provider, (c) => idToken(provider, c));
            expect(world.calls.filter((c) => c.url === KEYS[provider])).toHaveLength(1);
          });

          it("fetches the set again for a known kid once it is more than an hour old", async () => {
            await signInWith(provider, on);
            vi.useFakeTimers({ toFake: ["Date"] });
            vi.setSystemTime(Date.now() + 61 * 60_000);
            await acceptedAs(provider, (c) => idToken(provider, c));
            expect(world.calls.filter((c) => c.url === KEYS[provider])).toHaveLength(2);
          });

          it("stops accepting a key the provider has withdrawn once the set is refetched", async () => {
            await signInWith(provider, on);
            const fresh = await signingKey(`${provider}-key-2`);
            world.keys[provider] = [fresh.jwk];
            vi.useFakeTimers({ toFake: ["Date"] });
            vi.setSystemTime(Date.now() + 61 * 60_000);
            await refusedAs(provider, (c) => idToken(provider, c), "key");
          });
        });
      });

      /* ── e. Apple's code ──────────────────────────────────────────────── */

      if (apple) {
        describe("Apple's authorization code", () => {
          const normal = () => world.answers.token;
          const nothingMade = async (subject) => {
            for (const table of ["ways"]) expect(await count(table, "subject = ?", subject)).toBe(0);
          };
          const sendFor = async (subject) => {
            const before = await snapshot();
            const request = await providerRequest("apple", on, { token: { subject } });
            const res = await post("apple", request);
            return { before, request, res };
          };

          it("refuses a code Apple calls invalid_grant, as token_refused with reason code", async () => {
            world.answers.token = () => [400, { error: "invalid_grant" }];
            const subject = freshSubject();
            const { before, request, res } = await sendFor(subject);
            expect(res.status).toBe(403);
            expect(res.body.error).toBe("token_refused");
            expect(res.body.reason).toBe("code");
            expect(await snapshot()).toEqual(before);
            await nothingMade(subject);
            expect(appleCalls()).toBe(1);
            expect(await count("challenges", "id = ?", request.challenge)).toBe(0);
          });

          const FAILURES = {
            "invalid_client": () => [400, { error: "invalid_client" }],
            "another 400 error": () => [400, { error: "invalid_request" }],
            "a 400 with no body": () => [400, null],
            "a 401": () => [401, { error: "invalid_grant" }],
            "an invalid_grant with the wrong status": () => [200, { error: "invalid_grant" }],
            "a 500 with no body": () => [500, null],
            "a 503 with a body": () => [503, { error: "server_error" }],
            "a 200 with an empty object": () => [200, {}],
            "a 200 with an empty refresh token": () => [200, { refresh_token: "" }],
            "a 200 with a refresh token that is a number": () => [200, { refresh_token: 12345 }],
            "a 200 with a null refresh token": () => [200, { refresh_token: null }],
            "a 200 with no body": () => [200, null],
          };
          for (const [name, answer] of Object.entries(FAILURES)) {
            it(`answers provider (apple) for ${name}, and makes no account, way, token, or session`, async () => {
              world.answers.token = answer;
              const subject = freshSubject();
              const { before, res } = await sendFor(subject);
              expect(res.status, JSON.stringify(res.body)).toBe(502);
              expect(res.body.error).toBe("provider");
              expect(res.body.which).toBe("apple");
              expect(await snapshot()).toEqual(before);
              await nothingMade(subject);
            });
          }

          it("answers provider (apple) when Apple's token address can't be reached, and makes nothing", async () => {
            world.down.add(APPLE_TOKEN);
            const subject = freshSubject();
            const { before, res } = await sendFor(subject);
            expect(res.status).toBe(502);
            expect(res.body.error).toBe("provider");
            expect(res.body.which).toBe("apple");
            expect(await snapshot()).toEqual(before);
            await nothingMade(subject);
          });

          for (const [name, make] of Object.entries({
            "invalid_grant": () => [400, { error: "invalid_grant" }],
            "invalid_client": () => [400, { error: "invalid_client" }],
            "no refresh token": () => [200, {}],
            "a 500": () => [500, null],
            "the address down": "down",
          })) {
            it(`lets the same Apple account sign in afresh after a failed exchange (${name}), as a new account`, async () => {
              const subject = freshSubject();
              const good = normal();
              if (make === "down") world.down.add(APPLE_TOKEN);
              else world.answers.token = make;
              const failed = await sendFor(subject);
              expect(failed.res.status).not.toBe(200);
              if (make === "down") world.down.delete(APPLE_TOKEN);
              world.answers.token = good;
              const made = await signInWith("apple", on, { token: { subject } });
              expect(made.created).toBe(true);
              expect(await count("ways", "kind = 'apple' AND subject = ?", subject)).toBe(1);
              expect(await count("apple_tokens", "way = ?", made.way.id)).toBe(1);
            });
          }

          it("does not reuse the failed request's challenge: the same request sent again is gone", async () => {
            world.answers.token = () => [400, { error: "invalid_grant" }];
            const { request } = await sendFor(freshSubject());
            const again = await post("apple", request);
            expect(again.status).toBe(410);
            expect(again.body.what).toBe("challenge");
          });

          it("leaves an existing account alone when a new client's exchange fails, and makes no session", async () => {
            const first = await signInWith("apple", on);
            const before = await snapshot();
            world.answers.token = () => [400, { error: "invalid_grant" }];
            const request = await providerRequest("apple", on, { token: { subject: first.subject, claims: { aud: APPLE_WEB_CLIENT } } });
            const res = await post("apple", request);
            expect(res.status).toBe(403);
            expect(res.body.reason).toBe("code");
            expect(await snapshot()).toEqual(before);
            expect(await count("apple_tokens", "way = ?", first.way.id)).toBe(1);
          });

          it("does not call Apple's token address when the token itself was refused", async () => {
            const { res } = await via("apple", withClaims("apple", { iss: "https://evil.example" }));
            expect(res.status).toBe(403);
            expect(appleCalls()).toBe(0);
          });
        });
      }

      /* ── f. Accepted ──────────────────────────────────────────────────── */

      describe("when accepted", () => {
        it("signs in where only this provider is configured", async () => {
          const alone = apple ? { ...on, GOOGLE_CLIENT_IDS: undefined } : { ...on, APPLE_PRIVATE_KEY: undefined };
          expect((await signInWith(provider, alone)).created).toBe(true);
        });

        it("answers exactly time, token, expires, created, and way", async () => {
          const made = await signInWith(provider, on);
          expect(Object.keys(made).filter((k) => !["subject", "body"].includes(k))).toEqual(["time", "token", "expires", "created", "way"]);
          expect(made.token).toMatch(TOKEN);
          expect(made.created).toBe(true);
        });

        it("answers a way of id, kind, and added, and nothing else, and never the subject", async () => {
          const request = await providerRequest(provider, on);
          const subject = freshSubject();
          const res = await post(provider, { ...request, idToken: await idToken(provider, request.challenge, { subject }) });
          expect(res.status).toBe(200);
          expect(Object.keys(res.body.way)).toEqual(["id", "kind", "added"]);
          expect(res.body.way).toEqual({ id: expect.stringMatching(/^[0-9a-f-]{36}$/), kind: provider, added: expect.any(String) });
          expect(JSON.stringify(res.body)).not.toContain(subject);
        });

        it("gives a session that expires about 30 days on", async () => {
          const made = await signInWith(provider, on);
          const days = (Date.parse(made.expires) - Date.now()) / 86_400_000;
          expect(days).toBeGreaterThan(29.9);
          expect(days).toBeLessThan(30.1);
        });

        it("makes one account with one way on the first sign-in for a subject", async () => {
          const before = await snapshot();
          const made = await signInWith(provider, on);
          const after = await snapshot();
          expect(after.accounts).toBe(before.accounts + 1);
          expect(after.ways).toBe(before.ways + 1);
          expect(after.sessions).toBe(before.sessions + 1);
          const account = await must("GET", "/account", { token: made.token });
          expect(account.ways).toEqual([made.way]);
          expect(account).toMatchObject({ notebook: null, kid: 0 });
        });

        it("signs in again as the same account, with the same way, and makes only a session", async () => {
          const first = await signInWith(provider, on);
          const before = await snapshot();
          const second = await signInWith(provider, on, { token: { subject: first.subject } });
          expect(second.created).toBe(false);
          expect(second.way).toEqual(first.way);
          expect(second.token).not.toBe(first.token);
          expect(await snapshot()).toEqual({ ...before, sessions: before.sessions + 1 });
          const a = await must("GET", "/account", { token: first.token });
          const b = await must("GET", "/account", { token: second.token });
          expect(b.ways).toEqual(a.ways);
          expect(b.ways).toEqual([first.way]);
        });

        it("signs in a third time, still created false", async () => {
          const first = await signInWith(provider, on);
          for (let i = 0; i < 2; i++) {
            const again = await signInWith(provider, on, { token: { subject: first.subject } });
            expect(again.created).toBe(false);
            expect(again.way.id).toBe(first.way.id);
          }
        });

        it("makes a different account for a different subject", async () => {
          const a = await signInWith(provider, on);
          const b = await signInWith(provider, on);
          expect(a.way.id).not.toBe(b.way.id);
          const seenA = await must("GET", "/account", { token: a.token });
          const seenB = await must("GET", "/account", { token: b.token });
          expect(seenA.ways[0].id).not.toBe(seenB.ways[0].id);
        });

        it("takes the second configured client's token as the same account as the first's", async () => {
          const first = await signInWith(provider, on);
          const second = await signInWith(provider, on, { token: { subject: first.subject, claims: { aud: SECOND_CLIENT[provider] } } });
          expect(second.created).toBe(false);
          expect(second.way.id).toBe(first.way.id);
        });

        it("treats a subject that differs only in case as another account", async () => {
          const subject = `Case-${freshSubject()}`;
          const a = await signInWith(provider, on, { token: { subject } });
          const b = await signInWith(provider, on, { token: { subject: subject.toLowerCase() } });
          expect(b.created).toBe(true);
          expect(b.way.id).not.toBe(a.way.id);
        });

        it("signs in with the session token the answer carries, and no other", async () => {
          const made = await signInWith(provider, on);
          expect((await call("GET", "/account", { token: made.token })).status).toBe(200);
          expect((await call("GET", "/account", { token: `${made.token.slice(0, -1)}${made.token.at(-1) === "A" ? "B" : "A"}` })).status).toBe(401);
        });

        it("makes the same subject at the other provider a different account", async () => {
          const subject = freshSubject();
          const here = await signInWith(provider, on, { token: { subject } });
          const there = await signInWith(OTHER[provider], on, { token: { subject } });
          expect(there.created).toBe(true);
          expect(there.way.id).not.toBe(here.way.id);
          const accounts = (await env.DB.prepare("SELECT account FROM ways WHERE subject = ?").bind(subject).all()).results.map((r) => r.account);
          expect(accounts).toHaveLength(2);
          expect(new Set(accounts).size).toBe(2);
          expect((await must("GET", "/account", { token: here.token })).ways.map((w) => w.kind)).toEqual([provider]);
          expect((await must("GET", "/account", { token: there.token })).ways.map((w) => w.kind)).toEqual([OTHER[provider]]);
        });

        it("ends three first sign-ins at once for one new subject as one account and three sessions", async () => {
          const subject = freshSubject();
          const before = await snapshot();
          const requests = await Promise.all([1, 2, 3].map(() => providerRequest(provider, on, { token: { subject } })));
          const answers = await Promise.all(requests.map((body) => post(provider, body)));
          expect(answers.map((r) => r.status), JSON.stringify(answers.map((r) => r.body))).toEqual([200, 200, 200]);
          expect(answers.filter((r) => r.body.created)).toHaveLength(1);
          expect(new Set(answers.map((r) => r.body.way.id)).size).toBe(1);
          expect(new Set(answers.map((r) => r.body.token)).size).toBe(3);
          const after = await snapshot();
          expect(after.accounts).toBe(before.accounts + 1);
          expect(after.ways).toBe(before.ways + 1);
          expect(after.sessions).toBe(before.sessions + 3);
          expect(await count("ways", "subject = ?", subject)).toBe(1);
          for (const r of answers) expect((await must("GET", "/account", { token: r.body.token })).ways).toEqual([answers[0].body.way]);
        });
      });

      /* ── g and h. What is kept, and what a refusal writes ─────────────── */

      describe("what is kept", () => {
        it("keeps the subject in ways.subject, and public and count null for a way of this kind", async () => {
          const made = await signInWith(provider, on);
          const row = await env.DB.prepare("SELECT * FROM ways WHERE id = ?").bind(made.way.id).first();
          expect(row).toMatchObject({ kind: provider, subject: made.subject, public: null, count: null, id: made.way.id });
          expect(row.syncs).toBeNull();
        });

        it("keeps no identity token, no email or name from it, no session token, and no challenge in any table", async () => {
          const subject = freshSubject();
          const email = `${subject}@mail.example`;
          const name = `Name ${subject}`;
          const request = await providerRequest(provider, on);
          const token = await idToken(provider, request.challenge, { subject, claims: { email, name, given_name: `Given ${subject}`, picture: `https://pics.example/${subject}.png` } });
          const res = await post(provider, { ...request, idToken: token });
          expect(res.status).toBe(200);
          const [header, payload, signature] = token.split(".");
          for (const table of ["accounts", "ways", "sessions", "challenges", "apple_tokens"]) {
            const text = await everything(table);
            for (const secret of [token, header, payload, signature, email, name, `Given ${subject}`, `pics.example/${subject}`, res.body.token, request.challenge]) {
              if (table === "ways" && secret === subject) continue;
              expect(text, `${table} holds ${secret.slice(0, 20)}`).not.toContain(secret);
            }
          }
        });

        it("keeps a hash of the session token, and not the token", async () => {
          const made = await signInWith(provider, on);
          const hash = b64(new Uint8Array(await crypto.subtle.digest("SHA-256", ascii(made.token))));
          expect(await count("sessions", "token_hash = ?", hash)).toBe(1);
          expect(hash).not.toBe(made.token);
        });

        it("keeps the subject only in ways, and not in accounts, sessions, or challenges", async () => {
          const made = await signInWith(provider, on);
          for (const table of ["accounts", "sessions", "challenges"]) expect(await everything(table), table).not.toContain(made.subject);
          expect(await everything("ways")).toContain(made.subject);
        });

        it("keeps the other provider's way out of it: this subject has one way, of this kind", async () => {
          const made = await signInWith(provider, on);
          const rows = (await env.DB.prepare("SELECT kind FROM ways WHERE subject = ?").bind(made.subject).all()).results;
          expect(rows).toEqual([{ kind: provider }]);
        });

        it("uses the challenge up on an accepted sign-in", async () => {
          const request = await providerRequest(provider, on);
          expect(await count("challenges", "id = ?", request.challenge)).toBe(1);
          await post(provider, request);
          expect(await count("challenges", "id = ?", request.challenge)).toBe(0);
        });
      });

      describe("a refused sign-in", () => {
        const REFUSALS = {
          "a bad issuer": withClaims(provider, { iss: "https://evil.example" }),
          "a bad audience": withClaims(provider, { aud: "someone-elses-client" }),
          "an expired token": withClaims(provider, { exp: Math.floor(Date.now() / 1000) - 300 }),
          "a wrong nonce": withClaims(provider, { nonce: "wrong" }),
          "an empty subject": withClaims(provider, { sub: "" }),
          "an unknown key": withClaims(provider, {}, { kid: "no-such-key" }),
          "a forged signature": async (c) => signToken(await signingKey("rogue-rsa-key"), claimsFor(provider, c), { kid: signingKid }),
          "alg none": withClaims(provider, {}, { alg: "none" }),
        };
        for (const [name, makeToken] of Object.entries(REFUSALS)) {
          it(`writes no account, way, or session for ${name}, and answers no token`, async () => {
            await signInWith(provider, on);
            const before = await snapshot();
            const challenge = await challengeFor(on);
            const body = { challenge, idToken: await makeToken(challenge), ...(apple ? { code: "code-x" } : {}) };
            const res = await post(provider, body);
            expect(res.status).toBe(403);
            expect(res.body.token).toBeUndefined();
            expect(await snapshot()).toEqual(before);
          });
        }
      });
    });
  }
});
