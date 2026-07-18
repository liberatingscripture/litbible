import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";

// Tests run inside workerd (via the Workers vitest pool) so `cloudflare:email`
// and EmailMessage resolve for real rather than being stubbed out.
//
// wrangler.toml is loaded for its compatibility date and module resolution only.
// The tests call `worker.fetch(request, env)` with a hand-built env, so no real
// send_email or ratelimit binding is ever provisioned — see test/index.test.js.
//
// Note: @cloudflare/vitest-pool-workers >=0.18 replaced the old
// `defineWorkersConfig` (from the removed "/config" subpath) with this plugin.
export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.toml" } })],
});
