// How often one address may post (src/index.js, `allowed`). The limiter here
// is the one wrangler.jsonc declares, run by workerd's own local copy of
// Cloudflare's rate limiting, so the number under test is the configured one.
//
// Every other test file posts each request from an address of its own
// (test/post.js); these post from one.
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import config from "../wrangler.jsonc?raw";
import { RETRY_SECONDS } from "../src/http.js";
import { clear, postLegacy, rows, send } from "./post.js";

let n = 0;
/** An address no other test here has used, so each test starts from a count of nothing. */
const address = () => `2001:db8:ffff::${(++n).toString(16)}`;
const from = (ip) => ({ headers: { "cf-connecting-ip": ip } });

const found = /"name": "REPORT_LIMIT", "namespace_id": "\d+", "simple": \{ "limit": (\d+), "period": (\d+) \}/.exec(config);
const LIMIT = { limit: Number(found[1]), period: Number(found[2]) };

// THE LOCAL LIMITER COUNTS IN WINDOWS ALIGNED TO THE WALL CLOCK: it starts a
// key's count again each time floor(now / period) moves. A burst under way as
// the clock crosses the top of a minute is counted in two halves and never
// refused, so a test that expects an exact count would fail through no fault
// of the Worker's (the notebook service's suite met this on 2026-11-24, and
// its test/limits.test.js has the whole account). So every test here starts
// with room to finish inside one window.
const WINDOW_MS = LIMIT.period * 1000;
/** Longer than a test may take (Vitest stops one at five seconds). */
const ROOM_MS = 6000;

beforeEach(async () => {
  const left = WINDOW_MS - (Date.now() % WINDOW_MS);
  if (left < ROOM_MS) await new Promise((resolve) => setTimeout(resolve, left + 100));
  await clear();
}, ROOM_MS + 5000);

/** Posts from `ip` until refused, at most `most` times. Returns how many were taken before the refusal, and the refusal. */
async function until(ip, most) {
  for (let i = 0; i < most; i++) {
    const res = await postLegacy({}, from(ip));
    if (res.status === 429) return { passed: i, refused: res };
  }
  return { passed: most, refused: null };
}

describe("the limit on one address", () => {
  it("is 120 posts a minute, as wrangler.jsonc gives it", () => {
    expect(LIMIT).toEqual({ limit: 120, period: 60 });
    expect(RETRY_SECONDS).toBe(LIMIT.period);
  });

  it("answers 429 with nothing but how long to wait, once one address has posted that many times", async () => {
    const { passed, refused } = await until(address(), LIMIT.limit + 20);
    expect(passed).toBe(LIMIT.limit);
    expect([refused.status, refused.text]).toEqual([429, ""]);
    expect(refused.headers.get("retry-after")).toBe("60");
    expect(refused.headers.get("cache-control")).toBe("no-store");
  });

  it("counts nothing for a refused post", async () => {
    const ip = address();
    await until(ip, LIMIT.limit + 1);
    expect((await rows())[0].n).toBe(LIMIT.limit);
    for (let i = 0; i < 5; i++) expect((await postLegacy({}, from(ip))).status).toBe(429);
    expect((await rows())[0].n).toBe(LIMIT.limit);
  });

  it("counts a post of any kind against the address, a refused one included, before anything of it is read", async () => {
    const ip = address();
    for (let i = 0; i < LIMIT.limit; i++) await send("POST", { type: "text/plain", body: "x", ...from(ip) });
    expect((await postLegacy({}, from(ip))).status).toBe(429);
    expect(await rows()).toEqual([]);
  });

  it("leaves every other address alone", async () => {
    await until(address(), LIMIT.limit + 1);
    expect((await postLegacy({}, from(address()))).status).toBe(204);
  });

  it("stores the address nowhere after a refusal, and logs nothing", async () => {
    const spies = ["log", "info", "warn", "error", "debug"].map((level) => vi.spyOn(console, level).mockImplementation(() => {}));
    try {
      await until(address(), LIMIT.limit + 3);
      for (const table of ["counts", "days"]) {
        const { results } = await env.DB.prepare(`SELECT * FROM ${table}`).all();
        expect(JSON.stringify(results), table).not.toContain("2001:db8");
      }
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});

describe("a deployment whose limiter is missing or broken", () => {
  it("answers 500 to everything when the binding is missing, instead of running unlimited unnoticed", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await postLegacy({}, { env: { REPORT_LIMIT: undefined } });
      expect([res.status, res.text]).toEqual([500, ""]);
      expect(JSON.parse(error.mock.calls[0][0])).toEqual({ failure: "request", error: "no REPORT_LIMIT binding" });
      expect(await rows()).toEqual([]);
    } finally {
      error.mockRestore();
    }
  });

  it("lets the post through when the limiter itself fails: a brake that sticks must not stop the reports", async () => {
    const broken = { limit: async () => { throw new Error("the limiter is down"); } };
    expect((await postLegacy({}, { env: { REPORT_LIMIT: broken } })).status).toBe(204);
    expect(await rows()).toHaveLength(1);
  });

  it("hands the limiter the address as its key, and nothing else of the request", async () => {
    const seen = [];
    const spy = { limit: async (options) => (seen.push(options), { success: true }) };
    await postLegacy({}, { headers: { "cf-connecting-ip": "203.0.113.7" }, env: { REPORT_LIMIT: spy } });
    expect(seen).toEqual([{ key: "203.0.113.7" }]);
  });
});
