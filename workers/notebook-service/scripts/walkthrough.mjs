// Runs the test vectors' walkthrough against a running service, over HTTP:
// the check to make after a deploy, and the quickest proof that a local
// `npm run dev` works. The steps are the ones the test suite runs in workerd
// (test/walkthrough.js); only the way a request is sent differs.
//
//   NOTEBOOK_URL     the service's address (default http://localhost:8787)
//   PREVIEW_SECRET   the preview's secret. Read from the environment only:
//                    never pass it as an argument, and it is never printed.
//                    For a local run it is the value in .dev.vars.
//
//   npm run walkthrough
//
// Each run makes its own test account (walkthrough-<time>-<random>), so runs
// never meet, and what it leaves behind is test data in a preview database.
// It needs the preview's way in, so it cannot run against production.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as ref from "../../../src/lib/desk-crypto.mjs";
import { walkthroughSteps } from "../test/walkthrough.js";

const base = (process.env.NOTEBOOK_URL ?? "http://localhost:8787").replace(/\/+$/, "");
const secret = process.env.PREVIEW_SECRET;
if (!secret) {
  console.error("PREVIEW_SECRET is not set. Set it in the environment for this run; it is never written down here.");
  process.exit(2);
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

const hello = await call("GET", "/").catch((error) => ({ status: 0, body: { error: error.message } }));
if (hello.status !== 200 || hello.body?.service !== "lit-notebook") {
  console.error(`No notebook service answered at ${base} (${hello.status}).`);
  process.exit(1);
}
if (!hello.body.preview) {
  console.error(`The service at ${base} has no preview way in, so the walkthrough can't sign in.`);
  process.exit(1);
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
process.exit(passed === steps.length ? 0 : 1);
