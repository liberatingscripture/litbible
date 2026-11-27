# When the notebook service breaks

One page. For BVJ, who answers first, and BDR, who answers second (BVJ,
2026-11-23). The longer reference is `README.md` beside this file.

**First, what a break costs: sync pauses, and nothing is lost.** Every
device keeps its own whole notebook and works without the service. So there
is time to read this page. Don't hurry a fix into production.

| | Preview | Production |
|---|---|---|
| Address | `https://notebook-preview.litbible.net` | `https://notebook.litbible.net` (**not deployed yet**) |
| Worker | `litbible-notebook-preview` | `litbible-notebook-production` |
| Holds | test data only | readers' notebooks, sealed |
| `--env` | `preview` | `production` |

## 1. Is it broken, and how?

```bash
curl -s https://notebook-preview.litbible.net/     # or production's address
```

- **`{"time":…,"service":"lit-notebook",…}`**: the Worker is up. Watch its
  log live: `npx wrangler tail --env preview` (or `--env production`) from
  this directory, or the dashboard's real-time log (Workers & Pages, the
  Worker, Logs). **Nothing is stored** (BVJ, 2026-11-26), so a failure that
  is over can't be read back: watch while it happens again, or while a
  reader tries.
- **No answer, or Cloudflare's own error page**: the Worker or its address
  is down. Check https://www.cloudflarestatus.com first. If Cloudflare is
  well, roll back (2).
- **Every request answers `error` (500)**: read the log's `failure` lines.
  `"failure":"Error"` on every route, right after a deploy, most often
  means a binding is missing (the service refuses to run without its three
  rate limiters, on purpose). Roll back (2).
- **`d1` in a `failure` line**: the database. If it began with a deploy,
  roll back (2). If not, see (4). If every route fails at once with no
  deploy, and the account is on Workers Free, D1's day of writes may be
  spent (100,000 rows): it comes back at midnight UTC, or within minutes
  of moving the account to Workers Paid (BVJ).
- **Readers are told `slow_down` (429)**: the limits. See (6).
- **A reader is told their account is full (`too_large` with
  `"what":"account"`, 413)**: it holds 100,000 rows or 100 MB. See (6).
- **Only Apple sign-ins fail (`provider`, 502)**: Apple is unreachable or
  its key is wrong. Nothing else is affected. See (5).
- **Harm that rolling back can't stop** (the stored data is what's wrong,
  or one account is filling the database or spending the day's writes):
  switch the service off (10), then find the cause.

A log line never holds an id, an account, or an address. To find one
reader's trouble, ask them what their device says: the refusal's word is
enough.

## 2. Roll back the code (BVJ or BDR, no Cloudflare access needed)

GitHub, Actions, **"Notebook service,"** "Run workflow" on `main`:
environment `preview` or `production`, action `rollback`, version empty
(the one before the current) or a version ID, and a few words of why.

By hand, with `wrangler login` on BVJ's account, from this directory:

```bash
npx wrangler deployments list --env production
npx wrangler rollback --env production --message "why"
```

**A rollback returns the code in seconds and never touches the database.**
A migration is never undone, and every migration is written to work with
the version before it, so rolling back one version is always safe.
Production's rollback waits for no reviewer: it has an environment of its
own (`notebook-production-rollback`), so BDR can run it alone.

**Then switch deploys off (3) before anything merges.** A merge that
touches the package deploys `main`, which is the code you just rolled back
from. A rollback waits in a queue apart from the deploys, so a merge can't
cancel one that is waiting, but a merge can still land after it. The switch
stops rollbacks too, so turn it on again to roll back further. Once the fix
is merged, turn it on and run the workflow's deploy by hand, since the
merge itself deployed nothing.

Then check: `npm run check:production -- https://notebook.litbible.net`, or
for the preview, `npm run walkthrough -- https://notebook-preview.litbible.net`.

**Count the rows again after a rollback past Audit 9's ceiling** (migration
`0004`, BVJ, 2026-11-26). The code before it stores rows without counting
them, so once the code that counts is back, each account's `row_count` and
`row_bytes` may be wrong for whatever was pushed or removed in between. A
count too low lets an account past its ceiling; one too high refuses a
reader early. This counts every account again, from its rows (the
migration's own statement). It is safe while readers push, since a push
moves the counts in the same step that stores its rows:

```bash
npx wrangler d1 execute DB --env production --remote --command "UPDATE accounts SET row_count = (SELECT COUNT(*) FROM rows WHERE rows.account = accounts.id), row_bytes = (SELECT COALESCE(SUM(size * 3 / 4), 0) FROM rows WHERE rows.account = accounts.id)"
```

## 3. Stop deploys while you think

Delete the repository variable `NOTEBOOK_PREVIEW_DEPLOYS` (or
`NOTEBOOK_PRODUCTION_DEPLOYS`), or set it to anything but `on`. Merges then
deploy nothing. Production never deploys on a merge in any case.

## 4. The data is wrong (production only; BVJ)

**Stop and think before this one: it sends every reader back in time.** D1's
Time Travel restores the whole database to a minute in the last 30 days (7
on the Free plan). Everything written since is lost from the service, and a
deletion carried out since is undone. Devices still hold their notebooks
and will push again, so records are not lost; a reader who deleted their
account in that window must delete it again, and should be told.

```bash
npx wrangler d1 time-travel info DB --env production
npx wrangler d1 time-travel restore DB --env production --timestamp=<RFC 3339 time>
```

It prints a bookmark for the state before the restore: keep it, since it is
the way back. On the preview, don't restore; wipe (`README.md`, "Wipe").

## 5. Apple

- **Apple is down**: Apple sign-ins answer `provider`, and an account with
  an Apple way in can't be deleted until Apple answers. Nothing to do but
  wait; the hourly run retries by itself.
- **The Apple key leaked or was revoked**: in BDR's Apple developer account,
  revoke the key and make a new one. BVJ sets it from the new `.p8` file
  (`Get-Content -Raw "<path>" | npx wrangler secret put APPLE_PRIVATE_KEY --env …`,
  README, "Apple and Google") and changes `APPLE_KEY_ID` in
  `wrangler.jsonc` to the id in the file's name. Set the secret and merge
  the id together: between the two, Apple's sign-ins fail with `provider`.
  The value goes nowhere else, a conversation with an assistant included.

## 6. Reading the hourly line, and the limits

Once an hour, at seventeen past, the service logs one line:

```json
{"job":"scheduled","deleted":0,"replaced":0,"canceled":0,"held":0,"failed":0,"more":false,"swept":{"sessions":0,"approvals":0,"challenges":0,"accounts":0,"accountsHeld":0}}
```

`swept.accounts` counts the accounts deleted because they never set up a
notebook: no notebook, no live session, and made (or replaced) more than
30 days ago (BVJ, 2026-11-26). Up to 100 go in a run, oldest first. Nobody
asked for these deletions, so a number far above the sign-ups of a month
before is worth a look.

- **No such line at seventeen past, watched live**: the cron trigger may
  be gone. Dashboard: the Worker, Settings, Trigger Events. Redeploy (the trigger is in
  `wrangler.jsonc`). Nothing is lost meanwhile: requests that are due wait.
- **`held` above 0, hour after hour**: an account that should be deleted is
  being kept because Apple won't take the revoke (5). A reader asked to be
  deleted, so this one matters: find out why Apple refuses within a day or
  two. If Apple can't be mended, the decision to delete anyway is BVJ's
  (the spec's "Still open," 65).
- **`swept.accountsHeld` above 0, hour after hour**: an account never set
  up holds a token from Apple, and Apple won't take the revoke (5). It
  stays until Apple does. Nobody is waiting on it, so this is less urgent
  than `held`, but it is the same fault.
- **`failed` above 0**: a fault here. The `failure` line beside it has the
  kind. The request (or the account never set up) stays and is tried
  again; fix the cause.
- **`more: true`, hour after hour**: more than 100 requests fall due each
  hour. Raise `DUE_PER_RUN` in `src/scheduled.js`.
- **`swept.accounts` at 100, hour after hour**: more accounts are left
  unused than a run deletes, which is likely a program making them. Raise
  `UNUSED_PER_RUN`, and see the limits below.
- **Readers told `slow_down`**: one address is over 60 sign-in starts, 120
  pushes (`POST /rows`), or 1,200 requests a minute. A real crowd behind one
  address (a conference) can do that: raise the numbers in `wrangler.jsonc`
  and deploy. A flood is doing what the limit is for; if it hurts anyway,
  add a rate limiting rule on the zone in the dashboard (Security, WAF),
  which stops it before the Worker runs. A reader's device waits the
  `retry` it is given and goes on by itself.
- **A reader told their account is full** (`too_large`, `"what":"account"`):
  it holds 100,000 rows or 100 MB of sealed records (BVJ, 2026-11-26).
  Their changes stay on their devices; the website tries again each hour.
  Deleting entries frees room only slowly, since a deletion keeps a small
  record of itself. The ceiling is `accountRows` and `accountBytes` in
  `LIMITS`, `src/check.js`, and raising it is BVJ's call (a change to the
  spec, and a note for the apps). To see which accounts are largest, by
  count and never by name:

  ```bash
  npx wrangler d1 execute DB --env production --remote --command "SELECT row_count, row_bytes FROM accounts ORDER BY row_bytes DESC LIMIT 10"
  ```

  If a count looks wrong (say, after a rollback), count again (2).

## 7. An account won't delete

Deleting is one statement, and it either deletes everything or nothing. If
a very large notebook ever makes it fail (the log shows `d1` on
`DELETE /account`, or `failed` in the hourly line), the account is whole.
BVJ removes its rows in pieces and lets the request run again. This needs
the account's id, which no log holds; take it from the `waiting` table:

```bash
npx wrangler d1 execute DB --env production --remote --command "SELECT account, what, due FROM waiting WHERE due < datetime('now') ORDER BY due"
npx wrangler d1 execute DB --env production --remote --command "DELETE FROM rows WHERE account = '<id>' AND rev IN (SELECT rev FROM rows WHERE account = '<id>' LIMIT 5000)"
```

Repeat the second until it changes nothing. The next hourly run deletes the
rest. Do this only for an account whose request is in that table and due.

**An account never set up** (`swept.accountsHeld`, (6)) has no notebook and
so no rows: size is never why it stays. It stays because it holds a token
from Apple that Apple won't revoke (5), and goes by itself once Apple
answers. It also stays, rightly, the moment it is signed in to or sets up a
notebook: the deleting statement asks again.

## 8. A secret leaked

| What | Do |
|---|---|
| A deploy token (`CLOUDFLARE_API_TOKEN`) | Cloudflare dashboard, Account API tokens: "Roll," then update the GitHub environment's secret. It can deploy Workers and run migrations; it can't read a notebook, since nothing can |
| `PREVIEW_SECRET` | Set a new one (`npx wrangler secret put PREVIEW_SECRET --env preview`), update `NOTEBOOK_PREVIEW_SECRET` in GitHub, give it to BDR privately. It reaches test data only |
| `APPLE_PRIVATE_KEY` | (5) |
| A copy of the database | Tell BVJ. Notebooks in it are sealed with keys the service never had. What is plain: Apple's and Google's account ids, passkeys' public keys, Apple's refresh tokens, dates, and session token hashes (not tokens). Revoke Apple's tokens by rotating the Apple key, and end every session: `DELETE FROM sessions` |

No secret's value goes into a file, a commit, an issue, or a conversation
with an assistant. `DISASTER-RECOVERY.md` has every name.

## 9. Afterward

Write what happened in the pull request that fixes it. If readers were
affected, or a restore undid a deletion, BVJ decides what they are told. If
the apps must change anything, it goes in `STUDY-DESK-FOR-THE-APPS.md`.

## 10. Switch the service off (BVJ)

For when rolling back the code can't help: the stored data is what's
wrong, or one account is doing harm (BVJ, 2026-11-26; Audit 9's decision
8). Stop the service answering first, then find the cause.

1. **Stop deploys** (3). A deploy puts the address back, since `routes` in
   `wrangler.jsonc` names it.
2. **Remove the address.** Cloudflare dashboard: Workers & Pages, the
   Worker (`litbible-notebook-preview` or `litbible-notebook-production`),
   Settings, Domains & Routes, the Custom Domain
   (`notebook-preview.litbible.net` or `notebook.litbible.net`), Remove.
   It takes about a minute and changes no code. The website and the apps
   then say they're offline, and every notebook stays whole on its
   devices. The hourly run goes on, since it needs no address.
3. **Find the account**, by its counts (an id is no name):

   ```bash
   npx wrangler d1 execute DB --env production --remote --command "SELECT id, row_count, row_bytes, created FROM accounts ORDER BY row_bytes DESC LIMIT 5"
   npx wrangler d1 execute DB --env production --remote --command "SELECT account, COUNT(*) AS n FROM rows GROUP BY account ORDER BY n DESC LIMIT 5"
   ```

   The second counts the rows themselves, for when the first's counts may
   be wrong (after a rollback past migration `0004`; count again, (2)).
4. **Delete it, if that is the call (BVJ's).** Not by hand if it holds a
   token from Apple (`SELECT COUNT(*) FROM apple_tokens t JOIN ways w ON
   w.id = t.way WHERE w.account = '<id>'` above 0): the service always
   tells Apple before an account goes, and a hand delete would skip that.
   Otherwise remove its rows in pieces, as in (7), until the statement
   changes nothing, then the account:

   ```bash
   npx wrangler d1 execute DB --env production --remote --command "DELETE FROM accounts WHERE id = '<id>'"
   ```

   **On Workers Free each row deleted counts against the day's 100,000
   rows written**, shared with every database on the account, and an
   index counts again. An account at the ceiling (100,000 rows) can take
   more than a day's allowance: spread it over days, with the service off
   or not. The ceiling keeps any account's delete within D1's 30 seconds,
   so the hourly run's own delete would also work; this is the route for
   an account nobody asked to delete.
5. **Switch it back on**: the same page, Add, Custom Domain, the same
   address. Then let deploys run again (3).

Try it once on the preview when convenient (BVJ's, 2026-11-26), telling
BDR first in case the apps are testing against it.
