import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CANONICAL_NT_ORDER = [
  'matthew',
  'mark',
  'luke',
  'john',
  'acts',
  'romans',
  '1corinthians',
  '2corinthians',
  'galatians',
  'ephesians',
  'philippians',
  'colossians',
  '1thessalonians',
  '2thessalonians',
  '1timothy',
  '2timothy',
  'titus',
  'philemon',
  'hebrews',
  'james',
  '1peter',
  '2peter',
  '1john',
  '2john',
  '3john',
  'jude',
  'revelation',
];

const BOOK_INDEX = new Map(CANONICAL_NT_ORDER.map((book, index) => [book, index]));

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const projectRoot = path.resolve(scriptDir, '..');
const chaptersDir = path.join(projectRoot, 'src', 'data', 'chapters');
const apiDir = path.join(projectRoot, 'public', 'api');

async function readAndSortChapters() {
  const entries = await fs.readdir(chaptersDir, { withFileTypes: true });
  const jsonFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name);

  const chapters = [];

  for (const filename of jsonFiles) {
    const filePath = path.join(chaptersDir, filename);
    const raw = await fs.readFile(filePath, 'utf8');

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`Invalid JSON in ${filename}: ${error.message}`);
    }

    const bookKey = parsed?.bookKey;
    if (!BOOK_INDEX.has(bookKey)) {
      throw new Error(`Invalid bookKey in ${filename}: ${String(bookKey)}`);
    }

    const chapterNumber = Number(parsed?.chapter);
    if (Number.isNaN(chapterNumber)) {
      throw new Error(`Invalid chapter in ${filename}: ${String(parsed?.chapter)}`);
    }

    chapters.push({
      bookKey,
      chapterNumber,
      data: parsed,
    });
  }

  chapters.sort((a, b) => {
    const byBook = BOOK_INDEX.get(a.bookKey) - BOOK_INDEX.get(b.bookKey);
    if (byBook !== 0) {
      return byBook;
    }
    return a.chapterNumber - b.chapterNumber;
  });

  return chapters.map((chapter) => chapter.data);
}

/**
 * The content version is owned by build-api-manifest.mjs (it hashes the full
 * synced content set). Read it from version.json so content.json's `version`
 * matches what the apps poll. Falls back to a date-only string if this script
 * is run standalone before the manifest step (degraded, but keeps `build:api`
 * usable on its own).
 */
async function resolveVersion(generatedAt) {
  try {
    const raw = await fs.readFile(path.join(apiDir, 'version.json'), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed?.version) return parsed.version;
  } catch {
    // version.json not written yet — fall back below
  }
  return `v${generatedAt.slice(0, 10).replace(/-/g, '')}`;
}

async function main() {
  const generatedAt = new Date().toISOString();
  const chapters = await readAndSortChapters();

  await fs.mkdir(apiDir, { recursive: true });

  const version = await resolveVersion(generatedAt);

  const contentPayload = {
    version,
    generatedAt,
    chapters,
  };

  await fs.writeFile(path.join(apiDir, 'content.json'), JSON.stringify(contentPayload), 'utf8');
  console.log(`✅ public/api/content.json written — ${chapters.length} chapters (version ${version})`);
}

main().catch((error) => {
  console.error('❌ build-api-json failed');
  if (error && typeof error === 'object' && 'stack' in error && error.stack) {
    console.error(error.stack);
  } else {
    console.error(error);
  }
  process.exit(1);
});
