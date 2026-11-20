import { test } from "node:test";
import assert from "node:assert/strict";
import { headingSlug, idChars } from "../src/slug.ts";

test("idChars keeps Unicode letters, numbers, dash and underscore", () => {
  assert.equal(idChars("نصب"), "نصب");
  assert.equal(idChars("نسخه ۲"), "نسخه-۲");
  assert.equal(idChars("snake_case-and-dash"), "snake_case-and-dash");
});

test("idChars turns each run of other characters into one dash", () => {
  assert.equal(idChars("install tabs!"), "install-tabs-");
  assert.equal(idChars('"><script>'), "-script-");
  assert.equal(idChars("a   b"), "a-b");
  assert.equal(idChars(""), "");
  assert.equal(headingSlug("install tabs!"), "install-tabs");
});

test("headingSlug lower-cases and folds accents to letters and numbers", () => {
  assert.equal(headingSlug("  Set Up! "), "set-up");
  assert.equal(headingSlug("Café"), "cafe");
  assert.equal(headingSlug("a_b"), "a-b");
  assert.equal(headingSlug("--x--"), "x");
  assert.equal(headingSlug("نصب"), "نصب");
  assert.equal(headingSlug("!!!"), "");
});
