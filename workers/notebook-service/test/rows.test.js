// Records: GET /rows and POST /rows ("The service's interface": "Records",
// and "A record on the service"). The service opens no row, so every check
// here is of form, size, key number, and revision.
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { call } from "./call.js";
import { LIMITS } from "../src/check.js";
import { approve, changeKey, must, newDevice, note, pull, push, ref, rowFor, setUp, trash } from "./notebook.js";

const MAX_CT = LIMITS.maxRecordBytes + LIMITS.tagBytes; // 1,048,592
const MIN_CT = LIMITS.padBlock + LIMITS.tagBytes; // 272

/** The length of the base64url text that spells `n` bytes. */
const chars = (n) => Math.floor(n / 3) * 4 + [0, 2, 3][n % 3];
/** A ct of `n` bytes that is well formed (all zero bits); the service can't open it, and doesn't try. */
const ctOf = (n) => "A".repeat(chars(n));
const NONCE = "A".repeat(16); // 12 bytes

let made = 0;
/** A row that passes every check, with unsealed filler. `over` changes one thing. */
const fake = (over = {}) => ({
  v: 1,
  id: `fake-${Date.now().toString(36)}-${++made}`,
  rev: 0,
  modified: "2026-11-23T18:35:09.978Z",
  kid: 1,
  nonce: NONCE,
  ct: ctOf(MIN_CT),
  ...over,
});

/** Posts rows from a device without insisting on a 200. */
const post = (device, put = [], remove = []) => call("POST", "/rows", { token: device.token, body: { put, remove } });
const get = (device, query = "") => call("GET", `/rows${query}`, { token: device.token });

/** The service's id for a test account's name. */
const accountId = async (name) =>
  (await env.DB.prepare("SELECT account FROM ways WHERE kind = 'preview' AND subject = ?").bind(name).first()).account;

/** Puts `count` rows straight into the database, revisions 1 to `count`, as small valid rows. */
async function insertMany(account, count, { kid = 1, ct = ctOf(MIN_CT) } = {}) {
  const id = await accountId(account);
  for (let from = 0; from < count; from += 100) {
    const statements = [];
    for (let i = from; i < Math.min(count, from + 100); i++) {
      statements.push(
        env.DB.prepare(
          "INSERT INTO rows (account, id, rev, v, modified, deleted_at, kid, nonce, ct, size) VALUES (?, ?, ?, 1, ?, NULL, ?, ?, ?, ?)",
        ).bind(id, `bulk-${i}`, i + 1, "2026-11-23T18:35:09.978Z", kid, NONCE, ct, ct.length),
      );
    }
    await env.DB.batch(statements);
  }
  await env.DB.prepare("UPDATE accounts SET rev = ? WHERE id = ?").bind(count, id).run();
}

describe("GET /rows", () => {
  it("answers an empty notebook with its shape", async () => {
    const { device } = await setUp();
    const res = await get(device);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["time", "kid", "rows", "next", "more"]);
    expect(res.body).toMatchObject({ kid: 1, rows: [], next: 0, more: false });
  });

  it("answers a row with exactly its members, and no deletedAt on a record that is not trash", async () => {
    const { device } = await setUp();
    const sent = await rowFor(device.held, note());
    await push(device, [sent]);
    const { rows, kid, next, more } = (await get(device)).body;
    expect(kid).toBe(1);
    expect(more).toBe(false);
    expect(next).toBe(1);
    expect(Object.keys(rows[0]).sort()).toEqual(["ct", "id", "kid", "modified", "nonce", "rev", "v"]);
    expect(rows[0]).toEqual({ v: 1, id: sent.id, rev: 1, modified: sent.modified, kid: 1, nonce: sent.nonce, ct: sent.ct });
  });

  it("leaves deletedAt out of a row pushed with deletedAt null", async () => {
    const { device } = await setUp();
    const sent = { ...fake(), deletedAt: null };
    await push(device, [sent]);
    const [row] = (await get(device)).body.rows;
    expect("deletedAt" in row).toBe(false);
  });

  it("gives a trash record's row its deletedAt, byte for byte", async () => {
    const { device } = await setUp();
    const gone = trash(note(), { deletedAt: "2026-11-23T18:35:09.9791Z" });
    const sent = await rowFor(device.held, gone);
    expect(sent.deletedAt).toBe("2026-11-23T18:35:09.9791Z");
    await push(device, [sent]);
    const [row] = (await get(device)).body.rows;
    expect(row.deletedAt).toBe("2026-11-23T18:35:09.9791Z");
    expect(Object.keys(row).sort()).toEqual(["ct", "deletedAt", "id", "kid", "modified", "nonce", "rev", "v"]);
  });

  it("refuses a session that is not open", async () => {
    const { account } = await setUp();
    const stranger = await newDevice(account);
    const res = await get(stranger);
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: "not_open", kid: 1 });
  });

  it("refuses a request with no session", async () => {
    expect((await call("GET", "/rows")).body.error).toBe("sign_in");
  });

  it("reads a missing since as 0", async () => {
    const { device } = await setUp();
    await push(device, [fake(), fake()]);
    expect((await get(device)).body.rows).toHaveLength(2);
    expect((await get(device, "?since=0")).body.rows).toHaveLength(2);
  });

  it.each([["-1"], ["1.5"], ["abc"], ["01"], ["12345678901234567"], ["1e3"], ["+1"]])(
    "refuses since=%s",
    async (since) => {
      const { device } = await setUp();
      const res = await get(device, `?since=${since}`);
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: "bad_request", field: "since" });
    },
  );

  it.each([["0"], ["2"], ["true"], [""]])("refuses old=%s", async (old) => {
    const { device } = await setUp();
    const res = await get(device, `?old=${old}`);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "bad_request", field: "old" });
  });

  it("gives rows in revision order, and only those later than since", async () => {
    const { device } = await setUp();
    const a = fake();
    const b = fake();
    const c = fake();
    await push(device, [a, b, c]);
    // Pushing a again moves it to the end of the order.
    await push(device, [{ ...a, rev: 1 }]);
    const all = (await get(device)).body;
    expect(all.rows.map((r) => [r.id, r.rev])).toEqual([[b.id, 2], [c.id, 3], [a.id, 4]]);
    const later = (await get(device, "?since=2")).body;
    expect(later.rows.map((r) => r.id)).toEqual([c.id, a.id]);
    expect((await get(device, "?since=4")).body).toMatchObject({ rows: [], next: 4, more: false });
  });

  it("gives with old=1 only the rows under an older kid, and none before a change of key", async () => {
    const { device } = await setUp();
    await push(device, [fake(), fake()]);
    expect((await get(device, "?old=1")).body.rows).toEqual([]);
    await changeKey(device);
    const fresh = fake({ kid: 2 });
    await push(device, [fresh]);
    const old = (await get(device, "?old=1")).body;
    expect(old.kid).toBe(2);
    expect(old.rows).toHaveLength(2);
    expect(old.rows.every((r) => r.kid === 1)).toBe(true);
    expect((await get(device)).body.rows).toHaveLength(3);
    // The cursor works with old=1 too.
    expect((await get(device, `?old=1&since=${old.rows[0].rev}`)).body.rows).toHaveLength(1);
  });

  it("pages at the row limit and following next reaches every row once", async () => {
    const { account, device } = await setUp();
    const total = LIMITS.pageRows * 2 + 7;
    await insertMany(account, total);
    const first = (await get(device)).body;
    expect(first.rows).toHaveLength(LIMITS.pageRows);
    expect(first.more).toBe(true);
    expect(first.next).toBe(first.rows.at(-1).rev);
    const seen = [...first.rows];
    let next = first.next;
    let more = true;
    while (more) {
      const page = (await get(device, `?since=${next}`)).body;
      seen.push(...page.rows);
      next = page.next;
      more = page.more;
    }
    expect(seen.map((r) => r.rev)).toEqual(Array.from({ length: total }, (_, i) => i + 1));
    expect(new Set(seen.map((r) => r.id)).size).toBe(total);
  });

  it("holds exactly pageRows rows with more false when there are no more than that", async () => {
    const { account, device } = await setUp();
    await insertMany(account, LIMITS.pageRows);
    const page = (await get(device)).body;
    expect(page.rows).toHaveLength(LIMITS.pageRows);
    expect(page.more).toBe(false);
  });

  it("splits pages by the size of the ciphertext, with at least one row in each", async () => {
    const { device } = await setUp();
    const big = ctOf(MAX_CT);
    for (let i = 0; i < 4; i++) await push(device, [fake({ ct: big })]);
    const pages = [];
    let next = 0;
    for (;;) {
      const page = (await get(device, `?since=${next}`)).body;
      pages.push(page);
      next = page.next;
      if (!page.more) break;
    }
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      expect(page.rows.length).toBeGreaterThanOrEqual(1);
      const size = page.rows.reduce((sum, r) => sum + r.ct.length, 0);
      if (page.rows.length > 1) expect(size).toBeLessThanOrEqual(LIMITS.pageChars);
    }
    expect(pages.flatMap((p) => p.rows)).toHaveLength(4);
    // A page of near-largest rows can't hold the row limit's worth.
    expect(pages[0].rows.length).toBeLessThan(LIMITS.pageRows);
  });

  it("never returns another account's rows", async () => {
    const mine = await setUp();
    const theirs = await setUp();
    await push(mine.device, [fake()]);
    await push(theirs.device, [fake(), fake()]);
    expect((await get(mine.device)).body.rows).toHaveLength(1);
    expect((await get(theirs.device)).body.rows).toHaveLength(2);
  });
});

describe("POST /rows, refusing the whole request", () => {
  it("answers old_key for a row sealed under another kid, and stores no row of the request", async () => {
    const { device } = await setUp();
    const good = fake();
    const stale = fake({ kid: 2 });
    const res = await post(device, [good, stale]);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: "old_key", kid: 1 });
    expect((await get(device)).body.rows).toEqual([]);
    // No revision was given either.
    expect((await push(device, [fake()])).rev).toBe(1);
  });

  it.each([[0], [-1], [1.5], ["1"], [null], [undefined]])("refuses a kid of %s as malformed", async (kid) => {
    const { device } = await setUp();
    const res = await post(device, [fake(), fake({ kid })]);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "bad_request", field: "put[1].kid" });
    expect((await get(device)).body.rows).toEqual([]);
  });

  it.each([["put"], ["remove"]])("refuses a %s that is not a list", async (member) => {
    const { device } = await setUp();
    const res = await call("POST", "/rows", { token: device.token, body: { put: [], remove: [], [member]: {} } });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "bad_request", field: member });
  });

  it.each([[null], ["row"], [5], [[]]])("refuses a put item that is %j", async (item) => {
    const { device } = await setUp();
    const res = await post(device, [item]);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "bad_request", field: "put[0]" });
  });

  it("refuses a remove item that is not an object", async () => {
    const { device } = await setUp();
    const res = await post(device, [], ["abc"]);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "bad_request", field: "remove[0].id" });
  });

  it.each([[""], ["x".repeat(65)], ["line\nfeed"], ["é"], [5], [undefined]])("refuses a remove item with id %j", async (id) => {
    const { device } = await setUp();
    const res = await post(device, [], [{ id, rev: 1 }]);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "bad_request", field: "remove[0].id" });
  });

  it.each([[0], [-1], [1.5], ["1"], [undefined]])("refuses a remove item with rev %j", async (rev) => {
    const { device } = await setUp();
    const res = await post(device, [], [{ id: "a", rev }]);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "bad_request", field: "remove[0].rev" });
  });

  it("refuses the same id twice in put, and stores nothing", async () => {
    const { device } = await setUp();
    const row = fake();
    const res = await post(device, [row, { ...row }, fake()]);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "bad_request", field: "id" });
    expect((await get(device)).body.rows).toEqual([]);
  });

  it("refuses the same id twice in remove", async () => {
    const { device } = await setUp();
    const res = await post(device, [], [{ id: "a", rev: 1 }, { id: "a", rev: 1 }]);
    expect(res.body).toMatchObject({ error: "bad_request", field: "id" });
  });

  it("refuses the same id in put and in remove", async () => {
    const { device } = await setUp();
    const row = fake();
    const res = await post(device, [row], [{ id: row.id, rev: 1 }]);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "bad_request", field: "id" });
  });

  it("accepts exactly the most items in a request, and refuses one more with too_large", async () => {
    const { device } = await setUp();
    const limit = LIMITS.rowsPerRequest;
    const ok = await post(device, Array.from({ length: limit }, () => fake()));
    expect(ok.status).toBe(200);
    expect(ok.body.put).toHaveLength(limit);

    const over = await post(device, Array.from({ length: limit + 1 }, () => fake()));
    expect(over.status).toBe(413);
    expect(over.body.error).toBe("too_large");
    expect((await get(device)).body.rows).toHaveLength(limit);
  });

  it("counts put and remove together toward the most items", async () => {
    const { device } = await setUp();
    const put = Array.from({ length: LIMITS.rowsPerRequest }, () => fake());
    const res = await post(device, put, [{ id: "z", rev: 1 }]);
    expect(res.status).toBe(413);
    expect(res.body.error).toBe("too_large");
  });

  it("refuses a session that is not open", async () => {
    const { account } = await setUp();
    const stranger = await newDevice(account);
    const res = await post(stranger, [fake()]);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("not_open");
  });
});

describe("POST /rows, row by row", () => {
  /** Posts one bad row beside a good one: the bad one is refused for itself, the good one is stored. */
  async function refusedAlone(over, word) {
    const { device } = await setUp();
    const bad = fake(over);
    const good = fake();
    const res = await post(device, [bad, good]);
    expect(res.status).toBe(200);
    expect(res.body.put[0]).toEqual({ ...(typeof bad.id === "string" ? { id: bad.id } : {}), refused: word });
    expect(res.body.put[1]).toEqual({ id: good.id, rev: 1 });
    const rows = (await get(device)).body.rows;
    expect(rows.map((r) => r.id)).toEqual([good.id]);
    return device;
  }

  it("answers an accepted row with its id and new rev, and the request with kid, rev, put, remove", async () => {
    const { device } = await setUp();
    const row = fake();
    const res = await post(device, [row]);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["time", "kid", "rev", "put", "remove"]);
    expect(res.body).toMatchObject({ kid: 1, rev: 1, put: [{ id: row.id, rev: 1 }], remove: [] });
    expect(Object.keys(res.body.put[0]).sort()).toEqual(["id", "rev"]);
  });

  it("refuses a row whose v is not 1", () => refusedAlone({ v: 2 }, "v"));
  it("refuses a row with no v", () => refusedAlone({ v: undefined }, "v"));
  it("refuses a row whose v is the text 1", () => refusedAlone({ v: "1" }, "v"));

  it("refuses an empty id", () => refusedAlone({ id: "" }, "id"));
  it("refuses an id of 65 characters", () => refusedAlone({ id: "a".repeat(65) }, "id"));
  it("refuses an id with a line feed", () => refusedAlone({ id: "a\nb" }, "id"));
  it("refuses an id with a non-ASCII letter", () => refusedAlone({ id: "café" }, "id"));
  it("refuses an id that is not text", () => refusedAlone({ id: 12 }, "id"));

  it("accepts an id of 64 characters with spaces and punctuation", async () => {
    const { device } = await setUp();
    const id = `${"a b!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~".repeat(3)}`.slice(0, 64);
    expect(id).toHaveLength(64);
    const res = await post(device, [fake({ id })]);
    expect(res.body.put[0]).toEqual({ id, rev: 1 });
    expect((await get(device)).body.rows[0].id).toBe(id);
  });

  it.each([
    ["no Z", "2026-11-23T18:35:09.978"],
    ["an offset", "2026-11-23T18:35:09.978+00:00"],
    ["a space for the T", "2026-11-23 18:35:09.978Z"],
    ["no seconds", "2026-11-23T18:35Z"],
    ["a date only", "2026-11-23"],
    ["a number", 1764009309978],
    ["null", null],
    ["a missing member", undefined],
    ["a dot and no digits", "2026-11-23T18:35:09.Z"],
  ])("refuses a modified with %s", (_, modified) => refusedAlone({ modified }, "modified"));

  it.each([["no fraction", "2026-11-23T18:35:09Z"], ["three digits", "2026-11-23T18:35:09.978Z"], ["nine digits", "2026-11-23T18:35:09.978123456Z"], ["one digit", "2026-11-23T18:35:09.9Z"]])(
    "accepts a modified with %s",
    async (_, modified) => {
      const { device } = await setUp();
      const row = fake({ modified });
      expect((await post(device, [row])).body.put[0]).toEqual({ id: row.id, rev: 1 });
      expect((await get(device)).body.rows[0].modified).toBe(modified);
    },
  );

  // The spec's open item 31: a trash record's deletedAt must be in the same
  // form as modified, so a trash record with a looser time (one the format
  // itself allows) can't be pushed. The service says "deletedAt" and no more.
  it.each([
    ["no Z", "2026-11-23T18:35:09.978"],
    ["an offset", "2026-11-23T18:35:09.978+00:00"],
    ["a space for the T", "2026-11-23 18:35:09.978Z"],
    ["no seconds", "2026-11-23T18:35Z"],
    ["a number", 5],
  ])("refuses a deletedAt with %s", (_, deletedAt) => refusedAlone({ deletedAt }, "deletedAt"));

  it("accepts a deletedAt in the form, with or without a fraction", async () => {
    const { device } = await setUp();
    const a = fake({ deletedAt: "2026-11-23T18:35:09Z" });
    const b = fake({ deletedAt: "2026-11-23T18:35:09.123456Z" });
    const res = await post(device, [a, b]);
    expect(res.body.put.map((p) => p.rev)).toEqual([1, 2]);
    const rows = (await get(device)).body.rows;
    expect(rows.map((r) => r.deletedAt)).toEqual([a.deletedAt, b.deletedAt]);
  });

  it("refuses a nonce of 11 bytes", () => refusedAlone({ nonce: "A".repeat(chars(11)) }, "nonce"));
  it("refuses a nonce of 13 bytes", () => refusedAlone({ nonce: "A".repeat(chars(13)) }, "nonce"));
  it("refuses a nonce that is not text", () => refusedAlone({ nonce: 5 }, "nonce"));
  it("refuses a missing nonce", () => refusedAlone({ nonce: undefined }, "nonce"));

  it("refuses a ct that is not base64url", () => refusedAlone({ ct: `${ctOf(MIN_CT).slice(0, -2)}+/` }, "ct"));
  it("refuses a ct with padding", () => refusedAlone({ ct: `${ctOf(MIN_CT)}=` }, "ct"));
  it("refuses a ct with leftover bits that are not zero", () => refusedAlone({ ct: `${ctOf(MIN_CT).slice(0, -1)}B` }, "ct"));
  it("refuses a ct that is not text", () => refusedAlone({ ct: 5 }, "ct"));
  it("refuses a ct 15 bytes short of a block", () => refusedAlone({ ct: ctOf(MIN_CT - 1) }, "ct"));
  it("refuses a ct 1 byte over a block", () => refusedAlone({ ct: ctOf(MIN_CT + 1) }, "ct"));
  it("refuses a ct of exactly the tag's 16 bytes", () => refusedAlone({ ct: ctOf(16) }, "ct"));
  it("refuses a ct of exactly 256 bytes", () => refusedAlone({ ct: ctOf(256) }, "ct"));
  it("refuses an empty ct", () => refusedAlone({ ct: "" }, "ct"));

  it("accepts the smallest ct, 272 bytes, and the largest, 1,048,592", async () => {
    const { device } = await setUp();
    const small = fake({ ct: ctOf(MIN_CT) });
    const large = fake({ ct: ctOf(MAX_CT) });
    const res = await post(device, [small, large]);
    expect(res.body.put).toEqual([{ id: small.id, rev: 1 }, { id: large.id, rev: 2 }]);
    const rows = (await get(device)).body.rows;
    expect(rows.map((r) => r.ct.length)).toEqual([chars(MIN_CT), chars(MAX_CT)]);
  });

  it("refuses a ct one block over the largest as too_large", () => refusedAlone({ ct: ctOf(MAX_CT + LIMITS.padBlock) }, "too_large"));

  it.each([[-1], [1.5], ["0"], [null], [undefined]])("refuses a rev of %j", (rev) => refusedAlone({ rev }, "rev"));

  it("answers the first failed check when a row fails two", async () => {
    const { device } = await setUp();
    const res = await post(device, [fake({ v: 2, nonce: "A" })]);
    expect(res.body.put[0].refused).toBe("v");
  });
});

describe("POST /rows, revisions and conflicts", () => {
  it("gives a new row the next revision, in the request's order", async () => {
    const { device } = await setUp();
    const rows = [fake(), fake(), fake()];
    const res = await post(device, rows);
    expect(res.body.put.map((p) => p.rev)).toEqual([1, 2, 3]);
    expect(res.body.rev).toBe(3);
    const next = await post(device, [fake(), fake()]);
    expect(next.body.put.map((p) => p.rev)).toEqual([4, 5]);
    expect(next.body.rev).toBe(5);
  });

  it("shares one run of revisions across the whole account, not each device", async () => {
    const { device } = await setUp();
    const other = await approve(device);
    await post(device, [fake()]);
    expect((await post(other, [fake()])).body.put[0].rev).toBe(2);
  });

  it("accepts a push against the revision just given", async () => {
    const { device } = await setUp();
    const row = fake();
    const first = await post(device, [row]);
    const second = await post(device, [{ ...row, rev: first.body.put[0].rev }]);
    expect(second.body.put[0]).toEqual({ id: row.id, rev: 2 });
    const rows = (await get(device)).body.rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].rev).toBe(2);
  });

  it("replaces the stored row when a push is accepted", async () => {
    const { device } = await setUp();
    const row = fake({ modified: "2026-01-01T00:00:00.000Z" });
    await post(device, [row]);
    await post(device, [{ ...row, rev: 1, modified: "2026-02-02T00:00:00.000Z", ct: ctOf(MIN_CT + 256) }]);
    const [stored] = (await get(device)).body.rows;
    expect(stored.modified).toBe("2026-02-02T00:00:00.000Z");
    expect(stored.ct).toBe(ctOf(MIN_CT + 256));
  });

  it("answers rev 0 for an id that exists with conflict changed and the stored row", async () => {
    const { device } = await setUp();
    const row = fake();
    await post(device, [row]);
    const stored = (await get(device)).body.rows[0];
    const res = await post(device, [{ ...row, rev: 0, modified: "2027-01-01T00:00:00.000Z" }]);
    expect(res.status).toBe(200);
    expect(res.body.put[0]).toEqual({ id: row.id, conflict: "changed", row: stored });
    // A conflict changes nothing.
    expect(res.body.rev).toBe(1);
    expect((await get(device)).body.rows).toEqual([stored]);
  });

  it("answers a stale rev with conflict changed and the stored row", async () => {
    const { device } = await setUp();
    const row = fake();
    await post(device, [row]);
    await post(device, [{ ...row, rev: 1 }]);
    const stored = (await get(device)).body.rows[0];
    expect(stored.rev).toBe(2);
    const res = await post(device, [{ ...row, rev: 1 }]);
    expect(res.body.put[0]).toEqual({ id: row.id, conflict: "changed", row: stored });
    expect((await get(device)).body.rows).toEqual([stored]);
  });

  it("answers a rev above 0 for an id the service does not have with conflict gone and no row", async () => {
    const { device } = await setUp();
    const row = fake({ rev: 5 });
    const res = await post(device, [row]);
    expect(res.body.put[0]).toEqual({ id: row.id, conflict: "gone" });
    expect("row" in res.body.put[0]).toBe(false);
    expect(res.body.rev).toBe(0);
    expect((await get(device)).body.rows).toEqual([]);
  });

  it("answers a stale rev against a row another device changed since", async () => {
    const { device } = await setUp();
    const other = await approve(device);
    const row = fake();
    await post(device, [row]);
    await post(other, [{ ...row, rev: 1, modified: "2027-01-01T00:00:00.000Z" }]);
    const res = await post(device, [{ ...row, rev: 1 }]);
    expect(res.body.put[0].conflict).toBe("changed");
    expect(res.body.put[0].row.modified).toBe("2027-01-01T00:00:00.000Z");
    expect(res.body.put[0].row.rev).toBe(2);
  });

  it("stores the rows beside a conflict, and gives them the next revisions", async () => {
    const { device } = await setUp();
    const mine = fake();
    await post(device, [mine]);
    const fresh = fake();
    const res = await post(device, [{ ...mine, rev: 0 }, fresh]);
    expect(res.body.put[0].conflict).toBe("changed");
    expect(res.body.put[1]).toEqual({ id: fresh.id, rev: 2 });
    expect(res.body.rev).toBe(2);
  });

  it("changes no revision for a request with nothing accepted", async () => {
    const { device } = await setUp();
    await post(device, [fake(), fake()]);
    const res = await post(device, [fake({ v: 3 }), fake({ rev: 9 })]);
    expect(res.body.rev).toBe(2);
    expect((await get(device)).body.next).toBe(2);
    expect((await post(device, [fake()])).body.put[0].rev).toBe(3);
  });

  it("answers rev as the account's last revision for an empty request", async () => {
    const { device } = await setUp();
    await post(device, [fake()]);
    const res = await post(device, [], []);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ kid: 1, rev: 1, put: [], remove: [] });
  });

  it("removes a row with its current rev, and it is gone from GET /rows", async () => {
    const { device } = await setUp();
    const a = fake();
    const b = fake();
    await post(device, [a, b]);
    const res = await post(device, [], [{ id: a.id, rev: 1 }]);
    expect(res.status).toBe(200);
    expect(res.body.remove).toEqual([{ id: a.id, removed: true }]);
    // A removal takes a revision.
    expect(res.body.rev).toBe(3);
    expect((await get(device)).body.rows.map((r) => r.id)).toEqual([b.id]);
  });

  it("answers a remove with a stale rev as conflict changed with the row, and removes nothing", async () => {
    const { device } = await setUp();
    const row = fake();
    await post(device, [row]);
    await post(device, [{ ...row, rev: 1 }]);
    const stored = (await get(device)).body.rows[0];
    const res = await post(device, [], [{ id: row.id, rev: 1 }]);
    expect(res.body.remove[0]).toEqual({ id: row.id, conflict: "changed", row: stored });
    expect(res.body.rev).toBe(2);
    expect((await get(device)).body.rows).toEqual([stored]);
  });

  it("answers a remove for an id that is not there as removed, with no revision taken", async () => {
    const { device } = await setUp();
    await post(device, [fake()]);
    const res = await post(device, [], [{ id: "never-was", rev: 7 }]);
    expect(res.body.remove).toEqual([{ id: "never-was", removed: true }]);
    expect(res.body.rev).toBe(1);
  });

  it("lets a removed id start over with rev 0", async () => {
    const { device } = await setUp();
    const row = fake();
    await post(device, [row]);
    await post(device, [], [{ id: row.id, rev: 1 }]);
    const res = await post(device, [{ ...row, rev: 0 }]);
    expect(res.body.put[0]).toEqual({ id: row.id, rev: 3 });
  });

  it("does not remove or answer another account's row with the same id", async () => {
    const mine = await setUp();
    const theirs = await setUp();
    const row = fake();
    await post(theirs.device, [row]);
    const res = await post(mine.device, [{ ...row, rev: 0 }], [{ id: "other", rev: 1 }]);
    expect(res.body.put[0]).toEqual({ id: row.id, rev: 1 });
    expect((await get(theirs.device)).body.rows).toHaveLength(1);
  });
});

describe("rows between devices", () => {
  it("keeps a trash record's deletedAt byte for byte, and another device opens it", async () => {
    const { device } = await setUp();
    const other = await approve(device);
    const gone = trash(note(), { deletedAt: "2026-11-23T18:35:09.123456Z" });
    await push(device, [await rowFor(device.held, gone)]);
    const { rows, records } = await pull(other);
    expect(rows[0].deletedAt).toBe("2026-11-23T18:35:09.123456Z");
    expect(records).toEqual([gone]);
  });

  it("gives a device the rows another pushed, sealed and opened with the reference", async () => {
    const { device } = await setUp();
    const other = await approve(device);
    const records = [note({ body: "ἐν ἀρχῇ" }), note({ body: "a second" })];
    await push(device, await Promise.all(records.map((r) => rowFor(device.held, r))));
    expect((await pull(other)).records).toEqual(records);
    expect(ref).toBeDefined();
    expect(await must("GET", "/rows?since=2", { token: other.token })).toMatchObject({ rows: [], next: 2 });
  });
});
