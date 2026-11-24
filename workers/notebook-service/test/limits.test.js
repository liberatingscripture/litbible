// How often a client may ask (src/limits.js): two limits, each counted by the
// address a request comes from. The limiters here are the ones wrangler.jsonc
// declares, run by workerd's own local copy of Cloudflare's rate limiting, so
// the numbers under test are the configured ones.
//
// Every other test file sends each request from an address of its own
// (test/call.js); these send from one.
import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import config from "../wrangler.jsonc?raw";
import { RETRY_SECONDS, limitFor } from "../src/limits.js";
import { SECRET, call, freshAccount } from "./call.js";
import { must, signIn } from "./notebook.js";

let n = 0;
/** An address no other test here has used, so each test starts from a count of nothing. */
const address = () => `2001:db8:ffff::${(++n).toString(16)}`;
const from = (ip) => ({ headers: { "cf-connecting-ip": ip } });

/** The number wrangler.jsonc gives a limiter in the preview's environment, which the tests run as. */
function configured(name) {
  const found = new RegExp(`"name": "${name}", "namespace_id": "\\d+", "simple": \\{ "limit": (\\d+), "period": (\\d+) \\}`).exec(config);
  return { limit: Number(found[1]), period: Number(found[2]) };
}
const SIGN_IN = configured("SIGN_IN_LIMIT");
const REQUEST = configured("REQUEST_LIMIT");

/** Sends `send` until it is refused, at most `most` times. Returns how many were answered before the refusal, and the refusal. */
async function until(send, most) {
  for (let i = 0; i < most; i++) {
    const res = await send();
    if (res.status === 429) return { passed: i, refused: res };
  }
  return { passed: most, refused: null };
}

describe("which limit a request is counted under", () => {
  it("counts every request that begins a sign-in, and the preview's way in, under SIGN_IN_LIMIT", () => {
    for (const route of [
      "POST /sign-in/challenge",
      "POST /sign-in/passkey/options",
      "POST /sign-in/passkey",
      "POST /sign-in/new-passkey/options",
      "POST /sign-in/new-passkey",
      "POST /sign-in/apple",
      "POST /sign-in/google",
      "POST /preview/session",
    ]) {
      expect(limitFor(route), route).toBe("SIGN_IN_LIMIT");
    }
  });

  it("counts everything else, a path that doesn't exist included, under REQUEST_LIMIT", () => {
    for (const route of ["GET /", "GET /sign-in", "GET /account", "DELETE /account", "POST /rows", "POST /ways/passkey", "POST /preview/passkeys", undefined]) {
      expect(limitFor(route), String(route)).toBe("REQUEST_LIMIT");
    }
  });

  it("has the numbers the spec gives: 60 a minute to begin a sign-in, 1,200 a minute for the rest", () => {
    expect(SIGN_IN).toEqual({ limit: 60, period: 60 });
    expect(REQUEST).toEqual({ limit: 1200, period: 60 });
    expect(RETRY_SECONDS).toBe(60);
  });
});

describe("the sign-in limit", () => {
  it("answers slow_down, 429, with how long to wait, once one address has asked the configured number of times", async () => {
    const ip = address();
    const { passed, refused } = await until(() => call("POST", "/sign-in/passkey/options", from(ip)), SIGN_IN.limit + 20);
    expect(passed).toBe(SIGN_IN.limit);
    expect(refused.status).toBe(429);
    expect(Object.keys(refused.body)).toEqual(["time", "error", "message", "retry"]);
    expect(refused.body).toMatchObject({ error: "slow_down", retry: 60 });
    expect(refused.headers.get("retry-after")).toBe("60");
    expect(refused.headers.get("cache-control")).toBe("no-store");
  });

  it("writes nothing for a refused request: no challenge is made", async () => {
    const ip = address();
    await until(() => call("POST", "/sign-in/passkey/options", from(ip)), SIGN_IN.limit + 1);
    const before = (await env.DB.prepare("SELECT COUNT(*) AS n FROM challenges").first()).n;
    for (let i = 0; i < 5; i++) expect((await call("POST", "/sign-in/passkey/options", from(ip))).status).toBe(429);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM challenges").first()).n).toBe(before);
  });

  it("is one count for every way of beginning a sign-in, not one for each", async () => {
    const ip = address();
    const paths = ["/sign-in/passkey/options", "/sign-in/new-passkey/options", "/sign-in/passkey", "/sign-in/new-passkey"];
    let i = 0;
    const { passed } = await until(() => call("POST", paths[i++ % paths.length], { ...from(ip), body: {} }), SIGN_IN.limit + 20);
    expect(passed).toBe(SIGN_IN.limit);
  });

  it("counts the preview's way in, so its secret can't be guessed at without end", async () => {
    const ip = address();
    const { passed, refused } = await until(() => call("POST", "/preview/session", { ...from(ip), body: { secret: "x".repeat(40), account: "guess" } }), SIGN_IN.limit + 20);
    expect(passed).toBe(SIGN_IN.limit);
    expect(refused.body.error).toBe("slow_down");
    // Even the right secret is refused from that address now.
    expect((await call("POST", "/preview/session", { ...from(ip), body: { secret: SECRET, account: freshAccount() } })).status).toBe(429);
  });

  it("leaves every other address alone", async () => {
    const ip = address();
    await until(() => call("POST", "/sign-in/passkey/options", from(ip)), SIGN_IN.limit + 1);
    expect((await call("POST", "/sign-in/passkey/options", from(address()))).status).toBe(200);
  });

  it("leaves the same address's other requests alone: a device already signed in keeps working", async () => {
    const ip = address();
    const token = await signIn(freshAccount());
    await until(() => call("POST", "/sign-in/passkey/options", from(ip)), SIGN_IN.limit + 1);
    expect((await call("GET", "/account", { token, ...from(ip) })).status).toBe(200);
    expect((await call("GET", "/", from(ip))).status).toBe(200);
  });
});

describe("the limit on every other request", () => {
  it("answers slow_down once one address has asked the configured number of times, with a session or without", async () => {
    const ip = address();
    const token = await signIn(freshAccount());
    let i = 0;
    const send = () => (i++ % 2 ? call("GET", "/account", { token, ...from(ip) }) : call("GET", "/no/such/path", from(ip)));
    const { passed, refused } = await until(send, REQUEST.limit + 20);
    expect(passed).toBe(REQUEST.limit);
    expect(refused.body).toMatchObject({ error: "slow_down", retry: 60 });
    // The session itself is untouched, and works from another address.
    expect((await call("GET", "/account", { token })).status).toBe(200);
  });

  it("still lets that address begin a sign-in: the two are counted apart", async () => {
    const ip = address();
    await until(() => call("GET", "/", from(ip)), REQUEST.limit + 1);
    expect((await call("GET", "/", from(ip))).status).toBe(429);
    expect((await call("POST", "/sign-in/passkey/options", from(ip))).status).toBe(200);
  });
});

describe("what a limit never does", () => {
  it("counts no preflight", async () => {
    const ip = address();
    for (let i = 0; i < SIGN_IN.limit + 5; i++) {
      await call("OPTIONS", "/sign-in/passkey/options", { headers: { "cf-connecting-ip": ip, origin: "https://litbible.net" } });
    }
    expect((await call("POST", "/sign-in/passkey/options", from(ip))).status).toBe(200);
  });

  it("answers a browser's refused request with the CORS headers, so the page can read the refusal", async () => {
    const ip = address();
    const headers = { "cf-connecting-ip": ip, origin: "https://litbible.net" };
    const { refused } = await until(() => call("POST", "/sign-in/passkey/options", { headers }), SIGN_IN.limit + 1);
    expect(refused.headers.get("access-control-allow-origin")).toBe("https://litbible.net");
  });

  it("logs the refusal as any other, by the route's pattern, and never the address", async () => {
    const ip = address();
    await until(() => call("POST", "/sign-in/passkey/options", from(ip)), SIGN_IN.limit);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await call("POST", "/sign-in/passkey/options", from(ip));
      expect(error).not.toHaveBeenCalled();
      const line = log.mock.calls[0][0];
      expect(JSON.parse(line)).toMatchObject({ route: "POST /sign-in/passkey/options", status: 429, refused: "slow_down" });
      expect(line).not.toContain(ip);
      expect(line).not.toContain("2001");
    } finally {
      log.mockRestore();
      error.mockRestore();
    }
  });

  it("stores the address nowhere: no table holds it after a refusal", async () => {
    const ip = address();
    await until(() => call("POST", "/sign-in/passkey/options", from(ip)), SIGN_IN.limit + 1);
    const tables = (await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%'").all()).results;
    expect(tables.length).toBeGreaterThan(8);
    for (const { name } of tables) {
      const { results } = await env.DB.prepare(`SELECT * FROM ${name}`).all();
      expect(JSON.stringify(results), name).not.toContain("2001:db8:ffff");
    }
  });
});

describe("a deployment whose limiter is missing or broken", () => {
  it("answers error to everything when a binding is missing, instead of running unlimited unnoticed", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      for (const [missing, path] of [["REQUEST_LIMIT", "/"], ["SIGN_IN_LIMIT", "/sign-in"]]) {
        const method = path === "/" ? "GET" : "POST";
        const res = await call(method, path === "/" ? "/" : "/sign-in/passkey/options", { env: { [missing]: undefined } });
        expect([res.status, res.body.error], missing).toEqual([500, "error"]);
      }
      expect(error).toHaveBeenCalledTimes(2);
    } finally {
      error.mockRestore();
    }
  });

  it("lets the request through when the limiter itself fails: a brake that sticks must not stop the service", async () => {
    const broken = { limit: async () => { throw new Error("the limiter is down"); } };
    expect((await call("GET", "/", { env: { REQUEST_LIMIT: broken } })).status).toBe(200);
    expect((await must("POST", "/sign-in/passkey/options", { env: { SIGN_IN_LIMIT: broken } })).publicKey.challenge).toBeTruthy();
  });

  it("hands the limiter the address as its key, and nothing else of the request", async () => {
    const seen = [];
    const spy = { limit: async (options) => (seen.push(options), { success: true }) };
    const token = await signIn(freshAccount());
    await call("GET", "/account?x=1", { token, headers: { "cf-connecting-ip": "203.0.113.7" }, env: { REQUEST_LIMIT: spy } });
    expect(seen).toEqual([{ key: "203.0.113.7" }]);
  });
});
