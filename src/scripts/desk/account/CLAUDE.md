# The account pages

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory. It governs the website's account code wherever it
> lives: the modules listed under "Where the code is," the three pages
> (`src/pages/account.astro`, `account/connect.astro`, the box on
> `delete-account.astro`), `src/styles/pages/account.css`, the header's
> account entry, and their tests.
> Accounts are part of the Study Desk's sync, so **`src/scripts/desk/CLAUDE.md`
> and `src/scripts/desk/sync/CLAUDE.md` apply here too**. The service is
> `workers/notebook-service/` (`workers/CLAUDE.md`), and both sides are built
> to `STUDY-DESK-ENCRYPTION.md`.

## Where it stands

The plan's step 4h (`STUDY-DESK.md`, "Order of work," 4), built 2026-11-24
and 25. **The pages are built and closed**: no reader sees an account until
one browser opens them with `?account=preview` (rule 11). What was and was
not seen in a real browser is under step 4h in `STUDY-DESK.md`. **A
request that waits and a device that joined are also said on the page
being read** (BVJ, 2026-11-25), by the sync's own code:
`src/scripts/desk/sync/CLAUDE.md`, rule 11. Not built: the final words of
the first-time choice (step 4j). Sign in with Apple and with Google are built
and off (rule 19). **The choices Claude made while building are BVJ's
now** (2026-11-25, “yes” to each of the eight listed under step 4h): the
header's tiles, its “Sign out,” and “Account” in the phone menu (rule
17), a heading not drawn twice (rule 18), no announcement here
(“Routes”), “approved from this browser,” the one press of rule 20,
and rule 21's three seconds. **The Turnstile check is on in the
preview** (2026-11-25: BVJ made the widget, for `litbible.net` alone, and
set its secret; `workers/CLAUDE.md`, “The notebook service”), so “Create
an account” shows the widget there, and not from the dev server, whose
address the widget refuses. No widget has been seen on the sign-in page
yet. **BVJ made a real passkey on a Windows
laptop and signed in with it from `litbible.net`** (2026-11-25), the
first outside the rig's virtual authenticator; what prompt made it isn't
recorded. E231 came of it (rule 17). The same day BVJ approved the
choices in the notices that were still Claude's
(`src/scripts/desk/sync/CLAUDE.md`, rule 11). **A spare key by default
changes setup, sign-in, and the account's home** (BVJ, 2026-11-26, BDR's
level 2; `STUDY-DESK.md`, "Order of work," 4, step SK4): the default setup
with no recovery code, "End-to-end encryption" on and off on the home, and
Apple and Google first on the sign-in page with "Sign in with a passkey"
kept as a quieter third. Not built; a Fable session builds it.

## Routes

| Route | File | What it is |
|---|---|---|
| `/account/` | `account.astro` | Every screen: signed out, setup, the recovery code, opening the notebook, the home, the basics on a phone |
| `/account/connect/` | `account/connect.astro` | Where a link that carries an approval code lands (`#a=<16 characters>`, the QR code's content). The same page code, with the code read and taken out of the address first, and used only by a browser that is joining (rule 23) |
| `/delete-account/` | `delete-account.astro` | The public page (in the sitemap, as the stores require), with a box that signs in and deletes or asks to; the box is `data-account-opened` and hidden unless accounts are open |

`/account/` and `/account/connect/` are noindex, out of the sitemap (an
`account` rule in `astro.config.mjs`) and Pagefind, and show one line
without the switch. The announcement popover stays off all three
(`src/components/CLAUDE.md`, "The announcement popover").

## Where the code is

- `src/lib/desk-passkey.mjs`: a passkey's two ceremonies, between the
  service's JSON and a browser's forms. **It imports nothing.**
- `src/lib/desk-account-session.mjs`: what needs no key: signing in, the
  account, its ways in, a request that waits seven days, deleting, ending a
  session. It imports the passkey forms alone, so a page that holds no
  notebook can load it without the encryption.
- `src/lib/desk-account.mjs`: everything that touches the notebook's key:
  setup, joining (passkey, recovery code, approval from either side), the
  lists with each card opened, renaming, changing the key (removing a
  device, a new recovery code, "this device only"), signing a device out.
  A model: no state, no storage, no DOM. It is handed the service (`call`)
  and what the device holds, and hands back what the device must keep.
- `src/lib/desk-account-words.mjs`: **every word the pages say**, the
  switch's key and values, what a device is first called (`deviceName`),
  and the sentence for each failure (`failureWords`). It imports nothing.
  `test/desk-account-words.test.js` holds every sentence to the site's
  conventions, so a new sentence goes in `WORDS` or a function there,
  never in a page.
- `src/lib/desk-account-providers.mjs`: the website's half of Sign in with
  Apple and with Google (rule 19). It imports nothing.
- `src/scripts/account-gate.js`: shared reader code, the three pages' only
  static script. It reads the switch and imports the page dynamically.
- `src/scripts/desk/account/page.js`: what works on any device and holds no
  key (signing in, making an account, the basics, the request that waits,
  deleting, signing out, the providers). **It imports no encryption.**
  `ui.js` is what its screens are built from; `turnstile.js` loads
  Cloudflare's widget only when the service names a site key and the reader
  has pressed "Create an account."
- `src/scripts/desk/account/notebook.js`: everything with the key (setup,
  the recovery code, opening the notebook, the home and its sections,
  linking the sync). `page.js` imports it dynamically, only with
  `data-desk="on"`.
- `src/scripts/desk/account/header-entry.js`: "Sign in" in the header, and
  the account button with its menu (rule 17). `desk-gate.js` imports it.
- `src/scripts/desk/sync/service.js` carries the requests. `signIn: true`
  makes a carrier with no session, for the requests that begin one.

## The rules

1. **The PRF's output never leaves the browser.** A passkey's answer for
   the service is built member by member in `desk-passkey.mjs`, and
   `clientExtensionResults.prf.results` is never copied into it. The output
   goes to the caller apart, as bytes, to seal or open a holder and drop.
   The service refuses a response that carries it (`prf_results`), so a
   slip fails 23 of the tests here; that was checked by making the slip.
2. **The PRF input is the fixed one** (`prfInput()` in `desk-crypto.mjs`),
   given by the caller and never taken from the service.
3. **The device checks; the service is never asked to vouch.** A keyring is
   kept only after `openHolder`'s four checks or `acceptGrant`'s. A new
   keyring is sealed to the public key in a card this device opened, never
   to one the service names. Where the key lives ("follows my account" or
   "this device only") is read from the holder cards that open
   (`whereKeyLives`), not from anything the service says.
4. **A card that doesn't open is unknown, and removed at the next change of
   key** (`readLists` marks it `opens: false`; `changeKey` leaves it out),
   as the spec's "Removing a device" says. It is never kept on trust.
5. **A recovery code is handed to `keep` before the request that makes it
   real**, in `setUp`, `addHolder`, and `changeKey`, so a crash between the
   two never leaves a holder whose code no one saw. The page stores it
   there, shows it only once the request is accepted, drops it on a
   refusal, and forgets it when the reader has typed two groups back.
6. **A passkey that can't open the notebook is never an error that loses
   anything** (`openWithPasskey` answers null): the page offers approval
   and the recovery code, and no holder is deleted or replaced because of
   it.
7. **A device never removes itself by a change of key, and never leaves the
   notebook without a holder**: both are refused before anything is sent
   (`AccountStop`). Signing out is `signOutDevice`, which changes no key.
8. **`desk-account.mjs` is gated as the sync is**: it brings the encryption
   with it, so `test/desk-sync-gate.test.js` lists it, and nothing may
   import it statically but the account pages' own gated code.
9. **Every setup makes a recovery code, and its two groups are always
   typed back** (BVJ, 2026-11-24: “Let's go ahead and give Google/Apple
   users a recovery key. They can just choose not to use it if they want.
   No need to offer the choice as a checkbox,” and, of the check, “No,
   they shouldn't skip adding the two number groups”). So the setup page
   passes `recovery: true` under both choices and offers no way past the
   check. `setUp` still takes `recovery: false`, because the service
   allows a notebook with a passkey holder alone and one made by an app
   may be such a notebook. For BDR to confirm (the spec's “Still open,”
   85).
10. **Two kinds of stop.** `AccountRefusal` is the service's word, with what
   it is about (`error.is("exists", "waiting")`). `AccountStop` is the
   device's own (`wrongCode`, `approvalForged`, `holderNeeded`, …). A page
   words each; neither carries a sentence.
11. **Accounts are closed for everyone until opened in one browser** (BVJ,
    2026-11-24, of Claude's picks: “Yes, your picks”). `?account=preview`
    opens them, `?account=off` closes them, and `?account=local` points a
    page served from this computer at `wrangler dev`. It is one stored
    value, `localStorage['lit-desk-account']`, named on `/privacy`.
    **The parameter works on every page, as `?desk=` does** (E230; BVJ
    typed it on the home page, where nothing read it): `Layout.astro`'s
    pre-paint script reads it, stores or clears the value, takes it out of
    the address (once, where `?desk=` is there too), and stamps
    `<html data-account="open">` from the key, on every device
    (`test/desk-prepaint.test.js`). So the header's way in is drawn on the
    visit that opens accounts, whatever page that is. `account-gate.js`
    reads the stored choice on the account pages and keeps its own
    `readSwitch` for a value the script doesn't know. `page.js` sets the
    stamp itself for a linked browser, which is open whatever the switch
    says. **Opening accounts to everyone** is its
    own change, apart from the Study Desk's launch, and the last line of
    `STUDY-DESK.md`'s “Before accounts open” list (“Order of work,” 4),
    which holds every gate before it: the switch and its key
    (`account-gate.js`, `SWITCH_KEY`, the pre-paint line, `/privacy`'s list
    item), the one-line notes on the two pages, `data-account-opened` on
    `/delete-account/` and its rule in `account.css`, the header's rule
    (`html[data-desk][data-account="open"] .site-header__account` in
    `global.css`), whether `/account/` stays noindex, and the production
    service's origin in `SERVICES`. **Step 4j's words go with it**
    (2026-11-25): `/privacy`'s “Accounts are not open yet.” paragraph
    under “Accounts and sync” and its “Until accounts open…” sentence,
    `/terms/`' “Accounts are not open yet;” in “Accounts,” the help page's
    “(being tested, and not open to everyone yet)” in three places and
    “Accounts are being tested…” opening “An account,” the first-time
    card's closed form (`CARD_WORDS.closed`, which says an account “is
    coming”), and both pages' effective dates. **The card's open form
    reads the same stamp** (`accountsOpen()` in `first-use.js`), so
    whatever replaces the switch must still stamp `data-account="open"`
    for every reader, or that function must change with it.
12. **Split by the key, and a phone gets the basics** (BVJ, the same day).
    `page.js` runs on every device and holds no key. `notebook.js` loads
    only with `data-desk="on"`. So a phone or tablet can sign in, see or
    cancel a request, delete the account, and sign out, and is offered
    nothing that touches a key; the page says where the notebook can be
    opened. It never opens the notebook's database there.
13. **What the page keeps is in `lit-desk-sync`, and `/privacy` says each**:
    `account` (a sign-in that isn't the sync's yet: mid-setup, or a phone
    that may come back to cancel), with `setup` inside it while a setup's
    request is out; `code` (a new recovery code sealed to this device's
    key, until two groups are typed back); `seen` (which devices and ways
    this browser has told its reader about, written by the home's “OK”
    and by the same “OK” on the sync's notice,
    `src/scripts/desk/sync/CLAUDE.md`, rule 11); and `provider` (rule 19). **A
    setup whose answer never arrived is finished on the next visit with the
    same code** (`resumeSetup`), and one the service never received is
    dropped and starts over. Nothing of a passkey's PRF output is stored.
    The header's note of what it showed last (`lit-desk-account-last`,
    rule 17) is a key of its own, since the pre-paint script reads it,
    and `/privacy` names it too.
14. **Signing out, deleting, and “Stop syncing in this browser” keep the
    notebook in the browser, and say so** (BVJ, the same day: no “erase it
    here too”). Signing out is asked first, in one place: the header's
    “Sign out” is a link to `/account/#sign-out`, which opens the question
    (the page hears `hashchange` too, since on the account page itself only
    the fragment changes). The page's sheet carries `id="sign-out"` for
    it, because `npm run check:links` fails a fragment with no element.
    **Both end the service's session** (Audit 9; BVJ, 2026-11-26).
    Signing out removes this browser's device entry only where the session
    is attached to it: in the `removed` and `otherNotebook` stops it sends
    `DELETE /session` alone (`attached: false`), and `signOutDevice` falls
    back to the same where the service answers `own_device` (COH9-1).
    “Stop syncing” sends `DELETE /session` first and stops whatever that
    answers (SY9b-2), so no session is left behind on the service.
15. **`replace: true` has one way to be said**: “Join the new notebook,” on
    a stop of `otherNotebook`. Nothing else sets `S.replace`, and it is
    cleared when a link is made or the reader leaves. The old browser's
    notebook is untouched until then and goes into the new one after.
16. **“Reconnect” keeps its word and opens this page** (BVJ, the same day;
    `src/scripts/desk/sync/CLAUDE.md`, “What the account pages supply”).
    The home's first block names the real step for the stop: “Sign in
    again,” “Join again,” or “Join the new notebook,” each beside “Stop
    syncing in this browser.” While a stop stands, nothing that needs the
    key is offered.
17. **The header's entry** (BVJ, 2026-11-24): “Sign in” at the end of the
    header's tools, only with the Study Desk on, on a computer, with
    accounts open; once the browser is linked, a small account button whose
    menu holds the sync's status (the status line's own slot), “Account and
    devices,” and “Sign out.” “Study Desk ▾” is unchanged. Under 760px it
    is “Account” in the phone menu's Study group. Five things to keep:
    - **It reads only the link** (`peekLink`), so it brings no encryption
      and starts no sync, and `test/desk-sync-gate.test.js` holds its two
      imports. A reader signed in but not yet linked still sees “Sign in.”
    - **It is in the markup twice** (`SiteHeader.astro`: the nav's tools
      and the actions), as the search button is, and hidden by one rule in
      `global.css`. Until its state is known it keeps its room and shows
      nothing, so the row never moves.
    - **It is as wide as what it shows, and the room is right from the
      first paint** (E231; BVJ, 2026-11-25: the button keeping the words'
      width left a gap, and “the rest of the header scoots over to stay
      next to it”). The button is narrower than “Sign in,” and which of
      the two a browser gets is read after the page has painted. So
      `header-entry.js` keeps a note of what it showed
      (`localStorage['lit-desk-account-last']`, "in" or absent; the note
      is Claude's choice of means), `Layout.astro`'s pre-paint script
      stamps it as `data-account-last="in"`, and `global.css` holds the
      button's room where it says so and the words' otherwise. **The note
      is a hint: what shows always comes from the notebook.** Where the
      two differ (linked, or signed out, in another tab), the tools move
      once, the note is put right, and `lit:header-tools` on `document`
      has the title fitted again (`src/components/CLAUDE.md`, “The
      header's title swap”); `desk-gate.js` sends the same when the
      entry's script fails to load and the plain link shows. Two of the
      four files can't import, so `test/desk-account-header.test.js`
      holds the key, the stamp, and the event to one name each. Never fix
      a width on the entry. The title-fit script counts the entry's room,
      which costs the long title some widths: measured 5px apart
      (2026-11-25, down to 1105px), `/` and a chapter show “LIT Bible” up
      to 1215px with “Sign in” and up to 1180px with the button
      (`/about/`: 1260 and 1225px).
    - **`start()` can be called again**, and the account page does: when
      it links the browser or stops syncing, and on a visit whose stamp
      wasn't there before paint, so `desk-gate.js` never drew the entry (a
      linked browser with the switch off).
    - **Both buttons are tiles**, as the search and Aa buttons are
      (Claude's choice, which BVJ kept, 2026-11-25: green text beside the
      green “Read” read as a second primary). Site 2.0's `restyle.css`,
      which drew them, went in Featherboa's Phase 0; Featherboa's kit
      draws them from Phase 2.
18. **One screen at a time, and its heading takes focus** (`screens` in
    `ui.js`), except the page's first, which leaves focus alone: taking it
    on load scrolled `/delete-account/` to its box. A heading that repeats
    the page's own h1 is kept for a screen reader and not drawn. A button
    is busy (`aria-disabled`), never `disabled`, while its step runs. A
    step that waited checks `ui.live()` before it draws. **An “Are you
    sure” is `confirmBox`, shown with `focusConfirm`** (Audit 9, AC9-1):
    focus goes to its question, never to the button that does it; the
    group is named by the question and that button described by it;
    Escape is Cancel, and neither cancels while the step runs. Cancel
    puts focus back where the reader asked.
19. **Sign in with Apple and with Google are built and off**
    (`desk-account-providers.mjs`'s header is the account of it). A
    provider is offered only when the service lists it **and**
    `PROVIDER_CLIENTS` has the website's client id for it; both are null,
    none is guessed, and **neither provider has ever been tried**. With
    none set the page asks the service nothing more and draws no button.
    The flow is a navigation to the provider's page and back with the
    identity token after the `#`: no script of theirs and no new origin in
    the CSP. The page keeps the service's challenge and a random `state`
    for five minutes, takes the answer out of the address before anything
    else runs, and sends the token on only when the state is the one it
    kept. **Turning one on** means: the id in `PROVIDER_CLIENTS` and among
    the service's `*_CLIENT_IDS`; both of `RETURN_PATHS` registered with
    the provider; a try against the real provider in a real browser,
    including a canceled sign-in and Apple's code exchange; each
    provider's own rules for its button (they are plain buttons today);
    and `/privacy`'s sentence, which says “it is not yet.”
20. **“I can’t do any of these” is the one way to a new notebook.** It is
    folded under the ways to open a notebook, asks nothing more (the
    request waits seven days, and a device with the key can cancel it),
    and is not offered while any request waits.
21. **The home fills from the top down** (BVJ, 2026-11-25: “Yes, fix it,”
    of the home shifting when its late sections arrive). Where the key
    lives, the devices, and the recovery code wait on requests of their own
    (`readLists`), so over a network they come after the status line. What
    lies under them, “Ways to sign in” and “Sign out or delete,” is drawn
    at once inside `.account__rest` and held back, then shown in the same
    step as the three (`settle` in `showHome`), so neither ever moves down
    the page under a reader. Four things to keep:
    - **The wait has an end**, `REST_WAIT_MS` (three seconds; Claude's
      number, which BVJ kept, 2026-11-25), because signing out and
      deleting are down there. Past it the
      rest shows and moves once when the lists come. A stop, or a state
      with no pass running (offline, slowed, a pass that failed), settles
      at once, since no list is coming.
    - **The three sections, the notice of what is new, and the rest show
      together**: the notice is read (`drawNews`) before any of them is
      shown. The notice sits above the status, so on the rare visit that
      has one the status moves down once; nothing else above the lists
      arrives late.
    - **The header's “Sign out” waits for it** (`wantSignOut`): the mark
      leaves the address at once, and the question opens when the home has
      settled, never under sections still to come.
    - **A new section of the home** that waits on a request goes above
      `.account__rest` and is shown in `loadLists`' one step; one that
      doesn't wait goes above the lists or inside the rest.
22. **One name for the local place** (BVJ, 2026-11-26, Audit 9 decision 13).
    Every reader-facing string says **“this browser”** where the notebook
    is kept or syncs (two browsers on one computer hold two notebooks),
    **“this computer”** only for a saved file or the hardware (“a file on
    your computer,” a clock), and **“device”** only in “This device only”
    and for the account's set (“your devices,” “Add a device,” a device
    card). A new sentence follows it.
23. **An approval is said in full, and a link never asks it** (BVJ,
    2026-11-26, Audit 9 decision 5, SEC9-1). The question
    (`addQuestion`) names the device, says when the request was made and
    how its session signed in (`askedWords`, from the answer's `created`
    and `through` against its `time`), and says to approve only a device
    in hand: one showing this code now, or, after “Show a code for the new
    device instead,” one where the reader just entered or scanned it. **A
    browser that holds the notebook never acts on a link's code**: the
    code leaves the address as before, `loadLists` drops it, and “Add a
    device” opens empty, focused, with a line asking for the code the new
    device shows. Only a browser joining uses a link's code. Since a link
    can be sent by anyone, keep it that way.

## Testing

- **The flows run against the service's own code**
  (`test/desk-account.test.js`, in `npm run test:desk`).
  `test/helpers/real-notebook-service.mjs` runs
  `workers/notebook-service/src/` in Node on a real SQLite database
  (`node:sqlite`) with the real migrations, behind a small stand-in for D1,
  so no check, word, or shape of the service's is written out again by
  hand. Its header says what stands in for Cloudflare. **A change under
  `workers/notebook-service/src/` or its `test/authenticator.js` can
  therefore fail the root suite**, which is the point.
- **Passkeys are real**: `test/helpers/fake-credentials.mjs` puts the
  service's software passkey behind a browser's `navigator.credentials`,
  with a PRF that is a real function of the passkey and the input. A second
  computer with a synced passkey is a second `fakeCredentials()` holding
  the same passkey.
- **A test that needs the service broken at an exact point** (a race, a
  half-answered request) still uses `fake-notebook-service.mjs`, as the
  sync's tests do.
- Never assert on a whole answer of the service's: every one carries
  `time`. Compare the members the test is about.
- **The pages are driven, not read** (`test/desk-account-page.test.js`,
  `desk-account-providers.test.js`, `desk-account-header.test.js`):
  `test/helpers/account-page.mjs` opens the real page in a happy-dom
  window over the real store, the real connector, and the service's own
  code. `world()` is a service, `browser(w, …)` a device (`desk: false`
  for a phone, shared `creds` for a synced passkey), `openPage(b, …)` a
  visit, and `page.press(label)` waits for the step to end. Seven days
  pass with `w.service.due(time)`. Apple and Google are
  `test/helpers/fake-providers.mjs`, which replaces `fetch` until
  `restore()`.
- **In a real browser, drive headless Chrome over the DevTools protocol**
  with a virtual authenticator (`WebAuthn.addVirtualAuthenticator`: ctap2.1,
  internal, resident keys, user verification, `hasPrf`, both backup flags),
  one `Target.createBrowserContext` for each device, against `wrangler dev`
  and a built `dist/` served at `http://localhost:4321`. Three things that
  rig can't show, each of which looked like a fault and wasn't:
  1. **A copied credential has another PRF secret**, so “the same passkey
     on a second computer” opens nothing there. That is rule 6's case, and
     the only way to see a synced passkey carry the key is a real one.
  2. **The virtual authenticator counts per copy**, and the service
     refuses a counter that didn't go forward (the spec's “Still open,”
     51). A real synced passkey reports 0.
  3. **A verse number clicked in the page's first instant** gets the
     reader's menu without the desk's rows, since the first stage hasn't
     arrived. Wait for the Notebook's tab before clicking.
  The Browser pane can't run a WebAuthn ceremony, and no OS passkey prompt
  can be driven: say plainly what was not seen.
- **The same rig runs against the deployed preview** with
  `?account=preview` in place of `?account=local`, and only on BVJ's
  go-ahead, each time. Two things differ there. **Delete the account the
  run made, in a `finally` too** (`DELETE /account?platform=web` with the
  session the page kept), since the virtual passkey is gone when Chrome
  closes and nothing else could sign in to delete it. **Wait for the
  home's lists, not only for “in sync”**: the three sections that need
  their own requests are drawn a moment later over a network.
- **And from `litbible.net` itself**, the same way and on the same
  go-ahead: the pages at `https://litbible.net` with `?account=preview`,
  and `litbible.net` as the relying party wherever the rig names one.
  It is the only run in which the site's headers meet these pages.
  **Keep the run out of the site's numbers**: block
  `*cloudflareinsights.com*` and `*/csp-report*` in each device
  (`Network.setBlockedURLs`), so test visits are not in the analytics
  and the policy's week of reports counts readers only, and record
  violations in the run instead (a `securitypolicyviolation` listener
  added to every new document, and the protocol's `Log.entryAdded`).
