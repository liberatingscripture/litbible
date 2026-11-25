// Where the site's content security policy reports go (Study Desk step 4i).
//
// public/_headers tells every browser to post a report to an address, and
// workers/csp-reports/ is the Worker that answers there. The two are deployed
// apart (the site by Cloudflare Pages, the Worker by hand), and a mismatch
// shows on no page: reports would go to an address nothing answers, and a
// week of "no reports" would read as a clean policy. So the pairing is held
// here, with the rules the browsers' documentation gives (public/CLAUDE.md,
// "Security headers / CSP").

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");

const headers = read("public/_headers");
/** The value of a header in the `/*` block (the first rule in the file). */
function header(name) {
  const block = headers.slice(0, headers.indexOf("\n\n"));
  const found = block.split("\n").filter((line) => line.startsWith(`  ${name}: `));
  assert.equal(found.length, 1, `${name} is set once for every path`);
  return found[0].slice(name.length + 4);
}

const worker = read("workers/csp-reports/wrangler.jsonc");
const route = /"routes":\s*\[\{\s*"pattern":\s*"([^"]+)"/.exec(worker)[1];
const ADDRESS = `https://${route}`;

test("the Worker answers at the site's own origin, on the path its code names", () => {
  assert.equal(ADDRESS, "https://litbible.net/csp-report");
  const origin = /"SITE_ORIGIN":\s*"([^"]+)"/.exec(worker)[1];
  const path = /export const PATH = "([^"]+)"/.exec(read("workers/csp-reports/src/http.js"))[1];
  assert.equal(origin + path, ADDRESS);
});

test("Reporting-Endpoints declares one endpoint, at the Worker's address, written in full", () => {
  const declared = header("Reporting-Endpoints");
  const [, name, address] = /^([a-z][a-z0-9-]*)="([^"]+)"$/.exec(declared);
  assert.equal(address, ADDRESS);
  // Safari supports the header but not an endpoint named "default" (browser-compat-data, 2026-11-24).
  assert.notEqual(name, "default");
});

test("both policies report both ways: report-to for the browsers that know it, report-uri for the rest", () => {
  const [, name] = /^([a-z][a-z0-9-]*)=/.exec(header("Reporting-Endpoints"));
  for (const policy of ["Content-Security-Policy", "Content-Security-Policy-Report-Only"]) {
    const directives = header(policy).split(";").map((directive) => directive.trim());
    assert.deepEqual(
      directives.filter((directive) => /^report-/.test(directive)),
      [`report-uri ${ADDRESS}`, `report-to ${name}`],
      `${policy} names the Worker's address and the declared endpoint`,
    );
    // Neither may ask for a sample: a sample is a piece of the page or of what a reader typed.
    assert.ok(!header(policy).includes("report-sample"), `${policy} asks for no sample`);
  }
});

test("the report-only policy is still report-only, and the enforced one still holds only its four structural directives", () => {
  // Enforcing the full policy is a later step (4i's second half), made on purpose and not by an edit here.
  const enforced = header("Content-Security-Policy").split(";").map((directive) => directive.trim().split(" ")[0]);
  assert.deepEqual(enforced, ["frame-ancestors", "object-src", "base-uri", "form-action", "report-uri", "report-to"]);
  assert.match(header("Content-Security-Policy-Report-Only"), /^default-src 'self'; script-src /);
});

test("no line of _headers is over Cloudflare's 2,000 characters, where a rule would be dropped", () => {
  for (const line of headers.split("\n")) assert.ok(line.length <= 2000, `${line.slice(0, 60)}… is ${line.length} characters`);
});

test("the privacy page gives the number of days the Worker keeps a count", () => {
  const days = /export const KEEP_DAYS = (\d+);/.exec(read("workers/csp-reports/src/store.js"))[1];
  assert.match(read("src/pages/privacy.astro").replace(/\s+/g, " "), new RegExp(`counts are deleted after ${days} days`));
});

test("every Worker's rate limiter has a namespace of its own, so one never counts against another", () => {
  const ids = [];
  for (const name of readdirSync(fileURLToPath(new URL("../workers", import.meta.url)), { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    for (const file of ["wrangler.jsonc", "wrangler.toml"]) {
      let config;
      try {
        config = read(`workers/${name.name}/${file}`);
      } catch {
        continue;
      }
      for (const [, id] of config.matchAll(/namespace_id"?\s*[:=]\s*"(\d+)"/g)) ids.push(`${id}`);
    }
  }
  assert.ok(ids.length >= 6, `found ${ids.length} limiters`);
  assert.equal(new Set(ids).size, ids.length, `namespace ids: ${ids.join(", ")}`);
});
