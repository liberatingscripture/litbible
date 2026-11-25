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
not seen in a real browser is under step 4h in `STUDY-DESK.md`. Not built:
the notices anywhere but the account's home, and the final words of the
first-time choice (step 4j). Sign in with Apple and with Google are built
and off (rule 19). The Turnstile check's half on the service is its own
pull request.

## Routes

| Route | File | What it is |
|---|---|---|
| `/account/` | `account.astro` | Every screen: signed out, setup, the recovery code, opening the notebook, the home, the basics on a phone |
| `/account/connect/` | `account/connect.astro` | Where a link that carries an approval code lands (`#a=<16 characters>`, the QR code's content). The same page code, with the code read and taken out of the address first |
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
