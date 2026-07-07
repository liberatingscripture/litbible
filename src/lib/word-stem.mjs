// English (Porter2/Snowball) stemmer — shared by the verse-index build
// (scripts/build-verse-index.mjs groups the corpus vocabulary by stem) and
// the client (search-core.js stems query tokens). Related-form matching in
// scripture keyword search ("liberation" also finds "liberate") only works
// because BOTH sides use this exact implementation: never swap one side to
// a different stemmer.
//
// Reference: https://snowballstem.org/algorithms/english/stemmer.html

const VOWELS = "aeiouy";

function isVowel(ch) {
  return VOWELS.includes(ch);
}

/** Snowball "short syllable" ending at index i (inclusive). */
function endsWithShortSyllable(w) {
  const n = w.length;
  if (n === 2) return isVowel(w[0]) && !isVowel(w[1]);
  if (n < 3) return false;
  const c2 = w[n - 3];
  const v = w[n - 2];
  const c = w[n - 1];
  return (
    !isVowel(c2) && isVowel(v) && !isVowel(c) && c !== "w" && c !== "x" && c !== "Y"
  );
}

/** R1/R2 start indexes per the Snowball definition. */
function regions(w) {
  let r1 = w.length;
  // Special prefixes fix R1.
  if (/^(gener|commun|arsen)/.test(w)) {
    r1 = w.match(/^(gener|commun|arsen)/)[0].length;
  } else {
    for (let i = 1; i < w.length; i++) {
      if (!isVowel(w[i]) && isVowel(w[i - 1])) {
        r1 = i + 1;
        break;
      }
    }
  }
  let r2 = w.length;
  for (let i = r1 + 1; i < w.length; i++) {
    if (!isVowel(w[i]) && isVowel(w[i - 1])) {
      r2 = i + 1;
      break;
    }
  }
  return { r1, r2 };
}

const EXCEPTIONS_1 = new Map([
  ["skis", "ski"],
  ["skies", "sky"],
  ["dying", "die"],
  ["lying", "lie"],
  ["tying", "tie"],
  ["idly", "idl"],
  ["gently", "gentl"],
  ["ugly", "ugli"],
  ["early", "earli"],
  ["only", "onli"],
  ["singly", "singl"],
  ["sky", "sky"],
  ["news", "news"],
  ["howe", "howe"],
  ["atlas", "atlas"],
  ["cosmos", "cosmos"],
  ["bias", "bias"],
  ["andes", "andes"],
]);

const EXCEPTIONS_2 = new Set([
  "inning",
  "outing",
  "canning",
  "herring",
  "earring",
  "proceed",
  "exceed",
  "succeed",
]);

const DOUBLES = ["bb", "dd", "ff", "gg", "mm", "nn", "pp", "rr", "tt"];

const LI_ENDING = "cdeghkmnrt";

/**
 * Stem one lowercase English word. Non-alphabetic input is returned as-is.
 */
export function stemWord(input) {
  let w = String(input || "").toLowerCase();
  if (w.length <= 2) return w;
  if (EXCEPTIONS_1.has(w)) return EXCEPTIONS_1.get(w);

  if (w[0] === "'") w = w.slice(1);

  // Mark consonant-y as "Y" so it isn't treated as a vowel.
  if (w[0] === "y") w = "Y" + w.slice(1);
  w = w.replace(/([aeiouy])y/g, "$1Y");

  let { r1, r2 } = regions(w);
  const inR1 = (suffixLen) => w.length - suffixLen >= r1;
  const inR2 = (suffixLen) => w.length - suffixLen >= r2;

  // Step 0 — strip apostrophe suffixes.
  for (const suf of ["'s'", "'s", "'"]) {
    if (w.endsWith(suf)) {
      w = w.slice(0, -suf.length);
      break;
    }
  }

  // Step 1a
  if (w.endsWith("sses")) {
    w = w.slice(0, -2);
  } else if (w.endsWith("ied") || w.endsWith("ies")) {
    w = w.slice(0, -3) + (w.length > 4 ? "i" : "ie");
  } else if (w.endsWith("ss") || w.endsWith("us")) {
    // keep
  } else if (w.endsWith("s")) {
    // Delete if the preceding part contains a vowel NOT immediately before.
    const head = w.slice(0, -1);
    if ([...head.slice(0, -1)].some(isVowel)) w = head;
  }

  if (EXCEPTIONS_2.has(w)) return w.replace(/Y/g, "y");

  // Step 1b
  const step1bDone = (() => {
    for (const suf of ["eedly", "eed"]) {
      if (w.endsWith(suf)) {
        if (inR1(suf.length)) w = w.slice(0, -suf.length) + "ee";
        return true;
      }
    }
    for (const suf of ["ingly", "edly", "ing", "ed"]) {
      if (w.endsWith(suf)) {
        const head = w.slice(0, -suf.length);
        if ([...head].some(isVowel)) {
          w = head;
          if (w.endsWith("at") || w.endsWith("bl") || w.endsWith("iz")) {
            w += "e";
          } else if (DOUBLES.some((d) => w.endsWith(d))) {
            w = w.slice(0, -1);
          } else if (w.length <= r1 && endsWithShortSyllable(w)) {
            // "short word": R1 is empty (r1 at/past end) and ends in a
            // short syllable — restore the e ("hoping" → "hope").
            w += "e";
          }
          ({ r1, r2 } = regions(w));
        }
        return true;
      }
    }
    return false;
  })();
  void step1bDone;

  // Step 1c — y/Y → i after a non-vowel that is not the first letter.
  if (
    (w.endsWith("y") || w.endsWith("Y")) &&
    w.length > 2 &&
    !isVowel(w[w.length - 2])
  ) {
    w = w.slice(0, -1) + "i";
  }

  // Step 2 (longest suffix, in R1)
  const STEP2 = [
    ["ization", "ize"],
    ["ational", "ate"],
    ["fulness", "ful"],
    ["ousness", "ous"],
    ["iveness", "ive"],
    ["tional", "tion"],
    ["biliti", "ble"],
    ["lessli", "less"],
    ["entli", "ent"],
    ["ation", "ate"],
    ["alism", "al"],
    ["aliti", "al"],
    ["ousli", "ous"],
    ["iviti", "ive"],
    ["fulli", "ful"],
    ["enci", "ence"],
    ["anci", "ance"],
    ["abli", "able"],
    ["izer", "ize"],
    ["ator", "ate"],
    ["alli", "al"],
    ["bli", "ble"],
  ];
  let done2 = false;
  for (const [suf, rep] of STEP2) {
    if (w.endsWith(suf)) {
      if (inR1(suf.length)) w = w.slice(0, -suf.length) + rep;
      done2 = true;
      break;
    }
  }
  if (!done2) {
    if (w.endsWith("ogi")) {
      if (inR1(3) && w[w.length - 4] === "l") w = w.slice(0, -1);
    } else if (w.endsWith("li")) {
      if (inR1(2) && LI_ENDING.includes(w[w.length - 3])) w = w.slice(0, -2);
    }
  }
  ({ r1, r2 } = regions(w));

  // Step 3 (longest suffix, in R1; "ative" needs R2)
  const STEP3 = [
    ["ational", "ate"],
    ["tional", "tion"],
    ["alize", "al"],
    ["icate", "ic"],
    ["iciti", "ic"],
    ["ical", "ic"],
    ["ness", ""],
    ["ful", ""],
  ];
  let done3 = false;
  for (const [suf, rep] of STEP3) {
    if (w.endsWith(suf)) {
      if (inR1(suf.length)) w = w.slice(0, -suf.length) + rep;
      done3 = true;
      break;
    }
  }
  if (!done3 && w.endsWith("ative") && inR2(5)) {
    w = w.slice(0, -5);
  }
  ({ r1, r2 } = regions(w));

  // Step 4 (longest suffix, in R2)
  const STEP4 = [
    "ement",
    "ance",
    "ence",
    "able",
    "ible",
    "ment",
    "ant",
    "ent",
    "ism",
    "ate",
    "iti",
    "ous",
    "ive",
    "ize",
    "al",
    "er",
    "ic",
  ];
  let done4 = false;
  for (const suf of STEP4) {
    if (w.endsWith(suf)) {
      if (inR2(suf.length)) w = w.slice(0, -suf.length);
      done4 = true;
      break;
    }
  }
  if (!done4 && w.endsWith("ion") && inR2(3)) {
    const before = w[w.length - 4];
    if (before === "s" || before === "t") w = w.slice(0, -3);
  }
  ({ r1, r2 } = regions(w));

  // Step 5
  if (w.endsWith("e")) {
    if (
      inR2(1) ||
      (inR1(1) && !endsWithShortSyllable(w.slice(0, -1)))
    ) {
      w = w.slice(0, -1);
    }
  } else if (w.endsWith("l") && inR2(1) && w[w.length - 2] === "l") {
    w = w.slice(0, -1);
  }

  return w.replace(/Y/g, "y");
}
