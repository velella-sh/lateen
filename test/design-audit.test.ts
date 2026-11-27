import assert from "node:assert/strict";
import { test } from "node:test";
import { auditIndex, auditMatrix } from "../scripts/design-audit.ts";
import { loadMatrix } from "../visual/index.ts";

test("the audit matrix shoots every layout and gallery page in the default look", () => {
  const source = loadMatrix();
  const matrix = auditMatrix(source);
  const index = auditIndex(matrix);
  const widths = Object.keys(source.widths).length;
  const pages = matrix.layouts.length + matrix.gallery.pages.length;
  assert.equal(index.length, pages * widths * source.themes.length);
  assert.equal(new Set(index.map((shot) => shot.case)).size, index.length, "case names are unique");
  for (const target of [...matrix.layouts, ...matrix.gallery.pages]) assert.equal(target.fixture, "default");
});

test("the audit covers light and dark, left-to-right and right-to-left, at three widths", () => {
  const index = auditIndex();
  assert.deepEqual([...new Set(index.map((shot) => shot.theme))].sort(), ["dark", "light"]);
  assert.deepEqual([...new Set(index.map((shot) => shot.dir))].sort(), ["ltr", "rtl"]);
  assert.deepEqual([...new Set(index.map((shot) => shot.width))].sort((a, b) => a - b), [375, 768, 1280]);
  assert.ok(index.every((shot) => shot.lang !== "ar"));
});
