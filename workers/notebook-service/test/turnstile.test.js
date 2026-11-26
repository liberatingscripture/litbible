// Turnstile on the request that begins a new account (src/turnstile.js;
// STUDY-DESK-ENCRYPTION.md, "Signing in," and "Still open," 86).
//
// The keys below are Cloudflare's published dummy keys for testing, not
// LIT's: the site key and secret that always pass, and the secret that
// always fails. No real secret is written anywhere in this repository. The
// preview's own site key is in wrangler.jsonc (public by design), so each
// test here sets both of the two itself (`NEITHER` clears them). Nothing
// here reaches the network: fetch() is replaced for each test with a
// stand-in for siteverify, as test/idp.js does for Apple and Google.
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { call } from "./call.js";
import { ORIGIN, attest, newPasskey } from "./authenticator.js";
import { must } from "./notebook.js";
import { SITEVERIFY } from "../src/turnstile.js";

const SITE_KEY = "1x00000000000000000000AA";
const SECRET = "1x0000000000000000000000000000000AA";
const ON = { TURNSTILE_SITE_KEY: SITE_KEY, TURNSTILE_SECRET: SECRET };
/** The two cleared, whatever the preview's configuration sets. */
const NEITHER = { TURNSTILE_SITE_KEY: undefined, TURNSTILE_SECRET: undefined };
const TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

let world;

/** Replaces fetch() with siteverify. `answer(form)` gives [status, body text]; `down` makes it fail as a network does. */
function standIn() {
  world = {
    calls: [],
    down: false,
    answer: (form) => [200, JSON.stringify({ success: form.response === TOKEN, "error-codes": form.response === TOKEN ? [] : ["invalid-input-response"] })],
  };
  vi.stubGlobal("fetch", async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    const form = Object.fromEntries(new URLSearchParams(init.body ?? ""));
    world.calls.push({ url, method: init.method, form, headers: init.headers ?? {}, signal: init.signal });
    if (url !== SITEVERIFY) throw new Error(`a test reached an address it did not expect: ${url}`);
    if (world.down) throw new TypeError("network failure (a test's)");
    const [status, text] = world.answer(form);
    return new Response(text, { status, headers: { "content-type": "application/json" } });
  });
}

beforeEach(standIn);
afterEach(() => vi.unstubAllGlobals());

/** A browser's request for new-passkey options, with the check on. */
const asked = (body, { headers = { origin: ORIGIN }, more = {} } = {}) =>
  call("POST", "/sign-in/new-passkey/options", { body, headers, env: { ...ON, ...more } });

const challenges = async () => (await env.DB.prepare("SELECT COUNT(*) AS n FROM challenges WHERE purpose = 'passkey_new'").first()).n;

describe("configuration", () => {
  it("is off with neither, with the site key alone, and with the secret alone: GET /sign-in has no member", async () => {
    for (const more of [{}, { TURNSTILE_SITE_KEY: SITE_KEY }, { TURNSTILE_SECRET: SECRET }, { TURNSTILE_SITE_KEY: " ", TURNSTILE_SECRET: SECRET }]) {
      const answer = await must("GET", "/sign-in", { env: { ...NEITHER, ...more } });
      expect(Object.keys(answer), JSON.stringify(Object.keys(more))).toEqual(["time", "ways"]);
    }
  });

  it("is on with both: GET /sign-in carries the site key, and never the secret", async () => {
    const { status, body } = await call("GET", "/sign-in", { env: ON });
    expect(status).toBe(200);
    expect(body).toEqual({ time: expect.any(String), ways: ["passkey"], turnstile: SITE_KEY });
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  it("while off, a browser's request needs no token and no body, and siteverify is never asked", async () => {
    for (const more of [{}, { TURNSTILE_SITE_KEY: SITE_KEY }, { TURNSTILE_SECRET: SECRET }]) {
      const { status, body } = await call("POST", "/sign-in/new-passkey/options", { headers: { origin: ORIGIN }, env: { ...NEITHER, ...more } });
      expect(status).toBe(200);
      expect(body.publicKey.challenge).toBeTypeOf("string");
    }
    expect(world.calls).toEqual([]);
  });
});

describe("with the check on, a browser's request (it has an Origin)", () => {
  it("passes with a good token, and is given options; siteverify is sent the secret, the token, and the address", async () => {
    const before = await challenges();
    const { status, body } = await asked({ turnstile: TOKEN }, { headers: { origin: ORIGIN, "cf-connecting-ip": "2001:db8::7" } });
    expect(status).toBe(200);
    expect(Object.keys(body)).toEqual(["time", "publicKey", "expires"]);
    expect(await challenges()).toBe(before + 1);

    expect(world.calls).toHaveLength(1);
    const [sent] = world.calls;
    expect(sent.url).toBe(SITEVERIFY);
    expect(sent.method).toBe("POST");
    expect(sent.form).toEqual({ secret: SECRET, response: TOKEN, remoteip: "2001:db8::7" });
    expect(sent.signal).toBeInstanceOf(AbortSignal);
  });

  it("makes an account, start to finish, with the passkey made from those options", async () => {
    const { body } = await asked({ turnstile: TOKEN });
    const passkey = await newPasskey();
    const made = await must("POST", "/sign-in/new-passkey", { body: { credential: await attest(passkey, body.publicKey) }, env: ON });
    expect(made.created).toBe(true);
    // Only the options were checked: the second request is not.
    expect(world.calls).toHaveLength(1);
  });

  it("ignores other members of the body, as before", async () => {
    expect((await asked({ turnstile: TOKEN, extra: [1, 2] })).status).toBe(200);
  });

  for (const [what, body] of [
    ["no body at all", undefined],
    ["an empty body object", {}],
    ["an empty token", { turnstile: "" }],
    ["a token over 2,048 characters", { turnstile: "x".repeat(2049) }],
    ["a token that isn't text", { turnstile: 12345 }],
    ["a null token", { turnstile: null }],
  ]) {
    it(`is refused not_allowed by "turnstile" with ${what}, without asking siteverify or writing anything`, async () => {
      const before = await challenges();
      const { status, body: answer } = await asked(body);
      expect(status).toBe(422);
      expect(answer).toMatchObject({ error: "not_allowed", rule: "turnstile" });
      expect(world.calls).toEqual([]);
      expect(await challenges()).toBe(before);
    });
  }

  it("takes a token of exactly 2,048 characters to siteverify", async () => {
    const long = "y".repeat(2048);
    const { body } = await asked({ turnstile: long });
    expect(body).toMatchObject({ error: "not_allowed", rule: "turnstile" });
    expect(world.calls.map((c) => c.form.response)).toEqual([long]);
  });

  it("is refused not_allowed by \"turnstile\" when siteverify fails the token, and nothing is written", async () => {
    const before = await challenges();
    const { status, body } = await asked({ turnstile: "a-token-siteverify-refuses" });
    expect(status).toBe(422);
    expect(body).toMatchObject({ error: "not_allowed", rule: "turnstile" });
    expect(world.calls).toHaveLength(1);
    expect(await challenges()).toBe(before);
  });

  it("is refused when the deployment's secret is Cloudflare's always-fail one", async () => {
    world.answer = (form) => [200, JSON.stringify({ success: form.secret === SECRET, "error-codes": [] })];
    const { body } = await asked({ turnstile: TOKEN }, { more: { TURNSTILE_SECRET: "2x0000000000000000000000000000000AA" } });
    expect(body).toMatchObject({ error: "not_allowed", rule: "turnstile" });
  });

  for (const code of ["invalid-input-secret", "missing-input-secret", "bad-request", "internal-error"]) {
    it(`is refused provider, never the reader's token, when siteverify says no for "${code}"`, async () => {
      // A wrong secret on the deployment fails every token. The reader's check didn't fail: the service's did.
      world.answer = () => [200, JSON.stringify({ success: false, "error-codes": [code] })];
      const before = await challenges();
      const { status, body } = await asked({ turnstile: TOKEN });
      expect(status).toBe(502);
      expect(body).toMatchObject({ error: "provider", which: "turnstile" });
      expect(await challenges()).toBe(before);
    });
  }

  it("is still not_allowed when siteverify names the token among its reasons", async () => {
    world.answer = () => [200, JSON.stringify({ success: false, "error-codes": ["timeout-or-duplicate"] })];
    const { status, body } = await asked({ turnstile: TOKEN });
    expect(status).toBe(422);
    expect(body).toMatchObject({ error: "not_allowed", rule: "turnstile" });
  });

  for (const [what, change] of [
    ["can't be reached", () => (world.down = true)],
    ["answers 500", () => (world.answer = () => [500, JSON.stringify({ success: true })])],
    ["answers 403", () => (world.answer = () => [403, ""])],
    ["answers something that isn't JSON", () => (world.answer = () => [200, "<html>gateway</html>"])],
    ["answers JSON without a verdict", () => (world.answer = () => [200, JSON.stringify({ ok: true })])],
    ["answers a verdict that isn't true or false", () => (world.answer = () => [200, JSON.stringify({ success: "yes" })])],
  ]) {
    it(`is refused provider, which "turnstile", when siteverify ${what}, and nothing is written`, async () => {
      change();
      const before = await challenges();
      const { status, body } = await asked({ turnstile: TOKEN });
      expect(status).toBe(502);
      expect(body).toMatchObject({ error: "provider", which: "turnstile" });
      expect(await challenges()).toBe(before);
    });
  }

  it("still refuses a body that is not JSON as bad_request, as every request does", async () => {
    const { status, body } = await call("POST", "/sign-in/new-passkey/options", {
      body: "not json",
      headers: { origin: ORIGIN },
      env: ON,
    });
    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "bad_request", field: "body" });
  });
});

describe("with the check on, an app's request (no Origin)", () => {
  it("is given options with no token and no body, and siteverify is never asked", async () => {
    const { status, body } = await call("POST", "/sign-in/new-passkey/options", { env: ON });
    expect(status).toBe(200);
    expect(body.publicKey.challenge).toBeTypeOf("string");
    expect(world.calls).toEqual([]);
  });

  it("is not checked even when it sends a token, or a body of any form", async () => {
    expect((await call("POST", "/sign-in/new-passkey/options", { body: { turnstile: "anything" }, env: ON })).status).toBe(200);
    expect((await call("POST", "/sign-in/new-passkey/options", { body: "not json", env: ON })).status).toBe(200);
    expect(world.calls).toEqual([]);
  });
});

describe("nothing else changes", () => {
  it("signing in with a passkey asks for no token, from a browser or an app", async () => {
    for (const headers of [{ origin: ORIGIN }, {}]) {
      expect((await call("POST", "/sign-in/passkey/options", { headers, env: ON })).status).toBe(200);
    }
    expect(world.calls).toEqual([]);
  });
});

describe("the secret", () => {
  it("appears in no answer and no log line, whatever the check answers", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const answers = [
        await call("GET", "/sign-in", { env: ON }),
        await asked({ turnstile: TOKEN }),
        await asked({ turnstile: "refused" }),
        await asked({}),
      ];
      world.down = true;
      answers.push(await asked({ turnstile: TOKEN }));
      for (const { body, headers } of answers) {
        expect(JSON.stringify(body)).not.toContain(SECRET);
        expect(JSON.stringify([...headers])).not.toContain(SECRET);
      }
      const lines = [...log.mock.calls, ...error.mock.calls, ...warn.mock.calls].map((args) => args.join(" "));
      expect(lines.length).toBeGreaterThanOrEqual(5);
      for (const line of lines) {
        expect(line).not.toContain(SECRET);
        expect(line).not.toContain(TOKEN);
      }
      // The refusals are logged by word, as every refusal is.
      expect(lines.filter((line) => line.includes('"refused":"not_allowed"'))).toHaveLength(2);
      expect(lines.filter((line) => line.includes('"refused":"provider"'))).toHaveLength(1);
    } finally {
      log.mockRestore();
      error.mockRestore();
      warn.mockRestore();
    }
  });
});
