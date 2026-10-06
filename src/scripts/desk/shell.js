// src/scripts/desk/shell.js
//
// The Study Desk, as loaded by desk-gate.js on a computer with the preview
// switched on (STUDY-DESK.md, phase 1b). Everything the desk needs comes in
// through here, so none of it reaches a reader who hasn't switched it on.

// As text, added below as a <style>. A plain CSS import is gathered into
// every page's stylesheet by Astro, dynamic import or not, which would have
// every reader download the desk's styles.
import deskCss from "../../styles/desk.css?inline";
import { webClient } from "../../lib/desk-store-core.mjs";
import { openStore } from "./store.js";
import { createPanel } from "./panel.js";
import { initUndo } from "./undo-bar.js";

// Stamped at build by Layout.astro (src/lib/content-version.mjs, which reads
// the file system and so can't be imported here).
const contentVersion = document.documentElement.dataset.contentVersion || "unversioned";

/** What every record this page writes is stamped with. */
const ctx = () => ({ client: webClient(contentVersion), contentVersion });

async function start() {
  const style = document.createElement("style");
  style.dataset.desk = "";
  style.textContent = deskCss;
  document.head.append(style);

  let store = null;
  let storeError = null;
  try {
    store = await openStore({ ctx });
  } catch (err) {
    storeError = err;
  }
  initUndo();
  createPanel({ store, storeError, ctx });
}

start();
