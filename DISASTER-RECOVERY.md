# Disaster Recovery — litbible.net

> **What this is.** The repo is the content store — everything reader-facing
> can be rebuilt from a clone. What *cannot* be rebuilt from the repo is the
> deploy configuration and secrets, which live only in third-party dashboards.
> This file lists every dashboard, every secret **by name and location only**
> (never values — if a value ever appears here, rotate it), and the from-zero
> redeploy path. Because this repo is **public**, login addresses and
> recovery contacts are also kept out; they live in the private
> **"LIT Bible — Accounts & Recovery"** doc in the Liberating Scripture
> Collective Google Drive. Update both in the same change whenever a
> dashboard, secret, or integration is added or removed.
>
> Scenarios it covers: lost laptop, lost account access, a deleted Cloudflare
> project, or handing the site to someone else.

## The one-paragraph version

The site is a static Astro build deployed to **Cloudflare Pages** on the
`litbible.net` zone. One standalone **Cloudflare Worker**
(`litbible-contact-form`) backs the two contact forms, delivering mail via
**Cloudflare Email Routing's send binding**; bot protection is **Cloudflare
Turnstile** (two widgets). Inbound litbible.net mail is **Google Workspace**
(MX points at Google, not Cloudflare). Off-Cloudflare: **GitHub** (repo +
Actions + one PAT secret), **Brevo** (newsletter), **RedCircle** (podcast
feed), **GiveLively** (donations). Everything else is in the repo.

## Accounts & dashboards

This repo is **public**, so the specific login addresses, password-vault
location, and recovery contacts are deliberately NOT written here. They
live in a private companion document — **"LIT Bible — Accounts &
Recovery"** in the **Liberating Scripture Collective Google Drive**. In a
real emergency, open that doc first; this table only maps which services
exist and which *kind* of identity owns each.

| Service | What it holds | Who logs in (specifics in the private doc) |
|---------|---------------|--------------------------------------------|
| Cloudflare | `litbible.net` zone (DNS), Pages project, the Worker, Email Routing (send-side), both Turnstile widgets | The primary admin identity |
| Google Workspace | litbible.net mail (the owner's mailbox; `contact@` sender identity's domain); admin console at admin.google.com | The primary admin identity (this *is* that account) |
| Porkbun (registrar) | `litbible.net` registration | The owner's **personal** identity — a separate account, with the Porkbun password in *that* account's own manager |
| GitHub | `liberatingscripture/litbible` repo, Actions, branch ruleset, `RELEASE_NOTES_PAT` + `LSC_SYNC_TOKEN` secrets | The primary admin identity |
| Brevo | Newsletter list + the three sibforms forms (footer subscribe, /courses subscribe, /unsubscribe) | The primary admin identity |
| RedCircle | *Found in Translation* podcast; feed `https://feeds.redcircle.com/59ffbfb2-f814-469a-8522-416bb67c15f6` | **Managed by BDR**, not the site owner — audio recovery goes through them |
| GiveLively | Donation widget on /support (`secure.givelively.org/widgets/simple_donation/liberating-scripture-collective`) | A Collective-domain (liberatingscripture.org) identity |
| Resend | `send.litbible.net` sending domain (nothing in this repo uses it — set up for the mobile-app development side) | **Managed by BDR**, not the site owner — like RedCircle, recovery goes through them |
| Bluesky | The account with handle `@litbible.net` (verified by the `_atproto` DNS record) | The primary admin identity |

## The dependency chain (read this first in a real emergency)

Almost every account above logs in as — and password-resets through — the
**primary admin identity**, a Google Workspace address on the litbible.net
domain itself, whose mail only works while three things hold:

1. the **Porkbun registration** is current (domain lapse = no DNS at all),
2. the **Cloudflare zone** exists and still carries the Google MX/TXT
   records (zone deletion = mail stops, even though the registration is
   fine),
3. the **Google Workspace subscription** is active and its admin login
   recoverable.

Break any link and the recovery email for Cloudflare, GitHub, and Brevo —
and the password vault itself — goes dark with it. Mitigations
(**confirmed in place 2026-07-18**; the specific recovery addresses and
phone are in the private "Accounts & Recovery" Drive doc):

- Auto-renew + a working payment method at Porkbun.
- The primary admin account has recovery configured **outside this
  chain**: a recovery email on a domain not controlled through this
  stack, plus the owner's personal phone — so it can be recovered even
  while litbible.net mail is down.
- That outside recovery identity (which also holds the Porkbun password)
  has its own recovery configured, pointing to a trusted family member's
  personal address — it's the root of trust for the registrar.

## Cloudflare (the load-bearing account)

Losing this account is the worst case — it holds five distinct things:

1. **DNS zone `litbible.net`** — registered at **Porkbun**, with
   nameservers pointed at Cloudflare (so the zone's records live in the
   Cloudflare dashboard, and a lapsed Porkbun registration takes down
   everything regardless of Cloudflare's health — keep renewal/payment
   current there). The full record inventory (22 records as of
   2026-07-18, captured from live DNS) is in **"DNS record inventory"**
   below — mail for litbible.net is Google-hosted (MX → Google), NOT
   Cloudflare Email Routing.
2. **Pages project** — serves the site from `dist/`, **git-connected**:
   pushing to `main` on GitHub triggers Cloudflare to build and deploy
   automatically; there is no manual deploy step. The build command and
   output directory are configured in the Pages dashboard (not in the
   repo) — if the project is ever recreated, reconnect it to the GitHub
   repo and set build command `npm run build`, output directory `dist`.
   The Node version comes from the repo's `.node-version` file. Leave the
   dashboard's `NODE_VERSION` variable unset, since it would override the
   file. Without either, Pages falls back to its build image's default
   (22.16.0 in 2026-10), which astro 7.4 refuses to run on.
3. **Worker `litbible-contact-form`** — routes
   `litbible.net/contact/submit` and `litbible.net/app-support/submit`.
   Code, routes, and the rate-limit binding all live in
   `workers/contact-form/wrangler.toml` and redeploy with `npm run deploy`
   there; only the six secrets (below) need re-entering by hand.
4. **Email Routing (send-side only)** — litbible.net's *inbound* mail is
   Google Workspace, so Cloudflare Email Routing exists here solely to
   power the Worker's `send_email` binding. What matters is the
   **Destination addresses** list: each inbox the Worker delivers to must
   be added **and verified** there (Cloudflare emails a confirmation
   link; the binding hard-fails on an unverified destination). Sender
   identity is `contact@litbible.net` (config in `wrangler.toml`, no
   routing rule needed). Destinations (exact addresses are in the private
   Drive doc — they're also the `DEST_EMAIL` / `APP_SUPPORT_DEST_EMAIL`
   secret values):
   - **/contact** → the owner's litbible.net Workspace mailbox
   - **/app-support** → a shared Gmail inbox both the owner and BDR can
     access, so app-support recovery doesn't bottleneck on one person
5. **Turnstile** — two separate widgets, one per form. Site keys are public
   and committed (`src/pages/contact.astro`, `src/pages/app-support.astro`);
   the secret keys are Worker secrets. If the widgets are lost, create two
   new **Managed**-mode widgets for hostname `litbible.net`, paste the new
   site keys into those two pages, and re-set the two secrets.

### The notebook service's preview (deployed 2026-11-23)

The Study Desk's sync service (`workers/notebook-service/`; the plan's step
4c in `STUDY-DESK.md`). The preview was created and deployed on 2026-11-23
by a session at BVJ's word, with BVJ typing the secret. Production is
prepared and not deployed: its own entry follows this one. **When either
breaks, the one-page protocol is `workers/notebook-service/RUNBOOK.md`.**

- **What it adds to the account**: a Worker, `litbible-notebook-preview`;
  a D1 database of the same name (western North America); one Worker
  secret, `PREVIEW_SECRET`, whose value is in BVJ's password manager and
  nowhere else; and a Custom Domain, `notebook-preview.litbible.net`, which
  puts one record in the zone that the Worker manages (in the inventory
  below). Code, bindings, the database's id, and the address are all in
  `workers/notebook-service/wrangler.jsonc`.
- **Losing it loses nothing.** Everything on the preview is test data. No
  reader's notebook is there, and nothing is restored: recreate it from
  the service's README, "One-time setup," and tell the apps' sessions in
  `STUDY-DESK-FOR-THE-APPS.md` that the test accounts are gone.
- **Roll back** (code only, never the database), from
  `workers/notebook-service/`:
  `npx wrangler deployments list --env preview`, then
  `npx wrangler rollback --env preview` (or with a version ID). The
  README's "Roll back" has the detail, and "Wipe" clears the test data.
- **Who answers when it breaks**: BVJ first, BDR second (BVJ, 2026-11-23;
  BDR's part is BDR's to accept). **Anyone with write access to this
  repository can roll back, with no access to Cloudflare**: Actions,
  "Notebook service," "Run workflow" on `main`, environment `preview`,
  action `rollback` (empty version: the one before the current). That is the
  workflow `.github/workflows/notebook-service-deploy.yml`, BVJ's choice
  on 2026-11-23 over a member role on this account. **It is on, and was
  tried that day**: a deploy, a rollback, and a second deploy each
  passed. It also deploys the preview on every merge to `main` that
  touches the service. Its token and environment are in the secrets
  table below; if GitHub Actions is down, BVJ rolls back by hand, as
  above.
- **A break pauses sync and loses nothing**, on the preview and later in
  production: every device keeps its own notebook.
- **Sign-in (the plan's step 4e, 2026-11-24) added no resource and no
  secret.** A passkey signs in with `litbible.net` as the relying party,
  set by three variables in `wrangler.jsonc` (`PASSKEY_RP_ID`,
  `PASSKEY_ORIGINS`, `PASSKEY_LOCAL_ORIGINS`), none of them a secret. It
  leans on two files the **site** serves, `apple-app-site-association` and
  `assetlinks.json` in `public/.well-known/`: if either stops being served
  as it is, the apps lose their passkeys for the site along with their
  links. **Sign in with Apple and with Google are built and off.** Turning
  them on will add the variables `GOOGLE_CLIENT_IDS`, `APPLE_CLIENT_IDS`,
  `APPLE_TEAM_ID`, and `APPLE_KEY_ID`, and one Worker secret,
  `APPLE_PRIVATE_KEY` (in the secrets table below as not yet set). All of
  those come from BDR's Apple developer account and Google Cloud project,
  which are two more dashboards this service will then depend on: record
  them here when they are in use.

### The notebook service's production (prepared 2026-11-24, NOT deployed)

Step 4f of the plan wrote everything production needs into the repository
and created nothing. **No reader's notebook is on any service yet.**
Whether and when to deploy is BVJ's; the steps are in
`workers/notebook-service/README.md`, "Production."

- **What it will add to the account, when deployed**: a Worker,
  `litbible-notebook-production`; a D1 database, `litbible-notebook`, made
  by hand first (its id in `wrangler.jsonc` is a placeholder of zeros until
  then, and nothing deploys with it); a Custom Domain,
  `notebook.litbible.net`, with one record in the zone; a cron trigger,
  hourly; and two rate limit bindings, which are configuration and no
  resource. It should run on Workers Paid.
- **What it will hold**: every signed-in reader's notebook, sealed on their
  devices with keys the service never has, and the plain fields
  `STUDY-DESK-ENCRYPTION.md` lists under "What the service holds." **This
  is the one thing in the whole deployment that the repository cannot
  rebuild.**
- **Its backup is D1's Time Travel**: any minute of the last 30 days (7 on
  the Free plan), restored with `wrangler d1 time-travel restore`. There is
  no other copy, by design: a second copy is a second place a deleted
  account would linger. A restore undoes deletions made since, so it is
  BVJ's call each time (`RUNBOOK.md`, 4).
- **Losing the database entirely** loses the synced copies and no reader's
  notebook: every device holds its own, whole, and pushes it again once a
  reader signs in and sets up. They would need their recovery code or
  passkey only for a notebook the service still held, so a new, empty
  database means every reader sets up again as a first device.
- **Deleting accounts depends on the hourly run**, which carries out
  requests that waited seven days. If the cron trigger is lost, nothing is
  deleted until it is back (`RUNBOOK.md`, 6).
- **Roll back, and who answers**: as for the preview, with environment
  `production` in the workflow. The workflow's production jobs never run on
  a merge, and stay skipped until BVJ sets `NOTEBOOK_PRODUCTION_DEPLOYS`.
- **The site serves one page for it**, `/delete-account/`, the address
  Google Play asks for. It is out of search and the sitemap until accounts
  open.

### The policy's report Worker (built 2026-11-24, NOT deployed)

Counts the reports browsers send about the site's content security policy
(`workers/csp-reports/`; the plan's step 4i in `STUDY-DESK.md`). Everything
it needs is in the repository, and **nothing of it exists on the account
yet**: creating its database and deploying it are BVJ's, and the steps are
in `workers/csp-reports/README.md`, "One-time setup."

- **What it will add to the account, when deployed**: a Worker,
  `litbible-csp-reports`; a D1 database of the same name, made by hand
  first (its id in `wrangler.jsonc` is a placeholder of zeros until then);
  a route on the zone, `litbible.net/csp-report`, with no DNS record; a
  cron trigger, once a day; and one rate limit binding, which is
  configuration and no resource. **No secret, and no token.**
- **What it holds**: counts of reports by day, rule, blocked origin, page
  path, and browser family, each deleted after 30 days. Nothing about a
  reader. **Losing it loses nothing that matters**: the counts are a
  working list for one decision (enforcing the policy), and they start
  again from the next report.
- **If it is down or gone**: no page breaks. The static site answers at
  the address and refuses each report (405), and nothing is counted until
  it is redeployed.
  The policy itself is in `public/_headers` and doesn't depend on it.
- **Deleting old counts depends on the daily run.** If the cron trigger is
  lost, counts outlive the 30 days the privacy page gives; redeploying
  restores the trigger, and the README's "Stop, roll back, or wipe" has
  the command that deletes every count by hand.
- **It deploys by hand**, with no workflow and no GitHub secret.

## DNS record inventory (litbible.net zone, 2026-07-18)

Captured from live DNS + the Cloudflare dashboard. All values here are
public by nature (anyone can query them), so committing them is safe; the
DKIM public keys can also be re-issued from the matching provider
dashboard if this list ever drifts. Unless noted: TTL Auto, DNS only
(not proxied).

**Site (Cloudflare Pages)** — both **Proxied** (orange cloud):

```
litbible.net       CNAME  litbible.pages.dev
www.litbible.net   CNAME  litbible.pages.dev
```

**The notebook service's preview (a Worker Custom Domain)**, added
2026-11-23 and **Proxied**. The Worker manages it (the dashboard lists it
as a record of type "Worker"), so it is never rebuilt by hand:
`npm run deploy:preview` in `workers/notebook-service/` makes the record
and its certificate again.

```
notebook-preview.litbible.net  Worker  litbible-notebook-preview
```

**Mail: Google Workspace** (re-obtainable from the Google Admin console):

```
litbible.net  MX  1  aspmx.l.google.com
litbible.net  MX  5  alt1.aspmx.l.google.com
litbible.net  MX  5  alt2.aspmx.l.google.com
litbible.net  MX 10  alt3.aspmx.l.google.com
litbible.net  MX 10  alt4.aspmx.l.google.com

google._domainkey.litbible.net  TXT  "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmDwbQjBO/VNV0Zjxgn8XdObQCY/32ayX47FOGRwssQzNPORm1QTDQ9e1ORzXQTElQmHyEAgKUn+FUaHXjDjEEPM3f+29U13LdwmYndYJncHAwcHxjWpxxiD7n6CFRQtikuELkB2M3gXBR2CIomvBpzWBkmbP3Wj20oHQbukbQB9Y60oJiVP0ZqYjnvvqom2B2ix7VUeOkO8jbEp2lKnenmqoyIQqmrq5PXL649VG+lktk3/BH2ryVZpN/RLSsXenwvYpccIHrjKFpGgVDyq3GvyOybpHgU4Ii6im457nUoO3DKiErMfXxCrnuMiMPJmSFAH7FEy9KiCpEJN2HO8NSQIDAQAB"
```

**Sender authorization (SPF/DMARC)** — the SPF names every service allowed
to send as `@litbible.net` (Google, Brevo/Sendinblue, Resend); DMARC
reports go to Brevo:

```
litbible.net         TXT  "v=spf1 include:_spf.google.com include:sendinblue.com include:spf.resend.com ~all"
_dmarc.litbible.net  TXT  "v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com"  (TTL 1 hr)
```

**Brevo (newsletter) sender verification** (re-obtainable from Brevo →
Senders & Domains) — TTL 1 hr:

```
brevo1._domainkey.litbible.net  CNAME  b1.litbible-net.dkim.brevo.com
brevo2._domainkey.litbible.net  CNAME  b2.litbible-net.dkim.brevo.com
litbible.net                    TXT    "brevo-code:70c3c17ad3503b1780148a5dd4e60c83"
```

**Resend sending domain `send.litbible.net`** (Resend rides Amazon SES;
re-obtainable from the Resend dashboard → Domains) — TTL 1 hr:

```
send.litbible.net             MX 10  feedback-smtp.us-east-1.amazonses.com
send.litbible.net             TXT    "v=spf1 include:amazonses.com ~all"
resend._domainkey.litbible.net TXT   "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDE/7c+OCggxgVvc6kTuoVrFyYcRUtjrdoa4WLX+qAZU0E692d05SF+Hr5BGykNpzOVkf9pVX+NCHYvQTzyD+E39cqOdH9hDpCWxTnlWpn35c7uoeGU+JEZQGsQJCW9RPbq95QKcoO0k2c5LBXB/K8sHORypNh+RraEcCyioPUFoQIDAQAB"
```

The Resend account is **BDR's**, set up as part of mobile-app development
(owner recollection, 2026-07-18) — nothing in this repo sends through it.
Note that the root-domain SPF above also authorizes Resend, so mail from
that account can authenticate as `@litbible.net`; if BDR ever retires it,
remove `include:spf.resend.com` from the root SPF and delete these three
records.

**Domain verifications & identity:**

```
litbible.net           TXT  "google-site-verification=MQZCS0t6moLPzAzJjx-BCpUAQENurGJAH98-lTfHTYw"
litbible.net           TXT  "google-site-verification=_2kFeFBVTizJaErUwI3zE_Ce9rHlwNb42ry0ZqSeReI"
litbible.net           TXT  "google-site-verification=c7Q0OI0zszhFmXSnGKuE-1ClpxhY8Ykm34OJkbL_9ZI"
litbible.net           TXT  "openai-domain-verification=dv-MhhUKHf7qEoB37QyXXiwuL6e"
_atproto.litbible.net  TXT  "did=did:plc:5z5apkm7ns4nytgpqaibttvx"
```

The `_atproto` record is the **Bluesky handle verification** (it lets a
Bluesky account use `litbible.net` as its handle); the DID is permanent,
so rebuild it verbatim. Google/OpenAI verifications can be re-issued from
Search Console / the OpenAI dashboard if lost.

**Agent discovery (A2A):**

```
_a2a._agents.litbible.net  SVCB  1 litbible.net. mandatory="alpn,port" alpn="a2a" port="443"
```

## Secrets (names and locations only — never values)

**Worker secrets** — re-set from `workers/contact-form/` with
`npx wrangler secret put <NAME>` (interactive prompt; values never touch
shell history). Documented in `wrangler.toml`'s comments:

| Name | What it is |
|------|------------|
| `TURNSTILE_SECRET` | Secret key of the /contact Turnstile widget |
| `DEST_EMAIL` | Verified Email Routing destination for /contact mail |
| `DISPLAY_TO` | Optional branded alias shown in /contact's `To:` header |
| `APP_SUPPORT_TURNSTILE_SECRET` | Secret key of the /app-support widget |
| `APP_SUPPORT_DEST_EMAIL` | Verified destination for /app-support mail |
| `APP_SUPPORT_DISPLAY_TO` | Optional alias for /app-support's `To:` header |

**GitHub Actions secrets** (repo → Settings → Secrets → Actions):

| Name | What it is |
|------|------------|
| `RELEASE_NOTES_PAT` | Fine-grained PAT (Contents: read/write on this repo, owned by a branch-ruleset-bypass account) that lets `release-notes.yml` push its auto-generated commit straight to `main`. If it is revoked, the workflow fails on the push step; mint a new fine-grained PAT with the same scope and update the secret. |
| `LSC_SYNC_TOKEN` | Fine-grained PAT scoped to **`liberatingscripture/liberatingscripture.github.io`** only, with **Issues: read/write**. Lets `apps-mirror-notify.yml` open an issue on the LSC repo when a mirrored `/apps` file or `/privacy` changes here. The built-in `GITHUB_TOKEN` cannot write to another repo, which is why this exists. Two distinct failure modes: if the secret is **absent** the workflow logs a warning and exits 0, so the run stays green and the only symptom is that LSC silently stops being told; if the token is **present but revoked** the `gh` call 401s and the step fails red under Actions' default `bash -e`. Recovery either way: re-mint with the same scope and update the secret. |

**Both are deliberately set to never expire.** These workflows are meant to
run unattended for long stretches, and a lapsed token is a recurring, quiet
failure in exchange for a control that only ever bounds the window of an
*undetected* leak. The accepted trade is that **nothing rotates them for you,
so revoking by hand is the only kill switch** — which is what makes this
section worth keeping accurate. If the owning account is ever compromised,
pull `RELEASE_NOTES_PAT` first: it can write to `main` past the branch
ruleset, where `LSC_SYNC_TOKEN` can only open issues on a public repo.

**The notebook service's preview** (see "The notebook service's preview"
above). The first four have been set since 2026-11-23, when BVJ turned the
deploy workflow on; the fifth is not set yet:

| Name | Where | What it is |
|------|-------|------------|
| `PREVIEW_SECRET` | Worker secret, the `preview` environment only | What the preview's own way in asks for, so the apps' sessions can get a test session before sign-in exists. Set from `workers/notebook-service/` with `npx wrangler secret put PREVIEW_SECRET --env preview`. If it leaks or is lost, set a new value (32 or more random characters) and give it to BDR privately; sessions already made keep working, and all it ever reaches is test data. Production is never given it. |
| `CLOUDFLARE_API_TOKEN` | GitHub environment `notebook-preview` (limited to `main`) | A Cloudflare API token, named `litbible-notebook-preview-deploys` on the account's API tokens page, that can deploy and roll back Workers and run D1 migrations on this account, and nothing else (Workers Scripts, Workers Tail read, and D1 on the account; Workers Routes on the `litbible.net` zone). Never expires, like the two tokens above and for the same reason. Kill switch: Cloudflare dashboard, Account API tokens, "Roll" (then update this secret) or "Delete." Losing it stops the workflow and nothing else; deploys by hand still work. |
| `CLOUDFLARE_ACCOUNT_ID` | the same environment | The account's ID. Not a secret in itself; kept beside the token. |
| `NOTEBOOK_PREVIEW_SECRET` | the same environment, optional | The same value as `PREVIEW_SECRET`, so that a deploy can run its own check against the preview. Change the two together. |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | GitHub environment `notebook-production`, **which does not exist yet** (2026-11-24) | Production's own copy of the two above, for the workflow's production jobs. Made when BVJ decides to deploy production (the service's README, "Production," step 4): limit the environment to `main` and add BVJ as a required reviewer. The token may be a second one with the same four permissions, or the preview's. Same kill switch. |
| `APPLE_PRIVATE_KEY` | Worker secret, **not yet set** (2026-11-24) | The Sign in with Apple key from BDR's Apple developer account: the whole text of its `.p8` file. Sign in with Apple stays off until it and its three variables are set (the service's README, "Apple and Google"). When it is: BVJ types it at Wrangler's own prompt, `npx wrangler secret put APPLE_PRIVATE_KEY --env preview`. The service uses it to sign the short-lived token Apple asks for when it trades a sign-in's code or revokes a refresh token, and for nothing else. If it leaks: revoke the key in the Apple developer account (Certificates, Identifiers & Profiles, Keys), make a new one, and set the new key and its `APPLE_KEY_ID`. Apple lets a key be downloaded once, so a lost file means a new key. |

The workflow is switched by two repository **variables** (not secrets):
`NOTEBOOK_PREVIEW_DEPLOYS` (`on` to enable it; absent, both of its jobs are
skipped) and `NOTEBOOK_PREVIEW_URL` (the preview's address). Production's
two jobs have their own pair, **neither set** (2026-11-24):
`NOTEBOOK_PRODUCTION_DEPLOYS` and `NOTEBOOK_PRODUCTION_URL`. Production has
no Worker secret of its own until Sign in with Apple is turned on there.

**The policy's report Worker has no secret**, in Cloudflare or in GitHub.
Its counts are read with Wrangler's own login on the owner's machine.

There are **no other secrets**. The site build needs none (the podcast fetch
is an unauthenticated public feed; Brevo/GiveLively integrations are
public-key/embed-only).

## From-zero redeploy

**Site** (any machine with Node + npm):

```sh
git clone https://github.com/liberatingscripture/litbible
cd litbible
npm ci
npm run build        # full pipeline; output in dist/
```

In normal operation there is no manual deploy: **push to `main` and the
git-connected Pages project builds and deploys itself.** Only if the Pages
project itself was lost do you recreate it in the Cloudflare dashboard and
reconnect it to the GitHub repo (build command `npm run build`, output
directory `dist`), then attach the `litbible.net` custom domain.
`public/_headers` ships in the build, so security headers, caching rules,
and the API `no-store` rules need no dashboard configuration. Redirects and
the sitemap live in `astro.config.mjs` — also no dashboard config.

**Worker** (must be live *before* the site, or form POSTs hit a Pages 404):

```sh
cd workers/contact-form
npm install
npx wrangler login
# re-set the six secrets listed above (wrangler offers to create the
# Worker on the first `secret put` — say yes)
npm run deploy       # attaches both routes from wrangler.toml
```

Full step-by-step (Email Routing verification, Turnstile widget creation,
smoke tests) is in `workers/contact-form/README.md`.

**The notebook service's preview** (independent of the site and of the
forms' Worker, and holding only test data): `workers/notebook-service/README.md`,
"One-time setup." Its last step runs a scripted check against the deployed
service. **Production**, once it exists: the same README, "Production."
Its code and configuration come back from the repository; **its data comes
back only from D1's Time Travel**, and only within 30 days.

**The policy's report Worker**, once it exists (independent of everything
else, with no secret): `workers/csp-reports/README.md`, "One-time setup,"
whose last step checks it. Its counts are not worth restoring.

**Verify after redeploy:**

- Site loads; a chapter page and `/read/<book>` render.
- `/api/version.json` responds (the mobile apps gate all syncing on it).
- Submit `/contact` and `/app-support` once each; confirm both emails
  arrive with a working `Reply-To`.
- Newsletter footer form still posts to Brevo (sibforms).

## The mobile apps

The iOS/Android apps sync from `litbible.net/api/*` and store content
locally, so a site outage degrades them gracefully — readers keep their
last-synced text. Recovery order therefore doesn't need to rush for the
apps; just ensure `/api/version.json`, `/api/manifest.json`, and
`/api/data/*` are serving (all generated by `npm run build`) and the
`no-store` headers from `public/_headers` are active.

## Off-Cloudflare integrations (degrade independently)

- **Brevo** — the footer/courses subscribe forms and /unsubscribe post to
  hardcoded `sibforms.com` endpoints. **The subscriber list lives only in
  Brevo — no export is kept as of 2026-07-18.** It is the one dataset in
  the whole system with no second copy; if the list grows to matter,
  start a periodic CSV export (Brevo dashboard → Contacts → Export) and
  update this line. The site itself is unaffected by a Brevo outage.
- **RedCircle** — the build fetches the podcast feed but a fetch failure
  falls back to the committed snapshot (`src/data/podcast-feed.xml`) and
  never fails the build. Audio files live on RedCircle only, in an
  account **BDR manages** — podcast recovery is theirs to drive.
- **GiveLively** — donation widget is an embed; nothing to recover on our
  side beyond the account (login in the private Drive doc).
