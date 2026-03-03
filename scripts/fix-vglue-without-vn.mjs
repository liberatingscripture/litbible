#!/usr/bin/env node
// One-off content fixer:
// unwrap <span class="vglue">...</span> only when it does NOT contain <sup class="vn">.
// Uses JSON AST range edits so file formatting/order remain unchanged.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getNodeValue, parseTree } from "jsonc-parser";

const ROOT = process.cwd();
const CHAPTER_DIR = path.join(ROOT, "src", "data", "chapters");

function rel(filePath) {
  return path.relative(ROOT, filePath).replaceAll("\\", "/");
}

function isRepoClean() {
  const res = spawnSync("git", ["status", "--porcelain"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (res.status !== 0) return false;
  return String(res.stdout || "").trim() === "";
}

function listChapterJsonFiles(dir) {
  const files = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
        files.push(full);
      }
    }
  }
  return files.sort();
}

function findTagEnd(input, ltIndex) {
  let quote = "";
  for (let i = ltIndex + 1; i < input.length; i += 1) {
    const ch = input[i];
    if (quote) {
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === ">") return i;
  }
  return -1;
}

function isBoundaryChar(ch) {
  return ch === undefined || /[\s/>]/.test(ch);
}

function parseSpanTagAt(input, index) {
  if (input[index] !== "<") return null;
  const slice = input.slice(index).toLowerCase();
  if (slice.startsWith("</span") && isBoundaryChar(input[index + 6])) {
    const end = findTagEnd(input, index);
    if (end < 0) return null;
    return {
      type: "close",
      start: index,
      end: end + 1,
      text: input.slice(index, end + 1),
    };
  }
  if (slice.startsWith("<span") && isBoundaryChar(input[index + 5])) {
    const end = findTagEnd(input, index);
    if (end < 0) return null;
    return {
      type: "open",
      start: index,
      end: end + 1,
      text: input.slice(index, end + 1),
    };
  }
  return null;
}

function findNextSpanTag(input, fromIndex) {
  let i = fromIndex;
  while (i < input.length) {
    const lt = input.indexOf("<", i);
    if (lt < 0) return null;
    const tag = parseSpanTagAt(input, lt);
    if (tag) return tag;
    i = lt + 1;
  }
  return null;
}

function hasClassVglue(openTagText) {
  const classMatch = openTagText.match(
    /\bclass\s*=\s*("([^"]*)"|'([^']*)')/i,
  );
  if (!classMatch) return false;
  const classValue = classMatch[2] ?? classMatch[3] ?? "";
  return classValue.split(/\s+/).some((token) => token === "vglue");
}

function findMatchingSpanClose(input, openTag) {
  let depth = 1;
  let cursor = openTag.end;
  while (cursor < input.length) {
    const tag = findNextSpanTag(input, cursor);
    if (!tag) return null;
    if (tag.type === "open") {
      depth += 1;
    } else {
      depth -= 1;
      if (depth === 0) {
        return {
          closeStart: tag.start,
          closeEnd: tag.end,
        };
      }
    }
    cursor = tag.end;
  }
  return null;
}

function hasVerseMarkerVn(innerHtml) {
  return /<sup\b[^>]*\bclass\s*=\s*("([^"]*\bvn\b[^"]*)"|'([^']*\bvn\b[^']*)')[^>]*>/i.test(
    innerHtml,
  );
}

function unwrapBadVglueInHtml(html) {
  if (!html || !html.includes("vglue") || !html.includes("<span")) {
    return { html, replacements: 0 };
  }

  let out = "";
  let cursor = 0;
  let replacements = 0;

  while (cursor < html.length) {
    const tag = findNextSpanTag(html, cursor);
    if (!tag) {
      out += html.slice(cursor);
      break;
    }

    out += html.slice(cursor, tag.start);

    if (tag.type !== "open" || !hasClassVglue(tag.text)) {
      out += html.slice(tag.start, tag.end);
      cursor = tag.end;
      continue;
    }

    const closing = findMatchingSpanClose(html, tag);
    if (!closing) {
      out += html.slice(tag.start);
      break;
    }

    const inner = html.slice(tag.end, closing.closeStart);
    if (hasVerseMarkerVn(inner)) {
      out += html.slice(tag.start, closing.closeEnd);
    } else {
      out += inner;
      replacements += 1;
    }
    cursor = closing.closeEnd;
  }

  return { html: out, replacements };
}

function collectStringNodes(rootNode) {
  const out = [];
  const stack = [rootNode];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    if (node.type === "string") out.push(node);
    if (node.children?.length) {
      for (let i = node.children.length - 1; i >= 0; i -= 1) {
        stack.push(node.children[i]);
      }
    }
  }
  return out;
}

function applyEdits(raw, edits) {
  const ordered = [...edits].sort((a, b) => b.offset - a.offset);
  let next = raw;
  for (const edit of ordered) {
    next = `${next.slice(0, edit.offset)}${edit.replacement}${next.slice(
      edit.offset + edit.length,
    )}`;
  }
  return next;
}

function shortSample(input, max = 120) {
  const s = input.replace(/\s+/g, " ").trim();
  return s.length <= max ? s : `${s.slice(0, max - 1)}...`;
}

function main() {
  if (!fs.existsSync(CHAPTER_DIR)) {
    console.error(`Chapter directory not found: ${rel(CHAPTER_DIR)}`);
    process.exitCode = 1;
    return;
  }

  const files = listChapterJsonFiles(CHAPTER_DIR);
  const cleanRepo = isRepoClean();

  let filesChanged = 0;
  let replacementsTotal = 0;
  const samples = [];

  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8");
    const parseErrors = [];
    const root = parseTree(raw, parseErrors, {
      allowTrailingComma: false,
      disallowComments: true,
    });
    if (!root || parseErrors.length > 0) continue;

    const stringNodes = collectStringNodes(root);
    const edits = [];

    for (const node of stringNodes) {
      const value = getNodeValue(node);
      if (typeof value !== "string") continue;
      if (!value.includes("vglue") || !value.includes("<span")) continue;

      const fixed = unwrapBadVglueInHtml(value);
      if (fixed.replacements > 0 && fixed.html !== value) {
        edits.push({
          offset: node.offset,
          length: node.length,
          replacement: JSON.stringify(fixed.html),
        });
        replacementsTotal += fixed.replacements;
        if (samples.length < 5) {
          samples.push({
            file: rel(file),
            before: shortSample(value),
            after: shortSample(fixed.html),
          });
        }
      }
    }

    if (!edits.length) continue;

    if (!cleanRepo) {
      fs.copyFileSync(file, `${file}.bak`);
    }

    const nextRaw = applyEdits(raw, edits);
    if (nextRaw !== raw) {
      fs.writeFileSync(file, nextRaw, "utf8");
      filesChanged += 1;
    }
  }

  console.log(`Scanned files: ${files.length}`);
  console.log(`Changed files: ${filesChanged}`);
  console.log(`Replacements: ${replacementsTotal}`);
  if (!cleanRepo && filesChanged > 0) {
    console.log("Repo is dirty; created .bak files for changed files.");
  }
  if (samples.length) {
    console.log("\nSamples:");
    for (const sample of samples) {
      console.log(`- ${sample.file}`);
      console.log(`  before: ${sample.before}`);
      console.log(`  after : ${sample.after}`);
    }
  }
}

main();
