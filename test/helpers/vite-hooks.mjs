// test/helpers/vite-hooks.mjs
//
// Node module hooks (registered by browser-env.mjs) that let a test import the
// desk's browser modules as Vite would serve them: a stylesheet import
// (`desk.css?inline`, a plain `.css`) becomes an empty string module, and
// `import.meta.env` in a file under src/ becomes a fixed object, since Node has
// neither, and a JSON import needs no `with { type: "json" }`, as in Vite.
// Nothing else is rewritten.

const ENV = '({ BASE_URL: "/", MODE: "test", DEV: false, PROD: true, SSR: false })';

export async function resolve(specifier, context, next) {
  if (/\.css(\?.*)?$/.test(specifier) || /\?(raw|inline|url)$/.test(specifier)) {
    return { url: "data:text/javascript,export default %22%22;", shortCircuit: true };
  }
  if (/\.json$/.test(specifier)) {
    const resolved = await next(specifier, context);
    return { ...resolved, importAttributes: { ...resolved.importAttributes, type: "json" } };
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  const result = await next(url, context);
  if (url.startsWith("file:") && /\/src\/.*\.(m?js|ts)$/.test(url) && result.source != null) {
    const text = String(result.source);
    if (text.includes("import.meta.env")) {
      return { ...result, source: text.replaceAll("import.meta.env", ENV), shortCircuit: true };
    }
  }
  return result;
}
