export function normalizeHbqVerseGlue(html: string): string {
  const source = String(html ?? "");
  if (!source.includes("hbq-line") || !source.includes('class="vglue"')) {
    return source;
  }

  return source.replace(
    /<p\b[^>]*class=(['"])[^'"]*\bhbq-line\b[^'"]*\1[^>]*>[\s\S]*?<\/p>/gi,
    (lineHtml: string) => {
      if (lineHtml.includes("hbq-first") || lineHtml.includes("hbq-rest")) {
        return lineHtml;
      }

      return lineHtml.replace(
        /^(<p\b[^>]*class=(['"])[^'"]*\bhbq-line\b[^'"]*\2[^>]*>\s*(?:<span class="rm-verse-anchor"[^>]*>\s*<\/span>\s*)*)<span class="vglue">\s*(<sup\b[^>]*\bclass=(['"])[^'"]*\bvn\b[^'"]*\4[^>]*>[\s\S]*?<\/sup>)\s*(?:&nbsp;|\u00a0)\s*([\s\S]*?)<\/span>([\s\S]*?)(<\/p>)$/i,
        (
          _match: string,
          lineOpen: string,
          _lineQuote: string,
          sup: string,
          _supQuote: string,
          firstChunk: string,
          tailChunk: string,
          lineClose: string,
        ) => {
          const combined = `${String(firstChunk ?? "")}${String(tailChunk ?? "")}`;
          const combinedTrimmed = combined.replace(/^\s+/, "");
          const firstMatch = combinedTrimmed.match(
            /^((?:<[^>]+>\s*)*)(\S+)([\s\S]*)$/,
          );

          if (!firstMatch) {
            return lineHtml;
          }

          const leadingTags = firstMatch[1] ?? "";
          const firstWord = `${leadingTags}${firstMatch[2] ?? ""}`;
          const rest = firstMatch[3] ?? "";
          const restHtml = rest ? `<span class="hbq-rest">${rest}</span>` : "";

          return `${lineOpen}<span class="vglue">${sup}&#8288;<span class="hbq-first">${firstWord}</span></span>${restHtml}${lineClose}`;
        },
      );
    },
  );
}
