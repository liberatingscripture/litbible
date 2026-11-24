-- Sign-in (step 4e of STUDY-DESK.md, "Order of work," 4): what a real way in
-- needs that the preview's never did.
--
-- Like every migration here, this one works with the code deployed before it
-- (README, "Migrations"): it adds columns that may be empty, two tables, and
-- an index that no row written by the earlier code falls under.
--
-- What may be stored is still fixed by STUDY-DESK-ENCRYPTION.md, "What the
-- service holds": a provider's account id, a passkey's public key, id, and
-- flags, and Apple's refresh token. No name, no email address, and nothing a
-- passkey's PRF gave.

-- The account's WebAuthn user handle: 32 random bytes, base64url, made by the
-- service and told to no one but the reader's passkey provider. Every passkey
-- of one account is made under the same handle, so a provider keeps one
-- passkey for the account and replaces it when a new one is made there.
-- NULL until the account's first passkey ceremony asks for it.
ALTER TABLE accounts ADD COLUMN handle TEXT;

-- A real passkey's public key, as a JWK (JSON text): P-256 for ES256, or RSA
-- for RS256. NULL on every other kind of way, and on a passkey the preview
-- listed with no ceremony, which is how the two are told apart: only a way
-- with a key here can sign anyone in.
ALTER TABLE ways ADD COLUMN public TEXT;
-- A real passkey's signature counter as last seen. Passkeys that sync report 0.
ALTER TABLE ways ADD COLUMN count INTEGER;

-- A real passkey signs in to one account, whoever asks: the index step 4c
-- left for this step. The preview's made-up passkeys have no key and stay
-- outside it, so two test accounts may still name the same made-up credential.
CREATE UNIQUE INDEX ways_passkey ON ways(subject) WHERE kind = 'passkey' AND public IS NOT NULL;

-- A challenge: 32 random bytes the service made, good for one ceremony and
-- for five minutes. A passkey ceremony signs it; Apple and Google carry it
-- back as the identity token's nonce. It is deleted when it is used.
CREATE TABLE challenges (
  id TEXT PRIMARY KEY,                 -- the challenge itself, base64url
  purpose TEXT NOT NULL,               -- 'passkey_sign_in' | 'passkey_new' | 'passkey_add' | 'provider'
  account TEXT REFERENCES accounts(id) ON DELETE CASCADE,  -- 'passkey_add' only: whose
  handle TEXT,                         -- 'passkey_new' only: the user handle its options named
  expires TEXT NOT NULL
);
CREATE INDEX challenges_expires ON challenges(expires);

-- Apple's refresh token for a way in of kind 'apple', kept for one purpose:
-- so that removing the way, or deleting the account (step 4f), can revoke it.
-- One for each client id (the app's, the website's) the reader signed in
-- through, since Apple revokes a token only for the client it was issued to.
CREATE TABLE apple_tokens (
  way TEXT NOT NULL REFERENCES ways(id) ON DELETE CASCADE,
  client TEXT NOT NULL,                -- the client id: the identity token's `aud`
  token TEXT NOT NULL,                 -- the refresh token. It opens nothing in a notebook
  created TEXT NOT NULL,
  PRIMARY KEY (way, client)
);
