// The "also a Greek word" offer (search-core.js greekOfferFor): its words table
// is a plain lookup, so an inherited name is not a Greek word (GK3-6), and one
// failed fetch doesn't turn the offer off for the rest of the visit (GK3-14).
import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.document = { documentElement: { dataset: { desk: "on" } } };
let calls = 0;
let behavior = "fail";
globalThis.fetch = async () => {
  calls++;
  if (behavior === "reject") throw new Error("offline");
  if (behavior === "fail") return { ok: false, status: 503, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => ({ format: 1, words: { pistis: "πίστις", logos: "λόγος" } }) };
};

const { greekOfferFor, offerLemma } = await import("../src/scripts/search-core.js");

test("GK3-6: offerLemma knows only the table's own keys", () => {
  const words = Object.assign(Object.create(null), { pistis: "πίστις" });
  assert.equal(offerLemma(words, ["pistis"]), "πίστις");
  assert.equal(offerLemma(words, ["constructor"]), null);
  // Even a plain object, as a caller might pass, does not offer what it inherits.
  assert.equal(offerLemma({ pistis: "πίστις" }, ["constructor", "toString", "__proto__", "hasOwnProperty"]), null);
  assert.equal(offerLemma({ a: "" }, ["a"]), null, "an empty lemma is no offer");
  assert.equal(offerLemma({ a: 3 }, ["a"]), null, "a lemma is a string");
  assert.equal(offerLemma(words, ["nope", "pistis"]), "πίστις", "the first key that is there");
});

test("GK3-14: a failed fetch is forgotten, so the offer returns on the next search", async () => {
  behavior = "fail";
  assert.equal(await greekOfferFor("/", "pistis", "all"), null);
  behavior = "reject";
  assert.equal(await greekOfferFor("/", "pistis", "all"), null);
  const failed = calls;
  behavior = "ok";
  assert.deepEqual(await greekOfferFor("/", "pistis", "all"), { word: "pistis", greek: "πίστις" });
  assert.equal(calls, failed + 1, "it asked again");
  // Once it has loaded it is kept.
  assert.deepEqual(await greekOfferFor("/", "logos", "all"), { word: "logos", greek: "λόγος" });
  assert.equal(calls, failed + 1);
});

test("GK3-6: a word that merely shares a name with Object's is not offered", async () => {
  behavior = "ok";
  assert.equal(await greekOfferFor("/", "constructor", "all"), null);
  assert.equal(await greekOfferFor("/", "valueOf", "all"), null);
  assert.equal(await greekOfferFor("/", "hasownproperty", "all"), null);
});

test("the offer stands down for the Greek type and for anything but a single word", async () => {
  behavior = "ok";
  assert.equal(await greekOfferFor("/", "pistis", "greek"), null);
  assert.equal(await greekOfferFor("/", "pistis logos", "all"), null);
  assert.equal(await greekOfferFor("/", "πίστις", "all"), null);
});
