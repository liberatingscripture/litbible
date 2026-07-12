/**
 * litbible.net form backend (FIXLIST F1).
 *
 * ONE Worker serves TWO routes, selected by the request pathname:
 *   - POST /contact/submit      → the /contact page
 *   - POST /app-support/submit  → the /app-support page (LIT Bible apps)
 *
 * The two forms are near-identical but NOT the same: each has its own
 * Turnstile widget (own secret) and its own destination inbox, so the
 * per-route config (`formConfig`) picks the subject line, destination email,
 * Turnstile secret, and success/error URLs. Everything else is shared.
 *
 * For each request the Worker:
 *   1. verifies the Cloudflare Turnstile token server-side (siteverify) with
 *      the route's secret — nothing else checks the token on our side;
 *   2. sends the message via the Email Routing send_email binding, from
 *      FROM_EMAIL (contact@litbible.net) with Reply-To set to the submitter,
 *      to the route's verified destination inbox.
 *
 * The route's optional DISPLAY_TO secret sets the address SHOWN in the To:
 * header (a branded alias) while the delivery envelope still targets the real
 * destination inbox — so a quoted/forwarded copy never reveals the underlying
 * address. If the platform rejects the header/envelope mismatch, the send is
 * retried once with the header matching the envelope.
 *
 * Two client paths, mirroring the old Formspree behavior:
 *   - The page's fetch() submit sends `Accept: application/json` and gets a
 *     JSON verdict ({ ok: true } or { ok: false, error }).
 *   - A native no-JS POST gets a 303 redirect to the route's thanks page on
 *     success, or a small self-contained HTML error page (a static site
 *     can't render per-request errors, so the Worker carries its own).
 *
 * The `_gotcha` honeypot is honored server-side too: a filled honeypot
 * "succeeds" without sending anything, same as the client-side check.
 */

import { EmailMessage } from "cloudflare:email";
// The browser build — the Node build drags in node:path/os, which Workers
// would need the nodejs_compat flag for.
import { createMimeMessage, Mailbox } from "mimetext/browser";

const LIMITS = { name: 200, email: 254, message: 10000 };

// The app-support form's "Which app?" select. Anything outside this set (or a
// missing field) collapses to "Not sure" so a tampered POST can't inject text.
const ALLOWED_PLATFORMS = new Set(["iOS", "Android", "Not sure"]);

// Per-route configuration. The route pathname (gated by wrangler.toml `routes`)
// picks the destination inbox, Turnstile secret, subject, and redirect targets.
// `displayTo` is the OPTIONAL address shown in the email's To: header (a
// branded alias) while delivery still targets `destEmail`; unset falls back to
// `destEmail` (see the send block for the header/envelope-mismatch retry).
// Unknown paths fall back to the contact config rather than crashing.
function formConfig(pathname, env) {
  if (pathname.startsWith("/app-support")) {
    return {
      kind: "app-support",
      subjectFor: (name) => `litbible.net app support — ${name}`,
      destEmail: env.APP_SUPPORT_DEST_EMAIL,
      displayTo: env.APP_SUPPORT_DISPLAY_TO,
      turnstileSecret: env.APP_SUPPORT_TURNSTILE_SECRET,
      thanksPath: "/app-support/thanks/",
      backPath: "/app-support/",
    };
  }
  return {
    kind: "contact",
    subjectFor: (name) => `litbible.net contact — ${name}`,
    destEmail: env.DEST_EMAIL,
    displayTo: env.DISPLAY_TO,
    turnstileSecret: env.TURNSTILE_SECRET,
    thanksPath: "/contact/thanks/",
    backPath: "/contact/",
  };
}

// Header-bound fields must never carry CR/LF (header injection) — collapse
// all whitespace runs. The message body keeps its newlines.
const headerSafe = (v, max) =>
  String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

const looksLikeEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "POST" },
      });
    }

    const cfg = formConfig(new URL(request.url).pathname, env);

    const wantsJson = (request.headers.get("Accept") || "").includes(
      "application/json",
    );
    const respond = (status, error) =>
      wantsJson
        ? Response.json(error ? { ok: false, error } : { ok: true }, { status })
        : error
          ? errorPage(status, error, cfg.backPath)
          : seeOther(new URL(cfg.thanksPath, request.url));

    // Per-IP rate limit (5/min, wrangler.toml [[ratelimits]]) before doing
    // any real work. Fail open on a binding hiccup — a broken limiter
    // shouldn't take the contact form down.
    try {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) return respond(429, "rate-limited");
    } catch (err) {
      console.warn("rate limiter unavailable:", err);
    }

    let form;
    try {
      form = await request.formData();
    } catch {
      return respond(400, "bad-request");
    }

    // Honeypot filled → a bot. Pretend success, send nothing.
    if (String(form.get("_gotcha") || "").trim() !== "") {
      return respond(200);
    }

    const name = headerSafe(form.get("name"), LIMITS.name);
    const email = headerSafe(form.get("email"), LIMITS.email);
    const message = String(form.get("message") || "")
      .trim()
      .slice(0, LIMITS.message);
    if (!name || !message || !looksLikeEmail(email)) {
      return respond(400, "missing-fields");
    }

    // App-support only: which app the report is about. Whitelisted so a
    // tampered POST can't inject arbitrary text into the email.
    let platform = "";
    if (cfg.kind === "app-support") {
      const raw = headerSafe(form.get("platform"), 20);
      platform = ALLOWED_PLATFORMS.has(raw) ? raw : "Not sure";
    }

    const token = String(form.get("cf-turnstile-response") || "");
    if (!(await verifyTurnstile(cfg.turnstileSecret, token, request))) {
      return respond(403, "turnstile");
    }

    const fields = { name, email, message, platform };
    try {
      // Delivery envelope always targets destEmail; the To: header shows
      // displayTo (a branded alias) when set. If Cloudflare rejects the
      // header/envelope mismatch, retry once with the header matching the
      // envelope so the message still gets through.
      const displayTo = cfg.displayTo || cfg.destEmail;
      try {
        await env.CONTACT_EMAIL.send(buildEmail(env, request, cfg, fields, displayTo));
      } catch (err) {
        if (displayTo === cfg.destEmail) throw err;
        console.warn("DISPLAY_TO send rejected, retrying with DEST_EMAIL:", err);
        await env.CONTACT_EMAIL.send(
          buildEmail(env, request, cfg, fields, cfg.destEmail),
        );
      }
    } catch (err) {
      console.error("send failed:", err);
      return respond(500, "send-failed");
    }

    return respond(200);
  },
};

// Build the outbound message. `toHeader` is the address shown in the To:
// header (branded alias or the real inbox); the delivery envelope always
// targets cfg.destEmail regardless.
function buildEmail(env, request, cfg, { name, email, message, platform }, toHeader) {
  const msg = createMimeMessage();
  msg.setSender({ name: "LIT Bible contact form", addr: env.FROM_EMAIL });
  msg.setRecipient(toHeader);
  // mimetext validates known headers: Reply-To must be a Mailbox, not a
  // bare string (a string throws MIMETEXT_INVALID_HEADER_VALUE).
  msg.setHeader("Reply-To", new Mailbox(email));
  msg.setSubject(cfg.subjectFor(name));
  msg.addMessage({
    contentType: "text/plain",
    data: [
      cfg.kind === "app-support"
        ? "New message from the litbible.net app support form."
        : "New message from the litbible.net contact form.",
      "",
      `Name:  ${name}`,
      `Email: ${email}`,
      ...(platform ? [`App:   ${platform}`] : []),
      "",
      "Message:",
      message,
      "",
      `— ${sentLine(request)}; reply to this email to answer.`,
    ].join("\n"),
  });
  return new EmailMessage(env.FROM_EMAIL, cfg.destEmail, msg.asRaw());
}

// The email footer shows the SENDER's local time (from Cloudflare's
// IP-geolocation zone on the request) — the mail client already localizes
// the Date: header to the reader's zone, so sender-local is the one piece
// of timing context the header can't provide.
function sentLine(request) {
  const zone = request.cf?.timezone;
  if (zone) {
    try {
      const when = new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        dateStyle: "medium",
        timeStyle: "long",
      }).format(new Date());
      return `Sent ${when} (sender's local time)`;
    } catch {
      // fall through to UTC
    }
  }
  return `Sent ${new Date().toISOString()}`;
}

async function verifyTurnstile(secret, token, request) {
  if (!token) return false;
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: new URLSearchParams({
          secret,
          response: token,
          remoteip: request.headers.get("CF-Connecting-IP") || "",
        }),
      },
    );
    const verdict = await res.json();
    if (verdict.success !== true) {
      // Only Turnstile's error codes — no submitter data. Visible in
      // `wrangler tail`; distinguishes a misconfigured secret
      // (invalid-input-secret) from a bad/expired token.
      console.warn(
        "turnstile rejected:",
        JSON.stringify(verdict["error-codes"] ?? []),
      );
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

const seeOther = (url) =>
  new Response(null, { status: 303, headers: { Location: url.href } });

// Minimal branded error page for the no-JS path. Matches the site's cream/ink
// palette; self-contained because the Worker can't reach into the static site.
// `backPath` returns the reader to the form they came from (/contact/ or
// /app-support/).
function errorPage(status, error, backPath = "/contact/") {
  const detail =
    error === "turnstile"
      ? "The security check could not be verified. Please go back, complete the checkbox again, and resend."
      : error === "missing-fields"
        ? "Please go back and fill in your name, a valid email address, and a message."
        : error === "rate-limited"
          ? "Several messages arrived from your connection in a short time. Please wait a minute, then go back and try again."
          : "Something went wrong sending your message. Please go back and try again in a moment.";
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Message not sent | LIT Bible</title>
<style>
  body{margin:0;background:#E1DFD9;color:#1d231c;font:1.05rem/1.5 Georgia,'Times New Roman',serif;
       min-height:100svh;display:grid;place-items:center;padding:24px}
  main{max-width:34rem;text-align:center}
  h1{font-size:2rem;margin:0 0 .6em}
  a{color:#0F6B33}
  @media(prefers-color-scheme:dark){body{background:#1a1e1a;color:#e4e2dc}a{color:#3abf6a}}
</style>
</head>
<body>
<main>
<h1>Your message didn&rsquo;t send</h1>
<p>${detail}</p>
<p><a href="${backPath}">Back to the form</a></p>
</main>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
