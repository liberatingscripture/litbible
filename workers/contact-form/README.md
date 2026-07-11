# Contact-form Worker

The backend for the [litbible.net/contact](https://litbible.net/contact/) form
(FIXLIST F1). A standalone Cloudflare Worker — **not** a Pages Function, which
can't use the `send_email` binding — that verifies the Turnstile token
server-side and delivers the message through Cloudflare Email Routing. No
third-party form processor (Formspree is retired once this ships).

- **Route:** `litbible.net/contact/submit` (deliberately outside `/api/*`,
  which is reserved for the mobile-app sync contract).
- **From:** `contact@litbible.net`, with `Reply-To:` set to the submitter.
- **To:** the inbox in the `DEST_EMAIL` secret (kept out of the repo).

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

## Follow-ups after it ships

- Delete the retired Formspree forms in their dashboard (`mbdlnpgz` contact;
  `mgovgpoo` courses — already unused).
- Consider a Cloudflare **rate-limiting rule** on `litbible.net/contact/submit`
  (e.g. 5 requests/minute per IP) — Turnstile gates bots, rate limiting caps
  cost.

## Development notes

- `npm run check` bundles the Worker without deploying (no auth needed) —
  CI-friendly sanity check.
- `npm run dev` runs it locally, but `send_email` is simulated: wrangler
  writes the would-be email to a local file instead of sending.
- Dead ends, so nobody re-litigates them: the free MailChannels-from-Workers
  path shut down in Aug 2024; Cloudflare Email Service (arbitrary
  recipients) is beta/paid and unnecessary here — Email Routing's
  `send_email` binding to a verified destination is free and sufficient.
