-- The ceiling on what one account stores (Study Desk Audit 9, SV9-1 and
-- SEC9-3; BVJ, 2026-11-26): 100,000 rows and 100,000,000 bytes of sealed
-- records. STUDY-DESK-ENCRYPTION.md, "Records," says what is counted. And,
-- at the end, an index for the sweep of accounts that never set up a
-- notebook.
--
-- Like every migration here, this one works with the code deployed before it
-- (README, "Migrations"): two columns with a default, which that code never
-- reads, and a count of what is already there. The code that reads them
-- moves them in the same guarded batch that writes the rows (src/rows.js),
-- and resets them where a replacement deletes the rows (src/waiting.js).
--
-- Between this migration and the deploy of that code, a push from the code
-- before it isn't counted. The preview applies a migration and deploys within
-- the same run, and a rollback past this version would leave the same gap
-- for as long as it lasted; RUNBOOK.md, section 2, has the statement below
-- to count again after one.

-- How many rows the account holds.
ALTER TABLE accounts ADD COLUMN row_count INTEGER NOT NULL DEFAULT 0;
-- The bytes of sealed record those rows hold: each row's ciphertext, tag
-- included, as base64urlBytes() in src/check.js measures it from its text.
-- `size` is that text's length, and unpadded base64url spells
-- floor(length * 3 / 4) bytes, which SQLite's integer division gives.
ALTER TABLE accounts ADD COLUMN row_bytes INTEGER NOT NULL DEFAULT 0;

-- What the preview already holds (test data).
UPDATE accounts SET
  row_count = (SELECT COUNT(*) FROM rows WHERE rows.account = accounts.id),
  row_bytes = (SELECT COALESCE(SUM(size * 3 / 4), 0) FROM rows WHERE rows.account = accounts.id);

-- The same decisions' other half: the hourly run deletes an account that
-- never set up a notebook (src/scheduled.js, sweepUnused). This index holds
-- only the accounts with no notebook, so that run reads those and not every
-- account. A push never writes to it: it changes neither `kid` nor `created`.
CREATE INDEX accounts_no_notebook ON accounts(created) WHERE kid = 0;
