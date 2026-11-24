// Runs before each test file: the real migrations, applied to the local D1
// the tests use. applyD1Migrations() only applies what isn't applied yet.
import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
