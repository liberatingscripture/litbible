// The hand-written passkey verifier (src/webauthn.js, src/cbor.js), held to
// bytes it didn't make.
//
// The first half runs the W3C's own published examples (WebAuthn Level 3,
// section 16, "Test Vectors") through it: attestation objects, client data,
// authenticator data, and signatures that the specification's editors
// generated, copied byte for byte into test/fixtures/w3c-webauthn-vectors.json.
// A decoder that only ever read what the encoder in test/authenticator.js
// writes could share that encoder's mistakes; these can't.
//
// Not every example verifies the user, and the service always requires that,
// so each example is read piece by piece (the pieces src/webauthn.js exports),
// and then through the whole check, where the answer the example must get is
// stated: accepted, or refused for the one flag it lacks.
//
// The second half is each refusal of the two decoders, one input at a time.
import { describe, expect, it } from "vitest";
import raw from "./fixtures/w3c-webauthn-vectors.json?raw";
import { CborError, decodeCbor, decodeCborWhole } from "../src/cbor.js";
import {
  PasskeyRefused,
  checkAssertion,
  checkRegistration,
  ecdsaSignatureFromDer,
  jwkFromCose,
  readAuthenticatorData,
  readClientData,
  verifySignature,
} from "../src/webauthn.js";
import { cbor, concat, derSignature } from "./authenticator.js";
import { ref } from "./notebook.js";

const W3C = JSON.parse(raw);
const hex = (text) => Uint8Array.from(text.match(/../g) ?? [], (pair) => parseInt(pair, 16));
const b64 = ref.toBase64url;
const sha256 = async (bytes) => new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));

/** One example as bytes. */
const example = (name) => {
  const { registration: r, authentication: a } = W3C.vectors[name];
  return {
    registration: { challenge: hex(r.challenge), credentialId: hex(r.credential_id), clientDataJSON: hex(r.clientDataJSON), attestationObject: hex(r.attestationObject) },
    authentication: { challenge: hex(a.challenge), authenticatorData: hex(a.authenticatorData), clientDataJSON: hex(a.clientDataJSON), signature: hex(a.signature) },
  };
};

/** The reason a check refuses with, or "accepted". */
const verdict = async (check) => {
  try {
    await check();
    return "accepted";
  } catch (error) {
    if (error instanceof PasskeyRefused) return error.reason;
    throw error;
  }
};

/** The credential a registration example made, read piece by piece. */
const credentialOf = (registration) => {
  const attestation = decodeCborWhole(registration.attestationObject);
  const data = readAuthenticatorData(attestation.get("authData"));
  return { fmt: attestation.get("fmt"), data, jwk: jwkFromCose(data.credential.key) };
};

describe("the W3C's test vectors: what the service reads of them", () => {
  it("names the document they came from", () => {
    expect(W3C.source).toBe("https://www.w3.org/TR/webauthn-3/#sctn-test-vectors");
    expect(Object.keys(W3C.vectors)).toEqual(["none-es256", "packed-self-es256", "none-es256-crossOrigin", "packed-rs256", "packed-es384", "packed-eddsa"]);
  });

  // [the example, its attestation format, the flags at registration, its key's kind]
  const READ = [
    ["none-es256", "none", { verified: false, eligible: true, backedUp: true }, "EC"],
    ["packed-self-es256", "packed", { verified: true, eligible: true, backedUp: true }, "EC"],
    ["none-es256-crossOrigin", "none", { verified: true, eligible: false, backedUp: false }, "EC"],
    ["packed-rs256", "packed", { verified: true, eligible: true, backedUp: true }, "RSA"],
  ];
  for (const [name, fmt, flags, kty] of READ) {
    describe(name, () => {
      it("reads the attestation object: its format, the RP, the flags, the credential's id, and its key", async () => {
        const { registration } = example(name);
        const made = credentialOf(registration);
        expect(made.fmt).toBe(fmt);
        expect([...made.data.rpIdHash]).toEqual([...(await sha256(new TextEncoder().encode(W3C.rpId)))]);
        expect(made.data).toMatchObject({ present: true, count: 0, ...flags });
        expect([...made.data.credential.id]).toEqual([...registration.credentialId]);
        expect(made.jwk.kty).toBe(kty);
      });

      it("reads the client data: the challenge the relying party gave, and the origin", () => {
        const { registration, authentication } = example(name);
        // Read as JSON here, since one example was made in another site's frame, which readClientData() refuses.
        for (const [half, type] of [[registration, "webauthn.create"], [authentication, "webauthn.get"]]) {
          const data = JSON.parse(new TextDecoder().decode(half.clientDataJSON));
          expect(data).toMatchObject({ type, challenge: b64(half.challenge), origin: W3C.origin });
        }
      });

      it("verifies the signature the example's authenticator made, with the key its registration gave", async () => {
        const { registration, authentication } = example(name);
        const { jwk } = credentialOf(registration);
        expect(await verifySignature({ jwk, ...authentication })).toBe(true);
      });

      it("refuses that signature once a single bit of what was signed, or of the signature, is changed", async () => {
        const { registration, authentication } = example(name);
        const { jwk } = credentialOf(registration);
        for (const part of ["authenticatorData", "clientDataJSON", "signature"]) {
          const changed = Uint8Array.from(authentication[part]);
          changed[changed.length - 1] ^= 0x01;
          expect(await verifySignature({ jwk, ...authentication, [part]: changed }), part).toBe(false);
        }
      });

      it("refuses that signature under another example's key", async () => {
        const { authentication } = example(name);
        const other = READ.find(([n, , , k]) => n !== name && k === kty)?.[0] ?? "none-es256";
        const { jwk } = credentialOf(example(other).registration);
        expect(await verifySignature({ jwk, ...authentication })).toBe(false);
      });
    });
  }
});

describe("the W3C's test vectors: the whole check, as the service makes it", () => {
  const whole = async (name, rpId = W3C.rpId) => {
    const { registration, authentication } = example(name);
    const made = await verdict(() => checkRegistration({ attestationObject: registration.attestationObject, credentialId: registration.credentialId, rpId }));
    const { jwk, data } = credentialOf(registration);
    const used = await verdict(() => checkAssertion({ ...authentication, rpId, jwk, syncs: data.eligible }));
    return { made, used };
  };

  it("accepts the registration and the sign-in of the one example whose user was verified both times", async () => {
    // Its client data says it was made in another site's frame, which the service refuses at an
    // earlier step (below); what the authenticator made is sound, and is what is checked here.
    expect(await whole("none-es256-crossOrigin")).toEqual({ made: "accepted", used: "accepted" });
    const { registration } = example("none-es256-crossOrigin");
    const kept = await checkRegistration({ attestationObject: registration.attestationObject, credentialId: registration.credentialId, rpId: W3C.rpId });
    expect(kept).toEqual({ jwk: { kty: "EC", crv: "P-256", x: expect.any(String), y: expect.any(String) }, count: 0, syncs: false });
  });

  it("accepts a registration with a packed attestation statement, which it does not read, and an RS256 key", async () => {
    expect((await whole("packed-self-es256")).made).toBe("accepted");
    expect((await whole("packed-rs256")).made).toBe("accepted");
    const { registration } = example("packed-rs256");
    const kept = await checkRegistration({ attestationObject: registration.attestationObject, credentialId: registration.credentialId, rpId: W3C.rpId });
    expect(kept).toMatchObject({ jwk: { kty: "RSA", e: "AQAB" }, syncs: true });
  });

  it("refuses each example whose user was not verified, for that and nothing else", async () => {
    expect((await whole("none-es256")).made).toBe("verification");
    for (const name of ["none-es256", "packed-self-es256", "packed-rs256"]) expect((await whole(name)).used, name).toBe("verification");
  });

  it("refuses every example for another relying party", async () => {
    for (const name of ["none-es256-crossOrigin", "packed-self-es256", "packed-rs256"]) {
      expect(await whole(name, "example.com"), name).toEqual({ made: "rp", used: "rp" });
    }
  });

  it("refuses a registration whose response names another credential's id", async () => {
    const { registration } = example("none-es256-crossOrigin");
    const other = example("packed-self-es256").registration.credentialId;
    expect(await verdict(() => checkRegistration({ attestationObject: registration.attestationObject, credentialId: other, rpId: W3C.rpId }))).toBe("credential");
  });

  it("refuses the example made in another site's frame when it reads its client data", () => {
    const { registration, authentication } = example("none-es256-crossOrigin");
    expect(() => readClientData(registration.clientDataJSON, "webauthn.create")).toThrow(PasskeyRefused);
    try {
      readClientData(authentication.clientDataJSON, "webauthn.get");
    } catch (error) {
      expect(error.reason).toBe("cross_origin");
    }
  });

  it("reads the client data of the others, with members a later version of the standard added", () => {
    const { registration, authentication } = example("none-es256");
    expect(readClientData(registration.clientDataJSON, "webauthn.create")).toEqual({ challenge: b64(registration.challenge), origin: W3C.origin });
    expect(readClientData(authentication.clientDataJSON, "webauthn.get")).toEqual({ challenge: b64(authentication.challenge), origin: W3C.origin });
  });

  it("refuses the examples' keys of kinds the service does not take: ES384 and Ed25519", () => {
    for (const name of ["packed-es384", "packed-eddsa"]) {
      const attestation = decodeCborWhole(example(name).registration.attestationObject);
      const data = readAuthenticatorData(attestation.get("authData"));
      expect(() => jwkFromCose(data.credential.key), name).toThrow(PasskeyRefused);
      try {
        jwkFromCose(data.credential.key);
      } catch (error) {
        expect(error.reason, name).toBe("algorithm");
      }
    }
  });
});

describe("the CBOR decoder", () => {
  const bytes = (...values) => Uint8Array.from(values);
  const refusal = (input) => {
    try {
      decodeCborWhole(input);
      return null;
    } catch (error) {
      return error instanceof CborError ? error.message : `not a CborError: ${error}`;
    }
  };

  it("reads back everything the test encoder writes", () => {
    const value = new Map([
      ["fmt", "none"],
      ["attStmt", new Map()],
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, new Uint8Array(32).fill(7)],
      ["list", [0, 23, 24, 255, 256, 65535, 65536, -1, -24, -25, -257, true, false, null, "é"]],
    ]);
    const read = decodeCborWhole(cbor(value));
    expect([...read.keys()]).toEqual([...value.keys()]);
    expect(read.get("list")).toEqual(value.get("list"));
    expect([...read.get(-2)]).toEqual([...value.get(-2)]);
    expect(read.get("attStmt")).toBeInstanceOf(Map);
  });

  it("reads numbers of one, two, four, and eight bytes", () => {
    expect(decodeCborWhole(bytes(0x18, 0xff))).toBe(255);
    expect(decodeCborWhole(bytes(0x19, 0x01, 0x00))).toBe(256);
    expect(decodeCborWhole(bytes(0x1a, 0x00, 0x01, 0x00, 0x00))).toBe(65536);
    expect(decodeCborWhole(bytes(0x1b, 0, 0, 0, 1, 0, 0, 0, 0))).toBe(4294967296);
    expect(decodeCborWhole(bytes(0x39, 0x01, 0x00))).toBe(-257);
  });

  it("says where an item ends, so that what follows it can be read", () => {
    const two = concat(cbor(new Map([[1, 2]])), cbor(new Map([["a", "b"]])));
    const first = decodeCbor(two);
    expect(first.end).toBe(3);
    expect(decodeCbor(two, first.end).value.get("a")).toBe("b");
  });

  const REFUSED = {
    "nothing at all": bytes(),
    "a float": bytes(0xfa, 0x3f, 0x80, 0x00, 0x00),
    "a double": bytes(0xfb, 0, 0, 0, 0, 0, 0, 0, 0),
    "undefined": bytes(0xf7),
    "a simple value": bytes(0xf0),
    "a tag": bytes(0xc0, 0x00),
    "a byte string with no end (an indefinite length)": bytes(0x5f, 0x41, 0x00, 0xff),
    "an array with no end": bytes(0x9f, 0x01, 0xff),
    "a map with no end": bytes(0xbf, 0x01, 0x02, 0xff),
    "a reserved length": bytes(0x1c),
    "a number past what a script can hold": bytes(0x1b, 0x00, 0x20, 0, 0, 0, 0, 0, 0x01),
    "a byte string longer than what is left": bytes(0x45, 1, 2, 3),
    "text longer than what is left": bytes(0x65, 0x61, 0x62),
    "a length cut off": bytes(0x19, 0x01),
    "an array that claims more items than there are bytes": bytes(0x9a, 0xff, 0xff, 0xff, 0xff, 0x01),
    "a map that claims more pairs than there are bytes": bytes(0xba, 0x7f, 0xff, 0xff, 0xff, 0x01, 0x02),
    "an array cut off": bytes(0x83, 0x01, 0x02),
    "a map with a key and no value": bytes(0xa1, 0x01),
    "a map with the same key twice": bytes(0xa2, 0x01, 0x02, 0x01, 0x03),
    "a map with the same text key twice": concat(bytes(0xa2), cbor("a"), cbor(1), cbor("a"), cbor(2)),
    "a map whose key is a byte string": bytes(0xa1, 0x41, 0x00, 0x01),
    "a map whose key is an array": bytes(0xa1, 0x80, 0x01),
    "text that is not UTF-8": bytes(0x62, 0xc3, 0x28),
    "bytes after the item": bytes(0x01, 0x02),
    "arrays nested nine deep": bytes(0x81, 0x81, 0x81, 0x81, 0x81, 0x81, 0x81, 0x81, 0x81, 0x01),
  };
  for (const [name, input] of Object.entries(REFUSED)) {
    it(`refuses ${name}`, () => {
      expect(refusal(input)).toEqual(expect.any(String));
      expect(refusal(input)).not.toMatch(/^not a CborError/);
    });
  }

  it("reads arrays nested eight deep, which is as deep as it goes", () => {
    expect(refusal(bytes(0x81, 0x81, 0x81, 0x81, 0x81, 0x81, 0x81, 0x81, 0x01))).toBeNull();
  });
});

describe("an ECDSA signature in ASN.1", () => {
  const r = new Uint8Array(32).fill(0x11);
  const s = new Uint8Array(32).fill(0x22);
  const raw = concat(r, s);

  it("is read as r and s, 32 bytes each", () => {
    expect([...ecdsaSignatureFromDer(derSignature(raw))]).toEqual([...raw]);
  });

  it("is read when r or s has its high bit set, and so a zero byte before it", () => {
    const high = concat(new Uint8Array(32).fill(0xee), new Uint8Array(32).fill(0xff));
    const der = derSignature(high);
    expect(der.length).toBe(72);
    expect([...ecdsaSignatureFromDer(der)]).toEqual([...high]);
  });

  it("is read when r or s is short, and padded back to 32 bytes", () => {
    const short = concat(new Uint8Array(31), Uint8Array.of(5), new Uint8Array(30), Uint8Array.of(1, 2));
    const der = derSignature(short);
    expect(der.length).toBe(2 + 3 + 4);
    expect([...ecdsaSignatureFromDer(der)]).toEqual([...short]);
  });

  const good = derSignature(raw);
  const BAD = {
    "nothing": new Uint8Array(0),
    "r and s end to end, as WebCrypto writes them": raw,
    "a sequence under another tag": Uint8Array.from(good, (b, i) => (i === 0 ? 0x31 : b)),
    "a length that is one too many": Uint8Array.from(good, (b, i) => (i === 1 ? b + 1 : b)),
    "a length that is one too few": Uint8Array.from(good, (b, i) => (i === 1 ? b - 1 : b)),
    "a byte after s": concat(good, Uint8Array.of(0)),
    "its last byte missing": good.subarray(0, good.length - 1),
    "r under another tag": Uint8Array.from(good, (b, i) => (i === 2 ? 0x04 : b)),
    "s under another tag": Uint8Array.from(good, (b, i) => (i === 36 ? 0x04 : b)),
    "an r of no bytes": concat(Uint8Array.of(0x30, 2 + 34), Uint8Array.of(0x02, 0x00), Uint8Array.of(0x02, 32), s),
    "a negative r": concat(Uint8Array.of(0x30, 68), Uint8Array.of(0x02, 32), new Uint8Array(32).fill(0x80), Uint8Array.of(0x02, 32), s),
    "an r of 33 bytes that matter": concat(Uint8Array.of(0x30, 69), Uint8Array.of(0x02, 33), new Uint8Array(33).fill(0x01), Uint8Array.of(0x02, 32), s),
    "one integer and no second": concat(Uint8Array.of(0x30, 34), Uint8Array.of(0x02, 32), r),
    "three integers": concat(Uint8Array.of(0x30, 9), Uint8Array.of(0x02, 1, 1, 0x02, 1, 1, 0x02, 1, 1)),
    "a length in the long form": concat(Uint8Array.of(0x30, 0x81, 68), Uint8Array.of(0x02, 32), r, Uint8Array.of(0x02, 32), s),
    "an r whose length runs past the end": concat(Uint8Array.of(0x30, 6), Uint8Array.of(0x02, 0x7f, 1, 0x02, 1, 1)),
  };
  for (const [name, der] of Object.entries(BAD)) {
    it(`is refused when it is ${name}`, () => {
      expect(ecdsaSignatureFromDer(der)).toBeNull();
    });
  }
});

describe("authenticator data", () => {
  const reason = (bytes) => {
    try {
      readAuthenticatorData(bytes);
      return "accepted";
    } catch (error) {
      return error instanceof PasskeyRefused ? error.reason : `threw ${error}`;
    }
  };
  const base = (flags) => concat(new Uint8Array(32).fill(9), Uint8Array.of(flags), Uint8Array.of(0, 0, 1, 2));
  const key = cbor(new Map([[1, 2], [3, -7]]));
  const attested = (idLength, id = new Uint8Array(idLength).fill(3)) => concat(new Uint8Array(16), Uint8Array.of(idLength >> 8, idLength & 0xff), id);

  it("is read: 37 bytes of RP, flags, and counter", () => {
    const data = readAuthenticatorData(base(0x05));
    expect(data).toMatchObject({ present: true, verified: true, eligible: false, backedUp: false, count: 258, credential: null });
  });

  it("reads a counter with its high bit set as a positive number", () => {
    const data = readAuthenticatorData(concat(new Uint8Array(32), Uint8Array.of(0x01), Uint8Array.of(0xff, 0xff, 0xff, 0xff)));
    expect(data.count).toBe(4294967295);
  });

  it("reads a credential id of 1 byte and of 1,023", () => {
    for (const length of [1, 1023]) {
      const data = readAuthenticatorData(concat(base(0x45), attested(length), key));
      expect(data.credential.id.length).toBe(length);
    }
  });

  const BAD = {
    "36 bytes": base(0x05).subarray(0, 36),
    "a byte after the counter that no flag announces": concat(base(0x05), Uint8Array.of(0)),
    "attested data announced and missing": base(0x45),
    "attested data cut off inside the AAGUID": concat(base(0x45), new Uint8Array(10)),
    "a credential id of no bytes": concat(base(0x45), attested(0), key),
    "a credential id of 1,024 bytes": concat(base(0x45), attested(1024), key),
    "a credential id shorter than its length says": concat(base(0x45), attested(40, new Uint8Array(8))),
    "no public key after the credential id": concat(base(0x45), attested(16)),
    "a public key that is not a map": concat(base(0x45), attested(16), cbor("a key")),
    "a public key that is not CBOR": concat(base(0x45), attested(16), Uint8Array.of(0xff)),
    "bytes after the public key that no flag announces": concat(base(0x45), attested(16), key, Uint8Array.of(0xa0)),
    "extension data announced and missing": base(0x85),
    "extension data that is not a map": concat(base(0x85), cbor([1])),
    "bytes after the extension data": concat(base(0x85), cbor(new Map()), Uint8Array.of(0)),
  };
  for (const [name, bytes] of Object.entries(BAD)) {
    it(`is refused with ${name}`, () => {
      expect(reason(bytes)).toBe("authenticator_data");
    });
  }

  it("is read with extension data after the counter, and after a public key", () => {
    expect(reason(concat(base(0x85), cbor(new Map([["credProtect", 2]]))))).toBe("accepted");
    expect(reason(concat(base(0xc5), attested(16), key, cbor(new Map([["credProtect", 2]]))))).toBe("accepted");
  });
});

describe("client data", () => {
  const text = (value) => new TextEncoder().encode(typeof value === "string" ? value : JSON.stringify(value));
  const reason = (value, type = "webauthn.get") => {
    try {
      readClientData(text(value), type);
      return "accepted";
    } catch (error) {
      return error instanceof PasskeyRefused ? error.reason : `threw ${error}`;
    }
  };
  const good = { type: "webauthn.get", challenge: "abc", origin: "https://litbible.net", crossOrigin: false };

  it("is read for its challenge and origin, whatever else it holds", () => {
    expect(readClientData(text({ ...good, topOrigin: "https://x.example", other: [1, 2] }), "webauthn.get")).toEqual({ challenge: "abc", origin: "https://litbible.net" });
    // An Android app's client data names no crossOrigin at all.
    expect(reason({ type: "webauthn.get", challenge: "abc", origin: "android:apk-key-hash:x", androidPackageName: "com.example" })).toBe("accepted");
  });

  const BAD = [
    ["not JSON", "{", "client_data"],
    ["JSON that is a list", [good], "client_data"],
    ["JSON that is null", "null", "client_data"],
    ["JSON that is a string", '"webauthn.get"', "client_data"],
    ["bytes that are not UTF-8", null, "client_data"],
    ["no challenge", { ...good, challenge: undefined }, "client_data"],
    ["a challenge that is a number", { ...good, challenge: 5 }, "client_data"],
    ["no origin", { ...good, origin: undefined }, "client_data"],
    ["an origin that is a list", { ...good, origin: ["https://litbible.net"] }, "client_data"],
    ["the other ceremony's type", { ...good, type: "webauthn.create" }, "type"],
    ["no type", { ...good, type: undefined }, "type"],
    ["a type in another case", { ...good, type: "WebAuthn.Get" }, "type"],
    ["crossOrigin true", { ...good, crossOrigin: true }, "cross_origin"],
  ];
  for (const [name, value, expected] of BAD) {
    it(`is refused with ${name}`, () => {
      if (value === null) {
        expect(() => readClientData(Uint8Array.of(0x7b, 0xc3, 0x28, 0x7d), "webauthn.get")).toThrow(PasskeyRefused);
        return;
      }
      expect(reason(value)).toBe(expected);
    });
  }

  it("does not take a crossOrigin that is merely truthy as true, nor refuse one that is false or missing", () => {
    for (const crossOrigin of [false, undefined, null, 0]) expect(reason({ ...good, crossOrigin })).toBe("accepted");
  });
});
