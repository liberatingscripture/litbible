// The account, the key proof, and setting up
// (STUDY-DESK-ENCRYPTION.md, "The service's interface": "The account" and
// "Setting up").

import { answer, notAllowed, now, refuse } from "./http.js";
import { LIMITS, needArray, needBytes, needCount, needDeviceEntry, needHolder, needUuid } from "./check.js";
import { commit, guard } from "./db.js";
import { authenticate, changing, needCurrentKid, needNotebook, needProof, openSession } from "./session.js";
import { insertDevice, insertHolder, needRoomForHolders, needSyncedPasskeys } from "./lists.js";
import { wayOut } from "./signin.js";

/** GET /account, from a signed-in session. */
export async function getAccount({ request, env }) {
  const auth = await authenticate(request, env);
  const { results } = await env.DB.prepare(
    "SELECT id, kind, subject, syncs, created FROM ways WHERE account = ? ORDER BY created, id",
  )
    .bind(auth.account)
    .all();
  return answer({
    notebook: auth.notebook,
    kid: auth.kid,
    lists: auth.lists,
    session: { open: auth.open, device: auth.device, expires: auth.expires },
    ways: results.map(wayOut),
    // A request to delete the account or replace the notebook, while it waits. Step 4f.
    waiting: null,
  });
}

/**
 * POST /session/proof, from a signed-in session: { device, kid, proof }.
 * Checks, in order: the account has a notebook; `kid` is current; the proof;
 * the device has an entry. Then the session is open and attached to it.
 */
export function postProof({ request, env }) {
  return changing(
    request,
    env,
    (body) => ({
      device: needUuid(body.device, "device"),
      kid: needCount(body.kid, "kid", 1),
      proof: needBytes(body.proof, "proof", LIMITS.proofBytes),
    }),
    async (auth, { device, kid, proof }) => {
      needCurrentKid(auth, kid);
      await needProof(env, auth, proof);
      const entry = await env.DB.prepare("SELECT 1 FROM devices WHERE account = ? AND id = ?")
        .bind(auth.account, device)
        .first();
      if (!entry) refuse(410, "gone", { what: "device" });
      // The lists too: the entry just read must still stand when the session is attached to it,
      // or a device signed out a moment ago would keep a session that outlives its sign-out.
      await commit(env.DB, [guard(env.DB, auth.account, { kid, lists: auth.lists }), openSession(env, auth, device, kid)]);
      return answer({ open: true, device, kid });
    },
    needNotebook,
  );
}

/**
 * POST /notebook, from a signed-in session: the first device sets up.
 * { notebook, proofHash, device: { id, card, keyring }, holders: [...] },
 * everything sealed under kid 1.
 *
 * "The account has no notebook" is checked and written as one step: the
 * batch's guard holds the account at kid 0, so of two devices setting up at
 * once the second is rolled back, run again, and told "already_set_up".
 */
export function postNotebook({ request, env }) {
  return changing(
    request,
    env,
    (body) => {
      const input = {
        notebook: needUuid(body.notebook, "notebook"),
        proofHash: needBytes(body.proofHash, "proofHash", LIMITS.proofBytes),
        device: needDeviceEntry(body.device, "device"),
        holders: needArray(body.holders, "holders").map((holder, i) => needHolder(holder, `holders[${i}]`)),
      };
      const { holders } = input;
      if (holders.length < 1) notAllowed("holder_needed");
      needRoomForHolders(holders.length);
      if (holders.filter((h) => h.kind === "recovery").length > 1) notAllowed("one_recovery");
      if (new Set([input.notebook, input.device.id, ...holders.map((h) => h.id)]).size !== holders.length + 2) {
        notAllowed("distinct_ids");
      }
      const credentials = holders.filter((h) => h.kind === "passkey").map((h) => h.credential);
      if (new Set(credentials).size !== credentials.length) notAllowed("one_holder_per_passkey");
      return { ...input, credentials };
    },
    async (auth, { notebook, proofHash, device, holders, credentials }) => {
      await needSyncedPasskeys(env.DB, auth.account, credentials);
      const time = now();
      const kid = 1;
      await commit(env.DB, [
        // The lists too: a passkey read a moment ago as one of the account's ways in must still
        // be one when its holder is stored, and removing a way in moves the lists (src/ways.js).
        guard(env.DB, auth.account, { kid: 0, lists: auth.lists }),
        env.DB.prepare("UPDATE accounts SET notebook = ?, kid = ?, proof_hash = ?, lists = lists + 1 WHERE id = ?").bind(
          notebook,
          kid,
          proofHash,
          auth.account,
        ),
        insertDevice(env.DB, auth.account, device, { kid, how: "setup", time }),
        ...holders.map((holder) => insertHolder(env.DB, auth.account, holder, { kid, by: device.id, time })),
        openSession(env, auth, device.id, kid),
      ]);
      return answer({ notebook, kid, lists: auth.lists + 1, session: { open: true, device: device.id } });
    },
    // The table's first check, made before the body is read: an account that has a notebook
    // is told so whatever the second setup sent.
    (auth) => (auth.kid === 0 ? auth : refuse(409, "already_set_up", { notebook: auth.notebook })),
  );
}
