/**
 * build-api-manifest.mjs
 *
 * Generates /api/manifest.json and copies content files to /api/data/
 * so the iOS and Android apps can check for updates and download changed files.
 *
 * Runs automatically as part of `npm run build`.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const dataDir = path.join(projectRoot, 'src', 'data');
const outputBase = path.join(projectRoot, 'public', 'api');
const outputData = path.join(outputBase, 'data');

function hashBuffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Collect all content files that should be served to the apps.
 * Returns an array of { relativePath, absolutePath } objects.
 */
async function collectContentFiles() {
  const files = [];

  // chapters/*.json
  const chaptersDir = path.join(dataDir, 'chapters');
  for (const name of await fs.readdir(chaptersDir)) {
    if (name.endsWith('.json')) {
      files.push({
        relativePath: `chapters/${name}`,
        absolutePath: path.join(chaptersDir, name),
      });
    }
  }

  // intros/*.md
  const introsDir = path.join(dataDir, 'intros');
  try {
    for (const name of await fs.readdir(introsDir)) {
      if (name.endsWith('.md')) {
        files.push({
          relativePath: `intros/${name}`,
          absolutePath: path.join(introsDir, name),
        });
      }
    }
  } catch {
    // intros directory may not exist yet
  }

  // Top-level data files the spec expects (include them when they exist)
  const topLevelFiles = [
    'glossary.json',
    'release-notes.json',
    'topics.json',
    'translation-commitments.json',
  ];
  for (const name of topLevelFiles) {
    const abs = path.join(dataDir, name);
    try {
      await fs.access(abs);
      files.push({ relativePath: name, absolutePath: abs });
    } catch {
      // File doesn't exist yet — skip
    }
  }

  // Also include generated topics-index.json as topics.json if the dedicated
  // file doesn't already exist and the generated one does.
  const hasTopicsJson = files.some((f) => f.relativePath === 'topics.json');
  if (!hasTopicsJson) {
    const generated = path.join(projectRoot, 'public', 'topics-index.json');
    try {
      await fs.access(generated);
      files.push({ relativePath: 'topics.json', absolutePath: generated });
    } catch {
      // Not yet generated — skip
    }
  }

  return files;
}

async function main() {
  const files = await collectContentFiles();
  const manifest = { generatedAt: new Date().toISOString(), files: {} };

  // Ensure output directories exist
  await fs.mkdir(path.join(outputData, 'chapters'), { recursive: true });
  await fs.mkdir(path.join(outputData, 'intros'), { recursive: true });

  for (const { relativePath, absolutePath } of files) {
    const content = await fs.readFile(absolutePath);
    manifest.files[relativePath] = hashBuffer(content);

    const dest = path.join(outputData, relativePath);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, content);
  }

  await fs.writeFile(
    path.join(outputBase, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
  );

  console.log(
    `✅ public/api/manifest.json written — ${Object.keys(manifest.files).length} files hashed`,
  );
  console.log(
    `✅ public/api/data/ populated — files ready for app sync`,
  );
}

main().catch((error) => {
  console.error('❌ build-api-manifest failed');
  console.error(error?.stack ?? error);
  process.exit(1);
});
