// A bookmark's row in the Trash starts no follow and stops none (Audit 8, NB8-13).

import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDom } from "./helpers/browser-env.mjs";
import { createRecord } from "../src/lib/desk-records.mjs";

const { recordRow } = await import("../src/scripts/desk/record-rows.js");

const FOLLOW_KEY = "lit-desk-follow";
const moving = () =>
  createRecord("bookmark", { bookKey: "john", chapter: 3, verse: 16, endVerse: 16, follow: true }, { now: "2026-11-09T12:00:00.000Z", client: "web/test", contentVersion: "v1" });
const actions = { labels: new Map(), onLabels() {}, onDelete() {} };

/** Click without navigating anywhere. */
function click(el) {
  const stop = (e) => e.preventDefault();
  document.addEventListener("click", stop);
  try {
    el.click();
  } finally {
    document.removeEventListener("click", stop);
  }
}

test("NB8-13: a moving bookmark in the notebook has follow controls, and its link starts the follow", () => {
  resetDom();
  sessionStorage.removeItem(FOLLOW_KEY);
  const r = moving();
  const li = recordRow(r, actions);
  document.body.append(li);
  assert.ok(li.querySelector("[data-bookmark-follow-link]"), "Start/Stop following");
  assert.ok(li.querySelector("[data-bookmark-move]"), "Move it here");
  click(li.querySelector(".desk-item__ref"));
  assert.ok(sessionStorage.getItem(FOLLOW_KEY), "following the link started the follow");
  assert.equal(JSON.parse(sessionStorage.getItem(FOLLOW_KEY)).id, r.id);
  sessionStorage.removeItem(FOLLOW_KEY);
});

test("NB8-13: the same bookmark in the Trash has no follow controls, and its link starts no follow and stops none", () => {
  resetDom();
  const other = { id: "other", bookKey: "john", tab: "t" };
  sessionStorage.setItem(FOLLOW_KEY, JSON.stringify(other));
  const r = moving();
  const li = recordRow(r, { ...actions, trash: { when: "Deleted today", onRestore() {} } });
  document.body.append(li);
  assert.equal(li.querySelector("[data-bookmark-follow-link]"), null);
  assert.equal(li.querySelector("[data-bookmark-move]"), null);
  click(li.querySelector(".desk-item__ref"));
  assert.equal(sessionStorage.getItem(FOLLOW_KEY), JSON.stringify(other), "an earlier follow is neither replaced nor stopped");
  sessionStorage.removeItem(FOLLOW_KEY);
});

test("NB8-13: a stay-put bookmark's link in the Trash doesn't stop the follow that is running", () => {
  resetDom();
  const running = { id: "x", bookKey: "john", tab: "t" };
  sessionStorage.setItem(FOLLOW_KEY, JSON.stringify(running));
  const r = createRecord("bookmark", { bookKey: "john", chapter: 3, verse: 16, endVerse: 16 }, { now: "2026-11-09T12:00:00.000Z", client: "web/test", contentVersion: "v1" });
  const li = recordRow(r, { ...actions, trash: { when: "Deleted today", onRestore() {} } });
  document.body.append(li);
  click(li.querySelector(".desk-item__ref"));
  assert.equal(sessionStorage.getItem(FOLLOW_KEY), JSON.stringify(running));
  // In the notebook, the same link does stop it.
  const live = recordRow(r, actions);
  document.body.append(live);
  click(live.querySelector(".desk-item__ref"));
  assert.equal(sessionStorage.getItem(FOLLOW_KEY), null, "in the notebook, going to a stay-put bookmark stops the follow");
});
