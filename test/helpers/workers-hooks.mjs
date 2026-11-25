// test/helpers/workers-hooks.mjs
//
// A Node module hook (registered by real-notebook-service.mjs) that lets the
// root suite import the notebook service's own test helpers. They name
// `cloudflare:workers`, which exists only inside workerd, for the Worker's
// bindings; here that module is one object the helper fills in. Nothing else
// is rewritten.

const STAND_IN = "export const env = (globalThis.__notebookServiceEnv ??= {});";

export async function resolve(specifier, context, next) {
  if (specifier === "cloudflare:workers") {
    return { url: `data:text/javascript,${encodeURIComponent(STAND_IN)}`, shortCircuit: true };
  }
  return next(specifier, context);
}
