import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

// chapters
const CHAPTERS_DIR = path.join(ROOT, "src", "data", "chapters");

// outputs
const OUT_INDEX_FILE = path.join(ROOT, "public", "topics-index.json"); // existing
const OUT_AUTOCOMPLETE_FILE = path.join(ROOT, "public", "search", "topics.json"); // new

function normalizeTopic(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[\u00A0]/g, " ")
    .replace(/[’']/g, "") // drop apostrophes
    .replace(/[^a-z0-9\s-]/g, " ") // kill punctuation
    .replace(/\s+/g, "-") // spaces -> hyphen
    .replace(/-+/g, "-") // collapse
    .replace(/^-|-$/g, ""); // trim hyphens
}

function bookKeyToLabel(key) {
  const m = String(key).match(/^(\d+)?([a-z]+)$/i);
  if (!m) return String(key);
  const num = m[1] ? m[1] + " " : "";
  const word = m[2];
  return num + word.charAt(0).toUpperCase() + word.slice(1);
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function buildFromChapters(topicsMap, topicMeta) {
  if (!(await fileExists(CHAPTERS_DIR))) return;

  const files = (await fs.readdir(CHAPTERS_DIR)).filter((f) => f.endsWith(".json"));

  for (const f of files) {
    const full = path.join(CHAPTERS_DIR, f);
    const raw = await fs.readFile(full, "utf8");

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      continue;
    }

    const bookKey = data.bookKey || data.book || "";
    const chapter = data.chapter;
    const type = data.type || "scripture";
    const title =
      data.title ||
      (bookKey && chapter ? `${bookKeyToLabel(bookKey)} ${chapter}` : "Scripture");

    const url =
      chapter === "intro" || type === "intro"
        ? `/${bookKey}-intro`
        : `/${bookKey}-${chapter}`;

    const topics = Array.isArray(data.topics) ? data.topics : [];
    for (const t of topics) {
      const key = normalizeTopic(t);
      if (!key) continue;

      // Full index entry (topic -> list of pages)
      const entry = {
        url,
        title,
        type,
        book: bookKey || "",
        chapter: typeof chapter === "number" ? chapter : null,
        topicLabel: String(t),
      };

      if (!topicsMap[key]) topicsMap[key] = [];
      topicsMap[key].push(entry);

      // Lightweight autocomplete meta (topic -> counts + original label)
      if (!topicMeta[key]) {
        topicMeta[key] = {
          key,
          label: String(t).trim(),
          count: 0,
          books: new Set(),
        };
      }
      topicMeta[key].count += 1;
      if (bookKey) topicMeta[key].books.add(bookKey);
    }
  }
}

async function main() {
  const topicsMap = {};
  const topicMeta = {}; // key -> { key, label, count, books:Set }

  await buildFromChapters(topicsMap, topicMeta);

  // Deduplicate within each topic by URL
  for (const key of Object.keys(topicsMap)) {
    const seen = new Set();
    topicsMap[key] = topicsMap[key].filter((e) => {
      if (seen.has(e.url)) return false;
      seen.add(e.url);
      return true;
    });
  }

  // Deterministic key order so the generated files are byte-stable when the
  // underlying topics haven't changed. This keeps the app-sync content hash
  // (and therefore version.json) from churning on every rebuild.
  //
  // Deliberately NO `generatedAt` (or any other per-build timestamp): emitting
  // one would change the file every build, churn the content hash, bump
  // version.json, and force every client to re-download on every sync — the
  // exact throttling hole the content-hashed version closed. Consumers must
  // therefore treat `generatedAt` as absent/optional; the authoritative
  // build time lives in version.json / manifest.json, not here.
  const sortedTopics = {};
  for (const key of Object.keys(topicsMap).sort()) {
    sortedTopics[key] = topicsMap[key];
  }

  // 1) Full index (existing behavior)
  const indexPayload = {
    topics: sortedTopics,
  };

  await fs.mkdir(path.dirname(OUT_INDEX_FILE), { recursive: true });
  await fs.writeFile(OUT_INDEX_FILE, JSON.stringify(indexPayload, null, 2), "utf8");
  console.log(`Wrote ${OUT_INDEX_FILE}`);

  // 2) Autocomplete payload (small + fast)
  // Sort: most common first, tie-break alphabetical
  const autocompleteItems = Object.values(topicMeta)
    .map((m) => ({
      key: m.key,
      label: m.label,
      count: m.count,
      books: Array.from(m.books),
    }))
    .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label));

  const autocompletePayload = {
    items: autocompleteItems,
  };

  await fs.mkdir(path.dirname(OUT_AUTOCOMPLETE_FILE), { recursive: true });
  await fs.writeFile(
    OUT_AUTOCOMPLETE_FILE,
    JSON.stringify(autocompletePayload, null, 2),
    "utf8",
  );
  console.log(`Wrote ${OUT_AUTOCOMPLETE_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
