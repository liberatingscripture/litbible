// scripts/lib/greek-core.mjs
//
// The pure half of `npm run build:greek` (the data behind the Study Desk's Greek
// tab, phase 1f). No fs, no argv: scripts/build-greek.mjs reads the sources and
// writes public/greek/, and everything that decides what a file says lives here
// so test/greek-core.test.js can reach it.
//
// What this builds, and from what (the files themselves sit outside the repo
// and are never committed; see public/greek/LICENSE.txt for the credits):
//
//   text/    SBL's SBLGNT (the text of record), word by word, with the lemma and
//            parsing of MorphGNT. MorphGNT lacks John 7:53–8:11 and Romans
//            16:25–27, so those borrow: the first from MACULA's SBLGNT data, the
//            second from the SBLGNT apparatus (the Greek) and MACULA's Nestle
//            1904 (the parsing). Each borrowed run says so in `borrowed`.
//   ubs/     The UBS Greek New Testament Dictionary, markup flattened to prose.
//   step/    STEPBible's brief lexicon (TBESG), HTML sanitized.
//   lsj/     STEPBible's formatted LSJ, HTML sanitized.
//
// The rule behind every join in here: never silently misalign. Where two
// sources disagree about a verse, nothing is carried across it and the
// disagreement goes into the report the shell prints.

export const GREEK_FORMAT = 1;

// ------------------------------------------------------------------- folding

/** NFC, because the sources disagree about how they compose accented Greek. */
export const nfc = (s) => String(s ?? "").normalize("NFC");

// SBL's data writes the elision mark U+02BC where MorphGNT writes U+2019; two
// capitals also differ. Neither is a different word (CLAUDE.md, "Translation
// Source Text"), so a comparison folds them.
const APOSTROPHES = /[’ʼ'ʹ᾽᾿]/g;
export const foldGreek = (s) => nfc(s).replace(APOSTROPHES, "’").toLowerCase();
export const sameWord = (a, b) => foldGreek(a) === foldGreek(b);

/**
 * A looser fold for the borrowed passages, whose sources are other editions of
 * the text: accents, breathing, diaeresis and punctuation are ignored, so
 * "δέ" meets "δὲ" and "εἰσιν;;" meets "εἰσιν".
 */
export const relaxGreek = (s) =>
  nfc(s)
    .replace(APOSTROPHES, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLowerCase();

const decodeEntities = (s) =>
  String(s)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

// ------------------------------------------------------------------ SBLGNT XML

/** "Romans 16:24" -> { chapter: 16, verse: 24 }; null when it isn't a reference. */
export function parseVerseId(id) {
  const m = /(\d+):(\d+)\s*$/.exec(String(id ?? ""));
  return m ? { chapter: Number(m[1]), verse: Number(m[2]) } : null;
}

const TAG = /<(\/?)([A-Za-z][A-Za-z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>|([^<]+)|(<)/g;

function attr(attrs, name) {
  const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(attrs);
  return m ? decodeEntities(m[1] ?? m[2]) : null;
}

/**
 * Reads one SBLGNT book file (data/sblgnt/xml/<Book>.xml). SBL's markup is
 * flat: a `<p>` holds `<verse-number id="Romans 1:1">`, then for each word an
 * optional `<prefix>`, the `<w>`, and its `<suffix>`.
 *
 * Returns { title, paragraphs } where a paragraph is a list of
 * { chapter, verse, text, prefix, suffix }. A paragraph is cut wherever the
 * chapter changes, since the site files one chapter per JSON file.
 */
export function parseSblXml(xml) {
  const paragraphs = [];
  let title = null;
  let current = null;
  let chapter = null;
  let verse = null;
  let pendingPrefix = "";
  let last = null; // the word whose <suffix> comes next
  // What the text between tags belongs to.
  let inside = null;
  let buf = "";

  const startParagraph = () => {
    current = [];
    paragraphs.push(current);
    last = null;
  };

  TAG.lastIndex = 0;
  for (let m = TAG.exec(xml); m; m = TAG.exec(xml)) {
    if (m[5] !== undefined) {
      if (inside) buf += m[5];
      continue;
    }
    const closing = m[1] === "/";
    const name = m[2];
    if (!closing) {
      if (name === "p") {
        startParagraph();
      } else if (name === "title" && !current) {
        inside = "title";
        buf = "";
      } else if (name === "verse-number") {
        const ref = parseVerseId(attr(m[3], "id"));
        if (ref) {
          if (ref.chapter !== chapter) {
            // Cut the paragraph at the chapter boundary, so a chapter's file
            // never holds the next chapter's first words.
            if (current && current.length) startParagraph();
            chapter = ref.chapter;
          }
          verse = ref.verse;
        }
        inside = "verse-number";
        buf = "";
      } else if (name === "w" || name === "prefix" || name === "suffix") {
        inside = name;
        buf = "";
      }
      if (m[4] === "/" && (name === "prefix" || name === "suffix")) {
        // <suffix/> is empty by definition.
        if (name === "suffix" && last) last.suffix = "";
        if (name === "prefix") pendingPrefix = "";
        inside = null;
      }
    } else {
      if (name === "title" && inside === "title") {
        title = decodeEntities(buf).trim();
        inside = null;
      } else if (name === "w" && inside === "w") {
        if (!current) startParagraph();
        last = { chapter, verse, text: decodeEntities(buf), prefix: pendingPrefix, suffix: "" };
        pendingPrefix = "";
        current.push(last);
        inside = null;
      } else if (name === "prefix" && inside === "prefix") {
        pendingPrefix = decodeEntities(buf);
        inside = null;
      } else if (name === "suffix" && inside === "suffix") {
        if (last) last.suffix = decodeEntities(buf);
        inside = null;
      } else if (name === "verse-number") {
        inside = null;
      }
    }
  }
  return { title, paragraphs: paragraphs.filter((p) => p.length) };
}

const endsInSpace = (s) => /\s$/.test(s);
const startsWithSpace = (s) => /^\s/.test(s);

/**
 * SBL leaves the plain space between two words implicit (an empty suffix) and
 * only writes one where it carries punctuation or a text-critical sign. The
 * Greek tab joins words by concatenating `pre + text + post`, so the space has
 * to be explicit in the data:
 *
 *   post  the suffix, plus a space unless it already ends in one or in an em
 *         dash (SBL's "no space" mark, never followed by one);
 *   pre   the prefix without its leading space, which now lives in the
 *         previous word's `post` (the first word of a paragraph just loses it).
 *
 * Joining the result reproduces SBL's printed text exactly. Returns plain
 * [{ chapter, verse, text, pre, post }].
 */
export function spaceWords(words) {
  return words.map((w, i) => {
    const next = words[i + 1];
    let post = w.suffix;
    if (next) {
      if (startsWithSpace(next.prefix)) {
        if (!endsInSpace(post)) post += " ";
      } else if (!endsInSpace(post) && !post.endsWith("—")) {
        post += " ";
      }
    }
    return {
      chapter: w.chapter,
      verse: w.verse,
      text: w.text,
      pre: w.prefix.replace(/^\s+/, ""),
      post,
    };
  });
}

// ----------------------------------------------------------------- apparatus

/**
 * Reads one SBLGNT apparatus file (data/sblgntapp/xml/<Book>.xml): a `<verse>`
 * line naming "Romans 1:1", then its `<note>` lines. Returns a list of
 * { chapter, verse, notes: [string] } in file order.
 */
export function parseApparatusXml(xml) {
  const out = [];
  let current = null;
  const re = /<verse>([^<]*)<\/verse>|<note>([\s\S]*?)<\/note>/g;
  for (let m = re.exec(xml); m; m = re.exec(xml)) {
    if (m[1] !== undefined) {
      const ref = parseVerseId(m[1]);
      current = ref ? { ...ref, notes: [] } : null;
      if (current) out.push(current);
    } else if (current) {
      const note = nfc(decodeEntities(m[2])).replace(/\s+/g, " ").trim();
      if (note) current.notes.push(note);
    }
  }
  return out;
}

const SIGLA = new Set(["WH", "Treg", "NA28", "RP", "NIV", "NA27", "TR", "Byz"]);

/**
 * The Greek that Romans 16:24's second apparatus note prints for the doxology
 * ("Ἀμήν RP ] 25 Τῷ δὲ δυναμένῳ … 26 … 27 … ἀμήν. WH Treg NA28"): the part
 * after "]", cut before the trailing witnesses. Returns { 25: "…", 26: "…",
 * 27: "…" } or null when the note doesn't have that shape.
 */
export function doxologyFromNotes(notes) {
  for (const note of notes) {
    const at = note.indexOf("]");
    if (at < 0) continue;
    const words = note.slice(at + 1).trim().split(/\s+/);
    while (words.length && SIGLA.has(words[words.length - 1])) words.pop();
    const verses = {};
    let v = null;
    for (const w of words) {
      if (/^\d+$/.test(w) && (v === null ? w === "25" : Number(w) === v + 1)) {
        v = Number(w);
        verses[v] = [];
      } else if (v !== null) {
        verses[v].push(w);
      }
    }
    if (v === 27) return Object.fromEntries(Object.entries(verses).map(([k, ws]) => [k, ws.join(" ")]));
  }
  return null;
}

const TRAILING_PUNCT = /[,.·;:!?]+$/;
const GREEK_LETTER = /[\p{Script=Greek}]/u;

/**
 * One verse of apparatus Greek as words: punctuation joins the word it follows
 * (`post`, with the space after it), as SBL's own suffixes do, and a leading
 * bracket or parenthesis belongs to the word it opens (`pre`).
 */
export function tokenizeApparatusGreek(text, verse) {
  const out = [];
  for (const chunk of nfc(text).split(/\s+/).filter(Boolean)) {
    let pre = "";
    let word = chunk;
    let post = "";
    const tail = TRAILING_PUNCT.exec(word);
    if (tail) {
      post = tail[0];
      word = word.slice(0, tail.index);
    }
    const head = /^[(\[⟦]+/.exec(word);
    if (head) {
      pre = head[0];
      word = word.slice(head[0].length);
    }
    const close = /[)\]⟧]+$/.exec(word);
    if (close) {
      post = close[0] + post;
      word = word.slice(0, close.index);
    }
    if (!word || !GREEK_LETTER.test(word)) continue;
    out.push({ verse, text: word, pre, post: post + " " });
  }
  return out;
}

// ----------------------------------------------------------- MACULA TSV and codes

// MACULA's book codes, in the order of BOOK_ORDER.
export const MACULA_BOOKS = [
  "MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH", "2TH",
  "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD", "REV",
];

/**
 * Reads a MACULA Greek TSV (SBLGNT or Nestle 1904) into
 * Map<"JHN 7:53", [{ text, lemma, strong, morph, person, number, gender, case,
 * tense, voice, mood, degree }]>, words in verse order. Only the grammatical
 * fields are kept. The `ln`/`domain` columns are permission-only and are never
 * read.
 */
export function parseMaculaTsv(tsv) {
  const lines = tsv.split(/\r?\n/);
  const head = lines[0].split("\t");
  const col = (name) => head.indexOf(name);
  const idx = {
    ref: col("ref"), text: col("text"), lemma: col("lemma"), strong: col("strong"), morph: col("morph"),
    person: col("person"), number: col("number"), gender: col("gender"), case: col("case"),
    tense: col("tense"), voice: col("voice"), mood: col("mood"), degree: col("degree"),
  };
  for (const [k, v] of Object.entries(idx)) if (v < 0) throw new Error(`MACULA TSV has no "${k}" column`);
  const out = new Map();
  for (const line of lines.slice(1)) {
    if (!line) continue;
    const c = line.split("\t");
    const m = /^(\S+ \d+:\d+)!(\d+)$/.exec(c[idx.ref]);
    if (!m) continue;
    const word = { n: Number(m[2]) };
    for (const [k, v] of Object.entries(idx)) if (k !== "ref") word[k] = c[v] ?? "";
    word.text = nfc(word.text);
    word.lemma = nfc(word.lemma);
    let list = out.get(m[1]);
    if (!list) out.set(m[1], (list = []));
    list.push(word);
  }
  return out;
}

// MACULA's part-of-speech prefix (Robinson's) to MorphGNT's two-letter code.
// Where the two schemes sort a word differently (MorphGNT files "οὐ" under
// adverbs, MACULA under particles; "ὅτι" is a conjunction in one and an adverb
// in the other) no table can be right for every word, so the builder passes a
// hint learned from the words both sources parse (see `posHints`).
const POS_BY_PREFIX = {
  N: "N-", V: "V-", A: "A-", T: "RA", P: "RP", R: "RR", D: "RD", I: "RI", X: "RI", Q: "RI",
  K: "RR", F: "RP", S: "A-", C: "RP", CONJ: "C-", COND: "C-", PREP: "P-", ADV: "D-", PRT: "X-",
  INJ: "I-", HEB: "N-", ARAM: "N-",
};
const TENSE = { present: "P", imperfect: "I", future: "F", aorist: "A", perfect: "X", pluperfect: "Y" };
const VOICE = { active: "A", middle: "M", passive: "P", middlepassive: "M" };
const MOOD = {
  indicative: "I", imperative: "D", subjunctive: "S", optative: "O", infinitive: "N", participle: "P",
};
const CASE = { nominative: "N", genitive: "G", dative: "D", accusative: "A", vocative: "V" };
const NUMBER = { singular: "S", plural: "P" };
const GENDER = { masculine: "M", feminine: "F", neuter: "N" };
const PERSON = { first: "1", second: "2", third: "3" };
const DEGREE = { comparative: "C", superlative: "S" };

/** The key a pos hint is stored under: MACULA's prefix and the lemma. */
export const posHintKey = (word) => `${String(word.morph).split("-")[0]}\t${nfc(word.lemma)}`;

/**
 * A MACULA word's part of speech and parsing as MorphGNT writes them
 * ({ pos: "V-", parse: "3AAI-S--" }): person, tense, voice, mood, case, number,
 * gender, degree. MACULA spells the fields out; this puts the letters back.
 * A field MACULA leaves empty is "-". Person is kept only where MACULA gives it
 * (verbs): MorphGNT leaves it out of pronouns, so "P-1GS" parses "----GS--".
 *
 * @param {object} word one row from parseMaculaTsv
 * @param {Map<string,string>} [hints] posHintKey -> MorphGNT pos
 */
export function maculaToMorph(word, hints) {
  const prefix = String(word.morph).split("-")[0];
  // Middle-or-passive forms: MorphGNT calls an aorist or future one (the
  // deponent -θη- type) passive and every other one middle.
  const voice =
    word.voice === "middlepassive" ? (word.tense === "aorist" || word.tense === "future" ? "P" : "M") : VOICE[word.voice];
  const parse =
    (PERSON[word.person] ?? "-") +
    (TENSE[word.tense] ?? "-") +
    (voice ?? "-") +
    (MOOD[word.mood] ?? "-") +
    (CASE[word.case] ?? "-") +
    (NUMBER[word.number] ?? "-") +
    (GENDER[word.gender] ?? "-") +
    (DEGREE[word.degree] ?? "-");
  const pos = hints?.get(posHintKey(word)) ?? POS_BY_PREFIX[prefix] ?? null;
  return { pos, parse };
}

/**
 * Learns, from words both sources parse, which MorphGNT part of speech goes
 * with each (MACULA prefix, lemma): the most common one wins, ties to the
 * first seen. `pairs` is [[maculaWord, morphPos]].
 */
export function posHints(pairs) {
  const tally = new Map();
  for (const [word, pos] of pairs) {
    const key = posHintKey(word);
    let counts = tally.get(key);
    if (!counts) tally.set(key, (counts = new Map()));
    counts.set(pos, (counts.get(pos) ?? 0) + 1);
  }
  const out = new Map();
  for (const [key, counts] of tally) {
    let best = null;
    for (const [pos, n] of counts) if (!best || n > best[1]) best = [pos, n];
    out.set(key, best[0]);
  }
  return out;
}

/** MACULA's strong number "4561" -> "G4561"; null for blank or odd values. */
export function strongKey(n) {
  const m = /^G?0*(\d+)[A-Za-z]?$/.exec(String(n ?? "").trim());
  return m && Number(m[1]) > 0 ? `G${Number(m[1])}` : null;
}

// ---------------------------------------------------------------- verse joins

/**
 * Whether SBL's words and another source's words for the same verse are the
 * same words in the same order. Returns null when they are, else a short
 * description of the first disagreement for the report.
 */
export function compareVerse(sblWords, otherForms) {
  if (sblWords.length !== otherForms.length) {
    return `${sblWords.length} words in SBL, ${otherForms.length} in the other source`;
  }
  for (let i = 0; i < sblWords.length; i++) {
    if (!sameWord(sblWords[i].text, otherForms[i])) {
      return `word ${i + 1}: SBL "${sblWords[i].text}", other "${otherForms[i]}"`;
    }
  }
  return null;
}

/**
 * Pairs two lists of words by longest common subsequence of their folded forms.
 * Used where the sources are different editions and counts can differ (the
 * apparatus Greek against Nestle 1904): returns [[i, j]] index pairs for the
 * words that match, in order. A word with no partner is left out, never
 * paired with a neighbour.
 */
export function alignByForm(a, b, fold = foldGreek) {
  const fa = a.map(fold);
  const fb = b.map(fold);
  const dp = Array.from({ length: fa.length + 1 }, () => new Array(fb.length + 1).fill(0));
  for (let i = fa.length - 1; i >= 0; i--) {
    for (let j = fb.length - 1; j >= 0; j--) {
      dp[i][j] = fa[i] === fb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const pairs = [];
  let i = 0;
  let j = 0;
  while (i < fa.length && j < fb.length) {
    if (fa[i] === fb[j]) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

// ---------------------------------------------------------------- shard numbers

/** UBS entries: two digits, the first six digits of MainId modulo 64. */
export function ubsShard(mainId) {
  return String(Number(String(mainId).slice(0, 6)) % 64).padStart(2, "0");
}

const strongDigits = (key) => Number(String(key).replace(/\D/g, ""));

/** STEP brief lexicon: two digits, the Strong's number modulo 64. */
export function stepShard(key) {
  return String(strongDigits(key) % 64).padStart(2, "0");
}

/** STEP full LSJ: three digits, the Strong's number modulo 128. */
export function lsjShard(key) {
  return String(strongDigits(key) % 128).padStart(3, "0");
}

// ----------------------------------------------------------------------- UBS

// UBS numbers its books 040 (Matthew) to 066 (Revelation), in NT order.
export const UBS_FIRST_BOOK = 40;

/** UBS StrongCodes "G0006" -> "G6". */
export const ubsStrong = (code) => strongKey(code);

/**
 * Flattens the markup UBS writes inline into plain text:
 *   {D:8.1}   -> "8.1"           a domain or entry code
 *   {S:04500202800030} -> "Romans 2:28"   a scripture reference
 *   {L:ἀγάπη<SDBG:…>} -> "ἀγάπη"          a link to another entry
 *   {N:001}   -> removed          a call to a footnote
 *   anything else {X:…} -> removed, and counted in `unknown` by its letter.
 *
 * @param {string} text
 * @param {(book:number, chapter:number, verse:number) => string|null} refLabel
 * @param {Record<string, number>} [unknown] tally the shell reports
 */
export function flattenUbsMarkup(text, refLabel, unknown = {}) {
  if (!text) return "";
  const out = String(text).replace(/\{([A-Za-z]+):([^}]*)\}/g, (_, kind, body) => {
    if (kind === "D") return body.trim();
    if (kind === "N") return "";
    if (kind === "L") return body.replace(/<[^>]*>?$/, "").trim();
    if (kind === "S") {
      const m = /^(\d{3})(\d{3})(\d{3})/.exec(body.trim());
      const label = m && refLabel(Number(m[1]), Number(m[2]), Number(m[3]));
      if (label) return label;
      unknown.S = (unknown.S ?? 0) + 1;
      return "";
    }
    unknown[kind] = (unknown[kind] ?? 0) + 1;
    return "";
  });
  return nfc(out.replace(/[ \t]+/g, " ").replace(/\s+([,.;:)])/g, "$1").trim());
}

const clean = (v) => (v === undefined || v === null || v === "" ? undefined : v);

/**
 * One UBS entry as the file the Greek tab reads. `senses` has one element per
 * LEXMeaning, flattened across BaseForms in order, even for a meaning with
 * nothing to say: a word's `sense` is an index into this list, so it must never
 * shift. Empty fields are omitted.
 */
export function ubsEntryShard(entry, refLabel, unknown = {}) {
  const senses = [];
  for (const base of entry.BaseForms ?? []) {
    for (const meaning of base.LEXMeanings ?? []) {
      const sense = (meaning.LEXSenses ?? []).find((s) => s.LanguageCode === "en") ?? meaning.LEXSenses?.[0] ?? {};
      const flat = (t) => flattenUbsMarkup(t, refLabel, unknown);
      const glosses = (sense.Glosses ?? []).map(flat).filter(Boolean);
      const out = {
        code: clean(meaning.LEXEntryCode),
        domain: clean((meaning.LEXDomains ?? []).map((d) => d.Domain).filter(Boolean).join("; ")),
        subdomain: clean((meaning.LEXSubDomains ?? []).map((d) => d.Domain).filter(Boolean).join("; ")),
        def: clean(flat(sense.DefinitionShort) || flat(sense.DefinitionLong)),
        glosses: glosses.length ? glosses : undefined,
        comment: clean(flat(sense.Comments)),
      };
      for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
      senses.push(out);
    }
  }
  return { lemma: nfc(entry.Lemma), senses };
}

/**
 * Every place an entry's meanings are cited: Map<"book:chapter:verse",
 * [{ pos, sense }]>, `pos` UBS's own word position in that verse, `sense` the
 * index into the flattened meanings. References carry a trailing footnote call
 * on a few ("04002001500038{N:001}"), which is not part of the address.
 */
export function ubsSenseRefs(entry) {
  const out = new Map();
  let sense = 0;
  for (const base of entry.BaseForms ?? []) {
    for (const meaning of base.LEXMeanings ?? []) {
      for (const ref of meaning.LEXReferences ?? []) {
        const m = /^(\d{3})(\d{3})(\d{3})(\d{5})/.exec(ref);
        if (!m) continue;
        const key = `${Number(m[1])}:${Number(m[2])}:${Number(m[3])}`;
        let list = out.get(key);
        if (!list) out.set(key, (list = []));
        if (!list.some((r) => r.pos === Number(m[4]) && r.sense === sense)) list.push({ pos: Number(m[4]), sense });
      }
      sense++;
    }
  }
  return out;
}

/** lemma (NFC) -> UBS entry: the headword first, then AlternateLemmas. */
export function ubsLemmaIndex(entries) {
  const primary = new Map();
  const alternate = new Map();
  for (const e of entries) {
    if (!primary.has(nfc(e.Lemma))) primary.set(nfc(e.Lemma), e);
    for (const alt of e.AlternateLemmas ?? []) {
      if (!alternate.has(nfc(alt))) alternate.set(nfc(alt), e);
    }
  }
  return {
    find: (lemma) => primary.get(nfc(lemma)) ?? alternate.get(nfc(lemma)) ?? null,
  };
}

/**
 * The sense UBS assigns at each occurrence of one lemma in one verse, or null.
 *
 * `refs` are UBS's citations of the lemma's entry in the verse ({pos, sense}),
 * `count` how many times the lemma occurs in the verse in our text. UBS counts
 * words in its own text, so positions can't be compared, only ordered: the kth
 * occurrence takes the sense of the kth smallest position. When UBS cites the
 * lemma a different number of times than we have occurrences, order says
 * nothing, so the senses are assigned only if every citation points at the same
 * one (then every occurrence gets it); otherwise every occurrence is null.
 *
 * @returns {(number|null)[]} one entry per occurrence, in verse order
 */
export function matchSenses(refs, count) {
  const none = new Array(count).fill(null);
  if (!refs || !refs.length) return none;
  const sorted = [...refs].sort((a, b) => a.pos - b.pos || a.sense - b.sense);
  if (sorted.length === count) return sorted.map((r) => r.sense);
  const senses = new Set(sorted.map((r) => r.sense));
  return senses.size === 1 ? new Array(count).fill(sorted[0].sense) : none;
}

// --------------------------------------------------------------- HTML sanitizer

const escText = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => escText(s).replace(/"/g, "&quot;");

/**
 * Reduces STEPBible's lexicon HTML to a closed allowlist, because it is set as
 * HTML in the reader's page:
 *   <b>, <i>, <br>            kept (any case, self-closing or not)
 *   <ref='1Co.15.39'>…</ref>  -> <span class="lex-ref">…</span>, attribute gone
 *   <a href="javascript:void(0)" title="…">…</a>
 *                             -> <abbr title="…">…</abbr>, title escaped; no
 *                                href survives, so no link can
 *   every other tag           dropped, its text kept
 * Text is entity-decoded and escaped afresh, so a stray `&` or `<` can't open
 * anything. Tags the source left unclosed are closed at the end, and a closing
 * tag with no opener is dropped, so the result is always balanced.
 * STEP marks an indented line with leading underscores (`<br>__1.`); those
 * become two no-break spaces.
 */
export function sanitizeLexiconHtml(html) {
  const out = [];
  // What is open in the output, innermost last: the source tag it stands for
  // and the closing markup to write when it ends.
  const stack = [];
  const open = (src, markup, closer) => {
    out.push(markup);
    stack.push({ src, closer });
  };
  const close = (src) => {
    let at = stack.length - 1;
    while (at >= 0 && stack[at].src !== src) at--;
    if (at < 0) return;
    while (stack.length > at) out.push(stack.pop().closer);
  };

  TAG.lastIndex = 0;
  const s = String(html ?? "");
  for (let m = TAG.exec(s); m; m = TAG.exec(s)) {
    if (m[5] !== undefined) {
      out.push(escText(decodeEntities(m[5])));
    } else if (m[6] !== undefined) {
      out.push("&lt;");
    } else {
      const closing = m[1] === "/";
      const name = m[2].toLowerCase();
      if (name === "b" || name === "i") {
        if (closing) close(name);
        else open(name, `<${name}>`, `</${name}>`);
      } else if (name === "br") {
        if (!closing) out.push("<br>");
      } else if (name === "ref") {
        if (closing) close("ref");
        else open("ref", '<span class="lex-ref">', "</span>");
      } else if (name === "a") {
        if (closing) close("a");
        else {
          const title = attr(m[3], "title");
          if (title) open("a", `<abbr title="${escAttr(title)}">`, "</abbr>");
          else open("a", "", "");
        }
      }
      // Any other tag: dropped, its text stays.
    }
  }
  while (stack.length) out.push(stack.pop().closer);
  return out
    .join("")
    .replace(/(<br>)\s*_{2,}/g, "$1  ")
    .trim();
}

// -------------------------------------------------------------------- STEP rows

/**
 * Reads a STEPBible lexicon file into rows. A data row starts with an extended
 * Strong's number ("G4561") and has eight tab-separated columns: eStrong,
 * dStrong, uStrong, Greek, transliteration, morph, gloss, meaning (HTML). Header
 * and licence text before the table is skipped. Rows whose number has no digits
 * to key on are dropped.
 */
export function parseStepLexicon(text) {
  const rows = [];
  for (const line of String(text).split(/\r?\n/)) {
    if (!/^G\d/.test(line)) continue;
    const c = line.split("\t");
    if (c.length < 8) continue;
    const key = strongKey(c[0]);
    if (!key) continue;
    rows.push({
      key,
      dStrong: c[1],
      greek: nfc(c[3]),
      translit: nfc(c[4]),
      gloss: c[6].trim(),
      html: c.slice(7).join("\t"),
    });
  }
  return rows;
}

/** The brief lexicon's rows as the files the Greek tab reads. Entries are { lemma, translit, gloss, html }. */
export function stepEntries(rows) {
  const by = new Map();
  for (const r of rows) {
    const list = by.get(r.key) ?? by.set(r.key, []).get(r.key);
    list.push({ lemma: r.greek, translit: r.translit, gloss: r.gloss, html: sanitizeLexiconHtml(r.html) });
  }
  return by;
}

/** The full LSJ's rows, { lemma, html }, keyed the same way. */
export function lsjEntries(rows, into = new Map()) {
  for (const r of rows) {
    const list = into.get(r.key) ?? into.set(r.key, []).get(r.key);
    list.push({ lemma: r.greek, html: sanitizeLexiconHtml(r.html) });
  }
  return into;
}

/**
 * Drops, within each Strong's number, an entry whose lemma and html are
 * identical to an earlier one (the lexicon files repeat some rows, G2424 three
 * times), keeping the order of the rest. Only the numbers in `wanted` are
 * touched when it is given. Changes the map in place and returns how many
 * entries it dropped.
 */
export function dropDuplicateEntries(entries, wanted = null) {
  let dropped = 0;
  for (const [key, list] of entries) {
    if (wanted && !wanted.has(key)) continue;
    const seen = new Set();
    const kept = list.filter((e) => {
      const id = JSON.stringify([e.lemma, e.html]);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    dropped += list.length - kept.length;
    if (kept.length !== list.length) entries.set(key, kept);
  }
  return dropped;
}

/**
 * Splits keyed entries into shard objects: Map<shardName, {key: entries}>.
 * Keys are sorted so the output is byte-stable. Only keys in `wanted` (a Set)
 * are kept when it is given.
 */
export function shardEntries(entries, shardOf, wanted = null) {
  const shards = new Map();
  const keys = [...entries.keys()].filter((k) => !wanted || wanted.has(k)).sort((a, b) => strongDigits(a) - strongDigits(b));
  for (const key of keys) {
    const name = shardOf(key);
    let shard = shards.get(name);
    if (!shard) shards.set(name, (shard = {}));
    shard[key] = entries.get(key);
  }
  return shards;
}

// ------------------------------------------------------------- lemma bridges

/**
 * Walks words both MACULA's SBLGNT data and MorphGNT parse and pairs them up.
 * The two list the same words in the same order wherever the verse is the same
 * text; a verse where the counts or forms disagree yields null, so a pair is
 * only ever two readings of one word. Returns [[maculaWord, morphToken]].
 */
export function pairMaculaWithMorph(maculaRows, tokens) {
  if (!maculaRows || !tokens || maculaRows.length !== tokens.length) return null;
  for (let i = 0; i < tokens.length; i++) if (!sameWord(maculaRows[i].text, tokens[i].word)) return null;
  return tokens.map((t, i) => [maculaRows[i], t]);
}

/**
 * Tallies the Strong's number MACULA gives each MorphGNT lemma and returns
 * Map<lemma, "G4561">: the most common one, the lower number on a tie, so the
 * result doesn't depend on the order words were read in.
 */
export function strongByLemma(pairs) {
  const tally = new Map();
  for (const [row, token] of pairs) {
    const key = strongKey(row.strong);
    if (!key) continue;
    const lemma = nfc(token.lemma);
    let counts = tally.get(lemma);
    if (!counts) tally.set(lemma, (counts = new Map()));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const out = new Map();
  for (const [lemma, counts] of tally) {
    let best = null;
    for (const [key, n] of counts) {
      if (!best || n > best[1] || (n === best[1] && strongDigits(key) < strongDigits(best[0]))) best = [key, n];
    }
    out.set(lemma, best[0]);
  }
  return out;
}

/** TBESG's Greek field can list forms ("α, Ἀλφα"); the headword is the first. */
export const headword = (greek) => nfc(String(greek).split(",")[0]).trim();

/**
 * Resolves what the lemma table says about a lemma: its Strong's number, its
 * UBS entry and a short English gloss.
 *
 *   Strong's  the most common MACULA number for words with this MorphGNT lemma,
 *             else the number MACULA gave the word being looked up (a borrowed
 *             word MorphGNT never saw), else the UBS entry's first StrongCode,
 *             else the brief lexicon's entry for that Greek headword.
 *   UBS       matched on the headword, then on its alternate spellings.
 *   gloss     UBS's first gloss, else the brief lexicon's gloss for the number.
 *
 * Tallies what it could not resolve into `stats` for the report.
 */
export function makeLemmaResolver({ lemmaStrong, ubsIndex, tbesgByGreek, tbesgGloss, stats }) {
  const cache = new Map();
  stats.noStrong ??= new Set();
  stats.noUbs ??= new Set();
  stats.usedUbs ??= new Set();
  stats.strongFrom ??= {};

  return function resolve(lemma, ownStrong = null) {
    const key = nfc(lemma);
    const own = strongKey(ownStrong);
    const cached = cache.get(key);
    if (cached && (cached.strong || !own)) return cached;

    const entry = ubsIndex.find(key);
    let strong = lemmaStrong.get(key) ?? null;
    let from = strong ? "macula" : null;
    if (!strong && own) [strong, from] = [own, "macula-own"];
    if (!strong && entry) {
      strong = (entry.StrongCodes ?? []).map(ubsStrong).find(Boolean) ?? null;
      if (strong) from = "ubs";
    }
    if (!strong) {
      strong = tbesgByGreek.get(key) ?? null;
      if (strong) from = "tbesg";
    }
    if (!cached) {
      if (entry) stats.usedUbs.add(entry.MainId);
      else stats.noUbs.add(key);
    }
    if (strong) {
      stats.noStrong.delete(key);
      if (!cached || !cached.strong) stats.strongFrom[from] = (stats.strongFrom[from] ?? 0) + 1;
    } else {
      stats.noStrong.add(key);
    }

    let gloss = null;
    for (const base of entry?.BaseForms ?? []) {
      for (const meaning of base.LEXMeanings ?? []) {
        const sense = (meaning.LEXSenses ?? []).find((s) => s.LanguageCode === "en") ?? meaning.LEXSenses?.[0];
        const first = (sense?.Glosses ?? []).map((g) => flattenUbsMarkup(g, () => null)).find(Boolean);
        if (first && !gloss) gloss = first;
      }
    }
    if (!gloss && strong) gloss = tbesgGloss.get(strong) || null;

    const out = { strong, entry, ubsId: entry ? entry.MainId : null, gloss };
    cache.set(key, out);
    return out;
  };
}

/**
 * How often the corpus gives each sense to each lemma: Map<lemma, Map<sense, n>>,
 * counted over the built chapter files' words.
 */
export function countSenses(docs) {
  const out = new Map();
  for (const doc of docs) {
    for (const para of doc.paragraphs) {
      for (const word of para) {
        const sense = word[8];
        if (sense === null || word[5] < 0) continue;
        const lemma = doc.lemmas[word[5]][0];
        let counts = out.get(lemma);
        if (!counts) out.set(lemma, (counts = new Map()));
        counts.set(sense, (counts.get(sense) ?? 0) + 1);
      }
    }
  }
  return out;
}

/**
 * The gloss shown for a lemma: the first gloss of the UBS sense the corpus
 * assigns it most often (ties to the earlier sense). A sense with no gloss is
 * passed over for the next most common. With no assigned sense at all, or none
 * of them glossed, `fallback` stands: the entry's first gloss, else the brief
 * lexicon's.
 *
 * @param {object|null} entry UBS entry
 * @param {Map<number, number>} [counts] sense index -> words
 * @param {string|null} fallback
 */
export function pickGloss(entry, counts, fallback = null) {
  if (!entry || !counts || !counts.size) return fallback;
  const firstGloss = [];
  for (const base of entry.BaseForms ?? []) {
    for (const meaning of base.LEXMeanings ?? []) {
      const sense = (meaning.LEXSenses ?? []).find((s) => s.LanguageCode === "en") ?? meaning.LEXSenses?.[0];
      firstGloss.push((sense?.Glosses ?? []).map((g) => flattenUbsMarkup(g, () => null)).find(Boolean) ?? null);
    }
  }
  const ranked = [...counts].sort((x, y) => y[1] - x[1] || x[0] - y[0]);
  for (const [sense] of ranked) if (firstGloss[sense]) return firstGloss[sense];
  return fallback;
}

// ------------------------------------------------------------------ the chapters

export const BORROWED_JOHN = "macula-sblgnt";
export const BORROWED_DOXOLOGY = "sblgnt-apparatus+macula-nestle1904";

/** An empty report, the shape buildBook fills in. */
export function newReport() {
  return {
    emptyChapters: [],
    mismatches: [],
    morphOnly: [],
    borrowFailed: [],
    borrowPartial: [],
    doxologyUnmatched: [],
    wordsFromMorphgnt: 0,
    wordsFromMacula: 0,
    wordsFromNestle: 0,
    senses: { assigned: 0, noRefs: 0, ambiguous: 0, noEntry: 0 },
  };
}

/** Consecutive runs of numbers as [first, last] pairs. */
function runs(numbers) {
  const sorted = [...numbers].sort((x, y) => x - y);
  const out = [];
  for (const n of sorted) {
    const last = out[out.length - 1];
    if (last && n === last[1] + 1) last[1] = n;
    else out.push([n, n]);
  }
  return out;
}

/**
 * Builds every chapter file of one book.
 *
 * @param {object} a
 * @param {string} a.bookKey
 * @param {number} a.chapters           how many chapters the book has
 * @param {{title:string|null, paragraphs:object[][]}} a.sbl   parseSblXml
 * @param {{chapter:number, verse:number, notes:string[]}[]} a.apparatus
 * @param {(chapter:number, verse:number) => object[]|undefined} a.morphVerse  MorphGNT tokens
 * @param {(chapter:number, verse:number) => object[]|undefined} a.maculaVerse MACULA SBLGNT rows
 * @param {(chapter:number, verse:number) => object[]|undefined} a.nestleVerse MACULA Nestle 1904 rows
 * @param {Map<string,string>} a.hints   posHints
 * @param {ReturnType<typeof makeLemmaResolver>} a.resolveLemma
 * @param {(entry:object) => Map<string, {pos:number,sense:number}[]>} a.ubsRefs  ubsSenseRefs, cached
 * @param {number} a.ubsBook             UBS's number for this book (40 = Matthew)
 * @param {object} a.report              newReport()
 * @returns {object[]} chapter objects, index 0 = chapter 1
 */
export function buildBook(a) {
  const { bookKey, report } = a;
  const byChapter = new Map();
  for (const para of a.sbl.paragraphs) {
    const c = para[0].chapter;
    let list = byChapter.get(c);
    if (!list) byChapter.set(c, (list = []));
    list.push(spaceWords(para));
  }
  const out = [];

  for (let chapter = 1; chapter <= a.chapters; chapter++) {
    const paras = byChapter.get(chapter) ?? [];
    if (!paras.length) report.emptyChapters.push(`${bookKey} ${chapter}`);
    const apparatusRows = a.apparatus.filter((r) => r.chapter === chapter);

    // Romans 16:24's note prints the Greek of the doxology SBL leaves out.
    const doxology =
      bookKey === "romans" && chapter === 16 ? doxologyFromNotes(apparatusRows.flatMap((r) => r.notes)) : null;

    // One row per word; `t` is its place in its verse.
    const rows = [];
    const verseRows = new Map();
    const takeVerse = (verse, row) => {
      let list = verseRows.get(verse);
      if (!list) verseRows.set(verse, (list = []));
      list.push(row);
      row.t = list.length;
      rows.push(row);
    };
    paras.forEach((words, p) => {
      for (const w of words) {
        takeVerse(w.verse, { paragraph: p, ...w, t: 0, lemma: null, pos: null, parse: null, strong: null, sense: null });
      }
    });

    // Lemma and parsing, from MorphGNT wherever it has the verse.
    const borrowedVerses = [];
    for (const [verse, vrows] of verseRows) {
      const where = `${bookKey} ${chapter}:${verse}`;
      const tokens = a.morphVerse(chapter, verse);
      if (tokens) {
        const why = compareVerse(vrows, tokens.map((t) => t.word));
        if (why) {
          report.mismatches.push(`${where}: ${why}`);
          continue;
        }
        vrows.forEach((r, i) => {
          r.lemma = nfc(tokens[i].lemma);
          r.pos = tokens[i].pos;
          r.parse = tokens[i].parse;
        });
        report.wordsFromMorphgnt += vrows.length;
        continue;
      }
      // MorphGNT has nothing for this verse. MACULA's SBLGNT data carries the
      // same text (John 7:53–8:11), so take its lemma and parsing, if it agrees.
      const maculaRows = a.maculaVerse(chapter, verse);
      if (!maculaRows) {
        report.borrowFailed.push(`${where}: in neither MorphGNT nor MACULA`);
        continue;
      }
      // The same text word for word, or else a different edition of it:
      // then pair the words that match and leave the others unparsed.
      let pairs;
      if (!compareVerse(vrows, maculaRows.map((m) => m.text))) {
        pairs = vrows.map((_, i) => [i, i]);
      } else {
        pairs = alignByForm(vrows.map((r) => r.text), maculaRows.map((m) => m.text), relaxGreek);
        const lost = vrows.filter((_, i) => !pairs.some(([x]) => x === i)).map((r) => r.text);
        if (lost.length) report.borrowPartial.push(`${where}: no MACULA word for ${lost.map((w) => `"${w}"`).join(", ")}`);
      }
      if (!pairs.length) {
        report.borrowFailed.push(`${where}: no word in common with MACULA`);
        continue;
      }
      for (const [i, j] of pairs) {
        const conv = maculaToMorph(maculaRows[j], a.hints);
        const r = vrows[i];
        r.lemma = maculaRows[j].lemma;
        r.pos = conv.pos;
        r.parse = conv.parse;
        r.strong = maculaRows[j].strong;
      }
      report.wordsFromMacula += pairs.length;
      borrowedVerses.push(verse);
    }
    // A verse MorphGNT has and our text lacks is a disagreement too.
    for (let v = 1; v <= 200; v++) {
      if (!verseRows.has(v) && a.morphVerse(chapter, v)) report.morphOnly.push(`${bookKey} ${chapter}:${v}`);
    }
    const borrowed = runs(borrowedVerses).map(([first, last]) => [first, last, BORROWED_JOHN]);

    // The doxology: its own paragraph after 16:24.
    if (doxology) {
      const paragraph = paras.length;
      const verses = Object.keys(doxology).map(Number).sort((x, y) => x - y);
      for (const verse of verses) {
        const words = tokenizeApparatusGreek(doxology[verse], verse);
        const nestle = a.nestleVerse(chapter, verse) ?? [];
        const pairs = new Map(alignByForm(words.map((w) => w.text), nestle.map((n) => n.text), relaxGreek));
        words.forEach((w, i) => {
          const row = {
            paragraph, chapter, verse, text: w.text, pre: w.pre, post: w.post,
            t: 0, lemma: null, pos: null, parse: null, strong: null, sense: null,
          };
          takeVerse(verse, row);
          const j = pairs.get(i);
          if (j === undefined) {
            report.doxologyUnmatched.push(`${bookKey} ${chapter}:${verse} "${w.text}"`);
            return;
          }
          const conv = maculaToMorph(nestle[j], a.hints);
          row.lemma = nestle[j].lemma;
          row.pos = conv.pos;
          row.parse = conv.parse;
          row.strong = nestle[j].strong;
          report.wordsFromNestle++;
        });
      }
      borrowed.push([verses[0], verses[verses.length - 1], BORROWED_DOXOLOGY]);
    }

    // The lemma table, in order of first use.
    const lemmaIndex = new Map();
    const lemmas = [];
    for (const r of rows) {
      if (!r.lemma || lemmaIndex.has(r.lemma)) continue;
      const info = a.resolveLemma(r.lemma, r.strong);
      lemmaIndex.set(r.lemma, lemmas.length);
      lemmas.push([r.lemma, info.strong, info.ubsId, info.gloss]);
    }

    // UBS's sense at each word: per verse, per lemma, by occurrence.
    for (const [verse, vrows] of verseRows) {
      const byLemma = new Map();
      for (const r of vrows) {
        if (!r.lemma) continue;
        let list = byLemma.get(r.lemma);
        if (!list) byLemma.set(r.lemma, (list = []));
        list.push(r);
      }
      for (const [lemma, list] of byLemma) {
        const info = a.resolveLemma(lemma);
        if (!info.entry) {
          report.senses.noEntry += list.length;
          continue;
        }
        const refs = a.ubsRefs(info.entry).get(`${a.ubsBook}:${chapter}:${verse}`);
        const senses = matchSenses(refs, list.length);
        list.forEach((r, i) => {
          r.sense = senses[i];
          if (senses[i] !== null) report.senses.assigned++;
          else if (!refs || !refs.length) report.senses.noRefs++;
          else report.senses.ambiguous++;
        });
      }
    }

    const doc = { format: GREEK_FORMAT, book: bookKey, chapter };
    if (chapter === 1 && a.sbl.title) doc.title = nfc(a.sbl.title);
    doc.paragraphs = [];
    for (const r of rows) {
      (doc.paragraphs[r.paragraph] ??= []).push([
        r.verse,
        r.t,
        nfc(r.text),
        nfc(r.pre),
        nfc(r.post),
        r.lemma ? lemmaIndex.get(r.lemma) : -1,
        r.lemma ? r.pos : null,
        r.lemma ? r.parse : null,
        r.sense,
      ]);
    }
    doc.lemmas = lemmas;
    doc.apparatus = apparatusRows.map((r) => [r.verse, r.notes]);
    if (borrowed.length) doc.borrowed = borrowed;
    out.push(doc);
  }
  return out;
}
