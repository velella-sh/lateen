import assert from "node:assert/strict";
import { test } from "node:test";
import { isRecord } from "../src/guards.ts";
import { isRecord as entryIsRecord, theme } from "../src/index.ts";

test("a plain object passes, including nested and boxed objects", () => {
  assert.equal(isRecord({}), true);
  assert.equal(isRecord({ field: "value" }), true);
  assert.equal(isRecord(new Date()), true);
  assert.equal(isRecord({ nested: { deep: 1 } }), true);
});

test("null, arrays, and non-objects are rejected", () => {
  assert.equal(isRecord(null), false);
  assert.equal(isRecord(undefined), false);
  assert.equal(isRecord([]), false);
  assert.equal(isRecord([{}]), false);
  assert.equal(isRecord("object"), false);
  assert.equal(isRecord(1), false);
  assert.equal(isRecord(true), false);
  assert.equal(isRecord(() => 1), false);
});

test("narrowing reads fields without a cast", () => {
  const values: unknown[] = [{ name: "one" }, "two", null, [3]];
  const names = values.filter(isRecord).flatMap((value) => (typeof value.name === "string" ? [value.name] : []));
  assert.deepEqual(names, ["one"]);
});

test("the theme entry still names its folders and re-exports the same guard", () => {
  assert.equal(theme.name, "lateen");
  assert.equal(entryIsRecord({ ok: true }), true);
  assert.equal(entryIsRecord(null), false);
  assert.equal(entryIsRecord([]), false);
});
