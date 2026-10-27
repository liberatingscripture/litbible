/**
 * Reading and writing the frontmatter of the /apps Markdown collections
 * (callouts, examples, seasons) for the Apps Page Studio.
 *
 * Deliberately a small subset of YAML, the one those files are written in:
 * top-level `key: value` lines whose value is a plain scalar, a double- or
 * single-quoted string, a number, a boolean, or a `|` / `|-` block. Anything
 * else (lists, nested maps, comments, anchors) throws rather than being
 * guessed at, so a hand edit the Studio can't read stops the run instead of
 * being rewritten wrong.
 *
 * Writing keeps every field the change didn't touch byte for byte (its
 * original lines), so applying one edit to a file changes one field's lines
 * and nothing else. The tests hold every file in those three collections to a
 * byte-identical round trip.
 */

const KEY_LINE = /^([A-Za-z_][A-Za-z0-9_]*):(?: (.*))?$/;

/**
 * Parse a Markdown file with frontmatter.
 * @returns {{ fields: {key: string, value: unknown, raw: string[]}[], body: string, bodyRaw: string }}
 *   `body` is the text after the frontmatter with its leading and trailing
 *   blank lines removed; `bodyRaw` is exactly what followed the closing fence.
 */
export function parseDoc(text, where = "file") {
  if (!text.startsWith("---\n")) throw new Error(`${where}: no frontmatter`);
  const close = text.indexOf("\n---\n", 3);
  const closeAtEnd = text.endsWith("\n---") ? text.length - 3 : -1;
  const end = close >= 0 ? close : closeAtEnd - 1;
  if (end < 0) throw new Error(`${where}: frontmatter is never closed`);
  const lines = text.slice(4, end + 1).split("\n");
  lines.pop(); // the split leaves an empty string after the last newline
  const bodyRaw = close >= 0 ? text.slice(close + 5) : "";

  const fields = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = KEY_LINE.exec(line);
    if (!m) throw new Error(`${where}: can't read frontmatter line ${i + 2}: ${JSON.stringify(line)}`);
    const [, key, rest = ""] = m;
    if (fields.some((f) => f.key === key)) throw new Error(`${where}: "${key}" appears twice`);
    if (rest === "|" || rest === "|-") {
      const raw = [line];
      const block = [];
      let indent = null;
      while (i + 1 < lines.length && (lines[i + 1] === "" || /^ +/.test(lines[i + 1]))) {
        const next = lines[++i];
        raw.push(next);
        if (next === "") { block.push(""); continue; }
        const lead = next.match(/^ */)[0].length;
        if (indent === null) indent = lead;
        if (lead < indent) throw new Error(`${where}: "${key}" block is indented unevenly`);
        block.push(next.slice(indent));
      }
      while (block.length && block[block.length - 1] === "") block.pop();
      const joined = block.join("\n");
      fields.push({ key, value: rest === "|" ? `${joined}\n` : joined, raw });
    } else {
      fields.push({ key, value: parseScalar(rest, `${where}: "${key}"`), raw: [line] });
    }
  }
  return { fields, body: bodyRaw.replace(/^\n+/, "").replace(/\n+$/, ""), bodyRaw };
}

function parseScalar(s, where) {
  if (s === "") return null;
  if (s.startsWith('"')) {
    if (!s.endsWith('"') || s.length < 2) throw new Error(`${where}: unclosed quote`);
    try { return JSON.parse(s); } catch { throw new Error(`${where}: a quoted value the Studio can't read`); }
  }
  if (s.startsWith("'")) {
    if (!s.endsWith("'") || s.length < 2) throw new Error(`${where}: unclosed quote`);
    const inner = s.slice(1, -1);
    if (/(^|[^'])'([^']|$)/.test(inner)) throw new Error(`${where}: a quoted value the Studio can't read`);
    return inner.replace(/''/g, "'");
  }
  if (/^[-+]?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (s === "true") return true;
  if (s === "false") return false;
  if (/^[[{&*!|>%@`]/.test(s) || /(^|\s)#/.test(s) || /: /.test(s) || s.endsWith(":")) {
    throw new Error(`${where}: a value the Studio can't read (${JSON.stringify(s)})`);
  }
  return s.trim();
}

/** Whether a string can be written as a YAML plain scalar and read back as the same string. */
export function plainSafe(s) {
  if (s === "" || s !== s.trim() || /[\n\r\t]/.test(s)) return false;
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(s)) return false;
  if (/: |\s#|:$/.test(s)) return false;
  if (/^(true|false|yes|no|on|off|null|y|n|~)$/i.test(s)) return false;
  if (/^[-+.]?\d/.test(s) && /^[-+]?(\d[\d_]*)?(\.\d*)?([eE][-+]?\d+)?$/.test(s)) return false;
  if (/^0[xob]/i.test(s)) return false;
  return true;
}

/**
 * The lines one field is written as. `quote` writes a one-line string in
 * double quotes even where it could go bare, as these files do for image
 * paths, notes and color names.
 */
export function fieldLines(key, value, { quote = false } = {}) {
  if (typeof value === "number" || typeof value === "boolean") return [`${key}: ${value}`];
  if (value === null || value === undefined) throw new Error(`"${key}" has no value`);
  if (typeof value !== "string") throw new Error(`"${key}" must be text, a number or true/false`);
  if (value.includes("\n")) {
    const keep = value.endsWith("\n");
    const lines = (keep ? value.slice(0, -1) : value).split("\n");
    if (/^ /.test(lines[0])) throw new Error(`"${key}" can't start with a space`);
    return [`${key}: ${keep ? "|" : "|-"}`, ...lines.map((l) => (l === "" ? "" : `  ${l}`))];
  }
  return [`${key}: ${!quote && plainSafe(value) ? value : JSON.stringify(value)}`];
}

/**
 * Write a document back. Each field keeps its original lines when its value
 * is unchanged; changed and new fields are written fresh, in the order given,
 * quoted if they were quoted before or their key is in `quoteKeys`.
 * @param {{key: string, value: unknown, raw?: string[], original?: unknown}[]} fields
 * @param {{body: string, bodyRaw?: string, originalBody?: string}} body
 * @param {{quoteKeys?: Iterable<string>}} [style]
 */
export function serializeDoc(fields, { body, bodyRaw, originalBody }, { quoteKeys = [] } = {}) {
  const always = new Set(quoteKeys);
  const out = ["---"];
  for (const f of fields) {
    if (f.value === undefined) continue; // a field removed by the change
    const same = f.raw && Object.is(f.value, f.original);
    const quote = always.has(f.key) || /^[A-Za-z_][A-Za-z0-9_]*: "/.test(f.raw?.[0] ?? "");
    out.push(...(same ? f.raw : fieldLines(f.key, f.value, { quote })));
  }
  out.push("---");
  const keepBody = bodyRaw !== undefined && body === originalBody;
  const tail = keepBody ? bodyRaw : body ? `\n${body}\n` : "";
  return `${out.join("\n")}\n${tail}`;
}
