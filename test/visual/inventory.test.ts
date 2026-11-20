import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { buildFixture } from "./fixtures/build.ts";

interface Entry {
  readonly name: string;
  readonly selector: string;
  readonly page?: string;
  readonly variants?: readonly string[];
}

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const BUILD = join(ROOT, ".mizzen/inventory-gate");
const INVENTORY = JSON.parse(readFileSync(join(ROOT, "test/visual/inventory.json"), "utf8")) as { components: Entry[] };
const STATES = JSON.parse(readFileSync(join(ROOT, "test/visual/states.json"), "utf8")) as { components: { name: string }[] };

function components(): string[] {
  return readdirSync(join(ROOT, "components"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && readFileSync(join(ROOT, "components", entry.name, "index.ts"), "utf8").length > 0)
    .map((entry) => entry.name)
    .sort();
}

function docFor(page: string): Document {
  const file = page === "/" ? "index.html" : `${page.replace(/^\/|\/$/g, "")}/index.html`;
  return new JSDOM(readFileSync(join(BUILD, file), "utf8")).window.document;
}

test("the inventory covers every component, selector, variant and island", () => {
  buildFixture(BUILD);
  const expected = components();
  const inventoryNames = INVENTORY.components.map((entry) => entry.name);
  const errors: string[] = [];

  for (const name of expected) if (!inventoryNames.includes(name)) errors.push(`missing component: ${name}`);
  for (const name of inventoryNames) if (!expected.includes(name)) errors.push(`unknown component: ${name}`);

  const gallery = docFor("/gallery/");
  const inventoryPage = docFor("/inventory/");
  const allHtml = `${gallery.documentElement.outerHTML}\n${inventoryPage.documentElement.outerHTML}`;

  for (const entry of INVENTORY.components) {
    const doc = entry.page === undefined ? gallery : docFor(entry.page);
    if (doc.querySelector(entry.selector) === null) errors.push(`component ${entry.name}: selector not found: ${entry.selector}`);
    for (const variant of entry.variants ?? []) {
      if (!allHtml.includes(variant)) errors.push(`variant ${entry.name}: ${variant} has no fixture`);
    }
  }

  const islands = readdirSync(join(ROOT, "components"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && readdirSync(join(ROOT, "components", entry.name)).includes("client.ts"))
    .map((entry) => entry.name)
    .sort();
  const stateNames = new Set(STATES.components.map((entry) => entry.name));
  for (const name of islands) if (!stateNames.has(name)) errors.push(`client component ${name} has no states.json entry`);

  mkdirSync(join(ROOT, "test/visual/out"), { recursive: true });
  writeFileSync(
    join(ROOT, "test/visual/out/fixture-inventory.json"),
    `${JSON.stringify({ components: expected.length, variants: INVENTORY.components.reduce((n, entry) => n + (entry.variants?.length ?? 0), 0), clientComponents: islands.length, ok: errors.length === 0, errors }, null, 2)}\n`,
  );

  assert.deepEqual(errors, [], errors.join("\n"));
});
