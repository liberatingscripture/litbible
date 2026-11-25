// wrangler.jsonc, held to what the site's privacy page and public/_headers
// rely on. A config has no other test.
import { describe, expect, it } from "vitest";
import raw from "../wrangler.jsonc?raw";
import packageJson from "../package.json?raw";
import { PATH } from "../src/http.js";

/** JSON with comments, read: line comments outside strings are dropped. */
function readJsonc(text) {
  let out = "";
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      out += c;
      if (c === "\\") out += text[++i];
      else if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
      out += c;
    } else if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else out += c;
  }
  return JSON.parse(out);
}

const config = readJsonc(raw);

describe("where it answers", () => {
  it("answers at one address, the site's own origin and the Worker's one path", () => {
    expect(config.routes).toEqual([{ pattern: "litbible.net/csp-report", zone_name: "litbible.net" }]);
    expect(config.vars).toEqual({ SITE_ORIGIN: "https://litbible.net" });
    expect(`https://${config.routes[0].pattern}`).toBe(config.vars.SITE_ORIGIN + PATH);
  });

  it("has no *.workers.dev address and no per-version preview address", () => {
    expect(config.workers_dev).toBe(false);
    expect(config.preview_urls).toBe(false);
  });
});

describe("what the privacy page relies on", () => {
  it("stores no logs at all", () => {
    expect(config.observability).toEqual({ enabled: false });
    expect(config.logpush).toBeUndefined();
    expect(config.tail_consumers).toBeUndefined();
  });

  it("deletes old counts once a day", () => {
    expect(config.triggers).toEqual({ crons: ["41 4 * * *"] });
  });

  it("has one database of its own and no other place to keep anything", () => {
    expect(config.d1_databases).toHaveLength(1);
    const [db] = config.d1_databases;
    expect([db.binding, db.database_name, db.migrations_dir]).toEqual(["DB", "litbible-csp-reports", "migrations"]);
    expect(db.database_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    for (const key of ["kv_namespaces", "r2_buckets", "analytics_engine_datasets", "queues", "durable_objects", "secrets"]) {
      expect(config[key], key).toBeUndefined();
    }
  });
});

describe("the limit", () => {
  it("is one limiter, counted by the minute", () => {
    expect(config.ratelimits).toEqual([{ name: "REPORT_LIMIT", namespace_id: "4201", simple: { limit: 120, period: 60 } }]);
  });
});

describe("the package", () => {
  it("takes its three tools at the ranges the other two Workers do, so one Dependabot rule fits all three", () => {
    expect(Object.keys(JSON.parse(packageJson).devDependencies)).toEqual(["@cloudflare/vitest-plugin", "vitest", "wrangler"]);
    expect(JSON.parse(packageJson).dependencies).toBeUndefined();
  });
});
