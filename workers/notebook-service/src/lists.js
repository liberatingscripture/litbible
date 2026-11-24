// The device list and the holder list: the statements that write an entry,
// the shapes an entry is answered in, and the checks several requests share.
//
// The service can read none of what it stores here but the plain columns: a
// card, a keyring, and a holder's record are sealed, and it keeps each as the
// text it arrived in.

import { notAllowed, refuse } from "./http.js";
import { LIMITS } from "./check.js";

/** A sealed card as it is answered: with the kid it was sealed under. */
const cardOut = (row) => ({ kid: row.card_kid, nonce: row.card_nonce, ct: row.card_ct });

/** A sealed keyring as it is answered: with the kid that is its `current`. */
export const keyringOut = (row) => ({ kid: row.keyring_kid, enc: row.keyring_enc, ct: row.keyring_ct });

/** A device as `GET /devices` answers it. */
export const deviceOut = (row) => ({
  id: row.id,
  card: cardOut(row),
  added: row.added,
  how: row.added_how,
  by: row.added_by,
  seen: row.seen,
});

/** A holder as `GET /devices` answers it: its card, never its record. */
export const holderCardOut = (row) => ({
  id: row.id,
  kind: row.kind,
  ...(row.credential ? { credential: row.credential } : {}),
  card: cardOut(row),
  added: row.added,
  by: row.added_by,
});

/** A holder as `GET /holders` answers it: its record and its keyring, never its card. */
export const holderRecordOut = (row) => ({
  id: row.id,
  kind: row.kind,
  ...(row.credential ? { credential: row.credential } : {}),
  record: { nonce: row.record_nonce, ct: row.record_ct },
  keyring: keyringOut(row),
});

/**
 * Lists a device. `how` is 'setup', 'approval', 'passkey', or 'recovery';
 * `by` is the approving device's id or the holder's the device came in
 * through. `card` and `keyring` were both sealed under `kid`.
 */
export function insertDevice(db, account, device, { kid, how, by = null, time }) {
  return db
    .prepare(
      `INSERT INTO devices (account, id, card_kid, card_nonce, card_ct, keyring_kid, keyring_enc, keyring_ct,
                            added, added_how, added_by, seen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(account, device.id, kid, device.card.nonce, device.card.ct, kid, device.keyring.enc, device.keyring.ct, time, how, by, time);
}

/** Stores a holder, added from the device `by`. */
export function insertHolder(db, account, holder, { kid, by, time }) {
  return db
    .prepare(
      `INSERT INTO holders (account, id, kind, credential, record_nonce, record_ct, card_kid, card_nonce, card_ct,
                            keyring_kid, keyring_enc, keyring_ct, added, added_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      account,
      holder.id,
      holder.kind,
      holder.credential,
      holder.record.nonce,
      holder.record.ct,
      kid,
      holder.card.nonce,
      holder.card.ct,
      kid,
      holder.keyring.enc,
      holder.keyring.ct,
      time,
      by,
    );
}

/** The statement every change to either list ends with: the lists' version moves. */
export const moveLists = (db, account) =>
  db.prepare("UPDATE accounts SET lists = lists + 1 WHERE id = ?").bind(account);

/** Every device's id, and every holder's id, kind, and credential, read together. */
export async function readLists(db, account) {
  const [devices, holders] = await db.batch([
    db.prepare("SELECT id FROM devices WHERE account = ?").bind(account),
    db.prepare("SELECT id, kind, credential FROM holders WHERE account = ?").bind(account),
  ]);
  return { devices: devices.results, holders: holders.results };
}

/**
 * A passkey holder's credential must be one of this account's passkeys, and
 * one marked as the kind that syncs: a passkey that stays on one computer or
 * one security key signs the reader in and holds nothing.
 */
export async function needSyncedPasskeys(db, account, credentials) {
  if (!credentials.length) return;
  const { results } = await db
    .prepare("SELECT subject, syncs FROM ways WHERE account = ? AND kind = 'passkey'")
    .bind(account)
    .all();
  const mine = new Map(results.map((way) => [way.subject, way.syncs]));
  for (const credential of credentials) {
    if (!mine.has(credential)) notAllowed("passkey_unknown");
    if (!mine.get(credential)) notAllowed("passkey_not_synced");
  }
}

/** Refuses another device once the list is full. */
export function needRoomForDevice(count) {
  if (count >= LIMITS.devices) refuse(429, "too_many", { what: "devices", limit: LIMITS.devices });
}

/** Refuses more holders than the list may hold. */
export function needRoomForHolders(count) {
  if (count > LIMITS.holders) refuse(429, "too_many", { what: "holders", limit: LIMITS.holders });
}
