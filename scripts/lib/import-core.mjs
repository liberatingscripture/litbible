/**
 * import-core.mjs — the pure transform layer of `scripts/import-chapter.mjs`.
 *
 * Split out for the same reason as `verse-index-core.mjs` and
 * `glossary-feed-core.mjs`: the importer writes chapter JSON, the most
 * contract-bearing artifact in the repo, and a shell that touches the
 * filesystem and `process.argv` cannot be unit-tested. Everything here is
 * pure — no fs, no argv, no exit.
 *
 * WHAT THIS LAYER GUARANTEES, and it is the whole reason the importer exists:
 *
 *   Not one visible character of the Word master reaches the JSON altered,
 *   with exactly TWO pre-approved exceptions:
 *
 *     1. straight quotes  ->  curly quotes   (the corpus convention)
 *     2. digit-hyphen-digit -> en dash       (repo-only; see CLAUDE.md)
 *
 * Everything else the importer notices — a typo, a doubled word, a quotation
 * that never closes — is REPORTED AND REFUSED, never repaired. That is an
 * owner decision and it is not a limitation to work around: the masters are
 * the origin of the translation, so a defect found during an import has to be
 * fixed in Word and re-imported, or the two sides silently diverge again. An
 * importer that quietly corrected what it found would recreate the 2026-02
 * import damage in the opposite direction, and this time with no evidence
 * that anything had changed.
 *
 * The two exceptions are safe to automate precisely because they are
 * REVERSIBLE BY RULE: `foldAllowed` folds both back out, so the fidelity gate
 * can compare master against generated and see through them. A third
 * exception could only be added by extending that fold in step.
 */

/** Footnote labels are positional: a…z, then aa…zz, then aaa…. */
const LETTERS = "abcdefghijklmnopqrstuvwxyz";
export const labelFor = (i) => LETTERS[i % 26].repeat(Math.floor(i / 26) + 1);

export const anchorFor = (label) =>
  `<sup class="fn-ref"><a id="fnref-${label}" href="#fn-${label}" role="doc-noteref">${label}</a></sup>`;

/** Deliberately loose. A false negative costs one hyphen; a false positive
 *  puts an en dash in a URL a reader would type, and breaks the link. */
export const isUrlToken = (t) =>
  t.includes("://") || /(^|\/)www\./.test(t) || /\b[a-z0-9-]+\.(?:com|org|net|edu|gov)\b/i.test(t);

/** Apply `fn` to the text between tags, never to a tag's interior — an en dash
 *  in `id="john-3-p1"` would break the anchor. */
export const mapTextNodes = (html, fn) =>
  html.split(/(<[^>]*>)/).map((p, i) => (i % 2 === 1 ? p : fn(p))).join("");

/**
 * What a reader actually sees, with footnote anchor letters removed.
 *
 * The anchors come out on purpose: Word renders a footnote reference as a
 * superscript number and the repo renders it as a letter, so the marker itself
 * is never comparable between the two sides and has to be excluded from BOTH
 * sides of the gate. (On the master side it is excluded for free — a footnote
 * reference is zero-width in Word and contributes no characters at all.)
 */
export const visibleText = (html) =>
  html
    .replace(/<sup class="fn-ref">[\s\S]*?<\/sup>/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#3[49];/g, "'");

/**
 * Fold the two pre-approved changes back out, so the gate compares only what
 * must not have moved. Whitespace runs collapse because markup carries the
 * layout: the master's paragraph break becomes a `</p><p>` and contributes no
 * character of its own.
 *
 * KEEP THIS IN STEP with the transforms above. It is what makes the guarantee
 * checkable rather than merely asserted — a transform the fold cannot undo
 * would be reported as a fidelity failure on every import.
 */
export const foldAllowed = (s) =>
  s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/–/g, "-")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Curl the straight quotes in an HTML fragment, tags untouched.
 *
 * The text nodes are concatenated and curled AS ONE STRING, then written back
 * positionally, because `curlify` is a state machine over the quotation nesting
 * and a fragment split at a `<em>` boundary would restart it mid-quotation.
 * That is safe only because `curlify` is length-preserving, which is asserted
 * rather than assumed.
 *
 * @returns {{html: string, curled: number, refusal: string|null}}
 *   `refusal` is the offending text when `curlify` declined — the quotation is
 *   unbalanced, and curling it would mean guessing which mark was intended.
 *   The master's characters are returned untouched in that case.
 */
export function curlText(html, curlify) {
  const parts = html.split(/(<[^>]*>)/);
  const spans = [];
  let text = "";
  parts.forEach((p, i) => {
    if (i % 2 === 0) {
      spans.push([i, text.length, p.length]);
      text += p;
    }
  });

  const res = curlify(text);
  if (!res.ok) return { html, curled: 0, refusal: text.slice(0, 150).replace(/\s+/g, " ") };
  if (res.result.length !== text.length) {
    throw new Error("curlify changed the text length; refusing to write back positionally");
  }

  let curled = 0;
  for (let i = 0; i < text.length; i++) if (text[i] !== res.result[i]) curled++;
  for (const [i, at, len] of spans) parts[i] = res.result.slice(at, at + len);
  return { html: parts.join(""), curled, refusal: null };
}

/** Convert digit-hyphen-digit to an en dash outside tags and URLs. */
export function enDashRanges(html) {
  let dashed = 0;
  const out = mapTextNodes(html, (t) =>
    t
      .split(/(\s+)/)
      .map((tok) => {
        if (isUrlToken(tok)) return tok;
        const next = tok.replace(/(?<=[0-9])-(?=[0-9])/g, "–");
        for (let i = 0; i < tok.length; i++) if (tok[i] !== next[i]) dashed++;
        return next;
      })
      .join("")
  );
  return { html: out, dashed };
}

/**
 * Collapse the run boundaries Word splits a styled phrase at, so
 * `<em>ekd</em><em>e</em><em>me</em><em>o</em>` arrives as `<em>ekdemeo</em>`.
 * Structural: it changes no visible character, which is why it is not one of
 * the two exceptions. Only attribute-less same-name seams merge — two real
 * `<sup class="fn-ref">` anchors in a row are a legitimate shape.
 */
export function collapseRuns(html) {
  let out = html;
  let prev;
  do {
    prev = out;
    out = out.replace(/<\/([a-z]+)><\1>/g, "");
  } while (out !== prev);
  return out;
}

/**
 * Lift a comma or semicolon out of the styled run it was typed inside, so
 * `<em>presbuteros,</em>` becomes `<em>presbuteros</em>,`.
 *
 * Structural, like `collapseRuns`: it changes no visible character, only which
 * side of a tag boundary the mark sits on. Word invites the mistake — selecting
 * a word to italicize is easy to overshoot by one character — and the corpus is
 * emphatic that the mark belongs outside: published text runs 1,133 commas
 * after a closing tag against 13 before one.
 *
 * ONLY a comma or semicolon, and that limit is the whole care of this function.
 * Terminal punctuation frequently DOES belong to the styled run — `<em>i.e.</em>`
 * would be broken by moving its period, `<em>Marana tha!</em>` owns its
 * exclamation, and an italicized book title ends in its own period. A comma
 * never belongs to a single italicized word.
 *
 * @returns {{html: string, lifted: number}}
 */
export function liftTrailingPunctuation(html) {
  let lifted = 0;
  const out = html.replace(/([,;]+)(<\/(?:em|strong|i|b)>)/g, (_, marks, close) => {
    lifted += marks.length;
    return close + marks;
  });
  return { html: out, lifted };
}

/**
 * The fidelity gate. Compare a master span against what was generated from it,
 * with both pre-approved changes folded out.
 *
 * @returns {null|{at: number, master: string, generated: string}}
 *   null when they agree; otherwise the first divergence with context. A
 *   divergence is ALWAYS a bug in the importer, never in the master — the
 *   master is the origin, so anything the importer cannot reproduce from it is
 *   something the importer got wrong. The caller must refuse to write.
 */
export function fidelityDivergence(master, generated) {
  const a = foldAllowed(master);
  const b = foldAllowed(generated);
  if (a === b) return null;
  let k = 0;
  while (k < a.length && k < b.length && a[k] === b[k]) k++;
  const window = (s) => `…${s.slice(Math.max(0, k - 55), k + 55)}…`;
  return { at: k, master: window(a), generated: window(b) };
}

/**
 * Index of the master's chapter-number heading, or -1 when there isn't one.
 *
 * A multi-chapter book prints a big chapter number before verse 1, and the
 * chapter's entry range opens ON it, because the range is anchored at the
 * "<chapter> 1" pair the scan located the chapter by. That number is a heading,
 * not scripture: left in, it becomes literal body text at the head of the first
 * paragraph (`<b>21</b> ` before verse 1). The caller drops this entry from the
 * build AND from the fidelity gate's master reconstruction, so both sides stay
 * comparable — dropping it from only one would report a divergence.
 *
 * Deliberately conservative: it matches only when the sole visible text before
 * the first verse marker is exactly the chapter number. Anything else there is
 * unexpected, and unexpected text before verse 1 is left alone for a human
 * rather than guessed at. A single-chapter book never hits this — that branch
 * anchors the range at verse 1's own digits, so the first entry is the marker.
 */
export function chapterHeadingIndex(entries, start, end, chapterNum) {
  const want = String(chapterNum);
  let found = -1;
  for (let i = start; i < end; i++) {
    const e = entries[i];
    if (e.kind === "verseMarker") return found; // reached verse 1
    if (e.kind === "break") continue;
    if (e.kind !== "text") return -1; // an anchor leads: not our shape
    const t = e.plain.trim();
    if (t === "") continue;
    if (t === want && found === -1) {
      found = i;
      continue;
    }
    return -1; // real text before verse 1: leave it, and leave the heading too
  }
  return -1;
}

/**
 * The first whitespace-delimited token after a verse marker, which is what the
 * verse number has to stay glued to.
 *
 * Word's run boundaries do not respect words. The token can therefore arrive
 * split across several runs — an opening quote in its own run (`“` + `Honestly`
 * + `, I’m telling you`), a word broken mid-letter (`t` + `here will be `), or
 * a comma orphaned from the word it follows. Reading only the FIRST run, as
 * this once did, glues just that fragment and leaves the rest outside the span:
 * `…&nbsp;“</span>Honestly,` instead of `…&nbsp;“Honestly,</span>`. The number
 * then wraps away from its word, which is the one thing `vglue` exists to
 * prevent.
 *
 * Markup inside the token is kept — `“<em>Rabbi</em>,”` (John 1:49, 11:8) is
 * the corpus shape, one token spanning a style boundary.
 *
 * Stops at anything that is not a text run: a footnote anchor or the next
 * marker ends the token where it stands. Also stops rather than splitting a
 * run that carries BOTH markup and whitespace, since slicing that by a plain
 * text offset would not survive the tags — a short span is a cosmetic loss, a
 * mangled one is not.
 *
 * @param {(j: number) => boolean} sameBlock  is entry j still in this block
 * @returns {{tokenHtml: string, tailHtml: string, nextIndex: number}}
 *   `tailHtml` is the remainder of the last run consumed, to be emitted after
 *   the span; `nextIndex` is the entry to resume the caller's loop at.
 */
export function firstTokenSpan(entries, i, end, { escapeHtml, sameBlock }) {
  let tokenHtml = "";
  let tailHtml = "";
  let j = i;
  for (; j < end; j++) {
    const e = entries[j];
    if (e.kind !== "text" || !sameBlock(j)) break;

    let html = e.html;
    let plain = e.plain;
    if (tokenHtml === "") {
      const lead = plain.replace(/^[  ]+/, ""); // Word's separator space
      if (lead === "") continue;
      html = html.slice(plain.length - lead.length);
      plain = lead;
    }

    const ws = /\s/.exec(plain);
    if (!ws) {
      tokenHtml += html; // whole run belongs to the token
      continue;
    }
    const head = escapeHtml(plain.slice(0, ws.index));
    if (!html.startsWith(head)) break; // tags or entities in the way: stop short
    tokenHtml += head;
    tailHtml = html.slice(head.length);
    j++;
    break;
  }
  return { tokenHtml, tailHtml, nextIndex: j };
}
