// Record identity, merge, and ordering for src/data/alignment/.
//
// These files are the one generated artifact in the repo that is COMMITTED,
// because they carry human review state. So every write is a merge, and the
// merge rules are the contract between the two writers:
//
//   build-alignment.mjs   rescans the English text and re-derives records
//   scripts/alignment-review/  records what a human concluded
//
// The asymmetry that drives the rules: the scanner can only find renderings the
// glossary already lists, and the whole point of the review tool is to capture
// the ones it doesn't ("blasphemia" is glossed "disrespectfulness" but the text
// reads "contemptuous speech"). A review record therefore usually has NO
// counterpart in a rescan, and must survive one anyway.
//
// STATUS VOCABULARY
//   auto           written by the scanner, unreviewed
//   confirmed      a human checked this rendering in this verse
//   no-rendering   a human checked and found no distinct rendering here
//                  (english: [], term.form: null — a first-class answer)
//   rejected       a human ruled this scan record a false positive. Flipped in
//                  place, source stays "glossary-scan", so the next rescan
//                  matches it by key and can't resurrect it.

/**
 * Stable identity for merging across runs.
 *
 * Tolerates BOTH record shapes on purpose. A `no-rendering` record has
 * `english: []` and `term.form: null`; before this was hardened, one such
 * record made readExisting() throw, swallow the error, and silently discard
 * every preserved status in that chapter file.
 *
 * `(ref, glossary, "", 0)` is the no-rendering key, and it is unique per
 * (verse, term) — which is correct: a verse can only have one such answer.
 */
export function recordKey(r) {
  const glossary = r?.term?.glossary ?? "";
  const first = r?.english?.[0];
  const text = first?.text == null ? "" : String(first.text).toLowerCase();
  const n = Number.isFinite(first?.n) ? first.n : 0;
  return `${r?.ref ?? ""}|${glossary}|${text}|${n}`;
}

const verseOf = (r) => {
  const v = Number(String(r?.ref ?? "").split(".").pop());
  return Number.isFinite(v) ? v : 0;
};
const formOf = (r) => String(r?.english?.[0]?.text ?? "").toLowerCase();
const nOf = (r) => (Number.isFinite(r?.english?.[0]?.n) ? r.english[0].n : 0);
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Canonical on-disk order. Deliberately independent of how a record was
 * produced: sorting by source or status would make the file churn every time a
 * review session ran, burying the real change in the diff.
 */
export function sortRecords(records) {
  return [...records].sort(
    (a, b) =>
      verseOf(a) - verseOf(b) ||
      cmp(a?.term?.glossary ?? "", b?.term?.glossary ?? "") ||
      cmp(formOf(a), formOf(b)) ||
      nOf(a) - nOf(b),
  );
}

/**
 * Fold a fresh scan of one chapter into what's already on disk.
 *
 * @param {object} args
 * @param {object[]} args.scanned freshly derived records for this chapter
 * @param {Map<string, object>} args.existing recordKey -> record, from disk
 * @param {boolean} args.corpusAvailable whether MorphGNT was loaded this run
 * @returns {{ records: object[], preserved: number, carried: number,
 *             stale: {key: string, record: object}[] }}
 */
export function mergeScanWithExisting({ scanned, existing, corpusAvailable = true }) {
  const out = [];
  const seen = new Set();
  const stale = [];
  let preserved = 0;
  let carried = 0;

  for (const r of scanned) {
    const key = recordKey(r);
    seen.add(key);
    const prev = existing.get(key);

    if (prev && prev.status !== "auto") {
      // Keep the WHOLE prior record, not just its status. A reviewed record can
      // carry hand-edits the scanner has no way to re-derive — a corrected
      // `term.form`, a phase-2 `greek` array — and donating only a field or two
      // discards them without a word.
      out.push(prev);
      preserved++;
      continue;
    }

    // Without the corpus we have nothing to say about the Greek, so keep
    // whatever the last verified run concluded rather than blanking it.
    if (!corpusAvailable && prev?.lemma) r.lemma = prev.lemma;
    out.push(r);
  }

  for (const [key, prev] of existing) {
    if (seen.has(key)) continue;

    if (prev?.source !== "glossary-scan") {
      // A record the scanner cannot independently rediscover — a rendering the
      // glossary doesn't list, or a "no distinct rendering here" verdict.
      // Capturing exactly these is why the review tool exists, so it is carried
      // forward unconditionally.
      out.push(prev);
      carried++;
      continue;
    }

    // A scan record the scan no longer produces: the English text changed under
    // it. Reviewed ones are worth a warning; unreviewed ones just go.
    if (prev.status !== "auto") stale.push({ key, record: prev });
  }

  return { records: sortRecords(out), preserved, carried, stale };
}

/**
 * Write one reviewer decision about one (verse, term) pair.
 *
 * The pair is treated as a FULLY OWNED SLOT: every prior record for it is
 * replaced by `records`. That is what lets a decision reject the scanner's
 * proposal and substitute a different span in one atomic step.
 *
 * The consequence, and it is load-bearing: a verse where the term is rendered
 * TWICE must submit both spans in ONE call. Two sequential single-span writes
 * would have the second silently delete the first.
 *
 * @param {object} args
 * @param {object[]} args.existingRecords every record in the chapter file
 * @param {string} args.ref e.g. "Rom.8.3"
 * @param {string} args.termGlossary glossary id
 * @param {object[]} [args.records] the new records for this slot (may be empty)
 */
export function applyReviewDecision({ existingRecords, ref, termGlossary, records = [] }) {
  const kept = existingRecords.filter(
    (r) => !(r?.ref === ref && r?.term?.glossary === termGlossary),
  );
  return sortRecords([...kept, ...records]);
}

/**
 * Bulk-reject by identity key — the Absent tab's one action.
 *
 * Rejection rather than deletion: a deleted scan record is re-created by the
 * very next `npm run build:alignment`, so the verdict has to live in the file.
 */
export function rejectRecordsByKey({ existingRecords, keys }) {
  const wanted = keys instanceof Set ? keys : new Set(keys);
  let changed = 0;
  const records = existingRecords.map((r) => {
    if (!wanted.has(recordKey(r)) || r.status === "rejected") return r;
    changed++;
    return { ...r, status: "rejected" };
  });
  return { records, changed };
}
