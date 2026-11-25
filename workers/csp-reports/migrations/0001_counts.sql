-- What is kept of the reports browsers send about the site's content
-- security policy: counts, and nothing about who sent them (src/report.js
-- has what each column may hold).
--
-- WITHOUT ROWID makes the key the table itself, so adding to a count writes
-- one row and not two (a table row and an index row). D1 counts rows written
-- against the account's daily allowance.

CREATE TABLE counts (
  day         TEXT NOT NULL,    -- 2026-11-24, in UTC
  disposition TEXT NOT NULL,    -- enforce (blocked), report (only flagged), or unknown
  directive   TEXT NOT NULL,    -- the rule: script-src-elem, connect-src, ...
  blocked     TEXT NOT NULL,    -- an origin, a path on the site, a scheme, or a word (inline, eval)
  page        TEXT NOT NULL,    -- the page's path on the site, no query string
  source      TEXT NOT NULL,    -- the file that asked: as `blocked`, or empty
  browser     TEXT NOT NULL,    -- chromium, firefox, safari, or other
  n           INTEGER NOT NULL, -- how many reports
  PRIMARY KEY (day, disposition, directive, blocked, page, source, browser)
) WITHOUT ROWID;

-- How many reports were counted each day, so a day's cap (src/store.js,
-- DAILY_CAP) is checked by reading one row.
CREATE TABLE days (
  day TEXT PRIMARY KEY,
  n   INTEGER NOT NULL
) WITHOUT ROWID;
