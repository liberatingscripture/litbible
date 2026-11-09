// Audit 8, batch G: GK8-3, GK8-4 and GK8-6 are driven in
// test/desk-audit8-dom-greek-tab.test.js and desk-audit8-dom-greek-builder.test.js.
// Nothing here reads source any more; the file stays as a pointer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

test("the driven Greek tests are present", () => {
  for (const f of ["desk-audit8-dom-greek-tab.test.js", "desk-audit8-dom-greek-builder.test.js"]) {
    assert.ok(existsSync(new URL(`./${f}`, import.meta.url)), f);
  }
});
