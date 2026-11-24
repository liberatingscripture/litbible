// The test vectors' walkthrough, run against the service as real devices.
//
// test/fixtures/notebook-crypto-vectors.json ends with one notebook followed
// from its first device to a recovery, every value along the way. This file
// plays those eight steps against the service: each device sends exactly the
// sealed values the vectors give, reads back what the service kept, and opens
// it with the reference the website ships (src/lib/desk-crypto.mjs), making
// the checks a real device makes. The service never opens anything.
//
// It runs two ways, from the same steps:
//   - in workerd, under vitest (test/walkthrough.test.js);
//   - over HTTP against a running service, local or deployed
//     (scripts/walkthrough.mjs), which is how a deploy is verified.
//
// So it uses nothing but what it is handed: `call` (one request), `ref` (the
// reference), `vectors`, the preview's `secret`, and a test account's name.

/** Returns the steps in order: [{ name, run }]. They share state and must run in order. */
export function walkthroughSteps({ call, ref, vectors, secret, account }) {
  const steps = vectors.walkthrough.steps;
  const [s1, s2, s3, s4, s5, s6, s7] = steps;
  const { A, B, C, D } = vectors.walkthrough.devices;
  const bytes = ref.fromHex;
  /** A byte string as the vectors write it (hex), as the service carries it (base64url). */
  const wire = (hex) => ref.toBase64url(bytes(hex));
  const unwire = ref.fromBase64url;
  const state = { tokens: {}, held: {} };
  const out = [];
  const step = (name, run) => out.push({ name, run });

  const fail = (what, res) => {
    throw new Error(`${what}: ${res.status} ${JSON.stringify(res.body)}`);
  };
  const ok = (res, what) => (res.status === 200 ? res.body : fail(what, res));
  const refused = (res, status, error, what) => {
    if (res.status !== status || res.body?.error !== error) fail(`${what} (expected ${status} ${error})`, res);
    return res.body;
  };
  const same = (got, want, what) => {
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      throw new Error(`${what}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
    }
  };
  const signIn = async (who) => {
    state.tokens[who] = ok(await call("POST", "/preview/session", { body: { secret, account } }), `${who} signs in`).token;
    return state.tokens[who];
  };
  const as = (who) => ({ token: state.tokens[who] });
  const card = (sealed) => ({ nonce: wire(sealed.nonce), ct: wire(sealed.ciphertext) });
  const keyring = (sealed) => ({ enc: wire(sealed.enc), ct: wire(sealed.ciphertext) });
  const sealedBytes = (onWire) => ({ nonce: unwire(onWire.nonce), ct: unwire(onWire.ct) });
  const keyringBytes = (onWire) => ({ enc: unwire(onWire.enc), ct: unwire(onWire.ct) });
  const deviceKey = (given) => ({ d: bytes(given.key.d), public: bytes(given.key.public) });
  /** A vector's row (hex) as a device pushes it, against the revision it last saw. */
  const rowToPut = (row, rev) => ({ ...row, nonce: wire(row.nonce), ct: wire(row.ct), rev });
  const withoutRev = ({ rev, ...row }) => row;

  /** A device reads every row and opens each with its keyring, as it would after joining. */
  async function pullAndOpen(who) {
    const pulled = ok(await call("GET", "/rows?since=0", as(who)), `${who} pulls`);
    const records = [];
    for (const row of pulled.rows) records.push((await ref.openRow({ row, keyring: state.held[who] })).record);
    return { rows: pulled.rows, records };
  }

  /** A device that kept its entry through a change of key: fetch the new keyring, check it, prove. */
  async function catchUp(who, id, given, expectedKeyring, proofHex, kid) {
    refused(await call("GET", "/rows?since=0", as(who)), 403, "not_open", `${who} is no longer open`);
    const fetched = ok(await call("GET", `/keyring?device=${id}`, as(who)), `${who} fetches its keyring`);
    same(fetched.keyring, { kid, ...keyring(expectedKeyring) }, `${who}'s sealed keyring`);
    const incoming = await ref.openKeyring({ recipient: deviceKey(given), ...keyringBytes(fetched.keyring) });
    state.held[who] = ref.checkKeyring({ held: state.held[who], incoming });
    ok(await call("POST", "/session/proof", { ...as(who), body: { device: id, kid, proof: wire(proofHex) } }), `${who} proves kid ${kid}`);
  }

  /** The device that changed the key seals every row again and pushes each against its revision. */
  async function reseal(who, newRows, kid) {
    const old = ok(await call("GET", "/rows?old=1&since=0", as(who)), `${who} lists rows under an older key`);
    same(old.rows.length, newRows.length, "rows still under the older key");
    const revOf = new Map(old.rows.map((row) => [row.id, row.rev]));
    const pushed = ok(
      await call("POST", "/rows", { ...as(who), body: { put: newRows.map((row) => rowToPut(row, revOf.get(row.id))) } }),
      `${who} pushes the resealed rows`,
    );
    if (pushed.put.some((item) => !item.rev)) throw new Error(`a resealed row was not stored: ${JSON.stringify(pushed.put)}`);
    const left = ok(await call("GET", "/rows?old=1&since=0", as(who)), "rows under an older key, after");
    same(left.rows.length, 0, "rows left under an older key");
    same((await pullAndOpen(who)).rows.map((row) => row.kid), newRows.map(() => kid), "every row's kid");
  }

  step("1. The first device (A) sets up under “follows my account”", async () => {
    const { given, expected } = s1;
    await signIn("A");
    const before = ok(await call("GET", "/account", as("A")), "A reads the account");
    same([before.notebook, before.kid, before.session.open], [null, 0, false], "an account with no notebook");
    const credential = wire(given.passkey.credential);
    ok(await call("POST", "/preview/passkeys", { ...as("A"), body: { credential, syncs: true } }), "A's passkey is listed");

    state.holder = { id: given.holder.id, credential };
    const body = {
      notebook: given.notebook,
      proofHash: wire(expected.keyProofHash),
      device: { id: A, card: card(expected.card), keyring: keyring(expected.keyringForDevice) },
      holders: [
        {
          id: given.holder.id,
          kind: "passkey",
          credential,
          record: card(expected.holderRecord),
          card: card(expected.holderCard),
          keyring: keyring(expected.keyringForHolder),
        },
      ],
    };
    const made = ok(await call("POST", "/notebook", { ...as("A"), body }), "A sets up");
    same([made.kid, made.session.open, made.session.device], [1, true, A], "after setup");
    state.held.A = ref.parseKeyring(expected.keyringText);

    const after = ok(await call("GET", "/account", as("A")), "A reads the account again");
    same([after.notebook, after.kid, after.session.open, after.session.device], [given.notebook, 1, true, A], "the account");
    refused(await call("POST", "/notebook", { ...as("A"), body }), 409, "already_set_up", "a second setup");
  });

  step("2. A pushes its notebook, sealed under kid 1", async () => {
    const pushed = ok(
      await call("POST", "/rows", { ...as("A"), body: { put: s2.expected.rows.map((row) => rowToPut(row, 0)) } }),
      "A pushes",
    );
    same(pushed.put, s2.expected.rows.map((row, i) => ({ id: row.id, rev: i + 1 })), "each row's new revision");
    const { rows, records } = await pullAndOpen("A");
    same(rows.map(withoutRev), s2.expected.rows.map((row) => rowToPut(row)).map(withoutRev), "the rows as the service holds them");
    same(records.length, 3, "rows A opens");
  });

  step("3. A second device (B) joins by passkey", async () => {
    const { given, expected } = s3;
    await signIn("B");
    const account = ok(await call("GET", "/account", as("B")), "B reads the account");
    same([account.kid, account.session.open], [1, false], "B is signed in and not open");
    refused(await call("GET", "/rows?since=0", as("B")), 403, "not_open", "records before the key is proved");
    refused(await call("GET", "/devices", as("B")), 403, "not_open", "the device list before the key is proved");

    const { holders } = ok(await call("GET", "/holders", as("B")), "B fetches the holders");
    const from = given.fromService.holder;
    same(
      holders,
      [{ id: from.id, kind: "passkey", credential: wire(from.credential), record: card(from.record), keyring: { kid: 1, ...keyring(from.keyring) } }],
      "the holder as the service gives it",
    );
    // The four checks under "Holders," with the passkey's secret, which the service never sees.
    const opened = await ref.openHolder({
      secretKey: await ref.passkeyKey(bytes(given.passkey.prf)),
      kind: holders[0].kind,
      id: holders[0].id,
      notebook: account.notebook,
      credential: bytes(given.passkey.answered),
      sealed: sealedBytes(holders[0].record),
      keyring: keyringBytes(holders[0].keyring),
    });
    same(ref.keyringText(opened.keyring), s1.expected.keyringText, "the keyring B opens");
    state.held.B = opened.keyring;

    const joined = ok(
      await call("POST", "/devices", {
        ...as("B"),
        body: {
          kid: 1,
          proof: wire(expected.keyProof),
          holder: holders[0].id,
          device: { id: B, card: card(expected.card), keyring: keyring(expected.keyringForDevice) },
        },
      }),
      "B joins",
    );
    same([joined.session.open, joined.session.device], [true, B], "B's session");
    same((await pullAndOpen("B")).records, expected.records, "the records B opens");

    const lists = ok(await call("GET", "/devices", as("B")), "B reads the lists");
    same(lists.devices.map((d) => [d.id, d.how, d.by]), [[A, "setup", null], [B, "passkey", from.id]], "the device list");
    same(lists.holders.map((h) => [h.id, h.kind, h.by]), [[from.id, "passkey", A]], "the holder list");
  });

  step("4. A third device (C) is approved by B", async () => {
    const { given, expected } = s4;
    const { id, request, grant } = expected;
    await signIn("C");
    const asked = {
      id,
      device: request.deviceId,
      platform: request.platform,
      model: request.model,
      public: wire(request.public),
      sign: wire(request.sign),
      mac: wire(request.mac),
    };
    ok(await call("POST", "/approvals", { ...as("C"), body: asked }), "C asks to join");

    // B finds the request by its id and checks its MAC with the key made from the code.
    const macKey = bytes(expected.macKey);
    const seen = ok(await call("GET", `/approvals/${id}`, as("B")), "B reads the request").approval;
    same(seen.grant, null, "no grant yet");
    await ref.checkApprovalRequest({
      macKey,
      id,
      request: {
        deviceId: seen.device,
        platform: seen.platform,
        model: seen.model,
        public: unwire(seen.public),
        sign: unwire(seen.sign),
        mac: unwire(seen.mac),
      },
    });
    const granted = { kid: grant.kid, card: card(grant.card), keyring: keyring(grant), mac: wire(grant.mac) };
    ok(await call("POST", `/approvals/${id}/grant`, { ...as("B"), body: granted }), "B grants");

    // C checks the grant: its MAC, the keyring, its kid, and the card written for it.
    const got = ok(await call("GET", `/approvals/${id}`, as("C")), "C reads the grant").approval.grant;
    same(got, { ...granted, by: B }, "the grant as the service gives it");
    const accepted = await ref.acceptGrant({
      macKey,
      id,
      grant: { kid: got.kid, ...keyringBytes(got.keyring), card: sealedBytes(got.card), mac: unwire(got.mac) },
      device: { id: C, key: deviceKey(given.device), sign: bytes(given.device.sign.public) },
    });
    state.held.C = accepted.keyring;
    const joined = ok(
      await call("POST", `/approvals/${id}/accept`, { ...as("C"), body: { kid: grant.kid, proof: wire(expected.keyProof) } }),
      "C accepts",
    );
    same([joined.session.open, joined.session.device], [true, C], "C's session");
    refused(await call("GET", `/approvals/${id}`, as("C")), 410, "gone", "the approval, once accepted");

    const lists = ok(await call("GET", "/devices", as("C")), "C reads the lists");
    same(lists.devices.map((d) => [d.id, d.how, d.by]).at(-1), [C, "approval", B], "C's entry");
    // The card B wrote for C opens under the card key, for C's id.
    const mine = lists.devices.at(-1).card;
    const opened = await ref.openDeviceCard({
      notebookKey: ref.keyOf(state.held.C, 1),
      kid: mine.kid,
      notebook: state.held.C.notebook,
      deviceId: C,
      ...sealedBytes(mine),
    });
    same(opened.text, expected.card.plaintext, "C's card");
  });

  step("5. The first device (A) is removed, from C, and the key changes", async () => {
    const { given, expected } = s5;
    const before = ok(await call("GET", "/devices", as("C")), "C reads the lists");
    const change = {
      kid: 1,
      lists: before.lists,
      proofHash: wire(expected.keyProofHash),
      devices: [
        { id: B, card: card(expected.cardB), keyring: keyring(expected.keyringForB) },
        { id: C, card: card(expected.cardC), keyring: keyring(expected.keyringForC) },
      ],
      holders: [{ id: state.holder.id, card: card(expected.holderCard), keyring: keyring(expected.keyringForHolder) }],
      removeDevices: [given.removed],
    };
    const changed = ok(await call("POST", "/notebook/key", { ...as("C"), body: change }), "C changes the key");
    same([changed.kid, changed.lists], [2, before.lists + 1], "after the change");
    state.held.C = ref.parseKeyring(expected.keyringText);
    refused(await call("POST", "/notebook/key", { ...as("C"), body: change }), 409, "old_key", "the same change, sent again");

    // A lost its entry, its sealed keyring, and its sessions.
    refused(await call("GET", "/account", as("A")), 401, "sign_in", "A's old session");
    await signIn("A");
    refused(await call("GET", `/keyring?device=${A}`, as("A")), 404, "not_found", "a keyring for A");
    refused(
      await call("POST", "/session/proof", { ...as("A"), body: { device: A, kid: 1, proof: wire(s1.expected.keyProof) } }),
      409,
      "old_key",
      "A proving the old key",
    );

    // B kept its entry: it fetches the new keyring, checks it against the keys it holds, and proves.
    await catchUp("B", B, s3.given.device, expected.keyringForB, expected.keyProof, 2);
    same(ref.keyringText(state.held.B), expected.keyringText, "the keyring B accepts");

    // A row under the old key is refused from now on, and C seals every row again.
    const stale = rowToPut(s2.expected.rows[0], 1);
    refused(await call("POST", "/rows", { ...as("C"), body: { put: [stale] } }), 409, "old_key", "a row under the old key");
    await reseal("C", expected.rows, 2);

    // A still holds the old keyring, which opens nothing sealed from now on.
    const row = rowToPut(expected.onA.row);
    const refusal = await ref.openRow({ row, keyring: state.held.A }).then(() => null, (error) => error);
    same(refusal?.why, expected.onA.refused, "what A can do with a new row");
    same((await pullAndOpen("B")).records, s3.expected.records, "the records B opens under the new key");
  });

  step("6. The reader switches to “this device only,” from C", async () => {
    const { given, expected } = s6;
    const before = ok(await call("GET", "/devices", as("C")), "C reads the lists");
    const change = {
      kid: 2,
      lists: before.lists,
      proofHash: wire(expected.keyProofHash),
      devices: [
        { id: B, card: card(expected.cardB), keyring: keyring(expected.keyringForB) },
        { id: C, card: card(expected.cardC), keyring: keyring(expected.keyringForC) },
      ],
      holders: [],
      newHolders: [
        {
          id: given.holder.id,
          kind: "recovery",
          record: card(expected.holderRecord),
          card: card(expected.holderCard),
          keyring: keyring(expected.keyringForHolder),
        },
      ],
      removeHolders: [given.removedHolder],
    };
    const changed = ok(await call("POST", "/notebook/key", { ...as("C"), body: change }), "C changes the key");
    same(changed.kid, 3, "the new kid");
    state.held.C = ref.parseKeyring(expected.keyringText);

    const lists = ok(await call("GET", "/devices", as("C")), "C reads the lists");
    same(lists.holders.map((h) => [h.id, h.kind, h.by]), [[given.holder.id, "recovery", C]], "the holder list");
    await reseal("C", expected.rows, 3);
    await catchUp("B", B, s3.given.device, expected.keyringForB, expected.keyProof, 3);
  });

  step("7. Every device lost: a fourth (D) comes in with the recovery code", async () => {
    const { given, expected } = s7;
    await signIn("D");
    const account = ok(await call("GET", "/account", as("D")), "D reads the account");
    const { holders } = ok(await call("GET", "/holders", as("D")), "D fetches the holders");
    const from = given.fromService.holder;
    same(
      holders,
      [{ id: from.id, kind: "recovery", record: card(from.record), keyring: { kid: 3, ...keyring(from.keyring) } }],
      "the recovery holder as the service gives it",
    );
    const opened = await ref.openHolder({
      secretKey: await ref.codeKey(ref.readRecoveryCode(given.typed)),
      kind: "recovery",
      id: holders[0].id,
      notebook: account.notebook,
      sealed: sealedBytes(holders[0].record),
      keyring: keyringBytes(holders[0].keyring),
    });
    state.held.D = opened.keyring;
    same(opened.keyring.current, 3, "the keyring's current key");

    ok(
      await call("POST", "/devices", {
        ...as("D"),
        body: {
          kid: 3,
          proof: wire(expected.keyProof),
          holder: holders[0].id,
          device: { id: D, card: card(expected.card), keyring: keyring(expected.keyringForDevice) },
        },
      }),
      "D joins",
    );
    same((await pullAndOpen("D")).records, expected.records, "the records D opens");
    const lists = ok(await call("GET", "/devices", as("D")), "D reads the lists");
    same(lists.devices.map((d) => [d.id, d.how, d.by]).at(-1), [D, "recovery", from.id], "D's entry");
    same(lists.devices.length, 3, "devices listed at the end (B, C, and D)");
  });

  return out;
}
