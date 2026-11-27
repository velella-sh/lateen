import assert from "node:assert/strict";
import { test } from "node:test";
import { findUnrendered } from "../scripts/design-audit.ts";
import { buildFixture } from "./visual/fixtures/build.ts";
import { tempDir } from "./integration-helpers.ts";

test("the audit lists units that no captured page renders, each with a reason", () => {
  const build = tempDir("design-audit-inventory-");
  buildFixture(build);
  const rows = findUnrendered(build);
  assert.ok(rows.length > 0, "the inventory page holds components the gallery does not show");
  for (const row of rows) assert.ok(row.reason.length > 0, `${row.unit} has no reason`);
  const callouts = rows.filter((row) => row.unit === "abstract");
  assert.equal(callouts[0]?.reason, "inventory page only");
  assert.equal(new Set(rows.map((row) => `${row.kind}/${row.unit}`)).size, rows.length, "a unit is listed once");
});
