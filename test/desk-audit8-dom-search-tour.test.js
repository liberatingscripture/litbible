// The tour runner (src/scripts/desk/tour-runner.js) driven in a browser DOM
// (Audit 8: DK8-9, GF8b-5): a step still opening from a tour that ended never
// counts as the current step of the next one, and a `later()` registered once
// the tour is over runs at once.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, window } from "./helpers/browser-env.mjs";

const { createTourRunner } = await import("../src/scripts/desk/tour-runner.js");

const steps = ["one", "two"].map((id, i) => ({
  id,
  title: `Step ${id}`,
  partName: "Part",
  number: i + 1,
  of: 2,
  nextPart: null,
  body: { default: `Words for ${id}.` },
}));

const click = (sel) => document.querySelector(sel).dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
const cardTitle = () => document.querySelector(".desk-tour__title")?.textContent;
const reset = () => {
  document.querySelector(".desk-tour")?.remove();
  document.documentElement.removeAttribute("data-desk-tour");
};

test("GF8b-5: a later() registered after the tour ended runs at once, and a throwing one is swallowed", () => {
  const runner = createTourRunner();
  let ran = 0;
  runner.later(() => ran++);
  assert.equal(ran, 1, "no run is going, so nothing else would ever undo it");
  runner.later(() => {
    throw new Error("a closer that throws");
  });
  assert.equal(runner.running(), false);
});

test("GF8b-5: a later() registered during a run waits for the step to be undone, then runs once", async () => {
  reset();
  const runner = createTourRunner();
  let undone = 0;
  runner.start({
    steps,
    act: async (step) => {
      if (step.id === "one") runner.later(() => undone++);
      return null;
    },
  });
  await settle(20);
  assert.equal(undone, 0, "still showing the step");
  click(".desk-tour__next");
  await settle(20);
  assert.equal(undone, 1, "undone before the next step");
  runner.end();
  await settle(20);
  assert.equal(undone, 1, "not run again");
});

test("GF8b-5: a step that opens something after the tour ended is told it is no longer live", async () => {
  reset();
  const runner = createTourRunner();
  const opened = [];
  let release;
  runner.start({
    steps,
    act: async (step, { live }) => {
      await new Promise((r) => (release = r));
      // What the tours do: open only while this step is the one showing, else undo at once.
      if (live()) opened.push(step.id);
      else runner.later(() => opened.push(`${step.id} undone`));
    },
  });
  runner.end(); // the tour ends while step one is still opening
  release();
  await settle(20);
  assert.deepEqual(opened, ["one undone"]);
});

test("DK8-9: a step still opening from an ended tour cannot mark or show the next tour's card", async () => {
  reset();
  const runner = createTourRunner();
  const staleTarget = document.createElement("button");
  document.body.append(staleTarget);
  let releaseA;
  runner.start({
    steps,
    act: async () => {
      await new Promise((r) => (releaseA = r));
      return { el: staleTarget };
    },
  });
  runner.end(); // tour A ends while its first step is still opening
  reset();
  // Tour B starts; its first step never finishes opening, so its card is not shown yet.
  runner.start({ steps, act: () => new Promise(() => {}) });
  releaseA(); // A's step now finishes: it holds token 1, as B's first step does
  await settle(30);
  assert.ok(!staleTarget.classList.contains("desk-tour-target"), "tour A's target is not outlined in tour B");
  assert.ok(!document.querySelector(".desk-tour").classList.contains("desk-tour--on"), "tour B's card is not shown by tour A's step");
  runner.end();
  staleTarget.remove();
});

test("DK8-9: moving on while a step opens leaves the older step not live", async () => {
  reset();
  const runner = createTourRunner();
  const releases = [];
  const live = {};
  runner.start({
    steps,
    act: async (step, { live: isLive }) => {
      await new Promise((r) => releases.push(r));
      live[step.id] = isLive();
      return null;
    },
  });
  click(".desk-tour__next"); // to step two while step one is still opening
  releases.forEach((r) => r());
  await settle(30);
  assert.deepEqual(live, { one: false, two: true });
  runner.end();
});
