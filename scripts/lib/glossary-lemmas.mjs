// Glossary id -> the Greek lemmas whose rendering that entry governs.
//
// The glossary's own `greek:` field is a transliterated HEADWORD ("sarx"), which
// can't be matched against MorphGNT's accented lemmas. This is the bridge, and
// it's an EDITORIAL config, not a derivation: the question isn't "what's the
// dictionary form" but "which Greek words does this commitment cover." So the
// cognate family is included wherever it plausibly carries the same rendering
// (βλασφημέω is governed by the blasphemy entry; ἀνομία is not governed by the
// law entry, because it isn't rendered "Torah").
//
// ERRING INCLUSIVE IS THE SAFER BIAS but not a free one. A missing lemma makes
// good records read as `lemma: "absent"` and hides them; a too-generous one lets
// a bad record read `present`. The build prints a per-term absent rate — a term
// far above its neighbours usually means a lemma missing from this map, not a
// translator inconsistency. Check here first.
//
// Every lemma below is validated against the corpus at load, so a typo or a bad
// accent fails loudly instead of silently matching nothing.

export const GLOSSARY_LEMMAS = {
  "adultery-marital-infidelity": ["μοιχεία", "μοιχεύω", "μοιχαλίς", "μοιχός"],
  "almighty-sustainer-of-all": ["παντοκράτωρ"],
  "angel-message": ["ἄγγελος"],
  // ἱλαστήριον included: it is the ark's cover, rendered "reconciliation
  // cover" (Rom 3:25, Heb 9:5) — the place of the meeting, not a separate idea.
  "atonement-reconciliation": ["ἱλασμός", "ἱλαστήριον", "ἱλάσκομαι"],
  // βαπτισμός included though it is rendered "ritual washings" (Heb 9:10),
  // not "immersion" — erring inclusive, and the reviewer can call it no-rendering.
  "baptism-immersion": ["βαπτίζω", "βάπτισμα", "βαπτιστής", "βαπτισμός"],
  "bad-harmful": ["κακός", "κακία"],
  "blasphemy-disrespectfulness": ["βλασφημία", "βλασφημέω", "βλάσφημος"],
  // μακάριος deliberately excluded — English collapses the two into "bless",
  // but the words are unrelated in origin and meaning, and two published
  // footnotes say so outright. It is its own candidate.
  "bless-pronounce-well-being": ["εὐλογέω", "εὐλογία", "εὐλογητός"],
  "blessed-how-greatly-fortunate": ["μακάριος", "μακαρίζω", "μακαρισμός"],
  // ἐκλεκτός deliberately excluded — it shares ekklesia's root and its own
  // footnotes, but it's rendered "chosen"/"called", never "Called Community".
  "church-called-community": ["ἐκκλησία"],
  "clean-clean": ["καθαρός", "καθαρίζω", "καθαρισμός", "καθαρότης"],
  "confession-open-acknowledgement": ["ὁμολογία", "ὁμολογέω", "ἐξομολογέω"],
  "defiled-common": ["κοινός", "κοινόω"],
  "demon-demon": ["δαιμόνιον", "δαίμων", "δαιμονίζομαι"],
  "devil-false-accuser": ["διάβολος"],
  "evil-hardship": ["πονηρός", "πονηρία"],
  "faith-trust": ["πίστις", "πιστός", "πιστεύω"],
  // συγκοινωνός/συγκοινωνέω included: the sun- compound is rendered
  // "coparticipants" (2 Cor 1:7), the same commitment intensified.
  // κοινός is NOT here — it is defiled-common, a different claim.
  "fellowship-community": ["κοινωνία", "κοινωνός", "κοινωνέω", "συγκοινωνός", "συγκοινωνέω"],
  "flesh-body": ["σάρξ", "σάρκινος", "σαρκικός"],
  "forgiveness-letting-go": ["ἀφίημι", "ἄφεσις"],
  "gehenna-hinnom-valley": ["γέεννα"],
  "gentiles-people-groups": ["ἔθνος"],
  "glory-praiseworthiness": ["δόξα", "δοξάζω"],
  "godliness-respectfulness": ["εὐσέβεια", "εὐσεβής", "εὐσεβέω", "εὐσεβῶς"],
  "good-admirable": ["καλός"],
  "good-beneficial": ["ἀγαθός", "ἀγαθωσύνη"],
  "gospel-triumphant-message": ["εὐαγγέλιον", "εὐαγγελίζω", "εὐαγγελιστής"],
  "grace-generosity": ["χάρις", "χαρίζομαι", "χάρισμα"],
  "heaven-sky": ["οὐρανός", "οὐράνιος", "ἐπουράνιος"],
  "hell-hades": ["ᾅδης"],
  "holy-sacred": ["ἅγιος", "ἁγιάζω", "ἁγιασμός", "ἁγιωσύνη"],
  "hypocrite-faker": ["ὑποκριτής", "ὑπόκρισις", "ὑποκρίνομαι"],
  // πορνεία's family only. μοιχεία is its own entry: the two sit side by side
  // in vice lists (Matt 15:19) and render differently, so folding them would
  // make each one's occurrence list wrong.
  "immorality-exploitation": ["πορνεία", "πόρνη", "πόρνος", "πορνεύω", "ἐκπορνεύω"],
  // ἀνομία/ἄνομος deliberately excluded — "lawlessness" isn't a Torah rendering.
  "law-torah": ["νόμος", "νομικός"],
  // ἐλεημοσύνη included: it's rendered "compassion work" (Matt 6:2), the same
  // commitment realized as a practice rather than a disposition.
  "mercy-loving-faithfulness": ["ἔλεος", "ἐλεάω", "ἐλεήμων", "ἐλεημοσύνη"],
  "repentance-reorient-mind": ["μετάνοια", "μετανοέω"],
  // ἐγείρω deliberately excluded — it's the ordinary "get up" across the
  // gospels, so including it would make `present` nearly free and stop the
  // check from discriminating.
  "resurrection-reawakening": ["ἀνάστασις", "ἀνίστημι", "ἐξανάστασις"],
  "righteousness-justness": ["δικαιοσύνη", "δίκαιος", "δικαιόω", "δικαίωμα", "δικαίωσις"],
  "salvation-liberation": ["σωτηρία", "σωτήριος", "σωτήρ", "σῴζω"],
  "satan-adversary": ["Σατανᾶς"],
  // προσκυνέω deliberately excluded — it is "bow down", a separate term
  // (deferred). The two are named as different acts in Matt 4:10 / Luke 4:8.
  "serve-serve-as-representative": ["λατρεύω", "λατρεία"],
  "sin-deviation": ["ἁμαρτία", "ἁμαρτάνω", "ἁμάρτημα", "ἁμαρτωλός"],
  "soul-very-being": ["ψυχή", "ψυχικός"],
  "spirit-life-breath": ["πνεῦμα", "πνευματικός"],
  "submit-cooperate": ["ὑποτάσσω", "ὑποταγή"],
  "trespass-shortfall": ["παράπτωμα", "παράβασις", "παραβάτης", "παραβαίνω"],
  "unclean-unclean": ["ἀκάθαρτος", "ἀκαθαρσία"],
};

// Each of those Greek words by itself: the word a traditional English Bible
// uses for it, and the word in Latin letters. [traditional, Greek].
//
// A glossary entry names ONE word of its family ("Faith", "pistis"), and that
// pair was being said of every key term in the text: "Traditionally faith ·
// Greek pistis" on "trusted", which renders pisteuo and is traditionally
// "believed". A third of the marked words sit on a family word other than the
// entry's own (BVJ, 2026-11-10; STUDY-DESK-FIXES.md, E85). So the term lens's
// card and a sheet's hints and Key terms box read the word here for the Greek
// word a verse actually holds (src/lib/term-words.mjs has the rule).
//
// EDITORIAL, like the map above, and the owner's to correct. What to know
// before changing a line:
//
// - The traditional word is a dictionary form as it reads after
//   "traditionally": "believe", never "believed", and lowercase unless Bibles
//   print a capital ("Satan", "Gentiles", "Hades", "Savior"; the test names
//   each one allowed). It is the usual word for the Greek word, not a claim
//   about one verse: "holy" stands though the same word is "saints" in many
//   places. A verse-by-verse word would be a field on the alignment record,
//   decided in review; nothing here can supply it.
// - A slash offers two where no one word is usual: the verses the LIT marks
//   are split between them ("forgive/leave" for aphiemi, "confess/praise"),
//   the word works both ways ("rise/raise"), or older and newer Bibles part
//   ("carnal/fleshly"). The entries' own "Defiled/Profane" does the same, and
//   the sheets read either side as the word. Sparingly: a slash on every word
//   with a second sense would make every hint a pair.
// - A phrase leans on a small verb where English has no one word ("have
//   mercy", "commit adultery", "make atonement"). The sheets' give-away
//   checks set those verbs aside (CARRIERS in src/lib/term-words.mjs), so a
//   phrase that leans on a new one needs it added there.
// - The Greek is spelled as the glossary spells it: no macrons, u for upsilon
//   (hupotasso, psuche), ch, ph, and ng for a doubled gamma (euangelion).
// - Each entry's own `traditional` and `greek` must appear here on one of its
//   words: the Greek as the entry spells it ("koine", "diabolon" and
//   "Gehenna" included), the traditional word the same but for its capital,
//   so a mark on the entry's own word reads as it always did.
//   test/term-words.test.js holds that, and that every lemma above has a
//   line and no line names a lemma the map lacks: change an entry's word and
//   the line here in the same change.
export const LEMMA_WORDS = {
  "adultery-marital-infidelity": {
    "μοιχεία": ["adultery", "moicheia"],
    "μοιχεύω": ["commit adultery", "moicheuo"],
    "μοιχαλίς": ["adulterous/adulteress", "moichalis"],
    "μοιχός": ["adulterer", "moichos"],
  },
  "almighty-sustainer-of-all": {
    "παντοκράτωρ": ["Almighty", "pantokrator"],
  },
  "angel-message": {
    "ἄγγελος": ["angel", "angelos"],
  },
  "atonement-reconciliation": {
    "ἱλασμός": ["atonement", "hilasmos"],
    // The owner's notes at Romans 3:25 and Hebrews 9:5 give "mercy seat".
    "ἱλαστήριον": ["mercy seat", "hilasterion"],
    // Two verses, one each way (Hebrews 2:17, Luke 18:13).
    "ἱλάσκομαι": ["make atonement/be merciful", "hilaskomai"],
  },
  "baptism-immersion": {
    "βαπτίζω": ["baptize", "baptizo"],
    "βάπτισμα": ["baptism", "baptisma"],
    "βαπτιστής": ["Baptist", "baptistes"],
    "βαπτισμός": ["washing/baptism", "baptismos"],
  },
  "bad-harmful": {
    "κακός": ["bad", "kakos"],
    "κακία": ["malice", "kakia"],
  },
  "blasphemy-disrespectfulness": {
    "βλασφημία": ["blasphemy", "blasphemia"],
    "βλασφημέω": ["blaspheme/slander", "blasphemeo"],
    "βλάσφημος": ["blasphemous/blasphemer", "blasphemos"],
  },
  "bless-pronounce-well-being": {
    "εὐλογέω": ["bless", "eulogeo"],
    "εὐλογία": ["blessing", "eulogia"],
    "εὐλογητός": ["blessed", "eulogetos"],
  },
  "blessed-how-greatly-fortunate": {
    "μακάριος": ["blessed", "makarios"],
    "μακαρίζω": ["call blessed", "makarizo"],
    "μακαρισμός": ["blessedness", "makarismos"],
  },
  "church-called-community": {
    "ἐκκλησία": ["church", "ekklesia"],
  },
  "clean-clean": {
    "καθαρός": ["clean", "katharos"],
    "καθαρίζω": ["cleanse", "katharizo"],
    "καθαρισμός": ["purification", "katharismos"],
    "καθαρότης": ["purification", "katharotes"],
  },
  "confession-open-acknowledgement": {
    "ὁμολογία": ["confession", "homologia"],
    "ὁμολογέω": ["confess", "homologeo"],
    "ἐξομολογέω": ["confess/praise", "exomologeo"],
  },
  "defiled-common": {
    "κοινός": ["defiled/profane", "koine"],
    "κοινόω": ["defile", "koinoo"],
  },
  "demon-demon": {
    "δαιμόνιον": ["demon", "daimonion"],
    "δαίμων": ["demon", "daimon"],
    "δαιμονίζομαι": ["demon-possessed", "daimonizomai"],
  },
  "devil-false-accuser": {
    "διάβολος": ["devil", "diabolon"],
  },
  "evil-hardship": {
    "πονηρός": ["evil", "poneros"],
    "πονηρία": ["wickedness", "poneria"],
  },
  "faith-trust": {
    "πίστις": ["faith", "pistis"],
    "πιστός": ["faithful", "pistos"],
    "πιστεύω": ["believe", "pisteuo"],
  },
  "fellowship-community": {
    "κοινωνία": ["fellowship", "koinonia"],
    "κοινωνός": ["partner/partaker", "koinonos"],
    "κοινωνέω": ["share", "koinoneo"],
    "συγκοινωνός": ["fellow partaker", "sunkoinonos"],
    "συγκοινωνέω": ["have fellowship with", "sunkoinoneo"],
  },
  "flesh-body": {
    "σάρξ": ["flesh", "sarx"],
    // "Carnal" is the King James's word for both; later literal Bibles have
    // "fleshly" or "of the flesh".
    "σάρκινος": ["carnal/fleshly", "sarkinos"],
    "σαρκικός": ["carnal/fleshly", "sarkikos"],
  },
  "forgiveness-letting-go": {
    // "Leave" in more of its verses than "forgive" (a literal translation has
    // left/leave 54 times, forgive 46, allow/permit 19, of 143), and the LIT
    // marks nearly all of them, so "forgive" alone was wrong on "leave your
    // gift there" (Matthew 5:24). The plainest case of a word one line can't
    // settle.
    "ἀφίημι": ["forgive/leave", "aphiemi"],
    "ἄφεσις": ["forgiveness", "aphesis"],
  },
  "gehenna-hinnom-valley": {
    "γέεννα": ["Gehenna/hell", "Gehenna"],
  },
  "gentiles-people-groups": {
    "ἔθνος": ["Gentiles", "ethnos"],
  },
  "glory-praiseworthiness": {
    "δόξα": ["glory", "doxa"],
    "δοξάζω": ["glorify", "doxazo"],
  },
  "godliness-respectfulness": {
    "εὐσέβεια": ["godliness", "eusebeia"],
    "εὐσεβής": ["devout", "eusebes"],
    // Two verses, one each way (Acts 17:23, 1 Timothy 5:4).
    "εὐσεβέω": ["worship/show godliness", "eusebeo"],
    "εὐσεβῶς": ["godly", "eusebos"],
  },
  "good-admirable": {
    "καλός": ["good", "kalos"],
  },
  "good-beneficial": {
    "ἀγαθός": ["good", "agathos"],
    "ἀγαθωσύνη": ["goodness", "agathosune"],
  },
  "gospel-triumphant-message": {
    "εὐαγγέλιον": ["gospel", "euangelion"],
    "εὐαγγελίζω": ["preach the gospel", "euangelizo"],
    "εὐαγγελιστής": ["evangelist", "euangelistes"],
  },
  "grace-generosity": {
    "χάρις": ["grace", "charis"],
    "χαρίζομαι": ["forgive/grant", "charizomai"],
    "χάρισμα": ["gift", "charisma"],
  },
  "heaven-sky": {
    "οὐρανός": ["heaven", "ouranos"],
    "οὐράνιος": ["heavenly", "ouranios"],
    "ἐπουράνιος": ["heavenly", "epouranios"],
  },
  "hell-hades": {
    "ᾅδης": ["hell/Hades", "Hades"],
  },
  "holy-sacred": {
    "ἅγιος": ["holy", "hagios"],
    "ἁγιάζω": ["sanctify", "hagiazo"],
    "ἁγιασμός": ["sanctification/holiness", "hagiasmos"],
    "ἁγιωσύνη": ["holiness", "hagiosune"],
  },
  "hypocrite-faker": {
    "ὑποκριτής": ["hypocrite", "hupokrites"],
    "ὑπόκρισις": ["hypocrisy", "hupokrisis"],
    "ὑποκρίνομαι": ["pretend", "hupokrinomai"],
  },
  "immorality-exploitation": {
    "πορνεία": ["sexual immorality", "porneia"],
    "πόρνη": ["prostitute", "porne"],
    "πόρνος": ["sexually immoral", "pornos"],
    "πορνεύω": ["commit sexual immorality", "porneuo"],
    "ἐκπορνεύω": ["commit sexual immorality", "ekporneuo"],
  },
  "law-torah": {
    "νόμος": ["law", "nomos"],
    "νομικός": ["lawyer", "nomikos"],
  },
  "mercy-loving-faithfulness": {
    "ἔλεος": ["mercy", "eleos"],
    "ἐλεάω": ["have mercy", "eleao"],
    "ἐλεήμων": ["merciful", "eleemon"],
    "ἐλεημοσύνη": ["alms", "eleemosune"],
  },
  "repentance-reorient-mind": {
    "μετάνοια": ["repentance", "metanoia"],
    "μετανοέω": ["repent", "metanoeo"],
  },
  "resurrection-reawakening": {
    "ἀνάστασις": ["resurrection", "anastasis"],
    // To rise oneself, or to raise another ("I will raise them up," John 6:40).
    "ἀνίστημι": ["rise/raise", "anistemi"],
    "ἐξανάστασις": ["resurrection", "exanastasis"],
  },
  "righteousness-justness": {
    "δικαιοσύνη": ["righteousness", "dikaiosune"],
    "δίκαιος": ["righteous", "dikaios"],
    "δικαιόω": ["justify", "dikaioo"],
    // No one word in any Bible: a requirement or regulation (Romans 8:4,
    // Hebrews 9:1), or a righteous act (Romans 5:18, Revelation 19:8).
    "δικαίωμα": ["requirement/righteous act", "dikaioma"],
    "δικαίωσις": ["justification", "dikaiosis"],
  },
  "salvation-liberation": {
    "σωτηρία": ["salvation", "soteria"],
    "σωτήριος": ["salvation", "soterios"],
    "σωτήρ": ["Savior", "soter"],
    "σῴζω": ["save", "sozo"],
  },
  "satan-adversary": {
    "Σατανᾶς": ["Satan", "Satanas"],
  },
  "serve-serve-as-representative": {
    "λατρεύω": ["serve", "latreuo"],
    "λατρεία": ["service", "latreia"],
  },
  "sin-deviation": {
    "ἁμαρτία": ["sin", "hamartia"],
    "ἁμαρτάνω": ["sin", "hamartano"],
    "ἁμάρτημα": ["sin", "hamartema"],
    "ἁμαρτωλός": ["sinner", "hamartolos"],
  },
  "soul-very-being": {
    "ψυχή": ["soul", "psuche"],
    "ψυχικός": ["natural", "psuchikos"],
  },
  "spirit-life-breath": {
    "πνεῦμα": ["spirit", "pneuma"],
    "πνευματικός": ["spiritual", "pneumatikos"],
  },
  "submit-cooperate": {
    "ὑποτάσσω": ["submit", "hupotasso"],
    "ὑποταγή": ["submission", "hupotage"],
  },
  "trespass-shortfall": {
    "παράπτωμα": ["transgression", "paraptoma"],
    "παράβασις": ["transgression", "parabasis"],
    "παραβάτης": ["transgressor", "parabates"],
    "παραβαίνω": ["transgress", "parabaino"],
  },
  "unclean-unclean": {
    "ἀκάθαρτος": ["unclean", "akathartos"],
    "ἀκαθαρσία": ["impurity", "akatharsia"],
  },
};

/**
 * One entry's family as [traditional, Greek] pairs, in GLOSSARY_LEMMAS' order,
 * so an index into one is an index into the other. A lemma with no line is an
 * error, not a gap: a mark on it would fall back to the entry's own word, the
 * very thing this table exists to stop, and nothing on the page would say so.
 *
 * @param {string} id a glossary id
 * @returns {[string, string][]}
 */
export function lemmaWords(id) {
  const words = LEMMA_WORDS[id] ?? {};
  return (GLOSSARY_LEMMAS[id] ?? []).map((lemma) => {
    const pair = words[lemma];
    if (!Array.isArray(pair) || !pair[0] || !pair[1]) {
      throw new Error(`glossary-lemmas: LEMMA_WORDS has no line for ${lemma} (${id})`);
    }
    return pair;
  });
}
