import assert from "node:assert/strict";
import { test } from "node:test";
import { PATHS, readableLeading } from "../scripts/test-type.ts";

test("readable leading is 1.4 to 1.8 times the font size", () => {
  assert.ok(readableLeading({ fontSize: 17, lineHeight: 28.05 }));
  assert.ok(!readableLeading({ fontSize: 17, lineHeight: 20 }));
  assert.ok(!readableLeading({ fontSize: 17, lineHeight: 40 }));
});

test("the type gate visits the docs home, a guide, and the data explorer", () => {
  assert.equal(PATHS.length, 3);
});
