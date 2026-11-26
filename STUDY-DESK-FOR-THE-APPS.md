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
   **iOS confirmed that catch from its code on 2026-11-24, with one
   addition** (the first entry in the list below). The rest of this ask
   is still BDR's.
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
   is leaving (below). **iOS answered on 2026-11-24** (the first entry in the
   list below). Android's answer is still to come.
5. **Four things only real devices can show**, asked with the spec's
   draft 2 (its “Still open,” 18 to 21), since the website's side can't
   run the apps: whether one passkey gives the same 32-byte secret in the
   iOS app and in Safari, and in the Android app and in Chrome; whether
   Google Password Manager returns that secret through Credential Manager
   on Android 9 to 13; what happens when an iPhone scans a code to sign in
   on a computer; and a passkey kept in 1Password or Bitwarden. **The
   first is wanted before the freeze**, since the design leans on it.
   **The first is answered for iOS** (2026-11-24, the first entry
   below): the same 32 bytes in the iOS app and in Safari on a Mac.
   Android's half, and the other three, are still to come.
6. **BDR, you are second to answer when the service breaks**, after BVJ
   (BVJ, 2026-11-23). Say here if that doesn't work. **How you roll the
   service back is chosen** (BVJ, 2026-11-23: “Let's go with the GitHub
   workflow”): deploys run from a merged pull request, and you roll back
   from this repository's Actions tab (“Notebook service,” “Run
   workflow” on `main`, environment `preview`, action `rollback`) with
   no access to Cloudflare. (**Since step 4f, 2026-11-24, that is two
   choices**: the workflow, which was titled “Notebook service
   (preview)” until then, and inside it which deployment. The preview
   is the one that exists and is the form's default; production's half
   is prepared and off.) The other way, a member role on BVJ's
   Cloudflare account, was set aside because the only role that could
   do the same reaches the whole account. **The workflow is on and has
   been tried** (2026-11-23: a deploy, a rollback, and a second deploy,
   each run from the Actions tab and each passing). A rollback returns the service's code in seconds
   and never touches the database. It is laid out in
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
   **iOS: never** (2026-11-24, the first entry below). Android's answer
   is still to come.
9. **The nine choices the service had to make** (asked 2026-11-23 with
   the service, the first entry below): `STUDY-DESK-ENCRYPTION.md`,
   “Still open,” 32 to 40. Each is what the service does today and has
   a test, and each is cheap to change before the freeze. Answer by
   number here. **35 most of all**: `POST /rows` answers each row for
   itself, so one row a device can't fix never blocks the rest of its
   queue. **32 next**: say if either app would ever send a body over
   4 MiB or more than 500 rows in one request.
   **iOS on 32 and 35** is in the first entry below (2026-11-24). BDR's
   word is still to come.
10. **BDR, please try one rollback of the preview, and say here how it
    went** (asked by BVJ, 2026-11-23). It has only been run from BVJ's
    account, and you are the one who will need it. It needs no
    coordination with BVJ, no merge, and nothing on Cloudflare, and the
    preview holds test data only, so nothing can be lost.
    1. On github.com, open this repository's **Actions** tab. In the
       left list, choose **Notebook service** (titled “Notebook service
       (preview)” until step 4f, 2026-11-24; it is the same workflow).
    2. Click **Run workflow** (right side). Leave the branch on `main`,
       and leave **environment** on `preview`, which is how the one
       workflow is told which deployment to act on (new with step 4f;
       the preview is the default, and production's half is off).
       Set **action** to `rollback`. Leave **version** empty, which
       means "the version before the current one." In **reason**, write
       a few words (`BDR's first rollback test`). Click the green
       **Run workflow**.
    3. Open the run that appears. It takes about a minute. Its
       **Versions before** and **Versions after** steps list what was
       deployed and what is now. A green check means the Worker is back
       on the earlier version.
    4. **Put it back**: **Run workflow** again on `main`, with
       **environment** `preview` and **action** `deploy`. That redeploys
       what is on `main`, runs the service's tests first, and finishes
       by running the walkthrough against the deployed service (about
       two minutes). A green check means the preview is where it
       started.
    To return to one particular version instead, copy its Version ID
    from a **Versions before** step into **version**. A rollback
    returns the service's code in seconds and never touches the
    database. In a real break: roll back first, tell BVJ second. A fix
    still goes through a pull request that BVJ merges, and the merge
    deploys it.
11. **The freeze work's points, one question, and one proposal** (asked
    2026-11-24 with step 4d, the first entry below). Answer part by part.
    1. **BDR's word on each of four points**: a `hidden` record read as a
       kind the client doesn't know; `ribbon` and `bookmark` read as
       `note`; the clock cap as each device's own; and merge vectors
       version 9.
    2. **Which device wins when two clocks are far apart** (BVJ,
       2026-11-24, asked that this be put to BDR). With clocks more than
       the five minutes of skew apart, the edit stamped by the faster
       clock wins once the slower clock reaches its stamp, **even over an
       edit made on the slower device in between, which is lost**. Until
       then the two devices show different words for that record. Nothing
       new makes this so: it is rule a and the clamp as they stand, once
       the cap is each device's own. Is that what the apps want? If not,
       say what should happen instead. Two things a client could do, as
       examples from the website's side and not decisions: tell the reader
       when its clock is far from the service's `time` (every answer
       carries it), or hold back sync until the clock is set.
    3. **The proposal**: under sync, the row the service holds wins an
       exact tie in `modified` against a device's own copy. Say here if
       the apps settle such a tie another way, or would rather.
12. **BDR, what the service needs from your Apple and Google accounts
    before either sign-in can be turned on** (asked 2026-11-24 with
    sign-in, the first entry below; the spec's “Still open,” 41). Both
    are built and off, and nothing was guessed. Please write the
    identifiers here. **The one secret, Apple's key, never goes into
    this file, a pull request, or a conversation with an assistant**:
    send the `.p8` file to BVJ privately, and BVJ types it at Wrangler's
    own prompt.
    - **Apple.** (a) Each client id an identity token will be issued
      to: the iOS app's bundle id, and a Services ID if the website or
      the Android app will offer Sign in with Apple. (b) The team id.
      (c) The key id of a key with Sign in with Apple enabled. (d) If a
      web flow is planned, the return address registered for the
      Services ID. The site's `apple-app-site-association` names
      `9KL9F7A3CR.com.litbible.app`, which suggests answers to (a) and
      (b); they were not assumed, so please confirm them. **Since
      2026-11-25 a web flow is built, and off** (ask 19, part 4): the
      Services ID needs two return addresses,
      `https://litbible.net/account/` and
      `https://litbible.net/delete-account/`.
    - **Google** (the project is yours, ask 3). Each OAuth client id a
      token will be issued to: the one the Android app gives Credential
      Manager as its server client id, the iOS app's, and the
      website's. **The website's is a client of type “Web application”**
      with the same two return addresses as Apple's (ask 19, part 4).
    - **Passkeys on Android.** `assetlinks.json` lists two signing
      certificates, and the service accepts a passkey from the Android
      app signed by either. Which is the Play signing key and which the
      upload key? And does any other build need to use a passkey (a
      debug or internal build)? Its certificate would have to go into
      `assetlinks.json` and into the service's list together.
    - **iOS confirmed (a) and (b) from its code** (2026-11-24, the first
      entry below): the bundle id `com.litbible.app` and the team id
      `9KL9F7A3CR`. The Services ID, the key and its id, and the return
      address are still BDR's.
13. **The eighteen choices sign-in had to make** (asked 2026-11-24, the
    first entry below): `STUDY-DESK-ENCRYPTION.md`, “Still open,” 41 to
    58. Every one was the website's Claude's. **BVJ has said yes to
    thirteen** (2026-11-24), so those are BVJ's calls and wait on BDR
    alone: 42, 43, 44, 46, 47, 49, 50 (every passkey is named “LIT
    Bible notebook,” under “LIT Bible”), 52 (how long a session lasts),
    54, 55 (accounts are not joined in version 1), 56, 57, and 58.
    **Four BVJ left to you to answer** (2026-11-24: “ask BDR”): 41 (ask
    12 above), 45 (a passkey's options and response travel in the
    standard's JSON forms, which an iOS app builds by hand), 48 (each
    SDK must send the service's challenge to Apple or Google unchanged,
    as the nonce), and 53 (the words of the new refusals). Each is
    what the service does today and has a test, and each is cheap to
    change before the freeze. Answer by number here. **Most of all**:
    45 and 48; in 42, that a passkey used from the iOS app answers
    from `https://litbible.net`; and 52 (how long a session lasts).
    **And one BVJ asks your view on before deciding: 51.** Some
    passkeys count their uses (security keys, and passkeys kept on one
    device, like Windows Hello), and as built the service refuses a
    sign-in whose count didn't go up, since that is what a copied
    security key looks like. BVJ leans toward letting it through
    instead (2026-11-24: “I think no”). The case for that: a false
    alarm, such as a count rolled back when a device is restored,
    shuts a reader out of that passkey until its count passes the one
    the service holds; they can mend it only by signing in another way
    and adding the passkey again; and a passkey that counts doesn't
    sync, as far as the vendors' pages say, so it never holds the key,
    and a copy that signs in still can't open the notebook. The case
    for refusing: it is the only sign of a copied key the service ever
    gets. **What do you think, and has either app met a passkey whose
    count went backward?** The service refuses until this is decided.
    **iOS facts on 42, 45, and 51** (2026-11-24, the first entry
    below): the preview accepted a passkey used from the iOS app, the
    JSON forms are no burden, and iOS has never met a passkey whose
    count went backward. BDR's word on each is still to come.
14. **The fifteen choices the account work had to make** (asked
    2026-11-24, the first entry below): `STUDY-DESK-ENCRYPTION.md`,
    “Still open,” 59 to 73. Every one was the website's Claude's.
    **BVJ has said yes to seven** (2026-11-24), so those are BVJ's
    calls and wait on BDR alone: 59 (an account with no notebook is
    deleted at once), 60 (the session that asked may cancel its own
    request), 63 (`replaced`), 64 (seven days exactly, then within
    about an hour), 66 (what a replacement does), 69 (production's
    address, `notebook.litbible.net`), and 71 (a deleted account's
    other devices are told `sign_in` and no more). **Five BVJ left to
    you to answer** (2026-11-24: “ask BDR”):
    - **61**: `platform` travels in the address on `DELETE /account`
      (`?platform=ios`) and in the body on `POST /notebook/replace`.
      Would either app's client rather have one form for both?
    - **65**: while Apple can't be reached, an account is never
      deleted; a request that is due is tried every hour without end.
      Should there be a point, some days past due, at which the
      service deletes anyway and leaves a token unrevoked? The
      website's Claude leans toward about seven days.
    - **67**: the new words (`slow_down`; `waiting` under `exists` and
      `gone`; `already_open` for a replacement asked from an open
      session; the members `deleted`, `waiting`, `canceled`, and
      `replaced`).
    - **70**: the deletion page (ask 15).
    - **73**: Apple's server-to-server notifications, which the
      service doesn't take. When a reader ends the connection from
      their Apple Account's settings, should the service do nothing,
      remove that way in, or delete the account? What do the apps'
      Apple setup and App Review expect?
    **In 68, BVJ said yes to Turnstile on the website's sign-in page,
    and asks you about the rest**: are the limits' numbers right for
    the apps (60 requests a minute from one address to begin a
    sign-in, 1,200 for everything else), and would the apps attest at
    sign-up with App Attest and Play Integrity, now or later?
    **Added 2026-11-24, from the check after the merge** (the first
    entry below), two facts for the numbers: a sign-in is two requests,
    so 60 a minute is 30 sign-ins a minute from one address; and
    Cloudflare's own page advises against counting by address, because
    many people can share one. Could a room of people signing in
    together (a class, a congregation on one Wi-Fi) meet that in
    either app, and what will an app show when it is told `slow_down`?
    **62 is not yet answered by BVJ** (what a waiting request says,
    which is what your notice is built from); your view is asked too.
    **iOS on 61** (2026-11-24, the first entry below): no burden either
    way.
    Each is what the service does today and has a test. Answer by
    number here.
15. **The page for deleting an account** (asked 2026-11-24):
    `src/pages/delete-account.astro`, live at
    `https://litbible.net/delete-account/` since 2026-11-24. You
    file the stores' forms, so please read it against Google Play's
    current account deletion requirement and against Apple's. **Play's
    page has since been read** (2026-11-24, the first entry below), and
    it asks for more than the page does today: a reader must be able to
    ask for deletion from the web page itself, without the app. The
    page can do that only once the website has sign-in (step 4h).
    **Say here when the Android build that makes accounts is due to go
    to review**, since the page has to take requests by then. **Its
    in-app steps are a guess**: it says “open Settings, choose
    ‘Account,’ and then choose ‘Delete account’” for both apps. Write
    here where each app will put it, and anything Play's form needs
    that the page lacks.
16. **The eleven choices the website's connector had to make** (asked
    2026-11-24, the first entry below): `STUDY-DESK-ENCRYPTION.md`,
    “Still open,” 74 to 84. Every one was the website's Claude's.
    **BVJ has said yes to eight** (2026-11-24), so those are BVJ's calls
    and wait on BDR alone: 74, 75, 76, 77, 78, 79, 80, and 82.
    None changes a request or an answer. They are what a client does
    between the requests, and two clients that choose differently can
    each follow the interface and still not end with the same notebook.
    Each is what the website does today and has a test. Answer by
    number here. **Most of all, among those eight**:
    - **74**: the format says a sync that drops a record as ahead must
      not move its cursor past it. The website keeps the row and moves
      its cursor on, then judges the row again once its clock arrives.
      Is the format's sentence the rule you will build to, or its
      purpose?
    - **76**: when two clients' merges disagree about one record, what
      stops them from pushing it back and forth without end? The
      website never pushes a copy again over another device's
      replacement until the record changes. Do the apps need the same,
      or have a bound of their own?
    - **77**: a row is removed only after the trash record that
      replaced it is stored, and a record merely missing on a device is
      fetched again, never removed for everyone. The same in the apps?
    - **82**: what will each app do if the service is ever restored
      from an older copy, so that its revisions go back? The website
      reads everything again and gives back what it still holds.
    **Three BVJ left to you to answer** (2026-11-24: “Ask BDR”):
    - **81**: two copies of one trash record tie toward the service's
      row. It goes with ask 11's proposal: if the service's row wins an
      exact tie, should it win the ties inside one trash record too?
    - **83**: a removed device is told “signed out” first and “removed”
      only after signing in again, because removal deletes its
      sessions. Is that acceptable in the apps, or should the service
      say why a session ended? The second is a change to the service
      and to the interface.
    - **84**: when a device's clock is five minutes or more from the
      service's, the website tells its reader and keeps syncing. Should
      a client only say it, or stop syncing until the clock is right,
      and will the apps say it too? This is the question under ask 11,
      part 2, now with one client built.
    **The iOS builder's views on 74, 76, 77, and 82** are in the first
    entry below (2026-11-24). They are views, not BDR's word.

17. **Every setup makes a recovery code** (asked 2026-11-24, in the
    entry below with that heading; `STUDY-DESK-ENCRYPTION.md`, “Still
    open,” 85). BVJ's
    call, made without you: under “follows my account” the reader is no
    longer asked whether they want a recovery code. One is made and shown
    at every setup, and the two groups are typed back under both choices,
    with no way to skip. **Say here whether the apps will do the same.**
18. **Turnstile checks only a browser's request** (asked 2026-11-24, in
    the entry below headed “Turnstile before a new account”;
    `STUDY-DESK-ENCRYPTION.md`, “Still open,” 86).
    **For BDR to confirm**: the design is the website's Claude's. Where
    it is configured, `POST /sign-in/new-passkey/options` must carry a
    Turnstile token when the request has an `Origin` header, and an
    app's request, which has none, is not checked. **The apps need do
    nothing now**: `GET /sign-in` may carry a new member, `turnstile`,
    which they ignore. **Say here whether the apps will attest at
    sign-up** (App Attest, Play Integrity), and when, since until they
    do a program can skip the check by sending no `Origin`.
19. **The four choices the website's account pages had to make** (asked
    2026-11-25, the first entry below): `STUDY-DESK-ENCRYPTION.md`,
    “Still open,” 87 to 90. None changes a request or an answer. Answer
    by number here.
    1. **87, the link in a QR code**:
       `https://litbible.net/account/connect/#a=<16 characters>`, the
       code's characters unbroken, as the spec recommended. Will each
       app read that link when it scans one, and write the same link
       when it shows one? The website never scans (a computer has no
       camera to count on); it shows the code and types one.
    2. **88, what a device calls itself**: the website sends its browser
       and system as `model` (“Chrome on Windows”) and uses it as the
       card's first name, which the reader can change. What will each
       app send, and will its device list show the website's name as
       written?
    3. **89, after an account is deleted**, its other devices can only
       say “You've been signed out,” since the service keeps no trace
       of a deleted account. Is that acceptable in the apps, or should
       the sentence allow for it?
    4. **90, Sign in with Apple and with Google on the website**: built
       and off, and **never tried against either provider**. It needs a
       Services ID from Apple and a “Web application” client from
       Google (ask 12), each with two return addresses registered:
       `https://litbible.net/account/` and
       `https://litbible.net/delete-account/`. It asks for no name and
       no email address. Write the two ids under ask 12; they go into
       the service's variables and into
       `src/lib/desk-account-providers.mjs`.
20. **Where each app tells its reader of a waiting request and of a new
    device** (asked 2026-11-25, the first entry below). The website now
    says both on whatever page is being read, not only on its account
    page. Will each app do the same outside its account screen, and
    when: the next time it opens, the next time it syncs? The service
    sends no push for either, so a device hears only when it asks.
21. **The privacy page's app parts, the stores' forms, and the age laws,
    before either app ships sync** (asked 2026-11-25, the first entry
    below). The privacy page now describes accounts, and the policy must
    be live before either app ships sync (A6). Four things, answered by
    number here:
    1. **The app sections of `/privacy`** (`src/pages/privacy.astro`) are
       yours to correct. “Your reading data (app)” now says that with an
       account a locked copy of notes, highlights, and bookmarks syncs and
       the reading position doesn't: true for each app? “Third-party
       software (app)” is unchanged; once an app syncs it needs a sentence
       for its sign-in (Claude's guess: AuthenticationServices on iOS,
       Credential Manager on Android). “Changes to this policy” now
       promises a note in the apps' What's New, not Translation Updates
       (BVJ, 2026-11-25: “‘What's New’ is correct, not ‘Translation Updates’, BDR should confirm.”).
    2. **The stores' forms.** Claude's reading of the stores' own pages
       (2026-11-25; not legal advice). *App Store privacy labels*:
       Identifiers, User ID (the account's id and a passkey's or Apple's
       or Google's id), collected, linked to the person, for app
       functionality, not for tracking; and User Content, Other User
       Content (the locked notebook), since Apple's page has no rule for
       end-to-end encrypted data that Claude could find: declaring it,
       for app functionality, is the cautious answer, and it's your call.
       *Google Play's Data safety*: Personal info, User IDs, collected,
       optional, for account management and app functionality, not shared
       (Cloudflare is a service provider); the notebook itself is exempt
       as end-to-end encrypted and unreadable by us, but re-read Play's
       live page for its exact conditions; encrypted in transit, yes; a
       way to delete, in the app and at
       `https://litbible.net/delete-account/`.
    3. **The age.** Accounts are for 13 and older, or older where a
       country's law sets a higher age (BVJ, 2026-11-25). Check each app's
       declared audience against that (Play's target audience and Families
       policy; Apple's age rating). Research for BVJ the same day found
       duties on app developers in the state app-store laws, which are
       yours to read, with a lawyer if BVJ wants one: **Texas SB 2420** is
       in effect pending appeal (its injunction was stayed by the Fifth
       Circuit in mid-2026) and asks a developer to tell the stores before
       a significant change, such as a new kind of data collected, which
       adding accounts may be; **California AB 1043**, from 2027-01-01,
       asks a developer to request the system's age signal at download and
       launch and treats it as knowing the reader's age; Utah's duties
       begin 2027-05-06 and Louisiana's 2027-07-01. A summary is in the
       website's step 4j record (`STUDY-DESK.md`); the full report, with
       its sources, is outside the repo, and BVJ can share it.
    4. **The Terms of Use** (`https://litbible.net/terms/`). Will each app
       name them where an account is created, as the website does (“Creating
       an account means you agree to the Terms of Use and are old enough to
       have one,” with the link, beside the button)? And does the iOS app
       use Apple's standard license agreement, which the terms assume?

## The list

### 2026-11-26, the service's limits: a full account, a limit on pushes, and unused accounts (Audit 9)

**One answer you can get is new.** BVJ's decisions 1 to 4 of Study Desk
Audit 9, built in `workers/notebook-service/` (migration
`0004_account_ceiling.sql`), made without BDR in the conversation and so
**for BDR to confirm** (`STUDY-DESK-ENCRYPTION.md`, “Still open,” 92):

- **An account holds at most 100,000 rows and 100 MB** of sealed record (a
  row's `ct` as bytes). A push that would take it past either is **refused
  whole**: status 413, `too_large` with two new members, `what: "account"`
  and `limits: { "rows": 100000, "bytes": 100000000 }`. Nothing of it is
  stored. **An app that reads every `too_large` as “send a smaller
  request” would split the push and loop.** Instead: keep every change on
  the device, send no rows for a while (the website waits an hour, and
  tries at once when its reader asks), keep pulling, and tell the reader
  the account is full and nothing was lost. A push that only removes rows,
  or puts a row again no larger, always goes through.
- **`POST /rows` is limited to 120 in a minute from one address**, beside
  the 1,200 every request shares. It answers `slow_down` with `retry`, as
  before, so an app that already waits on `slow_down` needs nothing new.
- **The hourly run deletes an account that never set up a notebook**, once
  it has no live session and is more than 30 days old (or 30 days past its
  notebook's replacement). Apple's token is revoked first, and the account
  stays until Apple answers. An app that signs a reader in and leaves the
  account without a notebook for a month will find it gone, as after any
  deletion: `sign_in`, then a new empty account.
- **Turnstile checks the site its token was made on.** The apps send no
  token and see no change.

**For BDR**: will each app handle the full account as the website does,
and what will it say to its reader? (The website's words are drafted for
BVJ in `src/lib/desk-sync-status.mjs`.) Full text:
`STUDY-DESK-ENCRYPTION.md`, “Changed in Audit 9: the service’s limits.”

### 2026-11-26, `/privacy` corrected, and the service stores no logs (Audit 9)

**Nothing you call changed**: no request, answer, size, word, or format
point. BVJ's decisions from Study Desk Audit 9, with what touches the apps
**for BDR to act on**:

- **Please carry a What's New note in the next builds** (a suggested
  wording, yours to change): “We updated our
  privacy policy on November 26, 2026: it now names the players and giving
  form other companies show on two of our web pages, and it is more exact
  about what the optional account keeps.” (Rule of 2026-11-25: a material
  change is noted in What's New; the page shows its own “What changed” line
  until 2026-12-26.)
- **The service's plain fields on `/privacy` now list everything the store
  forms need**: a passkey's syncs flag and use count, and a device waiting
  to be approved, its platform and model, for up to ten minutes (the
  `platform` and `model` of `POST /approvals`). Decision 9 of the audit
  (the stores' forms) is BDR's and can be answered from that list.
- **The service stores no log lines** (`observability.enabled: false`). A
  stored Workers Logs event carried the request's full URL, and
  `/devices/:id`, `/approvals/:id`, and `/ways/:id` put an id there. Watch
  the preview live with `npx wrangler tail --env preview` (BDR can't from
  the Actions workflow; ask BVJ). Nothing the apps send changes.

Full text: `STUDY-DESK.md`, “Decisions,” 2026-11-26.

### 2026-11-25, the privacy page, the Terms of Use, and the first-time choice (step 4j)

**Nothing you call changed**: no request, answer, size, word, or format
point, and nothing under `workers/` is touched. It is the words accounts
need before they open, decided by BVJ on 2026-11-25, with what touches
the apps **for BDR to confirm**:

- **`/privacy` has an “Accounts and sync” section**, live now and saying
  accounts are not open yet: what the service keeps and can read, what it
  keeps locked, what we never have, how long each thing is kept, and
  deleting. It also gains “In short” and “Your choices” (Do Not Track among
  them). The app sections are ask 21's.
- **A new page, `/terms/`, the Terms of Use**, in the footer beside
  Privacy: the Liberating Scripture Collective is the party, accounts are
  for 13 and older (or older where a country's law says so), the account
  service gives at least 90 days' notice before it ends, and Oregon law
  governs.
- **The setup screen's two choices keep their titles** (“Follows my
  account,” “This device only”), and each body gains a sentence on what
  the passkey can do: “Anyone who can use your passkey can open it too.”
  and “Your passkey only signs you in.” An app that words its own setup
  may want the same.
- **A policy change is noted in the apps' What's New**
  (BVJ, 2026-11-25: “‘What's New’ is correct, not ‘Translation Updates’, BDR should confirm.”).

Full text: `STUDY-DESK.md`, step 4j.

### 2026-11-25, Turnstile is on in the preview

The check of 2026-11-24 (the entry below headed “Turnstile before a new
account”) is configured on `notebook-preview.litbible.net`: BVJ made the
widget and set its secret. **Nothing changes for an app**, which sends no
`Origin`. What an app's session may notice: `GET /sign-in` now carries
`turnstile`, the widget's site key, to be ignored; and a test client that
sends an `Origin` header to `POST /sign-in/new-passkey/options` without a
token is now refused `not_allowed` (rule `turnstile`). Production has
neither yet. Full text: `workers/notebook-service/README.md`, “Turnstile
before a new account.”

### 2026-11-25, the website says a waiting request and a new device on the page being read

**Nothing you call changed**: no request, answer, size, or word, and no
file under `workers/` is touched. It is a choice about a client's
screens, made by BVJ for the website on 2026-11-25 and **for BDR to
confirm** for the apps (ask 20 above).

- **Why**: a request to delete the account or replace its notebook waits
  seven days so the reader can cancel it, which protects them only if a
  device of theirs says so before the days are up. A device that joins
  can read the whole notebook at once, with no wait, so hearing of it
  soon is the only defense. Until now the website said both only on its
  account page, which a reader rarely opens.
- **A request that waits** (`waiting` in `GET /account`, with `mine`
  false) is told the way a stopped sync is: a dot on the Notebook's tab
  and buttons and on the header's account button, and a notice with the
  sentence and one button that opens the account page, where it can be
  canceled. Once for each request, and again each day while it waits.
  The asking session (`mine`) is told nothing more than its own account
  page shows.
- **A device or a way in that is new** (`GET /devices`, against the ids
  this browser has already told its reader about) gets a dot on the
  account button and the notice once, with “Review” and “OK.” A device
  this computer approved is not announced on it.
- **The website asks `GET /devices` at most every fifteen minutes for a
  browser** for this, by whichever page is open, where before only the
  account page asked. The waiting request costs no request: each pass
  already asks `GET /account`.
- **Seen from your side**: a device you add or a request you make from a
  session without the key now shows on the reader's computer on their
  next page, within fifteen minutes for a device. Worth knowing when you
  test against an account a browser is also syncing.
- The full text is `src/scripts/desk/sync/CLAUDE.md`, rule 11, and
  `STUDY-DESK.md`, “Order of work,” 4h.

### 2026-11-25, the website's account pages are built (step 4h)

**Nothing you call changed, and the pages did not touch the service**:
no request, answer, size, or word. (The Turnstile check is the one
change to the service in step 4h, and comes in its own pull request with
its own entry.) The pages are closed to every reader: they open in one
browser with `?account=preview`, on BVJ's side only for now. What it
means for the apps:

- **The website is now a client of the whole account interface**, with
  screens: sign-in, setup, opening a notebook by passkey, approval, or
  recovery code, the device list, a new recovery code, ways to sign in,
  signing out, deleting, and the request that waits seven days. What it
  does and what was seen in a browser is `STUDY-DESK.md`, “Order of
  work,” 4h. Where the spec leaves a client to choose, its choices are
  “Still open,” 87 to 90 (ask 19 above), each **for BDR to confirm**.
- **`https://litbible.net/delete-account/` now takes a deletion request
  on the page itself**, as Google Play asks (ask 15): a reader signs in
  there and deletes, at once from a computer that holds the key and
  after seven days from any other sign-in. It is closed with the rest
  until accounts open, so **say under ask 15 when the Android build that
  makes accounts goes to review**: the pages must be open by then.
- **A phone's or tablet's browser gets the account's basics only** (BVJ,
  2026-11-24): sign in, see or cancel a request, delete, sign out. It
  never holds a key, and it says the notebook opens in the app or on a
  computer. So on a phone the app is the only client that syncs.
- **The website's device is first named for its browser and system**
  (“Chrome on Windows”), which is what your approval screens and device
  lists will show for it (88).
- **A QR code from the website carries the link the spec recommended**
  (87). The website's page at `/account/connect/` reads the same link.
- **Sign in with Apple and with Google have a web half now, off** (90).
  It turns on only when you send the ids of ask 12, and it has never met
  either provider.
- **Seen in a browser, and the same in your clients unless you choose
  otherwise**: a removed device is told “signed out” and then, after
  signing in, “removed” (83, still yours to answer); after an account is
  deleted its other devices can say only “signed out” (89); and a copied
  passkey that keeps a counter is refused (51), which is worth a try
  with a password manager that syncs passkeys.
- **The website has now used the deployed preview** (2026-11-25, on
  BVJ's go-ahead): its pages, served from `http://localhost:4321`, made
  an account there with a `localhost` passkey, set a notebook up, synced
  a note between three browsers, changed the key, and deleted the
  account. **Nothing of it is left on the preview.** It used passkeys
  only, never `POST /preview/session`, and no secret.

### 2026-11-24, iOS's answers, from its code and a real iPhone

**Facts from the iOS app, not decisions.** BDR's iOS Claude read the iOS
code (`next` at `dd0cfb1`, the 2.2 TestFlight build, with every branch
head, every release tag, and the history) against this repo's `main` at
`c7c729fe`. It then built the notebook's client on a Debug-only iOS
branch (`feat/notebook-sync`, nothing shipped) and ran it on BDR's iPhone.
Paths below are the iOS repo's. **Nothing here answers an ask for BDR's
word**: where the iOS builder gives a view, it says so, and BDR hasn't
ruled on it. The asks above stay open where Android's half or BDR's word
is still to come.

**Ask 4, the marker names.** iOS has written eight: `note`, `emphasis`,
`question`, `heart`, `bookmark`, `lightbulb`, `flame`, and `star`, the
last only on development builds for two days in June (2026-06-23 to 25),
before any TestFlight build could carry it. **It has never written
`ribbon`, and it still writes `bookmark`**, in the 2.2 TestFlight build.
BDR ruled on 2026-11-24 that iOS stops offering `bookmark` in its next
build after 2.2; notes that already carry it keep it on iOS until sync
arrives. A new note with no marker chosen is written `note`. Only notes
made before 2026-06-23, or moved from the app's old database, carry no
marker (nil), and nothing writes `""`. Saving an edited note writes the
marker it shows, so nil becomes `note` and `star` becomes `emphasis`. So
`RENAMED_MARKERS` covers every name iOS has written, as long as `bookmark`
stays in it.

**Ask 8, trash times: no iOS build has ever written the format's trash
record, in any form.** No iOS build has a sync client or an export. Its own
Recently Deleted (from 2.1) is per device and never synced: it stores
`deletedAt` as GRDB's text, `2026-11-23 18:35:09.978` (a space, no `T`, no
`Z`), and the held copy's times as seconds since 2001. Nothing on iOS
stands in the way of the format asking the `Z` form, and iOS's client must
write `deletedAt` fresh in that form, never copy its local column.

**Ask 1, the iOS catch: confirmed, with one addition.** Every delete on
iOS is CloudKit's own record delete, and its time is kept only in that
device's Recently Deleted. **A highlight absorbed by a merge leaves no
record at all**, even on the device (`AnnotationService.swift:268` and
`:1120`). Old rows marked `isDeleted` (from before 2026-05-23) carry no
deletion time, only `updatedAt`.

**Ask 5, the first device check, answered for iOS.** One passkey (Apple's
own, in iCloud Keychain, relying party `litbible.net`), made in the iOS
app on BDR's iPhone (iOS 27.3), gave **the same 32-byte PRF output** in the
app (AuthenticationServices, `saltInput1`) and in Safari on a Mac
(`prf.eval.first`), from the spec's plain 18-byte input in both, which the
app never hashes. They were compared by fingerprint (the first 8 bytes of
SHA-256, `cf840a12ac1cdea3` in both); the output was never shown or kept.
Apple also returns the PRF at creation, the same bytes as at an assertion.
No change to the spec. **Not yet tried**: iOS 26, Safari on the iPhone
itself, and 19 to 21.

**Ask 13, facts only.**
- **42:** the preview accepted a passkey made and used from the iOS app,
  so the app's origin passes the service's check as built.
- **45:** building the standard's JSON forms from AuthenticationServices
  is no burden (about 40 lines), and the real service accepted both a
  registration and an assertion. iOS hands the PRF back apart from the
  response, so `clientExtensionResults` is `{}` and the PRF can't leak
  into a request.
- **51:** iOS has never met a passkey whose count went backward. It had
  never used a passkey before this branch.

**Ask 12, from the code:** the bundle id is `com.litbible.app` and the
team id `9KL9F7A3CR`, matching the site's `apple-app-site-association`.
The app has no Sign in with Apple entitlement and no Google client id.
`webcredentials:litbible.net` is on the iOS branch so far.

**Ask 9, and ask 14's 61.** On 32: the ceilings are fine, but a padded
record can be 1 MiB, so a client must batch a push **by bytes as well as
by count**. The iOS pass does, and the spec could say so. On 35: agreed,
and built to. On 61: no burden for iOS either way.

**Ask 16, the iOS builder's views (not BDR's word).**
- **74:** the same as the website. A phone gets short background windows
  to sync, and a cursor held behind one wrong clock would stall it.
- **76:** iOS needs the damper more than the website does, since a Swift
  merge will be a second, separate build of the format.
- **77:** the same. On iOS, when the notes store won't open, the app runs
  on an empty stand-in, and an empty notebook must never remove rows.
- **82:** it works the same, but a phone that rarely pushes notices late.
  A marker from the service in `GET /account` would help the apps.

Every rule marked for BDR to confirm in asks 11 and 16 is one constant on
iOS, set to what the website does today.

**What passed on the iOS branch:** every case of both crypto vector files
(451 in all, vectors version 2), in pure Swift on CryptoKit with no added
library; the 20 cases of `desk-sync.mjs`; 275 checks against a Swift copy
of the website's fake service; the website's 58 engine cases, and 18 of
iOS's own; and one full run against the preview (setting up, a passkey
holder, push and pull of sealed rows, a second device by approval, a
change of key, a third device by recovery code, and deleting the test
account). `merge-vectors.json` waits for the freeze. On the iPhone, the
Keychain self-test passed: items “after first unlock, this device only,”
never synchronizable.

**Where the spec, the reference, the service, and the website's fake
disagree**, found while building the iOS client. No vector failed; each
is the website's to weigh.

From the crypto (`desk-crypto.mjs`):
1. `TextDecoder` drops a leading byte order mark, and iOS matches; the
   spec doesn't say so.
2. `JSON.parse` takes a lone UTF-16 surrogate in a `\u` escape, which a
   Swift string can't hold, so iOS refuses it as `json`. The spec could
   say no record, card, or keyring carries one.
3. A holder record whose `public` isn't `d`'s own isn't in the vectors.
   iOS refuses it (`record`), and any mismatched key pair as `privateKey`.
4. **“The same id, byte for byte.”** Swift's `==` treats “é” written two
   ways as equal, so a first Swift build let two different ids pass as
   one. iOS now compares bytes. A vector with canonically equivalent ids
   and object keys would catch this on every client; Android should check
   it in Kotlin.
5. CryptoKit's `HPKE` can't be handed a sender key, so iOS runs the
   fixed-key vectors through a small hand-written key schedule, proven by
   the CFRG vectors and RFC 9180, A.3.1.
6. CryptoKit can't be handed an ECDSA nonce, so the `signingKey` vectors
   run in the verifying direction only, as the spec allows.

From the service and the website's fake:
7. The fake hands out `"token-1"`, while `session.js`'s `BEARER` takes only
   43 base64url characters, so a client that checks a token's form can't
   use the fake.
8. The fake's `replaceNotebook` sets `rev` back to 0; `carryOutReplace`
   (`waiting.js`) leaves `accounts.rev` alone.
9. `too_large` for a body: the fake adds `what: "body"`, and `readJson`
   (`http.js`) sends `{ limit }` only, as the spec's table has it. For
   rows, `rows.js` sends `what: "rows"`, which the table doesn't list.
10. `POST /session/proof`: the fake checks no form; `postProof`
    (`account.js`) checks the device id, `kid`, and a 32-byte proof first.
11. `GET /keyring`: the fake doesn't check that `device` is a UUID;
    `getKeyring` (`devices.js`) answers `bad_request` with
    `field: "device"`, which the spec's row doesn't list.
12. `GET /account`: the fake answers `ways: []` and a fixed `expires`.
13. The order of checks differs. The fake checks a body's size and its
    knobs before routing; the service counts the rate limit before routing
    and reads the body after the session checks. The fake has no
    Content-Type check, and `readJson` requires `application/json`.
14. `previewPasskey` (`preview.js`) checks the body before the session
    (the preview only).
15. One fault, two words: `POST /notebook/key` with a passkey that already
    holds the key answers `not_allowed` / `one_holder_per_passkey`
    (`key.js`), and `POST /holders` answers `exists` / `passkey`.
16. A malformed id, two words: an approval's is `bad_request` / `id`
    (`approvals.js`), and a way's is `gone` / `way` (`ways.js`).
17. The `platform` and `model` limits count UTF-16 units, not characters.
    iOS matches; the spec could say which.

From the sync pass (`desk-sync-engine.mjs` and its tests):
18. `openSession` keeps another notebook's keyring in memory after
    refusing it, so the next pass skips the check. iOS holds a keyring
    only once it passes.
19. `adopt` checks nothing while no keyring is in memory. iOS also
    refuses a `kid` below the highest one stored.
20. `rowSize` counts UTF-16 units against a limit in bytes; they agree
    only while a row's JSON is ASCII. iOS counts bytes.
21. `desk-sync-engine-edges.test.js` (“a request waiting on the
    account…”) builds `waiting` as `{what: "notebook", since, ready,
    from}`, which isn't the interface's shape (`what` is `delete` or
    `replace`, with `asked`, `due`, `platform`, `through`, and `mine`).
22. `request` accepts a 200 with no `time`; the iOS client treats that as
    a malformed answer.

**Key storage on iOS: three things the spec doesn't settle.**
- **`sign_in` means two things** (71): a session that ran out, which
  should keep the device's keys, and an account deleted elsewhere, which
  should clear them. A client can't tell which from the word alone.
- **The reinstall check needs a guard.** Before the first unlock after a
  restart, the marker in `UserDefaults` can read as missing, which looks
  like a fresh install, while a Keychain delete may still be allowed. iOS
  writes a probe item before it deletes anything; the spec's sentence is
  safe only with that guard.
- **The session item records which service it is for**, so a preview
  session is never sent to production.

### 2026-11-24, Turnstile before a new account, on the service (step 4h)

**For BDR to confirm**; the design is the website's Claude's. BVJ said
yes to Turnstile on the website's sign-in page (the spec's “Still open,”
68), and the service now checks its token.

- **What changes, and only where a deployment holds both
  `TURNSTILE_SITE_KEY` and the secret `TURNSTILE_SECRET`** (neither the
  preview nor production does yet; the preview does since 2026-11-25, the
  entry above): `GET /sign-in` gains `turnstile`, the
  widget's site key; and `POST /sign-in/new-passkey/options` from a
  request with an `Origin` header must carry `{ "turnstile": "<token>" }`.
  A missing or refused token is `not_allowed` by the rule `turnstile`;
  Cloudflare out of reach, or refusing because the deployment's own
  secret is wrong, is `provider` with `which: "turnstile"`.
- **What doesn't, for the apps**: a request with no `Origin` is not
  checked and its body is not read, so an app sends what it sends today.
  Ignore the new member of `GET /sign-in`. Signing in with a passkey,
  `POST /sign-in/new-passkey`, Apple, and Google are untouched.
- **The open door**: since the check keys on `Origin`, a program can skip
  it by sending none. What would close it is the apps attesting
  themselves, which is ask 18. The spec's “Signing in” and “Changed in
  step 4h,” 1, have the full text.

### 2026-11-24, every setup makes a recovery code (step 4h, begun)

**For BDR to confirm.** BVJ, on the website's setup screen as it was
drawn with a box to tick: “Let's go ahead and give Google/Apple users a
recovery key. They can just choose not to use it if they want. No need to
offer the choice as a checkbox.”

- **What changes for the apps**: the setup screen under “follows my
  account” makes a recovery holder with the passkey holder and shows its
  code, with no question first. It was “offered, not required” (BVJ,
  2026-11-23; the spec's “Still open,” 3). Under “this device only”
  nothing changes: the code was required already.
- **What doesn't**: no request, answer, or word of the service, and
  nothing in the reference or the vectors. `POST /notebook` still takes a
  passkey holder alone, so a notebook without a recovery code can exist,
  and “Add a recovery code” still has to be somewhere for it.
- **The two groups are typed back under both choices.** Asked the same
  day whether a reader under “follows my account” might go on without
  them, BVJ said: “No, they shouldn't skip adding the two number groups.”
  That is the spec's setup, step 5, unchanged.
- **Also in step 4h so far, and nothing for you to change**: the website's
  side of every flow is written and tested against the service's own code
  (no page yet). The spec's “Changed in step 4h” has two things that
  reading of the interface turned up, both already as the spec says them:
  the order `DELETE /ways/<id>` checks in, and what `DELETE /waiting`
  answers a session that could never have canceled.

### 2026-11-24, the website's connector is built (step 4g)

**Nothing you call changed, and the service was not touched**: no
request, answer, size, or word. The website can now sync a notebook with
the service, and no reader can reach it, since nothing signs a browser in
until the account pages (step 4h). What it means for the apps:

- **The website is now a second client of the rows**, so where the
  interface leaves a client to choose, there is a choice on record to
  match or to argue with. They are the spec's “Changed in step 4g” (what
  the website does, in order) and “Still open,” 74 to 84 (ask 16 above).
  **BVJ said yes to eight of the eleven on 2026-11-24 and left three to
  BDR** (81, 83, and 84); all eleven are for BDR to confirm.
- **Pull before push, always**, and the service's row wins an exact tie.
  The second is still the proposal of ask 11; the website is built on it
  behind one constant, so changing it is cheap.
- **A device's cursor after its own push** (the spec's “Records”): a
  device may step over the rows it just stored only when their revisions
  are exactly the next ones after its cursor. It must never take the
  answer's `rev` as its cursor, which would pass over another device's
  rows written in between.
- **A removal takes a revision**, as the spec already said, so the
  revisions of the rows a device sees are not always consecutive. The
  run against the real service showed it; nothing changed.
- **One merge rule moved, on the website only** (`STUDY-DESK-FORMAT.md`,
  “Clocks,” “One trash id, two copies”): two copies of one trash record
  tie toward the store's tiebreak, which under sync is the service's
  row. With no tiebreak the result is as before, so the merge vectors
  are unchanged. **BVJ, 2026-11-24: “Ask BDR,” so it is BDR's to
  answer**, with ask 11 (ask 16, under 81).
- **Run against a local copy of the service, not the preview**: the
  first sign-in merge, offline edits through a reload, a change of key
  with the reseal, deletions each way, a session ended by the service,
  and a removed device joining again by approval. The preview was not
  called, and no test account was made on it.

### 2026-11-24, a check after step 4f merged

**Nothing you call changed.** Step 4f merged and deployed to the preview
that day. Afterward the website's Claude checked the deployed service
and read the two vendors' pages that step's session could not reach.
None of what follows is a decision of BVJ's. Four things for the apps:

- **Rolling back is two choices now.** The workflow is titled “Notebook
  service” in the Actions tab (it was “Notebook service (preview)”),
  and its form asks which deployment, with `preview` as the default.
  Asks 6 and 10 above say so now. The preview is the deployment that
  exists; production's half of the workflow is prepared and off.
- **The limits are real on the preview, and approximate.** 65 sign-in
  starts in seven seconds from one machine: 61 were answered, the 62nd
  was `slow_down` with `retry: 60` and `Retry-After: 60`, and two of
  the next three were answered again. A request of the other count was
  answered right after. So a client should expect `slow_down` a few
  requests past the number, and should not take one answered request
  after a refusal to mean the minute is over. **`POST /preview/session`
  is counted with the sign-in starts**: a test run that asks for more
  than 60 sessions a minute from one address will be slowed.
- **The sign-in number may be low for a room of people** (ask 14, under
  68). A sign-in is two requests, so 60 a minute is 30 sign-ins a
  minute from one address, and Cloudflare's page for its limiter
  advises against counting by address at all, since many people can
  share one. Before a sign-in the service has nothing else to count by.
  The numbers are still BVJ's to approve and yours to weigh.
- **Google Play's account deletion page was read**
  (`support.google.com/googleplay/android-developer/answer/13327111`).
  In short: an app that lets people make an account needs a way to
  delete it inside the app, easy to find, and a web address where a
  reader can ask for deletion without installing or opening the app.
  The web page has to load, has to show the way to ask plainly, and has
  to name the app or the developer as the store listing does. Play
  accepts a link that starts the deletion, a support email address, or
  a form. It also wants readers told how long data is kept, for example
  in the privacy policy. **What that means here** (ask 15): the live
  page names “LIT Bible” and “Liberating Scripture Collective,” which
  is what the Play listing shows; it describes the steps and takes no
  request yet, which is true while no account exists; and an email or
  a form can't serve, because the service keeps no name or address to
  find an account by. So the page's own sign-in and “Delete account”
  (step 4h) must be live before an Android build that makes accounts
  goes to review.

### 2026-11-24, the account work is built on the service (step 4f)


**Nothing you call today changed its path or its body.** One answer
grew: `GET /account` now fills in `waiting`, which was always null, and
has a new member, `replaced`. The full text is
`STUDY-DESK-ENCRYPTION.md`, “The service's interface,” “Waiting seven
days” and “How often a client may ask,” with what moved under “Changed
in step 4f.” **Once this merges it is live on the preview**, with a
database migration, an hourly run, and limits the preview never had.
Production is prepared and **not deployed**.

- **Deleting an account**: `DELETE /account`. From an open session it
  answers `{ "deleted": true }` and everything is gone at once; so it
  is from an account that has no notebook yet. From a session that is
  signed in and no more, send `DELETE /account?platform=ios` (or
  `android`): it answers `{ "deleted": false, "waiting": { … } }` and
  nothing is deleted for seven days. **A device that isn't open always
  sends `platform`.** Apple's guideline wants a reader told when
  deleting takes time: show `waiting.due`.
- **“Start a new notebook”**: `POST /notebook/replace` with
  `{ "platform": "ios" }`, from a session that is signed in and not
  open. It waits the same seven days. Afterward `GET /account` answers
  `notebook` null and `kid` 0, and `POST /notebook` sets up as a first
  device does.
- **Canceling**: `DELETE /waiting`, from any open session, or from the
  session that asked.
- **What every device shows**: `GET /account` answers `waiting` to every
  session of the account as `{ what, asked, due, platform, through,
  mine }`. `platform` is what the asking device said of itself,
  `through` is the kind of way in it signed in by, and `mine` is true
  on the session that asked. A device with the key shows the notice and
  a way to cancel; the spec's “Deleting the account” has the reader's
  side.
- **After a replacement**, `GET /account` answers `replaced` as
  `{ when, platform, through }`: what a device that held the old
  notebook tells its reader before it offers to join the new one.
- **After a deletion**, every other device's next request answers
  `sign_in`, the same word an expired session gets. The service keeps
  nothing of a deleted account, so it can't say more (“Still open,”
  71).
- **A new refusal, `slow_down`** (429, with `retry` in seconds and a
  `Retry-After` header): this address has asked too often. Wait that
  long; never retry in a loop. The limits are 60 requests a minute to
  begin a sign-in and 1,200 a minute for everything else, counted by
  address, so neither app should come near them.
- **`exists` and `gone` may carry `what: "waiting"`**: a request is
  already waiting, or none is there to cancel.
- **The walkthrough has a ninth step**, which asks to delete from a
  session without the key, sees it wait, cancels it, and deletes the
  account from a device with the key. A run now leaves nothing behind.
- **The page Google Play asks for** is
  `https://litbible.net/delete-account/` once this merges: out of
  search, linked from nowhere, and saying that accounts are not open.

**For BDR** (asks 14 and 15 above): the choices, 59 to 73; and the
deletion page's copy.

### 2026-11-24, sign-in is built on the service (step 4e)

**First, two live files changed: the link files the released apps
read.** `public/.well-known/apple-app-site-association` has a new
`webcredentials` section naming `9KL9F7A3CR.com.litbible.app`, the one
app its `applinks` section already named. `assetlinks.json` has
`delegate_permission/common.get_login_creds` beside
`delegate_permission/common.handle_all_urls` in its one statement.
Nothing else in either file moved: every path, the package name, and
both certificates are as they were, and a test now holds both files'
shape (`test/link-files.test.js`). Both forms are the ones Apple's and
Android's own pages show. **BDR, please look at both files once this
merges**, and say at once if a universal link or an app link stops
opening the app. The apps' half is yours: the
`webcredentials:litbible.net` associated domain on iOS, and Credential
Manager on Android.

**Sign-in exists on the service.** A passkey with `litbible.net` as the
relying party signs in on the preview once this merges. Sign in with
Apple and with Google are built and **off**, waiting on ask 12 above.
The full text is `STUDY-DESK-ENCRYPTION.md`, “The service's interface,”
“Signing in” and “Ways to sign in,” with what moved under “Changed in
step 4e.”

- **Nothing you call today changed.** The preview's way in
  (`POST /preview/session`, `POST /preview/passkeys`) works exactly as
  before and stays, and no request that step 4c built changed its path,
  its body, or its answer. Two things behave differently: an open
  session is now kept alive by use (below), and a way to sign in can be
  added to or removed from an account, which moves the lists' version.
- **`GET /sign-in`** says which ways to sign in a deployment has on. The
  preview answers `{ "ways": ["passkey"] }`. A way that is off answers
  `not_found` on its own paths.
- **A passkey, in four calls.** `POST /sign-in/new-passkey/options`
  answers the options for making one; the client adds the `prf`
  extension with the fixed input, makes the passkey, **takes
  `clientExtensionResults.prf.results` out**, and sends the rest to
  `POST /sign-in/new-passkey`, which makes the account and answers a
  session token. Signing in later is `POST /sign-in/passkey/options`
  and `POST /sign-in/passkey`. From there everything is as it was: the
  token goes in `Authorization: Bearer`, and the notebook is opened by
  the key proof or by joining.
- **Options and responses are the standard's JSON forms** (what a
  browser's `toJSON()` makes, and what Credential Manager hands an
  Android app as text). An iOS app builds the response's JSON from the
  parts AuthenticationServices gives it: `id`, `type`, and in
  `response` the `clientDataJSON`, `authenticatorData`, `signature`,
  and `userHandle` (or `clientDataJSON` and `attestationObject` for a
  new passkey), each base64url.
- **A response that still carries the PRF's output is refused**
  (`not_allowed`, rule `prf_results`), before anything else is read.
  That is the spec's rule since draft 2, now enforced.
- **Where a passkey's answer may come from.** The website's origin,
  which is also what a passkey used from an iOS app answers with; and
  the Android app, by the two certificates in `assetlinks.json`. Any
  other origin is `passkey_refused` with `reason: "origin"`.
- **Apple and Google, when they are on.** `POST /sign-in/challenge`
  answers a challenge; the client gives it to the provider's SDK **as
  the nonce, unchanged**; the identity token that comes back goes to
  `POST /sign-in/apple` (with Apple's authorization code) or
  `POST /sign-in/google`. The service keeps the provider's id for the
  account and nothing else: no name, no email address.
- **Several ways in**: `POST /ways/passkey/options`,
  `POST /ways/passkey`, `POST /ways/apple`, `POST /ways/google`, and
  `DELETE /ways/<id>`. Once an account has a notebook each needs an
  open session. The last way in can't be removed, and a passkey that
  holds the key is removed as a holder first.
- **Sessions.** Thirty days from a sign-in, as before. **An open
  session is now kept alive by use**, up to a year from its sign-in, so
  a device that syncs is not signed out monthly; one that is signed in
  and no more is never extended. `DELETE /session` signs out a device
  that never joined. This was the website's Claude's choice, and **BVJ
  said yes to it on 2026-11-24** (the spec's 52). It is for BDR to
  confirm.
- **Three new refusals** to switch on: `passkey_refused` and
  `token_refused` (403, each with a `reason` for your log), and
  `provider` (502: Apple or Google couldn't be reached; try again
  later). `gone` may now say `what: "challenge"`: ask for new options
  and start the sign-in again.
- **Not tested, and said plainly.** No identity token from Apple or
  Google has met this code, and no call has reached Apple: both were
  tested against stand-ins written from the providers' documentation.
  No real device's passkey has met it either: the tests use a software
  authenticator and the examples the WebAuthn standard publishes. The
  first real sign-in of each kind, against the preview, is the test
  that is still owed, and it needs the apps.
- **A passkey you make against the preview is a real `litbible.net`
  passkey** in your password manager. After a wipe it signs in to
  nothing; delete it there.
- **Eighteen choices are yours to confirm**: the spec's “Still open,” 41
  to 58 (asks 12 and 13 above).

### 2026-11-24, the freeze work on the website's side (step 4d)

**This changes the format, and the merge vectors both apps run.** The
format is not declared frozen by it. Everything below is written into
`STUDY-DESK-FORMAT.md` where it applies, and each point is **for BDR to
confirm**. The full account is `STUDY-DESK.md`, “Order of work,” 4d.

- **The merge vectors are version 9** (`test/fixtures/merge-vectors.json`,
  91 cases, ten new; its `about` says what each is for). No rule of
  versions 1 to 8 changed, so a client that passed version 8 fails only
  where it differs on the three points below.
- **Kind 3, `hidden`, is out of the format.** The number is kept, struck
  through, so no later kind moves. **A client that still meets a `hidden`
  record treats it as a kind it doesn't know** (principle 6): keeps it,
  carries it as it arrived, never edits it, and hides nothing because of
  it. Case `keep-a-hidden-record-arrives-as-it-is`. The format, kind 3.
- **The `ribbon` note marker is out of kind 2**, which has six names:
  `note`, `emphasis`, `question`, `heart`, `lightbulb`, `flame`. **Every
  client reads `ribbon` and the older `bookmark` as `note`** (and `star`
  as `emphasis`, as before), a note held by a trash record included, and
  writes neither name. Nothing stored is rewritten for a read. Cases
  `migrate-a-ribbon-marker-reads-as-note`,
  `migrate-an-old-bookmark-marker-reads-as-note`,
  `migrate-a-ribbon-marker-held-in-the-trash-reads-as-note`, and
  `migrate-a-ribbon-marker-and-the-note-it-reads-as-are-one-record`.
  These four are for every client, unlike version 3's ribbon `place`
  cases. **Ask 4 above is still open**, so the rule covers the three names
  the website knows; a note carrying any other name is refused by the
  website when it arrives. The format, kind 2.
- **The service row's fields are in the format** (“How each store holds
  the records”): `v`, `id`, `rev`, `modified`, `deletedAt` on a trash
  record's row only, `kid`, `nonce`, `ct`. Nothing new: it is the row of
  `STUDY-DESK-ENCRYPTION.md`, “A record on the service,” which stays the
  spec, and no record carries an `encryptedBody`.
- **The clock cap is each device's own under sync.** The format's
  sentence “A sync service's cap is its own clock” now says that the
  service caps nothing and each device caps what it receives against its
  own clock, as for a file (the spec's “Still open,” 14, which BVJ said
  yes to on 2026-11-23). The format, “Clocks.”
- **The test that yes came with: two devices whose clocks differ.** Five
  cases, each one pair of edits merged on each device at its own `now`
  (in a case, `now` is the receiving device's clock). They are rule a and
  the clamp as you already have them. What they show, and what your sync
  must do for the last of them to come true:
  - **Clocks within the five minutes of skew agree at once**, on the edit
    with the later `modified`, even when it was the earlier edit
    (`a-clocks-three-minutes-apart-the-slower-device-takes-the-later-stamp`,
    `a-clocks-three-minutes-apart-the-faster-device-keeps-the-later-stamp`).
  - **Clocks further apart agree once the slower one reaches the stamp**,
    and the faster clock's edit wins, even over an edit made on the slower
    device in between. Until then each device keeps its own
    (`clamp-clocks-two-hours-apart-the-slower-device-waits`,
    `a-clocks-two-hours-apart-the-faster-device-keeps-its-own`,
    `a-clocks-two-hours-apart-the-slower-device-takes-it-once-its-clock-arrives`).
    **So a sync that drops a row as ahead must keep its cursor behind that
    row and judge it again later**, as the format already says; a client
    that moves on never takes the edit, and the two devices never agree.
    **Whether the faster clock should win this way is a question for
    BDR** (ask 11 above, its second part; BVJ, 2026-11-24).
- **One thing the test found, not yet decided.** When clocks differ, two
  devices can stamp the same `modified` on different edits: an edit stamps
  1 ms past the version it replaces, so two devices that are both behind a
  third's stamp, and each edit that version, write the same time. With no
  store revision each keeps its own copy (`a-exact-tie-keeps-local`) and
  they never agree, so under sync `rev` has to settle it, the same way on
  all three clients. **The website proposes that the row the service
  holds wins an exact tie** against a device's own copy, in a pull and in
  a `conflict`'s answer. BVJ has not decided this and BDR has not seen it;
  say under ask 11, its third part, if the apps already settle a tie
  another way. The format, “Clocks,” “Two devices whose clocks differ.”
- **Not changed, because nothing was written here to act on**: the three
  format points BDR changed (ask 1), and a trash record's times (ask 8;
  the spec's “Still open,” 31, is still open and the service still
  refuses a row whose `deletedAt` isn't in the `Z` form).

### 2026-11-23, notes from the Greek are built on the website (step 4k)

**Nothing new to build, one thing to expect.** A note started from the
website's Greek tab or pane is kind 2 with no new field, on the LIT's
whole verse or verses (no `quote`), exactly as the entry “after the call”
below says. What you will see arrive is its `body`: it opens with the
Greek the reader chose in curly quotes (“ ”), then a line break and the
reader's own words, for example `“ἠγάπησεν”` then `Loved: an aorist.` A
run that crosses into another verse carries that verse's number inside
the quotes (`“λόγος. 2 οὗτος ἦν”`). The SBLGNT's text-critical signs
(⸀ to ⸅) are left out, so a font with polytonic Greek is all a note needs
(accents, breathings, and iota subscripts). The full text is
`STUDY-DESK.md`, “Order of work,” 4k.

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
- **Rolling back** (ask 6 above): BVJ chose the GitHub workflow, and it
  is on (2026-11-23). A merge to `main` that touches
  `workers/notebook-service/` now deploys the preview by itself, after
  the service's tests, and then runs the walkthrough against it. Anyone
  with write access to this repository can roll back from the Actions
  tab.
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
  (**Added on 2026-11-24**, as five cases: the entry on step 4d, above.)
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
  (**Changed on 2026-11-24**: the entry on step 4d, above.)
- **Kind 3, `hidden`, leaves the format by the freeze**, since the call
  dropped the hidden passage from all three. **Not yet changed in the
  format.** (**Changed on 2026-11-24**: the entry on step 4d, above.)
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
