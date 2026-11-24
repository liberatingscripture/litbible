// "Setting up": POST /notebook, every check in its row.
import { describe, expect, it } from "vitest";
import { LIMITS } from "../src/check.js";
import { call, freshAccount } from "./call.js";
import { listPasskey, makeHolder, must, newDevice, ref, setUp, setupRequest, signIn } from "./notebook.js";

const b64 = ref.toBase64url;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const bytesOf = (n) => b64(new Uint8Array(n).fill(7));

const post = (made, body = made.body) => call("POST", "/notebook", { token: made.device.token, body });

/** Reads a path into a body: ["holders", 0, "card", "ct"]. */
const get = (body, path) => path.reduce((o, k) => o?.[k], body);
const set = (body, path, value) => {
  const parent = get(body, path.slice(0, -1));
  if (value === undefined) delete parent[path.at(-1)];
  else parent[path.at(-1)] = value;
};
const nameOf = (path) => path.map((k, i) => (typeof k === "number" ? `[${k}]` : i ? `.${k}` : k)).join("");

/** Nothing of a refused request is stored: no notebook, no holder, no device entry. */
async function expectNothingStored(made, ids = [made.device.id]) {
  const account = await must("GET", "/account", { token: made.device.token });
  expect(account.notebook).toBeNull();
  expect(account.kid).toBe(0);
  expect(account.lists).toBe(0);
  expect(account.session.open).toBe(false);
  expect((await must("GET", "/holders", { token: made.device.token })).holders).toEqual([]);
  for (const id of ids) {
    const res = await call("GET", `/keyring?device=${id}`, { token: made.device.token });
    expect(res.status).toBe(404);
  }
}

/**
 * Builds a request that would be accepted, lets `mutate` change one thing, and
 * expects the refusal. Then checks nothing was stored and that the unchanged
 * request is accepted, which shows the one change was the whole reason.
 */
async function refuses(mutate, expected, options) {
  const made = await setupRequest(options);
  const body = structuredClone(made.body);
  await mutate(body, made);
  const res = await post(made, body);
  const { status, ...members } = expected;
  expect(res.status).toBe(status);
  for (const [key, value] of Object.entries(members)) expect(res.body[key], key).toEqual(value);
  await expectNothingStored(made, [made.device.id]);
  const control = await post(made);
  expect(control.status, JSON.stringify(control.body)).toBe(200);
}

const bad = (field) => ({ status: 400, error: "bad_request", field });
const notAllowed = (rule) => ({ status: 422, error: "not_allowed", rule });

describe("POST /notebook: the accepted request", () => {
  it("answers with the notebook, kid 1, lists 1, and the session open on the device", async () => {
    const made = await setupRequest();
    const res = await post(made);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["time", "notebook", "kid", "lists", "session"]);
    expect(res.body.notebook).toBe(made.held.notebook);
    expect(res.body.kid).toBe(1);
    expect(res.body.lists).toBe(1);
    expect(res.body.session).toEqual({ open: true, device: made.device.id });
  });

  it("opens the session and attaches it to the device", async () => {
    const made = await setupRequest();
    await post(made);
    const account = await must("GET", "/account", { token: made.device.token });
    expect(account).toMatchObject({ notebook: made.held.notebook, kid: 1, lists: 1 });
    expect(account.session).toMatchObject({ open: true, device: made.device.id });
    expect((await call("GET", "/devices", { token: made.device.token })).status).toBe(200);
  });

  it("lists the device as added by setup, with its card as sent, and the holders with it", async () => {
    const made = await setupRequest({ passkey: true, recovery: true });
    await post(made);
    const lists = await must("GET", "/devices", { token: made.device.token });
    expect(lists.kid).toBe(1);
    expect(lists.lists).toBe(1);
    expect(lists.devices).toEqual([
      {
        id: made.device.id,
        card: { kid: 1, ...made.body.device.card },
        added: expect.stringMatching(TIME),
        how: "setup",
        by: null,
        seen: expect.stringMatching(TIME),
      },
    ]);
    expect(lists.holders.map((h) => h.id).sort()).toEqual(made.body.holders.map((h) => h.id).sort());
    for (const sent of made.body.holders) {
      const stored = lists.holders.find((h) => h.id === sent.id);
      expect(stored).toMatchObject({ kind: sent.kind, card: { kid: 1, ...sent.card }, by: made.device.id });
      expect(stored.credential).toBe(sent.credential);
    }
  });

  it("keeps each sealed keyring and holder record as it arrived", async () => {
    const made = await setupRequest({ passkey: true, recovery: true });
    await post(made);
    const keyring = await must("GET", `/keyring?device=${made.device.id}`, { token: made.device.token });
    expect(keyring.keyring).toEqual({ kid: 1, ...made.body.device.keyring });
    const { holders } = await must("GET", "/holders", { token: made.device.token });
    for (const sent of made.body.holders) {
      expect(holders.find((h) => h.id === sent.id)).toMatchObject({
        kind: sent.kind,
        record: sent.record,
        keyring: { kid: 1, ...sent.keyring },
      });
    }
  });

  it("accepts a passkey holder alone, a recovery holder alone, and both", async () => {
    for (const options of [{ passkey: true, recovery: false }, { passkey: false, recovery: true }, { passkey: true, recovery: true }]) {
      const made = await setupRequest(options);
      expect((await post(made)).status).toBe(200);
    }
  });

  it("lets only the key's proof open a later session", async () => {
    const { account, device } = await setUp();
    const token = await signIn(account);
    expect((await call("GET", "/devices", { token })).status).toBe(403);
    expect(device).toBeTruthy();
  });
});

describe("POST /notebook: the account has no notebook", () => {
  it("refuses a second setup with already_set_up and stores nothing of it", async () => {
    const first = await setUp({ passkey: true, recovery: true });
    const second = await setupRequest({ account: first.account });
    const res = await post(second);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("already_set_up");
    expect(res.body.notebook).toBe(first.held.notebook);

    const account = await must("GET", "/account", { token: first.device.token });
    expect(account).toMatchObject({ notebook: first.held.notebook, kid: 1, lists: 1 });
    const lists = await must("GET", "/devices", { token: first.device.token });
    expect(lists.devices.map((d) => d.id)).toEqual([first.device.id]);
    expect(lists.holders.map((h) => h.id).sort()).toEqual(first.holders.map((h) => h.id).sort());
    const holders = await must("GET", "/holders", { token: first.device.token });
    for (const h of second.body.holders) expect(holders.holders.some((s) => s.id === h.id)).toBe(false);
    expect((await call("GET", `/keyring?device=${second.device.id}`, { token: first.device.token })).status).toBe(404);
    // The second device's session was not opened, and the first one still is.
    expect((await must("GET", "/account", { token: second.device.token })).session.open).toBe(false);
    expect((await call("GET", "/devices", { token: first.device.token })).status).toBe(200);
  });

  it("refuses the same request sent twice", async () => {
    const made = await setupRequest();
    expect((await post(made)).status).toBe(200);
    const again = await post(made);
    expect(again.status).toBe(409);
    expect(again.body.error).toBe("already_set_up");
    expect((await must("GET", "/account", { token: made.device.token })).lists).toBe(1);
  });

  it("lets only one of two setups at once win", async () => {
    const account = freshAccount();
    const a = await setupRequest({ account });
    const b = await setupRequest({ account });
    const [ra, rb] = await Promise.all([post(a), post(b)]);
    expect([ra.status, rb.status].sort()).toEqual([200, 409]);
    const loser = ra.status === 409 ? ra : rb;
    expect(loser.body.error).toBe("already_set_up");
    const lists = await must("GET", "/account", { token: a.device.token });
    expect(lists.lists).toBe(1);
  });

  it("does not take another account's notebook as this one's", async () => {
    await setUp();
    const made = await setupRequest();
    expect((await post(made)).status).toBe(200);
  });
});

describe("POST /notebook: at least one holder, at most one recovery", () => {
  it("refuses an empty list of holders with holder_needed", async () => {
    await refuses((body) => (body.holders = []), notAllowed("holder_needed"));
  });

  it("refuses a request with no holders member", async () => {
    await refuses((body) => delete body.holders, bad("holders"));
  });

  it("refuses holders that is not a list", async () => {
    await refuses((body) => (body.holders = body.holders[0]), bad("holders"));
  });

  it("refuses two recovery holders with one_recovery", async () => {
    await refuses(async (body, made) => body.holders.push((await makeHolder(made.held, "recovery")).wire), notAllowed("one_recovery"));
  });

  it("refuses a holder whose kind is neither", async () => {
    await refuses((body) => (body.holders[0].kind = "password"), bad("holders[0].kind"));
  });

  it("refuses a holder with no kind", async () => {
    await refuses((body) => delete body.holders[0].kind, bad("holders[0].kind"));
  });

  it("refuses a kind spelled with a capital", async () => {
    await refuses((body) => (body.holders[0].kind = "Recovery"), bad("holders[0].kind"));
  });

  it("refuses a recovery holder that carries a credential", async () => {
    await refuses((body) => (body.holders[0].credential = b64(ref.randomBytes(20))), bad("holders[0].credential"));
  });

  it("refuses more holders than the limit with too_many", async () => {
    await refuses(
      (body) => {
        body.holders = Array.from({ length: LIMITS.holders + 1 }, () => ({ ...structuredClone(body.holders[0]), id: crypto.randomUUID() }));
      },
      { status: 429, error: "too_many", what: "holders", limit: LIMITS.holders },
    );
  });

  it("accepts exactly the limit of holders", async () => {
    const made = await setupRequest({ recovery: true });
    for (let i = 0; i < LIMITS.holders - 1; i++) {
      const holder = await makeHolder(made.held, "passkey");
      await listPasskey(made.device, holder.credential);
      made.body.holders.push(holder.wire);
    }
    expect(made.body.holders.length).toBe(LIMITS.holders);
    const res = await post(made);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect((await must("GET", "/holders", { token: made.device.token })).holders.length).toBe(LIMITS.holders);
  });
});

describe("POST /notebook: a passkey holder's credential", () => {
  it("refuses a credential that is not one of the account's passkeys with passkey_unknown", async () => {
    await refuses((body) => (body.holders[0].credential = b64(ref.randomBytes(20))), notAllowed("passkey_unknown"), {
      passkey: true,
      recovery: false,
    });
  });

  it("refuses a passkey listed with syncs false with passkey_not_synced", async () => {
    await refuses(
      async (body, made) => {
        const holder = await makeHolder(made.held, "passkey");
        await listPasskey(made.device, holder.credential, false);
        body.holders.push(holder.wire);
      },
      notAllowed("passkey_not_synced"),
    );
  });

  it("refuses a credential that belongs to another account with passkey_unknown", async () => {
    await refuses(
      async (body, made) => {
        const holder = await makeHolder(made.held, "passkey");
        const elsewhere = await newDevice(freshAccount());
        await listPasskey(elsewhere, holder.credential, true);
        body.holders.push(holder.wire);
      },
      notAllowed("passkey_unknown"),
    );
  });

  it("refuses two holders for one credential with one_holder_per_passkey", async () => {
    await refuses(
      async (body, made) => {
        const one = await makeHolder(made.held, "passkey");
        const two = await makeHolder(made.held, "passkey");
        await listPasskey(made.device, one.credential, true);
        two.wire.credential = one.credential;
        body.holders.push(one.wire, two.wire);
      },
      notAllowed("one_holder_per_passkey"),
    );
  });

  it("refuses a passkey holder with no credential", async () => {
    await refuses((body) => delete body.holders[0].credential, bad("holders[0].credential"), { passkey: true, recovery: false });
  });

  it("refuses an empty credential and one over the limit", async () => {
    for (const credential of ["", bytesOf(LIMITS.credentialBytes + 1)]) {
      await refuses((body) => (body.holders[0].credential = credential), bad("holders[0].credential"), { passkey: true, recovery: false });
    }
  });

  it("accepts a credential of exactly the limit, when the account lists it as syncing", async () => {
    const made = await setupRequest({ recovery: true });
    const credential = bytesOf(LIMITS.credentialBytes);
    await listPasskey(made.device, credential, true);
    const holder = await makeHolder(made.held, "passkey");
    holder.wire.credential = credential;
    made.body.holders.push(holder.wire);
    expect((await post(made)).status).toBe(200);
  });

  it("accepts a one-byte credential", async () => {
    const made = await setupRequest({ recovery: true });
    const credential = b64(new Uint8Array([9]));
    await listPasskey(made.device, credential, true);
    const holder = await makeHolder(made.held, "passkey");
    holder.wire.credential = credential;
    made.body.holders.push(holder.wire);
    expect((await post(made)).status).toBe(200);
  });

  for (const [name, spell] of [
    ["padding", (s) => `${s}=`],
    ["a plus sign", (s) => `+${s.slice(1)}`],
    ["a slash", (s) => `/${s.slice(1)}`],
    ["leftover bits", (s) => `${s.slice(0, -1)}B`],
  ]) {
    it(`refuses a credential spelled with ${name}`, async () => {
      await refuses((body) => (body.holders[0].credential = spell(body.holders[0].credential)), bad("holders[0].credential"), {
        passkey: true,
        recovery: false,
      });
    });
  }
});

describe("POST /notebook: every id is a UUID", () => {
  const IDS = [
    ["notebook", ["notebook"], null],
    ["the device's id", ["device", "id"], null],
    ["a holder's id", ["holders", 0, "id"], null],
  ];
  const WRONG = {
    "uppercase": (id) => id.toUpperCase(),
    "without hyphens": (id) => id.replaceAll("-", ""),
    "too short": () => "1234",
    "a number": () => 12,
    "empty": () => "",
    "missing": () => undefined,
  };
  for (const [label, path] of IDS) {
    for (const [name, make] of Object.entries(WRONG)) {
      it(`refuses ${label} that is ${name}`, async () => {
        await refuses((body) => set(body, path, make(get(body, path))), bad(nameOf(path)));
      });
    }
  }

  it("accepts ids a client made with the reference's newId()", async () => {
    const made = await setupRequest();
    for (const id of [made.body.notebook, made.body.device.id, made.body.holders[0].id]) expect(id).toMatch(UUID);
    expect((await post(made)).status).toBe(200);
  });
});

describe("POST /notebook: no two ids are the same", () => {
  it("refuses the notebook's id used as the device's", async () => {
    await refuses((body) => (body.device.id = body.notebook), notAllowed("distinct_ids"));
  });

  it("refuses the notebook's id used as a holder's", async () => {
    await refuses((body) => (body.holders[0].id = body.notebook), notAllowed("distinct_ids"));
  });

  it("refuses the device's id used as a holder's", async () => {
    await refuses((body) => (body.holders[0].id = body.device.id), notAllowed("distinct_ids"));
  });

  it("refuses two holders with one id", async () => {
    await refuses((body) => (body.holders[1].id = body.holders[0].id), notAllowed("distinct_ids"), { passkey: true, recovery: true });
  });
});

/** The sealed parts of a setup request, and what each one's members must be. */
const PARTS = [
  { path: ["device", "card"], keyring: false, limit: LIMITS.cardBytes },
  { path: ["device", "keyring"], keyring: true, limit: LIMITS.keyringBytes },
  { path: ["holders", 0, "record"], keyring: false, limit: LIMITS.holderRecordBytes },
  { path: ["holders", 0, "card"], keyring: false, limit: LIMITS.cardBytes },
  { path: ["holders", 0, "keyring"], keyring: true, limit: LIMITS.keyringBytes },
];

/** What the service answers to read back a part, for the tests that accept a part at its limit. */
async function stored(made, part) {
  const token = made.device.token;
  const [where] = part.path;
  const last = part.path.at(-1);
  if (where === "device" && last === "keyring") return (await must("GET", `/keyring?device=${made.device.id}`, { token })).keyring;
  if (where === "device") return (await must("GET", "/devices", { token })).devices[0].card;
  const id = made.body.holders[0].id;
  if (last === "card") return (await must("GET", "/devices", { token })).holders.find((h) => h.id === id).card;
  return (await must("GET", "/holders", { token })).holders.find((h) => h.id === id)[last];
}

describe("POST /notebook: sizes", () => {
  for (const part of PARTS) {
    const label = nameOf(part.path);
    const first = part.keyring ? "enc" : "nonce";
    const firstBytes = part.keyring ? LIMITS.pointBytes : LIMITS.nonceBytes;
    const wrongFirst = part.keyring ? [LIMITS.pointBytes - 1, LIMITS.pointBytes + 1] : [LIMITS.nonceBytes - 1, LIMITS.nonceBytes + 1];

    describe(label, () => {
      for (const n of wrongFirst) {
        it(`refuses ${first} of ${n} bytes, not ${firstBytes}`, async () => {
          await refuses((body) => set(body, [...part.path, first], bytesOf(n)), bad(`${label}.${first}`));
        });
      }

      it(`refuses ${first} of no bytes`, async () => {
        await refuses((body) => set(body, [...part.path, first], ""), bad(`${label}.${first}`));
      });

      it(`refuses a ct of one byte over its limit of ${part.limit}`, async () => {
        await refuses((body) => set(body, [...part.path, "ct"], bytesOf(part.limit + 1)), bad(`${label}.ct`));
      });

      it("refuses a ct far over its limit", async () => {
        await refuses((body) => set(body, [...part.path, "ct"], bytesOf(part.limit * 2)), bad(`${label}.ct`));
      });

      it(`refuses a ct of ${LIMITS.tagBytes} bytes, which is a tag and no message`, async () => {
        await refuses((body) => set(body, [...part.path, "ct"], bytesOf(LIMITS.tagBytes)), bad(`${label}.ct`));
      });

      it("refuses an empty ct", async () => {
        await refuses((body) => set(body, [...part.path, "ct"], ""), bad(`${label}.ct`));
      });

      it(`accepts a ct of exactly ${part.limit} bytes, and stores it as sent`, async () => {
        const made = await setupRequest();
        const ct = bytesOf(part.limit);
        set(made.body, [...part.path, "ct"], ct);
        const res = await post(made);
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expect((await stored(made, part)).ct).toBe(ct);
      });

      it(`accepts a ct of ${LIMITS.tagBytes + 1} bytes, the least there can be`, async () => {
        const made = await setupRequest();
        set(made.body, [...part.path, "ct"], bytesOf(LIMITS.tagBytes + 1));
        expect((await post(made)).status).toBe(200);
      });

      const members = [
        [first, firstBytes, true],
        ["ct", 20, false],
      ];
      for (const [member, validBytes, noLeftover] of members) {
        const field = `${label}.${member}`;
        const spells = [
          ["is missing", () => undefined],
          ["is a number", () => 5],
          ["is spelled with padding", (s) => `${s}=`],
          ["is spelled with a plus sign", (s) => `+${s.slice(1)}`],
          ["is spelled with a slash", (s) => `/${s.slice(1)}`],
          ...(noLeftover ? [] : [["has leftover bits in its last character", (s) => `${s.slice(0, -1)}B`]]),
        ];
        for (const [name, spell] of spells) {
          it(`refuses ${member} that ${name}`, async () => {
            await refuses((body) => set(body, [...part.path, member], spell(bytesOf(validBytes))), bad(field));
          });
        }
      }

      it("refuses a part that is missing, and one that is not an object", async () => {
        await refuses((body) => set(body, part.path, undefined), bad(label));
        await refuses((body) => set(body, part.path, "sealed"), bad(label));
      });
    });
  }

  describe("proofHash", () => {
    for (const n of [LIMITS.proofBytes - 1, LIMITS.proofBytes + 1, 0]) {
      it(`refuses a hash of ${n} bytes, not ${LIMITS.proofBytes}`, async () => {
        await refuses((body) => (body.proofHash = bytesOf(n)), bad("proofHash"));
      });
    }
    for (const [name, spell] of [
      ["is missing", () => undefined],
      ["is a number", () => 5],
      ["is spelled with padding", (s) => `${s}=`],
      ["is spelled with a plus sign", (s) => `+${s.slice(1)}`],
      ["is spelled with a slash", (s) => `/${s.slice(1)}`],
      ["has leftover bits", (s) => `${s.slice(0, -1)}B`],
    ]) {
      it(`refuses a hash that ${name}`, async () => {
        await refuses((body) => (body.proofHash = spell(bytesOf(LIMITS.proofBytes))), bad("proofHash"));
      });
    }
  });

  it("refuses a request with no device, and one whose device is not an object", async () => {
    await refuses((body) => delete body.device, bad("device"));
    await refuses((body) => (body.device = "phone"), bad("device"));
  });

  it("ignores members it does not know", async () => {
    const made = await setupRequest();
    made.body.extra = { anything: 1 };
    made.body.device.name = "My laptop";
    made.body.holders[0].label = "mine";
    expect((await post(made)).status).toBe(200);
  });
});
