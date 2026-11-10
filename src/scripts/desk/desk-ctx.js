// src/scripts/desk/desk-ctx.js
//
// What every record a desk page writes is stamped with: the client and the
// content version the page was built from. Its own small module (Audit 8,
// LG8-10) so a phone showing a shared sheet can have it without boot.js,
// which brings all of desk.css; boot.js re-exports it for the rest.

import { webClient } from "../../lib/desk-store-core.mjs";

// Stamped at build by Layout.astro (src/lib/content-version.mjs, which reads
// the file system and so can't be imported here).
const contentVersion = document.documentElement.dataset.contentVersion || "unversioned";

/** What every record this page writes is stamped with. */
export const deskCtx = () => ({ client: webClient(contentVersion), contentVersion });
