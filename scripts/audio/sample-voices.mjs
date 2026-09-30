#!/usr/bin/env node
// scripts/audio/sample-voices.mjs
//
// Reads one chapter aloud in chosen Azure voices and saves the MP3s on this
// computer, for choosing the voices of hosted Read aloud audio (audit X9).
// Not part of any build, and nothing is uploaded anywhere.
//
//   node scripts/audio/sample-voices.mjs                 # Romans 8, the shortlist
//   node scripts/audio/sample-voices.mjs --chapter=john-11
//   node scripts/audio/sample-voices.mjs --voices=en-US-JaneNeural
//   node scripts/audio/sample-voices.mjs --dry-run       # the text and counts, no key needed
//   node scripts/audio/sample-voices.mjs --verses        # also a verse-by-verse reading
//
// Each voice reads <chapter>-<voice>-paragraphs.mp3: a paragraph per request,
// the natural flow across verse breaks. That is how a standard voice's audio
// would be made, since standard voices report where SSML bookmarks fall, so
// verse timings come with it. --verses adds <chapter>-<voice>-verses.mp3 and
// its timings, a verse per request: the only way to time a voice that
// reports no timings (the DragonHD and HD Flash voices). Listen there for
// the seam where a sentence runs across a verse.
//
// The text is what Read aloud says: verse numbers, footnote letters and
// bracket markers left out (scripts/lib/verse-text.mjs), after "Romans,
// chapter 8." No pronunciation fixes yet: hearing what each voice gets wrong
// is the point.
//
// The key: AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in the environment, or
// the same two lines (NAME=value) in ~/.lit-azure-speech, outside the repo.
// The key is never printed. Output goes to ~/LIT-voice-samples unless --out=
// says otherwise, so no audio lands in the repo.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { htmlToPlainText, splitChapterVerses } from "../lib/verse-text.mjs";
import { chapterIntro } from "../../src/lib/read-aloud.mjs";
import { bookKeyToLabel } from "../../src/data/books.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// The owner's shortlist from the Voice Gallery (2026-09-29): standard voices
// only (owner), for one price, exact verse timings and full pronunciation
// control.
const SHORTLIST = [
  "en-US-JaneNeural",
  "en-US-LolaMultilingualNeural",
  "en-US-AndrewMultilingualNeural",
  "en-US-SteffanMultilingualNeural",
];

// 48 kbps mono MP3: the size the storage estimates assume. Constant bit rate,
// so a clip's length follows from its byte count.
const FORMAT = "audio-24khz-48kbitrate-mono-mp3";
const BYTES_PER_SECOND = 48000 / 8;

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.length ? v.join("=") : true];
  })
);

const chapterSlug = String(args.chapter || "romans-8");
const voices = args.voices ? String(args.voices).split(",").filter(Boolean) : SHORTLIST;
const outDir = path.resolve(String(args.out || path.join(os.homedir(), "LIT-voice-samples")));
const dryRun = !!args["dry-run"];
const withVerses = !!args.verses;

/* ── The text ─────────────────────────────────────────────────────── */

const file = path.join(ROOT, "src/data/chapters", `${chapterSlug}.json`);
if (!fs.existsSync(file)) fail(`No chapter file for "${chapterSlug}".`);
const chapter = JSON.parse(fs.readFileSync(file, "utf8"));
if (!chapter.indexed) fail(`${chapter.title} is a draft; pick a published chapter.`);

const intro = chapterIntro(bookKeyToLabel(chapter.bookKey), chapter.chapter);

// Paragraph text: verse numbers out first (htmlToPlainText leaves their
// digits), then everything else the way the verse split does it.
const paragraphs = chapter.paragraphs
  .map((html) => htmlToPlainText(html.replace(/<sup\b[^>]*\bclass="vn"[^>]*>[\s\S]*?<\/sup>/gi, "")))
  .filter(Boolean);
const verses = [...splitChapterVerses(chapter.paragraphs)].map(([verse, text]) => ({ verse, text }));

const chars = (list) => list.reduce((n, t) => n + t.length, 0);
const perVoice =
  intro.length + chars(paragraphs) + (withVerses ? intro.length + chars(verses.map((v) => v.text)) : 0);
console.log(
  `${chapter.title}: ${paragraphs.length} paragraphs, ${verses.length} verses, ` +
    `${perVoice.toLocaleString()} characters per voice${withVerses ? " (both readings)" : ""}, ` +
    `${(perVoice * voices.length).toLocaleString()} in all for ${voices.length} voice(s).`
);

if (dryRun) {
  console.log(`\n${intro}\n`);
  for (const p of paragraphs) console.log(p + "\n");
  process.exit(0);
}

/* ── The key ──────────────────────────────────────────────────────── */

function readKeyFile() {
  const p = path.join(os.homedir(), ".lit-azure-speech");
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const keyFile = readKeyFile();
const KEY = process.env.AZURE_SPEECH_KEY || keyFile.AZURE_SPEECH_KEY;
const REGION = process.env.AZURE_SPEECH_REGION || keyFile.AZURE_SPEECH_REGION;
if (!KEY || !REGION) {
  fail(
    "No Azure key. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION, or put those two lines in " +
      path.join(os.homedir(), ".lit-azure-speech")
  );
}

/* ── Speaking ─────────────────────────────────────────────────────── */

const escapeXml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function ssml(voice, text) {
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">` +
    `<voice name="${voice}">${escapeXml(text)}</voice></speak>`
  );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One request. The free tier allows about 20 a minute, so a 429 waits and
// tries again rather than failing the run.
async function speak(voice, text) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": KEY,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": FORMAT,
        "User-Agent": "litbible-voice-sample",
      },
      body: ssml(voice, text),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if ((res.status === 429 || res.status >= 500) && attempt < 6) {
      const wait = Number(res.headers.get("retry-after")) * 1000 || 4000 * attempt;
      process.stdout.write(` (waiting ${Math.round(wait / 1000)}s)`);
      await sleep(wait);
      continue;
    }
    const body = (await res.text()).slice(0, 300);
    throw new Error(`${voice}: HTTP ${res.status} ${res.statusText} ${body}`);
  }
}

async function reading(voice, pieces, label) {
  const parts = [];
  const timings = [];
  let seconds = 0;
  process.stdout.write(`  ${label}: `);
  for (const piece of pieces) {
    const audio = await speak(voice, piece.text);
    if (piece.verse != null) timings.push({ verse: piece.verse, start: Math.round(seconds * 100) / 100 });
    seconds += audio.length / BYTES_PER_SECOND;
    parts.push(audio);
    process.stdout.write(".");
  }
  process.stdout.write(` ${Math.round(seconds)}s\n`);
  return { audio: Buffer.concat(parts), timings, seconds };
}

fs.mkdirSync(outDir, { recursive: true });
const safe = (voice) => voice.replace(/^en-US-/, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/-+$/, "");

for (const voice of voices) {
  console.log(`\n${voice}`);
  try {
    const flow = await reading(
      voice,
      [{ text: intro }, ...paragraphs.map((text) => ({ text }))],
      "paragraphs"
    );
    fs.writeFileSync(path.join(outDir, `${chapterSlug}-${safe(voice)}-paragraphs.mp3`), flow.audio);
    if (!withVerses) continue;

    const byVerse = await reading(voice, [{ text: intro }, ...verses], "verses");
    fs.writeFileSync(path.join(outDir, `${chapterSlug}-${safe(voice)}-verses.mp3`), byVerse.audio);
    // Where each verse starts in the verse-by-verse file: what the player
    // would highlight from. Approximate to a few hundredths of a second.
    fs.writeFileSync(
      path.join(outDir, `${chapterSlug}-${safe(voice)}-verses.json`),
      JSON.stringify({ voice, chapter: chapterSlug, format: FORMAT, verses: byVerse.timings }, null, 2) + "\n"
    );
  } catch (err) {
    console.error(`\n  ${err.message}`);
  }
}

console.log(`\nSaved in ${outDir}`);

function fail(message) {
  console.error(message);
  process.exit(1);
}
