-- The notebook service's first schema (step 4c of STUDY-DESK.md, "Order of work," 4).
--
-- What may be stored is fixed by STUDY-DESK-ENCRYPTION.md, "What the service
-- holds": sealed things, and the few plain fields the service needs to sync.
-- No name, no email address, and nothing that opens a notebook.
--
-- Sealed values are kept as the base64url text they arrive in. D1 hands a
-- BLOB back as an array of numbers, which would triple a large row on its way
-- out, and the service never needs the bytes: it checks a value's form and
-- length from its text and stores it as it came.
--
-- Every time is the service's own clock, in the record format's form
-- (2026-11-23T18:35:09.978Z), except a row's `modified` and `deleted_at`,
-- which are the device's and are sealed with the record.

-- One row for each reader. An account with `kid` 0 has no notebook yet.
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,                 -- a UUID the service makes
  created TEXT NOT NULL,
  notebook TEXT,                       -- the notebook's id (a device makes it), or NULL
  kid INTEGER NOT NULL DEFAULT 0,      -- the current notebook key's number, 0 for none
  proof_hash TEXT,                     -- base64url(SHA-256(key proof)) for `kid`
  lists INTEGER NOT NULL DEFAULT 0,    -- the version of the device and holder lists
  rev INTEGER NOT NULL DEFAULT 0       -- the last revision given to a row
);

-- A way to sign in. Step 4c makes only `preview` ways (and passkeys by the
-- preview's own request, with no ceremony); step 4e adds Apple, Google, and
-- real passkeys, with whatever more each needs, by a later migration.
CREATE TABLE ways (
  id TEXT PRIMARY KEY,                 -- a UUID the service makes
  account TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                  -- 'preview' | 'passkey' (4e: 'apple', 'google')
  subject TEXT NOT NULL,               -- a preview account's name; a passkey's credential id (base64url)
  syncs INTEGER,                       -- a passkey only: 1 when it is the kind that syncs
  created TEXT NOT NULL,
  UNIQUE (account, kind, subject)
);
-- A way that signs a reader in belongs to one account, whoever asks. A passkey
-- is left out of this index for now: the preview lists one with no ceremony,
-- it can't sign anyone in, and two test accounts may name the same made-up
-- credential (the test vectors' own, say). Step 4e, which registers real
-- passkeys, adds the matching index for those.
CREATE UNIQUE INDEX ways_sign_in ON ways(kind, subject) WHERE kind <> 'passkey';

-- A session. The token itself is never stored, only its SHA-256.
-- "Open" is worked out, never stored: attached to a device that has an entry,
-- and proved for the account's current kid.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,         -- base64url(SHA-256(token))
  account TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  way TEXT,                            -- the way in it came from
  device TEXT,                         -- the device entry it is attached to, or NULL
  open_kid INTEGER NOT NULL DEFAULT 0, -- the kid it proved, 0 for never
  proof_failures INTEGER NOT NULL DEFAULT 0,
  created TEXT NOT NULL,
  expires TEXT NOT NULL
);
CREATE INDEX sessions_account ON sessions(account, device);

-- The device list. The card and the keyring are sealed; the rest is plain.
CREATE TABLE devices (
  account TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  id TEXT NOT NULL,                    -- a UUID the device makes
  card_kid INTEGER NOT NULL,
  card_nonce TEXT NOT NULL,
  card_ct TEXT NOT NULL,
  keyring_kid INTEGER NOT NULL,
  keyring_enc TEXT NOT NULL,
  keyring_ct TEXT NOT NULL,
  added TEXT NOT NULL,
  added_how TEXT NOT NULL,             -- 'setup' | 'approval' | 'passkey' | 'recovery'
  added_by TEXT,                       -- the approving device's id, or the holder's it came in through
  seen TEXT NOT NULL,
  PRIMARY KEY (account, id)
);

-- The holder list: the recovery code's holder, and one for each passkey that
-- opens the notebook. A holder is removed only by a change of key.
CREATE TABLE holders (
  account TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  id TEXT NOT NULL,                    -- a UUID the device that made it chose
  kind TEXT NOT NULL,                  -- 'recovery' | 'passkey'
  credential TEXT,                     -- a passkey holder only: the credential id (base64url)
  record_nonce TEXT NOT NULL,
  record_ct TEXT NOT NULL,
  card_kid INTEGER NOT NULL,
  card_nonce TEXT NOT NULL,
  card_ct TEXT NOT NULL,
  keyring_kid INTEGER NOT NULL,
  keyring_enc TEXT NOT NULL,
  keyring_ct TEXT NOT NULL,
  added TEXT NOT NULL,
  added_by TEXT,                       -- the device it was added from
  PRIMARY KEY (account, id)
);
-- The interface's own rules, held by the database too: at most one recovery
-- holder, and at most one holder for a passkey.
CREATE UNIQUE INDEX holders_recovery ON holders(account) WHERE kind = 'recovery';
CREATE UNIQUE INDEX holders_credential ON holders(account, credential) WHERE credential IS NOT NULL;

-- The records, one sealed row each ("A record on the service"). `size` is
-- the length of `ct` as text, so a page of rows can be measured from an
-- index without reading a single ciphertext.
CREATE TABLE rows (
  account TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  id TEXT NOT NULL,                    -- the record's id, as the record writes it
  rev INTEGER NOT NULL,                -- the service's revision
  v INTEGER NOT NULL,
  modified TEXT NOT NULL,
  deleted_at TEXT,                     -- a trash record's only
  kid INTEGER NOT NULL,
  nonce TEXT NOT NULL,
  ct TEXT NOT NULL,
  size INTEGER NOT NULL,
  PRIMARY KEY (account, id)
);
CREATE INDEX rows_page ON rows(account, rev, kid, size);

-- An approval in progress, kept for at most ten minutes. The grant's columns
-- are NULL until a device with the key grants it.
CREATE TABLE approvals (
  account TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  id TEXT NOT NULL,                    -- 32 lowercase hex characters, made from the approval code
  session TEXT NOT NULL,               -- the token hash of the session that asked
  device TEXT NOT NULL,                -- the new device's id
  platform TEXT NOT NULL,
  model TEXT NOT NULL,
  public TEXT NOT NULL,
  sign TEXT NOT NULL,
  mac TEXT NOT NULL,
  created TEXT NOT NULL,
  expires TEXT NOT NULL,
  granted_by TEXT,                     -- the granting device's id
  grant_kid INTEGER,
  grant_card_nonce TEXT,
  grant_card_ct TEXT,
  grant_enc TEXT,
  grant_ct TEXT,
  grant_mac TEXT,
  PRIMARY KEY (account, id)
);

-- Never holds a row. Every change that depends on what was just read begins
-- by trying to put a 0 here unless the account still stands as it was read;
-- the CHECK fails, and D1 rolls the whole batch back (src/db.js, "guard").
CREATE TABLE guard (
  ok INTEGER NOT NULL CONSTRAINT state_moved CHECK (ok = 1)
);
