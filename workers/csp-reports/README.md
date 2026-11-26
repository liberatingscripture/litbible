# The policy's report Worker

A small Cloudflare Worker with a D1 database that counts the reports
browsers send about litbible.net's content security policy. It is step 4i of
the Study Desk's plan (`STUDY-DESK.md`, "Order of work," 4): the full policy
is to be enforced before sign-in ships, and a week of these reports is how
the policy's list is checked first.

**Status: deployed 2026-11-25**, on BVJ's go-ahead that day, and checked at
its real address (see "One-time setup," which is now the record of what was
done and the way to do it again from nothing). The site's headers have
named it since the same day, when `public/_headers` gained the reporting
directives, so the first day of counts is 2026-11-25.

## What it is for

Every page of the site is sent with a list of the places it may load
scripts, images, fonts, and frames from (`public/_headers`). Most of that
list is "report-only": a browser checks each page against it and blocks
nothing. When a page reaches outside the list, the browser posts a report to
`https://litbible.net/csp-report`, and this Worker adds one to a count.

Nobody is emailed and nothing is an alarm. `npm run summary` prints a week of
the counts as a page to read, and that page is the list of what would break
if the policy were enforced.

## What it keeps, and what it never does

One row for each combination of these, with a count (`src/report.js`,
`migrations/0001_counts.sql`):

| Kept | For example |
|------|-------------|
| the day, in UTC | `2026-11-25` |
| blocked, or only flagged | `enforce`, `report` |
| the rule | `connect-src` |
| what was blocked | `https://api.example.com`, `inline`, `chrome-extension` |
| the page's path | `/support/` |
| the file that asked | `/_astro/chapter-tools.B5E1GIKE.js`, `https://secure.givelively.org` |
| the browser's family | `chromium`, `firefox`, `safari`, `other` |

**Nothing about the reader is kept, and no log is stored.** The site's
privacy page says so, in the paragraph "Security reports," and these are
what make it true:

- **The address a report comes from** is handed to Cloudflare's rate limiter
  as a key for one call and goes nowhere else.
- **The user agent** is read for the browser's family and dropped.
- **Query strings and fragments** are cut from every address (a search, a
  shared sheet's link).
- **A browser extension's address is cut to its scheme.** Firefox gives each
  installation of an extension an id of its own, which would mark one
  reader's browser.
- **The referrer, the policy's text, the sample, the line, and the column**
  are never read.
- **Workers Logs is off** (`observability.enabled` is `false`).
  Cloudflare's documentation doesn't say what it attaches to a stored log
  line (read 2026-11-24), so none is stored. The Worker writes a line only
  when it fails, of fixed words, and `npx wrangler tail` shows it live.
- **Counts are deleted after 30 days** (`KEEP_DAYS` in `src/store.js`), by a
  run once a day at 04:41 UTC.

## What it answers

Every answer has an empty body: nothing a sender posts is ever given back.

| Status | When |
|--------|------|
| 204 | A post that was read, whether its reports were counted, dropped, or over the hour's cap. The three are answered alike on purpose. |
| 400 | Not JSON, not UTF-8, or empty |
| 404 | Any path but `/csp-report` |
| 405 | Any method but POST |
| 413 | Larger than 64 KB, by what it claims or by what arrives |
| 415 | A type no browser sends a report as |
| 429 | More than 120 posts in a minute from one address (`Retry-After: 60`) |
| 500 | The database or the configuration failed |

A report is dropped (and answered 204) when it isn't a policy report, or
when its page isn't on `https://litbible.net`. So a Pages preview
(`*.pages.dev`) and a copy of a page on another site are never counted.

## The limits, and what they are for

The address is public and takes posts from anyone.

- **64 KB a post**, and **20 reports read from one post**.
- **120 posts a minute from one address.** Cloudflare's limiter is
  approximate and counted separately in each of its locations; it slows a
  sender down and is not a wall.
- **208 reports counted in one UTC hour** (`HOURLY_CAP`), so a day counts at
  most 4,992 (24 hours of 208, the largest whole share of 5,000). After an
  hour's allowance is spent, posts are answered as before and write nothing
  until the next hour starts, so a flood costs one hour and not the rest of
  the day. A post that doesn't fit what is
  left of its hour is dropped whole. This is the limit that protects the
  rest of the account: on the Workers Free plan every D1 database draws on
  one allowance of 100,000 rows written a day, which the notebook service's
  preview shares, and a full day here writes at most about 10,000. The
  allowance is kept in the `days` table, one row an hour, keyed like
  `2026-11-26T13`; no schema changed, and the `counts` rows stay by day.
  (Rows keyed by a bare day, from before the hourly cap, are left alone and
  deleted with the rest after 30 days.)
- **What no limit here can stop**: each post is one Worker request, and on
  Workers Free the account has 100,000 a day across every Worker. A flood
  aimed at this address spends them, exactly as one aimed at the contact
  form's address would. The site's own traffic is nowhere near it (about 27
  page views a day in a browser, 2026-11-24).

## Run and test it

```sh
cd workers/csp-reports
npm ci
npm test             # in workerd, against a real local D1 and the configured limiter
npm run check        # a dry-run bundle: proves the config is sound
```

Locally, over real HTTP (no account needed):

```sh
npm run migrate:local
npm run dev -- --port 8799
# in another terminal: post a report, then read it back
npm run summary -- --local
```

On Windows, stopping `wrangler dev` can leave `workerd.exe` serving: check
that the port is free afterward.

## One-time setup (BVJ, or a session with BVJ's go-ahead)

1. **Create the database**:
   `npx wrangler d1 create litbible-csp-reports --update-config=false`.
   Put the id it prints into `wrangler.jsonc` as `database_id` (an id is not
   a secret) and commit it. Without that flag Wrangler offers to write a
   second, differently named binding into the config.
2. **Make its two tables**: `npm run migrate`.
3. **Deploy**: `npm run deploy`. This creates the Worker
   `litbible-csp-reports`, its route `litbible.net/csp-report`, and its
   daily trigger. There is no secret to set.
4. **Check it** (on Windows PowerShell, `curl.exe`; `curl` there is another
   command):
   - `curl.exe -i https://litbible.net/csp-report` answers `405` with
     `allow: POST`. Before the deploy the same address is the site's 404 page.
   - `curl.exe -i -X POST https://litbible.net/csp-report -H "content-type: application/csp-report" --data "{}"`
     answers `204`. An empty object is no report, so nothing is written; the
     answer proves the route, the limiter, and the configuration. (Before
     the deploy the static site answers this post `405`.)
   - `npm run summary` prints "No reports were counted," which proves the
     database and its tables are there and readable.

**Done on 2026-11-25**: the database is `litbible-csp-reports` in Western
North America, and all three checks answered as written. One more was made
that day, to see the whole path work: a single marked report about a page
that doesn't exist, `/csp-report-check/`, which the summary then showed as
one `connect-src` report from browser `other`. That row is the check's and
not a reader's; it goes with the rest after 30 days.

**The Worker goes live before, or with, the site change that names it.** If
`public/_headers` names the address first, the static site answers there and
refuses each post (`405`, seen on a Pages preview on 2026-11-24): nothing
breaks, and nothing is counted.

## Reading a week

```sh
npm run summary                         # the last 7 days
npm run summary -- --days 14
npm run summary -- --from 2026-11-25 --to 2026-12-01
npm run summary -- --save week.json     # also keep the rows
npm run summary -- --file week.json     # from kept rows: asks Cloudflare nothing
```

It asks Cloudflare through Wrangler and the login it already has, with two
SELECTs that change nothing. It is still a command against BVJ's account, so
it is BVJ's to run or to say yes to.

If an hour reached its cap, the page's first lines name it ("REACHED THE
HOUR'S CAP ... in the UTC hours starting 2026-11-26 13:00"): that hour's
counts are a floor, and every other hour counted in full, so one flooded
hour no longer blanks a day. A flood from one sender also skews what the
hour's list shows, so read a capped hour's lines with that in mind.

The page has three parts: what would be blocked if the whole policy were
enforced (the list to work through), what the enforced part already blocks,
and what browser extensions cause (not the site's to fix). Its last lines
say how to tell an extension from a gap.

**Any line can be forged** (Study Desk Audit 9, SEC9-5). Anyone can post to
the address, and the Worker can't tell a browser's report from a made-up
one, so a few posts can put an origin the site never uses at the top of
section 1. **An origin seen only in reports never goes into the policy**: it
goes in once it has been seen on that page in a real browser (the walk
below). The summary says so above its lists.

**A week at the site's traffic is a thin sample.** Reports come only from
pages someone opened, so also walk each kind of page in a real browser once
the headers are live (the donation box through to its payment step, the
podcast page's players, both forms, a subscribe), and read the summary
again.

## When it has to change

- **The address is in five places that must agree**: `public/_headers`
  (three times), the route and `SITE_ORIGIN` in `wrangler.jsonc`, and `PATH`
  in `src/http.js`. The root's `test/csp-reporting.test.js` fails when they
  don't.
- **`KEEP_DAYS` and the privacy page's "30 days" change together.** The same
  root test holds them.
- **What is kept and the privacy page's paragraph change together**, by
  hand: no test can read that paragraph's meaning. A new column is a change
  to what the site tells readers it keeps.
- **Turning Workers Logs on is a change to the privacy page**, not a
  convenience. `test/config.test.js` holds it off.
- **Migrations are never edited once applied**: add the next numbered file.

## Stop, roll back, or wipe

- **Stop the reports**: take `report-uri`, `report-to`, and
  `Reporting-Endpoints` out of `public/_headers`. The Worker can stay.
- **Roll back a deploy**: `npx wrangler rollback`.
- **Delete every count**:
  `npx wrangler d1 execute DB --remote --command "DELETE FROM counts; DELETE FROM days"`.
- **Remove it all**: `npx wrangler delete`, then
  `npx wrangler d1 delete litbible-csp-reports`.
