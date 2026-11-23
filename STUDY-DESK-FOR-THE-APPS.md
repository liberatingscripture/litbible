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
   below, above all that passkeys carry the key at launch.
3. **Who owns the Google Cloud project** for Sign in with Google. BVJ
   thinks BDR; to confirm.
4. **Every note marker name either app has ever written**, still asked in
   `STUDY-DESK-FORMAT.md` under kind 2. It matters more now that one marker
   is leaving (below).

## The list

### 2026-11-23, after the call

Recorded in full in `STUDY-DESK.md`, “Decisions,” 2026-11-23.

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
  sign-in are out of date until draft 2. It makes passkeys part of the
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
  itself. **Device signatures are reserved
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
  developer account. Google Cloud is ask 3 above. Who answers when the
  service breaks is not yet said.

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
