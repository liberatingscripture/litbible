// Runs the test vectors' walkthrough against a running service, over HTTP:
// the check to make after a deploy, and the quickest proof that a local
// `npm run dev` works. The steps are the ones the test suite runs in workerd
// (test/walkthrough.js); only the way a request is sent differs.
//
//   npm run walkthrough                           the local `npm run dev`
//   npm run walkthrough -- https://<the address>  a deployed preview
//
// The address is the first argument, or NOTEBOOK_URL, or http://localhost:8787.
// The preview's secret is never an argument and is never printed. It is read
// from PREVIEW_SECRET in the environment; failing that, for a local address
// from this package's own .dev.vars, and for any other address by asking at
// the terminal, where it is drawn as asterisks as it is typed or pasted.
//
// Each run makes its own test account (walkthrough-<time>-<random>), so runs
// never meet, and its last step deletes that account, so a run that passes
// leaves nothing behind. One that fails partway leaves its test account in
// the preview database.
// It needs the preview's way in, so it cannot run against production.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as ref from "../../../src/lib/desk-crypto.mjs";
import { walkthroughSteps } from "../test/walkthrough.js";
import { askHidden } from "./ask-hidden.mjs";

const base = (process.argv[2] ?? process.env.NOTEBOOK_URL ?? "http://localhost:8787").replace(/\/+$/, "");
const local = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(base);
let secret = process.env.PREVIEW_SECRET || (local ? await localSecret() : undefined);
if (!secret && !local && process.stdin.isTTY) {
  secret = await askHidden("The preview's secret (shown as asterisks; paste it, then press Enter): ").catch(() => undefined);
}
if (!secret) {
  console.error(
    local
      ? "No PREVIEW_SECRET in the environment or in .dev.vars. Copy .dev.vars.example to .dev.vars and fill it in."
      : "No secret given. Set PREVIEW_SECRET in the environment, or run this at a terminal to be asked for it.",
  );
  process.exit(2);
}

/** The local-only secret from this package's .dev.vars, which git ignores. Never used for a deployed address. */
async function localSecret() {
  const text = await readFile(fileURLToPath(new URL("../.dev.vars", import.meta.url)), "utf8").catch(() => "");
  return /^PREVIEW_SECRET=(.+)$/m.exec(text)?.[1].trim();
}

const vectors = JSON.parse(
  await readFile(fileURLToPath(new URL("../../../test/fixtures/notebook-crypto-vectors.json", import.meta.url)), "utf8"),
);

/** One request, in the shape the steps expect: { status, headers, body }. */
async function call(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: response.status, headers: response.headers, body: parsed };
}

// The exit code is set and the script left to end by itself: process.exit()
// straight after a fetch trips an assertion in Node on Windows.
process.exitCode = await main();

async function main() {
  const hello = await call("GET", "/").catch((error) => ({ status: 0, body: { error: error.message } }));
  if (hello.status !== 200 || hello.body?.service !== "lit-notebook") {
    console.error(`No notebook service answered at ${base} (${hello.status}).`);
    return 1;
  }
  if (!hello.body.preview) {
    console.error(`The service at ${base} has no preview way in, so the walkthrough can't sign in.`);
    return 1;
  }
  console.log(`${base}  interface ${hello.body.interface}  service time ${hello.body.time}`);

  const account = `walkthrough-${Date.now().toString(36)}-${ref.toBase64url(ref.randomBytes(6))}`;
  const steps = walkthroughSteps({ call, ref, vectors, secret, account });
  let passed = 0;
  for (const { name, run } of steps) {
    try {
      await run();
      passed += 1;
      console.log(`  ok    ${name}`);
    } catch (error) {
      // A step's message quotes the service's answer, never what was sent, so no secret or token is in it.
      console.log(`  FAIL  ${name}\n        ${error.message}`);
      break;
    }
  }
  console.log(`${passed} of ${steps.length} steps passed (test account ${account}).`);
  return passed === steps.length ? 0 : 1;
}
