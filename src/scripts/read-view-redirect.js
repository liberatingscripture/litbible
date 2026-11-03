// src/scripts/read-view-redirect.js
//
// NOT LOADED YET. The page script for the retired `/read/<book>` (STUDY-DESK.md,
// E8, "At launch"; work session 8b built it, 8c switches it on): it sends the
// reader to the Chapter View address the old one belongs at, keeping its place
// (`#ch-10`, `#luke-10-v25`). The rules are src/lib/read-view-retirement.mjs.
// At 8c `/read/[book].astro` becomes a noindex page that loads this and
// carries `<meta http-equiv="refresh">` to the book's first chapter for a
// reader without scripts.

import { studyAddress } from "../lib/read-view-retirement.mjs";

const to = studyAddress(window.location.pathname, window.location.hash);
if (to) window.location.replace(to);
