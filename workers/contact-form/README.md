# Contact-form Worker

The backend for the litbible.net site forms (FIXLIST F1). A standalone
Cloudflare Worker — **not** a Pages Function, which can't use the `send_email`
binding — that verifies the Turnstile token server-side and delivers the
message through Cloudflare Email Routing. No third-party form processor
(Formspree is retired once this ships).

**One Worker, two routes.** The request pathname selects a per-form config
(`formConfig` in `src/index.js`): subject line, destination inbox, Turnstile
secret, and success/error URLs. Both routes are deliberately outside `/api/*`,
which is reserved for the mobile-app sync contract.

| Route | Page | Turnstile secret | Destination secret |
|-------|------|------------------|--------------------|
| `litbible.net/contact/submit` | [/contact](https://litbible.net/contact/) | `TURNSTILE_SECRET` | `DEST_EMAIL` |
| `litbible.net/app-support/submit` | [/app-support](https://litbible.net/app-support/) | `APP_SUPPORT_TURNSTILE_SECRET` | `APP_SUPPORT_DEST_EMAIL` |

Each form has its **own Turnstile widget** (own secret) and its **own
destination inbox**, so app-support mail can go to a different address than
contact mail. Both send **From** `contact@litbible.net` with `Reply-To:` set
to the submitter. All four secrets are kept out of the repo.

## One-time setup (owner, Cloudflare dashboard + CLI)

Do these **before** merging the site changes that point the form here —
otherwise the form posts into a 404.

1. **Email Routing** (dashboard → litbible.net → Email → Email Routing):
   enable it if it isn't already, and add + verify your inbox as a
   *destination address* (Cloudflare emails you a confirmation link).
   `contact@litbible.net` does not need to exist as a routing rule — it's
   only the sender identity.
2. **Install & authenticate** (in this directory):

   ```sh
   npm install
   npx wrangler login
   ```

3. **Secrets:**

   ```sh
   npx wrangler secret put TURNSTILE_SECRET   # the Turnstile SECRET key (dashboard → Turnstile → the litbible.net widget)
   npx wrangler secret put DEST_EMAIL         # your inbox — must be the verified destination from step 1
   ```

   (On first `secret put`, wrangler offers to create the Worker — say yes.)

4. **Deploy:**

   ```sh
   npm run deploy
   ```

   The route in `wrangler.toml` attaches automatically. Worker routes take
   precedence over Pages on the same path, so `/contact/submit` is served by
   this Worker while everything else stays on Pages.

5. **Smoke test** on the live site: submit the form with JS on (inline
   success message), then once with JS disabled (should land on
   `/contact/thanks/`), and confirm both emails arrive with a working
   Reply-To.

## Adding the app-support form (owner, Windows PowerShell)

The `/app-support` page reuses this Worker via a second route. It has its own
Turnstile widget and its own destination inbox, so it needs new dashboard
setup and two new secrets. **Do all of this and redeploy the Worker BEFORE
deploying the site changes that publish `/app-support`** — until the Worker
carries the new route, a POST to `/app-support/submit` hits the Pages 404.

**A. Create the app-support Turnstile widget (dashboard):**

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Turnstile** in the
   sidebar → **Add widget**.
2. Name it something identifiable, e.g. `litbible app support`.
3. Hostname: add `litbible.net`. Widget mode: **Managed** (same as contact's).
4. Create it, then copy both keys:
   - **Site Key** → paste into `src/pages/app-support.astro`, replacing the
     `PASTE-NEW-SITEKEY-HERE` placeholder in the `data-sitekey` attribute, and
     commit (site keys are public by design).
   - **Secret Key** → used in step C. Do not put it in any repo file.

**B. Verify the app-support destination inbox (Email Routing):**

Dashboard → **litbible.net** → **Email** → **Email Routing** → **Destination
addresses** → add the inbox that should receive app-support messages and click
the confirmation link Cloudflare emails it. `send_email` errors on an
unverified **destination** (`APP_SUPPORT_DEST_EMAIL`).

The optional **display** address (`APP_SUPPORT_DISPLAY_TO`, step C) is only a
`To:`-header alias, not a delivery target, so it does **not** need to be a
verified destination — it can be any branded address. Mirrors the
liberatingscripture.org contact Worker's `DISPLAY_TO`.

**C. Set the three secrets (PowerShell, in this directory):**

```powershell
cd C:\Users\bcjoh\GitHub\litbible\workers\contact-form
npx wrangler secret put APP_SUPPORT_TURNSTILE_SECRET
# paste the Secret Key from step A when prompted, press Enter
npx wrangler secret put APP_SUPPORT_DEST_EMAIL
# type the verified inbox address from step B (where mail is delivered)
npx wrangler secret put APP_SUPPORT_DISPLAY_TO
# type the branded address to SHOW in the To: header (need not be verified)
```

`APP_SUPPORT_DISPLAY_TO` is optional: omit it and the To: header just shows the
real destination. If Cloudflare rejects the header/envelope mismatch, the
Worker retries once with the header matching the envelope, so mail still gets
through. `wrangler secret put` prompts interactively, so the values never land
in shell history. Secrets attach to the deployed `litbible-contact-form` Worker
and survive redeploys.

**D. Redeploy the Worker** (adds the new route and code):

```powershell
npm run deploy
```

**E. Then deploy the site**, and smoke-test `/app-support` on production: submit
with JS on (inline success), once with JS off (should land on
`/app-support/thanks/`), confirm the message reaches the NEW inbox with a
working Reply-To, and confirm `/contact` still delivers to the original inbox.

## Follow-ups after it ships

- Delete the retired Formspree forms in their dashboard (`mbdlnpgz` contact;
  `mgovgpoo` courses — already unused).

## Abuse protection

Two layers, both in the Worker (no dashboard rules):

- **Turnstile** server-side verification gates bots.
- A **rate-limiting binding** (`[[ratelimits]]` in `wrangler.toml`) caps
  submissions at 5/minute per client IP → 429 with a "wait a minute"
  message. It's best-effort per Cloudflare location — fine for capping
  cost on a contact form, not a security boundary.

## Development notes

- `npm run check` bundles the Worker without deploying (no auth needed) —
  CI-friendly sanity check.
- `npm run dev` runs it locally, but `send_email` is simulated: wrangler
  writes the would-be email to a local file instead of sending.
- Dead ends, so nobody re-litigates them: the free MailChannels-from-Workers
  path shut down in Aug 2024; Cloudflare Email Service (arbitrary
  recipients) is beta/paid and unnecessary here — Email Routing's
  `send_email` binding to a verified destination is free and sufficient.
