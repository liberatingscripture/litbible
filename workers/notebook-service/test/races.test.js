// "Checked and written as one step," held to it.
//
// The interface says several checks and their writes are one step. D1 has no
// transaction that spans a read and a later write, so the service makes each
// such write conditional on what it read (src/db.js). Two requests sent at
// once only meet by luck, so these tests make the race happen at an exact
// point: the request under test runs with a database that pauses right after
// a chosen read, lets a second request run to its end, and then goes on. Each
// test fails if the guard it is about is weakened.
//
// Also here: what a session is told FIRST, where the interface gives an order.
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { call, freshAccount } from "./call.js";
import { raced } from "../src/db.js";
import { LIMITS } from "../src/check.js";
import {
  approvalRequest,
  approve,
  cardFor,
  changeKey,
  grantRequest,
  joinRequest,
  keyChangeRequest,
  makeHolder,
  must,
  openThrough,
  proofOf,
  rowFor,
  setUp,
  signIn,
} from "./notebook.js";

/**
 * The database, but `during` runs once, right after the first read whose SQL
 * holds `marker` has come back (and before the request acts on it).
 */
function pausingAfterRead(marker, during) {
  let fired = false;
  const once = async (result) => {
    if (!fired) {
      fired = true;
      await during();
    }
    return result;
  };
  return {
    prepare(sql) {
      const statement = env.DB.prepare(sql);
      if (fired || !sql.includes(marker)) return statement;
      return {
        bind(...values) {
          const bound = statement.bind(...values);
          return {
            first: async (...args) => once(await bound.first(...args)),
            all: async (...args) => once(await bound.all(...args)),
            run: async (...args) => once(await bound.run(...args)),
          };
        },
      };
    },
    batch: (statements) => env.DB.batch(statements),
  };
}

/** The database, but `during` runs once, right after the first batch() has come back. */
function pausingAfterBatch(during) {
  let fired = false;
  return {
    prepare: (sql) => env.DB.prepare(sql),
    async batch(statements) {
      const out = await env.DB.batch(statements);
      if (!fired) {
        fired = true;
        await during();
      }
      return out;
    },
  };
}

const accountId = async (name) =>
  (await env.DB.prepare("SELECT account FROM ways WHERE kind = 'preview' AND subject = ?").bind(name).first()).account;

describe("a request that lost a race is checked again against what the other one left", () => {
  it("does not attach a session to a device that signed out while its proof was being checked", async () => {
    const { account, device: first } = await setUp();
    const phone = await approve(first);
    // A second session for the same device (another tab, say), signed in and not yet proved.
    const tab = await signIn(account);
    const body = { device: phone.id, kid: 1, proof: await proofOf(phone.held) };

    const DB = pausingAfterRead("SELECT 1 FROM devices", async () => {
      await must("DELETE", `/devices/${phone.id}`, { token: phone.token });
    });
    const res = await call("POST", "/session/proof", { token: tab, body, env: { DB } });
    expect([res.status, res.body.error, res.body.what]).toEqual([410, "gone", "device"]);
    expect((await must("GET", "/account", { token: tab })).session).toMatchObject({ open: false, device: null });

    // The device's id is listed again later. The tab's session proved nothing since the
    // sign-out, so it must not come back open.
    await env.DB.prepare(
      `INSERT INTO devices (account, id, card_kid, card_nonce, card_ct, keyring_kid, keyring_enc, keyring_ct, added, added_how, seen)
       SELECT account, ?, card_kid, card_nonce, card_ct, keyring_kid, keyring_enc, keyring_ct, added, 'recovery', seen
         FROM devices WHERE account = ? AND id = ?`,
    )
      .bind(phone.id, await accountId(account), first.id)
      .run();
    expect((await must("GET", "/account", { token: tab })).session.open).toBe(false);
  });

  it("does not keep a grant from a device that signed out while it was granting", async () => {
    const { account, device: first } = await setUp();
    const approver = await approve(first);
    const asking = await approvalRequest(account);
    await must("POST", "/approvals", { token: asking.device.token, body: asking.body });
    const grant = await grantRequest(approver, asking);

    const DB = pausingAfterRead("FROM approvals WHERE account = ? AND id = ?", async () => {
      await must("DELETE", `/devices/${approver.id}`, { token: approver.token });
    });
    const res = await call("POST", `/approvals/${asking.id}/grant`, { token: approver.token, body: grant, env: { DB } });
    expect([res.status, res.body.error]).toEqual([401, "sign_in"]);
    expect((await must("GET", `/approvals/${asking.id}`, { token: first.token })).approval.grant).toBeNull();
  });

  it("holds the approvals limit when two devices ask at once", async () => {
    const { account } = await setUp();
    const ask = async () => {
      const asking = await approvalRequest(account);
      return { asking, send: (options = {}) => call("POST", "/approvals", { token: asking.device.token, body: asking.body, ...options }) };
    };
    for (let i = 0; i < LIMITS.approvals - 1; i++) expect((await (await ask()).send()).status).toBe(200);

    // Both see one place left. The one that pauses after counting must count again as it writes.
    const [slow, quick] = [await ask(), await ask()];
    const DB = pausingAfterBatch(async () => {
      expect((await quick.send()).status).toBe(200);
    });
    const res = await slow.send({ env: { DB } });
    expect([res.status, res.body.error, res.body.what]).toEqual([429, "too_many", "approvals"]);
    const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM approvals WHERE account = ?").bind(await accountId(account)).first();
    expect(n).toBe(LIMITS.approvals);
  });

  it("stores no row under the old key when the key changes while a push is being checked", async () => {
    const { device: one } = await setUp();
    const two = await approve(one);
    const row = await rowFor(two.held);

    const DB = pausingAfterRead("SELECT id, rev FROM rows", async () => {
      await changeKey(one);
    });
    const res = await call("POST", "/rows", { token: two.token, body: { put: [row] }, env: { DB } });
    // The change closed the pushing device's session, so it is told to catch up, and nothing was stored.
    expect([res.status, res.body.error, res.body.kid]).toEqual([403, "not_open", 2]);
    expect((await must("GET", "/rows?since=0", { token: one.token })).rows).toEqual([]);
  });

  it("does not list a device that joined under a key that changed while it was joining", async () => {
    const { account, device: first, holders } = await setUp();
    const joining = await openThrough(account, holders[0]);
    const body = await joinRequest(joining, holders[0]);

    // The pause is after the join's own read of the two lists (its only batch before the write).
    const DB = pausingAfterBatch(async () => {
      await changeKey(first);
    });
    const res = await call("POST", "/devices", { token: joining.token, body, env: { DB } });
    expect([res.status, res.body.error, res.body.kid]).toEqual([409, "old_key", 2]);
    const lists = await must("GET", "/devices", { token: first.token });
    expect(lists.devices.map((d) => d.id)).toEqual([first.id]);
  });

  it("refuses a change of key whose lists moved while it was being checked", async () => {
    const { account, device: first, holders } = await setUp();
    const change = await keyChangeRequest(first);
    // A device joins after the change read both lists. The change never named it, so applying
    // the change would leave it holding a key the notebook no longer uses, in silence.
    const joining = await openThrough(account, holders[0]);
    const join = await joinRequest(joining, holders[0]);
    const DB = pausingAfterBatch(async () => {
      await must("POST", "/devices", { token: joining.token, body: join });
    });
    const res = await call("POST", "/notebook/key", { token: first.token, body: change.body, env: { DB } });
    expect([res.status, res.body.error]).toEqual([409, "lists_changed"]);
    expect((await must("GET", "/account", { token: first.token })).kid).toBe(1);
  });
});

describe("what counts as a race", () => {
  const failure = (statement) => statement.run().then(() => null, (error) => error);

  it("is the guard's own check, as D1 words it", async () => {
    const error = await failure(env.DB.prepare("INSERT INTO guard (ok) VALUES (0)"));
    expect(String(error?.message)).toContain("state_moved");
    expect(raced(error)).toBe(true);
  });

  it("is a primary key or unique index someone else got to first", async () => {
    const id = crypto.randomUUID();
    const insert = () => env.DB.prepare("INSERT INTO accounts (id, created) VALUES (?, ?)").bind(id, "2026-11-23T00:00:00.000Z");
    await insert().run();
    expect(raced(await failure(insert()))).toBe(true);
  });

  it("is not any other failed constraint: that is a fault, and must surface as one", async () => {
    const missing = await failure(env.DB.prepare("INSERT INTO accounts (id, created) VALUES (?, NULL)").bind(crypto.randomUUID()));
    expect(String(missing?.message)).toContain("NOT NULL");
    expect(raced(missing)).toBe(false);
    expect(raced(new Error("D1_ERROR: FOREIGN KEY constraint failed: SQLITE_CONSTRAINT"))).toBe(false);
    expect(raced(new Error("D1_ERROR: CHECK constraint failed: some_other_check: SQLITE_CONSTRAINT"))).toBe(false);
  });
});

describe("what a session is told first", () => {
  const oversized = "x".repeat(5 * 1024 * 1024);

  it("tells a session that isn't open so, whatever it sent, on every request that needs an open one", async () => {
    const { account, device } = await setUp();
    const behind = await signIn(account);
    const id = "0".repeat(32);
    const routes = [
      ["PUT", `/devices/${device.id}`],
      ["POST", "/holders"],
      ["POST", "/notebook/key"],
      ["POST", "/rows"],
      ["POST", `/approvals/${id}/grant`],
    ];
    for (const [method, path] of routes) {
      for (const body of [{ nonsense: true }, "not json", oversized]) {
        const res = await call(method, path, { token: behind, body });
        expect([method, path, res.status, res.body.error]).toEqual([method, path, 403, "not_open"]);
      }
    }
  });

  it("tells a second setup the account is set up, whatever it sent", async () => {
    const { account } = await setUp();
    const token = await signIn(account);
    for (const body of [{}, { holders: [] }, "not json"]) {
      const res = await call("POST", "/notebook", { token, body });
      expect([res.status, res.body.error]).toEqual([409, "already_set_up"]);
    }
  });

  it("tells an account with no notebook so before reading a request that needs one", async () => {
    const token = await signIn(freshAccount());
    const id = "0".repeat(32);
    for (const path of ["/session/proof", "/devices", "/approvals", `/approvals/${id}/accept`]) {
      const res = await call("POST", path, { token, body: { nonsense: true } });
      expect([path, res.status, res.body.error]).toEqual([path, 409, "no_notebook"]);
    }
  });

  it("tells an open session it has nothing to ask approval for, whatever it sent", async () => {
    const { device } = await setUp();
    const res = await call("POST", "/approvals", { token: device.token, body: { nonsense: true } });
    expect([res.status, res.body.error, res.body.rule]).toEqual([422, "not_allowed", "already_open"]);
  });

  it("checks the lists' version before the kid, as the tables order them", async () => {
    const { device, held } = await setUp();
    const { lists } = await must("GET", "/devices", { token: device.token });
    const stale = { lists: lists + 5, kid: 9 };

    const renamed = await call("PUT", `/devices/${device.id}`, {
      token: device.token,
      body: { ...stale, card: await cardFor(device, held) },
    });
    expect([renamed.status, renamed.body.error, renamed.body.lists]).toEqual([409, "lists_changed", lists]);

    const holder = await makeHolder(held, "passkey");
    const added = await call("POST", "/holders", { token: device.token, body: { ...stale, holder: holder.wire } });
    expect([added.status, added.body.error, added.body.lists]).toEqual([409, "lists_changed", lists]);
  });

  it("reads the Authorization scheme in any case, and the token to the letter", async () => {
    const token = await signIn(freshAccount());
    for (const scheme of ["Bearer", "bearer", "BEARER"]) {
      const res = await call("GET", "/account", { headers: { authorization: `${scheme} ${token}` } });
      expect([scheme, res.status]).toEqual([scheme, 200]);
    }
    const swapped = token.replace(/[a-z]/, (c) => c.toUpperCase());
    if (swapped !== token) {
      expect((await call("GET", "/account", { headers: { authorization: `Bearer ${swapped}` } })).status).toBe(401);
    }
  });
});

describe("sessions that ran out", () => {
  it("are swept when the account next signs in, and no one else's are touched", async () => {
    const [mine, theirs] = [freshAccount("mine"), freshAccount("theirs")];
    await signIn(mine);
    await signIn(theirs);
    await env.DB.prepare("UPDATE sessions SET expires = '2020-01-01T00:00:00.000Z' WHERE account IN (?, ?)")
      .bind(await accountId(mine), await accountId(theirs))
      .run();
    const count = async (name) =>
      (await env.DB.prepare("SELECT COUNT(*) AS n FROM sessions WHERE account = ?").bind(await accountId(name)).first()).n;

    const token = await signIn(mine);
    expect(await count(mine)).toBe(1);
    expect(await count(theirs)).toBe(1);
    expect((await call("GET", "/account", { token })).status).toBe(200);
  });
});
