// "The account": GET /account and POST /session/proof.
import { describe, expect, it } from "vitest";
import { SECRET, call, freshAccount } from "./call.js";
import { approve, changeKey, listPasskey, must, proofOf, ref, setUp, signIn } from "./notebook.js";

const b64 = ref.toBase64url;
const random32 = () => b64(ref.randomBytes(32));
const TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const proof = (token, body) => call("POST", "/session/proof", { token, body });

describe("GET /account", () => {
  it("answers for an account with no notebook: none, kid 0, lists 0, not open, one way in", async () => {
    const session = await must("POST", "/preview/session", { body: { secret: SECRET, account: freshAccount() } });
    const res = await call("GET", "/account", { token: session.token });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["time", "notebook", "kid", "lists", "session", "ways", "waiting"]);
    expect(res.body.notebook).toBeNull();
    expect(res.body.kid).toBe(0);
    expect(res.body.lists).toBe(0);
    expect(res.body.session).toEqual({ open: false, device: null, expires: session.expires });
    expect(res.body.waiting).toBeNull();
    expect(res.body.ways).toEqual([{ id: expect.stringMatching(UUID), kind: "preview", added: expect.stringMatching(TIME) }]);
  });

  it("answers after setup with the notebook, kid 1, lists 1, and the session open on its device", async () => {
    const { device, held } = await setUp();
    const res = await call("GET", "/account", { token: device.token });
    expect(res.status).toBe(200);
    expect(res.body.notebook).toBe(held.notebook);
    expect(res.body.kid).toBe(1);
    expect(res.body.lists).toBe(1);
    expect(res.body.session).toEqual({ open: true, device: device.id, expires: expect.stringMatching(TIME) });
    expect(res.body.waiting).toBeNull();
  });

  it("answers a second signed-in device with the same notebook, kid, and lists, and not open", async () => {
    const { account, held } = await setUp();
    const token = await signIn(account);
    const res = await call("GET", "/account", { token });
    expect(res.body.notebook).toBe(held.notebook);
    expect(res.body.kid).toBe(1);
    expect(res.body.lists).toBe(1);
    expect(res.body.session.open).toBe(false);
    expect(res.body.session.device).toBeNull();
  });

  it("reports an approved device as open on its own device, and the lists moved", async () => {
    const { device } = await setUp();
    const second = await approve(device);
    const res = await must("GET", "/account", { token: second.token });
    expect(res.session.device).toBe(second.id);
    expect(res.session.open).toBe(true);
    expect(res.lists).toBe(2);
  });

  it("reports the kid after a change of key, and the changing session still open", async () => {
    const { device } = await setUp();
    await changeKey(device);
    const res = await must("GET", "/account", { token: device.token });
    expect(res.kid).toBe(2);
    expect(res.lists).toBe(2);
    expect(res.session.open).toBe(true);
  });

  it("lists a passkey with its credential and whether it syncs, and a preview way with neither", async () => {
    const { account, device, holders } = await setUp({ passkey: true });
    const unsynced = ref.toBase64url(ref.randomBytes(20));
    // Once the account has a notebook a new way in needs an open session, which this device has.
    await must("POST", "/preview/passkeys", { token: device.token, body: { credential: unsynced, syncs: false } });
    const res = await must("GET", "/account", { token: device.token });
    expect(res.ways.map((w) => w.kind)).toEqual(["preview", "passkey", "passkey"]);
    const [preview, synced, local] = res.ways;
    expect(Object.keys(preview).sort()).toEqual(["added", "id", "kind"]);
    expect(Object.keys(synced).sort()).toEqual(["added", "credential", "id", "kind", "syncs"]);
    expect(synced.credential).toBe(holders[0].credential);
    expect(synced.syncs).toBe(true);
    expect(local.credential).toBe(unsynced);
    expect(local.syncs).toBe(false);
    for (const way of res.ways) {
      expect(way.id).toMatch(UUID);
      expect(way.added).toMatch(TIME);
    }
    // The account's name (the preview's subject) is never sent back.
    expect(JSON.stringify(res)).not.toContain(account);
  });

  it("shows one account's ways and notebook to its own sessions only", async () => {
    const a = await setUp({ passkey: true });
    const b = await setUp();
    const res = await must("GET", "/account", { token: b.device.token });
    expect(res.notebook).toBe(b.held.notebook);
    expect(res.ways.map((w) => w.kind)).toEqual(["preview"]);
    expect(JSON.stringify(res)).not.toContain(a.held.notebook);
  });

  it("reports a session's expiry about thirty days on", async () => {
    const token = await signIn(freshAccount());
    const { session } = await must("GET", "/account", { token });
    const days = (Date.parse(session.expires) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });
});

/** An account with a notebook, one open device, and a signed-in session that has not proved. */
async function withClosedSession() {
  const made = await setUp();
  const token = await signIn(made.account);
  const good = { device: made.device.id, kid: 1, proof: await proofOf(made.held) };
  return { ...made, token, good };
}

describe("POST /session/proof: the checks, in order", () => {
  it("answers the open session's shape on a right proof, and attaches the session to the device", async () => {
    const { token, good, device } = await withClosedSession();
    const res = await proof(token, good);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["time", "open", "device", "kid"]);
    expect(res.body).toMatchObject({ open: true, device: device.id, kid: 1 });
    const account = await must("GET", "/account", { token });
    expect(account.session).toMatchObject({ open: true, device: device.id });
    expect((await call("GET", "/devices", { token })).status).toBe(200);
  });

  it("attaches the session to the device named, not to another", async () => {
    const { token, held, device, account } = await withClosedSession();
    const second = await approve(device);
    const res = await proof(token, { device: second.id, kid: 1, proof: await proofOf(held) });
    expect(res.status).toBe(200);
    expect((await must("GET", "/account", { token })).session.device).toBe(second.id);
    expect(account).toBeTruthy();
  });

  it("refuses with no_notebook when the account has none", async () => {
    const token = await signIn(freshAccount());
    const res = await proof(token, { device: crypto.randomUUID(), kid: 1, proof: random32() });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("no_notebook");
  });

  it("refuses with old_key, naming the current kid, when kid is not current", async () => {
    const { token, good } = await withClosedSession();
    const res = await proof(token, { ...good, kid: 2 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("old_key");
    expect(res.body.kid).toBe(1);
  });

  it("refuses an old kid after a real change of key", async () => {
    const { token, held, device, account } = await withClosedSession();
    await changeKey(device);
    const res = await proof(token, { device: device.id, kid: 1, proof: await proofOf(held, 1) });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("old_key");
    expect(res.body.kid).toBe(2);
    expect(account).toBeTruthy();
  });

  it("checks the kid before the proof: a wrong proof with an old kid is old_key and is not counted", async () => {
    const { token, good } = await withClosedSession();
    for (let i = 0; i < 8; i++) {
      const res = await proof(token, { ...good, kid: 2, proof: random32() });
      expect(res.body.error).toBe("old_key");
    }
    // Eight old_key answers have used none of the five tries.
    const wrong = await proof(token, { ...good, proof: random32() });
    expect(wrong.body.error).toBe("wrong_proof");
    expect(wrong.body.left).toBe(4);
  });

  it("refuses a wrong proof with wrong_proof and the tries left, counting down 4, 3, 2, 1", async () => {
    const { token, good } = await withClosedSession();
    for (const left of [4, 3, 2, 1]) {
      const res = await proof(token, { ...good, proof: random32() });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("wrong_proof");
      expect(res.body.left).toBe(left);
    }
  });

  it("ends the session on the fifth wrong proof, with sign_in and reason wrong_proofs", async () => {
    const { token, good } = await withClosedSession();
    for (let i = 0; i < 4; i++) await proof(token, { ...good, proof: random32() });
    const fifth = await proof(token, { ...good, proof: random32() });
    expect(fifth.status).toBe(401);
    expect(fifth.body.error).toBe("sign_in");
    expect(fifth.body.reason).toBe("wrong_proofs");
    // The session is gone, so even the right proof now gets nothing.
    const after = await proof(token, good);
    expect(after.status).toBe(401);
    expect(after.body.error).toBe("sign_in");
    expect(after.body.reason).toBeUndefined();
    expect((await call("GET", "/account", { token })).status).toBe(401);
  });

  it("does not open the session when it is ended, and leaves the account's other sessions", async () => {
    const { token, good, device } = await withClosedSession();
    for (let i = 0; i < 5; i++) await proof(token, { ...good, proof: random32() });
    expect((await call("GET", "/devices", { token: device.token })).status).toBe(200);
  });

  it("counts a proof that is one byte off as wrong, not as right", async () => {
    const { token, good, held } = await withClosedSession();
    const bytes = ref.fromBase64url(await proofOf(held));
    bytes[31] ^= 1;
    const res = await proof(token, { ...good, proof: b64(bytes) });
    expect(res.body.error).toBe("wrong_proof");
    expect(res.body.left).toBe(4);
  });

  it("resets the count on a right proof", async () => {
    const { token, good } = await withClosedSession();
    for (let i = 0; i < 3; i++) await proof(token, { ...good, proof: random32() });
    expect((await proof(token, good)).status).toBe(200);
    const next = await proof(token, { ...good, proof: random32() });
    expect(next.body.error).toBe("wrong_proof");
    expect(next.body.left).toBe(4);
  });

  it("keeps one session's wrong proofs from touching another session of the same account", async () => {
    const { account, token, good } = await withClosedSession();
    const other = await signIn(account);
    for (let i = 0; i < 4; i++) await proof(token, { ...good, proof: random32() });
    const mine = await proof(other, { ...good, proof: random32() });
    expect(mine.body.left).toBe(4);
    // And the first session is not ended by the other's tries: its fifth is still its own.
    const fifth = await proof(token, { ...good, proof: random32() });
    expect(fifth.body.error).toBe("sign_in");
    expect((await proof(other, good)).status).toBe(200);
  });

  it("does not let a stranger's wrong proofs end the reader's own session", async () => {
    const { device } = await withClosedSession();
    const stranger = await signIn(freshAccount());
    for (let i = 0; i < 6; i++) await proof(stranger, { device: device.id, kid: 1, proof: random32() });
    expect((await call("GET", "/devices", { token: device.token })).status).toBe(200);
  });

  it("refuses with gone, naming the device, when the id has no entry, after checking the proof", async () => {
    const { token, held } = await withClosedSession();
    const res = await proof(token, { device: crypto.randomUUID(), kid: 1, proof: await proofOf(held) });
    expect(res.status).toBe(410);
    expect(res.body.error).toBe("gone");
    expect(res.body.what).toBe("device");
    expect((await call("GET", "/devices", { token })).body.error).toBe("not_open");
  });

  it("checks the proof before the device: a wrong proof for an unknown device is wrong_proof and counted", async () => {
    const { token } = await withClosedSession();
    const res = await proof(token, { device: crypto.randomUUID(), kid: 1, proof: random32() });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("wrong_proof");
    expect(res.body.left).toBe(4);
  });

  it("does not take another account's device as an entry", async () => {
    const { token, held } = await withClosedSession();
    const stranger = await setUp();
    const res = await proof(token, { device: stranger.device.id, kid: 1, proof: await proofOf(held) });
    expect(res.status).toBe(410);
    expect(res.body.what).toBe("device");
  });
});

describe("POST /session/proof: malformed requests are bad_request, naming the field, and are not counted", () => {
  const spell = {
    "31 bytes": () => b64(ref.randomBytes(31)),
    "33 bytes": () => b64(ref.randomBytes(33)),
    "base64 with padding": () => Buffer.from(ref.randomBytes(32)).toString("base64"),
    "a plus sign": () => `+${random32().slice(1)}`,
    "a slash": () => `/${random32().slice(1)}`,
    "leftover bits": () => `${random32().slice(0, 42)}B`,
    "an empty string": () => "",
    "a number": () => 7,
  };
  for (const [name, make] of Object.entries(spell)) {
    it(`refuses a proof of ${name}`, async () => {
      const { token, good } = await withClosedSession();
      const res = await proof(token, { ...good, proof: make() });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("bad_request");
      expect(res.body.field).toBe("proof");
      const next = await proof(token, { ...good, proof: random32() });
      expect(next.body.left).toBe(4);
    });
  }

  it("refuses a missing proof", async () => {
    const { token, good } = await withClosedSession();
    const { proof: _, ...rest } = good;
    const res = await proof(token, rest);
    expect(res.body.field).toBe("proof");
  });

  const devices = {
    "uppercase": (id) => id.toUpperCase(),
    "without hyphens": (id) => id.replaceAll("-", ""),
    "too short": () => "1234",
    "a number": () => 12,
    "empty": () => "",
  };
  for (const [name, make] of Object.entries(devices)) {
    it(`refuses a device id that is ${name}`, async () => {
      const { token, good } = await withClosedSession();
      const res = await proof(token, { ...good, device: make(good.device) });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("bad_request");
      expect(res.body.field).toBe("device");
    });
  }

  it("refuses a missing device", async () => {
    const { token, good } = await withClosedSession();
    const { device: _, ...rest } = good;
    expect((await proof(token, rest)).body.field).toBe("device");
  });

  for (const [name, kid] of [["zero", 0], ["negative", -1], ["a fraction", 1.5], ["a string", "1"], ["null", null], ["missing", undefined]]) {
    it(`refuses a kid that is ${name}`, async () => {
      const { token, good } = await withClosedSession();
      const res = await proof(token, { ...good, kid });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("bad_request");
      expect(res.body.field).toBe("kid");
    });
  }

  // The table's first check comes before the body is read: there is nothing to prove on an
  // account with no notebook, whatever the request holds.
  it("checks the notebook before the body: a malformed request on an account with none is no_notebook", async () => {
    const token = await signIn(freshAccount());
    const res = await proof(token, { device: "x", kid: 1, proof: random32() });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("no_notebook");
  });
});

describe("the preview's way to a passkey does not give a session a proof", () => {
  it("leaves a session that listed a passkey not open", async () => {
    const { account, held } = await setUp();
    const token = await signIn(account);
    const res = await listPasskey({ token }, b64(ref.randomBytes(20)), true);
    expect(res.status).toBe(403);
    expect((await must("GET", "/account", { token })).session.open).toBe(false);
    expect(held).toBeTruthy();
  });
});
