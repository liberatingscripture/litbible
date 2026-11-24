// Approvals: adding a device from one that already has the key
// (STUDY-DESK-ENCRYPTION.md, "By approval," and "The service's interface":
// "Approvals").
//
// The service is a mailbox here and nothing more. It can check neither MAC,
// since both are made with a key that comes from the approval code, which it
// never sees. It keeps the request and the grant for the two devices, shows
// them only to sessions of the same account, and drops them after ten
// minutes, on a change of key, or once the new device accepts.

import { after, answer, bad, notAllowed, now, refuse } from "./http.js";
import { LIMITS, isApprovalId, needBytes, needCard, needCount, needKeyring, needText, needUuid } from "./check.js";
import { commit, guard } from "./db.js";
import { authenticate, changing, needCurrentKid, needNotebook, needOpen, needProof, openSession } from "./session.js";
import { insertDevice, moveLists, needRoomForDevice } from "./lists.js";

export const APPROVAL_MINUTES = 10;

/** The approval with this id, if it is this account's and still in time. Otherwise "gone". */
async function needApproval(env, auth, id, time) {
  if (!isApprovalId(id)) bad("id");
  const approval = await env.DB.prepare("SELECT * FROM approvals WHERE account = ? AND id = ? AND expires > ?")
    .bind(auth.account, id, time)
    .first();
  return approval ?? refuse(410, "gone", { what: "approval" });
}

/**
 * POST /approvals, from a session that is signed in and not open: a new
 * device asks to join. { id, device, platform, model, public, sign, mac }.
 */
export function postApprovals({ request, env }) {
  return changing(
    request,
    env,
    (body) => ({
      id: isApprovalId(body.id) ? body.id : bad("id"),
      device: needUuid(body.device, "device"),
      platform: needText(body.platform, "platform", LIMITS.platformChars),
      model: needText(body.model, "model", LIMITS.modelChars),
      public: needBytes(body.public, "public", LIMITS.pointBytes),
      sign: needBytes(body.sign, "sign", LIMITS.pointBytes),
      mac: needBytes(body.mac, "mac", LIMITS.proofBytes),
    }),
    async (auth, input) => {
      if (auth.open) notAllowed("already_open");
      needNotebook(auth);
      const time = now();
      const [approvals, entry] = await env.DB.batch([
        env.DB.prepare("SELECT id FROM approvals WHERE account = ? AND expires > ?").bind(auth.account, time),
        env.DB.prepare("SELECT 1 FROM devices WHERE account = ? AND id = ?").bind(auth.account, input.device),
      ]);
      if (approvals.results.some((a) => a.id === input.id)) refuse(409, "exists", { what: "approval" });
      if (entry.results.length) refuse(409, "exists", { what: "device" });
      if (approvals.results.length >= LIMITS.approvals) {
        refuse(429, "too_many", { what: "approvals", limit: LIMITS.approvals });
      }
      const expires = after(time, APPROVAL_MINUTES * 60 * 1000);
      await commit(env.DB, [
        guard(env.DB, auth.account, { kid: auth.kid, lists: auth.lists }),
        // Ones that ran out are swept here, where the next one is made.
        env.DB.prepare("DELETE FROM approvals WHERE account = ? AND expires <= ?").bind(auth.account, time),
        env.DB.prepare(
          `INSERT INTO approvals (account, id, session, device, platform, model, public, sign, mac, created, expires)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          auth.account,
          input.id,
          auth.tokenHash,
          input.device,
          input.platform,
          input.model,
          input.public,
          input.sign,
          input.mac,
          time,
          expires,
        ),
      ]);
      return answer({ id: input.id, expires });
    },
  );
}

/** GET /approvals/<id>, from a signed-in session: the request, and the grant if there is one. */
export async function getApproval({ request, env, params }) {
  const auth = await authenticate(request, env);
  const a = await needApproval(env, auth, params.id, now());
  return answer({
    approval: {
      id: a.id,
      device: a.device,
      platform: a.platform,
      model: a.model,
      public: a.public,
      sign: a.sign,
      mac: a.mac,
      expires: a.expires,
      grant: a.granted_by
        ? {
            kid: a.grant_kid,
            card: { nonce: a.grant_card_nonce, ct: a.grant_card_ct },
            keyring: { enc: a.grant_enc, ct: a.grant_ct },
            mac: a.grant_mac,
            by: a.granted_by,
          }
        : null,
    },
  });
}

/**
 * POST /approvals/<id>/grant, from an open session: { kid, card, keyring, mac }.
 * Refused when `kid` isn't current, so no approval crosses a change of key.
 */
export function postGrant({ request, env, params }) {
  return changing(
    request,
    env,
    (body) => ({
      kid: needCount(body.kid, "kid", 1),
      card: needCard(body.card, "card"),
      keyring: needKeyring(body.keyring, "keyring"),
      mac: needBytes(body.mac, "mac", LIMITS.proofBytes),
    }),
    async (auth, { kid, card, keyring, mac }) => {
      needOpen(auth);
      const time = now();
      const approval = await needApproval(env, auth, params.id, time);
      if (approval.granted_by) refuse(409, "exists", { what: "grant" });
      needCurrentKid(auth, kid);
      const [, granted] = await commit(env.DB, [
        guard(env.DB, auth.account, { kid }),
        env.DB.prepare(
          `UPDATE approvals SET granted_by = ?, grant_kid = ?, grant_card_nonce = ?, grant_card_ct = ?,
                                grant_enc = ?, grant_ct = ?, grant_mac = ?
            WHERE account = ? AND id = ? AND granted_by IS NULL AND expires > ?`,
        ).bind(auth.device, kid, card.nonce, card.ct, keyring.enc, keyring.ct, mac, auth.account, approval.id, time),
      ]);
      // Two devices granting at once: the second finds the grant already there.
      if (granted.meta.changes !== 1) refuse(409, "exists", { what: "grant" });
      return answer({ id: approval.id });
    },
  );
}

/**
 * POST /approvals/<id>/accept, from the session that made the request:
 * { kid, proof }. The new device has checked the grant, kept the keyring, and
 * now proves the key. It is listed with the grant's card and keyring, as
 * added by the granting device.
 */
export function postAccept({ request, env, params }) {
  return changing(
    request,
    env,
    (body) => ({
      kid: needCount(body.kid, "kid", 1),
      proof: needBytes(body.proof, "proof", LIMITS.proofBytes),
    }),
    async (auth, { kid, proof }) => {
      needNotebook(auth);
      const approval = await needApproval(env, auth, params.id, now());
      if (approval.session !== auth.tokenHash) notAllowed("requester");
      if (!approval.granted_by) notAllowed("no_grant");
      needCurrentKid(auth, kid);
      // A grant under another kid can't be accepted; a change of key drops approvals, so this is belt and braces.
      if (approval.grant_kid !== kid) refuse(409, "old_key", { kid: auth.kid });
      await needProof(env, auth, proof);
      const { results: devices } = await env.DB.prepare("SELECT id FROM devices WHERE account = ?")
        .bind(auth.account)
        .all();
      if (devices.some((d) => d.id === approval.device)) refuse(409, "exists", { what: "device" });
      needRoomForDevice(devices.length);
      const device = {
        id: approval.device,
        card: { nonce: approval.grant_card_nonce, ct: approval.grant_card_ct },
        keyring: { enc: approval.grant_enc, ct: approval.grant_ct },
      };
      await commit(env.DB, [
        guard(env.DB, auth.account, { kid, lists: auth.lists }),
        insertDevice(env.DB, auth.account, device, { kid, how: "approval", by: approval.granted_by, time: now() }),
        env.DB.prepare("DELETE FROM approvals WHERE account = ? AND id = ?").bind(auth.account, approval.id),
        moveLists(env.DB, auth.account),
        openSession(env, auth, device.id, kid),
      ]);
      return answer({ kid, lists: auth.lists + 1, session: { open: true, device: device.id } });
    },
  );
}
