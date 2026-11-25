// src/lib/desk-sync-offline.mjs
//
// "No answer came": what the request carrier (src/scripts/desk/sync/service.js)
// throws when the notebook service can't be reached at all. It is a file of
// its own, and imports nothing, so that the carrier can be loaded without
// the sync loop and the encryption behind it: the account's basics on a
// phone sign in and delete an account, and hold no notebook
// (src/scripts/desk/account/CLAUDE.md). The loop re-exports it
// (desk-sync-engine.mjs), so everything that caught it there still does.

/** Thrown by `api.call` when the service can't be reached at all. */
export class Offline extends Error {
  constructor(message = "the notebook service can't be reached", options) {
    super(message, options);
    this.name = "Offline";
  }
}
