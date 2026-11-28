// src/scripts/read-view-redirect.js
//
// The page script for the retired `/read/<book>` (src/pages/read/[book].astro;
// STUDY-DESK.md, E8; Featherboa's Phase 4, WB-44): it sends the reader to the
// chapter's page the old address belongs at, keeping its place (`#ch-10`,
// `#luke-10-v25`), with `location.replace`, so Back skips the old address.
// The rules are src/lib/read-view-retirement.mjs. The page carries a
// `<meta http-equiv="refresh">` to the book's first chapter for a reader
// without scripts.

import { studyAddress } from "../lib/read-view-retirement.mjs";

const to = studyAddress(window.location.pathname, window.location.hash);
if (to) window.location.replace(to);
