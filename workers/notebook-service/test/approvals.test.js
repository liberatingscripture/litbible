// Approvals: POST /approvals, GET /approvals/<id>, and the grant and accept
// that follow ("The service's interface": "Approvals"). The service is a
// mailbox: it can check neither MAC, so every check here is of form, of who
// is asking, and of the key's number.
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { call, freshAccount } from "./call.js";
import { LIMITS } from "../src/check.js";
import {
  acceptRequest,
  approvalRequest,
  approve,
  changeKey,
  grantRequest,
  must,
  newDevice,
  note,
  proofOf,
  pull,
  push,
  ref,
  rowFor,
  setUp,
} from "./notebook.js";

const b64 = ref.toBase64url;
const bytes = (n) => b64(new Uint8Array(n));

const accountId = async (name) =>
  (await env.DB.prepare("SELECT account FROM ways WHERE kind = 'preview' AND subject = ?").bind(name).first()).account;
const expire = async (account, id) =>
  env.DB.prepare("UPDATE approvals SET expires = ? WHERE account = ? AND id = ?")
    .bind("2000-01-01T00:00:00.000Z", await accountId(account), id)
    .run();

const ask = (asking, body = asking.body) => call("POST", "/approvals", { token: asking.device.token, body });
const show = (token, id) => call("GET", `/approvals/${id}`, { token });
const grant = (token, id, body) => call("POST", `/approvals/${id}/grant`, { token, body });
const accept = (token, id, body) => call("POST", `/approvals/${id}/accept`, { token, body });

/** An approver, a new device that has asked, and the grant the approver would send. */
async function asked() {
  const { account, device: approver } = await setUp();
  const asking = await approvalRequest(account);
  await must("POST", "/approvals", { token: asking.device.token, body: asking.body });
  return { account, approver, asking };
}
/** The same, with the grant already made. */
async function granted() {
  const made = await asked();
  const body = await grantRequest(made.approver, made.asking);
  await must("POST", `/approvals/${made.asking.id}/grant`, { token: made.approver.token, body });
  return { ...made, grantBody: body };
}
const acceptBody = async (made) => ({ kid: 1, proof: await proofOf(made.approver.held) });

describe("POST /approvals", () => {
  it("accepts a request and answers its id and a time ten minutes on", async () => {
    const { account } = await setUp();
    const asking = await approvalRequest(account);
    const res = await ask(asking);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["time", "id", "expires"]);
    expect(res.body.id).toBe(asking.id);
    const span = Date.parse(res.body.expires) - Date.parse(res.body.time);
    expect(Math.abs(span - 10 * 60 * 1000)).toBeLessThan(5000);
  });

  it("refuses an open session with already_open", async () => {
    const { account, device } = await setUp();
    const asking = await approvalRequest(account);
    const res = await call("POST", "/approvals", { token: device.token, body: asking.body });
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: "not_allowed", rule: "already_open" });
  });

  it("refuses an account with no notebook with no_notebook", async () => {
    const asking = await approvalRequest(freshAccount());
    const res = await ask(asking);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("no_notebook");
  });

  it("refuses a request with no session", async () => {
    const { account } = await setUp();
    const asking = await approvalRequest(account);
    const res = await call("POST", "/approvals", { body: asking.body });
    expect(res.body.error).toBe("sign_in");
  });

  it.each([["31 characters", "a".repeat(31)], ["33 characters", "a".repeat(33)], ["uppercase", "A".repeat(32)], ["not hex", "g".repeat(32)], ["a number", 5]])(
    "refuses an id of %s",
    async (_, id) => {
      const { account } = await setUp();
      const asking = await approvalRequest(account);
      const res = await ask(asking, { ...asking.body, id });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: "bad_request", field: "id" });
    },
  );

  it("refuses an id already in use by an approval in progress", async () => {
    const { account } = await setUp();
    const first = await approvalRequest(account);
    const second = await approvalRequest(account);
    await must("POST", "/approvals", { token: first.device.token, body: first.body });
    const res = await ask(second, { ...second.body, id: first.id });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: "exists", what: "approval" });
  });

  it("refuses a device id that already has an entry", async () => {
    const { account, device } = await setUp();
    const asking = await approvalRequest(account);
    const res = await ask(asking, { ...asking.body, device: device.id });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: "exists", what: "device" });
  });

  it.each([["device", "not-a-uuid"], ["device", "ABCDEF01-0000-4000-8000-000000000000"], ["device", 5]])(
    "refuses a %s of %j",
    async (field, value) => {
      const { account } = await setUp();
      const asking = await approvalRequest(account);
      const res = await ask(asking, { ...asking.body, [field]: value });
      expect(res.body).toMatchObject({ error: "bad_request", field });
    },
  );

  it.each([["public"], ["sign"]])("refuses a %s that is not 65 bytes", async (field) => {
    const { account } = await setUp();
    const asking = await approvalRequest(account);
    for (const n of [64, 66]) {
      const res = await ask(asking, { ...asking.body, [field]: bytes(n) });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: "bad_request", field });
    }
  });

  it("refuses a mac that is not 32 bytes", async () => {
    const { account } = await setUp();
    const asking = await approvalRequest(account);
    for (const n of [31, 33]) {
      const res = await ask(asking, { ...asking.body, mac: bytes(n) });
      expect(res.body).toMatchObject({ error: "bad_request", field: "mac" });
    }
  });

  it.each([["empty", ""], ["too long", "x".repeat(LIMITS.platformChars + 1)], ["not text", 5]])(
    "refuses a platform that is %s",
    async (_, platform) => {
      const { account } = await setUp();
      const asking = await approvalRequest(account);
      const res = await ask(asking, { ...asking.body, platform });
      expect(res.body).toMatchObject({ error: "bad_request", field: "platform" });
    },
  );

  it("accepts a platform of the longest length", async () => {
    const { account } = await setUp();
    const asking = await approvalRequest(account);
    expect((await ask(asking, { ...asking.body, platform: "x".repeat(LIMITS.platformChars) })).status).toBe(200);
  });

  it.each([
    ["empty", ""],
    ["too long", "x".repeat(LIMITS.modelChars + 1)],
    ["holding a line feed", "Pixel\n8"],
    ["holding a tab", "Pixel\t8"],
    ["holding a NUL", "Pixel\u00008"],
    ["holding a DEL", "Pixel\u007f8"],
    ["holding a C1 control", "Pixel\u00858"],
    ["not text", null],
  ])("refuses a model that is %s", async (_, model) => {
    const { account } = await setUp();
    const asking = await approvalRequest(account);
    const res = await ask(asking, { ...asking.body, model });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "bad_request", field: "model" });
  });

  it("accepts a model with non-ASCII letters, and of the longest length", async () => {
    const { account } = await setUp();
    const a = await approvalRequest(account);
    expect((await ask(a, { ...a.body, model: "Teléfono de Zoë, 日本語" })).status).toBe(200);
    const b = await approvalRequest(account);
    expect((await ask(b, { ...b.body, model: "x".repeat(LIMITS.modelChars) })).status).toBe(200);
  });

  it("refuses a fourth approval in progress with too_many, and allows one again once one runs out", async () => {
    const { account } = await setUp();
    const made = [];
    for (let i = 0; i < LIMITS.approvals; i++) {
      const asking = await approvalRequest(account);
      expect((await ask(asking)).status).toBe(200);
      made.push(asking);
    }
    const fourth = await approvalRequest(account);
    const res = await ask(fourth);
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ error: "too_many", what: "approvals", limit: LIMITS.approvals });
    expect((await show(fourth.device.token, fourth.id)).body.error).toBe("gone");

    await expire(account, made[0].id);
    expect((await ask(fourth)).status).toBe(200);
  });

  it("limits each account on its own", async () => {
    const one = await setUp();
    for (let i = 0; i < LIMITS.approvals; i++) await ask(await approvalRequest(one.account));
    const two = await setUp();
    expect((await ask(await approvalRequest(two.account))).status).toBe(200);
  });
});

describe("kept for ten minutes", () => {
  it("answers gone to GET, grant, and accept once it has run out", async () => {
    const { account, approver, asking } = await granted();
    const body = await acceptBody({ approver });
    await expire(account, asking.id);

    for (const res of [
      await show(asking.device.token, asking.id),
      await show(approver.token, asking.id),
      await grant(approver.token, asking.id, { kid: 1, card: { nonce: bytes(12), ct: bytes(32) }, keyring: { enc: bytes(65), ct: bytes(32) }, mac: bytes(32) }),
      await accept(asking.device.token, asking.id, body),
    ]) {
      expect(res.status).toBe(410);
      expect(res.body).toMatchObject({ error: "gone", what: "approval" });
    }
  });

  it("lets an expired id be used again", async () => {
    const { account } = await setUp();
    const asking = await approvalRequest(account);
    await ask(asking);
    await expire(account, asking.id);
    const again = await approvalRequest(account);
    const res = await ask(again, { ...again.body, id: asking.id });
    expect(res.status).toBe(200);
    expect((await show(again.device.token, asking.id)).body.approval.device).toBe(again.device.id);
  });
});

describe("GET /approvals/<id>", () => {
  it("answers the request as posted, with grant null", async () => {
    const { account } = await setUp();
    const asking = await approvalRequest(account);
    const posted = await ask(asking);
    const res = await show(asking.device.token, asking.id);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["time", "approval"]);
    expect(Object.keys(res.body.approval)).toEqual(["id", "device", "platform", "model", "public", "sign", "mac", "expires", "grant"]);
    expect(res.body.approval).toEqual({
      id: asking.id,
      device: asking.body.device,
      platform: asking.body.platform,
      model: asking.body.model,
      public: asking.body.public,
      sign: asking.body.sign,
      mac: asking.body.mac,
      expires: posted.body.expires,
      grant: null,
    });
  });

  it("is readable by an open session of the account, as the approver reads it", async () => {
    const { approver, asking } = await asked();
    expect((await show(approver.token, asking.id)).body.approval.id).toBe(asking.id);
  });

  it("answers the grant once there is one", async () => {
    const { approver, asking, grantBody } = await granted();
    const { grant: g } = (await show(asking.device.token, asking.id)).body.approval;
    expect(Object.keys(g)).toEqual(["kid", "card", "keyring", "mac", "by"]);
    expect(g).toEqual({
      kid: grantBody.kid,
      card: { nonce: grantBody.card.nonce, ct: grantBody.card.ct },
      keyring: { enc: grantBody.keyring.enc, ct: grantBody.keyring.ct },
      mac: grantBody.mac,
      by: approver.id,
    });
  });

  it("answers gone to a session of another account", async () => {
    const { asking } = await asked();
    const stranger = await newDevice(freshAccount());
    const res = await show(stranger.token, asking.id);
    expect(res.status).toBe(410);
    expect(res.body).toMatchObject({ error: "gone", what: "approval" });
  });

  it("refuses a malformed id", async () => {
    const { approver } = await asked();
    const res = await show(approver.token, "XYZ");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "bad_request", field: "id" });
  });

  it("answers gone to an unknown id", async () => {
    const { approver } = await asked();
    const res = await show(approver.token, "0".repeat(32));
    expect(res.status).toBe(410);
    expect(res.body).toMatchObject({ error: "gone", what: "approval" });
  });

  it("refuses a request with no session", async () => {
    const { asking } = await asked();
    expect((await call("GET", `/approvals/${asking.id}`)).body.error).toBe("sign_in");
  });
});

describe("POST /approvals/<id>/grant", () => {
  it("stores a grant and answers the id", async () => {
    const { approver, asking } = await asked();
    const res = await grant(approver.token, asking.id, await grantRequest(approver, asking));
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["time", "id"]);
    expect(res.body.id).toBe(asking.id);
  });

  it("refuses a session that is not open", async () => {
    const { approver, asking } = await asked();
    const body = await grantRequest(approver, asking);
    const res = await grant(asking.device.token, asking.id, body);
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: "not_open", kid: 1 });
    expect((await show(approver.token, asking.id)).body.approval.grant).toBeNull();
  });

  it("answers gone for an approval that does not exist", async () => {
    const { approver, asking } = await asked();
    const body = await grantRequest(approver, asking);
    const res = await grant(approver.token, "f".repeat(32), body);
    expect(res.status).toBe(410);
    expect(res.body).toMatchObject({ error: "gone", what: "approval" });
  });

  it("answers gone for an approval that has run out", async () => {
    const { account, approver, asking } = await asked();
    const body = await grantRequest(approver, asking);
    await expire(account, asking.id);
    const res = await grant(approver.token, asking.id, body);
    expect(res.status).toBe(410);
    expect(res.body.error).toBe("gone");
  });

  it("answers gone for another account's approval", async () => {
    const { approver, asking } = await asked();
    const body = await grantRequest(approver, asking);
    const other = await setUp();
    const res = await grant(other.device.token, asking.id, body);
    expect(res.status).toBe(410);
    expect((await show(approver.token, asking.id)).body.approval.grant).toBeNull();
  });

  it("refuses a second grant with exists", async () => {
    const { approver, asking, grantBody } = await granted();
    const res = await grant(approver.token, asking.id, grantBody);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: "exists", what: "grant" });
  });

  it("lets exactly one of two grants at once through", async () => {
    const { account, approver, asking } = await asked();
    const second = await approve(approver);
    expect(second.account).toBe(account);
    const bodies = [await grantRequest(approver, asking), await grantRequest(second, asking)];
    const results = await Promise.all([grant(approver.token, asking.id, bodies[0]), grant(second.token, asking.id, bodies[1])]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(results.find((r) => r.status === 409).body).toMatchObject({ error: "exists", what: "grant" });
    const winner = results[0].status === 200 ? approver : second;
    expect((await show(approver.token, asking.id)).body.approval.grant.by).toBe(winner.id);
  });

  it("refuses a kid that is not current with old_key, and stores no grant", async () => {
    const { approver, asking } = await asked();
    const body = await grantRequest(approver, asking);
    const res = await grant(approver.token, asking.id, { ...body, kid: 2 });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: "old_key", kid: 1 });
    expect((await show(approver.token, asking.id)).body.approval.grant).toBeNull();
  });

  it.each([[0], [-1], [1.5], ["1"]])("refuses a kid of %j as malformed", async (kid) => {
    const { approver, asking } = await asked();
    const body = await grantRequest(approver, asking);
    const res = await grant(approver.token, asking.id, { ...body, kid });
    expect(res.body).toMatchObject({ error: "bad_request", field: "kid" });
  });

  it("refuses a card whose nonce is not 12 bytes", async () => {
    const { approver, asking } = await asked();
    const body = await grantRequest(approver, asking);
    const res = await grant(approver.token, asking.id, { ...body, card: { ...body.card, nonce: bytes(11) } });
    expect(res.body).toMatchObject({ error: "bad_request", field: "card.nonce" });
  });

  it("refuses a card whose ct is shorter than a tag, or over the card's limit", async () => {
    const { approver, asking } = await asked();
    const body = await grantRequest(approver, asking);
    for (const n of [LIMITS.tagBytes, LIMITS.cardBytes + 1]) {
      const res = await grant(approver.token, asking.id, { ...body, card: { ...body.card, ct: bytes(n) } });
      expect(res.body).toMatchObject({ error: "bad_request", field: "card.ct" });
    }
  });

  it("refuses a keyring whose enc is not 65 bytes", async () => {
    const { approver, asking } = await asked();
    const body = await grantRequest(approver, asking);
    const res = await grant(approver.token, asking.id, { ...body, keyring: { ...body.keyring, enc: bytes(64) } });
    expect(res.body).toMatchObject({ error: "bad_request", field: "keyring.enc" });
  });

  it("refuses a keyring whose ct is shorter than a tag, or over the keyring's limit", async () => {
    const { approver, asking } = await asked();
    const body = await grantRequest(approver, asking);
    for (const n of [LIMITS.tagBytes, LIMITS.keyringBytes + 1]) {
      const res = await grant(approver.token, asking.id, { ...body, keyring: { ...body.keyring, ct: bytes(n) } });
      expect(res.body).toMatchObject({ error: "bad_request", field: "keyring.ct" });
    }
  });

  it.each([[31], [33]])("refuses a mac of %i bytes", async (n) => {
    const { approver, asking } = await asked();
    const body = await grantRequest(approver, asking);
    const res = await grant(approver.token, asking.id, { ...body, mac: bytes(n) });
    expect(res.body).toMatchObject({ error: "bad_request", field: "mac" });
  });

  it("refuses a missing card, keyring, or mac", async () => {
    const { approver, asking } = await asked();
    const body = await grantRequest(approver, asking);
    for (const field of ["card", "keyring", "mac"]) {
      const res = await grant(approver.token, asking.id, { ...body, [field]: undefined });
      expect(res.body).toMatchObject({ error: "bad_request", field });
    }
  });
});

describe("POST /approvals/<id>/accept", () => {
  it("refuses another open device of the account with requester", async () => {
    const made = await granted();
    const res = await accept(made.approver.token, made.asking.id, await acceptBody(made));
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: "not_allowed", rule: "requester" });
    expect((await must("GET", "/devices", { token: made.approver.token })).devices).toHaveLength(1);
  });

  it("refuses another signed-in session of the account with requester", async () => {
    const made = await granted();
    const other = await newDevice(made.account);
    const res = await accept(other.token, made.asking.id, await acceptBody(made));
    expect(res.body).toMatchObject({ error: "not_allowed", rule: "requester" });
  });

  it("refuses an accept before a grant with no_grant", async () => {
    const made = await asked();
    const res = await accept(made.asking.device.token, made.asking.id, await acceptBody(made));
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: "not_allowed", rule: "no_grant" });
  });

  it("refuses a kid that is not current with old_key", async () => {
    const made = await granted();
    const res = await accept(made.asking.device.token, made.asking.id, { ...(await acceptBody(made)), kid: 2 });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: "old_key", kid: 1 });
  });

  it("refuses a wrong proof with wrong_proof, and the device is not listed", async () => {
    const made = await granted();
    const res = await accept(made.asking.device.token, made.asking.id, { kid: 1, proof: bytes(32) });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: "wrong_proof", left: 4 });
    const list = await must("GET", "/devices", { token: made.approver.token });
    expect(list.devices.map((d) => d.id)).toEqual([made.approver.id]);
    // The approval stands, so a right proof still works.
    expect((await accept(made.asking.device.token, made.asking.id, await acceptBody(made))).status).toBe(200);
  });

  it("refuses a proof that is not 32 bytes", async () => {
    const made = await granted();
    const res = await accept(made.asking.device.token, made.asking.id, { kid: 1, proof: bytes(31) });
    expect(res.body).toMatchObject({ error: "bad_request", field: "proof" });
  });

  it("refuses when the device id gained an entry meanwhile, with exists", async () => {
    const made = await granted();
    const account = await accountId(made.account);
    await env.DB.prepare(
      `INSERT INTO devices (account, id, card_kid, card_nonce, card_ct, keyring_kid, keyring_enc, keyring_ct, added, added_how, seen)
       VALUES (?, ?, 1, 'n', 'c', 1, 'e', 'k', ?, 'setup', ?)`,
    )
      .bind(account, made.asking.device.id, "2026-11-23T00:00:00.000Z", "2026-11-23T00:00:00.000Z")
      .run();
    const res = await accept(made.asking.device.token, made.asking.id, await acceptBody(made));
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: "exists", what: "device" });
  });

  it("answers gone for an approval that does not exist", async () => {
    const made = await granted();
    const res = await accept(made.asking.device.token, "e".repeat(32), await acceptBody(made));
    expect(res.status).toBe(410);
  });

  it("lists the device with the grant's card and keyring, opens the session, and deletes the approval", async () => {
    const made = await granted();
    const before = await must("GET", "/devices", { token: made.approver.token });
    const body = await acceptRequest(made.asking);
    const res = await accept(made.asking.device.token, made.asking.id, body);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["time", "kid", "lists", "session"]);
    expect(res.body).toMatchObject({ kid: 1, lists: before.lists + 1, session: { open: true, device: made.asking.device.id } });

    const after = await must("GET", "/devices", { token: made.approver.token });
    expect(after.lists).toBe(before.lists + 1);
    const entry = after.devices.find((d) => d.id === made.asking.device.id);
    expect(entry).toMatchObject({ how: "approval", by: made.approver.id });
    expect(entry.card).toEqual({ kid: 1, nonce: made.grantBody.card.nonce, ct: made.grantBody.card.ct });
    const { keyring } = await must("GET", `/keyring?device=${made.asking.device.id}`, { token: made.asking.device.token });
    expect(keyring).toEqual({ kid: 1, enc: made.grantBody.keyring.enc, ct: made.grantBody.keyring.ct });

    const account = await must("GET", "/account", { token: made.asking.device.token });
    expect(account.session).toMatchObject({ open: true, device: made.asking.device.id });

    const gone = await show(made.asking.device.token, made.asking.id);
    expect(gone.status).toBe(410);
    const twice = await accept(made.asking.device.token, made.asking.id, body);
    expect(twice.status).toBe(410);
    expect(twice.body.error).toBe("gone");
  });
});

describe("a change of key", () => {
  it("drops approvals in progress, so GET, grant, and accept all answer gone", async () => {
    const { account, approver, asking } = await granted();
    const waiting = await approvalRequest(account);
    await must("POST", "/approvals", { token: waiting.device.token, body: waiting.body });
    const ungranted = await grantRequest(approver, waiting);

    await changeKey(approver);

    for (const id of [asking.id, waiting.id]) {
      const read = await show(approver.token, id);
      expect(read.status).toBe(410);
      expect(read.body.error).toBe("gone");
    }
    const g = await grant(approver.token, waiting.id, { ...ungranted, kid: 2 });
    expect(g.status).toBe(410);
    const a = await accept(asking.device.token, asking.id, { kid: 2, proof: await proofOf(approver.held) });
    expect(a.status).toBe(410);
    expect(a.body).toMatchObject({ error: "gone", what: "approval" });
  });
});

describe("the whole flow with the reference", () => {
  it("lets the new device open rows the approver pushed", async () => {
    const { device } = await setUp();
    const records = [note({ body: "before" }), note({ body: "second" })];
    await push(device, await Promise.all(records.map((r) => rowFor(device.held, r))));
    const added = await approve(device);
    expect((await pull(added)).records).toEqual(records);
    // And the other way round.
    const mine = note({ body: "from the new device" });
    await push(added, [await rowFor(added.held, mine)]);
    expect((await pull(device)).records).toEqual([...records, mine]);
  });
});
