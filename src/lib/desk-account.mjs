// src/lib/desk-account.mjs
//
// What an account page does with the notebook's key: setting the notebook
// up, joining it (by passkey, by recovery code, by approval from either
// side), reading who can open it, renaming and removing devices, a first
// and a new recovery code, turning "follows my account" on and off, and
// signing a device out. STUDY-DESK-ENCRYPTION.md is the rule for each, by
// the section each function names, and desk-crypto.mjs does the sealing.
//
// A model, not a page: it holds no state and touches no storage or DOM.
// Every function is handed `call` (the service, as in
// desk-account-session.mjs) and what the device holds (`device`, its key
// pairs; `held`, its keyring, in memory), and hands back what the device
// must now keep. The page (src/scripts/desk/account/) stores, links, and
// draws.
//
// Rules a wrong edit here makes unsafe:
//   - The device checks; the service is never asked to vouch. A keyring is
//     kept only after openHolder's four checks or acceptGrant's.
//   - A card that doesn't open under a key this device holds is shown as
//     unknown and REMOVED at the next change of key, never kept on trust.
//   - A recovery code is handed to `keep` BEFORE the request that makes it
//     real, so a crash between the two never leaves a holder whose code no
//     one saw. The caller shows it only after the request is accepted.
//   - A PRF output and a recovery code are used and dropped: nothing here
//     returns one but the code it has just made.

import {
  Refusal,
  acceptGrant,
  approvalKeys,
  approvalRequestMac,
  checkApprovalRequest,
  codeKey,
  deviceCard,
  firstKeyring,
  fromBase64url,
  generateDeviceKey,
  generateKeyPair,
  generateSigningKey,
  holderCard,
  holderRecord,
  keyOf,
  keyProof,
  keyProofHash,
  makeGrant,
  newId,
  nextKeyring,
  openDeviceCard,
  openHolder,
  openHolderCard,
  passkeyKey,
  randomBytes,
  resealDeviceCard,
  resealHolderCard,
  sealDeviceCard,
  sealHolderCard,
  sealHolderRecord,
  sealKeyring,
  toBase64url,
} from "./desk-crypto.mjs";
import { AccountRefusal, PLATFORM, must } from "./desk-account-session.mjs";

export { AccountRefusal, PLATFORM };

const b64 = toBase64url;
const un = fromBase64url;
const isoNow = () => new Date().toISOString();

const wireSealed = ({ nonce, ct }) => ({ nonce: b64(nonce), ct: b64(ct) });
const wireKeyring = ({ enc, ct }) => ({ enc: b64(enc), ct: b64(ct) });
const sealedBytes = ({ nonce, ct }) => ({ nonce: un(nonce), ct: un(ct) });
const keyringBytes = ({ enc, ct }) => ({ enc: un(enc), ct: un(ct) });

/**
 * A step that can't go on, for a reason the page words. `why` is one of:
 *   "wrongCode"       the recovery code doesn't open this notebook
 *   "noRecovery"      the notebook has no recovery code to enter
 *   "holderBroken"    a holder opened and then failed a check (2 to 4): the
 *                     device keeps nothing and offers the other ways in
 *   "approvalGone"    the approval ran out, or never was
 *   "approvalForged"  an approval's MAC doesn't verify: not from a device
 *                     that saw the code
 *   "ownCard"         this device's own card doesn't open, so it won't
 *                     change the key
 *   "holderNeeded"    the change would leave nothing that can open the
 *                     notebook
 *   "behind"          the service's current key is newer than this
 *                     device's keyring: catch up, then start again
 */
export class AccountStop extends Error {
  constructor(why, cause) {
    super(`account: ${why}`);
    this.name = "AccountStop";
    this.why = why;
    if (cause) this.cause = cause;
  }
}

/* ── A device ───────────────────────────────────────────────────────────── */

/**
 * A device that has joined nothing: an id and its two key pairs, the
 * private halves CryptoKeys that can't be read out (the spec's "The
 * website"). `name` is what its card starts with.
 */
export async function newDevice({ name, platform = PLATFORM } = {}) {
  return { id: newId(), key: await generateDeviceKey(), sign: await generateSigningKey(), name, platform };
}

/** The key proof for a keyring's current key, as a request carries it. */
export const proofOf = async (held) => b64(await keyProof(keyOf(held, held.current)));
const proofHashOf = async (held) => b64(await keyProofHash(await keyProof(keyOf(held, held.current))));

const current = (held) => ({ notebookKey: keyOf(held, held.current), kid: held.current });

async function cardFor(device, held, now) {
  const card = deviceCard({ public: device.key.public, sign: device.sign.public, name: device.name, platform: device.platform, added: now() });
  return wireSealed(await sealDeviceCard({ ...current(held), notebook: held.notebook, deviceId: device.id, card }));
}

const keyringFor = async (publicKey, held) => wireKeyring(await sealKeyring({ keyring: held, recipientPublic: publicKey }));

const entryFor = async (device, held, now) => ({
  id: device.id,
  card: await cardFor(device, held, now),
  keyring: await keyringFor(device.key.public, held),
});

/**
 * Proves the key, which opens the session: for a device that has an entry
 * and the keyring and signed in again. Returns { open, device, kid }.
 */
export async function prove({ call, device, held }) {
  return must(call, "POST", "/session/proof", { device: device.id, kid: held.current, proof: await proofOf(held) }, "prove the key");
}

/* ── Holders ────────────────────────────────────────────────────────────── */

/**
 * A holder, made as the spec's "Holders" says: a key pair of its own, its
 * record sealed under the secret, its card, and the keyring sealed to it.
 * `want` is { kind: "recovery" } or { kind: "passkey", credential, prf }
 * (the passkey's id and PRF output, as bytes). Returns { id, kind, wire,
 * code }: `code` is a new recovery code's 15 bytes, else null.
 */
async function makeHolder(held, want, { now, random }) {
  const id = newId();
  const key = await generateKeyPair();
  const kid = held.current;
  let secretKey;
  let code = null;
  let credential;
  if (want.kind === "recovery") {
    code = random(15);
    secretKey = await codeKey(code);
  } else {
    credential = want.credential;
    secretKey = await passkeyKey(want.prf);
  }
  const record = holderRecord({ notebook: held.notebook, kind: want.kind, id, credential, d: key.d, public: key.public, anchor: { kid, key: keyOf(held, kid) } });
  const card = holderCard({
    public: key.public,
    kind: want.kind,
    credential,
    name: want.name ?? (want.kind === "recovery" ? "Recovery code" : "Passkey"),
    added: now(),
  });
  const wire = {
    id,
    kind: want.kind,
    ...(credential ? { credential: b64(credential) } : {}),
    record: wireSealed(await sealHolderRecord({ secretKey, record })),
    card: wireSealed(await sealHolderCard({ notebookKey: keyOf(held, kid), kid, notebook: held.notebook, holderId: id, card })),
    keyring: await keyringFor(key.public, held),
  };
  return { id, kind: want.kind, wire, code };
}

const codeOf = (holders) => holders.find((holder) => holder.code)?.code ?? null;

/* ── Setting up the first device ────────────────────────────────────────── */

/**
 * Sets the notebook up (the spec's "Setting up the first device," steps 2
 * to 4). `passkey` is { credential, prf } for "follows my account," a
 * passkey that syncs and gave a PRF output, or null; `recovery` is whether
 * to make a recovery code, which is required when there is no passkey.
 *
 * `keep({ code, notebook, held })` is called before the request is sent,
 * with the new recovery code (or null) and the keyring it opens, so the
 * page can store both where a setup cut short finds them: an answer that
 * never arrived must not leave a notebook whose key and code no one holds.
 *
 * Returns { held, kid, lists, code, holders }: the keyring to link the
 * browser with, and the code to show now that the request is accepted.
 * An account that already has a notebook throws AccountRefusal
 * `already_set_up`: join it instead, and never show the code.
 */
export async function setUp({ call, device, passkey = null, recovery = true, keep, now = isoNow, random = randomBytes }) {
  if (!passkey && !recovery) throw new AccountStop("holderNeeded");
  const held = firstKeyring(newId(), random(32));
  const holders = [];
  if (passkey) holders.push(await makeHolder(held, { kind: "passkey", ...passkey }, { now, random }));
  if (recovery) holders.push(await makeHolder(held, { kind: "recovery" }, { now, random }));
  const code = codeOf(holders);
  await keep?.({ code, notebook: held.notebook, held });
  const answer = await must(
    call,
    "POST",
    "/notebook",
    {
      notebook: held.notebook,
      proofHash: await proofHashOf(held),
      device: await entryFor(device, held, now),
      holders: holders.map((holder) => holder.wire),
    },
    "set up",
  );
  return { held, kid: answer.kid, lists: answer.lists, code, holders: holders.map(({ id, kind }) => ({ id, kind })) };
}

/* ── Adding a device: through a holder ──────────────────────────────────── */

/** The notebook's holders as `GET /holders` answers them: [{ id, kind, credential, record, keyring }]. */
export async function readHolders(call) {
  return (await must(call, "GET", "/holders")).holders ?? [];
}

/**
 * What a signed-in device that can't open the notebook may try, from the
 * holder list: { passkeys, recovery }. `passkeys` is the credential ids
 * (bytes) of the passkeys that hold the key, to name in the prompt;
 * `recovery` is whether there is a code to enter.
 */
export function waysToOpen(holders) {
  return {
    passkeys: holders.filter((holder) => holder.kind === "passkey" && holder.credential).map((holder) => un(holder.credential)),
    recovery: holders.some((holder) => holder.kind === "recovery"),
  };
}

async function openThrough(stored, notebook, secretKey, credential) {
  try {
    const opened = await openHolder({
      secretKey,
      kind: stored.kind,
      id: stored.id,
      notebook,
      credential,
      sealed: sealedBytes(stored.record),
      keyring: keyringBytes(stored.keyring),
    });
    return { held: opened.keyring, holder: stored.id, kind: stored.kind };
  } catch (error) {
    if (!(error instanceof Refusal)) throw error;
    // The first check is the secret itself; a later one is the holder.
    throw new AccountStop(error.check === 1 ? "wrongCode" : "holderBroken", error);
  }
}

/**
 * Opens the notebook with the recovery code (15 bytes, as readRecoveryCode
 * gives them). Nothing is sent that changes anything. Returns { held,
 * holder, kind }, or throws AccountStop "wrongCode" ("That code doesn't
 * open this notebook") or "noRecovery".
 */
export async function openWithRecoveryCode({ call, notebook, code, holders }) {
  const stored = (holders ?? (await readHolders(call))).find((holder) => holder.kind === "recovery");
  if (!stored) throw new AccountStop("noRecovery");
  return openThrough(stored, notebook, await codeKey(code), undefined);
}

/**
 * Opens the notebook with a passkey that just answered: `credential` its
 * id, `prf` its PRF output. Returns { held, holder, kind }, or null when
 * this passkey can't open the notebook here: it holds nothing, it gave no
 * output, or its output doesn't open its holder. A passkey that fails is
 * never an error that loses anything: the page offers approval and the
 * recovery code.
 */
export async function openWithPasskey({ call, notebook, credential, prf, holders }) {
  if (!prf) return null;
  const id = b64(credential);
  const stored = (holders ?? (await readHolders(call))).find((holder) => holder.kind === "passkey" && holder.credential === id);
  if (!stored) return null;
  try {
    return await openThrough(stored, notebook, await passkeyKey(prf), credential);
  } catch (error) {
    if (error instanceof AccountStop) return null;
    throw error;
  }
}

/**
 * Joins: the device writes its card, seals the keyring to its own key, and
 * sends both with the key proof (`POST /devices`). `holder` is the id it
 * came in through. Returns { kid, lists }; the session is open.
 */
export async function join({ call, device, held, holder, now = isoNow }) {
  return must(
    call,
    "POST",
    "/devices",
    { kid: held.current, proof: await proofOf(held), holder, device: await entryFor(device, held, now) },
    "join",
  );
}

/* ── Adding a device: by approval ───────────────────────────────────────── */

/**
 * The new device asks to join (the spec's "By approval," step 3). `code` is
 * the approval code's 10 bytes: the one this device made and is showing, or
 * the one the reader typed from the other device's screen.
 * Returns { id, macKey, expires } for `acceptApproval`.
 */
export async function askToJoin({ call, device, code }) {
  const { id, macKey } = await approvalKeys(code);
  const fields = { id, deviceId: device.id, platform: device.platform, model: device.name, public: device.key.public, sign: device.sign.public };
  const mac = await approvalRequestMac({ macKey, ...fields });
  const answer = await must(
    call,
    "POST",
    "/approvals",
    { id, device: device.id, platform: device.platform, model: device.name, public: b64(device.key.public), sign: b64(device.sign.public), mac: b64(mac) },
    "ask to join",
  );
  return { id, macKey, expires: answer.expires };
}

async function readApproval(call, id) {
  try {
    return (await must(call, "GET", `/approvals/${id}`)).approval;
  } catch (error) {
    if (error instanceof AccountRefusal && error.is("gone")) throw new AccountStop("approvalGone", error);
    throw error;
  }
}

/**
 * The device that has the key finds the request a code names and checks its
 * MAC (step 4). Returns { id, macKey, request, expires, granted }:
 * `request.model` and `request.platform` are what the reader is asked about
 * ("Add [model] to your notebook?"). Nothing is granted yet.
 */
export async function findRequest({ call, code }) {
  const { id, macKey } = await approvalKeys(code);
  const approval = await readApproval(call, id);
  let request;
  try {
    request = {
      deviceId: approval.device,
      platform: approval.platform,
      model: approval.model,
      public: un(approval.public),
      sign: un(approval.sign),
      mac: un(approval.mac),
    };
    await checkApprovalRequest({ macKey, id, request });
  } catch (error) {
    throw new AccountStop("approvalForged", error);
  }
  return { id, macKey, request, expires: approval.expires, granted: approval.grant !== null };
}

/**
 * The reader said yes (step 5): the keyring sealed to the new device's key,
 * its card, and the grant's MAC. `found` is findRequest's result.
 */
export async function grant({ call, held, found, now = isoNow }) {
  const made = await makeGrant({ macKey: found.macKey, id: found.id, request: found.request, keyring: held, added: now() });
  return must(
    call,
    "POST",
    `/approvals/${found.id}/grant`,
    { kid: made.kid, card: wireSealed(made.card), keyring: wireKeyring(made), mac: b64(made.mac) },
    "grant",
  );
}

/**
 * The new device looks for its grant (step 6). Returns null while there is
 * none yet, so the page asks again. With one, it runs the grant's checks,
 * accepts, and returns { held, kid, lists }: the session is open.
 * Throws AccountStop "approvalGone" once the ten minutes are up, and
 * "approvalForged" for a grant that fails a check.
 */
export async function acceptApproval({ call, device, asked }) {
  const approval = await readApproval(call, asked.id);
  const given = approval.grant;
  if (!given) return null;
  let accepted;
  try {
    accepted = await acceptGrant({
      macKey: asked.macKey,
      id: asked.id,
      grant: { kid: given.kid, ...keyringBytes(given.keyring), card: sealedBytes(given.card), mac: un(given.mac) },
      device: { id: device.id, key: device.key, sign: device.sign.public },
    });
  } catch (error) {
    throw new AccountStop("approvalForged", error);
  }
  const held = accepted.keyring;
  const answer = await must(call, "POST", `/approvals/${asked.id}/accept`, { kid: given.kid, proof: await proofOf(held) }, "accept");
  return { held, kid: answer.kid, lists: answer.lists };
}

/* ── Who can open the notebook ──────────────────────────────────────────── */

/**
 * Both lists, each card opened under the keyring (`GET /devices`). Returns
 *   { kid, lists, devices, holders, raw }
 * A device is { id, opens, name, platform, added, how, by, seen, public };
 * a holder { id, opens, kind, credential, name, added, by, public }. An
 * entry whose card doesn't open has `opens: false` and no name: the page
 * shows it as unknown, and a change of key removes it. `raw` is the answer
 * itself, which a change of key works from.
 */
export async function readLists({ call, held }) {
  const raw = await must(call, "GET", "/devices");
  if (raw.kid > held.current) throw new AccountStop("behind");
  const notebook = held.notebook;
  const devices = [];
  for (const entry of raw.devices ?? []) {
    const base = { id: entry.id, added: entry.added, how: entry.how, by: entry.by ?? null, seen: entry.seen ?? null };
    try {
      const key = keyOf(held, entry.card.kid);
      if (!key) throw new Refusal("missingKey");
      const opened = await openDeviceCard({ notebookKey: key, kid: entry.card.kid, notebook, deviceId: entry.id, ...sealedBytes(entry.card) });
      devices.push({ ...base, opens: true, name: opened.card.name, platform: opened.card.platform, public: opened.public, card: opened.card });
    } catch (error) {
      if (!(error instanceof Refusal)) throw error;
      devices.push({ ...base, opens: false });
    }
  }
  const holders = [];
  for (const entry of raw.holders ?? []) {
    const base = { id: entry.id, kind: entry.kind, credential: entry.credential ?? null, added: entry.added, by: entry.by ?? null };
    try {
      const key = keyOf(held, entry.card.kid);
      if (!key) throw new Refusal("missingKey");
      const opened = await openHolderCard({ notebookKey: key, kid: entry.card.kid, notebook, holderId: entry.id, ...sealedBytes(entry.card) });
      // The card, not the service, says what a holder is, and which passkey it is for.
      if (opened.card.kind !== entry.kind) throw new Refusal("card", "kind");
      if (entry.kind === "passkey" && opened.card.credential !== entry.credential) throw new Refusal("card", "credential");
      holders.push({ ...base, opens: true, name: opened.card.name, public: opened.public });
    } catch (error) {
      if (!(error instanceof Refusal)) throw error;
      holders.push({ ...base, opens: false });
    }
  }
  return { kid: raw.kid, lists: raw.lists, devices, holders, raw };
}

/**
 * Where the key lives, read from the holder cards that open and never from
 * the service's word: "account" when a passkey holds it ("follows my
 * account"), else "device" ("this device only").
 */
export const whereKeyLives = (lists) => (lists.holders.some((holder) => holder.opens && holder.kind === "passkey") ? "account" : "device");

/** True when the notebook has a recovery code. */
export const hasRecoveryCode = (lists) => lists.holders.some((holder) => holder.opens && holder.kind === "recovery");

/**
 * What to announce: the devices and holders in `lists` that this device has
 * not told its reader about. `seen` is the ids it has (an array or a Set);
 * `own` is this device's id, which is never news to itself. Each is
 * { what: "device" | "holder", id, name, kind, how, by, byName, added }:
 * `by` is the device that granted an approval or added a holder, and
 * `byName` its name where its card opens.
 */
export function news({ lists, seen, own }) {
  const known = seen instanceof Set ? seen : new Set(seen ?? []);
  const nameOf = (id) => lists.devices.find((device) => device.id === id && device.opens)?.name ?? null;
  const out = [];
  for (const device of lists.devices) {
    if (device.id === own || known.has(device.id)) continue;
    out.push({
      what: "device",
      id: device.id,
      name: device.opens ? device.name : null,
      how: device.how,
      by: device.how === "approval" ? device.by : null,
      byName: device.how === "approval" ? nameOf(device.by) : null,
      added: device.added,
    });
  }
  for (const holder of lists.holders) {
    if (known.has(holder.id) || holder.by === own) continue;
    out.push({ what: "holder", id: holder.id, kind: holder.kind, name: holder.opens ? holder.name : null, by: holder.by, byName: nameOf(holder.by), added: holder.added });
  }
  return out;
}

/** Every id in the lists, which is what `news` is next given as `seen`. */
export const seenIn = (lists) => [...lists.devices.map((device) => device.id), ...lists.holders.map((holder) => holder.id)];

/* ── Changing one's own entry ───────────────────────────────────────────── */

/**
 * Renames this device: its card written again with the new name, every
 * other field kept (`PUT /devices/<id>`). `lists` is readLists' result.
 * Returns { lists }, the new version.
 */
export async function renameDevice({ call, device, held, lists, name }) {
  const mine = lists.devices.find((entry) => entry.id === device.id);
  if (!mine?.opens) throw new AccountStop("ownCard");
  const card = { ...mine.card, name };
  const sealed = await sealDeviceCard({ ...current(held), notebook: held.notebook, deviceId: device.id, card });
  return must(call, "PUT", `/devices/${device.id}`, { lists: lists.lists, kid: held.current, card: wireSealed(sealed) }, "rename");
}

/**
 * Adds a holder without changing the key (`POST /holders`): a first
 * recovery code, or a passkey for "follows my account." `want` is as for
 * setUp's holders; `keep` is given a new code before the request.
 * Returns { lists, code, holder }.
 */
export async function addHolder({ call, held, lists, want, keep, now = isoNow, random = randomBytes }) {
  const holder = await makeHolder(held, want, { now, random });
  if (holder.code) await keep?.({ code: holder.code, notebook: held.notebook });
  const answer = await must(call, "POST", "/holders", { lists: lists.lists, kid: held.current, holder: holder.wire }, "add a holder");
  return { lists: answer.lists, code: holder.code, holder: { id: holder.id, kind: holder.kind } };
}

/* ── Changing the key ───────────────────────────────────────────────────── */

/**
 * Changes the notebook's key (the spec's "Removing a device, and changing
 * the key," steps 1 to 4). `lists` is readLists' result, which the reader
 * has just been shown; `removeDevices` and `removeHolders` are ids;
 * `add` is holders to make under the new key, as for setUp.
 *
 * Every entry whose card doesn't open is removed with them. This device is
 * always kept, and the change is refused here if it would leave no holder.
 *
 * Returns { held, kid, lists, code, removed }: the NEXT keyring, which the
 * caller hands to the connector (`adopt`), so that every record still
 * under an older key is sealed again. `removed` is what went, unknown
 * entries included. If the lists moved meanwhile the service answers
 * `lists_changed` (or `old_key`, `not_open`): read them and start again.
 */
export async function changeKey({ call, device, held, lists, removeDevices = [], removeHolders = [], add = [], keep, now = isoNow, random = randomBytes }) {
  const goneDevices = new Set(removeDevices);
  const goneHolders = new Set(removeHolders);
  for (const entry of lists.devices) if (!entry.opens) goneDevices.add(entry.id);
  for (const entry of lists.holders) if (!entry.opens) goneHolders.add(entry.id);
  if (goneDevices.has(device.id)) throw new AccountStop("ownCard");

  const keptHolders = lists.holders.filter((entry) => !goneHolders.has(entry.id));
  if (keptHolders.length + add.length === 0) throw new AccountStop("holderNeeded");

  const from = current(held);
  const next = nextKeyring(held, random(32));
  const to = current(next);
  const notebook = next.notebook;
  const rawDevice = new Map((lists.raw.devices ?? []).map((entry) => [entry.id, entry]));
  const rawHolder = new Map((lists.raw.holders ?? []).map((entry) => [entry.id, entry]));

  const body = {
    kid: from.kid,
    lists: lists.lists,
    proofHash: await proofHashOf(next),
    devices: [],
    holders: [],
    newHolders: [],
    removeDevices: [...goneDevices],
    removeHolders: [...goneHolders],
  };
  for (const entry of lists.devices) {
    if (goneDevices.has(entry.id)) continue;
    const sealed = sealedBytes(rawDevice.get(entry.id).card);
    body.devices.push({
      id: entry.id,
      card: wireSealed(await resealDeviceCard({ from, to, notebook, deviceId: entry.id, ...sealed })),
      // Sealed to the key in the card this device just opened, never to one the service names.
      keyring: await keyringFor(entry.public, next),
    });
  }
  for (const entry of keptHolders) {
    const sealed = sealedBytes(rawHolder.get(entry.id).card);
    body.holders.push({
      id: entry.id,
      card: wireSealed(await resealHolderCard({ from, to, notebook, holderId: entry.id, ...sealed })),
      keyring: await keyringFor(entry.public, next),
    });
  }
  const made = [];
  for (const want of add) made.push(await makeHolder(next, want, { now, random }));
  body.newHolders = made.map((holder) => holder.wire);
  const code = codeOf(made);
  if (code) await keep?.({ code, notebook });

  const answer = await must(call, "POST", "/notebook/key", body, "change the key");
  return {
    held: next,
    kid: answer.kid,
    lists: answer.lists,
    code,
    removed: { devices: [...goneDevices], holders: [...goneHolders] },
    added: made.map(({ id, kind }) => ({ id, kind })),
  };
}

/** Removes devices: a change of key that leaves them out. */
export const removeDevices = ({ ids, ...rest }) => changeKey({ ...rest, removeDevices: ids });

/**
 * "Make a new recovery code" (the spec's "A new recovery code"): a new
 * holder and code AND a new key, the old recovery holder removed in the
 * same request. Returns changeKey's result; `code` is the new one.
 */
export function newRecoveryCode({ lists, ...rest }) {
  const old = lists.holders.filter((holder) => holder.kind === "recovery").map((holder) => holder.id);
  return changeKey({ ...rest, lists, removeHolders: old, add: [{ kind: "recovery" }] });
}

/**
 * "Switch to this device only": a change of key that keeps no passkey
 * holder, and makes a recovery code in the same step if the reader has
 * none, since one is required now. The passkeys still sign the reader in.
 */
export function switchToDeviceOnly({ lists, ...rest }) {
  const passkeys = lists.holders.filter((holder) => holder.kind === "passkey").map((holder) => holder.id);
  return changeKey({ ...rest, lists, removeHolders: passkeys, add: hasRecoveryCode(lists) ? [] : [{ kind: "recovery" }] });
}

/**
 * Stops one passkey opening the notebook: the same change of key with that
 * holder removed. If it was the last passkey holder the notebook is "this
 * device only" from then on, so a recovery code is made if there is none.
 */
export function removePasskeyHolder({ lists, holder, ...rest }) {
  const left = lists.holders.filter((entry) => entry.opens && entry.id !== holder);
  return changeKey({ ...rest, lists, removeHolders: [holder], add: left.length ? [] : [{ kind: "recovery" }] });
}

/* ── Signing out ────────────────────────────────────────────────────────── */

/**
 * Signs this device out on the service: its entry, its sealed keyring, and
 * every session attached to it are removed, and the key doesn't change
 * (`DELETE /devices/<id>`). It needs no open session. A session the service
 * no longer knows is as good as signed out, and returns { lists: null }.
 * The caller then unlinks the browser; the notebook in it stays.
 */
export async function signOutDevice({ call, device }) {
  try {
    return await must(call, "DELETE", `/devices/${device.id}`, undefined, "sign out");
  } catch (error) {
    if (error instanceof AccountRefusal && error.is("sign_in")) return { lists: null };
    throw error;
  }
}

/* ── A recovery code the reader has just been shown ─────────────────────── */

/**
 * Two of the code's six groups to ask back, in order, chosen at random:
 * [first, second], each 1 to 6. `random(n)` gives n random bytes.
 */
export function groupsToAsk(random = randomBytes) {
  const pick = (among) => among[random(1)[0] % among.length];
  const all = [1, 2, 3, 4, 5, 6];
  const first = pick(all);
  const second = pick(all.filter((group) => group !== first));
  return first < second ? [first, second] : [second, first];
}
