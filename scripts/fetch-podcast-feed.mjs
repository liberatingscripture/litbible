#!/usr/bin/env node
/**
 * fetch-podcast-feed.mjs
 *
 * Fetches the Found in Translation RSS feed and saves it to
 * src/data/podcast-feed.xml, which the podcast page parses at build time.
 *
 * This script NEVER fails the build: if the feed is unreachable, it warns
 * and leaves the previous committed snapshot in place, so a RedCircle
 * outage cannot break a deploy.
 */

import { writeFileSync, readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const RSS_URL =
  "https://feeds.redcircle.com/59ffbfb2-f814-469a-8522-416bb67c15f6";
const FETCH_TIMEOUT_MS = 15_000;

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const outPath = resolve(__dirname, "..", "src/data/podcast-feed.xml");

try {
  const response = await fetch(RSS_URL, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const xml = await response.text();

  // Sanity check: don't overwrite a good snapshot with an error page
  if (!xml.includes("<item>")) {
    throw new Error("response does not look like an RSS feed (no <item>)");
  }

  const previous = existsSync(outPath) ? readFileSync(outPath, "utf-8") : null;
  if (previous === xml) {
    console.log("✅ Podcast feed unchanged — snapshot already up to date.");
  } else {
    writeFileSync(outPath, xml, "utf-8");
    console.log("✅ Podcast feed snapshot updated: src/data/podcast-feed.xml");
  }
} catch (e) {
  if (existsSync(outPath)) {
    console.warn(
      `⚠ Podcast feed fetch failed (${e.message}) — building with the existing snapshot.`,
    );
  } else {
    console.error(
      `✗ Podcast feed fetch failed (${e.message}) and no snapshot exists yet — the podcast page will have no episodes.`,
    );
  }
}
