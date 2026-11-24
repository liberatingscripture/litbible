// Changing the key
// (STUDY-DESK-ENCRYPTION.md, "Removing a device, and changing the key," and
// "The service's interface": "Changing the key").
//
// One request carries the whole change, and it is applied all at once or not
// at all: the new kid, the new proof's hash, every kept device's and holder's
// card and keyring sealed under the new key, the entries to remove, and any
// new holder. Removing a device, switching to "this device only," replacing a
// passkey, and making a new recovery code are all this one request.

import { answer, notAllowed, now } from "./http.js";
import { LIMITS, needArray, needBytes, needCount, needDeviceEntry, needDistinct, needHolder, needKeptHolder, needUuid } from "./check.js";
import { commit, guard, idList } from "./db.js";
import { changing, needCurrentKid, needCurrentLists, needOpen } from "./session.js";
import { insertHolder, needRoomForHolders, needSyncedPasskeys, readLists } from "./lists.js";

const list = (value, field, each) => needArray(value ?? [], field).map((item, i) => each(item, `${field}[${i}]`));

function parse(body) {
  const input = {
    kid: needCount(body.kid, "kid", 1),
    lists: needCount(body.lists, "lists", 1),
    proofHash: needBytes(body.proofHash, "proofHash", LIMITS.proofBytes),
    devices: list(body.devices, "devices", needDeviceEntry),
    holders: list(body.holders, "holders", needKeptHolder),
    newHolders: list(body.newHolders, "newHolders", needHolder),
    removeDevices: list(body.removeDevices, "removeDevices", needUuid),
    removeHolders: list(body.removeHolders, "removeHolders", needUuid),
  };
  // No id may be named twice, in one list or across "kept" and "removed".
  needDistinct([...input.devices.map((d) => d.id), ...input.removeDevices], "devices");
  needDistinct(
    [...input.holders.map((h) => h.id), ...input.newHolders.map((h) => h.id), ...input.removeHolders],
    "holders",
  );
  return input;
}

/** True when the two lists hold the same ids, each once. */
const sameIds = (a, b) => a.length === b.length && a.every((id) => b.includes(id));

/** POST /notebook/key, from an open session. */
export function postNotebookKey({ request, env }) {
  return changing(request, env, parse, change, needOpen);

  async function change(auth, input) {
    const { kid, lists, proofHash, devices, holders, newHolders, removeDevices, removeHolders } = input;
    needCurrentKid(auth, kid);
    needCurrentLists(auth, lists);

    // Every device on the service is in exactly one of "kept" and "removed," and so is every
    // holder: a device the caller never saw can't be kept by accident or dropped in silence.
    const stored = await readLists(env.DB, auth.account);
    const named = [...devices.map((d) => d.id), ...removeDevices];
    if (!sameIds(named, stored.devices.map((d) => d.id))) notAllowed("every_device");
    const namedHolders = [...holders.map((h) => h.id), ...removeHolders];
    if (!sameIds(namedHolders, stored.holders.map((h) => h.id))) notAllowed("every_holder");

    if (!devices.some((d) => d.id === auth.device)) notAllowed("keep_own_device");

    // What the holder list will be afterward: the kept ones as they are stored, and the new ones.
    const kept = stored.holders.filter((h) => !removeHolders.includes(h.id));
    const after = [...kept, ...newHolders];
    if (after.length < 1) notAllowed("holder_needed");
    needRoomForHolders(after.length);
    if (after.filter((h) => h.kind === "recovery").length > 1) notAllowed("one_recovery");
    const credentials = after.filter((h) => h.kind === "passkey").map((h) => h.credential);
    if (new Set(credentials).size !== credentials.length) notAllowed("one_holder_per_passkey");
    // A new holder's id can't be one the service already has: every stored holder is named as
    // kept or removed (above), and parse() refused any id named twice.
    await needSyncedPasskeys(
      env.DB,
      auth.account,
      newHolders.filter((h) => h.kind === "passkey").map((h) => h.credential),
    );

    const db = env.DB;
    const next = kid + 1;
    const time = now();
    const reseal = (table, entry) =>
      db
        .prepare(
          `UPDATE ${table} SET card_kid = ?, card_nonce = ?, card_ct = ?, keyring_kid = ?, keyring_enc = ?, keyring_ct = ?
            WHERE account = ? AND id = ?`,
        )
        .bind(next, entry.card.nonce, entry.card.ct, next, entry.keyring.enc, entry.keyring.ct, auth.account, entry.id);

    await commit(db, [
      guard(db, auth.account, { kid, lists }),
      db.prepare("UPDATE accounts SET kid = ?, proof_hash = ?, lists = lists + 1 WHERE id = ?").bind(next, proofHash, auth.account),
      // Removed devices lose their entries, their sealed keyrings, and their sessions.
      db.prepare("DELETE FROM devices WHERE account = ? AND id IN (SELECT value FROM json_each(?))").bind(auth.account, idList(removeDevices)),
      db.prepare("DELETE FROM sessions WHERE account = ? AND device IN (SELECT value FROM json_each(?))").bind(auth.account, idList(removeDevices)),
      // Removed holders go before new ones arrive, so "one recovery" and "one for a passkey" hold throughout.
      db.prepare("DELETE FROM holders WHERE account = ? AND id IN (SELECT value FROM json_each(?))").bind(auth.account, idList(removeHolders)),
      ...devices.map((device) => reseal("devices", device)),
      ...holders.map((holder) => reseal("holders", holder)),
      ...newHolders.map((holder) => insertHolder(db, auth.account, holder, { kid: next, by: auth.device, time })),
      // No approval crosses a change of key.
      db.prepare("DELETE FROM approvals WHERE account = ?").bind(auth.account),
      // The caller's session stays open, for the new kid. Every other session proved an older one.
      db.prepare("UPDATE sessions SET open_kid = ? WHERE token_hash = ?").bind(next, auth.tokenHash),
    ]);
    return answer({ kid: next, lists: lists + 1 });
  }
}
