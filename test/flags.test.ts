// The one reading of a directive's bare attribute: `version-badge`'s `block`, `reading-time`'s
// `showWords`, and `preset-preview`'s `picker` all decide "on" with this, so an author's spelling
// cannot mean one thing in one component and the opposite in another. Each component's own test
// keeps its flag on the same matrix.
import assert from "node:assert/strict";
import { test } from "node:test";
import { flagOf } from "../src/flags.ts";

test("flagOf turns a bare attribute on and only the false words off", () => {
  // A bare word arrives as "", a written value as a string, and a missing one as undefined.
  for (const on of ["", "true", "block", "YES", "1", "on", "  "]) {
    assert.equal(flagOf(on), true, `${JSON.stringify(on)} is on`);
  }
  for (const off of ["false", "no", "0", "off", " FALSE ", "\tNo\n", "OFF"]) {
    assert.equal(flagOf(off), false, `${JSON.stringify(off)} is off`);
  }
  for (const off of [undefined, null, false]) {
    assert.equal(flagOf(off), false, `${String(off)} is off`);
  }
  for (const on of [true, 0, 1, {}, []]) {
    assert.equal(flagOf(on), true, `${JSON.stringify(on) ?? String(on)} is on`);
  }
});
