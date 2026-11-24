# For the apps: website decisions that change what you build

**Read this first if you are an iOS or Android session.** It is the short
list the 2026-11-23 call asked for (the call worksheet's T4; BVJ said yes
the same day): one dated entry for each decision made on the website's
side that changes what the apps build, carry, or wait on. The website's
decisions of 2026-11-10 and 2026-11-18 never reached either app's list,
because nothing carried them there. This file is what carries them now.

- **It is a pointer, not the record.** Each entry says what changed and
  where the full text is: `STUDY-DESK.md` for decisions,
  `STUDY-DESK-FORMAT.md` for the record format, `STUDY-DESK-ENCRYPTION.md`
  for the encryption spec.
- **An entry is added in the same pull request as the decision**, newest
  first, and is never deleted. One that is overtaken is marked with what
  replaced it.
- **“For BDR to confirm”** marks a call BVJ made without BDR in the
  conversation that changes the apps. It isn't settled until BDR says so.
- **The apps answer here too**, by pull request, under “Waiting to hear
  from the apps.” An answered ask moves into the list with its date.

## Waiting to hear from the apps

1. **The three format points BDR changed** (asked 2026-11-23). On the
   “Format Points Review” page, BDR kept BVJ's call on 13 of 22 points and
   changed 3: **the verse limit, collections after a highlight merge, and
   printed sheet hints.** That page isn't shared with BVJ, so the website
   doesn't know what BDR wants instead. BDR's Claude: for each of the
   three, please write here the point in `STUDY-DESK-FORMAT.md` it is
   about, what BDR wants in its place, and why. The same for the six
   points that were unmarked on 2026-11-22 (three on bookmarks, and those
   on labels, the trash, and undo) once BDR marks them, and for the iOS
   catch that page raised: a deletion on iOS leaves no synced record of
   when it happened.
2. **BDR's word on the calls marked “for BDR to confirm”** in the list
   below, above all that passkeys carry the key at launch. **They are now
   numbered in one place**: `STUDY-DESK-ENCRYPTION.md`, “Still open,” 1 to
   15 (draft 2, the first entry below). Answer by number here.
3. **BDR, the Google Cloud project for Sign in with Google is assigned to
   you** (BVJ, 2026-11-23: “Let's actually just assign BDR the Google
   Cloud project. If he balks, we can change it”). Say here if that
   doesn't work. The service's sign-in (the plan's step 4e) needs an
   OAuth client from it.
4. **Every note marker name either app has ever written**, still asked in
   `STUDY-DESK-FORMAT.md` under kind 2. It matters more now that one marker
   is leaving (below).
5. **Four things only real devices can show**, asked with the spec's
   draft 2 (its “Still open,” 18 to 21), since the website's side can't
   run the apps: whether one passkey gives the same 32-byte secret in the
   iOS app and in Safari, and in the Android app and in Chrome; whether
   Google Password Manager returns that secret through Credential Manager
   on Android 9 to 13; what happens when an iPhone scans a code to sign in
   on a computer; and a passkey kept in 1Password or Bitwarden. **The
   first is wanted before the freeze**, since the design leans on it.
6. **BDR, you are second to answer when the service breaks**, after BVJ
   (BVJ, 2026-11-23). Say here if that doesn't work. **How you roll the
   service back is chosen** (BVJ, 2026-11-23: “Let's go with the GitHub
   workflow”): deploys run from a merged pull request, and you roll back
   from this repository's Actions tab (“Notebook service (preview),” “Run
   workflow” on `main`, action `rollback`) with no access to Cloudflare.
   The other way, a member role on BVJ's Cloudflare account, was set
   aside because the only role that could do the same reaches the whole
   account. **The workflow is built and still off**: an entry in the list
   below will say when it is on and has been tried. It is laid out in
   `workers/notebook-service/README.md`, “Who can deploy and roll back.”
   Say here if a rollback from GitHub doesn't work for you.
7. **The nine readings the reference had to choose**, and one question
   (asked 2026-11-23 with the vectors, the first entry below):
   `STUDY-DESK-ENCRYPTION.md`, “Still open,” 22 to 31. Each is what the
   vectors test today, and each is cheap to change before the freeze.
   Answer by number here. **23 most of all**: a typed recovery or approval
   code is read to the letter, so a tab, a line break, a no-break space,
   or an en dash in it is refused. **BVJ said to keep it strict**
   (2026-11-23), so it is BVJ's call and **for BDR to confirm**. If the
   apps would rather every client remove those, say so and the vectors
   change. **Overtaken the same day: BVJ loosened it**, and the vectors
   are version 2 (the first entry in the list below). **BVJ then said yes to the other eight as built** (22, and 24
   to 30; 2026-11-23), so all nine are BVJ's calls and wait on BDR alone.
8. **Has either app ever written a trash record's time in any form but
   the `Z` one** (`2026-11-23T18:35:09.978Z`)? Asked 2026-11-23; the
   spec's “Still open,” 31. The format lets a trash record carry any time
   that parses, and the service will take only the `Z` form on a row, so
   such a record could never be pushed. If neither app has, the format
   will ask the `Z` form of trash records too; if one has, the service
   relaxes its check for a trash record's row instead.
9. **The nine choices the service had to make** (asked 2026-11-23 with
   the service, the first entry below): `STUDY-DESK-ENCRYPTION.md`,
   “Still open,” 32 to 40. Each is what the service does today and has
   a test, and each is cheap to change before the freeze. Answer by
   number here. **35 most of all**: `POST /rows` answers each row for
   itself, so one row a device can't fix never blocks the rest of its
   queue. **32 next**: say if either app would ever send a body over
   4 MiB or more than 500 rows in one request.

## The list

### 2026-11-23, the notebook service is built (step 4c)

**The service exists, and the interface has its final spelling.** It is
`workers/notebook-service/` on `main`: a Cloudflare Worker with D1 that
answers every request in `STUDY-DESK-ENCRYPTION.md`, “The service's
interface,” but sign-in (step 4e) and the seven-day requests (step 4f).
**The preview is live** at `https://notebook-preview.litbible.net`
(deployed 2026-11-23; `GET /` there answers with no session). The
vectors' walkthrough was run against it over HTTPS the same day and
passed, 8 of 8 steps, the last of them a row of the largest size the
format allows. It also runs on your own machine, which needs nothing
from anyone.

- **Read “The service's interface” again**: it is no longer a sketch.
  Under each table is the exact body of every request and every answer.
  “How a request is carried” has the session (`Authorization: Bearer
  <token>`), the JSON rules, and `time` first in every answer. “How
  values are spelled” has base64url, ids, times, and every size. “What
  the service answers when it refuses” is the table to switch on: one
  word in `error`, a status, and what else the body carries. No path
  moved, and no check of draft 2 was taken away.
- **Run it locally**, with no Cloudflare account and no secret from
  anyone. In a clone of this repository:
  `cd workers/notebook-service`, `npm ci`, copy `.dev.vars.example` to
  `.dev.vars` and put 32 or more characters of your own after
  `PREVIEW_SECRET=`, `npm run migrate:local`, `npm run dev`. It answers at
  `http://localhost:8787` (from an Android emulator,
  `http://10.0.2.2:8787`). `npm run walkthrough` runs the vectors'
  walkthrough against it.
- **How an app gets a session before sign-in exists**: the preview's own
  way in (the spec's “The preview's way in”). `POST /preview/session`
  with `{ "secret", "account" }` answers a token. `account` is any
  made-up label (`bdr-ios-1`); the same label is the same account, so two
  devices under test share a notebook by sharing one. `POST
  /preview/passkeys` lists a passkey as a way in with no ceremony, so the
  passkey holder's checks can be tried. Locally the secret is the one in
  your own `.dev.vars`. **For the deployed preview, BVJ gives BDR the
  secret privately. It never goes into a repository, an issue, a pull
  request, or a conversation with an assistant**: a session reads it from
  the environment. To check the deployed preview from a clone,
  `node scripts/walkthrough.mjs https://notebook-preview.litbible.net`
  in `workers/notebook-service` asks for the secret at the terminal and
  draws it as asterisks.
- **The quickest way to see every call in order** is
  `workers/notebook-service/test/walkthrough.js`: the vectors' walkthrough
  as the requests a client sends, with what comes back, in about 400
  lines. `test/notebook.js` is the same client with freshly made keys.
- **Nine choices the service had to make**, where the interface made
  none, are the spec's “Still open,” 32 to 40, each **for BDR to
  confirm** (ask 9 above). The ones a client feels most:
  - **`POST /rows` answers each row for itself** (35). A row that fails a
    check is answered `refused` and the rows beside it are stored; only
    an old `kid`, a malformed request, a repeated id, or more than 500
    rows refuses the whole request. A stale `rev` is that row's
    `conflict`, with the row as it stands.
  - **The session is checked before the body** (38), so a device that
    missed a change of key always hears `not_open`.
  - **Five wrong key proofs in a row end the session** (34), counted for
    the session and not the account.
  - **The limits** (32): a 4 MiB body, 500 rows a request, 100 devices,
    20 holders, three approvals in progress.
  - **A session lasts 30 days** (40), which sign-in may change.
- **A trash record's times** (ask 8, the spec's 31) are checked as the
  interface states, since neither app has answered: a row whose
  `deletedAt` isn't in the `Z` form is answered `refused: "deletedAt"`,
  alone. Say if either app has ever written another form.
- **Rolling back** (ask 6 above): BVJ chose the GitHub workflow, which
  is built and not yet turned on. Until it is, only BVJ can deploy or
  roll back.
- **Everything on the preview is test data, wiped at any time.** Use
  made-up account labels of your own (`bdr-ios-1`), and expect a wipe to
  be announced here.
- **Still to come**: sign-in
  (4e), after which the token comes from Apple, Google, or a passkey and
  nothing else in a request changes; deleting an account and the
  seven-day requests (4f), until which `GET /account` answers `waiting`
  as null; and production's address (4f).

### 2026-11-23, a pasted code is read more kindly (vectors version 2)

**This changes what both apps build, and the vectors file.** BVJ
loosened the spec's “Still open,” 23, after first keeping it strict the
same day. **For BDR to confirm.**

- **The rule**: before a typed recovery code, approval code, or
  typed-back group is read, a client removes white space, the invisible
  characters a paste can carry, and the hyphen with the dashes put in its
  place. Everything else is read as before (`O` as `0`, `I` and `L` as
  `1`, anything else refused, characters checked before length).
- **The list is the rule**, in `STUDY-DESK-ENCRYPTION.md` under “The
  recovery code,” as code points. **Do not use Swift's `isWhitespace` or
  Kotlin's `isWhitespace` in its place**: each differs from the list, and
  three clients would then read one paste three ways.
- **The vectors**: `test/fixtures/notebook-crypto-vectors.json` now has
  `vectorsVersion` 2. Only the `read` cases of `recoveryCode` and
  `approvalCode` changed. Four cases that were refused are now read (a
  tab, a line break, an en dash, a no-break space), and there are new
  ones: other dashes and spaces, a zero width space, a byte order mark,
  every removed character at once, and four that are still refused (an
  underscore, a full stop, a fullwidth digit, and a code that is nothing
  but removed characters, which is a wrong length).
- **Why**: a reader uses the recovery code after losing their devices,
  and a code that is right in every character should not be refused for
  what a copy brought with it. It costs nothing in security.

### 2026-11-23, the encryption reference and its test vectors

**The vectors exist** (the plan's step 4b). The file both apps run is
`test/fixtures/notebook-crypto-vectors.json` on `main`, fetched the way
each app already fetches `test/fixtures/anchor-vectors.json`. It is made
by `npm run build:notebook-crypto-vectors` from the code the website will
ship, `src/lib/desk-crypto.mjs`, which is the reference to read beside
the spec. `test/desk-crypto.test.js` holds the two together. This gates
IOS-108 and NB15.

- **How to read the file.** Its top has `vectorsVersion` (it moves when
  any value does; 1 today), `conventions`, and `refusals`. Each case has a
  `why`, a `given`, and an `expected`. Every byte string is lowercase
  hex, a row's `nonce` and `ct` included, though the service carries
  those in base64url. The exceptions are the JSON a client seals
  (`plaintext`) and a MAC's input (`macInput`), which hold base64url as
  on a device. **To reproduce a ciphertext, seal the `plaintext` given,
  byte for byte**: your own JSON writer orders keys its own way, which is
  fine, and what it writes you check by opening it again.
- **A case that must be refused** has `expected.refused` with one of the
  words under `refusals`. You need not use the words. You must refuse
  every such case, and tell apart the two kinds the spec treats
  differently: a row to keep **aside** while the device fetches its
  keyring (`aside: true`: an unknown `v`, or a `kid` not held) from one to
  **skip and report**, and which of a holder's four checks stopped
  (`check`). No refusal ever deletes anything.
- **What each group proves:**
  - `hkdf`, `keyProof`: every derived key, the proof a device sends, and
    the hash the service stores.
  - `recoveryCode`, `approvalCode`: the text of a code, a typed code back
    to its bytes (lowercase, spaces, `O`, `I`, `L`), each refusal, and
    whether a group typed back matches.
  - `base64url`: byte strings written one way, and every other spelling
    refused. (Added to the spec's table with this step.)
  - `padding`, `seal`, `open`, `openRefused`: a record to a row and back:
    the padded length, the AAD (a row with no `deletedAt` has an AAD that
    ends with a line feed), the exact ciphertext, and thirty rows that
    must not be accepted, among them a wrong tag, each AAD field changed,
    bad padding, the wrong key, and a record that disagrees with its
    plain fields.
  - `keyring`: its own checks (a gap in the `kid`s, a repeat, a short
    key), and what a device accepts from the service (never another
    notebook, a lower `current`, or other bytes for a key it holds).
  - `hpkeOpen`: a keyring sealed to a public key, opened with the private
    key, with the shared secret, key, and nonce along the way for an HPKE
    written by hand, and refusals (a changed byte, an `enc` off the curve,
    another recipient).
  - `card`, `holderCard`: a card sealed and opened, refused under another
    id, `kid`, or notebook and as the other kind of card; a card with a
    field version 1 doesn't know, sealed again with the field kept; cards
    a client won't write.
  - `prf`: the fixed PRF input in each form (its bytes, the base64url
    Android's request JSON carries, the hashed form the passkey sees),
    and a passkey response before and after `prf.results` is removed.
  - `passkeyHolder`, `recoveryHolder`: coming in through a holder, from
    the PRF's 32 bytes or from the typed code, and a refusal at each of
    the four checks, a forged keyring among them.
  - `approval`: the approval's id, both MACs with their inputs as text,
    the grant, and what each device refuses (a changed key, model, id,
    `kid`, or ciphertext, a keyring of the service's own, a card for
    another device).
  - `signingKey`: the reserved key: signatures as `r ‖ s` and in DER, in
    each shape DER takes, verified, and changed ones refused.
  - `point`: public keys on and off the curve, compressed, and too short.
  - `walkthrough`: one notebook through eight steps, every value: a first
    device under “follows my account,” its rows, a second device by
    passkey, a third by approval, the first removed, a switch to “this
    device only” with a recovery code, a recovery by code on a fourth,
    and forged keyrings refused. Follow it in the opening direction if
    you can't fix a sender's key.
- **HPKE and ECDSA cases run in one direction.** A platform's HPKE makes
  its own sender key and ECDSA its own number, so the file gives a sealed
  keyring to open and a signature to verify. The sender's key and the
  signing number are there too, for a client that can fix them.
- **What a client must run beyond the file** (IOS-108, NB15):
  1. **What it seals, it opens**, with its own randomness: a record, a
     keyring sealed with the platform's HPKE, a card, a holder record,
     and an approval end to end. And what it signs, it verifies.
  2. **Its own random inputs.** The file fixes every nonce, key, and
     code. That yours come from the platform's random source, fresh each
     time, is for your own tests and review.
  3. **Published vectors, for anything written by hand.** If Android
     writes HKDF or HPKE on the platform's primitives, run them against
     their published cases first. `test/fixtures/published-crypto-vectors.json`
     has the ones the reference passes, with each source named: RFC 5869,
     RFC 4231, Wycheproof's AES-256-GCM, and the CFRG's HPKE vectors.
     **RFC 9180's printed appendix has no case for the notebook's suite**
     (P-256, HKDF-SHA256, AES-256-GCM); the CFRG's full file does, and it
     is in that fixture.
  4. **Where the keys are kept**: the Keychain or Keystore choices in the
     spec, and that no backup or transfer copies them.
  5. **The real passkey**: that one passkey gives the same 32 bytes in
     the app and in the browser (“Waiting to hear from the apps,” 5), and
     that `prf.results` is gone from the real response the platform hands
     you. The file starts from the 32 bytes.
  6. **The format's own checks on an opened record** (the merge and
     anchor vectors), which come after everything here.
  7. **Against the service**, once the preview runs (4c): a row one client
     sealed opens on the others.
- **The spec changed with it**, in the same pull request: its “Changed in
  step 4b” lists 21 places where the text now says exactly what the
  reference does. No decision of draft 2 moved. Nine were choices
  (“Waiting to hear from the apps,” 7). **BVJ said yes to all nine as
  built** later the same day, so each is for BDR to confirm. The one
  question it turned up, about a trash record's times, is ask 8.
- **If the reference is wrong, say so here.** A change to a rule changes
  the spec, the reference, and the file together, and `vectorsVersion`
  goes up, so a client can tell which file it ran.

### 2026-11-23, BVJ on draft 2's choices

BVJ was walked through the choices draft 2 made (the spec's “Still open,”
7 to 17) and said yes to all of them. Recorded in full in `STUDY-DESK.md`,
“Decisions,” 2026-11-23, “BVJ on draft 2's choices.”

- **7 to 15 are now BVJ's calls, and each is still for BDR to confirm**:
  the key proof; only a synced passkey with a working PRF holds the key;
  the passkey's fixed input; where the key lives is whether a passkey
  holder exists, not a setting the service stores; a notebook always has
  a holder; “Replace my passkey” and “Switch to this device only” on the
  screen that removes a device; a device makes its own id; the service's
  requests, with the clock cap left to the devices; and changing a way to
  sign in needs a device that has the key. So the spec's “Still open,” 1
  to 15, waits on BDR alone.
- **A merge test comes with the clock cap** (14), in the freeze work
  (step 4d): two devices whose clocks differ must still agree on which
  edit wins. It will be a new case in the merge vectors both apps run.
- **The two sentences are settled** (16), and the apps show the same
  words: the one for a reader who takes no recovery code, in the spec
  under “Setting up the first device,” and the removal screen's under
  “follows my account,” in “What removing a device means,” which now
  names the reader's password manager beside their Apple or Google
  account.
- **When the service breaks, BVJ answers first and BDR second** (17).
  **BDR's part is for BDR to accept** (ask 6 above). Only BVJ can deploy
  or roll back today, so the service's first step (4c) gives BDR a way to.

### 2026-11-23, the encryption spec's draft 2

`STUDY-DESK-ENCRYPTION.md` is now draft 2, written on the website's side
(the plan's step 4a). It replaces draft 1 whole. Nothing in it is built,
and the reference and vectors (4b) follow once it is agreed. (**Overtaken
the same day**: 4b was built against draft 2 as written; the entry “the
encryption reference and its test vectors,” above.) **For BDR's Claude to
review, and for BDR to confirm**: its last section, “Still open,” numbers
every call that changes what the apps build.

- **What draft 2 writes in from BVJ's answers** (the entry below): passkeys
  carry the key at launch; the reader's choice of “follows my account” or
  “this device only”; the recovery code offered where a passkey holds the
  key and required elsewhere; a signing key in every device's card,
  checked by nothing yet.
- **What is new in draft 2 and that neither BDR nor BVJ has seen**, each
  made while writing it and each for both to check (BVJ has since said
  yes to all of them: the entry above):
  - **The key proof.** A device shows the service that it holds the
    notebook key (32 bytes derived from the key, whose hash the service
    keeps) before the service gives it records or lets it change
    anything. Draft 1 would have let any signed-in session change the key.
  - **The service's interface**: every request, and what the service
    checks. The apps build their clients against it, on the preview
    service (4c). The checks are the spec; the paths are settled when the
    preview runs.
  - **Holders.** Draft 1's recovery record is now one shape for the
    recovery code and for each passkey, with a card as devices have. The
    keyring no longer names the recovery public key.
  - **Only a synced passkey with a working PRF holds the key**, and the
    app finds out by asking, never from a list of platforms. The PRF's
    input is fixed (`lit-notebook/1 prf`), user verification is always
    required, and **the app must take `prf.results` out of any passkey
    response before it goes to the service**, which Android's Credential
    Manager JSON carries.
  - **A device makes its own id** and keeps it across sessions; an
    approval ends with the new device accepting it; the approval's request
    carries the signing public key under its MAC.
  - **The service leaves the clock cap to the devices**, which would
    change one sentence of the format's “Clocks” at the freeze.
- **Where a passkey can carry a key** is a section of the spec, from each
  platform's own documentation (2026-11-23). Apple's is clear (iOS 18,
  macOS 15). Google's pages don't say that Google Password Manager returns
  the secret, and Microsoft's don't say Windows Hello does. So the four
  questions under “Waiting to hear from the apps,” 5.
- **What the apps should tell the website if it is wrong**: the spec's
  author could not read either app's repository. Its claims about the
  apps (iOS 26 as the target, Android API 26 and later, the Keychain and
  Keystore choices) are carried from draft 1.

### 2026-11-23, after the call

Recorded in full in `STUDY-DESK.md`, “Decisions,” 2026-11-23.

- **The website's plan for sync is written**: `STUDY-DESK.md`, “Order of
  work,” 4, steps 4a to 4l. **What the apps wait on, and when**: the
  spec's draft 2 (4a), the reference and test vectors (4b), and a preview
  service to build against (4c), all aimed at about December 15; the
  format freeze (4d), tentatively December 24; then sign-in on the service
  (4e), which waits on the Apple and Google credentials from BDR's side.
  The privacy page and terms (4j) are live before either app ships sync.

- **The website's sync lands with the apps', on February 10**, and the
  website opens the Study Desk to everyone that day, with the
  announcement. Until now the website's sync followed on its own
  schedule.
- **BVJ's side writes the encryption spec from draft 2 on, with its
  reference and test vectors, and builds the service.** The service's code
  lives in this repo, under `workers/`. This changes the call's “BDR's
  side builds” (worksheet item D7) and the 2026-10-09 arrangement that
  BDR's Claude drafts the spec and vectors. **The apps' part**: review the
  spec and the service's pull requests, and run the vectors in both apps
  (iOS IOS-108, Android NB15).
- **Passkeys carry the notebook key at launch, and the recovery code is
  the fallback** where a passkey can't (BVJ). **For BDR to confirm.**
  Draft 1 of the spec has it the other way around (the recovery code now,
  the passkey later), so its sections on setup, adding a device, and
  sign-in are out of date until draft 2. **Draft 2 is written** (the
  entry above). It makes passkeys part of the
  launch, where the call had them “if the schedule holds” (iOS IOS-106,
  Android NB13).
- **The spec's other open items, as BVJ answered them. For BDR to
  confirm.** The setup sentence as proposed; the reader types two of the
  recovery code's six groups back; seven days before a signed-in device
  that can't open the notebook may delete or replace it; setup suggests a
  second way in to a reader who has only a passkey; `deletedAt` stays
  among the plain fields. A reader with a passkey is offered a recovery
  code and not required to take one. **The reader chooses whether the key
  follows their Apple or Google account or stays only on their device**
  (item 4; BVJ), on every platform, and **at setup “follows my account”
  is shown first and recommended** (BVJ). For draft 2: an explicit
  setting, separate from how the reader signs in, with “follows my
  account” carried by a synced passkey and no key in iCloud Keychain
  itself. (Draft 2 writes it as whether the notebook has a passkey that
  opens it, which each device reads for itself, and not as a setting the
  service stores.) **Device signatures are reserved
  now and enforced later** (item 7): each device makes a signing key at
  launch and keeps its public half in its card, and nothing checks it
  until a later version.
- **The `ribbon` note marker leaves the website too** (BVJ), matching the
  call's decision that the bookmark picture leaves the apps' note markers.
  By the freeze, kind 2's marker list in `STUDY-DESK-FORMAT.md` will have
  six names, and every client will read `ribbon` and the older `bookmark`
  as `note`. **Not yet changed in the format or the website's code.**
- **Kind 3, `hidden`, leaves the format by the freeze**, since the call
  dropped the hidden passage from all three. **Not yet changed in the
  format.**
- **Notes from the Greek are in the website's version 1** (BVJ). A note
  started from the website's Greek tab or pane is an ordinary note on its
  verse (kind 2, no new field), with the Greek the reader selected put
  into its body. **All an app has to do is show Greek script in a note's
  body**, accents and breathings included.
- **The account owners**: BVJ the Cloudflare account, BDR the Apple
  developer account and, by BVJ's assignment, the Google Cloud project
  (ask 3 above, for BDR to accept). Who answers when the service breaks is
  not yet said. (Said later the same day: BVJ first and BDR second; the
  entry “BVJ on draft 2's choices,” above.)

### 2026-11-23, on the call

What BVJ and BDR decided together is in `STUDY-DESK.md`, “Decisions,”
2026-11-23, and on the call worksheet: plan C, February 10 held for sync
with a gate about December 15, simple bookmarks with synced labels, the
hidden passage dropped from all three, passkeys, one announcement on Ash
Wednesday with a private beta on all three, and the format freeze
tentatively on December 24.

### Earlier decisions that never reached the apps

- **2026-11-18: Collections are a new record kind, 12**, website only.
  The apps need only keep the records untouched (the format's principle
  6). `STUDY-DESK-FORMAT.md`, “Collections (kind 12)” and “Still open in
  this file,” names the two points to read closely: the website rewrites a
  collection when a highlight in it changes id, and the limits are 1,000
  members and 512 KB.
- **2026-11-10: no notes on a footnote** (`STUDY-DESK-FIXES.md`, E79). The
  website neither makes nor shows one, and the apps need not build one.
  `footnote` and `n` on a note stay reserved and are carried untouched.
  Pinned footnotes (kind 11) are not affected.
- **2026-11-10: the hidden passage is not on the website.** Overtaken on
  2026-11-23: dropped from all three, above.
