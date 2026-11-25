// The counts (src/store.js): alike reports add to one row, a day has a cap
// that is all or nothing for a post, and a count is deleted after 30 days.
//
// Time is tested by moving the clock itself (only `Date` is faked), so the
// day a real post and a real cron run would read is the one tested.
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index.js";
import { DAILY_CAP, KEEP_DAYS, count, dayOf, prune } from "../src/store.js";
import { clear, modern, postLegacy, postModern, rows } from "./post.js";

const DAY = 24 * 60 * 60 * 1000;
const days = async () => (await env.DB.prepare("SELECT day, n FROM days ORDER BY day").all()).results;
const total = async () => (await env.DB.prepare("SELECT COALESCE(SUM(n), 0) AS n FROM counts").first()).n;
const capped = (cap) => ({ env: { DAILY_CAP: String(cap) } });

// Called with nothing: Vitest hands a hook its own context, which is not a database.
beforeEach(() => clear());
afterEach(() => vi.useRealTimers());

describe("adding to the counts", () => {
  it("adds alike reports to one row, across posts, and keeps the day's total beside them", async () => {
    await postLegacy();
    await postLegacy();
    await postLegacy({ "blocked-uri": "inline", "effective-directive": "script-src-elem" });
    expect((await rows()).map((row) => [row.directive, row.blocked, row.n])).toEqual([
      ["connect-src", "https://api.example.com", 2],
      ["script-src-elem", "inline", 1],
    ]);
    expect(await days()).toEqual([{ day: dayOf(Date.now()), n: 3 }]);
  });

  it("keeps apart reports that differ in any one of the six things kept", async () => {
    const base = modern();
    await postModern([
      base,
      modern({ disposition: "enforce" }),
      modern({ effectiveDirective: "img-src" }),
      modern({ blockedURL: "https://other.example.com/" }),
      modern({ documentURL: "https://litbible.net/john-4/" }),
      modern({ sourceFile: "https://litbible.net/_astro/other.js" }),
      modern({}, { user_agent: "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0" }),
    ]);
    expect(await rows()).toHaveLength(7);
    expect(await total()).toBe(7);
  });

  it("puts each UTC day's reports under that day", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-11-24T23:59:58Z"));
    await postLegacy();
    vi.setSystemTime(Date.parse("2026-11-25T00:00:01Z"));
    await postLegacy();
    await postLegacy();
    expect(await days()).toEqual([
      { day: "2026-11-24", n: 1 },
      { day: "2026-11-25", n: 2 },
    ]);
    expect((await rows()).map((row) => [row.day, row.n])).toEqual([
      ["2026-11-24", 1],
      ["2026-11-25", 2],
    ]);
  });
});

describe("the day's cap", () => {
  it("is 5,000 reports, and a number of the environment's own that isn't a whole one above nothing is ignored", async () => {
    expect(DAILY_CAP).toBe(5000);
    for (const odd of ["abc", "0", "-3", "2.5", ""]) {
      for (let i = 0; i < 3; i++) await postLegacy({}, capped(odd));
    }
    expect(await total()).toBe(15);
  });

  it("counts up to the cap and no further, and answers the post over it exactly as any other", async () => {
    for (let i = 0; i < 5; i++) expect((await postLegacy({}, capped(5))).status).toBe(204);
    const over = await postLegacy({}, capped(5));
    expect([over.status, over.text]).toEqual([204, ""]);
    expect(await total()).toBe(5);
    expect(await days()).toEqual([{ day: dayOf(Date.now()), n: 5 }]);
  });

  it("is all or nothing for one post: a post that doesn't fit whole adds no row and moves no total", async () => {
    await postModern([modern(), modern(), modern(), modern()], capped(5));
    expect(await total()).toBe(4);
    // Two more would make six: neither is counted, not even the one there was room for.
    await postModern([modern({ effectiveDirective: "img-src" }), modern({ effectiveDirective: "font-src" })], capped(5));
    expect(await total()).toBe(4);
    expect(await rows()).toHaveLength(1);
    expect((await days())[0].n).toBe(4);
    // One still fits, and brings the day to its cap.
    await postModern([modern({ effectiveDirective: "img-src" })], capped(5));
    expect(await total()).toBe(5);
    expect(await rows()).toHaveLength(2);
  });

  it("starts again the next UTC day", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-11-24T12:00:00Z"));
    for (let i = 0; i < 4; i++) await postLegacy({}, capped(3));
    expect(await total()).toBe(3);
    vi.setSystemTime(Date.parse("2026-11-25T00:00:00Z"));
    for (let i = 0; i < 4; i++) await postLegacy({}, capped(3));
    expect(await days()).toEqual([
      { day: "2026-11-24", n: 3 },
      { day: "2026-11-25", n: 3 },
    ]);
  });

  it("says whether a post was counted, and writes nothing for an empty one", async () => {
    const entry = { disposition: "report", directive: "img-src", blocked: "data", page: "/", source: "", browser: "safari", n: 2 };
    expect(await count(env.DB, "2026-11-24", [entry], 3)).toBe(true);
    expect(await count(env.DB, "2026-11-24", [entry], 3)).toBe(false);
    expect(await count(env.DB, "2026-11-24", [], 3)).toBe(false);
    expect(await days()).toEqual([{ day: "2026-11-24", n: 2 }]);
  });
});

describe("deleting what is older than 30 days", () => {
  const entry = (page) => ({ disposition: "report", directive: "img-src", blocked: "data", page, source: "", browser: "safari", n: 1 });
  const now = Date.parse("2026-12-24T04:41:00Z");

  async function seed() {
    for (const back of [0, 1, 29, 30, 31, 45]) await count(env.DB, dayOf(now - back * DAY), [entry(`/back-${back}/`)]);
  }

  it("keeps the last 30 days and today, and deletes the days before from both tables", async () => {
    expect(KEEP_DAYS).toBe(30);
    await seed();
    expect(await prune(env.DB, now)).toBe("2026-11-24");
    expect((await rows()).map((row) => row.page).sort()).toEqual(["/back-0/", "/back-1/", "/back-29/", "/back-30/"]);
    expect((await days()).map((row) => row.day)).toEqual(["2026-11-24", "2026-11-25", "2026-12-23", "2026-12-24"]);
  });

  it("is what the daily run does, at the time the run was scheduled for", async () => {
    await seed();
    await worker.scheduled({ scheduledTime: now, cron: "41 4 * * *" }, env);
    expect(await rows()).toHaveLength(4);
  });

  it("reads the clock when a run carries no time", async () => {
    await seed();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now + 10 * DAY);
    await worker.scheduled({}, env);
    expect((await rows()).map((row) => row.page).sort()).toEqual(["/back-0/", "/back-1/"]);
  });

  it("fails loudly when the database does: one line of fixed words, and the run is marked failed", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const broken = { prepare: () => ({ bind: () => ({}) }), batch: async () => { throw new Error("D1_ERROR: no such table: counts"); } };
      await expect(worker.scheduled({ scheduledTime: now }, { ...env, DB: broken })).rejects.toThrow("no such table");
      expect(JSON.parse(error.mock.calls[0][0])).toEqual({ failure: "prune", error: "D1_ERROR: no such table: counts" });
    } finally {
      error.mockRestore();
    }
  });
});
