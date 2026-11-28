import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const DOC = readFileSync(new URL("../docs/design/audit-0.2.6.md", import.meta.url), "utf8");
const CATEGORIES = ["token", "layout shell", "prose", "code", "component", "API", "home", "search", "chart"];

interface Row {
  readonly id: string;
  readonly category: string;
  readonly owners: readonly string[];
}

/** The rows of the defect table: `| D1 | defect | category | case | owner |`. */
function rows(): Row[] {
  return DOC.split("\n")
    .filter((line) => /^\| D\d+ \|/.test(line))
    .map((line) => {
      const cells = line.split("|").map((cell) => cell.trim());
      return { id: cells[1] ?? "", category: cells[3] ?? "", owners: [...(cells[5] ?? "").matchAll(/#\d+/g)].map((m) => m[0]) };
    });
}

test("the audit lists defects with sequential ids", () => {
  const found = rows();
  assert.ok(found.length >= 9, "the nine known defects are all covered");
  found.forEach((row, index) => assert.equal(row.id, `D${String(index + 1)}`));
});

test("every defect has one category from the list and exactly one owner issue", () => {
  for (const row of rows()) {
    assert.ok(CATEGORIES.includes(row.category), `${row.id}: unknown category "${row.category}"`);
    assert.equal(row.owners.length, 1, `${row.id}: needs exactly one owner`);
  }
});

test("the owner check names every owner the table uses", () => {
  const checked = new Set([...(DOC.split("## Owner check")[1] ?? "").matchAll(/#\d+/g)].map((m) => m[0]));
  for (const row of rows()) for (const owner of row.owners) assert.ok(checked.has(owner), `${row.id}: ${owner} missing from the owner check`);
});
