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

/**
 * The approval with this id, if it is this account's and still in time. Otherwise "gone".
 * `through` is the way in of the session that asked, read from that session as it stands
 * (null once it has ended), so the device asked to approve can say how the request was made
 * (Audit 9, SEC9-1; BVJ, 2026-11-26).
 */
async function needApproval(env, auth, id, time) {
  if (!isApprovalId(id)) bad("id");
  const approval = await env.DB.prepare(
    `SELECT approvals.*,
            (SELECT ways.kind FROM sessions JOIN ways ON ways.id = sessions.way AND ways.account = sessions.account
              WHERE sessions.token_hash = approvals.session) AS through
       FROM approvals WHERE account = ? AND id = ? AND expires > ?`,
  )
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
      const time = now();
      const [approvals, entry] = await env.DB.batch([
        env.DB.prepare("SELECT id FROM approvals WHERE account = ? AND expires > ?").bind(auth.account, time),
        env.DB.prepare("SELECT 1 FROM devices WHERE account = ? AND id = ?").bind(auth.account, input.device),
      ]);
      if (approvals.results.some((a) => a.id === input.id)) refuse(409, "exists", { what: "approval" });
      if (entry.results.length) refuse(409, "exists", { what: "device" });
      const tooMany = () => refuse(429, "too_many", { what: "approvals", limit: LIMITS.approvals });
      if (approvals.results.length >= LIMITS.approvals) tooMany();
      const expires = after(time, APPROVAL_MINUTES * 60 * 1000);
      const [, , made] = await commit(env.DB, [
        guard(env.DB, auth.account, { kid: auth.kid, lists: auth.lists }),
        // Ones that ran out are swept here, where the next one is made.
        env.DB.prepare("DELETE FROM approvals WHERE account = ? AND expires <= ?").bind(auth.account, time),
        // The limit is counted again inside the write: an approval moves none of the account's
        // numbers, so the guard can't see one made a moment ago by a request racing this one.
        env.DB.prepare(
          `INSERT INTO approvals (account, id, session, device, platform, model, public, sign, mac, created, expires)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            WHERE (SELECT COUNT(*) FROM approvals WHERE account = ? AND expires > ?) < ?`,
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
          auth.account,
          time,
          LIMITS.approvals,
        ),
      ]);
      if (made.meta.changes !== 1) tooMany();
      return answer({ id: input.id, expires });
    },
    // Signed in and not open: a device that has the key has nothing to ask for.
    (auth) => (auth.open ? notAllowed("already_open") : needNotebook(auth)),
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
      created: a.created,
      through: a.through ?? null,
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
      const time = now();
      const approval = await needApproval(env, auth, params.id, time);
      if (approval.granted_by) refuse(409, "exists", { what: "grant" });
      needCurrentKid(auth, kid);
      const [, granted] = await commit(env.DB, [
        // The lists too, so the granting device still has its entry when its grant is kept.
        guard(env.DB, auth.account, { kid, lists: auth.lists }),
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
    needOpen,
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
    needNotebook,
  );
}
