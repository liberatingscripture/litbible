// The display gate for the alignment dataset (src/data/alignment/): which
// records a reader may be shown, and which terms are complete enough to show
// at all. /glossary's "Where it appears" block reads it, and so does every
// other page that shows where a term appears, so the rule is stated once.
//
// THE DISPLAY RULE, and it is a publishing decision rather than a technical
// one: a partial count reads as a reviewed total. So a term appears only when
// every record we would show is one we can actually vouch for, and a single
// record we can neither vouch for nor rule out withholds the whole term.
//
//   ignored       `rejected` / `no-rendering`, and anything the Greek check
//                 contradicts (`lemma: "absent"`). A known false positive
//                 says nothing either way about the rest of the term
//   shown         a human confirmed it, or the scan matched a rendering
//                 distinctive enough that a string match is effectively
//                 certain and the Greek doesn't contradict it
//   withholds     an unreviewed match on ordinary English ("trust", "clean"),
//                 which may or may not be rendering the Greek at all
//
// That last case is what kept `sarx` off the page until its review finished:
// it also renders as the ordinary word "family", which the scan cannot tell
// from a vocative "Family," (cf. Rom 8:12).
//
// Pure: no fs, no Astro. Callers load the chapter files themselves.

/**
 * See the display rule above. Returns null for a record that says nothing.
 *
 * @param {{ status?: string, lemma?: string, confidence?: string | null }} record
 * @returns {"show" | "withhold" | null}
 */
export function verdict(record) {
  const status = record.status ?? "auto";
  if (status === "rejected" || status === "no-rendering") return null;
  if (record.lemma === "absent") return null;
  if (status === "confirmed") return "show";
  return record.confidence === "distinctive" ? "show" : "withhold";
}

/**
 * @typedef {object} GatedOccurrence
 * @property {string} bookKey
 * @property {number} chapter
 * @property {number} verse
 * @property {object} record  the alignment record itself
 */

/**
 * Fold every chapter's records into the terms that clear the gate.
 *
 * Returns term id -> rendering (`term.form`) -> one entry per shown record,
 * in the order the files and records were given. A term is left out entirely
 * when any of its records withholds it, or when none of its records is shown
 * (every one reviewed to "no rendering", say): an empty list would claim the
 * opposite of what the data says.
 *
 * Grouping is by the glossary rendering, not the written text: "Life-breath",
 * "life-breath" and "life-breaths" are one rendering to a reader. Each record
 * keeps its written variant, so Romans 8:2's deliberate "Torah"/"torah" pair
 * survives in the data even where a count shows them together.
 *
 * @param {Iterable<{ bookKey: string, chapter: number, records?: object[] }>} files
 * @returns {Map<string, Map<string, GatedOccurrence[]>>}
 */
export function gatedOccurrences(files) {
  /** @type {Map<string, { pure: boolean, forms: Map<string, GatedOccurrence[]> }>} */
  const byTerm = new Map();

  for (const { bookKey, chapter, records } of files) {
    for (const record of records ?? []) {
      const id = record.term?.glossary;
      if (!id) continue;

      const call = verdict(record);
      if (!call) continue;

      // One unvouchable record withholds the term, even though the record
      // itself contributes no count: a subtotal presented as a total is the
      // failure mode this guards against.
      let entry = byTerm.get(id);
      if (!entry) byTerm.set(id, (entry = { pure: true, forms: new Map() }));
      if (call === "withhold") {
        entry.pure = false;
        continue;
      }

      const form = record.term?.form;
      if (!form) continue;

      let list = entry.forms.get(form);
      if (!list) entry.forms.set(form, (list = []));
      list.push({
        bookKey,
        chapter,
        verse: Number(String(record.ref).split(".").pop()),
        record,
      });
    }
  }

  const out = new Map();
  for (const [id, entry] of byTerm) {
    if (!entry.pure || !entry.forms.size) continue;
    out.set(id, entry.forms);
  }
  return out;
}
