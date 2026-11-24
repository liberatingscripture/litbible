// The check to run against a deployed PRODUCTION service. It needs no secret
// and writes nothing: no account is made, and no session.
//
//   npm run check:production -- https://<the address>
//
// The address is the first argument, or NOTEBOOK_URL. The preview is checked
// by the walkthrough instead (scripts/walkthrough.mjs), which needs the
// preview's own way in and so can never run here.
//
// What it holds production to:
//   1. it answers, as this service, at this interface;
//   2. it says it is not a preview, and the preview's way in is not there;
//   3. it gives nothing to a request with no session;
//   4. a passkey can begin a sign-in (which also shows the database answers:
//      the options carry a challenge the service wrote there). That one
//      request leaves one row, which runs out in five minutes and is swept.
const base = (process.argv[2] ?? process.env.NOTEBOOK_URL ?? "").replace(/\/+$/, "");
// https, or this machine's own `npx wrangler dev --env production` (a local database, nothing remote).
if (!/^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$)/.test(base)) {
  console.error("Give production's address: npm run check:production -- https://<the address>");
  process.exit(2);
}

async function ask(method, path, body) {
  const response = await fetch(base + path, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let parsed = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }
  return { status: response.status, body: parsed };
}

const checks = [
  [
    "answers as the notebook service, interface 1, and not a preview",
    async () => {
      const { status, body } = await ask("GET", "/");
      return status === 200 && body?.service === "lit-notebook" && body?.interface === 1 && body?.preview === false;
    },
  ],
  [
    "has no preview way in: both of its paths are not found",
    async () => {
      const session = await ask("POST", "/preview/session", { secret: "x".repeat(40), account: "check" });
      const passkeys = await ask("POST", "/preview/passkeys", { credential: "AAAA", syncs: true });
      return session.status === 404 && session.body?.error === "not_found" && passkeys.status === 404;
    },
  ],
  [
    "gives nothing to a request with no session",
    async () => {
      const account = await ask("GET", "/account");
      const rows = await ask("GET", "/rows");
      return account.status === 401 && account.body?.error === "sign_in" && rows.status === 401;
    },
  ],
  [
    "offers a passkey, and can begin a sign-in with one",
    async () => {
      const ways = await ask("GET", "/sign-in");
      if (!(ways.status === 200 && Array.isArray(ways.body?.ways) && ways.body.ways.includes("passkey"))) return false;
      const options = await ask("POST", "/sign-in/passkey/options");
      return options.status === 200 && typeof options.body?.publicKey?.challenge === "string" && options.body.publicKey.rpId === "litbible.net";
    },
  ],
];

let failed = 0;
for (const [name, check] of checks) {
  let ok = false;
  try {
    ok = await check();
  } catch {
    ok = false;
  }
  if (!ok) failed += 1;
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}`);
}
if (failed) {
  console.error(`\n${failed} of ${checks.length} checks failed against ${base}.`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} checks passed against ${base}.`);
