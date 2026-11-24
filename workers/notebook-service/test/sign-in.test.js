// Sign-in, as a reader lives it: an account made with a passkey, a notebook
// that the same passkey opens on a second device, a second way in, and
// Apple and Google. Each test is a whole flow, start to finish, through the
// requests a real client sends. The checks each request makes, one at a
// time, are in passkeys.test.js, providers.test.js, and ways.test.js.
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { call } from "./call.js";
import { ANDROID_ORIGINS, LOCAL_ORIGIN, ORIGIN, addPasskey, assert, attest, newPasskey, optionsFor, signInWithPasskey, signUpWithPasskey } from "./authenticator.js";
import { APPLE_CLIENT, APPLE_REVOKE, APPLE_TOKEN, APPLE_WEB_CLIENT, providersOn, readClientSecret, signInWith, standDown, standIns } from "./idp.js";
import { entryFor, joinRequest, makeHolder, must, newDevice, openThrough, proofHashOf, pull, push, ref, rowFor, note } from "./notebook.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** A first device sets up a notebook from a real session, with a passkey holder made from a real passkey. */
async function setUpWith(token, passkey, { recovery = false } = {}) {
  const device = await newDevice(null, { token });
  const held = ref.firstKeyring(ref.newId(), ref.randomBytes(32));
  const holders = [await makeHolder(held, "passkey", passkey)];
  if (recovery) holders.push(await makeHolder(held, "recovery"));
  await must("POST", "/notebook", {
    token,
    body: { notebook: held.notebook, proofHash: await proofHashOf(held), device: await entryFor(device, held), holders: holders.map((h) => h.wire) },
  });
  device.held = held;
  return { device, held, holders };
}

describe("an account made with a passkey", () => {
  it("is made, signed in, and listed, with nothing kept but the passkey's id, key, and flags", async () => {
    const made = await signUpWithPasskey();
    expect(made.token).toMatch(TOKEN);
    expect(made.created).toBe(true);
    expect(made.way).toEqual({ id: expect.stringMatching(UUID), kind: "passkey", added: expect.any(String), credential: made.passkey.id, syncs: true });

    const account = await must("GET", "/account", { token: made.token });
    expect(account).toMatchObject({ notebook: null, kid: 0, session: { open: false, device: null } });
    expect(account.ways).toEqual([made.way]);

    const stored = await env.DB.prepare("SELECT * FROM ways WHERE id = ?").bind(made.way.id).first();
    expect(JSON.parse(stored.public)).toEqual({ kty: "EC", crv: "P-256", x: made.passkey.jwk.x, y: made.passkey.jwk.y });
    expect(stored).toMatchObject({ kind: "passkey", subject: made.passkey.id, syncs: 1, count: 0 });
    // The PRF's secret is nowhere in the database.
    for (const table of ["accounts", "ways", "sessions", "challenges"]) {
      const { results } = await env.DB.prepare(`SELECT * FROM ${table}`).all();
      expect(JSON.stringify(results), table).not.toContain(ref.toBase64url(made.passkey.prf));
    }
  });

  it("opens its notebook on a second device with one passkey: sign in, open through the holder, join", async () => {
    const first = await signUpWithPasskey();
    const { device, held, holders } = await setUpWith(first.token, first.passkey);
    const row = await rowFor(held, note({ body: "In the beginning was the Word" }));
    await push(device, [row]);

    // A second device: the same passkey signs in, and its PRF opens the holder.
    const second = await signInWithPasskey(first.passkey);
    expect(second.created).toBe(false);
    expect(second.way).toEqual(first.way);
    expect(second.token).not.toBe(first.token);
    const before = await must("GET", "/account", { token: second.token });
    expect(before).toMatchObject({ notebook: held.notebook, kid: 1, session: { open: false } });
    // Signed in is not open: no rows yet.
    expect((await call("GET", "/rows", { token: second.token })).body.error).toBe("not_open");

    const phone = await openThrough(null, holders[0], { token: second.token, name: "Phone", platform: "ios" });
    await must("POST", "/devices", { token: phone.token, body: await joinRequest(phone, holders[0]) });
    const { records } = await pull(phone);
    expect(records.map((r) => r.body)).toEqual(["In the beginning was the Word"]);
    const lists = await must("GET", "/devices", { token: phone.token });
    expect(lists.devices.map((d) => d.how)).toEqual(["setup", "passkey"]);
  });

  it("signs in from the website, from the iOS app, and from the Android app's origins", async () => {
    const made = await signUpWithPasskey();
    for (const origin of [ORIGIN, ...ANDROID_ORIGINS]) {
      const again = await signInWithPasskey(made.passkey, { origin });
      expect(again.way.id, origin).toBe(made.way.id);
    }
  });

  it("can be made from an Android app's origin too", async () => {
    const made = await signUpWithPasskey({}, { origin: ANDROID_ORIGINS[1] });
    expect((await signInWithPasskey(made.passkey)).way.id).toBe(made.way.id);
  });

  it("works with an RS256 passkey that doesn't sync and keeps a counter (Windows Hello)", async () => {
    const made = await signUpWithPasskey({ alg: -257, syncs: false, counting: true });
    expect(made.way.syncs).toBe(false);
    for (let i = 1; i <= 3; i++) {
      await signInWithPasskey(made.passkey);
      const { count } = await env.DB.prepare("SELECT count FROM ways WHERE id = ?").bind(made.way.id).first();
      expect(count).toBe(i);
    }
  });

  it("gives a page on the developer's own machine the RP ID localhost, on the preview", async () => {
    const { publicKey } = await optionsFor("/sign-in/new-passkey/options", { origin: LOCAL_ORIGIN });
    expect(publicKey.rp.id).toBe("localhost");
    const made = await signUpWithPasskey({}, { origin: LOCAL_ORIGIN });
    const again = await signInWithPasskey(made.passkey, { origin: LOCAL_ORIGIN });
    expect(again.way.id).toBe(made.way.id);
    const asked = await optionsFor("/sign-in/passkey/options", { origin: LOCAL_ORIGIN });
    expect(asked.publicKey.rpId).toBe("localhost");
    // Everyone else is told litbible.net.
    expect((await optionsFor("/sign-in/passkey/options")).publicKey.rpId).toBe("litbible.net");
    expect((await optionsFor("/sign-in/passkey/options", { origin: ORIGIN })).publicKey.rpId).toBe("litbible.net");
  });
});

describe("the options the service gives", () => {
  it("asks a new passkey to be discoverable, user-verified, unattested, ES256 or RS256, under a fresh user handle", async () => {
    const asked = await must("POST", "/sign-in/new-passkey/options");
    expect(Object.keys(asked)).toEqual(["time", "publicKey", "expires"]);
    expect(asked.publicKey).toEqual({
      rp: { id: "litbible.net", name: "LIT Bible" },
      user: { id: expect.stringMatching(TOKEN), name: "LIT Bible notebook", displayName: "LIT Bible notebook" },
      challenge: expect.stringMatching(TOKEN),
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      timeout: 300000,
      excludeCredentials: [],
      authenticatorSelection: { residentKey: "required", requireResidentKey: true, userVerification: "required" },
      attestation: "none",
    });
    // Five minutes, less the moment between making the challenge and answering.
    const span = Date.parse(asked.expires) - Date.parse(asked.time);
    expect(span).toBeGreaterThan(299000);
    expect(span).toBeLessThanOrEqual(300000);
    const other = await must("POST", "/sign-in/new-passkey/options");
    expect(other.publicKey.user.id).not.toBe(asked.publicKey.user.id);
    expect(other.publicKey.challenge).not.toBe(asked.publicKey.challenge);
  });

  it("asks a sign-in for user verification and names no passkey, and never asks for a PRF itself", async () => {
    const asked = await must("POST", "/sign-in/passkey/options");
    expect(asked.publicKey).toEqual({ challenge: expect.stringMatching(TOKEN), rpId: "litbible.net", timeout: 300000, userVerification: "required" });
    // A client never takes a PRF input from the service, so the service offers none.
    for (const path of ["/sign-in/passkey/options", "/sign-in/new-passkey/options"]) {
      expect(JSON.stringify((await must("POST", path)).publicKey)).not.toMatch(/prf|extensions/);
    }
  });

  it("says which ways to sign in are on, to anyone", async () => {
    expect((await must("GET", "/sign-in")).ways).toEqual(["passkey"]);
    const { env: on } = await providersOn();
    expect((await must("GET", "/sign-in", { env: on })).ways).toEqual(["passkey", "apple", "google"]);
    expect((await must("GET", "/sign-in", { env: { PASSKEY_RP_ID: undefined } })).ways).toEqual([]);
  });
});

describe("several ways in to one account", () => {
  it("adds a passkey to an account made with Google, sets up with it, and signs in either way", async () => {
    const { env: on } = await providersOn();
    await standIns();
    try {
      const google = await signInWith("google", on);
      expect(google.created).toBe(true);
      expect(google.way).toEqual({ id: expect.stringMatching(UUID), kind: "google", added: expect.any(String) });

      const added = await addPasskey(google.token);
      expect(added.way).toMatchObject({ kind: "passkey", credential: added.passkey.id, syncs: true });
      expect(added.lists).toBe(1);
      const { held } = await setUpWith(google.token, added.passkey, { recovery: true });

      const byPasskey = await signInWithPasskey(added.passkey);
      const byGoogle = await signInWith("google", on, { token: { subject: google.subject } });
      expect(byGoogle.created).toBe(false);
      for (const token of [byPasskey.token, byGoogle.token]) {
        const account = await must("GET", "/account", { token });
        expect(account.notebook).toBe(held.notebook);
        expect(account.ways.map((w) => w.kind)).toEqual(["google", "passkey"]);
      }
      // No account id from Google is ever answered, and no email address or name is kept.
      const everything = JSON.stringify(await Promise.all(["accounts", "ways", "sessions"].map((t) => env.DB.prepare(`SELECT * FROM ${t}`).all())));
      expect(JSON.stringify(await must("GET", "/account", { token: byGoogle.token }))).not.toContain(google.subject);
      expect(everything).not.toContain("reader@example.com");
      expect(everything).not.toContain("A Reader");
    } finally {
      standDown();
    }
  });
});

describe("Sign in with Apple", () => {
  let world;
  let on;
  let team;
  beforeEach(async () => {
    ({ env: on, team } = await providersOn());
    world = await standIns();
  });
  afterEach(standDown);

  it("trades the code for Apple's refresh token on the first sign-in through a client, and never again", async () => {
    const first = await signInWith("apple", on, { code: "code-one" });
    expect(first.created).toBe(true);
    const exchanges = () => world.calls.filter((c) => c.url === APPLE_TOKEN);
    expect(exchanges()).toHaveLength(1);
    const { form } = exchanges()[0];
    expect(form).toMatchObject({ client_id: APPLE_CLIENT, code: "code-one", grant_type: "authorization_code" });
    expect(form.redirect_uri).toBeUndefined();
    // The token Apple asks of the service: signed by the team's key, for this client, for five minutes.
    const secret = await readClientSecret(form.client_secret, team.publicKey);
    expect(secret.good).toBe(true);
    expect(secret.header).toMatchObject({ alg: "ES256", kid: "TESTKEY001" });
    expect(secret.claims).toMatchObject({ iss: "TESTTEAM01", aud: "https://appleid.apple.com", sub: APPLE_CLIENT });
    expect(secret.claims.exp - secret.claims.iat).toBe(300);

    const kept = await env.DB.prepare("SELECT client, token FROM apple_tokens WHERE way = ?").bind(first.way.id).all();
    expect(kept.results).toEqual([{ client: APPLE_CLIENT, token: "refresh-for-code-one" }]);

    const again = await signInWith("apple", on, { token: { subject: first.subject }, code: "code-two" });
    expect(again.created).toBe(false);
    expect(again.way.id).toBe(first.way.id);
    expect(exchanges()).toHaveLength(1);

    // Through the website's client, the same Apple account is the same way in, with a token of its own.
    const web = await signInWith("apple", on, {
      token: { subject: first.subject, claims: { aud: APPLE_WEB_CLIENT } },
      code: "code-web",
      redirect: "https://litbible.net/account/apple/",
    });
    expect(web.way.id).toBe(first.way.id);
    expect(exchanges()).toHaveLength(2);
    expect(exchanges()[1].form).toMatchObject({ client_id: APPLE_WEB_CLIENT, code: "code-web", redirect_uri: "https://litbible.net/account/apple/" });
    const both = await env.DB.prepare("SELECT client FROM apple_tokens WHERE way = ? ORDER BY client").bind(first.way.id).all();
    expect(both.results.map((r) => r.client)).toEqual([APPLE_CLIENT, APPLE_WEB_CLIENT]);
  });

  it("revokes Apple's tokens when the way in is removed, and then the Apple account is nobody's", async () => {
    const apple = await signInWith("apple", on, { code: "code-one" });
    const added = await addPasskey(apple.token);
    const gone = await must("DELETE", `/ways/${apple.way.id}`, { token: apple.token, env: on });
    expect(gone.lists).toBe(added.lists + 1);
    const revokes = world.calls.filter((c) => c.url === APPLE_REVOKE);
    expect(revokes).toHaveLength(1);
    expect(revokes[0].form).toMatchObject({ client_id: APPLE_CLIENT, token: "refresh-for-code-one", token_type_hint: "refresh_token" });
    expect((await readClientSecret(revokes[0].form.client_secret, team.publicKey)).good).toBe(true);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM apple_tokens WHERE way = ?").bind(apple.way.id).first()).n).toBe(0);

    // The caller's own session stays; the account's one way in is now the passkey.
    expect((await must("GET", "/account", { token: apple.token })).ways.map((w) => w.kind)).toEqual(["passkey"]);
    // Signing in with that Apple account again starts a new, empty account.
    const anew = await signInWith("apple", on, { token: { subject: apple.subject }, code: "code-three" });
    expect(anew.created).toBe(true);
    expect(anew.way.id).not.toBe(apple.way.id);
  });
});

describe("signing out of a session", () => {
  it("ends that session and no other", async () => {
    const made = await signUpWithPasskey();
    const other = await signInWithPasskey(made.passkey);
    expect(await must("DELETE", "/session", { token: made.token })).toEqual({ time: expect.any(String) });
    expect((await call("GET", "/account", { token: made.token })).body.error).toBe("sign_in");
    expect((await call("GET", "/account", { token: other.token })).status).toBe(200);
  });
});

describe("the software passkey itself", () => {
  it("makes responses in the standard's JSON form", async () => {
    const passkey = await newPasskey();
    const { publicKey } = await must("POST", "/sign-in/new-passkey/options");
    const made = await attest(passkey, publicKey);
    expect(Object.keys(made)).toEqual(["id", "rawId", "type", "response", "authenticatorAttachment", "clientExtensionResults"]);
    const { publicKey: asked } = await must("POST", "/sign-in/passkey/options");
    const used = await assert(passkey, asked);
    expect(Object.keys(used.response)).toEqual(["clientDataJSON", "authenticatorData", "signature", "userHandle"]);
  });
});
