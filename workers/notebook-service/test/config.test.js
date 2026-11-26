// wrangler.jsonc, held to what the two environments must and must not have.
// Production is prepared and not deployed (README, "Production"); what would
// make it unsafe is a line copied across from the preview, and a config has
// no other test.
import { describe, expect, it } from "vitest";
import raw from "../wrangler.jsonc?raw";
import packageJson from "../package.json?raw";
import workflow from "../../../.github/workflows/notebook-service-deploy.yml?raw";

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
const { preview, production } = config.env;
const scripts = JSON.parse(packageJson).scripts;

describe("the top level", () => {
  it("has no binding, no route, no variable, and no trigger, so a command with no --env reaches nothing", () => {
    for (const key of ["d1_databases", "routes", "route", "vars", "triggers", "ratelimits", "secrets", "kv_namespaces", "r2_buckets"]) {
      expect(config[key], key).toBeUndefined();
    }
    expect(config.workers_dev).toBe(false);
    expect(config.preview_urls).toBe(false);
    expect(Object.keys(config.env).sort()).toEqual(["preview", "production"]);
  });

  it("stores no log: a stored event carries the address asked for, ids and all (Audit 9, decision 4)", () => {
    expect(config.observability).toEqual({ enabled: false });
    for (const [name, env] of Object.entries(config.env)) {
      expect(env.observability, name).toBeUndefined();
    }
  });

  it("is named by every npm script that reaches Cloudflare or a database", () => {
    for (const [name, command] of Object.entries(scripts)) {
      if (!/wrangler/.test(command)) continue;
      expect(command, name).toMatch(/--env (preview|production)\b/);
    }
  });
});

describe("production", () => {
  it("has nothing of the preview's way in, and no dev server", () => {
    const text = JSON.stringify(production);
    expect(text).not.toMatch(/PREVIEW/i);
    expect(text).not.toContain("localhost");
    expect(production.vars.PASSKEY_LOCAL_ORIGINS).toBeUndefined();
    expect(production.secrets).toBeUndefined();
  });

  it("names itself production, answers at its own address, and lets the website alone call it", () => {
    expect(production.vars.ENVIRONMENT).toBe("production");
    expect(production.vars.ALLOWED_ORIGINS).toBe("https://litbible.net");
    expect(production.routes).toEqual([{ pattern: "notebook.litbible.net", custom_domain: true }]);
  });

  it("has a database of its own, never the preview's", () => {
    expect(production.d1_databases).toHaveLength(1);
    const [db] = production.d1_databases;
    expect(db.binding).toBe("DB");
    expect(db.database_name).toBe("litbible-notebook");
    expect(db.database_id).not.toBe(preview.d1_databases[0].database_id);
    expect(db.migrations_dir).toBe("migrations");
  });

  it("takes the same passkeys as the preview, without the dev server's", () => {
    expect(production.vars.PASSKEY_RP_ID).toBe(preview.vars.PASSKEY_RP_ID);
    expect(production.vars.PASSKEY_ORIGINS).toBe(preview.vars.PASSKEY_ORIGINS);
  });

  it("has no identifier of Apple's or Google's, as the preview has none", () => {
    for (const env of [preview, production]) {
      for (const name of ["APPLE_CLIENT_IDS", "APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY", "GOOGLE_CLIENT_IDS"]) {
        expect(env.vars[name], name).toBeUndefined();
      }
    }
  });

  it("never writes Turnstile's secret into the file, in either environment", () => {
    for (const env of [preview, production]) expect(env.vars.TURNSTILE_SECRET).toBeUndefined();
    expect(raw).not.toMatch(/TURNSTILE_SECRET"\s*:/);
  });

  it("turns Turnstile on in the preview alone (2026-11-25): its site key, and its secret required", () => {
    expect(preview.vars.TURNSTILE_SITE_KEY).toMatch(/^0x4[A-Za-z0-9_-]{10,}$/);
    expect(preview.secrets.required).toContain("TURNSTILE_SECRET");
    // Production takes both when it is deployed (README, "Production").
    expect(production.vars.TURNSTILE_SITE_KEY).toBeUndefined();
  });
});

describe("what both environments must have, each written out (a named environment inherits none of it)", () => {
  for (const [name, env] of [["preview", preview], ["production", production]]) {
    it(`${name}: the hourly trigger, and all three limiters with the spec's numbers`, () => {
      expect(env.triggers).toEqual({ crons: ["17 * * * *"] });
      expect(env.ratelimits.map((l) => [l.name, l.simple])).toEqual([
        ["SIGN_IN_LIMIT", { limit: 60, period: 60 }],
        ["REQUEST_LIMIT", { limit: 1200, period: 60 }],
        // POST /rows (BVJ, 2026-11-26; Audit 9, SV9-1).
        ["PUSH_LIMIT", { limit: 120, period: 60 }],
      ]);
    });
  }

  it("gives each limiter a namespace of its own, so the preview's traffic never counts against production's", () => {
    const ids = [...preview.ratelimits, ...production.ratelimits].map((l) => l.namespace_id);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
    for (const id of ids) expect(id).toMatch(/^[1-9]\d*$/);
  });
});

describe("the preview", () => {
  it("is the only environment with the preview's way in, and requires its secret to deploy", () => {
    expect(preview.vars.ENVIRONMENT).toBe("preview");
    expect(preview.vars.PREVIEW_SIGN_IN).toBe("on");
    expect(preview.secrets).toEqual({ required: ["PREVIEW_SECRET", "TURNSTILE_SECRET"] });
  });
});

describe("the deploy workflow", () => {
  it("deploys production only when asked by hand, never on a push", () => {
    const job = workflow.slice(workflow.indexOf("\n  deploy-production:"));
    expect(job.length).toBeGreaterThan(200);
    const condition = /if: >-\n([\s\S]*?)\n    runs-on/.exec(job)[1];
    expect(condition).toContain("vars.NOTEBOOK_PRODUCTION_DEPLOYS == 'on'");
    expect(condition).toContain("github.event_name == 'workflow_dispatch'");
    expect(condition).toContain("inputs.environment == 'production'");
    expect(condition).not.toContain("push");
    expect(job).toContain("environment: notebook-production");
  });

  it("never names production in a job that runs on a push", () => {
    const previewJob = workflow.slice(workflow.indexOf("\n  deploy:"), workflow.indexOf("\n  rollback:"));
    expect(previewJob).not.toContain("--env production");
    expect(previewJob).toContain("--env preview");
  });

  // Audit 9, SEC9-2, SV9-2, and SV9-3 (BVJ, 2026-11-26).
  const JOBS = ["test", "deploy", "rollback", "deploy-production", "rollback-production"];
  /** One job's text, from its key to the next job's. */
  function job(name) {
    const start = workflow.indexOf(`\n  ${name}:\n`);
    expect(start, name).toBeGreaterThan(-1);
    const rest = workflow.slice(start + 1);
    const next = rest.slice(1).search(/\n  [a-z-]+:\n/);
    return next === -1 ? rest : rest.slice(0, next + 1);
  }

  it("tests in a job with no secret, and deploys from an install that runs no package's scripts", () => {
    expect(job("test")).not.toContain("secrets.");
    expect(job("test")).not.toContain("environment:");
    expect(job("test")).toContain("npm test");
    for (const name of JOBS.slice(1)) {
      const text = job(name);
      expect(text, name).toContain("npm ci --ignore-scripts");
      expect(text, name).not.toMatch(/npm ci\s*\n/);
      expect(text, name).not.toContain("npm test");
    }
    expect(job("deploy")).toContain("needs: test");
    expect(job("deploy-production")).toContain("needs: test");
  });

  it("rolls production back from an environment of its own, and every rollback in a queue apart from the deploys", () => {
    expect(job("deploy-production")).toMatch(/environment: notebook-production\n/);
    expect(job("rollback-production")).toMatch(/environment: notebook-production-rollback\n/);
    const group = (name) => /concurrency:\n\s+group: (\S+)/.exec(job(name))?.[1];
    const groups = JOBS.slice(1).map(group);
    expect(groups.every(Boolean)).toBe(true);
    expect(new Set(groups).size).toBe(groups.length);
    // No queue for the whole workflow, which would put a rollback behind a deploy again.
    expect(workflow.slice(0, workflow.indexOf("\njobs:\n"))).not.toMatch(/^concurrency:/m);
  });

  it("pins every action by its commit, and keeps no token on disk after a checkout", () => {
    const uses = [...workflow.matchAll(/uses: (\S+)/g)].map((m) => m[1]);
    expect(uses.length).toBeGreaterThan(0);
    for (const action of uses) expect(action).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
    const checkouts = workflow.match(/uses: actions\/checkout@/g).length;
    expect(workflow.match(/persist-credentials: false/g)?.length).toBe(checkouts);
  });
});
