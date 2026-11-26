# The LIT notebook service

A Cloudflare Worker with a D1 database that holds each signed-in reader's
Study Desk notebook so that the website, the iOS app, and the Android app can
sync it. Everything it holds is sealed on the reader's own devices: the
service stores sealed rows and sealed keys, checks what can be checked without
a key, and can open nothing.

**Its specification is `STUDY-DESK-ENCRYPTION.md` at the repo root, "The
service's interface."** Every request here, the shape of its body and its
answer, every size, and the word of every refusal is a row of that section,
and each check has a test. Read that section before changing anything in
`src/`; change the two together.

This is steps 4c, 4e, and 4f of the plan in `STUDY-DESK.md` ("Order of work,"
4). **What it is today: the whole interface, under test, and deployed as a
preview at `https://notebook-preview.litbible.net` (since 2026-11-23, test
data only).** A passkey signs in (step 4e, 2026-11-24). Sign in with Apple
and with Google are built and off, and have never met either provider
("Apple and Google" below). Deleting an account, the requests that wait
seven days, the hourly run, and the limits are built (step 4f, 2026-11-24;
"The account work" below). **Production is prepared and not deployed**
("Production" below): no reader's notebook is on any service yet. The
website's connector (step 4g) and account pages (step 4h) call it, and the
check before a new account (Turnstile) is on here since 2026-11-25.

**When it breaks, read `RUNBOOK.md`**, one page, in this directory.

## What is here

```
src/index.js       routes, CORS, and the one log line a request leaves
src/http.js        answers, refusals and their words, reading a body
src/check.js       the form and size of every value, and the limits (LIMITS)
src/db.js          "checked and written as one step" on D1 (guard, commit, transact)
src/session.js     the three kinds of session, how long one lasts, the key proof, createSession()
src/signin.js      signing in: challenges, a passkey, Apple, Google
src/ways.js        several ways in to one account: adding one, removing one
src/passkey-form.js  a passkey's options and response as JSON, the accepted origins, the PRF rule
src/webauthn.js    checking a passkey's answer (WebAuthn 7.1 and 7.2), bytes in and a verdict out
src/cbor.js        the small CBOR reader webauthn.js needs
src/providers.js   Apple's and Google's identity tokens, and the two calls to Apple
src/jwt.js         RS256 tokens against a provider's published keys; the token Apple asks us to sign
src/turnstile.js   Cloudflare Turnstile before a new account, from a browser (off until configured)
src/account.js     GET /account, POST /session/proof, POST /notebook
src/devices.js     the device and holder lists
src/key.js         POST /notebook/key, the change of key
src/rows.js        GET /rows, POST /rows
src/approvals.js   the four approval requests
src/waiting.js     DELETE /account, POST /notebook/replace, DELETE /waiting, and what is done when one falls due
src/scheduled.js   the hourly run: what is due is carried out, what ran out is swept
src/limits.js      how often an address may ask
src/lists.js       what the list requests share
src/preview.js     the preview's way in (never in production)
migrations/        the D1 schema, one numbered file a change
test/              the suite: it runs the Worker in workerd on a real local D1
scripts/walkthrough.mjs        the check to run against a deployed preview
scripts/check-production.mjs   the check to run against a deployed production (no secret, writes nothing)
RUNBOOK.md         what to do when the service breaks, on one page
```

The package is on its own: its own `package.json` and lockfile, as
`workers/contact-form/` has. The root `npm ci` and `npm test` never reach it.
Its tests import the website's encryption reference by relative path
(`../../src/lib/desk-crypto.mjs`) and the vectors (`../../test/fixtures/`),
and nothing of the service ships to the site.

## Configuration, by name

All of it is in `wrangler.jsonc`, in two named environments: `env.preview`
and `env.production`. **The top level is deliberately empty**, so a command
that leaves `--env` off reaches no database and answers at no address. A
named environment inherits no binding, variable, trigger, or rate limit, so
each is written out in both, and `test/config.test.js` holds the file to
what each must and must not have.

| Name | Kind | What it is |
|---|---|---|
| `DB` | D1 binding | The database. The preview's is named `litbible-notebook-preview`; production's is to be `litbible-notebook`, and doesn't exist yet |
| `ENVIRONMENT` | variable | `preview` or `production`. The preview's way in works only where this says exactly `preview` |
| `SIGN_IN_LIMIT`, `PUSH_LIMIT`, `REQUEST_LIMIT` | rate limit bindings | How often one address may ask: 60 a minute to begin a sign-in, 120 a minute for `POST /rows` (BVJ, 2026-11-26, Audit 9), 1,200 a minute for everything else ("The account work" below). Each environment has its own three namespaces. A namespace id is a number we choose; it is no resource to create and no secret. **A missing binding answers "error" to every request**, so a deploy that drops one is seen at once |
| the cron trigger | `triggers.crons` | `17 * * * *`: every hour, at seventeen past, the hourly run |
| `PREVIEW_SIGN_IN` | variable | `on` on the preview, and set nowhere else |
| `ALLOWED_ORIGINS` | variable | The origins a browser may call from, comma separated (the website, and its dev server) |
| `PREVIEW_SECRET` | Wrangler secret | What `POST /preview/session` asks for. At least 32 characters. The preview only, never production |
| `PASSKEY_RP_ID` | variable | The relying party passkeys are made for: `litbible.net`. Passkeys are on where this and the next are set |
| `PASSKEY_ORIGINS` | variable | Where a passkey's answer may come from, comma separated: the website's origin, and each Android signing certificate as `android:apk-key-hash:…` ("Passkeys" below) |
| `PASSKEY_LOCAL_ORIGINS` | variable | The preview only: the website's dev server (`http://localhost:4321`), with the relying party `localhost`. Read only where `ENVIRONMENT` is `preview`; production never sets it |
| `GOOGLE_CLIENT_IDS` | variable, **not set** | The OAuth client ids a Google identity token may be issued to, comma separated. Sign in with Google is off until it is set |
| `APPLE_CLIENT_IDS` | variable, **not set** | The client ids an Apple identity token may be issued to (a bundle id, a Services ID), comma separated |
| `APPLE_TEAM_ID`, `APPLE_KEY_ID` | variables, **not set** | The Apple developer team, and the id of its Sign in with Apple key |
| `APPLE_PRIVATE_KEY` | Wrangler secret, **not set** | That key, the text of the `.p8` file. Sign in with Apple is off until all four of Apple's are set |
| `TURNSTILE_SITE_KEY` | variable, **set in the preview** (2026-11-25), not in production | The site key of the notebook service's Turnstile widget. Public by design: `GET /sign-in` hands it to the website, which shows the widget with it ("Turnstile before a new account" below) |
| `TURNSTILE_SECRET` | Wrangler secret, **set in the preview** (2026-11-25) and required there, not in production | That widget's secret key. The check is off until both this and the site key are set |

No value of a secret is written in this repository, in a pull request, or in a
conversation with an assistant. `DISASTER-RECOVERY.md` records names only.
**No identifier of Apple's or Google's is written here either**: they come
from BDR's Apple developer account and Google Cloud project, and none was
guessed.

## Run it locally

Nothing here needs a Cloudflare account.

```bash
cd workers/notebook-service
npm ci
npm test                 # the whole suite, in workerd, on a local D1
npm run check            # bundles the Worker as each environment's deploy would, and uploads nothing
```

To run it as a server, for an app's debug build or the walkthrough:

```bash
cp .dev.vars.example .dev.vars    # then put 32 or more characters of your own after PREVIEW_SECRET=
npm run migrate:local             # makes the local database
npm run dev                       # http://localhost:8787
```

Then, in another shell:

```bash
npm run walkthrough      # nine steps, against http://localhost:8787
```

To start the hourly run by hand, run the server with
`npx wrangler dev --env preview --test-scheduled` and open
`http://localhost:8787/__scheduled`. Its one log line appears in the
server's output.

For a local address the script reads the secret from `.dev.vars` itself, and
it never prints it.

`.dev.vars` is ignored by git. Use a value made for this machine, never the
deployed preview's.

## The tests

`npm test` runs every request as a real client would send it, in workerd,
against a local D1 made from the real migrations.

- `walkthrough.test.js`: the test vectors' walkthrough end to end (a first
  device, a second by passkey, a third by approval, a removal with a change of
  key, the switch to "this device only," a recovery by code), with the exact
  sealed values the vectors give, each opened again with the website's
  reference.
- `notebook.test.js`: the same life with freshly made keys, and the flows the
  vectors don't reach (a rename, signing out, a conflict, paging).
- `sessions`, `account`, `setup`, `devices`, `key`, `rows`, `approvals`: one
  test for each check in the interface's tables, each built from a request
  that would be accepted with one thing changed.
- `sign-in.test.js`: sign-in as a reader lives it. An account made with a
  passkey, the same passkey opening the notebook on a second device, a
  second way in, Apple, and Google, each a whole flow.
- `passkeys.test.js`, `providers.test.js`, `ways.test.js`: one test for each
  check of the sign-in and ways-in requests. The passkeys are made and used
  by a software authenticator (`test/authenticator.js`); Apple and Google
  are stood in for by a provider with real keys that signs real tokens
  (`test/idp.js`), and `fetch` is replaced for the length of a test.
- `webauthn.test.js`: the passkey-checking code against the examples the
  WebAuthn standard itself publishes (`test/fixtures/w3c-webauthn-vectors.json`,
  copied from Level 3, section 16), so it is not only checked against an
  authenticator written beside it.
- `sign-in-races.test.js`: sign-in and ways in where two requests meet, and
  how long a session lasts.
- `turnstile.test.js`: the Turnstile check, on and off by configuration,
  each way a token is refused, siteverify out of reach, a "no" that is
  the deployment's own fault (a wrong secret), an app's request
  (no `Origin`) let through unchecked, and the secret in no answer or log
  line. Siteverify is stood in for, and `fetch` replaced, as for Apple.
- `http.test.js`: the time on every answer, bodies, CORS, and that no token,
  proof, id, body, challenge, credential, identity token, or code reaches a
  log.
- `preview.test.js`: the preview's way in answers "not found" unless the
  environment turns it on.
- `waiting.test.js`: `DELETE /account`, `POST /notebook/replace`, and
  `DELETE /waiting`, one test for each check, with Apple stood in for; and
  the deletion of a notebook of 20,000 rows.
- `scheduled.test.js`: the hourly run. **Time is tested two ways**: the run
  is given an instant, so a test stands exactly on a request's `due` and one
  millisecond before it; and the Worker's own `scheduled` handler is run
  with the clock itself moved, so the path a real run takes is the one
  tested. Also what a run does when Apple is down, when one request fails,
  and when more are due than one run takes; and the sweep, accounts never
  set up among it.
- `sweep-races.test.js`: the sweep of accounts never set up, where a
  request meets it. Each condition in its deleting statements (no
  notebook, old enough, no live session, no Apple token) was taken out in
  turn, and a test here failed each time.
- `waiting-races.test.js`: the account work where two requests meet, or a
  request and a run. Each condition in a statement of `src/waiting.js` was
  taken out in turn, and a test here failed each time.
- `limits.test.js`: the three limits, against workerd's own local copy of
  Cloudflare's rate limiting, with the numbers `wrangler.jsonc` gives. That
  local copy counts exactly, in windows aligned to the wall clock, so a
  burst that crossed the top of a minute was counted in two halves and never
  refused (it failed a CI run on 2026-11-24). Each test there now waits for
  the next window when fewer than six seconds are left of the current one.
- `config.test.js`: `wrangler.jsonc` and the deploy workflow, held to what
  production must never have (anything of the preview's way in, a dev
  server, a deploy on a push).
- `races.test.js`: "checked and written as one step." Each test pauses one
  request right after a read, lets a second request finish, and lets the
  first go on; it fails if the guard it is about is weakened. Among them,
  two pushes meeting at the edge of the account's ceiling.

**What the tests can't show**: anything about the real D1 over a network. That
is what the walkthrough is for, after a deploy. Its eighth step pushes a row
of the largest size the format allows and reads it back, and its ninth
deletes the account, each of which only a deployed database can prove. **Nor
Cloudflare's own clock starting the hourly run, nor its real limiter's
counting**: "What to check on the preview after step 4f" below. **Nor anything about a real passkey, a real Apple or
Google token, or Apple's real answers**: see "Passkeys" and "Apple and
Google" for what is owed there.

One test outside this package belongs to it: the root's
`test/link-files.test.js` holds the shape of the site's two link files and
fails if `PASSKEY_ORIGINS` in `wrangler.jsonc` and the certificates in
`public/.well-known/assetlinks.json` ever differ.

## The preview

**Everything on the preview is test data and may be wiped at any time.** No
real notebook belongs there, and nothing there is backed up on purpose.

It was first deployed on 2026-11-23, and the walkthrough (step 6 below) run
against it over HTTPS passed 8 of 8 steps that day. Since step 4f the
walkthrough has nine steps, and its last deletes the test account it made,
so a run that passes leaves nothing behind. A run that fails partway leaves
its account, named `walkthrough-…`; "Wipe" clears those, and the ones left
by runs before step 4f.

### One-time setup (BVJ)

**Done on 2026-11-23**, by a session at BVJ's word, with BVJ typing the
secret. The steps stay here as the way to make the preview again from
nothing. Cloudflare is BVJ's account, and each of these creates or changes
something on it: they are for BVJ to run, or an assistant only when BVJ says
so in that session.

1. Sign in: `npx wrangler login` (once on a machine). The browser page it
   opens waits about two minutes for "Authorize."
2. Make the database:
   `npx wrangler d1 create litbible-notebook-preview`
   It prints a `database_id`. Put it in `wrangler.jsonc`, in
   `env.preview.d1_databases`, in place of the id there, and commit that. An
   id is not a secret.
3. Make its tables: `npm run migrate:preview`
4. Set the preview's secret: `npx wrangler secret put PREVIEW_SECRET --env preview`
   Wrangler asks for the value and shows asterisks; type or paste at least 32
   random characters (a password manager's generator will do; letters and
   digits are the least trouble for every tool that will carry it). The
   Worker doesn't exist yet, so wrangler offers to create it and add the
   secret: say yes. Keep the value in the password manager, since Cloudflare
   never shows it again.
5. Deploy: `npm run deploy:preview`
   The first deploy also makes the Custom Domain, `notebook-preview.litbible.net`,
   with its DNS record and certificate (see "The address" below).
6. Check it, at a terminal:
   `npm run walkthrough -- https://notebook-preview.litbible.net`
   The script asks for the secret from step 4 and draws it as asterisks as
   it is typed or pasted. Nine lines of `ok` mean the deployed service does
   everything the suite does, on the real database, down to keeping a row of
   the largest size. Where there is no terminal to ask at (a workflow), the
   script reads the secret from `PREVIEW_SECRET` in the environment. For a
   deployed address it never takes the secret from a file or an argument.
7. Give BDR the secret, directly and privately (see "How an app gets a
   session").

The account's plan matters in one way. On Workers Free a request gets 10 ms of
CPU, which is enough for everything here but may cut off a push of several
megabytes; on Workers Paid the limit is 30 seconds. The preview works on
either. Production stays on Free for now (BVJ; "Production" below).

### The address

`notebook-preview.litbible.net`, as a Custom Domain on the `litbible.net` zone
(`routes` in `env.preview`). BVJ's choice, and live since 2026-11-23. Why
this and not a `workers.dev` name: it doesn't put the account's
`workers.dev` subdomain into two apps and a spec; it stays the same if the
Worker is ever renamed or moved; the zone's own protections apply to it; and
production takes the same shape (`notebook.litbible.net`, written into
`env.production` in step 4f, for BVJ to settle). `workers_dev` and `preview_urls` are off, so the service answers at this
one address and no other.

To use another address, change `routes` in `env.preview`, and the address in
`STUDY-DESK-ENCRYPTION.md` ("How a request is carried") and in
`STUDY-DESK-FOR-THE-APPS.md`.

The website's Content Security Policy names this origin in `connect-src`
(`public/_headers`, since the connector, step 4g).

### Deploy again

A merge to `main` that touches this package deploys the preview by itself
(the workflow, on since 2026-11-23), and "Run workflow" with action `deploy`
does the same on demand. By hand, which needs `wrangler login` on BVJ's
account:

```bash
npm test
npm run migrate:preview     # applies any migration not yet applied; safe to run when there is none
npm run deploy:preview
```

Then the walkthrough, as in step 6.

### Migrations

A migration is applied **before** the code that needs it is deployed, and a
rollback of the code never undoes one. So every migration must work with the
code already deployed: add a table, a column that may be empty, or an index,
and take nothing away that the previous version reads. Remove a column only
in a later deploy, once no deployed version reads it. Never edit a migration
that has been applied anywhere; add the next numbered file.

### Roll back

```bash
npx wrangler deployments list --env preview      # what is deployed, and the versions before it
npx wrangler rollback --env preview              # asks which version to return to
npx wrangler rollback <version-id> --env preview --message "why"
```

A rollback returns the Worker's code and the configuration deployed with it,
in seconds. **It doesn't touch the database.** If the fault is in the data, a
rollback won't help: on the preview, wipe it (below); for production,
`RUNBOOK.md` has D1's Time Travel, which restores a database to any minute
of the last 30 days (7 on the Free plan).

**The same rollback runs from GitHub with no access to Cloudflare**: the
repository's Actions tab, "Notebook service," "Run workflow" on `main`,
environment `preview`, action `rollback`. Leave the version empty to return to the one
before the current, or give a version ID. See "Who can deploy and roll back."

### Wipe

Deleting every account deletes everything that hangs from one (ways in,
sessions, devices, holders, rows, approvals), and the tables stay:

```bash
npx wrangler d1 execute DB --env preview --remote --command "DELETE FROM accounts"
```

To start over from nothing instead, delete the database
(`npx wrangler d1 delete litbible-notebook-preview`), then repeat steps 2, 3,
and 5 of the setup. Tell the apps' sessions in `STUDY-DESK-FOR-THE-APPS.md`
when the preview is wiped: every test account and session goes with it.

### How an app gets a session

A passkey signs in on the preview ("Passkeys" below). The preview's own way
in stays beside it, unchanged by step 4e, because a client under test needs
accounts without a ceremony and Apple and Google are off: the preview hands a
session for a named test account to whoever holds the preview's secret
(`src/preview.js`; `STUDY-DESK-ENCRYPTION.md`, "The preview's way in").

1. BVJ gives BDR the secret privately (a password manager's share, say). It
   goes into an ignored local file or a build setting on BDR's machine, the
   way `.dev.vars` holds one here. It is never committed, never pasted into
   an issue or a pull request, and never typed into a conversation with an
   assistant: an assistant's session reads it from the environment.
2. `POST /preview/session` with `{ "secret": "…", "account": "bdr-ios-1" }`
   answers `{ "token": "…", "expires": "…" }`. The name is any label of
   letters, digits, `.`, `_`, and `-`; it is never a person's name or
   address. The same name is always the same account, so two devices under
   test share a notebook by sharing a name, and a new name is a new, empty
   account.
3. Every other request sends `Authorization: Bearer <token>`.
4. To try a passkey holder without a real passkey,
   `POST /preview/passkeys` with `{ "credential": "<base64url>", "syncs": true }`
   lists one as a way in, with no ceremony. A passkey listed this way has no
   public key and can sign no one in.

An app's session can also run the whole service on its own machine, with no
account and no secret from anyone ("Run it locally"). An Android emulator
reaches it at `http://10.0.2.2:8787`.

**The preview's way in can't be reached in production**, three times over:
its two paths are routed only when the deployment's own configuration says
`PREVIEW_SIGN_IN` is `on`; only when `ENVIRONMENT` is exactly `preview` (an
allow-list, so an environment nobody named is off); and only with a
`PREVIEW_SECRET` of 32 characters or more, which production is never given.
When any of the three is missing, both paths answer "not found" exactly as a
path that was never written does, and `test/preview.test.js` holds it to
that.

## Passkeys

The relying party is `litbible.net`, so one passkey works on the website and
in both apps. The requests are in `STUDY-DESK-ENCRYPTION.md`, "Signing in" and
"Ways to sign in"; this is what is particular to running them.

- **The checking is written here** (`src/webauthn.js`, `src/cbor.js`), on
  WebCrypto, with no dependency. The header of `src/webauthn.js` says why.
  It reads ES256 and RS256, asks for no attestation, and reads no attestation
  statement.
- **An Android origin** is `android:apk-key-hash:` followed by the base64url,
  with no padding, of the SHA-256 of the app's signing certificate. To spell
  one from the colon-separated fingerprint in `assetlinks.json`:

  ```bash
  node -e "console.log('android:apk-key-hash:' + Buffer.from(process.argv[1].replaceAll(':',''),'hex').toString('base64url'))" "8B:48:…:D7:49"
  ```

  The two in `wrangler.jsonc` are the two certificates
  `public/.well-known/assetlinks.json` lists for `com.litbible.app`, and the
  root's `test/link-files.test.js` fails if the two files ever differ. Android
  lets an app use a site's passkeys only if the site's `assetlinks.json` names
  the app's certificate, so a certificate goes into both files or neither.
- **An iOS app answers with the website's origin**, `https://litbible.net`, so
  it needs no entry of its own. That is Apple's documented behavior and has
  not been seen here.
- **The site's half** is in `public/.well-known/`: `webcredentials` in
  `apple-app-site-association` and `get_login_creds` in `assetlinks.json`,
  added with step 4e. The apps' half (the `webcredentials:litbible.net`
  associated domain, Credential Manager) is BDR's.
- **From the website's dev server**, `http://localhost:4321`, a passkey works
  against a local service or the preview with the relying party `localhost`
  (`PASSKEY_LOCAL_ORIGINS`). It is a `localhost` passkey and signs in from
  nowhere else.
- **A passkey made against the preview from the site or an app is a real
  `litbible.net` passkey** in the tester's password manager. After a wipe it
  signs in to nothing; delete it there.
- **Not yet seen**: any real device's passkey. The tests use a software
  authenticator and the standard's published examples. The first passkey made
  on a phone, a Mac, and Windows against the preview is the test still owed
  (the spec's "Still open," 18 to 21, with the PRF's own questions).

## Apple and Google

**Both are built, off, and have never met their provider.** Each is routed
only when its configuration is present, and answers "not found" until then,
exactly as the preview's way in does where it is off. The identifiers come
from BDR's Apple developer account and Google Cloud project
(`STUDY-DESK-FOR-THE-APPS.md`, "Waiting to hear from the apps").

**To turn one on** (BVJ's to do, since it changes the deployed service):

1. Add the variables to `env.preview.vars` in `wrangler.jsonc`:
   `GOOGLE_CLIENT_IDS` for Google; `APPLE_CLIENT_IDS`, `APPLE_TEAM_ID`, and
   `APPLE_KEY_ID` for Apple. They are identifiers, not secrets, and go
   through a pull request like any change.
2. For Apple, BVJ sets the key once, typing it at Wrangler's own prompt:
   `npx wrangler secret put APPLE_PRIVATE_KEY --env preview`, then pastes the
   whole text of the `.p8` file, `-----BEGIN PRIVATE KEY-----` line and all.
   Add `APPLE_PRIVATE_KEY` to `secrets.required` in `wrangler.jsonc` in the
   same pull request, so a deploy without it fails loudly, and record its
   name in `DISASTER-RECOVERY.md`.
3. Merge. The workflow deploys, and `GET /sign-in` then lists the provider.

**What to check the day the ids arrive**, since none of this has run against
the real thing. Each is one sign-in against the preview from a real client:

- **The token's claims**: that `iss` and `aud` are what `src/providers.js`
  expects, and that `nonce` comes back as the exact challenge string the
  client gave the SDK. A refusal names the claim (`token_refused`, `reason`).
  If an SDK hashes the nonce it is given, the check for that provider changes
  in `checkIdToken`.
- **Apple's code**: that `POST /sign-in/apple` trades it (a first sign-in
  answers 200 and leaves a row in `apple_tokens`), from the app and, if the
  website will offer Apple, from a web flow with its `redirect`.
- **Apple's revoke**: remove the Apple way in from an account that has
  another (`DELETE /ways/<id>`), and see in the Apple ID's settings that the
  app is gone from "Sign in with Apple."
- **The keys**: `GET /sign-in` lists the provider, and a first sign-in
  succeeds, which shows the provider's key set was fetched and read.

What is kept from a token is `sub` and nothing else. No name and no email
address is read, stored, or logged.

## Turnstile before a new account

**Built in step 4h (2026-11-24), and on in the preview since 2026-11-25**,
when BVJ made the widget and set its secret; production has neither yet.
The design is Claude's, for BDR to confirm (the spec's "Still open," 86).
Where the deployment holds both `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET`:

- `GET /sign-in` carries `turnstile`, the site key, and the website shows the
  widget on its sign-in page.
- `POST /sign-in/new-passkey/options` from a request that carries an
  `Origin` header must carry `{ "turnstile": "<token>" }`. `src/turnstile.js`
  asks Cloudflare's siteverify about it, with an eight-second limit as for
  Apple and Google, before a challenge is made or anything is written. A
  missing or refused token is `not_allowed` (`rule: "turnstile"`);
  siteverify out of reach, or answering other than 200 or unreadably, is
  `provider` (`which: "turnstile"`). **So is a "no" whose reason is the
  deployment's own**: siteverify answers 200 and `success: false` for a
  secret it doesn't know just as for a bad token, so a "no" that names
  `missing-input-secret`, `invalid-input-secret`, `bad-request`, or
  `internal-error` is `provider` too, and a mistyped secret never tells a
  reader their check failed.
- **A token made on another site is refused** (BVJ, 2026-11-26, Audit 9):
  siteverify's `hostname`, which Cloudflare documents as the hostname
  where the challenge was served, must be the host of one of
  `ALLOWED_ORIGINS`, compared whole and without regard to case. One
  missing, not text, or anything else (a subdomain, a longer name that
  begins the same) is `not_allowed` (`rule: "turnstile"`), as a bad token
  is. Cloudflare's docs advise checking the `action` too where one is
  set; the website sets none, so it is not checked.
- **A request with no `Origin` is not checked.** Only a browser sends one,
  and the iOS and Android apps send none. So until the apps attest
  themselves (App Attest, Play Integrity: a question for BDR), a program can
  skip the check by sending no `Origin`. This closes the website's door and
  leaves the apps' open, bounded by the limits as before.

The secret goes to siteverify and nowhere else: it is in no answer and no
log line (`test/turnstile.test.js`). The address a request came from is
passed to siteverify as `remoteip`, as Cloudflare asks, and is not kept.

**To turn it on** (BVJ's to do, since it changes the deployed service;
done for the preview on 2026-11-25, and production takes the same two
when it is deployed):

1. In the Cloudflare dashboard, Turnstile, add a widget for the notebook
   service: Rest of World, **Managed** mode, no pre-clearance, with the
   hostname `litbible.net` (which covers its subdomains). It is a widget of
   its own, apart from the two forms'. **The dashboard didn't take
   `localhost`** (2026-11-25), which Cloudflare advises against for a real
   key anyway, so a new account can't be begun from the website's dev
   server against the preview: the widget refuses that address. Signing
   in from the dev server still works, and the dummy keys below serve a
   local service.
2. Put its site key in `env.preview.vars` as `TURNSTILE_SITE_KEY`, through a
   pull request (it is public, like the forms' keys in their pages).
3. Set the secret once, typing it at Wrangler's own prompt:
   `npx wrangler secret put TURNSTILE_SECRET --env preview`. It is never
   pasted into a file, a pull request, or a conversation with an assistant.
   Add `TURNSTILE_SECRET` to `secrets.required` in `wrangler.jsonc` in the
   same pull request as the site key, so a deploy without it fails loudly
   (and to the preview's list in `test/config.test.js`), and record both
   names in `DISASTER-RECOVERY.md` as set.
4. Merge. `GET /sign-in` then names the site key. Production takes the same
   two when it is deployed.

**To try it locally**, with Cloudflare's published dummy keys (they are for
testing and reach no real widget). Put these in `.dev.vars`:

```bash
TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET=1x0000000000000000000000000000000AA
```

That secret passes every token, including the dummy token
`XXXX.DUMMY.TOKEN.XXXX`; `2x0000000000000000000000000000000AA` in its place
fails every token, and the site key `2x00000000000000000000AB` shows a widget
that always fails. **A dummy secret's answer names the hostname
`example.com`**, whatever page made the token, so the check of where a
token was made refuses it unless `.dev.vars` also adds that host to the
origins: `ALLOWED_ORIGINS=https://litbible.net,http://localhost:4321,https://example.com`
(locally only; the deployed values in `wrangler.jsonc` never name it). A
local server's siteverify call still goes to Cloudflare, so it needs a
network.

## Who can deploy and roll back

When the service breaks, BVJ answers first and BDR second (BVJ, 2026-11-23;
BDR's part is BDR's to accept). Today only BVJ can reach the Cloudflare
account, so BDR needs a way to roll the service back. There are two, and
**BVJ chose B, the workflow, on 2026-11-23** ("Let's go with the GitHub
workflow"), **and it has been on since that day**: a merge to `main` that
touches this package deploys the preview. A is kept below as the road not
taken, and why.

**A. A member role for BDR on BVJ's Cloudflare account.**
- *What BVJ does*: in the dashboard, Manage Account, Members, invite BDR with
  a role. The narrowest role that can deploy and roll back a Worker and run
  its D1 migrations is "Workers Platform Admin," and it is account-wide:
  Cloudflare has no role for one Worker. It grants edit access to every
  Worker (the forms' Worker too), to Pages (the project that serves
  litbible.net), to KV and R2, and to the zones.
- *What BDR then does*: `npx wrangler login`, then "Roll back" above, or the
  dashboard's Deployments page.
- *For it*: nothing to build or keep; it works when GitHub is down.
- *Against it*: far more access than a rollback needs, on the account that
  serves the whole site; and a deploy from a laptop is tied to no commit.

**B. Deploys that run from `main`, and a rollback run from GitHub.** On:
`.github/workflows/notebook-service-deploy.yml`.
- *What it does when on*: a merge to `main` that touches this package runs
  the tests, applies migrations, deploys the preview, and runs the
  walkthrough against it. The tests run in a job of their own with no
  secret; the job that holds the Cloudflare token starts on a fresh machine,
  installs with `npm ci --ignore-scripts`, and runs only wrangler and this
  repository's scripts, so no dependency's install script runs beside the
  token (BVJ, 2026-11-26; Audit 9, SEC9-2). Its actions are pinned by
  commit. From the Actions tab, "Notebook service" (named
  "Notebook service (preview)" until step 4f), "Run workflow" on `main` with
  environment `preview` and action `rollback` returns the Worker to the
  version before the current one, or to a version ID given. Anyone with write
  access to this repository can do that, with no access to Cloudflare.
- *What BVJ did to turn it on* (2026-11-23; kept as the way to set it up
  again):
  1. Make a Cloudflare API token (dashboard, Account API tokens, Create
     Token, the "Edit Cloudflare Workers" template). Narrow it to this
     account and to the `litbible.net` zone, remove what the service doesn't
     use (Pages, KV, R2), and add D1 with Edit. Give it no expiry. Its
     revocation path is that same page: "Roll" replaces its value (then
     update the GitHub secret), and "Delete" ends it at once; either stops
     the workflow and nothing else.
  2. In GitHub, Settings, Environments, make `notebook-preview`. Under
     "Deployment branches and tags" choose selected branches, and allow
     `main` alone. Add the environment secrets `CLOUDFLARE_API_TOKEN` and
     `CLOUDFLARE_ACCOUNT_ID`. The branch limit matters: it is what keeps the
     token out of a workflow pushed on any other branch, so don't store
     these as plain repository secrets.
  3. In Settings, Secrets and variables, Actions, Variables, add
     `NOTEBOOK_PREVIEW_DEPLOYS` with the value `on`.
  4. Optional, so that a deploy checks itself with the walkthrough: add the
     environment secret `NOTEBOOK_PREVIEW_SECRET` (the preview's own secret)
     and the variable `NOTEBOOK_PREVIEW_URL` (the preview's address). Set
     the two together; with neither, a deploy doesn't check itself.
  5. Make sure BDR has write access to the repository (BDR did when this
     was checked, 2026-11-23).
- *For it*: BDR needs nothing on Cloudflare; every deploy is a commit on
  `main` that passed its tests; the token can do far less than a member
  could, and only a workflow on `main` can read it.
- *Against it*: a token to look after; it depends on GitHub Actions; and a
  deploy needs a merge, which is BVJ's, so BDR alone can roll back but can't
  ship a fix. That is what "second to answer" needs, and no more.
- *Verified, 2026-11-23*: a deploy, a rollback, and a second deploy, each
  started from the workflow on `main`, each passing every step (the deploys
  ended with the walkthrough against the deployed service). The token that
  did it holds four permissions and no more: on the account, Workers Scripts
  (edit), Workers Tail (read), and D1 (edit); on the `litbible.net` zone,
  Workers Routes (edit). Cloudflare's "Edit Cloudflare Workers" template
  offers more rows today than step 1 names (Workers CI, CF Agents,
  Observability, Containers); they were removed too. The first deploy, which
  made the Custom Domain, was done by hand, so the token has only ever
  redeployed: whether it could make a Custom Domain from nothing is not
  known.

**Chosen: B** (BVJ, 2026-11-23), for the preview now. Production has its own
two jobs and its own two environments in the same workflow, prepared in step
4f and off ("Production" below): the deploy's, with BVJ as a required
reviewer, and the rollback's, `notebook-production-rollback`, with none, so
BDR can roll production back alone (BVJ, 2026-11-26; Audit 9, SV9-2). A
deploy and a rollback wait in separate queues, so a merge can't cancel a
rollback that is waiting (SV9-3). It gives BDR exactly the one power the role
calls for, and it leaves BVJ's account with one more narrow token instead of
one more administrator.

**To turn it off**, delete the repository variable
`NOTEBOOK_PREVIEW_DEPLOYS` (or set it to anything but `on`): both jobs are
then skipped, and deploys and rollbacks are by hand again, as "Deploy again"
and "Roll back" above describe. `DISASTER-RECOVERY.md` has the preview's
entry and production's.

## What is logged

One line for each request: the time, the route as `src/index.js` writes it
(`PUT /devices/:id`, never the address that was asked for), the status, the
refusal's word, and how long it took. And one line for each hourly run:
how many requests it carried out, held, or failed on, how many rows it
swept, and how many accounts never set up it deleted or held, as counts. **No body, key proof, session token, id, account, or
address a request came from reaches a log**, and no name or email address is stored
anywhere: a way to sign in is kept as the provider's own account id, and the
preview's as a made-up label. `test/http.test.js` checks the lines.

**None of it is stored** (`observability.enabled: false` in `wrangler.jsonc`,
held by `test/config.test.js`; BVJ, 2026-11-26, Study Desk Audit 9's decision
4). Watch the lines live with `npx wrangler tail --env preview`. Workers Logs
was on until then, and one stored event BVJ read from the preview's dashboard
showed why it can't be: beside the service's own line Cloudflare keeps the
Worker's name and version, its own request, ray, trace, and span ids, and the
request's method, **full URL, and path**, which for `/devices/:id`,
`/ways/:id`, `/approvals/:id`, and `GET /devices?device=` carry an id. It held
no IP address and no header. `/privacy` says the lines aren't stored; turning
stored logs back on is a change to that page first.

## The account work (step 4f)

Built 2026-11-24. The requests are in `STUDY-DESK-ENCRYPTION.md`, "Waiting
seven days" and "How often a client may ask"; this is what is particular to
running them.

- **Deleting an account is one statement.** Every table hangs from
  `accounts` (`ON DELETE CASCADE`), so the account's row takes its ways in,
  sessions, devices, holders, rows, approvals, and waiting request with it,
  or nothing goes. The statement carries its own condition: the session is
  still open, or the request is still waiting and due.
- **Apple first.** `revokeApple` (`src/waiting.js`) revokes every row of
  `apple_tokens` for the account's ways before the account goes, at once or
  when due, and forgets each token as it is revoked. If Apple can't be
  reached, or the deployment has no Apple key while a token exists, the
  account stays whole.
- **The hourly run** (`src/scheduled.js`, the cron trigger) carries out at
  most 100 requests that are due, oldest first, then deletes sessions,
  approvals, and sign-in challenges that ran out, and then up to 100
  accounts that never set up a notebook ("The service's limits, from Audit
  9" below). A request it can't carry
  out is left for the next hour and never stops the others. **Read its log
  line** (`RUNBOOK.md`, "Reading the hourly line"): `held` above 0 for more
  than a few hours means Apple is refusing, and `failed` above 0 is a fault
  here.
- **Seven days is `WAIT_DAYS` in `src/waiting.js`**, BVJ's number
  (2026-11-23). A request is due seven days to the millisecond after it was
  made and is carried out by the next run, so within about an hour after.
- **The limits are Cloudflare's rate limiting binding**, not a table and not
  a rule on the zone. `src/limits.js` says why at length; the short of it is
  that counting costs the database nothing, and that the service would
  otherwise have to store the address it counts by. The counters are kept
  for each Cloudflare location and are approximate, so a limit slows a
  client and is not a wall. **A deployment with a binding missing answers
  `error` to everything**, on purpose: an unlimited service that nobody
  knows is unlimited is the worse failure.
- **A rule on the zone can sit in front of it**, if a flood ever comes: the
  dashboard's Security, WAF, Rate limiting rules, on the hostname. That
  stops requests before the Worker runs (and is billed). It is a dashboard
  setting, BVJ's, and nothing here needs it.

### What to check on the preview after step 4f

The suite can't show these, and each is seen once on the deployed preview.
**The merge that carries step 4f deploys it there**, with a migration (a new
table and three columns), a cron trigger, and two rate limit bindings, none
of which the preview had.

1. **The walkthrough's nine steps pass** (the deploy runs it). The ninth is
   the first deletion of an account on a real D1. **Seen 2026-11-24**: the
   deploy that carried step 4f ran it against the preview, and it passed.
2. **The hourly run starts by Cloudflare's clock.** In the dashboard:
   Workers & Pages, `litbible-notebook-preview`, Settings, Trigger Events
   shows the cron; Logs shows a line with `"job":"scheduled"` at seventeen
   past each hour. Until one is seen, the run has only ever been started by
   a test or by hand.
3. **The limiter counts.** From one machine, 61 requests in a minute:

   ```bash
   for i in $(seq 1 61); do curl -s -o /dev/null -w "%{http_code}\n" -X POST https://notebook-preview.litbible.net/sign-in/passkey/options; done | sort | uniq -c
   ```

   About 60 answers of `200` and then `429`. "About," because the real
   limiter says it is approximate. **Seen 2026-11-24**: of 65 sent in seven
   seconds, 61 were answered, the 62nd was `slow_down` with `retry: 60` and
   `Retry-After: 60`, and two of the next three were answered again. A
   request of the other count (`GET /sign-in`) was answered right after.
4. **A large notebook deletes.** The largest tried is 20,000 rows on a local
   database, in 138 milliseconds. D1's limit on one statement is 30 seconds,
   and the same for a whole batch (its limits page, read 2026-11-24), so
   there should be room, but it is owed a try: push a few tens of thousands
   of rows to a test account on the preview from an app's debug build or a
   script, and delete the account. If it ever fails, the statement fails whole, the
   account stays, and `RUNBOOK.md` ("An account won't delete") has the way
   through.

### The service's limits, from Audit 9 (2026-11-26)

BVJ's decisions 1 to 4 of Study Desk Audit 9. What a client sees is in
`STUDY-DESK-ENCRYPTION.md`, "Changed in Audit 9: the service's limits";
this is what is particular to running them.

- **A ceiling on each account: 100,000 rows and 100 MB of sealed record**
  (`accountRows` and `accountBytes` in `LIMITS`, `src/check.js`). The counts
  are kept on the account, `row_count` and `row_bytes` (migration
  `0004_account_ceiling.sql`, which counts what each account already
  holds), so a push never counts an account's rows to decide. `POST /rows`
  moves them by its own difference in the same batch that stores its rows,
  under the same guard on the account's `rev`: of two pushes that meet at
  the edge, the second finds the revision moved, reads the counts again,
  and is refused (`test/races.test.js`). A row's bytes are its `ct` as
  bytes, measured from its text (`sealedBytes`, `src/rows.js`). A push that
  would end past either count, having grown it, is refused whole; a push
  that shrinks the account, or keeps it the same, never is. Replacing a
  notebook sets both to 0. If they are ever doubted (after a rollback past
  this version, above all), `RUNBOOK.md`, section 2, counts again.
- **`POST /rows`: 120 a minute from one address** (`PUSH_LIMIT`), counted
  under that limit alone, so a device that syncs often never spends the
  1,200 its other requests share. A deployment without the binding answers
  `error` to everything, as for the other two.
- **Accounts never set up are deleted by the hourly run**
  (`sweepUnused`, `src/scheduled.js`): an account with no notebook (`kid`
  0), no session still live, and made more than 30 days ago
  (`UNUSED_DAYS`), or replaced that long ago. Up to 100 a run
  (`UNUSED_PER_RUN`), oldest first; a partial index (`accounts_no_notebook`)
  keeps the search to accounts without a notebook. **The condition is in
  the deleting statement itself**, so an account signed in to, set up, or
  replaced after the run read it stays (`test/sweep-races.test.js`, which
  failed with each condition taken out in turn). An account holding a
  token from Apple is revoked first, one at a time, and stays while Apple
  can't be reached or the deployment has no Apple key; the hourly line
  counts it `accountsHeld`. Its session never lengthens (a session of an
  account with no notebook isn't extended), so a reader who made a passkey
  and never set up has 30 days from that sign-in, then about an hour.
- **Turnstile checks the site its token was made on** ("Turnstile before a
  new account" above).

**What the merge deploys**: the preview workflow applies migration `0004`
(two columns, counted from the rows there, and one index), then deploys the
Worker with the third rate limit binding. A namespace id is no resource to
make, so nothing is owed from BVJ first. **To see on the preview after it**:
the walkthrough passes (the deploy runs it); the hourly line, watched live,
carries `swept.accounts` and `swept.accountsHeld`; and the counts agree
with the rows, which this answers `0` for:

```bash
npx wrangler d1 execute DB --env preview --remote --command "SELECT COUNT(*) FROM accounts a WHERE a.row_count != (SELECT COUNT(*) FROM rows r WHERE r.account = a.id)"
```

### Bot protection at sign-up: assessed, and left for step 4h

The plan asked this step what can be done before the website has a sign-in
page. **Nothing is built, and here is why.**

- **What a program can do today**: make an empty account, by running a
  passkey ceremony with a software authenticator (the service asks for no
  attestation, so it can't tell), at most 30 a minute from one address. An
  empty account is one row in `accounts` and one in `ways`, and holds
  nothing. Sign in with Apple and with Google need a real provider account,
  which is those providers' problem to police and is off here anyway.
- **What would stop it, and why not now**:
  - *On the website*: a Turnstile token sent with
    `POST /sign-in/new-passkey/options` and checked here, as the forms'
    Worker checks one. **Built in step 4h and off** ("Turnstile before a
    new account" above): the website's sign-in page shows the widget where
    `GET /sign-in` names a site key, and the check here is on only once a
    widget and its secret exist, which are BVJ's to make. It is a new
    member of that request for the website alone.
  - *In the apps*: Turnstile needs a browser. The native answer is Apple's
    App Attest and Google's Play Integrity, each a real piece of work in
    BDR's apps and a new member of the request. That is BDR's to weigh.
  - *Here, alone*: the hourly run could delete accounts that have no
    notebook and no session after some weeks. That bounds the clutter and
    stops nobody, and it would leave a real reader who made a passkey and
    never set up with a passkey that signs in to nothing. **Built in Audit
    9** (BVJ, 2026-11-26), at 30 days ("The service's limits, from Audit
    9" below).
- **So**: the limits are what there is until the check is configured.
  **BVJ said yes to Turnstile on the website's sign-in page (2026-11-24)**;
  step 4h built the widget's place on that page and the token's check
  here, both off until a widget and its secret exist ("Turnstile before a
  new account" above). Whether the apps attest is asked of BDR (the spec's
  "Still open," 68 and 86).

### What was checked against the vendors' own pages, and what was not

Said plainly, since this step leans on three vendors' rules (2026-11-24):

- **Apple, read**: "Offering account deletion in your app." Deletion must
  start inside the app; the whole account goes, not a deactivation; an app
  with Sign in with Apple revokes its tokens through Apple's REST API; and
  where deleting takes time, the reader is told. The seven-day wait is
  within that as long as each app says so when it records the request. The
  same page asks apps to handle Apple's **server-to-server notifications**
  (a reader ending the connection from their Apple Account's settings).
  **That is not built**: the service has no address for Apple to call. It
  belongs with turning Sign in with Apple on, and is the spec's "Still
  open," 73.
- **Cloudflare, read after the merge** (2026-11-24; the session that built
  this could not reach `developers.cloudflare.com`, and wrote from memory).
  What was written holds:
  - *The rate limiting binding*: `ratelimits`, each with a `name`, a
    `namespace_id` (a number of our own choosing, unique on the account),
    and `simple` with a `limit` and a `period` of 10 or 60 seconds. Its
    counts are approximate, eventually consistent, and kept apart in each
    Cloudflare location.
  - *D1's limits*: 30 seconds for one statement, and for a whole batch; and
    Time Travel reaches back 30 days on Workers Paid and 7 on Free.
  - *Two things the step did not write*, both from the same pages. **The
    limiter's page advises against an address as the key**, since many
    people can share one; the service has nothing else to count a sign-in's
    first requests by, so what follows is about the number (the spec's
    "Still open," 68). And **D1 allows a Worker 50 queries in one run on
    Free and 1,000 on Paid** (a batch counts as one), which bears on the
    hourly run ("Production," step 1).
  - *D1's pricing page*, read the same day for the limits' cost: Free
    includes 100,000 rows written a day and refuses every query once that
    is spent, until midnight UTC; Paid includes 50 million a month, then
    one dollar a million.
- **Google Play, read after the merge** (2026-11-24;
  `support.google.com/googleplay/android-developer/answer/13327111`). The
  page was written to this summary of Play's rule, from memory: a web
  address that names the app or developer, gives the steps, and says what
  is deleted, what is kept, and for how long. **Play's own text asks for
  something else at one point**: the web address must be one where a reader
  can *ask* for deletion, without installing or opening the app (a link
  that starts it, a support email address, or a form). It must also load,
  show that way to ask plainly, and name the app or developer as the store
  listing does, and readers must be told how long data is kept. It does
  not ask the page to list what is deleted. The page names "LIT Bible" and
  "Liberating Scripture Collective," as the Play listing does. **It takes
  no request yet, so it meets Play's rule only once step 4h adds sign-in
  and "Delete account" to it, and that must be live before an Android build
  that makes accounts goes to review** (the spec's "Still open," 70). BDR,
  who files the form, still reads the page against Play's text.

## Production

**Prepared in step 4f. Not deployed, and not to be until BVJ says so.** No
session creates anything on Cloudflare without BVJ's word in that session
(`workers/CLAUDE.md`).

**What is ready, in this repository:**

- `env.production` in `wrangler.jsonc`: the address
  `notebook.litbible.net`, `ENVIRONMENT` `production`, the website as the
  one allowed origin, the passkey settings, the cron trigger, both limiters,
  and a D1 binding whose id is a **placeholder of zeros**. It has no
  `PREVIEW_` anything, no dev-server origin, and no required secret.
- `npm run migrate:production`, `npm run deploy:production`, and
  `npm run check:production -- https://notebook.litbible.net`.
- Two jobs in `.github/workflows/notebook-service-deploy.yml`,
  `deploy-production` and `rollback-production`. **Neither ever runs on a
  push.** Each runs only from "Run workflow" on `main` with environment
  `production`, only while the repository variable
  `NOTEBOOK_PRODUCTION_DEPLOYS` is `on` (it is not set), and only with a
  GitHub environment named `notebook-production` (it does not exist). The
  deploy job also refuses to start while the database id is the placeholder.
- `RUNBOOK.md`, and production's entry in `DISASTER-RECOVERY.md`.

**What it would run, for a reader**: everything the preview runs, without
the preview's way in. A passkey signs in. Apple and Google stay off until
BDR's identifiers are configured, exactly as on the preview.

**BVJ's steps, in order, when the day comes.** Each creates or changes
something on Cloudflare or GitHub.

1. **The plan: Free, for now** (BVJ, 2026-11-26, Audit 9's decision 2:
   “We won't need paid for quite some time. We have about 500 total app
   users and 25 daily site visitors.”). What Free costs: it gives a
   request 10 ms of CPU, which may cut off a large push, and keeps Time
   Travel's history for 7 days instead of 30. The deletion page tells
   readers 30 days. Two more reasons, from Cloudflare's pages as read on
   2026-11-24. **On Free the account gets 100,000 rows written a day, shared
   by every database on it, and then every query fails until midnight UTC**: one address beginning
   sign-ins at the limit (60 a minute, each a challenge written and later
   deleted, which D1 counts as at least four rows) would spend that within
   about seven hours, and nobody could sync for the rest of the day. And
   **a run of the Worker gets 50 D1 queries on Free** (1,000 on Paid): a
   due deletion takes at least two, so an hourly run with more than about
   two dozen due would stop short and skip that hour's sweep. The same
   holds for the preview on whichever plan the account has today; there
   it would cost a day of testing. What BVJ chose instead: the account's
   ceiling and the limit on pushes (Audit 9), and **the apps proving they
   are the apps before accounts open** (App Attest and Play Integrity; the
   spec's “Still open,” 86), so a program can't make accounts without end
   through the apps' door. Moving to Paid later is one change in the
   dashboard's Workers plans ($5 a month); record it in
   `DISASTER-RECOVERY.md`.
2. **Make the database**: `npx wrangler d1 create litbible-notebook`. Choose
   the location when asked (the preview's is western North America). Put
   the `database_id` it prints into `env.production.d1_databases` in
   `wrangler.jsonc`, in place of the zeros, through a pull request. An id is
   not a secret.
3. **Confirm the address.** `notebook.litbible.net` is written into
   `env.production.routes`. The first deploy makes it, as a Custom Domain
   with its DNS record and certificate. Add the record to the DNS inventory
   in `DISASTER-RECOVERY.md`.
4. **Choose how it deploys.** Either by hand, from this directory:

   ```bash
   npm test
   npm run migrate:production
   npm run deploy:production
   npm run check:production -- https://notebook.litbible.net
   ```

   or from the workflow, which is what lets BDR roll production back:
   - make a second Cloudflare API token like the preview's (the same four
     permissions; "Who can deploy and roll back," step 1), or decide to use
     the same one;
   - in GitHub, Settings, Environments, make `notebook-production`, limit
     it to `main`, **add yourself as a required reviewer** (so every
     production deploy waits for your click), and add the environment
     secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`;
   - make a second environment, `notebook-production-rollback`, limited to
     `main` with **no** required reviewer, holding the same two secrets.
     The rollback job reads its token from there, so BDR can roll
     production back when you can't be reached (BVJ, 2026-11-26);
   - add the repository variables `NOTEBOOK_PRODUCTION_DEPLOYS` = `on` and
     `NOTEBOOK_PRODUCTION_URL` = `https://notebook.litbible.net`;
   - Actions, "Notebook service," "Run workflow" on `main`, environment
     `production`, action `deploy`. As with the preview, the first deploy
     may need doing by hand: whether the token can make a Custom Domain from
     nothing is not known.
5. **Check it**: `npm run check:production -- https://notebook.litbible.net`
   reads four things and writes nothing: it is this service, it says it is
   not a preview, the preview's way in is not found, and a passkey can begin
   a sign-in (which shows the database answers). The walkthrough can't run
   against production, by design.
6. **See the hourly run once** in the Worker's logs, as for the preview.
7. **Record it**: production's rows in `DISASTER-RECOVERY.md` (the secrets
   table, the DNS inventory), and the address in
   `STUDY-DESK-FOR-THE-APPS.md`.

**Before any reader's notebook goes there**, these are still owed, and none
is this step's: a real passkey from each platform against the preview; the
website's connector and account pages (4g, 4h), with the Content Security
Policy naming this origin in `connect-src`; the privacy page and terms (4j);
and BDR's confirmation of the spec's open items.

**A migration applied to production is applied for good**, and a rollback
never undoes one. `migrations/0001` to `0003` are what the preview runs;
`0004` (Audit 9's ceiling) goes there with the merge that carries it.

## What is left, and where it plugs in

Nothing below changes a request that exists; each adds beside it.

**Step 4e, sign-in, is built** (2026-11-24). What it left:
- **Apple and Google are off** until BDR's identifiers are configured
  ("Apple and Google" above), and the first real sign-in with each is owed.
- **No real passkey has met the service** ("Passkeys" above).
- The preview's way in stays for the apps' sessions and automated tests. It
  stays off in production.

**Step 4f, the account work, is built** (2026-11-24). What it left:
- **Production is not deployed** ("Production" above). Whether and when is
  BVJ's.
- **Four things to see on the preview** once it is deployed there ("What to
  check on the preview after step 4f" above).
- **Bot protection at sign-up**: the service's Turnstile check is on in
  the preview since 2026-11-25 ("Turnstile before a new account" above),
  and production takes the same two when it is deployed; the apps' side
  waits on BDR.
- **Apple's revoke has never met Apple**, like the rest of Sign in with
  Apple. When the identifiers arrive, delete an Apple test account and see
  the app gone from the Apple Account's "Sign in with Apple" list.
- **Whether an account should ever be deleted with Apple unreachable** is
  open (the spec's "Still open," 65). As built it never is.
- **The deletion page can't delete yet**: `src/pages/delete-account.astro`
  describes; step 4h adds the sign-in and the button.

**Step 4g, the website's connector**: adds this origin to `connect-src` in
`public/_headers`, and reads `waiting` and `replaced` from `GET /account`.

## Changing things

- **A change to a check, a shape, a size, or a refusal's word changes
  `STUDY-DESK-ENCRYPTION.md` in the same pull request**, and gets a dated
  entry in `STUDY-DESK-FOR-THE-APPS.md`, since both apps build to it. After
  the freeze (step 4d) such a change is a new interface version.
- **Every change that depends on what was just read goes through `guard()`
  and `commit()`** (`src/db.js`): D1 has no transaction across a read and a
  later write. The header of that file says why and how; `test/races.test.js`
  shows how to test one.
- **`wrangler`'s version is set by `@cloudflare/vitest-plugin`, not by our
  range**, exactly as in `workers/contact-form/` (its README, "Development
  notes," has the whole story). The two are bumped
  together by Dependabot's `notebook-runtime` group. The tree must stay flat:
  no `node_modules/*/node_modules/(wrangler|miniflare|workerd)` key in
  `package-lock.json`.
- Sealed values are stored as the base64url text they arrive in, because D1
  hands a BLOB back as an array of numbers. A value's form and length are
  checked from its text (`base64urlBytes`, `src/check.js`).
- `db.batch()` is one transaction, and counts as one query against D1's
  limit of queries in a request however many statements it holds, which is
  why a push of 500 rows is one batch.
