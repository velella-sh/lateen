import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { readUiCss } from "./ui-css-helpers.ts";

const layouts = readFileSync(new URL("../site/layouts.md", import.meta.url), "utf8");
const components = readFileSync(new URL("../site/components/index.md", import.meta.url), "utf8");
const styles = readUiCss();

function section(source: string, name: string): string {
  const start = source.indexOf(`## ${name}`);
  assert.notEqual(start, -1, `missing ${name} section`);
  const next = source.indexOf("\n## ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

function layoutRows(name: string): string[] {
  return [...section(layouts, name).matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1]!);
}

test("layout reference keeps the complete inventory in task-based groups", () => {
  assert.deepEqual([...layouts.matchAll(/^## (.+)$/gm)].map((match) => match[1]), [
    "Choosing one",
    "Reading",
    "Collections",
    "Reference",
  ]);
  assert.deepEqual(layoutRows("Reading"), ["doc", "home", "guide", "base"]);
  assert.deepEqual(layoutRows("Collections"), ["list", "record", "post", "gallery"]);
  assert.deepEqual(layoutRows("Reference"), ["api-reference", "api-reference-index", "versions", "search-results", "not-found"]);
  for (const link of [
    "[API reference layout](/layouts/api-reference/)",
    "[Gallery layout](/components/gallery/)",
    "[Guide layout](/components/guide/)",
    "[List layout](/layouts/list/)",
    "[Blog layout](/layouts/post/)",
    "[Record layout](/layouts/record/)",
    "[Showpiece home](/showpiece/)",
    "[ask your agent](/ask-agent/)",
  ]) {
    assert.ok(layouts.includes(link), link);
  }
});

test("component reference leads with its complete alphabetized inventory", () => {
  const codeTabs = components.indexOf("## Code tabs");
  const inventory = components.indexOf("## In the library");
  assert.notEqual(codeTabs, -1);
  assert.notEqual(inventory, -1);
  assert.ok(inventory < codeTabs, "the inventory comes before the code tabs");
  assert.ok(components.includes(":::code-tabs{labels='[\"npm\",\"pnpm\",\"yarn\"]'}"));
  for (const command of ["npx mizzen dev .", "pnpm exec mizzen dev .", "yarn mizzen dev ."]) {
    assert.ok(components.includes(command), command);
  }
  const rows = [...section(components, "In the library").matchAll(/^\| \[[^\]]+\]\(\.\/([^/]+)\/\) \|/gm)].map((match) => match[1]!);
  assert.deepEqual(rows, [
    "add-to-calendar",
    "badge",
    "callout",
    "cards",
    "changelog-entry",
    "charts",
    "citation",
    "cli-demo",
    "code",
    "code-tabs",
    "compare",
    "data-explorer",
    "dated-list",
    "details",
    "diff-block",
    "drift-banner",
    "embed",
    "embed-code",
    "endpoint",
    "figure",
    "file-tree",
    "gallery",
    "glossary",
    "guide",
    "heading-anchor",
    "kbd",
    "key-value",
    "link-card",
    "mermaid",
    "network",
    "os-tabs",
    "output-block",
    "page-status",
    "preset-preview",
    "reading-time",
    "record-history",
    "report-issue",
    "reports",
    "schema-table",
    "stale-notice",
    "state",
    "status",
    "status-banner",
    "steps",
    "symbol-popover",
    "table",
    "tabs",
    "tags",
    "terminal",
    "tested-chip",
    "timeline",
    "trust-panel",
    "variables-form",
    "version-badge",
    "version-diff",
    "video",
  ]);
});

test("reference rows and table headers use the mockup's quiet metrics", () => {
  assert.match(styles, /\.doc-body \.item strong,\s*\.doc-body \.list a strong \{[^}]*font-size: var\(--type-size-sm\);[^}]*line-height: var\(--type-leading-ui\);/s);
  assert.match(styles, /\.doc-body \.item span,\s*\.doc-body \.list a span,\s*\.doc-body \.item em,\s*\.doc-body \.list a em \{[^}]*font-size: var\(--type-size-sm\);[^}]*line-height: var\(--type-leading-ui\);/s);
  assert.match(styles, /\.doc-body th \{[^}]*color: var\(--color-muted\);/s);
});
