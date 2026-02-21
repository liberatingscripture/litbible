#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { findNodeAtLocation, getNodeValue, parseTree } from "jsonc-parser";

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const FIX_MODE = args.has("--fix");

function walkJsonFiles(dir) {
  const out = [];
  const stack = [dir];
  const skip = new Set(["node_modules", ".git", "dist", ".astro"]);

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
        if (!skip.has(entry.name)) stack.push(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
        out.push(full);
      }
    }
  }

  return out;
}

function resolveChapterFiles() {
  const preferred = path.join(ROOT, "src", "data", "chapters");
  if (fs.existsSync(preferred) && fs.statSync(preferred).isDirectory()) {
    return fs
      .readdirSync(preferred, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".json"))
      .map((d) => path.join(preferred, d.name))
      .sort();
  }

  const srcDir = path.join(ROOT, "src");
  const candidates = walkJsonFiles(srcDir);
  const chapterFiles = [];
  for (const file of candidates) {
    try {
      const raw = fs.readFileSync(file, "utf8");
      const json = JSON.parse(raw);
      if (
        json &&
        typeof json === "object" &&
        Array.isArray(json.paragraphs) &&
        typeof json.bookKey === "string" &&
        Object.prototype.hasOwnProperty.call(json, "chapter")
      ) {
        chapterFiles.push(file);
      }
    } catch {
      // ignore parse failures in discovery fallback
    }
  }
  return chapterFiles.sort();
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replaceAll("\\", "/");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function snippet(text, index) {
  const start = Math.max(0, (index || 0) - 45);
  const end = Math.min(text.length, (index || 0) + 95);
  return text
    .slice(start, end)
    .replace(/\s+/g, " ")
    .trim();
}

function parseJsonFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    return { ok: true, raw, data };
  } catch (error) {
    return { ok: false, error };
  }
}

function extractVglueRanges(paragraphHtml) {
  const ranges = [];
  const stack = [];
  const spanTagRe = /<\/?span\b[^>]*>/gi;

  let match;
  while ((match = spanTagRe.exec(paragraphHtml)) !== null) {
    const tag = match[0];
    const idx = match.index;

    if (/^<span\b/i.test(tag)) {
      const isVglue = /\bclass=(['"])[^'"]*\bvglue\b[^'"]*\1/i.test(tag);
      stack.push({
        isVglue,
        start: idx,
        contentStart: idx + tag.length,
      });
      continue;
    }

    const open = stack.pop();
    if (!open) continue;
    if (open.isVglue) {
      ranges.push({
        start: open.start,
        end: idx + tag.length,
        contentStart: open.contentStart,
        contentEnd: idx,
      });
    }
  }

  return ranges;
}

function findContainingRange(ranges, start, end) {
  let chosen = null;
  for (const range of ranges) {
    if (start >= range.contentStart && end <= range.contentEnd) {
      if (!chosen || range.contentStart > chosen.contentStart) chosen = range;
    }
  }
  return chosen;
}

function fixV1EmptyGlue(paragraphHtml) {
  // Safe fix only:
  // <span class="vglue"><sup ... id="v1" class="vn">1</sup>&nbsp;</span>Token
  // -> move immediate plain-text token into vglue span.
  const pattern =
    /<span class="vglue">\s*(<sup\b(?=[^>]*\bid=(['"])v1\2)(?=[^>]*\bclass=(['"])[^'"]*\bvn\b[^'"]*\3)[^>]*>\s*1\s*<\/sup>)\s*&nbsp;\s*<\/span>(\s*)([^<\s][^\s<]*)/gi;

  let changed = false;
  const next = paragraphHtml.replace(
    pattern,
    (_m, sup, _q1, _q2, ws, token) => {
      changed = true;
      return `<span class="vglue">${sup}&nbsp;${token}</span>${ws}`;
    },
  );

  return { changed, paragraphHtml: next };
}

function getParagraphStringNodes(raw) {
  const parseErrors = [];
  const root = parseTree(raw, parseErrors, {
    allowTrailingComma: false,
    disallowComments: true,
  });

  if (!root) {
    return {
      ok: false,
      message: "Could not parse JSON tree.",
    };
  }

  if (parseErrors.length > 0) {
    const first = parseErrors[0];
    return {
      ok: false,
      message: `JSON parse error near offset ${first.offset}.`,
    };
  }

  const paragraphsNode = findNodeAtLocation(root, ["paragraphs"]);
  if (!paragraphsNode || paragraphsNode.type !== "array") {
    return {
      ok: false,
      message: 'Missing or invalid "paragraphs" array in JSON tree.',
    };
  }

  return {
    ok: true,
    nodes: paragraphsNode.children ?? [],
  };
}

function applyTextEdits(raw, edits) {
  const ordered = [...edits].sort((a, b) => b.offset - a.offset);
  let next = raw;
  for (const edit of ordered) {
    next = `${next.slice(0, edit.offset)}${edit.replacement}${next.slice(
      edit.offset + edit.length,
    )}`;
  }
  return next;
}

function validateChapterFile(filePath, parsed, stats) {
  const issues = [];
  const warnings = [];
  const { data } = parsed;
  const bookKey = String(data?.bookKey ?? "");
  const chapter = String(data?.chapter ?? "");
  const paragraphs = Array.isArray(data?.paragraphs) ? data.paragraphs : null;

  if (!paragraphs) {
    issues.push({
      level: "error",
      file: filePath,
      paragraphIndex: "-",
      rule: "schema",
      message: 'Missing required "paragraphs" array.',
      snippet: "",
    });
    return { issues, warnings };
  }

  const idSeen = new Set();
  const footnoteRefs = [];
  const expectedPrefix = new RegExp(
    `^${escapeRegExp(bookKey)}-${escapeRegExp(chapter)}-p\\d+$`,
  );

  for (let i = 0; i < paragraphs.length; i += 1) {
    stats.paragraphs += 1;
    const html = String(paragraphs[i] ?? "");

    // Rule 4: paragraph starts with a container tag that has id="book-chapter-pX"
// Accept <p>, <blockquote>, or <figure> (covers hbq poetry + placeholder figures).
const startTag = html.match(
  /^\s*<(p|blockquote|figure)\b[^>]*\bid=(['"])([^'"]+)\2/i,
);

if (!startTag) {
  warnings.push({
    level: "warn",
    file: filePath,
    paragraphIndex: i,
    rule: 4,
    message:
      'Paragraph must start with <p|blockquote|figure id="bookKey-chapter-pX">.',
    snippet: snippet(html, 0),
  });
} else {
  const pid = startTag[3];

  if (!expectedPrefix.test(pid)) {
    warnings.push({
      level: "warn",
      file: filePath,
      paragraphIndex: i,
      rule: 4,
      message: `Paragraph id "${pid}" does not match ${bookKey}-${chapter}-p# pattern.`,
      snippet: snippet(html, startTag.index ?? 0),
    });
  }

  if (idSeen.has(pid)) {
    warnings.push({
      level: "warn",
      file: filePath,
      paragraphIndex: i,
      rule: 4,
      message: `Duplicate paragraph id "${pid}" in file.`,
      snippet: snippet(html, startTag.index ?? 0),
    });
  } else {
    idSeen.add(pid);
  }
}


    // Rule 5 refs collection from paragraphs.
    const fnRefRe =
      /<a\b[^>]*\bid=(['"])(fnref-[^'"]+)\1[^>]*\bhref=(['"])#([^'"]+)\3[^>]*>/gi;
    let fnMatch;
    while ((fnMatch = fnRefRe.exec(html)) !== null) {
      footnoteRefs.push({
        paragraphIndex: i,
        refId: fnMatch[2],
        id: fnMatch[4],
        index: fnMatch.index,
        html,
      });
    }

    const vglueRanges = extractVglueRanges(html);
    const verseSupRe =
      /<sup\b(?=[^>]*\bid=(['"])v(\d+)\1)(?=[^>]*\bclass=(['"])[^'"]*\bvn\b[^'"]*\3)[^>]*>\s*(\d+)\s*<\/sup>/gi;
    let supMatch;
    while ((supMatch = verseSupRe.exec(html)) !== null) {
      const verseNum = Number(supMatch[2]);
      const supOpenIndex = supMatch.index;
      const supCloseIndex = supOpenIndex + supMatch[0].length;
      const range = findContainingRange(vglueRanges, supOpenIndex, supCloseIndex);

      // Rule 1
      if (!range) {
        issues.push({
          level: "error",
          file: filePath,
          paragraphIndex: i,
          rule: 1,
          message: `Verse marker v${verseNum} is not wrapped in <span class="vglue">...</span>.`,
          snippet: snippet(html, supOpenIndex),
        });
        continue;
      }

      const afterSup = html.slice(supCloseIndex, range.contentEnd);
      // Rule 2
      if (!/^\s*&nbsp;/i.test(afterSup)) {
        issues.push({
          level: "error",
          file: filePath,
          paragraphIndex: i,
          rule: 2,
          message: `Verse marker v${verseNum} in vglue is not immediately followed by &nbsp;.`,
          snippet: snippet(html, supOpenIndex),
        });
      }

      // Rule 3 (v1 only)
      if (verseNum === 1) {
        const afterNbsp = afterSup.replace(/^\s*&nbsp;/i, "");
        const textContent = afterNbsp
          .replace(/<[^>]*>/g, "")
          .replace(/&nbsp;/gi, "")
          .trim();
        if (!textContent) {
          issues.push({
            level: "error",
            file: filePath,
            paragraphIndex: i,
            rule: 3,
            message:
              "v1 glue span is empty after &nbsp;; include first word/punctuation inside the same vglue span.",
            snippet: snippet(html, supOpenIndex),
          });
        }
      }
    }
  }

  // Rule 5 footnote consistency
  const footnotes = Array.isArray(data?.footnotes) ? data.footnotes : null;
  const footnotePairs = new Set();
  if (footnotes) {
    for (const note of footnotes) {
      const fid = String(note?.id ?? "");
      const refId = String(note?.refId ?? "");
      if (fid || refId) footnotePairs.add(`${refId}|${fid}`);
    }
  }

  for (const ref of footnoteRefs) {
    if (!footnotes) {
      issues.push({
        level: "error",
        file: filePath,
        paragraphIndex: ref.paragraphIndex,
        rule: 5,
        message: `Reference ${ref.refId} -> #${ref.id} has no matching footnotes[] entry (footnotes missing).`,
        snippet: snippet(ref.html, ref.index),
      });
      continue;
    }
    if (!footnotePairs.has(`${ref.refId}|${ref.id}`)) {
      issues.push({
        level: "error",
        file: filePath,
        paragraphIndex: ref.paragraphIndex,
        rule: 5,
        message: `Reference ${ref.refId} -> #${ref.id} does not match any footnote { refId, id }.`,
        snippet: snippet(ref.html, ref.index),
      });
    }
  }

  if (footnotes) {
    const refUsedPairs = new Set(footnoteRefs.map((r) => `${r.refId}|${r.id}`));
    footnotes.forEach((note) => {
      const fid = String(note?.id ?? "");
      const refId = String(note?.refId ?? "");
      if (!fid || !refId) return;
      if (!refUsedPairs.has(`${refId}|${fid}`)) {
        warnings.push({
          level: "warn",
          file: filePath,
          paragraphIndex: "-",
          rule: 5,
          message: `Unused footnote entry { refId: "${refId}", id: "${fid}" }.`,
          snippet: "",
        });
      }
    });
  }

  return { issues, warnings };
}

function isRepoClean() {
  const res = spawnSync("git", ["status", "--porcelain"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (res.status !== 0) return false;
  return String(res.stdout || "").trim() === "";
}

function runFixPass(files) {
  const changed = [];
  const clean = isRepoClean();
  let fixedParagraphs = 0;

  for (const file of files) {
    let raw;
    try {
      raw = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }

    const tree = getParagraphStringNodes(raw);
    if (!tree.ok) continue;

    const edits = [];
    for (let i = 0; i < tree.nodes.length; i += 1) {
      const node = tree.nodes[i];
      if (!node || node.type !== "string") continue;
      const before = String(getNodeValue(node) ?? "");
      const result = fixV1EmptyGlue(before);
      if (result.changed && result.paragraphHtml !== before) {
        edits.push({
          offset: node.offset,
          length: node.length,
          replacement: JSON.stringify(result.paragraphHtml),
        });
      }
    }

    if (!edits.length) continue;

    const nextRaw = applyTextEdits(raw, edits);
    if (nextRaw === raw) continue;

    if (!clean) {
      const bak = `${file}.bak`;
      fs.copyFileSync(file, bak);
    }

    fs.writeFileSync(file, nextRaw, "utf8");
    fixedParagraphs += edits.length;
    changed.push({
      file,
      updates: edits.length,
      backup: !clean,
    });
  }

  return { changed, fixedParagraphs, backupMode: !clean };
}

function printIssues(allIssues, allWarnings) {
  for (const issue of allIssues) {
    console.error(
      `ERROR ${rel(issue.file)} paragraph[${issue.paragraphIndex}] rule ${issue.rule}: ${issue.message}`,
    );
    if (issue.snippet) console.error(`  snippet: ${issue.snippet}`);
  }
  for (const warn of allWarnings) {
    console.warn(
      `WARN  ${rel(warn.file)} paragraph[${warn.paragraphIndex}] rule ${warn.rule}: ${warn.message}`,
    );
    if (warn.snippet) console.warn(`  snippet: ${warn.snippet}`);
  }
}

function printSummary(stats, errorsCount, warningsCount) {
  console.log("");
  console.log("Summary");
  console.log(`  files scanned: ${stats.files}`);
  console.log(`  paragraphs scanned: ${stats.paragraphs}`);
  console.log(`  errors: ${errorsCount}`);
  console.log(`  warnings: ${warningsCount}`);
}

function validateAll(files) {
  const stats = { files: 0, paragraphs: 0 };
  const allIssues = [];
  const allWarnings = [];

  for (const file of files) {
    stats.files += 1;
    const parsed = parseJsonFile(file);
    if (!parsed.ok) {
      allIssues.push({
        level: "error",
        file,
        paragraphIndex: "-",
        rule: "json",
        message: `Invalid JSON: ${parsed.error?.message || "parse failed"}`,
        snippet: "",
      });
      continue;
    }

    const result = validateChapterFile(file, parsed, stats);
    allIssues.push(...result.issues);
    allWarnings.push(...result.warnings);
  }

  return { stats, allIssues, allWarnings };
}

function main() {
  const files = resolveChapterFiles();
  if (!files.length) {
    console.error("No chapter JSON files found.");
    process.exitCode = 1;
    return;
  }

  if (FIX_MODE) {
    const fixResult = runFixPass(files);
    if (fixResult.changed.length) {
      console.log(
        `Applied safe fixes in ${fixResult.changed.length} file(s), ${fixResult.fixedParagraphs} paragraph(s).`,
      );
      if (fixResult.backupMode) {
        console.log("Repo is dirty; created .bak files next to changed chapter files.");
      } else {
        console.log("Repo is clean; wrote changes in place without .bak files.");
      }
    } else {
      console.log("No safe --fix changes were applicable.");
    }
    console.log("Re-running validation after fixes...\n");
  }

  const { stats, allIssues, allWarnings } = validateAll(files);
  printIssues(allIssues, allWarnings);
  printSummary(stats, allIssues.length, allWarnings.length);
  process.exitCode = allIssues.length > 0 ? 1 : 0;
}

main();
