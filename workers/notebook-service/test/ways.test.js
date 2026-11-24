// "Ways to sign in": adding and removing a way in to an account, one check
// at a time. The rule under all of it: once an account has a notebook, a
// change to its ways in needs a session that has proved the notebook's key.
// (That each of these requests answers "sign_in" with no session, and
// "not_open" to a signed-in session once there is a notebook, is in
// sessions.test.js, which drives every route from one table.)
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LIMITS } from "../src/check.js";
import { call, freshAccount } from "./call.js";
import { ANDROID_ORIGINS, addPasskey, addPasskeyRequest, attest, newPasskey, optionsFor, signInWithPasskey, signUpWithPasskey } from "./authenticator.js";
import { APPLE_REVOKE, APPLE_TOKEN, freshSubject, providerRequest, providersOn, signInWith, standDown, standIns } from "./idp.js";
import { changeKey, makeHolder, must, ref, setUp, signIn } from "./notebook.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const b64 = ref.toBase64url;

const count = async (sql, ...binds) => (await env.DB.prepare(sql).bind(...binds).first()).n;
const waysOf = async (token) => (await must("GET", "/account", { token })).ways;
const listsOf = async (token) => (await must("GET", "/account", { token })).lists;
const refusal = (res) => [res.status, res.body.error, res.body.reason ?? res.body.rule ?? res.body.what ?? res.body.field];

/** Lists a made-up passkey with no ceremony (the preview's request). */
const listMadeUp = (token, credential = b64(ref.randomBytes(20)), syncs = true) =>
  must("POST", "/preview/passkeys", { token, body: { credential, syncs } });

describe("POST /ways/passkey/options", () => {
  it("answers what to ask a new passkey, under the account's own user handle", async () => {
    const made = await signUpWithPasskey();
    const asked = await must("POST", "/ways/passkey/options", { token: made.token });
    expect(Object.keys(asked)).toEqual(["time", "publicKey", "expires"]);
    expect(asked.publicKey).toMatchObject({
      rp: { id: "litbible.net", name: "LIT Bible" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { residentKey: "required", requireResidentKey: true, userVerification: "required" },
      attestation: "none",
      timeout: 300000,
    });
    // The handle the account's first passkey was made under.
    expect(asked.publicKey.user.id).toBe(made.passkey.handle);
    expect((await must("POST", "/ways/passkey/options", { token: made.token })).publicKey.user.id).toBe(made.passkey.handle);
  });

  it("names the account's passkeys to leave out, oldest first, and never a made-up one", async () => {
    const made = await signUpWithPasskey();
    const second = await addPasskey(made.token);
    await listMadeUp(made.token);
    const { publicKey } = await must("POST", "/ways/passkey/options", { token: made.token });
    expect(publicKey.excludeCredentials).toEqual([
      { type: "public-key", id: made.passkey.id },
      { type: "public-key", id: second.passkey.id },
    ]);
  });

  it("gives an account that has no passkey yet a user handle, once, and keeps it", async () => {
    const token = await signIn(freshAccount());
    const first = await must("POST", "/ways/passkey/options", { token });
    expect(first.publicKey.user.id).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.publicKey.excludeCredentials).toEqual([]);
    const again = await Promise.all([1, 2, 3].map(() => must("POST", "/ways/passkey/options", { token })));
    for (const asked of again) expect(asked.publicKey.user.id).toBe(first.publicKey.user.id);
  });

  it("makes a challenge that is this account's alone", async () => {
    const token = await signIn(freshAccount());
    const { publicKey } = await must("POST", "/ways/passkey/options", { token });
    const row = await env.DB.prepare("SELECT purpose, account, handle FROM challenges WHERE id = ?").bind(publicKey.challenge).first();
    expect(row.purpose).toBe("passkey_add");
    expect(row.account).toMatch(UUID);
    expect(row.handle).toBeNull();
  });

  it("names the RP ID localhost to a page on the developer's own machine", async () => {
    const token = await signIn(freshAccount());
    expect((await optionsFor("/ways/passkey/options", { token, origin: "http://localhost:4321" })).publicKey.rp.id).toBe("localhost");
  });
});

describe("POST /ways/passkey", () => {
  it("adds the passkey, answers the way and the lists' new version, and lists it in /account", async () => {
    const made = await signUpWithPasskey();
    const before = await listsOf(made.token);
    const { passkey, body } = await addPasskeyRequest(made.token);
    const res = await call("POST", "/ways/passkey", { token: made.token, body });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["time", "way", "lists"]);
    expect(res.body.way).toEqual({ id: expect.stringMatching(UUID), kind: "passkey", added: expect.any(String), credential: passkey.id, syncs: true });
    expect(res.body.lists).toBe(before + 1);
    expect(await listsOf(made.token)).toBe(before + 1);
    expect(await waysOf(made.token)).toEqual([made.way, res.body.way]);
    // And it signs in to the same account.
    expect((await signInWithPasskey(passkey)).way.id).toBe(res.body.way.id);
  });

  it("adds one made from the Android app, and one that does not sync", async () => {
    const made = await signUpWithPasskey();
    expect((await addPasskey(made.token, {}, { origin: ANDROID_ORIGINS[0] })).way.syncs).toBe(true);
    expect((await addPasskey(made.token, { alg: -257, syncs: false })).way.syncs).toBe(false);
  });

  it("refuses a challenge made for another account, and spends it", async () => {
    const mine = await signUpWithPasskey();
    const theirs = await signUpWithPasskey();
    const { publicKey } = await must("POST", "/ways/passkey/options", { token: theirs.token });
    const passkey = await newPasskey();
    const credential = await attest(passkey, publicKey);
    const res = await call("POST", "/ways/passkey", { token: mine.token, body: { credential } });
    expect(refusal(res)).toEqual([410, "gone", "challenge"]);
    // Its own account can't use it either now.
    expect(refusal(await call("POST", "/ways/passkey", { token: theirs.token, body: { credential } }))).toEqual([410, "gone", "challenge"]);
    expect(await waysOf(mine.token)).toHaveLength(1);
    expect(await waysOf(theirs.token)).toHaveLength(1);
  });

  it("refuses a challenge made for signing in or for a new account", async () => {
    const made = await signUpWithPasskey();
    for (const path of ["/sign-in/new-passkey/options", "/sign-in/passkey/options"]) {
      const asked = await must("POST", path);
      const forNew = await must("POST", "/sign-in/new-passkey/options");
      const credential = await attest(await newPasskey(), { ...forNew.publicKey, challenge: asked.publicKey.challenge });
      expect(refusal(await call("POST", "/ways/passkey", { token: made.token, body: { credential } })), path).toEqual([410, "gone", "challenge"]);
    }
    expect(await waysOf(made.token)).toHaveLength(1);
  });

  it("refuses the same answer sent twice", async () => {
    const made = await signUpWithPasskey();
    const { body } = await addPasskeyRequest(made.token);
    expect((await call("POST", "/ways/passkey", { token: made.token, body })).status).toBe(200);
    expect(refusal(await call("POST", "/ways/passkey", { token: made.token, body }))).toEqual([410, "gone", "challenge"]);
    expect(await waysOf(made.token)).toHaveLength(2);
  });

  it("refuses a passkey the account already has, with exists", async () => {
    const made = await signUpWithPasskey();
    const { publicKey } = await must("POST", "/ways/passkey/options", { token: made.token });
    const res = await call("POST", "/ways/passkey", { token: made.token, body: { credential: await attest(made.passkey, publicKey) } });
    expect(refusal(res)).toEqual([409, "exists", "passkey"]);
    expect(await waysOf(made.token)).toHaveLength(1);
  });

  it("refuses a passkey that signs in to another account, with exists", async () => {
    const mine = await signUpWithPasskey();
    const theirs = await signUpWithPasskey();
    const { publicKey } = await must("POST", "/ways/passkey/options", { token: mine.token });
    // A copy, since making a credential writes the new user handle into the authenticator.
    const res = await call("POST", "/ways/passkey", { token: mine.token, body: { credential: await attest({ ...theirs.passkey }, publicKey) } });
    expect(refusal(res)).toEqual([409, "exists", "passkey"]);
    expect(await waysOf(mine.token)).toHaveLength(1);
    // Theirs still signs in to theirs.
    expect((await signInWithPasskey(theirs.passkey)).way.id).toBe(theirs.way.id);
  });

  it("refuses a passkey whose id the account already lists as a made-up one, and takes one another account made up", async () => {
    const token = await signIn(freshAccount());
    const passkey = await newPasskey();
    await listMadeUp(token, passkey.id);
    const { publicKey } = await must("POST", "/ways/passkey/options", { token });
    expect(refusal(await call("POST", "/ways/passkey", { token, body: { credential: await attest(passkey, publicKey) } }))).toEqual([409, "exists", "passkey"]);

    const other = await signIn(freshAccount());
    const asked = await must("POST", "/ways/passkey/options", { token: other });
    expect((await call("POST", "/ways/passkey", { token: other, body: { credential: await attest(passkey, asked.publicKey) } })).status).toBe(200);
  });

  it("refuses a response that still carries a PRF result, and leaves the challenge to be answered properly", async () => {
    const made = await signUpWithPasskey();
    const { publicKey } = await must("POST", "/ways/passkey/options", { token: made.token });
    const passkey = await newPasskey();
    const leaking = await attest(passkey, publicKey, { clientExtensionResults: { prf: { enabled: true, results: { first: b64(passkey.prf) } } } });
    expect(refusal(await call("POST", "/ways/passkey", { token: made.token, body: { credential: leaking } }))).toEqual([422, "not_allowed", "prf_results"]);
    expect((await call("POST", "/ways/passkey", { token: made.token, body: { credential: await attest(passkey, publicKey) } })).status).toBe(200);
  });

  it("makes the checks a sign-in makes: an origin it does not accept is passkey_refused", async () => {
    const made = await signUpWithPasskey();
    const { body } = await addPasskeyRequest(made.token, {}, { origin: "https://evil.example" });
    expect(refusal(await call("POST", "/ways/passkey", { token: made.token, body }))).toEqual([403, "passkey_refused", "origin"]);
    expect(await waysOf(made.token)).toHaveLength(1);
  });

  it("refuses a malformed request before it uses the challenge", async () => {
    const made = await signUpWithPasskey();
    const { body } = await addPasskeyRequest(made.token);
    const res = await call("POST", "/ways/passkey", { token: made.token, body: { credential: { ...body.credential, type: "password" } } });
    expect(refusal(res)).toEqual([400, "bad_request", "credential.type"]);
    expect((await call("POST", "/ways/passkey", { token: made.token, body })).status).toBe(200);
  });

  it(`refuses a way in past ${LIMITS.ways}, with too_many`, async () => {
    const token = await signIn(freshAccount());
    for (let i = 1; i < LIMITS.ways; i++) await listMadeUp(token);
    expect(await waysOf(token)).toHaveLength(LIMITS.ways);
    const { body } = await addPasskeyRequest(token);
    const res = await call("POST", "/ways/passkey", { token, body });
    expect([res.status, res.body.error, res.body.what, res.body.limit]).toEqual([429, "too_many", "ways", LIMITS.ways]);
    expect(await waysOf(token)).toHaveLength(LIMITS.ways);
  });

  it("needs an open session once the account has a notebook, and takes one", async () => {
    const { account, device } = await setUp();
    const closed = await signIn(account);
    // A signed-in session can't even ask for the options.
    expect(refusal(await call("POST", "/ways/passkey/options", { token: closed }))).toEqual([403, "not_open", undefined]);
    // Nor answer options an open session asked for.
    const { body } = await addPasskeyRequest(device.token);
    const res = await call("POST", "/ways/passkey", { token: closed, body });
    expect([res.status, res.body.error, res.body.kid]).toEqual([403, "not_open", 1]);
    expect(await waysOf(device.token)).toHaveLength(1);
    // The challenge was not spent on the refusal: the session was checked before the body was read.
    expect((await call("POST", "/ways/passkey", { token: device.token, body })).status).toBe(200);
  });

  it("lets the new passkey hold the key if it syncs, and not if it doesn't", async () => {
    const { device, held } = await setUp();
    const synced = await addPasskey(device.token);
    const local = await addPasskey(device.token, { syncs: false });
    const lists = await listsOf(device.token);

    const refused = await call("POST", "/holders", { token: device.token, body: { lists, kid: 1, holder: (await makeHolder(held, "passkey", local.passkey)).wire } });
    expect(refusal(refused)).toEqual([422, "not_allowed", "passkey_not_synced"]);
    const holder = await makeHolder(held, "passkey", synced.passkey);
    expect((await must("POST", "/holders", { token: device.token, body: { lists, kid: 1, holder: holder.wire } })).lists).toBe(lists + 1);
  });
});

describe("POST /ways/google and POST /ways/apple", () => {
  let world;
  let on;
  beforeEach(async () => {
    ({ env: on } = await providersOn());
    world = await standIns();
  });
  afterEach(standDown);

  for (const provider of ["google", "apple"]) {
    describe(provider, () => {
      it("adds the provider account as a way in, and it then signs in to this account", async () => {
        const made = await signUpWithPasskey();
        const subject = freshSubject();
        const before = await listsOf(made.token);
        const res = await call("POST", `/ways/${provider}`, { token: made.token, env: on, body: await providerRequest(provider, on, { token: { subject } }) });
        expect(res.status).toBe(200);
        expect(Object.keys(res.body)).toEqual(["time", "way", "lists"]);
        expect(res.body.way).toEqual({ id: expect.stringMatching(UUID), kind: provider, added: expect.any(String) });
        expect(res.body.lists).toBe(before + 1);
        expect((await waysOf(made.token)).map((w) => w.kind)).toEqual(["passkey", provider]);

        const again = await signInWith(provider, on, { token: { subject } });
        expect(again.created).toBe(false);
        expect(again.way.id).toBe(res.body.way.id);
        expect(await waysOf(again.token)).toHaveLength(2);
      });

      it("refuses a provider account that already signs in to this account, or to another, with exists", async () => {
        const mine = await signInWith(provider, on);
        const theirs = await signInWith(provider, on);
        const exchanges = world.calls.filter((c) => c.url === APPLE_TOKEN).length;
        for (const subject of [mine.subject, theirs.subject]) {
          const res = await call("POST", `/ways/${provider}`, { token: mine.token, env: on, body: await providerRequest(provider, on, { token: { subject } }) });
          expect(refusal(res), subject).toEqual([409, "exists", "way"]);
        }
        expect(await waysOf(mine.token)).toHaveLength(1);
        // Apple was not asked to trade a code for a way in that could not be added.
        expect(world.calls.filter((c) => c.url === APPLE_TOKEN)).toHaveLength(exchanges);
      });

      it("makes the checks a sign-in makes: a token for another audience is token_refused, and a used challenge is gone", async () => {
        const made = await signUpWithPasskey();
        const wrong = await providerRequest(provider, on, { token: { claims: { aud: "someone-else.example" } } });
        expect(refusal(await call("POST", `/ways/${provider}`, { token: made.token, env: on, body: wrong }))).toEqual([403, "token_refused", "audience"]);
        const body = await providerRequest(provider, on);
        expect((await call("POST", `/ways/${provider}`, { token: made.token, env: on, body })).status).toBe(200);
        expect(refusal(await call("POST", `/ways/${provider}`, { token: made.token, env: on, body }))).toEqual([410, "gone", "challenge"]);
        expect(await waysOf(made.token)).toHaveLength(2);
      });

      it(`refuses a way in past ${LIMITS.ways}, with too_many`, async () => {
        const token = await signIn(freshAccount());
        for (let i = 1; i < LIMITS.ways; i++) await listMadeUp(token);
        const res = await call("POST", `/ways/${provider}`, { token, env: on, body: await providerRequest(provider, on) });
        expect([res.status, res.body.error, res.body.what]).toEqual([429, "too_many", "ways"]);
        expect(world.calls.filter((c) => c.url === APPLE_TOKEN)).toHaveLength(0);
      });

      it("needs an open session once the account has a notebook, and takes one", async () => {
        const { account, device } = await setUp();
        const closed = await signIn(account);
        const body = await providerRequest(provider, on);
        expect(refusal(await call("POST", `/ways/${provider}`, { token: closed, env: on, body }))).toEqual([403, "not_open", undefined]);
        expect((await call("POST", `/ways/${provider}`, { token: device.token, env: on, body })).status).toBe(200);
        expect((await waysOf(device.token)).map((w) => w.kind)).toEqual(["preview", provider]);
      });
    });
  }

  it("for Apple, trades the code for the refresh token and keeps it with the way", async () => {
    const made = await signUpWithPasskey();
    const res = await must("POST", "/ways/apple", { token: made.token, env: on, body: await providerRequest("apple", on, { code: "code-added" }) });
    const kept = await env.DB.prepare("SELECT client, token FROM apple_tokens WHERE way = ?").bind(res.way.id).all();
    expect(kept.results).toEqual([{ client: "test.example.app", token: "refresh-for-code-added" }]);
  });

  it("for Apple, adds nothing when the code can't be traded", async () => {
    const made = await signUpWithPasskey();
    const before = await listsOf(made.token);
    world.answers.token = () => [400, { error: "invalid_grant" }];
    expect(refusal(await call("POST", "/ways/apple", { token: made.token, env: on, body: await providerRequest("apple", on) }))).toEqual([403, "token_refused", "code"]);
    world.answers.token = () => [500, null];
    const down = await call("POST", "/ways/apple", { token: made.token, env: on, body: await providerRequest("apple", on) });
    expect([down.status, down.body.error, down.body.which]).toEqual([502, "provider", "apple"]);
    expect(await waysOf(made.token)).toHaveLength(1);
    expect(await listsOf(made.token)).toBe(before);
    expect(await count("SELECT COUNT(*) AS n FROM apple_tokens t JOIN ways w ON w.id = t.way WHERE w.account = (SELECT account FROM ways WHERE id = ?)", made.way.id)).toBe(0);
  });
});

describe("DELETE /ways/<id>", () => {
  it("removes a way in, answers the lists' new version, and that way no longer signs in", async () => {
    const made = await signUpWithPasskey();
    const second = await addPasskey(made.token);
    const res = await call("DELETE", `/ways/${second.way.id}`, { token: made.token });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["time", "lists"]);
    expect(res.body.lists).toBe(second.lists + 1);
    expect(await waysOf(made.token)).toEqual([made.way]);
    const { publicKey } = await must("POST", "/sign-in/passkey/options");
    const { assert } = await import("./authenticator.js");
    const gone = await call("POST", "/sign-in/passkey", { body: { credential: await assert(second.passkey, publicKey) } });
    expect(refusal(gone)).toEqual([403, "passkey_refused", "unknown"]);
  });

  it("refuses to remove the last way that can sign the reader in", async () => {
    const made = await signUpWithPasskey();
    const res = await call("DELETE", `/ways/${made.way.id}`, { token: made.token });
    expect(refusal(res)).toEqual([422, "not_allowed", "last_way"]);
    expect(await waysOf(made.token)).toHaveLength(1);
    expect((await signInWithPasskey(made.passkey)).way.id).toBe(made.way.id);
  });

  it("does not count a made-up passkey as a way that can sign in, and lets one be removed", async () => {
    const made = await signUpWithPasskey();
    const madeUp = await listMadeUp(made.token);
    // The real passkey is still the last way that can sign in.
    expect(refusal(await call("DELETE", `/ways/${made.way.id}`, { token: made.token }))).toEqual([422, "not_allowed", "last_way"]);
    expect((await call("DELETE", `/ways/${madeUp.id}`, { token: made.token })).status).toBe(200);
    expect(await waysOf(made.token)).toEqual([made.way]);
  });

  it("lets either of two ways go, and then refuses the one that is left", async () => {
    const made = await signUpWithPasskey();
    const second = await addPasskey(made.token);
    expect((await call("DELETE", `/ways/${made.way.id}`, { token: made.token })).status).toBe(200);
    expect(refusal(await call("DELETE", `/ways/${second.way.id}`, { token: made.token }))).toEqual([422, "not_allowed", "last_way"]);
  });

  it("refuses to remove a passkey that holds the notebook's key, until a change of key removes its holder", async () => {
    const { device, held } = await setUp();
    const added = await addPasskey(device.token);
    const holder = await makeHolder(held, "passkey", added.passkey);
    await must("POST", "/holders", { token: device.token, body: { lists: added.lists, kid: 1, holder: holder.wire } });

    const res = await call("DELETE", `/ways/${added.way.id}`, { token: device.token });
    expect(refusal(res)).toEqual([422, "not_allowed", "passkey_holds_key"]);
    expect(await waysOf(device.token)).toHaveLength(2);

    await changeKey(device, { removeHolders: [holder.id] });
    expect((await call("DELETE", `/ways/${added.way.id}`, { token: device.token })).status).toBe(200);
    expect((await waysOf(device.token)).map((w) => w.kind)).toEqual(["preview"]);
  });

  const NOT_MINE = {
    "an id no way has": () => crypto.randomUUID(),
    "an id that is not a UUID": () => "passkey",
    "a credential id in place of the way's id": (made) => made.passkey.id,
  };
  for (const [name, id] of Object.entries(NOT_MINE)) {
    it(`answers gone to ${name}`, async () => {
      const made = await signUpWithPasskey();
      await addPasskey(made.token);
      expect(refusal(await call("DELETE", `/ways/${id(made)}`, { token: made.token }))).toEqual([410, "gone", "way"]);
      expect(await waysOf(made.token)).toHaveLength(2);
    });
  }

  it("answers gone to another account's way, and leaves it alone", async () => {
    const mine = await signUpWithPasskey();
    await addPasskey(mine.token);
    const theirs = await signUpWithPasskey();
    const second = await addPasskey(theirs.token);
    expect(refusal(await call("DELETE", `/ways/${second.way.id}`, { token: mine.token }))).toEqual([410, "gone", "way"]);
    expect(await waysOf(theirs.token)).toHaveLength(2);
  });

  it("answers gone to a way already removed", async () => {
    const made = await signUpWithPasskey();
    const second = await addPasskey(made.token);
    await addPasskey(made.token);
    await must("DELETE", `/ways/${second.way.id}`, { token: made.token });
    expect(refusal(await call("DELETE", `/ways/${second.way.id}`, { token: made.token }))).toEqual([410, "gone", "way"]);
  });

  it("ends every session that came in through the way, keeps the caller's, and touches no other", async () => {
    const made = await signUpWithPasskey();
    const second = await addPasskey(made.token);
    const viaSecond = [await signInWithPasskey(second.passkey), await signInWithPasskey(second.passkey)];
    const viaFirst = await signInWithPasskey(made.passkey);
    const stranger = await signUpWithPasskey();

    await must("DELETE", `/ways/${second.way.id}`, { token: viaSecond[0].token });
    // The caller came in through the way it removed, and stays signed in.
    expect((await call("GET", "/account", { token: viaSecond[0].token })).status).toBe(200);
    expect((await call("GET", "/account", { token: viaSecond[1].token })).body.error).toBe("sign_in");
    for (const token of [made.token, viaFirst.token, stranger.token]) expect((await call("GET", "/account", { token })).status).toBe(200);
  });

  it("needs an open session once the account has a notebook, and takes one", async () => {
    const { account, device } = await setUp();
    const added = await addPasskey(device.token);
    const closed = await signIn(account);
    const res = await call("DELETE", `/ways/${added.way.id}`, { token: closed });
    expect([res.status, res.body.error, res.body.kid]).toEqual([403, "not_open", 1]);
    expect(await waysOf(device.token)).toHaveLength(2);
    expect((await call("DELETE", `/ways/${added.way.id}`, { token: device.token })).status).toBe(200);
  });

  it("is refused to a session that a change of key closed", async () => {
    const { device } = await setUp();
    const added = await addPasskey(device.token);
    const viaPasskey = await signInWithPasskey(added.passkey);
    await must("POST", "/session/proof", { token: viaPasskey.token, body: { device: device.id, kid: 1, proof: b64(await ref.keyProof(ref.keyOf(device.held, 1))) } });
    await changeKey(device);
    expect(refusal(await call("DELETE", `/ways/${added.way.id}`, { token: viaPasskey.token }))).toEqual([403, "not_open", undefined]);
  });

  describe("an Apple way", () => {
    let world;
    let on;
    beforeEach(async () => {
      ({ env: on } = await providersOn());
      world = await standIns();
    });
    afterEach(standDown);

    it("stays, with its tokens, when Apple can't be told", async () => {
      const apple = await signInWith("apple", on);
      await addPasskey(apple.token);
      for (const fail of [() => world.down.add(APPLE_REVOKE), () => (world.answers.revoke = () => [400, { error: "invalid_client" }]), () => (world.answers.revoke = () => [500, null])]) {
        world.down.clear();
        fail();
        const res = await call("DELETE", `/ways/${apple.way.id}`, { token: apple.token, env: on });
        expect([res.status, res.body.error, res.body.which]).toEqual([502, "provider", "apple"]);
      }
      expect((await waysOf(apple.token)).map((w) => w.kind)).toEqual(["apple", "passkey"]);
      expect(await count("SELECT COUNT(*) AS n FROM apple_tokens WHERE way = ?", apple.way.id)).toBe(1);
      // And goes once Apple answers.
      world.answers.revoke = () => [200, null];
      expect((await call("DELETE", `/ways/${apple.way.id}`, { token: apple.token, env: on })).status).toBe(200);
    });

    it("stays where the deployment no longer has Apple's key, since its tokens could not be revoked", async () => {
      const apple = await signInWith("apple", on);
      await addPasskey(apple.token);
      const res = await call("DELETE", `/ways/${apple.way.id}`, { token: apple.token, env: { ...on, APPLE_PRIVATE_KEY: undefined } });
      expect([res.status, res.body.error, res.body.which]).toEqual([502, "provider", "apple"]);
      expect(world.calls.filter((c) => c.url === APPLE_REVOKE)).toHaveLength(0);
      expect(await waysOf(apple.token)).toHaveLength(2);
    });

    it("revokes a token for each client the reader signed in through", async () => {
      const apple = await signInWith("apple", on, { code: "one" });
      await signInWith("apple", on, { token: { subject: apple.subject, claims: { aud: "test.example.web" } }, code: "two" });
      await addPasskey(apple.token);
      await must("DELETE", `/ways/${apple.way.id}`, { token: apple.token, env: on });
      const revoked = world.calls.filter((c) => c.url === APPLE_REVOKE).map((c) => [c.form.client_id, c.form.token]);
      expect(revoked.sort()).toEqual([["test.example.app", "refresh-for-one"], ["test.example.web", "refresh-for-two"]]);
    });

    it("is not checked with Apple before the rules are: the last way in is refused with no call to Apple", async () => {
      const apple = await signInWith("apple", on);
      expect(refusal(await call("DELETE", `/ways/${apple.way.id}`, { token: apple.token, env: on }))).toEqual([422, "not_allowed", "last_way"]);
      expect(world.calls.filter((c) => c.url === APPLE_REVOKE)).toHaveLength(0);
    });
  });

  it("removes a Google way with no call to anyone", async () => {
    const { env: on } = await providersOn();
    const world = await standIns();
    try {
      const google = await signInWith("google", on);
      await addPasskey(google.token);
      const calls = world.calls.length;
      await must("DELETE", `/ways/${google.way.id}`, { token: google.token, env: on });
      expect(world.calls).toHaveLength(calls);
      expect((await waysOf(google.token)).map((w) => w.kind)).toEqual(["passkey"]);
    } finally {
      standDown();
    }
  });
});
