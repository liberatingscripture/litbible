# Static files and headers (`public/`)

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory.
> Cross-references such as "below" or "rule 15" were written when all of
> this was one file, so they may point into another area file; the root's
> index says which file holds each section.

- **Security headers / CSP** live in `public/_headers` (deploy-only — `dev`
  and `astro preview` don't apply them). The CSP is deliberately split (owner
  decision 2026-07-10): an ENFORCED header carries only structural directives
  that can never break an integration (`frame-ancestors`, `object-src`,
  `base-uri`, `form-action`), while the full resource allowlist
  (script/connect/frame/img/etc.) is `Content-Security-Policy-Report-Only` —
  documentation + telemetry, blocks nothing. Two maintenance rules:
  (1) if a form's backend changes (as when the self-hosted contact Worker
  replaced Formspree), update the enforced `form-action` list in the same
  change;
  (2) when adding any new third-party integration, add its origins to the
  report-only allowlist so it stays an accurate inventory. **Revisit enforcing
  the full policy if the site ever gains logins/accounts/sessions** (e.g. a
  members area) — the "static site with no secrets" premise behind the
  report-only decision stops holding at that point. **That point is the
  Study Desk's account pages (plan step 4h)**: since step 4g the allowlist
  names the notebook service's two origins in `connect-src`, and a linked
  browser holds a session and device keys in IndexedDB. **Enforcing the
  full policy before sign-in ships is the plan's step 4i** (`STUDY-DESK.md`,
  "Order of work," 4): review a week of reports first.
- **Agent/AI discovery surface** lives in static files, all served as-is from
  `public/`. They only take effect on a deployed Cloudflare Pages site — `dev`
  and `astro preview` do **not** apply `_headers`:
  - `public/.well-known/api-catalog` — RFC 9727/9264 `linkset+json` pointing at
    the public API (`/api/content.json`, `/api/manifest.json`) with `service-doc`
    (→ `llms-full.txt`) and `status` (→ `/api/version.json`) relations. It's
    extensionless, so `_headers` sets its `Content-Type: application/linkset+json`.
  - `public/_headers` adds `Link:` headers (RFC 8288) on `/*` advertising the
    catalog (`rel="api-catalog"`) and docs (`rel="service-doc"`).
  - `public/robots.txt` carries a `Content-Signal` line. Keep it consistent with
    the CC BY-NC-ND license and `llms.txt`: `ai-train=no` (no broad LLM training),
    `search=yes`, `ai-input=yes` (RAG/inference welcome). The site has no auth,
    MCP server, or write API, so OAuth/MCP/WebMCP discovery files are intentionally
    absent — don't add them without a real backing service.
- **The apps' link files are live, and the released apps read them**:
  `public/.well-known/apple-app-site-association` (iOS universal links, and
  since Study Desk step 4e `webcredentials`, which lets the app use the
  site's passkeys) and `assetlinks.json` (Android app links, and
  `get_login_creds` for the same). A mistake in either breaks links for
  installed apps and shows on no page. The app ids, package name, and
  signing certificates in them are BDR's (the apps' developer): never add or
  change one without BDR. Edit them by inserting text, never by
  re-serializing, and flag the change at the top of the pull request.
  `test/link-files.test.js` holds their shape, and fails if the notebook
  service's accepted Android origins (`workers/notebook-service/wrangler.jsonc`)
  and the certificates in `assetlinks.json` ever differ. Apple fetches its
  file through its own CDN, so a change can take a day or more to reach a
  phone.
- **Images are optimized ahead of time.** There is no `astro:assets`
  pipeline: page-loaded raster images are WebP, resized to about twice their
  display size, and referenced by plain URL string (frontmatter, `src`,
  JSON). The pre-WebP originals are archived in `_source-images/`, outside
  `public/` so they never ship (its README). `assets/screenshots/` holds the
  /apps phone and tablet shots, **mirrored to the LSC site**: lowercase-kebab
  names, no spaces, so the two repos' components stay byte-identical
  (`src/components/apps/CLAUDE.md`).
