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

This is step 4c of the plan in `STUDY-DESK.md` ("Order of work," 4). **What it
is today: the whole interface but sign-in and the seven-day requests, under
test, and deployed as a preview at `https://notebook-preview.litbible.net`
(since 2026-11-23, test data only).** It has no production deployment, and
nothing in the website imports it (the website's connector is step 4g).

## What is here

```
src/index.js       routes, CORS, and the one log line a request leaves
src/http.js        answers, refusals and their words, reading a body
src/check.js       the form and size of every value, and the limits (LIMITS)
src/db.js          "checked and written as one step" on D1 (guard, commit, transact)
src/session.js     the three kinds of session, the key proof, createSession()
src/account.js     GET /account, POST /session/proof, POST /notebook
src/devices.js     the device and holder lists
src/key.js         POST /notebook/key, the change of key
src/rows.js        GET /rows, POST /rows
src/approvals.js   the four approval requests
src/lists.js       what the list requests share
src/preview.js     the preview's way in (never in production)
migrations/        the D1 schema, one numbered file a change
test/              the suite: it runs the Worker in workerd on a real local D1
scripts/walkthrough.mjs   the check to run against a deployed service
```

The package is on its own: its own `package.json` and lockfile, as
`workers/contact-form/` has. The root `npm ci` and `npm test` never reach it.
Its tests import the website's encryption reference by relative path
(`../../src/lib/desk-crypto.mjs`) and the vectors (`../../test/fixtures/`),
and nothing of the service ships to the site.

## Configuration, by name

All of it is in `wrangler.jsonc`. The top level is production's and is
deliberately empty of bindings until step 4f; `env.preview` is the preview.

| Name | Kind | What it is |
|---|---|---|
| `DB` | D1 binding | The database. The preview's is named `litbible-notebook-preview` |
| `ENVIRONMENT` | variable | `preview` on the preview. The preview's way in works only where this says exactly that |
| `PREVIEW_SIGN_IN` | variable | `on` on the preview, and set nowhere else |
| `ALLOWED_ORIGINS` | variable | The origins a browser may call from, comma separated (the website, and its dev server) |
| `PREVIEW_SECRET` | Wrangler secret | What `POST /preview/session` asks for. At least 32 characters. The preview only, never production |

No value of a secret is written in this repository, in a pull request, or in a
conversation with an assistant. `DISASTER-RECOVERY.md` records names only.

## Run it locally

Nothing here needs a Cloudflare account.

```bash
cd workers/notebook-service
npm ci
npm test                 # the whole suite, in workerd, on a local D1
npm run check            # bundles the Worker as a deploy would, and uploads nothing
```

To run it as a server, for an app's debug build or the walkthrough:

```bash
cp .dev.vars.example .dev.vars    # then put 32 or more characters of your own after PREVIEW_SECRET=
npm run migrate:local             # makes the local database
npm run dev                       # http://localhost:8787
```

Then, in another shell:

```bash
npm run walkthrough      # eight steps, against http://localhost:8787
```

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
- `http.test.js`: the time on every answer, bodies, CORS, and that no token,
  proof, id, or body reaches a log.
- `preview.test.js`: the preview's way in answers "not found" unless the
  environment turns it on.
- `races.test.js`: "checked and written as one step." Each test pauses one
  request right after a read, lets a second request finish, and lets the
  first go on; it fails if the guard it is about is weakened.

**What the tests can't show**: anything about the real D1 over a network. That
is what the walkthrough is for, after a deploy. Its last step pushes a row of
the largest size the format allows and reads it back, which only a deployed
database can prove.

## The preview

**Everything on the preview is test data and may be wiped at any time.** No
real notebook belongs there, and nothing there is backed up on purpose.

It was first deployed on 2026-11-23, and the walkthrough (step 6 below) run
against it over HTTPS passed 8 of 8 steps that day. Each run of the
walkthrough leaves one test account named `walkthrough-…` behind; "Wipe"
clears them.

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
   it is typed or pasted. Eight lines of `ok` mean the deployed service does
   everything the suite does, on the real database, down to keeping a row of
   the largest size. Where there is no terminal to ask at (a workflow), the
   script reads the secret from `PREVIEW_SECRET` in the environment. For a
   deployed address it never takes the secret from a file or an argument.
7. Give BDR the secret, directly and privately (see "How an app gets a
   session").

The account's plan matters in one way. On Workers Free a request gets 10 ms of
CPU, which is enough for everything here but may cut off a push of several
megabytes; on Workers Paid the limit is 30 seconds. The preview works on
either. Production (step 4f) should be on Paid.

### The address

`notebook-preview.litbible.net`, as a Custom Domain on the `litbible.net` zone
(`routes` in `env.preview`). BVJ's choice, and live since 2026-11-23. Why
this and not a `workers.dev` name: it doesn't put the account's
`workers.dev` subdomain into two apps and a spec; it stays the same if the
Worker is ever renamed or moved; the zone's own protections apply to it; and
production can take the same shape (`notebook.litbible.net`, settled in step
4f). `workers_dev` and `preview_urls` are off, so the service answers at this
one address and no other.

To use another address, change `routes` in `env.preview`, and the address in
`STUDY-DESK-ENCRYPTION.md` ("How a request is carried") and in
`STUDY-DESK-FOR-THE-APPS.md`.

The website's own Content Security Policy doesn't name this origin yet. The
connector that calls it (step 4g) adds it to `connect-src` in
`public/_headers`.

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
rollback won't help: on the preview, wipe it (below); for production, step 4f
writes down D1's Time Travel, which restores a database to any minute of the
last 30 days (7 on the Free plan).

**The same rollback runs from GitHub with no access to Cloudflare**: the
repository's Actions tab, "Notebook service (preview)," "Run workflow" on
`main`, action `rollback`. Leave the version empty to return to the one
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

Real sign-in is step 4e. Until then the preview hands a session for a named
test account to whoever holds the preview's secret (`src/preview.js`;
`STUDY-DESK-ENCRYPTION.md`, "The preview's way in").

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
4. To try a passkey holder before a real passkey can be registered,
   `POST /preview/passkeys` with `{ "credential": "<base64url>", "syncs": true }`
   lists one as a way in, with no ceremony.

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
  walkthrough against it. From the Actions tab, "Notebook service (preview),"
  "Run workflow" on `main` with action `rollback` returns the Worker to the
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

**Chosen: B** (BVJ, 2026-11-23), for the preview now; production's own job
and environment are step 4f's. It gives BDR exactly the one power the role
calls for, and it leaves BVJ's account with one more narrow token instead of
one more administrator.

**To turn it off**, delete the repository variable
`NOTEBOOK_PREVIEW_DEPLOYS` (or set it to anything but `on`): both jobs are
then skipped, and deploys and rollbacks are by hand again, as "Deploy again"
and "Roll back" above describe. `DISASTER-RECOVERY.md` has the preview's
entry; step 4f finishes it for production.

## What is logged

One line for each request: the time, the route as `src/index.js` writes it
(`PUT /devices/:id`, never the address that was asked for), the status, the
refusal's word, and how long it took. **No body, key proof, session token,
id, or account reaches a log**, and no name or email address is stored
anywhere: a way to sign in is kept as the provider's own account id, and the
preview's as a made-up label. Cloudflare's own per-request log (which would
record each address) is turned off in `wrangler.jsonc`
(`observability.logs.invocation_logs`). `test/http.test.js` checks the lines.

## What is left, and where it plugs in

Nothing below changes a request that exists; each adds beside it.

**Step 4e, sign-in** (Apple, Google, passkeys; "Ways to sign in"):
- New rows in `ROUTES` (`src/index.js`). Each ceremony ends by calling
  `createSession(env, { account, way })` (`src/session.js`), which returns
  the same token every request already reads.
- `ways` grows by a new migration: what each provider needs (Apple's refresh
  token, a passkey's public key). `kind` gains `apple` and `google`. The
  index `ways_sign_in` already keeps one such way to one account. Passkeys
  need the same index of their own; the preview's made-up passkeys are left
  out of it today, so that migration deals with them first.
- **A change to an account's ways in must move the lists' version, or be made
  in a batch guarded on it** (`src/db.js`). `POST /notebook`, `POST /holders`,
  and `POST /notebook/key` read the account's passkeys outside their guard,
  which is safe only because nothing can remove one today.
- The rule that changing a way in needs an open session once there is a
  notebook: `previewPasskey` (`src/preview.js`) shows its shape.
- The preview's way in can stay for the apps' automated tests, or go. Either
  way it stays off in production.

**Step 4f, the account work and production**:
- `DELETE /account`, `POST /notebook/replace`, `DELETE /waiting` ("Waiting
  seven days"): new routes, and a table for the request that waits.
  `GET /account` already answers `waiting`, as null.
- A scheduled handler, to carry out a request that falls due and to sweep
  what ran out. Today an account's expired sessions are swept when it next
  signs in, and its expired approvals when it next asks for one, so an
  account that never returns leaves a few rows behind.
- Deleting an account is one statement (every table hangs from `accounts`
  and is deleted with it). Try it on a large notebook before relying on it.
- Limits on how often a client may ask, and bot protection on sign-in.
- Production: its own D1 database, `ENVIRONMENT` set to `production`, its
  address and `ALLOWED_ORIGINS` at the top level of `wrangler.jsonc`, and no
  `PREVIEW_` anything. A production job in the deploy workflow, with its own
  GitHub environment. The rest of `DISASTER-RECOVERY.md`.

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
