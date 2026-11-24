-- The account work (step 4f of STUDY-DESK.md, "Order of work," 4): the
-- request that waits seven days, and what a replaced notebook leaves behind.
--
-- Like every migration here, this one works with the code deployed before it
-- (README, "Migrations"): it adds one table and three columns that may be
-- empty, and takes nothing away.
--
-- What may be stored is still fixed by STUDY-DESK-ENCRYPTION.md, "What the
-- service holds": a waiting request is plain, and names no one.

-- A request to delete the account or to replace its notebook, made from a
-- session that couldn't open the notebook, while it waits ("Waiting seven
-- days"). One for an account at most: the primary key is what makes "none is
-- already waiting" checked and written as one step. It goes with the account.
CREATE TABLE waiting (
  account TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  what TEXT NOT NULL,                  -- 'delete' | 'replace'
  asked TEXT NOT NULL,                 -- when it was made
  due TEXT NOT NULL,                   -- when it falls due: seven days after `asked`
  platform TEXT NOT NULL,              -- the kind of device, in the asking device's own word
  through TEXT,                        -- the kind of the way in the asking session came through, if it still stands
  session TEXT NOT NULL                -- the token hash of the session that asked, which may cancel it
);
CREATE INDEX waiting_due ON waiting(due);

-- The last time the account's notebook was replaced, so that a device that
-- held the old one can tell its reader when, and from what kind of device.
-- NULL on an account whose notebook never was.
ALTER TABLE accounts ADD COLUMN replaced TEXT;
ALTER TABLE accounts ADD COLUMN replaced_platform TEXT;
ALTER TABLE accounts ADD COLUMN replaced_through TEXT;

-- The scheduled sweep deletes by these.
CREATE INDEX sessions_expires ON sessions(expires);
CREATE INDEX approvals_expires ON approvals(expires);
