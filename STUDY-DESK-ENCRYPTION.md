# End-to-end encryption for the notebook (draft 2)

**Status: draft 2, 2026-11-23, for BDR to review and BVJ to check. The reference and the test
vectors are built (step 4b, the same day); the service, sign-in, and every client’s use of this are
not, and no record changes with it.** Written by BVJ’s Claude, on the website’s side, which
writes this spec, its reference, and its vectors and builds the service from here on (BVJ,
2026-11-23). Draft 1 was written the same day by BDR’s Claude (PR #680) and BVJ answered its open
items that evening (`STUDY-DESK.md`, “Decisions,” 2026-11-23). This draft writes those answers in,
adds the service’s interface, and ends with what changed and what is still open. It is step 4a of
the plan in `STUDY-DESK.md`, “Order of work,” 4.

**Writing the reference meant reading every sentence here as code, and some said less than code
needs.** Each such place now says what the reference does, in its own section; “Changed in step
4b” lists them all, and the ones that were a choice are under “Still open,” 22 to 30, **for BVJ and
BDR to confirm**, with one question it turned up (31). No decision of draft 2 was changed, and none
of its open items was settled.

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

**Decided in writing this draft, and seen by neither BVJ nor BDR yet.** They are listed at the end,
under “Still open,” so both can check them. The largest: a device proves to the service that it
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

(That one is made up.) Reading a code back, a client removes spaces and hyphens, takes lowercase as
uppercase, reads `O` as `0` and `I` or `L` as `1`, and refuses any other character (`U` included) or
a length other than 24.

**Read to the letter, as the reference does:** the space is U+0020 and the hyphen is U+002D, and
nothing else is removed. A tab, a line break, a no-break space, an en dash, and a letter from
another alphabet that looks like one of these are each “any other character,” and refused.
Lowercase means `a` to `z`. Characters are checked before the length, so a code with both faults is
reported as a wrong character. **The two groups a reader types back** (under “Setting up the first
device”) are read by the same rules, each as four characters. A wider reading (any white space, the
dashes a notes app swaps in) may be kinder to a reader who pastes a code; it is under “Still open.”

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
| The recovery code | Offered, not required | Required |
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
| The account: the notebook’s id, each sign-in method’s account id from Apple or Google (`sub`), each passkey’s public key, id, and flags (whether it syncs), when each was made | plain | Yes. No email address and no name is kept, even when a provider sends one |
| Apple’s refresh token, for an account that signs in with Apple, kept so deleting the account can revoke it | plain to LIT, encrypted at rest | Yes. It opens nothing in the notebook |
| Sessions, and for each whether it has proved the current key | plain | Yes |
| The account’s current `kid`, the hash of that key’s proof, and a version of the lists below that every change to them moves | plain | Yes. The hash opens nothing |
| The device list: for each device its id, its card and the `kid` the card was sealed under, when it was added and how, when it was last seen | the card sealed, the rest plain | Only the dates and how each was added. Names and public keys are inside the cards |
| The holder list: for each holder its id, its kind, a passkey holder’s credential id, its record, its card, when it was added and from which device | the record and the card sealed, the rest plain | Only that a recovery code or a given passkey can open the notebook |
| A sealed keyring for each device and each holder | HPKE | No |
| Records (under “A record on the service”) | sealed, beside a few plain fields | Only the plain fields |
| An approval in progress, for at most ten minutes | MACs and HPKE | The new device’s model and platform, nothing else |
| A request to replace the notebook or delete the account, while it waits (under “Deleting the account”) | plain | Yes |

**It never holds** a note, highlight, bookmark, or any other record unsealed, a notebook key, a
recovery code, a passkey’s secret, a device’s private key, a password, an email address, reading
history, display settings, or analytics.

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
   - **A recovery holder**, with its code: required under “this device only” and wherever no
     passkey holder was made, and offered otherwise (“Add a recovery code”).
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

**For a reader who takes no recovery code**, a sentence to match (BVJ, 2026-11-23, as draft 2
proposed it):

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
   [model] to your notebook?” The screen says to approve only a device the reader is holding.
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
state: holding the keyring, it approves; without one, it asks to join. The website’s “Connect your
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
- **Passkeys, at launch** (BVJ, 2026-11-23; the call had them “if the schedule holds”; **for BDR to
  confirm**). One passkey for the website and both apps: WebAuthn with the relying party
  `litbible.net`, which needs `webcredentials:litbible.net` in the site’s
  `apple-app-site-association` and `get_login_creds` in its `assetlinks.json` (`STUDY-DESK.md`, “One
  passkey everywhere”). Those are website changes made with the service’s sign-in, in step 4e.
- **What this file asks of every passkey request**, whoever makes it: a discoverable passkey; user
  verification required; the `prf` extension with the fixed input, at creation and at each use; and
  `results` taken out of anything sent to the service (under “The passkey”). The rest of the
  ceremony (the challenge, what the passkey is called in the reader’s password manager) is the
  service’s sign-in, step 4e.
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
- **How sessions are kept and renewed is the service’s sign-in, step 4e.** This file asks only that
  no session token is made from, or stands in for, any key here, and that a session is open only as
  “The key proof” says.

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
  for a day.
- **The service deletes everything it holds for the account**: every record, every sealed keyring,
  every holder, the device list, sessions, approvals, and sign-in methods, after revoking Apple’s
  refresh token (`appleid.apple.com/auth/revoke`). D1’s point-in-time history (Time Travel) keeps
  the account’s rows, plain and sealed alike, until they age out.
- **The device that deletes it** removes its keyring, device key, signing key, and session at once.
  Its own notebook stays, unless the reader also chooses to erase it there.
- **Every other device** finds out when it next reaches the service, removes its keys and session,
  keeps its own notebook, and says so.
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
notebook id, tells the reader when the notebook was replaced and from what kind of device, keeps its
own notebook, and joins only after the reader says yes; its own notes then join the new notebook.
(Its keyring would fail the checks under “The keyring” anyway.)

## The service’s interface

Draft 1 left this to “the service’s own spec.” **It is a section of this file, not a file beside
it**, for three reasons. What the service checks is half of every step above, and the other half is
what the device checks; a reader of one needs the other on the same page. The two freeze together,
under one version. And a second file would be one more thing for both apps’ sessions to find and
for this repo’s `CLAUDE.md` to name. What is *not* here is everything that has nothing to do with
keys: the sign-in ceremonies, how a session is carried, rate limits, and the shape of an error’s
body. Those belong to the service’s own README in `workers/notebook-service/` (steps 4c and 4e).

**The checks below are the spec. The paths are names to build against**, and they are settled when
the preview service runs (step 4c), in a pull request that corrects this section if one moves. All
of it is JSON over HTTPS, and every answer carries the service’s time. **For BDR to confirm**, since
both apps call these.

### Three kinds of session

- **Signed in**: the service knows which account the session belongs to (step 4e).
- **Open**: signed in, attached to an entry in the device list, and proved for the account’s
  current `kid` (under “The key proof”). A change of key closes every session but the one that made
  it.
- **Neither** gets nothing.

The service checks every request against the session’s account and never takes an account, a `sub`,
or a credential id from a request’s body as proof of who is asking.

### The account

| Request | From | The service checks | Then |
|---|---|---|---|
| `GET /account` | signed in | nothing more | Answers with the notebook’s id (or none), the current `kid`, the lists’ version, whether this session is open and to which device, the ways in (each one’s kind, id, and dates, and whether a passkey syncs), and any request that is waiting |
| `POST /session/proof` with the device’s id, `kid`, and the key proof | signed in | `kid` is current; the proof’s SHA-256 equals the stored hash; the device id is in the device list | The session is open and attached to that device. Wrong proofs are counted and limited |

### Setting up

| Request | From | The service checks | Then |
|---|---|---|---|
| `POST /notebook` with the notebook’s id, the proof’s hash, the device’s entry, and one or more holders | signed in | the account has no notebook (checked and written as one step); at least one holder, at most one of kind `recovery`; a passkey holder’s credential is one of this account’s passkeys and is marked as syncing; every id is a UUID and no two are the same; sizes | `kid` is 1. The device is listed as added by setup. The session is open |

### Devices and holders

| Request | From | The service checks | Then |
|---|---|---|---|
| `GET /holders` | signed in | nothing more | Each holder’s id, kind, credential id, sealed record, and sealed keyring with its `kid`. No cards |
| `GET /keyring?device=<id>` | signed in | nothing more | That device’s sealed keyring and its `kid`, or “not found” |
| `POST /devices` with the device’s id, card, sealed keyring, `kid`, the key proof, and the holder’s id it came in through | signed in | `kid` is current; the proof; the holder exists; no entry has that id | The device is listed as added by that holder’s kind. The lists’ version moves. The session is open |
| `GET /devices` | open | nothing more | The lists’ version, the current `kid`, each device (its id, its sealed card with the card’s `kid`, when and how it was added, and when it was last seen), and each holder (its id, kind, credential id, its sealed card with the card’s `kid`, and when and from which device it was added) |
| `PUT /devices/<id>` with a new card, perhaps a new sealed keyring, and the lists’ version | open, and only for its own device | the version is current; the card’s `kid` is current | The card is replaced (a rename), and the sealed keyring if one was sent (a new device key, for the lock). The version moves |
| `DELETE /devices/<id>` | a session attached to that device | nothing more | Signing out: the entry, its sealed keyring, and the session are removed. The version moves. The key doesn’t change |
| `POST /holders` with a holder’s id, kind, credential id, record, card, sealed keyring, and the lists’ version | open | the version is current; the card’s and the keyring’s `kid` are current; for `recovery`, none exists; for `passkey`, the credential is this account’s, is marked as syncing, and has no holder yet | The holder is stored. The version moves |

A holder is removed only by a change of key.

### Changing the key

| Request | From | The service checks | Then |
|---|---|---|---|
| `POST /notebook/key` with the `kid` and the lists’ version it started from, the new proof’s hash, each kept device (id, card, sealed keyring), each kept holder (id, card, sealed keyring), any new holder in full, and the ids of the devices and holders to remove | open | the `kid` and the version are both still current; **every** device on the service is in exactly one of “kept” and “removed,” and so is every holder; the caller’s own device is kept; at least one holder remains; at most one `recovery` holder remains; a new passkey holder as under `POST /holders` | All at once: `kid` goes up by one; the version moves; the proof’s hash is replaced; the new cards and keyrings are stored; removed devices lose their entries, sealed keyrings, and sessions; removed holders are deleted; approvals in progress are dropped; every session but the caller’s is no longer open |

### Records

| Request | From | The service checks | Then |
|---|---|---|---|
| `GET /rows?since=<rev>` | open | nothing more | Rows with a later `rev`, in order, a cursor for the next call, and whether there are more. With `old=1`, the rows still under an older `kid`, for resealing |
| `POST /rows` with rows to put, each with the `rev` the device last saw for that id (0 for a new one), and ids to remove, each with its `rev` | open | every row’s `kid` is the current one, or the whole request is refused as “old key”; then, row by row: `v` is 1; `id` is 1 to 64 printable ASCII characters; the two times are in the format’s form; the nonce is 12 bytes; the ciphertext is a multiple of 256 bytes plus 16, and at most 1,048,592; the `rev` given is the row’s current one, or that row is answered with “conflict” and the row as it stands | Each accepted row gets the next `rev`. A removed row is gone. A device that gets “conflict” opens the row it was sent, merges as the format says, and pushes again |

### Approvals

| Request | From | The service checks | Then |
|---|---|---|---|
| `POST /approvals` with the approval’s id, the device’s id, platform, model, both public keys, and the MAC | signed in, not open | the account has a notebook; the id is 32 hex characters and unused; the device id has no entry; a small limit on approvals in progress | Kept for ten minutes |
| `GET /approvals/<id>` | signed in | nothing more | The request, and the grant if there is one |
| `POST /approvals/<id>/grant` with `kid`, the card, `enc`, the ciphertext, and the MAC | open | the approval exists, is in time, and has no grant; `kid` is current | The grant is kept, with the device it came from |
| `POST /approvals/<id>/accept` with `kid` and the key proof | the session that made the request | a grant exists; `kid` is current and is the grant’s; the proof | The device is listed, with the grant’s card and keyring, as added by the granting device. The version moves. The session is open. The approval is deleted |

The service can’t check either MAC. It keeps them for the two devices, which can.

### Waiting seven days

| Request | From | The service checks | Then |
|---|---|---|---|
| `DELETE /account` | open | nothing more | Everything is deleted at once (under “Deleting the account”) |
| `DELETE /account` | signed in, not open | none is already waiting | A request to delete is recorded: when, from what kind of device, and when it falls due, seven days on |
| `POST /notebook/replace` | signed in, not open | the account has a notebook; none is already waiting | A request to replace is recorded the same way. When it falls due the service deletes the notebook’s records, keys, lists, and approvals, keeps the account and its ways in, and `POST /notebook` works again |
| `DELETE /waiting` | open | a request is waiting | It is canceled |

### Ways to sign in

The requests are step 4e’s. This file’s checks on them: on an account with a notebook, adding or
removing a way in needs an open session; the last way in can’t be removed; a passkey that has a
holder can’t be removed as a way in while the holder exists; and a passkey response that carries
`prf` results is refused.

### What the service answers when it refuses

A client has to tell these apart, whatever their final spelling: **sign in again**; **not open**
(fetch the keyring, check it, prove); **old key** (the same); **the lists changed** (fetch them and
start the step again); **already set up** (join instead); **conflict** (merge and push again);
**waiting** (a request to delete or replace is pending); **gone** (an approval ran out, or a device
has no entry); and **too large**.

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
| `recoveryCode`, `approvalCode` | bytes; typed forms (lowercase, spaces, `O`, `I`, `L`; a tab, an en dash, a no-break space, a look-alike letter, `U`, too few and too many characters); for the recovery code, groups typed back | the text; the bytes, or the refusal and why; whether a typed group matches |
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
   They go into the format’s “How each store holds the records” with the freeze work (step 4d).
4. **The service doesn’t apply the format’s cap on a clock running ahead.** The format says “a sync
   service’s cap is its own clock.” Under encryption the service can’t clamp a sealed time, so each
   receiving device caps against its own clock (under “A record on the service”). The format’s
   sentence changes with the freeze work, if BDR agrees. BVJ said yes on 2026-11-23, with a merge
   test added in the same step: two devices whose clocks differ must still agree on which edit
   wins.
5. **Passkeys are part of the launch**, where the call had them “if the schedule holds.”

## Order of work

The plan is `STUDY-DESK.md`, “Order of work,” 4, steps 4a to 4l. What this file is to each:

1. **4a, this draft.** BDR’s Claude reviews it, and BDR confirms or changes the calls marked “for
   BDR to confirm.” Answers go in `STUDY-DESK-FOR-THE-APPS.md`, under “Waiting to hear from the
   apps.”
2. **4b, the reference and the vectors** (under “The test vectors”), by BVJ’s side. **Built
   2026-11-23**, with what it changed here under “Changed in step 4b.”
3. **4c, the service on a preview address**: `workers/notebook-service/`, built to “The service’s
   interface.” With 4a and 4b it is the gate of about December 15.
4. **4d, the freeze**, tentatively December 24: this file freezes with the format. A change after
   that is a new version (`/2` labels, `v` 2), never a quiet edit.
5. **4e and 4f, sign-in and the account work on the service**: the ceremonies this file leaves to
   them, the seven-day wait, and deleting an account.
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
have gone another way: each took the smallest reading, and is under “Still open,” 22 to 30.

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
    typed back is read by the same rules. **(a choice)**
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

## Still open

**For BDR to confirm**, since each changes what the apps build. The first six are BVJ’s calls of
2026-11-23; the rest were made in writing this draft. **BVJ was walked through those later that
day and said yes to all nine**, so 1 to 15 now wait on BDR alone:

1. Passkeys carry the key at launch, and are part of the launch.
2. The reader’s choice of where the key lives, on every platform, with “follows my account” first.
3. A recovery code offered where a passkey holds the key, and required elsewhere.
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
    whose clocks differ must still agree on which edit wins.
15. **Adding or removing a way to sign in needs a session that has proved the key**, once the
    account has a notebook.

**Answered by BVJ on 2026-11-23**, and kept here under their numbers:

16. **The two pieces of wording.** The sentence for a reader who takes no recovery code stands as
    proposed (under “Setting up the first device”). The removal screen under “follows my account”
    stands with the reader’s password manager added (under “What removing a device means”).
17. **Who answers when the service breaks**: BVJ first, and BDR second. **BDR’s part is for BDR to
    accept.** Only BVJ can deploy or roll back today, so step 4c gives BDR a way to (a member role
    on the Cloudflare account, or deploys that run from a merged pull request; not yet chosen) and
    writes the steps into `DISASTER-RECOVERY.md`.

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

**From step 4b, for BVJ and BDR to confirm.** Writing the reference forced a choice in each of
these, where draft 2 made none. BVJ’s yes of 2026-11-23 was to 7 to 17 and came before these
existed, so each waits on both. Each took the smallest reading, is written into its section, and
is what the vectors test. Changing one means changing the reference and the vectors with it, which
is cheap before the freeze. The numbers go on from 21 so that nothing above is renumbered:

22. **Base64url is read strictly**: padding, `+`, `/`, a stray character, and leftover bits are
    each refused (“Fixed choices”). The other reading takes anything a lenient decoder takes.
23. **A typed code is read to the letter**: only the space (U+0020) and the hyphen (U+002D) are
    removed, so a tab, a line break, a no-break space, and an en dash are refused (“The recovery
    code”). A reader who pastes a code from a note may bring a line break with it. A client can
    trim what it likes before it reads, but then three clients trim three ways; the alternative is
    to say here that all white space and the common dashes are removed, and change the vectors.
    **This one is worth a real answer**, since it is the one a reader could meet.
24. **A row’s `deletedAt` is left out unless the record is trash**, and a `null` reads the same
    (“A record on the service”). The service’s own spelling of “none” is step 4c’s.
25. **A client checks the ciphertext’s length itself** and doesn’t open a row that isn’t a padded
    record’s, even one whose seal would hold (“Opening”).
26. **“The same instant,”** exactly: the same bytes, or both in the format’s form, alike through
    the seconds, with the same fraction once trailing zeros are dropped (“Opening”). A time outside
    the format’s form matches only itself.
27. **A sealed card and a sealed holder record travel as a 12-byte nonce and a ciphertext**,
    unpadded, and the interface settles their spelling in step 4c (“Device keys and device cards,”
    “Holders”). Padding a card would hide the length of a device’s name; draft 2 padded records
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
    `deletedAt`, or a client rewrites such a record before it seals it. Whether any client ever
    wrote such a time is for each to say.
