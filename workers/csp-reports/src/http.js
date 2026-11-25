// The Worker's answers, and reading a post's body.

/** The one path this Worker answers at. public/_headers names it. */
export const PATH = "/csp-report";

/** No post may be larger than this. One report is about 1,500 bytes; a browser may send several at once. */
export const MAX_BODY_BYTES = 64 * 1024;

/** What a refused sender is told to wait, in seconds: the limiter's period. */
export const RETRY_SECONDS = 60;

// application/csp-report is the old way's type and application/reports+json
// the new one's; a few older browsers send the old shape as plain JSON.
const TYPES = /^application\/(csp-report|reports\+json|json)\s*(;|$)/i;

/** Whether a Content-Type is one a report comes as. */
export const isReportType = (type) => TYPES.test(type ?? "");

/** An answer: a status and no body, ever. Nothing a sender posted is given back. */
export const answer = (status, headers = {}) => new Response(null, { status, headers: { "cache-control": "no-store", ...headers } });

/**
 * The post's body as text, and no more than `most` bytes of it: null when it
 * is larger, whatever its Content-Length claimed. Throws when it isn't UTF-8.
 */
export async function readText(request, most) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > most) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
