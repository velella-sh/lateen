import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import type { Component, Site, SourcePos } from "@velella/mizzen/contracts";
import { renderToString } from "preact-render-to-string";
import { siteConfig } from "./helpers/site.ts";
import { pageWith } from "./helpers/page.ts";

/**
 * The component contract: every directive unit renders from the engine's shape with its optional
 * fields missing, an empty collection, and unknown values. None may throw or print invented text.
 */

const root = new URL("../", import.meta.url).pathname;

const pos: SourcePos = { file: "index.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

const page = pageWith({ url: "/", source: pos, frontMatter: { title: "Contract" }, title: "Contract" });

const config = siteConfig({ title: "Contract", navigation: "" });

/** An empty collection, so a component that reads records receives none rather than failing. */
const site: Site = {
  config,
  pages: [page],
  nav: {},
  data: {},
  collections: { empty: { name: "empty", source: "_data/empty.yml", records: [] } },
};

/** One render input: a label and the props the component receives beside the empty body. */
const CASES: readonly (readonly [string, Readonly<Record<string, unknown>>])[] = [
  ["missing optional fields", {}],
  ["empty collection", { from: "empty" }],
  [
    "unknown values",
    {
      from: 42,
      items: 42,
      type: 42,
      fields: 42,
      columns: 42,
      value: 42,
      status: 42,
      date: 42,
      order: 42,
      level: 42,
      group: 42,
      toc: 42,
      start: 42,
      months: 42,
      feed: 42,
      calendar: 42,
      src: 42,
      url: 42,
      href: 42,
      id: 42,
      title: 42,
      label: 42,
      name: 42,
      lang: 42,
      rows: 42,
    },
  ],
];

/** Values a render must never print when the author supplied nothing usable. */
const FABRICATED = /\b(?:undefined|NaN|null|Infinity)\b|\[object Object\]|lorem ipsum/i;

/** Render the component the way the host calls it, and return its text. */
function render(component: Component, props: Readonly<Record<string, unknown>>): string {
  return renderToString(
    component({ props, page, site, html: "" } as never) as never,
  );
}

/** Every `components/<name>/index.ts` whose module exports a directive name. */
async function directives(): Promise<{ readonly name: string; readonly component: Component }[]> {
  const found: { name: string; component: Component }[] = [];
  for (const entry of readdirSync(join(root, "components"), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = join(root, "components", entry.name, "index.ts");
    const mod = (await import(pathToFileURL(file).href)) as {
      readonly directive?: unknown;
      readonly default?: unknown;
    };
    if (typeof mod.directive === "string" && typeof mod.default === "function") {
      found.push({ name: entry.name, component: mod.default as Component });
    }
  }
  return found;
}

const units = await directives();

test("the scan finds the directive components", () => {
  assert.ok(units.length >= 40, `found only ${units.length} directive components`);
});

for (const { name, component } of units) {
  test(`${name}: missing optional fields, empty collections, and unknown values`, () => {
    for (const [label, props] of CASES) {
      const out = render(component, props);
      assert.doesNotMatch(out, FABRICATED, `${label} printed invented text`);
    }
  });
}
