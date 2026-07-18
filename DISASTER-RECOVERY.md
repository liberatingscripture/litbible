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
| GitHub | `liberatingscripture/litbible` repo, Actions, branch ruleset, `RELEASE_NOTES_PAT` secret | The primary admin identity |
| Brevo | Newsletter list + the three sibforms forms (footer subscribe, /courses subscribe, /unsubscribe) | The primary admin identity |
| RedCircle | *Found in Translation* podcast; feed `https://feeds.redcircle.com/59ffbfb2-f814-469a-8522-416bb67c15f6` | **Managed by BDR**, not the site owner — audio recovery goes through them |
| GiveLively | Donation widget on /support (`secure.givelively.org/widgets/simple_donation/liberating-scripture-collective`) | A Collective-domain (liberatingscripture.org) identity |
| Resend | `send.litbible.net` sending domain (DNS records exist; nothing in this repo uses it) | *TODO — record in the private doc which login, and what sends through it* |
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
   automatically; there is no manual deploy step. The build command,
   output directory, and Node version are configured in the Pages
   dashboard (not in the repo) — if the project is ever recreated,
   reconnect it to the GitHub repo and set build command `npm run build`,
   output directory `dist`.
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

<!-- TODO(owner): what uses Resend? Nothing in this repo sends through it,
so note here which project/account it belongs to. -->

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

**GitHub Actions secret** (repo → Settings → Secrets → Actions):

| Name | What it is |
|------|------------|
| `RELEASE_NOTES_PAT` | Fine-grained PAT (Contents: read/write on this repo, owned by a branch-ruleset-bypass account) that lets `release-notes.yml` push its auto-generated commit straight to `main`. If it expires or is revoked, the workflow fails on the push step; mint a new fine-grained PAT with the same scope and update the secret. |

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
