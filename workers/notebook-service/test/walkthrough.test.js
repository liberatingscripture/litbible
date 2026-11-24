// The vectors' walkthrough, end to end against the Worker in workerd: a first
// device, a second joined by passkey, a third approved, one removed with a
// change of key, a switch to "this device only," and a recovery by code.
// test/walkthrough.js has the steps; scripts/walkthrough.mjs runs the same
// ones against a deployed service.
import { describe, it } from "vitest";
import * as ref from "../../../src/lib/desk-crypto.mjs";
// Read as text and parsed here: the file holds characters (the white space a pasted code
// can carry) that Vite's own JSON import turns into a module workerd can't parse.
import vectorsText from "../../../test/fixtures/notebook-crypto-vectors.json?raw";
import { SECRET, call, freshAccount } from "./call.js";
import { walkthroughSteps } from "./walkthrough.js";

const vectors = JSON.parse(vectorsText);

describe("the test vectors' walkthrough, with the service in the middle", () => {
  const steps = walkthroughSteps({ call, ref, vectors, secret: SECRET, account: freshAccount("walkthrough") });
  // The steps share one notebook and run in order; the first to fail stops the rest.
  let stopped = false;
  for (const { name, run } of steps) {
    it(name, async ({ skip }) => {
      if (stopped) skip();
      try {
        await run();
      } catch (error) {
        stopped = true;
        throw error;
      }
    });
  }
});
