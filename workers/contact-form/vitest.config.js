import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-plugin";

// Tests run inside workerd (via Cloudflare's Vitest plugin) so `cloudflare:email`
// and EmailMessage resolve for real rather than being stubbed out.
//
// wrangler.toml is loaded for its compatibility date and module resolution only.
// The tests call `worker.fetch(request, env)` with a hand-built env, so no real
// send_email or ratelimit binding is ever provisioned — see test/index.test.js.
//
// Note: the package was @cloudflare/vitest-pool-workers until its 1.0 rename
// (2026-08-20); the API is unchanged. Its >=0.18 releases had already replaced
// the old `defineWorkersConfig` (from the removed "/config" subpath) with this
// plugin.
export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.toml" } })],
});
