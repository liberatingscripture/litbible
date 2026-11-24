#!/usr/bin/env node
// scripts/build-notebook-crypto-vectors.mjs
//
// Writes test/fixtures/notebook-crypto-vectors.json: the test vectors for the
// synced notebook's encryption (STUDY-DESK-ENCRYPTION.md), which the website
// and both apps run in their own test suites so the three can't drift. The
// values come from src/lib/desk-crypto.mjs, the code the website ships.
//
// On demand only, like build:anchor-vectors: the output is committed, because
// the apps fetch it from this repo. Nothing here is random. Every key, nonce,
// code, and id is made from a label by SHA-256 (`fixed`), so running it twice
// gives the same bytes, and test/desk-crypto.test.js fails if the committed
// file is not what this builds. After a deliberate change to the spec or the
// reference: regenerate, bump CRYPTO_VECTORS_VERSION, and tell the apps
// (STUDY-DESK-FOR-THE-APPS.md).
//
// node:crypto is used for two things only. It checks the reference as the
// file is built (HKDF, AES-GCM, key agreement, and signatures, each computed a
// second way), and it stands in where WebCrypto can't work from a fixed
// input. scripts/lib/p256-fixed.mjs derives public keys from fixed private
// scalars and signs with a fixed ECDSA number.
//
//   npm run build:notebook-crypto-vectors

import { createCipheriv, createECDH, createHash, createHmac, createPublicKey, hkdfSync, verify as nodeVerify } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import * as c from "../src/lib/desk-crypto.mjs";
import { createRecord, trashRecord, validateRecord } from "../src/lib/desk-records.mjs";
import { B, P, curveAt, encodePoint, fieldSqrt, publicFromScalar, signWithNumber, toBytes } from "./lib/p256-fixed.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "test/fixtures/notebook-crypto-vectors.json");

/* ── Fixed inputs ────────────────────────────────────────────────────── */

const SEED = "lit-notebook-crypto-vectors/1";

/** `n` bytes that depend only on `label`. Test values: never a real key. */
function fixed(label, n) {
  const out = [];
  for (let i = 0; out.length < n; i++) out.push(...createHash("sha256").update(`${SEED} ${label} ${i}`).digest());
  return Uint8Array.from(out.slice(0, n));
}

const same = (a, b, what) => {
  if (!c.bytesEqual(a, b)) throw new Error(`build: ${what}: the reference and node:crypto disagree`);
};

/** A P-256 key pair from a label, the public half derived two ways. */
function keyPair(label) {
  const d = fixed(`${label} private key`, 32);
  if (!c.isP256Scalar(d)) throw new Error(`build: "${label}" is not a private scalar; change the label`);
  const pub = publicFromScalar(d);
  const node = createECDH("prime256v1");
  node.setPrivateKey(d);
  same(pub, node.getPublicKey(), `the public key of "${label}"`);
  return { d, public: pub };
}

const uuid = (label) => c.newId(fixed(`${label} id`, 16));
const nonce = (label) => fixed(`${label} nonce`, c.NONCE_BYTES);
const text = (bytes) => new TextDecoder().decode(bytes);

async function refusal(fn) {
  try {
    await fn();
  } catch (e) {
    if (e instanceof c.Refusal) return e;
    throw e;
  }
  throw new Error("build: a case that must be refused was accepted");
}

/** `{ refused, check? }` for a call that must refuse. */
async function refused(fn) {
  const e = await refusal(fn);
  return { refused: e.why, ...(e.check ? { check: e.check } : {}) };
}

/* ── The reference, checked against node:crypto as it is used ────────── */

async function hkdf(input, label, length = 32) {
  const out = await c.hkdf(input, label, length);
  same(out, hkdfSync("sha256", input, Buffer.alloc(32), Buffer.from(label), length), `HKDF "${label}"`);
  same(out, hkdfSync("sha256", input, Buffer.alloc(0), Buffer.from(label), length), `HKDF "${label}" with an empty salt`);
  return out;
}

async function gcmSeal(key, iv, aad, plaintext) {
  const out = await c.aesGcmSeal(key, iv, aad, plaintext);
  const node = createCipheriv("aes-256-gcm", key, iv);
  node.setAAD(aad);
  same(out, Buffer.concat([node.update(plaintext), node.final(), node.getAuthTag()]), "AES-256-GCM");
  same(await c.aesGcmOpen(key, iv, aad, out), plaintext, "AES-256-GCM, opened again");
  return out;
}

async function ecdh(holder, theirPublic) {
  const out = await c.ecdh(holder, theirPublic);
  const node = createECDH("prime256v1");
  node.setPrivateKey(holder.d);
  same(out, node.computeSecret(theirPublic), "P-256 key agreement");
  return out;
}

/** Seals a keyring to a public key with a fixed sender key, and checks the agreement behind it. */
async function sealKeyringTo(keyring, recipient, label) {
  const ephemeral = keyPair(`${label} sender`);
  await ecdh(ephemeral, recipient.public);
  const { enc, ct } = await c.sealKeyring({ keyring, recipientPublic: recipient.public, ephemeral });
  const opened = await c.openKeyring({ recipient, enc, ct });
  if (c.keyringText(opened) !== c.keyringText(keyring)) throw new Error("build: a sealed keyring did not open to itself");
  return { ephemeral, enc, ct };
}

/* ── Records ─────────────────────────────────────────────────────────── */

const CLIENT = "web/2026.11";
const CONTENT = "v20261123.5d2c847d";
const T1 = "2026-11-23T18:35:09.978Z";
const T2 = "2026-11-24T07:02:41.105Z";
const T3 = "2026-11-25T12:00:00.000Z";

function checked(record) {
  const problems = validateRecord(record);
  if (problems.length) throw new Error(`build: an example record is not valid: ${problems.join("; ")}`);
  return record;
}

const FILLER = "In the beginning was the Word, and the Word was with God. ";

/** A note whose JSON is exactly `bytes` long. */
function noteOfLength(bytes, label) {
  const make = (body) =>
    createRecord(
      "note",
      { bookKey: "john", chapter: 1, verse: 1, endVerse: 1, marker: "note", body },
      { now: T1, client: CLIENT, contentVersion: CONTENT, id: uuid(label) },
    );
  const room = bytes - c.utf8(JSON.stringify(make(""))).length;
  if (room < 0) throw new Error("build: a note can't be that short");
  const note = checked(make(FILLER.repeat(Math.ceil(room / FILLER.length)).slice(0, room)));
  if (c.utf8(JSON.stringify(note)).length !== bytes) throw new Error("build: the note missed its length");
  return note;
}

const sortKeys = (v) =>
  Array.isArray(v)
    ? v.map(sortKeys)
    : v && typeof v === "object"
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]))
      : v;

const NOTE = checked(
  createRecord(
    "note",
    { bookKey: "john", chapter: 3, verse: 16, endVerse: 17, marker: "question", body: "Who is the whole world here?" },
    { now: T1, client: CLIENT, contentVersion: CONTENT, id: uuid("record note") },
  ),
);
const HIGHLIGHT = checked(
  createRecord(
    "highlight",
    { bookKey: "john", chapter: 3, verse: 16, endVerse: 16, color: "yellow", quote: { exact: "God loved the whole world", prefix: "", suffix: "" } },
    { now: T2, client: "ios/2.4", contentVersion: CONTENT, id: uuid("record highlight") },
  ),
);
const GREEK_NOTE = checked(
  createRecord(
    "note",
    {
      bookKey: "john",
      chapter: 1,
      verse: 1,
      endVerse: 1,
      marker: "lightbulb",
      body: "ἐν ἀρχῇ ἦν ὁ λόγος: “In the beginning” echoes Genesis 1:1 (בְּרֵאשִׁית). Don’t skip the footnote 🌱",
    },
    { now: T2, client: "android/1.9", contentVersion: CONTENT, id: uuid("record greek note") },
  ),
);
const BOOKMARK = checked(
  createRecord(
    "bookmark",
    { bookKey: "romans", chapter: 8, verse: 1, label: "Morning reading" },
    { now: T2, client: CLIENT, contentVersion: CONTENT, id: uuid("record bookmark") },
  ),
);
const TRASH = checked(trashRecord(NOTE, { now: T3, client: CLIENT, contentVersion: CONTENT, id: uuid("record trash") }));

/** A row as the vectors file carries it: the service's row without `rev`, its two byte strings as bytes. */
const fileRow = (row) => ({ ...row, nonce: c.fromBase64url(row.nonce), ct: c.fromBase64url(row.ct) });
/** The same row as the service carries it (base64url), for the reference. */
const wireRow = (row) => ({ ...row, nonce: c.toBase64url(row.nonce), ct: c.toBase64url(row.ct) });
const fileKeys = (keyring) => keyring.keys.map(({ kid, key }) => ({ kid, key }));

/** Seals `plaintext` as a client would, and checks the seal a second way. */
async function sealedRow({ plaintext, notebookKey, kid, iv }) {
  const row = fileRow(await c.sealRecord({ text: plaintext, notebookKey, kid, nonce: iv }));
  const aad = c.rowAad(row);
  same(row.ct, await gcmSeal(await hkdf(notebookKey, c.LABELS.record), iv, aad, c.padRecord(c.utf8(plaintext))), "a sealed record");
  return { row, aad };
}

/**
 * A row made by hand, for the cases a correct client never produces: the
 * plain fields, the AAD, and the padding are whatever the case says.
 */
async function craftedRow({ plaintext, bytes, notebookKey, kid, iv, id, modified, deletedAt, aad, pad = true, v = 1 }) {
  const body = bytes ?? c.utf8(plaintext);
  const row = { v, id, modified, ...(deletedAt !== undefined ? { deletedAt } : {}), kid };
  const sealed = await c.aesGcmSeal(await c.recordKey(notebookKey), iv, aad ?? c.rowAad(row), pad ? c.padRecord(body) : body);
  return { ...row, nonce: iv, ct: sealed };
}

const flip = (bytes, at) => {
  const out = Uint8Array.from(bytes);
  out[at < 0 ? out.length + at : at] ^= 0x01;
  return out;
};

/* ── The groups ──────────────────────────────────────────────────────── */

async function hkdfGroup() {
  const inputs = [
    ["a notebook key", fixed("hkdf notebook key", 32), [["record", 32], ["device", 32], ["proof", 32]]],
    ["a recovery code's 15 bytes", fixed("hkdf recovery code", 15), [["recovery", 32]]],
    ["a passkey's PRF output", fixed("hkdf prf output", 32), [["passkey", 32]]],
    ["an approval code's 10 bytes", fixed("hkdf approval code", 10), [["approveId", 16], ["approveMac", 32]]],
    ["32 zero bytes", new Uint8Array(32), [["record", 32], ["approveId", 16]]],
  ];
  const cases = [];
  for (const [what, input, labels] of inputs) {
    for (const [name, length] of labels) {
      const label = c.LABELS[name];
      cases.push({
        why: `${what}, with the label "${label}", to ${length} bytes`,
        given: { input, label, length },
        expected: { prk: await c.hkdfExtract(new Uint8Array(32), input), key: await hkdf(input, label, length) },
      });
    }
  }
  return {
    about:
      "HKDF-SHA-256 (RFC 5869) with a salt of 32 zero bytes and the label's ASCII bytes as info. `prk` is HKDF-Extract's output, HMAC-SHA-256 keyed with the salt, given for a client that writes HKDF on HMAC.",
    cases,
  };
}

async function keyProofGroup() {
  const cases = [];
  for (const label of ["key proof first", "key proof second"]) {
    const notebookKey = fixed(label, 32);
    const proof = await c.keyProof(notebookKey);
    same(proof, await hkdf(notebookKey, c.LABELS.proof), "the key proof");
    const hash = await c.keyProofHash(proof);
    same(hash, createHash("sha256").update(proof).digest(), "the proof's hash");
    cases.push({ why: "the proof a device sends once, and the hash the service stores for the kid", given: { notebookKey }, expected: { proof, hash } });
  }
  return { about: 'The key proof is HKDF(notebook key, "lit-notebook/1 proof", 32 bytes); the service stores its SHA-256.', cases };
}

async function codeGroup({ bytes: size, format, read, name, alphabetCodes }) {
  const formatCases = [
    ["all zero bytes", new Uint8Array(size)],
    ["all 0xff bytes", new Uint8Array(size).fill(0xff)],
    ["random bytes", fixed(`${name} code a`, size)],
    ["random bytes", fixed(`${name} code b`, size)],
    ...alphabetCodes.map((t) => ["bytes whose text uses every character of the alphabet between them", read(t)]),
  ].map(([why, bytes]) => {
    const shown = format(bytes);
    return { why, given: { bytes }, expected: { text: shown, characters: shown.replaceAll("-", "") } };
  });

  const shown = format(fixed(`${name} code a`, size));
  const plain = shown.replaceAll("-", "");
  const mixed = alphabetCodes[0];
  const typedCases = [
    ["as shown", shown],
    ["in lowercase", shown.toLowerCase()],
    ["without hyphens, as a link carries an approval code", plain],
    ["with spaces for hyphens, and spaces around it", `  ${shown.replaceAll("-", " ")} `],
    ["with a space after every character", [...plain].join(" ")],
    ["O typed for 0, and I and L typed for 1", mixed.replaceAll("0", "O").replace("1", "I").replace("1", "L")],
    ["o typed for 0, and i and l typed for 1, in lowercase", mixed.toLowerCase().replaceAll("0", "o").replace("1", "i").replace("1", "l")],
    ["a U, which the alphabet leaves out", "U" + plain.slice(1)],
    ["one character short", plain.slice(1)],
    ["one character too many", plain + "0"],
    ["nothing typed", ""],
    ["a tab between groups: only the space (U+0020) and the hyphen (U+002D) are removed", shown.replace("-", "\t")],
    ["a line break at the end", shown + "\n"],
    ["an en dash (U+2013) for a hyphen", shown.replace("-", "–")],
    ["a no-break space (U+00A0) for a space", shown.replace("-", "\u00a0")],
    ["a Cyrillic capital O (U+041E), which is not the letter O", "\u041e" + plain.slice(1)],
    ["a dotless i (U+0131), which is not the letter I", "\u0131" + plain.slice(1)],
    ["an asterisk", "*" + plain.slice(1)],
    ["a bad character in a code that is also too short: the character is reported", "U" + plain.slice(2)],
  ];
  const readCases = [];
  for (const [why, typed] of typedCases) {
    let expected;
    try {
      expected = { bytes: read(typed) };
    } catch (e) {
      if (!(e instanceof c.Refusal)) throw e;
      expected = { refused: e.why };
    }
    readCases.push({ why, given: { typed }, expected });
  }
  return { formatCases, readCases, shown };
}

async function recoveryCodeGroup() {
  const { formatCases, readCases, shown } = await codeGroup({
    bytes: c.RECOVERY_CODE_BYTES,
    format: c.formatRecoveryCode,
    read: c.readRecoveryCode,
    name: "recovery",
    alphabetCodes: ["0123-4567-89AB-CDEF-GHJK-MNPQ", "RSTV-WXYZ-0123-4567-89AB-CDEF"],
  });
  const code = fixed("recovery code a", c.RECOVERY_CODE_BYTES);
  const groups = shown.split("-");
  const typedBack = [
    ["the first group, as shown", 1, groups[0], true],
    ["the fourth group, in lowercase", 4, groups[3].toLowerCase(), true],
    ["the last group, with a space in it", 6, `${groups[5].slice(0, 2)} ${groups[5].slice(2)}`, true],
    ["the second group typed where the first was asked for", 1, groups[1], false],
    ["three characters", 2, groups[1].slice(0, 3), false],
    ["the whole code where one group was asked for", 1, shown, false],
    ["a group number the code doesn't have", 7, groups[5], false],
  ].map(([why, group, typed, matches]) => {
    if (c.recoveryGroupMatches(code, group, typed) !== matches) throw new Error(`build: typed-back case "${why}" came out wrong`);
    return { why, given: { code, group, typed }, expected: { matches } };
  });
  return {
    about:
      "The recovery code: 15 bytes as 24 characters of Crockford's base32 (0123456789ABCDEFGHJKMNPQRSTVWXYZ), five bits to a character, most significant first, shown in six groups of four. Reading one back: spaces (U+0020) and hyphens (U+002D) are removed, a to z are taken as A to Z, O is read as 0 and I or L as 1; any other character is refused (`code`), and then any length but 24 (`codeLength`). `typedBack` is the check after a code is shown: the reader types a group back (groups are numbered from 1), read by the same rules.",
    format: formatCases,
    read: readCases,
    typedBack,
  };
}

async function approvalCodeGroup() {
  const { formatCases, readCases } = await codeGroup({
    bytes: c.APPROVAL_CODE_BYTES,
    format: c.formatApprovalCode,
    read: c.readApprovalCode,
    name: "approval",
    alphabetCodes: ["0123-4567-89AB-CDEF", "GHJK-MNPQ-RSTV-WXYZ"],
  });
  return {
    about:
      "The approval code: 10 bytes as 16 characters of the same base32, shown in four groups of four and read back by the recovery code's rules, for a length of 16. A link carries the 16 characters without hyphens.",
    format: formatCases,
    read: readCases,
  };
}

function paddingGroup() {
  const M = c.MAX_RECORD_BYTES;
  const lengths = [1, 2, 255, 256, 257, 511, 512, 513, 767, 768, 769, 1023, 1024, 1025, 65535, 65536, 65537, M - 257, M - 256, M - 255, M - 1, M];
  const cases = lengths.map((length) => ({ given: { length }, expected: { padded: c.paddedLength(length), ciphertext: c.paddedLength(length) + c.TAG_BYTES } }));
  for (const length of [0, M + 1]) {
    let why;
    try {
      c.paddedLength(length);
    } catch (e) {
      why = e.why;
    }
    cases.push({ given: { length }, expected: { refused: why } });
  }
  return {
    about:
      "A serialized record is padded with spaces (0x20) to the next multiple of 256 bytes; a length already a multiple of 256 takes none. `ciphertext` is the padded length plus the 16-byte tag. A record is never empty and never more than 1,048,576 bytes.",
    cases,
  };
}

async function recordGroups() {
  const K1 = fixed("seal notebook key 1", 32);
  const K2 = fixed("seal notebook key 2", 32);
  const keyring = c.nextKeyring(c.firstKeyring(uuid("seal notebook"), K1), K2);
  const keys = fileKeys(keyring);
  const keyOf = (kid) => (kid === 1 ? K1 : K2);

  const plan = [
    ["a note, sealed under the first key", JSON.stringify(NOTE), 1],
    ["a highlight, sealed under the second key", JSON.stringify(HIGHLIGHT), 2],
    ["a trash record: its deletedAt is a plain field and the last line of the AAD", JSON.stringify(TRASH), 2],
    ["a record of exactly 512 bytes takes no padding", JSON.stringify(noteOfLength(512, "record 512")), 2],
    ["a record of 513 bytes is padded to 768", JSON.stringify(noteOfLength(513, "record 513")), 2],
    ["a note with Greek, Hebrew, curly quotes, and an emoji: the bytes sealed are its UTF-8", JSON.stringify(GREEK_NOTE), 2],
    ["the first note as another client might write it, its keys in another order: the bytes sealed are the client's own", JSON.stringify(sortKeys(NOTE)), 1],
    ["a bookmark", JSON.stringify(BOOKMARK), 2],
  ];
  const seal = [];
  const open = [];
  for (const [i, [why, plaintext, kid]] of plan.entries()) {
    const iv = nonce(`seal case ${i}`);
    const notebookKey = keyOf(kid);
    const { row, aad } = await sealedRow({ plaintext, notebookKey, kid, iv });
    const bytes = c.utf8(plaintext).length;
    seal.push({
      why,
      given: { notebookKey, kid, nonce: iv, plaintext },
      expected: { recordKey: await c.recordKey(notebookKey), plaintextBytes: bytes, paddedLength: c.paddedLength(bytes), aad: text(aad), aadHex: aad, row },
    });
    const opened = await c.openRow({ row: wireRow(row), keyring });
    if (opened.text !== plaintext) throw new Error("build: a sealed row did not open to its record");
    open.push({ why: `the row that seal made: ${why}`, given: { keys, row }, expected: { text: opened.text, record: opened.record } });
  }

  // A line feed in a plain field can't be sealed.
  const withLineFeed = JSON.stringify({ ...NOTE, id: `${NOTE.id}\nextra` });
  seal.push({
    why: "a record whose id holds a line feed is refused: no value in an AAD may hold one",
    given: { notebookKey: K1, kid: 1, nonce: nonce("seal line feed"), plaintext: withLineFeed },
    expected: await refused(() => c.sealRecord({ text: withLineFeed, notebookKey: K1, kid: 1, nonce: nonce("seal line feed") })),
  });

  // Rows a correct client accepts although their bytes differ from its own.
  const accept = async (why, spec) => {
    const row = await craftedRow(spec);
    const opened = await c.openRow({ row: wireRow(row), keyring });
    open.push({ why, given: { keys, row }, expected: { text: opened.text, record: opened.record } });
  };
  const half = { ...NOTE, id: uuid("record half second"), modified: "2026-11-23T18:35:09.5Z" };
  await accept("the times are compared as instants: the record says …09.5Z and the plain field …09.500Z", {
    plaintext: JSON.stringify(half), notebookKey: K2, kid: 2, iv: nonce("open instants a"), id: half.id, modified: "2026-11-23T18:35:09.500Z",
  });
  const whole = { ...NOTE, id: uuid("record whole second"), modified: "2026-11-23T18:35:09Z" };
  await accept("a time with no fraction is the same instant as one with .000", {
    plaintext: JSON.stringify(whole), notebookKey: K2, kid: 2, iv: nonce("open instants b"), id: whole.id, modified: "2026-11-23T18:35:09.000Z",
  });
  const micro = { ...NOTE, id: uuid("record microseconds"), modified: "2026-11-23T18:35:09.978123Z" };
  await accept("fractions may run to any number of digits: …09.978123Z in the record and …09.9781230Z in the row", {
    plaintext: JSON.stringify(micro), notebookKey: K2, kid: 2, iv: nonce("open instants c"), id: micro.id, modified: "2026-11-23T18:35:09.9781230Z",
  });
  await accept("a row that carries deletedAt as null is a row without one", {
    plaintext: JSON.stringify(HIGHLIGHT), notebookKey: K2, kid: 2, iv: nonce("open null deletedAt"), id: HIGHLIGHT.id, modified: HIGHLIGHT.modified, deletedAt: null,
  });
  await accept("an older key still opens what it sealed: a row under kid 1 on a device that holds kids 1 and 2", {
    plaintext: JSON.stringify(BOOKMARK), notebookKey: K1, kid: 1, iv: nonce("open old key"), id: BOOKMARK.id, modified: BOOKMARK.modified,
  });

  // Refusals. `aside` marks the two that mean "keep the row and fetch the keyring."
  const openRefused = [];
  const refuseRow = async (why, row, heldKeys = keys) => {
    const held = { notebook: keyring.notebook, current: Math.max(...heldKeys.map((k) => k.kid)), keys: heldKeys };
    const e = await refusal(() => c.openRow({ row: wireRow(row), keyring: held }));
    openRefused.push({ why, given: { keys: heldKeys, row }, expected: { refused: e.why, aside: e.why === "version" || e.why === "missingKey" } });
  };
  const good = (await sealedRow({ plaintext: JSON.stringify(NOTE), notebookKey: K2, kid: 2, iv: nonce("refused good note") })).row;
  const trash = (await sealedRow({ plaintext: JSON.stringify(TRASH), notebookKey: K2, kid: 2, iv: nonce("refused good trash") })).row;
  const base = { notebookKey: K2, kid: 2, id: NOTE.id, modified: NOTE.modified };

  await refuseRow("one byte of the ciphertext changed", { ...good, ct: flip(good.ct, 40) });
  await refuseRow("one byte of the tag changed (the last 16 bytes)", { ...good, ct: flip(good.ct, -1) });
  await refuseRow("one byte of the nonce changed", { ...good, nonce: flip(good.nonce, 0) });
  await refuseRow("the row's id changed: it is a line of the AAD", { ...good, id: uuid("record another id") });
  await refuseRow("the row's modified changed by a millisecond", { ...good, modified: "2026-11-23T18:35:09.979Z" });
  await refuseRow("the row's modified written another way (…09.9780Z): the AAD is made from the row's bytes, not from the instant", { ...good, modified: "2026-11-23T18:35:09.9780Z" });
  await refuseRow("a deletedAt added to a row that was sealed without one", { ...good, deletedAt: T3 });
  await refuseRow("the deletedAt taken off a trash record's row", { v: trash.v, id: trash.id, modified: trash.modified, kid: trash.kid, nonce: trash.nonce, ct: trash.ct });
  await refuseRow("a trash record's deletedAt moved by a day", { ...trash, deletedAt: "2026-11-26T12:00:00.000Z" });
  await refuseRow("the row's kid changed to another key the device holds", { ...good, kid: 1 });
  await refuseRow("sealed under the right key with another kid in the AAD", await craftedRow({ ...base, plaintext: JSON.stringify(NOTE), iv: nonce("refused aad kid"), aad: c.rowAad({ ...base, kid: 1 }) }));
  await refuseRow("sealed with a device card's label where the row's belongs", await craftedRow({ ...base, plaintext: JSON.stringify(NOTE), iv: nonce("refused aad label"), aad: c.lines(c.LABELS.deviceCard, "2", NOTE.id, NOTE.modified, "") }));
  await refuseRow("sealed with no line for deletedAt: the AAD of a row without one still ends with the empty line's line feed", await craftedRow({ ...base, plaintext: JSON.stringify(NOTE), iv: nonce("refused aad short"), aad: c.lines(c.LABELS.row, "2", NOTE.id, NOTE.modified) }));
  await refuseRow("the wrong key: the device holds other bytes for this kid", good, [{ kid: 1, key: K1 }, { kid: 2, key: fixed("seal some other key", 32) }]);
  await refuseRow("sealed with the notebook key itself, not the record key made from it", {
    ...good,
    ct: await c.aesGcmSeal(K2, good.nonce, c.rowAad(good), c.padRecord(c.utf8(JSON.stringify(NOTE)))),
  });
  await refuseRow("a kid the device doesn't hold: kept aside while the device fetches its keyring, never deleted", { ...good, kid: 3 });
  await refuseRow("a row version the client doesn't know: kept aside, never deleted", { ...good, v: 2 });
  await refuseRow("the record's own id disagrees with the plain field", await craftedRow({ ...base, plaintext: JSON.stringify({ ...NOTE, id: uuid("record inner id") }), iv: nonce("refused inner id") }));
  await refuseRow("the record's own modified disagrees with the plain field", await craftedRow({ ...base, plaintext: JSON.stringify({ ...NOTE, modified: T2 }), iv: nonce("refused inner modified") }));
  await refuseRow("the record's modified differs from the plain field by a tenth of a millisecond (…09.9781Z)", await craftedRow({ ...base, plaintext: JSON.stringify({ ...NOTE, modified: "2026-11-23T18:35:09.9781Z" }), iv: nonce("refused inner fraction") }));
  await refuseRow("a trash record whose own deletedAt disagrees with the plain field", await craftedRow({ notebookKey: K2, kid: 2, id: TRASH.id, modified: TRASH.modified, deletedAt: T2, plaintext: JSON.stringify(TRASH), iv: nonce("refused inner deletedAt") }));
  await refuseRow("a trash record sealed with no deletedAt among the plain fields", await craftedRow({ notebookKey: K2, kid: 2, id: TRASH.id, modified: TRASH.modified, plaintext: JSON.stringify(TRASH), iv: nonce("refused trash without") }));
  await refuseRow("a record that isn't trash, sealed with a deletedAt among the plain fields", await craftedRow({ ...base, deletedAt: T3, plaintext: JSON.stringify(NOTE), iv: nonce("refused note with deletedAt") }));
  await refuseRow("bad padding: the record sealed with no padding, so its length isn't a multiple of 256", await craftedRow({ ...base, plaintext: JSON.stringify(NOTE), iv: nonce("refused unpadded"), pad: false }));
  await refuseRow("bad padding: padded with zero bytes, where the padding is spaces", await craftedRow({ ...base, bytes: Uint8Array.from([...c.utf8(JSON.stringify(NOTE)), ...new Uint8Array(512 - c.utf8(JSON.stringify(NOTE)).length)]), iv: nonce("refused zero padding"), pad: false }));
  await refuseRow("nothing but padding: 256 spaces", await craftedRow({ ...base, bytes: new Uint8Array(256).fill(0x20), iv: nonce("refused only spaces"), pad: false }));
  await refuseRow("a ciphertext that is a tag and nothing else", await craftedRow({ ...base, bytes: new Uint8Array(0), iv: nonce("refused empty"), pad: false }));
  await refuseRow("JSON that isn't an object: a list", await craftedRow({ ...base, plaintext: JSON.stringify([NOTE]), iv: nonce("refused list") }));
  await refuseRow("text that isn't JSON", await craftedRow({ ...base, plaintext: "id: " + NOTE.id, iv: nonce("refused not json") }));
  await refuseRow("bytes that aren't UTF-8", await craftedRow({ ...base, bytes: Uint8Array.from([0x7b, 0x22, 0xff, 0xfe, 0x22, 0x7d]), iv: nonce("refused not utf8") }));

  return {
    seal: {
      about:
        "Sealing a record: pad its serialized bytes, make the AAD from the plain fields, and seal with AES-256-GCM under the record key of the notebook key `kid`. `plaintext` is the record's JSON as text; the bytes sealed are its UTF-8. A client seals these exact bytes to reproduce `row.ct`; what it makes from its own serializer differs and is checked by opening it again. `aad` is the AAD as text and `aadHex` its bytes: lines lit-row/1, the kid in decimal, id, modified, and deletedAt, where a record that isn't trash has an empty last line, so its AAD ends with a line feed. A `row` is the row of the spec's \"A record on the service\" without `rev`, with `nonce` and `ct` in hex here (the service carries them in base64url), and `ct` ends with the 16-byte tag.",
      cases: seal,
    },
    open: {
      about:
        "Opening a row on a device that holds `keys`: the record, compared as JSON. The first cases are the rows `seal` made. `text` is the opened plaintext with its padding removed.",
      cases: open,
    },
    openRefused: {
      about:
        "Rows that must not be accepted, each with one thing wrong. `aside: true` (an unknown `v`, or a `kid` the device doesn't hold) means keep the row aside and fetch the keyring; every other refusal means skip the row, keep the device's own copy, and report it. No refusal ever deletes anything. The checks run in this order: the row's version, its kid, its own fields, the ciphertext's length, the seal, the JSON, and last the record's fields against the plain ones.",
      cases: openRefused,
    },
  };
}

async function keyringGroup() {
  const notebook = uuid("keyring notebook");
  const K = [1, 2, 3].map((n) => fixed(`keyring key ${n}`, 32));
  const b64 = c.toBase64url;
  const doc = (over = {}, keys = [[2, K[1]], [1, K[0]]]) =>
    JSON.stringify({ lit: "keyring", v: 1, notebook, current: 2, keys: keys.map(([kid, key]) => ({ kid, key: typeof key === "string" ? key : b64(key) })), ...over });

  const parse = [];
  const tryParse = (why, input) => {
    let expected;
    try {
      const k = c.parseKeyring(input);
      expected = { notebook: k.notebook, current: k.current, keys: fileKeys(k) };
    } catch (e) {
      if (!(e instanceof c.Refusal)) throw e;
      expected = { refused: e.why };
    }
    parse.push({ why, given: { text: input }, expected });
  };
  tryParse("a first keyring: one key, kid 1", c.keyringText(c.firstKeyring(notebook, K[0])));
  tryParse("two keys, newest first, as the reference writes one", doc());
  tryParse("two keys, oldest first: the order doesn't matter", doc({}, [[1, K[0]], [2, K[1]]]));
  tryParse("three keys", doc({ current: 3 }, [[3, K[2]], [2, K[1]], [1, K[0]]]));
  tryParse("a field this version doesn't know is ignored", doc({ note: "from a later client" }));
  tryParse("another `lit`", doc({ lit: "holder" }));
  tryParse("a `v` this client doesn't know", doc({ v: 2 }));
  tryParse("a kid missing: 1 and 3 where current is 3", doc({ current: 3 }, [[3, K[2]], [1, K[0]]]));
  tryParse("a gap filled by a repeat: kids 3, 1, 1", doc({ current: 3 }, [[3, K[2]], [1, K[0]], [1, K[0]]]));
  tryParse("a kid repeated with the list otherwise whole", doc({}, [[2, K[1]], [1, K[0]], [1, K[0]]]));
  tryParse("current lower than the newest key", doc({ current: 1 }));
  tryParse("current higher than the newest key", doc({ current: 3 }));
  tryParse("a kid of 0", doc({}, [[1, K[1]], [0, K[0]]]));
  tryParse("a kid that isn't a whole number", doc({}, [[2, K[1]], [1.5, K[0]]]));
  tryParse("no keys at all", doc({ current: 0 }, []));
  tryParse("a key of 31 bytes", doc({}, [[2, K[1]], [1, K[0].subarray(0, 31)]]));
  tryParse("a key of 33 bytes", doc({}, [[2, K[1]], [1, Uint8Array.from([...K[0], 0])]]));
  tryParse("a key in base64 with padding", doc({}, [[2, K[1]], [1, Buffer.from(K[0]).toString("base64")]]));
  tryParse("no notebook", JSON.stringify({ lit: "keyring", v: 1, current: 1, keys: [{ kid: 1, key: b64(K[0]) }] }));
  tryParse("text that isn't JSON", "keyring");
  tryParse("JSON that isn't an object", "[]");

  const held = c.nextKeyring(c.firstKeyring(notebook, K[0]), K[1]);
  const mine = { notebook, highest: held.current, keys: fileKeys(held) };
  const accept = [];
  const tryAccept = (why, incoming) => {
    let expected;
    try {
      c.checkKeyring({ held, incoming: c.parseKeyring(incoming) });
      expected = { accepted: true };
    } catch (e) {
      if (!(e instanceof c.Refusal)) throw e;
      expected = { refused: e.why };
    }
    accept.push({ why, given: { held: mine, text: incoming }, expected });
  };
  tryAccept("the keyring the device already holds", c.keyringText(held));
  tryAccept("the next keyring after a change of key: every key held, and a new one", c.keyringText(c.nextKeyring(held, K[2])));
  tryAccept("two changes of key ahead", c.keyringText(c.nextKeyring(c.nextKeyring(held, K[2]), fixed("keyring key 4", 32))));
  tryAccept("it drops a key by going backward: the keyring from before the last change of key", c.keyringText(c.firstKeyring(notebook, K[0])));
  tryAccept("it changes the bytes of a key the device holds (kid 1)", doc({}, [[2, K[1]], [1, fixed("keyring forged key 1", 32)]]));
  tryAccept("it changes the bytes of the current key (kid 2)", doc({}, [[2, fixed("keyring forged key 2", 32)], [1, K[0]]]));
  tryAccept("it names another notebook", c.keyringText({ ...held, notebook: uuid("keyring other notebook") }));
  tryAccept(
    "a forgery: the right notebook and a higher current, with keys the forger made for every kid",
    c.keyringText({ notebook, current: 3, keys: [3, 2, 1].map((kid) => ({ kid, key: fixed(`keyring forger's key ${kid}`, 32) })) }),
  );
  return {
    about:
      "`parse` is the keyring's own checks, on the JSON a sealed keyring opens to: `lit` and `v` known (`version`), the kids exactly the whole numbers from 1 to `current`, each once (`kids`), every key 32 bytes of base64url (`keySize`). `accept` is what a device that already holds a keyring (`held`: its notebook, the highest `current` it has accepted, and its keys) asks of one taken from the service: the same notebook (`notebook`), a `current` no lower than the highest accepted (`backward`), and every key it holds with the same bytes (`keyChanged`). A keyring that drops a held key is either malformed or lower, so it is refused by `parse` or as `backward`.",
    parse,
    accept,
  };
}

async function hpkeOpenGroup() {
  const notebook = uuid("hpke notebook");
  const one = c.firstKeyring(notebook, fixed("hpke key 1", 32));
  const three = c.nextKeyring(c.nextKeyring(one, fixed("hpke key 2", 32)), fixed("hpke key 3", 32));
  const recipient = keyPair("hpke recipient");
  const cases = [];
  let first;
  for (const [why, keyring, label] of [
    ["a keyring with one key, sealed to a device's public key", one, "hpke one"],
    ["a keyring with three keys", three, "hpke three"],
  ]) {
    const sealed = await sealKeyringTo(keyring, recipient, label);
    const context = await c.hpkeRecipientContext({ recipient, enc: sealed.enc, info: c.utf8(c.LABELS.keyring) });
    first ??= sealed;
    cases.push({
      why,
      given: { recipient, enc: sealed.enc, ciphertext: sealed.ct, info: c.LABELS.keyring, aad: "" },
      expected: {
        sharedSecret: context.sharedSecret,
        key: context.key,
        baseNonce: context.baseNonce,
        text: c.keyringText(keyring),
        keyring: { notebook: keyring.notebook, current: keyring.current, keys: fileKeys(keyring) },
      },
      sender: { ephemeral: sealed.ephemeral },
    });
  }
  const refuse = async (why, { enc = first.enc, ct = first.ct, to = recipient }) => {
    cases.push({
      why,
      given: { recipient: to, enc, ciphertext: ct, info: c.LABELS.keyring, aad: "" },
      expected: await refused(() => c.openKeyring({ recipient: to, enc, ct })),
    });
  };
  await refuse("one byte of the ciphertext changed", { ct: flip(first.ct, 10) });
  await refuse("one byte of the tag changed", { ct: flip(first.ct, -1) });
  await refuse("`enc` with one byte changed, which takes it off the curve: refused before any key agreement", { enc: flip(first.enc, 40) });
  await refuse("`enc` swapped for another valid point", { enc: keyPair("hpke other sender").public });
  await refuse("`enc` in compressed form (33 bytes)", { enc: Uint8Array.from([2 + (first.enc[64] & 1), ...first.enc.subarray(1, 33)]) });
  await refuse("opened with another device's key", { to: keyPair("hpke other recipient") });
  const plain = c.utf8(c.keyringText(one));
  const otherInfo = await c.hpkeSeal({ recipientPublic: recipient.public, info: "lit-notebook/2 keyring", plaintext: plain, ephemeral: keyPair("hpke other info sender") });
  await refuse("sealed with another `info` label (lit-notebook/2 keyring)", otherInfo);
  const withAad = await c.hpkeSeal({ recipientPublic: recipient.public, info: c.LABELS.keyring, aad: c.utf8("lit-notebook/1 keyring"), plaintext: plain, ephemeral: keyPair("hpke aad sender") });
  await refuse("sealed with an AAD, where a keyring's is empty", withAad);
  return {
    about:
      "HPKE (RFC 9180) in base mode, single-shot, with DHKEM(P-256, HKDF-SHA256), HKDF-SHA256, and AES-256-GCM (0x0010, 0x0001, 0x0002): the `info` is the ASCII bytes of lit-notebook/1 keyring and the AAD is empty. The cases run in the opening direction, since a platform's HPKE makes its own sender key: given the recipient's key pair, `enc`, and the ciphertext, the client opens the keyring. `sharedSecret`, `key`, and `baseNonce` are the values along the way, for a client that writes HPKE by hand; the nonce used is the base nonce (sequence number 0). `sender.ephemeral` is the sender's one-use key pair, for a client that can fix it and wants to reproduce the sealing too. Each client also checks that what it seals, it opens.",
    cases,
  };
}

const DEVICE_ADDED = "2026-11-23T18:40:00.000Z";

async function cardGroups() {
  const notebook = uuid("card notebook");
  const K1 = fixed("card notebook key 1", 32);
  const K2 = fixed("card notebook key 2", 32);
  const deviceId = uuid("card device");
  const otherDevice = uuid("card other device");
  const deviceKey = keyPair("card device key");
  const signKey = keyPair("card device signing key");
  const card = c.deviceCard({ public: deviceKey.public, sign: signKey.public, name: "Pixel 8", platform: "android", added: DEVICE_ADDED });
  const plaintext = JSON.stringify(card);
  const iv = nonce("card");
  const sealed = await c.sealDeviceCard({ notebookKey: K1, kid: 1, notebook, deviceId, text: plaintext, nonce: iv });
  const aad = c.lines(c.LABELS.deviceCard, notebook, "1", deviceId);
  same(sealed.ct, await gcmSeal(await hkdf(K1, c.LABELS.device), iv, aad, c.utf8(plaintext)), "a sealed card");
  const opened = await c.openDeviceCard({ notebookKey: K1, kid: 1, notebook, deviceId, ...sealed });

  const cardCases = [
    {
      why: "a device's card, sealed under the card key of the notebook key with kid 1",
      given: { notebookKey: K1, kid: 1, notebook, deviceId, nonce: iv, plaintext },
      expected: { cardKey: await c.cardKey(K1), aad: text(aad), aadHex: aad, ciphertext: sealed.ct, card: opened.card, public: opened.public, sign: opened.sign },
    },
  ];
  const openAs = { notebookKey: K1, kid: 1, notebook, deviceId, nonce: iv, ciphertext: sealed.ct };
  const refuseCard = async (why, over) => {
    const given = { ...openAs, ...over };
    cardCases.push({ why, given, expected: await refused(() => c.openDeviceCard({ ...given, ct: given.ciphertext })) });
  };
  await refuseCard("opened under another device's id: a card can't be moved to another entry", { deviceId: otherDevice });
  await refuseCard("opened as sealed under another kid", { kid: 2 });
  await refuseCard("opened for another notebook", { notebook: uuid("card other notebook") });
  await refuseCard("opened with another notebook key", { notebookKey: K2 });
  await refuseCard("one byte changed", { ciphertext: flip(sealed.ct, 5) });
  {
    const given = { notebookKey: K1, kid: 1, notebook, holderId: deviceId, nonce: iv, ciphertext: sealed.ct };
    cardCases.push({
      why: "opened as a holder's card (the label lit-holder-card/1, with the same ids)",
      given,
      expected: await refused(() => c.openHolderCard({ ...given, ct: given.ciphertext })),
    });
  }
  {
    // A card a faulty client sealed: its public key is not a point.
    const bad = JSON.stringify({ ...card, public: c.toBase64url(flip(deviceKey.public, 40)) });
    const badNonce = nonce("card bad public");
    const badSealed = await c.sealDeviceCard({ notebookKey: K1, kid: 1, notebook, deviceId, text: bad, nonce: badNonce });
    cardCases.push({
      why: "a card that opens, whose `public` is not a point on the curve: no keyring is ever sealed to it",
      given: { notebookKey: K1, kid: 1, notebook, deviceId, nonce: badNonce, ciphertext: badSealed.ct },
      expected: await refused(() => c.openDeviceCard({ notebookKey: K1, kid: 1, notebook, deviceId, ...badSealed })),
    });
    // A card whose `sign` is not a point still opens in version 1.
    const noSign = JSON.stringify({ ...card, sign: c.toBase64url(flip(signKey.public, 40)) });
    const noSignNonce = nonce("card bad sign");
    const noSignSealed = await c.sealDeviceCard({ notebookKey: K1, kid: 1, notebook, deviceId, text: noSign, nonce: noSignNonce });
    const read = await c.openDeviceCard({ notebookKey: K1, kid: 1, notebook, deviceId, ...noSignSealed });
    cardCases.push({
      why: "a card that opens, whose `sign` is not a point: version 1 refuses no card for its signing key, so it opens, with no signing key to show",
      given: { notebookKey: K1, kid: 1, notebook, deviceId, nonce: noSignNonce, ciphertext: noSignSealed.ct },
      expected: { card: read.card, public: read.public, sign: read.sign },
    });
  }
  const write = [];
  for (const [why, fields] of [
    ["a client refuses to write a card with no signing key", { public: deviceKey.public, name: "Pixel 8", platform: "android", added: DEVICE_ADDED }],
    ["a client refuses to write a card whose signing key is not a point", { public: deviceKey.public, sign: flip(signKey.public, 40), name: "Pixel 8", platform: "android", added: DEVICE_ADDED }],
    ["a client refuses to write a card whose device key is not a point", { public: flip(deviceKey.public, 40), sign: signKey.public, name: "Pixel 8", platform: "android", added: DEVICE_ADDED }],
  ]) {
    write.push({ why, given: fields, expected: await refused(() => c.deviceCard(fields)) });
  }

  // Sealing a card again keeps every field in it.
  const later = JSON.stringify({ ...card, name: "Mara’s phone", later: { since: 2, note: "a field version 1 doesn't know" } });
  const laterNonce = nonce("card with a later field");
  const laterSealed = await c.sealDeviceCard({ notebookKey: K1, kid: 1, notebook, deviceId, text: later, nonce: laterNonce });
  const newNonce = nonce("card sealed again");
  const again = await c.resealDeviceCard({ from: { notebookKey: K1, kid: 1 }, to: { notebookKey: K2, kid: 2 }, notebook, deviceId, ...laterSealed, newNonce });
  const reopened = await c.openDeviceCard({ notebookKey: K2, kid: 2, notebook, deviceId, ...again });
  if (reopened.text !== later) throw new Error("build: a card sealed again lost something");
  const reseal = {
    why: "a card with a field this version doesn't know, sealed again under a new key at a change of key: the field is still there",
    given: {
      from: { notebookKey: K1, kid: 1, nonce: laterNonce, ciphertext: laterSealed.ct },
      to: { notebookKey: K2, kid: 2, nonce: newNonce },
      notebook,
      deviceId,
    },
    expected: {
      plaintext: later,
      card: reopened.card,
      ciphertext: again.ct,
      note: "`ciphertext` is what a client gets by sealing the card's own bytes again, untouched. A client that parses the card and writes it out again gets other bytes; what it must show is that its resealed card opens under the new key and kid to a card equal to `card` as JSON, the unknown field included.",
    },
  };

  // Holder cards.
  const holderId = uuid("card holder");
  const holderKey = keyPair("card holder key");
  const credential = fixed("card passkey credential id", 20);
  const holderCases = [];
  const sealedHolder = {};
  for (const [kind, name, fields] of [
    ["passkey", "iCloud Keychain", { credential }],
    ["recovery", "Recovery code", {}],
  ]) {
    const hCard = c.holderCard({ public: holderKey.public, kind, ...fields, name, added: DEVICE_ADDED });
    const hText = JSON.stringify(hCard);
    const hNonce = nonce(`holder card ${kind}`);
    const hSealed = await c.sealHolderCard({ notebookKey: K1, kid: 1, notebook, holderId, text: hText, nonce: hNonce });
    const hAad = c.lines(c.LABELS.holderCard, notebook, "1", holderId);
    same(hSealed.ct, await gcmSeal(await hkdf(K1, c.LABELS.device), hNonce, hAad, c.utf8(hText)), "a sealed holder card");
    const hOpened = await c.openHolderCard({ notebookKey: K1, kid: 1, notebook, holderId, ...hSealed });
    sealedHolder[kind] = { nonce: hNonce, ct: hSealed.ct };
    holderCases.push({
      why: kind === "passkey" ? "a passkey holder's card, which carries the passkey's credential id" : "the recovery holder's card, which has no credential",
      given: { notebookKey: K1, kid: 1, notebook, holderId, nonce: hNonce, plaintext: hText },
      expected: { cardKey: await c.cardKey(K1), aad: text(hAad), aadHex: hAad, ciphertext: hSealed.ct, card: hOpened.card, public: hOpened.public },
    });
  }
  const p = sealedHolder.passkey;
  for (const [why, given, open] of [
    ["opened under another holder's id", { notebookKey: K1, kid: 1, notebook, holderId: uuid("card other holder"), nonce: p.nonce, ciphertext: p.ct }, c.openHolderCard],
    ["opened as sealed under another kid", { notebookKey: K1, kid: 2, notebook, holderId, nonce: p.nonce, ciphertext: p.ct }, c.openHolderCard],
    ["opened as a device's card (the label lit-device/1, with the same ids)", { notebookKey: K1, kid: 1, notebook, deviceId: holderId, nonce: p.nonce, ciphertext: p.ct }, c.openDeviceCard],
  ]) {
    holderCases.push({ why, given, expected: await refused(() => open({ ...given, ct: given.ciphertext })) });
  }

  return {
    card: {
      about:
        "A device's card: AES-256-GCM under the card key (HKDF of the notebook key with lit-notebook/1 device), with the AAD lines lit-device/1, the notebook's id, the kid in decimal, and the device's id. `plaintext` is the card's JSON as text, and a sealed card is its nonce and its ciphertext with the tag. `public` and `sign` inside it are base64url, as the spec says; `expected.public` and `expected.sign` are the same keys in hex. A card opens only under the notebook, kid, and device id it was sealed for. A client checks `public` to be a point before using it, and refuses to write a card without a valid point in both.",
      cases: cardCases,
      write,
      reseal,
    },
    holderCard: {
      about:
        "A holder's card: sealed like a device's card, under the same card key, with the AAD lines lit-holder-card/1, the notebook's id, the kid, and the holder's id.",
      cases: holderCases,
    },
  };
}

async function prfGroup() {
  const input = await c.prfInput();
  same(input.hashed, createHash("sha256").update(Buffer.concat([Buffer.from("WebAuthn PRF"), Buffer.from([0]), Buffer.from(c.PRF_INPUT)])).digest(), "the hashed PRF input");
  const b64 = (label, n) => c.toBase64url(fixed(`prf ${label}`, n));
  const id = b64("credential id", 20);
  const created = {
    id,
    rawId: id,
    type: "public-key",
    authenticatorAttachment: "platform",
    response: { clientDataJSON: b64("create clientDataJSON", 96), attestationObject: b64("attestationObject", 160), transports: ["internal", "hybrid"] },
    clientExtensionResults: { credProps: { rk: true }, prf: { enabled: true, results: { first: b64("output", 32) } } },
  };
  const used = {
    id,
    rawId: id,
    type: "public-key",
    authenticatorAttachment: "platform",
    response: { clientDataJSON: b64("get clientDataJSON", 96), authenticatorData: b64("authenticatorData", 37), signature: b64("signature", 70), userHandle: b64("userHandle", 16) },
    clientExtensionResults: { prf: { results: { first: b64("output", 32) } } },
  };
  const without = { ...used, clientExtensionResults: {} };
  return {
    about:
      "The fixed input a passkey's PRF is evaluated at, in each form a client meets it, and what leaves the device. `bytes` is the 18 ASCII bytes given as the extension's first value (`eval.first`); `base64url` is how a request's JSON carries them (Android's Credential Manager); `hashed` is what the platform sends the passkey, SHA-256 of the ASCII bytes of WebAuthn PRF, one zero byte, and the input. `responses` are passkey responses in the JSON form (made-up bytes, in base64url as that form has them): before a response goes to the service, `clientExtensionResults.prf.results` is removed and nothing else is, and the service refuses a response that still has it.",
    input: { text: c.PRF_INPUT, bytes: input.bytes, base64url: input.base64url, hashed: input.hashed },
    responses: [
      { why: "a response from creating a passkey, where the PRF answered at once: `enabled` stays, `results` goes", given: { response: created }, expected: { toService: c.stripPrfResults(created) } },
      { why: "a response from using a passkey: `prf` is left empty", given: { response: used }, expected: { toService: c.stripPrfResults(used) } },
      { why: "a response with no PRF results is sent as it is", given: { response: without }, expected: { toService: c.stripPrfResults(without) } },
    ],
  };
}

async function holderGroup(kind) {
  const tag = `${kind} holder`;
  const notebook = uuid(`${tag} notebook`);
  const K = [1, 2, 3].map((n) => fixed(`${tag} notebook key ${n}`, 32));
  const one = c.firstKeyring(notebook, K[0]);
  const two = c.nextKeyring(one, K[1]);
  const three = c.nextKeyring(two, K[2]);
  const id = uuid(tag);
  const key = keyPair(`${tag} key`);
  const passkey = kind === "passkey";
  const credential = passkey ? fixed(`${tag} credential id`, 20) : undefined;

  // The secret, and the key made from it.
  const prf = fixed(`${tag} prf output`, 32);
  const code = fixed(`${tag} code`, c.RECOVERY_CODE_BYTES);
  const secretKey = passkey ? await c.passkeyKey(prf) : await c.codeKey(code);
  same(secretKey, await hkdf(passkey ? prf : code, passkey ? c.LABELS.passkey : c.LABELS.recovery), "a holder's secret key");
  const secret = passkey ? { prf } : { code, typed: c.formatRecoveryCode(code) };
  const wrongSecretKey = passkey ? await c.passkeyKey(fixed(`${tag} another prf output`, 32)) : await c.codeKey(fixed(`${tag} another code`, c.RECOVERY_CODE_BYTES));
  const wrongSecret = passkey ? { prf: fixed(`${tag} another prf output`, 32) } : { code: fixed(`${tag} another code`, c.RECOVERY_CODE_BYTES), typed: c.formatRecoveryCode(fixed(`${tag} another code`, c.RECOVERY_CODE_BYTES)) };

  // The holder was made while kid 2 was current, so its anchor is key 2.
  const record = c.holderRecord({ notebook, kind, id, credential, d: key.d, public: key.public, anchor: { kid: 2, key: K[1] } });
  const plaintext = JSON.stringify(record);
  const iv = nonce(`${tag} record`);
  const sealed = await c.sealHolderRecord({ secretKey, text: plaintext, nonce: iv });
  const aad = c.lines(c.LABELS.holder, kind, id);
  same(sealed.ct, await gcmSeal(secretKey, iv, aad, c.utf8(plaintext)), "a sealed holder record");
  const sealedKeyring = await sealKeyringTo(two, key, `${tag} keyring`);

  const service = { kind, id, notebook, ...(passkey ? { credential } : {}), record: { nonce: iv, ciphertext: sealed.ct }, keyring: { enc: sealedKeyring.enc, ciphertext: sealedKeyring.ct } };
  const open = (s, k = secretKey, answered = credential) =>
    c.openHolder({
      secretKey: k,
      kind: s.kind,
      id: s.id,
      notebook: s.notebook,
      credential: answered,
      sealed: { nonce: s.record.nonce, ct: s.record.ciphertext },
      keyring: { enc: s.keyring.enc, ct: s.keyring.ciphertext },
    });
  const result = await open(service);
  const keyringOut = (k) => ({ notebook: k.notebook, current: k.current, keys: fileKeys(k) });

  const cases = [
    {
      why: passkey
        ? "a device comes in with the passkey: the PRF's 32 bytes make the passkey key, the record opens, and the keyring sealed to the holder is accepted by its anchor"
        : "a device comes in with the recovery code: its 15 bytes make the code key, the record opens, and the keyring sealed to the holder is accepted by its anchor",
      given: { secret, ...(passkey ? { answered: credential } : {}), service },
      expected: {
        secretKey,
        aad: text(aad),
        aadHex: aad,
        plaintext,
        record: result.record,
        holderKey: result.key,
        keyringText: c.keyringText(result.keyring),
        keyring: keyringOut(result.keyring),
      },
      sender: { recordSealedWith: { nonce: iv }, keyringSealedWith: { ephemeral: sealedKeyring.ephemeral } },
    },
  ];
  const later = await sealKeyringTo(three, key, `${tag} later keyring`);
  {
    const s = { ...service, keyring: { enc: later.enc, ciphertext: later.ct } };
    const r = await open(s);
    cases.push({
      why: "the keyring has moved on since the holder was made (a change of key): it still holds the anchor's key, so it is accepted",
      given: { secret, ...(passkey ? { answered: credential } : {}), service: s },
      expected: { keyring: keyringOut(r.keyring) },
    });
  }

  const refuse = async (why, { s = service, k = secretKey, sec = secret, answered = credential }) => {
    cases.push({ why, given: { secret: sec, ...(passkey ? { answered } : {}), service: s }, expected: await refused(() => open(s, k, answered)) });
  };
  const resealed = async (fields, label) => {
    const t = JSON.stringify({ ...record, ...fields });
    const n = nonce(`${tag} ${label}`);
    // The AAD stays the one the service's kind and id make, so check 1 passes.
    const ct = await c.aesGcmSeal(secretKey, n, aad, c.utf8(t));
    return { ...service, record: { nonce: n, ciphertext: ct } };
  };
  const keyringFor = async (k, label) => {
    const sealedTo = await sealKeyringTo(k, key, `${tag} ${label}`);
    return { ...service, keyring: { enc: sealedTo.enc, ciphertext: sealedTo.ct } };
  };
  const otherKind = passkey ? "recovery" : "passkey";

  await refuse(passkey ? "the wrong PRF output: this passkey doesn't open this notebook" : "the wrong code", { k: wrongSecretKey, sec: wrongSecret });
  await refuse("the service names another holder id than the record was sealed for", { s: { ...service, id: uuid(`${tag} another`) } });
  await refuse("the service names the other kind", { s: { ...service, kind: otherKind } });
  await refuse("one byte of the sealed record changed", { s: { ...service, record: { nonce: iv, ciphertext: flip(sealed.ct, 30) } } });
  await refuse("the record opens, and says it is of the other kind", { s: await resealed({ kind: otherKind }, "record other kind") });
  await refuse("the record opens, and carries another id", { s: await resealed({ id: uuid(`${tag} inner`) }, "record other id") });
  await refuse("the record opens, with a `v` this client doesn't know", { s: await resealed({ v: 2 }, "record v2") });
  await refuse("the record opens, and is for another notebook than the account's", { s: await resealed({ notebook: uuid(`${tag} other notebook`) }, "record other notebook") });
  await refuse("the record opens, and its private key is 31 bytes", { s: await resealed({ d: c.toBase64url(key.d.subarray(0, 31)) }, "record short d") });
  if (passkey) {
    await refuse("the record's `credential` is not the passkey that answered", { answered: fixed(`${tag} another credential id`, 20) });
  }
  await refuse("the keyring sealed to the holder has one byte changed", { s: { ...service, keyring: { enc: sealedKeyring.enc, ciphertext: flip(sealedKeyring.ct, 12) } } });
  {
    const stranger = keyPair(`${tag} stranger`);
    const sealedTo = await sealKeyringTo(two, stranger, `${tag} stranger keyring`);
    await refuse("the keyring was sealed to another key than the holder's", { s: { ...service, keyring: { enc: sealedTo.enc, ciphertext: sealedTo.ct } } });
  }
  await refuse("the keyring lacks the anchor's key: an older keyring, from before the holder was made", { s: await keyringFor(one, "older keyring") });
  await refuse("the keyring holds other bytes for the anchor's kid: anyone who knows the holder's public key could seal this one", {
    s: await keyringFor({ notebook, current: 2, keys: [{ kid: 2, key: fixed(`${tag} forged key 2`, 32) }, { kid: 1, key: K[0] }] }, "forged keyring"),
  });
  await refuse("the keyring names another notebook", { s: await keyringFor({ ...two, notebook: uuid(`${tag} keyring other notebook`) }, "other notebook keyring") });

  const how = passkey
    ? "The passkey key is HKDF(the PRF's 32 bytes, lit-notebook/1 passkey, 32 bytes). `answered` is the credential id of the passkey that just answered."
    : "The code key is HKDF(the code's 15 bytes, lit-notebook/1 recovery, 32 bytes). `typed` is the code as the reader types it.";
  return {
    about: `${how} \`service\` is what the service hands a device that asks to come in through the holder: its kind, id, and the notebook's id in plain, the sealed record (AES-256-GCM under the secret's key, with the AAD lines lit-holder/1, the kind, and the id), and the keyring sealed to the holder's public key with HPKE. The four checks run in order and stop at the first failure; a refusal's \`check\` says which: 1, the record opens; 2, the record is what it should be; 3, the sealed keyring opens with the record's private key and passes the keyring's own checks; 4, the keyring names the record's notebook and holds the anchor's key with the same bytes. \`plaintext\` is the record's JSON, with its byte strings in base64url as the spec says; \`holderKey\` is the holder's key pair in hex.`,
    cases,
  };
}

async function approvalGroup() {
  const notebook = uuid("approval notebook");
  const held = c.nextKeyring(c.firstKeyring(notebook, fixed("approval notebook key 1", 32)), fixed("approval notebook key 2", 32));
  const code = fixed("approval code", c.APPROVAL_CODE_BYTES);
  const { id, macKey } = await c.approvalKeys(code);
  same(c.fromHex(id), await hkdf(code, c.LABELS.approveId, 16), "the approval id");
  same(macKey, await hkdf(code, c.LABELS.approveMac), "the approval MAC key");

  const device = { id: uuid("approval new device"), key: keyPair("approval new device key"), sign: keyPair("approval new device signing key") };
  const asked = { deviceId: device.id, platform: "android", model: "Pixel 8", public: device.key.public, sign: device.sign.public };
  const requestInput = c.lines(c.LABELS.approveRequest, id, asked.deviceId, asked.platform, asked.model, c.toBase64url(asked.public), c.toBase64url(asked.sign));
  const requestMac = await c.approvalRequestMac({ macKey, id, ...asked });
  same(requestMac, createHmac("sha256", macKey).update(requestInput).digest(), "the request MAC");
  const request = { ...asked, mac: requestMac };
  await c.checkApprovalRequest({ macKey, id, request });

  const ephemeral = keyPair("approval grant sender");
  const cardNonce = nonce("approval card");
  const grant = await c.makeGrant({ macKey, id, request, keyring: held, added: DEVICE_ADDED, cardNonce, ephemeral });
  const grantInput = c.lines(c.LABELS.approveGrant, id, String(grant.kid), c.toBase64url(grant.enc), c.toBase64url(grant.ct));
  same(grant.mac, createHmac("sha256", macKey).update(grantInput).digest(), "the grant MAC");
  const mine = { id: device.id, key: device.key, sign: device.sign.public };
  const accepted = await c.acceptGrant({ macKey, id, grant, device: mine });
  const fileGrant = (g) => ({ kid: g.kid, enc: g.enc, ciphertext: g.ct, card: { nonce: g.card.nonce, ciphertext: g.card.ct }, mac: g.mac });

  const refusedCases = [];
  const refuseRequest = async (why, over) => {
    const r = { ...request, ...over };
    refusedCases.push({ why, given: { code, request: r }, expected: await refused(() => c.checkApprovalRequest({ macKey, id, request: r })) });
  };
  await refuseRequest("the request's device key swapped for another (the service putting in its own)", { public: keyPair("approval intruder key").public });
  await refuseRequest("the request's signing key swapped for another", { sign: keyPair("approval intruder signing key").public });
  await refuseRequest("the request's model changed", { model: "Pixel 9" });
  await refuseRequest("the request's device id changed", { deviceId: uuid("approval another device") });
  await refuseRequest("one byte of the request's MAC changed", { mac: flip(requestMac, 0) });
  {
    const other = await c.approvalKeys(fixed("approval another code", c.APPROVAL_CODE_BYTES));
    refusedCases.push({
      why: "a request made with another code: its MAC doesn't check under this code's key",
      given: { code, request: { ...request, mac: await c.approvalRequestMac({ macKey: other.macKey, id, ...asked }) } },
      expected: await refused(async () => c.checkApprovalRequest({ macKey, id, request: { ...request, mac: await c.approvalRequestMac({ macKey: other.macKey, id, ...asked }) } })),
    });
  }
  {
    const model = "Pixel 8\nlit-approve/1 grant";
    refusedCases.push({
      why: "a model with a line feed in it: no value in a MAC's lines may hold one, so no request is made",
      given: { code, request: { ...asked, model } },
      expected: await refused(() => c.approvalRequestMac({ macKey, id, ...asked, model })),
    });
  }
  const refuseGrant = async (why, g) => {
    refusedCases.push({ why, given: { code, device, grant: fileGrant(g) }, expected: await refused(() => c.acceptGrant({ macKey, id, grant: g, device: mine })) });
  };
  await refuseGrant("the grant's `enc` swapped for another point", { ...grant, enc: keyPair("approval intruder sender").public });
  await refuseGrant("one byte of the grant's ciphertext changed", { ...grant, ct: flip(grant.ct, 9) });
  await refuseGrant("the grant's kid changed", { ...grant, kid: 1 });
  await refuseGrant("one byte of the grant's MAC changed", { ...grant, mac: flip(grant.mac, 31) });
  {
    // A keyring of the service's own, sealed to the new device's key: without the code, no MAC.
    const forged = c.firstKeyring(notebook, fixed("approval forged key", 32));
    const sealedTo = await sealKeyringTo(forged, device.key, "approval forged keyring");
    await refuseGrant("a keyring of the service's own, sealed to the new device's key: without the code it has no MAC to send, and the real grant's doesn't fit", { ...grant, kid: 1, enc: sealedTo.enc, ct: sealedTo.ct });
  }
  {
    // A faulty approver: everything under the code, but the kid it names is not the keyring's current.
    const kid = 1;
    await refuseGrant("a grant whose MAC checks, naming a kid that isn't its keyring's current", { ...grant, kid, mac: await c.approvalGrantMac({ macKey, id, kid, enc: grant.enc, ct: grant.ct }) });
  }
  {
    const stranger = c.deviceCard({ public: keyPair("approval stranger key").public, sign: device.sign.public, name: asked.model, platform: asked.platform, added: DEVICE_ADDED });
    const n = nonce("approval stranger card");
    const card = await c.sealDeviceCard({ notebookKey: c.keyOf(held, 2), kid: 2, notebook, deviceId: device.id, card: stranger, nonce: n });
    await refuseGrant("a grant whose card names another device key than this device's", { ...grant, card });
  }
  {
    const n = nonce("approval misplaced card");
    const card = await c.sealDeviceCard({
      notebookKey: c.keyOf(held, 2), kid: 2, notebook, deviceId: uuid("approval another device"),
      card: c.deviceCard({ public: asked.public, sign: asked.sign, name: asked.model, platform: asked.platform, added: DEVICE_ADDED }), nonce: n,
    });
    await refuseGrant("a grant whose card was sealed for another device's id", { ...grant, card });
  }

  return {
    about:
      "Adding a device by approval. Both devices make the approval's id (HKDF of the code's 10 bytes with lit-notebook/1 approve-id, 16 bytes, written as 32 lowercase hex characters) and its MAC key (HKDF with lit-notebook/1 approve-mac, 32 bytes). Each MAC is HMAC-SHA-256 over lines, given here as `macInput` (text) with the keys and ciphertexts in base64url, as the MAC takes them. The grant's keyring is sealed with HPKE as in `hpkeOpen`, and its card is the new device's card, written by the approving device: the model as its name, and both public keys from the request. The new device checks, in order: the grant's MAC (`mac`); that the keyring opens and passes its own checks; that its `current` is the grant's kid (`grantKid`); and that the card opens for its own id under that key and names both of its public keys (`card`).",
    case: {
      why: "a new device asks, a device that holds the keyring grants, and the new device accepts",
      given: {
        code,
        codeText: c.formatApprovalCode(code),
        device,
        request: { deviceId: asked.deviceId, platform: asked.platform, model: asked.model, public: asked.public, sign: asked.sign },
        approver: { notebook, keys: fileKeys(held), cardNonce, added: DEVICE_ADDED, ephemeral },
      },
      expected: {
        id,
        macKey,
        request: { macInput: text(requestInput), mac: requestMac },
        grant: { ...fileGrant(grant), macInput: text(grantInput) },
        accepted: { keyring: { notebook: accepted.keyring.notebook, current: accepted.keyring.current, keys: fileKeys(accepted.keyring) }, card: accepted.card },
      },
    },
    refused: refusedCases,
  };
}

async function signingKeyGroup() {
  const key = keyPair("signing key");
  const other = keyPair("another signing key");
  const node = createPublicKey({ key: { kty: "EC", crv: "P-256", x: c.toBase64url(key.public.subarray(1, 33)), y: c.toBase64url(key.public.subarray(33)) }, format: "jwk" });
  const message = c.utf8("lit-notebook/1 a message a later version might sign");

  // Four signing numbers, each searched for from the same fixed start, so every shape of DER appears.
  const wanted = [
    ["r and s both begin with a high bit, so each takes a zero byte in DER (72 bytes)", (r, s) => r[0] & 0x80 && s[0] & 0x80],
    ["neither r nor s begins with a high bit (70 bytes of DER)", (r, s) => !(r[0] & 0x80) && !(s[0] & 0x80) && r[0] && s[0]],
    ["r begins with a zero byte, which DER drops", (r) => r[0] === 0 && !(r[1] & 0x80)],
    ["only s begins with a high bit, so only s takes a zero byte (71 bytes of DER)", (r, s) => !(r[0] & 0x80) && r[0] && s[0] & 0x80],
  ];
  const digest = createHash("sha256").update(message).digest();
  const cases = [];
  for (const [why, fits] of wanted) {
    for (let i = 0; ; i++) {
      const k = fixed(`signing number ${i}`, 32);
      const signature = signWithNumber(key.d, k, digest);
      if (!signature || !fits(signature.subarray(0, 32), signature.subarray(32))) continue;
      const der = c.signatureToDer(signature);
      if (!(await c.verifySignature(key.public, message, signature))) throw new Error("build: a made signature does not verify");
      if (!nodeVerify("sha256", message, { key: node, dsaEncoding: "ieee-p1363" }, signature)) throw new Error("build: node:crypto refuses r ‖ s");
      if (!nodeVerify("sha256", message, { key: node, dsaEncoding: "der" }, der)) throw new Error("build: node:crypto refuses the DER form");
      same(c.signatureFromDer(der), signature, "DER and back");
      cases.push({ why, given: { public: key.public, message, signature, der }, expected: { verifies: true }, signer: { number: k } });
      break;
    }
  }
  const good = cases[0].given;
  const unverified = [];
  for (const [why, over] of [
    ["one byte of r changed", { signature: flip(good.signature, 3) }],
    ["one byte of s changed", { signature: flip(good.signature, 40) }],
    ["one byte of the message changed", { message: flip(message, 0) }],
    ["another device's signing key", { public: other.public }],
    ["a signature of 63 bytes", { signature: good.signature.subarray(0, 63) }],
    ["the DER form where r ‖ s belongs", { signature: good.der }],
    ["r and s both zero", { signature: new Uint8Array(64) }],
    ["a public key that is not a point", { public: flip(key.public, 40) }],
  ]) {
    const given = { public: good.public, message, signature: good.signature, ...over };
    if (await c.verifySignature(given.public, given.message, given.signature)) throw new Error(`build: "${why}" verified`);
    unverified.push({ why, given, expected: { verifies: false } });
  }
  const der = good.der;
  const derRefused = [];
  for (const [why, bytes] of [
    ["a byte after the end", Uint8Array.from([...der, 0])],
    ["cut one byte short", der.subarray(0, der.length - 1)],
    ["r padded with a zero byte it doesn't need", (() => {
      const plain = cases[1].given.der; // neither number needs padding here
      const rLen = plain[3];
      return Uint8Array.from([0x30, plain[1] + 1, 2, rLen + 1, 0, ...plain.subarray(4)]);
    })()],
    ["r without the zero byte it needs, which makes it negative", (() => {
      const rLen = der[3];
      return Uint8Array.from([0x30, der[1] - 1, 2, rLen - 1, ...der.subarray(5)]);
    })()],
    ["the sequence's length in the long form", Uint8Array.from([0x30, 0x81, der[1], ...der.subarray(2)])],
    ["the wrong tag on the sequence", Uint8Array.from([0x31, ...der.subarray(1)])],
    ["nothing", new Uint8Array(0)],
  ]) {
    derRefused.push({ why, given: { der: bytes }, expected: await refused(() => c.signatureFromDer(bytes)) });
  }
  return {
    about:
      "The signing key, reserved: every device makes one (P-256, for ECDSA with SHA-256) and carries its public half in its card as `sign`, and nothing checks a signature in version 1. These cases are for the day something does. A signature is the 64 bytes r ‖ s (WebCrypto's output and CryptoKit's rawRepresentation); `der` is the same signature as Android's Signature gives it, and each form converts to the other. ECDSA picks a fresh number for every signature, so the cases run in the verifying direction; `signer.number` is the number these were made with, for a client that can fix it. Each client also checks that what it signs, it verifies.",
    key: { d: key.d, public: key.public, sign: c.toBase64url(key.public) },
    verify: [...cases, ...unverified],
    derRefused,
  };
}

function pointGroup() {
  const key = keyPair("point");
  const x = key.public.subarray(1, 33);
  const y = key.public.subarray(33);
  const negY = toBytes(P - BigInt("0x" + c.toHex(y)));
  const zeroX = [0n, fieldSqrt(B)];
  // A point with x = 0 is on the curve; the same point with x written as p (which is 0 again) is not an encoding of anything.
  const cases = [
    ["a device's public key", key.public, true],
    ["the same x with the other y (the point's negative): also on the curve", Uint8Array.from([4, ...x, ...negY]), true],
    ["the curve's base point", encodePoint([0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296n, 0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5n]), true],
    ["the point with x = 0, which is on the curve", encodePoint(zeroX), true],
    ["y changed by one bit: off the curve", flip(key.public, 64), false],
    ["x changed by one bit: off the curve", flip(key.public, 1), false],
    ["x written as the field's size p, where the point has x = 0: a coordinate must be less than p", Uint8Array.from([4, ...toBytes(P), ...toBytes(zeroX[1])]), false],
    ["y written as the field's size p", Uint8Array.from([4, ...toBytes(0n), ...toBytes(P)]), false],
    ["x and y both zero", Uint8Array.from([4, ...new Uint8Array(64)]), false],
    ["the compressed form (33 bytes, beginning 02 or 03)", Uint8Array.from([2 + (y[31] & 1), ...x]), false],
    ["the hybrid form (65 bytes, beginning 06 or 07)", Uint8Array.from([6 + (y[31] & 1), ...x, ...y]), false],
    ["x and y with no 04 in front (64 bytes)", Uint8Array.from([...x, ...y]), false],
    ["a byte too many (66 bytes)", Uint8Array.from([...key.public, 0]), false],
    ["a byte too few (64 bytes)", key.public.subarray(0, 64), false],
    ["the one-byte encoding of the point at infinity", Uint8Array.of(0), false],
    ["nothing", new Uint8Array(0), false],
  ].map(([why, bytes, valid]) => {
    if (c.isP256Point(bytes) !== valid) throw new Error(`build: point case "${why}" came out wrong`);
    if (valid && curveAt(BigInt("0x" + c.toHex(bytes.subarray(1, 33)))) !== (BigInt("0x" + c.toHex(bytes.subarray(33))) ** 2n) % P) throw new Error("build: a valid point is off the curve");
    return { why, given: { bytes }, expected: { valid } };
  });
  return {
    about:
      "A public key is the 65-byte uncompressed point, 04 ‖ x ‖ y, with x and y each less than the field's size and y² = x³ − 3x + b. Every public key a client is given, and HPKE's `enc`, is checked before it is used; anything else is refused.",
    cases,
  };
}

async function base64urlGroup() {
  const cases = [];
  for (const [why, bytes] of [
    ["no bytes", new Uint8Array(0)],
    ["one byte", Uint8Array.of(0xfb)],
    ["two bytes", Uint8Array.of(0xfb, 0xff)],
    ["three bytes: the characters - and _ where base64 has + and /", Uint8Array.of(0xfb, 0xff, 0xfe)],
    ["a 32-byte key", fixed("base64url key", 32)],
    ["a 65-byte public key", keyPair("base64url").public],
  ]) {
    const written = c.toBase64url(bytes);
    same(c.fromBase64url(written), bytes, "base64url and back");
    if (written !== Buffer.from(bytes).toString("base64url")) throw new Error("build: base64url disagrees with node");
    cases.push({ why, given: { bytes }, expected: { text: written } });
  }
  const refusedCases = [];
  for (const [why, typed] of [
    ["padding", "-w=="],
    ["the + of ordinary base64", "+/8"],
    ["the / of ordinary base64", "-/8"],
    ["a length no byte string encodes to (one character)", "A"],
    ["a length no byte string encodes to (five characters)", "AAAAA"],
    ["leftover bits that aren't zero: -x where one byte is written -w", "-x"],
    ["leftover bits that aren't zero: three characters", "-_9"],
    ["a space inside", "-_ 8"],
    ["a line break at the end", "-_8\n"],
  ]) {
    refusedCases.push({ why, given: { text: typed }, expected: await refused(() => c.fromBase64url(typed)) });
  }
  return {
    about:
      "Byte strings inside sealed JSON (a keyring's keys, a card's public keys, a holder record's keys) and in a MAC's lines are base64url without padding (RFC 4648, section 5). A client writes each byte string the one way and refuses any other spelling: padding, + or /, any other character, an impossible length, or leftover bits that aren't zero.",
    cases,
    refused: refusedCases,
  };
}

/* ── The walkthrough ─────────────────────────────────────────────────── */

async function walkthroughGroup() {
  const W = "walkthrough";
  const notebook = uuid(`${W} notebook`);
  const K = [1, 2, 3].map((n) => fixed(`${W} notebook key ${n}`, 32));
  const mk = (label, name, platform) => ({ id: uuid(`${W} ${label}`), key: keyPair(`${W} ${label} key`), sign: keyPair(`${W} ${label} signing key`), name, platform });
  const A = mk("device A", "iPhone", "ios");
  const Bd = mk("device B", "Safari on Mac", "web");
  const C = mk("device C", "Pixel 8", "android");
  const D = mk("device D", "Firefox on Windows", "web");
  const keyringOut = (k) => ({ notebook: k.notebook, current: k.current, keys: fileKeys(k) });
  const proofOf = async (key) => {
    const proof = await c.keyProof(key);
    return { proof, hash: await c.keyProofHash(proof) };
  };
  const sealedOut = (s) => ({ ephemeral: s.ephemeral, enc: s.enc, ciphertext: s.ct });

  /** A device's own card, sealed under the key `kid`. */
  const cardFor = async (device, kid, added, label) => {
    const card = c.deviceCard({ public: device.key.public, sign: device.sign.public, name: device.name, platform: device.platform, added });
    const plaintext = JSON.stringify(card);
    const iv = nonce(`${W} ${label}`);
    const sealed = await c.sealDeviceCard({ notebookKey: K[kid - 1], kid, notebook, deviceId: device.id, text: plaintext, nonce: iv });
    return { plaintext, nonce: iv, ciphertext: sealed.ct, aad: text(c.lines(c.LABELS.deviceCard, notebook, String(kid), device.id)) };
  };
  const resealCard = async (device, card, fromKid, toKid, label) => {
    const newNonce = nonce(`${W} ${label}`);
    const again = await c.resealDeviceCard({
      from: { notebookKey: K[fromKid - 1], kid: fromKid }, to: { notebookKey: K[toKid - 1], kid: toKid },
      notebook, deviceId: device.id, nonce: card.nonce, ct: card.ciphertext, newNonce,
    });
    return { plaintext: card.plaintext, nonce: newNonce, ciphertext: again.ct, aad: text(c.lines(c.LABELS.deviceCard, notebook, String(toKid), device.id)) };
  };
  const rowsUnder = async (records, kid, label) => {
    const rows = [];
    for (const [i, record] of records.entries()) {
      rows.push((await sealedRow({ plaintext: JSON.stringify(record), notebookKey: K[kid - 1], kid, iv: nonce(`${W} ${label} row ${i}`) })).row);
    }
    return rows;
  };

  const records = [NOTE, HIGHLIGHT, BOOKMARK];
  const steps = [];

  // 1. The first device sets up, under "follows my account".
  const ring1 = c.firstKeyring(notebook, K[0]);
  const prf = fixed(`${W} passkey prf output`, 32);
  const credential = fixed(`${W} passkey credential id`, 20);
  const passkeyKey = await c.passkeyKey(prf);
  const passkeyHolder = { id: uuid(`${W} passkey holder`), key: keyPair(`${W} passkey holder key`) };
  const passkeyRecord = c.holderRecord({ notebook, kind: "passkey", id: passkeyHolder.id, credential, d: passkeyHolder.key.d, public: passkeyHolder.key.public, anchor: { kid: 1, key: K[0] } });
  const passkeyRecordText = JSON.stringify(passkeyRecord);
  const passkeyRecordNonce = nonce(`${W} passkey holder record`);
  const passkeyRecordSealed = await c.sealHolderRecord({ secretKey: passkeyKey, text: passkeyRecordText, nonce: passkeyRecordNonce });
  const passkeyCard = c.holderCard({ public: passkeyHolder.key.public, kind: "passkey", credential, name: "iCloud Keychain", added: "2026-11-23T18:30:00.000Z" });
  const passkeyCardText = JSON.stringify(passkeyCard);
  const passkeyCardNonce1 = nonce(`${W} passkey holder card`);
  const passkeyCard1 = await c.sealHolderCard({ notebookKey: K[0], kid: 1, notebook, holderId: passkeyHolder.id, text: passkeyCardText, nonce: passkeyCardNonce1 });
  const cardA1 = await cardFor(A, 1, "2026-11-23T18:30:00.000Z", "card A");
  const ring1toA = await sealKeyringTo(ring1, A.key, `${W} keyring 1 to A`);
  const ring1toPasskey = await sealKeyringTo(ring1, passkeyHolder.key, `${W} keyring 1 to passkey holder`);
  const proof1 = await proofOf(K[0]);
  steps.push({
    step: 1,
    what: "The first device (A) sets up under “follows my account”: it makes the notebook's id and first key, its own keys and card, and a passkey holder, and sends the service the proof's hash, its card, the holder, and a keyring sealed to itself and to the holder.",
    given: {
      notebook,
      notebookKey: K[0],
      device: A,
      added: "2026-11-23T18:30:00.000Z",
      passkey: { prf, credential },
      holder: passkeyHolder,
      nonces: { card: cardA1.nonce, holderRecord: passkeyRecordNonce, holderCard: passkeyCardNonce1 },
      ephemerals: { toDevice: ring1toA.ephemeral, toHolder: ring1toPasskey.ephemeral },
    },
    expected: {
      keyringText: c.keyringText(ring1),
      recordKey: await c.recordKey(K[0]),
      cardKey: await c.cardKey(K[0]),
      keyProof: proof1.proof,
      keyProofHash: proof1.hash,
      card: cardA1,
      passkeyKey,
      holderRecord: { plaintext: passkeyRecordText, aad: text(c.lines(c.LABELS.holder, "passkey", passkeyHolder.id)), nonce: passkeyRecordNonce, ciphertext: passkeyRecordSealed.ct },
      holderCard: { plaintext: passkeyCardText, aad: text(c.lines(c.LABELS.holderCard, notebook, "1", passkeyHolder.id)), nonce: passkeyCardNonce1, ciphertext: passkeyCard1.ct },
      keyringForDevice: sealedOut(ring1toA),
      keyringForHolder: sealedOut(ring1toPasskey),
    },
  });

  // 2. It pushes its notebook.
  const rows1 = await rowsUnder(records, 1, "first push");
  steps.push({
    step: 2,
    what: "A pushes its notebook, each record sealed under the record key of kid 1.",
    given: { notebookKey: K[0], kid: 1, records: records.map((r, i) => ({ plaintext: JSON.stringify(r), nonce: rows1[i].nonce })) },
    expected: { rows: rows1 },
  });

  // 3. A second device joins by passkey.
  const joinedB = await c.openHolder({
    secretKey: await c.passkeyKey(prf), kind: "passkey", id: passkeyHolder.id, notebook, credential,
    sealed: { nonce: passkeyRecordNonce, ct: passkeyRecordSealed.ct }, keyring: { enc: ring1toPasskey.enc, ct: ring1toPasskey.ct },
  });
  const cardB1 = await cardFor(Bd, 1, "2026-11-24T09:15:00.000Z", "card B");
  const ring1toB = await sealKeyringTo(joinedB.keyring, Bd.key, `${W} keyring 1 to B`);
  const openedByB = [];
  for (const row of rows1) openedByB.push((await c.openRow({ row: wireRow(row), keyring: joinedB.keyring })).record);
  steps.push({
    step: 3,
    what: "A second device (B) joins by passkey. The passkey gives it the same 32 bytes; it makes the passkey key, opens the holder's record, runs the four checks, and has the keyring. It writes its own card, seals the keyring to its own device key, proves the key, and opens the rows.",
    given: {
      device: Bd,
      added: "2026-11-24T09:15:00.000Z",
      passkey: { prf, answered: credential },
      fromService: {
        holder: { kind: "passkey", id: passkeyHolder.id, notebook, credential, record: { nonce: passkeyRecordNonce, ciphertext: passkeyRecordSealed.ct }, keyring: { enc: ring1toPasskey.enc, ciphertext: ring1toPasskey.ct } },
        rows: rows1,
      },
      nonces: { card: cardB1.nonce },
      ephemerals: { toDevice: ring1toB.ephemeral },
    },
    expected: {
      passkeyKey,
      holderRecord: joinedB.record,
      holderKey: joinedB.key,
      keyring: keyringOut(joinedB.keyring),
      card: cardB1,
      keyringForDevice: sealedOut(ring1toB),
      keyProof: proof1.proof,
      records: openedByB,
    },
  });

  // 4. A third device is approved by the second.
  const code = fixed(`${W} approval code`, c.APPROVAL_CODE_BYTES);
  const approval = await c.approvalKeys(code);
  const asked = { deviceId: C.id, platform: C.platform, model: C.name, public: C.key.public, sign: C.sign.public };
  const request = { ...asked, mac: await c.approvalRequestMac({ macKey: approval.macKey, id: approval.id, ...asked }) };
  const grantSender = keyPair(`${W} grant sender`);
  const cardCNonce = nonce(`${W} card C`);
  const grant = await c.makeGrant({ macKey: approval.macKey, id: approval.id, request, keyring: joinedB.keyring, added: "2026-11-25T20:05:00.000Z", cardNonce: cardCNonce, ephemeral: grantSender });
  const acceptedC = await c.acceptGrant({ macKey: approval.macKey, id: approval.id, grant, device: { id: C.id, key: C.key, sign: C.sign.public } });
  const cardC1 = { plaintext: JSON.stringify(acceptedC.card), nonce: cardCNonce, ciphertext: grant.card.ct, aad: text(c.lines(c.LABELS.deviceCard, notebook, "1", C.id)) };
  steps.push({
    step: 4,
    what: "A third device (C) is approved by B. C shows a code; both make the approval's id and MAC key from it; C posts its request; B checks the request's MAC and grants, sealing its keyring to C's key and writing C's card; C checks the grant, keeps the keyring, and proves the key.",
    given: {
      code,
      codeText: c.formatApprovalCode(code),
      device: C,
      added: "2026-11-25T20:05:00.000Z",
      nonces: { card: cardCNonce },
      ephemerals: { toDevice: grantSender },
    },
    expected: {
      id: approval.id,
      macKey: approval.macKey,
      request: { deviceId: asked.deviceId, platform: asked.platform, model: asked.model, public: asked.public, sign: asked.sign, mac: request.mac },
      grant: { kid: grant.kid, enc: grant.enc, ciphertext: grant.ct, card: { nonce: grant.card.nonce, ciphertext: grant.card.ct }, mac: grant.mac },
      keyring: keyringOut(acceptedC.keyring),
      card: cardC1,
      keyProof: proof1.proof,
    },
  });

  // 5. The first device is removed, by the third: a new key.
  const ring2 = c.nextKeyring(acceptedC.keyring, K[1]);
  const ring2toB = await sealKeyringTo(ring2, Bd.key, `${W} keyring 2 to B`);
  const ring2toC = await sealKeyringTo(ring2, C.key, `${W} keyring 2 to C`);
  const ring2toPasskey = await sealKeyringTo(ring2, passkeyHolder.key, `${W} keyring 2 to passkey holder`);
  const cardB2 = await resealCard(Bd, cardB1, 1, 2, "card B under key 2");
  const cardC2 = await resealCard(C, cardC1, 1, 2, "card C under key 2");
  const passkeyCardNonce2 = nonce(`${W} passkey holder card under key 2`);
  const passkeyCard2 = await c.resealHolderCard({ from: { notebookKey: K[0], kid: 1 }, to: { notebookKey: K[1], kid: 2 }, notebook, holderId: passkeyHolder.id, nonce: passkeyCardNonce1, ct: passkeyCard1.ct, newNonce: passkeyCardNonce2 });
  const proof2 = await proofOf(K[1]);
  const rows2 = await rowsUnder(records, 2, "resealed under key 2");
  c.checkKeyring({ held: joinedB.keyring, incoming: await c.openKeyring({ recipient: Bd.key, enc: ring2toB.enc, ct: ring2toB.ct }) });
  steps.push({
    step: 5,
    what: "The first device (A) is removed, from C. C makes the next notebook key and a keyring with it as current, seals that keyring to B, to itself, and to the passkey holder (never to A), seals every kept card again under the new key, sends the new proof's hash, and seals every record again under the new key. B fetches its new sealed keyring and accepts it, since it holds every key B already has. A, which still has the old keyring, can't open the new rows.",
    given: {
      removed: A.id,
      notebookKey: K[1],
      nonces: { cardB: cardB2.nonce, cardC: cardC2.nonce, holderCard: passkeyCardNonce2, rows: rows2.map((r) => r.nonce) },
      ephemerals: { toB: ring2toB.ephemeral, toC: ring2toC.ephemeral, toHolder: ring2toPasskey.ephemeral },
    },
    expected: {
      keyringText: c.keyringText(ring2),
      keyProof: proof2.proof,
      keyProofHash: proof2.hash,
      keyringForB: sealedOut(ring2toB),
      keyringForC: sealedOut(ring2toC),
      keyringForHolder: sealedOut(ring2toPasskey),
      cardB: cardB2,
      cardC: cardC2,
      holderCard: { plaintext: passkeyCardText, aad: text(c.lines(c.LABELS.holderCard, notebook, "2", passkeyHolder.id)), nonce: passkeyCardNonce2, ciphertext: passkeyCard2.ct },
      rows: rows2,
      onB: { held: keyringOut(joinedB.keyring), accepted: true },
      onA: { held: keyringOut(ring1), row: rows2[0], ...(await refused(() => c.openRow({ row: wireRow(rows2[0]), keyring: ring1 }))), aside: true },
    },
  });

  // 6. Switch to "this device only", with a recovery code made.
  const ring3 = c.nextKeyring(ring2, K[2]);
  const recoveryCode = fixed(`${W} recovery code`, c.RECOVERY_CODE_BYTES);
  const codeKey = await c.codeKey(recoveryCode);
  const recoveryHolder = { id: uuid(`${W} recovery holder`), key: keyPair(`${W} recovery holder key`) };
  const recoveryRecord = c.holderRecord({ notebook, kind: "recovery", id: recoveryHolder.id, d: recoveryHolder.key.d, public: recoveryHolder.key.public, anchor: { kid: 3, key: K[2] } });
  const recoveryRecordText = JSON.stringify(recoveryRecord);
  const recoveryRecordNonce = nonce(`${W} recovery holder record`);
  const recoveryRecordSealed = await c.sealHolderRecord({ secretKey: codeKey, text: recoveryRecordText, nonce: recoveryRecordNonce });
  const recoveryCard = c.holderCard({ public: recoveryHolder.key.public, kind: "recovery", name: "Recovery code", added: "2026-12-01T08:00:00.000Z" });
  const recoveryCardText = JSON.stringify(recoveryCard);
  const recoveryCardNonce = nonce(`${W} recovery holder card`);
  const recoveryCardSealed = await c.sealHolderCard({ notebookKey: K[2], kid: 3, notebook, holderId: recoveryHolder.id, text: recoveryCardText, nonce: recoveryCardNonce });
  const ring3toB = await sealKeyringTo(ring3, Bd.key, `${W} keyring 3 to B`);
  const ring3toC = await sealKeyringTo(ring3, C.key, `${W} keyring 3 to C`);
  const ring3toRecovery = await sealKeyringTo(ring3, recoveryHolder.key, `${W} keyring 3 to recovery holder`);
  const cardB3 = await resealCard(Bd, cardB2, 2, 3, "card B under key 3");
  const cardC3 = await resealCard(C, cardC2, 2, 3, "card C under key 3");
  const proof3 = await proofOf(K[2]);
  const rows3 = await rowsUnder(records, 3, "resealed under key 3");
  const stale = await c.openHolder({
    secretKey: passkeyKey, kind: "passkey", id: passkeyHolder.id, notebook, credential,
    sealed: { nonce: passkeyRecordNonce, ct: passkeyRecordSealed.ct }, keyring: { enc: ring2toPasskey.enc, ct: ring2toPasskey.ct },
  });
  steps.push({
    step: 6,
    what: "The reader switches to “this device only,” from C. The notebook gets a third key, the passkey holder is removed and gets no keyring, and since the reader has no recovery code, one is made in the same step: a recovery holder, anchored to the new key. Whoever still has the passkey has, at most, the keyring it was last given, which holds no key that opens anything sealed from now on.",
    given: {
      removedHolder: passkeyHolder.id,
      notebookKey: K[2],
      recoveryCode,
      holder: recoveryHolder,
      added: "2026-12-01T08:00:00.000Z",
      nonces: { holderRecord: recoveryRecordNonce, holderCard: recoveryCardNonce, cardB: cardB3.nonce, cardC: cardC3.nonce, rows: rows3.map((r) => r.nonce) },
      ephemerals: { toB: ring3toB.ephemeral, toC: ring3toC.ephemeral, toHolder: ring3toRecovery.ephemeral },
    },
    expected: {
      keyringText: c.keyringText(ring3),
      keyProof: proof3.proof,
      keyProofHash: proof3.hash,
      codeText: c.formatRecoveryCode(recoveryCode),
      codeKey,
      holderRecord: { plaintext: recoveryRecordText, aad: text(c.lines(c.LABELS.holder, "recovery", recoveryHolder.id)), nonce: recoveryRecordNonce, ciphertext: recoveryRecordSealed.ct },
      holderCard: { plaintext: recoveryCardText, aad: text(c.lines(c.LABELS.holderCard, notebook, "3", recoveryHolder.id)), nonce: recoveryCardNonce, ciphertext: recoveryCardSealed.ct },
      keyringForB: sealedOut(ring3toB),
      keyringForC: sealedOut(ring3toC),
      keyringForHolder: sealedOut(ring3toRecovery),
      cardB: cardB3,
      cardC: cardC3,
      rows: rows3,
      withThePasskey: {
        keyring: keyringOut(stale.keyring),
        row: rows3[0],
        ...(await refused(() => c.openRow({ row: wireRow(rows3[0]), keyring: stale.keyring }))),
        aside: true,
      },
    },
  });

  // 7. Recovery by code, on a fourth device.
  const typed = c.formatRecoveryCode(recoveryCode).toLowerCase().replaceAll("-", " ");
  const joinedD = await c.openHolder({
    secretKey: await c.codeKey(c.readRecoveryCode(typed)), kind: "recovery", id: recoveryHolder.id, notebook,
    sealed: { nonce: recoveryRecordNonce, ct: recoveryRecordSealed.ct }, keyring: { enc: ring3toRecovery.enc, ct: ring3toRecovery.ct },
  });
  const cardD3 = await cardFor(D, 3, "2026-12-20T16:45:00.000Z", "card D");
  const ring3toD = await sealKeyringTo(joinedD.keyring, D.key, `${W} keyring 3 to D`);
  const openedByD = [];
  for (const row of rows3) openedByD.push((await c.openRow({ row: wireRow(row), keyring: joinedD.keyring })).record);
  steps.push({
    step: 7,
    what: "The reader has lost every device, and signs in on a fourth (D) with the recovery code, typed in lowercase with spaces. D makes the code key, opens the recovery holder's record, runs the four checks, and has the keyring; it writes its card, seals the keyring to itself, proves the key, and opens the rows.",
    given: {
      device: D,
      added: "2026-12-20T16:45:00.000Z",
      typed,
      fromService: {
        holder: { kind: "recovery", id: recoveryHolder.id, notebook, record: { nonce: recoveryRecordNonce, ciphertext: recoveryRecordSealed.ct }, keyring: { enc: ring3toRecovery.enc, ciphertext: ring3toRecovery.ct } },
        rows: rows3,
      },
      nonces: { card: cardD3.nonce },
      ephemerals: { toDevice: ring3toD.ephemeral },
    },
    expected: {
      code: recoveryCode,
      codeKey,
      holderRecord: joinedD.record,
      holderKey: joinedD.key,
      keyring: keyringOut(joinedD.keyring),
      card: cardD3,
      keyringForDevice: sealedOut(ring3toD),
      keyProof: proof3.proof,
      records: openedByD,
    },
  });

  // 8. Forged keyrings.
  const forgedRing = { notebook, current: 4, keys: [4, 3, 2, 1].map((kid) => ({ kid, key: fixed(`${W} forger's key ${kid}`, 32) })) };
  const forgedToC = await sealKeyringTo(forgedRing, C.key, `${W} forged keyring to C`);
  const forgedForRecovery = { notebook, current: 3, keys: [3, 2, 1].map((kid) => ({ kid, key: fixed(`${W} forger's key ${kid}`, 32) })) };
  const forgedToRecovery = await sealKeyringTo(forgedForRecovery, recoveryHolder.key, `${W} forged keyring to recovery holder`);
  const forgedHolder = { kind: "recovery", id: recoveryHolder.id, notebook, record: { nonce: recoveryRecordNonce, ciphertext: recoveryRecordSealed.ct }, keyring: { enc: forgedToRecovery.enc, ciphertext: forgedToRecovery.ct } };
  steps.push({
    step: 8,
    what: "Forgeries. The service has seen C's public key (in its approval request), so it can seal a keyring of its own to C; and anyone who learned the recovery holder's public key can seal one to it. Neither has ever held a notebook key. C refuses the first because it changes keys C holds, C refuses its own old keyring handed back because it goes backward, and a device coming in by code refuses the last because it lacks the anchor's key.",
    given: {
      toC: { device: C, held: keyringOut(ring3), enc: forgedToC.enc, ciphertext: forgedToC.ct },
      oldKeyringToC: { device: C, held: keyringOut(ring3), enc: ring2toC.enc, ciphertext: ring2toC.ct },
      toRecoveryHolder: { typed, fromService: { holder: forgedHolder } },
    },
    expected: {
      toC: { opensTo: c.keyringText(forgedRing), ...(await refused(async () => c.checkKeyring({ held: ring3, incoming: await c.openKeyring({ recipient: C.key, enc: forgedToC.enc, ct: forgedToC.ct }) }))) },
      oldKeyringToC: { opensTo: c.keyringText(ring2), ...(await refused(async () => c.checkKeyring({ held: ring3, incoming: await c.openKeyring({ recipient: C.key, enc: ring2toC.enc, ct: ring2toC.ct }) }))) },
      toRecoveryHolder: await refused(() =>
        c.openHolder({ secretKey: codeKey, kind: "recovery", id: recoveryHolder.id, notebook, sealed: { nonce: recoveryRecordNonce, ct: recoveryRecordSealed.ct }, keyring: { enc: forgedToRecovery.enc, ct: forgedToRecovery.ct } }),
      ),
    },
  });

  return {
    about:
      "One notebook from its first device to a recovery, every value along the way. Each step's `given` holds what the step starts from and every fixed random input it uses (nonces, and the sender key of each HPKE seal as `ephemerals`); `expected` holds what a client following the spec arrives at. A sealed card or holder record is given as its `plaintext` (the JSON as text), its `aad` (as text), its `nonce`, and its `ciphertext`; a sealed keyring as its `enc` and `ciphertext`, with the sender's key for a client that can fix it. A client that can't fix a sender key or reproduce another client's JSON byte for byte follows the walkthrough in the opening direction: every `ciphertext` here must open to the plaintext beside it.",
    devices: { A: A.id, B: Bd.id, C: C.id, D: D.id },
    steps,
  };
}

/* ── The file ────────────────────────────────────────────────────────── */

/** The whole vectors file as text. The same bytes on every run. */
export async function buildVectors() {
  const records = await recordGroups();
  const cards = await cardGroups();
  const out = {
    about:
      "Test vectors for the synced notebook's end-to-end encryption (STUDY-DESK-ENCRYPTION.md), made by the code the website ships (src/lib/desk-crypto.mjs). The website and both apps run this file in their own tests. Every case says what it tests in `why`, what the client starts from in `given`, and what it must arrive at in `expected`: values, or `refused` with the reason. Every random input is fixed and written here, and every private key comes with its public key (`d` beside `public`). These are test values, made from labels by SHA-256; none is a real key.",
    spec: "STUDY-DESK-ENCRYPTION.md",
    specDraft: 2,
    version: c.CRYPTO_VERSION,
    vectorsVersion: c.CRYPTO_VECTORS_VERSION,
    generatedBy: "npm run build:notebook-crypto-vectors (scripts/build-notebook-crypto-vectors.mjs)",
    conventions: [
      "Byte strings are lowercase hex. The exceptions are inside text the spec itself defines: a `plaintext` or `text` (JSON as it is sealed) carries its byte strings in base64url, as do a MAC's `macInput` and the passkey responses under `prf`.",
      "A `plaintext` or `text` is JSON given as a string; the bytes are its UTF-8. A client that seals must seal those bytes to reproduce a ciphertext here. Its own serializer may order keys or write numbers differently, so what it makes itself it checks by opening it again.",
      "A sealed value is its `nonce` (12 bytes) and its `ciphertext`, which ends with the 16-byte tag. A row's are called `nonce` and `ct`, as the service's row has them.",
      "An AAD is given as text (`aad`), with its line feeds, and for some cases as bytes too (`aadHex`).",
      "A keyring, where it is an expected value, is `{ notebook, current, keys: [{ kid, key }] }` with the keys in hex, newest first. Compare by kid, not by order.",
      "`refused` is one of the words under `refusals`. A client need not use the words, but it must refuse every case marked so, and where the spec treats two refusals differently (`aside`, a holder's `check`), it must tell them apart.",
      "HPKE and ECDSA cases run in the opening and the verifying direction. The sender's one-use key (`ephemeral`) and the signing number are given for a client that can fix them.",
      "Times are the format's: UTC with Z. Ids are UUIDs in lowercase with hyphens.",
    ],
    refusals: c.REFUSALS,
    labels: c.LABELS,
    limits: { padBlock: c.PAD_BLOCK, maxRecordBytes: c.MAX_RECORD_BYTES, nonceBytes: c.NONCE_BYTES, tagBytes: c.TAG_BYTES },
    hkdf: await hkdfGroup(),
    keyProof: await keyProofGroup(),
    recoveryCode: await recoveryCodeGroup(),
    approvalCode: await approvalCodeGroup(),
    base64url: await base64urlGroup(),
    seal: records.seal,
    open: records.open,
    openRefused: records.openRefused,
    padding: paddingGroup(),
    keyring: await keyringGroup(),
    hpkeOpen: await hpkeOpenGroup(),
    card: cards.card,
    holderCard: cards.holderCard,
    prf: await prfGroup(),
    passkeyHolder: await holderGroup("passkey"),
    recoveryHolder: await holderGroup("recovery"),
    approval: await approvalGroup(),
    signingKey: await signingKeyGroup(),
    point: pointGroup(),
    walkthrough: await walkthroughGroup(),
  };
  return (
    JSON.stringify(
      out,
      (key, value) => {
        if (value instanceof Uint8Array) {
          if (Buffer.isBuffer(value)) throw new Error(`build: "${key}" is a Buffer; make it a Uint8Array`);
          return c.toHex(value);
        }
        return value;
      },
      1,
    ) + "\n"
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = await buildVectors();
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, file);
  const v = JSON.parse(file);
  const count = (x) => (Array.isArray(x) ? x.length : 0);
  const sizes = Object.entries(v)
    .filter(([, g]) => g && typeof g === "object" && !Array.isArray(g) && ("about" in g || "cases" in g))
    .map(([name, g]) => `${name} ${Object.values(g).reduce((n, part) => n + count(part), 0) || 1}`);
  console.log(`Wrote ${Buffer.byteLength(file)} bytes to test/fixtures/notebook-crypto-vectors.json`);
  console.log(`  ${sizes.join(", ")}`);
}
