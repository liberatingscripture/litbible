// test/desk-crypto.test.js
//
// src/lib/desk-crypto.mjs is the reference implementation of the synced
// notebook's encryption (STUDY-DESK-ENCRYPTION.md), and the code the website
// ships. Both apps run test/fixtures/notebook-crypto-vectors.json in their own
// suites, so this file's job is to prove that file and the reference say the
// same thing, and that neither is only agreeing with itself:
//
// 1. Published vectors first (test/fixtures/published-crypto-vectors.json):
//    RFC 5869's HKDF, RFC 4231's HMAC, Wycheproof's AES-256-GCM, and the
//    CFRG's HPKE vectors for the notebook's exact suite, with RFC 9180's own
//    nearest suite through the same code.
// 2. The committed vectors are byte for byte what the builder makes today.
// 3. Every group, run the way an app runs it: from each case's `given`
//    alone to its `expected`, refusals included.
// 4. node:crypto as a second implementation, on the file's own values.
// 5. What the reference seals with real randomness, it opens.
//
// If one of these fails after a deliberate change: change the spec with it,
// run `npm run build:notebook-crypto-vectors`, bump CRYPTO_VECTORS_VERSION,
// and tell the apps (STUDY-DESK-FOR-THE-APPS.md).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createDecipheriv, createECDH, createHmac, createPublicKey, hkdfSync, verify as nodeVerify } from "node:crypto";

import * as c from "../src/lib/desk-crypto.mjs";
import { MAX_RECORD_BYTES, validateRecord } from "../src/lib/desk-records.mjs";
import { buildVectors } from "../scripts/build-notebook-crypto-vectors.mjs";
import { publicFromScalar } from "../scripts/lib/p256-fixed.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const vectorsText = read("./fixtures/notebook-crypto-vectors.json");
const vectors = JSON.parse(vectorsText);
const published = JSON.parse(read("./fixtures/published-crypto-vectors.json"));

const h = c.fromHex;
const x = c.toHex;
const pair = (k) => ({ d: h(k.d), public: h(k.public) });

/** The Refusal a call throws, or null when it doesn't refuse. Anything else it throws is a bug. */
async function refusalOf(fn) {
  try {
    await fn();
  } catch (e) {
    if (e instanceof c.Refusal) return e;
    throw e;
  }
  return null;
}

/** Runs `fn` and checks it against a case's `expected.refused` (and `check`). */
async function mustRefuse(fn, expected, why) {
  const e = await refusalOf(fn);
  assert.ok(e, `accepted, where it must be refused: ${why}`);
  assert.equal(e.why, expected.refused, why);
  if (expected.check) assert.equal(e.check, expected.check, `${why} (which check)`);
}

/** A row from the file (hex) as the service carries it (base64url). */
const wireRow = (row) => ({ ...row, nonce: c.toBase64url(h(row.nonce)), ct: c.toBase64url(h(row.ct)) });
const fileRow = (row) => ({ ...row, nonce: x(c.fromBase64url(row.nonce)), ct: x(c.fromBase64url(row.ct)) });

/** A keyring from the file's `{ notebook, keys: [{ kid, key }] }`. */
function keyringFrom({ notebook, keys }) {
  const sorted = keys.map(({ kid, key }) => ({ kid, key: h(key) })).sort((a, b) => b.kid - a.kid);
  return { notebook, current: sorted[0].kid, keys: sorted };
}
const keyringOut = (k) => ({ notebook: k.notebook, current: k.current, keys: k.keys.map(({ kid, key }) => ({ kid, key: x(key) })) });

/* ── 1. Published vectors, before the notebook's own ─────────────────── */

test("published: HKDF-SHA-256, RFC 5869 Appendix A", async () => {
  assert.equal(published.hkdf.cases.length, 3);
  for (const k of published.hkdf.cases) {
    const prk = await c.hkdfExtract(h(k.salt), h(k.ikm));
    assert.equal(x(prk), k.prk, `${k.name}: PRK`);
    assert.equal(x(await c.hkdfExpand(prk, h(k.info), k.length)), k.okm, `${k.name}: OKM`);
  }
  // A.3 has an empty salt, which the reference takes as 32 zero bytes.
  const a3 = published.hkdf.cases[2];
  assert.equal(a3.salt, "");
  assert.equal(x(await c.hkdfExtract(new Uint8Array(32), h(a3.ikm))), a3.prk);
});

test("published: HMAC-SHA-256, RFC 4231", async () => {
  assert.equal(published.hmac.cases.length, 7);
  for (const k of published.hmac.cases) {
    const mac = x(await c.hmac(h(k.key), h(k.data)));
    assert.equal(k.truncated ? mac.slice(0, 2 * k.truncated) : mac, k.mac, k.name);
    if (!k.truncated) {
      assert.equal(await c.hmacVerify(h(k.key), h(k.data), h(k.mac)), true, k.name);
      const wrong = h(k.mac);
      wrong[0] ^= 1;
      assert.equal(await c.hmacVerify(h(k.key), h(k.data), wrong), false, k.name);
    }
  }
});

test("published: AES-256-GCM, Wycheproof", async () => {
  const valid = published.aesGcm.cases.filter((k) => k.result === "valid");
  const invalid = published.aesGcm.cases.filter((k) => k.result === "invalid");
  assert.ok(valid.length >= 5 && invalid.length >= 3);
  for (const k of valid) {
    assert.equal(x(await c.aesGcmSeal(h(k.key), h(k.iv), h(k.aad), h(k.msg))), k.ct + k.tag, `tcId ${k.tcId}: seal`);
    assert.equal(x(await c.aesGcmOpen(h(k.key), h(k.iv), h(k.aad), h(k.ct + k.tag))), k.msg, `tcId ${k.tcId}: open`);
  }
  for (const k of invalid) {
    const e = await refusalOf(() => c.aesGcmOpen(h(k.key), h(k.iv), h(k.aad), h(k.ct + k.tag)));
    assert.equal(e?.why, "seal", `tcId ${k.tcId} (${k.comment}) must not open`);
  }
});

test("published: HPKE base mode, the CFRG's vectors for the notebook's suite and RFC 9180 A.3.1", async () => {
  const [exact, a3] = published.hpke.cases;
  assert.deepEqual([exact.kem_id, exact.kdf_id, exact.aead_id], [c.HPKE_SUITE.kem, c.HPKE_SUITE.kdf, c.HPKE_SUITE.aead], "the first case is the notebook's exact suite");
  assert.deepEqual([a3.kem_id, a3.kdf_id, a3.aead_id], [0x0010, 0x0001, 0x0001], "the second is RFC 9180's A.3");
  for (const k of published.hpke.cases) {
    assert.equal(k.mode, 0);
    const sender = await c.hpkeSenderContext({ recipientPublic: h(k.pkRm), info: h(k.info), ephemeral: { d: h(k.skEm), public: h(k.pkEm) }, aead: k.aead_id });
    const recipient = await c.hpkeRecipientContext({ recipient: { d: h(k.skRm), public: h(k.pkRm) }, enc: h(k.enc), info: h(k.info), aead: k.aead_id });
    for (const [side, ctx] of [["sender", sender], ["recipient", recipient]]) {
      assert.equal(x(ctx.enc), k.enc, `${k.name}, ${side}: enc`);
      assert.equal(x(ctx.sharedSecret), k.shared_secret, `${k.name}, ${side}: shared_secret`);
      assert.equal(x(ctx.keyScheduleContext), k.key_schedule_context, `${k.name}, ${side}: key_schedule_context`);
      assert.equal(x(ctx.secret), k.secret, `${k.name}, ${side}: secret`);
      assert.equal(x(ctx.key), k.key, `${k.name}, ${side}: key`);
      assert.equal(x(ctx.baseNonce), k.base_nonce, `${k.name}, ${side}: base_nonce`);
      assert.equal(x(ctx.exporterSecret), k.exporter_secret, `${k.name}, ${side}: exporter_secret`);
    }
    assert.deepEqual(k.encryptions.map((e) => e.seq), [0, 1, 2, 4, 255, 256]);
    for (const e of k.encryptions) {
      assert.equal(x(c.hpkeNonce(sender.baseNonce, e.seq)), e.nonce, `${k.name}: nonce ${e.seq}`);
      assert.equal(x(await c.hpkeContextSeal(sender, e.seq, h(e.aad), h(e.pt))), e.ct, `${k.name}: seal ${e.seq}`);
      assert.equal(x(await c.hpkeContextOpen(recipient, e.seq, h(e.aad), h(e.ct))), e.pt, `${k.name}: open ${e.seq}`);
    }
  }
  // The single-shot calls the notebook uses are the context at sequence number 0.
  const first = exact.encryptions[0];
  const sealed = await c.hpkeSeal({ recipientPublic: h(exact.pkRm), info: c.fromUtf8(h(exact.info)), aad: h(first.aad), plaintext: h(first.pt), ephemeral: { d: h(exact.skEm), public: h(exact.pkEm) } });
  assert.equal(x(sealed.enc), exact.enc);
  assert.equal(x(sealed.ct), first.ct);
  assert.equal(x(await c.hpkeOpen({ recipient: { d: h(exact.skRm), public: h(exact.pkRm) }, enc: sealed.enc, info: c.fromUtf8(h(exact.info)), aad: h(first.aad), ct: sealed.ct })), first.pt);
});

/* ── 2. The file itself ──────────────────────────────────────────────── */

const SPEC_GROUPS = [
  "hkdf", "keyProof", "recoveryCode", "approvalCode", "base64url", "seal", "open", "openRefused", "padding", "keyring", "hpkeOpen",
  "card", "holderCard", "prf", "passkeyHolder", "recoveryHolder", "approval", "signingKey", "point", "walkthrough",
];

test("the vectors file is for this version of the reference", () => {
  assert.equal(vectors.spec, "STUDY-DESK-ENCRYPTION.md");
  assert.equal(vectors.version, c.CRYPTO_VERSION);
  assert.equal(vectors.vectorsVersion, c.CRYPTO_VECTORS_VERSION);
  assert.deepEqual(vectors.refusals, c.REFUSALS);
  assert.deepEqual(vectors.labels, c.LABELS);
  assert.deepEqual(vectors.limits, { padBlock: c.PAD_BLOCK, maxRecordBytes: c.MAX_RECORD_BYTES, nonceBytes: c.NONCE_BYTES, tagBytes: c.TAG_BYTES });
  assert.equal(c.MAX_RECORD_BYTES, MAX_RECORD_BYTES, "the reference's ceiling is the format's (desk-records.mjs)");
  for (const label of Object.values(c.LABELS)) assert.match(label, /^lit-[a-z-]+\/1( [a-z-]+)?$/, label);
});

test("the vectors file has every group the spec's table names, and no other", () => {
  for (const g of SPEC_GROUPS) assert.ok(vectors[g]?.about, `the file has no group "${g}"`);
  const spec = read("../STUDY-DESK-ENCRYPTION.md");
  const section = spec.slice(spec.indexOf("\n## The test vectors"), spec.indexOf("\n## Departures from earlier documents"));
  const named = new Set();
  for (const row of section.split("\n").filter((l) => l.startsWith("| `"))) {
    for (const m of row.split("|")[1].matchAll(/`([A-Za-z0-9]+)`/g)) named.add(m[1]);
  }
  assert.deepEqual([...named].sort(), [...SPEC_GROUPS].sort(), "the spec's table of vector groups and the file's groups");
});

test("the vectors file is written with line feeds only, and ends with one", () => {
  assert.equal(vectorsText.includes("\r"), false);
  assert.ok(vectorsText.endsWith("}\n"));
});

test("the committed vectors are byte for byte what the builder makes (npm run build:notebook-crypto-vectors)", async () => {
  const built = await buildVectors();
  assert.ok(built === vectorsText, "test/fixtures/notebook-crypto-vectors.json is not what scripts/build-notebook-crypto-vectors.mjs builds: run the builder, bump CRYPTO_VECTORS_VERSION, and tell the apps");
  assert.ok((await buildVectors()) === built, "the builder gives the same bytes on every run");
});

test("every private key in the file comes with its own public key", () => {
  let found = 0;
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    if (typeof v.d === "string" && /^[0-9a-f]{64}$/.test(v.d)) {
      assert.match(v.public ?? "", /^04[0-9a-f]{128}$/, "a private key with no public key beside it");
      const node = createECDH("prime256v1");
      node.setPrivateKey(h(v.d));
      assert.equal(x(node.getPublicKey()), v.public, "node:crypto's public key for this d");
      assert.equal(x(publicFromScalar(h(v.d))), v.public, "p256-fixed's public key for this d");
      found++;
    }
    Object.values(v).forEach(walk);
  };
  walk(vectors);
  assert.ok(found > 40, `key pairs found: ${found}`);
});

/* ── 3. Each group, from `given` to `expected` ───────────────────────── */

test("hkdf", async () => {
  const labels = new Set();
  for (const k of vectors.hkdf.cases) {
    const { input, label, length } = k.given;
    labels.add(label);
    assert.equal(x(await c.hkdfExtract(new Uint8Array(32), h(input))), k.expected.prk, k.why);
    assert.equal(x(await c.hkdf(h(input), label, length)), k.expected.key, k.why);
    // Two more implementations: node:crypto's, and WebCrypto's own HKDF.
    assert.equal(x(hkdfSync("sha256", h(input), Buffer.alloc(32), label, length)), k.expected.key, `${k.why} (node:crypto)`);
    const key = await crypto.subtle.importKey("raw", h(input), "HKDF", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: c.utf8(label) }, key, 8 * length);
    assert.equal(x(bits), k.expected.key, `${k.why} (WebCrypto's HKDF)`);
  }
  // Every HKDF label of the spec's table is exercised.
  for (const name of ["record", "device", "proof", "recovery", "passkey", "approveId", "approveMac"]) assert.ok(labels.has(c.LABELS[name]), name);
});

test("keyProof", async () => {
  for (const k of vectors.keyProof.cases) {
    const proof = await c.keyProof(h(k.given.notebookKey));
    assert.equal(x(proof), k.expected.proof);
    assert.equal(x(await c.keyProofHash(proof)), k.expected.hash);
    assert.notEqual(k.expected.proof, x(await c.recordKey(h(k.given.notebookKey))), "the proof is not the record key");
  }
});

for (const [group, format, readCode, size] of [
  ["recoveryCode", c.formatRecoveryCode, c.readRecoveryCode, 24],
  ["approvalCode", c.formatApprovalCode, c.readApprovalCode, 16],
]) {
  test(group, async () => {
    for (const k of vectors[group].format) {
      assert.equal(format(h(k.given.bytes)), k.expected.text, k.why);
      assert.equal(k.expected.characters.length, size);
      assert.equal(x(readCode(k.expected.text)), k.given.bytes, `${k.why}, read back`);
      assert.equal(x(readCode(k.expected.characters)), k.given.bytes, `${k.why}, read back without hyphens`);
    }
    const reasons = new Set();
    for (const k of vectors[group].read) {
      if (k.expected.refused) {
        await mustRefuse(() => readCode(k.given.typed), k.expected, k.why);
        reasons.add(k.expected.refused);
      } else assert.equal(x(readCode(k.given.typed)), k.expected.bytes, k.why);
    }
    assert.deepEqual([...reasons].sort(), ["code", "codeLength"]);
    for (const k of vectors[group].typedBack ?? []) {
      assert.equal(c.recoveryGroupMatches(h(k.given.code), k.given.group, k.given.typed), k.expected.matches, k.why);
    }
  });
}

test("base64url", async () => {
  for (const k of vectors.base64url.cases) {
    assert.equal(c.toBase64url(h(k.given.bytes)), k.expected.text, k.why);
    assert.equal(x(c.fromBase64url(k.expected.text)), k.given.bytes, k.why);
    assert.equal(Buffer.from(h(k.given.bytes)).toString("base64url"), k.expected.text, `${k.why} (node)`);
  }
  for (const k of vectors.base64url.refused) await mustRefuse(() => c.fromBase64url(k.given.text), k.expected, k.why);
});

test("padding", async () => {
  for (const k of vectors.padding.cases) {
    if (k.expected.refused) {
      await mustRefuse(() => c.paddedLength(k.given.length), k.expected, `length ${k.given.length}`);
      continue;
    }
    assert.equal(c.paddedLength(k.given.length), k.expected.padded, `length ${k.given.length}`);
    assert.equal(k.expected.padded % 256, 0);
    assert.ok(k.expected.padded >= k.given.length && k.expected.padded - k.given.length < 256);
    assert.equal(k.expected.ciphertext, k.expected.padded + 16);
  }
  const padded = c.padRecord(c.utf8("{}"));
  assert.equal(padded.length, 256);
  assert.deepEqual([...padded.subarray(0, 3)], [0x7b, 0x7d, 0x20]);
  assert.ok(padded.subarray(2).every((b) => b === 0x20));
});

test("seal", async () => {
  let sealed = 0;
  for (const k of vectors.seal.cases) {
    const { notebookKey, kid, nonce, plaintext } = k.given;
    const args = { text: plaintext, notebookKey: h(notebookKey), kid, nonce: h(nonce) };
    if (k.expected.refused) {
      await mustRefuse(() => c.sealRecord(args), k.expected, k.why);
      continue;
    }
    const row = fileRow(await c.sealRecord(args));
    assert.deepEqual(row, k.expected.row, k.why);
    assert.equal(x(await c.recordKey(h(notebookKey))), k.expected.recordKey, k.why);
    assert.equal(c.utf8(plaintext).length, k.expected.plaintextBytes, k.why);
    assert.equal(c.paddedLength(k.expected.plaintextBytes), k.expected.paddedLength, k.why);
    assert.equal(c.fromUtf8(c.rowAad(row)), k.expected.aad, k.why);
    assert.equal(x(c.utf8(k.expected.aad)), k.expected.aadHex, k.why);
    assert.equal(k.expected.row.ct.length / 2, k.expected.paddedLength + 16, k.why);
    // The AAD's shape, spelled out: five lines, the last one empty unless the record is trash.
    const record = JSON.parse(plaintext);
    assert.equal(k.expected.aad, ["lit-row/1", String(kid), record.id, record.modified, record.kind === "trash" ? record.deletedAt : ""].join("\n"), k.why);
    assert.equal("deletedAt" in k.expected.row, record.kind === "trash", `${k.why}: only a trash record's row carries deletedAt`);
    assert.deepEqual(validateRecord(record), [], `${k.why}: the example is a valid record of the format`);
    // node:crypto opens it to the record and nothing but spaces after it.
    const ct = h(k.expected.row.ct);
    const node = createDecipheriv("aes-256-gcm", hkdfSync("sha256", h(notebookKey), Buffer.alloc(32), "lit-notebook/1 record", 32), h(nonce));
    node.setAAD(h(k.expected.aadHex));
    node.setAuthTag(ct.subarray(ct.length - 16));
    const opened = Buffer.concat([node.update(ct.subarray(0, ct.length - 16)), node.final()]).toString("utf8");
    assert.equal(opened.length % 256 === 0 || Buffer.byteLength(opened) % 256 === 0, true);
    assert.equal(opened.trimEnd(), plaintext, `${k.why} (node:crypto)`);
    assert.match(opened.slice(plaintext.length), /^ *$/, `${k.why}: the padding is spaces`);
    sealed++;
  }
  assert.ok(sealed >= 8);
  assert.ok(vectors.seal.cases.some((k) => k.expected.plaintextBytes === k.expected.paddedLength), "a record that takes no padding");
  assert.ok(vectors.seal.cases.some((k) => k.expected.row?.deletedAt), "a trash record");
  assert.ok(vectors.seal.cases.some((k) => /[^\x00-\x7f]/.test(k.given.plaintext)), "a record with text beyond ASCII");
});

test("open", async () => {
  for (const k of vectors.open.cases) {
    const opened = await c.openRow({ row: wireRow(k.given.row), keyring: keyringFrom({ notebook: "", keys: k.given.keys }) });
    assert.equal(opened.text, k.expected.text, k.why);
    assert.deepEqual(opened.record, k.expected.record, k.why);
    assert.deepEqual(validateRecord(opened.record), [], `${k.why}: a valid record of the format`);
  }
  // Every row `seal` made is opened here.
  const opened = new Set(vectors.open.cases.map((k) => k.given.row.ct));
  for (const k of vectors.seal.cases) if (k.expected.row) assert.ok(opened.has(k.expected.row.ct), k.why);
});

test("openRefused", async () => {
  const reasons = new Map();
  for (const k of vectors.openRefused.cases) {
    const keyring = keyringFrom({ notebook: "", keys: k.given.keys });
    await mustRefuse(() => c.openRow({ row: wireRow(k.given.row), keyring }), k.expected, k.why);
    assert.equal(k.expected.aside, ["version", "missingKey"].includes(k.expected.refused), k.why);
    reasons.set(k.expected.refused, (reasons.get(k.expected.refused) ?? 0) + 1);
  }
  // A wrong tag, a wrong AAD field, bad padding, the wrong key, fields that disagree, and the two "aside" cases are all here.
  assert.deepEqual([...reasons.keys()].sort(), ["fields", "json", "length", "missingKey", "seal", "version"]);
  assert.ok(reasons.get("seal") >= 12 && reasons.get("fields") >= 5);
});

test("keyring", async () => {
  for (const k of vectors.keyring.parse) {
    if (k.expected.refused) await mustRefuse(() => c.parseKeyring(k.given.text), k.expected, k.why);
    else {
      assert.deepEqual(keyringOut(c.parseKeyring(k.given.text)), k.expected, k.why);
      assert.deepEqual(keyringOut(c.parseKeyring(c.utf8(k.given.text))), k.expected, `${k.why} (as bytes)`);
      assert.deepEqual(keyringOut(c.parseKeyring(c.keyringText(c.parseKeyring(k.given.text)))), k.expected, `${k.why} (written and read again)`);
    }
  }
  const reasons = new Set(vectors.keyring.parse.map((k) => k.expected.refused).filter(Boolean));
  assert.deepEqual([...reasons].sort(), ["json", "keySize", "kids", "version"]);

  const outcomes = new Set();
  for (const k of vectors.keyring.accept) {
    const held = keyringFrom(k.given.held);
    assert.equal(held.current, k.given.held.highest);
    const check = () => c.checkKeyring({ held, highest: k.given.held.highest, incoming: c.parseKeyring(k.given.text) });
    if (k.expected.refused) await mustRefuse(check, k.expected, k.why);
    else assert.ok(check(), k.why);
    outcomes.add(k.expected.refused ?? "accepted");
  }
  assert.deepEqual([...outcomes].sort(), ["accepted", "backward", "keyChanged", "notebook"]);
});

test("hpkeOpen", async () => {
  let opened = 0;
  for (const k of vectors.hpkeOpen.cases) {
    const g = k.given;
    assert.equal(g.info, c.LABELS.keyring);
    assert.equal(g.aad, "");
    const open = () => c.openKeyring({ recipient: pair(g.recipient), enc: h(g.enc), ct: h(g.ciphertext) });
    if (k.expected.refused) {
      await mustRefuse(open, k.expected, k.why);
      continue;
    }
    assert.deepEqual(keyringOut(await open()), k.expected.keyring, k.why);
    assert.equal(c.fromUtf8(await c.hpkeOpen({ recipient: pair(g.recipient), enc: h(g.enc), info: g.info, ct: h(g.ciphertext) })), k.expected.text, k.why);
    const ctx = await c.hpkeRecipientContext({ recipient: pair(g.recipient), enc: h(g.enc), info: c.utf8(g.info) });
    assert.equal(x(ctx.sharedSecret), k.expected.sharedSecret, k.why);
    assert.equal(x(ctx.key), k.expected.key, k.why);
    assert.equal(x(ctx.baseNonce), k.expected.baseNonce, k.why);
    // The same seal again, from the sender's fixed key.
    const again = await c.sealKeyring({ keyring: keyringFrom(k.expected.keyring), recipientPublic: h(g.recipient.public), ephemeral: pair(k.sender.ephemeral) });
    assert.equal(x(again.enc), g.enc, k.why);
    assert.equal(x(again.ct), g.ciphertext, k.why);
    assert.equal(k.sender.ephemeral.public, g.enc, "enc is the sender's public key");
    // node:crypto agrees on the key agreement from both sides.
    const mine = createECDH("prime256v1");
    mine.setPrivateKey(h(g.recipient.d));
    const theirs = createECDH("prime256v1");
    theirs.setPrivateKey(h(k.sender.ephemeral.d));
    assert.equal(x(mine.computeSecret(h(g.enc))), x(theirs.computeSecret(h(g.recipient.public))), k.why);
    assert.equal(x(await c.ecdh(pair(g.recipient), h(g.enc))), x(mine.computeSecret(h(g.enc))), `${k.why} (node:crypto)`);
    opened++;
  }
  assert.equal(opened, 2);
  const reasons = new Set(vectors.hpkeOpen.cases.map((k) => k.expected.refused).filter(Boolean));
  assert.deepEqual([...reasons].sort(), ["point", "seal"]);
});

const cardArgs = (g) => ({ notebookKey: h(g.notebookKey), kid: g.kid, notebook: g.notebook, nonce: h(g.nonce), ...(g.deviceId ? { deviceId: g.deviceId } : { holderId: g.holderId }) });

for (const [group, seal, open] of [
  ["card", c.sealDeviceCard, c.openDeviceCard],
  ["holderCard", c.sealHolderCard, c.openHolderCard],
]) {
  test(group, async () => {
    let sealed = 0;
    for (const k of vectors[group].cases) {
      const g = k.given;
      // A case names the card it is opened as by the id it gives.
      const openAs = g.deviceId ? c.openDeviceCard : c.openHolderCard;
      if (k.expected.refused) {
        await mustRefuse(() => openAs({ ...cardArgs(g), ct: h(g.ciphertext) }), k.expected, k.why);
        continue;
      }
      if (g.plaintext) {
        const made = await seal({ ...cardArgs(g), text: g.plaintext });
        assert.equal(x(made.ct), k.expected.ciphertext, k.why);
        assert.equal(x(await c.cardKey(h(g.notebookKey))), k.expected.cardKey, k.why);
        assert.equal(x(c.utf8(k.expected.aad)), k.expected.aadHex, k.why);
        const label = g.deviceId ? "lit-device/1" : "lit-holder-card/1";
        assert.equal(k.expected.aad, [label, g.notebook, String(g.kid), g.deviceId ?? g.holderId].join("\n"), k.why);
        sealed++;
      }
      const opened = await open({ ...cardArgs(g), ct: h(g.ciphertext ?? k.expected.ciphertext) });
      assert.deepEqual(opened.card, k.expected.card, k.why);
      assert.equal(x(opened.public), k.expected.public, k.why);
      assert.equal(c.toBase64url(opened.public), opened.card.public, k.why);
      if ("sign" in k.expected) assert.equal(opened.sign ? x(opened.sign) : null, k.expected.sign, k.why);
    }
    assert.ok(sealed >= 1);
    assert.ok(vectors[group].cases.filter((k) => k.expected.refused === "seal").length >= 3);
  });
}

test("card: what a client won't write, and a card sealed again", async () => {
  for (const k of vectors.card.write) {
    const fields = { ...k.given, public: h(k.given.public), ...(k.given.sign ? { sign: h(k.given.sign) } : {}) };
    await mustRefuse(() => c.deviceCard(fields), k.expected, k.why);
  }
  const k = vectors.card.reseal;
  const { from, to, notebook, deviceId } = k.given;
  const again = await c.resealDeviceCard({
    from: { notebookKey: h(from.notebookKey), kid: from.kid }, to: { notebookKey: h(to.notebookKey), kid: to.kid },
    notebook, deviceId, nonce: h(from.nonce), ct: h(from.ciphertext), newNonce: h(to.nonce),
  });
  assert.equal(x(again.ct), k.expected.ciphertext, k.why);
  const opened = await c.openDeviceCard({ notebookKey: h(to.notebookKey), kid: to.kid, notebook, deviceId, nonce: again.nonce, ct: again.ct });
  assert.equal(opened.text, k.expected.plaintext);
  assert.deepEqual(opened.card, k.expected.card);
  assert.ok(opened.card.later, "the field this version doesn't know is still there");
  // The old key no longer opens it.
  assert.equal((await refusalOf(() => c.openDeviceCard({ notebookKey: h(from.notebookKey), kid: from.kid, notebook, deviceId, nonce: again.nonce, ct: again.ct })))?.why, "seal");
  // A client that parses and rewrites the card keeps the field too (a rename).
  const renamed = c.deviceCard({ ...opened.card, public: opened.public, sign: opened.sign, name: "Renamed" });
  assert.deepEqual(renamed.later, k.expected.card.later);
});

test("prf", async () => {
  const input = await c.prfInput();
  assert.equal(c.PRF_INPUT, "lit-notebook/1 prf");
  assert.equal(vectors.prf.input.text, c.PRF_INPUT);
  assert.equal(input.bytes.length, 18);
  assert.equal(x(input.bytes), vectors.prf.input.bytes);
  assert.equal(input.base64url, vectors.prf.input.base64url);
  assert.equal(x(input.hashed), vectors.prf.input.hashed);
  for (const k of vectors.prf.responses) {
    const before = JSON.stringify(k.given.response);
    assert.deepEqual(c.stripPrfResults(k.given.response), k.expected.toService, k.why);
    assert.equal(JSON.stringify(k.given.response), before, `${k.why}: the response itself is not changed`);
    assert.equal(JSON.stringify(k.expected.toService).includes('"results"'), false, k.why);
  }
  assert.ok(vectors.prf.responses.some((k) => k.given.response.clientExtensionResults.prf?.results && k.expected.toService.clientExtensionResults.prf.enabled === true));
});

for (const [group, kind] of [["passkeyHolder", "passkey"], ["recoveryHolder", "recovery"]]) {
  test(group, async () => {
    const secretKeyOf = (secret) => (kind === "passkey" ? c.passkeyKey(h(secret.prf)) : c.codeKey(c.readRecoveryCode(secret.typed)));
    const open = async (g) =>
      c.openHolder({
        secretKey: await secretKeyOf(g.secret),
        kind: g.service.kind,
        id: g.service.id,
        notebook: g.service.notebook,
        credential: g.answered ? h(g.answered) : undefined,
        sealed: { nonce: h(g.service.record.nonce), ct: h(g.service.record.ciphertext) },
        keyring: { enc: h(g.service.keyring.enc), ct: h(g.service.keyring.ciphertext) },
      });
    const checks = new Set();
    for (const k of vectors[group].cases) {
      if (k.expected.refused) {
        await mustRefuse(() => open(k.given), k.expected, k.why);
        checks.add(k.expected.check);
        continue;
      }
      const result = await open(k.given);
      assert.deepEqual(keyringOut(result.keyring), k.expected.keyring, k.why);
      if (!k.expected.plaintext) continue;
      // The first case carries every value along the way.
      const g = k.given;
      assert.equal(x(await secretKeyOf(g.secret)), k.expected.secretKey, k.why);
      if (kind === "recovery") assert.equal(x(c.readRecoveryCode(g.secret.typed)), g.secret.code);
      assert.equal(k.expected.aad, ["lit-holder/1", kind, g.service.id].join("\n"));
      assert.equal(x(c.utf8(k.expected.aad)), k.expected.aadHex);
      assert.deepEqual(result.record, k.expected.record);
      assert.deepEqual(JSON.parse(k.expected.plaintext), k.expected.record);
      assert.deepEqual({ d: x(result.key.d), public: x(result.key.public) }, k.expected.holderKey);
      assert.equal(c.keyringText(result.keyring), k.expected.keyringText);
      assert.equal("credential" in result.record, kind === "passkey", "only a passkey holder's record has a credential");
      // The record's own fields, as the spec's JSON has them.
      assert.deepEqual(Object.keys(result.record), ["lit", "v", "notebook", "kind", "id", ...(kind === "passkey" ? ["credential"] : []), "d", "public", "anchor"]);
      // Sealing it again from the fixed inputs gives the same bytes.
      const sealed = await c.sealHolderRecord({ secretKey: h(k.expected.secretKey), text: k.expected.plaintext, nonce: h(k.sender.recordSealedWith.nonce) });
      assert.equal(x(sealed.ct), g.service.record.ciphertext);
      const sealedKeyring = await c.sealKeyring({ keyring: result.keyring, recipientPublic: result.key.public, ephemeral: pair(k.sender.keyringSealedWith.ephemeral) });
      assert.equal(x(sealedKeyring.ct), g.service.keyring.ciphertext);
      // The reference writes the same record from its parts.
      const rebuilt = c.holderRecord({
        notebook: g.service.notebook, kind, id: g.service.id, credential: g.answered ? h(g.answered) : undefined,
        d: result.key.d, public: result.key.public, anchor: { kid: result.record.anchor.kid, key: c.fromBase64url(result.record.anchor.key) },
      });
      assert.equal(JSON.stringify(rebuilt), k.expected.plaintext);
    }
    assert.deepEqual([...checks].sort(), [1, 2, 3, 4], "a refusal at each of the four checks");
    const reasons = new Set(vectors[group].cases.map((k) => k.expected.refused).filter(Boolean));
    for (const r of ["seal", "record", "notebook", "anchor", ...(kind === "passkey" ? ["credential"] : [])]) assert.ok(reasons.has(r), r);
  });
}

test("approval", async () => {
  const { given: g, expected: e } = vectors.approval.case;
  const code = h(g.code);
  assert.equal(c.formatApprovalCode(code), g.codeText);
  assert.equal(x(c.readApprovalCode(g.codeText)), g.code);
  const { id, macKey } = await c.approvalKeys(code);
  assert.equal(id, e.id);
  assert.match(id, /^[0-9a-f]{32}$/);
  assert.equal(x(macKey), e.macKey);

  const asked = { deviceId: g.request.deviceId, platform: g.request.platform, model: g.request.model, public: h(g.request.public), sign: h(g.request.sign) };
  const requestMac = await c.approvalRequestMac({ macKey, id, ...asked });
  assert.equal(x(requestMac), e.request.mac);
  assert.equal(e.request.macInput, ["lit-approve/1 request", id, asked.deviceId, asked.platform, asked.model, c.toBase64url(asked.public), c.toBase64url(asked.sign)].join("\n"));
  assert.equal(x(createHmac("sha256", macKey).update(e.request.macInput).digest()), e.request.mac, "the request MAC (node:crypto)");
  const request = { ...asked, mac: requestMac };

  const held = keyringFrom(g.approver);
  const grant = await c.makeGrant({ macKey, id, request, keyring: held, added: g.approver.added, cardNonce: h(g.approver.cardNonce), ephemeral: pair(g.approver.ephemeral) });
  assert.deepEqual(
    { kid: grant.kid, enc: x(grant.enc), ciphertext: x(grant.ct), card: { nonce: x(grant.card.nonce), ciphertext: x(grant.card.ct) }, mac: x(grant.mac), macInput: e.grant.macInput },
    e.grant,
  );
  assert.equal(e.grant.macInput, ["lit-approve/1 grant", id, String(grant.kid), c.toBase64url(grant.enc), c.toBase64url(grant.ct)].join("\n"));
  assert.equal(x(createHmac("sha256", macKey).update(e.grant.macInput).digest()), e.grant.mac, "the grant MAC (node:crypto)");
  assert.equal(grant.kid, held.current);

  const device = { id: g.device.id, key: pair(g.device.key), sign: h(g.device.sign.public) };
  const fromFile = (f) => ({ kid: f.kid, enc: h(f.enc), ct: h(f.ciphertext), card: { nonce: h(f.card.nonce), ct: h(f.card.ciphertext) }, mac: h(f.mac) });
  const accepted = await c.acceptGrant({ macKey, id, grant: fromFile(e.grant), device });
  assert.deepEqual(keyringOut(accepted.keyring), e.accepted.keyring);
  assert.deepEqual(accepted.card, e.accepted.card);
  assert.equal(accepted.card.name, g.request.model, "the card's name starts as the model");
  assert.equal(accepted.card.public, c.toBase64url(device.key.public));
  assert.equal(accepted.card.sign, c.toBase64url(device.sign));

  const reasons = new Set();
  for (const k of vectors.approval.refused) {
    assert.equal(k.given.code, g.code);
    reasons.add(k.expected.refused);
    if (k.given.grant) {
      const d = { id: k.given.device.id, key: pair(k.given.device.key), sign: h(k.given.device.sign.public) };
      await mustRefuse(() => c.acceptGrant({ macKey, id, grant: fromFile(k.given.grant), device: d }), k.expected, k.why);
      continue;
    }
    const r = { ...k.given.request, public: h(k.given.request.public), sign: h(k.given.request.sign) };
    if (r.mac) await mustRefuse(() => c.checkApprovalRequest({ macKey, id, request: { ...r, mac: h(r.mac) } }), k.expected, k.why);
    else await mustRefuse(() => c.approvalRequestMac({ macKey, id, ...r }), k.expected, k.why);
  }
  assert.deepEqual([...reasons].sort(), ["card", "grantKid", "lineFeed", "mac"]);
  assert.ok(vectors.approval.refused.filter((k) => k.expected.refused === "mac").length >= 8);
});

test("signingKey", async () => {
  const g = vectors.signingKey;
  assert.equal(c.toBase64url(h(g.key.public)), g.key.sign, "the public key as a card's `sign` carries it");
  assert.equal(x(c.fromBase64url(g.key.sign)), g.key.public);
  assert.ok(c.isP256Point(h(g.key.public)));
  const jwk = (pub) => ({ kty: "EC", crv: "P-256", x: c.toBase64url(h(pub).subarray(1, 33)), y: c.toBase64url(h(pub).subarray(33)) });
  let verified = 0;
  for (const k of g.verify) {
    const { public: pub, message, signature } = k.given;
    assert.equal(await c.verifySignature(h(pub), h(message), h(signature)), k.expected.verifies, k.why);
    if (!k.expected.verifies) continue;
    verified++;
    const der = c.signatureToDer(h(signature));
    assert.equal(x(der), k.given.der, `${k.why}: to DER`);
    assert.equal(x(c.signatureFromDer(h(k.given.der))), signature, `${k.why}: from DER`);
    const key = createPublicKey({ key: jwk(pub), format: "jwk" });
    assert.ok(nodeVerify("sha256", h(message), { key, dsaEncoding: "ieee-p1363" }, h(signature)), `${k.why} (node:crypto, r ‖ s)`);
    assert.ok(nodeVerify("sha256", h(message), { key, dsaEncoding: "der" }, h(k.given.der)), `${k.why} (node:crypto, DER)`);
  }
  assert.equal(verified, 4);
  const derLengths = new Set(g.verify.filter((k) => k.expected.verifies).map((k) => k.given.der.length / 2));
  for (const n of [70, 71, 72]) assert.ok(derLengths.has(n), `a signature whose DER form is ${n} bytes`);
  assert.ok(g.verify.some((k) => k.expected.verifies && k.given.signature.startsWith("00")), "an r with a leading zero byte, which DER drops");
  assert.ok(g.verify.filter((k) => !k.expected.verifies).length >= 6);
  for (const k of g.derRefused) await mustRefuse(() => c.signatureFromDer(h(k.given.der)), k.expected, k.why);

  // What the reference signs, it verifies; and ECDSA never signs the same way twice.
  const mine = await c.generateSigningKey();
  const message = c.utf8("a message");
  const one = await c.signMessage(mine.privateKey, message);
  const two = await c.signMessage(mine.privateKey, message);
  assert.equal(one.length, 64);
  assert.notEqual(x(one), x(two));
  assert.equal(await c.verifySignature(mine.public, message, one), true);
  assert.equal(await c.verifySignature(mine.public, c.utf8("another message"), one), false);
  assert.equal(x(c.signatureFromDer(c.signatureToDer(one))), x(one));
  const imported = await c.importSigningKey(pair(g.key));
  assert.equal(await c.verifySignature(h(g.key.public), message, await c.signMessage(imported, message)), true);
});

test("point", () => {
  let valid = 0;
  for (const k of vectors.point.cases) {
    assert.equal(c.isP256Point(h(k.given.bytes)), k.expected.valid, k.why);
    if (k.expected.valid) valid++;
  }
  assert.ok(valid >= 3 && vectors.point.cases.length - valid >= 10);
  assert.equal(c.isP256Point("04"), false, "not bytes");
  assert.equal(c.isP256Point(undefined), false);
});

/* ── The walkthrough, followed from the file alone ───────────────────── */

test("walkthrough", async () => {
  const steps = vectors.walkthrough.steps;
  assert.deepEqual(steps.map((s) => s.step), [1, 2, 3, 4, 5, 6, 7, 8]);
  const [s1, s2, s3, s4, s5, s6, s7, s8] = steps;
  const sealedKeyring = (s) => ({ enc: h(s.enc), ct: h(s.ciphertext) });
  const sameSeal = async (keyring, recipientPublic, expected, what) => {
    const made = await c.sealKeyring({ keyring, recipientPublic: h(recipientPublic), ephemeral: pair(expected.ephemeral) });
    assert.equal(x(made.enc), expected.enc, what);
    assert.equal(x(made.ct), expected.ciphertext, what);
  };
  const deviceOf = (d) => ({ id: d.id, key: pair(d.key), sign: h(d.sign.public) });
  const proofIs = async (key, e) => {
    assert.equal(x(await c.keyProof(key)), e.keyProof);
    if (e.keyProofHash) assert.equal(x(await c.keyProofHash(h(e.keyProof))), e.keyProofHash);
  };
  /** A device's own card: written by the reference from its parts, sealed, and opened. */
  const ownCard = async (device, added, key, kid, notebook, e, what) => {
    const card = c.deviceCard({ public: h(device.key.public), sign: h(device.sign.public), name: device.name, platform: device.platform, added });
    assert.equal(JSON.stringify(card), e.plaintext, what);
    const made = await c.sealDeviceCard({ notebookKey: key, kid, notebook, deviceId: device.id, card, nonce: h(e.nonce) });
    assert.equal(x(made.ct), e.ciphertext, what);
    assert.equal(e.aad, ["lit-device/1", notebook, String(kid), device.id].join("\n"), what);
    assert.equal((await c.openDeviceCard({ notebookKey: key, kid, notebook, deviceId: device.id, nonce: h(e.nonce), ct: h(e.ciphertext) })).text, e.plaintext, what);
  };
  const resealed = async (deviceId, notebook, before, from, to, e, what) => {
    const made = await c.resealDeviceCard({ from, to, notebook, deviceId, nonce: h(before.nonce), ct: h(before.ciphertext), newNonce: h(e.nonce) });
    assert.equal(x(made.ct), e.ciphertext, what);
    assert.equal(e.plaintext, before.plaintext, `${what}: the card's bytes are kept`);
  };
  const rowsAre = async (records, key, kid, nonces, rows, what) => {
    for (const [i, plaintext] of records.entries()) {
      assert.deepEqual(fileRow(await c.sealRecord({ text: plaintext, notebookKey: key, kid, nonce: h(nonces[i]) })), rows[i], `${what}, row ${i}`);
    }
  };

  // 1. The first device sets up.
  const notebook = s1.given.notebook;
  const K1 = h(s1.given.notebookKey);
  const ring1 = c.firstKeyring(notebook, K1);
  assert.equal(c.keyringText(ring1), s1.expected.keyringText);
  assert.equal(x(await c.recordKey(K1)), s1.expected.recordKey);
  assert.equal(x(await c.cardKey(K1)), s1.expected.cardKey);
  await proofIs(K1, s1.expected);
  await ownCard(s1.given.device, s1.given.added, K1, 1, notebook, s1.expected.card, "step 1: A's card");
  const passkeyKey = await c.passkeyKey(h(s1.given.passkey.prf));
  assert.equal(x(passkeyKey), s1.expected.passkeyKey);
  const holder = s1.given.holder;
  const record = c.holderRecord({ notebook, kind: "passkey", id: holder.id, credential: h(s1.given.passkey.credential), d: h(holder.key.d), public: h(holder.key.public), anchor: { kid: 1, key: K1 } });
  assert.equal(JSON.stringify(record), s1.expected.holderRecord.plaintext);
  assert.equal(x((await c.sealHolderRecord({ secretKey: passkeyKey, record, nonce: h(s1.given.nonces.holderRecord) })).ct), s1.expected.holderRecord.ciphertext);
  assert.equal(s1.expected.holderRecord.aad, ["lit-holder/1", "passkey", holder.id].join("\n"));
  const holderCard = await c.openHolderCard({ notebookKey: K1, kid: 1, notebook, holderId: holder.id, nonce: h(s1.expected.holderCard.nonce), ct: h(s1.expected.holderCard.ciphertext) });
  assert.equal(holderCard.text, s1.expected.holderCard.plaintext);
  assert.equal(holderCard.card.kind, "passkey");
  assert.equal(x(holderCard.public), holder.key.public);
  assert.equal(x((await c.sealHolderCard({ notebookKey: K1, kid: 1, notebook, holderId: holder.id, text: holderCard.text, nonce: h(s1.given.nonces.holderCard) })).ct), s1.expected.holderCard.ciphertext);
  await sameSeal(ring1, s1.given.device.key.public, s1.expected.keyringForDevice, "step 1: the keyring for A");
  await sameSeal(ring1, holder.key.public, s1.expected.keyringForHolder, "step 1: the keyring for the passkey holder");

  // 2. It pushes its notebook.
  const records = s2.given.records.map((r) => r.plaintext);
  await rowsAre(records, K1, 1, s2.given.records.map((r) => r.nonce), s2.expected.rows, "step 2");

  // 3. A second device joins by passkey, from what the service gives it.
  const viaPasskey = s3.given.fromService.holder;
  assert.deepEqual(viaPasskey.keyring, { enc: s1.expected.keyringForHolder.enc, ciphertext: s1.expected.keyringForHolder.ciphertext }, "the service hands on what step 1 sent");
  const joinedB = await c.openHolder({
    secretKey: await c.passkeyKey(h(s3.given.passkey.prf)), kind: viaPasskey.kind, id: viaPasskey.id, notebook: viaPasskey.notebook, credential: h(s3.given.passkey.answered),
    sealed: { nonce: h(viaPasskey.record.nonce), ct: h(viaPasskey.record.ciphertext) }, keyring: sealedKeyring(viaPasskey.keyring),
  });
  assert.deepEqual(joinedB.record, s3.expected.holderRecord);
  assert.deepEqual({ d: x(joinedB.key.d), public: x(joinedB.key.public) }, s3.expected.holderKey);
  assert.deepEqual(keyringOut(joinedB.keyring), s3.expected.keyring);
  await ownCard(s3.given.device, s3.given.added, K1, 1, notebook, s3.expected.card, "step 3: B's card");
  await sameSeal(joinedB.keyring, s3.given.device.key.public, s3.expected.keyringForDevice, "step 3: the keyring for B");
  await proofIs(c.keyOf(joinedB.keyring, 1), s3.expected);
  assert.deepEqual(s3.given.fromService.rows, s2.expected.rows);
  for (const [i, row] of s3.given.fromService.rows.entries()) {
    assert.deepEqual((await c.openRow({ row: wireRow(row), keyring: joinedB.keyring })).record, s3.expected.records[i], `step 3, row ${i}`);
    assert.deepEqual(s3.expected.records[i], JSON.parse(records[i]));
  }

  // 4. A third device is approved by the second.
  const approval = await c.approvalKeys(h(s4.given.code));
  assert.equal(approval.id, s4.expected.id);
  assert.equal(x(approval.macKey), s4.expected.macKey);
  const C = s4.given.device;
  const asked = { deviceId: C.id, platform: C.platform, model: C.name, public: h(C.key.public), sign: h(C.sign.public) };
  const request = { ...asked, mac: await c.approvalRequestMac({ macKey: approval.macKey, id: approval.id, ...asked }) };
  assert.deepEqual({ ...asked, public: x(asked.public), sign: x(asked.sign), mac: x(request.mac) }, s4.expected.request);
  const grant = await c.makeGrant({ macKey: approval.macKey, id: approval.id, request, keyring: joinedB.keyring, added: s4.given.added, cardNonce: h(s4.given.nonces.card), ephemeral: pair(s4.given.ephemerals.toDevice) });
  assert.deepEqual({ kid: grant.kid, enc: x(grant.enc), ciphertext: x(grant.ct), card: { nonce: x(grant.card.nonce), ciphertext: x(grant.card.ct) }, mac: x(grant.mac) }, s4.expected.grant);
  const acceptedC = await c.acceptGrant({ macKey: approval.macKey, id: approval.id, grant, device: deviceOf(C) });
  assert.deepEqual(keyringOut(acceptedC.keyring), s4.expected.keyring);
  assert.equal(JSON.stringify(acceptedC.card), s4.expected.card.plaintext);
  await proofIs(c.keyOf(acceptedC.keyring, 1), s4.expected);

  // 5. The first device is removed: a new key, sealed to everyone kept and never to A.
  const K2 = h(s5.given.notebookKey);
  const ring2 = c.nextKeyring(acceptedC.keyring, K2);
  assert.equal(c.keyringText(ring2), s5.expected.keyringText);
  await proofIs(K2, s5.expected);
  const B = s3.given.device;
  await sameSeal(ring2, B.key.public, s5.expected.keyringForB, "step 5: the keyring for B");
  await sameSeal(ring2, C.key.public, s5.expected.keyringForC, "step 5: the keyring for C");
  await sameSeal(ring2, holder.key.public, s5.expected.keyringForHolder, "step 5: the keyring for the passkey holder");
  const k1 = { notebookKey: K1, kid: 1 };
  const k2 = { notebookKey: K2, kid: 2 };
  await resealed(B.id, notebook, s3.expected.card, k1, k2, s5.expected.cardB, "step 5: B's card");
  await resealed(C.id, notebook, s4.expected.card, k1, k2, s5.expected.cardC, "step 5: C's card");
  const holderCard2 = await c.resealHolderCard({ from: k1, to: k2, notebook, holderId: holder.id, nonce: h(s1.expected.holderCard.nonce), ct: h(s1.expected.holderCard.ciphertext), newNonce: h(s5.given.nonces.holderCard) });
  assert.equal(x(holderCard2.ct), s5.expected.holderCard.ciphertext);
  await rowsAre(records, K2, 2, s5.given.nonces.rows, s5.expected.rows, "step 5");
  const forB = await c.openKeyring({ recipient: pair(B.key), ...sealedKeyring(s5.expected.keyringForB) });
  assert.ok(c.checkKeyring({ held: keyringFrom(s5.expected.onB.held), incoming: forB }), "B accepts the new keyring");
  assert.equal(s5.expected.onB.accepted, true);
  await mustRefuse(() => c.openRow({ row: wireRow(s5.expected.onA.row), keyring: keyringFrom(s5.expected.onA.held) }), s5.expected.onA, "A can't open a row under the new key");
  assert.equal(s5.expected.onA.refused, "missingKey");
  assert.equal(s5.given.removed, s1.given.device.id);
  // Nothing in step 5 is sealed to A's key: A's own key opens none of the new keyrings.
  for (const s of [s5.expected.keyringForB, s5.expected.keyringForC, s5.expected.keyringForHolder]) {
    assert.equal((await refusalOf(() => c.openKeyring({ recipient: pair(s1.given.device.key), ...sealedKeyring(s) })))?.why, "seal");
  }

  // 6. Switch to "this device only": a third key, no passkey holder, a recovery holder.
  const K3 = h(s6.given.notebookKey);
  const ring3 = c.nextKeyring(ring2, K3);
  assert.equal(c.keyringText(ring3), s6.expected.keyringText);
  await proofIs(K3, s6.expected);
  const code = h(s6.given.recoveryCode);
  assert.equal(c.formatRecoveryCode(code), s6.expected.codeText);
  const codeKey = await c.codeKey(code);
  assert.equal(x(codeKey), s6.expected.codeKey);
  const recovery = s6.given.holder;
  const recoveryRecord = c.holderRecord({ notebook, kind: "recovery", id: recovery.id, d: h(recovery.key.d), public: h(recovery.key.public), anchor: { kid: 3, key: K3 } });
  assert.equal(JSON.stringify(recoveryRecord), s6.expected.holderRecord.plaintext);
  assert.equal(x((await c.sealHolderRecord({ secretKey: codeKey, record: recoveryRecord, nonce: h(s6.given.nonces.holderRecord) })).ct), s6.expected.holderRecord.ciphertext);
  const recoveryCard = c.holderCard({ public: h(recovery.key.public), kind: "recovery", name: "Recovery code", added: s6.given.added });
  assert.equal(JSON.stringify(recoveryCard), s6.expected.holderCard.plaintext);
  assert.equal(x((await c.sealHolderCard({ notebookKey: K3, kid: 3, notebook, holderId: recovery.id, card: recoveryCard, nonce: h(s6.given.nonces.holderCard) })).ct), s6.expected.holderCard.ciphertext);
  await sameSeal(ring3, B.key.public, s6.expected.keyringForB, "step 6: the keyring for B");
  await sameSeal(ring3, C.key.public, s6.expected.keyringForC, "step 6: the keyring for C");
  await sameSeal(ring3, recovery.key.public, s6.expected.keyringForHolder, "step 6: the keyring for the recovery holder");
  const k3 = { notebookKey: K3, kid: 3 };
  await resealed(B.id, notebook, s5.expected.cardB, k2, k3, s6.expected.cardB, "step 6: B's card");
  await resealed(C.id, notebook, s5.expected.cardC, k2, k3, s6.expected.cardC, "step 6: C's card");
  await rowsAre(records, K3, 3, s6.given.nonces.rows, s6.expected.rows, "step 6");
  // The passkey still opens its old record, and gets the keyring of step 5 at most.
  const stale = await c.openHolder({
    secretKey: passkeyKey, kind: "passkey", id: holder.id, notebook, credential: h(s1.given.passkey.credential),
    sealed: { nonce: h(s1.expected.holderRecord.nonce), ct: h(s1.expected.holderRecord.ciphertext) }, keyring: sealedKeyring(s5.expected.keyringForHolder),
  });
  assert.deepEqual(keyringOut(stale.keyring), s6.expected.withThePasskey.keyring);
  assert.equal(stale.keyring.current, 2);
  await mustRefuse(() => c.openRow({ row: wireRow(s6.expected.withThePasskey.row), keyring: stale.keyring }), s6.expected.withThePasskey, "the passkey's keyring opens nothing sealed under the third key");
  assert.equal((await refusalOf(() => c.openKeyring({ recipient: pair(holder.key), ...sealedKeyring(s6.expected.keyringForHolder) })))?.why, "seal", "the third keyring is not sealed to the passkey holder");
  assert.equal(s6.given.removedHolder, holder.id);

  // 7. Recovery by code, on a fourth device.
  const typedCode = c.readRecoveryCode(s7.given.typed);
  assert.equal(x(typedCode), s7.expected.code);
  assert.equal(s7.expected.code, s6.given.recoveryCode);
  assert.equal(x(await c.codeKey(typedCode)), s7.expected.codeKey);
  const viaCode = s7.given.fromService.holder;
  const joinedD = await c.openHolder({
    secretKey: await c.codeKey(typedCode), kind: viaCode.kind, id: viaCode.id, notebook: viaCode.notebook,
    sealed: { nonce: h(viaCode.record.nonce), ct: h(viaCode.record.ciphertext) }, keyring: sealedKeyring(viaCode.keyring),
  });
  assert.deepEqual(joinedD.record, s7.expected.holderRecord);
  assert.deepEqual({ d: x(joinedD.key.d), public: x(joinedD.key.public) }, s7.expected.holderKey);
  assert.deepEqual(keyringOut(joinedD.keyring), s7.expected.keyring);
  await ownCard(s7.given.device, s7.given.added, K3, 3, notebook, s7.expected.card, "step 7: D's card");
  await sameSeal(joinedD.keyring, s7.given.device.key.public, s7.expected.keyringForDevice, "step 7: the keyring for D");
  await proofIs(c.keyOf(joinedD.keyring, 3), s7.expected);
  assert.deepEqual(s7.given.fromService.rows, s6.expected.rows);
  for (const [i, row] of s7.given.fromService.rows.entries()) {
    assert.deepEqual((await c.openRow({ row: wireRow(row), keyring: joinedD.keyring })).record, s7.expected.records[i], `step 7, row ${i}`);
  }

  // 8. Forgeries.
  const { toC, oldKeyringToC, toRecoveryHolder } = s8.given;
  for (const [given, expected, what] of [[toC, s8.expected.toC, "a keyring of the service's own"], [oldKeyringToC, s8.expected.oldKeyringToC, "C's own old keyring"]]) {
    const incoming = await c.openKeyring({ recipient: pair(given.device.key), ...sealedKeyring(given) });
    assert.equal(c.keyringText(incoming), expected.opensTo, `${what} opens, since anyone can seal to a public key`);
    await mustRefuse(() => c.checkKeyring({ held: keyringFrom(given.held), incoming }), expected, what);
  }
  assert.equal(s8.expected.toC.refused, "keyChanged");
  assert.equal(s8.expected.oldKeyringToC.refused, "backward");
  const forged = toRecoveryHolder.fromService.holder;
  await mustRefuse(
    async () =>
      c.openHolder({
        secretKey: await c.codeKey(c.readRecoveryCode(toRecoveryHolder.typed)), kind: forged.kind, id: forged.id, notebook: forged.notebook,
        sealed: { nonce: h(forged.record.nonce), ct: h(forged.record.ciphertext) }, keyring: sealedKeyring(forged.keyring),
      }),
    s8.expected.toRecoveryHolder,
    "a forged keyring sealed to the recovery holder",
  );
  assert.deepEqual(s8.expected.toRecoveryHolder, { refused: "anchor", check: 4 });
});

/* ── 5. With real randomness: what the reference seals, it opens ─────── */

test("round trip: a record sealed with a random nonce opens, and no two seals are alike", async () => {
  const notebookKey = c.randomBytes(32);
  const keyring = c.firstKeyring(c.newId(), notebookKey);
  const record = { id: c.newId(), kind: "note", modified: "2026-11-23T18:35:09.978Z", body: "x".repeat(1000) };
  const one = await c.sealRecord({ record, notebookKey, kid: 1 });
  const two = await c.sealRecord({ record, notebookKey, kid: 1 });
  assert.notEqual(one.nonce, two.nonce);
  assert.notEqual(one.ct, two.ct);
  assert.deepEqual(Object.keys(one), ["v", "id", "modified", "kid", "nonce", "ct"]);
  const bytes = c.utf8(JSON.stringify(record)).length;
  assert.ok(bytes > 1024 && bytes < 1280);
  assert.equal(c.fromBase64url(one.ct).length, 1280 + 16, "padded to the next 256 bytes, plus the tag");
  assert.deepEqual((await c.openRow({ row: one, keyring })).record, record);
  assert.deepEqual((await c.openRow({ row: two, keyring })).record, record);
  // After a change of key the old rows still open, and new ones name the new kid.
  const next = c.nextKeyring(keyring, c.randomBytes(32));
  assert.deepEqual((await c.openRow({ row: one, keyring: next })).record, record);
  const resealed = await c.sealRecord({ record, notebookKey: c.keyOf(next, 2), kid: 2 });
  assert.equal(resealed.kid, 2);
  assert.equal((await refusalOf(() => c.openRow({ row: resealed, keyring })))?.why, "missingKey");
  // The largest record seals and opens; one byte more is refused.
  const base = JSON.stringify({ id: "a", modified: "2026-11-23T18:35:09Z", body: "" }).length;
  const largest = { id: "a", modified: "2026-11-23T18:35:09Z", body: "y".repeat(MAX_RECORD_BYTES - base) };
  const big = await c.sealRecord({ record: largest, notebookKey, kid: 1 });
  assert.equal(c.fromBase64url(big.ct).length, 1_048_592);
  assert.equal((await c.openRow({ row: big, keyring })).record.body.length, largest.body.length);
  largest.body += "y";
  assert.equal((await refusalOf(() => c.sealRecord({ record: largest, notebookKey, kid: 1 })))?.why, "recordSize");
});

test("round trip: a keyring sealed to a device's non-extractable key, and to a holder's", async () => {
  const keyring = c.nextKeyring(c.firstKeyring(c.newId(), c.randomBytes(32)), c.randomBytes(32));
  const device = await c.generateDeviceKey();
  assert.equal(device.privateKey.extractable, false);
  assert.ok(c.isP256Point(device.public));
  const one = await c.sealKeyring({ keyring, recipientPublic: device.public });
  const two = await c.sealKeyring({ keyring, recipientPublic: device.public });
  assert.notEqual(x(one.enc), x(two.enc), "a fresh sender key each time");
  assert.equal(c.keyringText(await c.openKeyring({ recipient: device, ...one })), c.keyringText(keyring));
  assert.equal(c.keyringText(await c.openKeyring({ recipient: device, ...two })), c.keyringText(keyring));
  const holderKey = await c.generateKeyPair();
  assert.ok(c.isP256Scalar(holderKey.d) && c.isP256Point(holderKey.public));
  const three = await c.sealKeyring({ keyring, recipientPublic: holderKey.public });
  assert.equal(c.keyringText(await c.openKeyring({ recipient: holderKey, ...three })), c.keyringText(keyring));
  assert.equal((await refusalOf(() => c.openKeyring({ recipient: device, ...three })))?.why, "seal");
  // A private key beside another key's public half is refused, by the platform or by the seal.
  const other = await c.generateKeyPair();
  const e = await refusalOf(() => c.openKeyring({ recipient: { d: holderKey.d, public: other.public }, ...three }));
  assert.ok(["privateKey", "seal"].includes(e?.why), e?.why);
});

test("round trip: setup, a holder, an approval, and a change of key, all with generated keys", async () => {
  const notebook = c.newId();
  const K1 = c.randomBytes(32);
  const ring1 = c.firstKeyring(notebook, K1);
  // A recovery holder.
  const code = c.randomBytes(c.RECOVERY_CODE_BYTES);
  const holderKey = await c.generateKeyPair();
  const holderId = c.newId();
  const sealedRecord = await c.sealHolderRecord({
    secretKey: await c.codeKey(code),
    record: c.holderRecord({ notebook, kind: "recovery", id: holderId, d: holderKey.d, public: holderKey.public, anchor: { kid: 1, key: K1 } }),
  });
  const forHolder = await c.sealKeyring({ keyring: ring1, recipientPublic: holderKey.public });
  const typed = c.formatRecoveryCode(code).toLowerCase();
  const joined = await c.openHolder({ secretKey: await c.codeKey(c.readRecoveryCode(typed)), kind: "recovery", id: holderId, notebook, sealed: sealedRecord, keyring: forHolder });
  assert.equal(c.keyringText(joined.keyring), c.keyringText(ring1));
  // An approval, with the new device's keys kept as non-extractable CryptoKeys.
  const deviceKey = await c.generateDeviceKey();
  const signKey = await c.generateSigningKey();
  const deviceId = c.newId();
  const approvalCode = c.randomBytes(c.APPROVAL_CODE_BYTES);
  const { id, macKey } = await c.approvalKeys(c.readApprovalCode(c.formatApprovalCode(approvalCode)));
  const asked = { deviceId, platform: "web", model: "Firefox on Windows", public: deviceKey.public, sign: signKey.public };
  const request = { ...asked, mac: await c.approvalRequestMac({ macKey, id, ...asked }) };
  const grant = await c.makeGrant({ macKey, id, request, keyring: joined.keyring, added: "2026-11-23T18:35:09.978Z" });
  const accepted = await c.acceptGrant({ macKey, id, grant, device: { id: deviceId, key: deviceKey, sign: signKey.public } });
  assert.equal(c.keyringText(accepted.keyring), c.keyringText(ring1));
  // A change of key: the card sealed again, the keyring sealed again, and the device accepts it.
  const ring2 = c.nextKeyring(ring1, c.randomBytes(32));
  const card2 = await c.resealDeviceCard({ from: { notebookKey: K1, kid: 1 }, to: { notebookKey: c.keyOf(ring2, 2), kid: 2 }, notebook, deviceId, ...grant.card });
  const opened = await c.openDeviceCard({ notebookKey: c.keyOf(ring2, 2), kid: 2, notebook, deviceId, ...card2 });
  assert.equal(x(opened.public), x(deviceKey.public));
  assert.equal(x(opened.sign), x(signKey.public));
  const forDevice = await c.sealKeyring({ keyring: ring2, recipientPublic: opened.public });
  assert.ok(c.checkKeyring({ held: accepted.keyring, incoming: await c.openKeyring({ recipient: deviceKey, ...forDevice }) }));
  assert.notEqual(x(await c.keyProof(K1)), x(await c.keyProof(c.keyOf(ring2, 2))));
});

test("every seal made without a nonce draws a fresh one: two seals of one input differ, and both open", async () => {
  // Every production call leaves the nonce to the default, and the vectors pass one in, so only this
  // holds the default: one nonce reused under one key would give the service the XOR of two cards and
  // the means to forge one (Audit 9, TQ9-1). One case for each sealer that takes a nonce.
  const added = "2026-11-25T12:00:00.000Z";
  const notebook = c.newId();
  const K1 = c.randomBytes(32);
  const K2 = c.randomBytes(32);
  const ring = c.firstKeyring(notebook, K1);
  const deviceId = c.newId();
  const deviceKey = await c.generateDeviceKey();
  const signKey = await c.generateSigningKey();
  const card = c.deviceCard({ public: deviceKey.public, sign: signKey.public, name: "Firefox on Windows", platform: "web", added });
  const holderKey = await c.generateKeyPair();
  const holderId = c.newId();
  const holderCard = c.holderCard({ public: holderKey.public, kind: "recovery", name: "Recovery code", added });
  const record = c.holderRecord({ notebook, kind: "recovery", id: holderId, d: holderKey.d, public: holderKey.public, anchor: { kid: 1, key: K1 } });
  const secretKey = await c.codeKey(c.randomBytes(c.RECOVERY_CODE_BYTES));
  const forHolder = await c.sealKeyring({ keyring: ring, recipientPublic: holderKey.public });
  const deviceCard1 = await c.sealDeviceCard({ notebookKey: K1, kid: 1, notebook, deviceId, card, nonce: c.randomBytes(c.NONCE_BYTES) });
  const holderCard1 = await c.sealHolderCard({ notebookKey: K1, kid: 1, notebook, holderId, card: holderCard, nonce: c.randomBytes(c.NONCE_BYTES) });
  const { id, macKey } = await c.approvalKeys(c.randomBytes(c.APPROVAL_CODE_BYTES));
  const asked = { deviceId, platform: "web", model: "Firefox on Windows", public: deviceKey.public, sign: signKey.public };
  const request = { ...asked, mac: await c.approvalRequestMac({ macKey, id, ...asked }) };
  const note = { id: "a", modified: added, body: "the same words, sealed twice" };

  /** [name, seal with no nonce, what it sealed ({ nonce, ct }), open it] */
  const cases = [
    // A row carries its nonce and ciphertext as base64url.
    ["sealRecord", () => c.sealRecord({ record: note, notebookKey: K1, kid: 1 }), (s) => ({ nonce: c.fromBase64url(s.nonce), ct: c.fromBase64url(s.ct) }), (s) => c.openRow({ row: s, keyring: ring })],
    ["sealDeviceCard", () => c.sealDeviceCard({ notebookKey: K1, kid: 1, notebook, deviceId, card }), (s) => s, (s) => c.openDeviceCard({ notebookKey: K1, kid: 1, notebook, deviceId, ...s })],
    ["sealHolderCard", () => c.sealHolderCard({ notebookKey: K1, kid: 1, notebook, holderId, card: holderCard }), (s) => s, (s) => c.openHolderCard({ notebookKey: K1, kid: 1, notebook, holderId, ...s })],
    [
      "resealDeviceCard",
      () => c.resealDeviceCard({ from: { notebookKey: K1, kid: 1 }, to: { notebookKey: K2, kid: 2 }, notebook, deviceId, ...deviceCard1 }),
      (s) => s,
      (s) => c.openDeviceCard({ notebookKey: K2, kid: 2, notebook, deviceId, ...s }),
    ],
    [
      "resealHolderCard",
      () => c.resealHolderCard({ from: { notebookKey: K1, kid: 1 }, to: { notebookKey: K2, kid: 2 }, notebook, holderId, ...holderCard1 }),
      (s) => s,
      (s) => c.openHolderCard({ notebookKey: K2, kid: 2, notebook, holderId, ...s }),
    ],
    [
      "sealHolderRecord",
      () => c.sealHolderRecord({ secretKey, record }),
      (s) => s,
      (s) => c.openHolder({ secretKey, kind: "recovery", id: holderId, notebook, sealed: s, keyring: forHolder }),
    ],
    [
      "makeGrant",
      () => c.makeGrant({ macKey, id, request, keyring: ring, added }),
      (g) => g.card,
      (g) => c.acceptGrant({ macKey, id, grant: g, device: { id: deviceId, key: deviceKey, sign: signKey.public } }),
    ],
  ];
  for (const [name, seal, sealed, open] of cases) {
    const one = await seal();
    const two = await seal();
    assert.equal(sealed(one).nonce.length, c.NONCE_BYTES, name);
    assert.notEqual(x(sealed(one).nonce), x(sealed(two).nonce), `${name}: a fresh nonce each time`);
    assert.notEqual(x(sealed(one).ct), x(sealed(two).ct), `${name}: so a different ciphertext`);
    await open(one);
    await open(two);
  }
});

/* ── Small rules the vectors lean on ─────────────────────────────────── */

test("lines, kids, ids, and instants", async () => {
  assert.equal(c.fromUtf8(c.lines("a", "b", "")), "a\nb\n");
  assert.equal(c.fromUtf8(c.lines("a")), "a");
  assert.equal((await refusalOf(() => c.lines("a", "b\nc")))?.why, "lineFeed");
  assert.equal((await refusalOf(() => c.lines("a", 2)))?.why, "lineFeed");
  assert.equal(c.kidText(12), "12");
  for (const bad of [0, -1, 1.5, "1", NaN, 2 ** 53]) assert.equal((await refusalOf(() => c.kidText(bad)))?.why, "kid", String(bad));
  const id = c.newId();
  assert.ok(c.isUuid(id));
  assert.equal(id[14], "4");
  assert.match(id[19], /[89ab]/);
  assert.equal(c.isUuid(id.toUpperCase()), false);
  assert.equal(c.isUuid(id.replaceAll("-", "")), false);
  assert.equal((await refusalOf(() => c.firstKeyring("my notebook", c.randomBytes(32))))?.why, "id");
  assert.ok(c.sameInstant("2026-11-23T18:35:09.5Z", "2026-11-23T18:35:09.500Z"));
  assert.ok(c.sameInstant("2026-11-23T18:35:09Z", "2026-11-23T18:35:09.0Z"));
  assert.ok(c.sameInstant("not a time", "not a time"), "the same bytes are the same time");
  assert.equal(c.sameInstant("2026-11-23T18:35:09.5Z", "2026-11-23T18:35:09.51Z"), false);
  assert.equal(c.sameInstant("2026-11-23T18:35:09Z", "2026-11-23T18:35:10Z"), false);
  assert.equal(c.sameInstant("2026-11-23T18:35:09Z", "2026-11-23T18:35:09+00:00"), false, "only the format's form is compared");
  assert.equal(c.sameInstant("2026-11-23T18:35:09Z", undefined), false);
});

test("a device that keeps its highest accepted `current` apart is held to it", async () => {
  const notebook = c.newId();
  const one = c.firstKeyring(notebook, c.randomBytes(32));
  const two = c.nextKeyring(one, c.randomBytes(32));
  assert.ok(c.checkKeyring({ held: one, incoming: two }));
  assert.equal((await refusalOf(() => c.checkKeyring({ held: one, highest: 3, incoming: two })))?.why, "backward");
  assert.equal((await refusalOf(() => c.checkKeyring({ held: two, incoming: one })))?.why, "backward");
});

test("the reference is pure: WebCrypto alone, no imports, no storage, no network", () => {
  const source = read("../src/lib/desk-crypto.mjs");
  assert.doesNotMatch(source, /^\s*import\s/m, "no import statements");
  assert.doesNotMatch(source, /\bimport\s*\(/, "no dynamic imports");
  assert.doesNotMatch(source, /\brequire\s*\(|["']node:/, "no node: modules");
  assert.doesNotMatch(source, /\b(localStorage|sessionStorage|indexedDB|XMLHttpRequest|WebSocket|navigator)\b|\bfetch\s*\(|\b(document|window|process)\s*\./, "no storage, network, or page");
  assert.doesNotMatch(source, /Math\.random/, "no randomness but the platform's");
});
