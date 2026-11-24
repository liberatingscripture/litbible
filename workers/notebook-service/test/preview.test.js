// The preview's way in: impossible to reach unless the environment turns it
// on, and (when on) what it checks.
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { LIMITS } from "../src/check.js";
import { SECRET, call, freshAccount } from "./call.js";
import { must, ref, setUp, signIn } from "./notebook.js";

const b64 = ref.toBase64url;
const bytesOf = (n) => b64(new Uint8Array(n).fill(5));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const waysNamed = async (name) =>
  (await env.DB.prepare("SELECT COUNT(*) AS n FROM ways WHERE kind = 'preview' AND subject = ?").bind(name).first()).n;

const OFF = {
  "PREVIEW_SIGN_IN is not set": { PREVIEW_SIGN_IN: undefined },
  'PREVIEW_SIGN_IN is "off"': { PREVIEW_SIGN_IN: "off" },
  'PREVIEW_SIGN_IN is "ON"': { PREVIEW_SIGN_IN: "ON" },
  'PREVIEW_SIGN_IN is "true"': { PREVIEW_SIGN_IN: "true" },
  'PREVIEW_SIGN_IN is "1"': { PREVIEW_SIGN_IN: "1" },
  "PREVIEW_SIGN_IN is empty": { PREVIEW_SIGN_IN: "" },
  'ENVIRONMENT is "production", though the flag is on': { ENVIRONMENT: "production", PREVIEW_SIGN_IN: "on" },
  // The environment must name itself "preview," to the letter: an allow-list, so an environment
  // nobody thought to name (production's own top level sets no ENVIRONMENT) is off too.
  "ENVIRONMENT is not set, though the flag is on": { ENVIRONMENT: undefined, PREVIEW_SIGN_IN: "on" },
  "ENVIRONMENT is empty, though the flag is on": { ENVIRONMENT: "", PREVIEW_SIGN_IN: "on" },
  'ENVIRONMENT is "Preview", though the flag is on': { ENVIRONMENT: "Preview", PREVIEW_SIGN_IN: "on" },
  'ENVIRONMENT is "staging", though the flag is on': { ENVIRONMENT: "staging", PREVIEW_SIGN_IN: "on" },
  "PREVIEW_SECRET is not set": { PREVIEW_SECRET: undefined },
  "PREVIEW_SECRET is empty": { PREVIEW_SECRET: "" },
  "PREVIEW_SECRET is 31 characters": { PREVIEW_SECRET: "s".repeat(31) },
  "PREVIEW_SECRET is not a string": { PREVIEW_SECRET: 12345678901234567890123456789012 },
};

describe("the preview's way in, when the environment does not turn it on", () => {
  for (const [name, env] of Object.entries(OFF)) {
    describe(name, () => {
      it("answers /preview/session as it answers a path that was never written", async () => {
        const account = freshAccount();
        const secret = env.PREVIEW_SECRET ?? SECRET;
        const asked = await call("POST", "/preview/session", { env, body: { secret: typeof secret === "string" ? secret : SECRET, account } });
        const never = await call("POST", "/preview/never-written", { env, body: { secret: SECRET, account } });
        expect(asked.status).toBe(404);
        expect(asked.body.error).toBe("not_found");
        expect({ ...asked.body, time: 0 }).toEqual({ ...never.body, time: 0 });
        expect([...asked.headers].filter(([k]) => k !== "date")).toEqual([...never.headers].filter(([k]) => k !== "date"));
        expect(await waysNamed(account)).toBe(0);
      });

      it("answers /preview/passkeys the same way, even with a good session", async () => {
        const token = await signIn(freshAccount());
        const asked = await call("POST", "/preview/passkeys", { token, env, body: { credential: bytesOf(8), syncs: true } });
        const never = await call("POST", "/preview/never-written", { token, env, body: { credential: bytesOf(8), syncs: true } });
        expect(asked.status).toBe(404);
        expect({ ...asked.body, time: 0 }).toEqual({ ...never.body, time: 0 });
        // And no way in was listed.
        const account = await must("GET", "/account", { token });
        expect(account.ways.map((w) => w.kind)).toEqual(["preview"]);
      });

      it("makes GET / report preview: false", async () => {
        const res = await call("GET", "/", { env });
        expect(res.status).toBe(200);
        expect(res.body.preview).toBe(false);
      });
    });
  }

  it("is on at a secret of exactly 32 characters, in an environment that names itself preview", async () => {
    for (const env of [{ PREVIEW_SECRET: "s".repeat(32) }, { ENVIRONMENT: "preview" }]) {
      expect((await call("GET", "/", { env })).body.preview, JSON.stringify(env)).toBe(true);
    }
    const res = await call("POST", "/preview/session", {
      env: { PREVIEW_SECRET: "s".repeat(32) },
      body: { secret: "s".repeat(32), account: freshAccount() },
    });
    expect(res.status).toBe(200);
  });

  it("keeps every other route working when the way in is off", async () => {
    const { account } = await setUp();
    const off = { PREVIEW_SIGN_IN: undefined };
    expect((await call("GET", "/account", { env: off })).body.error).toBe("sign_in");
    expect(account).toBeTruthy();
  });
});

describe("POST /preview/session, when on", () => {
  it("refuses a wrong secret with 401 preview_secret, and makes no account", async () => {
    const account = freshAccount();
    const before = (await env.DB.prepare("SELECT COUNT(*) AS n FROM sessions").first()).n;
    const res = await call("POST", "/preview/session", { body: { secret: `${SECRET}x`, account } });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("preview_secret");
    expect(await waysNamed(account)).toBe(0);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM sessions").first()).n).toBe(before);
  });

  it("refuses a secret that is a prefix of the right one, and one that is longer", async () => {
    for (const secret of [SECRET.slice(0, -1), SECRET.slice(0, 10), `${SECRET}${SECRET}`, ""]) {
      const res = await call("POST", "/preview/session", { body: { secret, account: freshAccount() } });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("preview_secret");
    }
  });

  it("refuses a missing secret, and one that is not a string, the same way", async () => {
    for (const body of [{ account: "x" }, { secret: null, account: "x" }, { secret: 12, account: "x" }, { secret: [SECRET], account: "x" }]) {
      const res = await call("POST", "/preview/session", { body });
      expect(res.status, JSON.stringify(body)).toBe(401);
      expect(res.body.error).toBe("preview_secret");
    }
    expect(await waysNamed("x")).toBe(0);
  });

  it("checks the secret before the account's name", async () => {
    const res = await call("POST", "/preview/session", { body: { secret: "wrong", account: "bad name!" } });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("preview_secret");
  });

  const NAMES = {
    "empty": "",
    "65 characters": "a".repeat(65),
    "with a space": "a b",
    "with a slash": "a/b",
    "with an at sign": "a@b",
    "with a colon": "a:b",
    "with a non-ASCII letter": "café",
    "a number": 12,
    "null": null,
    "missing": undefined,
  };
  for (const [name, account] of Object.entries(NAMES)) {
    it(`refuses an account name that is ${name}, with bad_request naming account`, async () => {
      const res = await call("POST", "/preview/session", { body: { secret: SECRET, account } });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("bad_request");
      expect(res.body.field).toBe("account");
      if (typeof account === "string") expect(await waysNamed(account)).toBe(0);
    });
  }

  it("accepts a name of 64 characters, and dots, hyphens, underscores, and digits", async () => {
    for (const account of [`${freshAccount()}`.padEnd(64, "x"), "a.b-c_d9", "A".repeat(1) + Date.now()]) {
      const res = await call("POST", "/preview/session", { body: { secret: SECRET, account } });
      expect(res.status, account).toBe(200);
    }
  });

  it("answers token, expires, and nothing else after time", async () => {
    const res = await call("POST", "/preview/session", { body: { secret: SECRET, account: freshAccount() } });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["time", "token", "expires"]);
    expect(res.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(ref.fromBase64url(res.body.token).length).toBe(32);
  });

  it("gives a session that expires about 30 days on", async () => {
    const res = await call("POST", "/preview/session", { body: { secret: SECRET, account: freshAccount() } });
    const days = (Date.parse(res.body.expires) - Date.now()) / 86_400_000;
    expect(res.body.expires).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });

  it("gives a different token each time", async () => {
    const account = freshAccount();
    const tokens = new Set();
    for (let i = 0; i < 5; i++) tokens.add((await must("POST", "/preview/session", { body: { secret: SECRET, account } })).token);
    expect(tokens.size).toBe(5);
  });

  it("gives the same name the same account, so a second session sees the first's notebook", async () => {
    const { account, held } = await setUp();
    const token = await signIn(account);
    const seen = await must("GET", "/account", { token });
    expect(seen.notebook).toBe(held.notebook);
    expect(await waysNamed(account)).toBe(1);
  });

  it("gives different names different accounts", async () => {
    const a = await setUp();
    const other = await signIn(freshAccount());
    const seen = await must("GET", "/account", { token: other });
    expect(seen.notebook).toBeNull();
    expect(seen.kid).toBe(0);
    expect(a.held.notebook).toBeTruthy();
    // Names that differ only in case are two accounts too.
    const lower = `case-${Date.now().toString(36)}`;
    const one = await must("POST", "/preview/session", { body: { secret: SECRET, account: lower } });
    const two = await must("POST", "/preview/session", { body: { secret: SECRET, account: lower.toUpperCase() } });
    const ids = await Promise.all([one, two].map((s) => must("GET", "/account", { token: s.token })));
    expect(ids[0].ways[0].id).not.toBe(ids[1].ways[0].id);
  });

  it("makes one account for two first requests with a new name at once", async () => {
    const account = freshAccount();
    const both = await Promise.all([1, 2, 3].map(() => call("POST", "/preview/session", { body: { secret: SECRET, account } })));
    expect(both.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(await waysNamed(account)).toBe(1);
    const ways = await Promise.all(both.map((r) => must("GET", "/account", { token: r.body.token })));
    expect(new Set(ways.map((w) => w.ways[0].id)).size).toBe(1);
  });

  it("stores the account's name only as the way's subject, and never the token", async () => {
    const account = freshAccount();
    const { token } = await must("POST", "/preview/session", { body: { secret: SECRET, account } });
    for (const table of ["sessions", "ways", "accounts", "devices", "holders", "rows", "approvals"]) {
      const { results } = await env.DB.prepare(`SELECT * FROM ${table}`).all();
      expect(JSON.stringify(results), table).not.toContain(token);
    }
    const hash = b64(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))));
    const stored = await env.DB.prepare("SELECT token_hash FROM sessions WHERE token_hash = ?").bind(hash).first();
    expect(stored?.token_hash).toBe(hash);
    expect(hash).not.toBe(token);
  });

  it("does not store the preview's secret anywhere", async () => {
    await must("POST", "/preview/session", { body: { secret: SECRET, account: freshAccount() } });
    for (const table of ["sessions", "ways", "accounts"]) {
      const { results } = await env.DB.prepare(`SELECT * FROM ${table}`).all();
      expect(JSON.stringify(results), table).not.toContain(SECRET);
    }
  });
});

describe("POST /preview/passkeys", () => {
  it("needs a session", async () => {
    for (const headers of [{}, { authorization: `Bearer ${b64(ref.randomBytes(32))}` }]) {
      const res = await call("POST", "/preview/passkeys", { headers, body: { credential: bytesOf(8), syncs: true } });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("sign_in");
    }
  });

  it("answers the way's id, the credential, and syncs, and lists it in /account", async () => {
    const token = await signIn(freshAccount());
    const credential = bytesOf(20);
    const res = await call("POST", "/preview/passkeys", { token, body: { credential, syncs: true } });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["time", "id", "credential", "syncs"]);
    expect(res.body.id).toMatch(UUID);
    expect(res.body).toMatchObject({ credential, syncs: true });
    const account = await must("GET", "/account", { token });
    expect(account.ways).toContainEqual({ id: res.body.id, kind: "passkey", added: expect.any(String), credential, syncs: true });
  });

  it("lists a passkey with syncs false as not syncing", async () => {
    const token = await signIn(freshAccount());
    const credential = bytesOf(21);
    await must("POST", "/preview/passkeys", { token, body: { credential, syncs: false } });
    const way = (await must("GET", "/account", { token })).ways.find((w) => w.credential === credential);
    expect(way.syncs).toBe(false);
  });

  const BAD_CREDENTIALS = {
    "missing": undefined,
    "a number": 12,
    "null": null,
    "empty": "",
    "padded": `${bytesOf(20)}=`,
    "spelled with a plus sign": `+${bytesOf(20).slice(1)}`,
    "spelled with a slash": `/${bytesOf(20).slice(1)}`,
    "spelled with leftover bits": `${bytesOf(20).slice(0, -1)}B`,
    "one byte over the limit": bytesOf(LIMITS.credentialBytes + 1),
    "far over the limit": bytesOf(LIMITS.credentialBytes * 4),
  };
  for (const [name, credential] of Object.entries(BAD_CREDENTIALS)) {
    it(`refuses a credential that is ${name}, naming credential`, async () => {
      const token = await signIn(freshAccount());
      const res = await call("POST", "/preview/passkeys", { token, body: { credential, syncs: true } });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("bad_request");
      expect(res.body.field).toBe("credential");
      expect((await must("GET", "/account", { token })).ways.length).toBe(1);
    });
  }

  it("accepts a credential of one byte and one of exactly the limit", async () => {
    const token = await signIn(freshAccount());
    for (const credential of [bytesOf(1), bytesOf(LIMITS.credentialBytes)]) {
      expect((await call("POST", "/preview/passkeys", { token, body: { credential, syncs: true } })).status).toBe(200);
    }
  });

  for (const [name, syncs] of [["a string", "true"], ["a number", 1], ["null", null], ["missing", undefined], ["an array", [true]]]) {
    it(`refuses syncs that is ${name}, naming syncs`, async () => {
      const token = await signIn(freshAccount());
      const res = await call("POST", "/preview/passkeys", { token, body: { credential: bytesOf(20), syncs } });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("bad_request");
      expect(res.body.field).toBe("syncs");
      expect((await must("GET", "/account", { token })).ways.length).toBe(1);
    });
  }

  it("refuses the same credential twice on one account with exists, naming passkey", async () => {
    const token = await signIn(freshAccount());
    const credential = bytesOf(20);
    await must("POST", "/preview/passkeys", { token, body: { credential, syncs: true } });
    for (const syncs of [true, false]) {
      const again = await call("POST", "/preview/passkeys", { token, body: { credential, syncs } });
      expect(again.status).toBe(409);
      expect(again.body.error).toBe("exists");
      expect(again.body.what).toBe("passkey");
    }
    const way = (await must("GET", "/account", { token })).ways.filter((w) => w.credential === credential);
    expect(way).toHaveLength(1);
    expect(way[0].syncs).toBe(true);
  });

  it("allows the same credential on two accounts", async () => {
    const credential = bytesOf(20);
    for (let i = 0; i < 2; i++) {
      const token = await signIn(freshAccount());
      expect((await call("POST", "/preview/passkeys", { token, body: { credential, syncs: true } })).status).toBe(200);
    }
  });

  it("allows a signed-in session to list a passkey before the account has a notebook", async () => {
    const token = await signIn(freshAccount());
    expect((await call("POST", "/preview/passkeys", { token, body: { credential: bytesOf(9), syncs: true } })).status).toBe(200);
  });

  it("needs an open session once the account has a notebook: a signed-in one gets not_open", async () => {
    const { account } = await setUp();
    const token = await signIn(account);
    const credential = bytesOf(20);
    const res = await call("POST", "/preview/passkeys", { token, body: { credential, syncs: true } });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("not_open");
    expect(res.body.kid).toBe(1);
    expect((await must("GET", "/account", { token })).ways.some((w) => w.credential === credential)).toBe(false);
  });

  it("accepts an open session once the account has a notebook", async () => {
    const { device } = await setUp();
    const credential = bytesOf(20);
    const res = await call("POST", "/preview/passkeys", { token: device.token, body: { credential, syncs: true } });
    expect(res.status).toBe(200);
  });
});
