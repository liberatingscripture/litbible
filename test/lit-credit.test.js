// test/lit-credit.test.js
//
// src/lib/lit-credit.mjs: the attribution notice and the address a printed
// page carries.

import { test } from "node:test";
import assert from "node:assert/strict";

import { LIT_CREDIT_LINE, printableUrl } from "../src/lib/lit-credit.mjs";

test("the notice is the one /read's license terms require", () => {
  assert.equal(
    LIT_CREDIT_LINE,
    "Scripture and footnote quotations are from the LIT Bible (litbible.net), used by permission under CC BY-NC-ND 4.0.",
  );
});

test("a printed address drops the scheme and the trailing slash", () => {
  assert.equal(printableUrl("https://litbible.net/john-3/"), "litbible.net/john-3");
  assert.equal(printableUrl("https://litbible.net/read/philemon/"), "litbible.net/read/philemon");
  assert.equal(printableUrl("http://localhost:4321/romans-intro/"), "localhost:4321/romans-intro");
  assert.equal(printableUrl("https://litbible.net/john-3/#v16"), "litbible.net/john-3#v16");
  assert.equal(printableUrl(""), "");
  assert.equal(printableUrl(undefined), "");
});
