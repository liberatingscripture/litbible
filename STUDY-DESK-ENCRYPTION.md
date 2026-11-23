# End-to-end encryption for the notebook (draft 1)

> **After draft 1 (2026-11-23).** BVJ answered most of the open items the
> same day; each answer is marked under “Open, for BDR and BVJ” at the end,
> and recorded in `STUDY-DESK.md` (“Decisions,” 2026-11-23). **The main
> change: passkeys carry the key at launch, and the recovery code is the
> fallback** where a passkey can’t. That reverses this draft’s K1 now and K2
> later, so “The short version,” “Setting up the first device,” “Adding a
> device,” “Sign-in,” and “Later: the passkey carries the key (K2)” are
> out of date until draft 2. Items 4 and 7 are answered too. **From draft 2 on, BVJ’s side writes this
> spec, its reference, and its vectors, and builds the service**, in this
> repo under `workers/`; “The test vectors” and “Order of work” still
> describe the earlier arrangement. Nothing here is built.

**Status: draft 1, 2026-11-23, for BVJ to review. Docs only: nothing here is built, and no code or
record changes with it.** Written by BDR’s Claude, as agreed on 2026-10-09 (`STUDY-DESK.md`: BDR’s
Claude drafts the encryption spec and its vectors as a pull request here) and confirmed at BDR and
BVJ’s call on 2026-11-23 (the call worksheet’s item A8). Plan C was chosen on that call (item D1): a
small LIT service on Cloudflare holds each signed-in reader’s notebook, and only the reader’s own
devices can read it. This file says exactly how, the same way on the website, iOS, and Android. It
gates encryption in both apps (iOS IOS-108, Android NB15) and shapes sign-in (IOS-106, NB13), and it
freezes with the record format, tentatively on 2026-12-24 (item D9).

It sits beside `STUDY-DESK-FORMAT.md` on purpose. That file says what a record *is*; this one says
how a record is sealed before it leaves a device, and how the key that seals it gets from one device
to another. Nothing here changes a record’s fields. The reference implementation and the test
vectors follow in their own pull request once this text is agreed (under “The test vectors”).

**Already decided, and taken as given here:**
- **Plan C, with end-to-end encryption at launch** (BDR and BVJ, 2026-11-23). Shipping sync without
  it is not a fallback (the proposal, §8).
- **The privacy page may say only that “LIT holds your notes encrypted and can’t read them”** (BDR,
  2026-10-07), so LIT must hold nothing that opens them.
- **Sign in with Apple and with Google, and passkeys at launch if the schedule holds** (item D6,
  2026-11-23). No passwords and no codes by email.
- **The service is built by BDR’s side** in a repository of its own, deployed to BVJ’s Cloudflare,
  with BVJ reviewing (item D7).
- **The envelope**: the service keeps a record’s id, revision, edit time and deletion time in the
  clear and everything else encrypted, and all merging happens on devices (`STUDY-DESK.md`, “To
  freeze before Christmas”; the format’s reserved `encryptedBody`).

**Still open, and how this draft takes it:**
- **Item D5, what happens when a reader loses every device.** This draft takes **K1**: a recovery
  code shown once at setup, and said plainly. **The choice is BDR’s and BVJ’s to confirm.** K2 (the
  passkey carries the key) is described as a later addition, and the design leaves room for it
  without changing anything else.
- **The sentence the setup screen says about a lost code**, proposed below.
- The smaller questions under “Open, for BDR and BVJ” at the end.

**A note on names.** “D5” and “D6” in this file mean the 2026-11-23 worksheet’s items. In
`STUDY-DESK.md`, D5 is the passphrase lock for a shared computer and D6 the first-time choice; this
file names those in full when it means them.

## The short version

- **Each notebook has a key, made on the reader’s first device and never sent anywhere in a form LIT
  can open.** Every record is sealed with it (AES-256-GCM) before it leaves a device. The service
  stores sealed records and the few plain fields it needs to sync, nothing more.
- **Each device keeps the key in its own locked storage**: the Keychain on iPhone and iPad (this
  device only), the Keystore on Android, and the browser’s own storage on a computer.
- **A new device gets the key in one of two ways.** A device that already has it approves the new
  one (scan a code, or type sixteen characters), or the reader types the recovery code. Signing in
  alone never gives a device the key.
- **No device takes a key on the service’s word.** Every key a device accepts is checked against
  something the service never has: the approval code, the keys the device already holds, or the
  recovery code.
- **The recovery code is shown once, at setup.** Lose it and every device, and the notes on the
  service can’t be opened by anyone, LIT included. The setup screen says so in one sentence.
- **Removing a device gives the notebook a new key**, so the removed device can’t read anything
  written afterward.
- **Deleting the account deletes everything the service holds.** Each device keeps its own notebook
  unless the reader erases that too.
- **All three clients run one set of test vectors**, made by a reference implementation in this
  repo, the way they run the anchor and merge vectors.

The keys, from the reader’s secrets down to a record:

```
  recovery code (shown once)               device key (one per device; never leaves it)
        │ HKDF                                        │
        ▼                                             │
  code key ── opens ──▶ recovery private key          │
                               │                      │
                               └──── each opens its own sealed copy of ────┐
                                                                           ▼
                           keyring: every notebook key so far, the recovery public key
                                                                           │ HKDF
                                                                           ▼
                                      record key ── seals ──▶ every record
                                      card key ──── seals ──▶ every device’s card
```

## What this protects, and what it doesn’t

**It protects everything the service holds.** A breach of the service or its backups, a legal
demand, a curious person with access to the Cloudflare account (BVJ and BDR included), and
Cloudflare itself see sealed records and the plain fields listed under “What the service holds,”
never what a reader wrote or what they call their devices.

**It stops the service from putting a key of its own into the notebook.** A device accepts a key
only from an approval checked against the code the reader’s two devices share, from a keyring that
holds every key the device already has, or from the recovery code (under “The keyring”).

**It protects what a reader writes after removing a lost device.** The notebook gets a new key that
the removed device never receives.

**It doesn’t protect:**
- **A device in someone else’s unlocked hands.** Each device keeps its own notebook unsealed, as
  today; the phone’s lock and the computer’s account protect it. Until the reader removes it, it is
  one of the reader’s devices: it reads what is added, and it could approve a device of its own. So
  every device announces a new one, and removing a device offers to remove the devices it added.
  Removing it stops it reading anything new, not what it already holds.
- **What the plain fields and the traffic show**: how many records a reader has, roughly how large
  each is (to the nearest 256 bytes), when they change or are deleted, how many devices are signed
  in, when each was added and by which, and which provider the reader signs in with. Cloudflare’s
  logs see addresses and times, as for any website.
- **An older copy, or a deletion withheld.** The service can’t alter a record, but it could hand a
  device an older sealed version of one, or a record without the trash record that deleted it, and
  the device can’t tell.
- **The code itself.** Readers trust that the apps and the website do what this file says. That
  trust weighs most on the website: litbible.net serves its own code, so whoever controls the site
  could change it. This holds for every encrypted service on the web, and it is why the website
  enforces its full Content Security Policy before sign-in ships (`STUDY-DESK.md`, “What an account
  system takes”).
- **A service turned against its readers, beyond the checks here.** It could refuse to serve data,
  delete it, or keep a device from learning that the key changed. **A removed device working with
  the service** could do what neither can alone, since it knows every key up to its removal: stopping
  that would take each device signing what it adds, which this version leaves out (under “Open”).
- **A lost recovery code and every device.** By design: what LIT can’t open, LIT can’t give back.
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

**Fixed choices:**
- **AES-256-GCM** for every symmetric seal: a 12-byte nonce, and the 16-byte tag appended to the
  ciphertext.
- **HKDF-SHA-256** with a salt of 32 zero bytes (what RFC 5869 uses for an empty salt; written out
  because Android’s `SecretKeySpec` and WebCrypto’s HMAC import refuse an empty key) and an ASCII
  `info` label from the table under “Labels,” unless a step says otherwise. The same goes for the
  empty salts inside a hand-written HPKE.
- **HPKE in base mode** with the suite DHKEM(P-256, HKDF-SHA256), HKDF-SHA256, AES-256-GCM
  (identifiers `0x0010`, `0x0001`, `0x0002`). An HPKE written by hand is checked against the CFRG’s
  published RFC 9180 test vectors for this suite before LIT’s own.
- **P-256 keys** are written as the 65-byte uncompressed point (`04 ‖ x ‖ y`: WebCrypto’s `raw`
  export, CryptoKit’s `x963Representation`), and private keys as the 32-byte big-endian scalar `d`,
  always kept beside its public key, since WebCrypto can import a private key only with both (as a
  JWK with `d`, `x` and `y`).
- **Every public key a client is given**, and HPKE’s `enc`, is checked to be a valid point on P-256
  before it is used.
- **Byte strings in JSON** are base64url without padding (RFC 4648 §5). Ids and times are the
  strings the record carries, byte for byte.
- **“Lines”**: where a step authenticates several values together (an AAD or an HMAC’s input), it
  joins their UTF-8 bytes with one line feed (`0x0A`) between each and none at the end. No value may
  contain a line feed; a client refuses to seal one that does.
- **MACs are compared in constant time.**

### Labels

| Label | Used as | For |
|---|---|---|
| `lit-notebook/1 record` | HKDF `info` | the record key, from a notebook key |
| `lit-notebook/1 device` | HKDF `info` | the card key, from a notebook key |
| `lit-notebook/1 recovery` | HKDF `info` | the code key, from the recovery code |
| `lit-notebook/1 approve-id` | HKDF `info` | an approval’s id, from the approval code |
| `lit-notebook/1 approve-mac` | HKDF `info` | an approval’s MAC key, from the approval code |
| `lit-notebook/1 keyring` | HPKE `info` | sealing a keyring |
| `lit-row/1` | first line | a record’s AAD |
| `lit-device/1` | first line | a device card’s AAD |
| `lit-recovery/1` | AAD | the sealed recovery record |
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

Records aren’t sealed with the notebook key directly. Each client derives the **record key**,
`HKDF(notebook key, info "lit-notebook/1 record", 32 bytes)`, and the **card key**,
`HKDF(notebook key, info "lit-notebook/1 device", 32 bytes)`, so each use has a key of its own and a
later use (sheet links, say) can take another label.

**One key for every record, with a random nonce, is safe here.** AES-GCM with random 12-byte nonces
stays within its safety margin for about four billion (2³²) seals under one key. A busy notebook
makes far fewer: a bookmark that follows the reader writes every few seconds while they read, a few
hundred thousand seals in a year of daily reading, and every new key starts the count again.

### The keyring

What a device holds, and what is sealed for each device and for the recovery key, is the
**keyring**: JSON, in UTF-8.

```json
{
  "lit": "keyring",
  "v": 1,
  "notebook": "<the notebook's id>",
  "current": 2,
  "keys": [
    { "kid": 2, "key": "<32 bytes, base64url>" },
    { "kid": 1, "key": "<32 bytes, base64url>" }
  ],
  "recovery": "<the recovery public key: 65 bytes, base64url>"
}
```

- **`keys` holds every key the notebook has had**, and **`current`** names the one every new seal
  uses. Old keys stay for good: they are 32 bytes each, a notebook changes its key rarely, and they
  are what lets a device check a new keyring (below).
- **`recovery`** is the recovery public key, carried here so that no device has to trust the
  service’s copy of it: a device seals new keyrings to the key its own keyring names.
- **A client refuses a keyring** whose `lit` or `v` it doesn’t know, whose `current` isn’t among
  `keys`, whose `kid`s repeat, whose keys aren’t 32 bytes, or whose `recovery` isn’t a valid P-256
  point.

**A keyring a device takes from the service must prove itself.** HPKE keeps a keyring secret but
doesn’t say who sealed it, and anyone with a device’s public key can seal one to it. So, outside an
approval (which the code checks) and a recovery (which the recovery record checks), a device accepts
a keyring only if:
1. its `notebook` is the device’s notebook;
2. it holds every key the device already holds, each `kid` with the same bytes;
3. its `current` is no lower than the highest the device has accepted for that notebook.

The service has never held a notebook key, so it can’t make a keyring that passes the second check,
or hand a device an old keyring after a change of key. A keyring that fails is reported and never
used.

### Device keys and device cards

Each device makes a P-256 key pair when it signs in, for that account. The private key never leaves
the device (under “Where each client keeps its keys”), and every keyring sealed for the device is
sealed to the public key. The service gives each signed-in device an id.

**A device card says which public key is which device’s**, in a form only a holder of the notebook
key can make and LIT can’t read:

```
card = AES-256-GCM(card key of the current notebook key, nonce: 12 random bytes,
                   aad: lines "lit-device/1", notebook id, kid, device id,
                   plaintext: JSON {"public", "name", "platform", "added"})
```

- **The approving device writes the new device’s card** in its grant (under “By approval”). A first
  device, and a device that joined with the recovery code, write their own. Whoever changes the key
  seals every card again under the new one.
- **The name is what the reader calls the device.** Since LIT can’t read a card, it can be personal;
  it starts as the model (“iPhone,” “Pixel 8,” “Firefox on Windows”), and the reader can rename a
  device on the device itself, which seals its card again.
- **A client seals a keyring only to the public key in a card that opens under the current key and
  names that device’s id**, or, during an approval, to the key the request’s MAC vouches for. The
  service can’t make a card or move one to another device’s entry (the id is in the AAD), so a key
  it slipped into the device list gets nothing.
- **Beside each card the service records**, in plain, when the device was added and through which
  device’s session (or by setup or by recovery code), and when it was last seen. Devices show these
  beside the card’s name.

### The recovery code and the recovery key

**The recovery code** is 15 random bytes (120 bits), written as 24 characters of Crockford’s base32,
`0123456789ABCDEFGHJKMNPQRSTVWXYZ`, five bits to a character, most significant first, and shown in
six groups of four:

```
7KQ2-9XMB-4TRE-HN3A-W8CD-5FGJ
```

(That one is made up.) Reading a code back, a client removes spaces and hyphens, takes lowercase as
uppercase, reads `O` as `0` and `I` or `L` as `1`, and refuses any other character (`U` included) or
a length other than 24.

**The code key** is `HKDF(the 15 bytes, info "lit-notebook/1 recovery", 32 bytes)`. No slow password
hash is needed: the code is 120 random bits, not something a person chose, so guessing it is out of
reach however fast the guesser.

**The recovery key** is a P-256 key pair made at random with the code, not derived from it. The
**recovery record** holds its private key, sealed under the code key, and the service keeps it:

```json
{
  "lit": "recovery",
  "v": 1,
  "notebook": "<the notebook's id>",
  "d": "<the recovery private key: 32 bytes, base64url>",
  "public": "<the recovery public key: 65 bytes, base64url>",
  "anchor": { "kid": 2, "key": "<the notebook key current when the code was made>" }
}
```

sealed as `AES-256-GCM(code key, nonce: 12 random bytes, aad: "lit-recovery/1", that JSON)`. The
recovery public key is in every keyring, and every keyring is also sealed to it with HPKE, so the
code opens the private key and the private key opens the keyring.

**The anchor is what makes that keyring trustworthy.** The recovery public key isn’t secret, so
anyone could seal a keyring to it, but only a holder of the code could have sealed the anchor, and a
real keyring holds the anchor’s key, since keyrings keep every key.

**Why a key pair, and not a key made straight from the code:** a device can seal a new keyring to
the recovery public key without knowing the code, so removing a device never means a new code; a
stolen device holds only the public half; and K2 can add a passkey later as one more holder in the
same way (under “Later: the passkey carries the key”).

## What the service holds

| What | Kept as | Can LIT read it? |
|---|---|---|
| The account: the notebook’s id, each sign-in method’s account id from Apple or Google (`sub`), each passkey’s public key and id, when it was made | plain | Yes. No email address and no name is kept, even when a provider sends one |
| Apple’s refresh token, for an account that signs in with Apple, kept so deleting the account can revoke it | plain to LIT, encrypted at rest | Yes. It opens nothing in the notebook |
| Sessions | plain | Yes |
| The device list: for each device an id, its card and the `kid` it was sealed under, when it was added and through which device, when it was last seen | the card sealed, the rest plain | Only the dates and which device added which. Names and public keys are inside the cards |
| A sealed keyring for each device, and one for the recovery key | HPKE | No |
| The recovery record | AES-GCM | No |
| The account’s current `kid`, and a version of the device list that every addition and removal moves | plain | Yes |
| Records (under “A record on the service”) | sealed, beside a few plain fields | Only the plain fields |
| An approval in progress, for at most ten minutes | MACs and HPKE | The new device’s model and platform, nothing else |
| A request to replace the notebook or delete the account, while it waits (under “Deleting the account”) | plain | Yes |

**It never holds** a note, highlight, bookmark or any other record unsealed, a notebook key, a
recovery code, a device’s private key, a password, an email address, reading history, display
settings or analytics. The proposal’s sketch of the service (§7) has the rest of what it does and
doesn’t do.

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

- **`id`, `modified` and, on a trash record only, `deletedAt`** are copied byte for byte from the
  record. They are the agreed plain fields, and the seal covers them.
- **`rev`** is the service’s own revision, the cursor for “what changed since.” The service sets it
  after the record is sealed, so it is the one plain field the seal doesn’t cover.
- **`v` and `kid`** say how to open the row; the seal covers both (`v` as its label, `lit-row/1`).
- **The service needs none of them to merge**, since merging happens on devices. It uses `rev` to
  sync and `kid` to refuse a record sealed under an old key, and it may use `modified` and
  `deletedAt` to apply the format’s cap on a clock running ahead (“Clocks”). Whether it refuses such
  a record or leaves the cap to the receiving devices is for the service’s own spec.

### Sealing

1. **Serialize** the record as the format writes it (JSON, in UTF-8). It must be no more than
   `MAX_RECORD_BYTES` (1,048,576 bytes), the format’s ceiling for any record.
2. **Pad** it with spaces (`0x20`) to the next multiple of 256 bytes (a length already a multiple of
   256 takes none), so the stored size says only roughly how much was written.
3. **Make the AAD**: lines `lit-row/1`, the `kid` in decimal, `id`, `modified`, and `deletedAt` (an
   empty line on a record that isn’t trash).
4. **Seal** with AES-256-GCM under the record key of the current notebook key, with a fresh random
   12-byte nonce.

The largest ciphertext is therefore 1,048,592 bytes, and the service refuses anything larger.

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

**Deletions under encryption.** A deleted record’s row leaves the service when the record is
deleted: its copy lives on in the trash record for 30 days (`TRASH_DAYS`), as the format says.
Dropping that copy after 30 days, leaving the tombstone, is the clients’ job, since only they can
open the trash record: the first device to drop it pushes the tombstone, which replaces the
service’s copy.

## Setting up the first device

When a reader signs in and the account has no key yet, the device:

1. **Makes** the notebook’s id, the notebook key (`kid` 1), the recovery key pair, the recovery code,
   and its own device key pair and card.
2. **Sends the service, in one request,** the recovery record, the keyring sealed to the recovery
   key, and its own device entry with its card and its sealed keyring. The service accepts this only
   while the account has no key, so two devices setting up at once can’t make two notebooks: the
   second is told to be approved instead, and its code was never shown.
3. **Shows the recovery code** with the sentence below, and asks the reader to keep it: in a password
   manager, written down, or both. It then asks for two of the six groups back, so a code the reader
   didn’t keep is found out now rather than on the day it is needed (for BDR and BVJ to confirm,
   under “Open”). **Until the reader confirms it, the device keeps the code in its secure storage**,
   so a setup cut short shows the same code again; once confirmed, the device forgets it.
4. **Pushes the notebook**, sealed: the one visible moment on a device that already has notes, as
   “Two roads, one notebook” describes (the proposal, §6b).

**The sentence, proposed for item D5:**

> Save this code somewhere safe, like a password manager or a note kept at home. If you lose it and
> every device you use with LIT, no one can open your synced notes, not even LIT.

The worksheet’s placeholder is the plainer alternative: “If you lose this code and every device,
your notes can’t be recovered. Not even LIT can open them.” This draft says “synced notes” because a
device’s own notebook and the reader’s exported file aren’t lost with the code (under “When a reader
loses every device”).

## Adding a device

A device that signs in to an account that already has a key gets the sealed records but can’t open
them. It asks: **“Approve this device from one that’s already signed in, or enter your recovery
code.”** However a device joins, every other device announces it: “[name] was added to your notebook
by [device] on [date].”

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
   device public key, and this MAC:

   `HMAC(MAC key, lines "lit-approve/1 request", approval id, device id, platform, model, base64url(public key))`
4. **The approving device** finds the request by its id, checks its MAC, and asks the reader “Add
   [model] to your notebook?”
5. **On yes, it posts a grant**: it seals its keyring to the new device’s public key (HPKE, `info`
   `lit-notebook/1 keyring`, an empty AAD), writes the new device’s card (the model as its name), and
   sends the approval id, the `kid` it sealed (the keyring’s `current`), the card, HPKE’s `enc` and
   ciphertext, and this MAC:

   `HMAC(MAC key, lines "lit-approve/1 grant", approval id, kid, base64url(enc), base64url(ciphertext))`

   The service refuses a grant whose `kid` isn’t the account’s current one, so no approval crosses a
   change of key: the approving device fetches the newer keyring and grants again. The service
   records that the approving device added this one.
6. **The new device** checks the grant’s MAC, opens the keyring, checks it, and checks that its
   `current` is the grant’s `kid` and that the card opens and names its own id and public key. Then
   it keeps the keyring. The sealed copy it received is its keyring on the service from then on.
7. **The service keeps an approval for at most ten minutes**, deletes it once granted, and shows it
   only to sessions of that account.

**What the code is for.** Each MAC proves its message came from a device that saw the code, which
only the reader’s two devices did. Without the code, the service can’t swap in a public key of its
own at step 3 or a keyring of its own at step 5, and 80 random bits can’t be worked out from what the
service sees in the ten minutes an approval lasts.

### By recovery code

1. **The reader types the code.** The device makes the code key and fetches the recovery record.
2. **It opens the recovery record.** A failure means the code is wrong: “That code doesn’t open this
   notebook.”
3. **It opens the keyring sealed to the recovery key** and checks it, and then that it names the
   record’s notebook, that its `recovery` is the record’s public key, and that it holds the anchor’s
   key, with the same `kid` and bytes.
4. **It joins**: its own card and sealed copy, and its entry in the device list.

The service never sees the code and can’t test a guess, since the check happens on the device; a
guesser would have to try 2¹²⁰ codes. Afterward the device offers to remove devices the reader no
longer has (under “Removing a device, and changing the key”), since a reader using the code has
often lost one.

### The link

**The approval code travels only where no server reads it**: typed, or in a QR code that holds it
after a `#`. It never goes in a path or a query string, and a client never sends it, or anything
after a link’s `#`, in a request.

The recommended shape (the exact address is the service’s and the website’s to settle):
`https://litbible.net/account/connect/#a=<16 characters>`. The proposal has the apps claim
`/account/` (§6b), so the phone’s camera opens the app, and the app takes its part from its own
state: holding the keyring, it approves; without one, it asks to join. The website’s “Connect your
phone” (the proposal, §6b) is the same link with the service’s single-use sign-in code in its query
string, so one scan signs the phone in and brings the key.

## Where each client keeps its keys

| | iOS | Android | Website |
|---|---|---|---|
| The device’s private key | Keychain, this device only | sealed by a Keystore key, in app storage | a non-extractable `CryptoKey` in IndexedDB |
| The keyring | Keychain, this device only | sealed by the same Keystore key | the sealed copy the service holds, opened in memory each visit |
| Copied to a new device by a backup | No | No | No |

**On every platform, a device that finds itself signed in but unable to open its key treats that as
“this device needs approval again,”** never as lost notes. Its own notebook stays where it was, and
the sealed copy on the service is untouched.

### iOS

- **Keychain generic-password items** with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` and
  `kSecAttrSynchronizable` off: readable once the phone has been unlocked after a restart, so
  background sync works, and never copied to another device, by iCloud Keychain or by a backup.
- **Keychain items outlive the app.** Deleting and reinstalling it would find the old keys and
  session, so on a first launch with no marker in `UserDefaults` (which deleting the app clears) the
  app removes them and starts signed out.
- **Why not iCloud Keychain**, which the proposal’s K1 (§9) suggested and which would spare an Apple
  reader approving a new iPhone: a key that syncs through iCloud Keychain reaches every device on
  that Apple account, including one the reader has removed from the notebook, and so would every
  new key after it, so removing a device would mean nothing. It would also make the setup sentence
  untrue for Apple readers alone. IOS-108 already says this device only. **For BDR and BVJ to
  confirm** (under “Open”).
- **The device key may be a Secure Enclave key** where CryptoKit’s HPKE accepts one. It need not be.
- **iCloud still carries records between a reader’s Apple devices** as it does today (“Two roads, one
  notebook”), unsealed and under Apple’s protection. An iPad that never signs in needs no key. “Can’t
  read” is a promise about LIT.

### Android

- **A Keystore AES-256-GCM key**, not exportable, in StrongBox where the device has it (API 28 and
  later), with no user authentication required, so background sync works. It seals the device’s
  private key and the keyring, which live in app-private storage.
- **The device key pair is an ordinary key sealed by that Keystore key**, since Keystore keys for
  ECDH need API 31 and the app supports API 26.
- **Those files are left out of Auto Backup and device-to-device transfer** (`dataExtractionRules`
  from Android 12, `fullBackupContent` before). On a new phone the Keystore key wouldn’t exist, so
  they couldn’t be opened anyway.
- **A Keystore key can occasionally be lost** (some devices have dropped them when the screen lock
  changed). The rule above applies.
- **Auto Backup keeps copying the app’s own notebook** as it does today, under Google’s protection.

### The website

- **The device key pair is made with WebCrypto**, its private key not extractable, and kept as a
  `CryptoKey` in IndexedDB, which keeps it that way: page code can use it but can’t read it out.
- **At rest the browser keeps only the sealed keyring**, as the service holds it. Each visit opens it
  with the device key and imports the record key as a non-extractable `CryptoKey`; the notebook
  key’s bytes are held in memory only.
- **A computer is the weakest home**: anyone who can use the browser as the reader can open the
  notebook. `STUDY-DESK.md`’s passphrase lock (its D5; website only, phase 4) is for that, and under
  sync it has to cover the device key itself, since the service holds a keyring sealed to that key
  and any script on the site can use it. So turning the lock on makes a new device key, extractable
  but kept only wrapped under a key made from the passphrase, and the device seals its keyring to the
  new key and writes its card again; the device’s entry on the service changes with it. The lock’s
  design is the website’s.
- **Safari can clear a site’s storage after seven days without a visit**, so a Safari reader may need
  to approve the computer again. Nothing is lost.
- **The encryption code is Study Desk code**: loaded only with `data-desk="on"` and never imported
  statically by shared reader code (the root `CLAUDE.md`). Every new storage key or store is named on
  /privacy (`test/desk-storage-keys.test.js`).

## Sign-in

**Signing in and opening the notebook are separate.** Signing in proves to the service which account
a device belongs to, so the service hands it that account’s sealed records. Only the keyring opens
them. So a stolen Apple or Google account gets an attacker sealed records and nothing more, beyond a
request to delete or replace the notebook that waits seven days and that the reader can cancel
(under “Deleting the account”). Losing a way to sign in doesn’t touch the key.

- **Sign in with Apple and Sign in with Google.** Which of them each app offers is the apps’ call
  (IOS-106, NB13). The service keeps only the provider’s account id (`sub`), and Apple’s refresh
  token so it can revoke it, and stores no email address or name, even when the provider sends one.
- **Passkeys at launch if the schedule holds** (item D6). One passkey for the website and both apps:
  WebAuthn with the relying party `litbible.net`, which needs `webcredentials:litbible.net` in the
  site’s `apple-app-site-association` and `get_login_creds` in its `assetlinks.json`
  (`STUDY-DESK.md`, “One passkey everywhere”). Those are website changes made with the service, not
  in this pull request.
- **Several ways in, one account**: “Add another way to sign in” (`STUDY-DESK.md`). It matters more
  under encryption: a reader whose only way in was a passkey they’ve lost can’t sign in, so their
  recovery code can’t help them (under “Open”).
- **Signing out** removes the device’s session, keyring and device key, and its entry and sealed copy
  on the service. The device’s own notebook stays. Signing back in needs approval or the code again.
  Signing out is the reader’s own act on a device they hold, so the key doesn’t change.
- **How sessions are kept and renewed is the service’s spec.** This one asks only that no session
  token is made from, or stands in for, any key here.

## Removing a device, and changing the key

**A device is removed** from the device list on any other signed-in device (“Remove,” or “Sign out
everywhere else”), usually because it was lost, sold or stolen. Removing one changes the notebook
key:

1. **The device doing it fetches the device list** and opens every card under the current key. It
   shows the reader the devices that will keep access and the one being removed, each with its name,
   when it was added and by which device, and when it was last seen. Devices that the removed one
   added are marked, and the reader is offered to remove them too. An entry whose card doesn’t open
   is shown as unknown, and removed.
2. **It makes the next notebook key** and a keyring with it as `current`, holding every older key.
3. **It seals the new keyring** to the public key in each kept device’s card and to the recovery key,
   and seals every kept card again under the new key.
4. **It sends all of that in one request**, which the service accepts only if the account’s current
   `kid` and the device list’s version are both what they were at step 1. The service then sets the
   new `kid`, stores the sealed copies and cards, and deletes each removed device’s entry, sealed
   copy and sessions. **If the request is refused** (another device changed the key or the list
   meanwhile), the device starts again from step 1 and shows the reader the list again if it changed.
5. **It reseals every record still under an older key**: opens each and seals it again under the new
   key with a fresh nonce, the plain fields unchanged, and pushes it against the row’s revision. Any
   device holding the new keyring finishes this if the first stops partway, and a row already
   resealed is skipped.

**From step 4, the service refuses a record sealed under any key but the current one.** A device
whose push is refused fetches its sealed keyring, checks it (under “The keyring”), and pushes again.
A device with no sealed keyring left has been removed: it signs out and keeps its own notebook. An
approval caught by a change of key is simply done again.

**What the reader is told**: removing a device stops it reading anything written from then on, and
can’t take back what that device already holds. Proposed: “Remove [name]? It won’t be able to open
anything added to your notebook from now on. Anything already on it stays there.”

## A new recovery code

**“Make a new recovery code”**, on any device with the keyring, is for a reader who lost theirs or
thinks someone saw it. It makes a new recovery key pair and code **and a new notebook key**, done as
under “Removing a device, and changing the key,” with the new keyring naming the new recovery public
key and the new recovery record anchored to the new key. The old recovery record is deleted in the
same request. The code is shown only once that request is accepted, and kept until the reader
confirms it, as at setup. A new code always brings a new key, so whatever the old code could have
opened stops mattering.

## Deleting the account

From either app (Apple’s guideline 5.1.1(v)) and from a web page (Google Play asks for one), on a
signed-in device:

- **From a device that can open the notebook, it happens at once.** From a device or page that
  can’t (a sign-in alone), it waits **seven days**: every device that can open the notebook shows
  the request, with when it was made and from what kind of device, and any of them can cancel it. A
  stolen sign-in can’t take a reader’s notebook away while they look the other way for a day (the
  seven days are for BDR and BVJ to confirm, under “Open”).
- **The service deletes everything it holds for the account**: every record, every sealed keyring,
  the recovery record, the device list, sessions, approvals and sign-in methods, after revoking
  Apple’s refresh token (`appleid.apple.com/auth/revoke`). D1’s point-in-time history (Time Travel)
  keeps the account’s rows, plain and sealed alike, until they age out.
- **The device that deletes it** removes its keyring, device key and session at once. Its own
  notebook stays, unless the reader also chooses to erase it there.
- **Every other device** finds out when it next reaches the service, removes its keys and session,
  keeps its own notebook, and says so.
- **Signing in again** with the same Apple or Google account starts a new, empty account with a new
  notebook id.

## When a reader loses every device

**With the recovery code**: sign in on a new device, enter the code, and the notebook comes back
(under “By recovery code”). Then remove the lost devices.

**Without it, the sealed records on the service can’t be opened by anyone.** That is the cost of LIT
being unable to read them. What may still be there:
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
own notebook, and joins only by approval or the new code after the reader says yes; its own notes
then join the new notebook. (Its keyring would fail the checks under “The keyring” anyway.)

## Later: the passkey carries the key (K2)

The WebAuthn PRF extension lets a passkey hand a device a secret when the reader signs in. K2 would
use it as one more way back beside the recovery code: a second recovery-style record, sealed under a
key made from the passkey’s secret as the recovery record is sealed under the code key, with every
keyring also sealed to its public key. Signing in with that passkey on a new device would bring the
notebook back with no code at all.

**It is an addition, not a redesign**: records, keyrings, approvals and changing the key stay as they
are, and each new keyring is sealed to one more holder. That is why the recovery path is a key pair.
Support for PRF differs between Apple, Google and the browsers today, so K2 waits until after launch.
A trusted contact who can approve a device (as Apple offers) would fit in the same way.

## Sheet links

Short links for shared sheets on the service (`STUDY-DESK.md`, M14) are undecided (the worksheet,
2026-11-23: “let’s brainstorm”). If they come, a shared sheet is sealed under a fresh random key
carried in the link after the `#`, as `share1.` links carry the whole sheet today. It would use
nothing from the notebook’s keys, so sharing one sheet could never open the notebook. Nothing in this
file depends on that choice.

## The test vectors

As with the anchor text and the merge rules, **one file of known inputs and outputs that all three
clients run in their own tests**, made by a reference implementation in this repo. They come in the
next pull request, once this text is agreed:

- `scripts/lib/notebook-crypto.mjs`: the reference, on WebCrypto, so the website runs the code it
  ships.
- `scripts/build-notebook-crypto-vectors.mjs` (`npm run build:notebook-crypto-vectors`): writes the
  file, on demand only, and the file is committed, like `build:anchor-vectors`.
- `test/fixtures/notebook-crypto-vectors.json`: the vectors.
- `test/notebook-crypto.test.js`: checks the file against the reference, in `npm test`.

Every random input (keys, nonces, codes) is fixed and written into the file, every private key comes
with its public key, and byte strings in it are lowercase hex. Each case says what it tests:

| Group | Given | Expected |
|---|---|---|
| `hkdf` | an input and each label | each derived key |
| `recoveryCode`, `approvalCode` | bytes; typed forms (lowercase, spaces, `O`, `I`, `L`) | the text; the bytes, or the refusal and why |
| `seal` | a record, a notebook key, `kid`, nonce, plain fields | the AAD, the padded length, the ciphertext, exactly |
| `open` | the rows `seal` made | the record |
| `openRefused` | a row with one byte or field changed, the wrong key, a record whose `id` or `modified` disagrees with the plain fields | a refusal, and which |
| `padding` | lengths around each multiple of 256 | the padded length |
| `keyring` | valid and invalid keyrings; for a device holding given keys, keyrings from the service that drop a key, change a key’s bytes, name another notebook, or go backward | accepted, or the refusal and why |
| `hpkeOpen` | a private key and its public key, `enc`, a ciphertext | the keyring |
| `recovery` | a code, a nonce, a recovery record | the sealed record, its opening, and a keyring that lacks the anchor refused |
| `approval` | a code, a request, a grant | the approval id and both MACs |
| `card` | a notebook key, a card, its AAD fields | the sealed card; refused under another device’s id |
| `point` | public keys on and off the curve | accepted, or refused |
| `walkthrough` | a first device, a second approved, the first removed, a recovery by code, a forged keyring | every value along the way, and the forgery refused |

HPKE makes a fresh key pair each time it seals, and CryptoKit can’t be handed one, so the HPKE cases
run in the opening direction. Each client also checks that what it seals, it opens.

## Departures from earlier documents

1. **iOS keeps the key on the device, not in iCloud Keychain.** The proposal’s §9 described K1 with
   the key “synced by iCloud between a reader’s Apple devices.” This draft follows IOS-108 instead,
   for the reason under “iOS.”
2. **Only a client can drop a trash record’s copy after 30 days.** The proposal’s sketch (§7) had the
   service drop it. Under encryption the service can’t open a trash record, so the first device to
   drop the copy pushes the tombstone (under “Opening”).
3. **The row gains `v`, `kid` and `nonce`** beside the agreed plain fields. Additions, not changes.

## Open, for BDR and BVJ

1. **Item D5: K1 as written**, with K2 later, or something else. **BVJ, 2026-11-23: passkeys carry
   the key at launch (K2), and the recovery code (K1) is the fallback where a passkey can’t.** For
   BDR to confirm, since both apps build it. Draft 2 writes it. A reader with a passkey is offered
   a recovery code and not required to take one; it is required only where no passkey can carry
   the key.
2. **The setup sentence**, proposed under “Setting up the first device.” **BVJ, 2026-11-23: as
   proposed.**
3. **Asking for two groups of the code back at setup**, or a box to tick saying it’s kept. **BVJ,
   2026-11-23: two groups.**
4. **iOS: this device only** (recommended), or iCloud Keychain. **BVJ, 2026-11-23: this device
   only, and the reader’s choice is how they sign in**: a passkey, which Apple or Google syncs and
   which carries the key, or Sign in with Apple or Google, where a new device is approved or takes
   the recovery code. No separate iCloud Keychain switch. For BDR to confirm.
5. **Seven days** before a device that can’t open the notebook may delete or replace it, or another
   wait, or none. **BVJ, 2026-11-23: seven days.**
6. **A reader who signs in only with a passkey**: if they lose it, they can’t sign in, and the code
   can’t help. Recommended for launch: setup suggests a second way in. Perhaps later: the recovery
   code also signs in, with a proof made from it. **BVJ, 2026-11-23: setup suggests a second way
   in.**
7. **Device signatures.** A removed device working with the service could still forge what a key
   holder makes (under “What this protects, and what it doesn’t”). Stopping that means each device
   signs the devices it adds and every keyring it makes, with a roster each device keeps. This draft
   leaves it to a later version, as more than launch needs; the alternative is to build it now.
   **BVJ, 2026-11-23: reserve now, enforce later.** Each device makes its signing key at launch
   and keeps the public half in its card; nothing checks it until a later version.
8. **`deletedAt` among the plain fields.** The agreed envelope has it, and the service has little use
   for it beyond the cap on times. It shows nothing the service doesn’t see anyway (a deletion is a
   request the service handles), so this draft keeps it; dropping it before the freeze is the
   alternative. **BVJ, 2026-11-23: keep it.**
9. **A row for this file in the root `CLAUDE.md`’s Important Files**, beside the format’s, once
   agreed. This pull request adds this file and nothing else. **Done 2026-11-23**: it is in that
   row and in `src/scripts/desk/CLAUDE.md`’s table.

## Order of work

1. **BVJ reviews this file**, in this pull request. It is on the apps’ path: sync on February 10
   needs the plan, a preview service and this spec by about December 15 (the worksheet’s item D2).
2. **The reference and the vectors**, in a second pull request here, drafted by BDR’s Claude.
3. **Both apps build against the vectors** (IOS-108, NB15) with sign-in (IOS-106, NB13), in January,
   against the preview service.
4. **The service** keeps what “What the service holds” lists and does what this file asks of it
   (under “The keyring,” “A record on the service,” “Setting up the first device,” “By approval,”
   “Removing a device, and changing the key,” and “Deleting the account”), in its own repository
   (item D7).
5. **The website’s encryption layer**, in phase 4 (`STUDY-DESK.md`), with the full CSP enforced first.
6. **This file freezes with the format**, tentatively on December 24 (item D9). A change after that is
   a new version (`/2` labels, `v` 2), never a quiet edit.

## Where this came from

- `LIT Handoff/PROPOSAL-ONE-NOTEBOOK-THREE-HOMES-2026-10-06.md`, BDR’s proposal: §4, §6, §6b, §7 and
  §9.
- `STUDY-DESK.md`: “One notebook, three homes,” “To freeze before Christmas,” “What an account system
  takes,” D5 and M14. `STUDY-DESK-FORMAT.md`: “Fields every record carries,” kind 10, “Clocks” and
  “How each store holds the records.” `src/lib/desk-records.mjs`: `MAX_RECORD_BYTES` and
  `TRASH_DAYS`.
- The Study Desk call worksheet, 2026-11-23: items A8, D1, D2, D5, D6, D7 and D9, and Claude’s
  explanation of D5 written for the call.
- iOS: Linear IOS-106 and IOS-108. Android: `ROADMAP.md` rows NB13, NB15 and NB16. Read, not changed.
  The iOS app targets iOS 26; the Android app supports API 26 and later.
- An independent review of an earlier version of this draft by a separate Claude session,
  2026-11-23. It found that a device would have accepted a keyring the service sealed (now refused
  under “The keyring”), that device entries weren’t bound to their devices (now cards), and nine
  smaller points, all taken in.
