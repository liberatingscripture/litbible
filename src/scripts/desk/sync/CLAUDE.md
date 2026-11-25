# Syncing the notebook (the website's connector)

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory. It governs the synced notebook's client wherever it
> lives: the rules in `src/lib/desk-sync.mjs`, the loop in
> `src/lib/desk-sync-engine.mjs`, the link in `src/lib/desk-sync-link.mjs`,
> the status words in `src/lib/desk-sync-status.mjs`, the browser's half
> here, and `src/styles/desk-sync.css`.
> Syncing is part of the Study Desk, so **`src/scripts/desk/CLAUDE.md`
> applies here too**; read it unless it is already loaded. The service this
> talks to is `workers/notebook-service/` (`workers/CLAUDE.md`), and both are
> built to `STUDY-DESK-ENCRYPTION.md`, "The service's interface."

## Where it stands

Built in the plan's step 4g (2026-11-24; `STUDY-DESK.md`, "Order of work,"
4, which says what was verified and what was not). **It is switched on for
nobody**: a browser syncs only once it is linked to an account, and nothing
links one until the account pages (step 4h) exist. Sign-in, setup, joining a
device, and every account page are 4h's; this directory takes a session and
keys from whoever calls it.

**The design choices here were Claude's, and BVJ went through them on
2026-11-24**: yes to the status sentences, how a stop is announced, when a
pass runs, one notebook at a time, and eight of the rules another client
has to match; "Ask BDR" on three (the trash record's tie, a removed device
hearing it in two steps, and a wrong clock said but not enforced). **All of
the rules another client has to match are still open with BDR**: the spec's
"Still open," 74 to 84, and `STUDY-DESK-FOR-THE-APPS.md`, ask 16. So keep
each one cheap to change: one constant, one function, one place.

## Where the code is

- `src/lib/desk-sync.mjs`: the rules, pure. **Its header is the statement of
  the six rules**, and of what an entry holds. Read it before changing what
  is pushed, removed, or held back.
- `src/lib/desk-sync-engine.mjs`: one pass (open the session, pull, merge,
  push, reseal). No storage, network, timer, or DOM of its own; each is
  handed in, so it runs whole under `node --test`.
- `src/lib/desk-sync-link.mjs`: what says a browser is linked, the names of
  the database, the lock, and the channel, and the services a page may talk
  to. **It imports nothing**, because the store and the first stage read it
  in every desk reader's page.
- `src/lib/desk-sync-status.mjs`: every sentence the reader sees.
- Here: `start.js` (the one way in, and what step 4h calls), `connector.js`
  (which tab syncs, and when a pass runs), `service.js` (one request),
  `sync-db.js` (the sync's storage), `status-line.js`, `stopped-notice.js`.

## The rules

1. **Never a silent stop, and never lost work** (BVJ's standing requirements
   for sync). Three things hold them, and a change must keep all three:
   - **No pass deletes a key, a session, or a record because of what the
     service answered.** A device that is signed out, removed, or pointed at
     another notebook stops, says so, and keeps everything (the spec:
     throwing keys away on the service's word would let the service lock a
     reader out).
   - **A stop only the reader can settle is always said, and never retried
     on a timer** (`needsReader` in `desk-sync-status.mjs`): the status
     line, a dot on the Notebook's tab and buttons, and a notice with
     "Reconnect" on whatever page the reader is on, once for each stop and
     again a day later. A new state that needs the reader goes in that set
     and gets a sentence that says where the notebook is.
   - **A row is removed from the service only on evidence** (rule 4 in
     `desk-sync.mjs`). A record missing from this browser is fetched again,
     never deleted for every device.
2. **Readers download none of it.** Only `desk/store.js` and
   `desk/first-stage.js` import `start.js`, dynamically, and only after
   reading a link from the notebook. Nothing else imports anything here
   statically, `desk-sync-link.mjs` imports nothing, and `desk-sync.css` is
   only ever imported `?inline`. `test/desk-sync-gate.test.js` holds each,
   and holds `src/lib/desk-account.mjs` (the account's key flows, step 4h)
   the same way, since it brings the encryption with it.
   After a change to what imports what, build and check that no page
   reaches the sync's chunk without a link.
3. **The queue is a difference, not a list** (`desk-sync.mjs`'s header).
   Nothing marks an edit as "to send": what is owed is whatever in the
   notebook no longer matches its entry. So no write to the notebook needs
   to know about the sync. **But the loop hears of a change from the store's
   notice** (`store.subscribe`, in this tab or from another), and rereads
   the whole notebook only when a tab starts leading. A write that tells no
   listener is not pushed until then.
4. **The notebook is written first and the sync's state second**, in two
   transactions, and either may be lost: a merge whose state was never
   written is pulled again and changes nothing, and a push whose answer was
   never recorded comes back as a row this device already holds. Don't add
   anything that is correct only if both land.
5. **Storage is one value and one database.** The link is the `sync` value
   in the notebook's own meta store, so a notebook that is deleted or made
   anew is not linked. Everything else is the IndexedDB database
   `lit-desk-sync` (`sync-db.js`'s header lists it): the device's keys as
   `CryptoKey`s that can't be read out, the session, the sealed keyring, an
   entry for each row, and rows kept sealed until they can be read. **No
   local storage, no session storage, no cookie, and no record in the
   clear.** `/privacy` names the database, and
   `test/desk-storage-keys.test.js` fails on any other storage here. A new
   store or value is named on `/privacy` in the same change.
6. **A page talks only to the three origins in `SERVICES`**, the local one
   only from a page served from this computer (`allowedService`). The link
   is read back from storage, and a stored address must never be able to
   send a session to another host. `public/_headers` names the two deployed
   origins in `connect-src`; a new origin goes in both.
7. **One tab syncs for the browser** (a Web Lock; `connector.js`'s header).
   The channel between tabs carries status and requests, never anything of
   the notebook, and a keyring only sealed to this device's own key.
8. **The key is the reference's business** (`src/lib/desk-crypto.mjs`). A
   keyring from the service is checked against the one held before it is
   used (`checkKeyring`), a wrong proof is never sent twice, and
   `linkNotebook` refuses a private key that can be read out.
9. **The service's row wins an exact tie** (`SERVICE_WINS_TIE`). It is the
   format's proposal of step 4d, not a decision; keep it one constant.
10. **BVJ said yes to the words as written** (2026-11-24), and to the dot
    with a notice once for each stop and again a day later. They follow the
    site's conventions (`test/desk-sync-status.test.js` checks curly quotes
    and no em dashes), and every sentence for a stop says the notebook is
    still on this computer. A new sentence is a new thing to show BVJ.

## A place for the status line

A desk page that wants the line leaves an empty, hidden element marked
`data-desk-sync-slot` and dispatches `SLOT_EVENT` on `document` when it
makes or shows one (the Notebook's Settings tab and `/notebook` do). An
unlinked browser never loads the code that fills it. `/desk` has no slot yet
(the dot and the notice only), and `/sheets` shows nothing of a stop, since
the notice never comes up over a sheet's page. **BVJ on the places
(2026-11-24): "good so far. I think the place on /desk should be tied to the
page menu."** Claude reads that as /desk's title menu ("Study Desk ▾",
`desk/title-menu.js`); it is not built.

## What step 4h calls

`start.js`'s header is the surface: `linkNotebook`, `currentSync`, `unlink`,
and `LinkRefused`; `connector.js` documents each method of the connector
(`status`, `subscribe`, `syncNow`, `setSession`, `call`, `device`,
`keyring`, `adopt`). Three things 4h must not assume:

- **"Reconnect" only asks for another pass.** For a reader who is signed
  out, removed, on another notebook, or without keys, 4h supplies the step
  behind it (sign in again and `setSession`; join again and `linkNotebook`).
- **A browser linked to another notebook is refused** unless the caller
  passes `replace: true`, which is the reader's own yes and 4h's to ask.
- **Several sentences on the desk become false in a linked browser**
  ("kept in this browser," "never leaves this computer"); the list is under
  step 4g in `STUDY-DESK.md`.

## Testing

- **`npm run test:desk` runs it all** (`test/desk-sync*.test.js`): the
  rules, the loop against every answer of the service, the edges (clocks,
  rows that can't be read, a restored service), seeded property tests over
  random histories, the connector in a happy-dom page (the real store and
  the real sync storage over `fake-indexeddb`, timers fired by hand), the
  status line and the notice, and the gate.
- **The account's tests run against the service's own code instead**
  (`test/helpers/real-notebook-service.mjs`;
  `src/scripts/desk/account/CLAUDE.md`, "Testing"). Use that for a flow,
  and the stand-in below for a service that has to break at an exact point.
- **The stand-in service is `test/helpers/fake-notebook-service.mjs`.** It
  repeats the real service's checks, words, and order by hand, so **a change
  to `workers/notebook-service/src/rows.js`, `session.js`, or `check.js`
  needs the same change there**, or these tests pass against a service that
  no longer exists. `sync-rig.mjs` makes devices; `sync-browser.mjs` makes
  the page.
- **End to end is a real browser against `wrangler dev`**, in
  `workers/notebook-service/` with a `.dev.vars` made for this machine
  (never the deployed preview's secret). The local service answers CORS for
  `http://localhost:4321`. A backgrounded `wrangler dev` outlives its shell
  on Windows: end its process tree and check the port when finished.
  Editing a module under Vite's dev server gives page script a second copy
  of it, so restart the server before reading `currentSync()` from the
  console.
