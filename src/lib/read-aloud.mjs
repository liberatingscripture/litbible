// src/lib/read-aloud.mjs
//
// The pure half of "Read aloud" (audit X9): what the device's voice is given
// to say, in what pieces, and which of the device's voices is offered. The
// player (src/scripts/read-aloud.js) speaks these pieces one at a time and
// moves the highlight from verse to verse. No DOM and no speechSynthesis
// here, so it runs under node:test.
//
// The text is Copy verse's (joinPieces with the verse numbers left out), so
// verse numbers, footnote letters and bracket markers are never spoken.

/** Longest piece handed to the voice at once, in characters. */
export const MAX_CHUNK = 200;

/**
 * Speeds offered, as the Web Speech API's rate (1 is the voice's normal).
 * Kept few, so the choice is a glance rather than a slider.
 */
export const RATES = [0.75, 1, 1.25, 1.5];

export const DEFAULT_RATE = 1;

/**
 * Split one verse's text into the pieces the voice says one at a time.
 *
 * Why pieces at all: Chrome's online voices stop partway through an
 * utterance that runs past about fifteen seconds, and 242 published verses
 * are longer than MAX_CHUNK characters (1 Timothy 1:9 runs to about 400).
 * Poetry lines are spoken one at a time, which gives each line the pause a
 * reader gives it; a long line or prose verse breaks after a sentence, then
 * after a clause, and only as a last resort at a space.
 */
export function speechChunks(text, max = MAX_CHUNK) {
  const out = [];
  for (const line of String(text ?? "").split("\n")) {
    const trimmed = line.replace(/\s+/g, " ").trim();
    if (trimmed) out.push(...splitLine(trimmed, max));
  }
  return out;
}

// A sentence ends at . ! ? or … with any closing quotes and brackets after
// it, before a space.
const SENTENCE_END = /(?<=[.!?…][”’")\]]*)\s+/u;
// A clause ends at a comma, semicolon, colon or dash, before a space.
const CLAUSE_END = /(?<=[,;:—–])\s+/u;

function splitLine(line, max) {
  if (line.length <= max) return [line];
  const sentences = pack(line.split(SENTENCE_END), max);
  return sentences.flatMap((s) => {
    if (s.length <= max) return [s];
    return pack(s.split(CLAUSE_END), max).flatMap((c) => (c.length <= max ? [c] : byWords(c, max)));
  });
}

/** Join consecutive parts back together while they fit within max. */
function pack(parts, max) {
  const out = [];
  let cur = "";
  for (const part of parts) {
    if (!part) continue;
    if (!cur) cur = part;
    else if (cur.length + 1 + part.length <= max) cur += " " + part;
    else {
      out.push(cur);
      cur = part;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function byWords(text, max) {
  return pack(text.split(" "), max);
}

/**
 * The chapter as a list of pieces: [{ verse, text }], in reading order.
 * `verses` is [{ verse, text }] with each verse's whole text; a verse with
 * no text (a gap such as Matthew 17:21 has no spans at all) gives nothing.
 * `intro`, when given, is spoken first with verse null ("Romans, chapter
 * 8."), so a listener starting from the top hears where they are.
 */
export function buildChunks(verses, { intro = "", max = MAX_CHUNK } = {}) {
  const chunks = [];
  if (intro) chunks.push({ verse: null, text: intro });
  for (const { verse, text } of verses) {
    for (const piece of speechChunks(text, max)) chunks.push({ verse, text: piece });
  }
  return chunks;
}

/** Index of the first piece of `verse`, or -1. */
export function firstChunkOf(chunks, verse) {
  return chunks.findIndex((c) => c.verse === verse);
}

/**
 * Where "next verse" goes from piece `i`: the first piece of the next verse,
 * or -1 at the last verse. From the intro it is verse 1's first piece.
 */
export function nextVerseStart(chunks, i) {
  const here = chunks[i]?.verse;
  for (let j = i + 1; j < chunks.length; j++) {
    if (chunks[j].verse !== here && chunks[j].verse !== null) return j;
  }
  return -1;
}

/**
 * Where "previous verse" goes from piece `i`: the first piece of the verse
 * before this one. At the first verse it goes back to that verse's start
 * (or the intro), so the button is never dead.
 */
export function previousVerseStart(chunks, i) {
  const here = chunks[i]?.verse;
  let j = i;
  while (j > 0 && chunks[j - 1].verse === here) j--; // start of this verse
  if (j === 0) return 0;
  const prev = chunks[j - 1].verse;
  while (j > 0 && chunks[j - 1].verse === prev) j--;
  return j;
}

/**
 * A book's name as a listener expects to hear it: "First Corinthians", not
 * "one Corinthians". The label is bookKeyToLabel's ("1 Corinthians").
 */
export function spokenBookName(label) {
  const ORDINAL = { 1: "First", 2: "Second", 3: "Third" };
  return String(label).replace(/^([123]) /, (_, n) => ORDINAL[n] + " ");
}

/** What is said before verse 1: "Romans, chapter 8." */
export function chapterIntro(bookLabel, chapter) {
  return `${spokenBookName(bookLabel)}, chapter ${chapter}.`;
}

/**
 * Apple's novelty voices ("Bad News", "Bubbles"), its old MacinTalk voices
 * and the Eloquence set ("Grandpa", "Rocko"). Safari offers every one of them
 * in every English, about fifty entries on a Mac, and none is a voice anyone
 * would choose to hear scripture in. Matched on the name before any
 * "(English (…))" suffix.
 */
const NOT_OFFERED = new Set([
  "Albert", "Bad News", "Bahh", "Bells", "Boing", "Bubbles", "Cellos",
  "Deranged", "Good News", "Hysterical", "Jester", "Junior", "Organ",
  "Pipe Organ", "Princess", "Ralph", "Superstar", "Trinoids", "Whisper",
  "Wobble", "Zarvox", "Agnes", "Bruce", "Fred", "Kathy", "Vicki", "Victoria",
  "Eddy", "Flo", "Grandma", "Grandpa", "Reed", "Rocko", "Sandy", "Shelley",
]);

function baseName(voice) {
  return String(voice.name || "").replace(/\s*\(.*$/, "").trim();
}

/** Lower is better: a voice its maker calls premium or natural first. */
function qualityRank(voice) {
  const name = String(voice.name || "");
  if (/premium|natural|neural/i.test(name)) return 0;
  if (/enhanced/i.test(name)) return 1;
  return 2;
}

/**
 * The device's English voices, in the order the list offers them: voices on
 * the device before online ones (an online voice is made by the browser's
 * maker, so the words go to them), then the reader's own English (en-GB
 * before en-US for a reader in Britain), then the better voices of each
 * kind, then by name. `voices` is speechSynthesis.getVoices(), or anything
 * shaped like it.
 */
export function englishVoices(voices, preferredLang = "en-US") {
  const pref = String(preferredLang || "").toLowerCase();
  const english = [...voices].filter(
    (v) => /^en([-_]|$)/i.test(v.lang || "") && !NOT_OFFERED.has(baseName(v))
  );
  const rank = (v) => [
    v.localService === false ? 1 : 0,
    normLang(v.lang) === pref ? 0 : 1,
    qualityRank(v),
  ];
  return english.sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    return (
      ra[0] - rb[0] || ra[1] - rb[1] || ra[2] - rb[2] || String(a.name).localeCompare(String(b.name))
    );
  });
}

const normLang = (lang) => String(lang || "").toLowerCase().replace("_", "-");

/**
 * The voice to start with, on the device whenever there is one:
 * 1. the one the reader chose last time, if the device still has it;
 * 2. a Premium, Enhanced or Natural voice in the reader's own English that
 *    is on the device: a reader who downloaded one (iPhone: Settings →
 *    Accessibility → Spoken Content → Voices) wants it, and Safari still
 *    marks the plain voice as the default;
 * 3. the device's own default;
 * 4. the first in englishVoices' order.
 * Null when the device offers no English voice, which leaves the choice to
 * the browser (the utterance still asks for English).
 */
export function pickVoice(voices, savedUri, preferredLang) {
  const list = englishVoices(voices, preferredLang);
  if (!list.length) return null;
  const saved = savedUri && list.find((v) => v.voiceURI === savedUri);
  if (saved) return saved;
  const onDevice = list.filter((v) => v.localService !== false);
  const pref = normLang(preferredLang);
  const better = onDevice.find((v) => qualityRank(v) < 2 && normLang(v.lang) === pref);
  if (better) return better;
  return onDevice.find((v) => v.default) || onDevice[0] || list[0];
}

/**
 * A voice's name for the list. Windows appends the language ("Microsoft
 * Aria Online (Natural) - English (United States)"), which the list doesn't
 * need; an online voice says so, since choosing it sends the words away.
 */
export function voiceLabel(voice) {
  let name = String(voice.name || voice.voiceURI || "Voice")
    .replace(/\s+-\s+English.*$/i, "")
    .trim();
  if (voice.localService === false && !/online/i.test(name)) name += " (online)";
  return name;
}

/** A rate as the speed list shows it: "1×", "1.25×". */
export function rateLabel(rate) {
  return `${rate}×`;
}
