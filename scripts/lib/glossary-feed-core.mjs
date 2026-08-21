/**
 * glossary-feed-core.mjs
 *
 * Pure core of the glossary app feed — the `{ entries, index }` document that
 * ships as `/api/data/glossary.json`. No fs and no argv of its own:
 * `build-glossary-json.mjs` reads the collection and writes the result, so every
 * rule below is unit-testable (test/build-glossary-feed.test.js). The output
 * shape is an app contract, which is why it is tested directly rather than
 * through the writer — same arrangement as `release-notes-core.mjs`.
 *
 * WHY THIS EXISTS: `build-api-manifest.mjs` declared a top-level `glossary.json`
 * from the day the sync system was built (2026-03), pointing at a source file
 * that never existed. The declaration was optional, so the build skipped it
 * silently and the API carried no glossary data for five months while both apps
 * sat on bundled copies — Android's from 2026-03-15, iOS's from 2026-08-01, with
 * 24 of 31 definitions already different between the two platforms. This
 * generator is the missing half; it repairs that drift on devices already in the
 * wild, with no app release.
 *
 * FOUR RULES, each one a way the feed fails silently if broken:
 *
 * 1. `index` IS REQUIRED. iOS's decoder throws without it; Android ignores it.
 *    A missing `index` is not a partial failure — iOS isolates each synced file
 *    in its own error handler, so it logs, SKIPS THE HASH UPDATE, and continues.
 *    The glossary never updates and the file re-downloads on every sync forever,
 *    with no user-visible error. Strictly worse than shipping nothing.
 *    (iOS is relaxing the field to optional, but that only reaches devices via
 *    an App Store release. Emit it regardless.)
 *
 * 2. `index.traditional` keys on `traditional`, `index.lit` keys on `litMenu`.
 *    Not `menuTraditional`, not `lit`. Both are displayed text on both
 *    platforms and iOS's cross-reference lookup keys on them, so switching
 *    source fields changes what users see AND breaks in-app navigation.
 *    `lit` is wrong for 27 of 31 entries; `menuTraditional` is a site-menu
 *    label that differs from `traditional` on 3 (`Trespass/Transgression`,
 *    `Good -1-`, `Good -2-`).
 *
 * 3. BODIES ARE PLAIN PROSE. Neither app has a Markdown parser near the
 *    glossary: Android draws the body as plain text, iOS runs it through an
 *    inline HTML parser. Markdown is the one format broken on both — `*kalos*`
 *    reaches the screen with its asterisks. See `toPlainProse`.
 *
 * 4. CROSS-REFERENCES SHIP VERBATIM. iOS builds in-app glossary links by
 *    pattern-matching the literal phrase `the entry for "X"` in the prose and
 *    resolving X against the index labels. Rewriting those into Markdown or
 *    HTML links silently loses the navigation — and an `https://` anchor inside
 *    a body renders on iOS as a tappable link that does nothing, because the
 *    handler discards any scheme that isn't the internal one. Straight quotes
 *    are load-bearing; curly ones do not match. `assertCrossReferencesResolve`
 *    guards both.
 *
 * 5. `draft: true` ENTRIES ARE WITHHELD, NOT REMOVED. An entry still being
 *    written stays in `src/content/glossary/` and is excluded here, on
 *    `/glossary`, and from the SearchBar term menu. It has to stay on disk:
 *    `build-alignment.mjs` seeds its scan from these files, and a term with no
 *    entry produces no scan records, so `mergeScanWithExisting` drops every
 *    `glossary-scan` record it has — confirmed ones included, with only a
 *    warning. Deleting an entry to unpublish it would quietly discard the
 *    review behind it.
 *
 *    Drafts are still parsed and flattened, so a body that would break the
 *    build breaks it now rather than on the day it is published — the same
 *    bargain `validate-chapters.mjs` strikes by validating `indexed: false`
 *    chapters. They are excluded only from `entries`, the `index`, and the
 *    cross-reference check, since a draft may well reference another draft.
 *
 * Determinism is a hard requirement, not tidiness: the content `version` the
 * apps gate all syncing on is derived from the hashes of every synced file, so
 * unstable output would bump the version on every build and re-sync every
 * device for nothing. Entries sort by id, index keys sort, no timestamps.
 */

/** Frontmatter keys every glossary entry must carry (mirrors content.config.ts). */
const REQUIRED_FIELDS = ["id", "traditional", "greek", "lit", "litMenu", "srOnly"];

/** Emitted in this order so the JSON is byte-stable across rebuilds. */
const FIELD_ORDER = [
  "id",
  "traditional",
  "menuTraditional",
  "greek",
  "lit",
  "litMenu",
  "srOnly",
  "note",
  "body",
];

/**
 * Minimal frontmatter reader — the glossary schema is flat `key: value`, so a
 * YAML dependency would buy nothing. Note the quote stripping: `traditional:
 * "Good [1]"` is YAML quoting, and the value is `Good [1]`. Reading the raw
 * line instead is how the March 2026 generator shipped `"Good [1]"` WITH its
 * quote characters into both apps, where it rendered literally in the Study row
 * and broke that entry's cross-reference lookup.
 *
 * `build-alignment.mjs` carries a deliberate twin of this function for the same
 * files. If you change the parse here, change it there too.
 */
export function readGlossaryFrontmatter(raw) {
  const m = String(raw).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z][A-Za-z0-9_]*):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim().replace(/^["'](.*)["']$/, "$1");
  }
  return out;
}

/**
 * Is this entry held back from publication?
 *
 * Accepts a boolean or the string `"true"` because two different parsers read
 * the same frontmatter: Astro's YAML gives `content.config.ts` a real boolean,
 * while `readGlossaryFrontmatter` above is a flat line scanner that hands back
 * every value as a string. A check for `=== true` would pass every draft
 * straight into the apps' feed while `/glossary` correctly hid it.
 */
export function isDraftEntry(frontmatter) {
  const v = frontmatter?.draft;
  return v === true || v === "true";
}

/** Splits an entry file into its frontmatter object and its raw body text. */
export function parseEntryFile(raw) {
  const text = String(raw).replace(/\r\n/g, "\n");
  const frontmatter = readGlossaryFrontmatter(text);
  if (!frontmatter) return null;
  const m = text.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return { frontmatter, body: (m ? m[1] : "").trim() };
}

/**
 * Markdown body → plain prose, for apps that render neither Markdown nor
 * (on Android) HTML.
 *
 * Two things in the collection today reach a phone screen as literal syntax:
 * 59 single-asterisk emphasis spans across 23 entries (transliterated Greek —
 * `*kalos*`, `*hagios*`) and 8 backslash escapes across 3 (`\[. . .\]`, the
 * scholarly elision in `law-torah`). The August 2026 iOS copy had the asterisks
 * removed but kept the escapes, which is why `\[. . .\]` is on screen today.
 *
 * Anything this function cannot flatten THROWS rather than shipping the raw
 * markup, on the same principle as the OG card's glyph check: a build error is
 * cheap, and a literal `<em>` on a reader's phone is not. If a future entry
 * genuinely needs rich text, the upgrade path is HTML (iOS renders it today,
 * Android would need renderer work) — not Markdown, which is broken on both.
 */
export function toPlainProse(raw, label = "body") {
  let out = String(raw).replace(/\r\n/g, "\n").trim();

  // Emphasis markers, strongest first so `**x**` does not decay into `*x*`.
  out = out
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/(?<![A-Za-z0-9_])_([^_\n]+)_(?![A-Za-z0-9_])/g, "$1");

  // Unmatched markers would otherwise survive into the feed. Checked before
  // unescaping so an intentionally escaped `\*` is not mistaken for one.
  const unescapedOnly = out.replace(/\\[^\sA-Za-z0-9]/g, "");
  if (unescapedOnly.includes("*")) {
    throw new Error(
      `${label}: unmatched "*" after stripping emphasis. Plain prose cannot carry ` +
        `Markdown — reword, or pair the marker.`,
    );
  }

  // Markdown character escaping has no meaning in a plain-prose feed, and both
  // apps draw the backslash on screen.
  out = out.replace(/\\([^\sA-Za-z0-9])/g, "$1");

  const rejects = [
    [/<[A-Za-z/!][^>]*>/, "an HTML tag (Android renders it literally)"],
    [/!?\[[^\]]*\]\([^)]*\)/, "a Markdown link or image (see rule 4 in this file's header)"],
    [/^#{1,6}\s/m, "a Markdown heading"],
    [/`/, "a backtick"],
  ];
  for (const [re, what] of rejects) {
    const hit = out.match(re);
    if (hit) {
      throw new Error(`${label}: body contains ${what}: ${JSON.stringify(hit[0])}`);
    }
  }

  // Collapse the gaps that removals leave behind, without joining paragraphs.
  return out
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** iOS's cross-reference normalizer: case-folded, with `[`, `]` and `-` dropped. */
function normalizeLabel(value) {
  return String(value)
    .toLowerCase()
    .replace(/[[\]\-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fails the build on a cross-reference that would land nowhere on iOS.
 *
 * Two of these were dead for months (`bad-harmful` and `evil-hardship` both
 * point at `good [1]`/`good [2]`) and nothing reported it, because a failed
 * match just renders as plain text. Cheap to check, invisible when it rots.
 */
export function assertCrossReferencesResolve(entries, index) {
  const known = new Set(
    [...Object.keys(index.traditional), ...Object.keys(index.lit)].map(normalizeLabel),
  );
  const problems = [];
  for (const entry of entries) {
    if (/the entr(?:y|ies) for [“”]/.test(entry.body)) {
      problems.push(
        `${entry.id}: cross-reference uses curly quotes; iOS matches straight quotes only`,
      );
    }
    for (const m of entry.body.matchAll(/the entr(?:y|ies) for "([^"]+)"/g)) {
      if (!known.has(normalizeLabel(m[1]))) {
        problems.push(`${entry.id}: the entry for "${m[1]}" — no entry carries that label`);
      }
    }
  }
  if (problems.length) {
    throw new Error(
      `Glossary cross-references do not resolve:\n  ${problems.join("\n  ")}\n` +
        `iOS turns \`the entry for "X"\` into in-app navigation by matching X against ` +
        `entry labels. An unresolved one silently renders as plain text.`,
    );
  }
}

/**
 * Builds the feed from `[{ name, raw }]` file contents.
 *
 * Returns `{ feed, stats }` — the stats are for the build log only and never
 * reach the feed, which must stay byte-stable.
 */
export function buildGlossaryFeed(files) {
  const entries = [];
  const stats = { emphasisStripped: 0, escapesStripped: 0, drafts: 0 };

  for (const { name, raw } of files) {
    const parsed = parseEntryFile(raw);
    if (!parsed) throw new Error(`${name}: no frontmatter block`);
    const { frontmatter, body } = parsed;

    const missing = REQUIRED_FIELDS.filter((k) => !frontmatter[k]);
    if (missing.length) {
      throw new Error(`${name}: missing required frontmatter: ${missing.join(", ")}`);
    }

    stats.emphasisStripped += (body.match(/(?<!\*)\*(?!\*)[^*\n]+\*(?!\*)/g) || []).length;
    stats.escapesStripped += (body.match(/\\[^\sA-Za-z0-9]/g) || []).length;

    const entry = {};
    for (const key of FIELD_ORDER) {
      if (key === "body") entry.body = toPlainProse(body, name);
      else if (frontmatter[key] !== undefined) entry[key] = frontmatter[key];
    }

    // Parsed and flattened above, then dropped: a draft is checked like every
    // other entry but never published. See rule 5 in the header.
    if (isDraftEntry(frontmatter)) {
      stats.drafts++;
      continue;
    }
    entries.push(entry);
  }

  // An all-draft collection would otherwise ship a well-formed empty feed, and
  // both apps would treat that as "the glossary is now empty" rather than as a
  // build mistake.
  if (!entries.length) {
    throw new Error(
      `No publishable glossary entries: all ${stats.drafts} are marked draft: true`,
    );
  }

  entries.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const duplicateIds = entries.map((e) => e.id).filter((id, i, all) => all.indexOf(id) !== i);
  if (duplicateIds.length) {
    throw new Error(`Duplicate glossary ids: ${[...new Set(duplicateIds)].join(", ")}`);
  }

  // A collision here would silently point one label at the wrong entry.
  const index = { traditional: {}, lit: {} };
  for (const [map, field] of [
    [index.traditional, "traditional"],
    [index.lit, "litMenu"],
  ]) {
    for (const entry of entries) {
      const label = entry[field];
      if (map[label] !== undefined) {
        throw new Error(
          `Two entries share the ${field} label ${JSON.stringify(label)}: ` +
            `${map[label]} and ${entry.id}. Index labels must be unique.`,
        );
      }
      map[label] = entry.id;
    }
  }
  for (const key of Object.keys(index)) {
    index[key] = Object.fromEntries(
      Object.entries(index[key]).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    );
  }

  assertCrossReferencesResolve(entries, index);

  return { feed: { entries, index }, stats };
}
