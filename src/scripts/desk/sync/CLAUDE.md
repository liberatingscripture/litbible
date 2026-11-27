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
nobody**: a browser syncs only once it is linked to an account, only the
account pages link one (step 4h; `src/scripts/desk/account/CLAUDE.md`), and
those are closed until opened in one browser with `?account=preview`.
Sign-in, setup, joining a device, and every account page are theirs; this
directory takes a session and keys from whoever calls it.

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
  `sync-db.js` (the sync's storage), `status-line.js`, `stopped-notice.js`,
  `account-notice.js` (rule 11), and `notice-parts.js` (the dot and the bar
  the two notices share).

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
     line, a dot on the Notebook's tab and buttons (and on the header's
     account button), and a notice with "Reconnect" on whatever page the
     reader is on, once for each stop and again a day later. **"Reconnect"
     for such a stop opens the account page** (`ACCOUNT_PAGE`; BVJ,
     2026-11-24), which names the real step; for every other stop it asks
     for another pass. A new state that needs the reader goes in that set
     and gets a sentence that says where the notebook is. Featherboa
     drops that notice: a stop is said by the status line and the dot
     alone, while rule 11's two notices keep their bar
     (`SITE-FEATHERBOA.md`, "First visit, signing in, and sync"); until
     it is built, this holds.
   - **A full account is a wait, not a loop** (the service's ceiling of
     100,000 rows and 100 MB; BVJ, 2026-11-26). The push the ceiling refuses
     is refused whole, so for `FULL_WAIT_MS` (an hour) after it the engine
     sends no rows; its passes still pull and send removals, end "full" with
     what waits counted, and "Reconnect" tries at once. It is not in
     `needsReader` (no dot, no notice): the status line says it. The words
     are BVJ's (2026-11-26).
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
   `linkNotebook` refuses a private key that can be read out. **A keyring
   is held in memory only once every check on it has passed** (the one this
   browser kept, at `openSession`, included), since a held keyring is what
   the next pass checks against; and **one handed to `adopt` with none held
   is still refused below `meta.highest`** (iOS's answers, 18 and 19).
9. **The service's row wins an exact tie** (`SERVICE_WINS_TIE`). It is the
   format's proposal of step 4d, not a decision; keep it one constant.
10. **BVJ said yes to the words as written** (2026-11-24), and to the dot
    with a notice once for each stop and again a day later. They follow the
    site's conventions (`test/desk-sync-status.test.js` checks curly quotes
    and no em dashes), and every sentence for a stop says the notebook is
    still in this browser. A new sentence is a new thing to show BVJ.
11. **Two things about the account are said on the page being read, not
    only on the account's home** (BVJ, 2026-11-25, of Claude's mock of
    where they would show: “Go with all your recommendations and choices
    for the mockup”). `account-notice.js` mounts beside the stopped notice;
    its rules and words are in `desk-sync-status.mjs`, and the dot and the
    bar are `notice-parts.js`, shared with the stop's.
    - **A request that waits** (to delete the account, or to replace its
      notebook) **is told as a stop is told**: the dot in every place a
      stop's goes (`<html data-desk-account="waiting">`), and the notice
      bar with the status line's own sentence and one button, “Review,”
      once for each request and again a day later for as long as it waits.
      The seven days protect a reader only if their devices say so. It
      costs no request: every pass already asks the account.
    - **A device that joined, or a new way to open the notebook** (a
      recovery code, a passkey that carries the key) **puts a dot on the
      header's account button alone** (`data-desk-account="news"`) and the
      bar once, with “Review” and “OK.” A device that joins can read the
      whole notebook at once, with no wait, so hearing of it soon is the
      only defense. **“OK” is the account home's own “OK”**: it writes the
      same `seen` value. A bar closed without an answer is not put up
      again, and the dot stays until either “OK.”
    - **“Review” opens the account page**, where the request is canceled
      or the device removed. The bar never does either itself.
    - **Not announced here**: a request this browser's own sign-in made
      (`mine`), and a device this computer approved, since the reader did
      both on this computer. **Never over a tour, a print, a sheet's own
      page, or another notice** (`barFree`, the stop's rule), and never on
      the account pages, which say both themselves. A phone has none of it.
    - **One painter owns every dot** (`markDots`): the two attributes the
      stylesheet draws from, and what each dotted button says to a screen
      reader, the most pressing reason first (a stop, then a request that
      waits, then what is new). A new reason for a dot goes through it, or
      two notices write over each other's `aria-description`.
    - **What is new costs a request of its own, `GET /devices`, at most
      every fifteen minutes for a browser** (`NEWS_EVERY_MS`, as often as
      a pass asks the account), from whichever page is open when it falls
      due, and once more on a page that finds something found earlier and
      never said (it was found under a tour, or on a sheet's page). The
      names are read with the notebook's key and kept in memory only:
      storage holds ids and times (`asked` and `news`, in `sync-db.js`'s
      header and on `/privacy`). **The account's model and its words are
      imported when a read is due, never with the page**
      (`test/desk-sync-gate.test.js`): `desk-account.mjs` is every key
      flow the account has.
    - **“Cancel the request” on the account page asks for a pass**
      (`syncNow`), so the status line and this notice hear at once that
      the request is gone. Without it they went on saying it for up to
      fifteen minutes.
    - **Claude's, which BVJ approved** (2026-11-25: “I approve your
      choices that were still unconfirmed.”): what a screen reader hears
      on a dotted button (“A request is waiting on your account,” “New on
      your account”), the fifteen minutes, and the minute a failed read
      waits before the next. **Not built**: a line in the account menu
      saying what the dot on its button stands for (the mock's 2B, which
      BVJ didn't take), so once the bar is closed the dot's words are a
      screen reader's alone until the account page is opened.

12. **A stop is final** (Audit 9, SY9b-2; BVJ approved the fix,
    2026-11-26). `unlink`, and every `stopCurrent` in `start.js` (linking
    anew, `setSyncEnv`), waits for the pass that is running, and once
    stopped that pass makes no request and no write: the engine's `stop()`
    sets a flag checked before and after each request, before each write of
    the sync's state, and inside the notebook's own transaction for a merge.
    The connector aborts the request in flight (`createApi`'s `signal`) and
    lets go of the Web Lock only once the pass has ended, so no other tab
    leads while it finishes. A closed `sync-db.js` handle refuses every call
    instead of opening the database again; a connection the browser takes
    away (another tab deleting the database, or a newer page upgrading it)
    still opens again. A stopped connector's `call` fails as `Offline`, so
    the account pages make their requests before they stop it.
    `test/desk-sync-stop.test.js` drives the audit's two races with a gated
    service.

13. **A failure that never ends is said after five passes and ten minutes** (Audit 9,
    SY9b-4; BVJ approved it, 2026-11-26). A refusal the engine has no state
    for ends a pass in `error`, which the connector retries on its backoff
    for ever. The engine counts the passes in a row that ended in `error`
    for the same reason (`status.streak`, and `status.failingFor`, the time since the first of them by the
    engine's own `now`); a success, a stop, or another
    reason starts the count over, and an offline pass leaves it. At
    `STUCK_AFTER` (5) and `STUCK_MS` (10 minutes) both reached (the backoff alone
    does five passes in about 75 seconds) `isStuck` is true and the notice
    bar says the words in `desk-sync-status.mjs` (the reason in them), once
    for each reason and again a day later (`noticeKey`, kept as `told`'s
    state `error:<reason>`). It is **not** in `NEEDS_READER`: no dot, the
    connector keeps retrying behind it, and its "Reconnect" asks for a pass
    now rather than opening the account page. The bar carries no link, so
    "Contact page" is plain text.

## A place for the status line

A desk page that wants the line leaves an empty, hidden element marked
`data-desk-sync-slot` and dispatches `SLOT_EVENT` on `document` when it
makes or shows one (the Notebook's Settings tab, `/notebook`, the account's
home, and the header's account menu when it opens). An unlinked browser
never loads the code that fills it. `/sheets` shows nothing of a stop but
the header's dot, since the notice never comes up over a sheet's page.
**On /desk and every other page the place is the header's account menu**
(BVJ, 2026-11-24, of Claude's pick: the status lives in that menu and
"Study Desk ▾" stays as it is; it settles the earlier "tied to the page
menu"). The entry is `src/scripts/desk/account/CLAUDE.md`, rule 17. On a
page that runs no connector (About, say) the menu holds its two links and
no status. **On the account page the stop is the page's to show**: the
status line draws no "Reconnect" for a stop that needs the reader, and the
notice never comes up there. Featherboa shows the same line at the foot
of the Study sidebar and of the Read page's Notebook panel, and keeps the
header's account menu (`SITE-FEATHERBOA.md`, "First visit, signing in,
and sync"); until it is built, this holds.

## What the account pages supply

`start.js`'s header is the surface: `linkNotebook`, `currentSync`, `unlink`,
and `LinkRefused`; `connector.js` documents each method of the connector
(`status`, `subscribe`, `syncNow`, `setSession`, `call`, `device`,
`keyring`, `adopt`). The account pages (step 4h;
`src/scripts/desk/account/CLAUDE.md`) are their only caller, and supply
what the sync leaves to the reader:

- **The step behind "Reconnect."** For a reader who is signed out, removed,
  on another notebook, or without keys, the account's home offers the real
  step: sign in again (`setSession`), or join again (`linkNotebook`), each
  beside "Stop syncing in this browser" (`unlink`).
- **The reader's yes for `replace: true`.** A browser linked to another
  notebook is refused unless the caller passes it; the one place that does
  is "Join the new notebook" (the account file's rule 15).
- **Several sentences on the desk become false in a linked browser**
  ("kept in this browser," "never leaves this browser"); the list is under
  step 4g in `STUDY-DESK.md`. One is changed (`keptLine` in
  `desk-reminder.mjs`: "Kept in this browser and in your account."); the
  rest are step 4j's.

## Testing

- **`npm run test:desk` runs it all** (`test/desk-sync*.test.js`): the
  rules, the loop against every answer of the service, the edges (clocks,
  rows that can't be read, a restored service), seeded property tests over
  random histories, the connector in a happy-dom page (the real store and
  the real sync storage over `fake-indexeddb`, timers fired by hand), the
  status line and the notice, and the gate. The account's notices
  (`test/desk-sync-account-notice.test.js`) are driven both ways: one
  status at a time with a hand-made connector, and whole flows against
  the service's own code.
- **The account's tests run against the service's own code instead**
  (`test/helpers/real-notebook-service.mjs`;
  `src/scripts/desk/account/CLAUDE.md`, "Testing"). Use that for a flow,
  and the stand-in below for a service that has to break at an exact point.
- **The stand-in service is `test/helpers/fake-notebook-service.mjs`.** It
  repeats the real service's checks, words, and order by hand, so **a change
  to `workers/notebook-service/src/rows.js`, `session.js`, `account.js`,
  `http.js`, or `check.js` needs the same change there**, or these tests
  pass against a service that no longer exists. Its header says what it
  leaves out. `test/desk-sync-fake-service.test.js` sends the same requests
  to it and to the service's own code where the order of checks decides the
  answer (no session, a session not open, a body too large) and fails where
  they part (Audit 9, SY9-2); a refusal the stand-in learns joins its cases.
  Its `fetch` honors an abort as a browser's does: the fetch fails at once,
  and a request already sent goes on at the service. `onCall` can hold a
  request to make a race exact. `sync-rig.mjs` makes devices;
  `sync-browser.mjs` makes the page.
- **A linked page makes one request of its own once it is in step**: the
  account notice's look at what is new, `GET /devices` (rule 11), sent after
  reads of its own storage, so on a slow machine it can land well after the
  status reaches `upToDate`. A test that counts the service's calls waits
  for it first, as the linked pages of `desk-sync-status-line.test.js`,
  `desk-sync-connector.test.js` and `desk-sync-stop.test.js` do, or a CI
  run counts it as the test's.
- **End to end is a real browser against `wrangler dev`**, in
  `workers/notebook-service/` with a `.dev.vars` made for this machine
  (never the deployed preview's secret). The local service answers CORS for
  `http://localhost:4321`. A backgrounded `wrangler dev` outlives its shell
  on Windows: end its process tree and check the port when finished.
  Editing a module under Vite's dev server gives page script a second copy
  of it, so restart the server before reading `currentSync()` from the
  console.
