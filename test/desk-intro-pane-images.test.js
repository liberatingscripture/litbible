// The Book Intro pane driven in a browser DOM (E120): Matthew's introduction
// has a chart, an img of the site's own, which the pane's scrub used to remove.
// Fed a page shaped like the built /matthew-intro/, the pane's article must
// hold the img with its alt and src, no style, and nothing that loads from
// anywhere else.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle } from "./helpers/browser-env.mjs";

const { createIntroPane } = await import("../src/scripts/desk/intro-pane.js");

const PAGE =
  '<!doctype html><html><body><article class="chapter"><section class="intro">' +
  "<p>The following chart shows the mirrored passages and pivotal section.</p>" +
  '<figure style="margin: 0; text-align: center;">' +
  '<img src="/images/matthew-chiasm.png" alt="Matthew chiasm diagram" style="display: block; max-width: 400px;" onerror="x()" />' +
  '<figcaption style="margin-top: 0.5rem;">Visit <a href="https://litbible.net/articles/matthew-15-canaanite-woman">this article</a> to read more.</figcaption>' +
  '</figure><p><img src="https://evil.example/pixel.png" alt="beacon"></p><p><img src="/img/x.png" alt="other folder"></p>' +
  "</section></article></body></html>";

test("the Book Intro pane keeps the site's own chart image, without its style, and drops other images", async () => {
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => PAGE });
  const pane = createIntroPane({
    paneId: "t1",
    start: { bookKey: "matthew", chapter: 1, verse: null },
    set: () => {},
    showPassage: () => {},
  });
  document.body.append(pane.el);
  await settle(20);
  const article = pane.el.querySelector(".desk-intro__article");
  assert.ok(article, "the introduction drew");
  const found = [...article.querySelectorAll("img")];
  assert.equal(found.length, 1, "only the site image stays");
  const img = found[0];
  assert.equal(img.getAttribute("src"), "/images/matthew-chiasm.png");
  assert.equal(img.getAttribute("alt"), "Matthew chiasm diagram");
  assert.equal(img.getAttribute("style"), null);
  assert.equal(img.getAttribute("onerror"), null);
  assert.equal(article.querySelector("figure").getAttribute("style"), null);
  assert.ok(article.querySelector("figcaption").textContent.includes("Visit this article"));
  pane.destroy();
});
