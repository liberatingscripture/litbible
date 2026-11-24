# Cloudflare Workers

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory.

## The contact and app-support Worker (`workers/contact-form/`)

- **The contact + app-support forms are self-hosted**: `/contact` posts to
  `/contact/submit` and `/app-support` posts to `/app-support/submit`, both
  served by a single standalone Cloudflare Worker in `workers/contact-form/`
  (deliberately outside `/api/*`, the app-sync namespace) that verifies the
  Turnstile token server-side and delivers mail via Email Routing's
  `send_email` binding. The Worker keys off the request pathname to pick a
  per-form config: each form has its own Turnstile widget (own secret) and its
  own destination inbox, so app-support mail lands in a different inbox than
  contact mail. Each route also takes an optional `*_DISPLAY_TO` secret — a
  branded alias shown in the `To:` header while delivery still targets the real
  (verified) inbox, with a one-time retry if Cloudflare rejects the mismatch
  (mirrors the liberatingscripture.org contact Worker). It deploys separately
  from the site (owner-run `wrangler
  deploy` — see its README, which also carries the one-time dashboard/secret
  setup for the app-support route); native POSTs (the fallback when fetch is
  blocked; Turnstile still needs JS to render, so a genuinely JS-less visitor
  can't pass the check) 303-redirect to the matching `…/thanks/` page.
  **Adding a route means redeploying the Worker before the site deploy that
  publishes the new form**, or the POST hits the Pages 404.

## What the two Workers share

Each Worker is a package of its own: its own
`package.json`, lockfile, and vitest suite (`npm test` in its directory), and
its own CI job and Dependabot stream. The root `npm ci` and `npm test` reach
neither, and nothing in the site imports either.

- **`wrangler`'s version is set by `@cloudflare/vitest-plugin`, not by our
  range.** Both suites run in workerd through that plugin, which pins wrangler
  EXACTLY. Our wrangler range must only admit that pin, or the tree splits
  into a second, nested wrangler/miniflare/workerd that no bump of ours can
  reach. `workers/contact-form/README.md`, "Development notes," has the whole
  story; Dependabot bumps the pair together in each stream
  (`.github/CLAUDE.md`).
- **Deploys are the owner's.** Cloudflare is BVJ's account: a session never
  runs `wrangler deploy`, `wrangler d1 create`, `wrangler secret put`, a
  remote migration, or anything else that creates or changes a resource there
  unless BVJ says so in that session. Local runs and tests need no account
  and are a session's to run.
- **No secret's value goes into a file, a commit, a pull request, or a
  message.** `DISASTER-RECOVERY.md` records names only.

## The notebook service (`workers/notebook-service/`)

The Study Desk's sync service: a Worker with a D1 database that holds each
signed-in reader's notebook sealed, so the service can open nothing (the
plan's step 4c in `STUDY-DESK.md`, "Order of work," 4).
**It is a preview only**, live at `https://notebook-preview.litbible.net`
since 2026-11-23 and holding test data alone. **Production is prepared and
not deployed** (step 4f, 2026-11-24: `env.production` in `wrangler.jsonc`
with a placeholder database id, and two workflow jobs that are off).
**The website's connector is built (step 4g, 2026-11-24;
`src/scripts/desk/sync/CLAUDE.md`)** and changed nothing here. Two
sentences of this package's README are stale since then ("Nothing in the
website imports the service," and "The website's own Content Security
Policy doesn't name this origin yet"): they were left because any change
in this package redeploys the preview, so correct them with the next
change that has to. **The root suite's stand-in for this service**
(`test/helpers/fake-notebook-service.mjs`) repeats the checks, words, and
order of `src/rows.js`, `src/session.js`, and `src/check.js` by hand: a
change to any of them needs the same change there.
**Sign-in is built (step 4e, 2026-11-24)**: a passkey with `litbible.net` as
the relying party works; Sign in with Apple and with Google are built, off,
and have never met either provider. **The account work is built (step 4f,
2026-11-24)**: deleting an account, the requests that wait seven days, an
hourly run, and limits by address. Its README is the working reference (run,
test, deploy, roll back, wipe, "Passkeys," "Apple and Google," "The account
work," "Production," and what each later step plugs in and where), and
`RUNBOOK.md` beside it is the page for when it breaks.

- **Its specification is `STUDY-DESK-ENCRYPTION.md`, "The service's
  interface," and the two change together.** That section holds the exact
  shape of every request and answer, every size, and the word of every
  refusal; both apps build clients from it. A change to a check, a shape, a
  size, or a word is a change to the spec in the same pull request, with a
  dated entry in `STUDY-DESK-FOR-THE-APPS.md`. After the freeze (step 4d) it
  is a new interface version.
- **"Checked and written as one step" is `guard()` and `commit()` in
  `src/db.js`.** D1 has no transaction across a read and a later write, so
  every write that depends on a read is one batch whose first statement fails
  unless the account's `kid`, lists' version, or last revision is still what
  was read. A new write path that skips the guard is a race, whatever its
  tests say; `test/races.test.js` shows how to force one at an exact point,
  and each guard there was checked by weakening it and watching a test fail.
- **Nothing personal is stored or logged, and no body, key proof, or session
  token reaches a log.** One line a request, with the route's own pattern and
  never the address asked for; Cloudflare's per-request log is off in
  `wrangler.jsonc`. `test/http.test.js` holds the service to it.
- **The preview's way in (`src/preview.js`) must stay unreachable in
  production**: routed only when the environment's own config says
  `PREVIEW_SIGN_IN` is `on`, names itself exactly `preview` (an allow-list),
  and holds a `PREVIEW_SECRET` of 32 characters or more. `test/preview.test.js`
  proves "not found" when any of the three is missing. Don't loosen any of
  the three, and don't give production's config any of them.
- **Sign-in gives out sessions, so its rules are the ones a wrong edit
  makes unsafe** (`src/signin.js`, `src/ways.js`, `src/webauthn.js`,
  `src/providers.js`):
  - **The PRF's output never reaches the service.** A passkey's response
    that still carries `clientExtensionResults.prf.results` is refused
    whole, before anything else is read (`src/passkey-form.js`).
  - **Every sign-in answers a challenge the service made**, used up as it
    is read (`useChallenge`). Don't read one without deleting it.
  - **A change to an account's ways in moves the lists' version, in a
    guarded batch**, and once an account has a notebook it needs an open
    session. A session is written only while its way in still stands
    (`createSession`).
  - **A passkey's answer is checked by code written here**, on WebCrypto,
    with no dependency; the header of `src/webauthn.js` says why, and
    `test/webauthn.test.js` holds it to the W3C's published examples.
    Don't add a switch that skips a check to make a test pass.
  - **No identifier of Apple's or Google's is in the repo, and none is
    guessed**: both stay off until BDR's are configured. The tests use
    made-up ones (`test/idp.js`).
  - **The Android origins in `wrangler.jsonc` and the certificates in
    `public/.well-known/assetlinks.json` change together**; the root's
    `test/link-files.test.js` fails when they differ. Those two link
    files are live and read by the released apps: change them only by
    inserting, and say so at the top of the pull request.
- **The account work's rules** (`src/waiting.js`, `src/scheduled.js`,
  `src/limits.js`):
  - **Seven days is BVJ's number** (`WAIT_DAYS`), and only a session that
    has proved the key deletes at once. Don't add a path that deletes or
    replaces a notebook from a session that is signed in and no more.
  - **Apple's tokens are revoked before an account goes**, and the account
    stays if Apple can't be reached.
  - **Each delete, cancel, and carry-out is one statement or batch with
    its condition inside it** (still open, still waiting, still due).
    `test/waiting-races.test.js` forces each race, and each condition was
    checked by taking it out and watching a test fail. Do the same for a
    new one.
  - **A replaced notebook resets every session's proof.** The next
    notebook's first key is `kid` 1 again.
  - **The address a request comes from is never stored or logged.** It is
    the limiter's key and nothing else. A missing limiter binding answers
    `error` to everything, on purpose.
  - **Production's config has no `PREVIEW_` anything**, and its workflow
    jobs never run on a push; `test/config.test.js` holds both. The top
    level of `wrangler.jsonc` stays empty.
- **The tests are a real client.** They import the website's reference by
  relative path (`src/lib/desk-crypto.mjs`) and replay the vectors'
  walkthrough (`test/fixtures/notebook-crypto-vectors.json`) through the
  Worker in workerd on a real local D1. `scripts/walkthrough.mjs` runs the
  same steps over HTTP, which is how a deploy is verified. A change to the
  reference or the vectors can therefore fail this package's CI job, not the
  root's.
- **Migrations are applied before the code that needs them, and a rollback
  never undoes one**, so each must work with the code already deployed. Never
  edit one that has been applied; add the next numbered file.
- **`.github/workflows/notebook-service-deploy.yml` is ON for the preview
  (since 2026-11-23), and off for production. A merge to `main` that
  touches this package deploys the preview**: tests, migrations, deploy,
  then the walkthrough against it. So
  a change here is live minutes after it merges, and a migration in it is
  applied for good. The workflow is also the way BDR rolls back, from the
  Actions tab (BVJ's choice over a member role on the Cloudflare account).
  The repository variable `NOTEBOOK_PREVIEW_DEPLOYS` is its switch, and the
  README's "Who can deploy and roll back" has how it is set up.
- **`src/pages/delete-account.astro` is this service's page on the site**:
  the address Google Play asks every app with accounts for. It is noindex,
  out of the sitemap, and unlinked until accounts open, and it can't delete
  anything until the website's sign-in (step 4h) adds the button. Each fact
  on it is one the service does (the spec's "Deleting the account"): change
  the two together, and BDR reviews its copy, as the one who files the
  stores' forms.
