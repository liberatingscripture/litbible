// The Greek tab's data builder (scripts/lib/greek-core.mjs).
//
// No disk and none of the real sources: every case is a few lines of inline XML,
// TSV or JSON shaped like the file it stands for. What these tests hold in
// place is the part nobody would notice going wrong by eye: a sense number that
// points one meaning off, a word joined to the wrong parsing, a lexicon's
// markup reaching a reader's page as live HTML, and a joined text that no
// longer reproduces SBL's.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  alignByForm,
  buildBook,
  compareVerse,
  dropDuplicateEntries,
  countSenses,
  doxologyFromNotes,
  flattenUbsMarkup,
  lsjShard,
  makeLemmaResolver,
  matchSenses,
  maculaToMorph,
  newReport,
  pairMaculaWithMorph,
  parseApparatusXml,
  parseMaculaTsv,
  parseSblXml,
  parseStepLexicon,
  pickGloss,
  posHints,
  relaxGreek,
  sanitizeLexiconHtml,
  shardEntries,
  spaceWords,
  stepShard,
  strongByLemma,
  strongKey,
  tokenizeApparatusGreek,
  ubsEntryShard,
  ubsLemmaIndex,
  ubsSenseRefs,
  ubsShard,
} from "../scripts/lib/greek-core.mjs";

// ── the SBLGNT XML ───────────────────────────────────────────────────────────

const w = (text, suffix = "", prefix = null) =>
  `${prefix === null ? "" : `<prefix>${prefix}</prefix>`}<w>${text}</w><suffix>${suffix}</suffix>`;

const BOOK_XML = `<book id="Ro"><title>ΠΡΟΣ ΡΩΜΑΙΟΥΣ</title>
<p><verse-number id="Romans 1:1">1:1</verse-number>${w("Παῦλος")}${w("δοῦλος")}${w("Χριστοῦ", "", " ⸂")}${w("Ἰησοῦ", "⸃, ")}${w("κλητὸς", "—")}${w("ἀπόστολος", ". ")}
<verse-number id="Romans 1:2">2</verse-number>${w("ὃ")}${w("προεπηγγείλατο", ". ")}</p>
<p><verse-number id="Romans 2:1">1</verse-number>${w("Διό", "· ")}</p></book>`;

test("a book parses into paragraphs of words with their chapter and verse", () => {
  const { title, paragraphs } = parseSblXml(BOOK_XML);
  assert.equal(title, "ΠΡΟΣ ΡΩΜΑΙΟΥΣ");
  assert.equal(paragraphs.length, 2);
  assert.deepEqual(paragraphs[0].map((x) => x.verse), [1, 1, 1, 1, 1, 1, 2, 2]);
  assert.equal(paragraphs[0][2].prefix, " ⸂");
  assert.equal(paragraphs[0][3].suffix, "⸃, ");
});

test("a paragraph is cut where the chapter changes, even mid-paragraph", () => {
  const xml = `<book><p><verse-number id="Mark 1:45">45</verse-number>${w("α", ". ")}<verse-number id="Mark 2:1">1</verse-number>${w("β", ". ")}</p></book>`;
  const { paragraphs } = parseSblXml(xml);
  assert.deepEqual(paragraphs.map((p) => p.map((x) => [x.chapter, x.verse, x.text])), [[[1, 45, "α"]], [[2, 1, "β"]]]);
});

test("joining pre + text + post reproduces SBL's printed text", () => {
  const [para] = parseSblXml(BOOK_XML).paragraphs;
  const joined = spaceWords(para).map((x) => x.pre + x.text + x.post).join("");
  // An empty suffix is the plain space; a prefix brings its own; an em dash and
  // the end of the paragraph are followed by none.
  assert.equal(joined, "Παῦλος δοῦλος ⸂Χριστοῦ Ἰησοῦ⸃, κλητὸς—ἀπόστολος. ὃ προεπηγγείλατο. ");
});

test("the space before a sign lives in the previous word, never in `pre`", () => {
  const [para] = parseSblXml(BOOK_XML).paragraphs;
  const words = spaceWords(para);
  assert.equal(words[1].post, " ");
  assert.equal(words[2].pre, "⸂");
  assert.equal(words[2].post, " ");
  assert.ok(words.every((x) => !/^\s/.test(x.pre)));
});

test("the first word of a paragraph loses the space its prefix carries", () => {
  const xml = `<book><p><verse-number id="John 7:53">53</verse-number>${w("καὶ", "", " ⟦")}${w("ἐπορεύθη", ". ")}</p></book>`;
  const [para] = parseSblXml(xml).paragraphs;
  const words = spaceWords(para);
  assert.equal(words[0].pre, "⟦");
  assert.equal(words.map((x) => x.pre + x.text + x.post).join(""), "⟦καὶ ἐπορεύθη. ");
});

// ── the apparatus ────────────────────────────────────────────────────────────

const APP_XML = `<book><book-name>ΠΡΟΣ ΡΩΜΑΙΟΥΣ</book-name>
<verse>Romans 1:1</verse>
<note>1:1 Χριστοῦ Ἰησοῦ Treg NA28 ] Ἰησοῦ Χριστοῦ WH RP</note>

<verse>Romans 16:24</verse>
<note>24 Ἡ χάρις … ὑμῶν RP ] – WH Treg NA28 </note>
<note>• Ἀμήν RP ] 25 Τῷ δὲ δυναμένῳ ὑμᾶς στηρίξαι, 26 φανερωθέντος δὲ νῦν, 27 μόνῳ σοφῷ θεῷ· ἀμήν. WH Treg NA28</note>
</book>`;

test("apparatus notes are kept per verse, in order, trimmed", () => {
  const rows = parseApparatusXml(APP_XML);
  assert.deepEqual(rows.map((r) => [r.chapter, r.verse, r.notes.length]), [[1, 1, 1], [16, 24, 2]]);
  assert.equal(rows[1].notes[0], "24 Ἡ χάρις … ὑμῶν RP ] – WH Treg NA28");
});

test("the doxology is read out of Romans 16:24's second note, witnesses cut", () => {
  const rows = parseApparatusXml(APP_XML);
  assert.deepEqual(doxologyFromNotes(rows[1].notes), {
    25: "Τῷ δὲ δυναμένῳ ὑμᾶς στηρίξαι,",
    26: "φανερωθέντος δὲ νῦν,",
    27: "μόνῳ σοφῷ θεῷ· ἀμήν.",
  });
  assert.equal(doxologyFromNotes(rows[0].notes), null);
});

test("apparatus Greek tokenizes with its punctuation as `post`", () => {
  const words = tokenizeApparatusGreek("σοφῷ θεῷ· ἀμήν.", 27);
  assert.deepEqual(
    words.map((x) => [x.text, x.pre, x.post]),
    [["σοφῷ", "", " "], ["θεῷ", "", "· "], ["ἀμήν", "", ". "]],
  );
  assert.equal(words.map((x) => x.pre + x.text + x.post).join(""), "σοφῷ θεῷ· ἀμήν. ");
});

// ── MACULA codes ─────────────────────────────────────────────────────────────

const TSV_HEAD = "xml:id\tref\trole\tclass\ttype\tenglish\tmandarin\tgloss\ttext\tafter\tlemma\tnormalized\tstrong\tmorph\tperson\tnumber\tgender\tcase\ttense\tvoice\tmood\tdegree\tdomain\tln\tframe\tsubjref\treferent";
const tsvRow = (ref, text, lemma, strong, morph, f = {}) =>
  [
    "n1", ref, "", "", "", "", "", "", text, " ", lemma, text, strong, morph,
    f.person ?? "", f.number ?? "", f.gender ?? "", f.case ?? "", f.tense ?? "", f.voice ?? "", f.mood ?? "", f.degree ?? "",
    "", "", "", "", "",
  ].join("\t");

const TSV = [
  TSV_HEAD,
  tsvRow("JHN 7:53!1", "Καὶ", "καί", "2532", "CONJ"),
  tsvRow("JHN 7:53!2", "ἐπορεύθη", "πορεύομαι", "4198", "V-AOI-3S", { person: "third", number: "singular", tense: "aorist", voice: "passive", mood: "indicative" }),
  tsvRow("JHN 7:53!3", "ἕκαστος", "ἕκαστος", "1538", "A-NSM", { number: "singular", gender: "masculine", case: "nominative" }),
  tsvRow("JHN 7:53!4", "αὐτοῦ", "αὐτός", "846", "P-GSM", { number: "singular", gender: "masculine", case: "genitive" }),
  tsvRow("ROM 16:25!1", "δυναμένῳ", "δύναμαι", "1410", "V-PDP-DSM", { number: "singular", gender: "masculine", case: "dative", tense: "present", voice: "middlepassive", mood: "participle" }),
].join("\n");

test("MACULA's spelled-out fields become MorphGNT's letters, for a verb", () => {
  const row = parseMaculaTsv(TSV).get("JHN 7:53")[1];
  assert.deepEqual(maculaToMorph(row), { pos: "V-", parse: "3API-S--" });
});

test("MACULA's fields become MorphGNT's letters, for a noun-like word", () => {
  const row = parseMaculaTsv(TSV).get("JHN 7:53")[2];
  assert.deepEqual(maculaToMorph(row), { pos: "A-", parse: "----NSM-" });
});

test("a pronoun keeps no person, as MorphGNT leaves it out", () => {
  const row = parseMaculaTsv(TSV).get("JHN 7:53")[3];
  assert.deepEqual(maculaToMorph(row), { pos: "RP", parse: "----GSM-" });
});

test("a middle-or-passive present participle is middle; an aorist one passive", () => {
  const present = parseMaculaTsv(TSV).get("ROM 16:25")[0];
  assert.equal(maculaToMorph(present).parse, "-PMPDSM-");
  assert.equal(maculaToMorph({ ...present, tense: "aorist" }).parse, "-APPDSM-");
});

test("a part-of-speech hint learned from MorphGNT overrides the prefix table", () => {
  const row = parseMaculaTsv(TSV).get("JHN 7:53")[0]; // CONJ -> C- by default
  assert.equal(maculaToMorph(row).pos, "C-");
  const hints = posHints([[row, "D-"], [row, "D-"], [row, "C-"]]);
  assert.equal(maculaToMorph(row, hints).pos, "D-");
});

test("MACULA rows group by verse in word order, and the licence-restricted columns are not kept", () => {
  const rows = parseMaculaTsv(TSV);
  assert.deepEqual(rows.get("JHN 7:53").map((r) => r.n), [1, 2, 3, 4]);
  assert.ok(!("ln" in rows.get("JHN 7:53")[0]) && !("domain" in rows.get("JHN 7:53")[0]));
});

test("a Strong's number is normalized, and blanks are refused", () => {
  assert.equal(strongKey("4561"), "G4561");
  assert.equal(strongKey("G0006"), "G6");
  assert.equal(strongKey(""), null);
  assert.equal(strongKey("0"), null);
});

test("MACULA and MorphGNT pair only where a verse agrees word for word", () => {
  const rows = parseMaculaTsv(TSV).get("JHN 7:53");
  const tokens = rows.map((r) => ({ word: r.text, lemma: r.lemma, pos: "X-", parse: "--------" }));
  assert.equal(pairMaculaWithMorph(rows, tokens).length, 4);
  assert.equal(pairMaculaWithMorph(rows, tokens.slice(1)), null);
  assert.equal(pairMaculaWithMorph(rows, [{ ...tokens[0], word: "Δὲ" }, ...tokens.slice(1)]), null);
});

test("a lemma's Strong's number is the most common one, the lower on a tie", () => {
  const row = (strong) => ({ strong });
  const tok = (lemma) => ({ lemma });
  const out = strongByLemma([
    [row("100"), tok("α")], [row("100"), tok("α")], [row("7"), tok("α")],
    [row("30"), tok("β")], [row("20"), tok("β")],
  ]);
  assert.equal(out.get("α"), "G100");
  assert.equal(out.get("β"), "G20");
});

// ── joins between sources ────────────────────────────────────────────────────

test("a verse's words must agree with the other source in count and form", () => {
  const sbl = [{ text: "Ἐν" }, { text: "ἀρχῇ" }];
  assert.equal(compareVerse(sbl, ["ἐν", "ἀρχῇ"]), null); // case folded
  assert.match(compareVerse(sbl, ["ἐν"]), /2 words in SBL, 1/);
  assert.match(compareVerse(sbl, ["ἐν", "ἀρχή"]), /word 2/);
});

test("the elision mark is folded: SBL's U+02BC meets MorphGNT's U+2019", () => {
  assert.equal(compareVerse([{ text: "κατʼ" }], ["κατ’"]), null);
});

test("an alignment pairs matching words in order and leaves the others out", () => {
  const pairs = alignByForm(["α", "β", "γ", "δ"], ["α", "γ", "δ", "ε"]);
  assert.deepEqual(pairs, [[0, 0], [2, 1], [3, 2]]);
  // The looser fold used for borrowed passages ignores accents and punctuation.
  assert.deepEqual(alignByForm(["δὲ", "εἰσιν"], ["δέ", "εἰσιν;;"], relaxGreek), [[0, 0], [1, 1]]);
  assert.equal(relaxGreek("καθʼ"), relaxGreek("καθ’"));
});

// ── UBS ──────────────────────────────────────────────────────────────────────

const label = (book, chapter, verse) => (book === 45 ? `Romans ${chapter}:${verse}` : null);

test("UBS markup flattens to plain text", () => {
  const unknown = {};
  const out = flattenUbsMarkup(
    "Like σώμα ({D:8.1}) in {S:04500202800030}; see {L:ἀγάπη<SDBG:ἀγάπη:000000>}{N:001} and {Q:zzz}.",
    label,
    unknown,
  );
  assert.equal(out, "Like σώμα (8.1) in Romans 2:28; see ἀγάπη and.");
  assert.deepEqual(unknown, { Q: 1 });
});

test("a scripture reference outside the New Testament is removed and counted", () => {
  const unknown = {};
  assert.equal(flattenUbsMarkup("see {S:00100100100000} here", label, unknown), "see here");
  assert.deepEqual(unknown, { S: 1 });
});

const ENTRY = {
  MainId: "004463000000000",
  Lemma: "σάρξ",
  StrongCodes: ["G4561"],
  AlternateLemmas: ["σαρξ"],
  BaseForms: [
    {
      LEXMeanings: [
        {
          LEXEntryCode: "8.63",
          LEXDomains: [{ Domain: "Body" }],
          LEXSubDomains: [{ Domain: "Parts" }],
          LEXSenses: [{ LanguageCode: "en", DefinitionShort: "the flesh", Glosses: ["flesh"], Comments: "See {S:04500202800030}.{N:001}" }],
          LEXReferences: ["04500800300010", "04500800300030{N:001}"],
        },
        { LEXEntryCode: "", LEXDomains: null, LEXSenses: [{ LanguageCode: "en", DefinitionShort: "", Glosses: [] }], LEXReferences: [] },
      ],
    },
    {
      LEXMeanings: [
        {
          LEXEntryCode: "9.1",
          LEXDomains: [{ Domain: "People" }],
          LEXSenses: [{ LanguageCode: "en", DefinitionShort: "a human being", Glosses: ["person"] }],
          LEXReferences: ["04500800300020"],
        },
      ],
    },
  ],
};

test("a UBS entry keeps one sense per meaning, empty ones too, so indexes never shift", () => {
  const shard = ubsEntryShard(ENTRY, label);
  assert.equal(shard.lemma, "σάρξ");
  assert.equal(shard.senses.length, 3);
  assert.deepEqual(shard.senses[0], {
    code: "8.63", domain: "Body", subdomain: "Parts", def: "the flesh", glosses: ["flesh"], comment: "See Romans 2:28.",
  });
  assert.deepEqual(shard.senses[1], {});
  assert.equal(shard.senses[2].def, "a human being");
});

test("UBS citations are indexed by verse, with the sense each points at", () => {
  const refs = ubsSenseRefs(ENTRY).get("45:8:3");
  assert.deepEqual(refs, [{ pos: 10, sense: 0 }, { pos: 30, sense: 0 }, { pos: 20, sense: 2 }]);
});

test("a lemma finds its UBS entry by headword, then by alternate spelling", () => {
  const index = ubsLemmaIndex([ENTRY]);
  assert.equal(index.find("σάρξ"), ENTRY);
  assert.equal(index.find("σαρξ"), ENTRY);
  assert.equal(index.find("ἄλλο"), null);
});

test("with equal counts, the kth occurrence takes the kth citation in position order", () => {
  const refs = [{ pos: 30, sense: 4 }, { pos: 10, sense: 1 }];
  assert.deepEqual(matchSenses(refs, 2), [1, 4]);
});

test("with unequal counts and one sense, every occurrence takes it", () => {
  assert.deepEqual(matchSenses([{ pos: 4, sense: 2 }, { pos: 9, sense: 2 }, { pos: 20, sense: 2 }], 2), [2, 2]);
  assert.deepEqual(matchSenses([{ pos: 4, sense: 2 }], 3), [2, 2, 2]);
});

test("with unequal counts and mixed senses, nothing is guessed", () => {
  assert.deepEqual(matchSenses([{ pos: 4, sense: 2 }, { pos: 9, sense: 3 }], 3), [null, null, null]);
});

test("a lemma UBS never cites in the verse gets no sense", () => {
  assert.deepEqual(matchSenses(undefined, 2), [null, null]);
  assert.deepEqual(matchSenses([], 1), [null]);
});

// ── the lexicon HTML ─────────────────────────────────────────────────────────

test("bold, italic and line breaks survive; <BR /> becomes <br>", () => {
  assert.equal(sanitizeLexiconHtml("<b>σάρξ</b>, <i>gen.</i> <BR /> next<br/>"), "<b>σάρξ</b>, <i>gen.</i> <br> next<br>");
});

test("<ref='…'> becomes a lex-ref span with no attribute but the class", () => {
  assert.equal(
    sanitizeLexiconHtml("see <ref='1Co.15.39'>1Co.15:39</ref>."),
    'see <span class="lex-ref">1Co.15:39</span>.',
  );
});

test("a javascript: link becomes an <abbr> with an escaped title, and no href", () => {
  const out = sanitizeLexiconHtml('<a href="javascript:void(0)" title="4th c.BC: A &amp; B “x” &lt;i&gt;">Refs</a>');
  assert.equal(out, '<abbr title="4th c.BC: A &amp; B “x” &lt;i&gt;">Refs</abbr>');
  assert.ok(!/href|javascript/.test(out));
});

test("a title that tries to break out of its attribute cannot", () => {
  const out = sanitizeLexiconHtml(`<a href="x" title='" onmouseover="alert(1)'>Refs</a>`);
  assert.equal(out, '<abbr title="&quot; onmouseover=&quot;alert(1)">Refs</abbr>');
});

test("an ordinary link, scripts and unknown tags are dropped, their text kept", () => {
  assert.equal(
    sanitizeLexiconHtml('<a href="https://example.com">x</a><script>alert(1)</script><Level3>y</Level3><img src=z onerror=q>'),
    "xalert(1)y",
  );
});

test("text is escaped afresh, so a stray & or < cannot open anything", () => {
  assert.equal(sanitizeLexiconHtml("a &amp; b & c < d &lt;script&gt;"), "a &amp; b &amp; c &lt; d &lt;script&gt;");
});

test("unclosed tags are closed and stray closers dropped, so the result is balanced", () => {
  assert.equal(sanitizeLexiconHtml("</i><b>open <i>both"), "<b>open <i>both</i></b>");
});

test("STEP's leading underscores for an indented line become spaces", () => {
  assert.equal(sanitizeLexiconHtml("<br>__1. first"), "<br>  1. first");
});

// ── lexicon rows and shards ──────────────────────────────────────────────────

const STEP_TEXT = [
  "TBESG - header text that is not a row",
  "G0001\tG0001G =\tG0001G\tα, Ἀλφα\tAlpha\tG:N-LI\tAlpha\t <b>Α</b> the first letter",
  "G4561\tG4561 =\tG4561\tσάρξ\tsarx\tG:N-F\tflesh\t <b>σάρξ</b> <BR />flesh",
  "G4561\tG4561 =\tG4561b\tσάρξ\tsarx\tG:N-F\tbody\t second",
  "G21502\tG21502 =\tG21502\tΗνια\tHenia\tG:N-PRI\tHeneia\tman",
].join("\n");

test("lexicon rows are read, keyed without leading zeros, header text skipped", () => {
  const rows = parseStepLexicon(STEP_TEXT);
  assert.deepEqual(rows.map((r) => r.key), ["G1", "G4561", "G4561", "G21502"]);
  assert.equal(rows[0].greek, "α, Ἀλφα");
  assert.equal(rows[1].gloss, "flesh");
});

test("shard numbers: UBS mod 64 of the entry number, STEP mod 64, LSJ mod 128", () => {
  assert.equal(ubsShard("004463000000000"), "47");
  assert.equal(ubsShard("000064000000000"), "00");
  assert.equal(stepShard("G4561"), "17");
  assert.equal(lsjShard("G4561"), "081");
  assert.equal(lsjShard("G128"), "000");
});

test("entries shard by number and only the wanted numbers are kept, in numeric order", () => {
  const entries = new Map([["G4561", [1]], ["G2", [2]], ["G66", [3]], ["G9", [4]]]);
  const shards = shardEntries(entries, stepShard, new Set(["G4561", "G66", "G2"]));
  assert.deepEqual([...shards.keys()].sort(), ["02", "17"]);
  assert.deepEqual(Object.keys(shards.get("02")), ["G2", "G66"]);
});

// ── the chapter builder ──────────────────────────────────────────────────────

test("a book builds into chapter files: words, lemma table, senses, and the report", () => {
  const xml = `<book><title>ΚΑΤΑ ΜΑΡΚΟΝ</title>
<p><verse-number id="Mark 1:1">1:1</verse-number>${w("Ἀρχὴ")}${w("τοῦ", "", " ⸀")}${w("εὐαγγελίου", ". ")}
<verse-number id="Mark 1:2">2</verse-number>${w("Καθὼς", ". ")}</p></book>`;
  const entry = { MainId: "000001000000000", Lemma: "ἀρχή", StrongCodes: [], AlternateLemmas: [], BaseForms: [{ LEXMeanings: [
    { LEXEntryCode: "1", LEXSenses: [{ LanguageCode: "en", Glosses: ["beginning"] }], LEXReferences: ["04100100100010"] },
    { LEXEntryCode: "2", LEXSenses: [{ LanguageCode: "en", Glosses: ["rule"] }], LEXReferences: [] },
  ] }] };
  const stats = {};
  const resolveLemma = makeLemmaResolver({
    lemmaStrong: new Map([["ἀρχή", "G746"]]),
    ubsIndex: ubsLemmaIndex([entry]),
    tbesgByGreek: new Map(),
    tbesgGloss: new Map([["G746", "origin"]]),
    stats,
  });
  const morphVerses = {
    "1:1": [
      { word: "Ἀρχὴ", lemma: "ἀρχή", pos: "N-", parse: "----NSF-" },
      { word: "τοῦ", lemma: "ὁ", pos: "RA", parse: "----GSN-" },
      { word: "εὐαγγελίου", lemma: "εὐαγγέλιον", pos: "N-", parse: "----GSN-" },
    ],
    // Mark 1:2 deliberately disagrees with SBL's word.
    "1:2": [{ word: "Ὡς", lemma: "ὡς", pos: "C-", parse: "--------" }],
  };
  const report = newReport();
  const [chapter1] = buildBook({
    bookKey: "mark",
    chapters: 1,
    sbl: parseSblXml(xml),
    apparatus: parseApparatusXml("<book><verse>Mark 1:1</verse><note>1 note one</note></book>"),
    morphVerse: (c, v) => morphVerses[`${c}:${v}`],
    maculaVerse: () => undefined,
    nestleVerse: () => undefined,
    hints: new Map(),
    resolveLemma,
    ubsRefs: ubsSenseRefs,
    ubsBook: 41,
    report,
  });

  assert.equal(chapter1.format, 1);
  assert.equal(chapter1.title, "ΚΑΤΑ ΜΑΡΚΟΝ");
  assert.deepEqual(chapter1.paragraphs[0][0], [1, 1, "Ἀρχὴ", "", " ", 0, "N-", "----NSF-", 0]);
  assert.deepEqual(chapter1.paragraphs[0][1].slice(0, 5), [1, 2, "τοῦ", "⸀", " "]);
  assert.equal(chapter1.paragraphs[0].map((x) => x[3] + x[2] + x[4]).join(""), "Ἀρχὴ ⸀τοῦ εὐαγγελίου. Καθὼς. ");
  // The disagreeing verse is reported and carries no lemma, never a guess.
  assert.deepEqual(chapter1.paragraphs[0][3].slice(1), [1, "Καθὼς", "", ". ", -1, null, null, null]);
  assert.match(report.mismatches[0], /mark 1:2/);
  assert.deepEqual(chapter1.lemmas[0], ["ἀρχή", "G746", "000001000000000", "beginning"]);
  assert.equal(chapter1.lemmas[2][2], null);
  assert.deepEqual(chapter1.apparatus, [[1, ["1 note one"]]]);
  assert.equal(chapter1.borrowed, undefined);
  assert.equal(report.senses.assigned, 1);
});

// ── the lemma gloss ──────────────────────────────────────────────────────────

const glossEntry = {
  BaseForms: [{ LEXMeanings: [
    { LEXSenses: [{ LanguageCode: "en", Glosses: ["to reveal"] }] },
    { LEXSenses: [{ LanguageCode: "en", Glosses: [] }] },
    { LEXSenses: [{ LanguageCode: "en", Glosses: ["revelation", "disclosure"] }] },
    { LEXSenses: [{ LanguageCode: "en", Glosses: ["unveiling"] }] },
  ] }],
};

test("the gloss is the first gloss of the sense the corpus assigns most often", () => {
  assert.equal(pickGloss(glossEntry, new Map([[0, 2], [2, 9]]), "fallback"), "revelation");
});

test("a tie in the counts goes to the earlier sense", () => {
  assert.equal(pickGloss(glossEntry, new Map([[3, 5], [2, 5]]), "fallback"), "revelation");
});

test("a most common sense with no gloss is passed over for the next", () => {
  assert.equal(pickGloss(glossEntry, new Map([[1, 8], [3, 2]]), "fallback"), "unveiling");
});

test("with no assigned sense, the fallback stands", () => {
  assert.equal(pickGloss(glossEntry, new Map(), "to reveal"), "to reveal");
  assert.equal(pickGloss(glossEntry, undefined, "origin"), "origin");
  assert.equal(pickGloss(null, new Map([[0, 1]]), "origin"), "origin");
});

test("senses are counted per lemma across every chapter's words", () => {
  const doc = (words) => ({ lemmas: [["α"], ["β"]], paragraphs: [words] });
  const counts = countSenses([
    doc([[1, 1, "x", "", " ", 0, "N-", "", 2], [1, 2, "y", "", " ", 0, "N-", "", 2], [1, 3, "z", "", " ", 1, "N-", "", null]]),
    doc([[1, 1, "x", "", " ", 0, "N-", "", 1], [1, 2, "q", "", " ", -1, null, null, null]]),
  ]);
  assert.deepEqual([...counts.get("α")], [[2, 2], [1, 1]]);
  assert.equal(counts.has("β"), false);
});

test("identical entries under one Strong's number are dropped, the rest kept in order", () => {
  const a = { lemma: "Ἰησοῦς", html: "<b>x</b>" };
  const b = { lemma: "Ἰησοῦς", html: "<b>y</b>" };
  const c = { lemma: "Ἰησοῦ", html: "<b>x</b>" };
  const entries = new Map([["G2424", [a, { ...a }, b, { ...a }, c]], ["G1", [a, { ...a }]]]);
  assert.equal(dropDuplicateEntries(entries, new Set(["G2424"])), 2);
  assert.deepEqual(entries.get("G2424"), [a, b, c]);
  assert.equal(entries.get("G1").length, 2); // not wanted, so untouched
  assert.equal(dropDuplicateEntries(entries), 1);
  assert.equal(entries.get("G1").length, 1);
});
