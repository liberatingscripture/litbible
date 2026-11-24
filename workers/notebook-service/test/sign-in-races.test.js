// Sign-in and ways in, where two requests meet, and how long a session lasts.
//
// As in races.test.js: two requests sent at once only meet by luck, so each
// test here makes the race happen at an exact point. The request under test
// runs with a database that pauses right after a chosen read (or batch), lets
// a second request run to its end, and then goes on. Each test fails if the
// guard it is about is weakened: the lists' version in a ways-in batch
// (src/ways.js), the lists' version in setting up (src/account.js), the
// session written only while its way in stands (src/session.js), the counter
// checked as it is written, and the two unique indexes on `ways`.
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LIMITS } from "../src/check.js";
import { SESSION_DAYS, SESSION_MAX_DAYS, hashText } from "../src/session.js";
import { call, freshAccount } from "./call.js";
import { addPasskey, addPasskeyRequest, assert, attest, newPasskey, optionsFor, passkeySignInRequest, signInWithPasskey, signUpWithPasskey } from "./authenticator.js";
import { APPLE_REVOKE, APPLE_TOKEN, freshSubject, providerRequest, providersOn, signInWith, standDown, standIns } from "./idp.js";
import { changeKey, entryFor, keyChangeRequest, makeHolder, must, newDevice, proofHashOf, proofOf, ref, setUp, signIn } from "./notebook.js";

const DAY = 24 * 60 * 60 * 1000;
const refusal = (res) => [res.status, res.body.error, res.body.reason ?? res.body.rule ?? res.body.what ?? res.body.field];
const waysOf = async (token) => (await must("GET", "/account", { token })).ways;

/** The database, but `during` runs once, right after the first read whose SQL holds `marker` has come back. */
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
      const wrap = (bound) => ({
        first: async (...args) => once(await bound.first(...args)),
        all: async (...args) => once(await bound.all(...args)),
        run: async (...args) => once(await bound.run(...args)),
      });
      return { ...wrap(statement), bind: (...values) => wrap(statement.bind(...values)) };
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

/** What a first device sends to set up from a real session, with a holder for a real passkey. Not sent. */
async function setupWith(token, passkey) {
  const device = await newDevice(null, { token });
  const held = ref.firstKeyring(ref.newId(), ref.randomBytes(32));
  const holder = await makeHolder(held, "passkey", passkey);
  const body = { notebook: held.notebook, proofHash: await proofHashOf(held), device: await entryFor(device, held), holders: [holder.wire] };
  return { device, held, holder, body };
}

describe("a sign-in that meets the removal of its way in", () => {
  it("is told the passkey is unknown when it was removed while its answer was being checked", async () => {
    const made = await signUpWithPasskey();
    const second = await addPasskey(made.token);
    const { body } = await passkeySignInRequest(second.passkey);

    const DB = pausingAfterRead("FROM ways w JOIN accounts a", async () => {
      await must("DELETE", `/ways/${second.way.id}`, { token: made.token });
    });
    const res = await call("POST", "/sign-in/passkey", { body, env: { DB } });
    expect(refusal(res)).toEqual([403, "passkey_refused", "unknown"]);
    expect(await waysOf(made.token)).toEqual([made.way]);
  });

  it("gets no session when the passkey was removed after its last check, and is told to try again", async () => {
    const made = await signUpWithPasskey();
    const second = await addPasskey(made.token);
    const { body } = await passkeySignInRequest(second.passkey);
    const sessions = async () => (await env.DB.prepare("SELECT COUNT(*) AS n FROM sessions WHERE way = ?").bind(second.way.id).first()).n;

    // The counter's write is the last thing a sign-in does before it makes the session.
    const DB = pausingAfterRead("UPDATE ways SET count", async () => {
      await must("DELETE", `/ways/${second.way.id}`, { token: made.token });
    });
    const res = await call("POST", "/sign-in/passkey", { body, env: { DB } });
    expect([res.status, res.body.error]).toEqual([503, "busy"]);
    expect(res.body.token).toBeUndefined();
    expect(await sessions()).toBe(0);

    // The second try finds the passkey gone.
    const again = await passkeySignInRequest(second.passkey);
    expect(refusal(await call("POST", "/sign-in/passkey", { body: again.body }))).toEqual([403, "passkey_refused", "unknown"]);
  });

  describe("with Apple or Google", () => {
    let world;
    let on;
    beforeEach(async () => {
      ({ env: on } = await providersOn());
      world = await standIns();
    });
    afterEach(standDown);

    for (const provider of ["google", "apple"]) {
      it(`gets no session through a ${provider} way removed while its token was being checked`, async () => {
        const first = await signInWith(provider, on);
        await addPasskey(first.token);
        const body = await providerRequest(provider, on, { token: { subject: first.subject } });

        const DB = pausingAfterRead("FROM ways WHERE kind = ? AND subject = ?", async () => {
          await must("DELETE", `/ways/${first.way.id}`, { token: first.token, env: on });
        });
        const res = await call("POST", `/sign-in/${provider}`, { body, env: { ...on, DB } });
        expect([res.status, res.body.error]).toEqual([503, "busy"]);
        expect(res.body.token).toBeUndefined();
        expect((await waysOf(first.token)).map((w) => w.kind)).toEqual(["passkey"]);
        // The one session left that came in through it is the one that removed it.
        const left = await env.DB.prepare("SELECT token_hash FROM sessions WHERE way = ?").bind(first.way.id).all();
        expect(left.results).toEqual([{ token_hash: await hashText(first.token) }]);
        if (provider === "apple") {
          // The removal revoked the token the service held. The sign-in had traded its code for
          // another by then, which has no way in to be kept with: that one is handed back too.
          const revoked = world.calls.filter((c) => c.url === APPLE_REVOKE).map((c) => c.form.token);
          expect(revoked).toHaveLength(2);
          expect(await env.DB.prepare("SELECT 1 FROM apple_tokens WHERE way = ?").bind(first.way.id).first()).toBeNull();
        }
      });

      it(`makes one account when two devices sign in with a new ${provider} account at once`, async () => {
        const subject = freshSubject();
        const slow = await providerRequest(provider, on, { token: { subject }, code: "code-slow" });
        const quick = await providerRequest(provider, on, { token: { subject }, code: "code-quick" });

        let other;
        const DB = pausingAfterRead("FROM ways WHERE kind = ? AND subject = ?", async () => {
          other = await must("POST", `/sign-in/${provider}`, { body: quick, env: on });
        });
        const res = await call("POST", `/sign-in/${provider}`, { body: slow, env: { ...on, DB } });
        expect(res.status).toBe(200);
        expect([other.created, res.body.created]).toEqual([true, false]);
        expect(res.body.way).toEqual(other.way);
        expect(res.body.token).not.toBe(other.token);
        const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM ways WHERE kind = ? AND subject = ?").bind(provider, subject).first();
        expect(n).toBe(1);
        // Both sessions are the one account's.
        expect(await waysOf(res.body.token)).toEqual(await waysOf(other.token));
        if (provider === "apple") {
          // Each traded its own code, and one refresh token is kept for the client.
          expect(world.calls.filter((c) => c.url === APPLE_TOKEN).map((c) => c.form.code).sort()).toEqual(["code-quick", "code-slow"]);
          const kept = await env.DB.prepare("SELECT token FROM apple_tokens WHERE way = ?").bind(other.way.id).all();
          expect(kept.results).toHaveLength(1);
        }
      });
    }

    it("removes an Apple way once, and tells Apple once, when two removals meet", async () => {
      const apple = await signInWith("apple", on);
      const second = await addPasskey(apple.token);
      await addPasskey(apple.token);

      // The slow removal has told Apple and is about to write when another change moves the lists.
      const DB = pausingAfterBatch(async () => {
        await must("DELETE", `/ways/${second.way.id}`, { token: apple.token, env: on });
      });
      const res = await call("DELETE", `/ways/${apple.way.id}`, { token: apple.token, env: { ...on, DB } });
      expect(res.status).toBe(200);
      expect(world.calls.filter((c) => c.url === APPLE_REVOKE)).toHaveLength(1);
      expect((await waysOf(apple.token)).map((w) => w.kind)).toEqual(["passkey"]);
    });
  });

  it("refuses the second of two answers that carry one counter value", async () => {
    const made = await signUpWithPasskey({ counting: true });
    const first = await passkeySignInRequest(made.passkey, { count: 7 });
    const clone = await passkeySignInRequest(made.passkey, { count: 7 });

    // Both read the stored counter before either writes it.
    const DB = pausingAfterRead("FROM ways w JOIN accounts a", async () => {
      await must("POST", "/sign-in/passkey", { body: clone.body });
    });
    const res = await call("POST", "/sign-in/passkey", { body: first.body, env: { DB } });
    expect(refusal(res)).toEqual([403, "passkey_refused", "counter"]);
    expect((await env.DB.prepare("SELECT count FROM ways WHERE id = ?").bind(made.way.id).first()).count).toBe(7);
  });
});

describe("two changes to an account's ways in at once", () => {
  it("keep the last way in: of two removals, the second is refused", async () => {
    const made = await signUpWithPasskey();
    const second = await addPasskey(made.token);

    // Both read two ways in. The one that pauses must read again as it writes.
    const DB = pausingAfterBatch(async () => {
      await must("DELETE", `/ways/${second.way.id}`, { token: made.token });
    });
    const res = await call("DELETE", `/ways/${made.way.id}`, { token: made.token, env: { DB } });
    expect(refusal(res)).toEqual([422, "not_allowed", "last_way"]);
    expect(await waysOf(made.token)).toEqual([made.way]);
    expect((await signInWithPasskey(made.passkey)).way.id).toBe(made.way.id);
  });

  it(`hold the limit of ${LIMITS.ways} ways in`, async () => {
    const token = await signIn(freshAccount());
    for (let i = 2; i < LIMITS.ways; i++) await must("POST", "/preview/passkeys", { token, body: { credential: ref.toBase64url(ref.randomBytes(20)), syncs: true } });
    expect(await waysOf(token)).toHaveLength(LIMITS.ways - 1);
    const slow = await addPasskeyRequest(token);
    const quick = await addPasskeyRequest(token);

    const DB = pausingAfterRead("SELECT COUNT(*) AS n FROM ways WHERE account = ?", async () => {
      await must("POST", "/ways/passkey", { token, body: quick.body });
    });
    const res = await call("POST", "/ways/passkey", { token, body: slow.body, env: { DB } });
    expect(refusal(res)).toEqual([429, "too_many", "ways"]);
    expect(await waysOf(token)).toHaveLength(LIMITS.ways);
  });

  it("give one passkey to one account when two accounts add it at once", async () => {
    const mine = await signUpWithPasskey();
    const theirs = await signUpWithPasskey();
    const passkey = await newPasskey();
    const forMine = await must("POST", "/ways/passkey/options", { token: mine.token });
    const forTheirs = await must("POST", "/ways/passkey/options", { token: theirs.token });
    const slow = { credential: await attest({ ...passkey }, forMine.publicKey) };
    const quick = { credential: await attest({ ...passkey }, forTheirs.publicKey) };

    // Both find the passkey free. The index on real passkeys lets one in.
    const DB = pausingAfterRead("SELECT 1 FROM ways WHERE kind = 'passkey' AND subject = ?", async () => {
      await must("POST", "/ways/passkey", { token: theirs.token, body: quick });
    });
    const res = await call("POST", "/ways/passkey", { token: mine.token, body: slow, env: { DB } });
    expect(refusal(res)).toEqual([409, "exists", "passkey"]);
    expect(await waysOf(mine.token)).toHaveLength(1);
    expect(await waysOf(theirs.token)).toHaveLength(2);
  });

  it("make one account when one new passkey answers two sign-ups at once", async () => {
    const passkey = await newPasskey();
    const one = await optionsFor("/sign-in/new-passkey/options");
    const two = await optionsFor("/sign-in/new-passkey/options");
    const [a, b] = await Promise.all([
      call("POST", "/sign-in/new-passkey", { body: { credential: await attest({ ...passkey }, one.publicKey) } }),
      call("POST", "/sign-in/new-passkey", { body: { credential: await attest({ ...passkey }, two.publicKey) } }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const lost = a.status === 409 ? a : b;
    expect(refusal(lost)).toEqual([409, "exists", "passkey"]);
    const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM ways WHERE kind = 'passkey' AND subject = ?").bind(passkey.id).first();
    expect(n).toBe(1);
    // The sign-up that lost left no account behind.
    const handles = await env.DB.prepare("SELECT COUNT(*) AS n FROM accounts WHERE handle IN (?, ?)").bind(one.publicKey.user.id, two.publicKey.user.id).first();
    expect(handles.n).toBe(1);
  });
});

describe("a way in removed while the lists were being changed", () => {
  it("is not left holding the key by a setup that read it a moment before", async () => {
    const made = await signUpWithPasskey();
    const second = await addPasskey(made.token);
    const { body } = await setupWith(made.token, second.passkey);

    const DB = pausingAfterRead("SELECT subject, syncs FROM ways WHERE account = ? AND kind = 'passkey'", async () => {
      await must("DELETE", `/ways/${second.way.id}`, { token: made.token });
    });
    const res = await call("POST", "/notebook", { token: made.token, body, env: { DB } });
    expect(refusal(res)).toEqual([422, "not_allowed", "passkey_unknown"]);
    expect(await must("GET", "/account", { token: made.token })).toMatchObject({ notebook: null, kid: 0 });
    const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM holders WHERE credential = ?").bind(second.passkey.id).first();
    expect(n).toBe(0);
  });

  it("is not left holding the key by a new holder that read it a moment before", async () => {
    const { device, held } = await setUp();
    const added = await addPasskey(device.token);
    const holder = await makeHolder(held, "passkey", added.passkey);
    const body = { lists: added.lists, kid: 1, holder: holder.wire };

    const DB = pausingAfterRead("SELECT subject, syncs FROM ways WHERE account = ? AND kind = 'passkey'", async () => {
      await must("DELETE", `/ways/${added.way.id}`, { token: device.token });
    });
    const res = await call("POST", "/holders", { token: device.token, body, env: { DB } });
    expect([res.status, res.body.error, res.body.lists]).toEqual([409, "lists_changed", added.lists + 1]);
    expect((await must("GET", "/holders", { token: device.token })).holders.map((h) => h.kind)).toEqual(["recovery"]);
  });

  it("is not left holding the key by a change of key that read it a moment before", async () => {
    const { device } = await setUp();
    const added = await addPasskey(device.token);
    // A change of key that adds a holder for the passkey, made as a device makes one.
    const change = await keyChangeRequest(device);
    const holder = await makeHolder(change.held, "passkey", added.passkey);
    change.body.newHolders.push(holder.wire);

    const DB = pausingAfterRead("SELECT subject, syncs FROM ways WHERE account = ? AND kind = 'passkey'", async () => {
      await must("DELETE", `/ways/${added.way.id}`, { token: device.token });
    });
    const res = await call("POST", "/notebook/key", { token: device.token, body: change.body, env: { DB } });
    expect([res.status, res.body.error, res.body.lists]).toEqual([409, "lists_changed", change.body.lists + 1]);
    expect((await must("GET", "/account", { token: device.token })).kid).toBe(1);
    expect((await must("GET", "/holders", { token: device.token })).holders.map((h) => h.kind)).toEqual(["recovery"]);
  });

  it("stays, when it became a holder while its removal was being checked", async () => {
    const { device, held } = await setUp();
    const added = await addPasskey(device.token);
    const holder = await makeHolder(held, "passkey", added.passkey);

    // The removal read the holders and found none for this passkey.
    const DB = pausingAfterBatch(async () => {
      await must("POST", "/holders", { token: device.token, body: { lists: added.lists, kid: 1, holder: holder.wire } });
    });
    const res = await call("DELETE", `/ways/${added.way.id}`, { token: device.token, env: { DB } });
    expect(refusal(res)).toEqual([422, "not_allowed", "passkey_holds_key"]);
    expect(await waysOf(device.token)).toHaveLength(2);
  });

  it("is not removed by a session that a change of key closed while it was asking", async () => {
    const { device } = await setUp();
    const added = await addPasskey(device.token);
    // A second open session: the passkey signs in, and proves the key.
    const other = await signInWithPasskey(added.passkey);
    await must("POST", "/session/proof", { token: other.token, body: { device: device.id, kid: 1, proof: await proofOf(device.held) } });

    const DB = pausingAfterBatch(async () => {
      await changeKey(device);
    });
    const res = await call("DELETE", `/ways/${added.way.id}`, { token: other.token, env: { DB } });
    expect([res.status, res.body.error]).toEqual([403, "not_open"]);
    expect(await waysOf(device.token)).toHaveLength(2);
  });
});

describe("how long a session lasts", () => {
  const stored = async (token) => env.DB.prepare("SELECT created, expires FROM sessions WHERE token_hash = ?").bind(await hashText(token)).first();
  const set = async (token, { created, expires }) => {
    const hash = await hashText(token);
    if (created) await env.DB.prepare("UPDATE sessions SET created = ? WHERE token_hash = ?").bind(created, hash).run();
    if (expires) await env.DB.prepare("UPDATE sessions SET expires = ? WHERE token_hash = ?").bind(expires, hash).run();
  };
  const from = (ms) => new Date(Date.now() + ms).toISOString();
  const near = (iso, ms) => Math.abs(Date.parse(iso) - (Date.now() + ms)) < 60 * 1000;

  it(`is ${SESSION_DAYS} days from a sign-in, by whichever way`, async () => {
    const passkey = await signUpWithPasskey();
    const again = await signInWithPasskey(passkey.passkey);
    const preview = await must("POST", "/preview/session", { body: { secret: env.PREVIEW_SECRET, account: freshAccount() } });
    for (const session of [passkey, again, preview]) {
      expect(near(session.expires, SESSION_DAYS * DAY)).toBe(true);
      expect((await must("GET", "/account", { token: session.token })).session.expires).toBe(session.expires);
    }
  });

  it("is never made longer for a session that is signed in and no more, however it is used", async () => {
    const { account, device } = await setUp();
    const closed = await signIn(account);
    const soon = from(2 * DAY);
    await set(closed, { expires: soon });
    for (const [method, path] of [["GET", "/account"], ["GET", "/holders"], ["GET", `/keyring?device=${device.id}`], ["POST", "/session/proof"]]) {
      await call(method, path, { token: closed, body: method === "POST" ? {} : undefined });
    }
    expect((await stored(closed)).expires).toBe(soon);
    expect((await must("GET", "/account", { token: closed })).session.expires).toBe(soon);
  });

  it(`is ${SESSION_DAYS} days from now for an open session, on any request it makes`, async () => {
    const { device } = await setUp();
    await set(device.token, { expires: from(3 * DAY) });
    const account = await must("GET", "/account", { token: device.token });
    expect(account.session.open).toBe(true);
    expect(near(account.session.expires, SESSION_DAYS * DAY)).toBe(true);
    expect((await stored(device.token)).expires).toBe(account.session.expires);

    // By a request that is refused, too: it is the session that was used.
    await set(device.token, { expires: from(3 * DAY) });
    expect((await call("PUT", `/devices/${device.id}`, { token: device.token, body: {} })).status).toBe(400);
    expect(near((await stored(device.token)).expires, SESSION_DAYS * DAY)).toBe(true);
  });

  it("is written at most once a day", async () => {
    const { device } = await setUp();
    const recent = from(SESSION_DAYS * DAY - DAY / 2);
    await set(device.token, { expires: recent });
    expect((await must("GET", "/account", { token: device.token })).session.expires).toBe(recent);
    expect((await stored(device.token)).expires).toBe(recent);

    const older = from(SESSION_DAYS * DAY - DAY - 60 * 1000);
    await set(device.token, { expires: older });
    expect((await must("GET", "/account", { token: device.token })).session.expires).not.toBe(older);
  });

  it(`never passes ${SESSION_MAX_DAYS} days from the sign-in that made it`, async () => {
    const { device } = await setUp();
    const created = from(-(SESSION_MAX_DAYS - 5) * DAY);
    const last = new Date(Date.parse(created) + SESSION_MAX_DAYS * DAY).toISOString();
    await set(device.token, { created, expires: from(DAY) });
    expect((await must("GET", "/account", { token: device.token })).session.expires).toBe(last);
    // And stays there, whatever is asked next.
    expect((await must("GET", "/account", { token: device.token })).session.expires).toBe(last);
    expect((await stored(device.token)).expires).toBe(last);
  });

  it(`ends ${SESSION_MAX_DAYS} days after its sign-in, open or not`, async () => {
    const { device } = await setUp();
    const created = from(-SESSION_MAX_DAYS * DAY - 1000);
    await set(device.token, { created, expires: new Date(Date.parse(created) + SESSION_MAX_DAYS * DAY).toISOString() });
    expect(refusal(await call("GET", "/account", { token: device.token }))).toEqual([401, "sign_in", undefined]);
    expect(refusal(await call("GET", "/rows", { token: device.token }))).toEqual([401, "sign_in", undefined]);
  });

  it("is not brought back by use once it has run out", async () => {
    const { device } = await setUp();
    const past = from(-1000);
    await set(device.token, { expires: past });
    expect((await call("GET", "/account", { token: device.token })).body.error).toBe("sign_in");
    expect((await stored(device.token)).expires).toBe(past);
  });

  it("stops being made longer for a session that a change of key closed", async () => {
    const { device } = await setUp();
    const added = await addPasskey(device.token);
    const other = await signInWithPasskey(added.passkey);
    await must("POST", "/session/proof", { token: other.token, body: { device: device.id, kid: 1, proof: await proofOf(device.held) } });
    await changeKey(device);
    const soon = from(3 * DAY);
    await set(other.token, { expires: soon });
    expect((await must("GET", "/account", { token: other.token })).session).toMatchObject({ open: false, expires: soon });
  });

  it("is swept from the account's sessions at its next sign-in", async () => {
    const made = await signUpWithPasskey();
    await set(made.token, { expires: from(-1000) });
    const again = await signInWithPasskey(made.passkey);
    expect(await stored(made.token)).toBeNull();
    expect(await stored(again.token)).not.toBeNull();
  });
});
