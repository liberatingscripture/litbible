// "Changing the key" of the interface: POST /notebook/key. Each refusal starts
// from a request built by keyChangeRequest(), changes one thing, and checks
// that nothing moved ("all at once, or not at all").
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { LIMITS } from "../src/check.js";
import { call } from "./call.js";
import {
  approve,
  approvalRequest,
  cardFor,
  changeKey,
  joinThrough,
  keyChangeRequest,
  listPasskey,
  makeHolder,
  must,
  proofOf,
  push,
  ref,
  rowFor,
  setUp,
  signIn,
} from "./notebook.js";

const strip = ({ time, ...rest }) => rest;
const b64 = ref.toBase64url;

async function snapshot(device) {
  const account = await must("GET", "/account", { token: device.token });
  const lists = await must("GET", "/devices", { token: device.token });
  return { kid: account.kid, lists: account.lists, listed: strip(lists) };
}

/** Sends a change that must be refused; the kid, the version, and both lists stay as they were. */
async function refused(device, body, status, error, extra = {}, token = device.token) {
  const before = await snapshot(device);
  const res = await call("POST", "/notebook/key", { token, body });
  expect(res.status).toBe(status);
  expect(res.body.error).toBe(error);
  expect(res.body).toMatchObject(extra);
  expect(await snapshot(device)).toEqual(before);
  return res;
}
const notAllowed = (device, body, rule) => refused(device, body, 422, "not_allowed", { rule });
const badRequest = (device, body, field) => refused(device, body, 400, "bad_request", { field });

/** Two devices and a recovery holder; the first device is the caller. */
async function twoDevices(options) {
  const made = await setUp(options);
  const second = await approve(made.device);
  return { ...made, second };
}

describe("POST /notebook/key: refusals", () => {
  it("refuses a session that is not open as not_open", async () => {
    const { account, device } = await setUp();
    const { body } = await keyChangeRequest(device);
    await refused(device, body, 403, "not_open", { kid: 1 }, await signIn(account));
  });

  it("refuses a kid that is not current as old_key", async () => {
    const { device } = await setUp();
    const { body } = await keyChangeRequest(device);
    await refused(device, { ...body, kid: 2 }, 409, "old_key", { kid: 1 });
  });

  it("refuses a version that is not current as lists_changed, with the current one", async () => {
    const { device, held } = await setUp();
    const { body } = await keyChangeRequest(device);
    // The list moves between building and sending: a rename.
    await must("PUT", `/devices/${device.id}`, {
      token: device.token,
      body: { lists: body.lists, kid: 1, card: await cardFor(device, held, { name: "Renamed" }) },
    });
    await refused(device, body, 409, "lists_changed", { lists: body.lists + 1 });
  });

  it("refuses when a device joined after the request was built as lists_changed", async () => {
    const { account, device, holders } = await setUp();
    const { body } = await keyChangeRequest(device);
    await joinThrough(account, holders[0]);
    await refused(device, body, 409, "lists_changed", { lists: body.lists + 1 });
  });

  it("refuses when a device on the service is in neither list as every_device", async () => {
    const { device, second } = await twoDevices();
    const { body } = await keyChangeRequest(device);
    body.devices = body.devices.filter((d) => d.id !== second.id);
    await notAllowed(device, body, "every_device");
  });

  it("refuses a removed device the service does not have as every_device", async () => {
    const { device } = await setUp();
    const { body } = await keyChangeRequest(device);
    body.removeDevices.push(crypto.randomUUID());
    await notAllowed(device, body, "every_device");
  });

  it("refuses a kept device the service does not have as every_device", async () => {
    const { device } = await setUp();
    const { body } = await keyChangeRequest(device);
    body.devices.push({ ...body.devices[0], id: crypto.randomUUID() });
    await notAllowed(device, body, "every_device");
  });

  it("refuses a device named in both lists as bad_request on devices", async () => {
    const { device, second } = await twoDevices();
    const { body } = await keyChangeRequest(device);
    body.removeDevices.push(second.id); // still in `devices` too
    await badRequest(device, body, "devices");
  });

  it("refuses a device named twice in one list as bad_request on devices", async () => {
    const { device, second } = await twoDevices();
    const { body } = await keyChangeRequest(device);
    body.devices.push(body.devices.find((d) => d.id === second.id));
    await badRequest(device, body, "devices");
  });

  it("refuses a removed device named twice as bad_request on devices", async () => {
    const { device, second } = await twoDevices();
    const { body } = await keyChangeRequest(device, { removeDevices: [second.id] });
    body.removeDevices.push(second.id);
    await badRequest(device, body, "devices");
  });

  it("refuses when a holder on the service is in neither list as every_holder", async () => {
    const { device } = await setUp({ passkey: true, recovery: true });
    const { body } = await keyChangeRequest(device);
    body.holders.pop();
    await notAllowed(device, body, "every_holder");
  });

  it("refuses a removed holder the service does not have as every_holder", async () => {
    const { device } = await setUp();
    const { body } = await keyChangeRequest(device);
    body.removeHolders.push(crypto.randomUUID());
    await notAllowed(device, body, "every_holder");
  });

  it("refuses a kept holder the service does not have as every_holder", async () => {
    const { device } = await setUp();
    const { body } = await keyChangeRequest(device);
    body.holders.push({ ...body.holders[0], id: crypto.randomUUID() });
    await notAllowed(device, body, "every_holder");
  });

  it("refuses a holder named in both lists as bad_request on holders", async () => {
    const { device, holders } = await setUp({ passkey: true, recovery: true });
    const { body } = await keyChangeRequest(device);
    body.removeHolders.push(holders[0].id);
    await badRequest(device, body, "holders");
  });

  it("refuses a holder named twice in one list as bad_request on holders", async () => {
    const { device } = await setUp();
    const { body } = await keyChangeRequest(device);
    body.holders.push(body.holders[0]);
    await badRequest(device, body, "holders");
  });

  it("refuses the caller's own device in removeDevices as keep_own_device", async () => {
    const { device } = await twoDevices();
    const { body } = await keyChangeRequest(device, { removeDevices: [device.id] });
    await notAllowed(device, body, "keep_own_device");
  });

  it("refuses every holder removed and none added as holder_needed", async () => {
    const { device, holders } = await setUp();
    const { body } = await keyChangeRequest(device, { removeHolders: [holders[0].id] });
    await notAllowed(device, body, "holder_needed");
  });

  it("refuses a recovery holder kept and another added as one_recovery", async () => {
    const { device } = await setUp();
    const { body } = await keyChangeRequest(device, { add: ["recovery"] });
    await notAllowed(device, body, "one_recovery");
  });

  it("refuses two new recovery holders as one_recovery", async () => {
    const { device } = await setUp({ passkey: true, recovery: false });
    const { held, body } = await keyChangeRequest(device, { add: ["recovery"] });
    body.newHolders.push((await makeHolder(held, "recovery")).wire);
    await notAllowed(device, body, "one_recovery");
  });

  it("refuses a new passkey holder whose credential is unknown as passkey_unknown", async () => {
    const { device } = await setUp();
    const { held, body } = await keyChangeRequest(device);
    body.newHolders.push((await makeHolder(held, "passkey")).wire); // never listed
    await notAllowed(device, body, "passkey_unknown");
  });

  it("refuses a new passkey holder whose credential does not sync as passkey_not_synced", async () => {
    const { device } = await setUp();
    const { held, body } = await keyChangeRequest(device);
    const holder = await makeHolder(held, "passkey");
    await listPasskey(device, holder.credential, false);
    body.newHolders.push(holder.wire);
    await notAllowed(device, body, "passkey_not_synced");
  });

  it("refuses a new passkey holder with a kept holder's credential as one_holder_per_passkey", async () => {
    const { device, holders } = await setUp({ passkey: true, recovery: true });
    const { held, body } = await keyChangeRequest(device);
    const holder = await makeHolder(held, "passkey");
    holder.wire.credential = holders[0].credential;
    body.newHolders.push(holder.wire);
    await notAllowed(device, body, "one_holder_per_passkey");
  });

  it("refuses two new passkey holders with one credential as one_holder_per_passkey", async () => {
    const { device } = await setUp();
    const { held, body } = await keyChangeRequest(device, { add: ["passkey"] });
    const again = await makeHolder(held, "passkey");
    again.wire.credential = body.newHolders[0].credential;
    body.newHolders.push(again.wire);
    await notAllowed(device, body, "one_holder_per_passkey");
  });

  it("refuses a new holder that takes an existing holder's id as bad_request on holders", async () => {
    // The spec's table does not say which word. The service's distinct-ids check
    // runs on parsing, so its `exists` branch for this case is never reached.
    const { device, holders } = await setUp({ passkey: true, recovery: true });
    const { held, body } = await keyChangeRequest(device);
    const holder = await makeHolder(held, "passkey");
    await listPasskey(device, holder.credential);
    holder.wire.id = holders[0].id;
    body.newHolders.push(holder.wire);
    await badRequest(device, body, "holders");
  });

  it("refuses a new holder that reuses the id of a holder being removed as bad_request on holders", async () => {
    const { device, holders } = await setUp({ passkey: true, recovery: true });
    const { held, body } = await keyChangeRequest(device, { removeHolders: [holders[0].id] });
    const holder = await makeHolder(held, "passkey");
    await listPasskey(device, holder.credential);
    holder.wire.id = holders[0].id;
    body.newHolders.push(holder.wire);
    await badRequest(device, body, "holders");
  });

  it("refuses more holders than the list may hold as too_many", async () => {
    const { device } = await setUp();
    const { held, body } = await keyChangeRequest(device);
    for (let i = 0; i < LIMITS.holders; i++) {
      const holder = await makeHolder(held, "passkey");
      await listPasskey(device, holder.credential);
      body.newHolders.push(holder.wire);
    }
    await refused(device, body, 429, "too_many", { what: "holders", limit: LIMITS.holders });
  });

  describe("refuses malformed members as bad_request on the member", () => {
    const cases = {
      kid: (b) => ({ ...b, kid: "1" }),
      lists: (b) => ({ ...b, lists: -1 }),
      proofHash: (b) => ({ ...b, proofHash: b64(ref.randomBytes(31)) }),
      "devices[0].id": (b) => ({ ...b, devices: [{ ...b.devices[0], id: "x" }] }),
      "devices[0].card.nonce": (b) => ({ ...b, devices: [{ ...b.devices[0], card: { ...b.devices[0].card, nonce: b64(ref.randomBytes(11)) } }] }),
      "devices[0].card.ct": (b) => ({ ...b, devices: [{ ...b.devices[0], card: { ...b.devices[0].card, ct: "" } }] }),
      "devices[0].keyring.enc": (b) => ({ ...b, devices: [{ ...b.devices[0], keyring: { ...b.devices[0].keyring, enc: b64(ref.randomBytes(64)) } }] }),
      "devices[0].keyring.ct": (b) => ({ ...b, devices: [{ ...b.devices[0], keyring: { ...b.devices[0].keyring, ct: "" } }] }),
      "holders[0].card.nonce": (b) => ({ ...b, holders: [{ ...b.holders[0], card: { ...b.holders[0].card, nonce: "AAAA" } }] }),
      "holders[0].keyring.enc": (b) => ({ ...b, holders: [{ ...b.holders[0], keyring: { ...b.holders[0].keyring, enc: "AAAA" } }] }),
      "removeDevices[0]": (b) => ({ ...b, removeDevices: ["nope"] }),
      "removeHolders[0]": (b) => ({ ...b, removeHolders: ["nope"] }),
      devices: (b) => ({ ...b, devices: "all" }),
      holders: (b) => ({ ...b, holders: {} }),
    };
    for (const [field, mutate] of Object.entries(cases)) {
      it(`refuses a bad ${field}`, async () => {
        const { device } = await setUp();
        const { body } = await keyChangeRequest(device);
        await badRequest(device, mutate(body), field);
      });
    }

    it("refuses a bad newHolders[0].kind", async () => {
      const { device } = await setUp();
      const { held, body } = await keyChangeRequest(device);
      const holder = await makeHolder(held, "passkey");
      body.newHolders.push({ ...holder.wire, kind: "email" });
      await badRequest(device, body, "newHolders[0].kind");
    });

    it("refuses a bad newHolders[0].record.nonce", async () => {
      const { device } = await setUp({ passkey: false, recovery: true });
      const { held, body } = await keyChangeRequest(device, { removeHolders: [] });
      const holder = await makeHolder(held, "passkey");
      body.newHolders.push({ ...holder.wire, record: { ...holder.wire.record, nonce: "AA" } });
      await badRequest(device, body, "newHolders[0].record.nonce");
    });
  });
});

describe("POST /notebook/key: all at once", () => {
  it("accepts removing the old recovery holder and adding a new one in one request", async () => {
    const { account, device, holders } = await setUp();
    const { held, added, answer } = await changeKey(device, { removeHolders: [holders[0].id], add: ["recovery"] });
    expect(strip(answer)).toMatchObject({ kid: 2 });
    const listed = (await must("GET", "/holders", { token: device.token })).holders;
    expect(listed.map((h) => h.id)).toEqual([added[0].id]);
    // The new code opens the notebook, and holds the new key.
    const joiner = await joinThrough(account, added[0]);
    expect(joiner.held.current).toBe(2);
    expect(held.current).toBe(2);
  });

  it("changes everything together", async () => {
    const { account, device, holders, held: oldHeld } = await setUp({ passkey: true, recovery: true });
    const [oldPasskey, recovery] = holders;
    const kept = await approve(device);
    const dropped = await approve(device);
    const bystander = await approve(device);

    // Two sessions on the device to be removed.
    const droppedSecond = await signIn(account);
    await must("POST", "/session/proof", {
      token: droppedSecond,
      body: { device: dropped.id, kid: 1, proof: await proofOf(dropped.held) },
    });
    // An approval in progress.
    const asking = await approvalRequest(account);
    await must("POST", "/approvals", { token: asking.device.token, body: asking.body });
    expect((await call("GET", `/approvals/${asking.id}`, { token: asking.device.token })).status).toBe(200);

    const before = await must("GET", "/devices", { token: device.token });
    const oldProof = await proofOf(oldHeld);
    const change = await keyChangeRequest(device, { removeDevices: [dropped.id], removeHolders: [oldPasskey.id], add: ["passkey"] });
    const res = await call("POST", "/notebook/key", { token: device.token, body: change.body });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)[0]).toBe("time");
    expect(strip(res.body)).toEqual({ kid: 2, lists: before.lists + 1 });
    device.held = change.held;
    const newPasskey = change.added[0];

    // The kid is one higher; the version moved.
    const account2 = await must("GET", "/account", { token: device.token });
    expect(account2).toMatchObject({ kid: 2, lists: before.lists + 1 });
    expect(account2.session).toMatchObject({ open: true, device: device.id });

    // The old proof no longer proves, and the new one does.
    const fresh = await signIn(account);
    const stale = await call("POST", "/session/proof", { token: fresh, body: { device: device.id, kid: 2, proof: oldProof } });
    expect(stale.body).toMatchObject({ error: "wrong_proof" });
    const proved = await call("POST", "/session/proof", { token: fresh, body: { device: device.id, kid: 2, proof: await proofOf(change.held) } });
    expect(proved.status).toBe(200);

    // Kept devices carry the new kid and exactly what was sent.
    const lists = await must("GET", "/devices", { token: device.token });
    expect(lists.kid).toBe(2);
    expect(lists.devices.map((d) => d.id).sort()).toEqual([device.id, kept.id, bystander.id].sort());
    for (const sent of change.body.devices) {
      const entry = lists.devices.find((d) => d.id === sent.id);
      expect(entry.card).toEqual({ kid: 2, ...sent.card });
      const keyring = await must("GET", `/keyring?device=${sent.id}`, { token: device.token });
      expect(keyring.keyring).toEqual({ kid: 2, ...sent.keyring });
      const was = before.devices.find((d) => d.id === sent.id);
      expect({ added: entry.added, how: entry.how, by: entry.by }).toEqual({ added: was.added, how: was.how, by: was.by });
    }

    // The removed device has no entry, no keyring, and no session.
    expect((await call("GET", `/keyring?device=${dropped.id}`, { token: device.token })).status).toBe(404);
    expect((await call("GET", "/devices", { token: dropped.token })).status).toBe(401);
    expect((await call("GET", "/devices", { token: droppedSecond })).status).toBe(401);

    // Holders: the removed one is gone from both lists; the kept one is resealed; the new one is by the caller.
    const holderList = (await must("GET", "/holders", { token: device.token })).holders;
    expect(holderList.map((h) => h.id).sort()).toEqual([recovery.id, newPasskey.id].sort());
    expect(lists.holders.map((h) => h.id).sort()).toEqual([recovery.id, newPasskey.id].sort());
    const keptHolder = change.body.holders[0];
    expect(lists.holders.find((h) => h.id === recovery.id).card).toEqual({ kid: 2, ...keptHolder.card });
    expect(holderList.find((h) => h.id === recovery.id).keyring).toEqual({ kid: 2, ...keptHolder.keyring });
    const stored = lists.holders.find((h) => h.id === newPasskey.id);
    expect(stored).toMatchObject({ kind: "passkey", credential: newPasskey.credential, by: device.id, card: { kid: 2, ...newPasskey.wire.card } });
    expect(holderList.find((h) => h.id === newPasskey.id).record).toEqual(newPasskey.wire.record);

    // An approval in progress is gone.
    const approval = await call("GET", `/approvals/${asking.id}`, { token: asking.device.token });
    expect(approval.status).toBe(410);
    expect(approval.body).toMatchObject({ error: "gone", what: "approval" });

    // Every other session is closed; the caller's is open.
    for (const other of [kept, bystander]) {
      const closed = await call("GET", "/devices", { token: other.token });
      expect(closed.status).toBe(403);
      expect(closed.body).toMatchObject({ error: "not_open", kid: 2 });
    }
    expect((await call("GET", "/devices", { token: device.token })).status).toBe(200);

    // A row sealed under the old kid is refused as old_key.
    const old = await call("POST", "/rows", { token: device.token, body: { put: [await rowFor(oldHeld)], remove: [] } });
    expect(old.status).toBe(409);
    expect(old.body).toMatchObject({ error: "old_key", kid: 2 });
    await push(device, [await rowFor(change.held)]);

    // A closed device catches up and opens again.
    const { catchUp } = await import("./notebook.js");
    await catchUp(kept);
    expect((await call("GET", "/devices", { token: kept.token })).status).toBe(200);
  });

  it("changes the key with nothing removed or added", async () => {
    const { device } = await twoDevices();
    const before = await must("GET", "/devices", { token: device.token });
    const { answer } = await changeKey(device, {});
    expect(strip(answer)).toEqual({ kid: 2, lists: before.lists + 1 });
    expect((await must("GET", "/devices", { token: device.token })).devices).toHaveLength(2);
  });

  it("is the same whether the removed holder's row is counted as db rows or lists", async () => {
    // Guards the database too: a removed holder leaves no row behind.
    const { account, device, holders } = await setUp({ passkey: true, recovery: true });
    await changeKey(device, { removeHolders: [holders[0].id] });
    const { n } = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM holders WHERE id = ?",
    ).bind(holders[0].id).first();
    expect(n).toBe(0);
    expect(account).toBeTruthy();
  });
});
