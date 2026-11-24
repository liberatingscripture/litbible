// A reader's devices, for the tests: everything a real client does on its
// side of the interface, with real keys and real sealed material made by the
// reference the website ships (src/lib/desk-crypto.mjs).
//
// Every helper here does what the spec says a device does, and no more: it
// seals before it sends, opens and checks what it is given, and never asks
// the service to vouch for a key. A test that wants a refusal builds the
// request with a helper, changes one thing, and sends it with call().

import * as ref from "../../../src/lib/desk-crypto.mjs";
import { SECRET, call, freshAccount } from "./call.js";

export { ref };

const b64 = ref.toBase64url;
const un = ref.fromBase64url;

/** A sealed card or holder record as the interface carries it. */
export const wireSealed = ({ nonce, ct }) => ({ nonce: b64(nonce), ct: b64(ct) });
/** A sealed keyring as the interface carries it. */
export const wireKeyring = ({ enc, ct }) => ({ enc: b64(enc), ct: b64(ct) });
const sealedBytes = ({ nonce, ct }) => ({ nonce: un(nonce), ct: un(ct) });
const keyringBytes = ({ enc, ct }) => ({ enc: un(enc), ct: un(ct) });

/** Sends a request and throws unless it is answered 200. Returns the body. */
export async function must(method, path, options, what = `${method} ${path}`) {
  const res = await call(method, path, options);
  if (res.status !== 200) throw new Error(`${what}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

/** A session for the test account of this name (the preview's way in). */
export async function signIn(account) {
  return (await must("POST", "/preview/session", { body: { secret: SECRET, account } })).token;
}

/**
 * A device that has joined nothing yet: a session, an id, and its two key
 * pairs. The session is the preview's for the test account of that name, or
 * `token` when the test signed in some real way (a passkey, Apple, Google).
 */
export async function newDevice(account, { name = "Test device", platform = "web", token } = {}) {
  return {
    account,
    token: token ?? (await signIn(account)),
    id: ref.newId(),
    key: await ref.generateKeyPair(),
    sign: (await ref.generateSigningKey()).public,
    name,
    platform,
    /** The keyring the device holds, once it has joined. */
    held: null,
  };
}

const keyOf = (held, kid = held.current) => ref.keyOf(held, kid);

/** The key proof for a keyring's current key, as a request carries it. */
export const proofOf = async (held, kid) => b64(await ref.keyProof(keyOf(held, kid)));
/** The hash of that proof, which is what the service stores. */
export const proofHashOf = async (held, kid) => b64(await ref.keyProofHash(await ref.keyProof(keyOf(held, kid))));

/** A device's card, sealed under the keyring's current key. */
export async function cardFor(device, held, { name = device.name } = {}) {
  const card = ref.deviceCard({
    public: device.key.public,
    sign: device.sign,
    name,
    platform: device.platform,
    added: new Date().toISOString(),
  });
  return wireSealed(
    await ref.sealDeviceCard({ notebookKey: keyOf(held), kid: held.current, notebook: held.notebook, deviceId: device.id, card }),
  );
}

/** A keyring sealed to a public key. */
export const keyringFor = async (publicKey, held) =>
  wireKeyring(await ref.sealKeyring({ keyring: held, recipientPublic: publicKey }));

/** A device's entry as a request carries it: { id, card, keyring }. */
export const entryFor = async (device, held) => ({
  id: device.id,
  card: await cardFor(device, held),
  keyring: await keyringFor(device.key.public, held),
});

/**
 * A holder, made as a device makes one: a key pair, its record sealed under
 * the secret, its card, and the keyring sealed to it. `kind` is "recovery"
 * (the secret is a recovery code) or "passkey" (a PRF output, with a made-up
 * credential id, or a real `passkey` from test/authenticator.js, whose
 * credential id and PRF secret are then the holder's). `wire` is the holder
 * as a request carries it.
 */
export async function makeHolder(held, kind, passkey) {
  const id = ref.newId();
  const key = await ref.generateKeyPair();
  const kid = held.current;
  const made = { id, kind, key };
  let credential;
  if (kind === "recovery") {
    made.code = ref.randomBytes(15);
    made.secretKey = await ref.codeKey(made.code);
  } else {
    made.prf = passkey ? passkey.prf : ref.randomBytes(32);
    credential = passkey ? passkey.credentialId : ref.randomBytes(20);
    made.credentialBytes = credential;
    made.credential = b64(credential);
    made.secretKey = await ref.passkeyKey(made.prf);
  }
  const record = ref.holderRecord({
    notebook: held.notebook,
    kind,
    id,
    credential,
    d: key.d,
    public: key.public,
    anchor: { kid, key: keyOf(held) },
  });
  const card = ref.holderCard({
    public: key.public,
    kind,
    credential,
    name: kind === "recovery" ? "Recovery code" : "Passkey",
    added: new Date().toISOString(),
  });
  made.wire = {
    id,
    kind,
    ...(credential ? { credential: made.credential } : {}),
    record: wireSealed(await ref.sealHolderRecord({ secretKey: made.secretKey, record })),
    card: wireSealed(await ref.sealHolderCard({ notebookKey: keyOf(held), kid, notebook: held.notebook, holderId: id, card })),
    keyring: await keyringFor(key.public, held),
  };
  return made;
}

/** Lists a passkey as one of the account's ways in (the preview's request, no ceremony). */
export const listPasskey = (device, credential, syncs = true) =>
  call("POST", "/preview/passkeys", { token: device.token, body: { credential, syncs } });

/**
 * What a first device sends to set up, without sending it: a new notebook's
 * id and first key, the device's entry, and the holders asked for.
 * Returns { device, held, holders, body }.
 */
export async function setupRequest({ account = freshAccount(), recovery = true, passkey = false, device } = {}) {
  device ??= await newDevice(account);
  const held = ref.firstKeyring(ref.newId(), ref.randomBytes(32));
  const holders = [];
  if (passkey) {
    const holder = await makeHolder(held, "passkey");
    await listPasskey(device, holder.credential);
    holders.push(holder);
  }
  if (recovery) holders.push(await makeHolder(held, "recovery"));
  const body = {
    notebook: held.notebook,
    proofHash: await proofHashOf(held),
    device: await entryFor(device, held),
    holders: holders.map((holder) => holder.wire),
  };
  return { account: device.account, device, held, holders, body };
}

/** A first device sets up. Returns { account, device, held, holders }; the device is open. */
export async function setUp(options) {
  const made = await setupRequest(options);
  await must("POST", "/notebook", { token: made.device.token, body: made.body }, "set up");
  made.device.held = made.held;
  return made;
}

/**
 * A device comes in through a holder: it fetches the holders, runs the four
 * checks with the holder's secret, and has the keyring. Nothing is sent that
 * changes anything. Returns the device, holding the keyring, not yet joined.
 */
export async function openThrough(account, holder, options) {
  const device = await newDevice(account, options);
  const { notebook } = await must("GET", "/account", { token: device.token });
  const { holders } = await must("GET", "/holders", { token: device.token });
  const stored = holders.find((h) => h.id === holder.id);
  if (!stored) throw new Error("the service has no such holder");
  const opened = await ref.openHolder({
    secretKey: holder.secretKey,
    kind: stored.kind,
    id: stored.id,
    notebook,
    credential: holder.credentialBytes,
    sealed: sealedBytes(stored.record),
    keyring: keyringBytes(stored.keyring),
  });
  device.held = opened.keyring;
  return device;
}

/** What that device then sends to join: POST /devices' body. */
export const joinRequest = async (device, holder) => ({
  kid: device.held.current,
  proof: await proofOf(device.held),
  holder: holder.id,
  device: await entryFor(device, device.held),
});

/** A device joins through a holder, by passkey or by recovery code. Returns the device, open. */
export async function joinThrough(account, holder, options) {
  const device = await openThrough(account, holder, options);
  await must("POST", "/devices", { token: device.token, body: await joinRequest(device, holder) }, "join");
  return device;
}

/**
 * The start of an approval: a new device, the code its screen shows, and the
 * request it posts. Returns { device, code, id, macKey, body }, nothing sent.
 */
export async function approvalRequest(account, options) {
  const device = await newDevice(account, { name: "Pixel 8", platform: "android", ...options });
  const code = ref.randomBytes(10);
  const { id, macKey } = await ref.approvalKeys(code);
  const fields = { id, deviceId: device.id, platform: device.platform, model: device.name, public: device.key.public, sign: device.sign };
  const mac = await ref.approvalRequestMac({ macKey, ...fields });
  const body = {
    id,
    device: device.id,
    platform: device.platform,
    model: device.name,
    public: b64(device.key.public),
    sign: b64(device.sign),
    mac: b64(mac),
  };
  return { device, code, id, macKey, body };
}

/** The approving device's side: it finds the request, checks its MAC, and builds the grant. Nothing sent. */
export async function grantRequest(approver, { id, macKey }) {
  const { approval } = await must("GET", `/approvals/${id}`, { token: approver.token });
  const request = {
    deviceId: approval.device,
    platform: approval.platform,
    model: approval.model,
    public: un(approval.public),
    sign: un(approval.sign),
    mac: un(approval.mac),
  };
  await ref.checkApprovalRequest({ macKey, id, request });
  const grant = await ref.makeGrant({ macKey, id, request, keyring: approver.held, added: new Date().toISOString() });
  return { kid: grant.kid, card: wireSealed(grant.card), keyring: wireKeyring(grant), mac: b64(grant.mac) };
}

/** The new device's side: it reads the grant, makes its checks, and keeps the keyring. Returns accept's body. */
export async function acceptRequest({ device, id, macKey }) {
  const { approval } = await must("GET", `/approvals/${id}`, { token: device.token });
  const grant = approval.grant;
  const accepted = await ref.acceptGrant({
    macKey,
    id,
    grant: { kid: grant.kid, ...keyringBytes(grant.keyring), card: sealedBytes(grant.card), mac: un(grant.mac) },
    device: { id: device.id, key: device.key, sign: device.sign },
  });
  device.held = accepted.keyring;
  return { kid: grant.kid, proof: await proofOf(device.held) };
}

/** A new device is approved by one that has the key, start to finish. Returns the new device, open. */
export async function approve(approver, options) {
  const asking = await approvalRequest(approver.account, options);
  await must("POST", "/approvals", { token: asking.device.token, body: asking.body }, "ask to join");
  await must("POST", `/approvals/${asking.id}/grant`, { token: approver.token, body: await grantRequest(approver, asking) }, "grant");
  await must("POST", `/approvals/${asking.id}/accept`, { token: asking.device.token, body: await acceptRequest(asking) }, "accept");
  return asking.device;
}

/**
 * What a device sends to change the key, without sending it. It reads both
 * lists, opens every card under the current key (an entry whose card doesn't
 * open is removed), makes the next key, seals the new keyring to each kept
 * device and holder, and seals each kept card again.
 *
 * `removeDevices` and `removeHolders` are ids; `add` is kinds of holder to
 * make in the same request ("recovery", "passkey").
 * Returns { held (the new keyring), body, added (the new holders) }.
 */
export async function keyChangeRequest(device, { removeDevices = [], removeHolders = [], add = [] } = {}) {
  const lists = await must("GET", "/devices", { token: device.token });
  const from = { notebookKey: keyOf(device.held), kid: device.held.current };
  const next = ref.nextKeyring(device.held, ref.randomBytes(32));
  const to = { notebookKey: keyOf(next), kid: next.current };
  const notebook = next.notebook;

  const body = {
    kid: from.kid,
    lists: lists.lists,
    proofHash: await proofHashOf(next),
    devices: [],
    holders: [],
    newHolders: [],
    removeDevices: [...removeDevices],
    removeHolders: [...removeHolders],
  };
  for (const entry of lists.devices) {
    if (removeDevices.includes(entry.id)) continue;
    const sealed = sealedBytes(entry.card);
    const opened = await ref.openDeviceCard({ ...from, notebook, deviceId: entry.id, ...sealed });
    body.devices.push({
      id: entry.id,
      card: wireSealed(await ref.resealDeviceCard({ from, to, notebook, deviceId: entry.id, ...sealed })),
      keyring: await keyringFor(opened.public, next),
    });
  }
  for (const entry of lists.holders) {
    if (removeHolders.includes(entry.id)) continue;
    const sealed = sealedBytes(entry.card);
    const opened = await ref.openHolderCard({ ...from, notebook, holderId: entry.id, ...sealed });
    body.holders.push({
      id: entry.id,
      card: wireSealed(await ref.resealHolderCard({ from, to, notebook, holderId: entry.id, ...sealed })),
      keyring: await keyringFor(opened.public, next),
    });
  }
  const added = [];
  for (const kind of add) {
    const holder = await makeHolder(next, kind);
    if (kind === "passkey") await listPasskey(device, holder.credential);
    added.push(holder);
    body.newHolders.push(holder.wire);
  }
  return { held: next, body, added };
}

/** A device changes the key. Returns { held, added, answer }; the device holds the new keyring. */
export async function changeKey(device, options) {
  const change = await keyChangeRequest(device, options);
  const answer = await must("POST", "/notebook/key", { token: device.token, body: change.body }, "change the key");
  device.held = change.held;
  return { ...change, answer };
}

/**
 * A device that kept its entry through a change of key made elsewhere: it
 * fetches its sealed keyring, opens it, checks it against the keys it holds
 * (the same notebook, never backward, every key it has unchanged), and proves.
 */
export async function catchUp(device) {
  const { keyring } = await must("GET", `/keyring?device=${device.id}`, { token: device.token });
  const incoming = await ref.openKeyring({ recipient: device.key, ...keyringBytes(keyring) });
  device.held = ref.checkKeyring({ held: device.held, incoming });
  await must(
    "POST",
    "/session/proof",
    { token: device.token, body: { device: device.id, kid: device.held.current, proof: await proofOf(device.held) } },
    "prove",
  );
  return device;
}

let rows = 0;
const stamp = () => new Date().toISOString();

/** A note as the format writes one, enough of it for a row. */
export const note = (fields = {}) => {
  const at = stamp();
  return { id: `note-${Date.now().toString(36)}-${++rows}`, kind: "note", schema: 1, created: at, modified: at, body: "For God so loved the world", ...fields };
};

/** A trash record for a deleted record, as the format writes one. */
export const trash = (deleted, fields = {}) => {
  const at = stamp();
  return { id: `trash-${Date.now().toString(36)}-${++rows}`, kind: "trash", schema: 1, created: at, modified: at, deletedAt: at, deletedId: deleted.id, record: deleted, ...fields };
};

/** A record sealed into a row under the keyring's current key, to put against `rev` (0 for a new one). */
export async function rowFor(held, record = note(), rev = 0) {
  return { ...(await ref.sealRecord({ record, notebookKey: keyOf(held), kid: held.current })), rev };
}

/** Pushes rows from a device. Returns the answer. */
export const push = (device, put = [], remove = []) =>
  must("POST", "/rows", { token: device.token, body: { put, remove } }, "push");

/** Pulls every row since `since`, page after page, and opens each with the device's keyring. */
export async function pull(device, since = 0) {
  const rowsOut = [];
  const records = [];
  let next = since;
  for (;;) {
    const page = await must("GET", `/rows?since=${next}`, { token: device.token }, "pull");
    for (const row of page.rows) {
      rowsOut.push(row);
      records.push((await ref.openRow({ row, keyring: device.held })).record);
    }
    next = page.next;
    if (!page.more) return { rows: rowsOut, records, next };
  }
}
