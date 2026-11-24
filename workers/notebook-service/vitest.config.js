import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";

// Tests run inside workerd (Cloudflare's Vitest plugin), against a real local
// D1 with the real migrations applied, so the SQL, the batches, and the
// guard's rollback are the ones production runs. No account, no network.
//
// The preview environment's bindings are loaded from wrangler.jsonc. The
// preview's secret comes in the way a real one does in local development, from
// the process's environment; this is a test value that exists nowhere else.
//
// The tests act as a real client: they import the encryption reference the
// website ships (src/lib/desk-crypto.mjs, which has no imports) and its test
// vectors by relative path, which is why Vite is allowed to read the repo's
// root. Nothing in src/ of this package imports either.
process.env.PREVIEW_SECRET ??= "test-only-preview-secret-0123456789abcdef";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");

export default defineConfig({
  server: { fs: { allow: [repoRoot] } },
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: "./wrangler.jsonc", environment: "preview" },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations(path.join(here, "migrations")),
        },
      },
    })),
  ],
  test: {
    setupFiles: ["./test/apply-migrations.js"],
    // The Worker logs one line for each request; a test run makes thousands.
    silent: true,
  },
});
