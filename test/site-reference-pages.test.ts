import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const layouts = readFileSync(new URL("../site/layouts.md", import.meta.url), "utf8");
const components = readFileSync(new URL("../site/components/index.md", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles/src/ui.css", import.meta.url), "utf8");

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

test("component reference shows executable code tabs before its complete inventory", () => {
  const codeTabs = components.indexOf("## Code tabs");
  const inventory = components.indexOf("## In the library");
  assert.notEqual(codeTabs, -1);
  assert.notEqual(inventory, -1);
  assert.ok(codeTabs < inventory, "code tabs come before the inventory");
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
    "data-explorer",
    "compare",
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
    "os-tabs",
    "output-block",
    "network",
    "page-status",
    "preset-preview",
    "reading-time",
    "record-history",
    "report-issue",
    "reports",
    "schema-table",
    "stale-notice",
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
  assert.match(styles, /\.item strong,\s*\.list a strong \{[^}]*font-size: 0\.8125rem;[^}]*line-height: 1\.375rem;/s);
  assert.match(styles, /\.item span,\s*\.list a span,\s*\.item em,\s*\.list a em \{[^}]*font-size: 0\.9375rem;[^}]*line-height: 1\.5rem;/s);
  assert.match(styles, /\.doc-body th \{[^}]*color: var\(--muted-foreground\);/s);
});
