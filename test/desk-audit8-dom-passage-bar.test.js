// The passage field with previous and next arrows (passage-bar.js) driven in a
// browser DOM (Audit 8, LG8-8): what it asks for through `set`, what it says
// when the typing isn't a passage, and how it puts the passage back.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "./helpers/browser-env.mjs";

const { createPassageBar } = await import("../src/scripts/desk/passage-bar.js");

const key = (el, k) => el.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));

let set, bar, field, error;
const asked = [];
const steps = () => [...bar.el.querySelectorAll(".desk-passage__step")];

function mount(passage) {
  asked.length = 0;
  set = (p) => asked.push(p);
  bar = createPassageBar({ id: "t", set });
  document.body.replaceChildren(bar.el);
  field = bar.el.querySelector(".desk-passage__field");
  error = bar.el.querySelector(".desk-passage__error");
  bar.update(passage);
}
const submit = () => bar.el.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));

beforeEach(() => mount({ bookKey: "john", chapter: 3, verse: null }));

test("update shows the passage in the field and names the neighbors on the arrows", () => {
  assert.equal(field.value, "John 3");
  const [prev, next] = steps();
  assert.equal(prev.getAttribute("aria-label"), "Previous chapter, John 2");
  assert.equal(next.getAttribute("aria-label"), "Next chapter, John 4");
  assert.equal(prev.getAttribute("aria-disabled"), "false");
});

test("the arrows ask for the neighboring chapter, across books, and are inert at the ends", () => {
  const [prev, next] = steps();
  prev.click();
  assert.deepEqual(asked.pop(), { bookKey: "john", chapter: 2, verse: null });
  bar.update({ bookKey: "john", chapter: 21, verse: null });
  next.click();
  assert.equal(asked.pop().bookKey, "acts", "John 21 steps on into Acts 1");

  bar.update({ bookKey: "matthew", chapter: 1, verse: null });
  assert.equal(prev.getAttribute("aria-disabled"), "true");
  assert.equal(prev.getAttribute("aria-label"), "Previous chapter");
  prev.click();
  assert.equal(asked.length, 0, "nothing before Matthew 1");
});

test("typing a reference and submitting asks for that passage and tidies the field", () => {
  field.value = "jn 3.16";
  submit();
  assert.deepEqual(asked, [{ bookKey: "john", chapter: 3, verse: 16 }]);
  assert.equal(field.value, "John 3:16");
  assert.equal(error.hidden, true);
});

test("something that is not a New Testament passage says so, asks for nothing, and clears when typing resumes", () => {
  field.value = "Genesis 1";
  submit();
  assert.deepEqual(asked, []);
  assert.equal(error.hidden, false);
  assert.match(error.textContent, /isn’t a passage in the New Testament/);
  assert.equal(error.getAttribute("role"), "alert");
  assert.equal(field.getAttribute("aria-invalid"), "true");
  field.value = "Genesis 1x";
  field.dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.equal(error.hidden, true);
  assert.equal(field.getAttribute("aria-invalid"), "false");
});

test("Escape puts the passage back and selects it; leaving the field does the same", () => {
  field.focus();
  field.value = "garbage";
  key(field, "Escape");
  assert.equal(field.value, "John 3");
  field.value = "Romans 8";
  field.dispatchEvent(new window.FocusEvent("blur"));
  assert.equal(field.value, "John 3");
});

test("update leaves what the reader is typing alone while the field has focus", () => {
  field.focus();
  field.value = "Rom";
  bar.update({ bookKey: "mark", chapter: 1, verse: null });
  assert.equal(field.value, "Rom");
  assert.equal(steps()[1].getAttribute("aria-label"), "Next chapter, Mark 2", "the arrows still follow the new passage");
});
