// "Devices and holders" of the interface (STUDY-DESK-ENCRYPTION.md, "The
// service's interface"): every request's answer shape, and every check it
// makes, each alone, starting from a request that would be accepted.
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { LIMITS } from "../src/check.js";
import { call, freshAccount } from "./call.js";
import {
  approve,
  approvalRequest,
  cardFor,
  changeKey,
  joinRequest,
  joinThrough,
  keyringFor,
  listPasskey,
  makeHolder,
  must,
  newDevice,
  openThrough,
  proofOf,
  ref,
  rowFor,
  setUp,
  setupRequest,
  signIn,
  entryFor,
} from "./notebook.js";

const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const randomProof = () => ref.toBase64url(ref.randomBytes(32));
const strip = ({ time, ...rest }) => rest;

/** What the lists and the account say, as one comparable value (the time of the answer left out). */
async function snapshot(device) {
  const account = await must("GET", "/account", { token: device.token });
  const lists = await must("GET", "/devices", { token: device.token });
  return { kid: account.kid, lists: account.lists, listed: strip(lists) };
}

/** Sends a request that must be refused, and checks the account and both lists did not move. */
async function refused(device, method, path, options, status, error, extra = {}) {
  const before = await snapshot(device);
  const res = await call(method, path, options);
  expect(res.status).toBe(status);
  expect(res.body.error).toBe(error);
  expect(res.body).toMatchObject(extra);
  expect(await snapshot(device)).toEqual(before);
  return res;
}

async function accountId(name) {
  return (await env.DB.prepare("SELECT account FROM ways WHERE kind = 'preview' AND subject = ?").bind(name).first()).account;
}

/** Fills the device list to its limit by writing rows, as 100 joins would be slow. */
async function fillDevices(account) {
  const id = await accountId(account);
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM devices WHERE account = ?").bind(id).first();
  const statements = [];
  for (let i = n; i < LIMITS.devices; i++) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO devices (account, id, card_kid, card_nonce, card_ct, keyring_kid, keyring_enc, keyring_ct, added, added_how, added_by, seen)
         VALUES (?, ?, 1, 'n', 'c', 1, 'e', 'k', ?, 'approval', NULL, ?)`,
      ).bind(id, crypto.randomUUID(), new Date().toISOString(), new Date().toISOString()),
    );
  }
  await env.DB.batch(statements);
}

/** Fills the holder list to its limit with passkey holders (each with its own credential). */
async function fillHolders(account) {
  const id = await accountId(account);
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM holders WHERE account = ?").bind(id).first();
  const statements = [];
  for (let i = n; i < LIMITS.holders; i++) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO holders (account, id, kind, credential, record_nonce, record_ct, card_kid, card_nonce, card_ct, keyring_kid, keyring_enc, keyring_ct, added, added_by)
         VALUES (?, ?, 'passkey', ?, 'n', 'c', 1, 'n', 'c', 1, 'e', 'k', ?, NULL)`,
      ).bind(id, crypto.randomUUID(), `filler-${i}`, new Date().toISOString()),
    );
  }
  await env.DB.batch(statements);
}

describe("GET /holders", () => {
  it("answers each holder's id, kind, credential (a passkey's only), record, and keyring, and no card", async () => {
    const { device, holders } = await setUp({ passkey: true, recovery: true });
    const [passkey, recovery] = holders;
    const body = await must("GET", "/holders", { token: device.token });
    expect(Object.keys(body)[0]).toBe("time");
    expect(body.time).toMatch(TIME);
    expect(body.holders).toHaveLength(2);
    const byId = Object.fromEntries(body.holders.map((h) => [h.id, h]));
    expect(byId[passkey.id]).toEqual({
      id: passkey.id,
      kind: "passkey",
      credential: passkey.credential,
      record: passkey.wire.record,
      keyring: { kid: 1, ...passkey.wire.keyring },
    });
    expect(byId[recovery.id]).toEqual({
      id: recovery.id,
      kind: "recovery",
      record: recovery.wire.record,
      keyring: { kid: 1, ...recovery.wire.keyring },
    });
    expect(JSON.stringify(body)).not.toContain('"card"');
  });

  it("answers a session that has not proved the key", async () => {
    const { account, holders } = await setUp();
    const stranger = await signIn(account);
    const res = await call("GET", "/holders", { token: stranger });
    expect(res.status).toBe(200);
    expect(res.body.holders.map((h) => h.id)).toEqual([holders[0].id]);
  });

  it("answers an empty list to an account with no notebook", async () => {
    const token = await signIn(freshAccount());
    const res = await call("GET", "/holders", { token });
    expect(res.status).toBe(200);
    expect(res.body.holders).toEqual([]);
  });

  it("never shows another account's holders", async () => {
    const one = await setUp();
    const two = await setUp();
    const seen = (await must("GET", "/holders", { token: one.device.token })).holders.map((h) => h.id);
    expect(seen).toEqual([one.holders[0].id]);
    expect(seen).not.toContain(two.holders[0].id);
  });

  it("refuses a request with no session", async () => {
    const res = await call("GET", "/holders");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("sign_in");
  });
});

describe("GET /keyring", () => {
  it("answers the device's keyring and its kid, equal to what was stored", async () => {
    const { device, body } = await setupRequest();
    await must("POST", "/notebook", { token: device.token, body });
    const res = await must("GET", `/keyring?device=${device.id}`, { token: device.token });
    expect(Object.keys(res)[0]).toBe("time");
    expect(res.device).toBe(device.id);
    expect(res.keyring).toEqual({ kid: 1, ...body.device.keyring });
  });

  it("answers a session that has not proved the key", async () => {
    const { account, device } = await setUp();
    const res = await call("GET", `/keyring?device=${device.id}`, { token: await signIn(account) });
    expect(res.status).toBe(200);
  });

  it("answers not_found for an id with no entry", async () => {
    const { device } = await setUp();
    const res = await call("GET", `/keyring?device=${crypto.randomUUID()}`, { token: device.token });
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: "not_found", what: "keyring" });
  });

  it("answers not_found for another account's device", async () => {
    const mine = await setUp();
    const theirs = await setUp();
    const res = await call("GET", `/keyring?device=${theirs.device.id}`, { token: mine.device.token });
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: "not_found", what: "keyring" });
  });

  it("answers not_found once the device is removed", async () => {
    const { device } = await setUp();
    const other = await approve(device);
    await must("DELETE", `/devices/${other.id}`, { token: other.token });
    const res = await call("GET", `/keyring?device=${other.id}`, { token: device.token });
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: "not_found", what: "keyring" });
  });

  it("refuses a missing device id as bad_request on device", async () => {
    const { device } = await setUp();
    const res = await call("GET", "/keyring", { token: device.token });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "bad_request", field: "device" });
  });

  it("refuses an id that is not a UUID as bad_request on device", async () => {
    const { device } = await setUp();
    const res = await call("GET", "/keyring?device=not-a-uuid", { token: device.token });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "bad_request", field: "device" });
  });

  it("refuses a request with no session", async () => {
    const res = await call("GET", `/keyring?device=${crypto.randomUUID()}`);
    expect(res.status).toBe(401);
  });
});

describe("POST /devices", () => {
  /** An account with a notebook, one holder (recovery), and a second device ready to join. */
  async function ready() {
    const made = await setUp();
    const holder = made.holders[0];
    const device = await openThrough(made.account, holder);
    return { ...made, holder, joiner: device, body: await joinRequest(device, holder) };
  }

  it("lists the device as added by the holder's kind and id, moves the version, and opens the session", async () => {
    const { device: first, holder, joiner, body } = await ready();
    const before = await snapshot(first);
    const res = await call("POST", "/devices", { token: joiner.token, body });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)[0]).toBe("time");
    expect(strip(res.body)).toEqual({ kid: 1, lists: before.lists + 1, session: { open: true, device: joiner.id } });

    const lists = await must("GET", "/devices", { token: joiner.token }); // open and attached
    const entry = lists.devices.find((d) => d.id === joiner.id);
    expect(entry).toMatchObject({ how: "recovery", by: holder.id, card: { kid: 1, ...body.device.card } });
    expect(lists.lists).toBe(before.lists + 1);
    const account = await must("GET", "/account", { token: joiner.token });
    expect(account.session).toMatchObject({ open: true, device: joiner.id });
    expect((await must("GET", `/keyring?device=${joiner.id}`, { token: joiner.token })).keyring).toEqual({
      kid: 1,
      ...body.device.keyring,
    });
  });

  it("records a passkey holder's kind when a device comes in through a passkey", async () => {
    const { account, device, holders } = await setUp({ passkey: true, recovery: false });
    const joiner = await joinThrough(account, holders[0]);
    const entry = (await must("GET", "/devices", { token: device.token })).devices.find((d) => d.id === joiner.id);
    expect(entry).toMatchObject({ how: "passkey", by: holders[0].id });
  });

  it("refuses an account with no notebook as no_notebook", async () => {
    const account = freshAccount();
    const device = await newDevice(account);
    const held = ref.firstKeyring(ref.newId(), ref.randomBytes(32));
    const body = { kid: 1, proof: randomProof(), holder: crypto.randomUUID(), device: await entryFor(device, held) };
    const res = await call("POST", "/devices", { token: device.token, body });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("no_notebook");
  });

  it("refuses a kid that is not current as old_key, before the proof is looked at", async () => {
    const { device: first, joiner, body } = await ready();
    const res = await refused(first, "POST", "/devices", { token: joiner.token, body: { ...body, kid: 2, proof: randomProof() } }, 409, "old_key", { kid: 1 });
    expect(res.body.error).toBe("old_key");
    // A wrong proof was not what was answered, so none was counted.
    const next = await call("POST", "/devices", { token: joiner.token, body: { ...body, proof: randomProof() } });
    expect(next.body).toMatchObject({ error: "wrong_proof", left: 4 });
  });

  it("refuses a wrong proof as wrong_proof, counts it, and ends the session on the fifth", async () => {
    const { device: first, joiner, body } = await ready();
    const bad = { ...body, proof: randomProof() };
    const one = await refused(first, "POST", "/devices", { token: joiner.token, body: bad }, 403, "wrong_proof", { left: 4 });
    expect(one.body.left).toBe(4);
    const two = await call("POST", "/devices", { token: joiner.token, body: bad });
    expect(two.body).toMatchObject({ error: "wrong_proof", left: 3 });
    for (let i = 0; i < 2; i++) await call("POST", "/devices", { token: joiner.token, body: bad });
    const fifth = await call("POST", "/devices", { token: joiner.token, body: bad });
    expect(fifth.status).toBe(401);
    expect(fifth.body).toMatchObject({ error: "sign_in", reason: "wrong_proofs" });
    // The session is gone, even for the right proof.
    expect((await call("POST", "/devices", { token: joiner.token, body })).status).toBe(401);
  });

  it("refuses a holder that does not exist as gone", async () => {
    const { device: first, joiner, body } = await ready();
    await refused(first, "POST", "/devices", { token: joiner.token, body: { ...body, holder: crypto.randomUUID() } }, 410, "gone", { what: "holder" });
  });

  it("refuses a device id that already has an entry as exists", async () => {
    const { device: first, joiner, holder, body } = await ready();
    const clash = { ...body, device: { ...body.device, id: first.id } };
    await refused(first, "POST", "/devices", { token: joiner.token, body: clash }, 409, "exists", { what: "device" });
    expect(holder).toBeTruthy();
  });

  it("checks the holder before the device id", async () => {
    const { device: first, joiner, body } = await ready();
    const both = { ...body, holder: crypto.randomUUID(), device: { ...body.device, id: first.id } };
    const res = await call("POST", "/devices", { token: joiner.token, body: both });
    expect(res.body).toMatchObject({ error: "gone", what: "holder" });
  });

  it("refuses another device once the list is full as too_many", async () => {
    const { account, device: first, joiner, body } = await ready();
    await fillDevices(account);
    await refused(first, "POST", "/devices", { token: joiner.token, body }, 429, "too_many", { what: "devices", limit: LIMITS.devices });
  });

  it("accepts a device when the list is one short of full", async () => {
    const { account, joiner, body } = await ready();
    await fillDevices(account);
    const id = await accountId(account);
    await env.DB.prepare("DELETE FROM devices WHERE account = ? AND added_how = 'approval' AND id IN (SELECT id FROM devices WHERE account = ? AND added_how = 'approval' LIMIT 1)")
      .bind(id, id)
      .run();
    expect((await call("POST", "/devices", { token: joiner.token, body })).status).toBe(200);
  });

  describe("refuses malformed members as bad_request on the member", () => {
    const cases = {
      kid: (b) => ({ ...b, kid: "1" }),
      proof: (b) => ({ ...b, proof: ref.toBase64url(ref.randomBytes(31)) }),
      holder: (b) => ({ ...b, holder: "not-a-uuid" }),
      "device.id": (b) => ({ ...b, device: { ...b.device, id: "nope" } }),
      "device.card.nonce": (b) => ({ ...b, device: { ...b.device, card: { ...b.device.card, nonce: ref.toBase64url(ref.randomBytes(11)) } } }),
      "device.card.ct": (b) => ({ ...b, device: { ...b.device, card: { ...b.device.card, ct: "" } } }),
      "device.keyring.enc": (b) => ({ ...b, device: { ...b.device, keyring: { ...b.device.keyring, enc: ref.toBase64url(ref.randomBytes(64)) } } }),
      "device.keyring.ct": (b) => ({ ...b, device: { ...b.device, keyring: { ...b.device.keyring, ct: undefined } } }),
      device: (b) => ({ ...b, device: undefined }),
    };
    for (const [field, mutate] of Object.entries(cases)) {
      it(`refuses a bad ${field}`, async () => {
        const { device: first, joiner, body } = await ready();
        await refused(first, "POST", "/devices", { token: joiner.token, body: mutate(body) }, 400, "bad_request", { field });
      });
    }
  });

  it("refuses a request with no session", async () => {
    const { body } = await ready();
    expect((await call("POST", "/devices", { body })).status).toBe(401);
  });
});

describe("GET /devices", () => {
  it("answers the version, the kid, each device, and each holder in the interface's shapes", async () => {
    const { account, device, holders, held } = await setUp({ passkey: true, recovery: true });
    const joiner = await joinThrough(account, holders[1]);
    const body = await must("GET", "/devices", { token: device.token });
    expect(Object.keys(body)).toEqual(["time", "kid", "lists", "devices", "holders"]);
    expect(body.time).toMatch(TIME);
    expect(body.kid).toBe(1);
    expect(body.lists).toBe((await must("GET", "/account", { token: device.token })).lists);

    expect(body.devices).toHaveLength(2);
    for (const entry of body.devices) {
      expect(Object.keys(entry).sort()).toEqual(["added", "by", "card", "how", "id", "seen"]);
      expect(Object.keys(entry.card).sort()).toEqual(["ct", "kid", "nonce"]);
      expect(entry.card.kid).toBe(1);
      expect(entry.added).toMatch(TIME);
      expect(entry.seen).toMatch(TIME);
    }
    const first = body.devices.find((d) => d.id === device.id);
    expect(first).toMatchObject({ how: "setup", by: null });
    const second = body.devices.find((d) => d.id === joiner.id);
    expect(second).toMatchObject({ how: "recovery", by: holders[1].id });

    expect(body.holders).toHaveLength(2);
    for (const entry of body.holders) {
      expect(entry.card.kid).toBe(1);
      expect(Object.keys(entry.card).sort()).toEqual(["ct", "kid", "nonce"]);
      expect(entry.added).toMatch(TIME);
      expect(entry.by).toBe(device.id);
    }
    const passkey = body.holders.find((h) => h.id === holders[0].id);
    expect(Object.keys(passkey).sort()).toEqual(["added", "by", "card", "credential", "id", "kind"]);
    expect(passkey).toMatchObject({ kind: "passkey", credential: holders[0].credential, card: { kid: 1, ...holders[0].wire.card } });
    const recovery = body.holders.find((h) => h.id === holders[1].id);
    expect(Object.keys(recovery).sort()).toEqual(["added", "by", "card", "id", "kind"]);

    const text = JSON.stringify(body);
    expect(text).not.toContain('"record"');
    expect(text).not.toContain('"keyring"');
    expect(held).toBeTruthy();
  });

  it("refuses a session that has not proved the key as not_open", async () => {
    const { account } = await setUp();
    const res = await call("GET", "/devices", { token: await signIn(account) });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: "not_open", kid: 1 });
  });

  it("refuses a request with no session", async () => {
    expect((await call("GET", "/devices")).status).toBe(401);
  });

  it("never shows another account's devices or holders", async () => {
    const one = await setUp();
    const two = await setUp();
    const body = await must("GET", "/devices", { token: one.device.token });
    expect(body.devices.map((d) => d.id)).toEqual([one.device.id]);
    expect(body.holders.map((h) => h.id)).toEqual([one.holders[0].id]);
    expect(JSON.stringify(body)).not.toContain(two.device.id);
  });
});

describe("PUT /devices/<id>", () => {
  const put = async (device, over = {}) => {
    const { lists } = await must("GET", "/devices", { token: device.token });
    return {
      lists,
      kid: 1,
      card: await cardFor(device, device.held, { name: "A new name" }),
      ...over,
    };
  };

  it("replaces the card, moves the version, and leaves the keyring alone when none is sent", async () => {
    const { device } = await setUp();
    const body = await put(device);
    const keyringBefore = await must("GET", `/keyring?device=${device.id}`, { token: device.token });
    const res = await call("PUT", `/devices/${device.id}`, { token: device.token, body });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)[0]).toBe("time");
    expect(strip(res.body)).toEqual({ lists: body.lists + 1 });

    const lists = await must("GET", "/devices", { token: device.token });
    expect(lists.lists).toBe(body.lists + 1);
    expect(lists.devices[0].card).toEqual({ kid: 1, ...body.card });
    const keyringAfter = await must("GET", `/keyring?device=${device.id}`, { token: device.token });
    expect(keyringAfter.keyring).toEqual(keyringBefore.keyring);
  });

  it("replaces the keyring too when one is sent", async () => {
    const { device } = await setUp();
    const keyring = await keyringFor(device.key.public, device.held);
    const before = await must("GET", `/keyring?device=${device.id}`, { token: device.token });
    expect(keyring).not.toEqual({ enc: before.keyring.enc, ct: before.keyring.ct });
    await must("PUT", `/devices/${device.id}`, { token: device.token, body: { ...(await put(device)), keyring } });
    const after = await must("GET", `/keyring?device=${device.id}`, { token: device.token });
    expect(after.keyring).toEqual({ kid: 1, ...keyring });
  });

  it("refuses another device's id as not_allowed own_device", async () => {
    const { device } = await setUp();
    const other = await approve(device);
    await refused(device, "PUT", `/devices/${other.id}`, { token: device.token, body: await put(device) }, 422, "not_allowed", { rule: "own_device" });
  });

  it("refuses an id with no entry as not_allowed own_device", async () => {
    const { device } = await setUp();
    await refused(device, "PUT", `/devices/${crypto.randomUUID()}`, { token: device.token, body: await put(device) }, 422, "not_allowed", { rule: "own_device" });
  });

  it("refuses a version that is not current as lists_changed, with the current one", async () => {
    const { device } = await setUp();
    const body = await put(device);
    const res = await refused(device, "PUT", `/devices/${device.id}`, { token: device.token, body: { ...body, lists: body.lists + 7 } }, 409, "lists_changed", { lists: body.lists });
    expect(res.body.lists).toBe(body.lists);
  });

  it("refuses a kid that is not current as old_key", async () => {
    const { device } = await setUp();
    await refused(device, "PUT", `/devices/${device.id}`, { token: device.token, body: await put(device, { kid: 2 }) }, 409, "old_key", { kid: 1 });
  });

  it("refuses a session that is not open as not_open", async () => {
    const { account, device } = await setUp();
    const token = await signIn(account);
    await refused(device, "PUT", `/devices/${device.id}`, { token, body: await put(device) }, 403, "not_open", { kid: 1 });
  });

  describe("refuses malformed members as bad_request on the member", () => {
    const cases = {
      lists: (b) => ({ ...b, lists: "1" }),
      kid: (b) => ({ ...b, kid: 0 }),
      "card.nonce": (b) => ({ ...b, card: { ...b.card, nonce: ref.toBase64url(ref.randomBytes(13)) } }),
      "card.ct": (b) => ({ ...b, card: { ...b.card, ct: "!!" } }),
      card: (b) => ({ ...b, card: "x" }),
      "keyring.enc": (b) => ({ ...b, keyring: { enc: ref.toBase64url(ref.randomBytes(33)), ct: b.card.ct } }),
      "keyring.ct": (b) => ({ ...b, keyring: { enc: ref.toBase64url(ref.randomBytes(65)), ct: "" } }),
    };
    for (const [field, mutate] of Object.entries(cases)) {
      it(`refuses a bad ${field}`, async () => {
        const { device } = await setUp();
        await refused(device, "PUT", `/devices/${device.id}`, { token: device.token, body: mutate(await put(device)) }, 400, "bad_request", { field });
      });
    }
  });
});

describe("DELETE /devices/<id>", () => {
  it("removes the entry and its keyring, ends every session on that device, and moves the version", async () => {
    const { account, device } = await setUp();
    const other = await approve(device);
    // A second sign-in proves on the same device: two sessions on one device.
    const second = await signIn(account);
    await must("POST", "/session/proof", {
      token: second,
      body: { device: other.id, kid: 1, proof: await proofOf(other.held) },
    });
    expect((await call("GET", "/devices", { token: second })).status).toBe(200);
    const before = await snapshot(device);

    const res = await call("DELETE", `/devices/${other.id}`, { token: other.token });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)[0]).toBe("time");
    expect(strip(res.body)).toEqual({ lists: before.lists + 1 });

    expect((await call("GET", "/devices", { token: other.token })).status).toBe(401);
    expect((await call("GET", "/devices", { token: second })).status).toBe(401);
    const after = await snapshot(device);
    expect(after.kid).toBe(1);
    expect(after.lists).toBe(before.lists + 1);
    expect(after.listed.devices.map((d) => d.id)).toEqual([device.id]);
    const gone = await call("GET", `/keyring?device=${other.id}`, { token: device.token });
    expect(gone.status).toBe(404);
    // The device that stayed is still open.
    expect((await call("GET", "/devices", { token: device.token })).status).toBe(200);
  });

  it("refuses a session attached to another device as not_allowed own_device", async () => {
    const { device } = await setUp();
    const other = await approve(device);
    await refused(device, "DELETE", `/devices/${device.id}`, { token: other.token }, 422, "not_allowed", { rule: "own_device" });
    expect((await call("GET", "/devices", { token: device.token })).status).toBe(200);
  });

  it("refuses a session attached to no device as not_allowed own_device", async () => {
    const { account, device } = await setUp();
    await refused(device, "DELETE", `/devices/${device.id}`, { token: await signIn(account) }, 422, "not_allowed", { rule: "own_device" });
  });

  it("refuses a request with no session", async () => {
    const { device } = await setUp();
    expect((await call("DELETE", `/devices/${device.id}`)).status).toBe(401);
  });

  it("lets a device that a change of key closed still sign out", async () => {
    const { device } = await setUp();
    const other = await approve(device);
    await changeKey(device, {});
    expect((await call("GET", "/devices", { token: other.token })).body.error).toBe("not_open");
    const res = await call("DELETE", `/devices/${other.id}`, { token: other.token });
    expect(res.status).toBe(200);
    const lists = await must("GET", "/devices", { token: device.token });
    expect(lists.devices.map((d) => d.id)).toEqual([device.id]);
    expect(lists.kid).toBe(2);
  });
});

describe("POST /holders", () => {
  /** An open device whose notebook has only a passkey holder, so a recovery holder may be added. */
  async function noRecovery() {
    const made = await setUp({ passkey: true, recovery: false });
    const lists = await must("GET", "/devices", { token: made.device.token });
    return { ...made, lists: lists.lists };
  }
  const send = (made, holder, over = {}) =>
    call("POST", "/holders", { token: made.device.token, body: { lists: made.lists, kid: 1, holder: holder.wire ?? holder, ...over } });

  it("stores the holder by the caller's device, moves the version, and a new device can come in through it", async () => {
    const made = await noRecovery();
    const holder = await makeHolder(made.held, "recovery");
    const res = await send(made, holder);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)[0]).toBe("time");
    expect(strip(res.body)).toEqual({ lists: made.lists + 1 });

    const lists = await must("GET", "/devices", { token: made.device.token });
    expect(lists.lists).toBe(made.lists + 1);
    const stored = lists.holders.find((h) => h.id === holder.id);
    expect(stored).toMatchObject({ kind: "recovery", by: made.device.id, card: { kid: 1, ...holder.wire.card } });
    const joined = await joinThrough(made.account, holder);
    const entry = (await must("GET", "/devices", { token: joined.token })).devices.find((d) => d.id === joined.id);
    expect(entry).toMatchObject({ how: "recovery", by: holder.id });
  });

  it("stores a passkey holder whose credential is a synced way in, with its credential", async () => {
    const made = await setUp({ passkey: false, recovery: true });
    const lists = (await must("GET", "/devices", { token: made.device.token })).lists;
    const holder = await makeHolder(made.held, "passkey");
    await listPasskey(made.device, holder.credential, true);
    const res = await call("POST", "/holders", { token: made.device.token, body: { lists, kid: 1, holder: holder.wire } });
    expect(res.status).toBe(200);
    const stored = (await must("GET", "/holders", { token: made.device.token })).holders.find((h) => h.id === holder.id);
    expect(stored).toMatchObject({ kind: "passkey", credential: holder.credential });
  });

  it("refuses a version that is not current as lists_changed", async () => {
    const made = await noRecovery();
    const holder = await makeHolder(made.held, "recovery");
    await refused(made.device, "POST", "/holders", { token: made.device.token, body: { lists: made.lists + 1, kid: 1, holder: holder.wire } }, 409, "lists_changed", { lists: made.lists });
  });

  it("refuses a kid that is not current as old_key", async () => {
    const made = await noRecovery();
    const holder = await makeHolder(made.held, "recovery");
    await refused(made.device, "POST", "/holders", { token: made.device.token, body: { lists: made.lists, kid: 2, holder: holder.wire } }, 409, "old_key", { kid: 1 });
  });

  it("refuses a session that is not open as not_open", async () => {
    const made = await noRecovery();
    const holder = await makeHolder(made.held, "recovery");
    const token = await signIn(made.account);
    await refused(made.device, "POST", "/holders", { token, body: { lists: made.lists, kid: 1, holder: holder.wire } }, 403, "not_open", { kid: 1 });
  });

  it("refuses a second recovery holder as exists recovery", async () => {
    const made = await setUp({ recovery: true });
    const lists = (await must("GET", "/devices", { token: made.device.token })).lists;
    const holder = await makeHolder(made.held, "recovery");
    await refused(made.device, "POST", "/holders", { token: made.device.token, body: { lists, kid: 1, holder: holder.wire } }, 409, "exists", { what: "recovery" });
  });

  it("refuses a passkey holder whose credential is unknown as passkey_unknown", async () => {
    const made = await noRecovery();
    const holder = await makeHolder(made.held, "passkey"); // never listed as a way in
    await refused(made.device, "POST", "/holders", { token: made.device.token, body: { lists: made.lists, kid: 1, holder: holder.wire } }, 422, "not_allowed", { rule: "passkey_unknown" });
  });

  it("refuses a passkey holder whose credential does not sync as passkey_not_synced", async () => {
    const made = await noRecovery();
    const holder = await makeHolder(made.held, "passkey");
    await listPasskey(made.device, holder.credential, false);
    await refused(made.device, "POST", "/holders", { token: made.device.token, body: { lists: made.lists, kid: 1, holder: holder.wire } }, 422, "not_allowed", { rule: "passkey_not_synced" });
  });

  it("refuses a passkey that already has a holder as exists passkey", async () => {
    const made = await noRecovery();
    const holder = await makeHolder(made.held, "passkey");
    holder.wire.credential = made.holders[0].credential; // the one that already has a holder
    await refused(made.device, "POST", "/holders", { token: made.device.token, body: { lists: made.lists, kid: 1, holder: holder.wire } }, 409, "exists", { what: "passkey" });
  });

  it("refuses a holder id already used as exists holder", async () => {
    const made = await noRecovery();
    const holder = await makeHolder(made.held, "passkey");
    await listPasskey(made.device, holder.credential, true);
    holder.wire.id = made.holders[0].id;
    await refused(made.device, "POST", "/holders", { token: made.device.token, body: { lists: made.lists, kid: 1, holder: holder.wire } }, 409, "exists", { what: "holder" });
  });

  it("refuses another holder once the list is full as too_many", async () => {
    const made = await noRecovery();
    await fillHolders(made.account);
    const holder = await makeHolder(made.held, "recovery");
    await refused(made.device, "POST", "/holders", { token: made.device.token, body: { lists: made.lists, kid: 1, holder: holder.wire } }, 429, "too_many", { what: "holders", limit: LIMITS.holders });
  });

  describe("refuses malformed members as bad_request on the member", () => {
    const cases = {
      "holder.kind": (w) => ({ ...w, kind: "email" }),
      "holder.id": (w) => ({ ...w, id: "x" }),
      "holder.credential": (w) => ({ ...w, credential: "AAAA" }), // a recovery holder has none
      "holder.record.nonce": (w) => ({ ...w, record: { ...w.record, nonce: ref.toBase64url(ref.randomBytes(8)) } }),
      "holder.record.ct": (w) => ({ ...w, record: { ...w.record, ct: "" } }),
      "holder.card.nonce": (w) => ({ ...w, card: { ...w.card, nonce: "A" } }),
      "holder.keyring.enc": (w) => ({ ...w, keyring: { ...w.keyring, enc: ref.toBase64url(ref.randomBytes(10)) } }),
    };
    for (const [field, mutate] of Object.entries(cases)) {
      it(`refuses a bad ${field}`, async () => {
        const made = await noRecovery();
        const holder = await makeHolder(made.held, "recovery");
        await refused(made.device, "POST", "/holders", { token: made.device.token, body: { lists: made.lists, kid: 1, holder: mutate(holder.wire) } }, 400, "bad_request", { field });
      });
    }

    it("refuses a passkey holder with no credential", async () => {
      const made = await noRecovery();
      const holder = await makeHolder(made.held, "passkey");
      const wire = { ...holder.wire, credential: undefined };
      await refused(made.device, "POST", "/holders", { token: made.device.token, body: { lists: made.lists, kid: 1, holder: wire } }, 400, "bad_request", { field: "holder.credential" });
    });

    it("refuses a bad lists", async () => {
      const made = await noRecovery();
      const holder = await makeHolder(made.held, "recovery");
      await refused(made.device, "POST", "/holders", { token: made.device.token, body: { lists: "1", kid: 1, holder: holder.wire } }, 400, "bad_request", { field: "lists" });
    });
  });
});

describe("a holder is removed only by a change of key", () => {
  it("has no DELETE for a holder", async () => {
    const { device, holders } = await setUp();
    for (const path of [`/holders/${holders[0].id}`, "/holders"]) {
      const res = await call("DELETE", path, { token: device.token });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("not_found");
    }
    const still = await must("GET", "/holders", { token: device.token });
    expect(still.holders.map((h) => h.id)).toEqual([holders[0].id]);
  });

  it("has no PUT for a holder either", async () => {
    const { device, holders } = await setUp();
    const res = await call("PUT", `/holders/${holders[0].id}`, { token: device.token, body: {} });
    expect(res.status).toBe(404);
  });
});
