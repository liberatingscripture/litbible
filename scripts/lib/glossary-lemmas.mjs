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
  "angel-message": ["ἄγγελος"],
  "bad-harmful": ["κακός", "κακία"],
  "blasphemy-disrespectfulness": ["βλασφημία", "βλασφημέω", "βλάσφημος"],
  "clean-clean": ["καθαρός", "καθαρίζω", "καθαρισμός", "καθαρότης"],
  "confession-open-acknowledgement": ["ὁμολογία", "ὁμολογέω", "ἐξομολογέω"],
  "defiled-common": ["κοινός", "κοινόω"],
  "demon-demon": ["δαιμόνιον", "δαίμων", "δαιμονίζομαι"],
  "devil-false-accuser": ["διάβολος"],
  "evil-hardship": ["πονηρός", "πονηρία"],
  "faith-trust": ["πίστις", "πιστός", "πιστεύω"],
  "flesh-body": ["σάρξ", "σάρκινος", "σαρκικός"],
  "forgiveness-letting-go": ["ἀφίημι", "ἄφεσις"],
  "gehenna-hinnom-valley": ["γέεννα"],
  "glory-praiseworthiness": ["δόξα", "δοξάζω"],
  "good-admirable": ["καλός"],
  "good-beneficial": ["ἀγαθός", "ἀγαθωσύνη"],
  "gospel-triumphant-message": ["εὐαγγέλιον", "εὐαγγελίζω", "εὐαγγελιστής"],
  "grace-generosity": ["χάρις", "χαρίζομαι", "χάρισμα"],
  "heaven-sky": ["οὐρανός", "οὐράνιος", "ἐπουράνιος"],
  "hell-hades": ["ᾅδης"],
  "holy-sacred": ["ἅγιος", "ἁγιάζω", "ἁγιασμός", "ἁγιωσύνη"],
  // ἀνομία/ἄνομος deliberately excluded — "lawlessness" isn't a Torah rendering.
  "law-torah": ["νόμος", "νομικός"],
  "repentance-reorient-mind": ["μετάνοια", "μετανοέω"],
  // ἐγείρω deliberately excluded — it's the ordinary "get up" across the
  // gospels, so including it would make `present` nearly free and stop the
  // check from discriminating.
  "resurrection-reawakening": ["ἀνάστασις", "ἀνίστημι", "ἐξανάστασις"],
  "righteousness-justness": ["δικαιοσύνη", "δίκαιος", "δικαιόω", "δικαίωμα", "δικαίωσις"],
  "salvation-liberation": ["σωτηρία", "σωτήριος", "σωτήρ", "σῴζω"],
  "satan-adversary": ["Σατανᾶς"],
  "sin-deviation": ["ἁμαρτία", "ἁμαρτάνω", "ἁμάρτημα", "ἁμαρτωλός"],
  "spirit-life-breath": ["πνεῦμα", "πνευματικός"],
  "trespass-shortfall": ["παράπτωμα", "παράβασις", "παραβάτης", "παραβαίνω"],
  "unclean-unclean": ["ἀκάθαρτος", "ἀκαθαρσία"],
};
