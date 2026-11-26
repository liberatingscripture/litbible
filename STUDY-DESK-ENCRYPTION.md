# End-to-end encryption for the notebook (draft 2)

**Status: draft 2, 2026-11-23, for BDR to review and BVJ to check. The reference and the test
vectors are built (step 4b, the same day), and so is the service, to run on a preview address
(step 4c, the same day), and so is the service’s sign-in (step 4e, 2026-11-24: a passkey works on
the preview; Apple and Google are built and off, waiting on client ids), and so is its account work
(step 4f, 2026-11-24: deleting an account, the requests that wait seven days, and limits on how
often a client may ask; production is prepared and **not deployed**). Every client’s use of this
is not, and no record changes with it.** Written by BVJ’s Claude, on the website’s side, which
writes this spec, its reference, and its vectors and builds the service from here on (BVJ,
2026-11-23). Draft 1 was written the same day by BDR’s Claude (PR #680) and BVJ answered its open
items that evening (`STUDY-DESK.md`, “Decisions,” 2026-11-23). This draft writes those answers in,
adds the service’s interface, and ends with what changed and what is still open. It is step 4a of
the plan in `STUDY-DESK.md`, “Order of work,” 4.

**Writing the reference meant reading every sentence here as code, and some said less than code
needs.** Each such place now says what the reference does, in its own section; “Changed in step
4b” lists them all, and the ones that were a choice are under “Still open,” 22 to 30, with one
question it turned up (31). **BVJ said yes to all nine choices on 2026-11-23, so they wait on BDR
alone**, and the question is put to the apps. No decision of draft 2 was changed, and none
of its open items was settled.

**Building the service did the same for “The service’s interface.”** That section now holds the
final shape of every request and answer, every size, and the word of every refusal, as the
service in `workers/notebook-service/` uses them. “Changed in step 4c” lists what moved, and the
ones that were a choice are under “Still open,” 32 to 40. No path changed, and no decision of
draft 2.

**Step 4e built sign-in on the service** (2026-11-24): a passkey with `litbible.net` as the relying
party, Sign in with Apple and with Google, several ways in to one account, and how long a session
lasts. Their requests are in “The service’s interface” under “Signing in” and “Ways to sign in.”
“Changed in step 4e” lists what moved, and each place that was a choice is under “Still open,” 41
to 58, for BDR to confirm and BVJ to check. No request that step 4c built changed its shape.

**Step 4g built the website’s connector** (2026-11-24): the first client of “Records,” the keyring,
and the key proof. **No request, answer, or word changed, and the service was not touched.** What a
client does between the requests was mostly unwritten, and the connector had to decide it. “Changed
in step 4g” says what it does, and each place that another client must match, or may want to, is
under “Still open,” 74 to 84, for BDR to confirm. **BVJ was walked through them the same day**:
yes to eight, and three left to BDR to answer (81, 83, and 84).

Plan C was chosen on BDR and BVJ’s call of 2026-11-23: a small LIT service on Cloudflare holds each
signed-in reader’s notebook, and only the reader’s own devices can read it. This file says exactly
how, the same way on the website, iOS, and Android. It gates encryption in both apps (iOS IOS-108,
Android NB15) and shapes sign-in (IOS-106, NB13), and it freezes with the record format,
tentatively on 2026-12-24.

It sits beside `STUDY-DESK-FORMAT.md` on purpose. That file says what a record *is*; this one says
how a record is sealed before it leaves a device, how the key that seals it gets from one device to
another, and what the service checks along the way. Nothing here changes a record’s fields.

**Decided by BDR and BVJ together, and taken as given:**
- **Plan C, with end-to-end encryption at launch** (2026-11-23). Shipping sync without it is not a
  fallback (BDR’s proposal, §8).
- **The privacy page may say only that “LIT holds your notes encrypted and can’t read them”** (BDR,
  2026-10-07), so LIT must hold nothing that opens them.
- **Sign in with Apple, with Google, or with a passkey.** No passwords and no codes by email.
- **The envelope**: the service keeps a record’s id, revision, edit time, and deletion time in the
  clear and everything else encrypted, and all merging happens on devices (`STUDY-DESK.md`, “To
  freeze before Christmas”; the format’s reserved `encryptedBody`).

**Decided by BVJ on 2026-11-23, without BDR in the conversation.** Each changes what the apps build,
so each is **for BDR to confirm**, and is marked so where it is written in below:
- **Passkeys carry the notebook key at launch**, and the recovery code is the fallback where a
  passkey can’t. Draft 1 had it the other way around.
- **The reader chooses where the key lives**: it “follows my account” or stays on “this device
  only,” at setup and later, on every platform. “Follows my account” is shown first and recommended.
- **A recovery code is offered, not required, to a reader whose passkey carries the key**, and
  required where no passkey does.
- **Each device makes a signing key now, and nothing checks it yet** (“reserve now, enforce
  later”).
- The setup sentence as draft 1 proposed it; the reader types two of the code’s six groups back;
  seven days before a signed-in device that can’t open the notebook may delete or replace it; setup
  suggests a second way in to a reader who has only a passkey; `deletedAt` stays a plain field.
- **BVJ’s side builds the service**, in this repo under `workers/`, with BDR’s side reviewing.

**Decided in writing this draft, and since agreed to by BVJ** (2026-11-23, later the same day);
**each is still for BDR to confirm.** They are listed at the end, under “Still open.” The largest: a device proves to the service that it
holds the key before the service lets it change anything (“The key proof”), and only a synced
passkey holds the key.

**A note on names.** “D5” and “D6” on the 2026-11-23 call worksheet are not `STUDY-DESK.md`’s D5
(the passphrase lock for a shared computer) and D6 (the first-time choice). This file names each in
full when it means one.

## The short version

- **Each notebook has a key, made on the reader’s first device and never sent anywhere in a form LIT
  can open.** Every record is sealed with it (AES-256-GCM) before it leaves a device. The service
  stores sealed records and the few plain fields it needs to sync, nothing more.
- **Each device keeps the key in its own locked storage**, on that device only: the Keychain on
  iPhone and iPad, the Keystore on Android, and the browser’s own storage on a computer. That is
  true under both of the reader’s choices.
- **The reader chooses where else the key can be reached from.** Under **“follows my account,”** a
  passkey can open the notebook: the passkey is synced by Apple, Google, or the reader’s password
  manager, so a new device on that account signs in and opens the notebook in one step. Under
  **“this device only,”** nothing but the reader’s devices and their recovery code can: a new device
  is approved from one that has the key (scan a code, or type sixteen characters), or takes the
  recovery code.
- **A recovery code is the fallback.** It is required where no passkey carries the key and offered
  where one does. It is shown once. A reader who loses every device and has neither a passkey that
  opens the notebook nor the code can’t get the synced notes back, and neither can LIT.
- **Signing in alone never gives a device the key**, and **no device takes a key on the service’s
  word.** Every key a device accepts is checked against something the service never has: the
  approval code, the keys the device already holds, the recovery code, or the passkey’s secret.
- **The service lets a session change the notebook only after the session proves it holds the
  key.** A stolen Apple or Google sign-in can ask to join and can ask to delete, and the second
  waits seven days where every device of the reader’s can cancel it.
- **Removing a device gives the notebook a new key**, so the removed device can’t read anything
  written afterward. Under “follows my account” that holds only if the device no longer has the
  reader’s passkey, and the screen says so.
- **Deleting the account deletes everything the service holds.** Each device keeps its own notebook
  unless the reader erases that too.
- **All three clients run one set of test vectors**, made by the code the website ships, the way
  they run the anchor and merge vectors.

The keys, from the reader’s secrets down to a record:

```
  passkey (its PRF)      recovery code          device key (one per device; never leaves it)
        │ HKDF                 │ HKDF                          │
        ▼                      ▼                               │
   passkey key             code key                            │
        │ opens                │ opens                         │
        ▼                      ▼                               │
   a holder’s private key (one holder for each passkey, one for the code)
                               │                               │
                               └──── each opens its own sealed copy of ────┐
                                                                           ▼
                                        keyring: every notebook key so far
                                                                           │ HKDF
                                                                           ▼
                             record key ── seals ──▶ every record
                             card key ──── seals ──▶ every device’s card and every holder’s card
                             key proof ─── shows the service that a device holds the key
```

## What this protects, and what it doesn’t

**It protects everything the service holds.** A breach of the service or its backups, a legal
demand, a curious person with access to the Cloudflare account (BVJ and BDR included), and
Cloudflare itself see sealed records and the plain fields listed under “What the service holds,”
never what a reader wrote or what they call their devices.

**It stops the service from putting a key of its own into the notebook.** A device accepts a key
only from an approval checked against the code the reader’s two devices share, from a keyring that
holds every key the device already has, or from a holder’s record that only the recovery code or
the passkey’s secret could have sealed (under “The keyring” and “Holders”).

**It stops a stolen sign-in from reading or changing the notebook.** Someone who gets into a
reader’s Apple or Google account, and signs in to LIT with it, gets a session that has not proved
the key. The service gives that session the sealed key material a new device needs in order to ask
to join, and none of the records. It can’t push, change the key, add or remove a way to sign in, or
remove a device (under “The key proof”).

**It protects what a reader writes after removing a lost device**, with the limit under “follows my
account” below. The notebook gets a new key that the removed device’s own key never receives.

**It doesn’t protect:**
- **A device in someone else’s unlocked hands.** Each device keeps its own notebook unsealed, as
  today; the phone’s lock and the computer’s account protect it. Until the reader removes it, it is
  one of the reader’s devices: it reads what is added, and it could approve a device of its own or
  set a passkey of its own to open the notebook. So every device announces a new device and a new
  holder, and removing a device offers to remove what it added. Removing it stops it reading
  anything new, not what it already holds.
- **Under “follows my account,” whoever can use the reader’s passkey.** That is the meaning of the
  choice: the passkey opens the notebook, so the notebook is as safe as the place the passkey is
  kept (iCloud Keychain, Google Password Manager, or a password manager) and the account that syncs
  it. LIT still can’t read anything, since the passkey’s secret never reaches the service. But a
  person who takes over the reader’s Apple or Google account far enough to use its passkeys opens
  the notebook, and **a removed device that still holds the synced passkey is not locked out**: it
  signs in again and the passkey opens the notebook (under “Removing a device, and changing the
  key”). Under “this device only,” a passkey signs the reader in and opens nothing.
- **What the plain fields and the traffic show**: how many records a reader has, roughly how large
  each is (to the nearest 256 bytes), when they change or are deleted, how many devices are signed
  in, when each was added and by which, which provider the reader signs in with, and whether a
  passkey or a recovery code can open the notebook. Cloudflare’s logs see addresses and times, as
  for any website.
- **An older copy, or a deletion withheld.** The service can’t alter a record, but it could hand a
  device an older sealed version of one, or a record without the trash record that deleted it, and
  the device can’t tell. The same goes for the keyring given to **a device joining by recovery code
  or by passkey**: it can check that the keyring is real, by the holder’s anchor, and not that it is
  the newest, since it has nothing of its own to compare. A device that already holds a keyring
  never goes backward (under “The keyring”), and an approval comes from a live device, so neither
  has this gap. A device never deletes a record because its row is missing from the service: a
  deletion arrives only as a trash record, which is sealed like any other.
- **The code itself.** Readers trust that the apps and the website do what this file says. That
  trust weighs most on the website: litbible.net serves its own code, so whoever controls the site
  could change it. The site also says which apps and which other sites may ask for the reader’s
  passkey (its `apple-app-site-association` and `assetlinks.json`, and `/.well-known/webauthn` if it
  ever has one). This holds for every encrypted service on the web, and it is why the website
  enforces its full Content Security Policy before sign-in ships (`STUDY-DESK.md`, “Order of work,”
  step 4i).
- **A service turned against its readers, beyond the checks here.** It could refuse to serve data,
  delete it, or keep a device from learning that the key changed. **A removed device working with
  the service** could do what neither can alone, since it knows every key up to its removal: it
  could make a keyring that a device, or a holder’s anchor older than its removal, accepts. Stopping
  that takes each device signing what it makes. Version 1 has every device make its signing key and
  checks nothing with it yet (under “The signing key”).
- **A stolen sign-in that the reader doesn’t notice for seven days.** A request to delete the
  account or to start a new notebook, made from a session that can’t open the notebook, waits seven
  days, and every device that can open the notebook shows it and can cancel it. If none of the
  reader’s devices reaches the service in that week, it goes through. The reader’s devices keep
  their own notebooks; the synced copy and the account are in the other person’s hands.
- **A lost recovery code, a lost passkey, and every device.** By design: what LIT can’t open, LIT
  can’t give back.
- **A future quantum computer.** The notebook key passes between devices under P-256, which a large
  enough quantum computer could break, so sealed copies kept today could be opened then. A later
  version can add a post-quantum key exchange once all three platforms offer one natively; the
  version fields below leave room for it.

## Building blocks

Every client uses its platform’s own cryptography. Nothing here needs an added library on iOS or
the website; Android may take Tink or write HKDF and HPKE on the platform’s primitives.

| | iOS (CryptoKit) | Android | Website (WebCrypto) |
|---|---|---|---|
| Random bytes | `SecRandomCopyBytes` | `SecureRandom` | `crypto.getRandomValues` |
| SHA-256, HMAC-SHA-256 | `SHA256`, `HMAC<SHA256>` | `MessageDigest`, `Mac` (`HmacSHA256`) | `SHA-256`, `HMAC` |
| HKDF-SHA-256 (RFC 5869) | `HKDF<SHA256>` | a few lines on HMAC, or Tink | `HKDF` |
| AES-256-GCM | `AES.GCM` | `Cipher` (`AES/GCM/NoPadding`) | `AES-GCM` |
| P-256 key agreement | `P256.KeyAgreement` | `KeyPairGenerator` (`EC`), `KeyAgreement` (`ECDH`) | `ECDH` on `P-256` |
| HPKE (RFC 9180) | `HPKE`, suite `.P256_SHA256_AES_GCM_256` (iOS 17 and later; the app targets iOS 26) | on the rows above, or Tink | on the rows above |
| P-256 signing (reserved) | `P256.Signing`, or the Secure Enclave’s | a Keystore `EC` key, `SHA256withECDSA` | `ECDSA` on `P-256` with `SHA-256` |
| A passkey’s secret (the PRF) | AuthenticationServices, the `prf` input on a passkey request | Credential Manager, `prf` in the request JSON | `navigator.credentials`, the `prf` extension |

**Fixed choices:**
- **AES-256-GCM** for every symmetric seal: a 12-byte nonce, and the 16-byte tag appended to the
  ciphertext.
- **HKDF-SHA-256** with a salt of 32 zero bytes (what RFC 5869 uses for an empty salt; written out
  because Android’s `SecretKeySpec` and WebCrypto’s HMAC import refuse an empty key) and an ASCII
  `info` label from the table under “Labels,” unless a step says otherwise. The same goes for the
  empty salts inside a hand-written HPKE.
- **HPKE in base mode** with the suite DHKEM(P-256, HKDF-SHA256), HKDF-SHA256, AES-256-GCM
  (identifiers `0x0010`, `0x0001`, `0x0002`). **Every HPKE seal here is single-shot**: a fresh
  sender key for each seal, one ciphertext from it (sequence number 0, so the nonce is the base
  nonce), `info` the ASCII bytes of the label, and an empty AAD. An HPKE written by hand is checked
  against published vectors before LIT’s own. RFC 9180’s own appendix doesn’t print this suite (its
  P-256 case, A.3, uses AES-128-GCM); the CFRG’s full vector file does, and the reference runs
  both through the same code (under “The test vectors”).
- **P-256 keys** are written as the 65-byte uncompressed point (`04 ‖ x ‖ y`: WebCrypto’s `raw`
  export, CryptoKit’s `x963Representation`), and private keys as the 32-byte big-endian scalar `d`,
  always kept beside its public key, since WebCrypto can import a private key only with both (as a
  JWK with `d`, `x`, and `y`).
- **Every public key a client is given**, and HPKE’s `enc`, is checked to be a valid point on P-256
  before it is used: 65 bytes, the first `04`, `x` and `y` each less than the field’s size, and
  `y² = x³ − 3x + b`. The compressed form is refused. The reference makes the check by hand, before
  any platform call sees the bytes, since platforms differ in what they take.
- **Byte strings in JSON** are base64url without padding (RFC 4648 §5). **A client writes each byte
  string the one way and refuses any other spelling**: padding, `+` or `/`, any other character, a
  length no byte string encodes to, and leftover bits that aren’t zero. Ids and times are the
  strings the record carries, byte for byte.
- **“Lines”**: where a step authenticates several values together (an AAD or an HMAC’s input), it
  joins their UTF-8 bytes with one line feed (`0x0A`) between each and none at the end. No value may
  contain a line feed; a client refuses to seal one that does. Two things follow, and both are in
  the vectors. **An empty last value leaves the line feed before it at the end** (a row’s AAD for a
  record that isn’t trash ends with `0x0A`). **A `kid` among the values is written in decimal
  digits**, with no sign and no leading zero.
- **MACs and the key proof are compared in constant time.**
- **Ids a device makes** (the notebook’s, a device’s, a holder’s) are UUIDs, written in lowercase
  with hyphens. A device makes a random one (version 4), and writes it lowercase (Swift’s
  `uuidString` is uppercase). A check asks only for the form: 8, 4, 4, 4, and 12 lowercase hex
  digits.
- **A check that fails is a refusal with a reason.** The vectors file names each reason with one
  word (its `refusals` list, copied from the reference’s `REFUSALS`), so “refused, and why” means
  the same thing on all three clients. A client need not use the words. It must refuse every case
  marked so, and tell two refusals apart wherever this file treats them differently.

### Labels

| Label | Used as | For |
|---|---|---|
| `lit-notebook/1 record` | HKDF `info` | the record key, from a notebook key |
| `lit-notebook/1 device` | HKDF `info` | the card key, from a notebook key |
| `lit-notebook/1 proof` | HKDF `info` | the key proof, from a notebook key |
| `lit-notebook/1 recovery` | HKDF `info` | the code key, from the recovery code |
| `lit-notebook/1 passkey` | HKDF `info` | the passkey key, from a passkey’s PRF output |
| `lit-notebook/1 prf` | the PRF’s input | what a passkey’s PRF is evaluated at |
| `lit-notebook/1 approve-id` | HKDF `info` | an approval’s id, from the approval code |
| `lit-notebook/1 approve-mac` | HKDF `info` | an approval’s MAC key, from the approval code |
| `lit-notebook/1 keyring` | HPKE `info` | sealing a keyring |
| `lit-row/1` | first line | a record’s AAD |
| `lit-device/1` | first line | a device card’s AAD |
| `lit-holder/1` | first line | a holder record’s AAD |
| `lit-holder-card/1` | first line | a holder card’s AAD |
| `lit-approve/1 request`, `lit-approve/1 grant` | first line | the two approval MACs |

The `/1` is this version. A later version changes the labels, so nothing made under one can be taken
for the other.

## The keys

### The notebook key

32 random bytes, made by the reader’s first device when the account has no key yet. Each notebook
key has a **`kid`**, a whole number: the first is 1, and each new key (under “Removing a device, and
changing the key”) takes the next. An account has one current notebook key at a time.

**Each notebook also has an id**, a UUID made with its first key. It stays for the notebook’s life
and changes only when a reader starts a new notebook in place of one they can’t open (under “When a
reader loses every device”).

Records aren’t sealed with the notebook key directly. Each client derives three keys from it, so
each use has a key of its own and a later use (sheet links, say) can take another label:
- the **record key**, `HKDF(notebook key, info "lit-notebook/1 record", 32 bytes)`;
- the **card key**, `HKDF(notebook key, info "lit-notebook/1 device", 32 bytes)`;
- the **key proof**, `HKDF(notebook key, info "lit-notebook/1 proof", 32 bytes)`.

**One key for every record, with a random nonce, is safe here.** AES-GCM with random 12-byte nonces
stays within its safety margin for about four billion (2³²) seals under one key. A busy notebook
makes far fewer: a bookmark that follows the reader writes every few seconds while they read, a few
hundred thousand seals in a year of daily reading, and every new key starts the count again.

### The key proof

**New in draft 2, and for BDR to confirm.** Draft 1 left what the service checks to the service’s
own spec. Written out, two of its requests had nothing to check: a device joining by recovery code
told the service it had joined, and a change of key was accepted from any signed-in session. So a
stolen sign-in could have listed itself as a device, skipped the seven-day wait, or replaced every
device’s sealed keyring with rubbish. The service can’t check a key it must never hold, so it
checks this instead:

- **The key proof is 32 bytes that only a holder of the notebook key can make**, derived as above.
  It opens nothing: HKDF gives no way from it back to the notebook key or across to the record key
  or the card key.
- **The service stores `SHA-256(key proof)` for the current `kid`**, set by the device that makes
  the key, at setup and at each change of key.
- **A session proves the key by sending the proof once.** The service hashes it, compares, and marks
  the session **open** for that `kid`. Every request that reads or changes the notebook needs an
  open session (under “The service’s interface”). After a change of key, every session but the one
  that made the change has to fetch its new keyring, check it, and prove again.
- **It proves a key to the service, and nothing to a device.** No device ever takes the service’s
  word that a session is open as a reason to trust a key, a card, or a keyring.
- **What it costs if it leaks.** The service sees the proof when it is sent, and stores only its
  hash. Someone who had both a proof and a stolen sign-in could open a session: they could then pull
  sealed rows they can’t read and make the changes the proof gates, which is where draft 1 stood
  for any stolen sign-in. They still read nothing.

### The keyring

What a device holds, and what is sealed for each device and each holder, is the **keyring**: JSON,
in UTF-8.

```json
{
  "lit": "keyring",
  "v": 1,
  "notebook": "<the notebook's id>",
  "current": 2,
  "keys": [
    { "kid": 2, "key": "<32 bytes, base64url>" },
    { "kid": 1, "key": "<32 bytes, base64url>" }
  ]
}
```

- **`keys` holds every key the notebook has had**, and **`current`** names the one every new seal
  uses. Old keys stay for good: they are 32 bytes each, a notebook changes its key rarely, and they
  are what lets a device check a new keyring (below).
- **A client refuses a keyring** whose `lit` or `v` it doesn’t know, whose `kid`s aren’t exactly the
  whole numbers from 1 to `current`, each once, or whose keys aren’t 32 bytes. These are **the
  keyring’s own checks**, made on every keyring a client opens, however it came. They also refuse
  bytes that aren’t a UTF-8 JSON object and a `notebook` that isn’t text.
- **The order of `keys` means nothing**: a client finds a key by its `kid`. The reference writes
  the newest first, as above.
- **A field this version doesn’t know is ignored**, and isn’t carried into a keyring the client
  makes. A later version that adds one changes `v`, which every version 1 client refuses.
- Draft 1’s keyring also named the recovery public key. Holders have cards now, as devices do
  (under “Holders”), so the keyring holds keys and nothing else.

**A keyring a device takes from the service must prove itself.** HPKE keeps a keyring secret but
doesn’t say who sealed it, and anyone with a device’s public key can seal one to it. So, outside an
approval (which the code checks) and a holder (which its anchor checks), a device accepts a keyring
only if:
1. its `notebook` is the device’s notebook;
2. it holds every key the device already holds, each `kid` with the same bytes;
3. its `current` is no lower than the highest the device has accepted for that notebook.

The service has never held a notebook key, so it can’t make a keyring that passes the second check,
or hand a device an old keyring after a change of key. A keyring that fails is reported and never
used. A device keeps the highest `current` it has accepted beside its keys, for the third check.

**All three must pass; where more than one fails, the vectors name the first of 1, 3, 2.** A
keyring that goes backward also lacks the device’s newer keys, and “it went backward” is the truer
report. And since a keyring’s own checks make its `kid`s run from 1 to `current`, one that drops a
key the device holds is either malformed or lower: the second check is left to catch other bytes
under a `kid` the device holds.

### Device keys and device cards

**A device’s id is a UUID the device makes**, with its keys, the first time it signs in to an
account. It keeps the id for as long as it keeps the keys, across sessions.

Each device makes two P-256 key pairs then, for that account: its **device key**, for key agreement,
and its **signing key** (below). Neither private key ever leaves the device (under “Where each
client keeps its keys”). Every keyring sealed for the device is sealed to the device key’s public
half.

**A device card says which public keys are which device’s**, in a form only a holder of the notebook
key can make and LIT can’t read:

```
card = AES-256-GCM(card key of the current notebook key, nonce: 12 random bytes,
                   aad: lines "lit-device/1", notebook id, kid, device id,
                   plaintext: JSON {"public", "sign", "name", "platform", "added"})
```

- **`public`** is the device key’s public half and **`sign`** the signing key’s, each 65 bytes in
  base64url. **`added`** is the time the card was first written, in the format’s form (UTC, with
  `Z`).
- **`platform`** is `ios`, `android`, or `web`, the same word a device gives in an approval’s
  request. Nothing checks it: a client that meets another word shows the card all the same.
- **A sealed card is two things: its 12-byte nonce, and its ciphertext with the tag.** The
  plaintext is the card’s JSON in UTF-8, as the client writes it, and **isn’t padded** (records
  are). How the two are spelled in a request is the interface’s, settled in step 4c.
- **A client that opens a card checks that `public` is a point** (under “Fixed choices”) and
  refuses the card otherwise. It doesn’t check `sign`, which nothing uses in version 1 (under “The
  signing key”).
- **The approving device writes the new device’s card** in its grant (under “By approval”). A first
  device, and a device that joined through a holder, write their own. Whoever changes the key seals
  every card again under the new one.
- **Sealing a card again keeps every field in it**, the ones this version doesn’t know included, so
  a later version can add to a card and an older client won’t drop what it added. **The simplest
  way, and the reference’s, is to seal the opened bytes again as they are**; the `card` vectors’
  resealed ciphertext is those bytes’. A client that renames a device parses the card, changes
  `name`, and writes every other field back.
- **The name is what the reader calls the device.** Since LIT can’t read a card, it can be personal;
  it starts as the model (“iPhone,” “Pixel 8,” “Firefox on Windows”), and the reader can rename a
  device on the device itself, which seals its card again.
- **A client seals a keyring only to the public key in a card that opens under the current key and
  names that device’s id**, or, during an approval, to the key the request’s MAC vouches for. The
  service can’t make a card or move one to another device’s entry (the id is in the AAD), so a key
  it slipped into the device list gets nothing.
- **Beside each card the service records**, in plain, when the device was added and how (by setup,
  by which device’s approval, by recovery code, or by passkey), and when it was last seen. Devices
  show these beside the card’s name.

### The signing key

**Reserve now, enforce later** (BVJ, 2026-11-23; **for BDR to confirm**). Version 1 leaves one
attack open on purpose: a removed device working with the service could forge what a key holder
makes. Closing it means each device signs the devices it adds and the keyrings it makes. That is
more than the launch needs, but it needs every device to have a signing key that the others already
know. So:

- **Every device makes a signing key when it makes its device key**: P-256, for ECDSA with SHA-256.
  It is a separate key pair from the device key, which is for key agreement only.
- **The curve is P-256** because all three platforms can keep such a key where page or app code
  can’t read it out: the Secure Enclave on iOS, the Android Keystore (which signs with EC keys on
  every version the app supports, where its key agreement needs API 31), and a non-extractable
  `CryptoKey` on the website. Ed25519 can’t be kept in the Secure Enclave, and the Android Keystore
  has it only on recent versions. It is also the curve everything else here already uses.
- **The card carries the public half as `sign`**: the 65-byte uncompressed point, base64url, beside
  `public`. An approval’s request carries it too, under the request’s MAC, since the approving
  device writes the new device’s card.
- **Nothing checks it in version 1.** No client signs anything with it, and no client refuses a
  card, a keyring, or a device for want of a signature. A client does refuse to *write* a card
  without a valid point in `sign`.
- **What a later version adds**, in a `/2` of the labels it touches: what is signed, by whom, and
  the roster each device keeps. Signatures will be the 64 bytes `r ‖ s` (WebCrypto’s output and
  CryptoKit’s `rawRepresentation`; Android’s `Signature` gives DER, to convert). Because every card
  already carries a signing key that a key holder wrote, turning signatures on won’t ask readers to
  enroll their devices again.
- **The vectors hold the key’s shape now**, so the day signatures turn on finds three clients that
  already agree (`signingKey`): a signature is verified over the message with SHA-256, and a client
  that converts between `r ‖ s` and DER by hand reads only strict DER (short lengths, no padding
  that isn’t needed, nothing after the end). Nothing in version 1 depends on them.

### Holders

**A holder is a way back into the notebook that isn’t a device.** It is a P-256 key pair, made at
random, whose private half the service keeps sealed under a secret that only the reader has. There
are two kinds: **the recovery code’s** (at most one) and **a passkey’s** (one for each passkey that
opens the notebook). A holder is treated as a device is: every keyring is also sealed to each
holder’s public key, so the secret opens the private key and the private key opens the keyring.

**Why a key pair, and not a key made straight from the secret:** a device can seal a new keyring to
a holder’s public key without knowing the code or having the passkey at hand, so changing the key
never means a new code or a passkey prompt; and a stolen device holds only public halves.

Each holder has an **id** (a UUID made with it) and three things on the service.

**1. The holder record** holds the private key, sealed under the holder’s secret:

```json
{
  "lit": "holder",
  "v": 1,
  "notebook": "<the notebook's id>",
  "kind": "passkey",
  "id": "<the holder's id>",
  "credential": "<a passkey holder only: the passkey's credential id, base64url>",
  "d": "<the holder's private key: 32 bytes, base64url>",
  "public": "<the holder's public key: 65 bytes, base64url>",
  "anchor": { "kid": 2, "key": "<the notebook key current when the holder was made>" }
}
```

sealed as:

```
holder record = AES-256-GCM(the code key or the passkey key, nonce: 12 random bytes,
                            aad: lines "lit-holder/1", kind, holder id,
                            plaintext: that JSON)
```

`kind` is `recovery` or `passkey`, and a recovery holder’s record has no `credential`. Like a card,
a sealed holder record is its 12-byte nonce and its ciphertext with the tag, and its plaintext
isn’t padded. `public` is `d`’s own public key: a client refuses to write a record where either
isn’t a valid key.

**2. The holder card** tells the other devices the holder’s public key, as a device card does:

```
holder card = AES-256-GCM(card key of the current notebook key, nonce: 12 random bytes,
                          aad: lines "lit-holder-card/1", notebook id, kid, holder id,
                          plaintext: JSON {"public", "kind", "credential", "name", "added"})
```

`credential` is there for a passkey holder only. `name` starts as “Recovery code” or as what the
platform calls the passkey’s home (“iCloud Keychain,” “Google Password Manager”), or “Passkey.” The
rules for device cards hold: whoever changes the key seals every kept holder’s card again and keeps
every field, and a client seals a keyring only to the public key in a holder card that opens under
the current key and names that holder’s id. It is sealed the same way too: a nonce and a
ciphertext, unpadded, with `public` checked to be a point when it is opened. The two labels keep
the two kinds apart, so a holder’s card never opens as a device’s, or a device’s as a holder’s.

**3. A keyring sealed to the holder’s public key**, with HPKE, as for a device.

**The anchor is what makes that keyring trustworthy.** A holder’s public key isn’t secret to
everyone (every key holder can read its card), and anyone who knows it could seal a keyring to it.
But only someone who had the secret could have sealed the anchor, and a real keyring holds the
anchor’s key, since keyrings keep every key. So a device that comes in through a holder checks, in
this order, and stops at the first failure:

1. **The record opens** under the key made from the secret, with the AAD made from the kind and id
   the service gave. A failure means the code is wrong, or this passkey doesn’t open this notebook.
2. **The record is what it should be**: `lit`, `v`, `kind`, and `id` as expected; `notebook` the
   account’s notebook; for a passkey, `credential` the id of the passkey that just answered,
   compared as bytes. Its keys have their shapes too: `d` a private scalar (32 bytes, 1 or more,
   and less than the curve’s order), `public` a point, and the anchor a `kid` of 1 or more with a
   32-byte key.
3. **The keyring sealed to the holder opens** with `d`, and passes the keyring’s own checks.
4. **The keyring names the record’s notebook and holds the anchor’s key**, with the same `kid` and
   the same bytes.

Then it keeps the keyring and joins (under “Adding a device”). What the anchor can’t show is that
the keyring is the newest, which is the gap described under “An older copy,” above.

**A client can say which check stopped it**, since the first means something a reader can act on
(a wrong code) and the others don’t. The vectors give the number of the check with each refusal.

**One thing no vector tests: a record whose `public` isn’t `d`’s own public key.** Only a device
that had the secret can have written it, so it is a client’s bug and never an attack, and platforms
notice at different moments: WebCrypto when it takes the key or when the keyring doesn’t open
(HPKE binds the recipient’s public key), CryptoKit not at all, since it works the public key out
from `d`.

#### The recovery code

**The recovery code** is 15 random bytes (120 bits), written as 24 characters of Crockford’s base32,
`0123456789ABCDEFGHJKMNPQRSTVWXYZ`, five bits to a character, most significant first, and shown in
six groups of four:

```
7KQ2-9XMB-4TRE-HN3A-W8CD-5FGJ
```

(That one is made up.) Reading a code back, a client removes white space, hyphens, and dashes, takes
lowercase as uppercase, reads `O` as `0` and `I` or `L` as `1`, and refuses any other character
(`U` included) or a length other than 24.

**A pasted code is forgiven what a paste brings, and every client forgives the same things** (BVJ,
2026-11-23, changing the strict reading BVJ kept earlier that day; “Still open,” 23, for BDR to
confirm). A reader uses this code after losing their devices, and a code that is right in every
character must not be refused for a line break copied with it or a dash a notes app swapped in.
Removing these costs nothing: the code’s strength is its 120 random bits, and no wrong code passes
because of it. **The list below is the rule.** A client removes exactly these characters, wherever
they are in what was typed, and no others, so it does not use its platform’s own idea of white
space (JavaScript’s `\s`, Swift’s `isWhitespace`, and Kotlin’s `isWhitespace` each differ from it):

| Removed | Code points |
|---|---|
| White space (Unicode’s `White_Space`) | U+0009 to U+000D, U+0020, U+0085, U+00A0, U+1680, U+2000 to U+200A, U+2028, U+2029, U+202F, U+205F, U+3000 |
| Invisible characters a paste can carry | U+00AD (soft hyphen), U+200B to U+200D (zero width space, non-joiner, joiner), U+2060 (word joiner), U+FEFF (byte order mark) |
| The hyphen and the dashes put in its place | U+002D, U+2010 to U+2015, U+2212 (minus sign), U+FE58, U+FE63, U+FF0D |

Everything else that isn’t one of the 32 characters, or a letter read as one, is still “any other
character,” and refused: an underscore, a full stop, a fullwidth digit, and a letter from another
alphabet that looks like one of these. Lowercase means `a` to `z`. Characters are checked before
the length, so a code with both faults is reported as a wrong character, and one that is nothing
but removed characters is reported as a wrong length. **The two groups a reader types back** (under
“Setting up the first device”) are read by the same rules, each as four characters, and so is an
approval code.

**The code key** is `HKDF(the 15 bytes, info "lit-notebook/1 recovery", 32 bytes)`. No slow password
hash is needed: the code is 120 random bits, not something a person chose, so guessing it is out of
reach however fast the guesser.

**The code is shown once**, with the sentence under “Setting up the first device,” and the reader
types two of its six groups back. Until they have, the device keeps the code in its secure storage,
so a setup cut short shows the same code again; once confirmed, the device forgets it.

#### The passkey

**For BDR to confirm**, as the largest change from draft 1.

A passkey can hand the app or the page a secret when the reader uses it: the WebAuthn **PRF**
extension (`prf`), which gives 32 bytes that depend on the passkey and on an input the caller
chooses. The same passkey gives the same 32 bytes on every device it syncs to, and nothing but the
passkey can make them.

- **The input is fixed**: the 18 ASCII bytes of `lit-notebook/1 prf`, given as the extension’s
  first value (`eval.first`). The platform hashes it as the standard says before the passkey sees
  it: SHA-256 of the ASCII bytes of `WebAuthn PRF`, one zero byte, and the input. A client never
  does that itself; the `prf` vectors give the hashed form for one that has to check what its
  platform sent. The second value is not used. **A client never takes a PRF input from the
  service.**
- **Why fixed, and not a random input kept on the service**: with a fixed input, the ceremony that
  signs a reader in can ask for the secret at the same time, before the service knows who they are,
  so a new device takes one prompt and not two. A random input would be known to the service
  anyway, so it would add nothing against the service, and nothing against a person who can already
  use the passkey.
- **User verification is always required** (`userVerification: "required"`) on every passkey
  request LIT makes. The standard ties the secret to it, and an Apple engineer notes that the bytes
  match from one place to another only when it is done the same way in both.
- **The passkey key** is `HKDF(the 32 bytes, info "lit-notebook/1 passkey", 32 bytes)`. The PRF’s
  output is never used as a key directly.
- **The PRF’s output and the passkey key live in memory only**, for as long as it takes to seal or
  open a holder record, and are never stored, logged, or sent. A client that signs in with a
  passkey asks for the PRF in that same ceremony and drops the output as soon as it knows there is
  nothing for it to open.
- **A client never sends the PRF’s results to the service.** The standard warns that a passkey
  response turned into JSON carries them (`clientExtensionResults.prf.results`), and Android’s
  Credential Manager hands the app that JSON. A client removes `results` before any response leaves
  the device, and the service refuses a response that still has them, so a client that forgets
  fails in testing and not in a reader’s hands. **That one member is all it removes**: `prf` itself
  and `prf.enabled` stay, and so does every other extension’s result, so the response is otherwise
  the one the platform made.
- **Only a synced passkey with a working PRF holds the key.** A client makes a passkey a holder
  only when the passkey reported `prf.enabled` at creation or returned results since, and its
  backup-eligible flag is set (it is the kind that syncs). A passkey that stays on one computer or
  one security key signs the reader in and holds nothing: on that device the device’s own key
  already does the job, and calling it “follows my account” would be untrue. A security key as a
  holder could be added later without changing anything here.
- **Which platforms can do this, and where they can’t**, is under “Where a passkey can carry a key.”
  The rule that follows from it: **a client finds out by asking, and never assumes.**

**A passkey that fails to open the notebook is never an error that loses anything.** If the PRF
returns nothing, or returns bytes that don’t open the holder record, the device is signed in and
can’t open the notebook, and it offers the other ways in (approval, or the recovery code). It never
deletes or replaces a holder because of it.

**A free check, each time.** A device that already holds the keyring and signs in with a holder’s
passkey gets the PRF’s output anyway. It tries the holder record with it, and if the record doesn’t
open, it tells the reader that this passkey couldn’t open the notebook here and that they should
keep another way back. That catches a platform whose passkey gives different bytes in different
places before the day it matters.

## Where the key lives: the reader’s choice

**The reader chooses, at setup and later** (BVJ, 2026-11-23; **for BDR to confirm**). The choice is
separate from how the reader signs in, and it is made on every platform, not on Apple’s alone.

| | “Follows my account” (shown first, recommended) | “This device only” |
|---|---|---|
| What can open the notebook | Each device that has joined, a passkey, and the recovery code if the reader took one | Each device that has joined, and the recovery code |
| A new device | Signs in and uses the passkey. No approval | Approved from a device that has the key, or takes the recovery code |
| Every device lost | The passkey, on a new device signed in to the same Apple or Google account (or password manager) | The recovery code |
| The recovery code | Made at setup, for the reader to keep or not (BVJ, 2026-11-24; it was “offered, not required”) | Required |
| A removed device | Locked out only once it no longer has the passkey | Locked out |
| A person who gets into the reader’s Apple or Google account | Opens the notebook, if they get as far as its passkeys | Gets a session that can’t open it |

- **Under both, the device’s own key stays on the device.** There is no LIT key in iCloud Keychain,
  in a backup, or anywhere a platform copies from one device to another. What syncs under “follows
  my account” is the reader’s passkey, by whoever keeps their passkeys.
- **The choice is whether the notebook has a passkey holder.** It isn’t a switch the service
  stores: each device reads it from the holder cards that open under the current key, so the
  service can’t turn it on. (The service could hide a holder’s card from a device, which takes
  access away from that holder at the next change of key and never gives any.)
- **A reader who signs in with Apple or Google adds a passkey for “follows my account.”** The
  passkey is also a way to sign in from then on.
- **Turning “follows my account” on later**, from any device that has the key: the device makes or
  uses a passkey, and makes it a holder (under “Holders”). The key doesn’t change.
- **Turning it off**, which is switching to “this device only”: the notebook gets a new key, and no
  passkey holder gets it (under “Removing a device, and changing the key”). If the reader has no
  recovery code, one is made in the same step, since it is required now. Their passkeys still sign
  them in.
- **While it is on, a passkey the reader adds as a way to sign in becomes a holder too**, if it can
  be one, and the device says which of the reader’s passkeys open the notebook and which only sign
  in.
- **A device that can’t use a passkey this way** (under “Where a passkey can carry a key”) still
  shows the choice, says that this device can’t keep such a passkey, and lets the reader turn it on
  later from a device that can. Until a passkey holder exists the notebook is “this device only,”
  and the recovery code is required.
- **Every device announces a new holder**, as it does a new device: “A passkey can now open your
  notebook. Set up from [device] on [date].”
- **Every setup makes a recovery code, under both choices** (BVJ, 2026-11-24, on seeing the
  website’s setup screen drawn with a box to tick: “Let’s go ahead and give Google/Apple users a
  recovery key. They can just choose not to use it if they want. No need to offer the choice as a
  checkbox.” **For BDR to confirm**, “Still open,” 85). It replaces “offered, not required” under
  “follows my account”: the reader is no longer asked whether they want one. Nothing in the
  service or the reference changes, since a notebook with a passkey holder and no recovery
  holder is still one the interface allows, and one set up before this may be such a notebook.

## Where a passkey can carry a key (checked 2026-11-23)

Checked against each platform’s own documentation, as the plan’s step 4a asks. Vendor blogs and
forums are named as such where nothing better exists. **What a row can’t confirm, the design does
not rely on.**

| Where | What the source says | Source |
|---|---|---|
| The standard | `prf` is part of WebAuthn Level 3, a W3C Recommendation since 2026-08-25. Outputs are 32 bytes. Inputs are hashed with a fixed prefix before the passkey sees them. Only the user-verified PRF is used. Outputs “may, or may not, be provided” at creation; if not, “an assertion is needed.” For keys used only on the device, “it may be necessary to omit this `results` output” from a response sent to a server | [W3C, §10.1.4](https://www.w3.org/TR/webauthn-3/#prf-extension) |
| iPhone, iPad, and Mac apps | The PRF types for passkey requests are in AuthenticationServices from **iOS 18.0, iPadOS 18.0, macOS 15.0, and visionOS 2.0**. The iOS app targets iOS 26 | [Apple: assertion input](https://developer.apple.com/documentation/authenticationservices/asauthorizationpublickeycredentialprfassertioninput-swift.struct), [registration input](https://developer.apple.com/documentation/authenticationservices/asauthorizationpublickeycredentialprfregistrationinput-swift.struct) |
| Safari | “Added support for the WebAuthn PRF extension” in Safari 18. Safari 18 also runs on macOS 14 and 13; the notes don’t say whether a passkey in iCloud Keychain returns a secret there, and the system types above need macOS 15, so don’t count on it | [Safari 18 release notes](https://developer.apple.com/documentation/safari-release-notes/safari-18-release-notes) |
| Password managers on Apple devices | A password manager’s extension is handed the PRF input from iOS 18.0 and macOS 15.0. Whether it answers is up to the manager | [Apple: `ASPasskeyAssertionCredentialExtensionInput`](https://developer.apple.com/documentation/authenticationservices/aspasskeyassertioncredentialextensioninput-swift.struct) |
| Android apps | **Google’s pages say almost nothing.** The one mention found: Jetpack `credentials` 1.3.0-alpha04 (2024-05-14), “Support PRF creation for Android versions 13 and below.” The guides to creating and using passkeys and the page of supported environments don’t mention PRF. Passkeys need Android 9 (API 28); the app supports API 26, so **Android 8.0 and 8.1 have no passkeys at all** | [Jetpack release notes](https://developer.android.com/jetpack/androidx/releases/credentials), [supported environments](https://developers.google.com/identity/passkeys/supported-environments) |
| Password managers on Android | Android 14 and later let the reader pick another passkey provider, and the provider receives the request’s JSON, which is where `prf` is asked for. The page says nothing about extensions, and whether a manager answers is up to the manager | [Android: credential providers](https://developer.android.com/identity/sign-in/credential-provider) |
| Chrome and Edge | `prf` since Chrome 116. Chrome’s notice of shipping it lists the risks: “Support on Windows depends on having a recent version of Windows. Not every security key supports the underlying hmac_secret functionality. Some passkey providers on Android 14 may not support it.” The same notice says it is supported on all of Chrome’s platforms, Android included. **No Google page read says in so many words that a passkey in Google Password Manager returns a secret**, on Android or on a computer, and none of Chrome’s release notes read (132, 133, 135, 140, 145, 147) mentions PRF | [MDN’s data](https://github.com/mdn/browser-compat-data/blob/main/api/CredentialsContainer.json), [Intent to Ship](https://groups.google.com/a/chromium.org/g/blink-dev/c/iTNOgLwD2bI), [chromestatus](https://chromestatus.com/feature/5138422207348736) |
| Windows Hello | **Not confirmed by Microsoft.** Its WebAuthn header has the fields (`bEnablePrf`, `pPRFGlobalEval`), and neither it, nor the notes for the February 10, 2026 update (KB5077181), nor Microsoft’s passkeys page says Windows Hello answers them. A report on Bitwarden’s tracker, which is a third party’s, says it does from builds 26100.7840 and 26200.7840 (that update) in Chrome 147 and later; its author still saw failures in June 2026 and closed it as working in September 2026. A Windows Hello passkey stays on its computer either way, so it is never a holder here | [webauthn.h](https://github.com/microsoft/webauthn/blob/master/webauthn.h), [KB5077181](https://support.microsoft.com/help/5077181), [Microsoft: passkeys](https://learn.microsoft.com/en-us/windows/security/identity-protection/passkeys/), [the report](https://github.com/bitwarden/clients/issues/19858) |
| Firefox | On a computer: 135 without macOS, and “supported on all desktop platforms” from 139. On Android: 149 | [MDN’s data](https://github.com/mdn/browser-compat-data/blob/main/api/CredentialsContainer.json), [Firefox 139](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/139), [bug 1958716](https://bugzilla.mozilla.org/show_bug.cgi?id=1958716) |
| Signing in by scanning a code from another device | The protocol carries the PRF, in a form of its own; Android phones handle it. **Apple’s has been unreliable**: an Apple engineer wrote in February 2025 that the bytes returned this way differed from those returned on the phone itself, “a bug” that “should be fixed in the current iOS 18.4 and macOS 15.4 betas,” and a developer reported the same fault in April 2026 on iOS 26.3.1 with Chrome on Windows, unanswered | [A Tour of WebAuthn](https://www.imperialviolet.org/tourofwebauthn/tourofwebauthn.html) (the same Chrome engineer’s own book, not Google’s documentation), [Apple forum 764730](https://developer.apple.com/forums/thread/764730), [774112](https://developer.apple.com/forums/thread/774112) |
| 1Password, Bitwarden, and others | Not verified. Each has written that it supports PRF for passkeys it stores, and each one’s forum has reports both ways | (vendor posts and forums only) |
| Security keys | They answer through an older extension (`hmac-secret`) and can’t return a secret at creation. Apple’s system API for security keys shows no PRF input on the page read. Not used as holders here | [W3C, §10.1.4](https://www.w3.org/TR/webauthn-3/#prf-extension), [A Tour of WebAuthn](https://www.imperialviolet.org/tourofwebauthn/tourofwebauthn.html), [Apple](https://developer.apple.com/documentation/authenticationservices/asauthorizationsecuritykeypublickeycredentialprovider) |

**What the design does about the gaps:**

1. **A client asks, and never assumes.** It requests `prf` when it creates a passkey and each time
   it uses one, and treats the passkey as able to hold the key only on what comes back
   (`prf.enabled`, or 32 bytes of results). There is no list of platforms in any client.
2. **Where creation returns no secret, one use right after does**: the client asks the reader for
   the passkey once more and takes the PRF from that.
3. **The recovery code is required wherever no passkey holder results**: Android 8, a password
   manager that doesn’t answer, a browser without the extension, a Windows Hello or security-key
   passkey.
4. **A device that can’t get the secret still joins**, by approval or by the recovery code. That
   covers scanning a code with an iPhone to sign in on a computer, when the bytes come back wrong:
   the phone is in the reader’s hand, and it approves the computer.
5. **Wrong bytes are found early** by the free check under “The passkey.”
6. **Nothing here is tested on a real device yet.** The step that matters most before the freeze is
   under “Still open”: one passkey, used from the website and from each app, must give the same 32
   bytes everywhere.

## What the service holds

| What | Kept as | Can LIT read it? |
|---|---|---|
| The account: the notebook’s id, each sign-in method’s account id from Apple or Google (`sub`), each passkey’s public key, id, signature counter, and flags (whether it syncs), when each was made, and a random handle that the account’s passkeys are made under | plain | Yes. No email address and no name is kept, even when a provider sends one |
| Apple’s refresh token, for an account that signs in with Apple, one for each client (the app, the website) the reader signed in through, kept so removing that way in or deleting the account can revoke it | plain to LIT, encrypted at rest | Yes. It opens nothing in the notebook |
| Sessions: for each, which way in it came through, when, and whether it has proved the current key | plain | Yes |
| A sign-in challenge, for at most five minutes | plain | Yes. It is 32 random bytes; it names no one, but the account a passkey is being added to |
| The account’s current `kid`, the hash of that key’s proof, and a version of the lists below that every change to them moves | plain | Yes. The hash opens nothing |
| The device list: for each device its id, its card and the `kid` the card was sealed under, when it was added and how, when it was last seen | the card sealed, the rest plain | Only the dates and how each was added. Names and public keys are inside the cards |
| The holder list: for each holder its id, its kind, a passkey holder’s credential id, its record, its card, when it was added and from which device | the record and the card sealed, the rest plain | Only that a recovery code or a given passkey can open the notebook |
| A sealed keyring for each device and each holder | HPKE | No |
| Records (under “A record on the service”) | sealed, beside a few plain fields | Only the plain fields |
| An approval in progress, for at most ten minutes | MACs and HPKE | The new device’s model and platform, nothing else |
| A request to replace the notebook or delete the account, while it waits (under “Deleting the account”): which of the two, when it was made and falls due, the kind of device in the device’s own word, the kind of way in it came through, and the hash of the session that asked | plain | Yes |
| When the account’s notebook was last replaced, and the same two words about the request that asked | plain | Yes |

**It never holds** a note, highlight, bookmark, or any other record unsealed, a notebook key, a
recovery code, a passkey’s secret, a device’s private key, a password, an email address, reading
history, display settings, or analytics. **Nor the address a request came from**: it is counted by
Cloudflare’s limiter for a minute (under “How often a client may ask”), and stored and logged by
the service nowhere. **Nor anything of a deleted account**, not even that there was one.

## A record on the service

One row per record, as the format sketches it (“How each store holds the records”):

```json
{
  "v": 1,
  "id": "<the record's id, exactly as the record writes it>",
  "rev": 4182,
  "modified": "2026-11-23T18:35:09.978Z",
  "deletedAt": "2026-11-23T18:35:09.979Z",
  "kid": 2,
  "nonce": "<12 bytes, base64url>",
  "ct": "<the ciphertext and tag, base64url>"
}
```

- **`id`, `modified`, and, on a trash record only, `deletedAt`** are copied byte for byte from the
  record. They are the agreed plain fields, and the seal covers them. `deletedAt` stays among them
  (BVJ, 2026-11-23).
- **A trash record is a record whose `kind` is `trash`** (the format’s kind 10). The row of any
  other record has no `deletedAt` at all: the example above is a trash record’s. A client that
  reads a row takes a missing `deletedAt` and a `null` one alike, as “none.”
- **`nonce` and `ct`** are base64url, and `ct` ends with the 16-byte tag.
- **`rev`** is the service’s own revision, the cursor for “what changed since.” The service sets it
  after the record is sealed, so it is the one plain field the seal doesn’t cover.
- **`v` and `kid`** say how to open the row; the seal covers both (`v` as its label, `lit-row/1`).
- **The service needs none of them to merge**, since merging happens on devices. It uses `rev` to
  sync and `kid` to refuse a record sealed under an old key.
- **The service applies no rule to the two times beyond their form.** It can’t clamp a time the
  seal covers, and refusing a record from a clock running ahead would strand it on its device. The
  format’s cap (“Clocks”) is applied by each device that receives the record, against its own
  clock, as it is for a file. The service sends its own time with every answer, so a device can
  notice that its clock is far off.

### Sealing

1. **Serialize** the record as the format writes it (JSON, in UTF-8). It must be no more than
   `MAX_RECORD_BYTES` (1,048,576 bytes), the format’s ceiling for any record; a client refuses to
   seal a larger one. Each client’s JSON writer orders keys and spaces its own way, and that is
   fine: what is sealed is that client’s bytes, and what every client reads back is the record.
2. **Pad** it with spaces (`0x20`) to the next multiple of 256 bytes (a length already a multiple of
   256 takes none), so the stored size says only roughly how much was written.
3. **Make the AAD**: lines `lit-row/1`, the `kid` in decimal, `id`, `modified`, and `deletedAt` (an
   empty line on a record that isn’t trash, so that AAD ends with a line feed).
4. **Seal** with AES-256-GCM under the record key of the current notebook key, with a fresh random
   12-byte nonce.

The largest ciphertext is therefore 1,048,592 bytes, and the service refuses anything larger, or
any whose length isn’t a multiple of 256 plus the 16-byte tag. The smallest is 272.

### Opening

1. **If the client doesn’t know `v`, or doesn’t hold `kid`,** it keeps the row aside and fetches its
   keyring (the key may just have changed). It never deletes or overwrites anything because of it.
2. **Open** with AES-256-GCM under that `kid`’s record key and the AAD made from the row’s plain
   fields. A failure means the row was damaged or altered: skip it, keep the device’s own copy, and
   report it.
3. **Remove trailing spaces and parse.** The record’s `id` and `modified` (and a trash record’s
   `deletedAt`) must equal the plain fields, the times compared as instants; otherwise skip it as in
   step 2.
4. **Then the format’s own checks**, as for any record that arrives (`validateRecord` on the
   website).

**The steps above, as exactly as the vectors need them.** There are two outcomes short of
success, and a client must tell them apart: **aside** (step 1: keep the row, fetch the keyring, try
again) and **skip and report** (everything else). Neither ever deletes anything. The checks run in
this order, and a row is refused at the first that fails:

1. `v` is 1. Otherwise: aside.
2. The device holds `kid`. Otherwise: aside. (A `kid` that isn’t a whole number of 1 or more is a
   row no client wrote: skip and report.)
3. The row’s own fields are what a row carries: `id` and `modified` text, `deletedAt` text or
   none, `nonce` 12 bytes, `ct` base64url.
4. **The ciphertext’s length is a padded record’s**: without its 16-byte tag, a multiple of 256
   bytes, at least 256 and at most `MAX_RECORD_BYTES`. The service makes this check too; a client
   makes it for itself and doesn’t open a row that fails it, even one whose seal would hold.
5. The seal opens.
6. The opened bytes, with the spaces at their end removed, are well-formed UTF-8 and a JSON object.
7. The record agrees with the plain fields: the same `id`, byte for byte; the same `modified`; and
   for a trash record the same `deletedAt`, while any other record’s row has none. A row that
   carries a `deletedAt` for a record that isn’t trash is refused, and so is a trash record’s row
   without one.

**“The same time” is the same instant, by this rule:** the two strings are the same bytes; or both
are in the format’s form (`YYYY-MM-DDTHH:MM:SS`, an optional fraction of any length, and `Z`), they
are alike through the seconds, and their fractions are alike once trailing zeros are dropped. So
`…09.5Z` and `…09.500Z` are the same instant, and `…09Z` and `…09.0Z`. Fractions are compared in
full, so no client’s clock decides it, and a time that isn’t in the format’s form is the same only
as itself. The seal already holds the row’s times to the byte (they are in the AAD), so this rule
only ever decides a row whose sealing client wrote one time two ways, once inside the record and
once in the row.

**Deletions under encryption.** A deleted record’s row leaves the service when the record is
deleted: its copy lives on in the trash record for 30 days (`TRASH_DAYS`), as the format says.
Dropping that copy after 30 days, leaving the tombstone, is the clients’ job, since only they can
open the trash record: the first device to drop it pushes the tombstone, which replaces the
service’s copy. **A row that is gone from the service deletes nothing on a device.** Only a trash
record does, and the service can’t make one.

## Setting up the first device

When a reader signs in and the account has no notebook yet, the device:

1. **Asks where the key lives**, “follows my account” first and recommended (under “Where the key
   lives”).
2. **Makes** the notebook’s id, the notebook key (`kid` 1), its own device key, signing key, and
   card.
3. **Makes the holders**:
   - **Under “follows my account,” a passkey holder.** If the reader signed in with a passkey in
     this session and the device still has the PRF’s output from that, it uses it, with no second
     prompt. Otherwise the reader makes a passkey now, which also becomes a way to sign in. If the
     passkey can’t hold the key (under “The passkey”), the device says so, and the recovery code
     below is required.
   - **A recovery holder**, with its code, at every setup (BVJ, 2026-11-24, under “Where the key
     lives”; until then it was offered, and made only if the reader said yes, wherever a passkey
     holder was made).
4. **Sends the service, in one request,** the notebook’s id, the hash of the key proof, its own
   device entry (its card and its sealed keyring), and each holder (its record, its card, and the
   keyring sealed to it). The service accepts this only while the account has no notebook, so two
   devices setting up at once can’t make two: the second is told to join instead, and a recovery
   code it made was never shown.
5. **Shows the recovery code**, if one was made, only after the request is accepted, with the
   sentence below, and asks the reader to keep it: in a password manager, written down, or both. It
   then asks for two of the six groups back, so a code the reader didn’t keep is found out now
   rather than on the day it is needed.
6. **Suggests a second way to sign in** to a reader whose only way in is a passkey, since a reader
   who loses that passkey can’t sign in, and then nothing else here can help them.
7. **Pushes the notebook**, sealed: the one visible moment on a device that already has notes, as
   “Two roads, one notebook” describes (BDR’s proposal, §6b).

**The sentence shown with a recovery code** (BVJ, 2026-11-23, as draft 1 proposed it), wherever a
code is shown:

> Save this code somewhere safe, like a password manager or a note kept at home. If you lose it and
> every device you use with LIT, no one can open your synced notes, not even LIT.

It says “synced notes” because a device’s own notebook and the reader’s exported file aren’t lost
with the code (under “When a reader loses every device”).

**For a reader whose notebook has no recovery code**, a sentence to match (BVJ, 2026-11-23, as
draft 2 proposed it). Since 2026-11-24 no setup leaves a reader without one, so this is for a
notebook that was set up before then, wherever a client says what can open it:

> Your passkey opens your notebook on a new device. If you lose your passkey and every device you
> use with LIT, no one can open your synced notes, not even LIT.

## Adding a device

A device that signs in to an account that already has a notebook can’t open it yet, and the service
gives it no records until it can. It tries, in this order, what the notebook’s holders allow:

1. **The passkey**, if a passkey holder exists and this device can use the passkey.
2. **Approval** from a device that already has the key.
3. **The recovery code**, if a recovery holder exists.

So the device asks, for example: **“Open your notebook with your passkey, approve this device from
one that’s already signed in, or enter your recovery code.”** However a device joins, every other
device announces it: “[name] was added to your notebook on [date]” and how (“by [device],” “with
your passkey,” or “with your recovery code”).

### By passkey

1. **If the reader signed in with a passkey**, the device already has the PRF’s output from that
   ceremony. Otherwise it asks for the passkey now, naming the passkeys that hold the key (their
   credential ids, from the holder list) and asking for the PRF.
2. **It makes the passkey key**, finds the holder whose `credential` is the passkey that answered,
   and runs the four checks under “Holders.”
3. **It joins**: it writes its own card, seals the keyring to its own device key, and sends both
   with the key proof. The service lists it as added by passkey.

A reader who signed in with a passkey sees one prompt for all of it. If any step fails, the device
offers approval and the recovery code, as under “The passkey.”

### By approval

Two devices signed in to the same account: the new one, without the key, and one that has it.

1. **One of them shows an approval code**: 10 random bytes (80 bits), as 16 characters of the same
   base32 in four groups of four, and as a QR code (under “The link”). Either device may show it, and
   the other scans or types it. Whichever device holds the keyring does the approving.
2. **Both derive** the approval id, written as 32 lowercase hex characters, and the MAC key:
   - approval id: `HKDF(code, info "lit-notebook/1 approve-id", 16 bytes)`
   - MAC key: `HKDF(code, info "lit-notebook/1 approve-mac", 32 bytes)`

   The service sees the id, never the code.
3. **The new device posts a request**: the approval id, its device id, its platform and model, its
   device public key, its signing public key, and this MAC:

   `HMAC(MAC key, lines "lit-approve/1 request", approval id, device id, platform, model, base64url(public key), base64url(signing public key))`

   The platform is the card’s word (`ios`, `android`, or `web`) and the model is the name the card
   will start with. Neither may hold a line feed, as for any line.
4. **The approving device** finds the request by its id, checks its MAC, and asks the reader “Add
   [model] to your notebook?” **The question also says when the request was made and how the
   session that made it signed in** (the answer’s `created` and `through`, read against its
   `time`: “Asked 2 minutes ago, signed in with a passkey.”), and **to approve only a device the
   reader is holding**: where the new device shows the code, one showing this code now; where the
   approving device showed it, one where the reader just entered or scanned it (Audit 9, SEC9-1;
   BVJ, 2026-11-26).
5. **On yes, it posts a grant**: it seals its keyring to the new device’s public key (HPKE, `info`
   `lit-notebook/1 keyring`, an empty AAD), writes the new device’s card (the model as its name, the
   platform, and both public keys from the request, with `added` its own time now), and sends the
   approval id, the `kid` it sealed (the keyring’s `current`), the card, HPKE’s `enc` and
   ciphertext, and this MAC:

   `HMAC(MAC key, lines "lit-approve/1 grant", approval id, kid, base64url(enc), base64url(ciphertext))`

   The ciphertext in that MAC is the sealed keyring’s. The card isn’t under the MAC and needs no
   place there: it is sealed under the card key of the keyring the MAC vouches for, with the new
   device’s id in its AAD.

   The service refuses a grant whose `kid` isn’t the account’s current one, so no approval crosses a
   change of key: the approving device fetches the newer keyring and grants again.
6. **The new device** checks the grant’s MAC, opens the keyring, checks it, and checks that its
   `current` is the grant’s `kid` and that the card opens and names its own id and both of its
   public keys. Then it keeps the keyring and **accepts**: it sends the key proof, and the service
   lists it, with the grant’s card and sealed keyring, as added by the approving device. Those
   checks run in that order, and the vectors name the first that fails: the MAC; the keyring opens
   (to this device’s key) and passes the keyring’s own checks; its `current` is the grant’s `kid`;
   the card opens under that key’s card key with this device’s id, and its `public` and `sign` are
   this device’s two public keys.
7. **The service keeps an approval for at most ten minutes**, deletes it once accepted, and shows it
   only to sessions of that account.

**What the code is for.** Each MAC proves its message came from a device that saw the code, which
only the reader’s two devices did. Without the code, the service can’t swap in a public key of its
own at step 3 or a keyring of its own at step 5, and 80 random bits can’t be worked out from what the
service sees in the ten minutes an approval lasts.

### By recovery code

1. **The reader types the code.** The device makes the code key and fetches the recovery holder.
2. **It runs the four checks** under “Holders.” A failure at the first means the code is wrong:
   “That code doesn’t open this notebook.”
3. **It joins**, as a device that came in by passkey does. The service lists it as added by recovery
   code.

The service never sees the code and can’t test a guess, since the check happens on the device; a
guesser would have to try 2¹²⁰ codes. Afterward the device offers to remove devices the reader no
longer has (under “Removing a device, and changing the key”), since a reader using the code has
often lost one.

### The link

**The approval code travels only where no server reads it**: typed, or in a QR code that holds it
after a `#`. It never goes in a path or a query string, and a client never sends it, or anything
after a link’s `#`, in a request.

The recommended shape (the exact address is settled with the service, in step 4c):
`https://litbible.net/account/connect/#a=<16 characters>`. BDR’s proposal has the apps claim
`/account/` (§6b), so the phone’s camera opens the app, and the app takes its part from its own
state: without the keyring, it asks to join with that code. **Holding the keyring, it never acts
on a code from a link** (Audit 9, SEC9-1; BVJ, 2026-11-26): it drops the code and asks the reader
to type the one the new device is showing. A link can be sent by anyone, and a device that looked
the code up would put “Add [model] to your notebook?” before a reader who asked for nothing; a
code typed from the other screen proves the reader is holding both. The website’s “Connect your
phone” (the proposal, §6b), which adds a single-use sign-in code to the same link, is held until
after February 10 (`STUDY-DESK.md`, “Order of work,” 4).

## Where each client keeps its keys

| | iOS | Android | Website |
|---|---|---|---|
| The device’s private key | Keychain, this device only | sealed by a Keystore key, in app storage | a non-extractable `CryptoKey` in IndexedDB |
| The signing key | Keychain, this device only, or the Secure Enclave | a Keystore key | a non-extractable `CryptoKey` in IndexedDB |
| The keyring | Keychain, this device only | sealed by the same Keystore key | the sealed copy the service holds, opened in memory each visit |
| Copied to a new device by a backup | No | No | No |
| The passkey | in the reader’s passkey provider | in the reader’s passkey provider | in the reader’s passkey provider |
| The passkey’s secret, and the passkey key | memory only | memory only | memory only |

**On every platform, a device that finds itself signed in but unable to open its key treats that as
“this device needs to join again,”** never as lost notes. Its own notebook stays where it was, and
the sealed copy on the service is untouched.

### iOS

- **Keychain generic-password items** with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` and
  `kSecAttrSynchronizable` off: readable once the phone has been unlocked after a restart, so
  background sync works, and never copied to another device, by iCloud Keychain or by a backup.
- **Keychain items outlive the app.** Deleting and reinstalling it would find the old keys and
  session, so on a first launch with no marker in `UserDefaults` (which deleting the app clears) the
  app removes them and starts signed out.
- **No LIT key goes in iCloud Keychain, under either choice.** Draft 1 asked whether to keep the
  key there, and recommended against. BVJ’s answer was that the reader chooses, on every platform,
  and that the choice is carried by a passkey. A passkey does what a synced Keychain item would
  (a new iPhone on the same Apple account opens the notebook with no approval), and it also works
  on the website and on Android, the reader can see it and remove it where they keep their
  passkeys, and the design stays the same on all three clients.
- **The device key and the signing key may be Secure Enclave keys** where CryptoKit’s HPKE and
  signing accept them. They need not be.
- **iCloud still carries records between a reader’s Apple devices** as it does today (“Two roads, one
  notebook”), unsealed and under Apple’s protection. An iPad that never signs in needs no key. “Can’t
  read” is a promise about LIT.

### Android

- **A Keystore AES-256-GCM key**, not exportable, in StrongBox where the device has it (API 28 and
  later), with no user authentication required, so background sync works. It seals the device’s
  private key and the keyring, which live in app-private storage.
- **The device key pair is an ordinary key sealed by that Keystore key**, since Keystore keys for
  ECDH need API 31 and the app supports API 26. **The signing key is a Keystore key itself**, since
  the Keystore signs with EC keys on every version the app supports.
- **Those files are left out of Auto Backup and device-to-device transfer** (`dataExtractionRules`
  from Android 12, `fullBackupContent` before). On a new phone the Keystore key wouldn’t exist, so
  they couldn’t be opened anyway.
- **A Keystore key can occasionally be lost** (some devices have dropped them when the screen lock
  changed). The rule above applies: the device joins again, with a new device key and signing key.
- **Android 8.0 and 8.1 have no passkeys.** A reader there signs in with Google, and the device
  joins by approval or by the recovery code.
- **Auto Backup keeps copying the app’s own notebook** as it does today, under Google’s protection.

### The website

- **The device key pair and the signing key pair are made with WebCrypto**, their private keys not
  extractable, and kept as `CryptoKey`s in IndexedDB, which keeps them that way: page code can use
  them but can’t read them out.
- **At rest the browser keeps only the sealed keyring**, as the service holds it. Each visit opens it
  with the device key and imports the record key as a non-extractable `CryptoKey`; the notebook
  key’s bytes are held in memory only.
- **A computer is the weakest home**: anyone who can use the browser as the reader can open the
  notebook. `STUDY-DESK.md`’s passphrase lock (its D5; website only) is for that, and it is held
  until after February 10. Under sync it has to cover the device key itself, since the service holds
  a keyring sealed to that key and any script on the site can use it. So turning the lock on will
  make a new device key, extractable but kept only wrapped under a key made from the passphrase, and
  the device will seal its keyring to the new key and write its card again. The service’s interface
  has the request for that already. The lock’s design is the website’s.
- **Safari can clear a site’s storage after seven days without a visit**, so a Safari reader may need
  to join again. Under “follows my account” that is one passkey prompt. Nothing is lost.
- **The encryption code is Study Desk code**: loaded only with `data-desk="on"` and never imported
  statically by shared reader code (the root `CLAUDE.md`). Account pages that work on a phone are
  step 4h’s to settle. Every new storage key or store is named on /privacy
  (`test/desk-storage-keys.test.js`).
- **As built in step 4g (2026-11-24).** A browser that syncs holds two things. One value in the
  notebook’s own database says it is linked: the notebook’s id, the service’s origin, and a random
  id for the link. A second IndexedDB database, `lit-desk-sync`, holds the device’s key pairs (as
  above), the session, the sealed keyring, and one small entry for each row: its id, the revision
  last seen, and a digest of the record. It holds no record in the clear: a row the device is
  keeping until it can read it, or until its time comes (“Opening,” and the format’s “Clocks”),
  waits there sealed, exactly as the service sent it. **The session is kept there too**, never in
  a cookie and never in local storage. The connector takes
  the key pairs from the account pages (step 4h makes them) and refuses a device key whose private
  half can be read out. A browser with no link downloads none of this code.

## Sign-in

**Signing in and opening the notebook are separate.** Signing in proves to the service which account
a device belongs to. Only the keyring opens the notebook, and the service gives records only to a
session that has proved it holds the key. So a stolen Apple or Google sign-in gets an attacker a
session that can ask to join, and a request to delete or replace the notebook that waits seven days
and that the reader can cancel (under “Deleting the account”). Losing a way to sign in doesn’t touch
the key.

- **Sign in with Apple and Sign in with Google.** Which of them each app offers is the apps’ call
  (IOS-106, NB13). The service keeps only the provider’s account id (`sub`), and Apple’s refresh
  token so it can revoke it, and stores no email address or name, even when the provider sends one.
  **Built on the service in step 4e and off**: each turns on when its client ids are configured,
  and those are BDR’s to give (“Still open,” 41).
- **Passkeys, at launch** (BVJ, 2026-11-23; the call had them “if the schedule holds”; **for BDR to
  confirm**). One passkey for the website and both apps: WebAuthn with the relying party
  `litbible.net`, which needs `webcredentials:litbible.net` in the site’s
  `apple-app-site-association` and `get_login_creds` in its `assetlinks.json` (`STUDY-DESK.md`, “One
  passkey everywhere”). **Both were added in step 4e (2026-11-24)**, naming only the app each file
  already named; the apps’ own half (the associated domain, Credential Manager) is theirs.
- **What this file asks of every passkey request**, whoever makes it: a discoverable passkey; user
  verification required; the `prf` extension with the fixed input, at creation and at each use; and
  `results` taken out of anything sent to the service (under “The passkey”). The rest of the
  ceremony (the challenge, what the passkey is called in the reader’s password manager) is the
  service’s sign-in, under “The service’s interface,” “Signing in.”
- **A passkey signs in under both choices.** Whether it also opens the notebook is the reader’s
  choice (under “Where the key lives”).
- **Several ways in, one account**: “Add another way to sign in” (`STUDY-DESK.md`). Once an account
  has a notebook, adding or removing a way in needs a session that has proved the key, so a stolen
  sign-in can’t add one of its own and stay. The last way in can’t be removed. A passkey that holds
  the key is removed as a holder first, which changes the key.
- **A reader who signs in only with a passkey**: setup suggests a second way in (BVJ, 2026-11-23).
  If they lose the passkey they can’t sign in, and the recovery code can’t help by itself.
- **Signing out** removes the device’s session, keyring, device key, and signing key, and its entry
  and sealed copy on the service. The device’s own notebook stays. Signing back in means joining
  again: by passkey under “follows my account,” otherwise by approval or the code. Signing out is
  the reader’s own act on a device they hold, so the key doesn’t change.
- **How sessions are kept** is under “The service’s interface,” “How a request is carried”: 30
  days from a sign-in, and an open session kept alive by use for up to a year. This file asks only
  that no session token is made from, or stands in for, any key here, and that a session is open
  only as “The key proof” says.

## Removing a device, and changing the key

**A device is removed** from the device list on any other device that has the key (“Remove,” or
“Sign out everywhere else”), usually because it was lost, sold, or stolen. Removing one changes the
notebook key:

1. **The device doing it fetches the device list and the holder list** and opens every card under
   the current key. It shows the reader the devices that will keep access and the one being removed,
   each with its name, when it was added and how, and when it was last seen. Devices that the
   removed one added, and holders set up from it, are marked, and the reader is offered to remove
   them too. An entry whose card doesn’t open is shown as unknown, and removed.
2. **It makes the next notebook key** and a keyring with it as `current`, holding every older key.
3. **It seals the new keyring** to the public key in each kept device’s card and each kept holder’s
   card, and seals every kept card again under the new key.
4. **It sends all of that in one request**, with the hash of the new key’s proof. The service
   accepts it only from a session that has proved the current key, and only if the account’s current
   `kid` and the lists’ version are both what they were at step 1, every device and holder on the
   service is either kept or removed in the request, and the notebook still has a holder afterward.
   The service then sets the new `kid`, stores the sealed copies and cards, and deletes each removed
   device’s entry, sealed copy, and sessions, and each removed holder. **If the request is refused**
   (another device changed the key or a list meanwhile), the device starts again from step 1 and
   shows the reader the lists again if they changed.
5. **It reseals every record still under an older key**: opens each and seals it again under the new
   key with a fresh nonce, the plain fields unchanged, and pushes it against the row’s revision. Any
   device holding the new keyring finishes this if the first stops partway, and a row already
   resealed is skipped.

**From step 4, the service refuses a record sealed under any key but the current one, and no other
session is open.** A device whose request is refused fetches its sealed keyring, checks it (under
“The keyring”), proves the new key, and goes on. A device that finds no sealed keyring for itself has
been removed: it stops syncing, says so, and keeps its own notebook. It keeps its keys until the
reader signs it out or joins again, since throwing them away on the service’s word would let the
service lock a reader out. An approval caught by a change of key is simply done again.

### What removing a device means, under each choice

**Under “this device only,”** removing a device stops it reading anything written from then on, and
can’t take back what it already holds. It can come back only by an approval or the recovery code.
The screen says, as draft 1 proposed: “Remove [name]? It won’t be able to open anything added to
your notebook from now on. Anything already on it stays there.”

**Under “follows my account,” that is true only if the device no longer has the reader’s passkey.**
The new key never reaches the removed device’s own key. But the passkey is a holder, the new keyring
is sealed to it, and a device that still has the passkey can sign in again and open the notebook
with it, as any new device of the reader’s would. LIT can’t take a passkey off a device: Apple,
Google, or the reader’s password manager decides where it is. So the screen says this plainly
(BVJ, 2026-11-23: draft 2’s wording, with the password manager added):

> Remove [name]? It won’t be able to open anything added to your notebook from now on, unless it
> still has your passkey. If it’s lost or stolen, remove it from your Apple or Google account too,
> or from the password manager that keeps your passkey. Anything already on it stays there.

and offers, for a device the reader no longer trusts, the two things that don’t depend on it:

- **“Replace my passkey.”** After taking the lost device off their Apple or Google account, so that
  nothing new syncs to it, the reader makes a new passkey on the device in their hand. It becomes a
  holder, and then the key changes with the old passkey’s holder removed and the old passkey
  removed as a way in. The lost device holds a passkey that neither signs in nor opens anything.
  The new one is made first, so the notebook is never without a holder.
- **“Switch to this device only.”** The key changes and no passkey holder is kept. Nothing about it
  depends on Apple or Google. A recovery code is made in the same step if the reader has none.

**Switching to “this device only” always gives the notebook a new key** (BVJ, 2026-11-23), whether
or not a device is removed with it: it is a change of key that removes every passkey holder.

**Removing one passkey from the list of what opens the notebook** is the same change of key with
that one holder removed. If it was the last passkey holder, the notebook is “this device only” from
then on.

## A new recovery code

**“Make a new recovery code”**, on any device with the keyring, is for a reader who lost theirs or
thinks someone saw it. It makes a new recovery holder and code **and a new notebook key**, done as
under “Removing a device, and changing the key,” with the old recovery holder removed and the new
one, anchored to the new key, added in the same request. The code is shown only once that request
is accepted, and kept until the reader confirms it, as at setup. A new code always brings a new
key, so whatever the old code could have opened stops mattering.

**A first recovery code**, for a reader who took none at setup, needs no new key: the device makes
the holder and adds it.

## Deleting the account

From either app (Apple’s guideline 5.1.1(v)) and from a web page (Google Play asks for one), on a
signed-in device:

- **From a device that can open the notebook, it happens at once.** From a device or page that
  can’t (a sign-in alone), it waits **seven days** (BVJ, 2026-11-23): every device that can open the
  notebook shows the request, with when it was made and from what kind of device, and any of them
  can cancel it. A stolen sign-in can’t take a reader’s notebook away while they look the other way
  for a day. The session that asked can cancel its own request too, so a reader who asked by mistake
  can take it back from the same device.
- **An account that has no notebook yet is deleted at once**, from any signed-in session: there is
  nothing to protect, and no device that could cancel.
- **The seven days are exact, and the deleting follows within about an hour.** A request falls due
  seven days to the millisecond after it was made. The service carries out what is due once an
  hour, and until it has, the request can still be canceled (under “Waiting seven days”).
- **The service deletes everything it holds for the account**: every record, every sealed keyring,
  every holder, the device list, sessions, approvals, and sign-in methods, after revoking Apple’s
  refresh token (`appleid.apple.com/auth/revoke`). D1’s point-in-time history (Time Travel) keeps
  the account’s rows, plain and sealed alike, until they age out (30 days on the plan production
  is to run on).
- **If Apple can’t be reached, the account stays, whole.** A token is never dropped unrevoked. A
  device that asked to delete at once is told to try again (`provider`); a request that is due is
  tried again every hour until Apple answers.
- **The device that deletes it** removes its keyring, device key, signing key, and session at once.
  Its own notebook stays, unless the reader also chooses to erase it there.
- **Every other device** finds out when it next reaches the service, removes its keys and session,
  keeps its own notebook, and says so. What it is told is `sign_in`, the same word a session that
  ran out gets: the service keeps nothing of a deleted account, not even that there was one. A
  device that saw a request to delete waiting knows why; one that didn’t learns it when its reader
  signs in again and finds an empty account (“Still open,” 71).
- **The reader’s passkey stays where they keep it**, since LIT can’t delete it. The device says so,
  and that it no longer opens anything.
- **Signing in again** with the same Apple or Google account starts a new, empty account with a new
  notebook id.

## When a reader loses every device

**With a passkey that opens the notebook** (“follows my account”): sign in on a new device with the
passkey, and the notebook comes back (under “By passkey”). Then remove the lost devices, as “What
removing a device means” describes.

**With the recovery code**: sign in on a new device, enter the code, and the notebook comes back
(under “By recovery code”). Then remove the lost devices.

**With neither, the sealed records on the service can’t be opened by anyone.** That is the cost of
LIT being unable to read them. What may still be there:
- **An exported notebook file**, from any of the three (iOS IOS-81, Android F9, the website’s full
  backup).
- **On Apple devices, iCloud**: a new iPhone or iPad restored from the reader’s iCloud gets its
  notebook back that way, since iCloud carries it as it does today.
- **On Android, Auto Backup**: a new phone restored from it gets the app’s notebook as of the last
  backup.
- **On a computer**, any browser the reader still uses.

From any of those, **“Start a new notebook”** (signed in, without the key) replaces the one that
can’t be opened. Like deleting the account from a device without the key, it waits seven days, shown
on every device that can open the old notebook, any of which can cancel it. Then the service deletes
the old sealed records and keys, and the device sets up as a first device (under “Setting up the
first device”) with a new notebook id, so its notebook goes up sealed under the new key.

**A device that held the old notebook never joins the new one on its own.** It sees a different
notebook id, tells the reader when the notebook was replaced and from what kind of device (the
service answers both, as `replaced` in `GET /account`), keeps its
own notebook, and joins only after the reader says yes; its own notes then join the new notebook.
(Its keyring would fail the checks under “The keyring” anyway.)

## The service’s interface

Draft 1 left this to “the service’s own spec.” **It is a section of this file, not a file beside
it**, for three reasons. What the service checks is half of every step above, and the other half is
what the device checks; a reader of one needs the other on the same page. The two freeze together,
under one version. And a second file would be one more thing for both apps’ sessions to find and
for this repo’s `CLAUDE.md` to name. How to run, deploy, and wipe
the service is in its own README, `workers/notebook-service/README.md`.

**The service is built (step 4c, 2026-11-23), and this section is what it does.** The paths, the
shape of every request and answer, the sizes, and the words of every refusal below are the ones the
code in `workers/notebook-service/` uses, and each check in the tables has a test that sends the
request a real client would and reads the refusal (`workers/notebook-service/test/`). Where
building it meant reading a sentence of draft 2 more exactly, or adding what draft 2 left out, the
change is listed under “Changed in step 4c,” and the ones that were a choice are under “Still
open,” 32 to 40. **For BDR to confirm**, since both apps call these.

**Sign-in is built too (step 4e, 2026-11-24)**, under “Signing in” and “Ways to sign in” below, to
the same standard: each check in their tables has a test, and a passkey is made and used end to
end by a software authenticator in the service’s own suite. Two things about it are *not* proved,
and are said where they matter: **Sign in with Apple and with Google have been run against
stand-ins only, never against either provider** (they are off until BDR’s client ids are
configured), and **no real device’s passkey has met the service yet** (“Still open,” 18 to 21).
What moved is under “Changed in step 4e,” and every choice is under “Still open,” 41 to 58. **For
BDR to confirm.**

**The account work is built too (step 4f, 2026-11-24)**, under “Waiting seven days” and “How often
a client may ask” below, to the same standard: each check has a test, each race the interface
names was forced at an exact point, and each condition in a statement was taken out in turn to
see a test fail. Three things about it are *not* proved, and are said where they matter: **the
service’s hourly run has only ever been started by a test or by hand on one machine, never by
Cloudflare’s own clock; deleting an account has run on a local database only, the largest of
20,000 rows; and the limits were counted against the local copy of Cloudflare’s limiter**, which
counts exactly where the real one says it is approximate. **Production is prepared and not
deployed.** What moved is under “Changed in step 4f,” and every choice is under “Still open,” 59
to 73. **For BDR to confirm.**

### How a request is carried

- **The address.** The preview’s is `https://notebook-preview.litbible.net` (BVJ’s choice, and
  live since 2026-11-23; it holds test data only). Production’s is to be
  `https://notebook.litbible.net`: it is written into the service’s configuration (step 4f) and
  **nothing is deployed there**, so no reader’s notebook is on any service yet. Every
  path below is under it. `GET /` needs no session and answers
  `{ "time": "…", "service": "lit-notebook", "interface": 1, "preview": true }`; `preview` says
  whether the preview’s own way in (below) is there.
- **JSON over HTTPS.** A request that has a body sends `Content-Type: application/json` and one
  JSON object of at most 4,194,304 bytes. A member the interface doesn’t name is ignored. A trailing
  slash on a path is ignored.
- **The session** travels as `Authorization: Bearer <token>`, where the token is the 43 characters
  sign-in gave (32 random bytes, base64url). It is never a cookie. The service keeps only the
  token’s SHA-256.
- **How long a session lasts.** Thirty days from the sign-in that made it. **An open session is
  kept alive by use**: on any request it makes, once its end is a day or more short of it, the end
  moves to 30 days from that moment, and never past 365 days from its sign-in, when the reader
  signs in again. **A session that is signed in and no more is never made longer**, so a sign-in
  that can’t open the notebook (a stolen one, say) runs out by itself. The token never changes and
  nothing a client sends renews it; `GET /account` answers the session’s end as `session.expires`.
  A session that has run out answers `sign_in` and is not brought back by use.
- **Every answer is a JSON object whose first member is `time`**, the service’s clock in the
  format’s form (`2026-11-23T18:35:09.978Z`), a refusal as much as a success. Nothing is cached
  (`Cache-Control: no-store`). **A client ignores a member of an answer that it doesn’t know**, so
  a later step can add one without breaking a client already built.
- **A refusal** has an HTTP status that isn’t 200 and the body
  `{ "time": "…", "error": "<word>", "message": "<a sentence for a log>", … }`. A client acts on
  `error` alone, by the table under “What the service answers when it refuses”; `message` may
  change.
- **From a browser**, the service answers cross-origin requests from the website’s own origins and
  no others, and never with credentials. The apps aren’t browsers and need nothing for this.

### How values are spelled

| A value | In a request and in an answer |
|---|---|
| A byte string (a nonce, a ciphertext, a key proof, a MAC, a public key, a credential id) | base64url, read strictly as under “Fixed choices”: no padding, no `+` or `/`, no leftover bits |
| A notebook’s, a device’s, or a holder’s id, and a way in’s | a UUID in lower case with its hyphens; the form is all that is checked |
| A sign-in challenge, and an account’s user handle for passkeys | 32 bytes, base64url (43 characters) |
| A passkey’s response, and the options the service gives for one | the standard’s own JSON forms (under “Signing in”), every byte string in them base64url |
| An identity token from Apple or Google | the provider’s JWT as text: three base64url parts joined by periods, at most 8,192 characters |
| An approval’s id | 32 lower-case hex characters |
| A record’s id | 1 to 64 printable ASCII characters (U+0020 to U+007E) |
| A time | the format’s form: `YYYY-MM-DDTHH:MM:SS`, an optional fraction of any length, then `Z`; at most 64 characters. The same pattern the reference’s “same instant” rule reads |
| `kid`, `lists` (the lists’ version), `rev` | whole numbers, as JSON numbers |
| A sealed card, a sealed holder record | `{ "nonce": <12 bytes>, "ct": <17 to 4,096 bytes> }` |
| A sealed keyring (HPKE) | `{ "enc": <65 bytes>, "ct": <17 to 65,536 bytes> }` |
| A device’s entry, and a kept holder’s, in a request | `{ "id", "card", "keyring" }` |
| A holder in full, in a request | `{ "id", "kind": "recovery" or "passkey", "credential": <1 to 1,023 bytes, a passkey holder’s only>, "record", "card", "keyring" }` |

A card or a keyring in a request carries no `kid` of its own: it is sealed under the request’s
`kid` (in a change of key, the next one). In an answer each carries the `kid` it was sealed under,
as `{ "kid", "nonce", "ct" }` and `{ "kid", "enc", "ct" }`. A holder’s record has none, since it is
sealed under the holder’s own secret.

**Limits.** A notebook has at most 100 devices and 20 holders, and at most 3 approvals in progress.
One `POST /rows` carries at most 500 rows, to put and to remove together. One page of `GET /rows`
is at most 500 rows and 4,194,304 characters of ciphertext as text, and always at least one row.
An account has at most 20 ways in. In a passkey’s response, `clientDataJSON` is at most 4,096
bytes, `attestationObject` 16,384, `authenticatorData` 37 to 1,024, `signature` 1,024, and
`userHandle` 64; Apple’s authorization code is at most 1,024 characters and a redirect address
2,048.

### Three kinds of session

- **Signed in**: the service knows which account the session belongs to (under “Signing in”).
- **Open**: signed in, attached to an entry in the device list, and proved for the account’s
  current `kid` (under “The key proof”). A change of key closes every session but the one that made
  it. “Open” is worked out on each request and never stored, so removing a device’s entry closes
  its sessions at once.
- **Neither** gets nothing: every request answers `sign_in`, but `GET /`, `GET /sign-in`, and the
  requests under “Signing in,” which are how a session begins.

The service checks every request against the session’s account and never takes an account, a `sub`,
or a credential id from a request’s body as proof of who is asking.

**The session is checked before the body is read.** A request that needs an open session answers
`not_open` to one that isn’t, whatever it sent; one that needs a notebook answers `no_notebook`;
and a second setup answers `already_set_up`. A device that has fallen behind is always told so,
and never “too large” or “bad request” for a body it would only send again.

### The account

| Request | From | The service checks | Then |
|---|---|---|---|
| `GET /account` | signed in | nothing more | Answers with the notebook’s id (or none), the current `kid`, the lists’ version, whether this session is open and to which device, the ways in (each one’s kind, id, and dates, and whether a passkey syncs), any request that is waiting, and when the notebook was last replaced |
| `POST /session/proof` with the device’s id, `kid`, and the key proof | signed in | the account has a notebook; `kid` is current; the proof’s SHA-256 equals the stored hash; the device id is in the device list | The session is open and attached to that device. Wrong proofs are counted and limited |
| `DELETE /session` | signed in | nothing more | This session is ended, and no other |

```text
GET /account
  → { "notebook": "<uuid>" or null, "kid": 2, "lists": 7,
      "session": { "open": true, "device": "<uuid>" or null, "expires": "<time>" },
      "ways": [ { "id": "<uuid>", "kind": "passkey", "added": "<time>",
                  "credential": "<bytes>", "syncs": true } ],
      "waiting": null
              or { "what": "delete" or "replace", "asked": "<time>", "due": "<time>",
                   "platform": "ios", "through": "apple", "mine": false },
      "replaced": null
              or { "when": "<time>", "platform": "web", "through": "google" } }

POST /session/proof   { "device": "<uuid>", "kid": 2, "proof": "<32 bytes>" }
  → { "open": true, "device": "<uuid>", "kid": 2 }

DELETE /session
  → { }
```

- **`kid` is 0, and `notebook` is null, on an account with no notebook.**
- **A way in’s `kind`** is `apple`, `google`, or `passkey`; on the preview, also `preview`.
  `credential` and `syncs` are a passkey’s only. No account id from Apple or Google is ever
  answered. A way in’s `id` is what `DELETE /ways/<id>` names (under “Ways to sign in”). They are
  listed oldest first.
- **`DELETE /session`** is how a session attached to no device signs out (`session.device` is
  null): a reader who signed in and went no further, and a device that was removed, or whose
  notebook was replaced, and signed in again. A session attached to a device signs out with
  `DELETE /devices/<id>`, which removes its entry and sealed keyring too (under “Devices and
  holders”). **Where that is refused by the rule `own_device`, the device sends
  `DELETE /session` instead** (Audit 9, COH9-1), so signing out never fails for the session’s
  state. **Stopping syncing ends the session too** (Audit 9, SY9b-2): a device whose reader stops
  syncing without signing out sends `DELETE /session` first, and a failure of that request
  doesn’t hold up the stop.
- **`waiting`** is the request to delete the account or replace the notebook that is waiting its
  seven days, or `null` (under “Waiting seven days”). **Every session of the account is answered
  it**, open or not, so that every device of the reader’s can show it. `mine` is true for the
  session that made the request, and for no other.
- **`replaced`** is the last time the account’s notebook was replaced, or `null` if it never was:
  when it was carried out, and the `platform` and `through` of the request that asked. It is what
  a device that held the old notebook tells its reader (under “When a reader loses every device”).
  It stays until the notebook is replaced again.
- **The proof’s checks run in the table’s order.** A `kid` that isn’t current is `old_key` whatever
  the proof, and is not counted. The comparison is of SHA-256 digests in constant time. A wrong
  proof is `wrong_proof` with `left`, the tries the session has left; the fifth in a row ends the
  session (`sign_in`, with `"reason": "wrong_proofs"`), and a right one starts the count again.
  **Wrong proofs are counted for the session, not the account**, so that someone with a stolen
  sign-in can’t lock the reader’s own devices out by guessing. A device id with no entry is `gone`,
  checked after the proof.

### Setting up

| Request | From | The service checks | Then |
|---|---|---|---|
| `POST /notebook` with the notebook’s id, the proof’s hash, the device’s entry, and one or more holders | signed in | the account has no notebook (checked and written as one step); at least one holder, at most one of kind `recovery`; a passkey holder’s credential is one of this account’s passkeys and is marked as syncing; at most one holder for a passkey; every id is a UUID and no two are the same; sizes | `kid` is 1. The device is listed as added by setup. The session is open |

```text
POST /notebook
  { "notebook": "<uuid>", "proofHash": "<32 bytes>",
    "device": { "id", "card", "keyring" },
    "holders": [ <a holder in full>, … ] }
  → { "notebook": "<uuid>", "kid": 1, "lists": 1,
      "session": { "open": true, "device": "<uuid>" } }
```

Everything in it is sealed under `kid` 1. Of two devices setting up at once, one is answered and the
other is told `already_set_up`, and nothing of the second is kept.

### Devices and holders

| Request | From | The service checks | Then |
|---|---|---|---|
| `GET /holders` | signed in | nothing more | Each holder’s id, kind, credential id, sealed record, and sealed keyring with its `kid`. No cards |
| `GET /keyring?device=<id>` | signed in | nothing more | That device’s sealed keyring and its `kid`, or “not found” |
| `POST /devices` with the device’s id, card, sealed keyring, `kid`, the key proof, and the holder’s id it came in through | signed in | the account has a notebook; `kid` is current; the proof; the holder exists; no entry has that id | The device is listed as added by that holder’s kind. The lists’ version moves. The session is open |
| `GET /devices` | open | nothing more | The lists’ version, the current `kid`, each device (its id, its sealed card with the card’s `kid`, when and how it was added, and when it was last seen), and each holder (its id, kind, credential id, its sealed card with the card’s `kid`, and when and from which device it was added) |
| `PUT /devices/<id>` with a new card, perhaps a new sealed keyring, and the lists’ version | open, and only for its own device | the version is current; the card’s `kid` is current | The card is replaced (a rename), and the sealed keyring if one was sent (a new device key, for the lock). The version moves |
| `DELETE /devices/<id>` | a session attached to that device | nothing more | Signing out: the entry, its sealed keyring, and every session attached to the device are removed. The version moves. The key doesn’t change |
| `POST /holders` with a holder’s id, kind, credential id, record, card, sealed keyring, and the lists’ version | open | the version is current; the card’s and the keyring’s `kid` are current; no holder has that id; for `recovery`, none exists; for `passkey`, the credential is this account’s, is marked as syncing, and has no holder yet | The holder is stored. The version moves |

A holder is removed only by a change of key.

```text
GET /holders
  → { "holders": [ { "id", "kind", "credential": "<a passkey holder's only>",
                     "record": { "nonce", "ct" }, "keyring": { "kid", "enc", "ct" } } ] }

GET /keyring?device=<uuid>
  → { "device": "<uuid>", "keyring": { "kid", "enc", "ct" } }

POST /devices
  { "kid": 2, "proof": "<32 bytes>", "holder": "<uuid>", "device": { "id", "card", "keyring" } }
  → { "kid": 2, "lists": 8, "session": { "open": true, "device": "<uuid>" } }

GET /devices
  → { "kid": 2, "lists": 8,
      "devices": [ { "id", "card": { "kid", "nonce", "ct" }, "added": "<time>",
                     "how": "setup" or "approval" or "passkey" or "recovery",
                     "by": "<uuid>" or null, "seen": "<time>" } ],
      "holders": [ { "id", "kind", "credential": "<a passkey holder's only>",
                     "card": { "kid", "nonce", "ct" }, "added": "<time>", "by": "<uuid>" } ] }

PUT /devices/<uuid>   { "lists": 8, "kid": 2, "card": { "nonce", "ct" }, "keyring": { "enc", "ct" } }
  → { "lists": 9 }

DELETE /devices/<uuid>
  → { "lists": 10 }

POST /holders         { "lists": 10, "kid": 2, "holder": <a holder in full> }
  → { "lists": 11 }
```

- **A device’s `how` and `by`**: `setup` (and `by` is null); `approval` (`by` is the device that
  granted it); `passkey` or `recovery` (`by` is the holder it came in through). A holder’s `by` is
  the device it was added from. Both lists are answered oldest first.
- **`seen`** is when a session open on that device last made a request, written at most once an
  hour.
- **`PUT`’s `keyring` may be left out** (a rename). A session attached to another device, or to
  none, is refused by the rule `own_device`, for `PUT` and for `DELETE` alike. A device signing
  out from such a session ends it with `DELETE /session` (under “The account”).
- **`DELETE` needs no open session**, so a device that never caught up with a change of key can
  still sign out. If its entry is already gone (another device removed it), its sessions are ended
  and the version doesn’t move.
- **The answer’s `lists` is the new version**, so a device that just changed a list need not fetch
  it again.

### Changing the key

| Request | From | The service checks | Then |
|---|---|---|---|
| `POST /notebook/key` with the `kid` and the lists’ version it started from, the new proof’s hash, each kept device (id, card, sealed keyring), each kept holder (id, card, sealed keyring), any new holder in full, and the ids of the devices and holders to remove | open | the `kid` and the version are both still current; **every** device on the service is in exactly one of “kept” and “removed,” and so is every holder; the caller’s own device is kept; at least one holder remains; at most one `recovery` holder remains; a new passkey holder as under `POST /holders` | All at once: `kid` goes up by one; the version moves; the proof’s hash is replaced; the new cards and keyrings are stored; removed devices lose their entries, sealed keyrings, and sessions; removed holders are deleted; approvals in progress are dropped; every session but the caller’s is no longer open |

```text
POST /notebook/key
  { "kid": 2, "lists": 11, "proofHash": "<32 bytes, the new key's proof, hashed>",
    "devices":       [ { "id", "card", "keyring" }, … ],     kept, sealed under kid 3
    "holders":       [ { "id", "card", "keyring" }, … ],     kept, sealed under kid 3
    "newHolders":    [ <a holder in full>, … ],              sealed under kid 3
    "removeDevices": [ "<uuid>", … ],
    "removeHolders": [ "<uuid>", … ] }
  → { "kid": 3, "lists": 12 }
```

Any of the five lists may be left out when it is empty. An id named twice, in one list or across
“kept” and “removed,” is a malformed request. The whole change is applied or none of it is: a
refusal leaves `kid`, the version, and both lists exactly as they were. Of two devices changing
the key at once, one is answered, and the other finds its session no longer open.

### Records

| Request | From | The service checks | Then |
|---|---|---|---|
| `GET /rows?since=<rev>` | open | nothing more | Rows with a later `rev`, in order, a cursor for the next call, and whether there are more. With `old=1`, the rows still under an older `kid`, for resealing |
| `POST /rows` with rows to put, each with the `rev` the device last saw for that id (0 for a new one), and ids to remove, each with its `rev` | open | every row’s `kid` is the current one, or the whole request is refused as “old key”; then, row by row: `v` is 1; `id` is 1 to 64 printable ASCII characters; the two times are in the format’s form; the nonce is 12 bytes; the ciphertext is a multiple of 256 bytes plus 16, and at most 1,048,592; the `rev` given is the row’s current one, or that row is answered with “conflict” and the row as it stands | Each accepted row gets the next `rev`. A removed row is gone. A device that gets “conflict” opens the row it was sent, merges as the format says, and pushes again |

```text
GET /rows?since=4180            (and &old=1 for the rows still under an older kid)
  → { "kid": 2, "rows": [ <a row, as under “A record on the service”>, … ],
      "next": 4182, "more": false }

POST /rows
  { "put":    [ { "v": 1, "id", "rev": <the rev last seen, 0 for a new row>, "modified",
                  "deletedAt": "<a trash record's only>", "kid", "nonce", "ct" }, … ],
    "remove": [ { "id", "rev": <the rev last seen> }, … ] }
  → { "kid": 2, "rev": 4185,
      "put":    [ { "id", "rev": 4184 }                        stored, with its new rev
                  { "id", "refused": "<a check, below>" }      not stored
                  { "id", "conflict": "changed", "row": <the row as it stands> }
                  { "id", "conflict": "gone" } ],
      "remove": [ { "id", "removed": true }
                  { "id", "conflict": "changed", "row": <the row as it stands> } ] }
```

- **Reading.** `since` is the `next` of the last page, or 0 (or left out) for everything. A page’s
  rows are in `rev` order; `next` is the last one’s `rev`, and `more` says whether to ask again.
  When no row is later, `rows` is empty and `next` is `since`. A row is answered exactly as it was
  pushed, with its `rev`; **`deletedAt` is left out of a row that has none**, never sent as null.
- **Writing, the whole request.** Refused as a whole: a row whose `kid` isn’t the current one
  (`old_key`, and no row of the request is stored); a `kid` that isn’t a whole number of 1 or more,
  a `put` or `remove` that isn’t a list, an item that isn’t an object, a `remove` item whose `id`
  or `rev` isn’t in form, or one id named twice in the request (`bad_request`); more than 500 items
  (`too_large`).
- **Writing, row by row.** Every other check is answered for that row alone, in the answer’s `put`
  and `remove`, in the request’s order, and a row that fails never holds back the rows beside it.
  `refused` names the first check that failed, in this order: `v`, `id`, `modified`, `deletedAt`,
  `nonce`, `ct` (not base64url, or not a multiple of 256 bytes plus 16), `too_large` (more than
  1,048,592 bytes), `rev` (not a whole number of 0 or more).
- **Conflicts.** A row is stored when its `rev` is the one the service holds (0 for an id it
  doesn’t have). Otherwise it is `"conflict": "changed"` with the row as it stands, or
  `"conflict": "gone"` when the service has no such row any more (it was removed). A conflict
  changes nothing. When a request’s conflicts would carry more than a page of ciphertext, the rows
  past that are answered without `row`, and the device pulls.
- **Removing.** A row is removed when the `rev` given is its current one. One already gone is
  answered `"removed": true`, since that is what was asked. A removal takes a revision too, though
  no row carries it, so `rev` numbers may skip.
- **Revisions** go up by one for each stored row, in the request’s order, and the answer’s `rev`
  is the account’s last. Two pushes at once never share one.
- **A device’s cursor after its own push** (step 4g, 2026-11-24; what the website does, and nothing
  the service asks). A row a device stored comes back in its next pull, since its `rev` is past the
  cursor. A device may step its cursor over the rows it just stored **only when their revisions
  are exactly the next ones after its cursor**: a revision is one row’s alone, so nothing else was
  written between. If even one is out of place (another device’s row or removal took a revision
  meanwhile), it leaves the cursor where it was and pulls. It never takes the answer’s `rev` as its
  cursor, which would pass over another device’s rows.
- **`deletedAt` in a request** may be left out or null for a record that isn’t trash; the service
  stores none and answers none. The service doesn’t check that a row with a `deletedAt` is a trash
  record’s: it can’t see a record’s kind. The device that opens the row does (“Opening”).

### Approvals

| Request | From | The service checks | Then |
|---|---|---|---|
| `POST /approvals` with the approval’s id, the device’s id, platform, model, both public keys, and the MAC | signed in, not open | the account has a notebook; the id is 32 hex characters and unused; the device id has no entry; a small limit on approvals in progress | Kept for ten minutes |
| `GET /approvals/<id>` | signed in | nothing more | The request, when it was made and how the session that made it signed in, and the grant if there is one |
| `POST /approvals/<id>/grant` with `kid`, the card, `enc`, the ciphertext, and the MAC | open | the approval exists, is in time, and has no grant; `kid` is current | The grant is kept, with the device it came from |
| `POST /approvals/<id>/accept` with `kid` and the key proof | the session that made the request | a grant exists; `kid` is current and is the grant’s; the proof; the device id has no entry | The device is listed, with the grant’s card and keyring, as added by the granting device. The version moves. The session is open. The approval is deleted |

The service can’t check either MAC. It keeps them for the two devices, which can.

```text
POST /approvals
  { "id": "<32 hex>", "device": "<uuid>", "platform": "ios", "model": "iPhone 15",
    "public": "<65 bytes>", "sign": "<65 bytes>", "mac": "<32 bytes>" }
  → { "id": "<32 hex>", "expires": "<time, ten minutes on>" }

GET /approvals/<32 hex>
  → { "approval": { "id", "device", "platform", "model", "public", "sign", "mac",
                    "created": "<time>", "through": "passkey" or null, "expires",
                    "grant": null
                          or { "kid", "card": { "nonce", "ct" }, "keyring": { "enc", "ct" },
                               "mac", "by": "<the granting device's id>" } } }

POST /approvals/<32 hex>/grant
  { "kid": 2, "card": { "nonce", "ct" }, "keyring": { "enc", "ct" }, "mac": "<32 bytes>" }
  → { "id": "<32 hex>" }

POST /approvals/<32 hex>/accept     { "kid": 2, "proof": "<32 bytes>" }
  → { "kid": 2, "lists": 13, "session": { "open": true, "device": "<uuid>" } }
```

- **`platform`** is 1 to 16 characters and **`model`** 1 to 64, with no control character in
  either (a model is one of the request’s “lines”). Their values are the device’s to choose, as
  under “Device keys and device cards.”
- **The limit is 3 in progress for one account.** A fourth is `too_many` until one runs out, is
  accepted, or is dropped by a change of key.
- **An approval belongs to its account.** A session of another account is told `gone` for the same
  id, as it is for one that ran out or never was.
- **A second grant is `exists`.** Of two devices granting at once, one is answered.
- **`created`** is when the request was made, and **`through`** the `kind` of the way in of the
  session that made it (`passkey`, `apple`, `google`; on the preview, also `preview`), or `null`
  once that session has ended. The approving device shows both, against the answer’s `time`, so a
  reader can tell a request they didn’t make (Audit 9, SEC9-1). Neither is under the MAC: the
  service could misstate them, as it could leave a request out, and the code still guards the keys.
- **Accept is for the session that asked**, by its token and nothing in the request. Any other is
  refused by the rule `requester`; one sent before there is a grant, by the rule `no_grant`.

### Waiting seven days

A session that has proved the notebook’s key may delete the account at once. One that is signed in
and no more may only *ask*, and what it asks waits seven days, where every device of the reader’s
can see it and any device with the key can cancel it (under “Deleting the account” and “When a
reader loses every device”). An account has at most one request waiting.

| Request | From | The service checks | Then |
|---|---|---|---|
| `DELETE /account` | open | Apple’s refresh tokens are revoked first, if the account has any | Everything is deleted at once (under “Deleting the account”) |
| `DELETE /account` | signed in, on an account with no notebook | the same | The same: everything is deleted at once |
| `DELETE /account?platform=<kind>` | signed in, not open, on an account with a notebook | `platform`; none is already waiting | A request to delete is recorded: when, from what kind of device, through which kind of way in, and when it falls due, seven days on. Nothing else changes |
| `POST /notebook/replace` with `platform` | signed in, not open | the account has a notebook; the session is not open; `platform`; none is already waiting | A request to replace is recorded the same way. When it is carried out the service deletes the notebook’s records, keys, lists, and approvals, keeps the account and its ways in, and `POST /notebook` works again |
| `DELETE /waiting` | open, or the session that made the request | a request is waiting | It is canceled |

```text
DELETE /account                       (open, or no notebook)
  → { "deleted": true }

DELETE /account?platform=ios          (signed in, not open)
  → { "deleted": false,
      "waiting": { "what": "delete", "asked": "<time>", "due": "<time, seven days on>",
                   "platform": "ios", "through": "apple", "mine": true } }

POST /notebook/replace   { "platform": "web" }
  → { "waiting": { "what": "replace", "asked": "<time>", "due": "<time, seven days on>",
                   "platform": "web", "through": "google", "mine": true } }

DELETE /waiting
  → { "canceled": "delete" or "replace" }
```

- **`platform`** is 1 to 16 characters with no control character: the kind of device, in the
  device’s own word, as in an approval (`ios`, `android`, `web`). On `DELETE /account` it travels
  in the address, since not every HTTP client sends a body with `DELETE`; it is read only when the
  request has to wait. **A device that isn’t open always sends it.** A request that must wait and
  has none is `bad_request` with `field: "platform"`.
- **`through`** is the kind of the way in the asking session came through (`apple`, `google`,
  `passkey`; on the preview, also `preview`), which the service knows for itself, or `null` if
  that way in was removed since. With `platform` it is “from what kind of device”: the one is what
  the device said of itself, the other what the service saw.
- **`due` is `asked` plus exactly seven days.** The service carries out what is due once an hour,
  so a request is carried out within about an hour after `due`, later if Apple can’t be reached.
  **Until it is carried out it can be canceled**, a minute before `due` or twenty minutes after.
  Nothing is ever carried out before `due`.
- **While a request waits, nothing else changes.** Every device syncs, joins, and changes the key
  as before, and the request outlives the session that made it.
- **A second request while one waits is `exists` with `what: "waiting"`**, whichever kind either
  is and whichever session asks. Of two sent at once, one is recorded.
- **Canceling is for a session with the key, and for the session that asked.** Any other session
  without the key is `not_open`. Where none is waiting the answer is `gone` with
  `what: "waiting"`.
- **`POST /notebook/replace` from an open session** is `not_allowed` by the rule `already_open`,
  and on an account with no notebook `no_notebook`, each whatever it sent.
- **Deleting at once is one step.** The account goes only if the session is still open as the
  account is deleted. A session that was open when it asked and was closed while it was being
  answered (a change of key a moment before) is told `not_open`, and its request is never
  quietly turned into one that waits.
- **Apple first.** Before an account is deleted, at once or when due, each of Apple’s refresh
  tokens for its ways in is revoked. If Apple can’t be reached the account stays whole:
  `DELETE /account` answers `provider`, and a request that is due is tried again each hour. A
  request to replace revokes nothing, since the ways in stay.
- **After a deletion** every session of the account answers `sign_in`. The same Apple or Google
  account then signs in to a new, empty account (`created: true`); a passkey that was the
  account’s is `passkey_refused` with `reason: "unknown"`.
- **After a replacement** the account has no notebook: `notebook` is null, `kid` is 0, the lists’
  version has moved, `replaced` says when, and every session is signed in and no more. Each
  session’s proof is forgotten with the key it was for, so a device that proved the old notebook’s
  first key is not open on the new one’s. The next `POST /notebook` sets up as a first device does.

### How often a client may ask

The service counts requests **by the address they come from**, in two counts:

| Count | What is counted | Limit for one address |
|---|---|---|
| Beginning a sign-in | every `POST` under `/sign-in/` (on the preview, also `POST /preview/session`) | 60 in a minute |
| Everything else | every other request, with a session or without, a path that doesn’t exist included | 1,200 in a minute |

A request over the limit is refused before anything is read or written: status 429,
`{ "error": "slow_down", "retry": 60 }`, and the header `Retry-After: 60`. **A client waits that
many seconds before it sends anything of that kind again**, and never retries in a loop. The two
are counted apart, so an address that may not begin a sign-in still syncs.

- **The numbers are far above what a reader’s devices send.** A sign-in is two requests; a first
  sync of 50,000 records is about a hundred. The 1,200 is sized so that people behind one address
  (a household, a congregation on one network) don’t meet it. **The 60 is 30 sign-ins in a minute
  from one address**: a household never meets it, and a room of people asked to sign in together
  can, each refused device waiting its minute. Whether it should be higher is “Still open,” 68.
- **They are approximate.** The counting is Cloudflare’s, kept for each of its locations and not
  exact across them. A limit slows a client down; nothing’s safety rests on it. What must be
  exact is counted in the database: a session’s wrong proofs, an account’s approvals in progress.
- **The address is kept nowhere.** It is handed to Cloudflare’s limiter as a key for the length of
  one call. The service stores no address and logs none (under “What the service holds”).
- **Nothing in this version tells a person from a program at sign-up.** A passkey or a provider
  account is needed to make an account, and the limit above bounds how fast. Whether the website’s
  sign-in page and the apps should prove more is “Still open,” 68.

### Signing in

Built in step 4e (2026-11-24). **Signing in tells the service which account a device belongs to,
and opens nothing.** Every request here ends in a session that is signed in, which becomes open
only by the key proof (under “The account”) or by joining. Nothing here carries a key, a keyring,
or a record.

**Three ways in, each on only where the deployment configures it.** A way that is off answers
`not_found` on every path of its own, exactly as a path that was never written does. `GET /sign-in`
says which are on, in the order a client might show them:

```text
GET /sign-in
  → { "ways": ["passkey", "apple", "google"],
      "turnstile": "<Turnstile's site key>" }      only where the check is on
```

On the preview today it answers `["passkey"]`. **`turnstile` is there only where the deployment
checks a Cloudflare Turnstile token before a new account** (below, and “Still open,” 86): it is
the site key a browser shows the widget with, public by design. Where the check is off the member
is absent. A client that shows no widget (an app) ignores it. **Sign in with Apple and with Google are built and
off**: their client ids come from BDR’s Apple developer account and Google Cloud project, none is
configured, and none is guessed (“Still open,” 41). They have been tested against stand-ins for
the two providers and against neither provider itself.

**Every sign-in answers a challenge the service made**: 32 random bytes, good once and for five
minutes. A passkey signs it. Apple and Google carry it back as the identity token’s `nonce`. So
nothing captured from one sign-in can be played again.

| Request | From | The service checks | Then |
|---|---|---|---|
| `GET /sign-in` | anyone | nothing | Answers which ways to sign in are on |
| `POST /sign-in/passkey/options` | anyone | nothing | A challenge, inside the options a client passes to its platform to use a passkey |
| `POST /sign-in/passkey` with the passkey’s response | anyone | its form, and that it carries no PRF result; the client data’s type, and that it wasn’t made in another site’s frame; the challenge; the origin; that the passkey is one the service knows; the user handle, if one came; the authenticator data (the relying party, presence, verification, the backup flags); the signature; that the counter went forward | A session for the passkey’s account |
| `POST /sign-in/new-passkey/options`, with `{ "turnstile": "<token>" }` from a browser where the check is on | anyone | where Turnstile is on and the request carries an `Origin` header: the token, with Cloudflare, before anything else is done; otherwise nothing | A challenge and a new user handle, inside the options for making a passkey |
| `POST /sign-in/new-passkey` with the new passkey’s response | anyone | the same as far as the origin; then the attestation object’s form; the authenticator data; that the credential id named is the one made; the public key’s algorithm and form; that no account has the passkey | A new account with the passkey as its one way in, and a session |
| `POST /sign-in/challenge` | anyone | nothing | A challenge for Apple or Google to carry back |
| `POST /sign-in/apple` with the challenge, the identity token, and Apple’s authorization code | anyone | the form; the challenge; the token’s signature under Apple’s published keys, then its issuer, audience, times, nonce, and subject; then, the first time through each client, that Apple trades the code for a refresh token | A session for the account that Apple account signs in to, or for a new account if there is none |
| `POST /sign-in/google` with the challenge and the identity token | anyone | the form; the challenge; the token, as for Apple, under Google’s keys | The same |

```text
POST /sign-in/passkey/options
  → { "publicKey": { "challenge": "<32 bytes>", "rpId": "litbible.net",
                     "timeout": 300000, "userVerification": "required" },
      "expires": "<time>" }

POST /sign-in/new-passkey/options
  { "turnstile": "<the widget's token>" }      only a browser's, and only where the check is on
  → { "publicKey": {
        "rp": { "id": "litbible.net", "name": "LIT Bible" },
        "user": { "id": "<32 bytes>", "name": "LIT Bible notebook",
                  "displayName": "LIT Bible notebook" },
        "challenge": "<32 bytes>",
        "pubKeyCredParams": [ { "type": "public-key", "alg": -7 },
                              { "type": "public-key", "alg": -257 } ],
        "timeout": 300000,
        "excludeCredentials": [],
        "authenticatorSelection": { "residentKey": "required", "requireResidentKey": true,
                                    "userVerification": "required" },
        "attestation": "none" },
      "expires": "<time>" }

POST /sign-in/challenge
  → { "challenge": "<32 bytes>", "expires": "<time>" }

POST /sign-in/passkey       { "credential": <an authentication response> }
POST /sign-in/new-passkey   { "credential": <a registration response> }
POST /sign-in/apple         { "challenge": "<32 bytes>", "idToken": "<the token>",
                              "code": "<Apple's authorization code>",
                              "redirect": "<an https address>" (only if the client's flow used one) }
POST /sign-in/google        { "challenge": "<32 bytes>", "idToken": "<the token>" }
  → { "token": "<43 characters>", "expires": "<time>", "created": false,
      "way": { "id": "<uuid>", "kind": "passkey", "added": "<time>",
               "credential": "<bytes>", "syncs": true } }
```

- **Turnstile, before a new account** (step 4h; the design is Claude’s, for BDR to confirm:
  “Still open,” 86). The check is on only where the deployment holds both `TURNSTILE_SITE_KEY`
  and the secret `TURNSTILE_SECRET`; with either missing nothing here changes. Where it is on,
  `POST /sign-in/new-passkey/options` **from a request that carries an `Origin` header** must
  carry `turnstile`, the widget’s token, as text of 1 to 2,048 characters. The service asks
  Cloudflare’s siteverify about it (with the address the request came from) before a challenge
  is made or anything is written, and after the limit on beginning a sign-in is counted. A
  missing, malformed, or refused token is `not_allowed` by the rule `turnstile`; Cloudflare out
  of reach, answering other than 200, answering something unreadable, or refusing for a reason
  that is the deployment’s own (a secret it doesn’t know, most of all) is `provider` with
  `which: "turnstile"`. A token is good once, so a client that is refused gets a new one from
  the widget before it asks again. **A request with no `Origin` (an app’s) is not checked, and
  its body is not read**, as before. Only a browser sends `Origin`, and Turnstile needs a
  browser, so until the apps attest themselves **a program can skip the check by sending no
  `Origin`**: this closes the website’s door and leaves the apps’ open. Every other sign-in
  request, `POST /sign-in/new-passkey` included, is unchanged.
- **Every sign-in answers the same four members**: `token`, the session, shown this once;
  `expires`; `created`, true when this request made the account; and `way`, the way in that was
  used, as `GET /account` lists it. The session is signed in. On an account with a notebook the
  client goes on to open it: `POST /session/proof` from a device that has an entry and the key,
  and otherwise by joining (a passkey holder, approval, or the recovery code).
- **A challenge is used up by the first request that reaches it, whatever follows**, so a client
  that is refused asks for a new one. A request refused for its form, for a PRF result, or for
  what its client data says of itself (`client_data`, `type`, `cross_origin`) never reaches the
  challenge and leaves it unused. A challenge that ran out,
  was used, was made by another of the three `options` requests or by `POST /sign-in/challenge`
  for a different kind of sign-in, or never was is `gone` with `what: "challenge"`.
- **The options are in the standard’s JSON form** (WebAuthn Level 3,
  `PublicKeyCredentialRequestOptionsJSON` and `PublicKeyCredentialCreationOptionsJSON`). A browser
  passes `publicKey` to `PublicKeyCredential.parseRequestOptionsFromJSON` or
  `parseCreationOptionsFromJSON`; Android passes it to Credential Manager as text; an iOS app reads
  the members AuthenticationServices asks for. **A client adds one thing itself:
  `extensions.prf`, with the fixed input** (under “The passkey”). The service never sends a PRF
  input, and a client never takes one from it. The sign-in options name no passkey
  (`allowCredentials` is left out), so the platform offers the reader the passkeys it has for
  `litbible.net`.
- **The response is in the standard’s JSON form too**, what `PublicKeyCredential.toJSON()` makes
  (`AuthenticationResponseJSON`, `RegistrationResponseJSON`):
  `{ "id", "rawId", "type": "public-key", "response": { … }, "clientExtensionResults": { … } }`,
  where `response` is `{ "clientDataJSON", "authenticatorData", "signature", "userHandle" }` for a
  passkey that signs in and `{ "clientDataJSON", "attestationObject" }` for a new one, every byte
  string base64url. The service reads `id`, `type`, those members of `response`, and
  `clientExtensionResults.prf`. `rawId`, if it is sent, must equal `id`; `userHandle` may be left
  out, null, or empty; every other member is ignored.
- **A response that still carries a PRF result is refused, whole and first.** If
  `clientExtensionResults.prf` has a `results` member at all, the request is `not_allowed` by the
  rule `prf_results`, before the challenge is used or anything else is read. The standard’s
  `toJSON()` includes the PRF’s output unless the client takes it out, and that output is the
  secret a passkey holder is sealed under (under “The passkey”). A client removes `results`, and
  only `results`, before a response leaves the device, on every platform.
- **The origin.** The client data’s `origin` must be one the deployment accepts. The preview
  accepts `https://litbible.net`, which is the website’s origin and also what a passkey used from
  an iOS app answers with, and the Android app as Android names it: `android:apk-key-hash:`
  followed by the base64url, unpadded, of the SHA-256 of the app’s signing certificate, for each
  of the two certificates the site’s `assetlinks.json` lists for `com.litbible.app`. A response
  made inside another site’s frame (`crossOrigin: true`) is refused.
- **On the preview only, a page on the developer’s own machine may use a passkey**:
  `http://localhost:4321`, the website’s dev server, with the relying party `localhost` (a browser
  allows no other there). The service answers options with `"rpId": "localhost"` to a request
  whose `Origin` header is that address. A passkey made there is a `localhost` passkey and signs
  in from nowhere else. Production is never given this, and the service reads the setting only
  where the deployment names itself the preview.
- **A passkey made on the preview from the website or an app is a real `litbible.net` passkey**
  in the tester’s password manager. After the preview is wiped it signs in to nothing, and the
  tester deletes it there.
- **What a passkey is asked for**: discoverable (`residentKey: "required"`); user verification
  required when it is made and each time it is used, and a response without it is refused; a key
  for ES256 (P-256) or RS256 (RSA of 2,048 bits or more), and no other; no attestation. The
  attestation statement is not read, whatever format it comes in: the service never judges the
  make of a reader’s passkey.
- **What the service keeps of a passkey**: its credential id, its public key, its signature
  counter, and whether it is the kind that syncs. That last is the authenticator’s “backup
  eligible” flag, read when the passkey is made and fixed from then on, and it is the `syncs`
  every other request reads: only a passkey that has it can hold the notebook’s key (under
  “Holders”). A sign-in whose flag differs from the stored one is refused.
- **The user handle** is 32 random bytes the service makes for the account and uses for nothing
  else. **An account has one**, and every passkey of the account is made under it. The standard
  has an authenticator keep one passkey for a relying party and a user handle, so a second made in
  the same password manager may replace the first there; that is why adding one names the
  account’s passkeys in `excludeCredentials` (under “Ways to sign in”), so the platform says the
  reader already has one. **The name a passkey shows in the reader’s password manager is “LIT
  Bible notebook,” the same for every account**, since the service holds no name or address to
  show.
- **The counter.** A passkey that keeps none sends 0 every time, as synced passkeys do, and that
  is accepted. One that counts must send a number higher than the last, checked and written as one
  step; one that doesn’t is refused (`counter`), which is what a copied authenticator looks like.
- **`passkey_refused` (403) carries `reason`**, the check that failed: `client_data`, `type`,
  `cross_origin`, `origin`, `unknown` (no account has this passkey), `user` (the user handle isn’t
  the account’s), `attestation`, `authenticator_data`, `rp`, `presence`, `verification`, `backup`,
  `credential` (the id named isn’t the one made), `algorithm`, `key`, `signature`, and `counter`.
  A client treats them alike but for `unknown`, where it can offer to make an account; the word is
  for a developer’s log.
- **Apple and Google: the token.** `idToken` is the identity token the provider gave the client,
  asked for with the service’s challenge as its nonce. The service checks its RS256 signature
  under the provider’s published keys, then `iss` (Apple’s `https://appleid.apple.com`; Google’s
  `https://accounts.google.com` or `accounts.google.com`), `aud` (one of the client ids the
  deployment lists, and the only audience), `exp` and `iat` (a minute’s grace each way), `nonce`
  (**equal to the challenge, character for character**), and `sub`. **`token_refused` (403)
  carries `reason`**: `form`, `algorithm`, `key`, `signature`, `issuer`, `audience`, `expired`,
  `issued`, `nonce`, `subject`, and for Apple `code`.
- **Apple: the code.** `code` is the authorization code Apple gave with the token. The first time
  an Apple account signs in through each client id (the iOS app’s, the website’s), the service
  trades the code with Apple for a refresh token **before it writes anything**, so an account is
  never made with an Apple way in that the service couldn’t later revoke. It keeps that token for
  one purpose, to revoke it when the way in is removed or the account is deleted, and never uses
  it otherwise. Every Apple sign-in sends a code, and the service spends it only when it holds no
  token for that client. `redirect` is the redirect address the client’s own flow used, if it used
  one (a web page’s does; an app’s has none), since Apple asks for the same one back. A code Apple
  won’t take is `token_refused` with `reason: "code"`.
- **`provider` (502), with `which`**, means Apple or Google couldn’t be reached or answered
  wrongly: their keys couldn’t be fetched, or Apple didn’t answer for the code. Nothing was
  written, the challenge is spent, and the client starts the sign-in again later.
- **No name and no email address** is read from a token, kept, or logged, even when the provider
  sends one. The service keeps `sub` and nothing else from it.
- **A provider account or a passkey that is no account’s way in.** For Apple and Google the
  sign-in makes a new account (`created: true`), with no notebook: there is no separate “sign up.”
  That includes a provider account that was once a way in and was removed. A passkey the service
  doesn’t know is refused (`unknown`); an account is made with a passkey only by the two
  `new-passkey` requests. **A client reads `created`**, and tells a reader who expected their
  notebook that this is a new, empty account.
- **Signing in never joins two accounts.** A reader who made one account with Apple on a phone and
  another with a passkey on a computer has two, and adding either way in to the other account is
  refused (`exists`) while both stand. Joining accounts is not in version 1 (“Still open,” 55).
- **Two devices signing in at once with a provider account that is new** make one account: the
  second finds the first’s. **A sign-in that meets the removal of its own way in** gets no session:
  it is told `unknown` (a passkey) or `busy`, and the next try finds the way gone.

### Ways to sign in

Built in step 4e (2026-11-24): several ways in to one account (“Add another way to sign in”).

**The rule every request here keeps: once an account has a notebook, adding or removing a way in
needs an open session**, one that has proved the notebook’s key. A sign-in alone is not enough, so
someone who steals a reader’s Apple or Google sign-in can’t add a way in of their own and stay, or
take the reader’s away. Before there is a notebook there is nothing to protect, and a signed-in
session may. As everywhere, the session is checked before the body is read: a signed-in session on
an account with a notebook is told `not_open` whatever it sent.

| Request | From | The service checks | Then |
|---|---|---|---|
| `POST /ways/passkey/options` | open; or signed in, on an account with no notebook | nothing more | A challenge good for this account alone, inside the options for making a passkey: the account’s own user handle, and its passkeys in `excludeCredentials` |
| `POST /ways/passkey` with the new passkey’s response | the same | everything `POST /sign-in/new-passkey` checks, against a challenge made for this account; that no account has the passkey; that the account has fewer than 20 ways in | The passkey is a way in. The lists’ version moves |
| `POST /ways/apple` and `POST /ways/google`, with what the sign-in request carries | the same | everything the sign-in request checks; that the provider account isn’t a way in to any account; fewer than 20 ways in; for Apple, that the code is traded | The provider account is a way in. The lists’ version moves |
| `DELETE /ways/<id>` | the same | the way is one of this account’s; it isn’t the last that can sign the reader in; it isn’t a passkey that has a holder; for Apple, that Apple revokes the refresh tokens kept for it | The way is removed, and every session that came in through it is ended but this one. The lists’ version moves |

```text
POST /ways/passkey/options
  → { "publicKey": { … as POST /sign-in/new-passkey/options answers, with the account's own
                     "user": { "id": … } and
                     "excludeCredentials": [ { "type": "public-key", "id": "<bytes>" }, … ] },
      "expires": "<time>" }

POST /ways/passkey   { "credential": <a registration response> }
POST /ways/apple     { "challenge", "idToken", "code", "redirect" (only if used) }
POST /ways/google    { "challenge", "idToken" }
  → { "way": { "id": "<uuid>", "kind": "passkey", "added": "<time>",
               "credential": "<bytes>", "syncs": true },
      "lists": 8 }

DELETE /ways/<id>
  → { "lists": 9 }
```

- **A change to the ways in moves the lists’ version**, and is checked and written as one step
  against it. These requests carry no `lists` of their own, so a client need not fetch the lists
  to add a way in, and each answers the new version. Moving it is what keeps the requests that
  read an account’s passkeys (`POST /notebook`, `POST /holders`, `POST /notebook/key`) from giving
  the key to a passkey that was removed a moment before: such a request is run again and refused
  (`passkey_unknown` or `lists_changed`). **So the lists’ version can move when neither list
  changed**, and a client that is told `lists_changed` fetches and starts again, as always.
- **A challenge from `POST /ways/passkey/options` is good for the account that asked**, and for
  that request alone. Answered from another account’s session, or sent to
  `POST /sign-in/new-passkey`, it is `gone`, and spent.
- **A new passkey is a way in, and holds nothing.** It becomes a holder only when a device that
  has the key adds one for it (`POST /holders`), which the same screen may do next, and only if
  `syncs` is true.
- **`exists`**: `what: "passkey"` for a passkey that is a way in already, to this account or
  another; `what: "way"` for an Apple or Google account that is. Which account has it is never
  said. For Apple, nothing is asked of Apple for a way in that can’t be added.
- **The last way in.** Removing the only way that can sign the reader in is refused by the rule
  `last_way`. Of two removals sent at once on an account with two ways, one is refused.
- **A passkey that holds the key** is refused by the rule `passkey_holds_key`. The client removes
  it as a holder first, which is a change of key (`POST /notebook/key` with the holder in
  `removeHolders`), and then removes the way in.
- **Removing a way in ends the sessions that came in through it**, open or not, all but the one
  asking. Their devices keep their entries and their keys, since removing a way in is not removing
  a device: each signs in again by a way that remains and proves the key.
- **Apple.** Before an Apple way in goes, the service revokes with Apple each refresh token it
  holds for it. If Apple can’t be told, the request is `provider` (502), nothing is removed, and
  the client tries again later. A Google way in has nothing to revoke.
- **A way in that isn’t this account’s** (another account’s, one already removed, an id in the
  wrong form) is `gone` with `what: "way"`. A twentieth way in is the last: the next is
  `too_many` with `what: "ways"`.

### The preview’s way in

**On the preview only, and never part of the interface.** It was built before sign-in (step 4c)
and stays beside it (step 4e changed neither request), because a client under test needs accounts
without a ceremony and Sign in with Apple and with Google are off until their client ids arrive.
The preview service hands a session for a named test account to whoever holds the preview’s
secret. Both requests answer `not_found`, exactly as a path that was never written does, unless
the deployment’s own configuration turns them on, names itself the preview, and has the secret.
Production is given none of the three.

```text
POST /preview/session    { "secret": "<the preview's secret>", "account": "<a made-up name>" }
  → { "token": "<43 characters>", "expires": "<time>" }

POST /preview/passkeys   { "credential": "<1 to 1,023 bytes>", "syncs": true }
  → { "id": "<uuid>", "credential": "<bytes>", "syncs": true }
```

- **An account’s name** is 1 to 64 of `A`–`Z`, `a`–`z`, `0`–`9`, `.`, `_`, and `-`: a label for a
  test, never a person’s name or address. The same name is always the same account, so several
  devices under test share one by sharing a name, and a new name is a new, empty account.
- **`/preview/passkeys`** lists a passkey as one of the account’s ways in with no ceremony, so a
  client can run the passkey holder’s checks without a real passkey. It follows the rule the real
  request does: once the account has a notebook, it needs an open session. **A passkey listed this
  way has no public key**: it can hold the key if `syncs` is true, it can sign no one in, it
  doesn’t count as a way that can when the last way in is being removed, and listing it doesn’t
  move the lists’ version, as it didn’t before step 4e. A real passkey with the same credential id
  can’t then be added to that account (`exists`).
- **A way in of the kind `preview`** is what `/preview/session` makes, one for each test account.
  An account made this way can add a real passkey (`POST /ways/passkey`) and then be signed in to
  by it.
- **Everything on the preview is test data and may be wiped at any time.**

### What the service answers when it refuses

Each refusal is one word in `error`, with the HTTP status beside it. What else the body carries is
there to save the client a request.

| `error` | Status | Also carries | What it means, and what a client does |
|---|---|---|---|
| `sign_in` | 401 | `reason: "wrong_proofs"` after a fifth wrong proof | No session, or one that ran out or was ended. **Sign in again** |
| `not_open` | 403 | `kid`, the current one | The session hasn’t proved the current key. **Fetch the keyring, check it, prove** |
| `old_key` | 409 | `kid`, the current one | The request named or was sealed under a key that is no longer current. **The same** |
| `wrong_proof` | 403 | `left`, the tries left | The proof isn’t the current key’s. The device’s keyring is wrong or behind |
| `lists_changed` | 409 | `lists`, the current version | **The lists changed.** Fetch them and start the step again |
| `already_set_up` | 409 | `notebook`, its id | The account has a notebook. **Join it instead** |
| `no_notebook` | 409 | | The account has none yet. Set one up |
| `exists` | 409 | `what`: `device`, `holder`, `recovery`, `passkey`, `approval`, `grant`, `way`, or `waiting` | That id, or the one thing of that kind, is already there. For `passkey` and `way` under “Signing in” and “Ways to sign in”: it is some account’s way in already. For `waiting`: a request to delete or replace is already waiting |
| `gone` | 410 | `what`: `device`, `holder`, `approval`, `challenge`, `way`, or `waiting` | **Gone**: an approval ran out, a device has no entry, the holder a device came in through was removed, a sign-in challenge ran out or was used, a way in isn’t this account’s, or no request is waiting to cancel |
| `not_found` | 404 | `what: "keyring"` from `GET /keyring` | No such path, a way to sign in that is off here, or no sealed keyring for that device |
| `bad_request` | 400 | `field`, the member at fault (`device.card.nonce`, `holders[0].kind`, `put[2].kid`, `credential.response.signature`, `idToken`, `Content-Type`, `body`) | The request isn’t in the form above. A fault in the client |
| `not_allowed` | 422 | `rule`, below | The request is well formed and breaks a rule of the interface |
| `passkey_refused` | 403 | `reason`, the check that failed (under “Signing in”) | A passkey’s answer didn’t pass. **Start the sign-in again** from new options; for `unknown`, the service has no such passkey |
| `token_refused` | 403 | `reason`, the check that failed (under “Signing in”) | An identity token from Apple or Google, or Apple’s code, didn’t pass. **Start the sign-in again** |
| `provider` | 502 | `which`: `apple`, `google`, or `turnstile` | Apple, Google, or Cloudflare’s Turnstile check (under “Signing in”) couldn’t be reached, or answered wrongly. Nothing was written. Try again later (for `turnstile`, with a new token) |
| `too_large` | 413 | `limit` | **Too large**: a body over 4,194,304 bytes, or more than 500 rows in one request |
| `too_many` | 429 | `what`: `devices`, `holders`, `approvals`, or `ways`; `limit` | A list is full, or three approvals are in progress |
| `slow_down` | 429 | `retry`, the seconds to wait; and the header `Retry-After` | This address has asked too often (under “How often a client may ask”). **Wait that long**, then send it again |
| `busy` | 503 | | The notebook changed three times while the request was being checked, or a way in was removed while a sign-in through it was being checked. Send it again (a sign-in: start it again) |
| `error` | 500 | | The service failed. Send it again later |

The rules a `not_allowed` names: `holder_needed` (a notebook always has a holder), `one_recovery`,
`one_holder_per_passkey`, `passkey_unknown` (the credential isn’t one of this account’s passkeys),
`passkey_not_synced`, `distinct_ids`, `own_device`, `every_device` and `every_holder` (a change of
key must name each one the service has, once), `keep_own_device`, `already_open` (a device that
has the key has no approval to ask for, and no notebook to replace), `requester`, `no_grant`, and from step 4e `prf_results`
(a passkey’s response still carries the PRF’s output), `last_way` (the last way that can sign the
reader in can’t be removed), and `passkey_holds_key` (remove the passkey as a holder first); and
from step 4h `turnstile` (where the check is on, a browser’s request to begin a new account
carried no Turnstile token, one that isn’t text of 1 to 2,048 characters, or one Cloudflare
refused: get a new token from the widget and ask again).

**“Conflict” is not a refusal**: it is one row’s answer inside a `POST /rows` that was answered
200 (above). **“Waiting” is not a refusal either**: a request that must wait is answered 200 with
`waiting`, and every session reads it in `GET /account`. The
preview’s way in adds one word of its own, `preview_secret` (401).

## Later

- **Enforcing signatures**, with the keys every device already has (under “The signing key”).
- **A security key as a holder**, for a reader who would rather carry the key than sync it.
- **Moving a holder’s anchor forward** whenever a device that has the keyring uses the passkey, so
  that an anchor never stays older than the last removal for long.
- **A trusted contact** who can approve a device (as Apple offers) would fit as one more holder.
- **The passphrase lock** for a shared computer, and **“Connect your phone”** (both under “Where
  each client keeps its keys” and “The link”), after February 10.
- **A post-quantum key exchange**, when all three platforms have one.

## Sheet links

Short links for shared sheets on the service (`STUDY-DESK.md`, M14) are undecided (the call,
2026-11-23: “let’s brainstorm”). If they come, a shared sheet is sealed under a fresh random key
carried in the link after the `#`, as `share1.` links carry the whole sheet today. It would use
nothing from the notebook’s keys, so sharing one sheet could never open the notebook. Nothing in this
file depends on that choice.

## The test vectors

As with the anchor text and the merge rules, **one file of known inputs and outputs that all three
clients run in their own tests.** BVJ’s side wrote it (BVJ, 2026-11-23), in step 4b, built the
same day against draft 2 as written. **The reference is the code the website ships**, not a second
copy under `scripts/`:

- `src/lib/desk-crypto.mjs`: the reference. Pure, on WebCrypto, with no storage and no network, so
  the website’s connector, the vector builder, and the tests all import the same functions. Every
  random input is an argument with a random default, which is how the builder fixes each one.
- `scripts/build-notebook-crypto-vectors.mjs` (`npm run build:notebook-crypto-vectors`): writes the
  file. On demand only, and the file is committed, like `build:anchor-vectors`. Running it twice
  gives the same bytes. `scripts/lib/p256-fixed.mjs` does the two things WebCrypto can’t, for
  vectors only: a public key from a private scalar, and a signature with a chosen number.
- `test/fixtures/notebook-crypto-vectors.json`: the vectors. Both apps fetch it from this repo, as
  they do the anchor vectors. Its `vectorsVersion` moves whenever a value in it does.
- `test/fixtures/published-crypto-vectors.json`: the few published cases the reference is run
  against first, each with its source named (below).
- `test/desk-crypto.test.js`: checks the file against the reference, in `npm test` and in
  `npm run test:desk`: the published cases first; then that the committed file is byte for byte
  what the builder makes; then every group, from each case’s `given` to its `expected`; then
  `node:crypto` as a second implementation on the file’s own values; then, with real randomness,
  that what the reference seals, it opens.

**The file is not only the reference agreeing with itself.** Before any of LIT’s own vectors, the
reference’s primitives pass published ones, committed with their sources so no test reaches the
network:

| What | Source | What it covers, and doesn’t |
|---|---|---|
| HKDF-SHA-256 | RFC 5869, Appendix A.1 to A.3 | Extract and expand, with a salt, a long input, and the empty salt this file writes as 32 zero bytes |
| HMAC-SHA-256 | RFC 4231, test cases 1 to 7 | Short and long keys and data, and the truncated case |
| AES-256-GCM | Project Wycheproof, `aes_gcm_test.json` (eleven cases with a 256-bit key and a 96-bit nonce, at a named commit) | Seven that must seal and open exactly, with and without AAD and plaintext, and four that must not open (a changed tag). Not other nonce or tag sizes, which this file never uses |
| HPKE, the notebook’s exact suite | The CFRG’s full vector file for RFC 9180 (`test-vectors.json` in `cfrg/draft-irtf-cfrg-hpke`, at a named commit): base mode, KEM `0x0010`, KDF `0x0001`, AEAD `0x0002` | The shared secret, the key schedule, and the seals at sequence numbers 0, 1, 2, 4, 255, and 256, from both the sender’s and the recipient’s side. **RFC 9180’s printed appendix has no case for this suite**, so this file, which the RFC names as the home of its full set, is the published source. Not the PSK and Auth modes, the export interface, or deriving a key pair from a seed, none of which the notebook uses |
| HPKE, the nearest suite the RFC prints | RFC 9180, Appendix A.3.1 (the same KEM and KDF with AES-128-GCM), compared with the RFC’s own text | The same code with one parameter changed, so the hand-written KEM and key schedule are held to the RFC’s page as well as to the CFRG’s file |

On top of those, LIT’s own values are checked against `node:crypto`, a second implementation, in
the builder as each is made and again in the test on the committed file: the `hkdf` group’s
outputs, each record `seal` made (sealed by the one, opened by the other), the key agreement
behind an HPKE seal, every key pair’s public key, both approval MACs, and the signatures in both
encodings. No published vector exists for the notebook’s own constructions (a row’s AAD, a card, a
holder, an approval), which is what the file is for.

**How the file is written.** Every random input (keys, nonces, codes, a passkey’s PRF output, the
sender key of each HPKE seal) is fixed and written into the file, every private key comes with its
public key, and byte strings in it are lowercase hex. That includes a row’s `nonce` and `ct`, which
the service carries in base64url. The exceptions are inside text this file defines: a `plaintext`
(JSON as it is sealed) and a MAC’s input carry their byte strings in base64url, as on a device.
Each case has a `why`, a `given`, and an `expected`, and a case that must be refused has
`expected.refused` with a word from the file’s `refusals` list, plus `aside: true` or a holder’s
`check` where the two kinds of refusal differ. **To reproduce a ciphertext a client seals the
`plaintext` given, byte for byte**; what it makes with its own JSON writer differs, and it checks
that by opening it again. Each group says what it tests:

| Group | Given | Expected |
|---|---|---|
| `hkdf` | an input and each label | each derived key |
| `keyProof` | a notebook key | the proof, and the hash the service stores |
| `recoveryCode`, `approvalCode` | bytes; typed forms (lowercase, spaces, `O`, `I`, `L`; a tab, line breaks, dashes, no-break and zero width spaces, and every removed character at once; an underscore, a full stop, a fullwidth digit, a look-alike letter, `U`, too few and too many characters); for the recovery code, groups typed back | the text; the bytes, or the refusal and why; whether a typed group matches |
| `base64url` | byte strings of several lengths; text with padding, `+`, `/`, a space, an impossible length, leftover bits | the text; refused |
| `seal` | a record’s serialized text, a notebook key, `kid`, nonce | the row, the AAD (as text and as bytes), the padded length, the ciphertext, exactly. Records of several kinds, a trash record, text beyond ASCII, a record that takes no padding, one record written with its keys in another order; refused: a record whose `id` holds a line feed |
| `open` | the rows `seal` made, and rows a client must also accept (times written two ways for one instant, a `null` `deletedAt`, an older `kid` the device still holds) | the record |
| `openRefused` | a row with one byte or one plain field changed, the wrong key, a wrong length, bytes that aren’t JSON, a record whose `id`, `modified`, or `deletedAt` disagrees with the plain fields, an unknown `v`, a `kid` not held | a refusal, which, and whether it means “aside” |
| `padding` | lengths around each multiple of 256, and at both ends | the padded length and the ciphertext’s; refused: 0, and one byte past the ceiling |
| `keyring` | valid and invalid keyrings (a `kid` missing from 1 to `current`, one repeated, a short key, an unknown `lit` or `v`); for a device holding given keys, keyrings from the service that drop a key, change a key’s bytes, name another notebook, or go backward | accepted, or the refusal and why |
| `hpkeOpen` | a private key and its public key, `enc`, a ciphertext; the same with a byte changed, the wrong recipient, an `enc` off the curve | the keyring, with the shared secret, key, and nonce along the way; refused |
| `card` | a notebook key, a card with `public` and `sign`, its AAD fields; a card with a field this version doesn’t know, sealed again under a new key; cards a client won’t write | the sealed card; refused under another device’s id, another notebook, another `kid`, and as a holder’s card; the unknown field still there |
| `holderCard` | a notebook key, a holder card of each kind, its AAD fields | the sealed card; refused under another holder’s id, and as a device card |
| `prf` | the fixed input | its bytes, its base64url (as Android’s request JSON carries it), and the hashed form the standard sends to the passkey; a passkey response with `prf.results`, and the same response as it may be sent to the service |
| `passkeyHolder` | a PRF output, a nonce, a holder record, the keyring sealed to it | the passkey key; the sealed record and its opening; the keyring accepted. Refused, with the check that stops it: the wrong PRF output; a record of the other kind or another id; a `credential` that isn’t the passkey that answered; a keyring that lacks the anchor’s key, holds other bytes for it, or names another notebook |
| `recoveryHolder` | a code, a nonce, a holder record, the keyring sealed to it | the same, from the code key |
| `approval` | a code, a request with both public keys, a grant | the approval id and both MACs, with each MAC’s input as text; the grant accepted. Refused: a key, the model, the device id, or the MAC of the request changed; `enc`, the ciphertext, the `kid`, or the MAC of the grant changed; a grant whose `kid` isn’t its keyring’s; a card for another device or with other keys |
| `signingKey` | a P-256 signing key pair; a message and its signature as `r ‖ s`; the same signature in DER | the public key as `sign` carries it; the signature verified; a changed byte refused; each form converted to the other; DER that isn’t strict refused |
| `point` | public keys on and off the curve, compressed, too short, with a coordinate past the field’s size | accepted, or refused |
| `walkthrough` | a first device under “follows my account,” a second joined by passkey, a third approved, the first removed, a switch to “this device only” with a recovery code made, a recovery by code, forged keyrings | every value along the way, and each forgery refused |

HPKE makes a fresh key pair each time it seals, ECDSA a fresh number each time it signs, and
CryptoKit can be handed neither, so the HPKE cases run in the opening direction and the signing
cases in the verifying one. The sender’s key and the signing number are in the file all the same,
for a client that can fix them. Each client also checks that what it seals, it opens, and what it
signs, it verifies.

**What the vectors can’t reach:**

- **The passkey itself.** No test can ask Apple’s or Google’s passkey for its secret. `prf` and
  `passkeyHolder` start from the 32 bytes. That every client gets the *same* 32 bytes from one real
  passkey is a test on real devices (under “Still open”).
- **Where each client keeps its keys.** A non-extractable `CryptoKey`, the Keychain, the Keystore,
  and what a backup copies are each platform’s to test.
- **The service.** What it checks, the key proof as a request, and sessions are tested with the
  service (step 4c). The vectors give the proof and its hash, and the rows a service must accept.
- **Randomness.** The file fixes every random input. That a client’s own nonces, keys, and codes
  come from the platform’s random source is for its own review.
- **A holder record whose `public` isn’t `d`’s** (under “Holders”).

## Departures from earlier documents

1. **The reader chooses whether the key follows their account, and a passkey carries it.** BDR’s
   proposal (§9) described the key “synced by iCloud between a reader’s Apple devices,” and draft 1
   kept the key on the device only. Neither puts a LIT key in iCloud Keychain now (under “iOS”).
2. **Only a client can drop a trash record’s copy after 30 days.** The proposal’s sketch (§7) had the
   service drop it. Under encryption the service can’t open a trash record, so the first device to
   drop the copy pushes the tombstone (under “Opening”).
3. **The row gains `v`, `kid`, and `nonce`** beside the agreed plain fields. Additions, not changes.
   They are in the format’s “How each store holds the records” since the freeze work (step 4d,
   2026-11-24), which lists the row’s fields and points here for the rest.
4. **The service doesn’t apply the format’s cap on a clock running ahead.** The format says “a sync
   service’s cap is its own clock.” Under encryption the service can’t clamp a sealed time, so each
   receiving device caps against its own clock (under “A record on the service”). The format’s
   sentence changes with the freeze work, if BDR agrees. BVJ said yes on 2026-11-23, with a merge
   test added in the same step: two devices whose clocks differ must still agree on which edit
   wins. **Step 4d changed the sentence and added the test** (2026-11-24; for BDR to confirm):
   merge vectors version 9, and the format’s “Clocks,” “Two devices whose clocks differ,” which
   says what the agreement comes to. Within the format’s five minutes of skew the two agree at
   once; further apart, once the slower clock reaches the stamp, the faster clock’s edit winning;
   and an exact tie in `modified`, which differing clocks make likely, is settled only by `rev`.
5. **Passkeys are part of the launch**, where the call had them “if the schedule holds.”

## Order of work

The plan is `STUDY-DESK.md`, “Order of work,” 4, steps 4a to 4l. What this file is to each:

1. **4a, this draft.** BDR’s Claude reviews it, and BDR confirms or changes the calls marked “for
   BDR to confirm.” Answers go in `STUDY-DESK-FOR-THE-APPS.md`, under “Waiting to hear from the
   apps.”
2. **4b, the reference and the vectors** (under “The test vectors”), by BVJ’s side. **Built
   2026-11-23**, with what it changed here under “Changed in step 4b.”
3. **4c, the service on a preview address**: `workers/notebook-service/`, built to “The service’s
   interface.” With 4a and 4b it is the gate of about December 15. **Built 2026-11-23**, with what
   it changed here under “Changed in step 4c.” Deploying it to the preview address is BVJ’s to do
   or to ask for (the service’s README has the steps).
4. **4d, the freeze**, tentatively December 24: this file freezes with the format. A change after
   that is a new version (`/2` labels, `v` 2), never a quiet edit.
5. **4e and 4f, sign-in and the account work on the service**: the ceremonies this file leaves to
   them, the seven-day wait, and deleting an account. **4e is built (2026-11-24)**: a passkey signs
   in on the preview, and Apple and Google wait on client ids from BDR (“Changed in step 4e”).
   **4f is built (2026-11-24)**, with production prepared and not deployed (“Changed in step 4f”).
6. **4g and 4h, the website’s connector and account pages**, on `src/lib/desk-crypto.mjs`, with the
   full Content Security Policy enforced first (4i).
7. **Both apps build against the vectors and the preview service** (IOS-108, NB15) with sign-in
   (IOS-106, NB13), in January.
8. **4l, the private beta**, where the passkey paths are tried on real Apple and Google accounts.

## Where this came from

- Draft 1 of this file, by BDR’s Claude (PR #680, 2026-11-23), and the independent review it was
  given by a separate Claude session, which found that a device would have accepted a keyring the
  service sealed (refused under “The keyring”), that device entries weren’t bound to their devices
  (now cards), and nine smaller points, all kept here.
- BVJ’s answers of 2026-11-23: `STUDY-DESK.md`, “Decisions,” 2026-11-23, and “Order of work,” 4.
- `LIT Handoff/PROPOSAL-ONE-NOTEBOOK-THREE-HOMES-2026-10-06.md`, BDR’s proposal: §4, §6, §6b, §7, and
  §9.
- `STUDY-DESK.md`: “One notebook, three homes,” “To freeze before Christmas,” “What an account system
  takes,” D5, and M14. `STUDY-DESK-FORMAT.md`: “Fields every record carries,” kind 10, “Clocks,” and
  “How each store holds the records.” `src/lib/desk-records.mjs`: `MAX_RECORD_BYTES` and
  `TRASH_DAYS`.
- The Study Desk call worksheet, 2026-11-23, and Claude’s explanation of its item D5 written for
  the call.
- iOS: Linear IOS-106 and IOS-108. Android: `ROADMAP.md` rows NB13, NB15, and NB16. Read by draft
  1’s author, not by this one, which has no access to the apps’ repositories. The iOS app targets
  iOS 26; the Android app supports API 26 and later.
- The documentation listed under “Where a passkey can carry a key,” read on 2026-11-23.
- For step 4b: RFC 5869, RFC 4231, RFC 9180 and the CFRG’s full vector file for it, and Project
  Wycheproof’s AES-GCM cases, each read on 2026-11-23 and named with its address in
  `test/fixtures/published-crypto-vectors.json`.

## Changed since draft 1

1. **Passkeys carry the key at launch.** Draft 1’s “Later: the passkey carries the key (K2)” is now
   “Holders,” “The passkey,” and “By passkey,” and the recovery code is the fallback.
2. **The reader’s choice**, “follows my account” or “this device only,” with what each means for a
   new device, a lost device, and a removed one (“Where the key lives” and “What removing a device
   means”).
3. **The recovery code is optional where a passkey holds the key**, and a notebook always has at
   least one holder.
4. **The recovery record became a holder record**, the same shape for a code and a passkey, and
   holders have cards as devices do. The keyring no longer names the recovery public key, and its
   `kid`s must run from 1 to `current`.
5. **The signing key**: P-256, made with the device key, carried in the card as `sign` and in an
   approval’s request, checked by nothing yet. Sealing a card again keeps fields a client doesn’t
   know.
6. **The key proof**, and with it “The service’s interface”: every request, and what the service
   checks. Records now go only to a session that has proved the key.
7. **A device makes its own id**, and keeps it across sessions. An approval ends with the new
   device accepting it.
8. **A device told it was removed keeps its keys** until the reader signs it out.
9. **The service leaves the clock cap to devices** and refuses a ciphertext whose length isn’t a
   padded one.
10. **“Where a passkey can carry a key”**: what each platform’s own documentation says, with links.
11. **“The test vectors” and “Order of work”** follow the plan: BVJ’s side writes them, and the
    reference is `src/lib/desk-crypto.mjs`.
12. **Settled, and no longer open**: the setup sentence, two groups typed back, seven days, the
    second way in, `deletedAt`.

## Changed in step 4b

Step 4b built the reference (`src/lib/desk-crypto.mjs`) and the vectors against draft 2 as it
stood. Code can’t leave a sentence half-read, so wherever draft 2 was silent, loose, or wrong, the
text was changed here in the same pull request, and the reference does what the text now says.
**None of these changes a decision of draft 2.** The ones marked **(a choice)** could reasonably
have gone another way: each took the smallest reading, and is under “Still open,” 22 to 30. BVJ
said yes to all nine on 2026-11-23; each still waits on BDR.

1. **HPKE’s published vectors** (“Fixed choices,” “The test vectors”). Draft 2 said the hand-written
   HPKE is checked against “the CFRG’s published RFC 9180 test vectors for this suite.” RFC 9180’s
   printed appendix has no case for this suite: its P-256 case uses AES-128-GCM. The CFRG’s full
   vector file does have it, and the reference passes that case and the RFC’s printed one through
   the same code. A wrong statement, corrected.
2. **Every HPKE seal is single-shot** (“Fixed choices”): `info` is the label’s ASCII bytes, the AAD
   is empty, and one ciphertext comes from each sender key. Draft 2 said so only inside step 5 of
   “By approval.”
3. **What “a valid point” is** (“Fixed choices”): 65 bytes, uncompressed, each coordinate less
   than the field’s size, on the curve; checked by hand before any platform call.
4. **Base64url is read strictly** (“Fixed choices”), so each byte string has one spelling. **(a
   choice)**
5. **“Lines” with an empty last value** (“Fixed choices,” “Sealing”): the line feed before it
   stays, so the AAD of a row that has no `deletedAt` ends with a line feed. Draft 2’s two
   sentences (“none at the end,” “an empty line”) could be read either way. Also that a `kid` in
   lines is decimal digits with no sign and no leading zero.
6. **Ids** (“Fixed choices”): a device makes a version 4 UUID; a check asks for the form only.
7. **Refusals have reasons** (“Fixed choices”), named by one word each in the vectors file.
8. **The keyring’s own checks** (“The keyring”) also refuse bytes that aren’t a JSON object; the
   order of `keys` means nothing; an unknown field is ignored and not carried forward **(a
   choice)**; and where more than one of the three acceptance checks fails, the report is the
   first of “another notebook,” “backward,” “a key changed” **(a choice)**.
9. **A sealed card and a sealed holder record are a nonce and a ciphertext, unpadded** (“Device
   keys and device cards,” “Holders”). Draft 2’s formulas named the nonce and didn’t say where it
   travels. Their spelling in a request is step 4c’s. **(a choice)**
10. **Reading a card** (“Device keys and device cards”): `public` must be a point or the card is
    refused; `sign` isn’t checked on reading. Draft 2 said only what a client won’t write.
11. **Sealing a card again** (“Device keys and device cards”): the opened bytes are sealed again
    as they are, which is how every field is kept; the vector’s ciphertext is those bytes’.
12. **`platform` is `ios`, `android`, or `web`** (“Device keys and device cards,” “By approval”).
    Draft 2 named the field and gave it no values. **(a choice)**
13. **A holder’s second check covers the shape of its keys** (“Holders”), and a client reports
    which of the four checks stopped it. Noted too: the one case no vector tests.
14. **How a typed code is read** (“The recovery code”): only U+0020 and U+002D are removed, other
    white space and dashes are refused, characters are checked before the length, and a group
    typed back is read by the same rules. **(a choice)** **Changed later on 2026-11-23**: white space,
    invisible characters, and dashes are removed, by the list in that section (vectors version 2).
15. **The PRF** (“The passkey”): the hashed form written out, and that `results` is the one member
    removed from a response.
16. **A row’s `deletedAt`** (“A record on the service”): left out for a record that isn’t trash,
    where draft 2’s example showed it on every row; a `null` reads as left out **(a choice)**; and
    a trash record is one whose `kind` is `trash`.
17. **Sealing** (“Sealing”): each client seals its own serialization, and the smallest ciphertext
    is 272 bytes.
18. **Opening, step by step** (“Opening”): the order of checks; which refusals mean “aside”; the
    client’s own check of the ciphertext’s length **(a choice)**; that the opened bytes must be
    UTF-8 and a JSON object; that a row with a `deletedAt` for a record that isn’t trash is
    refused; and the exact rule for “the same instant” **(a choice)**.
19. **By approval**: the grant’s card takes its platform from the request and its `added` from
    the approving device; the card is not under the grant’s MAC, and why that is enough; the order
    of the new device’s checks.
20. **The signing key** (“The signing key”): what the vectors hold for it now, and strict DER for a
    client that converts by hand.
21. **“The test vectors”**: the files as built, the published vectors and what each covers, how the
    file is written, a `base64url` group added to the table, the table’s rows brought up to what
    the file holds, and a longer list of what the vectors can’t reach.

**Noticed, and not changed, since it is the format’s and the service’s to settle** (“Still open,”
31): the format lets a trash record carry times that merely parse, and the service’s check on a
row asks for the format’s form, so a trash record with an old, looser time could never be pushed.

## Changed in step 4c

Step 4c built the service (`workers/notebook-service/`) against “The service’s interface” as step
4b left it. A service can’t leave a check half-read any more than a reference can, so wherever the
section was silent, loose, or wrong, the text was changed here in the same pull request, and the
service does what the text now says. **None of these changes a decision of draft 2, and no path
moved.** The ones marked **(a choice)** could reasonably have gone another way and are under
“Still open,” 32 to 40, for BDR to confirm and BVJ to check.

1. **Every request’s and answer’s shape is written out**, under each table. Draft 2 named what a
   request carries and left its spelling to this step.
2. **“How a request is carried” and “How values are spelled” are new**: the bearer token, one JSON
   object of at most 4,194,304 bytes, `time` first in every answer, strict base64url, and a number
   for every “sizes” the tables asked for. **(a choice)**: the numbers, and the limits of 100
   devices, 20 holders, 500 rows a request, and a page of 500 rows.
3. **The refusals have their final spelling here**, not in the service’s README as the section’s
   opening once said, since both apps switch on these words: one word in `error`, a status, and
   what else the body carries. Two words are new: `busy` (the notebook changed three times under
   one request; send it again) and `no_notebook`. `bad_request` names the member at fault and
   `not_allowed` names the rule. **(a choice)**
4. **The session and the account are checked before the body is read** (“Three kinds of session”),
   so a device that has fallen behind is told `not_open` whatever it sent. **(a choice)**
5. **`POST /session/proof`**: “the account has a notebook” is written into the checks, and so is
   their order, which a client can see (an old `kid` is never counted as a wrong proof; a device
   with no entry is told `gone` only after a right proof). **Wrong proofs are counted for the
   session, and the fifth in a row ends it.** Draft 2 said “counted and limited.” **(a choice)**
6. **`POST /notebook` allows one holder for a passkey.** Draft 2 gave that rule to `POST /holders`
   alone, so a setup naming one credential twice would have passed.
7. **`POST /devices` and `POST /approvals/<id>/accept`** have “the account has a notebook” written
   in, and accept checks again that the device’s id has no entry: one can appear between the
   request and the accept, when the same device also comes in through a holder.
8. **`DELETE /devices/<id>` ends every session attached to that device**, where draft 2 said “the
   session”: a device may hold more than one (two tabs). It needs no open session, and it succeeds
   when the entry is already gone.
9. **`POST /holders` refuses an id a holder already has.**
10. **Every request that changes a list answers the new version**, and `POST /notebook/key` the
    new `kid`, so a device need not fetch what it just changed.
11. **`POST /notebook/key`**: an id named twice is a malformed request; an empty list may be left
    out; “one holder for a passkey” holds across the kept holders and the new ones.
12. **`POST /rows` answers each row for itself.** Draft 2’s one sentence made “conflict” a row’s own
    answer and didn’t say whether a row that fails a check of form refuses the request. It doesn’t:
    that row is answered `refused` with the check’s name, and the rows beside it are stored. The
    whole request is refused only for an old `kid`, a request that isn’t in form, an id named
    twice, or more than 500 rows. **(a choice)**
13. **`POST /rows`, the rest**: a `rev` given for a row the service no longer has is
    `"conflict": "gone"`; removing a row that is already gone succeeds; a removal takes a revision.
    **(a choice)**
14. **`GET /rows` pages**, by `next` and `more`, and the service leaves `deletedAt` out of a row
    that has none (item 24 left the service’s spelling of “none” to this step).
15. **The times’ check is built as the tables state it** (item 31): both in the format’s form, by
    the reference’s own pattern. Being row by row, a trash record with a looser `deletedAt` is
    answered `refused: "deletedAt"` and holds nothing else back. Item 31 is still open.
16. **Approvals**: the “small limit” is 3 in progress for an account **(a choice)**; `platform` is
    at most 16 characters and `model` 64, with no control characters; another account’s session is
    told `gone`; “the session that made the request” is known by its token.
17. **“The preview’s way in” is new**, and outside the interface: how a client gets a session
    before step 4e exists, and why production can’t have it. **(a choice)**: the proposed address.
18. **A session’s token and its 30 days** are written down (“How a request is carried”). Draft 2
    left “how a session is carried” to the README; a client can’t call anything without it.
    **(a choice)**: the 30 days, which step 4e may revisit with real sign-in.
19. **“Open” is worked out on each request, never stored** (“Three kinds of session”), which is
    how removing an entry closes its sessions at once.
20. **“Waiting seven days” and “Ways to sign in” say they are not built yet**, and each names its
    step.

## Changed in step 4e

Step 4e built sign-in on the service (2026-11-24): `src/signin.js`, `src/ways.js`,
`src/webauthn.js`, `src/providers.js`, and their neighbors in `workers/notebook-service/`, with
the database’s second migration. This file left “the rest of the ceremony” to this step, so most
of what follows is new text and not a change to old text. **No decision of draft 2 changed, and no
request that step 4c built changed its path, its body, or its answer**, so a client built against
the preview keeps working. The ones marked **(a choice)** could reasonably have gone another way,
are mine (BVJ’s Claude), and are under “Still open,” 41 to 58, for BDR to confirm and BVJ to
check.

1. **“Signing in” is new** in “The service’s interface”: eight requests, their shapes, and the
   order of their checks. A passkey signs in on the preview today. **(a choice)**: nearly all of
   it, item by item below.
2. **“Ways to sign in” has its requests**, where step 4c left four sentences: adding a passkey,
   Apple, or Google to an account, and removing a way in. The four checks those sentences named
   are kept as written: an open session once there is a notebook, the last way in stays, a passkey
   with a holder stays, and a response with PRF results is refused.
3. **Sign in with Apple and with Google are built, off, and untested against either provider.**
   No client id, bundle id, or team id is written anywhere in this repository. The token check was
   tested with keys made inside the tests, and the two calls to Apple (trading the code, revoking
   a token) against a stand-in for Apple’s addresses. What a real token and a real answer look
   like is taken from each provider’s documentation, and the service’s README lists what to check
   the day the ids arrive.
4. **A passkey’s answer is checked by code written here, on the platform’s own cryptography**,
   and not by a library. The service asks for no attestation, so what it must check is small and
   fixed, and a library would bring a dozen attestation formats it never reads into the one place
   that hands out sessions, without knowing the two rules that are LIT’s own (a PRF result is
   refused; an Android app’s origin is checked against a list). The service’s tests hold the code
   to the examples the standard itself publishes (WebAuthn Level 3, section 16) as well as to a
   software authenticator written beside it. **(a choice)**
5. **The origins a passkey may answer from are written down**: the website’s, which an iOS app
   answers with too; the Android app by its two signing certificates, taken from the site’s
   `assetlinks.json`; and on the preview only, the website’s dev server. **(a choice)**
6. **The two link files have their passkey sections**: `webcredentials` in
   `public/.well-known/apple-app-site-association`, naming the one app the file already named,
   and `delegate_permission/common.get_login_creds` beside the relation the one statement in
   `assetlinks.json` already had. Nothing else in either file changed, and a test now holds both
   files’ shape and keeps the service’s Android origins equal to the certificates listed
   (`test/link-files.test.js`).
7. **How long a session lasts changed for an open session.** Step 4c wrote a flat 30 days and
   said this step might revisit it. A session still starts with 30 days. An open one is now kept
   alive by use, up to 365 days from its sign-in; one that is signed in and no more never is.
   **(a choice)**, and a change to what BVJ said yes to under item 40. **BVJ said yes to the
   change on 2026-11-24** (“Still open,” 52).
8. **`DELETE /session` is new** (“The account”): a device that signed in and never joined had no
   way to sign out.
9. **`GET /sign-in` is new**, and says which ways to sign in are on. `GET /` is unchanged.
   **(a choice)**: a way that is off answers `not_found`, as the preview’s way in does.
10. **Three refusals are new**: `passkey_refused` and `token_refused` (403, each with the
    `reason`), and `provider` (502, with `which`). `gone` may now carry `what: "challenge"` or
    `"way"`, `exists` `what: "way"`, and `too_many` `what: "ways"`; `not_allowed` has three new
    rules, `prf_results`, `last_way`, and `passkey_holds_key`; `busy` has a second cause.
    **(a choice)**: the words.
11. **A change to the ways in moves the lists’ version**, so that a passkey read as one of the
    account’s can’t be removed between that read and the write that makes it a holder.
    `POST /notebook` now holds the lists’ version too as it writes, for the same reason; its
    request and answer are unchanged. **(a choice)**
12. **A session is made only while its way in still stands**, in the same statement. A way in
    removed while a sign-in through it was being checked gets no session that would outlive the
    removal.
13. **“What the service holds”** now lists a passkey’s counter, the account’s user handle, the
    sign-in challenge, which way in a session came through, and that Apple’s refresh token is
    kept for each client and revoked when its way in is removed as well as when the account is
    deleted.
14. **“The preview’s way in” says how it sits beside real sign-in.** Neither of its requests
    changed. A passkey it lists has no public key and can’t sign anyone in.
15. **`GET /account`’s answer is unchanged**, and now says its ways in are listed oldest first.

## Changed in step 4f

Step 4f built the account work on the service (2026-11-24): `src/waiting.js`, `src/scheduled.js`,
and `src/limits.js` in `workers/notebook-service/`, with the database’s third migration. **No
decision of draft 2 changed, and no request that steps 4c and 4e built changed its path or its
body.** One answer grew a member (`GET /account`, item 3), which a client built to “a client
ignores a member of an answer that it doesn’t know” already reads. The ones marked **(a choice)**
could reasonably have gone another way, are mine (BVJ’s Claude), and are under “Still open,” 59 to
73, for BDR to confirm and BVJ to check.

1. **“Waiting seven days” is final**, where step 4c left a sketch of four rows marked “not built
   yet”: the three requests, their shapes, and what each answers. Draft 2’s rule is kept as
   written: at once with the key, seven days without, shown to every device, canceled by any
   device with the key.
2. **Four things the sketch didn’t say, each (a choice)**: an account with no notebook is deleted
   at once; the session that asked may cancel its own request; `DELETE /account` carries
   `platform` in its address, not a body; and a session that was open when it asked to delete and
   was closed while being answered is told `not_open`, never recorded as waiting.
3. **`GET /account` answers `waiting` in full, and a new member, `replaced`.** `waiting` was always
   null before this step. **(a choice)**: what each holds, and that every session of the account
   is answered `waiting`, open or not.
4. **“From what kind of device” is two words**: `platform`, which the asking device says of
   itself, and `through`, the kind of way in its session came through, which the service knows.
   **(a choice)**
5. **The timing is written down exactly**: due seven days to the millisecond after it was asked;
   carried out by the service’s hourly run, so within about an hour after; cancelable until then.
   **(a choice)**: an hour.
6. **“How often a client may ask” is new**: two counts by address, and the refusal `slow_down`
   (429, with `retry` and `Retry-After`). **(a choice)**: all of it, the numbers most of all.
7. **Two refusals carry a new `what`**: `exists` and `gone` may say `waiting`. The rule
   `already_open` now also refuses `POST /notebook/replace` from an open session. Draft 2 expected
   a refusal called “waiting”; there is none, since a request that waits is an answer, not a
   refusal. **(a choice)**: the words.
8. **Deleting an account revokes Apple’s tokens first, and waits for Apple.** That it revokes is
   draft 2’s. That the account stays, whole, while Apple can’t be reached is this step’s. **(a
   choice)**
9. **A replaced notebook leaves every session signed in and no more**, with its proof forgotten.
   Without that, a device that had proved `kid` 1 of the old notebook would be open on `kid` 1 of
   the new one, whose key it never held. The lists’ version moves; the revision counter is not
   reset.
10. **The service now does work on its own, once an hour**: it carries out what is due and deletes
    sessions, approvals, and sign-in challenges that ran out. Each of those was already dead to
    every request, so sweeping changes no answer.
11. **“What the service holds”** lists what a waiting request keeps and what a replacement leaves,
    and says two things the service does not hold: the address a request came from, and anything
    of a deleted account.
12. **Production’s address is written down**, `https://notebook.litbible.net`, and nothing is
    deployed there. **(a choice)**: the name, which is BVJ’s to settle.
13. **Nothing tells a person from a program at sign-up in this version.** The plan asked this step
    to look at it; what it found, and why it waits for the website’s sign-in page (step 4h), is
    “Still open,” 68.
14. **The page Google Play asks for exists**, at `https://litbible.net/delete-account/`, kept out
    of search and the sitemap and linked from nowhere until accounts open. It says what this
    section says, in a reader’s words (“Still open,” 70).

**After the merge, the same day**, the deployed preview was checked and the two vendors’ pages the
step could not reach were read (BVJ’s Claude, 2026-11-24). **No request, answer, or word changed.**
One sentence of “How often a client may ask” was corrected: it said both numbers were sized for a
congregation on one network, and the 60 is not. What the check found is under “Still open,” 68, 70,
and 72, each marked with the date.

## Changed in step 4g

Step 4g built the website’s connector (2026-11-24): `src/lib/desk-sync.mjs` (the rules, whose
header states each one), `src/lib/desk-sync-engine.mjs` (the loop), and `src/scripts/desk/sync/`
(the browser’s half). **No request, answer, size, or word of the interface changed, and nothing
under `workers/notebook-service/` was touched.** One bullet was added under “Records” (a device’s
cursor after its own push) and one under “The website” (what a linked browser keeps). The rest of
this section says what a client does between the requests, which this file had left to the client.
Each item is what the website does today and has a test in `test/desk-sync*.test.js`. The ones
marked **(a choice)** could reasonably have gone another way, are mine (BVJ’s Claude), and are
under “Still open,” 74 to 84, for BDR to confirm. **BVJ was walked through them on 2026-11-24**,
and what BVJ said is written there, item by item.

1. **A pass, in order**: `GET /account`; `GET /keyring` and `POST /session/proof` when the session
   isn’t open on the current key; `GET /rows?since=` until `more` is false; merge; `POST /rows`;
   and, after a change of key, `GET /rows?old=1` and the resealed rows. **Pull always comes before
   push**, so a device never pushes over a row it hasn’t read.
2. **Every row that arrives goes through “Opening” and then the format’s merge**, against this
   device’s clock, with the service’s row as the winner of an exact tie (the format’s proposal of
   step 4d, still unconfirmed; one constant on the website).
3. **`old_key` and `not_open`** each mean the session is behind: the device fetches its keyring,
   checks it against the one it holds (the same notebook, never backward, no held key changed),
   proves the new key, and starts the pass again, at most three times in a pass. A `kid` in an
   answer that is past the keyring’s means the same.
4. **What ends a pass, and what the device does then.** `sign_in`: the reader is told; nothing is
   removed. `slow_down`: it waits the `retry` given. `busy`: the request is sent again, twice at
   most. `not_found` for its own keyring, or `gone` to its proof: the device was removed; it keeps
   its keys, its notebook, and what it owes. A `notebook` in `GET /account` that isn’t the one it
   was linked to, or `no_notebook`: it stops, and never joins the other notebook by itself. A
   keyring that fails its check, or `wrong_proof` (sent once, never in a loop): it can’t open the
   notebook, and says so. **None of these deletes a key, a session, or a record.**
5. **`POST /rows`, row by row.** Stored: the device notes the new `rev`. `refused`: item 80.
   `conflict: changed` with the row: opened and merged like a pulled row, and the device pushes
   again only if, after the merge, its copy still differs from that row. `changed` without the
   row: it pulls from before that row. `conflict: gone`: its record is owed again as a new row
   (item 36). `removed`: done.
6. **A device keeps a row it can’t use yet, and goes on** (items 74 and 75): one whose `v` or
   `kid` it doesn’t know (“aside”), and one whose times are past its clock (“ahead”). Each is
   judged again every pass. **(a choice)**
7. **A device that pushed a copy doesn’t push it again over another device’s replacement** (item
   76). **(a choice)**
8. **A row is removed only on evidence** (item 77), **and a record that outlives an arriving
   deletion is pushed again** (item 78). **(a choice)**, both.
9. **A row a device can’t read is left exactly as it is** (item 79). **(a choice)**
10. **Requests are sized to the limits**: at most 500 rows, and a body the website holds to
    4,000,000 bytes of the 4,194,304 allowed. A record too large to seal stays on the device and
    is reported.
11. **A change of key from another device** needs nothing of the reader: the next pass meets
    `old_key` or `not_open`, takes the new keyring, and goes on. **Resealing** is “Removing a
    device, and changing the key,” step 5, as written: any device with the new keyring asks for
    the rows still under an older key and finishes them.
12. **The first sign-in is an ordinary pass** from cursor 0 with nothing noted as sent: the
    account’s rows are merged into the notebook in the browser, and what the browser holds that
    the account lacks, or holds newer, goes up. No request is special to it.
13. **A service whose revisions went backward** is noticed, and the device reads everything again
    and gives back what it still holds (item 82). **(a choice)**
14. **Two copies of one trash record** tie toward the service’s row (item 81; the format’s
    “Clocks”). **(a choice)**, in the merge, not in any request.
15. **One thing the run against the real service showed, and no decision**: removing a device ends
    its sessions, so a removed device is told `sign_in` first, and learns that it was removed only
    when its reader signs in again (item 83).
16. **A clock five minutes or more from the service’s is said to the reader, and sync goes on**
    (item 84). **(a choice)**

**Run against a local copy of the service on 2026-11-24** (`wrangler dev`, the Study Desk in a real
browser, a second device in Node): the first sign-in merge, offline edits through a reload, a
change of key and the reseal, deletions each way, a session ended by the service, and a removed
device joining again by approval. **The deployed preview was not called.** What that run did not
reach is listed under step 4g in `STUDY-DESK.md`.

## Changed in step 4h

Step 4h is the website’s account pages, built 2026-11-24 and 25 and closed to every reader
(`STUDY-DESK.md`, “Order of work,” 4h, says what they do and what was and was not seen in a
browser). **One request has changed, and only where a deployment turns the change on** (1,
below): the Turnstile check, which is the one change step 4h makes under
`workers/notebook-service/`. No other request, answer, size, or word of the interface has
changed, and the pages themselves touched nothing there. The
website’s side of every flow in this file is code under `src/lib/` (`desk-passkey.mjs`,
`desk-account-session.mjs`, `desk-account.mjs`) with the pages over it, and its tests run against
the service’s own code, so they are a second reading of “The service’s interface” by a client.
Two things that reading turned up, both as this file already says them and worth a client’s
notice:

- **`DELETE /ways/<id>` checks the last way in before it checks a passkey that holds the key.**
  A reader whose only way in is the passkey that holds the key is told `last_way`, and
  `passkey_holds_key` only once there is a second way in.
- **`DELETE /waiting` from a session that is neither open nor the one that asked is `not_open`
  even when nothing is waiting.** `gone` is for a session that could have canceled.

**One decision changed** (BVJ, 2026-11-24): every setup makes a recovery code (“Where the key
lives,” and “Still open,” 85).

**What the pages chose where this file leaves a client to choose** is “Still open,” 87 to 90:
the link a QR code carries, what the website calls itself in a request to join, what a device
says once its account is deleted, and the website’s half of Sign in with Apple and with Google.

**Seen in the browser run of 2026-11-25** (headless Chrome with a virtual authenticator, against
the service run locally, and then, on BVJ’s go-ahead, against the deployed preview from
`http://localhost:4321`, where the same was seen), and worth a client’s notice though nothing
changed:

- **A copy of a passkey that counts is refused, as 51 says it should be.** Chrome’s virtual
  authenticator keeps a signature counter for each copy of a credential, so a credential copied
  to a second browser was answered `passkey_refused` (`counter`) until its counter was ahead. A
  passkey that syncs reports 0 and is never refused this way. **For step 4l**: try a password
  manager that syncs passkeys (20 and 21 name two), since one that both syncs a passkey and
  counts would be refused on its second device.
- **The two steps of 83 were seen again**, and the same shape after a deletion (89).
- **A passkey that can’t open the notebook loses nothing.** The copied credential gave another
  PRF output (DevTools does not copy that secret), so its holder didn’t open; the page said so
  and offered approval and the recovery code, and no holder was touched.

1. **Turnstile before a new account, on the service** (2026-11-24; BVJ said yes to Turnstile on
   the website’s sign-in page under “Still open,” 68, and the design of the check is Claude’s,
   for BDR to confirm: “Still open,” 86). Where the deployment holds both `TURNSTILE_SITE_KEY`
   and `TURNSTILE_SECRET`, `GET /sign-in` gains `turnstile`, the site key, and
   `POST /sign-in/new-passkey/options` from a request with an `Origin` header must carry
   `{ "turnstile": "<token>" }`, checked with Cloudflare before a challenge is made. New: the
   `not_allowed` rule `turnstile`, and `turnstile` as a `which` of `provider`. A request with no
   `Origin` (an app’s) is not checked. Neither key is set on the preview or in production yet,
   so today nothing answers differently. The service’s `src/turnstile.js` and
   `test/turnstile.test.js`; the website already sends the token where `GET /sign-in` names a
   key (`src/lib/desk-account-session.mjs`).

## Changed in Audit 9

Study Desk Audit 9 (`STUDY-DESK-AUDIT-9.md`, 2026-11-25) read plan C’s accounts and sync, and BVJ
decided its open items on 2026-11-26 (`STUDY-DESK.md`, “Decisions,” that day). **One answer has
grown, and nothing else in the interface has changed** (1). The rest is what a client does, so
each app has the same to build; each is **for BDR to confirm** (“Still open,” 91):

1. **`GET /approvals/<id>` answers `created` and `through`** (SEC9-1): when the request was made,
   and how the session that made it signed in, `null` once that session has ended. Worked out from
   the session as the answer is made, so no column was added and no migration.
2. **The approving device says when, how, and to approve only a device in hand** (“By approval,”
   step 4), and **one holding the keyring never acts on a link’s code** (“The link”). Both answer
   SEC9-1: a reader could approve a stranger’s request whose code reached them in a link.
3. **Signing out falls back to `DELETE /session`** where `DELETE /devices/<id>` is refused by the
   rule `own_device` (COH9-1), which every session of a removed or replaced device that signed in
   again was. `own_device` is now named for `DELETE` as well as `PUT`.
4. **Stopping syncing ends the session** (SY9b-2), so a browser that stops leaves no session behind
   on the service.

## Still open

**For BDR to confirm**, since each changes what the apps build. The first six are BVJ’s calls of
2026-11-23; the rest were made in writing this draft. **BVJ was walked through those later that
day and said yes to all nine**, so 1 to 15 now wait on BDR alone:

1. Passkeys carry the key at launch, and are part of the launch.
2. The reader’s choice of where the key lives, on every platform, with “follows my account” first.
3. A recovery code offered where a passkey holds the key, and required elsewhere. **Changed by
   BVJ on 2026-11-24: made at every setup, with no question (85).**
4. The signing key: P-256, in the card, unchecked in version 1.
5. Two groups typed back, seven days, the second way in, `deletedAt` kept.
6. BVJ’s side builds the service, and the apps review it.
7. **The key proof**, and that the service gives records only to an open session.
8. **Only a synced passkey with a working PRF is a holder.** Windows Hello and security-key
   passkeys sign in and hold nothing.
9. **The PRF’s input is fixed**, so signing in and opening take one prompt.
10. **Holders have cards**, and the choice of where the key lives is whether a passkey holder
    exists, not a stored setting.
11. **A notebook always has a holder**: the service refuses a change of key that would leave none.
12. **“Replace my passkey” and “Switch to this device only”** on the screen that removes a device,
    under “follows my account.”
13. **A device makes its own id**; an approval is accepted by the new device; a removed device
    keeps its keys until signed out.
14. **The requests** under “The service’s interface,” their checks, and that the clock cap is the
    devices’ and not the service’s. BVJ’s yes came with a merge test, added in step 4d: two devices
    whose clocks differ must still agree on which edit wins. **Added 2026-11-24** (merge vectors
    version 9; the format’s “Clocks,” “Two devices whose clocks differ”). It found one thing the
    interface has to carry: when clocks differ, two devices can stamp the same `modified` on
    different edits, and only `rev` can settle that. The format proposes that the row the service
    holds wins such a tie, **which BVJ has not decided**; a client would apply it to a row from
    `GET /rows` and to the row a `conflict` answers with.
15. **Adding or removing a way to sign in needs a session that has proved the key**, once the
    account has a notebook.

**Answered by BVJ on 2026-11-23**, and kept here under their numbers:

16. **The two pieces of wording.** The sentence for a reader who takes no recovery code stands as
    proposed (under “Setting up the first device”). The removal screen under “follows my account”
    stands with the reader’s password manager added (under “What removing a device means”).
17. **Who answers when the service breaks**: BVJ first, and BDR second. **BDR’s part is for BDR to
    accept.** Only BVJ can deploy or roll back today, so step 4c gives BDR a way to (a member role
    on the Cloudflare account, or deploys that run from a merged pull request) and
    writes the steps into `DISASTER-RECOVERY.md`. **BVJ chose the second** (2026-11-23: “Let’s go
    with the GitHub workflow”): a workflow that deploys the preview from `main` and rolls it back
    from GitHub, with no access to Cloudflare. Step 4c built it, and **it has been on since
    2026-11-23**, when a deploy, a rollback, and a second deploy were each run from it and passed.
    Both options and how the workflow is set up are in `workers/notebook-service/README.md`, “Who
    can deploy and roll back.”

**To find out, on real devices, before the freeze:**

18. **One passkey must give the same 32 bytes everywhere**: in Safari and in the iOS app on an
    iPhone, in Chrome and in the Android app on an Android phone, in Safari and Chrome on a Mac, in
    Chrome on Windows with a passkey kept in Google Password Manager, and on a second device after
    the passkey syncs. Nothing in this file has been run against a real passkey. If any pair
    disagrees, that pair falls back to approval, and the choice’s promise changes for it.
19. **Whether Google Password Manager answers the PRF through Credential Manager on Android 9 to
    13**, which Google’s pages don’t say.
20. **Scanning a code with an iPhone to sign in on a computer**, where Apple’s behavior has been
    unreliable. The design falls back to approval; the question is how often a reader will meet it.
21. **A passkey kept in 1Password or Bitwarden**, on each platform.

**From step 4b, for BDR to confirm.** Writing the reference forced a choice in each of these,
where draft 2 made none. **BVJ said yes to all nine on 2026-11-23** (23 first, “Keep the recovery
code pasting strict,” then 22 and 24 to 30 after a walk through each; **23 was then loosened the
same day**, below), so 22 to 30 now wait on BDR alone. Each took the smallest reading, is written into its section, and
is what the vectors test. Changing one means changing the reference and the vectors with it, which
is cheap before the freeze. The numbers go on from 21 so that nothing above is renumbered:

22. **Base64url is read strictly**: padding, `+`, `/`, a stray character, and leftover bits are
    each refused (“Fixed choices”). The other reading takes anything a lenient decoder takes.
23. **A typed code is read with white space, invisible characters, and dashes removed**, by one
    list every client shares (“The recovery code”), so a code pasted from a note with a line break,
    a no-break space, or an en dash in it is read. As built in step 4b it was read to the letter,
    with only U+0020 and U+002D removed, and BVJ first kept that. **BVJ, later on 2026-11-23:
    “Let’s go ahead and loosen it,”** after weighing who pastes a code and when. The reference and
    the vectors changed with it (`CRYPTO_VECTORS_VERSION` 2). Still for BDR to confirm.
24. **A row’s `deletedAt` is left out unless the record is trash**, and a `null` reads the same
    (“A record on the service”). The service’s own spelling of “none” is step 4c’s: **it leaves
    the member out**, and takes a missing one and a null alike in a request.
25. **A client checks the ciphertext’s length itself** and doesn’t open a row that isn’t a padded
    record’s, even one whose seal would hold (“Opening”).
26. **“The same instant,”** exactly: the same bytes, or both in the format’s form, alike through
    the seconds, with the same fraction once trailing zeros are dropped (“Opening”). A time outside
    the format’s form matches only itself.
27. **A sealed card and a sealed holder record travel as a 12-byte nonce and a ciphertext**,
    unpadded, and the interface settles their spelling in step 4c (“Device keys and device cards,”
    “Holders”): **`{ "nonce", "ct" }`, base64url** (“How values are spelled”). Padding a card would hide the length of a device’s name; draft 2 padded records
    only, and so does the reference.
28. **`platform` is `ios`, `android`, or `web`**, in a card and in an approval’s request, and
    nothing checks it (“Device keys and device cards”).
29. **A keyring’s unknown fields are ignored and not carried forward**, unlike a card’s, which
    are kept (“The keyring”). A later version that adds to the keyring changes its `v`.
30. **The words and the order of refusals** in the vectors file: for a keyring from the service,
    “another notebook,” then “backward,” then “a key changed”; for a typed code, a wrong character
    before a wrong length; for a row, the order under “Opening”; for a grant, the order under “By
    approval”; for a holder, the number of the check. A client need not use the words, and where
    two faults meet, the vectors fix which one is named.
31. **A trash record whose times aren’t in the format’s form can’t be pushed.** The format lets a
    trash record carry times that merely parse (“write them with `Z` too”); the service’s check on
    a row asks for the format’s form (“The service’s interface,” “Records”). Not changed here, since
    the answer is the format’s or the service’s: either the service takes any time on a row with a
    `deletedAt`, or a client rewrites such a record before it seals it. **Put to the apps** (BVJ,
    2026-11-23; `STUDY-DESK-FOR-THE-APPS.md`, “Waiting to hear from the apps,” 8): has either ever
    written a trash record’s time in any form but the `Z` one? If neither has, the simplest answer
    is for the format to ask the `Z` form of trash records too; if one has, the service relaxes its
    check for a trash record’s row. Settled in step 4c or 4d, once they answer. **As built in step
    4c, with no answer yet**: the service makes the check as the interface states it, row by row,
    so such a row is answered `refused: "deletedAt"` and the rows beside it are stored. Relaxing
    it is one line of the service (`refusedRow`, `workers/notebook-service/src/rows.js`). **Not
    settled in step 4d** (2026-11-24): neither app had answered, so the format and the service
    are as they were, and this stays open until one does.

**From step 4c, for BDR to confirm and BVJ to check.** Building the service forced a choice in each
of these, where the interface made none. Each is written into “The service’s interface,” is what
the service does today, and has a test. Changing one before the freeze is cheap. The numbers go on
from 31:

32. **The sizes and limits** (“How values are spelled”): a body of at most 4,194,304 bytes; a
    sealed card or holder record of at most 4,096 bytes, and a sealed keyring of 65,536 (about a
    thousand keys); 100 devices and 20 holders in a notebook; 500 rows in one request; a page of
    500 rows or 4,194,304 characters of ciphertext. Each is a ceiling well above what a client
    sends today. Say if an app would send more. **BVJ checked the 100 devices, 2026-11-23:
    “Yes.”** BDR still confirms the rest.
33. **The refusals’ words and statuses** (“What the service answers when it refuses”), and that a
    client acts on `error` and never on `message`.
34. **Wrong proofs are counted for the session, and the fifth in a row ends it.** Counting them for
    the account would let someone with a stolen sign-in lock the reader’s own devices out by
    guessing, and guessing 32 bytes is out of reach at any count. Ending a session is not a
    timed lockout: that one device signs in again and has five more tries, and the reader’s
    other devices and the notebook are untouched. **BVJ checked, 2026-11-23: “Yes, keep it.”**
    BDR still confirms.
35. **`POST /rows` answers each row for itself**, and refuses the whole request only for an old
    `kid`, a request not in form, an id named twice, or more than 500 rows. The other reading
    refuses everything for one bad row, which lets a single record a device can’t fix block its
    whole queue.
36. **Removing**: a removal takes a revision; removing a row already gone succeeds; and a `rev`
    given for a row the service no longer has is `"conflict": "gone"`, which a device answers by
    pushing the row as new (`rev` 0) if its own merge says the record should live.
37. **Three approvals in progress for an account.** Someone with a stolen sign-in can hold all
    three, ten minutes at a time, and so keep a new device from asking. Counting by session
    wouldn’t stop that, since a sign-in makes sessions freely; the reader’s passkey and recovery
    code don’t pass through approvals, and a change of key clears them. **BVJ checked,
    2026-11-23: “yes.”** BDR still confirms.
38. **The session is checked before the body**, so `not_open`, `no_notebook`, and `already_set_up`
    come first whatever was sent.
39. **The preview**: its address, `https://notebook-preview.litbible.net` (settled: BVJ had it
    deployed there on 2026-11-23); test accounts by a made-up name; one secret, which BVJ gives BDR
    directly and which is never written into a repository.
40. **A session is a bearer token and lasts 30 days.** Step 4e, which builds real sign-in, may
    change how long. **BVJ checked, 2026-11-23: “yes.”** BDR still confirms. **Step 4e did change
    it, for an open session only: item 52**, which BVJ checked on 2026-11-24.

**From step 4e, for BDR to confirm and BVJ to check.** Building sign-in forced a choice in each of
these. **Every one was made by me (BVJ’s Claude, 2026-11-24). BVJ has since said yes to thirteen
(2026-11-24): 42, 43, 44, 46, 47, 49, 50, 52, 54, 55, 56, 57, and 58, which now wait on BDR alone.
BVJ left four to BDR to answer: 41, 45, 48, and 53. One is not decided: 51, where BVJ leans
toward no and asks what BDR thinks.**
Each is written into “Signing in” or “Ways to sign in,” is what the service does today, and has a
test. Changing one before the freeze is cheap. The numbers go on from 40:

41. **What the service needs from BDR before Apple or Google can be turned on**, since both come
    from accounts that are BDR’s (`STUDY-DESK-FOR-THE-APPS.md`, “Waiting to hear from the apps”).
    For Apple: each client id an identity token will be issued to (the iOS app’s bundle id; the
    Services ID, if the website or the Android app signs in with Apple); the team id; a Sign in
    with Apple key’s id, and the key itself, which BVJ types at Wrangler’s own prompt and which is
    never written anywhere; and the redirect address a web flow would use. For Google: each OAuth
    client id a token will be issued to (the one the Android app asks Credential Manager for, the
    iOS app’s, the website’s). **Until then both are off, and nothing here has met either
    provider.** **BVJ, 2026-11-24: “I’ll let BDR answer.”**
42. **The origins a passkey may answer from.** `https://litbible.net`; the Android app by the two
    certificates in `assetlinks.json`; and, on the preview alone, `http://localhost:4321` with the
    relying party `localhost`. For BDR: which of the two certificates is the Play signing key and
    which the upload key, whether a debug build needs a third (it would have to be added to
    `assetlinks.json` too, or Android won’t offer the passkey), and that a passkey used from the
    iOS app does answer with `https://litbible.net`, which is Apple’s documented behavior and
    untested here. **BVJ checked, 2026-11-24: “yes.”** BDR still confirms.
43. **The link files changed** (`webcredentials`; `get_login_creds`), with only the identifiers
    already in them. The apps’ half is BDR’s: the `webcredentials:litbible.net` associated
    domain on iOS, and Credential Manager on Android. **BVJ checked, 2026-11-24: “yes.”** BDR still
    confirms.
44. **Passkey checking is written here and reads two algorithms**: ES256 and RS256, which is what
    the options ask for. A passkey that could only make an Ed25519 key is not offered one. No
    attestation is asked for or read. **BVJ checked, 2026-11-24: “yes.”** BDR still confirms.
45. **Options and responses travel in the standard’s JSON forms**, and a client adds
    `extensions.prf` itself. A browser and Android have these forms ready-made; an iOS app builds
    the response’s JSON from the parts AuthenticationServices gives it. Say if that is a burden.
    **BVJ, 2026-11-24: “ask BDR,” so this is BDR’s to answer.**
46. **A response that still carries `prf.results` is refused whole, by the rule `prf_results`,
    before the challenge is used.** That it is refused is draft 2’s; that it is refused first,
    and how it is spelled, is this step’s. **BVJ checked, 2026-11-24: “yes.”** BDR still confirms.
47. **A challenge lasts five minutes and is spent by the first request that reaches it**, whatever
    that request’s outcome. **BVJ checked, 2026-11-24: “yes.”** BDR still confirms.
48. **The challenge is the provider token’s nonce, compared character for character.** Each SDK
    must hand the provider the challenge string unchanged and get it back as the `nonce` claim:
    Apple’s on iOS and its web script, Google’s through Credential Manager on Android, its iOS
    SDK, and its web script. **Untested against any of them.** If one hashes what it is given, the
    service’s check for that provider changes, which is one line. **BVJ, 2026-11-24: “ask BDR,” so
    this is BDR’s to answer.**
49. **Apple’s authorization code is sent with every Apple sign-in**, traded once for each client
    id, and the refresh token is kept for revoking and nothing else. `redirect` is sent only when
    the client’s own flow used one. **BVJ checked, 2026-11-24: “yes.”** BDR still confirms.
50. **One user handle for an account, and one name for every passkey: “LIT Bible notebook,”** with
    the relying party shown as “LIT Bible.” These are words a reader sees in their password
    manager, so they are BVJ’s to approve. The service holds no name or address to show in their
    place; a client can’t change them, since the options come from the service. **BVJ checked,
    2026-11-24: “yes.”** BDR still confirms.
51. **A counter that doesn’t go forward is refused.** A passkey that keeps no counter sends 0 and
    is always accepted, which covers every synced passkey. The other reading only notes a counter
    that went backward and lets the sign-in through. **BVJ leans toward that other reading
    (2026-11-24: “I think no”) and asks what BDR thinks, so this is not decided, and the service
    refuses until it is.** For letting it through: a false alarm, such as a count rolled back when a
    device is restored, shuts a reader out of that passkey until its count passes the one the
    service holds, which they can mend only by signing in another way and adding the passkey again;
    and a passkey that counts is, as far as the vendors’ pages say, one that doesn’t sync, which
    never holds the key (item 8), so a copy that signs in still can’t open the notebook. For
    refusing: it is the only sign of a copied security key the service ever gets.
52. **How long a session lasts: 30 days from a sign-in, and an open session kept alive by use for
    up to 365 days.** Item 40’s flat 30 days would sign every device out monthly, and a phone that
    syncs in the background would stop until its reader noticed. Only an open session is
    extended, so a sign-in that can’t open the notebook still runs out in 30 days; a removed
    device’s sessions end at once, and a change of key closes the rest, as before. Going back to
    a flat 30 days is one number in `src/session.js`. **BVJ checked, 2026-11-24: “yes.”** BDR
    still confirms.
53. **The new words**: `passkey_refused`, `token_refused`, and `provider`; `challenge` and `way`
    under `gone`, `way` under `exists`, `ways` under `too_many`; the rules `prf_results`,
    `last_way`, and `passkey_holds_key`; and that a way to sign in that is off answers
    `not_found`, with `GET /sign-in` to say which are on. **BVJ, 2026-11-24: “ask BDR,” so this is
    BDR’s to answer.**
54. **A change to the ways in moves the lists’ version**, and those requests carry no `lists` of
    their own. A device may therefore be told `lists_changed` when neither list changed. **BVJ
    checked, 2026-11-24: “yes.”** BDR still confirms.
55. **No joining of accounts, and no separate sign-up for Apple or Google.** A provider account
    that is no account’s way in makes a new, empty account when it signs in, and the answer says
    so (`created`). A reader who ends up with two accounts can’t fold one into the other in
    version 1: they delete one (step 4f) and add its way in to the other. Whether that is good
    enough for launch is BVJ’s call. **BVJ checked, 2026-11-24: “yes.”** BDR still confirms.
56. **Removing a way in ends the other sessions that came in through it** and leaves their
    devices listed. **And an Apple way in can’t be removed while Apple can’t be reached**, since
    its refresh token is revoked first. **BVJ checked, 2026-11-24: “yes.”** BDR still confirms.
57. **The limits**: 20 ways in for an account, and the sizes of a passkey’s response and of a
    token under “How values are spelled.” **BVJ checked, 2026-11-24: “yes.”** BDR still confirms.
58. **`DELETE /session`**, for a device that signed in and never joined; and **a client ignores a
    member of an answer that it doesn’t know**, so that a later step can add one. **BVJ checked,
    2026-11-24: “yes.”** BDR still confirms.

**From step 4f, for BDR to confirm and BVJ to check.** Building the account work forced a choice in
each of these. **Every one was made by me (BVJ’s Claude, 2026-11-24). BVJ was walked through them
the same day and said yes to seven: 59, 60, 63, 64, 66, 69, and 71, which now wait on BDR alone;
and yes to Turnstile on the website’s sign-in page, in 68. BVJ left five to BDR to answer: 61,
65, 67, 70, and 73, and the rest of 68. BVJ gave no answer on 62, which waits on both.** Each is written into “Waiting seven days” or “How often a client may ask,”
is what the service does today, and has a test. Changing one before the freeze is cheap. The
numbers go on from 58:

59. **An account with no notebook is deleted at once**, from any signed-in session. Draft 2’s
    sketch would have made it wait seven days, with no device able to cancel, since canceling
    needs the key and there is none. Before there is a notebook a signed-in session may already
    add and remove ways in, for the same reason: there is nothing to protect. **BVJ checked, 2026-11-24: “yes.”** BDR still confirms.
60. **The session that asked may cancel its own request**, though it has no key. Draft 2 said any
    device that can open the notebook. Without this, a reader who asked by mistake from a new
    phone, and has no other device at hand, could only watch it happen. It gives a thief
    nothing: a stolen sign-in is a different session, and can’t cancel the reader’s request. **BVJ checked, 2026-11-24: “yes.”** BDR still confirms.
61. **`DELETE /account` carries `platform` in its address** (`?platform=ios`), and
    `POST /notebook/replace` in its body. Some HTTP clients and proxies drop a body sent with
    `DELETE`. For BDR: say if either app’s client would rather have one form for both. **BVJ, 2026-11-24: “ask BDR,” so this is BDR’s to answer.**
62. **What a waiting request says**: `what`, `asked`, `due`, `platform`, `through`, and `mine`.
    `platform` is the asking device’s own word, so a thief can write anything there; `through`
    is the service’s own. **And every session of the account is answered it**, not only open
    ones: the device that asked has to see its own request, and a thief who learns that a
    request is waiting learns nothing they can use. For the apps: the notice a device shows
    (“a request to delete this account was made on … from …, and will be carried out on …”) is
    built from these six. **Not yet answered by BVJ** (2026-11-24); BDR’s view is asked too.
63. **`replaced`, in `GET /account`**: when the notebook was last replaced, and the `platform` and
    `through` of the request. It is how a device that held the old notebook tells its reader
    “when, and from what kind of device.” It is kept until the notebook is replaced again. **BVJ checked, 2026-11-24: “yes.”** BDR still confirms.
64. **Seven days exactly, then within about an hour.** The service’s own run is hourly.
    Cloudflare may start a run late, and says so; nothing here depends on the minute. **A request
    can be canceled until it is carried out**, so past `due` by up to that hour. The other
    reading stops canceling at `due`, which would refuse a cancel for a deletion that hasn’t
    happened yet. **BVJ checked, 2026-11-24: “yes.”** BDR still confirms.
65. **While Apple can’t be reached, an account is not deleted**: at once, the device is told
    `provider` and tries again; when due, the service tries again every hour, without end. The
    reader asked to be deleted and the service is holding their sealed notebook because of a
    third party’s outage, so **BVJ may want a point (some days past due) at which it deletes
    anyway and leaves a token unrevoked.** As built there is none, and the hourly log line
    counts what is held, so it is seen (the service’s `RUNBOOK.md`). **BVJ, 2026-11-24: “ask BDR,” so this is BDR’s to answer.**
66. **A replacement closes every session, keeps every way in, revokes nothing with Apple, and
    does not reset the revision counter.** A device of the old notebook sees `notebook` null and
    then a new id. **BVJ checked, 2026-11-24: “yes.”** BDR still confirms.
67. **The new words**: `slow_down` (429, with `retry` and `Retry-After`); `waiting` under `exists`
    and `gone`; `already_open` reused for a replacement asked from an open session; and the
    members `deleted`, `waiting`, `canceled`, and `replaced`. **BVJ, 2026-11-24: “ask BDR,” so this is BDR’s to answer.**
68. **Limits: by address, 60 a minute to begin a sign-in and 1,200 a minute for everything else;
    and nothing yet that tells a person from a program.** The numbers are BVJ’s to approve. For
    BDR: neither app should come near them; say if a first sync or a background task could.
    **On bot protection, which the plan asked this step to assess**: an account can be made by
    anything that can run a passkey ceremony, and since the service asks for no attestation, a
    program can. What that costs is small and bounded: one row in two tables for each made-up
    account, at most 30 a minute from one address, holding nothing. What would stop it is
    different for each client, and none of it can be built before the client it is for: on the
    website, a Turnstile token sent with `POST /sign-in/new-passkey/options` (the forms’ Worker
    already checks one), which needs the sign-in page of step 4h to show the widget; in the
    apps, Apple’s App Attest and Google’s Play Integrity, which are BDR’s to weigh and would be
    a new member of that request. **So nothing is built, and the question goes to step 4h**:
    does the website’s sign-in page carry Turnstile, and do the apps attest? Until an answer,
    the request is unchanged, and a later answer adds a member a client must send, which is a
    change to the interface. **BVJ, 2026-11-24: “yes to Turnstile,” so the website’s sign-in page (step 4h) carries it and the service checks its token; and “ask BDR about the rest,” so the numbers and whether the apps attest are BDR’s to answer.** The service’s check is built and off until configured (86).
    **Found by the check after the merge (BVJ’s Claude, 2026-11-24; nothing here is decided).**
    Three facts for the numbers. (a) Cloudflare’s page for the limiter advises against counting by
    address, because many people can share one. Before a sign-in there is nothing else to count
    by, so what the advice bears on is the number. (b) A sign-in is two requests, so 60 a minute
    is 30 sign-ins a minute from one address, at each Cloudflare location: a class or a
    congregation on one network, asked to sign in together, passes it. (c) Counting by address
    bounds what one address costs, not what a flood from many does. Each start of a sign-in writes
    a challenge that is deleted five minutes on, which D1 counts as at least four rows written. On
    Workers Free a database gets 100,000 rows written a day and then refuses every query until
    midnight UTC, so one address asking at the limit would stop all sync on such a database within
    about seven hours. On Workers Paid the first 50 million a month are included, and one address
    at the limit all month is about 10 million. **My recommendation**: keep counting by address;
    put production on Workers Paid before any reader’s notebook is there (the service’s README
    says so for other reasons too); and raise the 60 to 300 then, since a refused sign-in costs a
    reader more than those writes cost LIT.
69. **Production’s address, `https://notebook.litbible.net`**, beside the preview’s. Prepared in
    the service’s configuration and **not deployed**: BVJ decides whether and when, and makes
    the database. The apps should take the address from a build setting, as they do the
    preview’s. **BVJ checked, 2026-11-24: “yes.”** BDR still confirms.
70. **The page for deleting an account, `https://litbible.net/delete-account/`**: what Google Play
    asks for as the “delete account URL” in an app’s Data safety form, and where Apple’s reviewers
    can be pointed. **For BDR to review**, as the one who files both forms: that it says what Play
    asks (the app and developer by name, the steps, what is deleted, what is kept and for how
    long), and that its in-app steps match where each app puts “Delete account.” It is out of
    search and the sitemap and linked from nowhere, and says that accounts are not open yet. The
    page can’t delete anything until the website has sign-in (step 4h), which adds the button. **BVJ, 2026-11-24: “ask BDR,” so this is BDR’s to answer.**
    **Play’s page was read on 2026-11-24** (the check after the merge, BVJ’s Claude;
    `support.google.com/googleplay/android-developer/answer/13327111`), and the summary above is
    not quite its rule. As it reads now: the web address must load, must show the way to ask for
    deletion plainly, and must name the app or the developer as the store listing does; **a reader
    must be able to ask for deletion there, without installing or opening the app**; a link that
    starts the deletion, a support email address, or a form each serves; and readers must be told
    how long data is kept, for example in the privacy policy. It does not ask the page to list
    what is deleted. Against that: the page names “LIT Bible” and “Liberating Scripture
    Collective,” as the Play listing does; it takes no request yet, which is true while no account
    exists; and an email or a form can’t serve here, since the service keeps no name or address to
    find an account by. **So the page’s own sign-in and “Delete account” (step 4h) must be live
    before an Android build that makes accounts goes to review.** That is a dependency for the
    plan, not a choice.
71. **A device whose account was deleted elsewhere is told `sign_in`, and no more.** The service
    keeps nothing of a deleted account, so it can’t say “this account was deleted” to a session
    that outlived it. A device that had seen the request waiting can say so itself; one that
    hadn’t finds out when its reader signs in again. The other reading keeps a marker for each
    deleted account for a while, which is keeping something about a reader who asked to be
    forgotten. Say if either app needs the marker. **BVJ checked, 2026-11-24: “yes.”** BDR still confirms.
72. **What the tests could not show**, so that nobody takes it as shown: the hourly run started by
    Cloudflare’s own clock; a deletion on the real database, above all of a large notebook (the
    largest tried was 20,000 rows, locally, in 138 milliseconds); the real limiter’s counting; and
    Apple’s real answer to a revoke. The first three are seen on the preview once this is
    deployed there (the service’s README, “What to check on the preview after step 4f”); the
    fourth waits on BDR’s identifiers, with the rest of Sign in with Apple. **And two vendors’
    pages could not be reached while this was written**, Cloudflare’s documentation and Google
    Play’s help: what this file says of the limiter’s counting, and what the deletion page is
    built to, are from those pages as last read, not as re-read (the service’s README, “What was
    checked against the vendors’ own pages”).
    **Seen since (2026-11-24, after the merge; BVJ’s Claude).** The deploy’s walkthrough deleted
    an account on the real database (a small one). The real limiter counts: of 65 sign-in starts
    sent in seven seconds from one machine, 61 were answered, the 62nd was `slow_down` with
    `retry: 60` and `Retry-After: 60`, two of the next three were answered again, and a request of
    the other count was answered right after. Both vendors’ pages were read. What this file says
    of the limiter (kept for each location, approximate) is what Cloudflare’s page says, and so
    are the README’s 30 seconds for one D1 statement and Time Travel’s 30 and 7 days; what Play’s
    page says is under 70. **Still unseen**: the hourly run started by Cloudflare’s own clock, a
    large notebook’s deletion on the real database, and Apple’s answer to a revoke.
73. **Apple’s server-to-server notifications are not handled.** Apple’s page on account deletion,
    which was read for this step, asks an app with Sign in with Apple to take them: Apple calls
    an address of the service’s when a reader ends the connection from their Apple Account’s
    settings, or deletes their Apple Account. The service has no such address. As built, such a
    reader’s LIT account simply stays, with a refresh token Apple has already ended. Whether
    the service should then remove that way in, or the account, is a decision (it would be a
    deletion nobody with the key asked for), and it belongs with turning Sign in with Apple on.
    For BDR and BVJ. **BVJ, 2026-11-24: “ask BDR,” so this is BDR’s to answer.**

**From step 4g, for BDR to confirm and BVJ to check.** Building the website’s connector forced a
choice in each of these, where this file and the format made none. **Every one was made by me
(BVJ’s Claude, 2026-11-24). BVJ was walked through them the same day and said yes to eight: 74,
75, 76, 77, 78, 79, 80, and 82, which now wait on BDR alone. BVJ left three to BDR to answer: 81,
83, and 84, which the walk-through added.** None changes a request or
an answer. What they decide is whether the website and an app, each following the interface, end
with the same notebook: 74 to 79 and 81 are rules a second client has to share, or at least not
work against; 80 and 82 to 84 are questions. Each is what the website does today and has a test.
Changing one before the freeze is cheap. The numbers go on from 73:

74. **A row from a clock running ahead is kept and judged again, and the cursor moves on.** The
    format’s “Clocks” says a sync that drops a record as ahead “must not advance its cursor past
    it.” The website does what that sentence is for, another way: it keeps the row itself, sealed
    as it came, with the time it falls due; moves its cursor on; and merges the row once its own
    clock is within the format’s five minutes of the row’s latest time. Holding the cursor back
    would hold back every later row with it, for as long as one device’s clock is wrong. Where
    the device had no copy of the record, the merge writes one capped at the device’s own time,
    as the format’s clamp says, and that capped copy is never pushed. **For BDR**: is the
    format’s sentence the rule the apps will build to, or its purpose? The format now says, as a
    proposal, that either way serves. **BVJ checked, 2026-11-24: “yes.”** BDR still confirms.
75. **While a device keeps a row aside or ahead, it pushes nothing for that record**, not even an
    edit its reader makes meanwhile, since it hasn’t read what the push would replace. The edit
    stays in the notebook, is counted for the reader (“1 change made here is waiting behind an
    entry this computer hasn’t been able to take in yet”), and is settled by the merge once the
    row can be read. For a row that is ahead, the format’s “Two devices whose clocks differ”
    already names the cost: the edit made in between gives way. **For BDR**: the same in the
    apps? **BVJ checked, 2026-11-24: “yes.”** BDR still confirms.
76. **A copy is not pushed twice over another device’s answer (the damper).** When a device has
    pushed a copy of a record, another device replaces that row, and the first device’s merge
    still prefers its own copy, it does not push that copy again until the record next changes
    there. Two clients whose merges disagree about one record (a fault in one, a newer schema, a
    field one of them drops) would otherwise trade pushes without end, each a new revision that
    every other device pulls. With the damper each keeps its own copy until the record changes,
    which is the smaller harm. If merges never disagree, it never acts. **For BDR**: the apps
    need this or a bound of their own; say which. **BVJ checked, 2026-11-24: “yes.”** BDR still
    confirms.
77. **A row is removed from the service only on evidence.** A record that is gone from a device
    is never reason to remove its row. The row goes only once the device holds what replaced the
    record, already stored on the service: for a deleted record, its trash record; for a trash
    record, the record it deleted, live again, or the other trash record it collapsed into (the
    format’s collapse rule). So the trash record is pushed first and the row removed after. A
    record that is simply missing (storage cleared in part, a fault) is fetched again, so a
    damaged device can’t delete a notebook for every other device. **For BDR**: the same order
    in the apps? **BVJ checked, 2026-11-24: “yes.”** BDR still confirms.
78. **A record that outlives an arriving deletion is pushed again.** When a trash record arrives
    and loses to a record that is live on the device (the format’s rule b: the edit is the later
    action), the device pushes that record as a new row, and then removes the trash record’s
    row. The device that deleted the record removed its row (77), and nothing else would put it
    back for the others. **For BDR**: the same in the apps? **BVJ checked, 2026-11-24: “yes.”**
    BDR still confirms.
79. **A row a device can’t read is left exactly as it is.** “Opening” says to skip such a row,
    keep the device’s own copy, and report it. It doesn’t say whether the device’s copy should
    then go up over the row. The website’s doesn’t: the fault may be this client’s, so the copy
    it happens to hold is no evidence against the row. Only a later change to that record on
    this device pushes over it. The reader is told how many entries couldn’t be read. **For
    BDR**: the same in the apps? **BVJ checked, 2026-11-24: “yes.”** BDR still confirms.
80. **A row the service refuses stays on the device, and the reader is told.** `refused` names a
    check the row failed, which sending it again can’t mend, so the device doesn’t until the
    record changes. Its status line says “1 entry couldn’t be sent to your account. It is still
    in your notebook on this computer.” The same is done for a record too large to seal. The one
    case known to be reachable is item 31’s, a trash record whose times aren’t in the `Z` form,
    so 31 is now something a reader could see. **BVJ, 2026-11-24: “yes” to telling the reader.**
    **For BDR**: item 31’s answer, and whether the apps tell their readers too.
81. **Two copies of one trash record tie toward the service’s row.** The format merges two copies
    of one trash record field by field and gave every tie to the local copy. Under sync two
    devices can hold one trash record, the same id, with different held copies of equal
    `modified`, and each kept its own for good. The website now gives those ties to the arriving
    row when the store’s tiebreak favors it: the exact-tie proposal of step 4d, applied to the
    one place it didn’t reach. With no tiebreak the merge is as it was, so the merge vectors
    don’t move. **For BDR**, with the tie rule itself (`STUDY-DESK-FOR-THE-APPS.md`, ask 11).
    **BVJ, 2026-11-24: “Ask BDR,” so this is BDR’s to answer.** The website keeps it as built
    until then, behind the same constant as the tie rule.
82. **A service whose revisions went backward.** If the database is ever restored from an older
    copy (the runbook’s Time Travel), its revision counter goes back, and rows written since are
    gone from it while devices still hold them. The website notices at its next push, when the
    answer’s `rev` is lower than its cursor plus the rows just stored. It then pulls once from
    0, merges what the service has, and pushes as new rows what it still holds and the service
    no longer has. It deletes nothing. A device with nothing to push doesn’t notice until it has
    something. **For BDR**: what will the apps do after a restore? **For BVJ and the runbook
    (step 4l)**: only the website does this today, and it infers the restore. A member of
    `GET /account` that names it (a number the service raises when it is restored) would let
    every client know instead, and would be a change to the interface. Not built. **BVJ checked,
    2026-11-24: “yes”** to what the website does, with the question to BDR standing and the
    service’s own marker left for step 4l to weigh.
83. **A removed device hears it in two steps.** Removing a device deletes its sessions (“Removing
    a device, and changing the key,” step 4), and the same section says that a device which
    finds no sealed keyring for itself has been removed and says so. The two don’t meet: with no
    session, the removed device’s next request is answered `sign_in`, so it tells its reader
    they were signed out; only after they sign in again does `GET /keyring` answer `not_found`,
    and only then can it say that the device was removed. Seen in the run against the local
    service. Nothing is lost either way, since the device keeps its notebook and its keys, but
    the first message is not the true reason. One way to make it one step, as an example and not
    a decision: `sign_in` already carries a `reason` after a fifth wrong proof, and could carry
    one for a session ended by a removal, which needs the service to remember why a session
    ended. **For BVJ and BDR**: are two steps acceptable? **BVJ, 2026-11-24: “Ask BDR,” so this
    is BDR’s to answer.**
84. **A clock far from the service’s is said to the reader, and sync goes on.** Added by the
    walk-through. The service sends its time with every answer (“A record on the service”), and
    the format leaves what a client does with it to the client. The website’s status line says
    so when this computer’s clock is five minutes or more from the service’s (“This computer’s
    clock is about 2 hours ahead. Until it is set right, changes made here can replace later
    ones from your other devices.”), and it keeps syncing. The other reading holds sync back
    until the clock is set, which the apps’ file already named as an example under ask 11. **For
    BDR**: should a client only say it, or stop syncing until the clock is right, and will the
    apps say it too? **BVJ, 2026-11-24: “Ask BDR,” so this is BDR’s to answer.** The website
    says it and syncs on until then.
85. **Every setup makes a recovery code.** BVJ, 2026-11-24, on the website’s setup screen as
    step 4h drew it: “Let’s go ahead and give Google/Apple users a recovery key. They can just
    choose not to use it if they want. No need to offer the choice as a checkbox.” So under
    “follows my account” the recovery holder is made with the passkey holder, and its code is
    shown, with no question first; this changes item 3, and “Where the key lives” and “Setting
    up the first device” now say it. BVJ’s Claude reads “Google/Apple users” as the readers
    under “follows my account,” which `STUDY-DESK.md` describes as the key following “their
    Apple or Google account”; under “this device only” the code was required already. **For BDR
    to confirm**, since it changes each app’s setup screen: one step fewer to ask, one code more
    to show. **The two groups are typed back under both choices** (BVJ, the same day, asked
    whether a reader under “follows my account” might go on without them: “No, they shouldn’t
    skip adding the two number groups”). So “They can just choose not to use it” is about
    whether the reader ever uses the code, not about confirming it: every reader is shown one
    and proves they kept it, as “Setting up the first device,” step 5, already says.
86. **Turnstile checks only a request that carries an `Origin` header.** The design is Claude’s
    (2026-11-24), **for BDR to confirm**; BVJ’s word was “yes to Turnstile” on the website’s
    sign-in page (68). Where the deployment holds both `TURNSTILE_SITE_KEY` and
    `TURNSTILE_SECRET`, `POST /sign-in/new-passkey/options` with an `Origin` must carry a token
    Cloudflare accepts (“Signing in”), and `GET /sign-in` names the site key. **A request with
    no `Origin` is not checked**, because only a browser sends one, Turnstile needs a browser,
    and the iOS and Android apps send none; asking them for a token would shut them out. The cost
    is plain: **a program can skip the check by leaving `Origin` off**, so this closes the
    website’s door to scripted sign-ups and leaves the apps’ door as it was, bounded by the
    limits alone (68). What would close the apps’ door is attestation: Apple’s App Attest and
    Google’s Play Integrity, each a new member of the same request, which the service would then
    require of a request with no `Origin`. **For BDR**: will the apps attest at sign-up, and
    when? Until they do, the apps need change nothing: `GET /sign-in` may carry `turnstile`,
    which they ignore. Neither key is set on any deployment yet.
87. **The link a QR code carries is `https://litbible.net/account/connect/#a=<16 characters>`,
    the code’s characters unbroken.** “The link” recommended this shape and left the exact
    address to be settled. The website’s account page shows it as a QR code beside the code in
    four groups, whenever it shows an approval code (a computer that is joining, and “Show a code
    for the new device instead” on one that has the notebook). Reading one, the page at that
    address takes `#a=` followed by 16 to 24 characters of the code’s alphabet and hyphens, takes
    it out of the address before anything else runs, never sends it, and then uses it for what
    this browser can do: without the notebook, it asks to join with that code after sign-in; with
    it, it drops the code and asks for the one the new device shows to be typed (Audit 9, SEC9-1;
    BVJ, 2026-11-26: before that it filled the code in and asked the reader to say yes). A
    computer has no camera to count on, so the website never scans: it types. **For BDR to
    confirm**: that an app which scans this link reads the code the same way and takes its part
    from its own state, and that a QR code an app shows carries the same link.
88. **In a request to join, the website’s `model` is its browser and system** (“Chrome on
    Windows,” “Safari on Mac”; a browser it doesn’t know is “A browser on Windows”), and that is
    also the first name on its device card, which the reader can change (BVJ, 2026-11-24). The
    approving device shows it with the platform: “Add “Chrome on Windows” (Website) to your
    notebook?” Two computers therefore often share a first name until one is renamed; the
    website’s own notice of an approval says “approved from this browser” for that reason. **For
    BDR**: what will each app send as `model`, and will its list show the website’s name as
    written?
89. **A device whose account was deleted says only that it was signed out.** Deleting an account
    ends every session, so another device’s next request is answered `sign_in`, and it tells its
    reader they were signed out, with the notebook still on the device. Nothing more can be told
    without the service keeping a trace of a deleted account, which it does not. The reader
    learns the rest when the passkey is refused as `unknown`. Seen in the browser run. It is 83’s
    shape with no second step to wait for. **For BVJ and BDR**: is that acceptable, or should the
    sentence for `sign_in` allow for it (“…or your account was deleted from another device”)?
90. **The website’s half of Sign in with Apple and with Google, built and off.** It needs, from
    BDR’s accounts (ask 12), a client id of the website’s own at each provider: an Apple Services
    ID, and a Google OAuth client of type “Web application.” Each id goes in two places: the
    service’s `APPLE_CLIENT_IDS` or `GOOGLE_CLIENT_IDS`, and the website’s
    `src/lib/desk-account-providers.mjs`. **What the website does**: it asks the service for a
    challenge (`POST /sign-in/challenge`), keeps it with a random `state` for five minutes, and
    sends the reader to the provider’s own sign-in page (Apple: `response_type=code id_token`,
    `response_mode=fragment`, no scope; Google: `response_type=id_token`, `scope=openid`), with
    the challenge as `nonce`. The provider sends the reader back to the page they left with the
    identity token after the `#`; the page takes it out of the address, checks `state`, and
    posts `{ challenge, idToken }` (for Apple also `code` and `redirect`) as “Signing in” says.
    No name and no email address is asked for. **What must be registered at each provider** as a
    return address: `https://litbible.net/account/` and `https://litbible.net/delete-account/`
    (the second so that an account whose only way in is Apple or Google can be deleted from the
    web page, as Google Play requires). **Neither provider has been tried**: no id exists, none
    was guessed, and the flow has run only against stand-ins that sign real tokens. Apple’s rule
    that an answer after the `#` needs a request with no scope, and Google’s implicit answer for
    `id_token`, are from their documentation. **For BDR to confirm**: the two ids, the two return
    addresses, and that asking for no email address suits the apps’ own use of the same account
    (the service keeps none either way).
91. **Audit 9’s three client changes** (“Changed in Audit 9,” 2 to 4; BVJ, 2026-11-26). **For BDR
    to confirm**, since each is something an app builds too: (a) the approval question says when
    the request was made and how its session signed in, from the answer’s `created` and `through`,
    and says to approve only a device in hand; (b) a device that holds the keyring never acts on a
    code from a link, and asks for it typed; (c) signing out sends `DELETE /session` where the
    session is attached to no device, or where `DELETE /devices/<id>` is refused `own_device`, and
    stopping syncing ends the session. An app opened by a scanned link (87) that holds the keyring
    drops the code, as the website does.
