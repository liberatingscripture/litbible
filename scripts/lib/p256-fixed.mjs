// scripts/lib/p256-fixed.mjs
//
// P-256 arithmetic with every input fixed, for the notebook's crypto vectors
// (scripts/build-notebook-crypto-vectors.mjs) and their test. It does the two
// things WebCrypto can't: derive a public key from a private scalar, and sign
// with a chosen ECDSA number, so a signature in the vectors file is the same
// bytes on every run.
//
// FOR TEST VECTORS ONLY. It is plain BigInt arithmetic, not constant time,
// and a signing number that is known or repeated gives the private key away.
// Nothing the site ships imports it; src/lib/desk-crypto.mjs is the code that
// runs for a reader, and it leaves all of this to the platform.

export const P = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn;
export const N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;
export const B = 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604bn;
export const G = Object.freeze([
  0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296n,
  0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5n,
]);

const mod = (a, m) => ((a % m) + m) % m;

function inverse(a, m) {
  let [r0, r1] = [mod(a, m), m];
  let [s0, s1] = [1n, 0n];
  while (r1) {
    const q = r0 / r1;
    [r0, r1] = [r1, r0 - q * r1];
    [s0, s1] = [s1, s0 - q * s1];
  }
  if (r0 !== 1n) throw new Error("p256-fixed: no inverse");
  return mod(s0, m);
}

// Points are [x, y], or null for the point at infinity.
function add(a, b) {
  if (!a) return b;
  if (!b) return a;
  const [x1, y1] = a;
  const [x2, y2] = b;
  let slope;
  if (x1 === x2) {
    if (mod(y1 + y2, P) === 0n) return null;
    slope = mod((3n * x1 * x1 - 3n) * inverse(2n * y1, P), P);
  } else {
    slope = mod((y2 - y1) * inverse(x2 - x1, P), P);
  }
  const x3 = mod(slope * slope - x1 - x2, P);
  return [x3, mod(slope * (x1 - x3) - y1, P)];
}

export function multiply(k, point = G) {
  let result = null;
  let addend = point;
  for (let n = mod(k, N); n > 0n; n >>= 1n) {
    if (n & 1n) result = add(result, addend);
    addend = add(addend, addend);
  }
  return result;
}

export const toBig = (bytes) => BigInt("0x" + (Buffer.from(bytes).toString("hex") || "0"));
export const toBytes = (n, length = 32) => Uint8Array.from(Buffer.from(n.toString(16).padStart(2 * length, "0"), "hex"));

/** The 65-byte uncompressed form of a point: 04 ‖ x ‖ y. */
export const encodePoint = ([x, y]) => Uint8Array.from([4, ...toBytes(x), ...toBytes(y)]);

/** A private scalar's public key, as the 65-byte uncompressed point. */
export function publicFromScalar(d) {
  const k = toBig(d);
  if (k < 1n || k >= N) throw new Error("p256-fixed: not a private scalar");
  return encodePoint(multiply(k));
}

/** A square root modulo the field's size, or null when there is none. */
export function fieldSqrt(a) {
  let root = 1n;
  let base = mod(a, P);
  for (let e = (P + 1n) / 4n; e > 0n; e >>= 1n) {
    if (e & 1n) root = (root * base) % P;
    base = (base * base) % P;
  }
  return (root * root) % P === mod(a, P) ? root : null;
}

/** The curve's right-hand side at x: x³ − 3x + b. */
export const curveAt = (x) => mod(x * x * x - 3n * x + B, P);

/**
 * ECDSA over a 32-byte SHA-256 digest with the signing number `k` given:
 * the 64 bytes r ‖ s. Null when this `k` gives an r or an s of zero.
 */
export function signWithNumber(d, k, digest) {
  const kn = toBig(k);
  if (kn < 1n || kn >= N) return null;
  const r = mod(multiply(kn)[0], N);
  const s = mod(inverse(kn, N) * (toBig(digest) + r * toBig(d)), N);
  if (r === 0n || s === 0n) return null;
  return Uint8Array.from([...toBytes(r), ...toBytes(s)]);
}
