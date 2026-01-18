import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

// Adjust if your chapters live somewhere else
const CHAPTERS_DIR = path.join(ROOT, "src", "data", "chapters");
const OUT_FILE = path.join(ROOT, "public", "topics-index.json");

function normalizeTopic(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[\u00A0]/g, " ")
    .replace(/[’']/g, "")          // drop apostrophes
    .replace(/[^a-z0-9\s-]/g, " ") // kill punctuation
    .replace(/\s+/g, "-")          // spaces -> hyphen
    .replace(/-+/g, "-")           // collapse
    .replace(/^-|-$/g, "");        // trim hyphens
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

async function buildFromChapters(topicsMap) {
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

    // You can decide how to treat intros if you have them in this folder
    const url =
      chapter === "intro" || type === "intro"
        ? `/${bookKey}-intro`
        : `/${bookKey}-${chapter}`;

    const topics = Array.isArray(data.topics) ? data.topics : [];
    for (const t of topics) {
      const key = normalizeTopic(t);
      if (!key) continue;

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
    }
  }
}

async function main() {
  const topicsMap = {};

  await buildFromChapters(topicsMap);

  // Deduplicate within each topic by URL
  for (const key of Object.keys(topicsMap)) {
    const seen = new Set();
    topicsMap[key] = topicsMap[key].filter((e) => {
      if (seen.has(e.url)) return false;
      seen.add(e.url);
      return true;
    });
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    topics: topicsMap,
  };

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
