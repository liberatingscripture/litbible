// Devices and holders
// (STUDY-DESK-ENCRYPTION.md, "The service's interface": "Devices and holders").

import { answer, notAllowed, now, refuse } from "./http.js";
import { LIMITS, isUuid, needBytes, needCard, needCount, needDeviceEntry, needHolder, needKeyring, needUuid } from "./check.js";
import { commit, guard } from "./db.js";
import {
  authenticate,
  changing,
  needCurrentKid,
  needCurrentLists,
  needNotebook,
  needOpen,
  needProof,
  openSession,
} from "./session.js";
import {
  deviceOut,
  holderCardOut,
  holderRecordOut,
  insertDevice,
  insertHolder,
  keyringOut,
  moveLists,
  needRoomForDevice,
  needRoomForHolders,
  needSyncedPasskeys,
  readLists,
} from "./lists.js";

/**
 * GET /holders, from a signed-in session: what a new device needs in order
 * to come in through a holder. Each holder's record and sealed keyring, and
 * no cards. This is all a session that has not proved the key is given.
 */
export async function getHolders({ request, env }) {
  const auth = await authenticate(request, env);
  const { results } = await env.DB.prepare(
    `SELECT id, kind, credential, record_nonce, record_ct, keyring_kid, keyring_enc, keyring_ct
       FROM holders WHERE account = ? ORDER BY added, id`,
  )
    .bind(auth.account)
    .all();
  return answer({ holders: results.map(holderRecordOut) });
}

/** GET /keyring?device=<id>, from a signed-in session: that device's sealed keyring, or "not_found". */
export async function getKeyring({ request, env, url }) {
  const auth = await authenticate(request, env);
  const device = url.searchParams.get("device");
  if (!isUuid(device)) refuse(400, "bad_request", { field: "device" });
  const row = await env.DB.prepare(
    "SELECT keyring_kid, keyring_enc, keyring_ct FROM devices WHERE account = ? AND id = ?",
  )
    .bind(auth.account, device)
    .first();
  if (!row) refuse(404, "not_found", { what: "keyring" });
  return answer({ device, keyring: keyringOut(row) });
}

/**
 * POST /devices, from a signed-in session: a device that came in through a
 * holder joins. { kid, proof, holder, device: { id, card, keyring } }.
 * Checks, in order: `kid` is current; the proof; the holder exists; no entry
 * has the device's id.
 */
export function postDevices({ request, env }) {
  return changing(
    request,
    env,
    (body) => ({
      kid: needCount(body.kid, "kid", 1),
      proof: needBytes(body.proof, "proof", LIMITS.proofBytes),
      holder: needUuid(body.holder, "holder"),
      device: needDeviceEntry(body.device, "device"),
    }),
    async (auth, { kid, proof, holder, device }) => {
      needCurrentKid(auth, kid);
      await needProof(env, auth, proof);
      const lists = await readLists(env.DB, auth.account);
      const through = lists.holders.find((h) => h.id === holder);
      if (!through) refuse(410, "gone", { what: "holder" });
      if (lists.devices.some((d) => d.id === device.id)) refuse(409, "exists", { what: "device" });
      needRoomForDevice(lists.devices.length);
      await commit(env.DB, [
        guard(env.DB, auth.account, { kid, lists: auth.lists }),
        insertDevice(env.DB, auth.account, device, { kid, how: through.kind, by: through.id, time: now() }),
        moveLists(env.DB, auth.account),
        openSession(env, auth, device.id, kid),
      ]);
      return answer({ kid, lists: auth.lists + 1, session: { open: true, device: device.id } });
    },
    needNotebook,
  );
}

/** GET /devices, from an open session: both lists, with their cards. */
export async function getDevices({ request, env }) {
  const auth = needOpen(await authenticate(request, env));
  // Read together, so the lists and the version they are answered under belong to one moment.
  const [account, devices, holders] = await env.DB.batch([
    env.DB.prepare("SELECT kid, lists FROM accounts WHERE id = ?").bind(auth.account),
    env.DB.prepare(
      `SELECT id, card_kid, card_nonce, card_ct, added, added_how, added_by, seen
         FROM devices WHERE account = ? ORDER BY added, id`,
    ).bind(auth.account),
    env.DB.prepare(
      `SELECT id, kind, credential, card_kid, card_nonce, card_ct, added, added_by
         FROM holders WHERE account = ? ORDER BY added, id`,
    ).bind(auth.account),
  ]);
  return answer({
    kid: account.results[0].kid,
    lists: account.results[0].lists,
    devices: devices.results.map(deviceOut),
    holders: holders.results.map(holderCardOut),
  });
}

/**
 * PUT /devices/<id>, from an open session, for its own device only:
 * { lists, kid, card, keyring? }. A rename sends a new card; a new device key
 * (the passphrase lock, later) sends a new sealed keyring with it.
 */
export function putDevice({ request, env, params }) {
  return changing(
    request,
    env,
    (body) => ({
      lists: needCount(body.lists, "lists", 1),
      kid: needCount(body.kid, "kid", 1),
      card: needCard(body.card, "card"),
      keyring: body.keyring === undefined || body.keyring === null ? null : needKeyring(body.keyring, "keyring"),
    }),
    async (auth, { lists, kid, card, keyring }) => {
      if (params.id !== auth.device) notAllowed("own_device");
      needCurrentLists(auth, lists);
      needCurrentKid(auth, kid);
      const where = "WHERE account = ? AND id = ?";
      await commit(env.DB, [
        guard(env.DB, auth.account, { kid, lists }),
        keyring
          ? env.DB.prepare(
              `UPDATE devices SET card_kid = ?, card_nonce = ?, card_ct = ?, keyring_kid = ?, keyring_enc = ?, keyring_ct = ? ${where}`,
            ).bind(kid, card.nonce, card.ct, kid, keyring.enc, keyring.ct, auth.account, auth.device)
          : env.DB.prepare(`UPDATE devices SET card_kid = ?, card_nonce = ?, card_ct = ? ${where}`).bind(
              kid,
              card.nonce,
              card.ct,
              auth.account,
              auth.device,
            ),
        moveLists(env.DB, auth.account),
      ]);
      return answer({ lists: lists + 1 });
    },
    needOpen,
  );
}

/**
 * DELETE /devices/<id>, from a session attached to that device: signing out.
 * The entry, its sealed keyring, and the device's sessions are removed. The
 * key doesn't change: signing out is the reader's own act on a device they
 * hold. The session need not be open, so a device can still sign out after a
 * change of key it has not caught up with.
 */
export function deleteDevice({ request, env, params }) {
  return changing(request, env, null, async (auth) => {
    if (!auth.sessionDevice || params.id !== auth.sessionDevice) notAllowed("own_device");
    // An entry already gone (removed by another device) leaves only the sessions to end.
    const listed = auth.device !== null;
    await commit(env.DB, [
      guard(env.DB, auth.account, { lists: auth.lists }),
      env.DB.prepare("DELETE FROM devices WHERE account = ? AND id = ?").bind(auth.account, params.id),
      env.DB.prepare("DELETE FROM sessions WHERE account = ? AND device = ?").bind(auth.account, params.id),
      ...(listed ? [moveLists(env.DB, auth.account)] : []),
    ]);
    return answer({ lists: auth.lists + (listed ? 1 : 0) });
  });
}

/**
 * POST /holders, from an open session: a way back is added without a change
 * of key (a first recovery code, or a passkey when "follows my account" is
 * turned on). { lists, kid, holder: { id, kind, credential?, record, card, keyring } }.
 */
export function postHolders({ request, env }) {
  return changing(
    request,
    env,
    (body) => ({
      lists: needCount(body.lists, "lists", 1),
      kid: needCount(body.kid, "kid", 1),
      holder: needHolder(body.holder, "holder"),
    }),
    async (auth, { lists, kid, holder }) => {
      needCurrentLists(auth, lists);
      needCurrentKid(auth, kid);
      const existing = (await readLists(env.DB, auth.account)).holders;
      if (existing.some((h) => h.id === holder.id)) refuse(409, "exists", { what: "holder" });
      if (holder.kind === "recovery" && existing.some((h) => h.kind === "recovery")) {
        refuse(409, "exists", { what: "recovery" });
      }
      if (holder.kind === "passkey") {
        await needSyncedPasskeys(env.DB, auth.account, [holder.credential]);
        if (existing.some((h) => h.credential === holder.credential)) refuse(409, "exists", { what: "passkey" });
      }
      needRoomForHolders(existing.length + 1);
      await commit(env.DB, [
        guard(env.DB, auth.account, { kid, lists }),
        insertHolder(env.DB, auth.account, holder, { kid, by: auth.device, time: now() }),
        moveLists(env.DB, auth.account),
      ]);
      return answer({ lists: lists + 1 });
    },
    needOpen,
  );
}
