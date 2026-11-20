import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../site/install.md", import.meta.url), "utf8");

test("install shows the version tip and package-manager tabs before the remaining guide", () => {
  const tip = source.indexOf(':::callout{type=tip title="Check the version first"}');
  const tabs = source.indexOf(':::install-tabs{package="@velella/mizzen @velella/lateen"}');
  const use = source.indexOf("## Use it");
  assert.ok(tip >= 0 && tabs > tip && use > tabs);
  assert.ok(source.includes("## Start from a starter"));
  assert.ok(source.includes("## What the theme does not do"));
});
